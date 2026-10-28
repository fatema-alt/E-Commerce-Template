import assert from 'node:assert/strict';
import { assertSelect, main, placeholderReasons, runAudit } from './audit-production-readonly.mjs';

await assert.rejects(() => main([]), /Explicit --read-only-audit flag required/);
for (const sql of ['DELETE FROM products', 'SELECT 1; DELETE FROM products', 'SELECT * INTO copy FROM products', 'SELECT set_config(\'x\',\'y\',false)', 'WITH removed AS (DELETE FROM products) SELECT * FROM removed']) {
  assert.throws(() => assertSelect(sql));
}
assertSelect('SELECT COUNT(*)::text AS count FROM "public"."products"');
assert.ok(placeholderReasons('hiiiiiiiiiiiiii', true).includes('repeated-letters'));
assert.ok(placeholderReasons('LED', true).includes('very-short-title'));
assert.ok(placeholderReasons('Lorem ipsum placeholder description').includes('demo-or-lorem-marker'));
assert.deepEqual(placeholderReasons('Cotton T-Shirt', true), []);

const privateEmail = 'PRIVATE_CUSTOMER@example.test';
const privatePhone = 'PRIVATE_PHONE';
const rows = {
  products: [{ id: 'p1', name: 'Cotton T-Shirt', price: '650', salePrice: '500', brand: null, description: 'gvbjnnfobjnoigfb' }, { id: 'p2', name: 'hiiiiiiii', price: '0', salePrice: null, brand: null, description: 'Lorem ipsum' }],
  product_variants: [{ id: 'v1', productId: 'p1', name: 'Black', price: '650' }],
  categories: [{ id: 'c1', name: 'Upperwear', imageUrl: '/uploads/category.jpg' }],
  customers: [{ id: 'customer-id', status: 'ACTIVE', email: privateEmail, phone: privatePhone, firstName: 'PRIVATE_NAME', address: 'PRIVATE_ADDRESS' }],
  cms_documents: [{ id: 'd1', kind: 'PAGE', key: 'home', state: 'PUBLISHED' }],
  cms_versions: [{ id: 'version-id', documentId: 'd1', version: 1, content: { title: 'hiiiiiiii', contact: { email: privateEmail }, sections: [{ config: { title: 'Demo title' } }] } }],
  product_images: [{ id: 'i1', productId: 'p1', altText: '   ' }],
  cms_media_assets: [{ id: 'a1', altText: null, deletedAt: null }, { id: 'a2', altText: 'Useful alt', deletedAt: null }],
};
const queries = [];
const client = { async $queryRawUnsafe(sql, ...parameters) {
  assertSelect(sql); queries.push(sql);
  if (sql.includes('information_schema.columns')) return Object.entries(rows).flatMap(([table_name, records]) => [...new Set(records.flatMap(Object.keys))].map(column_name => ({ table_name, column_name })));
  const name = sql.match(/FROM "public"\."([A-Za-z_]+)"/)?.[1];
  assert.ok(name, sql);
  let selected = rows[name];
  if (sql.includes('BTRIM("brand")')) selected = selected.filter(row => row.brand?.trim());
  if (sql.includes('BTRIM("altText")')) selected = selected.filter(row => !row.altText?.trim() && !row.deletedAt);
  if (sql.includes('BTRIM("imageUrl")')) selected = selected.filter(row => row.imageUrl?.trim());
  if (sql.startsWith('SELECT COUNT')) return [{ count: String(selected.length) }];
  if (sql.startsWith('SELECT "brand"')) return [];
  if (sql.includes('"id"::text > $1')) selected = selected.filter(row => row.id > parameters[0]);
  // Return extra private fields deliberately: the report must whitelist output too.
  return selected.slice(0, Number(parameters.at(-1)));
} };
const report = await runAudit(client, { limit: 1 });
assert.equal(report.entities.products.count, '2');
assert.equal(report.entities.products.items.length, 1);
assert.equal(report.entities.coupons.count, null, 'Missing coupons table is unknown, not zero');
assert.deepEqual(report.entities.customers.items, [{ id: 'customer-id', status: 'ACTIVE' }]);
assert.equal(report.imageMetadata.product_images.count, '1');
assert.equal(report.imageMetadata.cms_media_assets.count, '1');
assert.ok(report.placeholders.count >= 4, 'All records scanned even when listings are capped');
assert.equal(report.placeholders.items.length, 1);
const output = JSON.stringify(report);
for (const secret of [privateEmail, privatePhone, 'PRIVATE_NAME', 'PRIVATE_ADDRESS', 'Lorem ipsum']) assert.ok(!output.includes(secret));
assert.ok(!JSON.stringify(report.placeholders).includes('hiiiiiiii'), 'No placeholder text excerpts');
const customerQuery = queries.find(sql => sql.startsWith('SELECT "id"') && sql.includes('FROM "public"."customers"'));
assert.doesNotMatch(customerQuery, /email|phone|firstName|lastName|address|note/i);
await assert.rejects(() => runAudit(client, { schema: 'public;DROP' }), /Invalid audit identifier/);
await assert.rejects(() => runAudit(client, { limit: 501 }), /Limit must be/);
console.log(`PASS: explicit flag, SELECT-only guard, missing tables, listing caps, complete placeholder scan, alt metadata, customer redaction (${queries.length} SELECTs)`);
