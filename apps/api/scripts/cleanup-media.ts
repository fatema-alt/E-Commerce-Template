import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createMediaStorage } from '../src/media/media.module.js';

// Dry run by default, scoped to generated keys. A grace period protects in-flight uploads.
const apply = process.argv.includes('--apply');
const db = new PrismaClient();
const storage = createMediaStorage();
try {
  for (const scope of ['products', 'categories'] as const) {
    for await (const { key, modified } of storage.list(scope)) {
      if (Date.now() - modified.getTime() < 24 * 60 * 60 * 1000) continue;
      const url = storage.url(scope, key);
      const referenced =
        scope === 'products'
          ? await db.productImage.count({
              where: { OR: [{ storageKey: key }, { url }] },
            })
          : await db.category.count({ where: { imageUrl: url } });
      if (referenced) continue;
      console.log(
        (apply ? 'Removing ' : 'Orphan candidate ') + scope + '/' + key,
      );
      if (apply) await storage.remove(scope, key);
    }
  }
} finally {
  await db.$disconnect();
}
