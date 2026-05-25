# New-cart notifications (in-app bell, lightweight) — Design

Date: 2026-05-25
Status: Approved for implementation

Notify followers when a creator they follow drops a new cart, via an in-app bell. Computed from the existing follows + carts (no fan-out, no events). Two tracks (Go backend, web frontend), disjoint files → parallelizable.

## Model
One new column: `users.notifications_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`. "Unread" = public, non-archived carts owned by a creator the viewer follows, with `created_at > viewer.notifications_seen_at`. Opening the bell sets `notifications_seen_at = now()`. Existing users get `now()` at migration time → nobody starts with a huge badge.

## Contract (normative)
- `GET /api/v1/notifications/unread-count` → `{ "count": number }`
- `GET /api/v1/notifications` → `{ "unreadCount": number, "items": NotificationItem[] }`
  - `NotificationItem = { "cartSlug", "cartTitle", "creatorHandle", "creatorDisplayName", "creatorAvatarUrl", "createdAt":ISO, "unread":boolean }`
  - newest first, `LIMIT 20`.
- `POST /api/v1/notifications/seen` → `200` (sets `notifications_seen_at = now()`).
- All three are authed (`/api/v1`, behind `RequireUser`).

---

## Workstream A — Backend (Go)

### Migration `internal/db/migrations/0009_notifications_seen`
- up: `ALTER TABLE users ADD COLUMN notifications_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();`
- down: `ALTER TABLE users DROP COLUMN notifications_seen_at;`

### sqlc queries (append to `internal/db/queries.sql`, regen)
```sql
-- name: NotificationUnreadCount :one
SELECT COUNT(*)::bigint AS count
FROM carts c
JOIN follows f ON f.creator_id = c.user_id
WHERE f.follower_id = $1
  AND c.visibility = 'public' AND c.archived_at IS NULL
  AND c.created_at > (SELECT notifications_seen_at FROM users WHERE id = $1);

-- name: ListNotifications :many
SELECT c.slug, c.title, c.created_at,
  u.handle, u.display_name, u.avatar_url,
  (c.created_at > (SELECT notifications_seen_at FROM users WHERE id = $1)) AS unread
FROM carts c
JOIN follows f ON f.creator_id = c.user_id
JOIN users u ON u.id = c.user_id
WHERE f.follower_id = $1
  AND c.visibility = 'public' AND c.archived_at IS NULL
ORDER BY c.created_at DESC
LIMIT 20;

-- name: MarkNotificationsSeen :exec
UPDATE users SET notifications_seen_at = now() WHERE id = $1;
```

### Service (`internal/creators/service.go`) — it already owns follows + the feed
- `NotificationUnreadCount(ctx, userID) (int64, error)`
- `ListNotifications(ctx, userID) ([]NotificationRow, error)` (sqlc row)
- `MarkNotificationsSeen(ctx, userID) error`

### Marshal (`internal/creators/marshal.go`)
- `NotificationItemJSON { CartSlug, CartTitle, CreatorHandle, CreatorDisplayName, CreatorAvatarURL string; CreatedAt string `2006-01-02T...`; Unread bool }` + `MarshalNotifications([]NotificationRow) []NotificationItemJSON` (null pg text → "", RFC3339 timestamps).

### Handlers (`internal/creators/handlers.go`, in `RegisterRoutes` under `/api/v1`)
- `r.Get("/notifications/unread-count", ...)` → `{count}`.
- `r.Get("/notifications", ...)` → call `ListNotifications` + `NotificationUnreadCount`; write `{unreadCount, items}` (items non-nil → `[]`).
- `r.Post("/notifications/seen", ...)` → `MarkNotificationsSeen`, `200`.
- All read `uid` via `auth.UserIDFromContext`.

### Tests (`internal/creators/{service,handlers}_test.go`)
- Seed: follower follows creatorA; creatorA has carts created before AND after the follower's `seen_at`; a non-followed creatorB cart; a private cart. Assert: unread-count counts only public followed carts created after `seen_at`; ListNotifications returns followed public carts newest-first with correct `unread` flags and excludes non-followed/private; `MarkNotificationsSeen` then unread-count = 0. Handler tests via `injectFixedUser` for the three routes.

### Files (A) — no web/
`internal/db/migrations/0009_notifications_seen.{up,down}.sql`, `internal/db/queries.sql`, `internal/db/sqlc/*` (regen), `internal/creators/{service,marshal,handlers,service_test,handlers_test}.go`.

---

## Workstream B — Frontend (web)

### Types + client
- `web/lib/types.ts`: `NotificationItem { cartSlug; cartTitle; creatorHandle; creatorDisplayName; creatorAvatarUrl; createdAt; unread }`.
- `web/lib/api-client.ts`: `getUnreadCount(opts?): Promise<number>` (GET unread-count → `.count`, 0 on error), `getNotifications(opts?): Promise<{ unreadCount: number; items: NotificationItem[] }>`, `markNotificationsSeen(): Promise<void>` (POST).

### Component `web/components/notification-bell.tsx` (`"use client"`)
- A `Bell` (lucide) icon button (≥44px) with an unread **badge** (small accent dot / count) shown when `count > 0`.
- On mount: `getUnreadCount()` (browser) → set badge.
- Built on `ui/dropdown-menu`: on open → `getNotifications()` to populate the list AND `markNotificationsSeen()` then optimistically set the badge to 0.
- List rows: creator avatar + **"@{creatorHandle} shared a new cart"** + cart title + `relativeTime(createdAt)`; unread rows subtly highlighted (`bg-paper`/accent dot); whole row links to `/c/{cartSlug}` (closes the menu). Empty → "No new carts yet — follow more creators."
- Stale-safe + resilient: a failed fetch leaves the bell usable (no crash).

### Nav wiring (`web/components/nav-bar.tsx`)
- Render `<NotificationBell />` when `user` is present, in **both** the `app` and `marketing` variants, placed just before the account control (the `AppSidebar` trigger). So the bell is consistent on dashboard and public pages when logged in. Do not render it logged-out.

### Mobile
Bell ≥44px tap target; the dropdown is usable at 360px (constrain width, scroll the list); badge doesn't overflow the top bar.

### Tests (`web/lib/api-client.test.ts`)
- `getUnreadCount` (GET `/api/v1/notifications/unread-count`, unwraps `count`), `getNotifications` (GET `/api/v1/notifications`), `markNotificationsSeen` (POST `/api/v1/notifications/seen`).

### Files (B) — no Go
Create: `web/components/notification-bell.tsx`. Modify: `web/lib/types.ts`, `web/lib/api-client.ts`, `web/lib/api-client.test.ts`, `web/components/nav-bar.tsx`.
Reuse: `web/lib/relative-time.ts`, `web/components/ui/dropdown-menu.tsx`.

---

## Verification
- Backend: `go build ./...`, `go vet ./...`, `go test ./internal/creators/... -race -count=1`; golangci-lint if present.
- Frontend: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Integrator: **full redeploy** (migration `0009` runs via the one-shot migrate container — additive `ADD COLUMN`, non-destructive); live check `GET /api/v1/notifications/unread-count` → `401` unauthenticated (route exists).

## Out of scope
Email/web-push, live updates (count refreshes on page load), per-item read state beyond the single seen-at, other notification types (new follower, etc.).
