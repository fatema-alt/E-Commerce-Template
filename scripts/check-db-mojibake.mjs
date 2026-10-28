/**
 * Read-only database query to check for mojibake encoding defects in CMS documents and versions.
 * Safe for production: Executes ONLY SELECT queries; contains zero write operations.
 * Database URL is sourced STRICTLY from command-line argument or the DATABASE_URL environment variable.
 *
 * Usage:
 *   node scripts/check-db-mojibake.mjs [DATABASE_URL]
 *   DATABASE_URL="postgresql://..." node scripts/check-db-mojibake.mjs
 */

let PrismaClient;
try {
  // When running with tsx, client.js resolves to src/generated/prisma/client.ts
  ({ PrismaClient } = await import('../apps/api/src/generated/prisma/client.js'));
} catch {
  try {
    // When running under plain node, load compiled client from dist
    ({ PrismaClient } = await import('../apps/api/dist/generated/prisma/client.js'));
  } catch (err) {
    console.error(
      'Error: Could not load PrismaClient.\n' +
      'Because the generated Prisma client is TypeScript (client.ts), either run with tsx:\n' +
      '  pnpm --filter api exec tsx ../../scripts/check-db-mojibake.mjs [DATABASE_URL]\n' +
      'or compile the api package first:\n' +
      '  pnpm --filter api build\n' +
      '  node scripts/check-db-mojibake.mjs [DATABASE_URL]'
    );
    process.exit(1);
  }
}

const connectionUrl = process.argv[2] || process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error(
    'Error: Database URL not specified.\n' +
    'Provide it via argument or environment variable:\n' +
    '  node scripts/check-db-mojibake.mjs "<DATABASE_URL>"\n' +
    '  DATABASE_URL="<DATABASE_URL>" node scripts/check-db-mojibake.mjs'
  );
  process.exit(1);
}

const masked = connectionUrl.replace(/:[^:@]+@/, ':***@');
console.log(`Connecting to database at ${masked} (Read-Only)...`);

const prisma = new PrismaClient({
  datasourceUrl: connectionUrl,
});

async function run() {
  try {
    // Postgres ARE regex pattern:
    // \u00e2\u20ac matches corrupted UTF-8 quote/dash sequences
    // \u00c2\u00b7 matches corrupted middle dot sequence
    // \u00e2\u2020 matches corrupted arrow sequence
    // \u00c3[\u00a1-\u00ff] matches corrupted Latin-1 supplement characters
    // \uFFFD matches the actual Unicode replacement character U+FFFD (chr(65533))
    const MOJIBAKE_SQL_PATTERN = '\\u00e2\\u20ac|\\u00c2\\u00b7|\\u00e2\\u2020|\\u00c3[\\u00a1-\\u00ff]|\\uFFFD';

    // 1. SELECT query to count total versions and versions with mojibake
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

    // 2. SELECT query to list distinct affected document keys and versions
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
