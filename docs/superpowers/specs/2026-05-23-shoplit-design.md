# shoplit — v1 Design

**Repo:** `github.com/mayur-tolexo/shoplit`
**Status:** Draft for review
**Date:** 2026-05-23

## Summary

shoplit is a free, open-source tool that lets creators build curated **carts** of products from any shopping site (Amazon, Myntra, Nykaa, Flipkart, AJIO, …) and share each cart as a short URL. It also supports **single-product** short URLs that redirect directly to the shop. Every outbound product click is routed through shoplit and rewritten with an affiliate tag — affiliate revenue funds the service so it can stay free for creators and viewers.

## Goals

- Creators sign in, build carts, and share short URLs (`/c/{slug}`).
- Creators also create single-product short URLs (`/p/{slug}`) that redirect straight to the shop.
- Viewers need **no account** to open cart pages or click product links.
- Every outbound click is redirected via shoplit and rewritten with the appropriate retailer affiliate tag.
- Share links stay reachable even during API deploys or partial outages — share-link reliability is the load-bearing property of this product.
- Free for everyone; costs covered by affiliate revenue.

## Non-Goals (v1)

The following are explicitly deferred to v2 ("shoplit social"). Mentioned only so the v1 data model leaves space:

- Creator discovery feed, follow graph, recommendations
- Viewer accounts, wishlists, reviews/ratings
- Mobile apps; web only at launch
- Price-drop alerts, inventory tracking
- Multi-language UI (English at launch)
- In-app checkout — we always redirect out

## Locked Decisions

| # | Decision |
|---|---|
| 1 | Repo: `github.com/mayur-tolexo/shoplit` |
| 2 | Sign-in (creators only): Google OAuth + Phone OTP |
| 3 | Viewers need no account; all share links are public |
| 4 | Product entry: paste URL → fetch Open Graph meta tags → user edits |
| 5 | All outbound clicks redirect through shoplit with affiliate tag injected |
| 6 | Two link types: `/c/{slug}` cart page (HTML), `/p/{slug}` single-product redirect |
| 7 | Cart pages are **live** — the short URL always reflects the latest state |
| 8 | Stack: Go (backend) + Next.js (frontend) + Postgres + Redis |
| 9 | Three services: `shoplit-api`, `shoplit-redirect`, `shoplit-web` |

## URL scheme

| Path | Purpose | Auth |
|---|---|---|
| `/` | Landing | public |
| `/login` | Google + phone OTP | public |
| `/dashboard` | Creator's carts | session |
| `/dashboard/carts/{id}` | Cart editor | session |
| `/c/{slug}` | Public cart page (SSR) | public |
| `/p/{slug}` | Single-product short URL → 302 to shop | public |
| `/go/{slug}` | Click from inside a cart page → 302 to shop | public |
| `/api/v1/*` | JSON API for the dashboard | JWT session |
| `/api/public/carts/{slug}` | Public cart JSON for SSR | public |

Slugs are 8-char nanoid (URL-safe, no ambiguous chars). Creators may set a custom slug (3–32 chars, kebab-lowercase) for carts only.

`/p` and `/go` are split namespaces so a custom vanity slug for a cart can't collide with a single-product short URL.

## Architecture

```
                       ┌──────────────────────────────┐
   Viewer (no login) ─▶│   Next.js (Vercel)           │
                       │   - / landing                │
                       │   - /c/{slug} (SSR + OG tags)│
                       │   - /dashboard (CSR)         │
                       └───────────┬──────────────────┘
                                   │ fetch JSON
                                   ▼
   Creator (logged in) ───▶┌──────────────────────────┐
                           │  shoplit-api  (Go)       │── OG fetcher
                           │  /api/v1/*               │── click-drain worker
                           │  /api/public/carts/...   │
                           └─────────┬────────────────┘
                                     │
                       ┌─────────────┴────────┐
                       ▼                      ▼
                  ┌─────────┐             ┌─────────┐
                  │Postgres │             │ Redis   │
                  └────▲────┘             └────▲────┘
                       │                       │
   Viewer click ──────▶│         ┌─────────────┴──────┐
   GET /go/{slug}      └────────▶│ shoplit-redirect   │── 302 ─▶ Amazon/Myntra/...
   GET /p/{slug}                 │ (Go, tiny)         │       (with affiliate tag)
                                 │ resolves slug,     │
                                 │ injects affiliate, │
                                 │ logs click         │
                                 └────────────────────┘
```

**Three deployable units:**

1. **`shoplit-api`** (Go) — all creator-facing endpoints, OG-fetch worker, click-drain worker, public cart JSON. Behind login except `/api/public/*`.
2. **`shoplit-redirect`** (Go) — *only* handles `/p/{slug}` and `/go/{slug}`. Stateless, deployable independently. Reads from Redis with a Postgres fallback. Sized so it can be scaled and cached without touching the API.
3. **`shoplit-web`** (Next.js, Vercel) — landing, cart pages (SSR with OG meta tags for WhatsApp/Twitter unfurls), creator dashboard (CSR after login).

**Why split the redirect path:** the redirect is shoplit's load-bearing wall. If a creator has shared a link with 10k followers, that link must keep working through deploys, schema migrations, or partial outages. Isolating the redirect into a small Go service with aggressive Redis caching means an API outage doesn't take down share links.

**Click flow:** every redirect increments a Redis counter (`clicks:{link_id}:{minute_bucket}`). A drain worker inside `shoplit-api` flushes counters older than the current minute into `click_events` and `click_daily` every ~30s. This keeps the redirect hot path under 20ms even at peak.

## Data Model — Postgres

```sql
-- creators
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT UNIQUE,           -- nullable if phone-only signup
  phone           TEXT UNIQUE,             -- E.164, nullable if google-only
  google_sub      TEXT UNIQUE,             -- Google "sub" claim
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  handle          CITEXT UNIQUE,           -- vanity, e.g. "mayur"; reserved later for v2
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at       TIMESTAMPTZ
);

-- shareable carts
CREATE TABLE carts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  slug            CITEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX carts_user_idx ON carts(user_id) WHERE archived_at IS NULL;

-- every shareable URL — single-product OR a click-target inside a cart
CREATE TABLE links (
  id              BIGSERIAL PRIMARY KEY,
  slug            CITEXT NOT NULL UNIQUE,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  original_url    TEXT NOT NULL,
  retailer        TEXT NOT NULL,           -- normalized hostname: "amazon.in", "myntra.com"
  link_type       TEXT NOT NULL,           -- 'single' | 'in_cart'
  cart_id         BIGINT REFERENCES carts(id),  -- non-null when link_type='in_cart'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at     TIMESTAMPTZ,
  CONSTRAINT cart_required_for_in_cart CHECK (
    (link_type = 'single' AND cart_id IS NULL) OR
    (link_type = 'in_cart' AND cart_id IS NOT NULL)
  )
);
CREATE INDEX links_user_idx ON links(user_id);
CREATE INDEX links_cart_idx ON links(cart_id);

-- products displayed inside a cart (order matters)
CREATE TABLE cart_items (
  id              BIGSERIAL PRIMARY KEY,
  cart_id         BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  position        INT NOT NULL,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  title           TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  price_text      TEXT,                    -- freeform string; currencies/variants are messy
  retailer        TEXT,                    -- inferred from URL on add
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cart_id, position)
);
CREATE INDEX cart_items_cart_idx ON cart_items(cart_id);

-- click events (flushed from Redis)
CREATE TABLE click_events (
  id              BIGSERIAL PRIMARY KEY,
  link_id         BIGINT NOT NULL REFERENCES links(id),
  occurred_at     TIMESTAMPTZ NOT NULL,
  country_code    TEXT,
  user_agent_kind TEXT,                    -- 'ios' | 'android' | 'desktop' | 'other'
  referer_host    TEXT
);
CREATE INDEX click_events_link_time ON click_events(link_id, occurred_at);

-- daily rollups for fast analytics
CREATE TABLE click_daily (
  link_id         BIGINT NOT NULL REFERENCES links(id),
  day             DATE NOT NULL,
  clicks          INT NOT NULL,
  PRIMARY KEY (link_id, day)
);

CREATE TABLE cart_views_daily (
  cart_id         BIGINT NOT NULL REFERENCES carts(id),
  day             DATE NOT NULL,
  views           INT NOT NULL,
  PRIMARY KEY (cart_id, day)
);

-- OTP abuse control
CREATE TABLE otp_attempts (
  id              BIGSERIAL PRIMARY KEY,
  phone           TEXT NOT NULL,
  ip              INET NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at     TIMESTAMPTZ
);
CREATE INDEX otp_attempts_phone_time ON otp_attempts(phone, sent_at DESC);
```

## Data Model — Redis

| Key | Value | TTL | Purpose |
|---|---|---|---|
| `link:{slug}` | JSON `{original_url, retailer, link_id, strategy}` | 1h | Redirect lookup cache |
| `cart:{slug}` | JSON of public cart payload | 5m | SSR cache (invalidated on cart edit) |
| `og:{sha256(url)}` | JSON of OG-fetch result | 24h | OG-fetch cache |
| `clicks:{link_id}:{minute}` | counter | 5m | Click bucket, drained every 30s |
| `otp:rl:phone:{phone}` | counter (cap 5/hour) | 1h | OTP rate limit |
| `otp:rl:ip:{ip}` | counter (cap 20/hour) | 1h | OTP rate limit |

## Components

### `shoplit-api` (Go)

```
cmd/shoplit-api/main.go
internal/
  auth/        # Google OAuth + phone OTP (MSG91), JWT sessions
  carts/       # cart CRUD
  products/    # cart-item CRUD, reorder
  links/       # slug generation, link creation
  ogfetch/     # paste-URL → OG meta tags; polite UA, 5s timeout, 24h cache
  affiliate/   # retailer detection + tag injection rules (shared with redirect)
  analytics/   # views/clicks reads; click-stream drain worker
  ratelimit/   # token-bucket via Redis
  db/          # sqlc-generated queries
  http/        # chi router, middleware, handlers
pkg/slug/      # nanoid-based slug generator
```

Key endpoints (`/api/v1/*`, JSON, JWT-auth except where noted):

- `POST /auth/google` — exchange Google ID token for session JWT
- `POST /auth/otp/send` — start phone OTP
- `POST /auth/otp/verify` — finish phone OTP → session JWT
- `GET  /me`
- `POST /carts` — create
- `GET  /carts` — list mine
- `GET  /carts/{id}` — read
- `PATCH /carts/{id}` — edit title/desc/cover/slug
- `DELETE /carts/{id}` — archive
- `POST /carts/{id}/items` — body: `{paste_url}` OR `{title, image_url, description, original_url, price_text}` (auto-runs OG-fetch on paste_url)
- `PATCH /carts/{id}/items/{item_id}` — edit fields or position
- `DELETE /carts/{id}/items/{item_id}`
- `POST /links` — standalone single-product link
- `GET  /carts/{id}/analytics?range=7d|30d|all` — views + clicks + top products
- `GET  /og-fetch?url=...` — utility for live preview while pasting (cached)

Public:

- `GET /api/public/carts/{slug}` — cart payload for SSR + the cart page itself

### `shoplit-redirect` (Go)

```
cmd/shoplit-redirect/main.go
internal/
  resolver/   # slug → link record (Redis → Postgres fallback)
  affiliate/  # shared rules package
  clicks/     # Redis counter increment, async drain stream
  http/       # two routes: /p/{slug}, /go/{slug}
```

Both Go services live in **one Go module** (the `shoplit` repo) with two `cmd/` entrypoints (`cmd/shoplit-api`, `cmd/shoplit-redirect`). They share `internal/affiliate`, `internal/db` (schema and sqlc-generated queries), and `internal/redis`. They build as separate binaries, deploy independently with separate health checks, and never call each other at runtime. `shoplit-redirect` opens Postgres in **read-only** mode (statement role limited to `SELECT` on `links`); all writes are owned by `shoplit-api`.

### `shoplit-web` (Next.js)

```
app/
  page.tsx                       # landing
  login/page.tsx                 # Google + phone OTP
  dashboard/page.tsx             # cart list
  dashboard/carts/[id]/page.tsx  # editor: drag-to-reorder, paste-URL → preview
  c/[slug]/page.tsx              # public cart, SSR with OG tags for unfurls
components/
  cart-editor/
  product-card/
  paste-url-input/
lib/
  api-client.ts                  # typed client for shoplit-api
```

Public cart pages are SSR so WhatsApp/Twitter unfurls work (OG meta tags emitted server-side). Dashboard is CSR after sign-in.

### Affiliate-tag injection rules

A `affiliate.Rule` interface keyed by retailer hostname suffix. Initial implementations:

| Retailer | Strategy |
|---|---|
| `amazon.in`, `amazon.com` | Append `?tag=shoplit-21` (Amazon Associates) |
| `myntra.com` | Append `utm_source=shoplit&utm_medium=affiliate`; switch to Cuelinks deeplink once approved |
| `nykaa.com` | Same UTM pattern; switch to Nykaa Affiliate Network params once approved |
| `flipkart.com` | `affid=shoplit` |
| Unknown retailer | Pass through unchanged |

Rules live in one file (`internal/affiliate/rules.go`) and are shared between `shoplit-api` (for showing creators what the rewritten URL will be) and `shoplit-redirect` (for actually rewriting at click time).

**Failsafe:** if a rule errors or the program isn't yet approved, redirect to the raw URL. Never break a click for an affiliate-tag failure.

## Key data flows

1. **Creator pastes Amazon URL into the editor**
   Frontend calls `GET /api/v1/og-fetch?url=...`. Server checks `og:{hash}` cache; on miss, HTTP GET with browser User-Agent, 5s timeout. Parses `og:title`, `og:image`, `product:price:amount`. Returns `{title, image_url, price_text, retailer}`. Caches 24h. Frontend pre-fills the product form; creator edits and saves.
2. **Creator saves a cart item**
   `POST /carts/{id}/items` with the (possibly edited) fields. API inserts a `link` row (auto slug) + `cart_item` row, invalidates `cart:{slug}` cache, returns canonical `/go/{slug}`.
3. **Viewer opens shared link `/c/abc123`**
   Next.js SSR calls `GET /api/public/carts/abc123`. Cached in Redis (`cart:abc123`, 5m). Page rendered with OG meta tags pointing to `cover_image_url` so previews unfurl on WhatsApp. View counted via fire-and-forget `POST /api/public/carts/abc123/view` (deduped per visitor cookie, daily).
4. **Viewer clicks a product → `/go/xy7Q`**
   `shoplit-redirect` resolves slug from Redis (miss → Postgres → backfill Redis), applies affiliate rule for the retailer, 302s to the final URL. Increments `clicks:{link_id}:{minute_bucket}`.
5. **Click drain worker (inside `shoplit-api`)**
   Every 30s, reads minute-bucket counters older than the current minute, inserts rows into `click_events`, upserts `click_daily`, deletes drained Redis keys.

## Error handling

- **OG fetch times out or returns 403 (Amazon's anti-bot):** return partial result `{retailer}` only. UI shows "Couldn't auto-fill — please add the title and image manually." Never block saving.
- **OG fetch returns junk (no `og:title`, no `og:image`):** treat the URL as a real product URL anyway — fall back to manual entry.
- **Affiliate rule missing / program errors at rewrite time:** redirect to original URL, log to an `affiliate_errors` log line. Viewer never sees an error.
- **Slug collision on insert:** retry generation up to 5 times, then 500 (vanishingly rare with 8-char nanoid).
- **OTP abuse:** Redis rate-limits per phone (5/h) and per IP (20/h). 5 failed verify attempts → 1h phone lockout. Logged in `otp_attempts`.
- **`shoplit-redirect` can't reach Redis:** falls back to Postgres directly. Performance degrades but service stays up.
- **`shoplit-redirect` can't reach Postgres either:** returns 302 to a `/error/offline` landing page on `shoplit-web`. Logged for paging.
- **`shoplit-api` is down (cart pages depend on it):** see the caveat below.

### Caveat: cart-page reliability still depends on the API

`/api/public/carts/{slug}` is served by `shoplit-api`. If the API is down, cart pages will fail to render even though the redirect path stays up.

The redirect path (`/go/{slug}`, `/p/{slug}`) is fully isolated, as designed.

**v1 decision:** accept this for the cart-page path. The redirect path — which is the actual link followers click — is isolated.

**v1.1 plan:** duplicate a thin read-only `/public/carts/{slug}` handler into `shoplit-redirect`. Same package, same DB, ~50 LOC. Brings cart pages to the same reliability tier as redirects.

## Testing strategy

- **Unit tests** (pure Go, no I/O): slug generator, affiliate rule mapping, retailer-from-hostname detection, OG meta parser, OTP rate limiter math.
- **Integration tests** with real Postgres (testcontainers-go) and miniredis: cart CRUD, click-drain worker correctness, redirect resolver fallbacks, OTP verify flow. **No DB mocking** — integration tests must hit a real Postgres.
- **HTTP-level tests** with `httptest` against both Go services: 302 status, `Location` header is the rewritten URL, click counter increments.
- **OG-fetch tests** stub the outbound HTTP client with fixtures from real Amazon/Myntra/Nykaa pages.
- **Frontend E2E** with Playwright on the critical path: sign-in → create cart → paste URL → save → open public link → click product → land on retailer.
- **Smoke tests** post-deploy: hit `/health` on both Go services and follow a canary `/go/{slug}` test link.

## Deployment

| Service | Platform | Tier | Notes |
|---|---|---|---|
| `shoplit-redirect` | Railway or Fly.io | Hobby | Separate app from API for blast-radius isolation |
| `shoplit-api` | Railway or Fly.io | Hobby | |
| `shoplit-web` | Vercel | Free | SSR for `/c/{slug}`; static for the rest |
| Postgres | Neon | Free | Branch DB for staging |
| Redis | Upstash | Free | 10k commands/day on free tier; revisit when exceeded |

DNS layout:
- `shoplit.app` → Vercel
- `api.shoplit.app` → `shoplit-api`
- `s.shoplit.app` → `shoplit-redirect` (short host so links are shorter; `/p/xy7Q`)

Secrets in 1Password and provider env-vars. CI on GitHub Actions: lint + test on PR, deploy on push to `main`.

## Compliance & disclosure

- Cart-page footer: "shoplit links contain affiliate tags. We may earn a commission when you shop through them."
- `/legal/privacy` and `/legal/terms` — boilerplate templates reviewed before launch.
- No third-party tracking pixels in v1.
- Cookie banner: minimal. Only first-party session cookie + anonymous visitor cookie (UUID, used for view-dedup only).
- GDPR/DPDP: a creator can delete their account; we hard-delete `users`, cascade `carts` and `cart_items`, soft-delete `links` (preserves click history without PII).

## Risks & open questions

- **Amazon Associates India approval** typically requires an active site with traffic. We'll launch with `utm_source=shoplit` placeholders and switch to real tags once approved. Build assuming the rule swap is a config change, not a code change.
- **OG-fetch may get blocked** by Amazon's anti-bot at scale. If systemic, rotate IPs (small cost) or fall back to manual-only entry for amazon.in.
- **Free-tier limits** at Vercel/Neon/Upstash are generous but not unlimited. Hosting cost ceiling at MVP: ~$0/month. Expect ~$20–$50/month once we exceed ~5k cart views/day.
- **Abuse:** someone creates carts pointing to scam/malware sites. v1 mitigation: a manual-review flag on user_id (banned_at), a "report this cart" link on every public cart page, and an internal `/admin/reports` queue page (auth-gated to a hardcoded user list at launch).

## What's deferred to v2 (so we don't accidentally design it out)

| Feature | Data-model implication for v1 |
|---|---|
| Creator profiles + handle pages | `users.handle` field already exists |
| Discovery feed | `carts.is_public` already exists |
| Viewer accounts | No v1 changes; new `viewers` table later |
| Wishlist | New `wishlist_items` table later, references `cart_items.id` |
| Reviews/ratings | New `cart_reviews` and `product_reviews` tables later |
| Follow graph | New `follows` table later |
| Mobile app | API is already JSON-first; we'll add OAuth refresh-token flow then |

---

**End of v1 design.**
