import { Trim } from './trim.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderPaymentMethod } from '../../generated/prisma/client.js';

export class OrderLineDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsInt() @Min(1) @Max(10000) quantity!: number;
}

export class CheckoutAddressDto {
  @Trim() @IsString() @Length(2, 120) recipientName!: string;
  @Trim() @IsString() @Length(6, 32) phone!: string;
  @Trim() @IsString() @Length(3, 240) line1!: string;
  @IsOptional() @Trim() @IsString() @Length(1, 240) line2?: string;
  @Trim() @IsString() @Length(2, 120) city!: string;
  @IsOptional() @Trim() @IsString() @Length(1, 120) district?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 120) division?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 120) upazila?: string;
  @IsOptional() @Trim() @IsString() @Length(1, 20) postalCode?: string;
}

export class CreateOrderDto {
  @IsOptional() @IsUUID() customerId?: string;
  @Trim() @IsString() @Length(2, 120) customerName!: string;
  @IsOptional() @Trim() @IsEmail() customerEmail?: string;
  @Trim() @IsString() @Length(6, 32) customerPhone!: string;
  @IsEnum(OrderPaymentMethod) paymentMethod!: OrderPaymentMethod;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress!: CheckoutAddressDto;
  @IsOptional() @Trim() @IsString() @Length(0, 2000) customerNote?: string;
  @IsOptional() @Trim() @IsString() @Length(2, 32) couponCode?: string;
  @IsOptional() @IsString() paymentOption?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) onlineDiscount?: string;
  /**
   * Pre-calculated shipping fee (BDT) verified server-side before being passed
   * to orders.service. Not exposed to the public API — only injected internally
   * by shop.service after re-verifying the confirmed address.
   * Format: decimal string e.g. "80.00" or "150.00".
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  shippingTotal?: string;
}
