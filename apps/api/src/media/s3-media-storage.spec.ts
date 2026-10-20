import sharp from 'sharp';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3MediaStorage } from './s3-media-storage.service.js';
describe('S3 media provider (offline)', () => {
  beforeEach(() => {
    vi.stubEnv('MEDIA_S3_BUCKET', 'catalog-test-bucket');
    vi.stubEnv('MEDIA_PUBLIC_URL', 'https://cdn.example.test');
    vi.stubEnv('MEDIA_S3_PREFIX', 'catalog/');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('uploads optimized images and thumbnails under scoped storage keys', async () => {
    const storage = new S3MediaStorage();
    const send = vi
      .spyOn(storage.client, 'send')
      .mockResolvedValue({} as never);
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const result = await storage.put('products', {
      buffer: image,
    } as Express.Multer.File);
    expect(send).toHaveBeenCalledTimes(2);
    const original = send.mock.calls[0][0] as PutObjectCommand;
    expect(original.input.Bucket).toBe('catalog-test-bucket');
    expect(original.input.Key).toBe('catalog/products/' + result.key);
    expect(original.input.ContentType).toBe('image/webp');
    expect(result.thumbnailUrl).toBe(result.url + '.thumb.webp');
    expect(storage.keyFromUrl('products', result.url)).toBe(result.key);
    expect(storage.keyFromUrl('categories', result.url)).toBeNull();
    storage.client.destroy();
  });
  it('rejects traversal and foreign media URLs without storage requests', async () => {
    const storage = new S3MediaStorage();
    const send = vi
      .spyOn(storage.client, 'send')
      .mockResolvedValue({} as never);
    await expect(
      storage.remove('products', '../categories/secret.webp'),
    ).rejects.toThrow('storage key');
    expect(
      storage.keyFromUrl(
        'products',
        'https://evil.test/catalog/products/asset.webp',
      ),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
    storage.client.destroy();
  });
});
