import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CourierAdapters, courierName } from './courier-adapters.js';
import {
  TrackingService,
  sealCredentials,
  openCredentials,
} from './tracking.service.js';
import { trackingSnapshot, normalizeTrackingPhone } from './tracking.rules.js';
import {
  CourierSettingsController,
  TrackingController,
} from './tracking.controller.js';

const at = new Date('2026-11-04T10:00:00Z');
const credentials = { apiKey: 'api-secret', secretKey: 'second-secret' };
beforeEach(() =>
  vi.stubEnv(
    'STOREFRONT_CHECKOUT_SECRET',
    'tracking-test-secret-at-least-32-characters',
  ),
);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function fixture() {
  const shipment = {
    id: 'shipment',
    orderId: 'order',
    provider: 'Steadfast',
    trackingNumber: 'TRACK-1',
    providerBookingId: null,
    status: 'IN_TRANSIT',
    courierStatus: 'pending',
    trackingCheckedAt: null,
  };
  const db: any = {
    order: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'order', customerPhone: '+8801712345678' }),
      findUnique: vi
        .fn()
        .mockResolvedValue({
          orderNumber: 'ORD-1',
          status: 'SHIPPED',
          paymentStatus: 'UNPAID',
          createdAt: at,
          updatedAt: at,
          events: [],
          shipments: [],
        }),
    },
    orderShipment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(shipment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    courierConfig: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          provider: 'STEADFAST',
          isEnabled: true,
          isSandbox: false,
          credentials: sealCredentials(credentials),
        }),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    orderEvent: { create: vi.fn() },
    storefrontThrottle: { upsert: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  db.$transaction = vi.fn((work) => work(db));
  return { service: new TrackingService(db), db, shipment };
}

describe('Tracking privacy and access', () => {
  it.each(['01712345678', '+8801712345678', '০১৭১২৩৪৫৬৭৮', '01712-345678'])(
    'normalizes %s',
    (phone) => expect(normalizeTrackingPhone(phone)).toBe('01712345678'),
  );
  it('requires both order number and matching checkout phone', async () => {
    const { service, db } = fixture();
    await expect(service.lookup('ORD-1', '01812345678')).rejects.toThrow(
      'No order matched',
    );
    expect(db.order.findUnique).not.toHaveBeenCalled();
    const result = await service.lookup('ORD-1', '01712345678');
    expect(result.trackingToken).toMatch(/^[\w-]+\.[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('01712345678');
    expect((await service.byToken(result.trackingToken)).orderNumber).toBe(
      'ORD-1',
    );
    const [payload] = result.trackingToken.split('.');
    await expect(
      service.byToken(`${payload}.${'0'.repeat(64)}`),
    ).rejects.toThrow('Invalid tracking');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400001);
    await expect(service.byToken(result.trackingToken)).rejects.toThrow(
      'expired',
    );
  });
  it('does not expose private audit fields or admin notes', () => {
    const result = trackingSnapshot({
      orderNumber: 'ORD-1',
      status: 'PROCESSING',
      paymentStatus: 'UNPAID',
      createdAt: at,
      updatedAt: at,
      shipments: [
        {
          id: 'shipment',
          trackingError: 'internal credential error',
          provider: 'Steadfast',
        },
      ],
      events: [
        {
          id: 'note',
          action: 'ADMIN_NOTE_ADDED',
          after: { body: 'private note' },
          createdAt: at,
        },
        {
          id: 'status',
          action: 'ORDER_STATUS_CHANGED',
          after: { status: 'PROCESSING', reason: 'private reason' },
          createdAt: at,
        },
      ],
    } as never);
    expect(result.timeline.map((event) => event.status)).toEqual([
      'PENDING',
      'PROCESSING',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private note|private reason|internal credential/,
    );
    expect(result.shipments[0].refreshDelayed).toBe(true);
  });
  it('throttles lookup requests and restricts courier settings to super admins', async () => {
    const { service, db } = fixture();
    db.storefrontThrottle.upsert.mockResolvedValue({ count: 11 });
    await expect(service.throttle('test')).rejects.toThrow('Too many');
    expect(Reflect.getMetadata('roles', CourierSettingsController)).toEqual([
      'SUPER_ADMIN',
    ]);
    expect(Reflect.getMetadata('public', TrackingController)).toBe(true);
  });
});

describe('Courier credential storage and refresh', () => {
  it('encrypts secrets, detects tampering and preserves blank saved credentials', async () => {
    const sealed = sealCredentials(credentials);
    expect(sealed).not.toContain('api-secret');
    expect(openCredentials(sealed)).toEqual(credentials);
    expect(() => openCredentials(sealed.slice(0, -4) + 'AAAA')).toThrow();
    const { service, db } = fixture();
    await service.saveSettings('STEADFAST', {
      isEnabled: true,
      isSandbox: false,
      credentials: { apiKey: '', secretKey: '' },
    });
    const data = db.courierConfig.upsert.mock.calls[0][0].update;
    expect(openCredentials(data.credentials)).toEqual(credentials);
    expect(courierName('Red-X')).toBe('REDX');
    expect(courierName('toString')).toBeNull();
  });
  it('rejects enabled configurations with incomplete credentials', async () => {
    const { service, db } = fixture();
    db.courierConfig.findUnique.mockResolvedValue(null);
    await expect(
      service.saveSettings('PATHAO', {
        isEnabled: true,
        isSandbox: true,
        credentials: {},
      }),
    ).rejects.toThrow('Complete all');
    expect(db.courierConfig.upsert).not.toHaveBeenCalled();
  });
  it('persists changed courier status and an audit event without changing order payments or stock', async () => {
    const { service, db } = fixture();
    vi.spyOn(CourierAdapters.prototype, 'track').mockResolvedValue('delivered');
    await service.syncShipment('shipment');
    expect(db.orderShipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courierStatus: 'delivered',
          trackingError: null,
        }),
      }),
    );
    expect(db.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'COURIER_TRACKING_UPDATED' }),
    });
  });
  it('keeps the last good status on API failure and skips a refresh already claimed by another instance', async () => {
    const { service, db } = fixture();
    const track = vi
      .spyOn(CourierAdapters.prototype, 'track')
      .mockRejectedValue(new Error('provider secret error'));
    await service.syncShipment('shipment');
    expect(db.orderShipment.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { trackingError: 'Courier refresh delayed' },
      }),
    );
    expect(db.orderEvent.create).not.toHaveBeenCalled();
    track.mockClear();
    db.orderShipment.updateMany.mockResolvedValue({ count: 0 });
    await service.syncShipment('shipment');
    expect(track).not.toHaveBeenCalled();
  });
});

describe('Courier API adapters', () => {
  it('authenticates Steadfast and encodes tracking codes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 200, delivery_status: 'pending' }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await new CourierAdapters().track(
        'STEADFAST',
        credentials,
        false,
        'TRACK/1',
      ),
    ).toBe('pending');
    expect(fetchMock.mock.calls[0][0]).toContain(
      'status_by_trackingcode/TRACK%2F1',
    );
    expect(fetchMock.mock.calls[0][1].headers['Secret-Key']).toBe(
      'second-secret',
    );
  });
  it('uses the RedX sandbox and rejects malformed status responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ parcel: { status: 'pickup-pending' } })),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await new CourierAdapters().track(
        'REDX',
        { accessToken: 'token' },
        true,
        'R1',
      ),
    ).toBe('pickup-pending');
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://sandbox.redx.com.bd/',
    );
    fetchMock.mockResolvedValue(new Response('{}'));
    await expect(
      new CourierAdapters().track(
        'REDX',
        { accessToken: 'token' },
        false,
        'R1',
      ),
    ).rejects.toThrow('status missing');
  });
  it('refreshes Pathao OAuth after 401 and reuses the new token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'old', expires_in: 3600 })),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 })),
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { order_status: 'Delivered' } })),
      );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new CourierAdapters();
    const config = {
      clientId: 'id',
      clientSecret: 'secret',
      username: 'user',
      password: 'password',
    };
    expect(await adapter.track('PATHAO', config, false, 'P1')).toBe(
      'Delivered',
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { order_status: 'Delivered' } })),
    );
    expect(await adapter.track('PATHAO', config, false, 'P2')).toBe(
      'Delivered',
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
