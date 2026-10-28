import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { CmsDocumentKind, Prisma } from '../generated/prisma/client.js';
import {
  assetIds,
  hashContent,
  safeLink,
  validateCmsContent,
  validateCmsKey,
} from './cms-validation.js';
import { assertNewPageAddress, validNewPageAddress } from './page-address.js';
import { CmsQueryDto } from './cms.dto.js';

@Injectable()
export class CmsService {
  constructor(private readonly db: PrismaService) {}
  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.db.$transaction(work, {
        isolationLevel: 'Serializable',
        timeout: 10000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'CMS content changed concurrently. Reload and retry.',
        );
      throw error;
    }
  }
  private async lock(
    tx: Prisma.TransactionClient,
    kind: CmsDocumentKind,
    key: string,
  ) {
    validateCmsKey(key);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'cms:' + kind + ':' + key}))`;
  }
  private async assets(tx: Prisma.TransactionClient, content: unknown) {
    const ids = assetIds(content);
    if (!ids.length) return ids;
    const rows = await tx.cmsMediaAsset.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (
      rows.length !== ids.length ||
      rows.some((row) => !row.url || !safeLink(row.url))
    )
      throw new BadRequestException(
        'Content references unavailable media assets',
      );
    return ids;
  }
  private async event(
    tx: Prisma.TransactionClient,
    documentId: string,
    revision: number,
    actorId: string,
    action: string,
    versionId?: string | null,
    metadata?: Prisma.InputJsonValue,
  ) {
    await tx.cmsAuditEvent.create({
      data: { documentId, actorId, action, versionId, metadata },
    });
    if (
      ['PUBLISHED', 'ROLLED_BACK', 'UNPUBLISHED', 'ARCHIVED'].includes(action)
    ) {
      // Assign change-feed sequences in commit order across different documents.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71421004)`;
      await tx.cmsPublicationEvent.create({
        data: { documentId, revision, actorId, action, versionId },
      });
    }
  }
  private assertRevision(actual: number, expected: number) {
    if (
      !Number.isSafeInteger(expected) ||
      expected < 0 ||
      expected >= 2147483647 ||
      actual !== expected
    )
      throw new ConflictException(
        'Revision mismatch. Reload the document before saving.',
      );
  }
  async draft(
    kind: CmsDocumentKind,
    key: string,
    content: unknown,
    expectedRevision: number,
    actorId: string,
  ) {
    const validated = validateCmsContent(kind, content);
    return this.transaction(async (tx) => {
      await this.lock(tx, kind, key);
      const current = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind, key } },
      });
      if (kind === 'PAGE' && !current) assertNewPageAddress(key);
      this.assertRevision(current?.revision ?? 0, expectedRevision);
      const document =
        current ??
        (await tx.cmsDocument.create({
          data: { id: randomUUID(), kind, key },
        }));
      const ids = await this.assets(tx, validated);
      const latest = await tx.cmsVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { version: 'desc' },
      });
      const version = await tx.cmsVersion.create({
        data: {
          documentId: document.id,
          version: (latest?.version ?? 0) + 1,
          content: validated as Prisma.InputJsonValue,
          contentHash: hashContent(validated),
          createdBy: actorId,
        },
      });
      if (ids.length)
        await tx.cmsAssetReference.createMany({
          data: ids.map((assetId) => ({ assetId, versionId: version.id })),
        });
      const changed = await tx.cmsDocument.updateMany({
        where: { id: document.id, revision: expectedRevision },
        data: { revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Concurrent modification');
      await this.event(
        tx,
        document.id,
        expectedRevision + 1,
        actorId,
        'DRAFT_SAVED',
        version.id,
      );
      return {
        documentId: document.id,
        revision: expectedRevision + 1,
        version: version.version,
        versionId: version.id,
        contentHash: version.contentHash,
      };
    });
  }
  async pageAddress(key: string) {
    if (!validNewPageAddress(key))
      return { available: false, reason: 'reserved-or-invalid' };
    const exists = await this.db.cmsDocument.findUnique({
      where: { kind_key: { kind: 'PAGE', key } },
      select: { id: true },
    });
    return { available: !exists, reason: exists ? 'already-used' : null };
  }
  async homepageContext(settingsKey: string, fallbackHomeKey: string) {
    validateCmsKey(settingsKey);
    validateCmsKey(fallbackHomeKey);
    const settings = await this.db.cmsDocument.findUnique({
      where: { kind_key: { kind: 'SITE_SETTINGS', key: settingsKey } },
      include: { publication: true },
    });
    const live = settings?.state === 'PUBLISHED' ? settings.publication : null;
    const content = live?.content as Record<string, unknown> | undefined;
    return {
      settingsKey,
      settingsRevision: settings?.revision ?? 0,
      settingsPublished: !!live,
      homePageKey:
        typeof content?.homePageKey === 'string'
          ? content.homePageKey
          : fallbackHomeKey,
    };
  }
  async assignHomepage(
    settingsKey: string,
    pageKey: string,
    expectedSettingsRevision: number,
    expectedPageRevision: number,
    actorId: string,
  ) {
    return this.transaction(async (tx) => {
      await this.lock(tx, 'PAGE', pageKey);
      await this.lock(tx, 'SITE_SETTINGS', settingsKey);
      const page = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind: 'PAGE', key: pageKey } },
        include: { publication: true },
      });
      if (!page || page.state !== 'PUBLISHED' || !page.publication)
        throw new BadRequestException(
          'Publish this page before using it as the homepage.',
        );
      this.assertRevision(page.revision, expectedPageRevision);
      const settings = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind: 'SITE_SETTINGS', key: settingsKey } },
        include: { publication: true },
      });
      if (!settings || settings.state !== 'PUBLISHED' || !settings.publication)
        throw new BadRequestException(
          'Publish Store info first, then choose the homepage.',
        );
      this.assertRevision(settings.revision, expectedSettingsRevision);
      const live = settings.publication.content as Record<
        string,
        Prisma.JsonValue
      >;
      if (live.homePageKey === pageKey)
        return { homePageKey: pageKey, revision: settings.revision };
      const content = validateCmsContent('SITE_SETTINGS', {
        ...live,
        homePageKey: pageKey,
      });
      const ids = await this.assets(tx, content);
      const latest = await tx.cmsVersion.findFirst({
        where: { documentId: settings.id },
        orderBy: { version: 'desc' },
      });
      const published = await tx.cmsVersion.create({
        data: {
          documentId: settings.id,
          version: (latest?.version ?? 0) + 1,
          content: content as Prisma.InputJsonValue,
          contentHash: hashContent(content),
          createdBy: actorId,
        },
      });
      if (ids.length)
        await tx.cmsAssetReference.createMany({
          data: ids.map((assetId) => ({ assetId, versionId: published.id })),
        });
      // inspect() reads the highest snapshot as the draft. Keep an existing draft
      // at the head without changing or publishing any of its fields.
      if (latest && latest.id !== settings.publication.id) {
        const preserved = await tx.cmsVersion.create({
          data: {
            documentId: settings.id,
            version: published.version + 1,
            content: latest.content as Prisma.InputJsonValue,
            contentHash: latest.contentHash,
            createdBy: actorId,
          },
        });
        const draftAssets = assetIds(latest.content);
        if (draftAssets.length)
          await tx.cmsAssetReference.createMany({
            data: draftAssets.map((assetId) => ({
              assetId,
              versionId: preserved.id,
            })),
          });
        await this.event(
          tx,
          settings.id,
          settings.revision + 1,
          actorId,
          'DRAFT_PRESERVED',
          preserved.id,
          { reason: 'HOMEPAGE_ASSIGNED' },
        );
      }
      const changed = await tx.cmsDocument.updateMany({
        where: { id: settings.id, revision: expectedSettingsRevision },
        data: {
          publishedVersionId: published.id,
          publishedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Settings changed. Reload before assigning the homepage.',
        );
      await this.event(
        tx,
        settings.id,
        settings.revision + 1,
        actorId,
        'PUBLISHED',
        published.id,
        {
          reason: 'HOMEPAGE_ASSIGNED',
          before: live.homePageKey ?? null,
          after: pageKey,
          pageVersionId: page.publication.id,
        },
      );
      return { homePageKey: pageKey, revision: settings.revision + 1 };
    });
  }
  async publish(
    kind: CmsDocumentKind,
    key: string,
    expectedRevision: number,
    actorId: string,
    versionNumber?: number,
    action = 'PUBLISHED',
  ) {
    return this.transaction(async (tx) => {
      await this.lock(tx, kind, key);
      const document = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind, key } },
      });
      if (!document) throw new NotFoundException('CMS document not found');
      this.assertRevision(document.revision, expectedRevision);
      const version = await tx.cmsVersion.findFirst({
        where: {
          documentId: document.id,
          ...(versionNumber ? { version: versionNumber } : {}),
        },
        orderBy: { version: 'desc' },
      });
      if (!version) throw new NotFoundException('Version not found');
      validateCmsContent(kind, version.content);
      await this.assets(tx, version.content);
      await tx.cmsDocument.update({
        where: { id: document.id },
        data: {
          state: 'PUBLISHED',
          publishedVersionId: version.id,
          publishedAt: new Date(),
          revision: { increment: 1 },
          scheduledAt: null,
          scheduledVersionId: null,
          scheduledBy: null,
        },
      });
      await this.event(
        tx,
        document.id,
        expectedRevision + 1,
        actorId,
        action,
        version.id,
      );
      return {
        publishedVersion: version.version,
        revision: expectedRevision + 1,
      };
    });
  }
  async schedule(
    kind: CmsDocumentKind,
    key: string,
    expectedRevision: number,
    actorId: string,
    at: string,
    versionNumber?: number,
  ) {
    const date = new Date(at);
    if (
      !Number.isFinite(date.getTime()) ||
      date.getTime() <= Date.now() ||
      date.getTime() > Date.now() + 366 * 86400000
    )
      throw new BadRequestException('Schedule must be in the next 366 days');
    return this.transaction(async (tx) => {
      await this.lock(tx, kind, key);
      const doc = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind, key } },
      });
      if (!doc) throw new NotFoundException('CMS document not found');
      if (doc.state === 'ARCHIVED')
        throw new ConflictException(
          'Restore an archived document before scheduling',
        );
      this.assertRevision(doc.revision, expectedRevision);
      const version = await tx.cmsVersion.findFirst({
        where: {
          documentId: doc.id,
          ...(versionNumber ? { version: versionNumber } : {}),
        },
        orderBy: { version: 'desc' },
      });
      if (!version) throw new NotFoundException('Version not found');
      validateCmsContent(kind, version.content);
      await this.assets(tx, version.content);
      await tx.cmsDocument.update({
        where: { id: doc.id },
        data: {
          scheduledAt: date,
          scheduledVersionId: version.id,
          scheduledBy: actorId,
          revision: { increment: 1 },
        },
      });
      await this.event(
        tx,
        doc.id,
        expectedRevision + 1,
        actorId,
        'SCHEDULED',
        version.id,
        { scheduledAt: date.toISOString() },
      );
      return {
        revision: expectedRevision + 1,
        scheduledAt: date,
        version: version.version,
      };
    });
  }
  async cancelSchedule(
    kind: CmsDocumentKind,
    key: string,
    expectedRevision: number,
    actorId: string,
  ) {
    return this.transaction(async (tx) => {
      await this.lock(tx, kind, key);
      const doc = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind, key } },
      });
      if (!doc) throw new NotFoundException('CMS document not found');
      this.assertRevision(doc.revision, expectedRevision);
      await tx.cmsDocument.update({
        where: { id: doc.id },
        data: {
          scheduledAt: null,
          scheduledVersionId: null,
          scheduledBy: null,
          revision: { increment: 1 },
        },
      });
      await this.event(
        tx,
        doc.id,
        expectedRevision + 1,
        actorId,
        'SCHEDULE_CANCELLED',
      );
      return { revision: expectedRevision + 1 };
    });
  }
  async withdraw(
    kind: CmsDocumentKind,
    key: string,
    expectedRevision: number,
    actorId: string,
    archive = false,
  ) {
    return this.transaction(async (tx) => {
      await this.lock(tx, kind, key);
      const doc = await tx.cmsDocument.findUnique({
        where: { kind_key: { kind, key } },
      });
      if (!doc) throw new NotFoundException('CMS document not found');
      this.assertRevision(doc.revision, expectedRevision);
      await tx.cmsDocument.update({
        where: { id: doc.id },
        data: {
          state: archive ? 'ARCHIVED' : 'DRAFT',
          publishedVersionId: null,
          publishedAt: null,
          scheduledAt: null,
          scheduledVersionId: null,
          scheduledBy: null,
          revision: { increment: 1 },
        },
      });
      await this.event(
        tx,
        doc.id,
        expectedRevision + 1,
        actorId,
        archive ? 'ARCHIVED' : 'UNPUBLISHED',
        doc.publishedVersionId,
      );
      return { revision: expectedRevision + 1 };
    });
  }
  async publicPages(query: CmsQueryDto) {
    const documents = await this.db.cmsDocument.findMany({
      where: {
        kind: 'PAGE',
        state: 'PUBLISHED',
        publishedVersionId: { not: null },
      },
      select: {
        key: true,
        publishedAt: true,
        publication: { select: { content: true } },
      },
      orderBy: { key: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: documents
        .filter(
          (doc) =>
            !(doc.publication?.content as { seo?: { noIndex?: boolean } })?.seo
              ?.noIndex,
        )
        .map((doc) => ({ key: doc.key, publishedAt: doc.publishedAt })),
      hasMore: documents.length === query.limit,
    };
  }
  async published(kind: CmsDocumentKind, key: string) {
    validateCmsKey(key);
    const doc = await this.db.cmsDocument.findUnique({
      where: { kind_key: { kind, key } },
      include: { publication: true },
    });
    if (!doc || doc.state !== 'PUBLISHED' || !doc.publication)
      throw new NotFoundException('Published content not found');
    // Explicit projection: never send drafts, internal revisions, audit actors or schedules.
    return {
      kind,
      key,
      version: doc.publication.version,
      content: doc.publication.content,
      assets: await this.db.cmsMediaAsset.findMany({
        where: {
          id: { in: assetIds(doc.publication.content) },
          deletedAt: null,
        },
        select: { id: true, url: true, thumbnailUrl: true, altText: true },
      }),
      etag: '"' + doc.publication.id + '-' + doc.publication.contentHash + '"',
    };
  }
  async inspect(kind: CmsDocumentKind, key: string) {
    validateCmsKey(key);
    const doc = await this.db.cmsDocument.findUnique({
      where: { kind_key: { kind, key } },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!doc) throw new NotFoundException('CMS document not found');
    return {
      ...doc,
      latestVersion: doc.versions[0] ?? null,
      versions: undefined,
    };
  }
  async version(kind: CmsDocumentKind, key: string, versionNumber: number) {
    if (
      !Number.isSafeInteger(versionNumber) ||
      versionNumber < 1 ||
      versionNumber > 2147483646
    )
      throw new BadRequestException('Invalid version number');
    const doc = await this.inspect(kind, key);
    const version = await this.db.cmsVersion.findUnique({
      where: {
        documentId_version: { documentId: doc.id, version: versionNumber },
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }
  async history(
    kind: CmsDocumentKind,
    key: string,
    query: CmsQueryDto,
    events = false,
  ) {
    const doc = await this.inspect(kind, key);
    const where = { documentId: doc.id };
    if (events) {
      const [items, total] = await this.db.$transaction([
        this.db.cmsAuditEvent.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
        }),
        this.db.cmsAuditEvent.count({ where }),
      ]);
      return { items, total, page: query.page };
    }
    const [items, total] = await this.db.$transaction([
      this.db.cmsVersion.findMany({
        where,
        select: {
          id: true,
          version: true,
          contentHash: true,
          createdBy: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      this.db.cmsVersion.count({ where }),
    ]);
    return { items, total, page: query.page };
  }
  async list(query: CmsQueryDto) {
    const where = query.kind ? { kind: query.kind } : {};
    const [items, total] = await this.db.$transaction([
      this.db.cmsDocument.findMany({
        where,
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { content: true },
          },
        },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.cmsDocument.count({ where }),
    ]);
    return {
      items: items.map(({ versions, ...item }) => ({
        ...item,
        title: (versions[0]?.content as Record<string, unknown> | undefined)
          ?.title,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  async changes(query: CmsQueryDto) {
    if (BigInt(query.after) > 9223372036854775807n)
      throw new BadRequestException('Invalid change-feed cursor');
    const items = await this.db.cmsPublicationEvent.findMany({
      where: { sequence: { gt: BigInt(query.after) } },
      take: query.limit,
      orderBy: { sequence: 'asc' },
      include: { document: { select: { kind: true, key: true } } },
    });
    return {
      items: items.map((row) => ({
        ...row,
        sequence: row.sequence.toString(),
      })),
      next: items.at(-1)?.sequence.toString() ?? query.after,
    };
  }
  async media(query: CmsQueryDto) {
    const [items, total] = await this.db.$transaction([
      this.db.cmsMediaAsset.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          altText: true,
          mimeType: true,
          bytes: true,
          width: true,
          height: true,
          createdAt: true,
        },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.cmsMediaAsset.count({ where: { deletedAt: null } }),
    ]);
    return { items, total, page: query.page };
  }
  async publishDue(limit = 50) {
    const due = await this.db.cmsDocument.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        scheduledVersionId: { not: null },
      },
      take: Math.min(100, Math.max(1, limit)),
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      select: { id: true, kind: true, key: true },
    });
    const results: { id: string; status: string; error?: string }[] = [];
    for (const item of due) {
      try {
        const status = await this.transaction(async (tx) => {
          await this.lock(tx, item.kind, item.key);
          const doc = await tx.cmsDocument.findUnique({
            where: { id: item.id },
            include: { scheduledVersion: true },
          });
          if (
            !doc?.scheduledAt ||
            doc.scheduledAt > new Date() ||
            !doc.scheduledVersion
          )
            return 'SKIPPED';
          const actor =
            doc.scheduledBy &&
            (await tx.adminUser.findUnique({ where: { id: doc.scheduledBy } }));
          if (!actor || !actor.isActive || actor.role !== 'SUPER_ADMIN') {
            await tx.cmsDocument.update({
              where: { id: doc.id },
              data: {
                scheduledAt: null,
                scheduledVersionId: null,
                scheduledBy: null,
                revision: { increment: 1 },
              },
            });
            await this.event(
              tx,
              doc.id,
              doc.revision + 1,
              doc.scheduledBy ?? 'system',
              'SCHEDULE_REVOKED',
            );
            return 'REVOKED';
          }
          validateCmsContent(doc.kind, doc.scheduledVersion.content);
          await this.assets(tx, doc.scheduledVersion.content);
          await tx.cmsDocument.update({
            where: { id: doc.id },
            data: {
              publishedVersionId: doc.scheduledVersion.id,
              state: 'PUBLISHED',
              publishedAt: new Date(),
              scheduledAt: null,
              scheduledVersionId: null,
              scheduledBy: null,
              revision: { increment: 1 },
            },
          });
          await this.event(
            tx,
            doc.id,
            doc.revision + 1,
            actor.id,
            'PUBLISHED',
            doc.scheduledVersion.id,
            { scheduled: true },
          );
          return 'PUBLISHED';
        });
        results.push({ id: item.id, status });
      } catch (error) {
        results.push({
          id: item.id,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Publication failed',
        });
      }
    }
    return { results };
  }
}
