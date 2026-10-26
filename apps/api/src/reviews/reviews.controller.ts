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
} from '@nestjs/common';
import type { Request } from 'express';
import { ReviewsService } from './reviews.service.js';
import { CreateQuestionDto, CreateReviewDto } from './reviews.dto.js';

@Controller('shop')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:productId/reviews')
  async getReviews(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('rating', new ParseIntPipe({ optional: true })) rating?: number,
  ) {
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
    const customerId = (req as any).user?.customerId || (req as any).user?.id;
    return this.reviewsService.submitReview(dto, customerId);
  }

  @Post('reviews/:id/helpful')
  async markHelpful(@Param('id', ParseUUIDPipe) id: string) {
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
    const customerId = (req as any).user?.customerId || (req as any).user?.id;
    return this.reviewsService.submitQuestion(dto, customerId);
  }
}
