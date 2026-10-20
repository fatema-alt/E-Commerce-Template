import { SetMetadata } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { Req } from '@nestjs/common';
import type { AdminRequest } from '../auth/auth.guard.js';
import {
  InventoryAdjustmentDto,
  InventoryThresholdDto,
} from './inventory.dto.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  overview() {
    return this.service.overview();
  }

  @Get('movements')
  movements(@Query('take') take?: string) {
    const parsed = take === undefined ? 100 : Number(take);
    if (!Number.isInteger(parsed) || parsed < 1)
      throw new BadRequestException('take must be a positive integer');
    return this.service.movements(parsed);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post(':id/adjust')
  adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InventoryAdjustmentDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.adjust(id, body, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':id/threshold')
  threshold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InventoryThresholdDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.setThreshold(id, body.lowStockAt, req.admin?.id);
  }
}
