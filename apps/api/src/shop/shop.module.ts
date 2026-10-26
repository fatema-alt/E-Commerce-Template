import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [PaymentsModule],
  controllers: [ShopController],
  providers: [ShopService, OrdersService],
})
export class ShopModule {}
