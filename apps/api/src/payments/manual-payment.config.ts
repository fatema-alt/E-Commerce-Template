export const MANUAL_PROVIDERS = [
  'MANUAL_BKASH',
  'MANUAL_NAGAD',
  'BANK_TRANSFER',
] as const;
export type ManualProvider = (typeof MANUAL_PROVIDERS)[number];
export type ManualTransfer = {
  id: ManualProvider;
  label: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  instructions: string;
  bankName?: string;
  branch?: string;
};
export const isManualProvider = (value: unknown): value is ManualProvider =>
  MANUAL_PROVIDERS.includes(value as ManualProvider);
export function manualTransfer(
  provider: string,
  config: Record<string, unknown>,
): ManualTransfer | null {
  if (!isManualProvider(provider)) return null;
  const text = (key: string) =>
    typeof config[key] === 'string' ? config[key].trim() : '';
  const accountNumber = text('accountNumber');
  if (!accountNumber || accountNumber.length > 80 || !text('accountName'))
    return null;
  if (
    provider !== 'BANK_TRANSFER' &&
    (!/^01[3-9]\d{8}$/.test(accountNumber) ||
      !['personal', 'merchant'].includes(text('accountType')))
  )
    return null;
  if (provider === 'BANK_TRANSFER' && !text('name')) return null;
  return {
    id: provider,
    label:
      provider === 'MANUAL_BKASH'
        ? 'bKash (manual)'
        : provider === 'MANUAL_NAGAD'
          ? 'Nagad (manual)'
          : 'Bank Transfer',
    accountNumber,
    accountName: text('accountName'),
    accountType: provider === 'BANK_TRANSFER' ? 'bank' : text('accountType'),
    instructions: text('instructions').slice(0, 1000),
    ...(provider === 'BANK_TRANSFER'
      ? { bankName: text('name'), branch: text('branch') }
      : {}),
  };
}
