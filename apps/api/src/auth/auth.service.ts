import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  CreateAdminUserDto,
  UpdateAdminUserDto,
  UpdateProfileDto,
} from './dto/user-management.dto.js';
import { AdminRole, Prisma } from '../generated/prisma/client.js';

export const SESSION_COOKIE = 'commerce_admin_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const tokenDigest = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string, address = 'unknown') {
    const key = tokenDigest(address);
    // Use the shared event store and a per-address lock so limits survive
    // restarts and apply across API replicas. Never record passwords or raw IPs.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const [bucket] = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*) AS count FROM catalog_audit_logs WHERE entity = 'authAttempt' AND "entityId" = ${key} AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`;
      if (Number(bucket.count) >= 10)
        throw new HttpException(
          'Too many login attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await tx.catalogAuditLog.create({
        data: {
          entity: 'authAttempt',
          entityId: key,
          action: 'LOGIN_ATTEMPT',
          changes: {},
        },
      });
    });

    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (
      !user ||
      !user.isActive ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      if (!user || !user.isActive)
        await verifyPassword(
          password,
          'scrypt:00000000000000000000000000000000:' + '00'.repeat(64),
        );
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.adminSession.create({
      data: {
        tokenHash: tokenDigest(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async session(token: string) {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    )
      return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      phone: session.user.phone,
      role: session.user.role,
    };
  }

  async logout(token: string) {
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: tokenDigest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ==========================================
  // Profile Management (For current logged-in user)
  // ==========================================

  async getProfile(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const isValid = await verifyPassword(oldPass, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password does not match.');
    }

    if (newPass.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters long.',
      );
    }

    const newHash = await hashPassword(newPass);

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  // ==========================================
  // Team / Role-based User Management
  // ==========================================

  async listUsers(params?: { q?: string; role?: AdminRole; isActive?: boolean }) {
    const where: Prisma.AdminUserWhereInput = {};

    if (params?.role) {
      where.role = params.role;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.q?.trim()) {
      const query = params.q.trim();
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.adminUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    return users;
  }

  async getUser(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async createUser(callerRole: string, dto: CreateAdminUserDto) {
    // Only SUPER_ADMIN can create another SUPER_ADMIN
    if (dto.role === AdminRole.SUPER_ADMIN && callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only Super Admins can assign the Super Admin role.',
      );
    }

    const existing = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const passwordHash = await hashPassword(dto.password);

    return this.prisma.adminUser.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        name: dto.name?.trim() || null,
        phone: dto.phone?.trim() || null,
        role: dto.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(
    callerRole: string,
    callerId: string,
    targetId: string,
    dto: UpdateAdminUserDto,
  ) {
    const target = await this.prisma.adminUser.findUnique({
      where: { id: targetId },
    });

    if (!target) throw new NotFoundException('User not found');

    // Protect against non-superadmin modifying superadmin
    if (
      target.role === AdminRole.SUPER_ADMIN &&
      callerRole !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Only Super Admins can modify Super Admin accounts.',
      );
    }

    // Protect against promoting someone to SUPER_ADMIN without being one
    if (
      dto.role === AdminRole.SUPER_ADMIN &&
      callerRole !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Only Super Admins can assign the Super Admin role.',
      );
    }

    // Prevent deactivating or demoting the last active Super Admin
    if (
      target.role === AdminRole.SUPER_ADMIN &&
      (dto.isActive === false || (dto.role && dto.role !== AdminRole.SUPER_ADMIN))
    ) {
      const superAdminCount = await this.prisma.adminUser.count({
        where: { role: AdminRole.SUPER_ADMIN, isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot deactivate or demote the last active Super Admin.',
        );
      }
    }

    const data: Prisma.AdminUserUpdateInput = {
      name: dto.name !== undefined ? dto.name.trim() || null : undefined,
      phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
      role: dto.role,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.passwordHash = await hashPassword(dto.password);
      // Revoke existing sessions when password changes
      await this.prisma.adminSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (dto.isActive === false) {
      // Revoke all sessions if user deactivated
      await this.prisma.adminSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return this.prisma.adminUser.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(callerRole: string, callerId: string, targetId: string) {
    if (callerId === targetId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.adminUser.findUnique({
      where: { id: targetId },
    });

    if (!target) throw new NotFoundException('User not found');

    if (target.role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin accounts cannot be deleted.');
    }

    if (callerRole !== 'SUPER_ADMIN' && target.role === AdminRole.ADMIN) {
      throw new ForbiddenException(
        'Only Super Admins can delete Admin accounts.',
      );
    }

    return this.prisma.adminUser.delete({
      where: { id: targetId },
    });
  }
}
