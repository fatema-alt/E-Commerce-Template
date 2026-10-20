import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Patch,
  Post,
  Req,
  SetMetadata,
} from '@nestjs/common';
import { IsIn, IsUUID, Matches } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import type { AdminRequest } from '../auth/auth.guard.js';
import { DashboardService } from './dashboard.service.js';

export class DashboardTargetDto {
  @Matches(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/) amount!: string;
}
export class AnalyticsEventDto {
  @IsUUID('4') id!: string;
  @IsUUID('4') sessionId!: string;
  @IsIn(['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT']) kind!: string;
  @IsIn(['direct', 'organic', 'social', 'referral', 'email']) source!: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get() @Header('Cache-Control', 'no-store') overview() {
    return this.dashboard.overview();
  }
  @Patch('target')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  target(@Body() dto: DashboardTargetDto, @Req() req: AdminRequest) {
    return this.dashboard.setTarget(dto.amount, req.admin!.id);
  }
}

@Controller('shop/analytics')
export class AnalyticsController {
  constructor(private readonly dashboard: DashboardService) {}
  @Post()
  @SetMetadata('public', true)
  track(
    @Body() dto: AnalyticsEventDto,
    @Headers('x-commerce-tracking') token = '',
  ) {
    const secret = process.env.STOREFRONT_CHECKOUT_SECRET ?? '';
    if (
      secret.length < 32 ||
      Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    )
      throw new ForbiddenException();
    return this.dashboard.track(dto);
  }
}
