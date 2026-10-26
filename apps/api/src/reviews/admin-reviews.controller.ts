import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReviewsService } from './reviews.service.js';
import {
  AnswerQuestionDto,
  QueryQuestionsDto,
  QueryReviewsDto,
  ReplyReviewDto,
  UpdateQuestionStatusDto,
  UpdateReviewStatusDto,
} from './reviews.dto.js';

@Controller('admin')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  async listReviews(@Query() query: QueryReviewsDto) {
    return this.reviewsService.listReviews(query);
  }

  @Get('reviews/stats')
  async getStats() {
    return this.reviewsService.getStats();
  }

  @Patch('reviews/:id/status')
  async updateReviewStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateReviewStatus(id, dto);
  }

  @Post('reviews/:id/reply')
  async replyToReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
    @Req() req: Request,
  ) {
    const adminName =
      (req as any).user?.name ||
      (req as any).user?.email ||
      'Store Management';
    return this.reviewsService.replyToReview(id, dto, adminName);
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.deleteReview(id);
  }

  @Get('qa')
  async listQuestions(@Query() query: QueryQuestionsDto) {
    return this.reviewsService.listQuestions(query);
  }

  @Post('qa/:id/answer')
  async answerQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerQuestionDto,
    @Req() req: Request,
  ) {
    const adminName =
      (req as any).user?.name ||
      (req as any).user?.email ||
      'Store Support';
    return this.reviewsService.answerQuestion(id, dto, adminName);
  }

  @Patch('qa/:id/status')
  async updateQuestionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionStatusDto,
  ) {
    return this.reviewsService.updateQuestionStatus(id, dto);
  }

  @Delete('qa/:id')
  async deleteQuestion(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.deleteQuestion(id);
  }
}
