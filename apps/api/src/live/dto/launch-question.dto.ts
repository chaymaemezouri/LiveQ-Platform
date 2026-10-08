import { IsUUID } from 'class-validator';

export class LaunchQuestionDto {
  @IsUUID()
  questionId!: string;
}
