import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  validateCmsContent,
  hashContent,
  safeLink,
} from './cms-validation.js';
import { BLOCK_SCHEMAS } from './cms-schema.js';
describe('CMS content validation', () => {
  it('allows owners to explicitly enable or hide the optional hero trust strip', () => {
    for (const showTrustStrip of [false, true]) {
      const content = { title: 'Home', sections: [{ id: 'hero', type: 'hero', visible: true, config: { showTrustStrip } }] };
      expect(validateCmsContent('PAGE', content)).toEqual(content);
    }
  });
  it('accepts full banners, split content, mobile images and disabled slides', () => {
    const image = { assetId: '12345678-1234-1234-1234-123456789abc', alt: 'Shopping campaign' };
    const content = { title: 'Home', sections: [{ id: 'hero', type: 'hero', visible: true, config: {
      intervalSeconds: 5,
      slides: [
        { title: 'Shopping', slideType: 'full_banner', image, mobileImage: image, bannerLink: '/shop', enabled: true },
        { title: 'Fashion', slideType: 'split_content', image, subtitle: 'New arrivals', button: { label: 'Shop fashion', href: '/shop' }, backgroundGradient: 'linear-gradient(120deg, #fae6ef, #ffffff)', enabled: false },
      ],
    } }] };
    expect(validateCmsContent('PAGE', content)).toEqual(content);
  });
  it('rejects unsupported hero types, unsafe gradients and invalid mobile assets', () => {
    const page = (slide: Record<string, unknown>) => ({ title: 'Home', sections: [{ id: 'hero', type: 'hero', visible: true, config: { slides: [{ title: 'Offer', ...slide }] } }] });
    expect(() => validateCmsContent('PAGE', page({ slideType: 'unknown' }))).toThrow();
    expect(() => validateCmsContent('PAGE', page({ backgroundGradient: 'url(https://example.com/image)' }))).toThrow();
    expect(() => validateCmsContent('PAGE', page({ mobileImage: { assetId: 'invalid', alt: '' } }))).toThrow();
    expect(validateCmsContent('PAGE', page({ bannerType: 'without_button' }))).toBeTruthy();
  });
  it('accepts a homepage key and rejects URL-shaped homepage selectors', () => {
    const settings = { storeName: 'Store', locale: 'en', currency: 'BDT', homePageKey: 'hero' };
    expect(validateCmsContent('SITE_SETTINGS', settings)).toEqual(settings);
    for (const homePageKey of ['/hero', '../hero', 'https://example.com']) {
      expect(() => validateCmsContent('SITE_SETTINGS', { ...settings, homePageKey })).toThrow();
    }
  });
  it('accepts a complete theme', () => {
    expect(validateCmsContent('THEME', DEFAULT_THEME)).toEqual(DEFAULT_THEME);
  });
  it('rejects injected CSS and unknown tokens', () => {
    expect(() =>
      validateCmsContent('THEME', {
        ...DEFAULT_THEME,
        primary: 'url(javascript:evil)',
      }),
    ).toThrow();
    expect(() =>
      validateCmsContent('THEME', { ...DEFAULT_THEME, arbitrary: 'x' }),
    ).toThrow();
  });
  it('rejects unsupported page publishing', () => {
    expect(() => validateCmsContent('PAGE', { sections: [] })).toThrow();
  });
  it('registers all sixteen data-only block schemas', () => {
    expect(Object.keys(BLOCK_SCHEMAS)).toHaveLength(16);
  });
  it('accepts validated pages, settings and nested navigation', () => {
    expect(
      validateCmsContent('PAGE', {
        title: 'Supershop',
        sections: [
          {
            id: 'intro',
            type: 'richText',
            visible: true,
            config: {
              paragraphs: [
                'Electronics, fashion, books and household essentials.',
              ],
            },
          },
        ],
      }),
    ).toBeTruthy();
    expect(
      validateCmsContent('SITE_SETTINGS', {
        storeName: 'Multi-category store',
        locale: 'bn-BD',
        currency: 'BDT',
      }),
    ).toBeTruthy();
    expect(
      validateCmsContent('NAVIGATION', {
        label: 'Header',
        items: [
          {
            id: 'shop',
            label: 'Shop',
            href: '/products',
            children: [
              {
                id: 'electronics',
                label: 'Electronics',
                href: '/categories/electronics',
              },
            ],
          },
        ],
      }),
    ).toBeTruthy();
  });
  it('accepts categoryGrid with empty or omitted categoryIds', () => {
    expect(
      validateCmsContent('PAGE', {
        title: 'Home',
        sections: [
          {
            id: 'categories-showcase',
            type: 'categoryGrid',
            visible: true,
            config: {
              title: 'Shop by Department',
              columns: 6,
              categoryIds: [],
            },
          },
        ],
      }),
    ).toBeTruthy();
  });
  it('rejects executable fields, unknown blocks and duplicate section IDs', () => {
    const section = {
      id: 'same',
      type: 'hero',
      visible: true,
      config: { title: 'Shop' },
    };
    expect(() =>
      validateCmsContent('PAGE', {
        title: 'Page',
        sections: [
          { ...section, config: { title: 'Shop', onClick: 'evil()' } },
        ],
      }),
    ).toThrow('unknown');
    expect(() =>
      validateCmsContent('PAGE', {
        title: 'Page',
        sections: [{ ...section, type: 'script' }],
      }),
    ).toThrow();
    expect(() =>
      validateCmsContent('PAGE', {
        title: 'Page',
        sections: [section, section],
      }),
    ).toThrow('duplicate');
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        storeName: 'Shop',
        locale: 'en',
        currency: 'BDT',
        paymentSecret: 'not-allowed',
      }),
    ).toThrow('unknown');
  });
  it('validates tracking settings with strict allowlists and rejects secret tokens', () => {
    const valid = {
      storeName: 'DS Mart',
      locale: 'en',
      currency: 'BDT',
      tracking: {
        enabled: true,
        gtmId: 'GTM-W8XYZ12',
        serverUrl: 'https://ss.dsmart.digislashagency.com',
        ga4MeasurementId: 'G-XYZ1234567',
        metaPixelId: '123456789012345',
        consentDefault: 'denied',
        debugMode: true,
      },
    };
    expect(validateCmsContent('SITE_SETTINGS', valid)).toEqual(valid);

    // Rejects invalid GTM ID
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...valid,
        tracking: { ...valid.tracking, gtmId: '<script>' },
      }),
    ).toThrow('invalid format');

    // Rejects invalid server URL (e.g. http or containing paths)
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...valid,
        tracking: { ...valid.tracking, serverUrl: 'http://insecure.test' },
      }),
    ).toThrow('invalid format');
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...valid,
        tracking: { ...valid.tracking, serverUrl: 'https://ss.test/path' },
      }),
    ).toThrow('invalid format');

    // Rejects secret tokens and credentials as unknown fields
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...valid,
        tracking: { ...valid.tracking, metaAccessToken: 'secret-token-123' },
      }),
    ).toThrow('unknown field');

    // Rejects invalid consent choice
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...valid,
        tracking: { ...valid.tracking, consentDefault: 'auto' },
      }),
    ).toThrow('unsupported value');
  });
  it('enforces RBAC permissions: ADMIN cannot publish, only SUPER_ADMIN can', async () => {
    const { CmsAdminController } = await import('./cms.controller.js');
    const draftRoles = Reflect.getMetadata(
      'roles',
      CmsAdminController.prototype.draft,
    );
    const publishRoles = Reflect.getMetadata(
      'roles',
      CmsAdminController.prototype.publish,
    );
    const rollbackRoles = Reflect.getMetadata(
      'roles',
      CmsAdminController.prototype.rollback,
    );

    expect(draftRoles).toContain('ADMIN');
    expect(draftRoles).toContain('SUPER_ADMIN');
    expect(publishRoles).toEqual(['SUPER_ADMIN']);
    expect(publishRoles).not.toContain('ADMIN');
    expect(rollbackRoles).toEqual(['SUPER_ADMIN']);
  });
  it('records audit events with actorId, revision, and mutation state when tracking changes are saved', async () => {
    const { CmsService } = await import('./cms.service.js');
    const recordedAuditEvents: Array<any> = [];
    const recordedPubEvents: Array<any> = [];
    const mockTx = {
      cmsAuditEvent: {
        create: vi.fn(async (args: { data: any }) => {
          recordedAuditEvents.push(args.data);
          return args.data;
        }),
      },
      cmsPublicationEvent: {
        create: vi.fn(async (args: { data: any }) => {
          recordedPubEvents.push(args.data);
          return args.data;
        }),
      },
      $executeRaw: vi.fn(async () => 1),
    };
    const cmsService = new CmsService({} as any);
    await (cmsService as any).event(
      mockTx,
      'doc-settings-1',
      2,
      'super-admin-id',
      'DRAFT_SAVED',
      'version-1',
    );
    await (cmsService as any).event(
      mockTx,
      'doc-settings-1',
      3,
      'super-admin-id',
      'PUBLISHED',
      'version-1',
    );

    expect(recordedAuditEvents).toHaveLength(2);
    expect(recordedAuditEvents[0]).toMatchObject({
      documentId: 'doc-settings-1',
      actorId: 'super-admin-id',
      action: 'DRAFT_SAVED',
      versionId: 'version-1',
    });
    expect(recordedAuditEvents[1]).toMatchObject({
      documentId: 'doc-settings-1',
      actorId: 'super-admin-id',
      action: 'PUBLISHED',
      versionId: 'version-1',
    });
    expect(recordedPubEvents).toHaveLength(1);
    expect(recordedPubEvents[0]).toMatchObject({
      documentId: 'doc-settings-1',
      revision: 3,
      actorId: 'super-admin-id',
      action: 'PUBLISHED',
      versionId: 'version-1',
    });
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.test',
    '/%5cevil.test',
    'https://user:secret@host.test',
    '/%0aevil',
    '/%252fevil',
    ' https://safe.test',
  ])('rejects unsafe links: %s', (value) => {
    expect(safeLink(value)).toBe(false);
  });
  it('bounds numeric theme values, nesting and product selectors', () => {
    expect(() =>
      validateCmsContent('THEME', { ...DEFAULT_THEME, radius: 10000 }),
    ).toThrow();
    expect(() =>
      validateCmsContent('PAGE', {
        title: 'Page',
        sections: [
          {
            id: 'grid',
            type: 'productGrid',
            visible: true,
            config: { title: 'Products', source: 'selected' },
          },
        ],
      }),
    ).toThrow('productIds');
    expect(() =>
      validateCmsContent('NAVIGATION', {
        label: 'Menu',
        items: [
          { id: 'same', label: 'One', href: '/' },
          { id: 'same', label: 'Two', href: '/' },
        ],
      }),
    ).toThrow('duplicate');
  });
  it('hashes object keys canonically but preserves section order', () => {
    expect(hashContent({ a: 1, b: 2 })).toBe(hashContent({ b: 2, a: 1 }));
    expect(hashContent([1, 2])).not.toBe(hashContent([2, 1]));
  });
});
