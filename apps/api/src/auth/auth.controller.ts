import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from './auth.service.js';
import { getCookie, type AdminRequest } from './auth.guard.js';
import {
  ChangePasswordDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  UpdateProfileDto,
} from './dto/user-management.dto.js';
import { AdminRole } from '../generated/prisma/enums.js';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
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

  // ==========================================
  // Profile (Any Logged In Admin / Manager / Staff)
  // ==========================================

  @Get('profile')
  async getProfile(@Req() req: AdminRequest) {
    if (!req.admin?.id) throw new UnauthorizedException();
    return this.auth.getProfile(req.admin.id);
  }

  @Patch('profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() req: AdminRequest,
  ) {
    if (!req.admin?.id) throw new UnauthorizedException();
    return this.auth.updateProfile(req.admin.id, dto);
  }

  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AdminRequest,
  ) {
    if (!req.admin?.id) throw new UnauthorizedException();
    return this.auth.changePassword(req.admin.id, dto.oldPassword, dto.newPassword);
  }

  // ==========================================
  // Role-Based User Management (Admin / Super Admin Only)
  // ==========================================

  @Get('users')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  async listUsers(
    @Query('q') q?: string,
    @Query('role') role?: AdminRole,
    @Query('isActive') isActive?: string,
  ) {
    return this.auth.listUsers({
      q,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('users/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  async getUser(@Param('id') id: string) {
    return this.auth.getUser(id);
  }

  @Post('users')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  async createUser(
    @Body() dto: CreateAdminUserDto,
    @Req() req: AdminRequest,
  ) {
    return this.auth.createUser(req.admin!.role, dto);
  }

  @Patch('users/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @Req() req: AdminRequest,
  ) {
    return this.auth.updateUser(req.admin!.role, req.admin!.id, id, dto);
  }

  @Delete('users/:id')
  @SetMetadata('roles', ['SUPER_ADMIN'])
  async deleteUser(
    @Param('id') id: string,
    @Req() req: AdminRequest,
  ) {
    return this.auth.deleteUser(req.admin!.role, req.admin!.id, id);
  }
}
