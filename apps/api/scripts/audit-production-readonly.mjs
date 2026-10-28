import { pathToFileURL } from 'node:url';

const entities = {
  products: ['id', 'name', 'slug', 'sku', 'brand', 'price', 'salePrice', 'isActive', 'isVisible', 'deletedAt'],
  product_variants: ['id', 'productId', 'name', 'sku', 'price', 'salePrice', 'isActive'],
  categories: ['id', 'name', 'slug', 'isActive', 'isVisible'],
  // Deliberately never select customer names, emails, phones, addresses or notes.
  customers: ['id', 'status', 'isActive', 'createdAt', 'deletedAt'],
  coupons: ['id', 'code', 'type', 'value', 'minOrderAmount', 'isActive', 'startsAt', 'expiresAt'],
  cms_documents: ['id', 'kind', 'key', 'state', 'revision', 'publishedVersionId', 'scheduledAt'],
};

export function assertSelect(sql) {
  if (!/^SELECT\s/i.test(sql.trim()) || /;|--|\/\*|\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|CALL|DO|GRANT|REVOKE|VACUUM|INTO|set_config|nextval|pg_advisory_lock)\b/i.test(sql)) {
    throw new Error('Audit permits allowlisted SELECT statements only');
  }
}
const identifier = value => {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) throw new Error('Invalid audit identifier');
  return `"${value}"`;
};
export function placeholderReasons(value, title = false) {
  if (typeof value !== 'string') return [];
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const reasons = [];
  if (title && [...text].length <= 3) reasons.push('very-short-title');
  if (/(\p{L})\1{3,}/iu.test(text)) reasons.push('repeated-letters');
  if (/\b(?:lorem|ipsum|dolor sit|asdf|qwerty|test|demo|sample|placeholder)\b/i.test(text)) reasons.push('demo-or-lorem-marker');
  if (/\b[bcdfghjklmnpqrstvwxyz]{7,}\b/i.test(text)) reasons.push('possible-keyboard-gibberish');
  return reasons;
}
function inspectContent(value, visit, path = '$', key = '') {
  if (typeof value === 'string') {
    if (['title', 'name', 'heading', 'subtitle', 'description', 'shortDescription', 'metaDescription', 'socialDescription', 'answer', 'text', 'label'].includes(key)) {
      visit(path, placeholderReasons(value, ['title', 'name', 'heading'].includes(key)));
    }
  } else if (Array.isArray(value)) value.forEach((item, index) => inspectContent(item, visit, `${path}[${index}]`, key));
  else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(childKey) ? childKey : '[key]';
      inspectContent(child, visit, `${path}.${safeKey}`, childKey);
    }
  }
}

export async function runAudit(client, { schema = 'public', limit = 100 } = {}) {
  identifier(schema);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Limit must be 1..500');
  const select = (sql, ...parameters) => { assertSelect(sql); return client.$queryRawUnsafe(sql, ...parameters); };
  const columns = await select('SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position', schema);
  const tables = new Map();
  for (const row of columns) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
    tables.get(row.table_name).add(row.column_name);
  }
  const table = name => `${identifier(schema)}.${identifier(name)}`;
  const pick = (name, fields) => fields.filter(field => tables.get(name)?.has(field));
  const count = async (name, where = '') => (await select(`SELECT COUNT(*)::text AS count FROM ${table(name)}${where}`))[0].count;
  const listing = async (name, fields, where = '') => {
    const safeFields = pick(name, fields);
    const rows = await select(`SELECT ${safeFields.map(identifier).join(', ')} FROM ${table(name)}${where} ORDER BY "id" LIMIT $1`, limit);
    return rows.map(row => Object.fromEntries(safeFields.map(field => [field, row[field]])));
  };
  const report = {
    generatedAt: new Date().toISOString(), schema, listingLimitPerSection: limit,
    notes: [
      'SELECT only; no migrations, cleanup, updates or deletes. Use a SELECT-only database role.',
      'Counts include inactive/soft-deleted entity records. Image metadata checks exclude soft-deleted assets.',
      'Counts and lists are not an atomic snapshot; concurrent edits can change results during the audit.',
      'Information-schema visibility depends on role grants: an unavailable table may be absent or not visible to this account.',
      'Entity listings are capped. Placeholder counts scan all product/category/CMS-version text in batches, including historical CMS versions.',
      'Customer output is IDs/status/timestamps only. No customer personal fields are selected. Placeholder findings contain paths/reasons, never text excerpts or CMS content.',
      'Heuristics are review candidates, not evidence that records are fake or safe to delete.',
    ],
    entities: {}, brands: null,
    placeholders: { scannedRecords: 0, count: 0, items: [] },
    imageMetadata: {},
  };
  for (const [name, fields] of Object.entries(entities)) {
    report.entities[name] = tables.has(name)
      ? { count: await count(name), items: await listing(name, fields), listingCappedAt: limit }
      : { count: null, items: [], unavailable: 'table-not-visible-or-missing' };
  }
  if (tables.get('products')?.has('brand')) {
    const where = ' WHERE NULLIF(BTRIM("brand"), \'\') IS NOT NULL';
    const total = await select(`SELECT COUNT(DISTINCT "brand")::text AS count FROM ${table('products')}${where}`);
    const items = await select(`SELECT "brand", COUNT(*)::text AS products FROM ${table('products')}${where} GROUP BY "brand" ORDER BY "brand" LIMIT $1`, limit);
    report.brands = { count: total[0].count, items };
  }
  for (const name of ['product_images', 'cms_media_assets']) {
    if (!tables.has(name)) { report.imageMetadata[name] = { count: null, unavailable: 'table-not-visible-or-missing' }; continue; }
    if (!tables.get(name).has('altText')) { report.imageMetadata[name] = { count: null, unavailable: 'alt-column-missing' }; continue; }
    const where = ` WHERE NULLIF(BTRIM("altText"), '') IS NULL${tables.get(name).has('deletedAt') ? ' AND "deletedAt" IS NULL' : ''}`;
    report.imageMetadata[name] = { count: await count(name, where), items: await listing(name, ['id', 'productId', 'variantId'], where) };
  }
  if (tables.get('categories')?.has('imageUrl')) {
    const where = ' WHERE NULLIF(BTRIM("imageUrl"), \'\') IS NOT NULL';
    report.imageMetadata.categoryImages = {
      count: await count('categories', where), items: await listing('categories', ['id'], where),
      note: 'No dedicated category alt field; renderer uses category name as alt. This is not a count of missing rendered alt attributes.',
    };
  }
  const recordFlag = (name, row, field, reasons) => {
    if (!reasons.length) return;
    report.placeholders.count++;
    if (report.placeholders.items.length < limit) report.placeholders.items.push({
      table: name, id: row.id, ...(row.documentId ? { documentId: row.documentId, version: row.version } : {}), field, reasons,
    });
  };
  const scans = {
    products: ['id', 'name', 'description', 'shortDescription', 'metaTitle', 'metaDescription', 'price', 'salePrice'],
    product_variants: ['id', 'name'], categories: ['id', 'name', 'description', 'metaTitle', 'metaDescription'],
    cms_versions: ['id', 'documentId', 'version', 'content'],
  };
  for (const [name, requested] of Object.entries(scans)) {
    if (!tables.get(name)?.has('id')) continue;
    const fields = pick(name, requested);
    let cursor = '';
    while (true) {
      const rows = await select(`SELECT ${fields.map(identifier).join(', ')} FROM ${table(name)} WHERE "id"::text > $1 ORDER BY "id"::text LIMIT $2`, cursor, 200);
      if (!rows.length) break;
      for (const row of rows) {
        report.placeholders.scannedRecords++;
        for (const field of fields) {
          if (['id', 'documentId', 'version', 'price', 'salePrice'].includes(field)) continue;
          if (field === 'content') inspectContent(row.content, (path, reasons) => recordFlag(name, row, path, reasons));
          else recordFlag(name, row, field, placeholderReasons(row[field], ['name', 'metaTitle'].includes(field)));
        }
        if (row.price != null && Number(row.price) <= 0) recordFlag(name, row, 'price', ['nonpositive-price-review']);
        if (row.salePrice != null && Number(row.salePrice) > Number(row.price)) recordFlag(name, row, 'salePrice', ['sale-above-regular-price-review']);
      }
      const next = String(rows.at(-1).id);
      if (next <= cursor) throw new Error('Non-advancing audit cursor');
      cursor = next;
    }
  }
  report.placeholders.listingCappedAt = limit;
  return report;
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('AUDIT_DATABASE_URL=<connection> node apps/api/scripts/audit-production-readonly.mjs --read-only-audit [--limit=100] [--schema=public]\nRequires the built API Prisma client. No dotenv loading, no database URL on the command line. Output is JSON. Use a SELECT-only database role.');
    return;
  }
  if (!args.includes('--read-only-audit')) throw new Error('Explicit --read-only-audit flag required; no connection opened');
  if (args.some(arg => arg !== '--read-only-audit' && !/^--(?:limit|schema)=/.test(arg))) throw new Error('Unknown argument');
  const limit = Number(args.find(arg => arg.startsWith('--limit='))?.slice(8) ?? 100);
  const schema = args.find(arg => arg.startsWith('--schema='))?.slice(9) ?? 'public';
  identifier(schema);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Limit must be 1..500');
  if (!process.env.AUDIT_DATABASE_URL) throw new Error('AUDIT_DATABASE_URL required; no connection opened');
  const url = new URL(process.env.AUDIT_DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL URL required');
  const { PrismaClient } = await import('../dist/generated/prisma/client.js');
  const client = new PrismaClient({ datasourceUrl: url.toString() });
  try { console.log(JSON.stringify(await runAudit(client, { schema, limit }), (_, value) => typeof value === 'bigint' ? value.toString() : value, 2)); }
  finally { await client.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Prisma errors may embed connection strings or query values: do not print them.
    console.error(`Audit failed (${error.code || error.name || 'Error'}). No connection details or customer fields printed. Use --help and verify configuration.`);
    process.exitCode = 1;
  });
}
