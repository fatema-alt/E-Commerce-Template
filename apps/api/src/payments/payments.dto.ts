import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum OnlinePaymentMethod {
  BKASH = 'BKASH',
  SSLCOMMERZ = 'SSLCOMMERZ',
}

export class InitiatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(OnlinePaymentMethod)
  method!: OnlinePaymentMethod;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}

export class QueryPaymentDto {
  @IsUUID()
  orderId!: string;
}
