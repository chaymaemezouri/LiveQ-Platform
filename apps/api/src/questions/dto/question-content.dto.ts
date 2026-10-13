import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class QuestionOptionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;
}

export class QuestionContentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsIn(['CHOICE', 'TEXT'])
  kind?: 'CHOICE' | 'TEXT';

  @ValidateIf((dto: QuestionContentDto) => dto.kind !== 'TEXT')
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ValidateIf((dto: QuestionContentDto) => dto.kind !== 'TEXT')
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  correctOptionIndex?: number | null;
}
