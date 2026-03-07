import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: [
      "http://localhost:3000", // CRM local
      "http://localhost:3001", // Profiles store local (old)
      "http://localhost:3003", // Profiles store local (new)
      "https://crm.pashkovsky-group.com",
      "https://profiles.pashkovsky-group.com",
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3002;
  await app.listen(port);

}

bootstrap();
