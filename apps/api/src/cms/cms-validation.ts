import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BLOCK_SCHEMAS, CMS_SCHEMAS, type Schema } from './cms-schema.js';
export { DEFAULT_THEME } from './cms-schema.js';

export function safeLink(value: string) {
  // Control characters and backslashes are intentionally forbidden in CMS URLs.
  // eslint-disable-next-line no-control-regex
  if (value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value))
    return false;
  let decoded = value;
  try {
    for (let i = 0; i < 2; i++) decoded = decodeURIComponent(decoded);
  } catch {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith('//'))
    return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
function fail(path: string, reason: string): never {
  throw new BadRequestException(path + ': ' + reason);
}
function validate(schema: Schema, value: unknown, path: string): void {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail(path, 'expected an object');
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(object, key)) fail(path + '.' + key, 'required');
    if (schema.properties)
      for (const key of Object.keys(object)) {
        if (!Object.hasOwn(properties, key))
          fail(path + '.' + key, 'unknown field');
        validate(properties[key], object[key], path + '.' + key);
      }
  } else if (schema.type === 'array') {
    if (
      !Array.isArray(value) ||
      value.length > (schema.maxItems ?? 100) ||
      value.length < (schema.minItems ?? 0)
    )
      fail(path, 'invalid array size');
    value.forEach((item, index) =>
      validate(schema.items!, item, path + '[' + index + ']'),
    );
  } else {
    if (typeof value !== schema.type) fail(path, 'expected ' + schema.type);
    if (schema.enum && !schema.enum.includes(value))
      fail(path, 'unsupported value');
    if (
      typeof value === 'number' &&
      (!Number.isSafeInteger(value) ||
        value < (schema.min ?? -Infinity) ||
        value > (schema.max ?? Infinity))
    )
      fail(path, 'number out of range');
    if (typeof value === 'string') {
      if (
        value.length < (schema.minLength ?? 0) ||
        value.length > (schema.maxLength ?? 10000) ||
        (schema.minLength && !value.trim())
      )
        fail(path, 'invalid text length');
      if (schema.pattern && !new RegExp(schema.pattern).test(value))
        fail(path, 'invalid format');
      if (schema.format === 'link' && !safeLink(value))
        fail(path, 'unsafe link');
      if (schema.format === 'datetime' && value && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z$/.test(value) || !Number.isFinite(Date.parse(value))))
        fail(path, 'invalid UTC date');
      if (
        schema.format === 'email' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        fail(path, 'invalid email');
    }
  }
}
export function validateCmsKey(key: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key))
    fail('key', 'use 1?64 lowercase letters, numbers, underscores or hyphens');
}
export function validateCmsContent(
  kind: string,
  content: unknown,
): Record<string, unknown> {
  const schema = CMS_SCHEMAS[kind];
  if (!schema) fail('kind', 'unsupported document kind');
  let encoded: string;
  try {
    encoded = JSON.stringify(content);
  } catch {
    fail('content', 'must be JSON');
  }
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > 100000)
    fail('content', 'maximum size is 100 KB');
  validate(schema, content, 'content');
  const object = content as Record<string, unknown>;
  if (kind === 'SITE_SETTINGS') {
    const ribbon = object.announcementRibbon as { items?: { id: string; startsAt?: string; endsAt?: string; ctaLabel?: string; ctaUrl?: string }[] } | undefined;
    const seen = new Set<string>();
    for (const item of ribbon?.items ?? []) {
      if (seen.has(item.id)) fail('announcementRibbon.items', 'duplicate announcement ID');
      seen.add(item.id);
      if (item.startsAt && item.endsAt && Date.parse(item.startsAt) >= Date.parse(item.endsAt)) fail('announcementRibbon.items', 'end must be after start');
      if (item.ctaLabel && !item.ctaUrl) fail('announcementRibbon.items', 'CTA URL is required for a CTA label');
    }
    const widget = object.contactWidget as Record<string, unknown> | undefined;
    for (const [channel, field] of [['whatsapp', 'number'], ['phone', 'number'], ['email', 'address']]) {
      const config = widget?.[channel] as Record<string, unknown> | undefined;
      if (config?.enabled && !config[field]) fail('contactWidget.' + channel, field + ' is required when enabled');
    }
  }
  const identifiers = new Set<string>();
  if (kind === 'PAGE')
    for (const section of object.sections as Record<string, unknown>[]) {
      if (identifiers.has(String(section.id)))
        fail('sections', 'duplicate section ID');
      identifiers.add(String(section.id));
      validate(
        BLOCK_SCHEMAS[String(section.type)],
        section.config,
        'section.' + section.id,
      );
      const config = section.config as Record<string, unknown>;
      if (
        ['productGrid', 'productCarousel', 'flashSale'].includes(
          String(section.type),
        )
      ) {
        if (config.source === 'selected' && !Array.isArray(config.productIds))
          fail('config.productIds', 'required for selected products');
        if (config.source === 'category' && !config.categoryId)
          fail('config.categoryId', 'required for category source');
      }
      if (
        section.type === 'flashSale' &&
        !Number.isFinite(Date.parse(String(config.endsAt)))
      )
        fail('config.endsAt', 'invalid date');
    }
  if (kind === 'NAVIGATION') {
    const visit = (items: Record<string, unknown>[]) => {
      for (const item of items) {
        if (identifiers.has(String(item.id)))
          fail('items', 'duplicate navigation ID');
        identifiers.add(String(item.id));
        if (identifiers.size > 200)
          fail('items', 'maximum 200 navigation items');
        if (item.children) visit(item.children as Record<string, unknown>[]);
      }
    };
    visit(object.items as Record<string, unknown>[]);
  }
  return JSON.parse(encoded) as Record<string, unknown>;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ':' +
            canonical((value as Record<string, unknown>)[key]),
        )
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function hashContent(content: unknown) {
  return createHash('sha256').update(canonical(content)).digest('hex');
}
export function assetIds(content: unknown): string[] {
  const ids = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (
        (key === 'assetId' || key.endsWith('AssetId')) &&
        typeof item === 'string'
      )
        ids.add(item);
      else visit(item);
    }
  }
  visit(content);
  return [...ids];
}
