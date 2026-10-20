import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service.js';

export type AdminRequest = Request & {
  admin?: { id: string; email: string; role: string };
};

export function getCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.cookie ?? '';
  const item = raw
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  return item?.slice(name.length + 1);
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { admin?: { id: string; email: string; role: string } }
      >();
    // Custom headers require CORS preflight and cannot be sent by cross-site forms.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      if (request.headers['x-commerce-admin'] !== '1')
        throw new ForbiddenException('Missing CSRF protection header');
      const origins = (process.env.ADMIN_ORIGINS ?? 'http://localhost:3001')
        .split(',')
        .map((value) => value.trim());
      if (
        request.headers['sec-fetch-site'] === 'cross-site' ||
        (request.headers.origin && !origins.includes(request.headers.origin))
      )
        throw new ForbiddenException('Origin not allowed');
    }
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const token = getCookie(request, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException();
    const admin = await this.auth.session(token);
    if (!admin) throw new UnauthorizedException();
    request.admin = admin;
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(admin.role)) throw new ForbiddenException();
    return true;
  }
}
