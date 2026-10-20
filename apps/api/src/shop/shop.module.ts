import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';
import { OrdersService } from '../orders/orders.service.js';
@Module({
  controllers: [ShopController],
  providers: [ShopService, OrdersService],
})
export class ShopModule {}
