import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrackingService } from './tracking.service.js';
import {
  TrackingController,
  CourierSettingsController,
} from './tracking.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [TrackingController, CourierSettingsController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
