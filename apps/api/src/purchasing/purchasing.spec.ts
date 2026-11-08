import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchasingService } from './purchasing.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('PurchasingService', () => {
  let service: PurchasingService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      supplier: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      purchaseOrder: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
      },
      goodsReceipt: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      inventory: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: any) => cb(mockDb)),
    };

    service = new PurchasingService(mockDb);
  });

  describe('Suppliers', () => {
    it('creates a new supplier successfully', async () => {
      mockDb.supplier.findFirst.mockResolvedValue(null);
      mockDb.supplier.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'sup-1', ...args.data }),
      );

      const result = await service.createSupplier({
        name: 'Prime Electronics Ltd',
        phone: '01700000000',
        email: 'sales@primebd.com',
      });

      expect(result.id).toBe('sup-1');
      expect(result.name).toBe('Prime Electronics Ltd');
      expect(mockDb.supplier.create).toHaveBeenCalled();
    });

    it('rejects duplicate supplier name', async () => {
      mockDb.supplier.findFirst.mockResolvedValue({ id: 'sup-1', name: 'Prime Electronics Ltd' });

      await expect(
        service.createSupplier({ name: 'Prime Electronics Ltd' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Purchase Orders', () => {
    it('creates a purchase order with items and computed totals', async () => {
      mockDb.supplier.findUnique.mockResolvedValue({ id: 'sup-1', name: 'Prime Electronics Ltd' });
      mockDb.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Wireless Headphones', sku: 'WH-01' },
      ]);
      mockDb.productVariant.findMany.mockResolvedValue([]);
      mockDb.purchaseOrder.findFirst.mockResolvedValue(null);
      mockDb.purchaseOrder.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'po-1', ...args.data }),
      );

      const result = await service.createOrder({
        supplierId: 'sup-1',
        shippingCost: 200,
        tax: 50,
        items: [
          {
            productId: 'prod-1',
            orderedQuantity: 10,
            unitCost: 1500,
          },
        ],
      });

      expect(result.poNumber).toMatch(/^PO-\d{8}-0001$/);
      expect(result.subtotal.toString()).toBe('15000');
      expect(result.totalAmount.toString()).toBe('15250');
    });

    it('throws if product does not exist', async () => {
      mockDb.supplier.findUnique.mockResolvedValue({ id: 'sup-1', name: 'Prime Electronics Ltd' });
      mockDb.product.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder({
          supplierId: 'sup-1',
          items: [{ productId: 'prod-non-existent', orderedQuantity: 5, unitCost: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Goods Receipts & Stock updates', () => {
    it('receives goods, updates inventory stock, and creates inventory movement', async () => {
      const mockPo = {
        id: 'po-1',
        poNumber: 'PO-20261108-0001',
        status: 'ORDERED',
        supplierId: 'sup-1',
        items: [
          {
            id: 'po-item-1',
            purchaseOrderId: 'po-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Smart LED Light',
            sku: 'LED-01',
            orderedQuantity: 20,
            receivedQuantity: 0,
            unitCost: new Prisma.Decimal(800),
            totalCost: new Prisma.Decimal(16000),
          },
        ],
        goodsReceipts: [],
      };

      mockDb.purchaseOrder.findUnique.mockResolvedValue(mockPo);
      mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
      mockDb.goodsReceipt.create.mockResolvedValue({
        id: 'grn-1',
        receiptNumber: 'GRN-20261108-0001',
        purchaseOrderId: 'po-1',
      });
      mockDb.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: 15,
      });
      mockDb.purchaseOrderItem.findMany.mockResolvedValue([
        { id: 'po-item-1', orderedQuantity: 20, receivedQuantity: 20 },
      ]);

      const receipt = await service.receiveGoods('po-1', {
        items: [{ purchaseOrderItemId: 'po-item-1', quantityReceived: 20 }],
        receivedBy: 'Manager Rahim',
      });

      expect(receipt.id).toBe('grn-1');
      // Verify inventory was incremented by 20
      expect(mockDb.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 20 } },
      });
      // Verify inventory movement of type PURCHASE
      expect(mockDb.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PURCHASE',
          quantity: 20,
          beforeQty: 15,
          afterQty: 35,
        }),
      });
      // Verify product costPrice was updated
      expect(mockDb.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { costPrice: expect.any(Object) },
      });
      // Verify PO status was updated to RECEIVED
      expect(mockDb.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: 'RECEIVED' },
      });
    });

    it('rejects receiving more than remaining ordered quantity', async () => {
      const mockPo = {
        id: 'po-1',
        status: 'ORDERED',
        items: [
          {
            id: 'po-item-1',
            productName: 'Smart LED Light',
            orderedQuantity: 10,
            receivedQuantity: 8,
          },
        ],
        goodsReceipts: [],
      };

      mockDb.purchaseOrder.findUnique.mockResolvedValue(mockPo);

      await expect(
        service.receiveGoods('po-1', {
          items: [{ purchaseOrderItemId: 'po-item-1', quantityReceived: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
