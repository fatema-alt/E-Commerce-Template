import { Trim } from './trim.js';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';
import { OrderMutationDto } from './order-operations.dto.js';

export class ChangeOrderStatusDto extends OrderMutationDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class AddOrderNoteDto extends OrderMutationDto {
  @Trim()
  @IsString()
  @Length(1, 2000)
  body!: string;
}
