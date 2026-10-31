import { OmitType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { IsBoolean } from 'class-validator';
import {
  CreateOrderDto,
  OrderLineDto,
} from '../orders/dto/create-order.dto.js';
import { Trim } from '../orders/dto/trim.js';

export class LoginShopperDto {
  @Trim() @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
export class RegisterShopperDto extends LoginShopperDto {
  @Trim() @IsString() @Length(2, 120) name!: string;
}
export class QuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];

  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 32)
  couponCode?: string;

  /**
   * Optional address hints from the checkout form.
   * Used to compute a contextual shipping estimate during quote.
   * The final fee is always re-verified server-side in checkout().
   */
  @IsOptional() @Trim() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(120) district?: string;

  @IsOptional()
  @IsIn([
    'OPTION_A',
    'OPTION_B',
    'OPTION_C',
    'BANK_TRANSFER',
    'COD',
    'MANUAL_BKASH',
    'MANUAL_NAGAD',
  ])
  paymentOption?: string;
}

export class ValidateCouponDto {
  @Trim()
  @IsString()
  @Length(2, 32)
  code!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
export class ShopCheckoutDto extends OmitType(CreateOrderDto, [
  'customerId',
  'paymentMethod',
  'shippingTotal',
] as const) {
  @IsOptional() @IsIn(['MANUAL_BKASH', 'MANUAL_NAGAD', 'BANK_TRANSFER']) manualProvider?: string;
  @IsOptional()
  @IsIn([
    'COD',
    'BANK_TRANSFER',
    'MANUAL',
    'BKASH',
    'SSLCOMMERZ',
    'NAGAD',
    'ONLINE',
  ])
  paymentMethod:
    | 'COD'
    | 'BANK_TRANSFER'
    | 'MANUAL'
    | 'BKASH'
    | 'SSLCOMMERZ'
    | 'NAGAD'
    | 'ONLINE' = 'COD';
  @IsOptional()
  @IsIn([
    'OPTION_A',
    'OPTION_B',
    'OPTION_C',
    'BANK_TRANSFER',
    'COD',
    'MANUAL_BKASH',
    'MANUAL_NAGAD',
  ])
  paymentOption?: string;
  @IsString() @MaxLength(10000) quoteToken!: string;
}
export class ManualPaymentSubmissionDto {
  @Trim()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{2,99}$/)
  reference!: string;
  @Trim() @IsString() @Length(3, 120) sender!: string;
}
export class ChangeShopPasswordDto {
  @IsString() @MaxLength(256) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(256) newPassword!: string;
}
export class SubscribeDto {
  @Trim() @IsEmail() @MaxLength(254) email!: string;
  @Equals(true) consent!: boolean;
}
export class NewsletterPreferenceDto {
  @IsBoolean() consent!: boolean;
}
