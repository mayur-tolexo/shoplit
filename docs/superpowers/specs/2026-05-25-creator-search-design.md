# Creator search — Design

Date: 2026-05-25
Status: Approved for implementation

Add as-you-type creator search to the `/discover` page. Two independent tracks (Go backend, web frontend) with disjoint files → parallelizable. No migration.

## Contract (normative)
Extend the existing endpoint:
`GET /api/public/creators?q=<term>&limit=&offset=` → `Creator[]` (the existing shape: `handle, displayName, avatarUrl, cartCount, followerCount, isFollowing`).
- `q` absent or empty (after trim) → current popularity-ranked list (unchanged).
- `q` non-empty → creators whose `handle` or `display_name` matches, ranked prefix-first then popularity.
Optional viewer session still fills `isFollowing` per row.

---

## Workstream A — Backend (Go)

### sqlc query (append to `internal/db/queries.sql`, then regenerate)
Use `sqlc.arg()` names so params are readable; `pattern` (the `%term%` substring) is reused in the WHERE, `prefix` (the `term%`) in the ORDER:

```sql
-- name: SearchCreators :many
-- Creators (>=1 public, non-archived cart) whose handle or display name matches
-- the search term. pattern = '%term%' (substring filter); prefix = 'term%'
-- (prefix matches rank first). Mirrors DiscoverCreators' columns so the handler
-- can reuse the same row mapping.
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
  AND (u.handle ILIKE sqlc.arg(pattern) OR u.display_name ILIKE sqlc.arg(pattern))
GROUP BY u.id, u.handle, u.display_name, u.avatar_url
ORDER BY
  (u.handle ILIKE sqlc.arg(prefix) OR u.display_name ILIKE sqlc.arg(prefix)) DESC,
  views_7d DESC,
  MAX(c.updated_at) DESC,
  u.id
LIMIT sqlc.arg(lim) OFFSET sqlc.arg(off);
```

Regenerate with `"$(go env GOPATH)/bin/sqlc" generate` (sqlc is installed). The generated row must be assignable to the same `CreatorRow` type the handler already loops over for discover; if `DiscoverCreatorsRow` and `SearchCreatorsRow` are distinct sqlc types with identical fields, add a tiny internal mapping so both feed one `MarshalCreator` path (keep it DRY — do not duplicate the marshal loop).

### Service (`internal/creators/service.go`)
- Add `SearchCreators(ctx, q string, limit, offset int32) ([]<row>, error)` mirroring `DiscoverCreators` (same default/clamp for limit→24 in [1,60], offset→0).
- Escape LIKE wildcards in user input so a literal `%`/`_` cannot match-all:
  ```go
  func escapeLike(s string) string {
      return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
  }
  ```
  Build `esc := escapeLike(strings.TrimSpace(q))`, `pattern := "%"+esc+"%"`, `prefix := esc+"%"`. (Postgres `ILIKE` treats `\` as the default escape char.)

### Handler (`internal/creators/handlers.go`)
Extend the existing `discoverCreators` handler (do NOT add a new route): read `q := strings.TrimSpace(r.URL.Query().Get("q"))`; if `q != ""` call `svc.SearchCreators(...)`, else `svc.DiscoverCreators(...)`. Everything else (limit/offset parse, optional-session `isFollowing`, `CreatorJSON` marshaling, JSON write) stays shared.

### Tests
`internal/creators/service_test.go`: matches by handle substring; matches by display_name (case-insensitive); prefix match ranks above a mere substring match; excludes private-only creators and banned users; **wildcard-escape** — a query of `"%"` returns no match-all (treated literally). Seed `cart_views_daily` only where ordering is asserted.
`internal/creators/handlers_test.go`: `GET /creators?q=<term>` returns the filtered subset; `GET /creators` (no q) returns the full list (unchanged).

### Files (A) — no web/ files
Modify: `internal/db/queries.sql`, `internal/db/sqlc/*` (regenerated), `internal/creators/service.go`, `internal/creators/handlers.go`, `internal/creators/service_test.go`, `internal/creators/handlers_test.go`.

---

## Workstream B — Frontend (web)

### API client (`web/lib/api-client.ts`)
Add optional `q` support to `listCreators` (append `&q=<encoded>` when present alongside the existing limit/offset query building). Browser calls don't need a cookie (credentials:"include" sends the session); server calls may still pass `{cookie}`.

### Component `web/components/creator-search.tsx` (client, `"use client"`)
Props: `initialCreators: Creator[]`. Owns the input + the entire results area.
- Controlled text input, full-width, with a clear (✕) button when non-empty; `aria-label="Search creators"`.
- Debounce ~250ms. On debounced non-empty (trimmed) query → `listCreators({}, { q })` from the browser; on empty query → show `initialCreators` (no fetch).
- **Stale-response guard:** use an `AbortController` (abort the previous request) or a monotonically increasing request id so fast typing never renders an older response.
- States: empty query → render `initialCreators` grid; loading → lightweight indicator; results → grid of `<CreatorCard>`; zero results → `No creators match "<q>"`; fetch error → unobtrusive inline message, keep input usable.
- Reuse the existing responsive grid: `grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3` with `<CreatorCard>`.

### Page `web/app/(public)/discover/page.tsx`
Keep fetching the popularity list server-side (unchanged); render the heading, then `<CreatorSearch initialCreators={creators} />`. Move the card-grid markup out of the page and into the component (the component renders both the initial grid and search results). Page stays `force-dynamic` and never throws on a 401.

### Mobile
Input ≥44px tall, full width, ≥44px clear button; results grid is the existing 2-up→3-up; no overflow at 360px.

### Tests (`web/lib/api-client.test.ts`)
Add a case asserting `listCreators` builds `/api/public/creators?q=<encoded>` (with encoding of spaces/special chars) and still works with limit/offset. (Component debounce/abort is integration-level; not unit-tested in the node-env vitest — keep the fetch call in the api-client so the URL is the tested seam.)

### Files (B) — no Go files
Create: `web/components/creator-search.tsx`.
Modify: `web/lib/api-client.ts`, `web/app/(public)/discover/page.tsx`, `web/lib/api-client.test.ts`.

---

## Verification
- Backend: `go build ./...`, `go vet ./...`, `go test ./internal/creators/... -race -count=1` (Docker up). golangci-lint if installed.
- Frontend: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`.
- Integrating engineer runs the authoritative `pnpm build` + a live `?q=` check.

## Out of scope (v1)
Global nav search; fuzzy/typo-tolerant matching; searching cart titles/products; pagination of search results (first page suffices).
