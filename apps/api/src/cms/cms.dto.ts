import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { CmsDocumentKind } from '../generated/prisma/client.js';
export class SaveCmsDraftDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsObject() content!: Record<string, unknown>;
}
export class PublishCmsDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version?: number;
}
export class ScheduleCmsDto extends PublishCmsDto {
  @IsISO8601() scheduledAt!: string;
}
export class RollbackCmsDto {
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsInt() @Min(1) @Max(2147483646) version!: number;
}
export class CmsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsEnum(CmsDocumentKind) kind?: CmsDocumentKind;
  @IsOptional() @IsString() @Matches(/^\d{1,20}$/) after = '0';
}
