import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionOptionDto } from './question-content.dto';

export class ImportQuestionItemDto {
  @IsInt()
  @Min(2)
  row!: number;

  @IsString()
  @MaxLength(4000)
  prompt!: string;

  @IsIn(['CHOICE', 'TEXT'])
  kind!: 'CHOICE' | 'TEXT';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  correctOptionIndex?: number | null;
}

export class ImportQuestionsDto {
  @IsUUID()
  requestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportQuestionItemDto)
  questions!: ImportQuestionItemDto[];
}
