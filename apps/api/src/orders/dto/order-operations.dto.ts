import { Trim } from './trim.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderMutationDto {
  @IsInt() @Min(0) version!: number;
}
export class ShipmentUpdateDto extends OrderMutationDto {
  @IsIn(['IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']) status!: string;
  @Trim() @IsString() @Length(5, 500) note!: string;
}
export class ReturnLineDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}
export class ReturnRequestDto extends OrderMutationDto {
  @Trim() @IsString() @Length(5, 500) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];
}
export class ReturnDecisionDto extends OrderMutationDto {
  @IsBoolean() approved!: boolean;
  @Trim() @IsString() @Length(5, 500) note!: string;
}
export class ReturnInspectionLineDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(0) @Max(100000) receivedQuantity!: number;
  @IsInt() @Min(0) @Max(100000) sellableQuantity!: number;
}
export class ReturnReceiveDto extends OrderMutationDto {
  @Trim() @IsString() @Length(5, 500) note!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnInspectionLineDto)
  items!: ReturnInspectionLineDto[];
}
export class PaymentRecordDto extends OrderMutationDto {
  @IsIn([
    'MANUAL_VERIFIED',
    'COD_COLLECTION',
    'COD_SETTLEMENT',
    'REFUND_RECORDED',
  ])
  kind!: string;
  @IsNumberString({ no_symbols: false }) amount!: string;
  @Trim() @IsString() @Length(2, 80) provider!: string;
  @Trim() @IsString() @Length(3, 120) reference!: string;
  @Trim() @IsString() @Length(10, 500) evidence!: string;
  @IsOptional() @IsUUID() shipmentId?: string;
  @IsOptional() @IsNumberString({ no_symbols: false }) fee?: string;
}
export class ManualPaymentRejectionDto extends OrderMutationDto {
  @Trim() @IsString() @Length(5, 500) note!: string;
}
