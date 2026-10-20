import { Global, Module } from '@nestjs/common';
import { MEDIA_STORAGE, LocalMediaStorage } from './media-storage.service.js';
import { S3MediaStorage } from './s3-media-storage.service.js';
export function createMediaStorage() {
  const kind = process.env.MEDIA_STORAGE ?? 'local';
  if (kind === 's3') return new S3MediaStorage();
  if (kind !== 'local') throw new Error('MEDIA_STORAGE must be local or s3');
  if (process.env.NODE_ENV === 'production' && !process.env.MEDIA_ROOT)
    throw new Error(
      'Production local media requires MEDIA_ROOT on a durable volume, or MEDIA_STORAGE=s3',
    );
  return new LocalMediaStorage();
}
@Global()
@Module({
  providers: [{ provide: MEDIA_STORAGE, useFactory: createMediaStorage }],
  exports: [MEDIA_STORAGE],
})
export class MediaModule {}
