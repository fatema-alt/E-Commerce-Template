import { SetMetadata } from '@nestjs/common';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CatalogQueryDto } from '../catalog/catalog-query.dto.js';
import type { AdminRequest } from '../auth/auth.guard.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() req: AdminRequest) {
    return this.categoriesService.create(dto, req.admin?.id);
  }

  @Get()
  findAll(@Query() query: CatalogQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get('summary') summary() {
    return this.categoriesService.summary();
  }
  @Get('tree') tree() {
    return this.categoriesService.tree();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categoriesService.findOne(id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AdminRequest,
  ) {
    return this.categoriesService.update(id, dto, req.admin?.id);
  }

  @SetMetadata('roles', ['SUPER_ADMIN'])
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AdminRequest,
  ) {
    return this.categoriesService.remove(id, req.admin?.id);
  }
}
