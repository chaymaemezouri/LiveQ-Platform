import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthReport {
  status: 'ok';
  service: 'liveq-api';
  database: 'up';
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      service: 'liveq-api',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
