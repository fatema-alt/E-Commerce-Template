import { describe, expect, it, vi } from 'vitest';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontQueryDto } from './storefront-query.dto.js';

describe('StorefrontController - categories', () => {
  it('preserves old response shape and executes legacy query when includeCounts is omitted or false', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Electronics', slug: 'electronics' },
        { id: 'cat-2', name: 'Cameras', slug: 'cameras' },
      ]),
    };
    const controller = new StorefrontController(mockPrisma as never);
    const query = new StorefrontQueryDto();

    const result = (await controller.categories(query)) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(2);
    // productCount must not exist on any returned category
    expect(result[0].productCount).toBeUndefined();
    expect(result[1].productCount).toBeUndefined();
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    // The SQL must NOT contain cat_tree, counts or productCount
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');
    expect(sqlText).not.toContain('cat_tree');
    expect(sqlText).not.toContain('productCount');
  });

  it('executes recursive product count CTE query when includeCounts is true', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Electronics', slug: 'electronics', productCount: 14 },
      ]),
    };
    const controller = new StorefrontController(mockPrisma as never);
    const query = new StorefrontQueryDto();
    query.includeCounts = true;

    const result = (await controller.categories(query)) as Array<{
      id: string;
      name: string;
      slug: string;
      productCount?: number;
    }>;
    expect(result).toHaveLength(1);
    expect(result[0].productCount).toBe(14);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    // The SQL MUST contain cat_tree and productCount
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');
    expect(sqlText).toContain('cat_tree');
    expect(sqlText).toContain('productCount');
  });

  it('correctly filters for active, visible, non-deleted products in SQL conditions', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const controller = new StorefrontController(mockPrisma as never);
    const query = new StorefrontQueryDto();
    query.includeCounts = true;

    await controller.categories(query);
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');

    // Must enforce active status, isActive, isVisible and deletedAt IS NULL
    expect(sqlText).toContain("p.\"deletedAt\" IS NULL");
    expect(sqlText).toContain("p.status = 'ACTIVE'");
    expect(sqlText).toContain('p."isActive"');
    expect(sqlText).toContain('p."isVisible"');
  });

  it('correctly builds tree hierarchy connecting child categories to parent root_id for descendant counts', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const controller = new StorefrontController(mockPrisma as never);
    const query = new StorefrontQueryDto();
    query.includeCounts = true;

    await controller.categories(query);
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');

    // cat_tree CTE must select root_id and recursively join children
    expect(sqlText).toContain('t.root_id');
    expect(sqlText).toContain('JOIN cat_tree t ON c."parentId" = t.id');
    expect(sqlText).toContain('GROUP BY t.root_id');
  });
});
