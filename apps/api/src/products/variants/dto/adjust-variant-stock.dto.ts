import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export enum VariantStockAdjustmentType {
  IN = 'IN',
  OUT = 'OUT',
}

export class AdjustVariantStockDto {
  @IsEnum(VariantStockAdjustmentType)
  type!: VariantStockAdjustmentType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
  @IsOptional() @IsString() @MaxLength(100) referenceId?: string;
}
