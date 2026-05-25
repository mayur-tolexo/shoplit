# Accurate Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop counting the owner's own views/clicks on their own cart, and report unique **reach** (distinct hashed-IP clickers) alongside total clicks.

**Architecture:** Add a salted-SHA256 `visitor_hash` to click events (raw IP never stored). The `shoplit-redirect` binary resolves the optional logged-in viewer from the session cookie and skips counting when the viewer owns the link; the `shoplit-api` public-cart path resolves the optional viewer and skips the view bump when the viewer owns the cart. A new `CartReach7d` query counts distinct visitor hashes; `reachLast7d` flows through `MarshalCart` to the dashboard.

**Tech Stack:** Go (chi, sqlc, pgx, golang-migrate), `internal/auth.SessionManager` (HMAC cookie), Next.js web.

**Conventions:** sqlc binary at `/Users/mayurdas/go/bin/sqlc` (run from repo root). Commit messages: NO `Co-Authored-By`, NO 🤖. This feature owns migration number **0006** (public/private carts will use 0007).

**Merge-coordination note:** `MarshalCart`, the `Cart` web type, `GetPublicCart`, `publicapi/handlers.go`, and `cart-card.tsx` are also touched by the upcoming public/private-carts feature — land this one first.

---

## Task 1: Migration + queries (visitor_hash, reach query, sqlc regen)

**Files:**
- Create: `internal/db/migrations/0006_click_visitor_hash.up.sql`, `0006_click_visitor_hash.down.sql`
- Modify: `internal/db/queries.sql`
- Regenerate: `internal/db/sqlc/*` (via sqlc)

- [ ] **Step 1: Write the up migration**

`internal/db/migrations/0006_click_visitor_hash.up.sql`:
```sql
ALTER TABLE click_events ADD COLUMN visitor_hash TEXT;
CREATE INDEX click_events_link_visitor ON click_events(link_id, occurred_at, visitor_hash);
```

- [ ] **Step 2: Write the down migration**

`internal/db/migrations/0006_click_visitor_hash.down.sql`:
```sql
DROP INDEX IF EXISTS click_events_link_visitor;
ALTER TABLE click_events DROP COLUMN IF EXISTS visitor_hash;
```

- [ ] **Step 3: Update `InsertClickEvent` + add `CartReach7d` in `internal/db/queries.sql`**

Replace the `InsertClickEvent` query (currently 5 columns) with a 6-column version, and add `CartReach7d` after `CartClicks7d`:
```sql
-- name: InsertClickEvent :exec
INSERT INTO click_events (link_id, occurred_at, country_code, user_agent_kind, referer_host, visitor_hash)
VALUES ($1, now(), $2, $3, $4, $5);
```
```sql
-- name: CartReach7d :one
SELECT COUNT(DISTINCT visitor_hash)::bigint AS reach
FROM click_events ce
JOIN links l ON ce.link_id = l.id
WHERE l.cart_id = $1 AND ce.occurred_at >= current_date - 6 AND ce.visitor_hash IS NOT NULL;
```

- [ ] **Step 4: Regenerate sqlc**

Run: `cd /Users/mayurdas/Documents/projects/go/src/shoplit && /Users/mayurdas/go/bin/sqlc generate`
Expected: no errors; `InsertClickEventParams` now has a `VisitorHash pgtype.Text` field, and a new `CartReach7d(ctx, pgtype.Int8) (int64, error)` method exists. Verify:
`grep -n "VisitorHash" internal/db/sqlc/*.go && grep -n "CartReach7d" internal/db/sqlc/*.go`

- [ ] **Step 5: Build to confirm generated code compiles**

Run: `go build ./internal/db/...`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add internal/db/migrations/0006_click_visitor_hash.up.sql internal/db/migrations/0006_click_visitor_hash.down.sql internal/db/queries.sql internal/db/sqlc
git commit -m "feat(db): click visitor_hash column + CartReach7d query"
```

---

## Task 2: VisitorHash + ClientIP helpers (TDD)

**Files:**
- Create: `internal/analytics/visitor.go`, `internal/analytics/visitor_test.go`
- Modify: `internal/httpx/` (add `clientip.go`), Test: `internal/httpx/clientip_test.go`

- [ ] **Step 1: Write failing tests** — `internal/analytics/visitor_test.go`:
```go
package analytics_test

import (
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/analytics"
)

func TestVisitorHash(t *testing.T) {
	a := analytics.VisitorHash("1.2.3.4", "salt")
	b := analytics.VisitorHash("1.2.3.4", "salt")
	if a == "" || a != b {
		t.Fatalf("hash must be deterministic and non-empty: %q %q", a, b)
	}
	if len(a) != 16 {
		t.Fatalf("want 16 hex chars, got %d", len(a))
	}
	if analytics.VisitorHash("1.2.3.4", "other") == a {
		t.Fatalf("different salt must give a different hash")
	}
	if analytics.VisitorHash("5.6.7.8", "salt") == a {
		t.Fatalf("different ip must give a different hash")
	}
	if analytics.VisitorHash("", "salt") != "" {
		t.Fatalf("empty ip must hash to empty string")
	}
}
```
`internal/httpx/clientip_test.go`:
```go
package httpx_test

import (
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/httpx"
)

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if got := httpx.ClientIP(r); got != "203.0.113.7" {
		t.Fatalf("XFF first hop: got %q", got)
	}

	r2 := httptest.NewRequest("GET", "/", nil)
	r2.RemoteAddr = "198.51.100.9:54321"
	if got := httpx.ClientIP(r2); got != "198.51.100.9" {
		t.Fatalf("RemoteAddr host: got %q", got)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `go test ./internal/analytics/ ./internal/httpx/ 2>&1 | tail`
Expected: build/compile failure (packages/functions not defined).

- [ ] **Step 3: Implement `internal/analytics/visitor.go`**
```go
// Package analytics holds shared analytics helpers (visitor identity, etc.).
package analytics

import (
	"crypto/sha256"
	"encoding/hex"
)

// VisitorHash returns a short, salted, one-way hash of a visitor IP. The raw IP
// is never stored — only this hash, so distinct visitors can be counted
// (reach) without retaining PII. Empty ip → empty hash (not counted).
func VisitorHash(ip, salt string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(salt + "|" + ip))
	return hex.EncodeToString(sum[:])[:16]
}
```

- [ ] **Step 4: Implement `internal/httpx/clientip.go`**
```go
package httpx

import (
	"net"
	"net/http"
	"strings"
)

// ClientIP returns the best-effort client IP: the first hop of X-Forwarded-For
// (set by the Caddy reverse proxy in prod), else the RemoteAddr host.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `go test ./internal/analytics/ ./internal/httpx/ -v 2>&1 | tail`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add internal/analytics/ internal/httpx/clientip.go internal/httpx/clientip_test.go
git commit -m "feat: salted visitor-hash + client-IP helpers"
```

---

## Task 3: Redirect — exclude owner clicks + record visitor_hash

The redirect binary resolves the optional logged-in viewer from the session cookie; if the viewer owns the link (`link.UserID`), skip counting entirely. Otherwise log the click with a visitor hash.

**Files:**
- Modify: `internal/redirect/service.go`, `internal/redirect/handlers.go`, `cmd/shoplit-redirect/main.go`, `deploy/compose.prod.yaml`

- [ ] **Step 1: Extend the Service to hold the SessionManager + salt, and `LogClick` to take a visitor hash** — `internal/redirect/service.go`:

Change the struct + constructor:
```go
type Service struct {
	q    *sqlcgen.Queries
	sm   *auth.SessionManager
	salt string
}

func NewService(q *sqlcgen.Queries, sm *auth.SessionManager, salt string) *Service {
	return &Service{q: q, sm: sm, salt: salt}
}

// ViewerID returns the logged-in user id from the request, or 0 if anonymous.
func (s *Service) ViewerID(r *http.Request) int64 {
	if s.sm == nil {
		return 0
	}
	id, err := s.sm.GetUser(r)
	if err != nil {
		return 0
	}
	return id
}

// Salt exposes the hashing salt for the handler.
func (s *Service) Salt() string { return s.salt }
```
Add imports `"net/http"` and `"github.com/mayur-tolexo/shoplit/internal/auth"`.

Replace `LogClick` to accept + store `visitorHash`:
```go
func (s *Service) LogClick(ctx context.Context, link sqlcgen.Link, uaKind, refererHost, visitorHash string) {
	_ = s.q.InsertClickEvent(ctx, sqlcgen.InsertClickEventParams{
		LinkID:        link.ID,
		CountryCode:   pgtype.Text{},
		UserAgentKind: nullText(uaKind),
		RefererHost:   nullText(refererHost),
		VisitorHash:   nullText(visitorHash),
	})
	_ = s.q.BumpClickDaily(ctx, link.ID)
}
```

- [ ] **Step 2: Skip owner clicks + pass the hash in `internal/redirect/handlers.go`**

Replace the click-logging block in `redirectHandler` (the `go svc.LogClick(...)` line) with:
```go
		// Don't count the owner's own clicks on their own cart. Record a
		// salted visitor hash for unique-reach (raw IP never stored).
		if svc.ViewerID(r) != link.UserID {
			vhash := analytics.VisitorHash(httpx.ClientIP(r), svc.Salt())
			go svc.LogClick(context.Background(), link, detectUAKind(r), refererHost(r), vhash)
		}
```
Add imports: `"github.com/mayur-tolexo/shoplit/internal/analytics"`, `"github.com/mayur-tolexo/shoplit/internal/httpx"`. (`context` already imported.)

- [ ] **Step 3: Wire the SessionManager in `cmd/shoplit-redirect/main.go`**

Where `svc := redirect.NewService(q)` is, change to build a SessionManager from the config secret (read-only; just verifies the HMAC cookie) and pass it + the salt:
```go
	sm := auth.NewSessionManager(cfg.SessionSecret).WithSecure(cfg.CookieSecure)
	svc := redirect.NewService(q, sm, cfg.SessionSecret)
```
Add import `"github.com/mayur-tolexo/shoplit/internal/auth"`. (`cfg.SessionSecret` and `cfg.CookieSecure` already exist in config; the config auto-generates a secret with a warning if unset — Step 4 sets it explicitly in prod.)

- [ ] **Step 4: Give the redirect service the session secret in `deploy/compose.prod.yaml`**

In the `shoplit-redirect` service `environment:` block, add (so its cookie verification matches the api's):
```yaml
      SHOPLIT_SESSION_SECRET: ${SHOPLIT_SESSION_SECRET}
      SHOPLIT_COOKIE_SECURE: "true"
```

- [ ] **Step 5: Build + existing redirect tests**

Run: `go build ./... && go test ./internal/redirect/ 2>&1 | tail`
Expected: build OK. If redirect tests construct `NewService(q)`, update them to `NewService(q, nil, "test-salt")` (nil sm → ViewerID returns 0, anonymous) and pass the new `LogClick` arg; keep them green.

- [ ] **Step 6: Commit**
```bash
git add internal/redirect/ cmd/shoplit-redirect/main.go deploy/compose.prod.yaml
git commit -m "feat(redirect): skip owner self-clicks; record salted visitor hash"
```

---

## Task 4: API — exclude owner self-views

The public-cart endpoint resolves the optional viewer and skips the view bump when the viewer owns the cart.

**Files:**
- Modify: `internal/carts/service.go` (`GetPublicCart` signature), `internal/publicapi/handlers.go`, `cmd/shoplit-api/main.go`

- [ ] **Step 1: `GetPublicCart` takes `viewerUserID` and skips the owner's bump** — `internal/carts/service.go`:

Change the signature and the bump:
```go
func (s *Service) GetPublicCart(ctx context.Context, slug string, viewerUserID int64) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, sqlcgen.User, error) {
```
and replace the fire-and-forget bump block with:
```go
	// Fire-and-forget view bump (best effort) — but never count the owner's
	// own views of their own cart.
	if viewerUserID != cart.UserID {
		go func() {
			_ = s.q.BumpCartViewsDaily(context.Background(), cart.ID)
		}()
	}
```

- [ ] **Step 2: Resolve the optional viewer in `internal/publicapi/handlers.go`**

`RegisterRoutes` gains the SessionManager; the handler resolves the optional user (0 if anonymous) and passes it through:
```go
func RegisterRoutes(r chi.Router, svc *carts.Service, sm *auth.SessionManager) {
	r.Get("/carts/{slug}", getPublicCart(svc, sm))
}

func getPublicCart(svc *carts.Service, sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		var viewerID int64
		if sm != nil {
			if id, err := sm.GetUser(r); err == nil {
				viewerID = id
			}
		}
		cart, items, user, err := svc.GetPublicCart(r.Context(), slug, viewerID)
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(carts.MarshalCart(cart, user, items, 0, 0, 0))
	}
}
```
Add import `"github.com/mayur-tolexo/shoplit/internal/auth"`. (Note the `MarshalCart` call now passes a third stat `0` for reach — see Task 5; this file compiles only after Task 5's MarshalCart signature change, so commit Tasks 4+5 together — see Task 5 Step 6.)

- [ ] **Step 3: Pass `sm` from `cmd/shoplit-api/main.go`**

Change `publicapi.RegisterRoutes(r, svc)` to:
```go
		publicapi.RegisterRoutes(r, svc, sm)
```

- [ ] **Step 4: (verification happens in Task 5)** — do not build yet; `MarshalCart` arity changes in Task 5.

---

## Task 5: Reach plumbing + dashboard display

**Files:**
- Modify: `internal/carts/service.go` (`CartStats7d`), `internal/carts/marshal.go`, `internal/carts/handlers.go`, `web/lib/types.ts`, `web/components/cart-card.tsx`, `web/app/(public)/c/[slug]/page.tsx`

- [ ] **Step 1: `CartStats7d` also returns reach** — `internal/carts/service.go`:
```go
func (s *Service) CartStats7d(ctx context.Context, cartID int64) (views, clicks, reach int64) {
	views, _ = s.q.CartViews7d(ctx, cartID)
	cid := pgtype.Int8{Int64: cartID, Valid: true}
	clicks, _ = s.q.CartClicks7d(ctx, cid)
	reach, _ = s.q.CartReach7d(ctx, cid)
	return views, clicks, reach
}
```

- [ ] **Step 2: `MarshalCart` adds `reachLast7d`** — `internal/carts/marshal.go`:

Change the signature to add the param, the `CartJSON` struct to add the field, and set it:
```go
func MarshalCart(c sqlcgen.Cart, owner sqlcgen.User, items []sqlcgen.ListCartItemsRow, viewsLast7d, clicksLast7d, reachLast7d int) CartJSON {
```
In the `CartJSON` struct add (next to the views/clicks fields):
```go
	ReachLast7d int `json:"reachLast7d"`
```
And in the returned struct literal add:
```go
		ReachLast7d: reachLast7d,
```

- [ ] **Step 3: Update the 4 `MarshalCart` call sites in `internal/carts/handlers.go`**

- `listCarts`: `v, cl := svc.CartStats7d(...)` → `v, cl, rc := svc.CartStats7d(r.Context(), c.ID)` and `MarshalCart(c, owner, items, int(v), int(cl), int(rc))`.
- `getCart`: `v, cl := svc.CartStats7d(...)` → `v, cl, rc := svc.CartStats7d(r.Context(), cart.ID)` and `MarshalCart(cart, owner, items, int(v), int(cl), int(rc))`.
- `createCart` and the other no-stats call: `MarshalCart(cart, owner, nil, 0, 0)` → `MarshalCart(cart, owner, nil, 0, 0, 0)`.

- [ ] **Step 4: Build + Go tests**

Run: `go build ./... && go test ./... 2>&1 | tail -15`
Expected: all pass (Tasks 1–5 compile together).

- [ ] **Step 5: Web — type, cookie forward, and display**

`web/lib/types.ts` — in `interface Cart` add:
```ts
  reachLast7d: number;
```

`web/app/(public)/c/[slug]/page.tsx` — forward the viewer cookie so the API can identify the owner (followers have no cookie, so nothing changes for them). Add `import { cookies } from "next/headers";` and change the fetch:
```tsx
  const cart = await getCartBySlug(params.slug, { cookie: cookies().toString() });
```
(There are two `getCartBySlug(params.slug)` calls in this file — `generateMetadata` and the page; update **both** to pass the cookie.)

`web/components/cart-card.tsx` — add reach to the footer stats. Update the lucide import to include `Users`, and add a third chip after clicks:
```tsx
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {cart.reachLast7d.toLocaleString()}
            </span>
```
(Place it right after the `MousePointerClick` clicks chip; keep the `· N items` span. Import: `import { Check, Eye, MousePointerClick, Users, Share2 } from "lucide-react";`)

- [ ] **Step 6: Web gate + commit (Tasks 4+5 together)**

Run: `cd web && npx tsc --noEmit && npx next lint --dir app --dir components && pnpm run build`
Expected: clean.
```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
git add internal/carts/ internal/publicapi/handlers.go cmd/shoplit-api/main.go web/lib/types.ts web/components/cart-card.tsx "web/app/(public)/c/[slug]/page.tsx"
git commit -m "feat: exclude owner self-views + surface unique reach on the dashboard"
```

---

## Task 6: End-to-end verification + deploy

**Files:** none (verification only).

- [ ] **Step 1: Full gate**
```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
go test ./... 2>&1 | tail -15
go build ./...
cd web && npx tsc --noEmit && npx next lint && pnpm run build
```
Expected: all clean.

- [ ] **Step 2: Deploy (migration runs via the migrate one-shot; redeploy api + redirect + web)**

The `migrate` compose service applies `0006` on `up`. `SHOPLIT_SESSION_SECRET` is
already in `deploy/.env` (the api uses it); compose now also passes it to the
redirect service, so no `.env` edit is needed. From repo root after merge to main:
```bash
ssh -i "$HOME/.ssh/shop-lit.pem" ubuntu@13.239.93.134 "
  cd shoplit && git pull --ff-only
  grep -q '^SHOPLIT_SESSION_SECRET=' deploy/.env || echo 'WARNING: SHOPLIT_SESSION_SECRET missing from deploy/.env'
  sudo docker compose -f deploy/compose.prod.yaml --env-file deploy/.env up -d --build migrate shoplit-api shoplit-redirect shoplit-web
  sudo docker compose -f deploy/compose.prod.yaml --env-file deploy/.env ps --format '{{.Service}}: {{.Status}}'
"
```

- [ ] **Step 3: Manual verification**
- As the cart owner (logged in), open your own `/c/{slug}` and click a product → views & clicks do **not** increase.
- From a different browser/incognito (no session) → views increase; clicking a product increases clicks **and** reach by 1.
- Click the same product twice from that one browser → clicks +2, reach +1.
- Dashboard card shows `views · clicks · reach`.

---

## Notes for the implementer
- **Owner = `link.UserID`** (the link row already carries the owner) — no extra owner-lookup query needed for clicks.
- **Fail-open:** if the session can't be read (no/invalid cookie), the viewer is treated as anonymous (0) and the event is counted — exactly right for real followers.
- **Privacy:** only the salted, truncated hash is stored; never the raw IP. Salt = server session secret.
- **Reach window** uses `current_date - 6` to match the existing `CartViews7d`/`CartClicks7d` 7-day windows.
- Commit messages: no `Co-Authored-By`, no 🤖.
```
