import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpensePaymentMethod, ExpenseStatus } from '../../generated/prisma/enums.js';

export class CreateExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  voucherNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpensePaymentMethod)
  @IsOptional()
  paymentMethod?: ExpensePaymentMethod;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  paidTo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  spentBy?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  receiptNumber?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;
}

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  voucherNo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpensePaymentMethod)
  @IsOptional()
  paymentMethod?: ExpensePaymentMethod;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  paidTo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  spentBy?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  receiptNumber?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;
}

export class ExpenseQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsEnum(ExpensePaymentMethod)
  @IsOptional()
  paymentMethod?: ExpensePaymentMethod;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
