import { describe, expect, it, vi } from 'vitest';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontQueryDto } from './storefront-query.dto.js';

describe('StorefrontController - categories', () => {
  it('executes legacy query when includeCounts is omitted or false', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Electronics', slug: 'electronics' },
      ]),
    };
    const controller = new StorefrontController(mockPrisma as never);
    const query = new StorefrontQueryDto();

    const result = (await controller.categories(query)) as unknown[];
    expect(result).toHaveLength(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    // The SQL must NOT contain cat_tree or counts
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');
    expect(sqlText).not.toContain('cat_tree');
    expect(sqlText).not.toContain('productCount');
  });

  it('executes recursive product count CTE query when includeCounts is true', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Electronics', slug: 'electronics', productCount: 12 },
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
    expect(result[0].productCount).toBe(12);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    // The SQL MUST contain cat_tree and productCount
    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    const sqlText = (sqlArg.strings || []).join(' ');
    expect(sqlText).toContain('cat_tree');
    expect(sqlText).toContain('productCount');
  });
});
