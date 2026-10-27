import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.js';
import { CmsService } from './cms.service.js';
import { DEFAULT_THEME } from './cms-schema.js';
import { CmsQueryDto } from './cms.dto.js';

describe.skipIf(!process.env.CMS_TEST_DATABASE_URL)(
  'CMS PostgreSQL foundation',
  () => {
    let db: PrismaClient;
    let cms: CmsService;
    let actor: string;
    const key = () => 'test-' + randomUUID();
    beforeAll(async () => {
      const url = new URL(process.env.CMS_TEST_DATABASE_URL!);
      if (!url.pathname.startsWith('/commerce_cms_validation_'))
        throw new Error(
          'CMS tests require an isolated commerce_cms_validation_ database',
        );
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.$connect();
      cms = new CmsService(db as never);
      actor = (
        await db.adminUser.create({
          data: {
            email: key() + '@cms.test',
            passwordHash: 'not-used-for-authentication',
            role: 'SUPER_ADMIN',
          },
        })
      ).id;
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('persists ribbon CRUD, order, contact settings and independent published snapshots', async () => {
      const name = key();
      const content = { storeName: 'DS Mart', locale: 'en', currency: 'BDT', announcementRibbon: { enabled: true, animation: 'fade', intervalSeconds: 5, items: [{ id: 'one', enabled: true, text: 'First message', device: 'both' }, { id: 'two', enabled: false, text: 'Second message', device: 'mobile' }] }, contactWidget: { enabled: true, title: 'Store Support', description: 'Contact us', position: 'right', desktop: true, mobile: true, phone: { enabled: true, number: '+8801712345678' } } };
      await cms.draft('SITE_SETTINGS', name, content, 0, actor);
      await cms.publish('SITE_SETTINGS', name, 1, actor);
      expect((await cms.published('SITE_SETTINGS', name)).content).toEqual(content);
      const edited = structuredClone(content);
      edited.announcementRibbon.items.reverse(); edited.announcementRibbon.items[0]!.enabled = true; edited.announcementRibbon.items[0]!.text = 'Edited message';
      edited.contactWidget.phone.number = '+8801812345678';
      await cms.draft('SITE_SETTINGS', name, edited, 2, actor);
      expect((await cms.published('SITE_SETTINGS', name)).content).toEqual(content);
      await cms.publish('SITE_SETTINGS', name, 3, actor);
      expect((await cms.published('SITE_SETTINGS', name)).content).toEqual(edited);
      edited.announcementRibbon.items.pop(); edited.contactWidget.enabled = false;
      await cms.draft('SITE_SETTINGS', name, edited, 4, actor);
      await cms.publish('SITE_SETTINGS', name, 5, actor);
      expect((await cms.published('SITE_SETTINGS', name)).content).toEqual(edited);
    });
    it('keeps drafts private and supports repeated publish after revision changes', async () => {
      const name = key();
      const draft = await cms.draft('THEME', name, DEFAULT_THEME, 0, actor);
      await expect(cms.published('THEME', name)).rejects.toThrow(
        'Published content not found',
      );
      const publication = await cms.publish(
        'THEME',
        name,
        draft.revision,
        actor,
      );
      expect(publication).toEqual({ revision: 2, publishedVersion: 1 });
      expect(
        await cms.publish('THEME', name, publication.revision, actor),
      ).toEqual({ revision: 3, publishedVersion: 1 });
      const content = await cms.published('THEME', name);
      expect(content.content).toEqual(DEFAULT_THEME);
      expect(content).not.toHaveProperty('scheduledBy');
    });
    it('saves later drafts without changing the published snapshot or ETag', async () => {
      const name = key();
      await cms.draft('THEME', name, DEFAULT_THEME, 0, actor);
      await cms.publish('THEME', name, 1, actor);
      const before = await cms.published('THEME', name);
      const next = await cms.draft(
        'THEME',
        name,
        { ...DEFAULT_THEME, primary: '#111111' },
        2,
        actor,
      );
      expect(next.version).toBe(2);
      expect(next.revision).toBe(3);
      expect(await cms.published('THEME', name)).toEqual(before);
      await expect(cms.publish('THEME', name, 2, actor)).rejects.toThrow(
        'Revision mismatch',
      );
    });
    it('rolls back via a publication pointer without editing or deleting versions', async () => {
      const name = key();
      await cms.draft('THEME', name, DEFAULT_THEME, 0, actor);
      await cms.publish('THEME', name, 1, actor);
      await cms.draft(
        'THEME',
        name,
        { ...DEFAULT_THEME, primary: '#222222' },
        2,
        actor,
      );
      await cms.publish('THEME', name, 3, actor);
      await cms.publish('THEME', name, 4, actor, 1, 'ROLLED_BACK');
      expect((await cms.published('THEME', name)).content).toEqual(
        DEFAULT_THEME,
      );
      const doc = await cms.inspect('THEME', name);
      expect(await db.cmsVersion.count({ where: { documentId: doc.id } })).toBe(
        2,
      );
      const events = await db.cmsPublicationEvent.findMany({
        where: { documentId: doc.id },
      });
      expect(events.map((row) => row.action)).toEqual([
        'PUBLISHED',
        'PUBLISHED',
        'ROLLED_BACK',
      ]);
    });
    it('rejects two concurrent writers with the same revision without losing history', async () => {
      const name = key();
      const results = await Promise.allSettled([
        cms.draft('THEME', name, DEFAULT_THEME, 0, actor),
        cms.draft(
          'THEME',
          name,
          { ...DEFAULT_THEME, primary: '#333333' },
          0,
          actor,
        ),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
      const doc = await cms.inspect('THEME', name);
      expect(doc.revision).toBe(1);
      expect(await db.cmsVersion.count({ where: { documentId: doc.id } })).toBe(
        1,
      );
    });
    it('enforces published version ownership and immutable history in PostgreSQL', async () => {
      const a = await cms.draft('THEME', key(), DEFAULT_THEME, 0, actor),
        b = await cms.draft('THEME', key(), DEFAULT_THEME, 0, actor);
      await expect(
        db.cmsDocument.update({
          where: { id: a.documentId },
          data: { state: 'PUBLISHED', publishedVersionId: b.versionId },
        }),
      ).rejects.toThrow();
      await expect(
        db.cmsVersion.update({
          where: { id: a.versionId },
          data: { content: {} },
        }),
      ).rejects.toThrow();
      await expect(
        db.cmsVersion.delete({ where: { id: a.versionId } }),
      ).rejects.toThrow();
      const event = await db.cmsAuditEvent.findFirstOrThrow({
        where: { documentId: a.documentId },
      });
      await expect(
        db.cmsAuditEvent.delete({ where: { id: event.id } }),
      ).rejects.toThrow();
    });
    it('pins scheduled versions while permitting newer drafts', async () => {
      const name = key();
      const draft = await cms.draft(
        'PAGE',
        name,
        { title: 'Scheduled snapshot', sections: [] },
        0,
        actor,
      );
      await cms.schedule(
        'PAGE',
        name,
        1,
        actor,
        new Date(Date.now() + 60000).toISOString(),
      );
      await cms.draft(
        'PAGE',
        name,
        { title: 'Unpublished newer draft', sections: [] },
        2,
        actor,
      );
      await db.cmsDocument.update({
        where: { id: draft.documentId },
        data: { scheduledAt: new Date(Date.now() - 1000) },
      });
      const workers = await Promise.all([cms.publishDue(), cms.publishDue()]);
      expect(
        workers
          .flatMap((result) => result.results)
          .filter(
            (result) =>
              result.id === draft.documentId && result.status === 'PUBLISHED',
          ),
      ).toHaveLength(1);
      expect((await cms.published('PAGE', name)).content).toEqual({
        title: 'Scheduled snapshot',
        sections: [],
      });
      expect(
        await db.cmsPublicationEvent.count({
          where: { documentId: draft.documentId },
        }),
      ).toBe(1);
    });
    it('revokes schedules when their publisher loses permission', async () => {
      const user = await db.adminUser.create({
        data: {
          email: key() + '@cms.test',
          passwordHash: 'unused',
          role: 'SUPER_ADMIN',
        },
      });
      const name = key();
      const draft = await cms.draft('THEME', name, DEFAULT_THEME, 0, user.id);
      await cms.schedule(
        'THEME',
        name,
        1,
        user.id,
        new Date(Date.now() + 60000).toISOString(),
      );
      await db.adminUser.update({
        where: { id: user.id },
        data: { role: 'STAFF' },
      });
      await db.cmsDocument.update({
        where: { id: draft.documentId },
        data: { scheduledAt: new Date(Date.now() - 1000) },
      });
      expect(
        (await cms.publishDue()).results.find(
          (row) => row.id === draft.documentId,
        )?.status,
      ).toBe('REVOKED');
      await expect(cms.published('THEME', name)).rejects.toThrow();
    });
    it('unpublishes/archives without deleting drafts, history or audit events', async () => {
      const name = key();
      const draft = await cms.draft('THEME', name, DEFAULT_THEME, 0, actor);
      await cms.publish('THEME', name, 1, actor);
      await cms.withdraw('THEME', name, 2, actor, true);
      await expect(cms.published('THEME', name)).rejects.toThrow();
      expect((await cms.inspect('THEME', name)).state).toBe('ARCHIVED');
      expect(
        await db.cmsVersion.count({ where: { documentId: draft.documentId } }),
      ).toBe(1);
      await cms.publish('THEME', name, 3, actor, 1);
      expect((await cms.published('THEME', name)).version).toBe(1);
    });
    it('retains media references and rejects unavailable assets during publication', async () => {
      const asset = await db.cmsMediaAsset.create({
        data: {
          storageKey: randomUUID() + '.webp',
          mimeType: 'image/webp',
          bytes: 100,
          width: 64,
          height: 64,
          url: '/uploads/products/test.webp',
          uploadedBy: actor,
        },
      });
      const name = key();
      const draft = await cms.draft(
        'PAGE',
        name,
        {
          title: 'Media',
          sections: [
            {
              id: 'hero',
              type: 'hero',
              visible: true,
              config: {
                title: 'Shop',
                image: { assetId: asset.id, alt: 'Supershop' },
              },
            },
          ],
        },
        0,
        actor,
      );
      expect(
        await db.cmsAssetReference.count({
          where: { versionId: draft.versionId },
        }),
      ).toBe(1);
      await expect(
        db.cmsMediaAsset.delete({ where: { id: asset.id } }),
      ).rejects.toThrow();
      await db.cmsMediaAsset.update({
        where: { id: asset.id },
        data: { deletedAt: new Date() },
      });
      await expect(cms.publish('PAGE', name, 1, actor)).rejects.toThrow(
        'unavailable',
      );
      expect(
        await db.cmsPublicationEvent.count({
          where: { documentId: draft.documentId },
        }),
      ).toBe(0);
    });
    it('paginates history and serializes change-feed cursors without BigInt errors', async () => {
      const name = key();
      await cms.draft('THEME', name, DEFAULT_THEME, 0, actor);
      await cms.draft('THEME', name, DEFAULT_THEME, 1, actor);
      const history = await cms.history(
        'THEME',
        name,
        Object.assign(new CmsQueryDto(), { limit: 1 }),
      );
      expect(history.items).toHaveLength(1);
      expect(history.total).toBe(2);
      const changes = await cms.changes(new CmsQueryDto());
      expect(() => JSON.stringify(changes)).not.toThrow();
      expect(typeof changes.next).toBe('string');
    });
  },
);
