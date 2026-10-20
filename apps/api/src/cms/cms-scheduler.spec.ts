import { vi } from 'vitest';
import { CmsScheduler } from './cms-scheduler.service.js';
import type { CmsService } from './cms.service.js';
describe('scheduled CMS publication runner', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it('runs due batches, prevents overlapping work and stops on shutdown', async () => {
    vi.useFakeTimers();
    vi.stubEnv('CMS_SCHEDULER_ENABLED', 'true');
    let complete!: (value: { results: [] }) => void;
    const publishDue = vi.fn(
      () =>
        new Promise<{ results: [] }>((resolve) => {
          complete = resolve;
        }),
    );
    const scheduler = new CmsScheduler({ publishDue } as unknown as CmsService);
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(60000);
    expect(publishDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(publishDue).toHaveBeenCalledTimes(1);
    complete({ results: [] });
    await scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60000);
    expect(publishDue).toHaveBeenCalledTimes(1);
  });
  it('can be disabled when a separate publishing worker is used', async () => {
    vi.useFakeTimers();
    vi.stubEnv('CMS_SCHEDULER_ENABLED', 'false');
    const publishDue = vi.fn();
    const scheduler = new CmsScheduler({ publishDue } as unknown as CmsService);
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(120000);
    expect(publishDue).not.toHaveBeenCalled();
    await scheduler.onModuleDestroy();
  });
});
