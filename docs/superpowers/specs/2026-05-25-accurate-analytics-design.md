# Accurate analytics — design (self-view exclusion + unique reach)

**Date:** 2026-05-25
**Status:** Approved direction (decisions locked)

## Problem

Two accuracy gaps in cart analytics:
1. **Self-counting.** When the cart's owner opens their own public cart (`/c/{slug}`) or clicks their own product links (`/go/{slug}`), it inflates views/clicks. Creators want numbers that reflect *real followers*.
2. **No reach.** Clicks are a raw total (`click_daily` counter). Creators want **unique clicks (reach)** — how many distinct people clicked — to understand audience size.

## Decisions (locked)

- **Unique = distinct hashed visitor IP** over the window. IP is hashed (never stored raw); approximate (shared wifi/CGNAT), the normal trade-off for "reach".
- **Display both**: total **clicks** AND unique **reach**, e.g. `42 clicks · 18 reach (7d)`.
- **Exclude the owner**: when a logged-in owner views/clicks *their own* cart, neither views nor clicks count.

## Current state

- Views: `carts.Service.GetPublicCart` fire-and-forgets `BumpCartViewsDaily(cartID)`. The API public endpoint (`/api/public/carts/{slug}`) is unauthenticated and the web public page calls it **without forwarding the viewer's cookie**, so the API can't tell who's viewing.
- Clicks: the **separate** `shoplit-redirect` binary handles `/go/{slug}`; `LogClick` writes a `click_events` row (link_id, occurred_at, country, ua_kind, referer_host — **no visitor identity**) + `BumpClickDaily(linkID)`. `/go` is same-origin `shoplit.in`, so the owner's session cookie *is* sent on their own clicks.
- Counts read by `CartViews7d`, `CartClicks7d`; surfaced via `CartStats7d` → `MarshalCart(..., views, clicks)`; shown on the dashboard `CartCard` and stats row.

## Changes

### 1. DB migration (`0006_click_visitor_hash`)
- `ALTER TABLE click_events ADD COLUMN visitor_hash TEXT;` (nullable — historical rows stay null and are excluded from reach).
- Index for distinct counting: `CREATE INDEX click_events_link_visitor ON click_events(link_id, occurred_at, visitor_hash);`

### 2. Visitor hashing (shared helper)
- New `internal/analytics/visitor.go`: `VisitorHash(ip, salt string) string` = first 16 hex chars of `sha256(salt + "|" + ip)`. Salt = `cfg.SessionSecret` (already present in both binaries' config) so hashes aren't reversible/correlatable across deployments.
- Client IP: prefer the first hop in `X-Forwarded-For` (Caddy sets it), else `RemoteAddr` host. New `internal/httpx` helper `ClientIP(r)`.

### 3. Owner exclusion
- **Views (shoplit-api):** the web public page forwards the viewer's cookie to the API; the public handler resolves the *optional* session user (via the existing `SessionManager`) and passes a `viewerUserID` (0 if none) into `GetPublicCart`, which **skips `BumpCartViewsDaily` when `viewerUserID == cart.OwnerID`**.
  - `internal/publicapi` gains the `*auth.SessionManager` (passed from `main`); `carts.Service.GetPublicCart` takes a `viewerUserID int64` param.
  - `web/app/(public)/c/[slug]/page.tsx`: call `getCartBySlug(slug, { cookie: cookies().toString() })` (followers have no shoplit cookie, so nothing changes for them; only the owner is identified).
- **Clicks (shoplit-redirect):** give the redirect service the `SessionManager` + a query to fetch a link's cart owner. On each `/go` hit, resolve the optional session user; if it equals the link's cart owner, **skip both `BumpClickDaily` and the `click_events` insert**. Otherwise record as today, now with `visitor_hash`.
  - New query `LinkCartOwner(linkID) -> user_id` (nullable for single links with no cart).
  - **New env for redirect:** the redirect binary currently has no session secret, so it can't read the cookie. Add `SHOPLIT_SESSION_SECRET` to the redirect service config + `deploy/compose.prod.yaml` (`shoplit-redirect` env, same `${SHOPLIT_SESSION_SECRET}` as the api). Without it, owner-click exclusion is skipped (fails open — clicks still counted), so this env is required for the feature to fully work.

### 4. Unique reach query + plumbing
- New query `CartReach7d`: `SELECT COUNT(DISTINCT visitor_hash) FROM click_events ce JOIN links l ON ce.link_id = l.id WHERE l.cart_id = $1 AND ce.occurred_at >= now() - interval '7 days' AND ce.visitor_hash IS NOT NULL;`
- `carts.Service.CartStats7d` returns `(views, clicks, reach int64)`; `MarshalCart(c, owner, items, views, clicks, reach)` adds `reachLast7d` to the JSON.
- `Cart` type (`web/lib/types.ts`) gains `reachLast7d: number`.

### 5. Display
- Dashboard `CartCard` footer: `👁 views · 🖱 clicks · 👥 reach`. (Keep it compact; "reach" with a people icon.)
- Dashboard top stats row (if it shows clicks): add a "Reach (7d)" stat or append reach to the clicks card hint. Keep scope to the cards + the existing stats row.

## Non-goals (YAGNI)
- No per-product reach, no historical backfill of `visitor_hash` (old rows null → excluded from reach; views/clicks history unchanged).
- No geo/IP storage beyond the existing `country_code` (still unused/empty).
- No bot filtering beyond what exists.

## Privacy
- Raw IPs are never stored — only a salted, truncated SHA-256. The salt is the server session secret. Document this in the extension/site privacy pages if needed (follow-up).

## Testing
- **Go unit:** `analytics.VisitorHash` is deterministic + salted (same ip+salt → same hash; different salt → different); `httpx.ClientIP` parses XFF first-hop vs RemoteAddr. Owner-exclusion: `GetPublicCart` skips the bump when viewer==owner (table test with a fake querier/spy).
- **Manual:** as owner, open own cart + click own product → counts unchanged; from a different session/IP → views+clicks+reach increment; two clicks from one IP → clicks +2, reach +1.
- **Gates:** `go test ./...`, `go build ./...`, web `tsc`/`lint`/`build`.
