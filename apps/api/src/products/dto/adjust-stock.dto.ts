import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export enum StockAdjustmentType {
  IN = 'IN',
  OUT = 'OUT',
}

export class AdjustStockDto {
  @IsEnum(StockAdjustmentType)
  type!: StockAdjustmentType;

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
