import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  API_PORT = 3002;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  WEB_ORIGIN = 'http://localhost:5173';

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    {
      NODE_ENV: 'development',
      API_PORT: 3002,
      WEB_ORIGIN: 'http://localhost:5173',
      ...config,
    },
    {
      enableImplicitConversion: true,
    },
  );
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
    throw new Error(`Invalid environment: ${messages}`);
  }

  return validated;
}
