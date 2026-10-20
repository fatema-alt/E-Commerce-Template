import sharp from 'sharp';
import { LocalMediaStorage } from './media-storage.service.js';
describe('Media content validation', () => {
  const storage = new LocalMediaStorage();
  it('rejects forged MIME types, executable content and tiny images before writing', async () => {
    await expect(
      storage.put('products', {
        buffer: Buffer.from('<script>alert(1)</script>'),
        mimetype: 'image/png',
      } as Express.Multer.File),
    ).rejects.toThrow('Image content');
    const tiny = await sharp({
      create: { width: 8, height: 8, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      storage.put('products', { buffer: tiny } as Express.Multer.File),
    ).rejects.toThrow('Image content');
  });
  it('blocks path traversal during file deletion', async () => {
    await expect(
      storage.remove('products', '../../outside.txt'),
    ).rejects.toThrow('storage key');
  });
});
