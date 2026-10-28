# WP1 commit (c): wording, hidden defaults and configured facts

This supersedes the default-display choices in commit (b). No published CMS content, database rows, shipping rates or backend return-window default were changed.

## Display defaults and controls

- Hero strip: hidden unless `showTrustStrip` is explicitly true. The optional boolean is exposed by the existing schema-driven builder settings. No Prisma change.
- Template `trustFeatures`: `visible: false`. Fallback `trustBadges`: `visible: false`; its renderer respects that flag. Both section types remain available.
- The hidden template section `flash-sale-deals` remains a normal `productGrid`, with source `featured`. The eye/visibility control in `visual-homepage-builder.tsx` can enable it; doing so shows a featured grid, not a countdown. For a real sale, use Add section → Flash Sale, enter the real deadline and source, then save/publish. Existing published flash-sale sections are unaffected.
- Template Latest products uses `source: latest`; the dormant Featured products grid uses `source: featured`.
- Fallback `getFeaturedProducts()` previously omitted the source filter. It now sends `source=featured`. Regression tests inspect actual request parameters for fallback featured, CMS featured and CMS latest.

## Copy changes

| Before | After |
| --- | --- |
| Track every order / Updates in your account or browser. | Order tracking / Updates in your account or checkout browser. |
| Contact the store to confirm return eligibility for this product. Include your order number when requesting support. | Questions about returns? Contact our team. |
| Delivery charges, applicable tax and enabled payment methods are shown at checkout. | Review delivery charges, applicable tax and available payment methods at checkout. |
| Product support / Ask our team about this product and return eligibility. | Returns questions / Questions about returns? Contact our team. |
| Choose an enabled payment method at checkout. | Check available payment methods at checkout. |
| Complete payment using the store’s verified payment flow. | Follow the instructions for your selected payment method. |
| Your final price and stock are verified securely before the order is created. | Your final price and stock are checked before the order is created. |
| Delivery within Bangladesh. Your final total is verified again when placing the order. | Review delivery charges and available payment methods at checkout. Your final total is checked when placing the order. |
| Free delivery on orders over ৳X. | Free delivery on orders of at least ৳X after discounts. |
| How do I place an order with Cash on Delivery (COD)? / How does Cash on Delivery (COD) work? | Which payment methods are available? |
| If Cash on Delivery is available for your order, select it at checkout and pay when your order arrives. | Check available payment methods at checkout. |
| How do I initiate a return or replacement? | Who do I contact about a return? |

Delivery FAQ wording is retained: “Review delivery charges at checkout. Contact our team with your location for delivery questions.” The fallback delivery FAQ question remains unchanged. Help adds the same delivery answer and a returns question linking to `/contact`. No Returns policy URL is invented before WP5.

The help payment note always starts “Check available payment methods at checkout.” It adds “Cash on Delivery is available at checkout.” only after the payment-method endpoint confirms enabled COD. Failure/loading/disabled states make no COD availability claim. Checkout hides a disabled COD choice. Historical order payment snapshots are unchanged.

## Shipping source and boundaries

`shippingSummary(quote.shippingRates)` consumes the rates returned by the real server quote. No fallback price/threshold is present in UI copy. Explicit `en-BD` formatting prevents locale-dependent server/client differences. Free-shipping text is omitted when the configured threshold is zero.

Mocked `ShopService.quote()` tests use deliberately non-default configured rates and exercise the actual coupon evaluation/shipping path: exactly at threshold is free; one unit below costs delivery; a coupon lowering a threshold subtotal below eligibility costs delivery; a coupon leaving it exactly at threshold remains free. No database is used.

## Editable regression policy

Edit `apps/storefront/scripts/claims-policy.json` to change banned phrases, example mutations, scanned source files and repeated filler phrases. The scanner checks CMS defaults, fallback homepage, hero, newsletter, product, purchase, payment note, cart, checkout, shipping copy and help. It catches literal prices in JSX, static shipping configuration inserted into UI code and banned claims. Visible default sections and rendered homepage text are checked for repeated complete filler labels/sentences; hidden starter content is retained for later owner editing.

Dynamic user-authored CMS/catalogue content and image-embedded text still need the owner review planned for commit (d).

## Checks

- Claims policy, shipping-copy, hidden-testimonials and hero regression scripts.
- API shipping and CMS validation specs (32 tests); API production build and full API TypeScript check.
- Storefront and admin webpack production builds, including TypeScript checking.
- Product/cart/checkout/help browser suite, configured shipping copy, enabled/disabled COD; desktop/390px and additional light/dark viewport checks.
- Default CMS and fallback homepage browser checks at 1366px and 390px.

The touched CMS test file had an existing constructor mismatch (`CmsService` takes one argument but its audit test passed three). The test now calls the current one-argument constructor; no production behaviour changes.

Final output:

```text
Test Files 3 passed (3) / Tests 32 passed (32)
PASS: 12 CMS/default/product/cart/checkout/help sources scanned; rendered copy and editable policy mutation checks
PASS: dynamic shipping thresholds, inclusive after-discount wording, disabled free shipping
PASS: guest checkout validation, disabled gateway, address draft, price-conflict retry, duplicate guard and successful redirect
PASS: cart checkout order responsive layouts at 320/375/430/768/1024/1440 in light and dark modes
PASS: help uses conditional payments and links returns questions to contact
PASS: disabled COD is absent from help availability and checkout choices
PASS template 1366px / template 390px / fallback 1366px / fallback 390px
```

All commands above completed successfully; API full type check and the three production builds exited zero. The first cold CMS run hit a controller-import timeout; the final run used `--testTimeout 20000` and passed. Browser wait/fixture assertions were corrected during validation; the final complete browser suite exited zero.
