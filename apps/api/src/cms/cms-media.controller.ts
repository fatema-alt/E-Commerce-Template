import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Req,
  SetMetadata,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp from 'sharp';
import {
  MEDIA_STORAGE,
  type MediaStorage,
  prepareImage,
} from '../media/media-storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminRequest } from '../auth/auth.guard.js';

@Controller('admin/cms/media')
export class CmsMediaController {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly db: PrismaService,
  ) {}
  @Post()
  @SetMetadata('roles', ['ADMIN', 'SUPER_ADMIN'])
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    if (!file) throw new BadRequestException('Choose an image');
    const { original } = await prepareImage(file);
    const metadata = await sharp(original).metadata();
    const saved = await this.storage.put('cms', file);
    try {
      return await this.db.cmsMediaAsset.create({
        data: {
          storageKey: 'cms/' + saved.key,
          url: saved.url,
          thumbnailUrl: saved.thumbnailUrl,
          mimeType: 'image/webp',
          bytes: original.length,
          width: metadata.width,
          height: metadata.height,
          uploadedBy: req.admin!.id,
        },
      });
    } catch (error) {
      await this.storage.remove('cms', saved.key);
      throw error;
    }
  }
}
