import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/category.dto.js';
import {
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto.js';
import {
  ExpensePaymentMethod,
  ExpenseStatus,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

const DEFAULT_CATEGORIES = [
  {
    name: 'Office & Showroom Rent',
    code: 'RENT',
    description: 'দোকান, শোরুম বা গোডাউন ভাড়া',
    color: '#4f46e5', // indigo
  },
  {
    name: 'Electricity & Utility Bills',
    code: 'UTILITIES',
    description: 'বিদ্যুৎ বিল, পানি, গ্যাস ও সার্ভিস চার্জ',
    color: '#0284c7', // sky
  },
  {
    name: 'Tea, Snacks & Entertainment',
    code: 'SNACKS',
    description: 'দোকানের চা, নাস্তা ও অতিথি আপ্যায়ন খরচ',
    color: '#d97706', // amber
  },
  {
    name: 'Staff Salary & Advances',
    code: 'SALARY',
    description: 'কর্মচারীদের বেতন, বোনাস ও অগ্রিম',
    color: '#059669', // emerald
  },
  {
    name: 'Packaging & Courier Supplies',
    code: 'PACKAGING',
    description: 'বক্স, বাবল র‍্যাপ, টেপ, প্যাকিং পলি ইত্যাদি',
    color: '#7c3aed', // violet
  },
  {
    name: 'Local Transport & Conveyance',
    code: 'CONVEYANCE',
    description: 'যাতায়াত, রিকশা ও ভ্যান ভাড়া',
    color: '#ea580c', // orange
  },
  {
    name: 'Repair & Maintenance',
    code: 'MAINTENANCE',
    description: 'দোকান মেরামত, এসি সার্ভিসিং ও ফিটিংস',
    color: '#dc2626', // red
  },
  {
    name: 'Marketing & Promotion',
    code: 'MARKETING',
    description: 'ফেসবুক বুস্টিং, ব্যানার ও লিফলেট প্রিন্টিং',
    color: '#db2777', // pink
  },
  {
    name: 'Internet & Telecom',
    code: 'TELECOM',
    description: 'ওয়াইফাই ব্রডব্যান্ড বিল ও মোবাইল রিচার্জ',
    color: '#0891b2', // cyan
  },
  {
    name: 'Stationery & Office Supplies',
    code: 'STATIONERY',
    description: 'খাতা, কলম, মেমো প্রিন্টিং ও স্টেশনারি',
    color: '#475569', // slate
  },
  {
    name: 'Miscellaneous / Other Expenses',
    code: 'MISC',
    description: 'বিবিধ ফুটফরমাশ খরচ',
    color: '#64748b', // cool slate
  },
];

@Injectable()
export class FinanceService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultCategoriesIfNeeded();
  }

  async seedDefaultCategoriesIfNeeded() {
    try {
      const count = await this.prisma.expenseCategory.count();
      if (count === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await this.prisma.expenseCategory.upsert({
            where: { name: cat.name },
            update: {},
            create: {
              name: cat.name,
              code: cat.code,
              description: cat.description,
              color: cat.color,
              isActive: true,
            },
          });
        }
      }
    } catch {
      // Ignore if table not yet migrated during initial setup
    }
  }

  // ==========================================
  // Summary & KPI Analytics
  // ==========================================

  async getSummary(query?: { startDate?: string; endDate?: string }) {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // This month's total
    const monthExpenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: { gte: startOfCurrentMonth },
        status: { not: ExpenseStatus.VOID },
      },
      select: { amount: true },
    });
    const totalThisMonth = monthExpenses.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    // Today's total
    const todayExpenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: { gte: startOfToday, lte: endOfToday },
        status: { not: ExpenseStatus.VOID },
      },
      select: { amount: true },
    });
    const totalToday = todayExpenses.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    // All-time total & total vouchers count
    const [allTimeSum, totalVouchersCount] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { status: { not: ExpenseStatus.VOID } },
        _sum: { amount: true },
      }),
      this.prisma.expense.count(),
    ]);

    // Breakdown by category (all-time non-void)
    const categoryAggregates = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { status: { not: ExpenseStatus.VOID } },
      _sum: { amount: true },
      _count: { id: true },
    });

    const categories = await this.prisma.expenseCategory.findMany({
      select: { id: true, name: true, color: true, code: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const byCategory = categoryAggregates
      .map((item) => {
        const cat = catMap.get(item.categoryId);
        return {
          categoryId: item.categoryId,
          name: cat?.name || 'Unknown',
          code: cat?.code || '',
          color: cat?.color || '#64748b',
          total: Number(item._sum.amount ?? 0),
          count: item._count.id,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Breakdown by payment method
    const paymentAggregates = await this.prisma.expense.groupBy({
      by: ['paymentMethod'],
      where: { status: { not: ExpenseStatus.VOID } },
      _sum: { amount: true },
      _count: { id: true },
    });

    const byPaymentMethod = paymentAggregates.map((item) => ({
      paymentMethod: item.paymentMethod,
      total: Number(item._sum.amount ?? 0),
      count: item._count.id,
    }));

    // Recent 5 expenses
    const recentExpenses = await this.prisma.expense.findMany({
      orderBy: { expenseDate: 'desc' },
      take: 5,
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return {
      totalThisMonth,
      totalToday,
      totalAllTime: Number(allTimeSum._sum.amount ?? 0),
      totalVouchersCount,
      byCategory,
      byPaymentMethod,
      recentExpenses,
    };
  }

  // ==========================================
  // Expense Voucher Generation
  // ==========================================

  private async generateNextVoucherNo(date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `EXP-${year}${month}-`;

    const last = await this.prisma.expense.findFirst({
      where: {
        voucherNo: { startsWith: prefix },
      },
      orderBy: { voucherNo: 'desc' },
      select: { voucherNo: true },
    });

    let seq = 1;
    if (last && last.voucherNo) {
      const parts = last.voucherNo.split('-');
      const num = parseInt(parts[parts.length - 1] || '0', 10);
      if (!Number.isNaN(num)) {
        seq = num + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ==========================================
  // Expenses CRUD
  // ==========================================

  async createExpense(dto: CreateExpenseDto, createdBy?: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Expense category ${dto.categoryId} not found`);
    }

    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    let voucherNo = dto.voucherNo?.trim();
    if (!voucherNo) {
      voucherNo = await this.generateNextVoucherNo(expenseDate);
    } else {
      const existing = await this.prisma.expense.findUnique({
        where: { voucherNo },
      });
      if (existing) {
        throw new BadRequestException(
          `Voucher number "${voucherNo}" already exists`,
        );
      }
    }

    return this.prisma.expense.create({
      data: {
        voucherNo,
        title: dto.title.trim(),
        amount: dto.amount,
        categoryId: dto.categoryId,
        expenseDate,
        paymentMethod: dto.paymentMethod ?? ExpensePaymentMethod.CASH,
        paidTo: dto.paidTo?.trim() || null,
        spentBy: dto.spentBy?.trim() || null,
        receiptNumber: dto.receiptNumber?.trim() || null,
        receiptUrl: dto.receiptUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: dto.status ?? ExpenseStatus.PAID,
        createdBy: createdBy || null,
      },
      include: {
        category: true,
      },
    });
  }

  async listExpenses(query: ExpenseQueryDto) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    if (query.q && query.q.trim()) {
      const term = query.q.trim();
      where.OR = [
        { voucherNo: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { paidTo: { contains: term, mode: 'insensitive' } },
        { spentBy: { contains: term, mode: 'insensitive' } },
        { receiptNumber: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total, aggregateSum] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
        include: {
          category: true,
        },
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({
        where: {
          ...where,
          status: { not: ExpenseStatus.VOID },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      totalAmount: Number(aggregateSum._sum.amount ?? 0),
    };
  }

  async getExpense(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        OR: [{ id }, { voucherNo: id }],
      },
      include: {
        category: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return expense;
  }

  async updateExpense(id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const cat = await this.prisma.expenseCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) {
        throw new NotFoundException(
          `Expense category ${dto.categoryId} not found`,
        );
      }
    }

    if (dto.voucherNo && dto.voucherNo !== existing.voucherNo) {
      const duplicate = await this.prisma.expense.findUnique({
        where: { voucherNo: dto.voucherNo },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(
          `Voucher number "${dto.voucherNo}" is already in use`,
        );
      }
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        voucherNo: dto.voucherNo?.trim(),
        title: dto.title?.trim(),
        amount: dto.amount,
        categoryId: dto.categoryId,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        paymentMethod: dto.paymentMethod,
        paidTo: dto.paidTo !== undefined ? dto.paidTo.trim() || null : undefined,
        spentBy:
          dto.spentBy !== undefined ? dto.spentBy.trim() || null : undefined,
        receiptNumber:
          dto.receiptNumber !== undefined
            ? dto.receiptNumber.trim() || null
            : undefined,
        receiptUrl:
          dto.receiptUrl !== undefined ? dto.receiptUrl.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
        status: dto.status,
      },
      include: {
        category: true,
      },
    });
  }

  async deleteExpense(id: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }

  // ==========================================
  // Categories CRUD
  // ==========================================

  async listCategories(includeInactive = false) {
    const where: Prisma.ExpenseCategoryWhereInput = includeInactive
      ? {}
      : { isActive: true };

    const categories = await this.prisma.expenseCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    // Compute total amount spent per category
    const sums = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { status: { not: ExpenseStatus.VOID } },
      _sum: { amount: true },
    });
    const sumMap = new Map(
      sums.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]),
    );

    return categories.map((cat) => ({
      ...cat,
      totalSpent: sumMap.get(cat.id) ?? 0,
    }));
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new BadRequestException(
        `Category with name "${dto.name}" already exists`,
      );
    }

    return this.prisma.expenseCategory.create({
      data: {
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        color: dto.color?.trim() || '#64748b',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Expense category ${id} not found`);
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.prisma.expenseCategory.findUnique({
        where: { name: dto.name.trim() },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(
          `Category with name "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code !== undefined ? dto.code.trim() || null : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        color: dto.color?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.expense.count({
      where: { categoryId: id },
    });

    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete category because it has ${count} expense records. You can mark it as inactive instead.`,
      );
    }

    return this.prisma.expenseCategory.delete({
      where: { id },
    });
  }
}
