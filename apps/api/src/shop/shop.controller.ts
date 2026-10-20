import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getCookie } from '../auth/auth.guard.js';
import { SHOP_COOKIE, ShopService } from './shop.service.js';
import {
  ChangeShopPasswordDto,
  LoginShopperDto,
  NewsletterPreferenceDto,
  QuoteDto,
  RegisterShopperDto,
  ShopCheckoutDto,
  SubscribeDto,
} from './shop.dto.js';
@Controller('shop')
@SetMetadata('public', true)
export class ShopController {
  constructor(private readonly shop: ShopService) {}
  @Get('newsletter') @Header('Cache-Control', 'no-store') newsletterStatus(
    @Req() req: Request,
  ) {
    return this.shop.newsletter(this.cookie(req));
  }
  @Post('newsletter/preferences') newsletterPreference(
    @Req() req: Request,
    @Body() dto: NewsletterPreferenceDto,
  ) {
    return this.shop.newsletter(this.cookie(req), dto.consent);
  }
  private cookie(req: Request) {
    return getCookie(req, SHOP_COOKIE);
  }
  private async issue(
    res: Response,
    customerId?: string,
    previousToken?: string,
  ) {
    const result = await this.shop.newSession(customerId, previousToken);
    res.cookie(SHOP_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 86400000,
    });
    return result;
  }
  @Get('me') @Header('Cache-Control', 'no-store') me(@Req() req: Request) {
    return this.shop.me(this.cookie(req));
  }
  @Get('payment-methods') payments() {
    return this.shop.payments();
  }
  @Post('register') async register(
    @Body() dto: RegisterShopperDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.shop.throttle('register-ip', req.ip || 'unknown', 30);
    const user = await this.shop.register(dto);
    await this.issue(res, user.id, this.cookie(req));
    return { user };
  }
  @Post('login') async login(
    @Body() dto: LoginShopperDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.shop.throttle('login-ip', req.ip || 'unknown', 100);
    await this.shop.throttle('login-email', dto.email.toLowerCase(), 10);
    const id = await this.shop.login(dto.email, dto.password);
    const { token } = await this.issue(res, id, this.cookie(req));
    return this.shop.me(token);
  }
  @Post('logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.shop.logout(this.cookie(req));
    res.clearCookie(SHOP_COOKIE, { path: '/' });
    return { ok: true };
  }
  @Post('password') password(
    @Req() req: Request,
    @Body() dto: ChangeShopPasswordDto,
  ) {
    return this.shop.changePassword(
      this.cookie(req),
      dto.currentPassword,
      dto.newPassword,
    );
  }
  @Post('quote') async quote(
    @Body() dto: QuoteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.shop.throttle('quote-ip', req.ip || 'unknown', 500);
    const session =
      (await this.shop.session(this.cookie(req))) ||
      (await this.issue(res)).session;
    return this.shop.quote(dto, session.id);
  }
  @Post('orders') async checkout(
    @Body() dto: ShopCheckoutDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: Request,
  ) {
    if (!key || !/^[a-zA-Z0-9-]{16,64}$/.test(key))
      throw new BadRequestException('A checkout idempotency key is required');
    await this.shop.throttle(
      'order-session',
      this.cookie(req) || req.ip || 'unknown',
      20,
      3600,
    );
    return this.shop.checkout(dto, this.cookie(req), key);
  }
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Req() req: Request,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    if (page < 1 || page > 100000)
      throw new BadRequestException('Invalid page');
    return this.shop.listOrders(this.cookie(req), page);
  }
  @Get('orders/:id') @Header('Cache-Control', 'no-store') order(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.shop.order(id, this.cookie(req));
  }
  @Post('newsletter') async newsletter(
    @Body() dto: SubscribeDto,
    @Req() req: Request,
  ) {
    await this.shop.throttle('newsletter-ip', req.ip || 'unknown', 100, 3600);
    await this.shop.throttle(
      'newsletter-email',
      dto.email.toLowerCase(),
      5,
      3600,
    );
    return this.shop.subscribe(dto.email);
  }
}
