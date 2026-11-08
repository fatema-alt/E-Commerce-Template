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
  SetMetadata,
} from '@nestjs/common';
import type { AdminRequest } from '../auth/auth.guard.js';
import { PurchasingService } from './purchasing.service.js';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';
import {
  ChangePurchaseOrderStatusDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderPaymentDto,
} from './dto/purchase-order.dto.js';
import { CreateGoodsReceiptDto } from './dto/goods-receipt.dto.js';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly service: PurchasingService) {}

  @Get('summary')
  getSummary() {
    return this.service.getPurchasingSummary();
  }

  // ==========================================
  // Suppliers Endpoints
  // ==========================================

  @Get('suppliers')
  listSuppliers(
    @Query('q') q?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listSuppliers({
      q,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('suppliers/:id')
  getSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSupplier(id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(dto);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.updateSupplier(id, dto);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Delete('suppliers/:id')
  deleteSupplier(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteSupplier(id);
  }

  // ==========================================
  // Purchase Orders Endpoints
  // ==========================================

  @Get('orders')
  listOrders(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listOrders({
      status,
      supplierId,
      paymentStatus,
      q,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('orders/:id')
  getOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getOrder(id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Post('orders')
  createOrder(@Body() dto: CreatePurchaseOrderDto, @Req() req: AdminRequest) {
    return this.service.createOrder(dto, req.admin?.email || req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Patch('orders/:id')
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.updateOrder(id, dto);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Post('orders/:id/status')
  changeOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePurchaseOrderStatusDto,
  ) {
    return this.service.changeOrderStatus(id, dto);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Post('orders/:id/payment')
  updateOrderPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderPaymentDto,
  ) {
    return this.service.updateOrderPayment(id, dto);
  }

  // ==========================================
  // Goods Receipts Endpoints
  // ==========================================

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
  @Post('orders/:id/receive')
  receiveGoods(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGoodsReceiptDto,
    @Req() req: AdminRequest,
  ) {
    return this.service.receiveGoods(
      id,
      dto,
      req.admin?.email || req.admin?.id,
    );
  }

  @Get('receipts')
  listReceipts(
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listReceipts({
      purchaseOrderId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('receipts/:id')
  getReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getReceipt(id);
  }
}
