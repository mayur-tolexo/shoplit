# shoplit browser extension — v1 design

**Date:** 2026-05-24
**Status:** Approved (brainstorm) → pending implementation plan

## Problem

Creators add products to a cart by pasting a retailer URL; the server fetches
OpenGraph/JSON-LD metadata (title/image/price). In production this fails:
shoplit's API runs on an AWS host whose datacenter IP is blocked by retailer
bot-protection (Myntra serves a challenge page, Nykaa returns 403, Amazon omits
`og:image`). Pasting share-text now lifts the title client-side, but **images
and price still can't be fetched server-side**.

A browser extension solves this at the root: it runs in the creator's own
browser — residential IP, logged-in retailer session — so it reads the live
product page DOM exactly as a real shopper's browser sees it. No IP block, no
third-party scraping service.

## Goals

- Add a product to one of the creator's shoplit carts directly from a retailer
  product page (Nykaa, Myntra, Amazon, Flipkart, AJIO), capturing title, image,
  price, and the canonical URL.
- Two entry points: the toolbar popup and an injected on-page button.
- Authenticate the extension to the shoplit API without relying on cross-site
  cookies.

## Non-goals (v2+)

- Chrome Web Store publishing (v1 is loaded unpacked for dev/testing).
- Firefox / Safari ports (build MV3, which Edge also runs).
- Bulk / wishlist import; variant and image-gallery selection.
- Usage analytics on the extension.
- A "connected devices" management UI in shoplit settings (token revocation
  exists in the data model; the UI is deferred).

## Architecture

Three parts: the extension, small backend additions to `shoplit-api`, and one
new frontend page.

```
 Retailer product page (browser, residential IP)
   │  content script: extract product + inject "+ shoplit" button
   ▼
 Extension popup ── service worker ──(Bearer token)──▶ shoplit-api (api.* / shoplit.in/api)
   │  shows product + cart picker + note + Add        GET /carts, POST /carts/{id}/items
   │
 Connect flow: shoplit.in/connect-extension ──(externally_connectable)──▶ service worker stores token
```

### Component 1 — Extension (Manifest V3)

New top-level `extension/` directory. Plain TypeScript bundled with esbuild into
three entry points. No framework.

- **content script** — injected on the five retailer domains (`content_scripts`
  matches). Responsibilities:
  - Extract the product (see Extraction).
  - Inject a floating "＋ shoplit" button on product pages. Clicking it opens a
    small **in-page panel rendered by the content script** (MV3 can't reliably
    open the toolbar popup programmatically). The panel and the popup share the
    same add UI module and add logic — only the host surface differs.
  - Respond to `extractProduct` messages from the popup.
- **service worker** (`background.service_worker`) — token storage
  (`chrome.storage.local`), all `fetch` calls to the shoplit API (host
  permission for `shoplit.in`), message routing between popup/content script,
  and `chrome.runtime.onMessageExternal` for the token handoff.
- **popup** (`action`) — when not connected, shows "Connect to shoplit"; when
  connected, requests the current tab's extracted product from the content
  script, lists the creator's carts (`GET /carts`), and offers cart picker +
  optional note + **Add**. Minimal inline edit of title/price is allowed before
  adding.

**Manifest V3 keys:**
- `manifest_version: 3`
- `permissions`: `activeTab`, `scripting`, `storage`
- `host_permissions`: the five retailer origins + `https://shoplit.in/*`
- `content_scripts`: matches the five retailer product domains
- `action`: default popup
- `externally_connectable.matches`: `https://shoplit.in/*`

### Component 2 — Backend additions (shoplit-api)

- **`extension_tokens` table** (migration): `id`, `user_id` (FK), `token_hash`
  (sha256 of the token — never store the raw token), `created_at`,
  `last_used_at`, `revoked_at` (nullable). Index on `token_hash`.
- **`POST /api/v1/extension/token`** — authenticated (session cookie). Generates
  a random token (e.g. 32 bytes base64url), stores its hash, returns the raw
  token once. Used by the connect page.
- **Bearer auth in `RequireUser`** — the middleware first checks the session
  cookie (current behavior); if absent, it accepts `Authorization: Bearer
  <token>`, looks up the (unrevoked) token by hash, resolves the user, and
  updates `last_used_at`. This is additive — existing cookie flows are untouched.
- **Reused, unchanged:** `GET /api/v1/carts` (picker), `POST
  /api/v1/carts/{id}/items` (the existing explicit-fields add path that mints the
  `/go` link), `GET /api/v1/me`.

### Component 3 — Frontend connect page

`shoplit.in/connect-extension` (authenticated; redirects to `/login` if not).
On load it calls `POST /api/v1/extension/token`, then hands the token to the
extension via `chrome.runtime.sendMessage(EXTENSION_ID, { type: "shoplit-token",
token })`. If the extension isn't detected, it falls back to displaying the token
as a one-time **copy-paste code** the creator pastes into the extension popup.
The page warns the token grants cart access and to keep it private.

## Extraction strategy (generic, per-page, in order)

1. **JSON-LD** — parse every `<script type="application/ld+json">`, find an
   object (or `@graph` entry) with `@type: "Product"`; read `name`, `image`
   (string or array → first), `offers.price` + `offers.priceCurrency`, `url`.
   Nykaa, Amazon, and most retailers emit this.
2. **OG / meta fallback** — `og:title`/`twitter:title`, `og:image`/
   `twitter:image`, `product:price:amount` + `product:price:currency`.
3. **Per-site selector fallback** — a small map keyed by hostname for fields the
   above miss (kept intentionally tiny; only added where observed necessary).

Retailer is classified from the hostname (a JS port of the Go `RetailerFromURL`,
including the `amzn.in`/`amzn.to`/`a.co` short hosts). Canonical URL: `<link
rel="canonical">` → `og:url` → `location.href`. Price is normalized to a display
string (e.g. `₹590`).

## Add flow

1. Creator on a product page clicks the toolbar icon or the injected button.
2. Content script extracts `{ title, imageUrl, priceText, url (canonical),
   retailer }`.
3. Popup shows the product, fetches `GET /carts` (Bearer) for the picker.
4. Creator picks a cart, optionally edits title/price or adds a note, clicks Add.
5. Service worker `POST /api/v1/carts/{id}/items` (Bearer) with the fields.
6. Backend runs the existing `AddProduct` path (mints the `/go` link, stores the
   item). Returns success.
7. Popup shows "Added ✓" with a link to the cart.

## Error handling

- **Not a product page / nothing extracted** — popup shows "Couldn't find a
  product here" with manual fields (title/image/price) so the add never
  dead-ends.
- **Not connected / token revoked or invalid (401)** — popup drops to the
  Connect state and prompts re-connect.
- **API/network error on add** — inline error + retry; the extracted data stays
  in the popup so nothing is lost.
- **Multiple JSON-LD products on a page** — prefer the one whose `url` matches
  the canonical URL, else the first.

## Security

- Token stored only in `chrome.storage.local` (extension-private). Backend stores
  only its sha256 hash; supports revocation via `revoked_at`.
- `externally_connectable` restricts which web origin can message the extension
  to `shoplit.in`.
- The connect page mints a token only for an authenticated session.
- Content script footprint on retailer pages is minimal and read-only with
  respect to the host page (aside from the injected button element).

## Testing

- **Backend:** unit/integration tests for token mint and Bearer-auth resolution
  in `RequireUser`, mirroring the existing carts handler tests (testcontainers).
- **Extension:** extraction unit tests against saved HTML fixtures (real Nykaa /
  Myntra / Amazon / Flipkart / AJIO product pages) asserting title/image/price;
  manual end-to-end on each retailer for the popup + injected-button + add flow.

## Repo layout

```
extension/
  manifest.json
  src/
    content.ts       # extraction + injected button
    service-worker.ts
    popup.ts / popup.html
    extract.ts       # JSON-LD/OG/selector logic (unit-tested)
    retailer.ts      # hostname → retailer (JS port of RetailerFromURL)
    api.ts           # shoplit API client (Bearer)
  build.mjs          # esbuild
internal/db/migrations/000X_extension_tokens.{up,down}.sql
internal/auth/…      # Bearer-token resolution
web/app/connect-extension/page.tsx
```
