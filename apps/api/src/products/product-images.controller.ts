import {
  SetMetadata,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MEDIA_STORAGE } from '../media/media-storage.service.js';
import type { MediaStorage } from '../media/media-storage.service.js';
import type { AdminRequest } from '../auth/auth.guard.js';
import { audit, catalogError } from '../catalog/catalog.rules.js';

class ImageDto {
  @IsOptional() @IsString() @MaxLength(200) altText?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  @IsOptional() @IsUUID() variantId?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

@Controller('products/:productId/images')
export class ProductImagesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  private async product(productId: string) {
    if (
      !(await this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Product not found');
  }

  @Get()
  async list(@Param('productId', ParseUUIDPipe) productId: string) {
    await this.product(productId);
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    });
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async upload(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    await this.product(productId);
    if (!file) throw new BadRequestException('Image file is required');
    const stored = await this.storage.put('products', file);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
        const count = await tx.productImage.count({ where: { productId } });
        if (count >= 20)
          throw new BadRequestException('Maximum 20 images per product');
        const image = await tx.productImage.create({
          data: {
            productId,
            storageKey: stored.key,
            url: stored.url,
            altText: '',
            isPrimary: count === 0,
            sortOrder: count,
          },
        });
        await audit(
          tx,
          'product',
          productId,
          'IMAGE_UPLOAD',
          { imageId: image.id },
          req.admin?.id,
        );
        return { ...image, thumbnailUrl: stored.thumbnailUrl };
      });
    } catch (error) {
      await this.storage.remove('products', stored.key);
      catalogError(error);
    }
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':imageId')
  async update(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: ImageDto,
    @Req() req: AdminRequest,
  ) {
    await this.product(productId);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
          const existing = await tx.productImage.findFirst({
            where: { id: imageId, productId },
          });
          if (!existing) throw new NotFoundException('Image not found');
          if (existing.isPrimary && dto.isPrimary === false)
            throw new BadRequestException(
              'Choose a different primary image instead',
            );
          if (
            dto.variantId &&
            !(await tx.productVariant.findFirst({
              where: { id: dto.variantId, productId },
            }))
          )
            throw new BadRequestException(
              'Image variant must belong to this product',
            );
          if (dto.isPrimary)
            await tx.productImage.updateMany({
              where: { productId },
              data: { isPrimary: false },
            });
          const image = await tx.productImage.update({
            where: { id: imageId },
            data: dto,
          });
          await audit(
            tx,
            'product',
            productId,
            'IMAGE_UPDATE',
            { imageId, ...dto },
            req.admin?.id,
          );
          return image;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      catalogError(error);
    }
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':imageId/primary')
  setPrimary(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: AdminRequest,
  ) {
    return this.update(productId, imageId, { isPrimary: true }, req);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post(':imageId/replace')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async replace(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    await this.product(productId);
    if (!file) throw new BadRequestException('Image file is required');
    if (
      !(await this.prisma.productImage.findFirst({
        where: { id: imageId, productId },
      }))
    )
      throw new NotFoundException('Image not found');
    const stored = await this.storage.put('products', file);
    let changed: { oldKey: string | null; image: unknown };
    try {
      changed = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
        const existing = await tx.productImage.findFirst({
          where: { id: imageId, productId },
        });
        if (!existing) throw new NotFoundException('Image not found');
        const image = await tx.productImage.update({
          where: { id: imageId },
          data: { storageKey: stored.key, url: stored.url },
        });
        await audit(
          tx,
          'product',
          productId,
          'IMAGE_REPLACE',
          { imageId },
          req.admin?.id,
        );
        return { oldKey: existing.storageKey, image };
      });
    } catch (error) {
      await this.storage.remove('products', stored.key);
      catalogError(error);
    }
    const cleanupPending = changed.oldKey
      ? await this.storage.remove('products', changed.oldKey).then(
          () => false,
          () => true,
        )
      : false;
    return { image: changed.image, cleanupPending };
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Delete(':imageId')
  async remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: AdminRequest,
  ) {
    await this.product(productId);
    const image = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId}))`;
      const existing = await tx.productImage.findFirst({
        where: { id: imageId, productId },
      });
      if (!existing) throw new NotFoundException('Image not found');
      await tx.productImage.delete({ where: { id: imageId } });
      if (existing.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (next)
          await tx.productImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
      await audit(
        tx,
        'product',
        productId,
        'IMAGE_DELETE',
        { imageId },
        req.admin?.id,
      );
      return existing;
    });
    const cleanupPending = image.storageKey
      ? await this.storage.remove('products', image.storageKey).then(
          () => false,
          () => true,
        )
      : false;
    return { success: true, cleanupPending };
  }
}
