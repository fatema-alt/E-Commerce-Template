import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentsService } from './payments.service.js';
import { InitiatePaymentDto } from './payments.dto.js';

@Controller('payments')
@SetMetadata('public', true)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  getMethods() {
    return this.paymentsService.getMethods();
  }

  @Post('initiate')
  async initiate(
    @Body() dto: InitiatePaymentDto,
    @Headers('origin') origin: string | undefined,
  ) {
    return this.paymentsService.initiate(dto.orderId, dto.method, origin);
  }

  @Get('bkash/callback')
  async bkashGetCallback(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.processCallback(
      'BKASH',
      query,
      req.body || {},
    );
    return res.redirect(result.redirectUrl);
  }

  @Post('bkash/callback')
  async bkashPostCallback(
    @Query() query: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.processCallback(
      'BKASH',
      query,
      body,
    );
    return res.redirect(result.redirectUrl);
  }

  @Post('sslcommerz/callback')
  async sslcommerzPostCallback(
    @Query() query: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.processCallback(
      'SSLCOMMERZ',
      query,
      body,
    );
    return res.redirect(result.redirectUrl);
  }

  @Get('sslcommerz/callback')
  async sslcommerzGetCallback(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.processCallback(
      'SSLCOMMERZ',
      query,
      req.body || {},
    );
    return res.redirect(result.redirectUrl);
  }

  @Post('sslcommerz/ipn')
  async sslcommerzIpn(@Body() body: Record<string, unknown>) {
    return this.paymentsService.processIpn('SSLCOMMERZ', body);
  }

  @Get('status/:orderId')
  async getStatus(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.getStatus(orderId);
  }
}
