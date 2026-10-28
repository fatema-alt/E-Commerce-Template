import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../auth/auth.guard.js';
import { CmsAdminController } from './cms.controller.js';
import { CmsService } from './cms.service.js';
import { assertNewPageAddress, validNewPageAddress } from './page-address.js';
import { hashContent } from './cms-validation.js';
function fixture(draft = true) {
  const live = {
    storeName: 'Live store',
    locale: 'en',
    currency: 'BDT',
    homePageKey: 'old-home',
    announcement: { enabled: true, text: 'Live message' },
  };
  const privateContent = {
    ...live,
    storeName: 'Private new name',
    announcement: { enabled: true, text: 'Private announcement' },
  };
  const versions: any[] = [
    {
      id: 'live',
      documentId: 'settings',
      version: 1,
      content: structuredClone(live),
      contentHash: hashContent(live),
    },
  ];
  if (draft)
    versions.push({
      id: 'draft',
      documentId: 'settings',
      version: 2,
      content: structuredClone(privateContent),
      contentHash: hashContent(privateContent),
    });
  const settings: any = {
    id: 'settings',
    key: 'default',
    state: 'PUBLISHED',
    revision: 5,
    publishedVersionId: 'live',
    scheduledAt: new Date('2030-01-01'),
    scheduledVersionId: 'draft',
    scheduledBy: 'other-admin',
  };
  const page: any = {
    id: 'page',
    key: 'landing',
    state: 'PUBLISHED',
    revision: 3,
    publication: { id: 'page-live' },
  };
  const audits: any[] = [],
    publications: any[] = [];
  const tx: any = {
    $executeRaw: vi.fn(),
    cmsDocument: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.kind_key.kind === 'PAGE'
          ? page
          : {
              ...settings,
              publication: versions.find(
                (v) => v.id === settings.publishedVersionId,
              ),
            },
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (settings.revision !== where.revision) return { count: 0 };
        Object.assign(settings, { ...data, revision: settings.revision + 1 });
        return { count: 1 };
      }),
    },
    cmsVersion: {
      findFirst: vi.fn(async () => versions.at(-1)),
      create: vi.fn(async ({ data }: any) => {
        const result = {
          id: 'v' + (versions.length + 1),
          ...structuredClone(data),
        };
        versions.push(result);
        return result;
      }),
    },
    cmsAssetReference: { createMany: vi.fn() },
    cmsMediaAsset: { findMany: vi.fn(async () => []) },
    cmsAuditEvent: {
      create: vi.fn(async ({ data }: any) => audits.push(data)),
    },
    cmsPublicationEvent: {
      create: vi.fn(async ({ data }: any) => publications.push(data)),
    },
  };
  const db: any = { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  return {
    service: new CmsService(db),
    db,
    tx,
    live,
    privateContent,
    settings,
    page,
    versions,
    audits,
    publications,
  };
}
describe('CMS homepage assignment', () => {
  it('publishes only homepage selection and preserves the exact private draft and schedule', async () => {
    const f = fixture();
    await f.service.assignHomepage('default', 'landing', 5, 3, 'super-admin');
    const published = f.versions.find(
      (v) => v.id === f.settings.publishedVersionId,
    );
    expect(published.content).toEqual({ ...f.live, homePageKey: 'landing' });
    expect(f.versions.at(-1).content).toEqual(f.privateContent);
    expect(f.versions[1].content).toEqual(f.privateContent);
    expect(f.settings.scheduledVersionId).toBe('draft');
    expect(f.settings.scheduledBy).toBe('other-admin');
    expect(f.audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'super-admin',
          action: 'PUBLISHED',
          metadata: expect.objectContaining({
            reason: 'HOMEPAGE_ASSIGNED',
            before: 'old-home',
            after: 'landing',
          }),
        }),
      ]),
    );
    expect(f.publications).toHaveLength(1);
    expect(f.settings.revision).toBe(6);
  });
  it('creates one immutable snapshot when there is no private draft', async () => {
    const f = fixture(false);
    await f.service.assignHomepage('default', 'landing', 5, 3, 'actor');
    expect(f.versions).toHaveLength(2);
  });
  it('does not add history when the page is already assigned', async () => {
    const f = fixture();
    f.versions[0].content.homePageKey = 'landing';
    await f.service.assignHomepage('default', 'landing', 5, 3, 'actor');
    expect(f.tx.cmsVersion.create).not.toHaveBeenCalled();
  });
  it.each(['DRAFT', 'ARCHIVED'])('rejects a %s target', async (state) => {
    const f = fixture();
    f.page.state = state;
    await expect(
      f.service.assignHomepage('default', 'landing', 5, 3, 'actor'),
    ).rejects.toThrow('Publish this page');
    expect(f.tx.cmsVersion.create).not.toHaveBeenCalled();
  });
  it('rejects a page without a publication', async () => {
    const f = fixture();
    f.page.publication = null;
    await expect(
      f.service.assignHomepage('default', 'landing', 5, 3, 'actor'),
    ).rejects.toThrow('Publish this page');
  });
  it('requires already-published store settings', async () => {
    const f = fixture();
    f.settings.state = 'DRAFT';
    await expect(
      f.service.assignHomepage('default', 'landing', 5, 3, 'actor'),
    ).rejects.toThrow('Publish Store info first');
  });
  it.each([
    [4, 3],
    [5, 2],
  ])(
    'rejects stale settings/page revisions %s/%s',
    async (settingsRevision, pageRevision) => {
      const f = fixture();
      await expect(
        f.service.assignHomepage(
          'default',
          'landing',
          settingsRevision,
          pageRevision,
          'actor',
        ),
      ).rejects.toThrow('Revision mismatch');
      expect(f.tx.cmsVersion.create).not.toHaveBeenCalled();
    },
  );
  it('resolves homepage from published content, not the latest draft', async () => {
    const f = fixture();
    f.versions.at(-1).content.homePageKey = 'private-home';
    expect(await f.service.homepageContext('default', 'home')).toMatchObject({
      homePageKey: 'old-home',
      settingsRevision: 5,
      settingsPublished: true,
    });
  });
  it('uses the configured fallback without treating drafts as published', async () => {
    const f = fixture();
    f.settings.state = 'DRAFT';
    expect(
      await f.service.homepageContext('default', 'fallback'),
    ).toMatchObject({ homePageKey: 'fallback', settingsPublished: false });
  });
  it('reports address collisions and reserved routes', async () => {
    const f = fixture();
    expect(await f.service.pageAddress('landing')).toMatchObject({
      available: false,
      reason: 'already-used',
    });
    expect(await f.service.pageAddress('checkout')).toMatchObject({
      available: false,
    });
  });
});
describe('page URL validation', () => {
  it.each([
    'cart',
    'checkout',
    'shop',
    'product',
    'category',
    'orders',
    'account',
    'help',
    'contact',
    'api',
  ])('rejects reserved URL %s', (value) => {
    expect(validNewPageAddress(value)).toBe(false);
    expect(() => assertNewPageAddress(value)).toThrow();
  });
  it.each(['About Us', '../page', 'UPPER', '', 'a'.repeat(65)])(
    'rejects unsafe/invalid URL %s',
    (value) => expect(validNewPageAddress(value)).toBe(false),
  );
  it.each(['about-us', 'home', 'faq', 'policy_2026'])('allows %s', (value) =>
    expect(validNewPageAddress(value)).toBe(true),
  );
});
describe('homepage assignment backend permission', () => {
  it.each(['STAFF', 'ADMIN', 'SUPER_ADMIN'])(
    'checks %s independently of UI',
    async (role) => {
      const guard = new AdminGuard(new Reflector(), {
        session: vi.fn(async () => ({ id: 'actor', role })),
      } as never);
      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            headers: {
              cookie: 'commerce_admin_session=token',
              'x-commerce-admin': '1',
              origin: 'http://localhost:3001',
            },
          }),
        }),
        getHandler: () => CmsAdminController.prototype.assignHomepage,
        getClass: () => CmsAdminController,
      };
      if (role === 'SUPER_ADMIN')
        expect(await guard.canActivate(context)).toBe(true);
      else await expect(guard.canActivate(context)).rejects.toThrow();
    },
  );
});
