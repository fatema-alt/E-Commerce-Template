export type CheckoutGateway = 'BKASH' | 'SSLCOMMERZ';

/** A gateway needs an explicit admin opt-in and complete merchant credentials. */
export function checkoutGatewayReady(row: {
  provider: string;
  isEnabled: boolean;
  config: unknown;
}) {
  if (!row.isEnabled) return false;
  const config = (row.config || {}) as Record<string, unknown>;
  const fields =
    row.provider === 'BKASH'
      ? {
          appKey: 'BKASH_APP_KEY',
          appSecret: 'BKASH_APP_SECRET',
          username: 'BKASH_USERNAME',
          password: 'BKASH_PASSWORD',
        }
      : row.provider === 'SSLCOMMERZ'
        ? {
            storeId: 'SSLCOMMERZ_STORE_ID',
            storePassword: 'SSLCOMMERZ_STORE_PASSWORD',
          }
        : null;
  return (
    fields !== null &&
    Object.entries(fields).every(([key, env]) => {
      const value = config[key] || process.env[env];
      return typeof value === 'string' && value.trim().length > 0;
    })
  );
}
