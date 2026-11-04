import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Req,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsObject,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import type { AdminRequest } from '../auth/auth.guard.js';
import { TrackingService } from './tracking.service.js';
import {
  courierFields,
  type Courier,
  type Credentials,
} from './courier-adapters.js';

export class TrackingLookupDto {
  @IsString() @Length(3, 100) orderNumber!: string;
  @IsString() @Length(6, 32) phone!: string;
}
export class CourierSettingsDto {
  @IsBoolean() isEnabled!: boolean;
  @IsBoolean() isSandbox!: boolean;
  @IsObject() credentials!: Credentials;
}
export class CourierTestDto {
  @IsString() @Length(1, 120) trackingNumber!: string;
}
@Controller('shop/tracking')
@SetMetadata('public', true)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}
  @Post() @Header('Cache-Control', 'no-store') async lookup(
    @Body() dto: TrackingLookupDto,
    @Req() req: Request,
  ) {
    await this.tracking.throttle(`lookup-ip:${req.ip}`, 100);
    await this.tracking.throttle(`lookup:${req.ip}:${dto.orderNumber.trim().toUpperCase()}`, 10);
    return this.tracking.lookup(dto.orderNumber, dto.phone);
  }
  @Get(':token') @Header('Cache-Control', 'no-store') async status(
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    if (token.length > 1000)
      throw new BadRequestException('Invalid tracking access');
    await this.tracking.throttle(`poll:${token}`, 10);
    return this.tracking.byToken(token);
  }
}
@Controller('admin/couriers')
@SetMetadata('roles', ['SUPER_ADMIN'])
export class CourierSettingsController {
  constructor(private readonly tracking: TrackingService) {}
  @Get() @Header('Cache-Control', 'no-store') settings() {
    return this.tracking.settings();
  }
  @Post(':provider/test') test(
    @Param('provider') provider: string,
    @Body() dto: CourierTestDto,
  ) {
    if (!Object.hasOwn(courierFields, provider))
      throw new BadRequestException('Unknown courier');
    return this.tracking.testCourier(
      provider as Courier,
      dto.trackingNumber.trim(),
    );
  }
  @Put(':provider') save(
    @Param('provider') provider: string,
    @Body() dto: CourierSettingsDto,
    @Req() req: AdminRequest,
  ) {
    if (!Object.hasOwn(courierFields, provider))
      throw new BadRequestException('Unknown courier');
    return this.tracking.saveSettings(provider as Courier, dto, req.admin?.id);
  }
}
