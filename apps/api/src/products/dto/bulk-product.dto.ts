import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class BulkProductDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];
  @IsIn(['ACTIVATE', 'DRAFT', 'ARCHIVE', 'CATEGORY', 'PRICE', 'DELETE'])
  action!: 'ACTIVATE' | 'DRAFT' | 'ARCHIVE' | 'CATEGORY' | 'PRICE' | 'DELETE';
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) price?: string;
}
