// Creates an isolated test database using the configured local database server.
// No fixtures are written to the store database.
import 'dotenv/config';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '../dist/generated/prisma/client.js';
const require = createRequire(import.meta.url);
const name = 'commerce_catalog_validation_editor_' + Date.now();
if (!/^commerce_catalog_validation_editor_\d+$/.test(name)) throw new Error('Invalid test database name');
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/' + name;
const db = new PrismaClient();
let created = false;
try {
  await db.$executeRawUnsafe('CREATE DATABASE "' + name + '"');
  created = true;
  const env = { ...process.env, DATABASE_URL: url.toString(), CATALOG_TEST_DATABASE_URL: url.toString() };
  for (const [pkg, script, args] of [
    ['prisma', 'build/index.js', ['migrate', 'deploy']],
    ['vitest', 'vitest.mjs', ['run', 'src/catalog/catalog.integration.spec.ts', 'src/reviews', 'src/auth/auth.guard.spec.ts', 'src/catalog/catalog.rules.spec.ts', 'src/media']],
  ]) {
    const result = spawnSync(process.execPath, [join(dirname(require.resolve(pkg + '/package.json')), script), ...args], { env, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
  }
} finally {
  if (created) await db.$executeRawUnsafe('DROP DATABASE "' + name + '" WITH (FORCE)');
  await db.$disconnect();
}
