import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  validateCmsContent,
  hashContent,
  safeLink,
} from './cms-validation.js';
import { BLOCK_SCHEMAS } from './cms-schema.js';
describe('CMS content validation', () => {
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
  it('registers all fourteen data-only block schemas', () => {
    expect(Object.keys(BLOCK_SCHEMAS)).toHaveLength(14);
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
