# Mobile "Share to shoplit" (PWA Share Target) — Design

**Date:** 2026-05-24
**Status:** Approved (ready for implementation plan)

## Problem

shoplit is mobile-first (Indian creators), but the desktop browser extension —
the easy "add this product" path — can't exist on mobile (mobile Chrome has no
extensions). The server-side fallback (paste a shared URL → OG-fetch the product
page for title/image/price) is blocked: retailer bot-protection (Nykaa, Myntra,
etc.) rejects the AWS host IP. So mobile creators are stuck typing each product's
details by hand, one at a time.

## Constraints (decided during brainstorming)

1. **Zero recurring cost.** No residential/mobile proxy, no paid headless-render
   service. The server cannot be the thing that fetches retailer pages.
2. **Mobile-first, ship fast.** Pure-web PWA over a native app. (Native Android
   WebView extractor was considered and deferred — heavier build, store review,
   no iOS coverage.)
3. **v1 image handling stays simple.** No file upload/storage in v1. Optional
   image-URL field + graceful placeholder. Photo upload is an explicit next phase.

## Core idea

Make shoplit an **installable PWA that registers in the Android share sheet** via
the Web Share Target API. Sharing a product from a shopping app hands shoplit the
**link + title (+ price when present in the text)**. shoplit posts those *explicit*
fields to the existing add-item API — it never fetches the retailer page, so the
IP block is irrelevant.

Title and price come for free from the share payload. The image is the only piece
that can't be auto-fetched for free on mobile web (cross-origin CORS blocks a web
page from reading a retailer page, even from the user's own phone); v1 makes the
image optional with a clean placeholder, and photo upload is the next phase.

## User flow

1. **One-time:** user installs shoplit to the home screen. The manifest declares a
   Web Share Target.
2. In any shopping app (Nykaa/Myntra/Amazon/Flipkart/AJIO): **Share → shoplit.**
   Android opens `https://shoplit.in/add?title=…&text=…&url=…`.
3. The `/add` screen parses the payload → clean product URL, title, price, retailer
   → pre-fills a compact add form with a **cart picker** (defaults to the last-used
   cart, remembered in `localStorage`).
4. User confirms → `POST /api/v1/carts/{id}/items` with explicit fields. On success:
   "Added ✓ — Add another / View cart."

## Components

New unless noted. Follows existing Next.js 14 App Router + Tailwind token
conventions (ink/cream/paper/rule/muted/accent, font-serif=Fraunces).

- **`web/app/manifest.ts`** — Next metadata manifest route. Declares:
  - `name`, `short_name`, `start_url`, `display: standalone`, theme/background
    colors (brand tokens).
  - `icons`: 192×192 and 512×512 PNGs (generated from the existing logo/mark;
    `maskable` variant included).
  - `share_target`: `{ action: "/add", method: "GET", params: { title: "title",
    text: "text", url: "url" } }`.
- **`web/public/sw.js`** + a small client registrar component — minimal service
  worker required for Android installability. Network-passthrough fetch handler;
  **no aggressive caching** of dynamic/app pages (avoid stale auth/content). Just
  enough to satisfy installability criteria.
- **`web/lib/parse-share.ts`** — pure, unit-tested function
  `parseShare({ title?, text?, url? }) → { productUrl, title, priceText }`:
  - Extract the first retailer URL found across `url` + `text` (regex; unwrap
    common short links left as-is — the add API/redirect already handles them).
  - Title: prefer the `title` param; else take `text` with the URL(s) removed and
    known boilerplate stripped (e.g. "Check out this product I found on Nykaa:");
    else humanize the URL slug; else empty (user fills in).
  - Price: regex for `₹`/`Rs.`/`INR` amounts in `text`.
  - Retailer detection is NOT done here — the server's existing
    `ogfetch.RetailerFromURL` fills it from `original_url`.
- **`web/app/add/page.tsx`** — the prefilled add screen. Client component:
  - Reads `searchParams`, runs `parseShare`.
  - Compact mobile form: title, price, product link, note, optional **Image URL**;
    **cart picker** (lists the user's carts; defaults to last-used from
    `localStorage`; offers "＋ New cart" if none exist).
  - Submits to `POST /api/v1/carts/{id}/items` with explicit
    `title/price_text/image_url/original_url/note` (server fills `retailer`).
  - Success state: "Added ✓" with **Add another** (clears form, keeps cart) and
    **View cart** actions.
  - Doubles as the **manual / iOS entry point**: a "Paste a product link" textarea
    runs the same `parseShare`, so the screen is useful even without share-target.
- **Auth return-to** — `/add` requires a logged-in creator. If logged out: stash
  the shared params (sessionStorage) and pass a `next=/add?…` through the Google
  sign-in round trip so the shared data survives login and lands back on `/add`.

**No backend changes** beyond wiring the login `next=`/return-to (the add-item API
already accepts explicit fields and detects the retailer).

## Image handling (v1)

- Optional "Image URL" field (prefilled if the share text happens to contain an
  image URL; usually empty).
- Otherwise the existing gradient placeholder (CartCover / ProductCard already
  render a branded fallback for missing images) — degrades gracefully.

### Next phase (explicitly deferred, not in this plan)

Photo upload: store uploaded images on the EC2 disk (served free via Caddy/Next),
with size/type limits and resize. This unlocks (a) "pick from gallery / take a
photo" and (b) auto-capturing the product image when a shopping app attaches one
to the share (POST share_target with `files`, service-worker-handled). Tracked as
a follow-up after v1 ships.

## Platform coverage

- **Android** (most Indian creators): full share-sheet flow. ✅
- **iOS**: Safari has no Web Share Target. `/add` works via the "Paste a product
  link" flow (same parser); installing gives an app icon. Documented, not broken.
- **Desktop**: unchanged — the browser extension remains the path.

## Error handling

- No URL in the share payload → open `/add` with an empty form + the paste box.
- Logged out → preserve shared data across Google login (return-to), then resume.
- User has no carts → cart picker offers "＋ New cart" (or a default cart prompt).
- Add API failure → inline error, form state preserved, retry.

## Testing

- **Unit (vitest):** `parse-share.ts` against real share strings captured from
  Nykaa, Myntra, Amazon (incl. `amzn.in` short links), Flipkart, AJIO — asserting
  correct `productUrl`, `title`, `priceText` (incl. the boilerplate-strip cases).
- **Manual:** install the PWA on Android; share a product from each retailer app;
  verify prefill + add. iOS paste-link path. Logged-out return-to round trip.
  Lighthouse "installable" check passes.

## Scope guard (YAGNI)

Not in v1: residential proxy, headless browser, file upload/image storage, native
Android/iOS app, offline caching beyond installability.
