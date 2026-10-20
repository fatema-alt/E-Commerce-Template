import {
  SetMetadata,
  BadRequestException,
  Controller,
  Delete,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service.js';
import { MEDIA_STORAGE } from '../media/media-storage.service.js';
import type { MediaStorage } from '../media/media-storage.service.js';
import type { AdminRequest } from '../auth/auth.guard.js';
import { audit } from '../catalog/catalog.rules.js';

@Controller('categories/:categoryId/image')
export class CategoryImagesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  private async change(
    categoryId: string,
    url: string | null,
    actorId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${categoryId}))`;
      const existing = await tx.category.findUnique({
        where: { id: categoryId },
      });
      if (!existing) throw new NotFoundException('Category not found');
      const result = await tx.category.update({
        where: { id: categoryId },
        data: { imageUrl: url },
      });
      await audit(
        tx,
        'category',
        categoryId,
        'IMAGE_UPDATE',
        { before: existing.imageUrl, after: url },
        actorId,
      );
      return { existing, result };
    });
  }

  private async cleanup(url: string | null) {
    const key = url ? this.storage.keyFromUrl('categories', url) : null;
    if (
      key &&
      !(await this.prisma.category.count({ where: { imageUrl: url } }))
    )
      await this.storage.remove('categories', key);
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
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    if (
      !(await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Category not found');
    const stored = await this.storage.put('categories', file);
    let changed: Awaited<ReturnType<CategoryImagesController['change']>>;
    try {
      changed = await this.change(categoryId, stored.url, req.admin?.id);
    } catch (error) {
      await this.storage.remove('categories', stored.key);
      throw error;
    }
    const cleanupPending = await this.cleanup(changed.existing.imageUrl).then(
      () => false,
      () => true,
    );
    return { ...changed.result, cleanupPending };
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Delete()
  async remove(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Req() req: AdminRequest,
  ) {
    const { existing, result } = await this.change(
      categoryId,
      null,
      req.admin?.id,
    );
    const cleanupPending = await this.cleanup(existing.imageUrl).then(
      () => false,
      () => true,
    );
    return { ...result, cleanupPending };
  }
}
