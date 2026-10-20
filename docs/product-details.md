# DS Mart product details

The product route now provides a responsive gallery and purchase panel, followed by product information, delivery/support disclosures and related products from the same public category.

## Catalog behavior

- Uses the public API's short/full description, brand, category, SKU/barcode, variant attributes, primary image and variant image associations.
- Changing an option updates its price, actual sale savings, SKU, available stock and gallery. Default options are selected only when available. Sold-out options cannot be purchased.
- Product type is authoritative: a SIMPLE product ignores historical child variant records. Only VARIABLE products expose variant controls. Old browser cart entries that incorrectly contain a variant for a SIMPLE product are normalized when visiting the product, or after a rejected cart quote. Quantities are preserved and merged with any existing simple line; unrelated products are retained. A fresh server quote is required afterward. Real invalid VARIABLE selections remain blocked and link back to product options.
- Quantity controls reject zero, fractions and quantities above available stock, including units already in the browser cart. Invalid input is normalized on blur. Cart writes also enforce the stock limit using the latest stored cart rather than a stale render snapshot.
- Add to cart gives accessible success/error feedback. Editing quantity or option clears stale success. Buy now adds the selected item to the existing cart and opens checkout. Stock and prices remain subject to server verification at checkout; the product page does not reserve inventory.
- Wishlist toggles between saved/removed, survives navigation and recovers from malformed stored JSON. Browser storage failures show an error. Share uses native sharing where supported and otherwise copies the product link.

## Gallery and resilience

The primary image is prioritized and has a stable square frame. Thumbnails, previous/next controls and arrow keys switch images. The native modal image viewer supports keyboard focus handling and Escape. Missing/broken images receive placeholders, including thumbnails.

A skeleton covers loading. A public API 404 renders the product-specific missing state; API/network/invalid-response failures render a retry screen instead of a false missing-product state. Retry reloads the route to fetch fresh data. Public slug redirects are followed and the storefront navigates to the canonical product slug.

## SEO

The page uses catalog SEO fields for title/description, robots, social previews and canonical URL. Configure `STOREFRONT_ORIGIN` to the actual public storefront origin if products do not define canonical URLs. No production domain is guessed. Product structured data uses actual variant prices/availability and escapes HTML before embedding JSON. Reviews, ratings and delivery guarantees are not fabricated.

## Verification

```powershell
corepack pnpm --filter storefront exec tsc --noEmit
corepack pnpm --filter storefront build --webpack
corepack pnpm --filter storefront test:product
```

The browser runner uses an existing Chrome/Edge binary (`PRODUCT_TEST_BROWSER` can override the path), an isolated in-memory catalog on port 4109 and the production storefront on port 3015. These ports must be free. It creates no database records and stops its own processes. It writes ignored fixture screenshots to `apps/storefront/.product-check/`.

Checks cover variant requirements, price/image updates, sold-out options/products, invalid and cumulative quantities, persistence, wishlist toggle/corrupt storage, blocked storage, gallery zoom/Escape/arrows/broken images, mobile overflow, light/dark screenshots, Buy now navigation, SEO/JSON escaping, missing/error states and recovery after API failure. Production build, TypeScript and targeted ESLint checks also passed.

Screenshots use test catalog data. Real database-backed order creation, payment and live storage/CDN verification remain deployment checks; this work does not claim those services were exercised.

The reported live Cotton T-Shirt mismatch was verified on 2026-10-19: the public catalog identifies it as SIMPLE while also returning a historical Black variant record. A real quote for one unit without a variant succeeded at BDT 500.00. No product type, inventory or order record was changed by this repair.
