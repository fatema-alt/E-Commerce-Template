import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from './password.js';

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
    return { token, user: { id: user.id, email: user.email, role: user.role } };
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
      role: session.user.role,
    };
  }
  async logout(token: string) {
    await this.prisma.adminSession.updateMany({
      where: { tokenHash: tokenDigest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
