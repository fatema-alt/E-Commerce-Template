import { SetMetadata } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { ProductVariantsService } from './product-variants.service.js';

import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import { AdjustVariantStockDto } from './dto/adjust-variant-stock.dto.js';
import type { AdminRequest } from '../../auth/auth.guard.js';
import {
  BulkVariantsDto,
  GenerateVariantsDto,
} from './dto/variant-actions.dto.js';

@Controller('products/:productId/variants')
export class ProductVariantsController {
  constructor(private readonly service: ProductVariantsService) {}

  @Post('generate')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  generate(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: GenerateVariantsDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.generate(productId, dto, req.admin?.id);
  }

  @Post('bulk')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  bulk(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: BulkVariantsDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.bulk(productId, dto, req.admin?.id);
  }

  @Get()
  findAll(
    @Param('productId', ParseUUIDPipe)
    productId: string,
  ) {
    return this.service.findAll(productId);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post()
  create(
    @Param('productId', ParseUUIDPipe)
    productId: string,

    @Body()
    dto: CreateVariantDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.create(productId, dto, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':variantId')
  update(
    @Param('productId', ParseUUIDPipe) productId: string,

    @Param('variantId', ParseUUIDPipe)
    id: string,

    @Body()
    dto: UpdateVariantDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.update(productId, id, dto, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Delete(':variantId')
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,

    @Param('variantId', ParseUUIDPipe)
    id: string,
    @Req() req: AdminRequest,
  ) {
    return this.service.remove(productId, id, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post(':variantId/stock-adjustments')
  adjustStock(
    @Param('productId', ParseUUIDPipe)
    productId: string,

    @Param('variantId', ParseUUIDPipe)
    variantId: string,

    @Body()
    dto: AdjustVariantStockDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.adjustStock(productId, variantId, dto, req.admin?.id);
  }
}
