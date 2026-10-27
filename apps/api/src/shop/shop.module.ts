import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';

@Module({
  imports: [PaymentsModule, PromotionsModule],
  controllers: [ShopController],
  providers: [ShopService, OrdersService],
  exports: [ShopService],
})
export class ShopModule {}
