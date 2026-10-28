import { BadRequestException } from '@nestjs/common';
export const RESERVED_PAGE_ROUTES = new Set([
  'api',
  'account',
  'cart',
  'checkout',
  'shop',
  'search',
  'category',
  'categories',
  'product',
  'products',
  'orders',
  'wishlist',
  'contact',
  'help',
  'cms',
  'admin',
  'login',
  'robots',
  'sitemap',
  'icon',
  'favicon',
  '_next',
  '_not-found',
]);
export function validNewPageAddress(value: string) {
  return (
    /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value) && !RESERVED_PAGE_ROUTES.has(value)
  );
}
export function assertNewPageAddress(value: string) {
  if (!validNewPageAddress(value))
    throw new BadRequestException(
      'Choose a URL with 1?64 lowercase letters, numbers, hyphens or underscores that does not use a reserved store route.',
    );
}
