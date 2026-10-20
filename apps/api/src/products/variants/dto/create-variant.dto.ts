import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  IsBoolean,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  @MaxLength(200)
  @MinLength(2)
  name!: string;

  @IsString()
  @MaxLength(100)
  @MinLength(2)
  sku!: string;

  @IsObject()
  attributes!: Record<string, string>;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string | null;
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  costPrice?: string | null;
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
}
