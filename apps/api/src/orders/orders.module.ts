import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrdersController } from './orders.controller.js';
import { OrderOperationsService } from './order-operations.service.js';
import { OrderReportsService } from './order-reports.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrderOperationsService, OrderReportsService],
})
export class OrdersModule {}
