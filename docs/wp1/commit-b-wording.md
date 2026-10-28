# WP1 commit (b): exact wording changes

Code defaults only. No published CMS content or database records are changed. The published-home/hero draft document belongs to commit (d).

## apps/storefront/src/components/hero-banner.tsx

| Before (exact) | After (exact) |
| --- | --- |
| Customer service promises | Shopping information |
| 100% Authentic Guarantee | Product information |
| Directly sourced from authorized brand distributors | Review product details before ordering. |
| Cash on Delivery (COD) | Payment options |
| Pay safely at doorstep anywhere across Bangladesh | Check available payment methods at checkout. |
| 7-Day Easy Returns | Returns questions |
| Simple replacements or hassle-free full refunds | Questions about returns? Contact our team. |
| 24/7 Dedicated Care | Contact our team |
| Friendly customer assistance via hotline & chat | Ask about products or an existing order. |

## apps/storefront/src/lib/storefront.ts

| Before (exact) | After (exact) |
| --- | --- |
| From your next favourite gadget to the little things for home. Discover more of what you love, all at DS Mart with nationwide Cash on Delivery. | Explore the catalogue and check available payment and delivery options at checkout. |
| Trending & Best Sellers | Explore products |
| Handpicked top sellers chosen by our customers. | Browse the current catalogue. |
| Save More With Checkout Coupons | Explore the catalogue |
| Enjoy up to 25% extra discount using verified promo codes. Fast 24-48h delivery inside Dhaka. | Review product details, prices and available options before ordering. |
| View All Deals | Browse products |
| Cash on Delivery | Payment options |
| Pay upon parcel inspection at your doorstep all across Bangladesh. | Check available payment methods at checkout. |
| 100% Genuine | Product information |
| Directly sourced authentic brand products with full warranty. | Review product details before ordering. |
| Easy 7-Day Returns | Returns questions |
| Hassle-free replacement or quick refund if not fully satisfied. | Questions about returns? Contact our team. |
| Dedicated Support | Contact our team |
| Expert customer assistance ready 24/7 via call or WhatsApp. | Ask about products or an existing order. |
| Select Cash on Delivery during checkout. Our delivery agent collects the payment in cash or via bKash upon delivering your package. | If Cash on Delivery is available for your order, select it at checkout and pay when your order arrives. |
| Delivery inside Dhaka takes 24 to 48 hours (৳60). Outside Dhaka takes 2 to 4 business days (৳120). Free delivery on orders over ৳2,500. | Review delivery charges at checkout. Contact our team with your location for delivery questions. |
| Enter your coupon code in the cart summary or checkout coupon field and click 'Apply' for instant savings. | If you have a coupon, enter it in your cart or at checkout. Any eligible discount is shown in your order total. |
| Get 10% Off Your First Order | Stay in the loop with DS Mart |
| Subscribe to our newsletter for exclusive vouchers, weekly sales, and member-only specials. | Subscribe to receive news and product updates from DS Mart. |
| I agree to receive discount updates and promotional emails from DS Mart. | I agree to receive news and product updates from DS Mart. |

## apps/admin/src/components/cms/standard-template.ts

| Before (exact) | After (exact) |
| --- | --- |
| Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery all across Bangladesh. | Explore the catalogue and check available payment and delivery options at checkout. |
| ⚡ Limited Time Flash Deals | Featured products |
| 🔥 Best Sellers & Trending Now | Latest products |
| Mega Savings & Exclusive Discounts | Explore the catalogue |
| Apply verified coupon codes during checkout for instant savings. Free delivery available on qualifying cart orders. | Review product details, prices and available options before ordering. |
| Explore Discounted Deals ↗ | Browse products ↗ |
| Cash on Delivery | Payment options |
| Pay safely in cash or mobile banking right at your doorstep anywhere in Bangladesh. | Check available payment methods at checkout. |
| 100% Authentic Products | Product information |
| Directly sourced genuine products from authorized distributors with full warranty support. | Review product details before ordering. |
| Easy 7-Day Returns | Returns questions |
| Simple and hassle-free replacements or full refunds if an item is not as expected. | Questions about returns? Contact our team. |
| 24/7 Dedicated Care | Contact our team |
| Prompt customer assistance via hotline, email, and live messaging whenever you need help. | Ask about products or an existing order. |
| Genuine feedback and verified purchases from shoppers all across Bangladesh. | Customer feedback. |
| Simply add products to your cart, proceed to checkout, enter your delivery address, and select 'Cash on Delivery'. You only pay when your parcel is delivered. | If Cash on Delivery is available for your order, select it at checkout and pay when your order arrives. |
| What is the standard delivery timeline across Bangladesh? | Where can I check delivery information? |
| Deliveries inside Dhaka typically arrive within 24 to 48 hours. For destinations outside Dhaka, delivery takes 2 to 4 business days. | Review delivery charges at checkout. Contact our team with your location for delivery questions. |
| Yes! You can apply eligible promotional coupon codes in your cart or checkout to enjoy additional savings on your total. | If you have a coupon, enter it in your cart or at checkout. Any eligible discount is shown in your order total. |
| Contact our support team within 7 days of delivery with your order ID, and we will arrange courier pickup or exchange. | Questions about returns? Contact our team. |
| Get 10% Off Your First Order | Stay in the loop with DS Mart |
| Subscribe to our weekly newsletter for exclusive voucher drops, new releases, and secret weekend sales. | Subscribe to receive news and product updates from DS Mart. |
| I agree to receive promotional emails and discount codes from DS Mart. | I agree to receive news and product updates from DS Mart. |

## apps/storefront/src/components/newsletter.tsx

| Before (exact) | After (exact) |
| --- | --- |
| EXCLUSIVE MEMBER OFFERS | DS MART UPDATES |
| Discover new arrivals, product updates and member offers when available. Subscribe to hear what’s next. | Subscribe to receive news and product updates from DS Mart. |

## Default flash-sale behaviour

The template section with ID `flash-sale-deals` changes from `type: "flashSale"` to `type: "productGrid"`, and from `visible: true` to `visible: false`. Its automatically generated `endsAt` (`new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()`) is removed. A `flashSale` requires a real deadline under the existing CMS schema; keeping a dormant normal grid avoids inventing one and keeps the template valid. No campaign or deadline is invented on install/reset. Existing IDs, source selectors and routes are preserved. Owners can add a flash-sale section when a real campaign is configured.

The backend return-window default remains 14 days. No Returns policy link is invented before WP5 creates that page.

## Validation

- `node apps/storefront/scripts/verify-homepage-claims.mjs`: passed (default strings, CMS required fields, rendered hero strip and newsletter, prohibited-claim guard).
- `node apps/storefront/scripts/verify-testimonials-hidden.mjs`: passed.
- `node apps/storefront/scripts/verify-hero.mjs`: passed.
- Storefront and admin: `node node_modules/next/dist/bin/next build --webpack` passed, including TypeScript checking.
- `node apps/storefront/scripts/verify-homepage-claims-browser.mjs`: passed for the actual template and fallback configuration at 1366px and 390px, using an in-memory API with an empty catalogue. No runtime exceptions or page horizontal overflow. Screenshots inspected.
- Existing dark-mode hero copy has low contrast against the light portion of the gradient; this wording-only commit does not change CSS. Published CMS copy and text embedded in banner images are not covered by these fixture checks and remain for owner review.
