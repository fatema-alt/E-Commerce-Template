export const courierFields = {
  STEADFAST: ['apiKey', 'secretKey'],
  PATHAO: ['clientId', 'clientSecret', 'username', 'password'],
  REDX: ['accessToken'],
} as const;
export type Courier = keyof typeof courierFields;
export type Credentials = Record<string, string>;
export const courierName = (value: string | null) => {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]/g, '');
  return normalized && Object.hasOwn(courierFields, normalized)
    ? (normalized as Courier)
    : null;
};

async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Courier request failed');
  return (await response.json()) as Record<string, unknown>;
}
const object = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
function status(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100)
    throw new Error('Courier status missing');
  return value.trim();
}

export class CourierAdapters {
  private tokens = new Map<string, { token: string; expires: number }>();

  async track(
    provider: Courier,
    credentials: Credentials,
    sandbox: boolean,
    trackingNumber: string,
    consignmentId?: string | null,
  ) {
    const encoded = encodeURIComponent(trackingNumber);
    if (provider === 'STEADFAST') {
      const path = consignmentId
        ? `status_by_cid/${encodeURIComponent(consignmentId)}`
        : `status_by_trackingcode/${encoded}`;
      const result = await json(`https://portal.packzy.com/api/v1/${path}`, {
        headers: {
          'Api-Key': credentials.apiKey,
          'Secret-Key': credentials.secretKey,
          Accept: 'application/json',
        },
      });
      if (result.status !== 200)
        throw new Error('Courier status lookup failed');
      return status(result.delivery_status);
    }
    if (provider === 'REDX') {
      const base = sandbox
        ? 'https://sandbox.redx.com.bd'
        : 'https://openapi.redx.com.bd';
      const result = await json(`${base}/v1.0.0-beta/parcel/info/${encoded}`, {
        headers: {
          'API-ACCESS-TOKEN': `Bearer ${credentials.accessToken}`,
          Accept: 'application/json',
        },
      });
      return status(object(result.parcel).status);
    }
    const base = sandbox
      ? 'https://courier-api-sandbox.pathao.com'
      : 'https://api-hermes.pathao.com';
    const key = JSON.stringify([base, credentials]);
    for (let attempt = 0; attempt < 2; attempt++) {
      let token = this.tokens.get(key);
      if (!token || token.expires <= Date.now()) {
        const auth = await json(`${base}/aladdin/api/v1/issue-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            username: credentials.username,
            password: credentials.password,
            grant_type: 'password',
          }),
        });
        if (typeof auth.access_token !== 'string' || !auth.access_token)
          throw new Error('Courier authentication failed');
        const lifetime = Number(auth.expires_in);
        token = {
          token: auth.access_token,
          expires:
            Date.now() +
            (Number.isFinite(lifetime) && lifetime > 120
              ? lifetime - 60
              : 240) *
              1000,
        };
        this.tokens.clear();
        this.tokens.set(key, token);
      }
      const response = await fetch(
        `${base}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId || trackingNumber)}/info`,
        {
          headers: {
            Authorization: `Bearer ${token.token}`,
            Accept: 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (response.status === 401 && attempt === 0) {
        this.tokens.delete(key);
        continue;
      }
      if (!response.ok) throw new Error('Courier request failed');
      const result = object(await response.json());
      const data = object(result.data);
      return status(data.order_status_slug || data.order_status);
    }
    throw new Error('Courier authentication failed');
  }
}
