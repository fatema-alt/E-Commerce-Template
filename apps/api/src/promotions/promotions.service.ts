import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CouponType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCouponDto, UpdateCouponDto } from './promotions.dto.js';

const D = Prisma.Decimal;

export interface CustomerIdentity {
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface CouponEvaluationResult {
  couponId: string;
  code: string;
  type: CouponType;
  discountAmount: Prisma.Decimal;
  isFreeShipping: boolean;
  description?: string | null;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly db: PrismaService) {}

  async list(filters: {
    page?: number;
    limit?: number;
    q?: string;
    isActive?: boolean;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.q
        ? {
            OR: [
              { code: { contains: filters.q.trim(), mode: 'insensitive' } },
              {
                description: {
                  contains: filters.q.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.db.$transaction([
      this.db.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { usages: true, orders: true },
          },
        },
      }),
      this.db.coupon.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: string) {
    const coupon = await this.db.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { usedAt: 'desc' },
          take: 20,
        },
        _count: {
          select: { usages: true, orders: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.db.coupon.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Coupon code "${code}" already exists`);
    }

    if (dto.type === CouponType.PERCENTAGE && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('Percentage coupon value must be between 1 and 100');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    if (startsAt && expiresAt && startsAt > expiresAt) {
      throw new BadRequestException('Start date cannot be after expiry date');
    }

    return this.db.coupon.create({
      data: {
        code,
        description: dto.description?.trim(),
        type: dto.type,
        value: new D(dto.value),
        minOrderAmount: dto.minOrderAmount ? new D(dto.minOrderAmount) : null,
        maxDiscountAmount: dto.maxDiscountAmount
          ? new D(dto.maxDiscountAmount)
          : null,
        usageLimit: dto.usageLimit,
        perCustomerLimit: dto.perCustomerLimit ?? 1,
        startsAt,
        expiresAt,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.db.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const code = dto.code ? dto.code.trim().toUpperCase() : undefined;
    if (code && code !== coupon.code) {
      const existing = await this.db.coupon.findUnique({ where: { code } });
      if (existing) {
        throw new ConflictException(`Coupon code "${code}" is already in use`);
      }
    }

    const type = dto.type ?? coupon.type;
    const value = dto.value !== undefined ? dto.value : Number(coupon.value);

    if (type === CouponType.PERCENTAGE && (value <= 0 || value > 100)) {
      throw new BadRequestException('Percentage discount must be between 1 and 100');
    }

    const startsAt =
      dto.startsAt !== undefined
        ? dto.startsAt
          ? new Date(dto.startsAt)
          : null
        : coupon.startsAt;
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : coupon.expiresAt;

    if (startsAt && expiresAt && startsAt > expiresAt) {
      throw new BadRequestException('Start date cannot be after expiry date');
    }

    return this.db.coupon.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: new D(dto.value) } : {}),
        ...(dto.minOrderAmount !== undefined
          ? {
              minOrderAmount: dto.minOrderAmount
                ? new D(dto.minOrderAmount)
                : null,
            }
          : {}),
        ...(dto.maxDiscountAmount !== undefined
          ? {
              maxDiscountAmount: dto.maxDiscountAmount
                ? new D(dto.maxDiscountAmount)
                : null,
            }
          : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.perCustomerLimit !== undefined
          ? { perCustomerLimit: dto.perCustomerLimit }
          : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async toggleActive(id: string) {
    const coupon = await this.db.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    return this.db.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }

  async delete(id: string) {
    const coupon = await this.db.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon._count.usages > 0) {
      // Deactivate rather than delete to preserve historical order records
      return this.db.coupon.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.db.coupon.delete({ where: { id } });
  }

  async evaluateCoupon(
    rawCode: string,
    subtotal: Prisma.Decimal,
    customer?: CustomerIdentity,
  ): Promise<CouponEvaluationResult> {
    const code = rawCode.trim().toUpperCase();

    const coupon = await this.db.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon code');
    }

    const now = new Date();

    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('This coupon promotion has not started yet');
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('This coupon code has expired');
    }

    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new BadRequestException('This coupon has reached its total usage limit');
    }

    if (coupon.minOrderAmount && subtotal.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount of ৳${coupon.minOrderAmount} required for this coupon`,
      );
    }

    // Customer usage check
    if (customer && (customer.customerId || customer.customerPhone || customer.customerEmail)) {
      const customerConditions: Prisma.CouponUsageWhereInput[] = [];
      if (customer.customerId) {
        customerConditions.push({ customerId: customer.customerId });
      }
      if (customer.customerPhone) {
        customerConditions.push({ customerPhone: customer.customerPhone });
      }
      if (customer.customerEmail) {
        customerConditions.push({ customerEmail: customer.customerEmail });
      }

      if (customerConditions.length > 0) {
        const usageCount = await this.db.couponUsage.count({
          where: {
            couponId: coupon.id,
            OR: customerConditions,
          },
        });

        if (usageCount >= coupon.perCustomerLimit) {
          throw new BadRequestException(
            'You have already reached the maximum usage limit for this coupon',
          );
        }
      }
    }

    // Calculate discount amount
    let discount = new D(0);
    let isFreeShipping = false;

    if (coupon.type === CouponType.PERCENTAGE) {
      discount = subtotal.mul(coupon.value).div(100).toDecimalPlaces(2);
      if (coupon.maxDiscountAmount && discount.greaterThan(coupon.maxDiscountAmount)) {
        discount = coupon.maxDiscountAmount;
      }
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      discount = coupon.value.greaterThan(subtotal) ? subtotal : coupon.value;
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      isFreeShipping = true;
      discount = new D(0);
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discountAmount: discount,
      isFreeShipping,
      description: coupon.description,
    };
  }
}
