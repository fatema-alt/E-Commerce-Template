import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { CategoryImagesController } from './category-images.controller.js';

@Module({
  controllers: [CategoriesController, CategoryImagesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
