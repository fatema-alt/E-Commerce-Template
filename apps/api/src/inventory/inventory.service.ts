import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { audit } from '../catalog/catalog.rules.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const inventories = await this.prisma.inventory.findMany({
      where: {
        OR: [
          { product: { deletedAt: null, type: 'SIMPLE' } },
          { variant: { isActive: true, product: { deletedAt: null } } },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
            productId: true,
            product: {
              select: { name: true, category: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const items = inventories.map((item) => ({
      id: item.id,
      productId: item.productId ?? item.variant?.productId ?? '',
      variantId: item.variantId,
      name: item.variant
        ? `${item.variant.product.name} / ${item.variant.name}`
        : (item.product?.name ?? ''),
      sku: item.variant?.sku ?? item.product?.sku ?? '',
      category:
        item.variant?.product.category.name ??
        item.product?.category.name ??
        '',
      type: item.variantId ? 'VARIANT' : 'PRODUCT',
      quantity: item.quantity,
      reserved: item.reserved,
      available: item.quantity - item.reserved,
      lowStockAt: item.lowStockAt,
      updatedAt: item.updatedAt,
    }));
    return {
      summary: {
        inventoryItems: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        lowStock: items.filter(
          (item) => item.available > 0 && item.available <= item.lowStockAt,
        ).length,
        outOfStock: items.filter((item) => item.available <= 0).length,
      },
      items,
    };
  }

  async movements(take = 100) {
    return this.prisma.inventoryMovement.findMany({
      take: Math.min(Math.max(take, 1), 200),
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, sku: true } },
        variant: { select: { name: true, sku: true } },
      },
    });
  }

  async adjust(
    id: string,
    input: {
      type: 'IN' | 'OUT';
      quantity: number;
      reason?: string;
      referenceId?: string;
    },
    actorId?: string,
  ) {
    if (
      !['IN', 'OUT'].includes(input.type) ||
      !Number.isInteger(input.quantity) ||
      input.quantity <= 0
    ) {
      throw new BadRequestException(
        'Type must be IN or OUT and quantity must be a positive integer',
      );
    }
    if (
      input.reason !== undefined &&
      (typeof input.reason !== 'string' || input.reason.length > 500)
    ) {
      throw new BadRequestException('Reason must be text up to 500 characters');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const inventory = await tx.inventory.findUnique({
          where: { id },
          include: { product: true, variant: { include: { product: true } } },
        });
        if (
          !inventory ||
          (inventory.product && inventory.product.deletedAt) ||
          (inventory.variant && inventory.variant.product.deletedAt)
        ) {
          throw new NotFoundException('Inventory not found');
        }
        const productId = inventory.productId ?? inventory.variant?.productId;
        if (!productId)
          throw new NotFoundException('Inventory product missing');
        if (inventory.product?.type === 'VARIABLE')
          throw new BadRequestException(
            'Adjust inventory on the specific variant',
          );
        const change = input.type === 'IN' ? input.quantity : -input.quantity;
        const next = inventory.quantity + change;
        if (next < inventory.reserved || next > 2147483647)
          throw new BadRequestException(
            'Stock must cover reservations and fit the stock limit',
          );
        // Optimistic concurrency guard: only one adjustment can update a particular stock value.
        const updated = await tx.inventory.updateMany({
          where: {
            id,
            quantity: inventory.quantity,
            reserved: inventory.reserved,
          },
          data: { quantity: next },
        });
        if (updated.count !== 1)
          throw new BadRequestException(
            'Stock changed concurrently; please retry',
          );
        if (!inventory.variantId) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: next },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            productId,
            variantId: inventory.variantId,
            type:
              change > 0
                ? InventoryMovementType.ADJUSTMENT_IN
                : InventoryMovementType.ADJUSTMENT_OUT,
            quantity: input.quantity,
            beforeQty: inventory.quantity,
            afterQty: next,
            reason: input.reason?.trim() || 'Inventory dashboard adjustment',
            referenceId: input.referenceId,
          },
        });
        await audit(
          tx,
          inventory.variantId ? 'variant' : 'product',
          inventory.variantId ?? productId,
          'STOCK_ADJUSTMENT',
          input,
          actorId,
        );
        return {
          id,
          productId,
          variantId: inventory.variantId,
          previous: inventory.quantity,
          current: next,
          available: next - inventory.reserved,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async setThreshold(id: string, lowStockAt: number, actorId?: string) {
    if (!Number.isInteger(lowStockAt) || lowStockAt < 0) {
      throw new BadRequestException(
        'lowStockAt must be a non-negative integer',
      );
    }
    const existing = await this.prisma.inventory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Inventory not found');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.inventory.update({
        where: { id },
        data: { lowStockAt },
      });
      await audit(
        tx,
        'inventory',
        id,
        'THRESHOLD_UPDATE',
        { before: existing.lowStockAt, after: lowStockAt },
        actorId,
      );
      return result;
    });
  }
}
