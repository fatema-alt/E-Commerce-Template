import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CheckoutPaymentsController } from './checkout-payments.controller.js';
import { CheckoutPaymentsService } from './checkout-payments.service.js';

/** Manual checkout has no dependency on legacy gateway adapters or services. */
@Module({
  imports: [PrismaModule],
  controllers: [CheckoutPaymentsController],
  providers: [CheckoutPaymentsService],
  exports: [CheckoutPaymentsService],
})
export class CheckoutPaymentsModule {}
