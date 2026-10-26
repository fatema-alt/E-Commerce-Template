import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, BkashAdapter, SslCommerzAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule {}
