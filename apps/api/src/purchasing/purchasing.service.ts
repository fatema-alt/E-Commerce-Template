import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';
import {
  ChangePurchaseOrderStatusDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderPaymentDto,
} from './dto/purchase-order.dto.js';
import { CreateGoodsReceiptDto } from './dto/goods-receipt.dto.js';

@Injectable()
export class PurchasingService {
  constructor(private readonly db: PrismaService) {}

  // ==========================================
  // Suppliers
  // ==========================================

  async listSuppliers(params: {
    q?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { contactName: { contains: params.q, mode: 'insensitive' } },
              { phone: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { purchaseOrders: true } },
        },
      }),
      this.db.supplier.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSupplier(id: string) {
    const supplier = await this.db.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        _count: { select: { purchaseOrders: true } },
      },
    });

    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    const existing = await this.db.supplier.findFirst({
      where: {
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Supplier with name "${dto.name}" already exists`,
      );
    }

    return this.db.supplier.create({
      data: {
        name: dto.name.trim(),
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        country: dto.country?.trim() || 'Bangladesh',
        taxId: dto.taxId?.trim() || null,
        paymentTerms: dto.paymentTerms?.trim() || null,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.getSupplier(id);

    if (dto.name) {
      const existing = await this.db.supplier.findFirst({
        where: {
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Supplier with name "${dto.name}" already exists`,
        );
      }
    }

    return this.db.supplier.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName?.trim() || null }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email?.trim().toLowerCase() || null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() || null }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.country !== undefined
          ? { country: dto.country?.trim() || null }
          : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId?.trim() || null } : {}),
        ...(dto.paymentTerms !== undefined
          ? { paymentTerms: dto.paymentTerms?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSupplier(id: string) {
    await this.getSupplier(id);

    const activeOrdersCount = await this.db.purchaseOrder.count({
      where: {
        supplierId: id,
        status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
      },
    });

    if (activeOrdersCount > 0) {
      throw new ConflictException(
        `Cannot delete supplier with ${activeOrdersCount} pending/active purchase orders`,
      );
    }

    return this.db.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ==========================================
  // Purchase Orders
  // ==========================================

  private async generatePoNumber(): Promise<string> {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `PO-${ymd}-`;

    const latest = await this.db.purchaseOrder.findFirst({
      where: { poNumber: { startsWith: prefix } },
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true },
    });

    let nextSeq = 1;
    if (latest) {
      const parts = latest.poNumber.split('-');
      const seqStr = parts[parts.length - 1];
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  private async generateGrnNumber(): Promise<string> {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `GRN-${ymd}-`;

    const latest = await this.db.goodsReceipt.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });

    let nextSeq = 1;
    if (latest) {
      const parts = latest.receiptNumber.split('-');
      const seqStr = parts[parts.length - 1];
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async listOrders(params: {
    status?: string;
    supplierId?: string;
    paymentStatus?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(params.status ? { status: params.status as Prisma.EnumPurchaseOrderStatusFilter } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.paymentStatus
        ? { paymentStatus: params.paymentStatus as Prisma.EnumPurchaseOrderPaymentStatusFilter }
        : {}),
      ...(params.q
        ? {
            OR: [
              { poNumber: { contains: params.q, mode: 'insensitive' } },
              { supplier: { name: { contains: params.q, mode: 'insensitive' } } },
              { notes: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lte: new Date(params.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true, goodsReceipts: true } },
        },
      }),
      this.db.purchaseOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrder(id: string) {
    const order = await this.db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        goodsReceipts: {
          include: {
            items: true,
          },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    return order;
  }

  async createOrder(dto: CreatePurchaseOrderDto, createdBy?: string) {
    const supplier = await this.db.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException('Supplier not found');
    }

    // Resolve products and validate items
    const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const products = await this.db.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const variantIds = dto.items
      .map((i) => i.variantId)
      .filter((id): id is string => Boolean(id));
    const variants = variantIds.length
      ? await this.db.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, name: true, sku: true, productId: true },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = new Prisma.Decimal(0);
    const preparedItems: Array<{
      productId: string;
      variantId?: string | null;
      sku: string;
      productName: string;
      variantName?: string | null;
      orderedQuantity: number;
      unitCost: Prisma.Decimal;
      totalCost: Prisma.Decimal;
    }> = [];

    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      let variantName: string | null = null;
      let sku = prod.sku;

      if (item.variantId) {
        const v = variantMap.get(item.variantId);
        if (!v || v.productId !== prod.id) {
          throw new BadRequestException(
            `Variant ${item.variantId} not found or does not belong to product ${prod.name}`,
          );
        }
        variantName = v.name;
        sku = v.sku || prod.sku;
      }

      const unitCost = new Prisma.Decimal(item.unitCost);
      const totalCost = unitCost.mul(item.orderedQuantity);
      subtotal = subtotal.add(totalCost);

      preparedItems.push({
        productId: prod.id,
        variantId: item.variantId || null,
        sku,
        productName: prod.name,
        variantName,
        orderedQuantity: item.orderedQuantity,
        unitCost,
        totalCost,
      });
    }

    const shippingCost = new Prisma.Decimal(dto.shippingCost || 0);
    const tax = new Prisma.Decimal(dto.tax || 0);
    const totalAmount = subtotal.add(shippingCost).add(tax);

    const poNumber = await this.generatePoNumber();
    const status = dto.status || 'DRAFT';

    return this.db.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: supplier.id,
        status,
        orderedAt: status === 'ORDERED' ? new Date() : null,
        subtotal,
        shippingCost,
        tax,
        totalAmount,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        notes: dto.notes?.trim() || null,
        createdBy: createdBy || null,
        items: {
          create: preparedItems,
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });
  }

  async updateOrder(id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.getOrder(id);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only DRAFT purchase orders can be edited. Transitioned orders must receive goods or be cancelled.',
      );
    }

    let supplierId = existing.supplierId;
    if (dto.supplierId && dto.supplierId !== existing.supplierId) {
      const s = await this.db.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!s || s.deletedAt) throw new NotFoundException('Supplier not found');
      supplierId = s.id;
    }

    if (dto.items && dto.items.length) {
      // Re-prepare items and totals
      const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
      const products = await this.db.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, name: true, sku: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const variantIds = dto.items
        .map((i) => i.variantId)
        .filter((id): id is string => Boolean(id));
      const variants = variantIds.length
        ? await this.db.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, name: true, sku: true, productId: true },
          })
        : [];
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      let subtotal = new Prisma.Decimal(0);
      const preparedItems = [];

      for (const item of dto.items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }

        let variantName: string | null = null;
        let sku = prod.sku;

        if (item.variantId) {
          const v = variantMap.get(item.variantId);
          if (!v || v.productId !== prod.id) {
            throw new BadRequestException(`Variant ${item.variantId} invalid`);
          }
          variantName = v.name;
          sku = v.sku || prod.sku;
        }

        const unitCost = new Prisma.Decimal(item.unitCost);
        const totalCost = unitCost.mul(item.orderedQuantity);
        subtotal = subtotal.add(totalCost);

        preparedItems.push({
          productId: prod.id,
          variantId: item.variantId || null,
          sku,
          productName: prod.name,
          variantName,
          orderedQuantity: item.orderedQuantity,
          unitCost,
          totalCost,
        });
      }

      const shippingCost = new Prisma.Decimal(
        dto.shippingCost !== undefined
          ? dto.shippingCost
          : existing.shippingCost,
      );
      const tax = new Prisma.Decimal(
        dto.tax !== undefined ? dto.tax : existing.tax,
      );
      const totalAmount = subtotal.add(shippingCost).add(tax);

      return this.db.$transaction(async (tx) => {
        // Delete old items
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        // Update PO and create new items
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            supplierId,
            subtotal,
            shippingCost,
            tax,
            totalAmount,
            expectedDeliveryDate: dto.expectedDeliveryDate
              ? new Date(dto.expectedDeliveryDate)
              : existing.expectedDeliveryDate,
            notes:
              dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
            items: {
              create: preparedItems,
            },
          },
          include: {
            supplier: true,
            items: true,
          },
        });
      });
    }

    // Update non-item fields only
    const shippingCost =
      dto.shippingCost !== undefined
        ? new Prisma.Decimal(dto.shippingCost)
        : existing.shippingCost;
    const tax =
      dto.tax !== undefined ? new Prisma.Decimal(dto.tax) : existing.tax;
    const totalAmount = new Prisma.Decimal(existing.subtotal)
      .add(shippingCost)
      .add(tax);

    return this.db.purchaseOrder.update({
      where: { id },
      data: {
        supplierId,
        shippingCost,
        tax,
        totalAmount,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : existing.expectedDeliveryDate,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
      },
      include: {
        supplier: true,
        items: true,
      },
    });
  }

  async changeOrderStatus(id: string, dto: ChangePurchaseOrderStatusDto) {
    const order = await this.getOrder(id);

    if (order.status === dto.status) {
      return order;
    }

    if (order.status === 'RECEIVED') {
      throw new BadRequestException('Fully received orders cannot change status');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled purchase orders cannot be reopened');
    }

    if (dto.status === 'CANCELLED' && order.goodsReceipts.length > 0) {
      throw new BadRequestException(
        'Cannot cancel purchase order with recorded goods receipts',
      );
    }

    const orderedAt =
      dto.status === 'ORDERED' && !order.orderedAt ? new Date() : order.orderedAt;

    return this.db.purchaseOrder.update({
      where: { id },
      data: {
        status: dto.status,
        orderedAt,
      },
      include: {
        supplier: true,
        items: true,
      },
    });
  }

  async updateOrderPayment(id: string, dto: UpdatePurchaseOrderPaymentDto) {
    await this.getOrder(id);

    const paidAmount =
      dto.paidAmount !== undefined
        ? new Prisma.Decimal(dto.paidAmount)
        : undefined;

    return this.db.purchaseOrder.update({
      where: { id },
      data: {
        paymentStatus: dto.paymentStatus,
        ...(paidAmount ? { paidAmount } : {}),
      },
      include: {
        supplier: true,
        items: true,
      },
    });
  }

  // ==========================================
  // Goods Receipts & Inventory Receiving
  // ==========================================

  async receiveGoods(
    purchaseOrderId: string,
    dto: CreateGoodsReceiptDto,
    receivedBy?: string,
  ) {
    const po = await this.getOrder(purchaseOrderId);

    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException(
        `Cannot receive goods for purchase order in "${po.status}" status. Order must be ORDERED or PARTIALLY_RECEIVED.`,
      );
    }

    const itemMap = new Map(po.items.map((i) => [i.id, i]));
    const receiptItemsToCreate: Array<{
      purchaseOrderItemId: string;
      productId: string;
      variantId?: string | null;
      quantityReceived: number;
      unitCost: Prisma.Decimal;
    }> = [];

    // Validate quantities against remaining ordered
    for (const item of dto.items) {
      const poItem = itemMap.get(item.purchaseOrderItemId);
      if (!poItem) {
        throw new BadRequestException(
          `Item ${item.purchaseOrderItemId} does not belong to this purchase order`,
        );
      }

      const remaining = poItem.orderedQuantity - poItem.receivedQuantity;
      if (item.quantityReceived <= 0) {
        throw new BadRequestException(
          `Received quantity for ${poItem.productName} must be greater than 0`,
        );
      }
      if (item.quantityReceived > remaining) {
        throw new BadRequestException(
          `Received quantity (${item.quantityReceived}) for ${poItem.productName} exceeds remaining quantity (${remaining})`,
        );
      }

      receiptItemsToCreate.push({
        purchaseOrderItemId: poItem.id,
        productId: poItem.productId,
        variantId: poItem.variantId,
        quantityReceived: item.quantityReceived,
        unitCost: poItem.unitCost,
      });
    }

    const receiptNumber = await this.generateGrnNumber();
    const effectiveReceiver = dto.receivedBy || receivedBy || 'Admin';

    return this.db.$transaction(
      async (tx) => {
        // 1. Create Goods Receipt
        const receipt = await tx.goodsReceipt.create({
          data: {
            receiptNumber,
            purchaseOrderId: po.id,
            receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
            receivedBy: effectiveReceiver,
            notes: dto.notes?.trim() || null,
            items: {
              create: receiptItemsToCreate,
            },
          },
          include: { items: true },
        });

        // 2. Update stock & inventory movements for each received item
        for (const item of receiptItemsToCreate) {
          // Increment receivedQuantity on PO item
          await tx.purchaseOrderItem.update({
            where: { id: item.purchaseOrderItemId },
            data: { receivedQuantity: { increment: item.quantityReceived } },
          });

          // Ensure inventory record exists
          const invWhere = item.variantId
            ? { variantId: item.variantId }
            : { productId: item.productId };

          let inventory = await tx.inventory.findFirst({
            where: invWhere,
          });

          if (!inventory) {
            inventory = await tx.inventory.create({
              data: {
                productId: item.variantId ? null : item.productId,
                variantId: item.variantId || null,
                quantity: 0,
                reserved: 0,
                lowStockAt: 5,
              },
            });
          }

          const beforeQty = inventory.quantity;
          const afterQty = beforeQty + item.quantityReceived;

          // Increment inventory quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { increment: item.quantityReceived } },
          });

          // Create inventory movement
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId || null,
              type: 'PURCHASE',
              quantity: item.quantityReceived,
              beforeQty,
              afterQty,
              referenceId: receipt.id,
              reason: `PURCHASE_RECEIPT: ${po.poNumber} (${receipt.receiptNumber})`,
            },
          });

          // Update product / variant costPrice
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { costPrice: item.unitCost },
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { costPrice: item.unitCost },
            });
          }
        }

        // 3. Check if all items are fully received
        const updatedItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: po.id },
        });

        const allDone = updatedItems.every(
          (i) => i.receivedQuantity >= i.orderedQuantity,
        );
        const newStatus = allDone ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: newStatus },
        });

        return receipt;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
  }

  async listReceipts(params: {
    purchaseOrderId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GoodsReceiptWhereInput = {
      ...(params.purchaseOrderId
        ? { purchaseOrderId: params.purchaseOrderId }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.goodsReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              supplier: { select: { id: true, name: true } },
            },
          },
          items: true,
        },
      }),
      this.db.goodsReceipt.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReceipt(id: string) {
    const receipt = await this.db.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Goods receipt not found');
    }

    return receipt;
  }

  // ==========================================
  // Purchasing Summary / KPIs
  // ==========================================

  async getPurchasingSummary() {
    const [
      activeSuppliers,
      openOrders,
      receivedOrders,
      totalReceipts,
      recentOrders,
    ] = await Promise.all([
      this.db.supplier.count({ where: { deletedAt: null, isActive: true } }),
      this.db.purchaseOrder.count({
        where: { status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] } },
      }),
      this.db.purchaseOrder.count({ where: { status: 'RECEIVED' } }),
      this.db.goodsReceipt.count(),
      this.db.purchaseOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { name: true } },
        },
      }),
    ]);

    return {
      activeSuppliers,
      openOrders,
      receivedOrders,
      totalReceipts,
      recentOrders,
    };
  }
}
