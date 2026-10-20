import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  SetMetadata,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogQueryDto } from './catalog-query.dto.js';
@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':entity/:id/audit')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  history(
    @Param('entity') entity: string,
    @Param('id', ParseUUIDPipe) entityId: string,
    @Query() query: CatalogQueryDto,
  ) {
    return this.prisma.catalogAuditLog.findMany({
      where: { entity, entityId },
      take: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
