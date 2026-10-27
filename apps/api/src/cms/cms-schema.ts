export type Schema = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: readonly unknown[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  minItems?: number;
  pattern?: string;
  format?: 'link' | 'email';
};
const text = (maxLength = 200, minLength = 1): Schema => ({
  type: 'string',
  minLength,
  maxLength,
});
const number = (min: number, max: number): Schema => ({
  type: 'number',
  min,
  max,
});
const bool: Schema = { type: 'boolean' };
const choice = (...values: string[]): Schema => ({
  type: 'string',
  enum: values,
});
export const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({ type: 'object', properties, required });
const array = (items: Schema, maxItems = 30, minItems = 0): Schema => ({
  type: 'array',
  items,
  maxItems,
  minItems,
});
const id: Schema = { ...text(64), pattern: '^[a-zA-Z0-9_-]+$' };
const uuid: Schema = {
  ...text(36),
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
};
const link: Schema = { ...text(2048), format: 'link' };
const color: Schema = { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' };
const button = object({ label: text(80), href: link });
const image = object({ assetId: uuid, alt: text(200, 0), href: link }, [
  'assetId',
  'alt',
]);
const productSource = {
  title: text(),
  source: choice('featured', 'latest', 'category', 'selected', 'sale', 'trending', 'recommended'),
  categoryId: uuid,
  productIds: array(uuid, 100, 0),
  limit: number(1, 100),
  columns: number(1, 6),
};

// Data-only registry. Renderer imports are intentionally deferred to Step 5.
export const BLOCK_SCHEMAS: Record<string, Schema> = {
  hero: object(
    {
      bannerType: choice('with_button', 'without_button'),
      title: text(200, 0),
      subtitle: text(1000, 0),
      image: image,
      bannerLink: link,
      button,
      align: choice('left', 'center', 'right'),
      intervalSeconds: number(3, 30),
      slides: array(object({
        slideType: choice('full_banner', 'split_content'),
        enabled: bool,
        title: text(200, 0),
        subtitle: text(1000, 0),
        bannerType: choice('with_button', 'without_button'),
        image,
        mobileImage: image,
        backgroundGradient: { ...text(300), pattern: '^(linear|radial)-gradient\\([#%(),.\\s\\w-]+\\)$' },
        bannerLink: link,
        button,
        secondaryButton: button,
        badge: text(200, 0),
        badgeColor: choice('amber', 'emerald', 'purple'),
        theme: choice('lime', 'blue', 'pink'),
        floatingBadges: array(object({ icon: text(20), text: text(200) }), 3),
      }, ['title']), 10, 1),
    },
    [],
  ),
  bannerSlider: object(
    {
      slides: array(
        object({ title: text(), image, subtitle: text(1000, 0), button }, [
          'title',
          'image',
        ]),
        10,
        1,
      ),
      intervalSeconds: number(3, 30),
    },
    ['slides'],
  ),
  categoryGrid: object(
    { title: text(), categoryIds: array(uuid, 50, 0), columns: number(1, 8) },
    ['title'],
  ),
  productGrid: object(productSource, ['title', 'source']),
  productCarousel: object(productSource, ['title', 'source']),
  featuredCollections: object({
    title: text(),
    collections: array(
      object({ name: text(100), image, href: link }, ['name', 'href']),
      20,
      1,
    ),
  }),
  brandShowcase: object({
    title: text(),
    brands: array(
      object({ name: text(100), image, href: link }, ['name']),
      40,
      1,
    ),
  }),
  flashSale: object(
    {
      ...productSource,
      endsAt: { ...text(30), pattern: '^\\d{4}-\\d{2}-\\d{2}T' },
    },
    ['title', 'source', 'endsAt'],
  ),
  promoBanner: object(
    { title: text(), description: text(1000, 0), image, button },
    ['title'],
  ),
  imageText: object(
    {
      title: text(),
      paragraphs: array(text(5000), 20, 1),
      image,
      imagePosition: choice('left', 'right'),
      button,
    },
    ['title', 'paragraphs', 'image'],
  ),
  richText: object({ title: text(), paragraphs: array(text(10000), 30, 1) }, [
    'paragraphs',
  ]),
  faq: object({
    title: text(),
    items: array(object({ question: text(500), answer: text(5000) }), 30, 1),
  }),
  newsletter: object(
    {
      title: text(),
      description: text(1000, 0),
      buttonLabel: text(80),
      consentText: text(1000),
      privacyHref: link,
    },
    ['title', 'buttonLabel', 'consentText', 'privacyHref'],
  ),
  trustFeatures: object(
    {
      title: text(),
      items: array(
        object({
          title: text(100),
          description: text(500),
          icon: choice(
            'shield',
            'truck',
            'return',
            'support',
            'payment',
            'quality',
          ),
        }),
        12,
        1,
      ),
    },
    ['items'],
  ),
  recentlyViewed: object(
    {
      title: text(),
      limit: number(1, 24),
    },
    ['title'],
  ),
  customerReviews: object(
    {
      title: text(),
      subtitle: text(1000, 0),
      limit: number(1, 20),
    },
    ['title'],
  ),
};

export const DEFAULT_THEME = {
  primary: '#48725C',
  background: '#F8F7F2',
  heading: '#203E33',
  secondarySurface: '#E5EFE6',
  accent: '#F3DED0',
} as const;
export const THEME_SCHEMA = object(
  {
    primary: color,
    background: color,
    heading: color,
    secondarySurface: color,
    accent: color,
    secondary: color,
    text: color,
    muted: color,
    border: color,
    fontFamily: choice('system', 'sans', 'serif'),
    headingFontFamily: choice('system', 'sans', 'serif'),
    bodyFontSize: number(12, 24),
    headingFontSize: number(20, 80),
    radius: number(0, 32),
    spacing: number(2, 16),
    buttonStyle: choice('solid', 'outline', 'soft'),
    productCardStyle: choice('bordered', 'raised', 'minimal'),
    headerStyle: choice('light', 'primary', 'dark'),
    footerStyle: choice('light', 'primary', 'dark'),
    layoutPreset: choice('compact', 'balanced', 'spacious'),
  },
  Object.keys(DEFAULT_THEME),
);

const seo = object(
  {
    title: text(200),
    description: text(500, 0),
    canonicalUrl: link,
    noIndex: bool,
  },
  [],
);
export const PAGE_SCHEMA = object(
  {
    title: text(),
    seo,
    sections: array(
      object(
        {
          id,
          type: { type: 'string', enum: Object.keys(BLOCK_SCHEMAS) },
          visible: bool,
          responsive: object(
            {
              desktop: bool,
              tablet: bool,
              mobile: bool,
              width: choice('contained', 'full'),
              padding: number(0, 12),
            },
            [],
          ),
          config: { type: 'object' },
        },
        ['id', 'type', 'visible', 'config'],
      ),
      100,
    ),
  },
  ['title', 'sections'],
);

function menuItem(depth: number): Schema {
  return object(
    {
      id,
      label: text(100),
      href: link,
      ...(depth < 3 ? { children: array(menuItem(depth + 1), 20) } : {}),
    },
    ['id', 'label', 'href'],
  );
}
export const NAVIGATION_SCHEMA = object({
  label: text(100),
  items: array(menuItem(0), 30),
});
export const SETTINGS_SCHEMA = object(
  {
    storeName: text(150),
    homePageKey: { ...text(64), pattern: '^[a-z0-9][a-z0-9_-]{0,63}$' },
    tagline: text(300, 0),
    logoAssetId: uuid,
    faviconAssetId: uuid,
    locale: { ...text(30), pattern: '^[a-z]{2}(?:-[A-Z]{2})?$' },
    currency: { ...text(3), pattern: '^[A-Z]{3}$' },
    announcement: object({ enabled: bool, text: text(500, 0), href: link }, [
      'enabled',
      'text',
    ]),
    header: object(
      {
        layout: choice('classic', 'centered', 'compact'),
        searchPlacement: choice('header', 'below', 'hidden'),
        menuKey: id,
        categoryMenuKey: id,
      },
      ['layout', 'searchPlacement'],
    ),
    footer: object(
      {
        columns: array(object({ title: text(100), menuKey: id }), 6),
        copyright: text(500, 0),
      },
      ['columns'],
    ),
    contact: object(
      {
        email: { ...text(254), format: 'email' },
        phone: text(40),
        address: text(1000),
      },
      [],
    ),
    socialLinks: array(button, 15),
    legalLinks: array(button, 20),
  },
  ['storeName', 'locale', 'currency'],
);

export const CMS_SCHEMAS: Record<string, Schema> = {
  THEME: THEME_SCHEMA,
  PAGE: PAGE_SCHEMA,
  SITE_SETTINGS: SETTINGS_SCHEMA,
  NAVIGATION: NAVIGATION_SCHEMA,
};
