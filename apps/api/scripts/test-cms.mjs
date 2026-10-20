import 'dotenv/config';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const url = process.env.CMS_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.startsWith('/commerce_cms_validation_')) throw new Error('Set CMS_TEST_DATABASE_URL to an isolated commerce_cms_validation_ database');
const env = { ...process.env, DATABASE_URL: url };
for (const [pkg, file, args] of [['prisma', 'build/index.js', ['migrate', 'deploy']], ['vitest', 'vitest.mjs', ['run', 'src/cms']]]) {
  const result = spawnSync(process.execPath, [join(dirname(require.resolve(pkg + '/package.json')), file), ...args], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
