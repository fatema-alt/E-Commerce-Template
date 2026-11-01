import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  SetMetadata,
} from '@nestjs/common';
import type { AdminRequest } from '../auth/auth.guard.js';
import { CheckoutPaymentsService } from './checkout-payments.service.js';
import {
  PaymentMethodDto,
  PlanSettingsDto,
  ReviewManualDto,
} from './checkout-payments.dto.js';

@Controller('admin/checkout-payments')
@SetMetadata('roles', ['SUPER_ADMIN'])
export class CheckoutPaymentsController {
  constructor(private readonly service: CheckoutPaymentsService) {}
  @Get() async config() {
    return {
      settings: await this.service.settings(),
      methods: await this.service.methods(),
    };
  }
  @Put('settings') settings(@Body() dto: PlanSettingsDto) {
    return this.service.saveSettings(dto);
  }
  @Post('methods') create(@Body() dto: PaymentMethodDto) {
    return this.service.saveMethod(dto);
  }
  @Put('methods/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentMethodDto,
  ) {
    return this.service.saveMethod(dto, id);
  }
  @Delete('methods/:id') delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteMethod(id);
  }
  @Post('review/:id') review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewManualDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.review(id, dto, req.admin!.id);
  }
}
