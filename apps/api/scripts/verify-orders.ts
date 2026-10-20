import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client.js';

const require = createRequire(import.meta.url);
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL required to connect to local PostgreSQL');
const testUrl = new URL(
  process.env.ORDERS_TEST_DATABASE_URL ?? process.env.DATABASE_URL,
);
if (!process.env.ORDERS_TEST_DATABASE_URL)
  testUrl.pathname = '/commerce_orders_validation_20261018';
const name = testUrl.pathname.slice(1);
if (!/^commerce_orders_validation_[a-zA-Z0-9_]+$/.test(name))
  throw new Error('Refusing non-isolated test database');
const adminUrl = new URL(testUrl);
adminUrl.pathname = '/postgres';
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
try {
  const exists = await admin.$queryRaw<
    Array<{ datname: string }>
  >`SELECT datname FROM pg_database WHERE datname = ${name}`;
  if (!exists.length)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
} finally {
  await admin.$disconnect();
}
const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  ORDERS_TEST_DATABASE_URL: testUrl.toString(),
};
execFileSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  { env, stdio: 'inherit' },
);
execFileSync(
  process.execPath,
  [
    join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),
    'run',
    '--maxWorkers=1',
    'src/orders',
    'src/auth/auth.guard.spec.ts',
  ],
  { env, stdio: 'inherit' },
);
