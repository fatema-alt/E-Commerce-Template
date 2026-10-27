import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReviewsService } from './reviews.service.js';
import { CreateQuestionDto, CreateReviewDto } from './reviews.dto.js';
import { getCookie } from '../auth/auth.guard.js';
import { SHOP_COOKIE, ShopService } from '../shop/shop.service.js';

@Controller('shop')
@SetMetadata('public', true)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly shop: ShopService,
  ) {}

  @Get('products/:productId/reviews')
  async getReviews(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('rating', new ParseIntPipe({ optional: true })) rating?: number,
  ) {
    if (
      (page !== undefined && page < 1) ||
      (limit !== undefined && (limit < 1 || limit > 100)) ||
      (rating !== undefined && (rating < 1 || rating > 5))
    )
      throw new BadRequestException('Invalid review pagination or rating');
    return this.reviewsService.getProductReviews(
      productId,
      page || 1,
      limit || 10,
      rating,
    );
  }

  @Get('products/:productId/reviews/summary')
  async getSummary(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.reviewsService.getProductReviewsSummary(productId);
  }

  @Post('products/:productId/reviews')
  async submitReview(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
  ) {
    dto.productId = productId;
    await this.shop.throttle('review-submit', req.ip || 'unknown', 20, 3600);
    const session = await this.shop.session(getCookie(req, SHOP_COOKIE));
    const customerId = session?.customerId || undefined;
    if (session?.customer?.email) dto.authorEmail = session.customer.email;
    return this.reviewsService.submitReview(dto, customerId);
  }

  @Post('reviews/:id/helpful')
  async markHelpful(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.shop.throttle('review-helpful', req.ip || 'unknown', 100, 3600);
    return this.reviewsService.markHelpful(id);
  }

  @Get('products/:productId/qa')
  async getQuestions(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.reviewsService.getProductQuestions(productId);
  }

  @Post('products/:productId/qa')
  async submitQuestion(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateQuestionDto,
    @Req() req: Request,
  ) {
    dto.productId = productId;
    await this.shop.throttle('question-submit', req.ip || 'unknown', 20, 3600);
    const session = await this.shop.session(getCookie(req, SHOP_COOKIE));
    const customerId = session?.customerId || undefined;
    if (session?.customer?.email) dto.authorEmail = session.customer.email;
    return this.reviewsService.submitQuestion(dto, customerId);
  }
}
