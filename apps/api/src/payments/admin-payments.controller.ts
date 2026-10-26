import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service.js';
import { TestGatewayDto, UpdatePaymentSettingDto } from './payments.dto.js';

@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('settings')
  async getSettings() {
    return this.paymentsService.getAdminSettings();
  }

  @Put('settings/:provider')
  async updateSetting(
    @Param('provider') provider: string,
    @Body() dto: UpdatePaymentSettingDto,
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.id || (req as any).admin?.id;
    return this.paymentsService.updateAdminSetting(
      provider.toUpperCase(),
      dto,
      actorId,
    );
  }

  @Post('settings/:provider/test')
  async testGateway(
    @Param('provider') provider: string,
    @Body() dto: TestGatewayDto,
  ) {
    return this.paymentsService.testGateway(provider.toUpperCase(), dto);
  }
}
