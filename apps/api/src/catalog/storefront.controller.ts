import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  SetMetadata,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CatalogQueryDto } from './catalog-query.dto.js';
import { StorefrontQueryDto } from './storefront-query.dto.js';

@Controller('storefront')
@SetMetadata('public', true)
export class StorefrontController {
  constructor(private readonly prisma: PrismaService) {}
  private readonly visibleCategory = Prisma.sql`NOT EXISTS (WITH RECURSIVE parents AS (SELECT id, "parentId", "isActive", "isVisible" FROM categories WHERE id = p."categoryId" UNION SELECT c.id, c."parentId", c."isActive", c."isVisible" FROM categories c JOIN parents a ON c.id = a."parentId") SELECT 1 FROM parents WHERE NOT "isActive" OR NOT "isVisible")`;
  private readonly select = {
    id: true,
    name: true,
    slug: true,
    sku: true,
    barcode: true,
    description: true,
    shortDescription: true,
    brand: true,
    type: true,
    trackInventory: true,
    price: true,
    salePrice: true,
    saleStartsAt: true,
    saleEndsAt: true,
    currency: true,
    isFeatured: true,
    metaTitle: true,
    metaDescription: true,
    canonicalUrl: true,
    noIndex: true,
    socialTitle: true,
    socialDescription: true,
    socialImage: true,
    category: { select: { id: true, name: true, slug: true } },
    images: {
      select: {
        id: true,
        url: true,
        altText: true,
        isPrimary: true,
        variantId: true,
      },
      orderBy: { sortOrder: 'asc' as const },
      take: 20,
    },
    variants: {
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        attributes: true,
        price: true,
        salePrice: true,
        isDefault: true,
        inventory: { select: { quantity: true, reserved: true } },
      },
      take: 200,
    },
    inventory: { select: { quantity: true, reserved: true } },
  } satisfies Prisma.ProductSelect;

  @Get('products')
  async products(@Query() query: StorefrontQueryDto) {
    const conditions = [
      Prisma.sql`p."deletedAt" IS NULL AND p.status = 'ACTIVE' AND p."isActive" AND p."isVisible"`,
      this.visibleCategory,
    ];
    if (query.search)
      conditions.push(
        Prisma.sql`(p.name ILIKE ${'%' + query.search + '%'} OR p.sku ILIKE ${'%' + query.search + '%'})`,
      );
    if (query.categoryId)
      conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    if (query.source === 'featured' || query.source === 'trending' || query.source === 'recommended')
      conditions.push(Prisma.sql`p."isFeatured" = true`);
    if (query.ids)
      conditions.push(
        Prisma.sql`p.id IN (${Prisma.join(query.ids.split(','))})`,
      );
    if (query.source === 'selected' && !query.ids)
      conditions.push(Prisma.sql`FALSE`);
    if (query.source === 'category' && !query.categoryId)
      conditions.push(Prisma.sql`FALSE`);
    if (query.source === 'sale')
      conditions.push(
        Prisma.sql`p."salePrice" IS NOT NULL AND p."salePrice" < p.price AND (p."saleStartsAt" IS NULL OR p."saleStartsAt" <= CURRENT_TIMESTAMP) AND (p."saleEndsAt" IS NULL OR p."saleEndsAt" > CURRENT_TIMESTAMP)`,
      );
    const effectivePrice = Prisma.sql`CASE WHEN p."salePrice" IS NOT NULL AND p."salePrice" < p.price AND (p."saleStartsAt" IS NULL OR p."saleStartsAt" <= CURRENT_TIMESTAMP) AND (p."saleEndsAt" IS NULL OR p."saleEndsAt" > CURRENT_TIMESTAMP) THEN p."salePrice" ELSE p.price END`;
    if (query.minPrice)
      conditions.push(
        Prisma.sql`(${effectivePrice}) >= ${new Prisma.Decimal(query.minPrice)}`,
      );
    if (query.maxPrice)
      conditions.push(
        Prisma.sql`(${effectivePrice}) <= ${new Prisma.Decimal(query.maxPrice)}`,
      );
    const sort =
      query.source === 'selected' && query.ids
        ? Prisma.sql`array_position(ARRAY[${Prisma.join(query.ids.split(','))}]::text[], p.id)`
        : query.sortBy === 'price'
          ? effectivePrice
          : query.sortBy === 'name'
            ? Prisma.sql`p.name`
            : Prisma.sql`p."createdAt"`;
    const direction =
      query.source === 'selected'
        ? Prisma.sql`ASC`
        : query.sortDirection === 'asc'
          ? Prisma.sql`ASC`
          : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM products p WHERE ${Prisma.join(conditions, ' AND ')}`,
        );
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT p.id FROM products p WHERE ${Prisma.join(conditions, ' AND ')} ORDER BY ${sort} ${direction}, p.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
        );
        const items = await tx.product.findMany({
          where: { id: { in: ids.map((item) => item.id) } },
          select: this.select,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        });
        return {
          items: ids.map(({ id }) =>
            this.present(items.find((item) => item.id === id)!),
          ),
          total: Number(count.total),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private present(
    product: Prisma.ProductGetPayload<{
      select: StorefrontController['select'];
    }>,
  ) {
    const now = new Date();
    const onSale =
      product.salePrice !== null &&
      product.salePrice.lessThan(product.price) &&
      (!product.saleStartsAt || product.saleStartsAt <= now) &&
      (!product.saleEndsAt || product.saleEndsAt > now);
    const { inventory, variants, ...publicProduct } = product;
    const available = (stock: { quantity: number; reserved: number } | null) =>
      Math.max(0, (stock?.quantity ?? 0) - (stock?.reserved ?? 0));
    const availableStock = !product.trackInventory
      ? product.type === 'VARIABLE' && variants.length === 0
        ? 0
        : 10000
      : product.type === 'VARIABLE'
        ? variants.reduce(
            (sum, variant) => sum + available(variant.inventory),
            0,
          )
        : available(inventory);
    return {
      ...publicProduct,
      effectivePrice: onSale ? product.salePrice : product.price,
      availableStock,
      variants: variants.map(({ inventory, ...variant }) => ({
        ...variant,
        availableStock: product.trackInventory ? available(inventory) : 10000,
        salePrice:
          onSale && variant.salePrice?.lessThan(variant.price)
            ? variant.salePrice
            : null,
      })),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        description: product.shortDescription,
        image: product.images.map((image) => image.url),
        ...(product.brand
          ? { brand: { '@type': 'Brand', name: product.brand } }
          : {}),
        offers: {
          '@type': 'Offer',
          priceCurrency: product.currency,
          price: (onSale ? product.salePrice : product.price)!.toString(),
          availability:
            availableStock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        },
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: product.category.name,
            item: '/categories/' + product.category.slug,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: product.name,
            item: '/products/' + product.slug,
          },
        ],
      },
    };
  }

  @Get('products/:slug')
  async product(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT p.id FROM products p WHERE p.slug = ${slug} AND p."deletedAt" IS NULL AND p.status = 'ACTIVE' AND p."isActive" AND p."isVisible" AND ${this.visibleCategory} LIMIT 1`,
    );
    if (ids[0]) {
      const product = await this.prisma.product.findUnique({
        where: { id: ids[0].id },
        select: this.select,
      });
      if (product) return this.present(product);
    }
    const redirect = await this.prisma.catalogRedirect.findUnique({
      where: { entity_fromSlug: { entity: 'product', fromSlug: slug } },
    });
    if (redirect) {
      const [target] = await this.prisma.$queryRaw<{ slug: string }[]>(
        Prisma.sql`SELECT p.slug FROM products p WHERE p.id = ${redirect.entityId} AND p."deletedAt" IS NULL AND p.status = 'ACTIVE' AND p."isActive" AND p."isVisible" AND ${this.visibleCategory}`,
      );
      if (target && target.slug !== slug) {
        res.redirect(301, '/api/v1/storefront/products/' + target.slug);
        return;
      }
    }
    throw new NotFoundException('Product not found');
  }

  @Get('categories')
  categories(@Query() query: StorefrontQueryDto) {
    return this.prisma.$queryRaw(
      Prisma.sql`WITH RECURSIVE visible AS (SELECT id, name, slug, "parentId", "imageUrl", "sortOrder" FROM categories WHERE "parentId" IS NULL AND "isActive" AND "isVisible" UNION ALL SELECT c.id, c.name, c.slug, c."parentId", c."imageUrl", c."sortOrder" FROM categories c JOIN visible v ON c."parentId" = v.id WHERE c."isActive" AND c."isVisible") SELECT * FROM visible ${query.ids ? Prisma.sql`WHERE id IN (${Prisma.join(query.ids.split(','))})` : Prisma.empty} ORDER BY "sortOrder", id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
  }

  @Get('categories/:slug')
  async category(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const visible = await this.prisma.$queryRaw<
      { id: string }[]
    >`WITH RECURSIVE visible AS (SELECT id, slug FROM categories WHERE "parentId" IS NULL AND "isActive" AND "isVisible" UNION ALL SELECT c.id, c.slug FROM categories c JOIN visible v ON c."parentId" = v.id WHERE c."isActive" AND c."isVisible") SELECT id FROM visible WHERE slug = ${slug}`;
    if (visible[0]) {
      const category = await this.prisma.category.findUnique({
        where: { id: visible[0].id },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          metaTitle: true,
          metaDescription: true,
          canonicalUrl: true,
          noIndex: true,
          parent: { select: { name: true, slug: true } },
        },
      });
      if (!category) throw new NotFoundException('Category not found');
      const ancestors = await this.prisma.$queryRaw<
        { name: string; slug: string; depth: number }[]
      >`WITH RECURSIVE ancestors AS (SELECT name, slug, "parentId", 1 AS depth FROM categories WHERE id = ${category.id} UNION ALL SELECT c.name, c.slug, c."parentId", a.depth + 1 FROM categories c JOIN ancestors a ON c.id = a."parentId" WHERE a.depth < 8) SELECT name, slug, depth FROM ancestors ORDER BY depth DESC`;
      return {
        ...category,
        openGraph: {
          title: category.metaTitle || category.name,
          description: category.metaDescription || category.description,
          image: category.imageUrl,
        },
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: category.name,
          description: category.description,
          url: category.canonicalUrl || '/categories/' + category.slug,
        },
        breadcrumb: {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: ancestors.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: '/categories/' + item.slug,
          })),
        },
      };
    }
    const redirect = await this.prisma.catalogRedirect.findUnique({
      where: { entity_fromSlug: { entity: 'category', fromSlug: slug } },
    });
    if (redirect) {
      const [target] = await this.prisma.$queryRaw<
        { slug: string }[]
      >`WITH RECURSIVE visible AS (SELECT id, slug FROM categories WHERE "parentId" IS NULL AND "isActive" AND "isVisible" UNION ALL SELECT c.id, c.slug FROM categories c JOIN visible v ON c."parentId" = v.id WHERE c."isActive" AND c."isVisible") SELECT slug FROM visible WHERE id = ${redirect.entityId}`;
      if (target && target.slug !== slug) {
        res.redirect(301, '/api/v1/storefront/categories/' + target.slug);
        return;
      }
    }
    throw new NotFoundException('Category not found');
  }

  @Get('sitemap')
  async sitemap(@Query() query: CatalogQueryDto) {
    // Chunked response for a storefront sitemap generator; no private entries.
    return this.prisma.$queryRaw(
      Prisma.sql`WITH RECURSIVE visible AS (SELECT id FROM categories WHERE "parentId" IS NULL AND "isActive" AND "isVisible" UNION ALL SELECT c.id FROM categories c JOIN visible v ON c."parentId" = v.id WHERE c."isActive" AND c."isVisible") SELECT 'product' AS entity, p.slug, p."updatedAt", p."canonicalUrl" FROM products p WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE' AND p."isActive" AND p."isVisible" AND NOT p."noIndex" AND p."categoryId" IN (SELECT id FROM visible) UNION ALL SELECT 'category' AS entity, c.slug, c."updatedAt", c."canonicalUrl" FROM categories c JOIN visible v ON c.id = v.id WHERE NOT c."noIndex" ORDER BY entity, slug LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
  }
}
