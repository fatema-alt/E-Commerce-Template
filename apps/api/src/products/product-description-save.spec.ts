import { ProductsService } from './products.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
describe('Product description persistence boundary', () => {
  function fixture() {
    const current = {
      id: 'product',
      name: 'Existing product',
      slug: 'existing-product',
      description: '## Original বাংলা\n\n- First\n- Second',
      price: new Prisma.Decimal('100'),
      salePrice: null,
      stock: 0,
      type: 'SIMPLE',
      status: 'DRAFT',
      updatedAt: new Date(),
      inventory: { id: 'inventory', quantity: 0, reserved: 0 },
    };
    const tx = {
      category: { findUnique: vi.fn().mockResolvedValue({ isActive: true }) },
      product: {
        findFirst: vi.fn().mockResolvedValue(current),
        create: vi
          .fn()
          .mockImplementation(({ data }) => ({ ...current, ...data })),
        update: vi.fn().mockResolvedValue(current),
        findUniqueOrThrow: vi.fn().mockResolvedValue(current),
      },
      catalogRedirect: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogAuditLog: { create: vi.fn() },
      inventory: {
        findUnique: vi.fn().mockResolvedValue(current.inventory),
        create: vi.fn(),
      },
      inventoryMovement: { create: vi.fn() },
    };
    const db = {
      ...tx,
      $transaction: vi.fn(
        async (operation: (value: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    };
    return { service: new ProductsService(db as never), tx, current };
  }
  it('stores sanitized canonical HTML on create', async () => {
    const { service, tx } = fixture();
    await service.create({
      name: 'New product',
      slug: 'new-product',
      sku: 'NEW',
      price: '100',
      stock: 0,
      categoryId: 'category',
      description:
        '<h2>বাংলা</h2><p onclick="bad()">Details</p><script>bad()</script>',
    } as CreateProductDto);
    expect(tx.product.create.mock.calls[0]?.[0].data.description).toBe(
      '<h2>বাংলা</h2><p>Details</p>',
    );
  });
  it('retains the exact legacy string when saving an unchanged description', async () => {
    const { service, tx, current } = fixture();
    await service.update('product', { description: current.description });
    expect(tx.product.update.mock.calls[0]?.[0].data.description).toBe(
      current.description,
    );
  });
  it('normalizes edited Markdown without altering product ids, slugs or variant mappings', async () => {
    const { service, tx } = fixture();
    await service.update('product', {
      description: '## Updated বাংলা\n\n1. One\n2. Two',
    });
    const data = tx.product.update.mock.calls[0]?.[0].data;
    expect(data.description).toContain('<h2>Updated বাংলা</h2>');
    expect(data.description).toContain('<ol>');
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('slug');
    expect(data).not.toHaveProperty('variants');
  });
});
