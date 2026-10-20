import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export function rejectNulls(value: object, fields: string[]) {
  const input = value as Record<string, unknown>;
  const key = fields.find((field) => input[field] === null);
  if (key) throw new BadRequestException(key + ' cannot be null');
}

export function money(value: string | number | Prisma.Decimal) {
  const text = value.toString();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text))
    throw new BadRequestException(
      'Price must be a non-negative amount with at most two decimal places',
    );
  return new Prisma.Decimal(text);
}

export function prices(
  price: string | number | Prisma.Decimal,
  sale?: string | number | Prisma.Decimal | null,
  cost?: string | number | Prisma.Decimal | null,
) {
  const regular = money(price);
  if (sale != null && money(sale).gt(regular))
    throw new BadRequestException('Sale price cannot exceed regular price');
  if (cost != null) money(cost);
}

export function combination(attributes: Record<string, string>) {
  const keys = Object.keys(attributes);
  if (
    !keys.length ||
    keys.length > 5 ||
    keys.some(
      (key) =>
        !key.trim() ||
        key.length > 50 ||
        typeof attributes[key] !== 'string' ||
        !attributes[key].trim() ||
        attributes[key].length > 100,
    )
  ) {
    throw new BadRequestException(
      'Use one to five options with non-empty text values',
    );
  }
  const entries = keys.map((key) => [
    key.trim().toLowerCase(),
    attributes[key].trim().toLowerCase(),
  ]);
  if (new Set(entries.map(([key]) => key)).size !== keys.length)
    throw new BadRequestException('Duplicate option names');
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function validateOptions(options: unknown) {
  if (!Array.isArray(options) || options.length > 5)
    throw new BadRequestException('A product supports at most five options');
  const names = new Set<string>();
  let combinations = 1;
  for (const option of options) {
    if (
      !option ||
      typeof option.name !== 'string' ||
      !option.name.trim() ||
      option.name.length > 50 ||
      !Array.isArray(option.values) ||
      !option.values.length ||
      option.values.length > 50 ||
      option.values.some(
        (v: unknown) => typeof v !== 'string' || !v.trim() || v.length > 100,
      )
    )
      throw new BadRequestException('Options need a name and 1–50 text values');
    const name = option.name.trim().toLowerCase();
    const values = option.values.map((v: string) => v.trim().toLowerCase());
    if (names.has(name) || new Set(values).size !== values.length)
      throw new BadRequestException('Duplicate option names or values');
    names.add(name);
    combinations *= values.length;
  }
  if (combinations > 200)
    throw new BadRequestException(
      'Options cannot generate more than 200 combinations',
    );
}

export function validateAttributes(
  attributes: Record<string, string>,
  options: Prisma.JsonValue,
) {
  combination(attributes);
  if (!Array.isArray(options) || !options.length) return;
  const normalized = Object.fromEntries(
    Object.entries(attributes).map(([k, v]) => [
      k.trim().toLowerCase(),
      v.trim().toLowerCase(),
    ]),
  );
  if (
    Object.keys(normalized).length !== options.length ||
    options.some((option) => {
      const item = option as { name: string; values: string[] };
      return !item.values.some(
        (value) =>
          value.trim().toLowerCase() ===
          normalized[item.name.trim().toLowerCase()],
      );
    })
  )
    throw new BadRequestException(
      'Variant attributes must match the configured product options',
    );
}

export function catalogError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new ConflictException(
        'SKU, slug or option combination already exists',
      );
    if (error.code === 'P2003')
      throw new ConflictException(
        'This record is referenced by other catalog records',
      );
    if (error.code === 'P2034')
      throw new ConflictException(
        'Another administrator changed this record. Refresh and retry.',
      );
  }
  throw error;
}

export async function audit(
  tx: Prisma.TransactionClient,
  entity: string,
  entityId: string,
  action: string,
  changes: unknown,
  actorId?: string,
) {
  await tx.catalogAuditLog.create({
    data: {
      entity,
      entityId,
      action,
      actorId,
      changes: JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue,
    },
  });
}

export async function changeSlug(
  tx: Prisma.TransactionClient,
  entity: 'product' | 'category',
  entityId: string,
  oldSlug: string,
  newSlug: string,
) {
  if (oldSlug === newSlug) return;
  const reserved = await tx.catalogRedirect.findUnique({
    where: { entity_fromSlug: { entity, fromSlug: newSlug } },
  });
  if (reserved && reserved.entityId !== entityId)
    throw new ConflictException('Slug is reserved by a historical URL');
  await tx.catalogRedirect.deleteMany({
    where: { entity, entityId, fromSlug: newSlug },
  });
  await tx.catalogRedirect.upsert({
    where: { entity_fromSlug: { entity, fromSlug: oldSlug } },
    create: { entity, entityId, fromSlug: oldSlug },
    update: { entityId },
  });
}
