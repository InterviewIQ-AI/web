import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow requests from the Vite dev server and any deployed frontend origin
  app.enableCors();

  // Global validation pipe:
  // - whitelist: strips properties not declared in DTOs (prevents extra-field injection)
  // - transform: auto-casts primitives (e.g. string '3' → number 3)
  // - forbidNonWhitelisted: throws 400 when extra fields are sent
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // lenient for now — no DTO classes yet
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Backend running on http://localhost:${port}`);
}
bootstrap();
