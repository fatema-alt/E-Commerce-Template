import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PurchaseOrderItemInputDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  orderedQuantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsEnum(['DRAFT', 'ORDERED'])
  @IsOptional()
  status?: 'DRAFT' | 'ORDERED';

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tax?: number;

  @IsString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items!: PurchaseOrderItemInputDto[];
}

export class UpdatePurchaseOrderDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tax?: number;

  @IsString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items?: PurchaseOrderItemInputDto[];
}

export class ChangePurchaseOrderStatusDto {
  @IsEnum(['DRAFT', 'ORDERED', 'CANCELLED'])
  @IsNotEmpty()
  status!: 'DRAFT' | 'ORDERED' | 'CANCELLED';

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdatePurchaseOrderPaymentDto {
  @IsEnum(['UNPAID', 'PARTIALLY_PAID', 'PAID'])
  @IsNotEmpty()
  paymentStatus!: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

  @IsNumber()
  @IsOptional()
  @Min(0)
  paidAmount?: number;
}
