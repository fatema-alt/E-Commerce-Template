import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from '../auth/auth.guard.js';
import { CmsAdminController } from './cms.controller.js';
import type { AuthService } from '../auth/auth.service.js';
import { validateCmsContent } from './cms-validation.js';

const base = { storeName: 'DS Mart', locale: 'en', currency: 'BDT' };
const item = {
  id: 'announcement-one',
  enabled: true,
  text: 'Shop smart',
  device: 'both',
};
const ribbon = {
  enabled: true,
  animation: 'fade',
  intervalSeconds: 6,
  items: [item],
};
const contact = {
  enabled: true,
  title: 'Store Support',
  description: 'Contact our team',
  position: 'right',
  desktop: true,
  mobile: true,
};
describe('Engagement CMS validation and roles', () => {
  it('preserves old Site Settings documents and validates new optional settings', () => {
    expect(validateCmsContent('SITE_SETTINGS', base)).toEqual(base);
    const content = {
      ...base,
      announcementRibbon: ribbon,
      contactWidget: {
        ...contact,
        phone: { enabled: true, number: '+8801712345678' },
      },
    };
    expect(validateCmsContent('SITE_SETTINGS', content)).toEqual(content);
  });
  it.each([
    { ...ribbon, intervalSeconds: 0 },
    { ...ribbon, backgroundColor: 'url(evil)' },
    { ...ribbon, animation: 'marquee' },
    { ...ribbon, items: [item, item] },
    { ...ribbon, items: [{ ...item, ctaLabel: 'Shop' }] },
    { ...ribbon, items: [{ ...item, ctaUrl: 'javascript:alert(1)' }] },
    { ...ribbon, items: [{ ...item, startsAt: 'not-a-date' }] },
    {
      ...ribbon,
      items: [
        {
          ...item,
          startsAt: '2026-10-30T00:00:00Z',
          endsAt: '2026-10-29T00:00:00Z',
        },
      ],
    },
  ])('rejects invalid ribbon configuration %j', (value) => {
    expect(() =>
      validateCmsContent('SITE_SETTINGS', {
        ...base,
        announcementRibbon: value,
      }),
    ).toThrow();
  });
  it.each([
    { ...contact, phone: { enabled: true } },
    { ...contact, phone: { enabled: true, number: '123;alert(1)' } },
    { ...contact, whatsapp: { enabled: true, number: 'javascript:foo' } },
    { ...contact, email: { enabled: true, address: 'not-an-email' } },
    { ...contact, email: { enabled: true, address: 'help@example.com?bcc=other@example.com' } },
    { ...contact, excludedRoutes: ['https://example.com'] },
    { ...contact, borderRadius: 999 },
  ])('rejects unsafe or incomplete channel configuration %j', (value) => {
    expect(() =>
      validateCmsContent('SITE_SETTINGS', { ...base, contactWidget: value }),
    ).toThrow();
  });
  it('allows disabled channels and valid UTC schedules', () => {
    expect(
      validateCmsContent('SITE_SETTINGS', {
        ...base,
        contactWidget: { ...contact, email: { enabled: false } },
        announcementRibbon: {
          ...ribbon,
          items: [
            {
              ...item,
              startsAt: '2026-10-27T00:00:00Z',
              endsAt: '2026-12-01T00:00:00Z',
            },
          ],
        },
      }),
    ).toBeTruthy();
  });
  it.each(['draft', 'publish'] as const)(
    'enforces existing CMS authorization on %s',
    async (action) => {
      const req = {
        method: action === 'draft' ? 'PATCH' : 'POST',
        headers: {
          cookie: 'commerce_admin_session=valid',
          'x-commerce-admin': '1',
        },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => CmsAdminController.prototype[action],
        getClass: () => CmsAdminController,
      } as unknown as ExecutionContext;
      const staff = new AdminGuard(new Reflector(), {
        session: async () => ({ id: 'staff', role: 'STAFF' }),
      } as unknown as AuthService);
      await expect(staff.canActivate(context)).rejects.toThrow();
      const admin = new AdminGuard(new Reflector(), {
        session: async () => ({ id: 'admin', role: 'ADMIN' }),
      } as unknown as AuthService);
      if (action === 'draft')
        await expect(admin.canActivate(context)).resolves.toBe(true);
      else await expect(admin.canActivate(context)).rejects.toThrow();
      const publisher = new AdminGuard(new Reflector(), {
        session: async () => ({ id: 'owner', role: 'SUPER_ADMIN' }),
      } as unknown as AuthService);
      await expect(publisher.canActivate(context)).resolves.toBe(true);
    },
  );
});
