import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toProductHtml } from '@commerce/product-content';
import {
  InventoryMovementType,
  Prisma,
  ProductStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AdjustStockDto, StockAdjustmentType } from './dto/adjust-stock.dto.js';
import { CatalogQueryDto } from '../catalog/catalog-query.dto.js';
import { BulkProductDto } from './dto/bulk-product.dto.js';
import {
  audit,
  changeSlug,
  prices,
  validateOptions,
  validateAttributes,
  money,
  rejectNulls,
} from '../catalog/catalog.rules.js';
const requiredFields = [
  'name',
  'slug',
  'sku',
  'price',
  'stock',
  'categoryId',
  'isActive',
  'type',
  'status',
  'tags',
  'collections',
  'isVisible',
  'isFeatured',
  'currency',
  'taxClass',
  'taxInclusive',
  'trackInventory',
  'backorderPolicy',
  'requiresShipping',
  'freeShipping',
  'weightUnit',
  'dimensionUnit',
  'noIndex',
  'options',
];

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly productInclude = {
    category: {
      select: { id: true, name: true },
    },
    inventory: true,
    images: {
      orderBy: { sortOrder: 'asc' as const },
    },
    variants: { include: { inventory: true }, take: 200 },
  };

  private async checkCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || !category.isActive) {
      throw new BadRequestException(
        'Selected category does not exist or is inactive',
      );
    }
  }

  private checkPrices(
    price: string | Prisma.Decimal,
    salePrice?: string | Prisma.Decimal | null,
  ) {
    prices(price, salePrice);
  }

  async create(dto: CreateProductDto, actorId?: string) {
    if (dto.description !== undefined) {
      dto.description = toProductHtml(dto.description);
      if (dto.description.length > 50000) throw new BadRequestException('Formatted description exceeds 50,000 characters');
    }
    await this.checkCategory(dto.categoryId);
    this.checkPrices(dto.price, dto.salePrice);
    this.validateProduct(dto);
    if (
      dto.type === 'VARIABLE' &&
      (dto.stock > 0 || dto.status === 'ACTIVE' || dto.isActive === true)
    )
      throw new BadRequestException(
        'Create variable products as drafts with zero parent stock, then configure and publish their variants',
      );

    const { stock, ...productData } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (
          await tx.catalogRedirect.findUnique({
            where: {
              entity_fromSlug: { entity: 'product', fromSlug: dto.slug },
            },
          })
        )
          throw new ConflictException('Slug is reserved by a historical URL');
        const product = await tx.product.create({
          data: {
            ...productData,
            stock,
            status:
              dto.status ??
              (dto.isActive === true
                ? ProductStatus.ACTIVE
                : ProductStatus.DRAFT),
            isActive: dto.status
              ? dto.status === 'ACTIVE'
              : dto.isActive === true,
          },
        });

        await audit(tx, 'product', product.id, 'CREATE', dto, actorId);

        await tx.inventory.create({
          data: {
            productId: product.id,
            quantity: stock,
            reserved: 0,
            lowStockAt: 5,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: InventoryMovementType.OPENING,
            quantity: stock,
            beforeQty: 0,
            afterQty: stock,
            reason: 'Opening inventory',
          },
        });

        return tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: this.productInclude,
        });
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private availability = Prisma.sql`COALESCE((SELECT SUM(i.quantity - i.reserved) FROM inventories i LEFT JOIN product_variants v ON v.id = i."variantId" WHERE (p.type = 'SIMPLE' AND i."productId" = p.id) OR (p.type = 'VARIABLE' AND v."productId" = p.id AND v."isActive" = true)), 0)`;
  private lowStock = Prisma.sql`EXISTS (SELECT 1 FROM inventories i LEFT JOIN product_variants v ON v.id = i."variantId" WHERE ((p.type = 'SIMPLE' AND i."productId" = p.id) OR (p.type = 'VARIABLE' AND v."productId" = p.id AND v."isActive")) AND i.quantity - i.reserved > 0 AND i.quantity - i.reserved <= i."lowStockAt")`;

  async findAll(query = new CatalogQueryDto()) {
    const conditions = [Prisma.sql`p."deletedAt" IS NULL`];
    if (query.search)
      conditions.push(
        Prisma.sql`(p.name ILIKE ${'%' + query.search + '%'} OR p.sku ILIKE ${'%' + query.search + '%'} OR p.barcode ILIKE ${'%' + query.search + '%'} OR EXISTS (SELECT 1 FROM product_variants v WHERE v."productId" = p.id AND (v.sku ILIKE ${'%' + query.search + '%'} OR v.barcode ILIKE ${'%' + query.search + '%'})))`,
      );
    if (query.categoryId)
      conditions.push(
        Prisma.sql`p."categoryId" IN (WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE id = ${query.categoryId} UNION SELECT c.id FROM categories c JOIN descendants d ON c."parentId" = d.id) SELECT id FROM descendants)`,
      );
    if (query.brand) conditions.push(Prisma.sql`p.brand = ${query.brand}`);
    if (query.status)
      conditions.push(Prisma.sql`p.status::text = ${query.status}`);
    if (query.type) conditions.push(Prisma.sql`p.type::text = ${query.type}`);
    if (query.minPrice)
      conditions.push(Prisma.sql`p.price >= ${money(query.minPrice)}`);
    if (query.maxPrice)
      conditions.push(Prisma.sql`p.price <= ${money(query.maxPrice)}`);
    if (
      query.minPrice &&
      query.maxPrice &&
      money(query.minPrice).gt(money(query.maxPrice))
    )
      throw new BadRequestException('Minimum price exceeds maximum price');
    for (const [from, to, column] of [
      [query.createdFrom, query.createdTo, 'createdAt'],
      [query.updatedFrom, query.updatedTo, 'updatedAt'],
    ]) {
      if (from && to && new Date(from) > new Date(to))
        throw new BadRequestException('Start date exceeds end date');
      const field =
        column === 'createdAt'
          ? Prisma.sql`p."createdAt"`
          : Prisma.sql`p."updatedAt"`;
      if (from) conditions.push(Prisma.sql`${field} >= ${new Date(from)}`);
      if (to) conditions.push(Prisma.sql`${field} <= ${new Date(to)}`);
    }
    if (query.stockStatus === 'OUT')
      conditions.push(Prisma.sql`${this.availability} <= 0`);
    if (query.stockStatus === 'LOW') conditions.push(this.lowStock);
    if (query.stockStatus === 'HEALTHY')
      conditions.push(
        Prisma.sql`${this.availability} > 0 AND NOT ${this.lowStock}`,
      );
    const sorts: Record<string, Prisma.Sql> = {
      name: Prisma.sql`p.name`,
      price: Prisma.sql`p.price`,
      sku: Prisma.sql`p.sku`,
      createdAt: Prisma.sql`p."createdAt"`,
      updatedAt: Prisma.sql`p."updatedAt"`,
    };
    const order = sorts[query.sortBy] ?? sorts.createdAt;
    const direction =
      query.sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM products p WHERE ${Prisma.join(conditions, ' AND ')}`,
        );
        const ids = await tx.$queryRaw<{ id: string; available: bigint }[]>(
          Prisma.sql`SELECT p.id, ${this.availability} AS available FROM products p WHERE ${Prisma.join(conditions, ' AND ')} ORDER BY ${order} ${direction}, p.id ASC LIMIT ${query.paginated ? query.pageSize : 100} OFFSET ${query.paginated ? (query.page - 1) * query.pageSize : 0}`,
        );
        const rows = await tx.product.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
          include: this.productInclude,
        });
        const items = ids.map((row) => ({
          ...rows.find((item) => item.id === row.id)!,
          availableStock: Number(row.available),
        }));
        return query.paginated
          ? {
              items,
              total: Number(count.total),
              page: query.page,
              pageSize: query.pageSize,
            }
          : items;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async summary() {
    const [totals] = await this.prisma.$queryRaw<Record<string, bigint>[]>(
      Prisma.sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE p.status = 'ACTIVE') AS active, COUNT(*) FILTER (WHERE p.status = 'DRAFT') AS draft, COUNT(*) FILTER (WHERE p.status = 'ARCHIVED') AS archived, COUNT(*) FILTER (WHERE ${this.availability} <= 0) AS "outOfStock", COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM product_images m WHERE m."productId" = p.id)) AS "missingImages", COUNT(*) FILTER (WHERE c."isActive" = false OR c."isVisible" = false) AS "categoryAttention", COUNT(*) FILTER (WHERE ${this.lowStock}) AS "lowStock", COUNT(*) FILTER (WHERE ${this.lowStock} OR ${this.availability} <= 0 OR NOT c."isActive" OR NOT EXISTS (SELECT 1 FROM product_images m WHERE m."productId" = p.id)) AS attention FROM products p JOIN categories c ON c.id = p."categoryId" WHERE p."deletedAt" IS NULL`,
    );
    const recent = await this.prisma.product.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
    const trends = await this.prisma.$queryRaw<
      { date: string; count: number }[]
    >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM products WHERE "deletedAt" IS NULL AND "createdAt" >= CURRENT_DATE - INTERVAL '29 days' GROUP BY 1 ORDER BY 1`;
    const valuation = await this.prisma.$queryRaw<
      { currency: string; value: Prisma.Decimal }[]
    >`SELECT p.currency, COALESCE(SUM(i.quantity * COALESCE(v."costPrice", p."costPrice", 0)), 0) AS value FROM inventories i LEFT JOIN product_variants v ON v.id = i."variantId" JOIN products p ON p.id = COALESCE(i."productId", v."productId") WHERE p."deletedAt" IS NULL AND ((p.type = 'SIMPLE' AND i."productId" IS NOT NULL) OR (p.type = 'VARIABLE' AND v."isActive")) GROUP BY p.currency`;
    return {
      ...Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [key, Number(value)]),
      ),
      missingCategories: 0,
      recent,
      trends,
      inventoryValuation: valuation.map((row) => ({
        currency: row.currency,
        value: row.value.toString(),
      })),
    };
  }

  private validateProduct(dto: Partial<CreateProductDto>) {
    rejectNulls(dto, requiredFields);
    if (dto.options) validateOptions(dto.options);
    if (
      dto.saleStartsAt &&
      dto.saleEndsAt &&
      new Date(dto.saleStartsAt) >= new Date(dto.saleEndsAt)
    )
      throw new BadRequestException('Sale end must be later than sale start');
    if ((dto.saleStartsAt || dto.saleEndsAt) && dto.salePrice == null)
      throw new BadRequestException('Scheduled sales require a sale price');
    if (
      dto.status === 'ACTIVE' &&
      (!dto.name?.trim() ||
        !dto.sku?.trim() ||
        !dto.categoryId ||
        dto.price == null)
    )
      throw new BadRequestException(
        'Publishing requires name, SKU, category and regular price',
      );
    if (dto.price != null) prices(dto.price, dto.salePrice, dto.costPrice);
    if (
      dto.price != null &&
      dto.compareAtPrice != null &&
      money(dto.compareAtPrice).lt(money(dto.price))
    )
      throw new BadRequestException(
        'Compare-at price cannot be lower than regular price',
      );
  }

  async bulk(dto: BulkProductDto, actorId?: string, role?: string) {
    if (dto.action === 'DELETE' && role !== 'SUPER_ADMIN')
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Permanent deletion requires SUPER_ADMIN',
      );
    if (dto.action === 'CATEGORY' && !dto.categoryId)
      throw new BadRequestException('Select a category');
    if (dto.action === 'PRICE' && dto.price === undefined)
      throw new BadRequestException('Enter a price');
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of dto.ids) {
      try {
        if (dto.action === 'DELETE') await this.remove(id, actorId);
        else
          await this.update(
            id,
            dto.action === 'CATEGORY'
              ? { categoryId: dto.categoryId }
              : dto.action === 'PRICE'
                ? { price: dto.price }
                : {
                    status:
                      dto.action === 'ACTIVATE'
                        ? 'ACTIVE'
                        : dto.action === 'ARCHIVE'
                          ? 'ARCHIVED'
                          : 'DRAFT',
                  },
            actorId,
          );
        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Operation failed',
        });
      }
    }
    return {
      results,
      succeeded: results.filter((row) => row.success).length,
      failed: results.filter((row) => !row.success).length,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...product,
      availableStock:
        product.type === 'VARIABLE'
          ? product.variants
              .filter((variant) => variant.isActive)
              .reduce(
                (sum, variant) =>
                  sum +
                  (variant.inventory
                    ? variant.inventory.quantity - variant.inventory.reserved
                    : 0),
                0,
              )
          : product.inventory
            ? product.inventory.quantity - product.inventory.reserved
            : product.stock,
    };
  }

  async update(id: string, dto: UpdateProductDto, actorId?: string) {
    rejectNulls(dto, requiredFields);
    if (dto.status === undefined && dto.isActive !== undefined)
      dto.status = dto.isActive ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
    const existing = await this.findOne(id);

    // Opening and saving an unrelated field must not rewrite legacy content.
    if (dto.description !== undefined && dto.description !== existing.description) {
      dto.description = toProductHtml(dto.description);
      if (dto.description.length > 50000) throw new BadRequestException('Formatted description exceeds 50,000 characters');
    }

    if (dto.categoryId) {
      await this.checkCategory(dto.categoryId);
    }

    this.checkPrices(
      dto.price ?? existing.price,
      dto.salePrice === undefined
        ? existing.salePrice === null
          ? null
          : existing.salePrice
        : dto.salePrice,
    );

    const { stock, expectedUpdatedAt, ...productData } = dto;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.product.findFirst({
            where: { id, deletedAt: null },
          });

          if (!current) {
            throw new NotFoundException('Product not found');
          }
          if (
            expectedUpdatedAt &&
            new Date(expectedUpdatedAt).getTime() !==
              current.updatedAt.getTime()
          )
            throw new ConflictException(
              'This product changed since you opened it. Reload before saving.',
            );
          const merged = { ...current, ...dto };
          this.validateProduct({
            ...merged,
            description: merged.description ?? undefined,
            price: merged.price.toString(),
            salePrice: merged.salePrice?.toString() ?? null,
            costPrice: merged.costPrice?.toString() ?? null,
            compareAtPrice: merged.compareAtPrice?.toString() ?? null,
            weight: merged.weight?.toString(),
            length: merged.length?.toString(),
            width: merged.width?.toString(),
            height: merged.height?.toString(),
            saleStartsAt: merged.saleStartsAt?.toString(),
            saleEndsAt: merged.saleEndsAt?.toString(),
            options: dto.options,
          });
          if (dto.options) {
            const variants = await tx.productVariant.findMany({
              where: { productId: id },
              take: 201,
            });
            for (const variant of variants)
              validateAttributes(
                variant.attributes as Record<string, string>,
                dto.options,
              );
          }
          if (dto.type && dto.type !== current.type) {
            if (dto.type === 'VARIABLE' && current.stock !== 0)
              throw new ConflictException(
                'Reduce parent stock to zero with an adjustment before switching to variable inventory',
              );
            if (
              dto.type === 'SIMPLE' &&
              (await tx.productVariant.count({ where: { productId: id } }))
            )
              throw new ConflictException(
                'A product with variant history must remain variable',
              );
          }
          if ((dto.type ?? current.type) === 'VARIABLE' && stock && stock > 0)
            throw new BadRequestException(
              'Adjust variant inventory instead of parent stock',
            );
          if (
            (dto.status ?? current.status) === 'ACTIVE' &&
            (dto.type ?? current.type) === 'VARIABLE' &&
            !(await tx.productVariant.count({
              where: { productId: id, isActive: true },
            }))
          )
            throw new BadRequestException(
              'Publishing a variable product requires at least one active variant',
            );
          if (dto.slug)
            await changeSlug(tx, 'product', id, current.slug, dto.slug);

          const inventory = await tx.inventory.findUnique({
            where: { productId: id },
          });

          if (!inventory) {
            throw new ConflictException('Product inventory is missing');
          }

          if (stock !== undefined && stock < inventory.reserved) {
            throw new BadRequestException(
              'Stock cannot be lower than reserved quantity',
            );
          }

          const nextStock = stock ?? inventory.quantity;

          await tx.product.update({
            where: { id },
            data: {
              ...productData,
              stock: nextStock,
              ...(dto.status !== undefined
                ? { status: dto.status, isActive: dto.status === 'ACTIVE' }
                : dto.isActive !== undefined
                  ? {
                      status: dto.isActive
                        ? ProductStatus.ACTIVE
                        : ProductStatus.DRAFT,
                    }
                  : {}),
            },
          });

          await audit(
            tx,
            'product',
            id,
            'UPDATE',
            { before: current, changes: dto },
            actorId,
          );

          if (stock !== undefined && stock !== inventory.quantity) {
            const difference = stock - inventory.quantity;

            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: stock },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: id,
                type:
                  difference > 0
                    ? InventoryMovementType.ADJUSTMENT_IN
                    : InventoryMovementType.ADJUSTMENT_OUT,
                quantity: Math.abs(difference),
                beforeQty: inventory.quantity,
                afterQty: stock,
                reason: 'Stock changed through product editor',
              },
            });
          }

          return tx.product.findUniqueOrThrow({
            where: { id },
            include: this.productInclude,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto, actorId?: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const product = await tx.product.findFirst({
            where: { id, deletedAt: null },
          });

          if (!product) {
            throw new NotFoundException('Product not found');
          }

          if (product.type === 'VARIABLE')
            throw new BadRequestException(
              'Adjust stock on the specific variant',
            );

          const inventory = await tx.inventory.findUnique({
            where: { productId: id },
          });

          if (!inventory) {
            throw new ConflictException('Product inventory is missing');
          }

          const change =
            dto.type === StockAdjustmentType.IN ? dto.quantity : -dto.quantity;

          const nextQuantity = inventory.quantity + change;

          if (nextQuantity < inventory.reserved || nextQuantity > 2147483647) {
            throw new BadRequestException('Insufficient available stock');
          }

          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: nextQuantity },
          });

          await tx.product.update({
            where: { id },
            data: { stock: nextQuantity },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: id,
              type:
                change > 0
                  ? InventoryMovementType.ADJUSTMENT_IN
                  : InventoryMovementType.ADJUSTMENT_OUT,
              quantity: dto.quantity,
              beforeQty: inventory.quantity,
              afterQty: nextQuantity,
              reason: dto.reason ?? 'Manual stock adjustment',
              referenceId: dto.referenceId,
            },
          });

          await audit(tx, 'product', id, 'STOCK_ADJUSTMENT', dto, actorId);

          return {
            productId: id,
            previousStock: inventory.quantity,
            currentStock: nextQuantity,
            availableStock: nextQuantity - inventory.reserved,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getStockMovements(id: string) {
    await this.findOne(id);

    return this.prisma.inventoryMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async remove(id: string, actorId?: string) {
    // Retain the established soft-delete contract so financial/stock history survives.
    return this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id, deletedAt: null },
        });
        if (!product) throw new NotFoundException('Product not found');
        const reserved = await tx.inventory.count({
          where: {
            OR: [{ productId: id }, { variant: { productId: id } }],
            reserved: { gt: 0 },
          },
        });
        if (reserved)
          throw new ConflictException(
            'Release inventory reservations before deleting',
          );
        await audit(
          tx,
          'product',
          id,
          'SOFT_DELETE',
          { name: product.name },
          actorId,
        );
        return tx.product.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            isActive: false,
            status: ProductStatus.ARCHIVED,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private handleError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Product SKU or slug already exists');
      }

      if (error.code === 'P2034') {
        throw new ConflictException(
          'Concurrent stock update detected. Please retry.',
        );
      }
    }

    throw error;
  }
}
