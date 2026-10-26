import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AnswerQuestionDto,
  CreateQuestionDto,
  CreateReviewDto,
  QueryQuestionsDto,
  QueryReviewsDto,
  ReplyReviewDto,
  UpdateQuestionStatusDto,
  UpdateReviewStatusDto,
} from './reviews.dto.js';
import {
  Prisma,
  QuestionStatus,
  ReviewStatus,
} from '../generated/prisma/client.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Checks whether the given email or customer ID has a confirmed/delivered order
   * containing the specified product.
   */
  async checkVerifiedPurchase(
    productId: string,
    email?: string,
    customerId?: string,
  ): Promise<boolean> {
    const conditions: Prisma.OrderWhereInput[] = [];
    if (email) {
      conditions.push({ customerEmail: { equals: email, mode: 'insensitive' } });
    }
    if (customerId) {
      conditions.push({ customerId });
    }

    if (conditions.length === 0) return false;

    const matchedOrder = await this.db.order.findFirst({
      where: {
        AND: [
          { OR: conditions },
          { status: { notIn: ['CANCELLED', 'RETURNED'] } },
          {
            items: {
              some: {
                productId,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(matchedOrder);
  }

  /**
   * Submit a product review from storefront.
   */
  async submitReview(dto: CreateReviewDto, customerId?: string) {
    const product = await this.db.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new NotFoundException(`Product not found with id ${dto.productId}`);
    }

    const isVerifiedPurchase = await this.checkVerifiedPurchase(
      dto.productId,
      dto.authorEmail,
      customerId,
    );

    // Auto-approve verified customer purchases with rating >= 3, or set to PENDING for moderation
    const status: ReviewStatus = isVerifiedPurchase && dto.rating >= 4
      ? ReviewStatus.APPROVED
      : ReviewStatus.PENDING;

    return this.db.productReview.create({
      data: {
        productId: dto.productId,
        customerId: customerId || undefined,
        authorName: dto.authorName.trim(),
        authorEmail: dto.authorEmail.toLowerCase().trim(),
        rating: dto.rating,
        title: dto.title?.trim() || null,
        content: dto.content.trim(),
        photos: dto.photos || [],
        isVerifiedPurchase,
        status,
      },
    });
  }

  /**
   * Get public reviews and ratings breakdown for a product.
   */
  async getProductReviewsSummary(productId: string) {
    const reviews = await this.db.productReview.findMany({
      where: {
        productId,
        status: ReviewStatus.APPROVED,
      },
      select: {
        rating: true,
      },
    });

    const total = reviews.length;
    const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const r of reviews) {
      sum += r.rating;
      ratingBreakdown[r.rating] = (ratingBreakdown[r.rating] || 0) + 1;
    }

    const averageRating = total > 0 ? Number((sum / total).toFixed(1)) : 0;

    return {
      total,
      averageRating,
      ratingBreakdown,
    };
  }

  /**
   * Get paginated approved reviews for storefront product page.
   */
  async getProductReviews(
    productId: string,
    page = 1,
    limit = 10,
    rating?: number,
  ) {
    const where: Prisma.ProductReviewWhereInput = {
      productId,
      status: ReviewStatus.APPROVED,
      ...(rating ? { rating } : {}),
    };

    const [items, total, summary] = await Promise.all([
      this.db.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          productId: true,
          authorName: true,
          rating: true,
          title: true,
          content: true,
          photos: true,
          isVerifiedPurchase: true,
          helpfulCount: true,
          adminReply: true,
          adminRepliedAt: true,
          createdAt: true,
        },
      }),
      this.db.productReview.count({ where }),
      this.getProductReviewsSummary(productId),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary,
    };
  }

  /**
   * Increment helpful count on review.
   */
  async markHelpful(reviewId: string) {
    const review = await this.db.productReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.db.productReview.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
      select: { id: true, helpfulCount: true },
    });
  }

  /**
   * Submit a question about a product.
   */
  async submitQuestion(dto: CreateQuestionDto, customerId?: string) {
    const product = await this.db.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.db.productQuestion.create({
      data: {
        productId: dto.productId,
        customerId: customerId || undefined,
        authorName: dto.authorName.trim(),
        authorEmail: dto.authorEmail.toLowerCase().trim(),
        question: dto.question.trim(),
        status: QuestionStatus.PENDING,
      },
    });
  }

  /**
   * Get approved & answered questions for storefront product page.
   */
  async getProductQuestions(productId: string) {
    return this.db.productQuestion.findMany({
      where: {
        productId,
        status: QuestionStatus.APPROVED,
        isAnswered: true,
      },
      orderBy: { answeredAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        question: true,
        answer: true,
        answeredAt: true,
        answeredBy: true,
        createdAt: true,
      },
    });
  }

  // ================= ADMIN REVIEWS MODERATION =================

  async listReviews(query: QueryReviewsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.ProductReviewWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.rating) {
      where.rating = query.rating;
    }
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { authorName: { contains: q, mode: 'insensitive' } },
        { authorEmail: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              images: {
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      }),
      this.db.productReview.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getStats() {
    const [total, pending, approved, rejected, questionsPending, questionsTotal, agg] =
      await Promise.all([
        this.db.productReview.count(),
        this.db.productReview.count({
          where: { status: ReviewStatus.PENDING },
        }),
        this.db.productReview.count({
          where: { status: ReviewStatus.APPROVED },
        }),
        this.db.productReview.count({
          where: { status: ReviewStatus.REJECTED },
        }),
        this.db.productQuestion.count({
          where: { isAnswered: false, status: QuestionStatus.PENDING },
        }),
        this.db.productQuestion.count(),
        this.db.productReview.aggregate({
          where: { status: ReviewStatus.APPROVED },
          _avg: { rating: true },
        }),
      ]);

    return {
      total,
      pending,
      approved,
      rejected,
      questionsPending,
      questionsTotal,
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
    };
  }

  async updateReviewStatus(id: string, dto: UpdateReviewStatusDto) {
    const existing = await this.db.productReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');

    return this.db.productReview.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async replyToReview(
    id: string,
    dto: ReplyReviewDto,
    adminAuthor = 'Store Management',
  ) {
    const existing = await this.db.productReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');

    return this.db.productReview.update({
      where: { id },
      data: {
        adminReply: dto.reply.trim(),
        adminRepliedAt: new Date(),
        adminReplyAuthor: adminAuthor,
      },
    });
  }

  async deleteReview(id: string) {
    const existing = await this.db.productReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');

    return this.db.productReview.delete({ where: { id } });
  }

  // ================= ADMIN Q&A MODERATION =================

  async listQuestions(query: QueryQuestionsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.ProductQuestionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { authorName: { contains: q, mode: 'insensitive' } },
        { authorEmail: { contains: q, mode: 'insensitive' } },
        { question: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.productQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
            },
          },
        },
      }),
      this.db.productQuestion.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async answerQuestion(
    id: string,
    dto: AnswerQuestionDto,
    adminAuthor = 'Store Management',
  ) {
    const existing = await this.db.productQuestion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Question not found');

    return this.db.productQuestion.update({
      where: { id },
      data: {
        answer: dto.answer.trim(),
        isAnswered: true,
        answeredAt: new Date(),
        answeredBy: adminAuthor,
        status: QuestionStatus.APPROVED,
      },
    });
  }

  async updateQuestionStatus(id: string, dto: UpdateQuestionStatusDto) {
    const existing = await this.db.productQuestion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Question not found');

    return this.db.productQuestion.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async deleteQuestion(id: string) {
    const existing = await this.db.productQuestion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Question not found');

    return this.db.productQuestion.delete({ where: { id } });
  }
}
