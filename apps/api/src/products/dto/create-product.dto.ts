import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsISO8601,
  IsUrl,
  IsEnum,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductType, ProductStatus } from '../../generated/prisma/client.js';

export class CreateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;

  @Transform(({ value }) => String(value))
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  price!: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  salePrice?: string | null;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  stock!: number;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsEnum(ProductType) type?: ProductType;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string | null;
  @IsOptional() @IsString() @MaxLength(150) manufacturer?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  collections?: string[];
  @IsOptional() @IsString() @MaxLength(5000) internalNotes?: string | null;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  costPrice?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  compareAtPrice?: string | null;
  @IsOptional() @IsISO8601() saleStartsAt?: string | null;
  @IsOptional() @IsISO8601() saleEndsAt?: string | null;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @MaxLength(50) taxClass?: string;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @IsIn(['DENY', 'ALLOW', 'NOTIFY']) backorderPolicy?: string;
  @IsOptional() @IsBoolean() requiresShipping?: boolean;
  @IsOptional() @IsBoolean() freeShipping?: boolean;
  @IsOptional() @IsString() @MaxLength(100) shippingClass?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,9}(\.\d{1,3})?$/)
  weight?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,9}(\.\d{1,3})?$/)
  length?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,9}(\.\d{1,3})?$/)
  width?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,9}(\.\d{1,3})?$/)
  height?: string | null;
  @IsOptional() @IsIn(['kg', 'g', 'lb', 'oz']) weightUnit?: string;
  @IsOptional() @IsIn(['cm', 'mm', 'in', 'm']) dimensionUnit?: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/) countryOfOrigin?: string | null;
  @IsOptional() @Matches(/^\d{6,10}$/) hsCode?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  canonicalUrl?: string | null;
  @IsOptional() @IsBoolean() noIndex?: boolean;
  @IsOptional() @IsString() @MaxLength(200) socialTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) socialDescription?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  socialImage?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(5) options?: {
    name: string;
    values: string[];
  }[];
}
