import { Trim } from './trim.js';
import { IsOptional, IsString, Length, IsNumber, Min } from 'class-validator';
import { OrderMutationDto } from './order-operations.dto.js';

export class BookManualShipmentDto extends OrderMutationDto {
  @Trim() @IsString() @Length(2, 80) provider!: string;
  @Trim() @IsString() @Length(2, 120) trackingNumber!: string;
  @IsOptional() @Trim() @IsString() @Length(1, 120) providerBookingId?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  parcelWeightKg?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost?: number;
  @IsOptional() @Trim() @IsString() @Length(1, 500) parcelDetails?: string;
}
