import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GoodsReceiptItemInputDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderItemId!: string;

  @IsInt()
  @Min(1)
  quantityReceived!: number;
}

export class CreateGoodsReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemInputDto)
  items!: GoodsReceiptItemInputDto[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsString()
  @IsOptional()
  receivedAt?: string;

  @IsString()
  @IsOptional()
  receivedBy?: string;
}
