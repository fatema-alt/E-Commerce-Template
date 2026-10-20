import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
  UseInterceptors,
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { CmsDocumentKind } from '../generated/prisma/client.js';
import type { AdminRequest } from '../auth/auth.guard.js';
import { CmsService } from './cms.service.js';
import {
  CmsQueryDto,
  PublishCmsDto,
  RollbackCmsDto,
  SaveCmsDraftDto,
  ScheduleCmsDto,
} from './cms.dto.js';
import { BLOCK_SCHEMAS, CMS_SCHEMAS, DEFAULT_THEME } from './cms-schema.js';

@Injectable()
export class CmsNoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}
@Controller('admin/cms')
@UseInterceptors(CmsNoStoreInterceptor)
export class CmsAdminController {
  constructor(private readonly cms: CmsService) {}
  @Get() list(@Query() query: CmsQueryDto) {
    return this.cms.list(query);
  }
  @Get('schema') schema() {
    return {
      schemaVersion: 1,
      documents: CMS_SCHEMAS,
      blocks: BLOCK_SCHEMAS,
      defaultTheme: DEFAULT_THEME,
    };
  }
  @Get('media') media(@Query() query: CmsQueryDto) {
    return this.cms.media(query);
  }
  @Get('changes')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  changes(@Query() query: CmsQueryDto) {
    return this.cms.changes(query);
  }
  @Get(':kind/:key')
  inspect(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
  ) {
    return this.cms.inspect(kind, key);
  }
  @Get(':kind/:key/versions')
  history(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Query() query: CmsQueryDto,
  ) {
    return this.cms.history(kind, key, query);
  }
  @Get(':kind/:key/events')
  events(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Query() query: CmsQueryDto,
  ) {
    return this.cms.history(kind, key, query, true);
  }
  @Get(':kind/:key/versions/:version')
  preview(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.cms.version(kind, key, version);
  }
  @Patch(':kind/:key/draft')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  draft(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: SaveCmsDraftDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.draft(
      kind,
      key,
      dto.content,
      dto.expectedRevision,
      req.admin!.id,
    );
  }
  @Post(':kind/:key/publish')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  publish(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: PublishCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.publish(
      kind,
      key,
      dto.expectedRevision,
      req.admin!.id,
      dto.version,
    );
  }
  @Post(':kind/:key/rollback')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  rollback(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: RollbackCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.publish(
      kind,
      key,
      dto.expectedRevision,
      req.admin!.id,
      dto.version,
      'ROLLED_BACK',
    );
  }
  @Post(':kind/:key/schedule')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  schedule(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: ScheduleCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.schedule(
      kind,
      key,
      dto.expectedRevision,
      req.admin!.id,
      dto.scheduledAt,
      dto.version,
    );
  }
  @Post(':kind/:key/cancel-schedule')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  cancel(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: PublishCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.cancelSchedule(
      kind,
      key,
      dto.expectedRevision,
      req.admin!.id,
    );
  }
  @Post(':kind/:key/unpublish')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  unpublish(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: PublishCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.withdraw(kind, key, dto.expectedRevision, req.admin!.id);
  }
  @Post(':kind/:key/archive')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  archive(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Body() dto: PublishCmsDto,
    @Req() req: AdminRequest,
  ) {
    return this.cms.withdraw(
      kind,
      key,
      dto.expectedRevision,
      req.admin!.id,
      true,
    );
  }
}
@Controller('storefront/cms')
@SetMetadata('public', true)
export class CmsPublicController {
  constructor(private readonly cms: CmsService) {}
  @Get('pages') @Header('Cache-Control', 'no-store') pages(
    @Query() query: CmsQueryDto,
  ) {
    return this.cms.publicPages(query);
  }
  @Get(':kind/:key')
  @Header('Cache-Control', 'no-store')
  async published(
    @Param('kind', new ParseEnumPipe(CmsDocumentKind)) kind: CmsDocumentKind,
    @Param('key') key: string,
    @Headers('if-none-match') tag: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { etag, ...content } = await this.cms.published(kind, key);
    response.setHeader('ETag', etag);
    if (tag === etag) {
      response.status(304);
      return;
    }
    return content;
  }
}
