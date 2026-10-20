import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto.js';
import { IsISO8601, IsOptional } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto, {
  skipNullProperties: false,
}) {
  @IsOptional() @IsISO8601() expectedUpdatedAt?: string;
}
