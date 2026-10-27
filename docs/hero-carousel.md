# Homepage hero carousel

Edit the published homepage key (locally `home`) in Homepage Builder. Restart the API after schema changes and refresh the admin to load the latest fields.

Each item under Hero → Slides has its own Banner display selector:

- **Full banner image** (`slideType: full_banner`): use artwork containing its own text/buttons. Desktop images display uncropped at 3:1 with `contain`; no HTML heading, description, badge or CTA is rendered. Banner Link optionally makes the whole artwork clickable. The title remains an accessible label. Optional Mobile Image uses a 4:5 frame below 700px; upload artwork composed for that size. Without mobile artwork, the desktop image remains uncropped.
- **Image + HTML content** (`slideType: split_content`): use artwork without text. Copy occupies 45% and edge-to-edge imagery 55% on desktop. Imagery uses `cover`, so keep subjects away from edges. Below 700px copy and image stack. Configure Title, Subtitle, Button and Secondary Button in the CMS.

Enable this slide controls visibility without deleting the saved content. Existing array arrows control ordering. Optional Background Gradient accepts a CSS linear/radial gradient; Theme remains the fallback. Images are selected or uploaded through the Media Library.

For the requested sequence, set shopping and electronics artwork to Full banner image, fashion artwork to Image + HTML content, then add a fourth Image + HTML content slide with promotional copy and choose its image. Campaign content stays in CMS data, rather than being generated inside the component.

Legacy `without_button` maps to full banners and `with_button` to split content until an explicit Slide Type is selected. Legacy hero sections without a Slides list render their original content as one slide. Disabled slides are omitted; disabling all slides hides the hero.

The shared grid reserves the tallest enabled slide's height to avoid jumps when slides change. Images retain their own proportions inside that shared stage. Controls occupy a separate consistent row and do not obscure embedded image text. Keyboard: Left/Right, Home/End. Swipe, previous/next and pagination are supported. Autoplay pauses on hover, keyboard focus, hidden tabs and reduced-motion preference; the pause button also stops it explicitly.

Images use `next/image` with responsive sizes and reserved layout. The first desktop image loads eagerly; later images load lazily. Local HTTP media bypasses the server optimizer so local/private API images work without enabling private-network access. HTTPS media uses optimization; add external storage origins to the comma-separated `CMS_IMAGE_ORIGINS` storefront environment variable if they differ from `STOREFRONT_API_BASE_URL`.

Checks: `pnpm --filter storefront test:hero`, `pnpm --filter storefront exec tsc --noEmit`, `pnpm --filter admin exec tsc --noEmit`, `pnpm --filter api exec tsc --noEmit -p tsconfig.build.json`, and `pnpm --filter api exec vitest run src/cms/cms-validation.spec.ts`.
