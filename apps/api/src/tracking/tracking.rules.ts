import type { Prisma } from '../generated/prisma/client.js';

export const trackingSelect = {
  orderNumber: true,
  status: true,
  paymentStatus: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  shipments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      provider: true,
      trackingNumber: true,
      status: true,
      bookedAt: true,
      shippedAt: true,
      deliveredAt: true,
      courierStatus: true,
      courierUpdatedAt: true,
      trackingCheckedAt: true,
      trackingError: true,
    },
  },
  events: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, after: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

type TrackingOrder = Prisma.OrderGetPayload<{ select: typeof trackingSelect }>;
const labels: Record<string, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Preparing your order',
  SHIPPED: 'Handed to courier',
  DELIVERED: 'Delivered',
  CANCELLED: 'Order cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURN_APPROVED: 'Return approved',
  RETURNED: 'Return received',
  MANUAL_BOOKED: 'Shipment booked',
  IN_TRANSIT: 'Shipment in transit',
  FAILED: 'Delivery attempt unsuccessful',
  PARTIAL_RETURN_RECEIVED: 'Partial return received',
};
export function normalizeTrackingPhone(value: string) {
  return value
    .replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
    .replace(/[\s()+-]/g, '')
    .replace(/^8801/, '01');
}

/** Never serialize admin notes, actor IDs, private reasons or raw courier payloads. */
export function trackingSnapshot(order: TrackingOrder) {
  const timeline: { id: string; label: string; status: string; at: Date }[] = [
    {
      id: 'placed',
      label: labels.PENDING,
      status: 'PENDING',
      at: order.createdAt,
    },
  ];
  for (const event of order.events || []) {
    const after =
      event.after &&
      typeof event.after === 'object' &&
      !Array.isArray(event.after)
        ? (event.after as Record<string, unknown>)
        : {};
    let status = '';
    if (
      event.action === 'ORDER_STATUS_CHANGED' &&
      typeof after.status === 'string'
    )
      status = after.status;
    else if (event.action === 'ORDER_CANCELLED') status = 'CANCELLED';
    else if (event.action === 'ORDER_RETURN_REQUESTED')
      status = 'RETURN_REQUESTED';
    else if (event.action === 'MANUAL_SHIPMENT_RECORDED')
      status = 'MANUAL_BOOKED';
    else if (
      /^SHIPMENT_.+_UPDATED$/.test(event.action) &&
      typeof after.status === 'string'
    )
      status = after.status;
    else if (
      /^RETURN_.+_DECIDED$/.test(event.action) &&
      typeof after.approved === 'boolean'
    )
      status = after.approved ? 'RETURN_APPROVED' : '';
    else if (/^RETURN_.+_RECEIVED$/.test(event.action))
      status =
        after.fullReturn === true ? 'RETURNED' : 'PARTIAL_RETURN_RECEIVED';
    else if (
      event.action === 'COURIER_TRACKING_UPDATED' &&
      typeof after.status === 'string'
    ) {
      timeline.push({
        id: event.id,
        label: `Courier: ${after.status.replace(/[_-]/g, ' ').slice(0, 100)}`,
        status: 'COURIER_UPDATE',
        at: event.createdAt,
      });
    }
    if (status && labels[status])
      timeline.push({
        id: event.id,
        label: labels[status],
        status,
        at: event.createdAt,
      });
  }
  const add = (id: string, status: string, at: Date | null | undefined) => {
    if (at && !timeline.some((event) => event.status === status))
      timeline.push({ id, status, label: labels[status], at });
  };
  add('confirmed', 'CONFIRMED', order.confirmedAt);
  add('shipped', 'SHIPPED', order.shippedAt);
  add('delivered', 'DELIVERED', order.deliveredAt);
  add('cancelled', 'CANCELLED', order.cancelledAt);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    updatedAt: order.updatedAt,
    timeline: timeline.sort((a, b) => +new Date(a.at) - +new Date(b.at)),
    shipments: (order.shipments || []).map(
      ({ trackingError, ...shipment }) => ({
        ...shipment,
        refreshDelayed: Boolean(trackingError),
      }),
    ),
  };
}
