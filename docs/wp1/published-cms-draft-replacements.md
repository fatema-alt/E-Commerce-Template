# Published home/hero: owner-reviewed draft replacements

Prepared 2026-10-28 (Asia/Dhaka). **Nothing in this document has been applied.** Edit drafts in the admin, review, then publish them yourself. Do not run a database update script.

## Snapshot limitation and safe review

The current local PostgreSQL/Docker service is unavailable. This document uses the published PAGE snapshots read during WP1 Step 0, not a fresh claim about today's production content:

- `PAGE/home`: published version ID `402a5a4a-a32e-48d7-b11c-bfc38f0d1642`.
- `PAGE/hero`: published version ID `8579cb8c-3082-424f-abda-75586d8bf5ff`.

Before editing, compare each current value in the admin. If it differs, review the newer value rather than overwriting it. Keep existing images, IDs, ordering and links unless the specific change below is approved. Save draft explicitly; use the existing revision-conflict protection. Only publish the reviewed page, never unrelated Site Settings drafts.

The new optional `showTrustStrip` switch is available after the reviewed WP1 code is deployed. Do not paste an unsupported new config field into an older production API. This document does not deploy code or publish a draft.

Paths below use section IDs and zero-based slide/item indexes. Hidden HTML copy can still become visible later or be used as image alt text; review it too. Image-embedded words cannot be fixed by replacing HTML strings: review the actual desktop/mobile artwork separately.

## PAGE/home: hero-campaign

| Field | Observed current text/value | Proposed draft text/value |
| --- | --- | --- |
| `config.title` | Shop Smart. Live Smart. | Keep unchanged |
| `config.subtitle` | Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery all across Bangladesh. | Explore the catalogue and check available payment and delivery options at checkout. |
| `config.showTrustStrip` | Not present | `false` (keep the fixed strip hidden) |
| `config.slides[0].title` | Shop Smart. Live Smart. | Keep unchanged |
| `config.slides[0].subtitle` | Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery all across Bangladesh. | Explore the catalogue and check available payment and delivery options at checkout. |
| `config.slides[0].badge` | 🔥 MEGA SHOPPING FESTIVAL • UP TO 60% OFF | Clear to an empty string |
| `config.slides[0].secondaryButton.label` | Explore Top Deals | Browse products |
| `config.slides[1].title` | Next-Gen Electronics & Smart Gadgets | Explore products |
| `config.slides[1].subtitle` | Directly sourced original smartphones, audio gear, computing accessories, and home appliances with manufacturer warranty support. | Review product details, prices and available options before ordering. |
| `config.slides[1].badge` | ⚡ 100% GENUINE & AUTHORIZED DISTRIBUTOR | Clear to an empty string |
| `config.slides[1].secondaryButton` | label: Official Warranty 🛡️; href: /help | Remove this optional button object |
| `config.slides[2].title` | Save More on Every Single Order | Find your next pick |
| `config.slides[2].subtitle` | Apply verified promo voucher codes during checkout. Free doorstep delivery on qualifying orders all across Bangladesh. | Review product details, prices and available options before ordering. |
| `config.slides[2].badge` | 🎉 EXCLUSIVE VOUCHER DISCOUNT | Clear to an empty string |
| `config.slides[2].button.label` | Grab Discount Deals ↗ | Browse products ↗ |
| `config.slides[2].secondaryButton` | label: Use Code: DSMART250; href: /shop | Remove this optional button object until an actual eligible offer is confirmed |

Slide 1/2 were stored as `bannerType: without_button` (full-banner rendering). Slide 3 was `with_button` (split rendering). Keep the selected mode appropriate to the actual image: embedded text/CTA artwork should use full banner; imagery without text can use split content. No fourth slide or asset is invented. The owner previously chose to select the fourth image in the CMS.

The existing Electronics links must be checked against the current catalogue. This report does not assume that a category slug exists or silently change it. Select a real destination in the admin if needed.

### Legacy stored hero strings: clear in the draft

`floatingBadges` are not currently rendered, but are still stored. Set **each slide's `floatingBadges` to `[]`** so future code changes cannot resurrect these claims. Do not delete media assets or immutable history versions.

| Path | Stored text to clear |
| --- | --- |
| `slides[0].floatingBadges[0].text` | Flat 20% Extra OFF |
| `slides[0].floatingBadges[1].text` | Fast 24-48h Delivery |
| `slides[0].floatingBadges[2].text` | 4.9 (1.2k+ Reviews) |
| `slides[1].floatingBadges[0].text` | 100% Brand Warranty |
| `slides[1].floatingBadges[1].text` | Original Audio Gear |
| `slides[1].floatingBadges[2].text` | 0% EMI & bKash Cashback |
| `slides[2].floatingBadges[0].text` | Save Flat ৳250 |
| `slides[2].floatingBadges[1].text` | Cash on Delivery (COD) |
| `slides[2].floatingBadges[2].text` | Easy 7-Day Returns |

Also clear the campaign badges and optional warranty/coupon buttons listed above. Do not replace these with numeric discounts, blanket authenticity/warranty promises, delivery estimates, EMI/cashback or review aggregates without confirmed evidence. COD availability must come from enabled payment settings; static CMS copy cannot guarantee it. Shipping fees and free-delivery eligibility are displayed from the actual checkout quote, not copied into banners.

## PAGE/home: remaining sections

| Section/field | Observed current text/value | Proposed draft text/value |
| --- | --- | --- |
| `flash-sale-deals.visible` | `true` | `false` until a genuine campaign/source/deadline is confirmed |
| `flash-sale-deals.config.title` | ⚡ Limited Time Flash Deals | Leave hidden. If a normal featured collection is wanted, add a product grid titled Featured products with `source: featured`; do not describe an unconfirmed countdown as a sale. |
| `flash-sale-deals.config.endsAt` | 2026-11-10T05:20:30.386Z | Do not treat this generated date as an approved campaign. Keep the section hidden; enter a real deadline only for an approved sale. |
| `best-sellers.config.title` | 🔥 Best Sellers & Trending Now | Latest products |
| `best-sellers.config.source` | latest | latest (keep; heading must match this source) |
| `promo-banner-savings.config.title` | Mega Savings & Exclusive Discounts | Explore the catalogue |
| `promo-banner-savings.config.description` | Apply verified coupon codes during checkout for instant savings. Free delivery available on qualifying cart orders. | Review product details, prices and available options before ordering. |
| `promo-banner-savings.config.button.label` | Explore Discounted Deals ↗ | Browse products ↗ |
| `trust-features-bd.visible` | `true` | `false`; preserve the section type for later confirmed facts |
| `customer-feedback.visible` | `true` | `false`; runtime already hides the fabricated testimonials |
| `customer-feedback.config.title` | What Our Customers Are Saying | Customer feedback |
| `customer-feedback.config.subtitle` | Genuine feedback and verified purchases from shoppers all across Bangladesh. | Clear to an empty string |
| `faq-home.config.items[0].question` | How do I place an order with Cash on Delivery (COD)? | Which payment methods are available? |
| `faq-home.config.items[0].answer` | Simply add products to your cart, proceed to checkout, enter your delivery address, and select 'Cash on Delivery'. You only pay when your parcel is delivered. | Check available payment methods at checkout. |
| `faq-home.config.items[1].question` | What is the standard delivery timeline across Bangladesh? | Where can I check delivery information? |
| `faq-home.config.items[1].answer` | Deliveries inside Dhaka typically arrive within 24 to 48 hours. For destinations outside Dhaka, delivery takes 2 to 4 business days. | Review delivery charges at checkout. Contact our team with your location for delivery questions. |
| `faq-home.config.items[2].question` | Can I use discount coupons on discounted items? | Keep unchanged |
| `faq-home.config.items[2].answer` | Yes! You can apply eligible promotional coupon codes in your cart or checkout to enjoy additional savings on your total. | If you have a coupon, enter it in your cart or at checkout. Any eligible discount is shown in your order total. |
| `faq-home.config.items[3].question` | How do I initiate a return or replacement? | Who do I contact about a return? |
| `faq-home.config.items[3].answer` | Contact our support team within 7 days of delivery with your order ID, and we will arrange courier pickup or exchange. | Questions about returns? Contact our team. |
| `newsletter-footer.config.title` | Get 10% Off Your First Order | Stay in the loop with DS Mart |
| `newsletter-footer.config.description` | Subscribe to our weekly newsletter for exclusive voucher drops, new releases, and secret weekend sales. | Subscribe to receive news and product updates from DS Mart. |
| `newsletter-footer.config.consentText` | I agree to receive promotional emails and discount codes from DS Mart. | I agree to receive news and product updates from DS Mart. |

The renderer already suppresses the numeric newsletter discount title, but remove it from the draft as well. Subscription does not issue a coupon. Keep the present contact route for returns questions; link to the real Returns policy page only after WP5 creates it. `privacyHref: /help` was in this snapshot; choose the actual Privacy page after WP5, without inventing a currently nonexistent policy route.

### Hidden trust-features content to review before any future re-enable

These stored items are **not approved facts**. Hiding the section is the immediate recommendation; do not replace it with repeated filler just to fill space.

| Current title | Current description |
| --- | --- |
| Cash on Delivery | Pay safely in cash or mobile banking right at your doorstep anywhere in Bangladesh. |
| 100% Authentic Products | Directly sourced genuine products from authorized distributors with full warranty support. |
| Easy 7-Day Returns | Simple and hassle-free replacements or full refunds if an item is not as expected. |
| 24/7 Dedicated Care | Prompt customer assistance via hotline, email, and live messaging whenever you need help. |

## PAGE/hero: separate published page

This is a separate CMS document, not automatically the homepage. The inspected local database had no published Site Settings document assigning it as home.

| Field | Observed current text/value | Proposed draft text/value |
| --- | --- | --- |
| `content.title` | Hero (with a trailing space) | Hero |
| hero section `config.title` | hiiiiiiiiiiiiiiiiiiiiiiii | Shop Smart. Live Smart. |
| hero section `config.subtitle` | how are youuu | Explore the catalogue and check available payment and delivery options at checkout. |
| hero section `config.button.label` | Click here | Browse products |
| hero section `config.button.href` | /cart | /shop |
| hero section `config.showTrustStrip` | Not present | `false` |

The repeated-letter title above is transcribed from the earlier snapshot; because a fresh read is unavailable, compare the exact number of letters in the admin before editing. Keep its image/asset reference unless replacement artwork has been reviewed. Do not assign it as homepage or publish unrelated Site Settings as part of this copy cleanup.

## Return-window decision remains open

- **7** is still stored in the old published home trust title/description context, returns FAQ, and slide 3's legacy `Easy 7-Day Returns` floating badge listed above. Clearing/hiding these is a draft recommendation only.
- **14** remains the backend default at `apps/api/src/orders/order-operations.service.ts`, `ORDER_RETURN_WINDOW_DAYS ?? 14`. It is unchanged.
- The former template's **14-day generated flash-sale deadline** was unrelated to returns and was removed in commit (b).
- No 7-day or 14-day delivery/returns promise remains in the new store-authored UI/template defaults. Immutable historical versions can still contain old strings; do not rewrite history.

Owner decision is still required for the actual return policy, eligibility and process before WP5 publishes policy copy.
