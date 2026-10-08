import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  function createService(queryRaw: ReturnType<typeof vi.fn>): HealthService {
    return new HealthService({ $queryRaw: queryRaw } as unknown as PrismaService);
  }

  it('reports the database as up when the probe query succeeds', async () => {
    const service = createService(vi.fn().mockResolvedValue([{ '?column?': 1 }]));

    const report = await service.check();

    expect(report).toMatchObject({
      status: 'ok',
      service: 'liveq-api',
      database: 'up',
    });
    expect(report.timestamp).toEqual(expect.any(String));
  });

  it('returns a service-unavailable error when the database probe fails', async () => {
    const service = createService(
      vi.fn().mockRejectedValue(new Error('connection refused')),
    );

    await expect(service.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
