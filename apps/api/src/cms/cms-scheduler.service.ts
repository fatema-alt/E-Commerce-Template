import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { CmsService } from './cms.service.js';
@Injectable()
export class CmsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CmsScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private closing = false;
  private pending?: Promise<void>;
  constructor(private readonly cms: CmsService) {}
  onModuleInit() {
    if (process.env.CMS_SCHEDULER_ENABLED === 'false') return;
    this.timer = setInterval(() => {
      if (!this.running) this.pending = this.run();
    }, 60000);
    this.timer.unref();
  }
  private async run() {
    if (this.running || this.closing) return;
    this.running = true;
    try {
      const { results } = await this.cms.publishDue();
      if (results.some((result) => result.status === 'FAILED'))
        this.logger.error(
          'A scheduled CMS publication failed; inspect the schedule and retry.',
        );
    } catch {
      this.logger.error(
        'CMS scheduler could not complete its batch; it will retry next minute.',
      );
    } finally {
      this.running = false;
    }
  }
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.pending;
  }
}
