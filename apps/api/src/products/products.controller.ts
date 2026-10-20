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
  Query,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CatalogQueryDto } from '../catalog/catalog-query.dto.js';
import { BulkProductDto } from './dto/bulk-product.dto.js';
import type { AdminRequest } from '../auth/auth.guard.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: AdminRequest) {
    return this.productsService.create(dto, req.admin?.id);
  }

  @Get()
  findAll(@Query() query: CatalogQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('summary') summary() {
    return this.productsService.summary();
  }

  @Post('bulk')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  bulk(@Body() dto: BulkProductDto, @Req() req: AdminRequest) {
    return this.productsService.bulk(dto, req.admin?.id, req.admin?.role);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: AdminRequest,
  ) {
    return this.productsService.update(id, dto, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post(':id/stock-adjustments')
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @Req() req: AdminRequest,
  ) {
    return this.productsService.adjustStock(id, dto, req.admin?.id);
  }

  @Get(':id/stock-movements')
  getStockMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getStockMovements(id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN'])
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AdminRequest) {
    return this.productsService.remove(id, req.admin?.id);
  }
}
