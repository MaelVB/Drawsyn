import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(',') ?? true,
      credentials: true
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT ?? 3333;
  await app.listen(port);
  console.log(`🚀 Game server listening on port ${port}`);
}

bootstrap();
