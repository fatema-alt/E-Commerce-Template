import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
} from '@nestjs/common';
import type { AdminRequest } from '../auth/auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import {
  ChangeOrderStatusDto,
  AddOrderNoteDto,
} from './dto/order-management.dto.js';
import { BookManualShipmentDto } from './dto/order-shipping-returns.dto.js';
import { OrderOperationsService } from './order-operations.service.js';
import { OrderReportsService } from './order-reports.service.js';
import {
  OrderMutationDto,
  ShipmentUpdateDto,
  ReturnRequestDto,
  ReturnDecisionDto,
  ReturnReceiveDto,
  PaymentRecordDto,
} from './dto/order-operations.dto.js';
import type { Response } from 'express';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrderOperationsService,
    private readonly reports: OrderReportsService,
  ) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
  ) {
    return this.orders.list({
      page,
      limit,
      status,
      q,
      paymentStatus,
      paymentMethod,
      from,
      to,
      sort,
    });
  }

  @Get('reports')
  report(@Query() filters: Record<string, string>) {
    const { period, ...query } = filters;
    return this.reports.report(query, period);
  }

  @Get('export')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  async export(
    @Query() filters: Record<string, string>,
    @Req() req: AdminRequest,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportCsv(filters, req.admin!.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }

  @Post()
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.create(dto, key, req.admin!.id);
  }

  @Patch(':id/status')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderStatusDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.changeStatus(id, dto, key, req.admin!);
  }

  @Post(':id/notes')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderNoteDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.addNote(id, dto, key, req.admin!);
  }

  @Post(':id/cancel')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderMutationDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.cancel(id, dto, key, req.admin!);
  }
  @Post(':id/shipments/manual')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  bookManualShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookManualShipmentDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.bookManualShipment(id, dto, key, req.admin!);
  }

  @Post(':id/returns/request')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  requestReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.requestReturn(id, dto, key, req.admin!);
  }

  @Post(':id/returns/:returnId/receive')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  receiveReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('returnId', ParseUUIDPipe) returnId: string,
    @Body() dto: ReturnReceiveDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.receiveReturn(id, returnId, dto, key, req.admin!);
  }

  @Patch(':id/shipments/:shipmentId')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  updateShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @Body() dto: ShipmentUpdateDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.updateShipment(id, shipmentId, dto, key, req.admin!);
  }

  @Post(':id/returns/:returnId/decision')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  decideReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('returnId', ParseUUIDPipe) returnId: string,
    @Body() dto: ReturnDecisionDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.decideReturn(id, returnId, dto, key, req.admin!);
  }

  @Post(':id/payments')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRecordDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.orders.recordPayment(id, dto, key, req.admin!);
  }
}
