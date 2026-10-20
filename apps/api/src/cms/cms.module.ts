import { Module } from '@nestjs/common';
import { CmsAdminController, CmsPublicController } from './cms.controller.js';
import { CmsService } from './cms.service.js';
import { CmsMediaController } from './cms-media.controller.js';
import { CmsScheduler } from './cms-scheduler.service.js';
@Module({
  controllers: [CmsAdminController, CmsPublicController, CmsMediaController],
  providers: [CmsService, CmsScheduler],
})
export class CmsModule {}
