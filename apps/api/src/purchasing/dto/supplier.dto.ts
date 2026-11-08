import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  contactName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(120)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  taxId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSupplierDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  contactName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(120)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  taxId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
