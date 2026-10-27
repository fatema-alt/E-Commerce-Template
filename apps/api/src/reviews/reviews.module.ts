import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReviewsService } from './reviews.service.js';
import { ReviewsController } from './reviews.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { ShopModule } from '../shop/shop.module.js';

@Module({
  imports: [PrismaModule, ShopModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
