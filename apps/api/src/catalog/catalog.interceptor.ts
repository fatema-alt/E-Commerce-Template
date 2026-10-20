import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import type { AdminRequest } from '../auth/auth.guard.js';

@Injectable()
export class CatalogResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.admin?.role !== 'STAFF') return next.handle();
    return next
      .handle()
      .pipe(
        map((value) =>
          JSON.parse(
            JSON.stringify(value, (key, item: unknown) =>
              ['costPrice', 'internalNotes', 'inventoryValuation'].includes(key)
                ? undefined
                : item,
            ),
          ),
        ),
      );
  }
}
