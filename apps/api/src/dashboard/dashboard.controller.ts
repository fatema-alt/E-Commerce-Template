import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Patch,
  Post,
  Query,
  Req,
  SetMetadata,
  Sse,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Observable } from 'rxjs';
import type { AdminRequest } from '../auth/auth.guard.js';
import {
  AnalyticsEventDto,
  DashboardLayoutDto,
  DashboardQueryDto,
  DashboardTargetDto,
} from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

export { AnalyticsEventDto, DashboardLayoutDto, DashboardQueryDto, DashboardTargetDto };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  overview(@Query() query: DashboardQueryDto, @Req() req: AdminRequest) {
    const role = req.admin?.role ?? 'ADMIN';
    return this.dashboard.overview(query, role);
  }

  @Sse('stream')
  stream(): Observable<{ data: string }> {
    return this.dashboard.eventStream();
  }

  @Get('layout')
  @Header('Cache-Control', 'no-store')
  async getLayout(@Req() req: AdminRequest) {
    const layout = await this.dashboard.getLayout(req.admin!.id);
    return { layout };
  }

  @Patch('layout')
  saveLayout(@Body() dto: DashboardLayoutDto, @Req() req: AdminRequest) {
    return this.dashboard.saveLayout(req.admin!.id, dto.layout);
  }

  @Post('layout/reset')
  resetLayout(@Req() req: AdminRequest) {
    return this.dashboard.resetLayout(req.admin!.id);
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
