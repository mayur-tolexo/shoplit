# Admin panel — Design

Date: 2026-05-25
Status: Approved for implementation

Read-only admin panel at `/dashboard/admin`: platform totals, a per-user table, and per-user cart drill-down. Two tracks (Go backend, web frontend), disjoint files → parallelizable.

## Authorization (reuses the existing admin concept)
Admins are the user IDs in `SHOPLIT_ADMIN_USER_IDS` (already parsed to `adminIDs []int64` in `cmd/shoplit-api/main.go`; the feedback `ListHandler` already gates on this set). 
- In `main.go`, build `adminSet := map[int64]bool{...}` and `isAdmin := func(id int64) bool { return adminSet[id] }`.
- New `internal/admin` package provides `RequireAdmin(isAdmin)` middleware: reads `auth.UserIDFromContext`; if not present or `!isAdmin(uid)` → `403 forbidden`. Mounts `/admin/*` inside the existing `/api/v1` block (already behind `RequireUser`).
- Surface admin status to the frontend: add `isAdmin bool` (`json:"isAdmin"`) to the `/me` response so the UI can show the Admin nav entry + gate the page. The API `403` is the real enforcement; the UI gate is cosmetic.

## Contract (normative JSON)
- `GET /api/v1/admin/overview` → `{ "users", "carts", "publicCarts", "privateCarts", "products", "follows", "views7d", "clicks7d" }` (all numbers).
- `GET /api/v1/admin/users` → `AdminUser[]`: `{ "id":string, "handle", "displayName", "avatarUrl", "email", "createdAt":ISO, "carts":number, "followers":number, "following":number }` — newest first, `LIMIT 500`. (`email`/`handle`/`avatarUrl` are `""` when null.)
- `GET /api/v1/admin/users/{id}/carts` → `AdminUserCart[]`: `{ "id":string, "slug", "title", "visibility", "products":number, "views7d":number, "clicks7d":number, "createdAt":ISO }` — newest first.
- All three require admin (`403` otherwise; `401` if unauthenticated).

---

## Workstream A — Backend (Go)

### sqlc queries (append to `internal/db/queries.sql`, regen)
```sql
-- name: AdminOverview :one
SELECT
  (SELECT COUNT(*) FROM users)::bigint AS users,
  (SELECT COUNT(*) FROM carts WHERE archived_at IS NULL)::bigint AS carts,
  (SELECT COUNT(*) FROM carts WHERE archived_at IS NULL AND visibility = 'public')::bigint AS public_carts,
  (SELECT COUNT(*) FROM cart_items)::bigint AS products,
  (SELECT COUNT(*) FROM follows)::bigint AS follows,
  (SELECT COALESCE(SUM(views), 0) FROM cart_views_daily WHERE day >= current_date - 6)::bigint AS views_7d,
  (SELECT COALESCE(SUM(clicks), 0) FROM click_daily WHERE day >= current_date - 6)::bigint AS clicks_7d;

-- name: AdminListUsers :many
SELECT
  u.id, u.handle, u.display_name, u.avatar_url, u.email, u.created_at,
  (SELECT COUNT(*) FROM carts c   WHERE c.user_id = u.id AND c.archived_at IS NULL)::bigint AS cart_count,
  (SELECT COUNT(*) FROM follows f WHERE f.creator_id = u.id)::bigint  AS follower_count,
  (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id)::bigint AS following_count
FROM users u
ORDER BY u.created_at DESC
LIMIT 500;

-- name: AdminUserCarts :many
SELECT
  c.id, c.slug, c.title, c.visibility, c.created_at,
  (SELECT COUNT(*) FROM cart_items ci WHERE ci.cart_id = c.id)::bigint AS product_count,
  (SELECT COALESCE(SUM(cv.views), 0)  FROM cart_views_daily cv WHERE cv.cart_id = c.id AND cv.day >= current_date - 6)::bigint AS views_7d,
  (SELECT COALESCE(SUM(cd.clicks), 0) FROM click_daily cd JOIN links l ON cd.link_id = l.id WHERE l.cart_id = c.id AND cd.day >= current_date - 6)::bigint AS clicks_7d
FROM carts c
WHERE c.user_id = $1 AND c.archived_at IS NULL
ORDER BY c.created_at DESC;
```

### New package `internal/admin`
- `service.go`: `Service{ q *sqlcgen.Queries }`; `Overview(ctx)`, `ListUsers(ctx)`, `UserCarts(ctx, userID)`. `privateCarts = carts - publicCarts` computed in Go.
- `middleware.go`: `RequireAdmin(isAdmin func(int64) bool) func(http.Handler) http.Handler` → `403` when caller isn't admin.
- `marshal.go`: `OverviewJSON`, `AdminUserJSON`, `AdminUserCartJSON` (string IDs via strconv; ISO timestamps; null pg text → "").
- `handlers.go`: `RegisterRoutes(parent chi.Router, svc *Service, isAdmin func(int64) bool)` → `parent.Route("/admin", func(r){ r.Use(RequireAdmin(isAdmin)); r.Get("/overview", ...); r.Get("/users", ...); r.Get("/users/{id}/carts", ...) })`.
- `service_test.go` / `handlers_test.go`: seed users/carts/follows; assert overview counts, per-user carts/followers/following counts, drill-down views/clicks; **non-admin caller → 403**, admin caller → 200. (Reuse `pkg/testutil`, `db.MigrateUp("../db/migrations")`, the `injectFixedUser` pattern; for the 403 test, inject a non-admin uid; pass an `isAdmin` set containing only the admin uid.)

### `/me` gains `isAdmin`
- `internal/carts/marshal.go`: add `IsAdmin bool `json:"isAdmin"`` to `UserJSON` (defaults false; only `getMe` sets it).
- `internal/carts/handlers.go`: `getMe` sets `out.IsAdmin = isAdmin(uid)`. Thread the predicate by extending `RegisterRoutes(r, svc, fetcher, isAdmin func(int64) bool)`.
- `cmd/shoplit-api/main.go`: build `adminSet`/`isAdmin`; pass `isAdmin` to `carts.RegisterRoutes(...)`; add `admin.RegisterRoutes(r, admin.NewService(q), isAdmin)` inside the `/api/v1` block.

### Files (A) — no web/
`internal/db/queries.sql`, `internal/db/sqlc/*` (regen), new `internal/admin/{service,middleware,marshal,handlers,service_test,handlers_test}.go`, `internal/carts/{marshal,handlers}.go`, `cmd/shoplit-api/main.go`.

---

## Workstream B — Frontend (web)

### Types + client
- `web/lib/types.ts`: add `isAdmin?: boolean` to `User`; add `AdminOverview`, `AdminUser`, `AdminUserCart` interfaces matching the contract.
- `web/lib/api-client.ts`: `getAdminOverview(opts?)`, `getAdminUsers(opts?)`, `getAdminUserCarts(id, opts?)` → the three endpoints (forward cookie; let `ApiError` propagate so pages can gate).

### Pages
- `web/app/dashboard/admin/page.tsx` (server component, `force-dynamic`): `getCurrentUser({cookie})`; if `!user.isAdmin` → `notFound()`. Fetch overview + users in parallel. Render: a row of **overview stat cards** (users, carts (public/private), products, follows, views7d, clicks7d) reusing the dashboard stat-card visual idiom; then a **users table** — columns avatar+@handle, name, carts, followers, following, joined (relative or date), email. Each row links to `/dashboard/admin/users/{id}`. Mobile: the table becomes stacked cards or horizontally scrolls (`overflow-x-auto`) — must not break at 360px.
- `web/app/dashboard/admin/users/[id]/page.tsx` (server, `force-dynamic`): same `isAdmin` gate; fetch `getAdminUserCarts(id)`; a back link to `/dashboard/admin`; a table of that user's carts (title → `/c/{slug}`, visibility badge, products, views7d, clicks7d, created).
- Both gate server-side via `user.isAdmin`; a non-admin hitting the URL gets `notFound()` (and the API would `403` anyway).

### Nav
- `web/components/app-sidebar.tsx`: in the logged-in drawer, add an **"Admin"** link (`/dashboard/admin`, e.g. a shield/gauge icon) rendered **only when `user.isAdmin`**.

### Files (B) — no Go
Create: `web/app/dashboard/admin/page.tsx`, `web/app/dashboard/admin/users/[id]/page.tsx`.
Modify: `web/lib/types.ts`, `web/lib/api-client.ts`, `web/components/app-sidebar.tsx`.
Reuse: the dashboard stat-card styling, `relative-time.ts`, theme tokens.

### Tests
- `web/lib/api-client.test.ts`: the three admin endpoint URLs (GET, incl. `/users/{id}/carts`).

---

## Verification
- Backend: `go build ./...`, `go vet ./...`, `go test ./internal/admin/... ./internal/carts/... -race -count=1`; golangci-lint if present.
- Frontend: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build` (single web agent may build).
- Integrator: full redeploy (backend changed); live check `GET /api/v1/admin/overview` → `401` unauthenticated (route exists).

## Out of scope
Moderation actions (ban/delete), growth charts, pagination beyond `LIMIT 500`, audit logging.
