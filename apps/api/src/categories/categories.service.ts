import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CatalogQueryDto } from '../catalog/catalog-query.dto.js';
import {
  audit,
  catalogError,
  changeSlug,
  rejectNulls,
} from '../catalog/catalog.rules.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async hierarchy(
    tx: Prisma.TransactionClient,
    id: string,
    parentId?: string | null,
  ) {
    // Serialize hierarchy edits, including concurrent moves of opposite branches.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71421001)`;
    const rows = await tx.category.findMany({
      select: { id: true, parentId: true },
    });
    const parents = new Map(rows.map((row) => [row.id, row.parentId]));
    if (parentId && !parents.has(parentId))
      throw new BadRequestException('Parent category does not exist');
    parents.set(id, parentId ?? null);
    for (const key of parents.keys()) {
      const seen = new Set<string>();
      let node: string | null | undefined = key;
      while (node) {
        if (seen.has(node))
          throw new BadRequestException(
            'A category cannot be moved under itself or a descendant',
          );
        seen.add(node);
        if (seen.size > 8)
          throw new BadRequestException(
            'Categories support a maximum depth of eight levels',
          );
        node = parents.get(node);
      }
    }
  }

  async create(dto: CreateCategoryDto, actorId?: string) {
    rejectNulls(dto, [
      'name',
      'slug',
      'sortOrder',
      'isActive',
      'isVisible',
      'isFeatured',
      'noIndex',
    ]);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.hierarchy(tx, 'new', dto.parentId);
        if (
          await tx.catalogRedirect.findUnique({
            where: {
              entity_fromSlug: { entity: 'category', fromSlug: dto.slug },
            },
          })
        )
          throw new ConflictException('Slug is reserved by a historical URL');
        const result = await tx.category.create({ data: dto });
        await audit(tx, 'category', result.id, 'CREATE', dto, actorId);
        return result;
      });
    } catch (error) {
      catalogError(error);
    }
  }

  async updateImage(id: string, imageUrl: string | null) {
    await this.findOne(id);
    return this.prisma.category.update({ where: { id }, data: { imageUrl } });
  }

  async findAll(query = new CatalogQueryDto()) {
    const where: Prisma.CategoryWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.active ? { isActive: query.active === 'true' } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
    };
    const sort = ['name', 'sortOrder', 'createdAt', 'updatedAt'].includes(
      query.sortBy,
    )
      ? query.sortBy
      : 'sortOrder';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: {
          _count: {
            select: {
              products: { where: { deletedAt: null } },
              children: true,
            },
          },
          parent: { select: { id: true, name: true } },
        },
        orderBy: [{ [sort]: query.sortDirection }, { id: 'asc' }],
        take: query.paginated ? query.pageSize : 100,
        skip: query.paginated ? (query.page - 1) * query.pageSize : 0,
      }),
      this.prisma.category.count({ where }),
    ]);
    return query.paginated
      ? { items, total, page: query.page, pageSize: query.pageSize }
      : items;
  }

  async tree() {
    const rows = await this.prisma.category.findMany({
      take: 1001,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
    if (rows.length > 1000)
      throw new BadRequestException(
        'Tree exceeds 1000 categories. Use the paginated list.',
      );
    type Node = (typeof rows)[number] & { children: Node[] };
    const nodes = new Map<string, Node>(
      rows.map((row) => [row.id, { ...row, children: [] }]),
    );
    const roots: Node[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId))
        nodes.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async summary() {
    const [total, active, roots, empty, missingImages, recent] =
      await this.prisma.$transaction([
        this.prisma.category.count(),
        this.prisma.category.count({ where: { isActive: true } }),
        this.prisma.category.count({ where: { parentId: null } }),
        this.prisma.category.count({
          where: { products: { none: { deletedAt: null } } },
        }),
        this.prisma.category.count({ where: { imageUrl: null } }),
        this.prisma.category.findMany({
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, updatedAt: true },
        }),
      ]);
    return {
      total,
      active,
      inactive: total - active,
      roots,
      subcategories: total - roots,
      empty,
      missingImages,
      recent,
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, actorId?: string) {
    rejectNulls(dto, [
      'name',
      'slug',
      'sortOrder',
      'isActive',
      'isVisible',
      'isFeatured',
      'noIndex',
    ]);
    const { expectedUpdatedAt, ...changes } = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71421001)`;
        const existing = await tx.category.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Category not found');
        if (
          expectedUpdatedAt &&
          new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
        )
          throw new ConflictException(
            'This category changed since you opened it. Reload before saving.',
          );
        if (dto.parentId !== undefined)
          await this.hierarchy(tx, id, dto.parentId);
        if (dto.slug)
          await changeSlug(tx, 'category', id, existing.slug, dto.slug);
        const result = await tx.category.update({
          where: { id },
          data: changes,
        });
        await audit(
          tx,
          'category',
          id,
          'UPDATE',
          { before: existing, after: result },
          actorId,
        );
        return result;
      });
    } catch (error) {
      catalogError(error);
    }
  }

  async remove(id: string, actorId?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71421001)`;
        const existing = await tx.category.findUnique({
          where: { id },
          include: { _count: { select: { products: true, children: true } } },
        });
        if (!existing) throw new NotFoundException('Category not found');
        if (existing._count.products || existing._count.children)
          throw new ConflictException(
            'Reassign all products (including archived products) and move child categories before deleting. You can deactivate this category instead.',
          );
        if (existing.imageUrl)
          throw new ConflictException(
            'Remove the category image before deleting',
          );
        if (
          await tx.catalogRedirect.count({
            where: { entity: 'category', entityId: id },
          })
        )
          throw new ConflictException(
            'Category has historical URLs. Deactivate it to preserve redirects.',
          );
        await audit(tx, 'category', id, 'DELETE', existing, actorId);
        return tx.category.delete({ where: { id } });
      });
    } catch (error) {
      catalogError(error);
    }
  }
}
