import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, Matches, MaxLength } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto.js';
export class StorefrontQueryDto extends CatalogQueryDto {
  @IsOptional()
  @IsIn(['featured', 'latest', 'category', 'selected', 'sale', 'trending', 'recommended'])
  source?: string;
  @IsOptional()
  @MaxLength(3699)
  @Matches(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(,[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}){0,99}$/,
  )
  ids?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeCounts?: boolean;
}
