import { IsInt, Max, Min } from 'class-validator';
import { AdjustStockDto } from '../products/dto/adjust-stock.dto.js';
export class InventoryAdjustmentDto extends AdjustStockDto {}
export class InventoryThresholdDto {
  @IsInt() @Min(0) @Max(2147483647) lowStockAt!: number;
}
