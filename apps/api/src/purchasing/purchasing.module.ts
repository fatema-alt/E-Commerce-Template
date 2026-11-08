import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PurchasingController } from './purchasing.controller.js';
import { PurchasingService } from './purchasing.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
