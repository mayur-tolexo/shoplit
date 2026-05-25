# "Wow" dashboard redesign — Design

Date: 2026-05-25
Status: Approved for implementation

Redesign the logged-in dashboard (`/dashboard`) around three pillars: a hero with your profile link + live preview, beautiful insights, and premium polish. Two tracks (Go backend, web frontend), disjoint files → parallelizable.

## Contract (normative)
New authed endpoint: `GET /api/v1/insights` → `{ "daily": DailyStat[] }`
- `DailyStat = { "date": "YYYY-MM-DD", "views": number, "clicks": number }`
- Exactly 14 entries, ascending by date, ending today (`today-13 … today`), **zero-filled** for days with no activity. Scope: all carts owned by the viewer.

Everything else the dashboard needs (per-cart `viewsLast7d/clicksLast7d/reachLast7d`, totals, top cart) is already in `listMyCarts()` — computed on the frontend. The daily series is the only new data.

---

## Workstream A — Backend (Go)

### sqlc queries (append to `internal/db/queries.sql`, regen with `"$(go env GOPATH)/bin/sqlc" generate`)
```sql
-- name: AccountDailyViews :many
SELECT cv.day::date AS day, COALESCE(SUM(cv.views), 0)::bigint AS views
FROM cart_views_daily cv
JOIN carts c ON c.id = cv.cart_id
WHERE c.user_id = $1 AND cv.day >= current_date - 13
GROUP BY cv.day
ORDER BY cv.day;

-- name: AccountDailyClicks :many
SELECT cd.day::date AS day, COALESCE(SUM(cd.clicks), 0)::bigint AS clicks
FROM click_daily cd
JOIN links l ON l.id = cd.link_id
JOIN carts c ON c.id = l.cart_id
WHERE c.user_id = $1 AND cd.day >= current_date - 13
GROUP BY cd.day
ORDER BY cd.day;
```
(`links.cart_id` is nullable; the JOIN naturally drops non-cart links.)

### Service (`internal/carts/service.go`)
- `AccountDailyStats(ctx, userID int64) ([]DailyStat, error)`: run both queries, merge by date into a **14-day, ascending, zero-filled** slice covering `today-13 … today` (build the date skeleton in Go using `time.Now().UTC()`, then fill from the query rows keyed by date). `DailyStat` is a small struct `{ Date time.Time / string, Views int64, Clicks int64 }`.

### Marshal (`internal/carts/marshal.go`)
- `DailyStatJSON { Date string `json:"date"`; Views int `json:"views"`; Clicks int `json:"clicks"` }` with `Date` formatted `"2006-01-02"`. A `MarshalDailyStats([]DailyStat) []DailyStatJSON` helper.

### Handler (`internal/carts/handlers.go`)
- Add `r.Get("/insights", getInsights(svc))` inside `RegisterRoutes` (already under `/api/v1` + `RequireUser`).
- `getInsights`: read `uid` from context, call `AccountDailyStats`, write `{"daily": MarshalDailyStats(...)}` (200). On error → 500.

### Tests
- `internal/carts/service_test.go` or `handlers_test.go`: seed `cart_views_daily` + `click_daily` across several days (incl. a gap day) for the user's cart(s); assert the series is length 14, ascending, zero-filled on the gap, correct sums, and excludes another user's carts. Handler test: `GET /api/v1/insights` returns a 14-element `daily` array.

### Files (A) — no web/
`internal/db/queries.sql`, `internal/db/sqlc/*` (regen), `internal/carts/service.go`, `internal/carts/marshal.go`, `internal/carts/handlers.go`, `internal/carts/{service,handlers}_test.go`.

---

## Workstream B — Frontend (web)

### Types + client
- `web/lib/types.ts`: `export interface DailyStat { date: string; views: number; clicks: number }`.
- `web/lib/api-client.ts`: `getInsights(opts?: AuthOpts): Promise<DailyStat[]>` → `GET /api/v1/insights`, returns the `daily` array (`[]` on absence).
- `web/lib/insights.ts` (pure, tested): `summarizeDaily(daily: DailyStat[])` → `{ viewsThisWeek, viewsPrevWeek, viewsDeltaPct, clicksThisWeek, clicksPrevWeek, clicksDeltaPct }` (last 7 vs the prior 7; delta `null`/0-safe when prev week is 0). Unit-tested (node-env vitest).

### Components
- `web/components/sparkline.tsx` — pure inline **SVG** sparkline from `values: number[]` (props: values, width, height, className for stroke). No chart library. Renders nothing/flat baseline for all-zero input.
- `web/components/dashboard-hero.tsx` (`"use client"`) — props `{ user }`. Left: greeting (avatar + "Hi {firstName}" + warm line) and the **profile link** ``{origin}/u/{handle}`` with **Copy** (reuse `lib/clipboard.ts`) + **Share** (reuse `share-sheet.tsx` or `navigator.share`). Right (lg+): a **live preview** — reuse `web/components/phone-frame.tsx` wrapping an `<iframe src={`/u/${handle}`} loading="lazy">` scaled to fit. Below `lg`: hide the phone, show a "View my profile →" link to `/u/{handle}`. Warm accent gradient background. Guard: if `handle` is empty, show the greeting without the link/preview.
- `web/components/insight-summary.tsx` — headline **views this week** via `AnimatedNumber`, a ▲/▼ **delta** chip vs last week (green up / muted down, from `summarizeDaily`), the `Sparkline` (14-day views), and a compact chip row: clicks (7d), reach (7d, summed from carts), carts count, products count. Server or client component (no interactivity needed beyond AnimatedNumber).
- `web/components/top-cart-card.tsx` — featured "⭐ Top cart" = the cart with the highest `viewsLast7d` (passed in). Larger cover, title, its views/clicks. Links to `/dashboard/carts/{id}`. Hidden if no carts have any views.

### Page (`web/app/dashboard/page.tsx`)
- Fetch `user`, `carts`, and `getInsights()` in parallel (forward cookie; insights failure → `[]`, never break the page).
- Layout (has carts): `<DashboardHero user={user} />` → `<InsightSummary daily={...} carts={...} />` + `<TopCartCard .../>` → header row ("Your carts" + Add/New cart) → cart grid (reuse `CartCard`, wrap in `RevealOnScroll` for entrance). Keep `InstallNudge`.
- Empty state: keep `FirstTimeOnboarding` (a slimmed hero greeting is fine; skip insights/top-cart when there are no carts).
- Premium polish: warm gradient in hero, `RevealOnScroll` entrance on grid, existing hover-lift on cards, refined serif hierarchy. Keep within the existing theme tokens (ink/cream/paper/accent/muted/rule).

### Mobile
Hero stacks (phone preview hidden → "View my profile" link); insight chips wrap; sparkline is responsive width; grid stays `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; ≥44px tap targets; keep `pb-24 sm:pb-10`.

### Tests
- `web/lib/insights.test.ts` (summarizeDaily: week split, delta %, zero-prev-week safety, short arrays).
- `web/lib/api-client.test.ts`: `getInsights` builds `/api/v1/insights` (GET).
(Sparkline/hero are visual; not unit-tested — keep logic in the tested pure helper.)

### Files (B) — no Go
Create: `web/lib/insights.ts`, `web/lib/insights.test.ts`, `web/components/sparkline.tsx`, `web/components/dashboard-hero.tsx`, `web/components/insight-summary.tsx`, `web/components/top-cart-card.tsx`.
Modify: `web/lib/types.ts`, `web/lib/api-client.ts`, `web/app/dashboard/page.tsx`.
Reuse: `phone-frame.tsx`, `lib/clipboard.ts`, `share-sheet.tsx`, `animated-number.tsx`, `cart-card.tsx`, `reveal-on-scroll.tsx`, `install-nudge.tsx`.

---

## Verification
- Backend: `go build ./...`, `go vet ./...`, `go test ./internal/carts/... -race -count=1`; golangci-lint if present.
- Frontend: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`. (Integrator runs the authoritative `pnpm build` + a logged-in visual check.)

## Out of scope
Per-cart trend charts; configurable date ranges (fixed 14-day); earnings/revenue; real-time updates.
