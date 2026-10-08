import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  questionIds!: string[];
}
