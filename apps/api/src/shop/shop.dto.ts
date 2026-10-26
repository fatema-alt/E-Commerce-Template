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
] as const) {
  @IsOptional()
  @IsIn(['COD', 'BANK_TRANSFER', 'BKASH', 'SSLCOMMERZ', 'NAGAD', 'ONLINE'])
  paymentMethod:
    | 'COD'
    | 'BANK_TRANSFER'
    | 'BKASH'
    | 'SSLCOMMERZ'
    | 'NAGAD'
    | 'ONLINE' = 'COD';
  @IsString() @MaxLength(10000) quoteToken!: string;
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
