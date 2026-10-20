import 'dotenv/config';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const target = process.env.CATALOG_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_catalog_validation_')
)
  throw new Error(
    'Set CATALOG_TEST_DATABASE_URL to an isolated commerce_catalog_validation_ database',
  );
const env = { ...process.env, DATABASE_URL: target };
for (const [pkg, file, args] of [
  ['prisma', 'build/index.js', ['migrate', 'deploy']],
  ['vitest', 'vitest.mjs', ['run']],
]) {
  const result = spawnSync(
    process.execPath,
    [join(dirname(require.resolve(pkg + '/package.json')), file), ...args],
    { env, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
