/**
 * Read-only database query to check for mojibake encoding defects in CMS documents and versions.
 * Safe for production: Executes only SELECT queries; never mutates data.
 *
 * Usage:
 *   node scripts/check-db-mojibake.mjs [DATABASE_URL]
 */

import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const connectionUrl =
  process.argv[2] ||
  process.env.DATABASE_URL ||
  'postgresql://commerce:commerce_dev_password@localhost:5434/commerce_db?schema=public';

const masked = connectionUrl.replace(/:[^:@]+@/, ':***@');
console.log(`Connecting to database at ${masked} (Read-Only Mode)...`);

const prisma = new PrismaClient({
  datasourceUrl: connectionUrl,
});

async function run() {
  try {
    // Unicode-escaped pattern avoids triggering local mojibake lint checks
    const MOJIBAKE_SQL_PATTERN = '\\u00e2\\u20ac|\\u00c2\\u00b7|\\u00e2\\u2020|\\u00c3[\\u00a1-\\u00ff]|\\\\uFFFD';

    // 1. Check total versions and count with mojibake
    const countResult = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total_versions,
        COUNT(*) FILTER (WHERE content::text ~ '${MOJIBAKE_SQL_PATTERN}')::int AS mojibake_versions_count
      FROM cms_versions;
    `);

    const { total_versions, mojibake_versions_count } = countResult[0] || {
      total_versions: 0,
      mojibake_versions_count: 0,
    };

    console.log(`\n--- CMS Content Mojibake Summary ---`);
    console.log(`Total CMS Versions Scanned: ${total_versions}`);
    console.log(`Versions with Mojibake:     ${mojibake_versions_count}`);

    // 2. Query distinct affected documents and keys
    if (mojibake_versions_count > 0) {
      const affected = await prisma.$queryRawUnsafe(`
        SELECT
          d.kind,
          d.key,
          v.version,
          v.id AS "versionId",
          (d."publishedVersionId" = v.id) AS "isPublished"
        FROM cms_versions v
        JOIN cms_documents d ON v."documentId" = d.id
        WHERE v.content::text ~ '${MOJIBAKE_SQL_PATTERN}'
        ORDER BY d.kind, d.key, v.version ASC;
      `);

      console.log(`\nAffected Document Keys:`);
      console.table(affected);
    } else {
      console.log(`\nResult: Clean! No mojibake patterns found in any stored CMS version or document.`);
    }
  } catch (error) {
    console.error(`Database query failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
