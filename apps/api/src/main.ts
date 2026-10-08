import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const socketAdapter = new IoAdapter(app);
  const createSocketServer = socketAdapter.createIOServer.bind(socketAdapter);
  const origin = config.getOrThrow<string>('WEB_ORIGIN');
  socketAdapter.createIOServer = (port, options) =>
    createSocketServer(
      port,
      Object.assign({}, options, {
        cors: { origin, credentials: true },
      }) as never,
    );
  app.useWebSocketAdapter(socketAdapter);

  const port = config.getOrThrow<number>('API_PORT');
  await app.listen(port);
  Logger.log(`LiveQ API listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error('LiveQ API failed to start', error, 'Bootstrap');
  process.exit(1);
});
