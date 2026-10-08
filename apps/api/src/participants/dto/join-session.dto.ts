import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { JOIN_CODE_PATTERN } from '../../sessions/join-code';

function normalizeCode(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function blankToNull(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class JoinSessionDto {
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @Matches(JOIN_CODE_PATTERN)
  code!: string;

  @IsOptional()
  @Transform(({ value }) => blankToNull(value))
  @IsString()
  @MaxLength(40)
  nickname?: string | null;
}
