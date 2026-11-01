import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PlanSettingsDto {
  @IsBoolean() fullEnabled!: boolean;
  @IsIn(['percentage', 'fixed']) discountType!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  discountValue!: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  maxDiscountCap?: number | null;
  @IsBoolean() partialEnabled!: boolean;
  @IsIn(['delivery_charge_only', 'fixed_amount', 'percentage_of_order'])
  advanceType!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  advanceValue!: number;
  @IsBoolean() codEnabled!: boolean;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  codMin?: number | null;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  codMax?: number | null;
  @IsBoolean() allowStacking!: boolean;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxTotalDiscountPercent?: number | null;
}
export class PaymentMethodDto {
  @IsString() @Length(1, 120) name!: string;
  @IsIn(['mobile_banking', 'bank']) type!: 'mobile_banking' | 'bank';
  @IsOptional() @IsString() @MaxLength(2048) logo?: string | null;
  @IsObject() details!: Record<string, string>;
  @IsString() @MaxLength(20000) instruction!: string;
  @IsBoolean() isEnabled!: boolean;
  @IsInt() @Min(0) @Max(100000) sortOrder!: number;
}
export class ReviewManualDto {
  @IsIn(['confirm', 'reject']) action!: 'confirm' | 'reject';
  @IsOptional() @IsString() @Length(3, 500) reason?: string;
  @IsInt() @Min(0) version!: number;
}
