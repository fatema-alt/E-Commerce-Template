import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { CreateCouponDto, UpdateCouponDto } from './promotions.dto.js';

@Controller('promotions/coupons')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  async list(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('q') q?: string,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ) {
    return this.promotionsService.list({ page, limit, q, isActive });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.get(id);
  }

  @Post()
  async create(@Body() dto: CreateCouponDto) {
    return this.promotionsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.promotionsService.update(id, dto);
  }

  @Post(':id/toggle')
  async toggle(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.toggleActive(id);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.delete(id);
  }
}
