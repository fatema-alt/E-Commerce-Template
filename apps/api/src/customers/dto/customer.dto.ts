import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerStatus } from '../../generated/prisma/client.js';
export class CreateCustomerDto {
 @IsString() @Length(1, 100) firstName!: string;
 @IsOptional() @IsString() @Length(1, 100) lastName?: string;
 @IsOptional() @IsEmail() email?: string;
 @IsOptional() @IsString() @Length(5, 32) phone?: string;
}
export class UpdateCustomerDto {
 @IsOptional() @IsString() @Length(1, 100) firstName?: string;
 @IsOptional() @IsString() @Length(1, 100) lastName?: string;
 @IsOptional() @IsEmail() email?: string;
 @IsOptional() @IsString() @Length(5, 32) phone?: string;
 @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
}
export class ListCustomersDto {
 @IsOptional() @IsString() @Length(1, 100) search?: string;
 @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
 @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
 @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
export class AddCustomerNoteDto { @IsString() @Length(1, 2000) body!: string; }
export class CreateAddressDto {
 @IsString() @Length(1, 100) recipientName!: string;
 @IsOptional() @IsString() @Length(5, 32) phone?: string;
 @IsOptional() @IsString() @Length(1, 50) label?: string;
 @IsString() @Length(1, 200) line1!: string;
 @IsOptional() @IsString() @Length(1, 200) line2?: string;
 @IsString() @Length(1, 100) city!: string;
 @IsOptional() @IsString() @Length(1, 100) region?: string;
 @IsOptional() @IsString() @Length(1, 20) postalCode?: string;
 @IsString() @Length(2, 2) countryCode: string = 'BD';
}
