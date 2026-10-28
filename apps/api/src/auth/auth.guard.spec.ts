import { Reflector } from '@nestjs/core';
import { AdminGuard } from './auth.guard.js';
import type { AuthService } from './auth.service.js';
import type { ExecutionContext } from '@nestjs/common';

describe('AdminGuard', () => {
  const request = (method: string, headers: object) => {
    const req = { method, headers };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };
  it('requires the CSRF header even on public login', async () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new AdminGuard(reflector, {} as AuthService);
    await expect(guard.canActivate(request('POST', {}))).rejects.toThrow(
      'CSRF',
    );
    await expect(
      guard.canActivate(request('POST', { 'x-commerce-admin': '1' })),
    ).resolves.toBe(true);
  });
  it('returns 401 without a session and 403 for staff mutation', async () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === 'roles' ? ['SUPER_ADMIN', 'ADMIN'] : false,
    } as unknown as Reflector;
    const auth = {
      session: async () => ({ id: 'staff', role: 'STAFF' }),
    } as unknown as AuthService;
    const guard = new AdminGuard(reflector, auth);
    await expect(guard.canActivate(request('GET', {}))).rejects.toThrow();
    await expect(
      guard.canActivate(
        request('POST', {
          cookie: 'commerce_admin_session=valid',
          'x-commerce-admin': '1',
        }),
      ),
    ).rejects.toThrow();
  });
  it('rejects an ADMIN request with 403 Forbidden when an endpoint requires SUPER_ADMIN (publish)', async () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === 'roles' ? ['SUPER_ADMIN'] : false,
    } as unknown as Reflector;
    const auth = {
      session: async () => ({ id: 'admin-user-1', role: 'ADMIN' }),
    } as unknown as AuthService;
    const guard = new AdminGuard(reflector, auth);
    await expect(
      guard.canActivate(
        request('POST', {
          cookie: 'commerce_admin_session=valid_token',
          'x-commerce-admin': '1',
        }),
      ),
    ).rejects.toThrow();
  });
  it('allows SUPER_ADMIN to activate endpoints requiring SUPER_ADMIN (publish)', async () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === 'roles' ? ['SUPER_ADMIN'] : false,
    } as unknown as Reflector;
    const auth = {
      session: async () => ({ id: 'super-admin-1', role: 'SUPER_ADMIN' }),
    } as unknown as AuthService;
    const guard = new AdminGuard(reflector, auth);
    await expect(
      guard.canActivate(
        request('POST', {
          cookie: 'commerce_admin_session=valid_token',
          'x-commerce-admin': '1',
        }),
      ),
    ).resolves.toBe(true);
  });
});
