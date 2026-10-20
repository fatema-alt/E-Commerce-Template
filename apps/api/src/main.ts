import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mediaRoot } from './media/media-storage.service.js';

async function bootstrap() {
 const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const origins = (process.env.ADMIN_ORIGINS ?? 'http://localhost:3001').split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  // Origin validation for browser-based cookie-authenticated writes (CSRF defense).
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) return next(new BadRequestException('Origin not allowed'));
      // Reject cross-site browser requests, including those without Origin.
      if (req.headers['sec-fetch-site'] === 'cross-site') return next(new BadRequestException('Cross-site request blocked'));
    }
    next();
  });
  app.use('/uploads', express.static(mediaRoot(), { dotfiles: 'deny', index: false, setHeaders: res => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'none'"); } }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Commerce API running on port ${port}`);
}
void bootstrap();
