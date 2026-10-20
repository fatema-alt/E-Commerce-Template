import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class GenerateVariantsDto {
  @IsString() @MinLength(1) @MaxLength(70) skuPrefix!: string;
}
export class BulkVariantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) price?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
