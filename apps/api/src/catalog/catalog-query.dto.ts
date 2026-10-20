import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  IsISO8601,
} from 'class-validator';

export class CatalogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  paginated = false;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(150) brand?: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?:
    'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  @IsOptional() @IsIn(['SIMPLE', 'VARIABLE']) type?: 'SIMPLE' | 'VARIABLE';
  @IsOptional() @IsIn(['LOW', 'OUT', 'HEALTHY']) stockStatus?:
    'LOW' | 'OUT' | 'HEALTHY';
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) minPrice?: string;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) maxPrice?: string;
  @IsOptional() @IsISO8601() createdFrom?: string;
  @IsOptional() @IsISO8601() createdTo?: string;
  @IsOptional() @IsISO8601() updatedFrom?: string;
  @IsOptional() @IsISO8601() updatedTo?: string;
  @IsOptional()
  @IsIn(['name', 'price', 'createdAt', 'updatedAt', 'sku', 'sortOrder'])
  sortBy = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
  @IsOptional() @IsIn(['true', 'false']) active?: string;
  @IsOptional() @IsUUID() parentId?: string;
}
