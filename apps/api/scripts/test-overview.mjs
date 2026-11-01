import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { DashboardService } from '../dist/dashboard/dashboard.service.js';

async function main() {
  const db = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL || 'postgresql://commerce:commerce_dev_password@localhost:5432/commerce_db?schema=public',
  });
  const service = new DashboardService(db);
  const result = await service.overview({ range: '7d', compare: 'prev_period' }, 'ADMIN');
  console.log(JSON.stringify(result, null, 2));
  await db.$disconnect();
}
main().catch(console.error);
