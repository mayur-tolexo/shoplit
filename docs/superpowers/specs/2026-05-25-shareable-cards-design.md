# Shareable preview & story cards — Design

Date: 2026-05-25
Status: Approved for implementation

Grow each creator's reach: (1) auto OG preview images so every shared cart/profile link looks gorgeous everywhere, and (2) a one-tap downloadable 9:16 "story card" (with QR) creators post to IG/TikTok. Both cart (`/c/{slug}`) and profile (`/u/{handle}`). Frontend-only (Next.js `next/og`). Two tracks, disjoint files → parallelizable.

## Contract (normative)
- OG previews are wired via the `opengraph-image` file convention (auto `og:image`/`twitter:image`), 1200×630, `image/png`.
- Story downloads (Track B links to these — Track A implements them):
  - `GET /c/{slug}/story` → `image/png`, 1080×1920, `Content-Disposition: attachment; filename="shoplit-{slug}.png"`.
  - `GET /u/{handle}/story` → `image/png`, 1080×1920, `attachment; filename="shoplit-{handle}.png"`.
- Both are public (no auth); unknown slug/handle → 404.

---

## Workstream A — Image generation (Next `next/og`)

### Shared render helper `web/lib/share-card.tsx`
- Pure JSX builders used by all four routes (one source of truth for layout, two sizes):
  - `cartCard({ kind: "og"|"story", cart })` and `profileCard({ kind, creator, cartCount })`.
  - **Cart**: cover image as the hero (or the brand-accent gradient when no absolute cover URL — same rule as the page), the cart title (serif), `@handle` + avatar, "N products", and the shoplit wordmark. Accent (`#B5532A`) used for brand chrome.
  - **Profile**: avatar, display name (serif), `@handle`, "N carts", shoplit wordmark, accent background wash.
  - **Story (1080×1920)** adds: large vertical hero, the `shoplit.in/c/{slug}` (or `/u/{handle}`) URL text, and a **QR code** (bottom) to that URL.
- **Reliability rule:** use only *our*-hosted images (the cart `coverImageUrl` when it's an absolute `https://…` URL, and the Google `avatarUrl`) + text + accent + shoplit mark. **Do NOT embed retailer-CDN product images** (they fail unpredictably in server image gen). When there's no absolute cover, render the accent gradient hero — always renders.
- **Fonts:** `ImageResponse`/satori needs TTF/OTF (not woff2/variable-woff). Bundle static TTFs for the brand serif (Fraunces) + sans (Inter) under `web/app/fonts/` (or `web/lib/fonts/`), and load them with the documented next/og pattern (`fetch(new URL("./X.ttf", import.meta.url))` or `fs.readFile` of a traced path) so they survive the standalone build. Provide `fonts: [{ name, data, weight, style }]` to `ImageResponse`.
- **QR:** add `qrcode` (+ `@types/qrcode`) dep (`pnpm add`); `qrcode.toDataURL(url, { margin, color })` → embed the PNG data URL as `<img>` in the story card. Style it on a cream rounded tile so it reads on the accent/dark background.

### Routes
- `web/app/(share)/c/[slug]/opengraph-image.tsx` — `export const size = { width:1200, height:630 }`, `contentType = "image/png"`, default async fn fetches `getCartBySlug(slug)` → `new ImageResponse(cartCard({kind:"og", cart}), { ...size, fonts })`. If not found, render a generic shoplit-branded fallback card (don't throw).
- `web/app/(public)/u/[handle]/opengraph-image.tsx` — same, via `getCreatorProfile(handle)` (→ creator + cartCount).
- `web/app/(share)/c/[slug]/story/route.tsx` — `export async function GET(req, { params })`: fetch cart → return `new ImageResponse(cartCard({kind:"story", cart}), { width:1080, height:1920, fonts })`; set `Content-Disposition` attachment header + `Cache-Control: public, max-age=300`. 404 if cart missing.
- `web/app/(public)/u/[handle]/story/route.tsx` — same for profile.
- Use the **nodejs runtime** (self-hosted standalone — no edge). Verify `pnpm build` traces fonts.

### generateMetadata cleanup
- `web/app/(share)/c/[slug]/page.tsx`: remove the manual `openGraph.images` block (the `opengraph-image.tsx` now provides it). Keep title/description.
- `web/app/(public)/u/[handle]/page.tsx`: likewise drop any manual og image; keep title/description.

### Files (A)
Create: the 4 route files, `web/lib/share-card.tsx`, bundled font TTF(s). Modify: the two `page.tsx` `generateMetadata`, `web/package.json` (qrcode). No Track B files.

---

## Workstream B — "Download story card" UX (awesome share UX)

The button(s) link to Track A's story routes (`/c/{slug}/story`, `/u/{handle}/story`) — Track A need not be running; build against these URLs.

- **`web/components/download-story-button.tsx`** (`"use client"` or simple) — a tasteful action: an `<a href={storyUrl} download>` styled as a pill/row with an icon (e.g., `ImageDown`/`Share2`) + label "Story card" / "Download story card"; ≥44px; on click a subtle toast ("Saved — post it to your story ✨") via `sonner`. Reusable for cart + profile (prop: `href`, `label`).
- **Cart share surface** — add the Download-story-card action into the cart's share UI: `web/components/share-sheet.tsx` (the expanded share dialog) and/or `web/components/sticky-share-bar.tsx`. It needs the slug → build `/c/{slug}/story`. Do NOT edit the cart `page.tsx` (Track A owns it); hook in via the share component(s), which already receive `slug`.
- **Profile** — add the action to `web/components/dashboard-hero.tsx` (the creator's home, which already shows the profile link + Copy/Share) → `/u/{handle}/story`. "Share to story".
- Awesome UX: clear, delightful, on-brand; a tiny note like "Perfect for Instagram/TikTok stories"; graceful (it's a plain download link — works even if JS is off).

### Files (B)
Create: `web/components/download-story-button.tsx`. Modify: `web/components/share-sheet.tsx` (and/or `sticky-share-bar.tsx`), `web/components/dashboard-hero.tsx`. No Track A files; do NOT touch the page.tsx files.

---

## Verification
- Both: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build` (must compile; the new routes build; fonts traced).
- Integrator (live, post-deploy — these routes are **public**, so directly checkable):
  - `curl -sI https://shoplit.in/c/{slug}/opengraph-image` → `content-type: image/png`, non-trivial size.
  - `curl -sI https://shoplit.in/c/{slug}/story` and `/u/{handle}/story` → `image/png`, attachment.
  - View a cart/profile link's preview (e.g., paste in a link unfurler) to confirm the card renders.

## Out of scope (v1)
Per-product cards, editable templates, video, scheduling, twitter-image variants beyond what the convention auto-provides.
