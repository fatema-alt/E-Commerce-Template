import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.js';
import { ReviewsService } from './reviews.service.js';
import { ShopService } from '../shop/shop.service.js';

describe.skipIf(!process.env.CATALOG_TEST_DATABASE_URL)('Review and newsletter persistence in isolated PostgreSQL', () => {
  let db: PrismaClient;
  let reviews: ReviewsService;
  let productId: string;
  const suffix = randomUUID();
  beforeAll(async () => {
    const url = new URL(process.env.CATALOG_TEST_DATABASE_URL!);
    if (!url.pathname.startsWith('/commerce_catalog_validation_')) throw new Error('Isolated catalog database required');
    db = new PrismaClient({ datasourceUrl: url.toString() });
    await db.$connect();
    reviews = new ReviewsService(db as never);
    const category = await db.category.create({ data: { name: 'Review test', slug: 'review-' + suffix } });
    const product = await db.product.create({ data: { name: 'Review test', slug: 'review-' + suffix, sku: 'review-' + suffix, categoryId: category.id, price: '100' } });
    productId = product.id;
  });
  afterAll(async () => { await db?.$disconnect(); });
  it('keeps guest reviews pending, then displays only moderated feedback with actual counts', async () => {
    const result = await reviews.submitReview({ productId, rating: 4, content: 'Test-only experience', authorName: 'Test shopper', authorEmail: suffix + '@test.invalid' });
    expect(result.status).toBe('PENDING'); expect(result.isVerifiedPurchase).toBe(false);
    expect((await reviews.getProductReviews(productId)).total).toBe(0);
    await reviews.updateReviewStatus(result.id, { status: 'APPROVED' });
    const published = await reviews.getProductReviews(productId);
    expect(published.items[0].content).toBe('Test-only experience');
    expect(published.summary.averageRating).toBe(4);
    expect(published.summary.verifiedTotal).toBe(0);
  });
  it('records subscriptions idempotently with case-normalized email', async () => {
    const shop = new ShopService(db as never, {} as never, {} as never, {} as never);
    const email = suffix + '@test.invalid';
    await shop.subscribe(email.toUpperCase()); await shop.subscribe(email);
    expect(await db.newsletterSubscription.count({ where: { email } })).toBe(1);
  });
});
