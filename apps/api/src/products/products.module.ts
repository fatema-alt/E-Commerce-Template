import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductImagesController } from './product-images.controller.js';
import { ProductsService } from './products.service.js';
import { ProductVariantsController } from './variants/product-variants.controller.js';
import { ProductVariantsService } from './variants/product-variants.service.js';

@Module({
  controllers: [
    ProductsController,
    ProductImagesController,
    ProductVariantsController,
  ],
  providers: [ProductsService, ProductVariantsService],
})
export class ProductsModule {}
