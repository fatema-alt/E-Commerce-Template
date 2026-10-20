import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { prepareImage } from './media-storage.service.js';
import type { MediaStorage } from './media-storage.service.js';
type Scope = 'products' | 'categories' | 'cms';

export class S3MediaStorage implements MediaStorage {
  readonly client: S3Client;
  readonly bucket: string;
  private readonly baseUrl: string;
  private readonly prefix: string;

  constructor() {
    this.bucket = process.env.MEDIA_S3_BUCKET ?? '';
    this.baseUrl = (process.env.MEDIA_PUBLIC_URL ?? '').replace(/\/$/, '');
    this.prefix = process.env.MEDIA_S3_PREFIX ?? 'catalog/';
    if (
      !this.bucket ||
      !/^https:\/\//.test(this.baseUrl) ||
      !/^(?:[a-zA-Z0-9_-]+\/)*$/.test(this.prefix)
    )
      throw new Error(
        'S3 media requires MEDIA_S3_BUCKET, an HTTPS MEDIA_PUBLIC_URL, and a safe optional MEDIA_S3_PREFIX ending in /',
      );
    const url = new URL(this.baseUrl);
    if (url.username || url.password || url.search || url.hash)
      throw new Error(
        'Media public URL cannot contain credentials, queries or fragments',
      );
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
    });
  }

  url(scope: Scope, key: string) {
    return this.baseUrl + '/' + this.prefix + scope + '/' + key;
  }
  keyFromUrl(scope: Scope, url: string) {
    const prefix = this.url(scope, '');
    const key = url.startsWith(prefix) ? url.slice(prefix.length) : '';
    return /^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key) ? key : null;
  }
  async put(scope: Scope, file: Express.Multer.File) {
    const { original, thumbnail } = await prepareImage(file);
    const key = randomUUID() + '.webp';
    try {
      for (const [name, body] of [
        [key, original],
        [key + '.thumb.webp', thumbnail],
      ] as const) {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.prefix + scope + '/' + name,
            Body: body,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
      }
    } catch (error) {
      await this.remove(scope, key);
      throw error;
    }
    return {
      key,
      url: this.url(scope, key),
      thumbnailUrl: this.url(scope, key + '.thumb.webp'),
    };
  }
  async remove(scope: Scope, key: string) {
    if (!/^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key))
      throw new BadRequestException('Invalid storage key');
    const result = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: [key, key + '.thumb.webp'].map((name) => ({
            Key: this.prefix + scope + '/' + name,
          })),
        },
      }),
    );
    if (result.Errors?.length) throw new Error('Object storage cleanup failed');
  }
  async *list(scope: Scope) {
    let token: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix + scope + '/',
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const item of result.Contents ?? []) {
        const key = item.Key?.slice((this.prefix + scope + '/').length).replace(
          /\.thumb\.webp$/,
          '',
        );
        if (
          key &&
          /^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key) &&
          item.LastModified
        )
          yield { key, modified: item.LastModified };
      }
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (token);
  }
}
