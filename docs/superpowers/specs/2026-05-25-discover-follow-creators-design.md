# Discover & Follow Creators — Design

Date: 2026-05-25
Status: Approved for implementation

## Overview

Add a social discovery layer to shoplit:

- **Discover creators** — a public page listing creators (users with ≥1 public cart), ranked by recent popularity.
- **Creator profiles** — a public page per creator at `/u/{handle}` showing their public carts and a Follow button.
- **Follow creators** — logged-in users follow/unfollow creators; a personal **Following feed** aggregates the public carts of everyone they follow.

This is the source-of-truth contract for two parallel implementation tracks (backend Go, frontend Next.js). Field names below are normative — do not rename them.

## Scope decisions

- Discover (`/discover`) and profiles (`/u/{handle}`) are **public / unauthenticated** (same as `/c/{slug}`). Good for sharing & SEO.
- Follow/unfollow and the Following feed (`/dashboard/following`) **require login**. A Follow button while logged out routes to `/login`.
- A creator only appears in Discover / has a populated profile if they have **≥1 public, non-archived cart**.
- **No new user-level bio field in v1** — carts carry the personality. (Future enhancement.)
- Following feed is ordered by cart `created_at` **descending** (newest carts first).
- Discover ranking v1 = **7-day cart views** (single clean join, no fan-out). Tiebreak: most-recently-updated cart, then user id. Clicks as a future tiebreak. (Engagement = views for v1.)
- All UX must be **mobile-web compatible** (responsive, touch-friendly). See Mobile requirements.

## Data model — migration `0008_follows`

`internal/db/migrations/0008_follows.up.sql`:

```sql
CREATE TABLE follows (
  follower_id  BIGINT NOT NULL REFERENCES users(id),
  creator_id   BIGINT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> creator_id)
);
CREATE INDEX follows_creator_idx ON follows(creator_id);   -- follower counts / followers of X
CREATE INDEX follows_follower_idx ON follows(follower_id);  -- who I follow / feed
```

`0008_follows.down.sql`:

```sql
DROP TABLE IF EXISTS follows;
```

## Backend

### sqlc queries (append to `internal/db/queries.sql`, then `sqlc generate`)

```sql
-- ─── FOLLOWS / CREATORS ──────────────────────────────────────────────────────

-- name: FollowCreator :exec
INSERT INTO follows (follower_id, creator_id)
VALUES ($1, $2)
ON CONFLICT (follower_id, creator_id) DO NOTHING;

-- name: UnfollowCreator :exec
DELETE FROM follows WHERE follower_id = $1 AND creator_id = $2;

-- name: CountFollowers :one
SELECT COUNT(*)::bigint AS followers FROM follows WHERE creator_id = $1;

-- name: IsFollowing :one
SELECT EXISTS (
  SELECT 1 FROM follows WHERE follower_id = $1 AND creator_id = $2
) AS following;

-- name: GetUserByHandle :one
SELECT * FROM users WHERE handle = $1 AND banned_at IS NULL;

-- name: ListPublicCartsByUser :many
SELECT * FROM carts
WHERE user_id = $1 AND visibility = 'public' AND archived_at IS NULL
ORDER BY created_at DESC;

-- name: DiscoverCreators :many
-- Creators (users with >=1 public, non-archived cart) ranked by 7-day cart
-- views. cart_count counts public carts; follower_count via correlated
-- subquery to avoid join fan-out.
SELECT
  u.id,
  u.handle,
  u.display_name,
  u.avatar_url,
  COUNT(DISTINCT c.id)::bigint AS cart_count,
  (SELECT COUNT(*) FROM follows f WHERE f.creator_id = u.id)::bigint AS follower_count,
  COALESCE(SUM(cv.views), 0)::bigint AS views_7d
FROM users u
JOIN carts c
  ON c.user_id = u.id AND c.visibility = 'public' AND c.archived_at IS NULL
LEFT JOIN cart_views_daily cv
  ON cv.cart_id = c.id AND cv.day >= current_date - 6
WHERE u.banned_at IS NULL AND u.handle IS NOT NULL
GROUP BY u.id, u.handle, u.display_name, u.avatar_url
ORDER BY views_7d DESC, MAX(c.updated_at) DESC, u.id
LIMIT $1 OFFSET $2;

-- name: ListFollowingCartIDs :many
-- Public, non-archived carts owned by creators that $1 follows, newest first.
SELECT c.*
FROM carts c
JOIN follows f ON f.creator_id = c.user_id
WHERE f.follower_id = $1 AND c.visibility = 'public' AND c.archived_at IS NULL
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3;
```

### New package `internal/creators`

Mirror `internal/carts` layout: `service.go`, `handlers.go`, `marshal.go`, plus `service_test.go` and `handlers_test.go`.

`Service` wraps `*sqlcgen.Queries`. It may depend on `*carts.Service` (or hold its own `q`) to build full `CartJSON` for profile/feed cards. Reuse `carts.MarshalCart` and `carts.CartJSON` for cart payloads (import the carts package) so the frontend `Cart` type is shared. **Pass analytics counts as 0** for public profile/feed carts (do not leak another creator's view/click/reach numbers).

Service methods:
- `DiscoverCreators(ctx, limit, offset) ([]CreatorRow, error)` — maps the sqlc row; `isFollowing` filled by handler when a viewer session exists (batch or per-row `IsFollowing`).
- `GetCreatorProfile(ctx, handle, viewerID) (user, cartsWithItems, followerCount, isFollowing, error)` — `ErrNotFound` (pgx.ErrNoRows) if handle unknown/banned.
- `Follow(ctx, followerID, handle) (followerCount int64, err error)` — resolve handle→creator id; reject self-follow with `ErrSelfFollow`; `ErrNotFound` if handle unknown.
- `Unfollow(ctx, followerID, handle) (followerCount int64, err error)`.
- `FollowingFeed(ctx, followerID, limit, offset) ([]CartJSON, error)` — list carts via `ListFollowingCartIDs`, fetch items per cart (same N+1 pattern as `carts.listCarts`), marshal with 0 analytics.

Sensible defaults: `limit` defaults to 24 when absent/invalid, clamp to [1,60]; `offset` defaults to 0.

### JSON contract (normative)

`Creator`:
```json
{
  "handle": "priya.styles",
  "displayName": "Priya Sharma",
  "avatarUrl": "https://…",
  "cartCount": 5,
  "followerCount": 128,
  "isFollowing": false
}
```

`Cart` reuses the existing `CartJSON` shape (see `internal/carts/marshal.go` / `web/lib/types.ts`). In public profile/feed contexts `viewsLast7d`/`clicksLast7d`/`reachLast7d` are `0`.

### Routes

Public (mounted under `/api/public`, optional session read like `getPublicCart`):
- `GET /api/public/creators?limit=&offset=` → `Creator[]` (bare array; shorter-than-limit page = end).
- `GET /api/public/creators/{handle}` → `{ "creator": Creator, "carts": Cart[] }`; 404 if handle unknown/banned.

Authed (mounted under `/api/v1`, behind `RequireUser`):
- `POST   /api/v1/creators/{handle}/follow`   → `200 { "following": true,  "followerCount": 129 }`; 404 unknown handle; 400 self-follow.
- `DELETE /api/v1/creators/{handle}/follow`   → `200 { "following": false, "followerCount": 128 }`.
- `GET    /api/v1/following?limit=&offset=`    → `Cart[]` (public carts of followed creators, newest first).

Wire registration in `cmd/shoplit-api/main.go`: a `creators.RegisterPublicRoutes(r, svc, sm)` inside the `/api/public` block and `creators.RegisterRoutes(r, svc)` inside the `/api/v1` block (which already applies `RequireUser`). The public discover/profile handlers read the optional viewer session via the passed `*auth.SessionManager` (nil-safe).

### Errors & edges
- Unknown handle → 404 (consistent with cart 404s, no info leak).
- Self-follow rejected in DB (`no_self_follow` CHECK) **and** service (`ErrSelfFollow` → 400) so the API gives a clean error before hitting the constraint.
- Follow/unfollow idempotent (`ON CONFLICT DO NOTHING` / `DELETE` of nothing).
- Banned users excluded from discover, profile, and counts surfaces.

## Frontend (Next.js, `web/`)

### Types (`web/lib/types.ts`)
Add:
```ts
export interface Creator {
  handle: string;
  displayName: string;
  avatarUrl: string;
  cartCount: number;
  followerCount: number;
  isFollowing: boolean;
}
```

### API client (`web/lib/api-client.ts`)
Add:
- `listCreators(opts?, { limit?, offset? }) : Promise<Creator[]>` → `GET /api/public/creators`.
- `getCreatorProfile(handle, opts?) : Promise<{ creator: Creator; carts: Cart[] } | null>` → `GET /api/public/creators/{handle}` (null on 404).
- `followCreator(handle) : Promise<{ following: boolean; followerCount: number }>` → `POST`.
- `unfollowCreator(handle) : Promise<{ following: boolean; followerCount: number }>` → `DELETE`.
- `getFollowingFeed(opts?, { limit?, offset? }) : Promise<Cart[]>` → `GET /api/v1/following`.

### Pages
- **`/discover`** (`web/app/(public)/discover/page.tsx`, server component, `force-dynamic`): renders `<MarketingNav />` + heading + responsive grid of creator cards + `<Footer />`. Forward `cookies().toString()` so `isFollowing` reflects the viewer.
- **`/u/[handle]`** (`web/app/(public)/u/[handle]/page.tsx`, server component, `force-dynamic`): `<MarketingNav />` + profile header (avatar, displayName, `@handle`, follower count, `<FollowButton>`) + responsive grid of the creator's public carts (reuse `CartCard` with `showStats={false}`, `href={`/c/${slug}`}`). `notFound()` on null. Include `generateMetadata` (title `@handle · shoplit`, og image = avatar if absolute).
- **`/dashboard/following`** (`web/app/dashboard/following/page.tsx`, server component): feed grid of recent carts from followed creators (reuse `CartCard` with `showStats={false}`, `showOwner`, `href={`/c/${slug}`}`). Empty state: friendly copy + CTA button → `/discover`.

### Components
- **`<FollowButton creator={Creator} />`** (`web/components/follow-button.tsx`, client): shows "Follow"/"Following" with optimistic toggle and follower-count update; reconciles from the API response; reverts + toasts on error. If the request 401s (logged out), route to `/login`. Touch target ≥44px.
- Extend **`CartCard`** with two optional, backwards-compatible props: `showStats?: boolean` (default `true`; when false, hide views/clicks/reach + Share button + private badge — public contexts) and `showOwner?: boolean` (default `false`; when true, render owner avatar + `@ownerHandle` from the cart fields — used in the feed).
- **Creator card** for the discover grid: may be inline in the page or a small `creator-card.tsx`. Shows avatar, displayName, `@handle`, cart count, follower count, and a `<FollowButton>`. Whole card links to `/u/{handle}` (Follow button stops propagation, like `CartCard`'s copy button).

### Navigation
- **Marketing nav** (`nav-bar.tsx`, `variant="marketing"`): add a **Discover** link (always visible).
- **App nav** (`nav-bar.tsx`, `variant="app"`, desktop): add **Discover** and **Following** links.
- **MobileBottomNav** (`mobile-bottom-nav.tsx`): include destinations **Carts, Discover, Add (center), Following**. Sign-out is already reachable via the top-right avatar dropdown, so it may move out of the bottom bar. Keep 44px+ targets, `env(safe-area-inset-bottom)` padding, `sm:hidden`.

### Mobile requirements (apply to every new surface)
- Responsive grids: `grid-cols-2` on mobile → `lg:grid-cols-3` (match existing cart grids), `gap-3 sm:gap-5`.
- All tappable controls ≥44×44px; primary actions never hover-only.
- Profile/discover headers stack vertically on mobile, horizontal at `sm:`.
- Respect safe-area insets where fixed elements exist; no horizontal overflow at 360px width.
- Verify layouts at 360px and 768px.

## Testing

### Backend (Go, testcontainers Postgres — `pkg/testutil.NewPostgres`)
`internal/creators/service_test.go`:
- follow then unfollow; follower count transitions; follow idempotency (double follow = 1 row); unfollow of non-followed = no-op.
- self-follow rejected (`ErrSelfFollow`).
- discover lists only creators with public carts; private-only creator excluded; ordering by 7-day views (seed `cart_views_daily`).
- profile returns only public carts (private/archived excluded); unknown handle → ErrNotFound.
- following feed returns followed creators' public carts newest-first; excludes non-followed and private carts.

`internal/creators/handlers_test.go` (mirror `carts/handlers_test.go` + `publicapi/handlers_test.go`):
- `POST`/`DELETE` follow return the `{following, followerCount}` body; self-follow → 400; unknown handle → 404.
- public discover/profile return expected JSON; profile 404 for unknown handle.
- following feed returns array for the injected user.

### Frontend (vitest)
- `api-client` request shapes for the new functions (URL, method).
- `FollowButton`: optimistic toggle updates label + count; reverts on rejected request; logged-out (401) routes to `/login`.

## Out of scope (v1)
- Notifications on new carts.
- User-level bio/profile editing.
- Clicks/reach in discover ranking (views only for v1).
- Follower/following list pages (only counts + feed).
- Pagination UI beyond simple limit/offset "load more" (optional; first page is enough for v1).
