import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, opendir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

export interface MediaStorage {
  put(
    scope: 'products' | 'categories' | 'cms',
    file: Express.Multer.File,
  ): Promise<{ key: string; url: string; thumbnailUrl: string }>;
  remove(scope: 'products' | 'categories' | 'cms', key: string): Promise<void>;
  url(scope: 'products' | 'categories' | 'cms', key: string): string;
  keyFromUrl(scope: 'products' | 'categories' | 'cms', url: string): string | null;
  list(
    scope: 'products' | 'categories' | 'cms',
  ): AsyncIterable<{ key: string; modified: Date }>;
}

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');
export const mediaRoot = () =>
  resolve(process.env.MEDIA_ROOT ?? join(process.cwd(), 'uploads'));

export async function prepareImage(file: Express.Multer.File) {
  if (!file?.buffer?.length || file.buffer.length > 5 * 1024 * 1024)
    throw new BadRequestException('Provide an image of at most 5 MB');
  let original: Buffer;
  let thumbnail: Buffer;
  try {
    const bytes = file.buffer;
    const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp =
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp) throw new Error('Invalid image signature');
    const image = sharp(file.buffer, {
      limitInputPixels: 32_000_000,
      animated: false,
      failOn: 'warning',
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 32 ||
      metadata.height < 32 ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Invalid dimensions or format');
    // Re-encoding strips executable payloads and private EXIF metadata.
    original = await image
      .clone()
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    thumbnail = await image
      .clone()
      .rotate()
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'Image content must be a valid JPG, PNG or WebP, 32–8192 pixels per side, up to 32 megapixels',
    );
  }
  return { original, thumbnail };
}

@Injectable()
export class LocalMediaStorage implements MediaStorage {
  async *list(scope: 'products' | 'categories' | 'cms') {
    const directory = await opendir(join(mediaRoot(), scope)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      },
    );
    if (!directory) return;
    for await (const entry of directory) {
      const key = entry.name.replace(/\.thumb\.webp$/, '');
      if (!entry.isFile() || !/^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key))
        continue;
      const info = await stat(join(mediaRoot(), scope, entry.name)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
          return null;
        },
      );
      if (info) yield { key, modified: info.mtime };
    }
  }
  url(scope: 'products' | 'categories' | 'cms', key: string) {
    return '/uploads/' + scope + '/' + key;
  }
  keyFromUrl(scope: 'products' | 'categories' | 'cms', url: string) {
    const prefix = '/uploads/' + scope + '/';
    const key = url.startsWith(prefix) ? url.slice(prefix.length) : '';
    return /^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key) ? key : null;
  }
  async put(scope: 'products' | 'categories' | 'cms', file: Express.Multer.File) {
    const { original, thumbnail } = await prepareImage(file);
    const key = randomUUID() + '.webp';
    await mkdir(join(mediaRoot(), scope), { recursive: true });
    try {
      await writeFile(join(mediaRoot(), scope, key), original, { flag: 'wx' });
      await writeFile(
        join(mediaRoot(), scope, key + '.thumb.webp'),
        thumbnail,
        { flag: 'wx' },
      );
    } catch (error) {
      await this.remove(scope, key);
      throw error;
    }
    return {
      key,
      url: '/uploads/' + scope + '/' + key,
      thumbnailUrl: '/uploads/' + scope + '/' + key + '.thumb.webp',
    };
  }

  async remove(scope: 'products' | 'categories' | 'cms', key: string) {
    if (!/^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/.test(key))
      throw new BadRequestException('Invalid storage key');
    for (const filename of [key, key + '.thumb.webp']) {
      await unlink(join(mediaRoot(), scope, filename)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        },
      );
    }
  }
}
