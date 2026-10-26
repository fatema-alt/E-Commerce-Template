import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewStatus, QuestionStatus } from '../generated/prisma/client.js';

export class CreateReviewDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  content!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  authorName!: string;

  @IsEmail()
  authorEmail!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class CreateQuestionDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  question!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  authorName!: string;

  @IsEmail()
  authorEmail!: string;
}

export class UpdateReviewStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

export class ReplyReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  reply!: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  answer!: string;
}

export class UpdateQuestionStatusDto {
  @IsEnum(QuestionStatus)
  status!: QuestionStatus;
}

export class QueryReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  q?: string;
}

export class QueryQuestionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
