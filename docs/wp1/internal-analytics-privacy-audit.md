# Internal analytics: implementation audit and privacy-page facts

Date: 2026-10-28. This describes the application implementation, not a legal/privacy certification or an audit of hosting/CDN/proxy logs.

## Behaviour unchanged

Internal `/api/analytics` remains enabled independently of GTM. With no GTM ID the third-party GTM script is absent, while first-party dashboard events can still be sent. Commit (d) changes no analytics production code or settings.

## What the application stores

Source: `apps/api/prisma/schema.prisma` models `AnalyticsSession` and `AnalyticsEvent`; `apps/api/src/dashboard/dashboard.service.ts` method `track()`.

| Record | Stored fields |
| --- | --- |
| AnalyticsSession | `id`: random UUID session identifier; `source`: one of `direct`, `organic`, `social`, `referral`, `email`; `createdAt`: database timestamp |
| AnalyticsEvent | `id`: random UUID event identifier; `sessionId`: session reference; `kind`: `PAGE_VIEW`, `PRODUCT_VIEW`, `ADD_TO_CART`, or `CHECKOUT`; `createdAt`: database timestamp |

There is no customer/account/order/product ID, email, phone, address, full IP, user-agent, complete referrer URL, page path, search text or URL-query field in these analytics models or the ingestion write selections. The traffic source is a coarse category, not the original URL or an email address. These random browser identifiers are pseudonymous/linkable, not proof of anonymous processing.

The browser helper reads the referrer and UTM parameters locally to choose the source category. It sends `{id, kind, source}`. The Next route adds the opaque session UUID and forwards exactly `{id, sessionId, kind, source}`. It does not forward the browser cookie/header set, IP headers or arbitrary extra JSON fields. The upstream API DTO restricts kinds/sources/UUIDs and rejects unknown fields under the global validation pipe. The service writes only the model fields above.

## Cookie, Do Not Track and retention

- `commerce_analytics` contains the random session UUID. It is HttpOnly, SameSite=Lax, path `/`, Secure in production, with `maxAge: 1800` (30 minutes). It is set on analytics responses; this is cookie expiry, **not database-row retention**.
- `trackEvent()` returns before sending when `navigator.doNotTrack === "1"`. The regression test toggles that value and verifies the request count does not increase.
- This is a browser-helper DNT check. The POST endpoint does not independently reject requests based on a DNT header; do not describe it as a universal server-side opt-out.
- The session ID groups browser events. The ingestion service caps recorded events at 300 per session in a rolling hour and de-duplicates event IDs. That is a rate bound, not a deletion schedule.
- No automatic retention/deletion job for analytics rows was found in the reviewed application code. An owner-approved database retention period and cleanup mechanism remain an open privacy-page/operations decision.

## Verification

`node scripts/verify-analytics.mjs` from `apps/storefront` passed against the production Next build and an isolated in-memory upstream, without database writes:

```text
PASS: traffic classification, serialized initial events, Do Not Track, same-origin validation, allowed event types, opaque HttpOnly sessions, server-only secret, bounded analytics payload; email/phone/IP/address/referrer fields are not forwarded.
```

The test supplies synthetic extra email/phone/IP/address/referrer fields and verifies that none reaches the upstream payload. Schema/service inspection verifies what is selected for persistence. Local DB row/column introspection could not be repeated while PostgreSQL/Docker was unavailable; production was not contacted.

## Draft factual privacy wording for owner review

“We use first-party analytics to understand visits, product views, cart additions and checkout activity. The application records random browser/event identifiers, a broad traffic-source category, event type and timestamps. This analytics record does not include your name, email, phone, delivery address or full IP address. Our browser analytics helper does not send these events when your browser reports Do Not Track as enabled. The analytics cookie expires after 30 minutes; database retention is a separate policy.”

Do not publish that last retention sentence as the final policy until the actual storage duration is decided. Hosting/CDN/reverse-proxy access logs, backups, monitoring and any enabled third-party tags need their own checks: they may process IPs or other metadata outside this application analytics pipeline. No such external log audit was performed here.
