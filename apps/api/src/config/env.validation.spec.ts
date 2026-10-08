import { validateEnv } from './env.validation';

const validConfig = {
  NODE_ENV: 'test',
  API_PORT: '3000',
  DATABASE_URL: 'postgresql://liveq:liveq@localhost:5432/liveq?schema=public',
  WEB_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'test-only-jwt-secret-at-least-32-characters',
};

describe('validateEnv', () => {
  it('returns typed configuration for a complete environment', () => {
    const result = validateEnv(validConfig);

    expect(result.NODE_ENV).toBe('test');
    expect(result.API_PORT).toBe(3000);
    expect(result.DATABASE_URL).toContain('postgresql://');
    expect(result.WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('applies local defaults when optional values are omitted', () => {
    const result = validateEnv({
      DATABASE_URL: validConfig.DATABASE_URL,
      JWT_SECRET: validConfig.JWT_SECRET,
    });

    expect(result.NODE_ENV).toBe('development');
    expect(result.API_PORT).toBe(3002);
    expect(result.WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('rejects a missing database url', () => {
    expect(() =>
      validateEnv({
        JWT_SECRET: validConfig.JWT_SECRET,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: validConfig.DATABASE_URL,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_SECRET/);
  });
});
