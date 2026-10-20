import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain lowercase letters, numbers and hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  canonicalUrl?: string | null;
  @IsOptional() @IsBoolean() noIndex?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isVisible?: boolean;
}
