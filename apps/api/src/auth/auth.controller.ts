import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from './auth.service.js';
import { getCookie } from './auth.guard.js';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(256) password!: string;
}
const cookieOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1',
  maxAge: SESSION_TTL_MS,
});
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login')
  @SetMetadata('public', true)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const result = await this.auth.login(dto.email, dto.password, req.ip);
    res.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return { user: result.user };
  }
  @Get('me')
  async me(@Req() req: Request) {
    const token = getCookie(req, SESSION_COOKIE);
    const user = token && (await this.auth.session(token));
    if (!user) throw new UnauthorizedException();
    return { user };
  }
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
    return { success: true };
  }
}
