import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CourierAdapters,
  courierFields,
  courierName,
  type Courier,
  type Credentials,
} from './courier-adapters.js';
import {
  normalizeTrackingPhone,
  trackingSelect,
  trackingSnapshot,
} from './tracking.rules.js';

const devSecret = randomBytes(32).toString('hex');
const secret = () => {
  const value = process.env.STOREFRONT_CHECKOUT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!value || value.length < 32))
    throw new Error(
      'STOREFRONT_CHECKOUT_SECRET must have at least 32 characters',
    );
  return value || devSecret;
};
function encryptionKey() {
  const value =
    process.env.COURIER_CREDENTIALS_KEY ||
    process.env.STOREFRONT_CHECKOUT_SECRET;
  if (!value || value.length < 32)
    throw new BadRequestException(
      'Configure a server COURIER_CREDENTIALS_KEY of at least 32 characters before saving courier credentials',
    );
  return createHash('sha256').update(value).digest();
}
export function sealCredentials(credentials: Credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}
export function openCredentials(value: string | null): Credentials {
  if (!value) return {};
  const [iv, tag, encrypted] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    ),
  ) as Credentials;
}

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private readonly adapters = new CourierAdapters();
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    if (process.env.COURIER_TRACKING_POLLING === 'false') return;
    this.timer = setInterval(() => {
      void this.syncBatch();
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async throttle(identity: string, max = 10, seconds = 60) {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const key = createHash('sha256')
      .update(`tracking:${identity}:${bucket}`)
      .digest('hex');
    const row = await this.db.storefrontThrottle.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        expiresAt: new Date((bucket + 1) * seconds * 1000),
      },
      update: { count: { increment: 1 } },
    });
    if (row.count > max)
      throw new HttpException(
        'Too many tracking requests. Please try again shortly.',
        429,
      );
  }

  async settings() {
    const rows = await this.db.courierConfig.findMany();
    return Object.entries(courierFields).map(([provider, fields]) => {
      const row = rows.find((item) => item.provider === provider);
      let saved: Credentials = {};
      try {
        saved = openCredentials(row?.credentials || null);
      } catch {
        /* Keep the form available for replacing an old encryption key. */
      }
      return {
        provider,
        isEnabled: row?.isEnabled ?? false,
        isSandbox: row?.isSandbox ?? provider !== 'STEADFAST',
        fields: Object.fromEntries(
          fields.map((field) => [field, Boolean(saved[field])]),
        ),
      };
    });
  }

  async saveSettings(
    provider: Courier,
    input: { isEnabled: boolean; isSandbox: boolean; credentials: Credentials },
    actorId?: string,
  ) {
    if (!Object.hasOwn(courierFields, provider))
      throw new BadRequestException('Unknown courier');
    if (provider === 'STEADFAST' && input.isSandbox)
      throw new BadRequestException(
        'Steadfast tracking uses the live merchant API',
      );
    const existing = await this.db.courierConfig.findUnique({
      where: { provider },
    });
    let credentials: Credentials;
    try {
      credentials = openCredentials(existing?.credentials || null);
    } catch {
      if (
        !courierFields[provider].every((field) =>
          input.credentials?.[field]?.trim(),
        )
      )
        throw new BadRequestException(
          'Re-enter all courier credentials after changing the server encryption key',
        );
      credentials = {};
    }
    for (const [field, value] of Object.entries(input.credentials || {})) {
      if (
        !(courierFields[provider] as readonly string[]).includes(field) ||
        typeof value !== 'string' ||
        value.length > 2000
      )
        throw new BadRequestException('Invalid courier credential field');
      if (value.trim()) credentials[field] = value.trim();
    }
    if (
      input.isEnabled &&
      !courierFields[provider].every((field) => credentials[field])
    )
      throw new BadRequestException(
        'Complete all courier credentials before enabling live tracking',
      );
    await this.db.courierConfig.upsert({
      where: { provider },
      create: {
        provider,
        ...input,
        credentials: sealCredentials(credentials),
        updatedBy: actorId,
      },
      update: {
        isEnabled: input.isEnabled,
        isSandbox: input.isSandbox,
        credentials: sealCredentials(credentials),
        updatedBy: actorId,
      },
    });
    return (await this.settings()).find((row) => row.provider === provider);
  }

  async lookup(reference: string, phone: string) {
    const normalized = normalizeTrackingPhone(phone);
    if (!/^01[3-9]\d{8}$/.test(normalized))
      throw new NotFoundException('No order matched those tracking details');
    const order = await this.db.order.findFirst({
      where: { orderNumber: { equals: reference.trim(), mode: 'insensitive' } },
      select: { id: true, customerPhone: true },
    });
    const expected = createHash('sha256')
      .update(normalizeTrackingPhone(order?.customerPhone || ''))
      .digest();
    const actual = createHash('sha256').update(normalized).digest();
    if (!order || !timingSafeEqual(expected, actual))
      throw new NotFoundException('No order matched those tracking details');
    const payload = Buffer.from(
      JSON.stringify({ id: order.id, expires: Date.now() + 86400000 }),
    ).toString('base64url');
    const trackingToken = `${payload}.${createHmac('sha256', secret()).update(payload).digest('hex')}`;
    return { trackingToken, tracking: await this.snapshot(order.id) };
  }

  async testCourier(provider: Courier, trackingNumber: string) {
    const row = await this.db.courierConfig.findUnique({ where: { provider } });
    if (!row?.credentials)
      throw new BadRequestException('Save courier credentials before testing');
    try {
      const status = await this.adapters.track(
        provider,
        openCredentials(row.credentials),
        row.isSandbox,
        trackingNumber,
      );
      return { status, checkedAt: new Date().toISOString() };
    } catch {
      throw new BadRequestException(
        'The courier lookup failed. Check your credentials, environment and tracking number.',
      );
    }
  }

  async byToken(token: string) {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !/^[a-f0-9]{64}$/.test(signature || '') || extra)
      throw new UnauthorizedException(
        'Tracking access expired. Enter your order details again.',
      );
    const expected = createHmac('sha256', secret()).update(payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException('Invalid tracking access');
    let data: { id?: string; expires?: number };
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid tracking access');
    }
    if (
      typeof data.id !== 'string' ||
      typeof data.expires !== 'number' ||
      data.expires <= Date.now()
    )
      throw new UnauthorizedException(
        'Tracking access expired. Enter your order details again.',
      );
    return this.snapshot(data.id);
  }

  async snapshot(id: string) {
    await this.syncOrder(id);
    const order = await this.db.order.findUnique({
      where: { id },
      select: trackingSelect,
    });
    if (!order) throw new NotFoundException('Order not found');
    return trackingSnapshot(order);
  }

  async syncOrder(orderId: string) {
    const shipments = await this.db.orderShipment.findMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    await Promise.allSettled(
      shipments.map((shipment) => this.syncShipment(shipment.id)),
    );
  }

  async syncShipment(id: string) {
    const shipment = await this.db.orderShipment.findUnique({ where: { id } });
    if (
      !shipment ||
      !shipment.trackingNumber ||
      shipment.status === 'CANCELLED'
    )
      return;
    const provider = courierName(shipment.provider);
    if (!provider) return;
    const settings = await this.db.courierConfig.findUnique({
      where: { provider },
    });
    if (!settings?.isEnabled) return;
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60000);
    const claimed = await this.db.orderShipment.updateMany({
      where: {
        id,
        OR: [
          { trackingCheckedAt: null },
          { trackingCheckedAt: { lt: cutoff } },
        ],
      },
      data: { trackingCheckedAt: now },
    });
    if (!claimed.count) return;
    try {
      const status = await this.adapters.track(
        provider,
        openCredentials(settings.credentials),
        settings.isSandbox,
        shipment.trackingNumber,
        shipment.providerBookingId,
      );
      await this.db.$transaction(async (tx) => {
        const updated = await tx.orderShipment.updateMany({
          where: {
            id,
            trackingCheckedAt: now,
            trackingNumber: shipment.trackingNumber,
          },
          data: {
            courierStatus: status,
            trackingError: null,
            ...(shipment.courierStatus !== status
              ? { courierUpdatedAt: now }
              : {}),
          },
        });
        if (updated.count && shipment.courierStatus !== status)
          await tx.orderEvent.create({
            data: {
              orderId: shipment.orderId,
              action: 'COURIER_TRACKING_UPDATED',
              actorType: 'COURIER',
              actorId: provider,
              after: { shipmentId: id, provider, status },
            },
          });
      });
    } catch {
      await this.db.orderShipment.updateMany({
        where: { id, trackingCheckedAt: now },
        data: { trackingError: 'Courier refresh delayed' },
      });
    }
  }

  async syncBatch() {
    if (this.running) return;
    this.running = true;
    try {
      const enabled = await this.db.courierConfig.findMany({
        where: { isEnabled: true },
        select: { provider: true },
      });
      if (!enabled.length) return;
      const shipments = await this.db.orderShipment.findMany({
        where: {
          order: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
          status: { not: 'CANCELLED' },
          trackingNumber: { not: null },
          OR: enabled.map((row) => ({
            provider: { equals: row.provider, mode: 'insensitive' as const },
          })),
        },
        take: 40,
        orderBy: { trackingCheckedAt: { sort: 'asc', nulls: 'first' } },
        select: { id: true },
      });
      for (let i = 0; i < shipments.length; i += 4)
        await Promise.allSettled(
          shipments
            .slice(i, i + 4)
            .map((shipment) => this.syncShipment(shipment.id)),
        );
    } catch {
      this.logger.warn(
        'Courier tracking refresh is unavailable; previous tracking updates are retained',
      );
    } finally {
      this.running = false;
    }
  }
}
