import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run demo cleaner in production!');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

export async function cleanDashboardDemo(client = prisma) {
  console.log('Cleaning existing dashboard demo data...');

  // 1. Delete demo order items and transactions first
  const demoOrders = await client.order.findMany({
    where: { orderNumber: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const demoOrderIds = demoOrders.map((o) => o.id);

  if (demoOrderIds.length > 0) {
    await client.orderItem.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await client.orderPaymentTransaction.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await client.orderAddress.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await client.orderEvent.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await client.order.deleteMany({ where: { id: { in: demoOrderIds } } });
  }

  // 2. Delete demo product reviews
  await client.productReview.deleteMany({
    where: { title: { contains: '[DEMO]' } },
  });

  // 3. Delete demo products & inventories
  const demoProducts = await client.product.findMany({
    where: { sku: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const demoProductIds = demoProducts.map((p) => p.id);
  if (demoProductIds.length > 0) {
    await client.inventory.deleteMany({ where: { productId: { in: demoProductIds } } });
    await client.productImage.deleteMany({ where: { productId: { in: demoProductIds } } });
    await client.product.deleteMany({ where: { id: { in: demoProductIds } } });
  }

  // 4. Delete demo categories
  await client.category.deleteMany({
    where: { slug: { startsWith: 'demo-' } },
  });

  // 5. Delete demo customers
  await client.customer.deleteMany({
    where: { email: { endsWith: '@demo.local' } },
  });

  // 6. Delete demo analytics sessions
  const demoSessions = await client.analyticsSession.findMany({
    where: { source: { in: ['demo_direct', 'demo_organic', 'demo_social'] } },
    select: { id: true },
  });
  const demoSessionIds = demoSessions.map((s) => s.id);
  if (demoSessionIds.length > 0) {
    await client.analyticsEvent.deleteMany({ where: { sessionId: { in: demoSessionIds } } });
    await client.analyticsSession.deleteMany({ where: { id: { in: demoSessionIds } } });
  }

  console.log('Demo cleanup complete.');
}

async function main() {
  try {
    await cleanDashboardDemo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('clean-dashboard-demo.ts')) {
  main().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}
