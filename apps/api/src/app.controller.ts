import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'commerce-suite-api',
      timestamp: new Date().toISOString(),
    };
  }
}