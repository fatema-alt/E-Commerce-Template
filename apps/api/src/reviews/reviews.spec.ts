import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewsService } from './reviews.service.js';
import { QuestionStatus, ReviewStatus } from '../generated/prisma/client.js';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      product: {
        findUnique: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
      },
      productReview: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      productQuestion: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    service = new ReviewsService(mockDb);
  });

  describe('submitReview', () => {
    it('creates a review with PENDING status when purchase is not verified', async () => {
      mockDb.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Cotton T-Shirt',
      });
      mockDb.order.findFirst.mockResolvedValue(null);
      mockDb.productReview.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'rev-1', ...args.data }),
      );

      const result = await service.submitReview({
        productId: 'prod-1',
        rating: 5,
        title: 'Great product!',
        content: 'Loved the soft cotton fabric and fast delivery.',
        authorName: 'Rahim Khan',
        authorEmail: 'rahim@example.com',
      });

      expect(result.status).toBe(ReviewStatus.PENDING);
      expect(result.isVerifiedPurchase).toBe(false);
      expect(mockDb.productReview.create).toHaveBeenCalled();
    });

    it('marks as verified purchase and auto-approves high-rating review when order matches', async () => {
      mockDb.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Cotton T-Shirt',
      });
      mockDb.order.findFirst.mockResolvedValue({ id: 'ord-123' });
      mockDb.productReview.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'rev-2', ...args.data }),
      );

      const result = await service.submitReview({
        productId: 'prod-1',
        rating: 5,
        content: 'Authentic item, highly recommended!',
        authorName: 'Karim Ahmed',
        authorEmail: 'karim@example.com',
      });

      expect(result.isVerifiedPurchase).toBe(true);
      expect(result.status).toBe(ReviewStatus.APPROVED);
    });
  });

  describe('getProductReviewsSummary', () => {
    it('calculates average rating and rating breakdown correctly', async () => {
      mockDb.productReview.findMany.mockResolvedValue([
        { rating: 5, isVerifiedPurchase: true },
        { rating: 5 },
        { rating: 4 },
        { rating: 2 },
      ]);

      const summary = await service.getProductReviewsSummary('prod-1');

      expect(summary.total).toBe(4);
      expect(summary.verifiedTotal).toBe(1);
      expect(summary.averageRating).toBe(4.0); // (5+5+4+2)/4 = 4.0
      expect(summary.ratingBreakdown[5]).toBe(2);
      expect(summary.ratingBreakdown[4]).toBe(1);
      expect(summary.ratingBreakdown[2]).toBe(1);
      expect(summary.ratingBreakdown[1]).toBe(0);
    });
  });

  describe('markHelpful', () => {
    it('increments helpful count on review', async () => {
      mockDb.productReview.findUnique.mockResolvedValue({ id: 'rev-1' });
      mockDb.productReview.update.mockResolvedValue({
        id: 'rev-1',
        helpfulCount: 5,
      });

      const res = await service.markHelpful('rev-1');
      expect(res.helpfulCount).toBe(5);
      expect(mockDb.productReview.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { helpfulCount: { increment: 1 } },
        select: { id: true, helpfulCount: true },
      });
    });
  });

  describe('admin moderation & replies', () => {
    it('updates review status to APPROVED', async () => {
      mockDb.productReview.findUnique.mockResolvedValue({ id: 'rev-1' });
      mockDb.productReview.update.mockResolvedValue({
        id: 'rev-1',
        status: ReviewStatus.APPROVED,
      });

      const res = await service.updateReviewStatus('rev-1', {
        status: ReviewStatus.APPROVED,
      });
      expect(res.status).toBe(ReviewStatus.APPROVED);
    });

    it('adds admin reply to customer review', async () => {
      mockDb.productReview.findUnique.mockResolvedValue({ id: 'rev-1' });
      mockDb.productReview.update.mockResolvedValue({
        id: 'rev-1',
        adminReply: 'Thank you for shopping with us!',
        adminReplyAuthor: 'DS Mart Support',
      });

      const res = await service.replyToReview(
        'rev-1',
        { reply: 'Thank you for shopping with us!' },
        'DS Mart Support',
      );
      expect(res.adminReply).toBe('Thank you for shopping with us!');
      expect(mockDb.productReview.update).toHaveBeenCalled();
    });
  });

  describe('product questions & answers (Q&A)', () => {
    it('submits a question in PENDING state', async () => {
      mockDb.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockDb.productQuestion.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'q-1', ...args.data }),
      );

      const res = await service.submitQuestion({
        productId: 'prod-1',
        question: 'Does this come with standard warranty?',
        authorName: 'Fahim',
        authorEmail: 'fahim@example.com',
      });

      expect(res.status).toBe(QuestionStatus.PENDING);
      expect(res.question).toBe('Does this come with standard warranty?');
    });

    it('answers and publishes question', async () => {
      mockDb.productQuestion.findUnique.mockResolvedValue({ id: 'q-1' });
      mockDb.productQuestion.update.mockResolvedValue({
        id: 'q-1',
        answer: 'Yes, 1 year official brand warranty included.',
        isAnswered: true,
        status: QuestionStatus.APPROVED,
      });

      const res = await service.answerQuestion(
        'q-1',
        { answer: 'Yes, 1 year official brand warranty included.' },
        'Official Seller',
      );

      expect(res.isAnswered).toBe(true);
      expect(res.status).toBe(QuestionStatus.APPROVED);
      expect(res.answer).toContain('brand warranty');
    });
  });
});
