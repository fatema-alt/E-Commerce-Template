import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto.js';
import { IsISO8601, IsOptional } from 'class-validator';
export class UpdateCategoryDto extends PartialType(CreateCategoryDto, {
  skipNullProperties: false,
}) {
  @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
