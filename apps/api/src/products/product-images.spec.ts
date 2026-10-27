import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ProductImagesController,
  ImageOrderDto,
} from './product-images.controller.js';
describe('Gallery ordering and shared media safety', () => {
  const first = '11111111-1111-4111-8111-111111111111',
    second = '22222222-2222-4222-8222-222222222222';
  function fixture(shared = 0) {
    const image = {
      id: first,
      productId: 'product',
      storageKey: 'old-key',
      url: '/uploads/products/shared.webp',
      isPrimary: false,
    };
    const tx = {
      $executeRaw: vi.fn(),
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'product' }) },
      productImage: {
        findMany: vi.fn().mockResolvedValue([{ id: first }, { id: second }]),
        findFirst: vi.fn().mockResolvedValue(image),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(shared),
      },
      cmsMediaAsset: { count: vi.fn().mockResolvedValue(0) },
      category: { count: vi.fn().mockResolvedValue(0) },
      catalogAuditLog: { create: vi.fn() },
    };
    const db = {
      ...tx,
      $transaction: vi.fn(
        async (operation: (value: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    };
    const storage = { remove: vi.fn().mockResolvedValue(undefined) };
    return {
      service: new ProductImagesController(db as never, storage as never),
      tx,
      db,
      storage,
    };
  }
  it('reorders a complete product gallery transactionally and makes the first image primary', async () => {
    const { service, tx, db } = fixture();
    await service.reorder('product', { imageIds: [second, first] }, {
      admin: { id: 'admin' },
    } as never);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.productImage.update.mock.calls).toEqual([
      [{ where: { id: second }, data: { sortOrder: 0, isPrimary: true } }],
      [{ where: { id: first }, data: { sortOrder: 1, isPrimary: false } }],
    ]);
    expect(tx.catalogAuditLog.create).toHaveBeenCalled();
  });
  it('rejects stale/incomplete or foreign image lists without updating mappings', async () => {
    const { service, tx } = fixture();
    await expect(
      service.reorder('product', { imageIds: [first] }, {
        admin: { id: 'admin' },
      } as never),
    ).rejects.toThrow('gallery changed');
    expect(tx.productImage.update).not.toHaveBeenCalled();
  });
  it('validates duplicates and non-UUID image ids at the request boundary', async () => {
    for (const imageIds of [[first, first], ['foreign'], []])
      expect(
        (await validate(plainToInstance(ImageOrderDto, { imageIds }))).length,
      ).toBeGreaterThan(0);
  });
  it('removes only a mapping when another image still references the underlying file', async () => {
    const { service, tx, storage } = fixture(1);
    await service.remove('product', first, { admin: { id: 'admin' } } as never);
    expect(tx.productImage.delete).toHaveBeenCalledWith({
      where: { id: first },
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('keeps files referenced by CMS assets', async () => {
    const { service, tx, storage } = fixture();
    tx.cmsMediaAsset.count.mockResolvedValue(1);
    await service.remove('product', first, { admin: { id: 'admin' } } as never);
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('cleans up an unreferenced generated file after mapping removal', async () => {
    const { service, storage } = fixture();
    await service.remove('product', first, { admin: { id: 'admin' } } as never);
    expect(storage.remove).toHaveBeenCalledWith('products', 'old-key');
  });
});
