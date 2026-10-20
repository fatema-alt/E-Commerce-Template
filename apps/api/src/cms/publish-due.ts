import 'dotenv/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CmsService } from './cms.service.js';
@Module({ imports: [PrismaModule], providers: [CmsService] })
class CmsWorkerModule {}
const application = await NestFactory.createApplicationContext(
  CmsWorkerModule,
  { logger: false },
);
try {
  const result = await application.get(CmsService).publishDue();
  console.log(JSON.stringify(result));
  if (result.results.some((row) => row.status === 'FAILED'))
    process.exitCode = 1;
} finally {
  await application.close();
}
