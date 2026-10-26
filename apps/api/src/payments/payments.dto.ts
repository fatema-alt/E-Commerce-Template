import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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

export class UpdatePaymentSettingDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class TestGatewayDto {
  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
