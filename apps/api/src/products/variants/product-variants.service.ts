import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateVariantDto } from './dto/create-variant.dto.js';
import { UpdateVariantDto } from './dto/update-variant.dto.js';
import {
  AdjustVariantStockDto,
  VariantStockAdjustmentType,
} from './dto/adjust-variant-stock.dto.js';
import {
  audit,
  catalogError,
  combination,
  prices,
  validateAttributes,
  validateOptions,
  rejectNulls,
} from '../../catalog/catalog.rules.js';
import {
  BulkVariantsDto,
  GenerateVariantsDto,
} from './dto/variant-actions.dto.js';

@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async product(tx: Prisma.TransactionClient, productId: string) {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAll(productId: string) {
    await this.product(this.prisma, productId);
    return this.prisma.productVariant.findMany({
      where: { productId },
      include: { inventory: true, images: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  async generate(
    productId: string,
    dto: GenerateVariantsDto,
    actorId?: string,
  ) {
    const product = await this.product(this.prisma, productId);
    validateOptions(product.options);
    const options = product.options as { name: string; values: string[] }[];
    if (!options.length)
      throw new BadRequestException('Configure and save product options first');
    let combinations: Record<string, string>[] = [{}];
    for (const option of options)
      combinations = combinations.flatMap((attrs) =>
        option.values.map((value) => ({ ...attrs, [option.name]: value })),
      );
    const existing = await this.findAll(productId);
    const keys = new Set(
      existing.map((row) =>
        combination(row.attributes as Record<string, string>),
      ),
    );
    const results: {
      name: string;
      success: boolean;
      skipped?: boolean;
      error?: string;
    }[] = [];
    for (const [index, attributes] of combinations.entries()) {
      const name = Object.values(attributes).join(' / ');
      if (keys.has(combination(attributes))) {
        results.push({ name, success: true, skipped: true });
        continue;
      }
      try {
        await this.create(
          productId,
          {
            name,
            attributes,
            sku:
              dto.skuPrefix.trim() + '-' + String(index + 1).padStart(3, '0'),
            price: product.price.toFixed(2),
            stock: 0,
          },
          actorId,
        );
        results.push({ name, success: true });
      } catch (error) {
        results.push({
          name,
          success: false,
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      }
    }
    return { results };
  }

  async bulk(productId: string, dto: BulkVariantsDto, actorId?: string) {
    if (dto.price === undefined && dto.isActive === undefined)
      throw new BadRequestException('Provide price or active status');
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of dto.ids) {
      try {
        await this.update(
          productId,
          id,
          { price: dto.price, isActive: dto.isActive },
          actorId,
        );
        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Update failed',
        });
      }
    }
    return { results };
  }

  async create(productId: string, dto: CreateVariantDto, actorId?: string) {
    rejectNulls(dto, [
      'name',
      'sku',
      'attributes',
      'price',
      'stock',
      'isActive',
      'isDefault',
    ]);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
          const product = await this.product(tx, productId);
          if (product.type !== 'VARIABLE')
            throw new BadRequestException(
              'Only variable products support variants',
            );
          const count = await tx.productVariant.count({ where: { productId } });
          const isDefault = count === 0 || dto.isDefault === true;
          if (isDefault && dto.isActive === false)
            throw new BadRequestException('Default variant must be active');
          if (count >= 200)
            throw new BadRequestException(
              'A product supports at most 200 variants',
            );
          prices(dto.price, dto.salePrice, dto.costPrice);
          validateAttributes(dto.attributes, product.options);
          if (dto.isDefault)
            await tx.productVariant.updateMany({
              where: { productId },
              data: { isDefault: false },
            });
          const { stock, ...data } = dto;
          const variant = await tx.productVariant.create({
            data: {
              ...data,
              productId,
              combinationKey: combination(dto.attributes),
              isDefault,
            },
          });
          await tx.inventory.create({
            data: { variantId: variant.id, quantity: stock },
          });
          await tx.inventoryMovement.create({
            data: {
              productId,
              variantId: variant.id,
              type: 'OPENING',
              quantity: stock,
              beforeQty: 0,
              afterQty: stock,
              reason: 'Variant opening inventory',
            },
          });
          await audit(tx, 'variant', variant.id, 'CREATE', dto, actorId);
          return tx.productVariant.findUniqueOrThrow({
            where: { id: variant.id },
            include: { inventory: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      catalogError(error);
    }
  }

  async update(
    productId: string,
    id: string,
    dto: UpdateVariantDto,
    actorId?: string,
  ) {
    rejectNulls(dto, [
      'name',
      'sku',
      'attributes',
      'price',
      'stock',
      'isActive',
      'isDefault',
    ]);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
          const product = await this.product(tx, productId);
          const existing = await tx.productVariant.findFirst({
            where: { id, productId },
          });
          if (!existing)
            throw new NotFoundException(
              'Variant does not belong to this product',
            );
          prices(
            dto.price ?? existing.price,
            dto.salePrice === undefined ? existing.salePrice : dto.salePrice,
            dto.costPrice,
          );
          if (dto.attributes)
            validateAttributes(dto.attributes, product.options);
          if (dto.isDefault && (dto.isActive ?? existing.isActive) === false)
            throw new BadRequestException('Default variant must be active');
          if (existing.isDefault && dto.isDefault === false)
            throw new ConflictException(
              'Choose another default variant before clearing the current default',
            );
          if (dto.isActive === false && existing.isDefault)
            throw new ConflictException(
              'Choose another default variant before deactivating this variant',
            );
          if (dto.isDefault)
            await tx.productVariant.updateMany({
              where: { productId },
              data: { isDefault: false },
            });
          if (dto.stock !== undefined)
            throw new BadRequestException(
              'Use inventory adjustments to change variant stock',
            );
          const { stock: _stock, ...data } = dto;
          const variant = await tx.productVariant.update({
            where: { id },
            data: {
              ...data,
              ...(dto.attributes
                ? { combinationKey: combination(dto.attributes) }
                : {}),
            },
          });
          await audit(
            tx,
            'variant',
            id,
            'UPDATE',
            { before: existing, after: variant },
            actorId,
          );
          return variant;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      catalogError(error);
    }
  }

  async remove(productId: string, id: string, actorId?: string) {
    // Deactivate rather than erasing order/stock references.
    return this.update(productId, id, { isActive: false }, actorId);
  }

  async adjustStock(
    productId: string,
    variantId: string,
    dto: AdjustVariantStockDto,
    actorId?: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.product(tx, productId);
          const variant = await tx.productVariant.findFirst({
            where: { id: variantId, productId },
          });
          if (!variant)
            throw new NotFoundException(
              'Variant does not belong to this product',
            );
          const inventory = await tx.inventory.findUnique({
            where: { variantId },
          });
          if (!inventory)
            throw new NotFoundException('Variant inventory missing');
          const change =
            dto.type === VariantStockAdjustmentType.IN
              ? dto.quantity
              : -dto.quantity;
          const next = inventory.quantity + change;
          if (next < inventory.reserved || next > 2147483647)
            throw new BadRequestException(
              'Quantity must cover reservations and fit the stock limit',
            );
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: next },
          });
          await tx.inventoryMovement.create({
            data: {
              productId,
              variantId,
              type: change > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              quantity: dto.quantity,
              beforeQty: inventory.quantity,
              afterQty: next,
              reason: dto.reason?.trim() || 'Variant stock adjustment',
              referenceId: dto.referenceId,
            },
          });
          await audit(
            tx,
            'variant',
            variantId,
            'STOCK_ADJUSTMENT',
            dto,
            actorId,
          );
          return { variantId, previous: inventory.quantity, current: next };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      catalogError(error);
    }
  }
}
