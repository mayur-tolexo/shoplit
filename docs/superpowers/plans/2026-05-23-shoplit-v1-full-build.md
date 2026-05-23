# shoplit — v1 Full-Build Implementation Plan (Real Google OAuth + Generic OG Fetch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. Architecture spec is at `docs/superpowers/specs/2026-05-23-shoplit-design.md`.

**Goal:** Production-ready v1: real Google OAuth (no mocks), generic OG fetch for any product URL, real Postgres persistence, real `/go/{slug}` redirects with click tracking, frontend wired end-to-end. Nykaa-specific catalog browsing + affiliate rules are a follow-up phase.

**Architecture:** `shoplit-api` exposes `/api/v1/*` (HMAC-signed session-cookie-gated) and `/api/public/*` (open); `shoplit-redirect` exposes `/go/{slug}` and `/p/{slug}` with a generic affiliate registry (pass-through for v1 — concrete rules per retailer land per their affiliate-program approvals). Real Google OAuth 2.0 web flow with PKCE handles sign-in; user profiles upserted from Google's userinfo endpoint. Next.js `rewrites` proxy `/api/*`, `/go/*`, `/p/*` to backend services (same-origin in browser; no CORS).

**Tech Stack:**
- Existing Go: chi, pgx, sqlc, redis/go-redis, testify, testcontainers
- New Go deps:
  - `github.com/PuerkitoBio/goquery` (HTML parsing for OG tags)
  - `github.com/matoous/go-nanoid/v2` (slug generation)
  - `golang.org/x/oauth2` (OAuth dance — stdlib-adjacent)
  - `golang.org/x/oauth2/google` (Google endpoint metadata)
- Existing Next.js 14: fetch with `credentials: "include"`, `next/font/google`, Tailwind, Radix UI

**Out of scope for v1** (later phases):
- Phone OTP, email magic-link
- Nykaa / Amazon / Myntra / Flipkart concrete affiliate rules (registry exists; rules empty)
- Server-side image proxy / object storage (hotlink with fallback for v1)
- Analytics dashboard charts (data captured; no read endpoint)
- Multi-account creator switching / impersonation
- Email notifications / digest emails
- CSRF beyond SameSite=Lax cookie attribute

---

## File structure produced by this plan

```
internal/
├── auth/
│   ├── session.go         # HMAC-signed cookie session manager
│   ├── google.go          # Google OAuth 2.0 web flow handlers
│   ├── middleware.go      # RequireUser chi middleware
│   ├── user_upsert.go     # Google profile → users table
│   └── auth_test.go
├── carts/
│   ├── service.go         # business logic wrapping sqlc Queries
│   ├── handlers.go        # HTTP handlers for /api/v1/carts/*
│   ├── slug.go            # nanoid-based slug generator
│   ├── marshal.go         # sqlc → JSON shaping
│   ├── util.go            # pgtype helpers
│   ├── service_test.go
│   ├── handlers_test.go
│   └── slug_test.go
├── ogfetch/
│   ├── ogfetch.go         # HTTP GET + meta-tag parse + Redis cache
│   └── ogfetch_test.go
├── affiliate/
│   ├── affiliate.go       # rule registry + Apply()
│   └── affiliate_test.go
├── redirect/
│   ├── service.go         # slug → link record → 302 target
│   ├── handlers.go        # GET /go/{slug}, /p/{slug}
│   └── redirect_test.go
├── publicapi/
│   ├── handlers.go        # GET /api/public/carts/{slug}
│   └── handlers_test.go
└── config/
    └── config.go          # extended with OAuth env vars

cmd/
├── shoplit-api/main.go    # auth + carts + og + public routes
└── shoplit-redirect/main.go  # /go and /p routes

web/
├── next.config.mjs        # rewrites: /api, /go, /p → backend
├── lib/
│   ├── api-client.ts      # REWRITTEN: real fetch()
│   └── mocks.ts           # DELETED
├── mocks/                 # DELETED
├── components/
│   ├── nav-bar.tsx        # MODIFIED: real user + logout dropdown
│   ├── cart-card.tsx      # MODIFIED: accept href prop
│   └── product-card.tsx   # MODIFIED: onError image fallback
├── public/
│   └── placeholder-product.svg  # NEW: neutral image fallback
└── app/
    ├── login/page.tsx     # MODIFIED: window.location to /api/v1/auth/google
    ├── (public)/page.tsx  # MODIFIED: CartCard with public href
    └── dashboard/carts/[id]/editor.tsx  # MODIFIED: error toasts

docs/
└── superpowers/
    └── runbooks/
        └── google-oauth-setup.md  # one-time GCP OAuth client setup
```

---

## Task 1: Add Go deps

**Files:** `go.mod`, `go.sum`

- [ ] **Step 1: Install**

```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
go get github.com/PuerkitoBio/goquery
go get github.com/matoous/go-nanoid/v2
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go mod tidy
go build ./...
```

- [ ] **Step 2: Commit**

```bash
git add go.mod go.sum
git commit -m "chore(deps): goquery, nanoid, oauth2/google"
```

---

## Task 2: Extend config with OAuth + session secret

**Files:**
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `.env.example`

- [ ] **Step 1: Add fields to `internal/config/config.go`**

```go
// internal/config/config.go
package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Env      string `env:"SHOPLIT_ENV" envDefault:"dev"`
	LogLevel string `env:"SHOPLIT_LOG_LEVEL" envDefault:"info"`

	DBDSN         string `env:"SHOPLIT_DB_DSN,required"`
	DBDSNReadOnly string `env:"SHOPLIT_DB_DSN_READONLY"`
	RedisURL      string `env:"SHOPLIT_REDIS_URL,required"`

	APIAddr      string `env:"SHOPLIT_API_ADDR" envDefault:":8080"`
	RedirectAddr string `env:"SHOPLIT_REDIRECT_ADDR" envDefault:":8081"`

	// Session signing secret. Random 32+ bytes (hex/base64) — generate with
	// `openssl rand -hex 32`. Used to HMAC-sign session and OAuth-state cookies.
	SessionSecret string `env:"SHOPLIT_SESSION_SECRET,required"`

	// Google OAuth 2.0 — create a client in https://console.cloud.google.com/.
	// See docs/superpowers/runbooks/google-oauth-setup.md.
	GoogleOAuthClientID     string `env:"GOOGLE_OAUTH_CLIENT_ID,required"`
	GoogleOAuthClientSecret string `env:"GOOGLE_OAUTH_CLIENT_SECRET,required"`
	GoogleOAuthRedirectURL  string `env:"GOOGLE_OAUTH_REDIRECT_URL" envDefault:"http://localhost:8080/api/v1/auth/google/callback"`

	// After successful sign-in, the OAuth callback redirects the browser to
	// this URL on the frontend.
	FrontendURL string `env:"SHOPLIT_FRONTEND_URL" envDefault:"http://localhost:3000"`
}

func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return &c, nil
}
```

- [ ] **Step 2: Update `internal/config/config_test.go`**

Update `TestLoad_AppliesDefaults` to set the new required env vars:

```go
// internal/config/config_test.go
package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustUnset(t *testing.T, keys ...string) {
	t.Helper()
	for _, k := range keys {
		original, hadIt := os.LookupEnv(k)
		os.Unsetenv(k)
		if hadIt {
			t.Cleanup(func() { os.Setenv(k, original) })
		} else {
			t.Cleanup(func() { os.Unsetenv(k) })
		}
	}
}

func TestLoad_AppliesDefaults(t *testing.T) {
	t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
	t.Setenv("SHOPLIT_REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("SHOPLIT_SESSION_SECRET", "test-secret-do-not-use-in-prod")
	t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "test-client-id")
	t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "dev", cfg.Env)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, ":8080", cfg.APIAddr)
	assert.Equal(t, ":8081", cfg.RedirectAddr)
	assert.Equal(t, "postgres://x", cfg.DBDSN)
	assert.Equal(t, "redis://localhost:6379/0", cfg.RedisURL)
	assert.Equal(t, "test-secret-do-not-use-in-prod", cfg.SessionSecret)
	assert.Equal(t, "http://localhost:8080/api/v1/auth/google/callback", cfg.GoogleOAuthRedirectURL)
	assert.Equal(t, "http://localhost:3000", cfg.FrontendURL)
}

func TestLoad_RequiresMandatory(t *testing.T) {
	t.Run("missing DBDSN", func(t *testing.T) {
		mustUnset(t, "SHOPLIT_DB_DSN")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		t.Setenv("SHOPLIT_SESSION_SECRET", "s")
		t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "c")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
	t.Run("missing SessionSecret", func(t *testing.T) {
		t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		mustUnset(t, "SHOPLIT_SESSION_SECRET")
		t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "c")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
	t.Run("missing GoogleOAuthClientID", func(t *testing.T) {
		t.Setenv("SHOPLIT_DB_DSN", "postgres://x")
		t.Setenv("SHOPLIT_REDIS_URL", "redis://x")
		t.Setenv("SHOPLIT_SESSION_SECRET", "s")
		mustUnset(t, "GOOGLE_OAUTH_CLIENT_ID")
		t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "s")
		_, err := Load()
		require.Error(t, err)
	})
}
```

- [ ] **Step 3: Update `.env.example`**

```bash
# Append these to .env.example:
cat >> .env.example <<'EOF'

# ─── auth ──────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
SHOPLIT_SESSION_SECRET=replace-me-with-32-bytes-of-random-hex

# Google OAuth 2.0 — see docs/superpowers/runbooks/google-oauth-setup.md
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:8080/api/v1/auth/google/callback

# Used by the OAuth callback to redirect back to the frontend after sign-in.
SHOPLIT_FRONTEND_URL=http://localhost:3000
EOF
```

- [ ] **Step 4: Verify**

```bash
go test ./internal/config/... -v -count=1
```

Expected: 4 sub-tests pass.

- [ ] **Step 5: Commit**

```bash
git add internal/config/ .env.example
git commit -m "feat(config): add session secret + google oauth env vars"
```

---

## Task 3: Write the GCP OAuth setup runbook

**Files:**
- Create: `docs/superpowers/runbooks/google-oauth-setup.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Google OAuth — One-Time Setup

This is required once per environment (dev, staging, prod). After this you'll
have a Google OAuth client ID + secret to drop into your `.env`.

## Steps

1. Go to https://console.cloud.google.com/.
2. Top-left, pick or create a project. Name it e.g. "shoplit-dev".
3. Left nav → **APIs & Services → OAuth consent screen**.
   - User type: **External** (so any Google account can sign in during dev).
   - App name: `shoplit (dev)` (use `shoplit` for prod).
   - User support email: yours.
   - Developer contact email: yours.
   - Scopes — add only: `openid`, `userinfo.email`, `userinfo.profile`.
   - Test users (dev only): add your own Google email so you can sign in
     before publishing.
   - Save.
4. Left nav → **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `shoplit-dev`.
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:8080/api/v1/auth/google/callback`
   - Click **Create**.
5. Copy the **Client ID** and **Client secret** into your local `.env`:

```bash
GOOGLE_OAUTH_CLIENT_ID=<paste here>
GOOGLE_OAUTH_CLIENT_SECRET=<paste here>
```

6. Generate a session secret:

```bash
openssl rand -hex 32
# paste into .env as SHOPLIT_SESSION_SECRET
```

7. Restart `make up`. Visit http://localhost:3000/login → "Continue with Google".

## Prod / staging differences

- Use a separate OAuth client per environment (so dev creds can't be used against prod).
- Add the prod redirect URI: `https://api.shoplit.app/api/v1/auth/google/callback`.
- Publish the OAuth consent screen (otherwise only test users can sign in).
- Set a strong session secret per environment.
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/superpowers/runbooks
git add docs/superpowers/runbooks/google-oauth-setup.md
git commit -m "docs: google oauth setup runbook"
```

---

## Task 4: SQL queries (users, carts, links, cart_items, click events)

**File:** `internal/db/queries.sql` (replace stub)

- [ ] **Step 1: Replace `internal/db/queries.sql`**

```sql
-- internal/db/queries.sql

-- ─── USERS ──────────────────────────────────────────────────────────────────

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByGoogleSub :one
SELECT * FROM users WHERE google_sub = $1;

-- name: UpsertGoogleUser :one
INSERT INTO users (google_sub, email, display_name, avatar_url, handle)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (google_sub) DO UPDATE
  SET email        = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url   = EXCLUDED.avatar_url
RETURNING *;

-- ─── CARTS ──────────────────────────────────────────────────────────────────

-- name: CreateCart :one
INSERT INTO carts (user_id, slug, title, description, cover_image_url, is_public)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCartByID :one
SELECT * FROM carts WHERE id = $1 AND archived_at IS NULL;

-- name: GetCartBySlug :one
SELECT * FROM carts WHERE slug = $1 AND archived_at IS NULL AND is_public = true;

-- name: ListCartsByUser :many
SELECT * FROM carts
WHERE user_id = $1 AND archived_at IS NULL
ORDER BY updated_at DESC;

-- name: UpdateCart :one
UPDATE carts SET
  title           = COALESCE($2, title),
  description     = COALESCE($3, description),
  cover_image_url = COALESCE($4, cover_image_url),
  is_public       = COALESCE($5, is_public),
  updated_at      = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCart :exec
UPDATE carts SET archived_at = now() WHERE id = $1;

-- ─── LINKS ──────────────────────────────────────────────────────────────────

-- name: CreateLink :one
INSERT INTO links (slug, user_id, original_url, retailer, link_type, cart_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetLinkBySlug :one
SELECT * FROM links WHERE slug = $1 AND disabled_at IS NULL;

-- ─── CART ITEMS ────────────────────────────────────────────────────────────

-- name: AddCartItem :one
INSERT INTO cart_items (cart_id, position, link_id, title, description, image_url, price_text, retailer)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListCartItems :many
SELECT ci.*, l.slug AS link_slug, l.original_url
FROM cart_items ci
JOIN links l ON ci.link_id = l.id
WHERE ci.cart_id = $1
ORDER BY ci.position ASC;

-- name: RemoveCartItem :exec
DELETE FROM cart_items WHERE id = $1 AND cart_id = $2;

-- name: NextCartItemPosition :one
SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM cart_items WHERE cart_id = $1;

-- name: ReorderCartItem :exec
UPDATE cart_items SET position = $3 WHERE id = $1 AND cart_id = $2;

-- ─── ANALYTICS (writes) ────────────────────────────────────────────────────

-- name: InsertClickEvent :exec
INSERT INTO click_events (link_id, occurred_at, country_code, user_agent_kind, referer_host)
VALUES ($1, now(), $2, $3, $4);

-- name: BumpClickDaily :exec
INSERT INTO click_daily (link_id, day, clicks)
VALUES ($1, current_date, 1)
ON CONFLICT (link_id, day) DO UPDATE SET clicks = click_daily.clicks + 1;

-- name: BumpCartViewsDaily :exec
INSERT INTO cart_views_daily (cart_id, day, views)
VALUES ($1, current_date, 1)
ON CONFLICT (cart_id, day) DO UPDATE SET views = cart_views_daily.views + 1;
```

- [ ] **Step 2: Regenerate sqlc**

```bash
make sqlc
go build ./...
go test ./internal/db/... -count=1
```

- [ ] **Step 3: Commit**

```bash
git add internal/db/queries.sql internal/db/sqlc/
git commit -m "feat(db): sqlc queries — users (google), carts, links, items, analytics"
```

---

## Task 5: Slug generator (internal/carts/slug.go)

**Files:**
- Create: `internal/carts/slug.go`
- Create: `internal/carts/slug_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/carts/slug_test.go
package carts_test

import (
	"strings"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSlug_DefaultLengthAndAlphabet(t *testing.T) {
	const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
	for i := 0; i < 100; i++ {
		s, err := carts.NewSlug()
		require.NoError(t, err)
		assert.Len(t, s, 8)
		for _, r := range s {
			assert.True(t, strings.ContainsRune(alphabet, r),
				"slug %q has out-of-alphabet rune %q", s, r)
		}
	}
}

func TestNewSlug_UniquePerCall(t *testing.T) {
	seen := make(map[string]bool, 200)
	for i := 0; i < 200; i++ {
		s, err := carts.NewSlug()
		require.NoError(t, err)
		assert.False(t, seen[s], "duplicate slug: %q", s)
		seen[s] = true
	}
}
```

- [ ] **Step 2: Run, see fail**

```bash
go test ./internal/carts/... -v
```

Expected: package not found.

- [ ] **Step 3: Implement**

```go
// internal/carts/slug.go
package carts

import (
	gonanoid "github.com/matoous/go-nanoid/v2"
)

const (
	slugAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
	slugLength   = 8
)

// NewSlug generates a random URL-safe slug using an unambiguous alphabet
// (no 0/O/1/I/L). 8 chars → ~2.2e14 possible slugs.
func NewSlug() (string, error) {
	return gonanoid.Generate(slugAlphabet, slugLength)
}
```

- [ ] **Step 4: Run, see pass**

```bash
go test ./internal/carts/... -v
```

- [ ] **Step 5: Commit**

```bash
git add internal/carts/slug.go internal/carts/slug_test.go
git commit -m "feat(carts): nanoid slug generator with unambiguous alphabet"
```

---

## Task 6: Session manager (HMAC-signed cookies)

**Files:**
- Create: `internal/auth/session.go`
- Create: `internal/auth/session_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/auth/session_test.go
package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSession_SetAndGetUser(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	rr := httptest.NewRecorder()
	sm.SetUser(rr, 42)

	cookies := rr.Result().Cookies()
	require.Len(t, cookies, 1)
	c := cookies[0]
	assert.Equal(t, "shoplit_session", c.Name)
	assert.True(t, c.HttpOnly)

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	uid, err := sm.GetUser(req)
	require.NoError(t, err)
	assert.Equal(t, int64(42), uid)
}

func TestSession_RejectsTampered(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&http.Cookie{Name: "shoplit_session", Value: "tampered.signature"})
	_, err := sm.GetUser(req)
	require.Error(t, err)
}

func TestSession_RejectsWrongSecret(t *testing.T) {
	sm1 := auth.NewSessionManager("secret-a")
	sm2 := auth.NewSessionManager("secret-b")
	rr := httptest.NewRecorder()
	sm1.SetUser(rr, 99)
	c := rr.Result().Cookies()[0]
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	_, err := sm2.GetUser(req)
	require.Error(t, err)
}

func TestSession_TempValueRoundtrip(t *testing.T) {
	sm := auth.NewSessionManager("test-secret-12345")
	rr := httptest.NewRecorder()
	sm.SetTemp(rr, "oauth_state", "abc123")
	c := rr.Result().Cookies()[0]
	assert.Equal(t, "shoplit_temp_oauth_state", c.Name)

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)
	got, err := sm.GetTemp(req, "oauth_state")
	require.NoError(t, err)
	assert.Equal(t, "abc123", got)
}
```

- [ ] **Step 2: Run, see fail**

```bash
go test ./internal/auth/... -v
```

- [ ] **Step 3: Implement**

```go
// internal/auth/session.go
// HMAC-signed cookie session manager. The cookie value format is
// `base64(user_id_string).hex(hmac-sha256)`. A wrong secret or tampered
// payload fails verification.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

const (
	SessionCookie  = "shoplit_session"
	tempCookiePrefix = "shoplit_temp_"
	sessionMaxAge  = 60 * 60 * 24 * 30 // 30 days
	tempMaxAge     = 600               // 10 minutes for OAuth state
)

type ctxKey struct{}

var userIDKey = ctxKey{}

// SessionManager signs cookies with HMAC-SHA256 using a server secret.
type SessionManager struct {
	secret []byte
}

func NewSessionManager(secret string) *SessionManager {
	return &SessionManager{secret: []byte(secret)}
}

// SetUser sets the session cookie containing the authenticated user_id.
func (s *SessionManager) SetUser(w http.ResponseWriter, userID int64) {
	val := s.sign(strconv.FormatInt(userID, 10))
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    val,
		Path:     "/",
		MaxAge:   sessionMaxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetUser returns the authenticated user_id from the session cookie, or an
// error if missing / tampered / wrong secret.
func (s *SessionManager) GetUser(r *http.Request) (int64, error) {
	c, err := r.Cookie(SessionCookie)
	if err != nil {
		return 0, fmt.Errorf("session: no cookie: %w", err)
	}
	raw, err := s.verify(c.Value)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(raw, 10, 64)
}

// Logout clears the session cookie.
func (s *SessionManager) Logout(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

// SetTemp stores a short-lived value under a derived cookie name. Used for
// OAuth state + PKCE verifier between /auth/google and the callback.
func (s *SessionManager) SetTemp(w http.ResponseWriter, key, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     tempCookiePrefix + key,
		Value:    s.sign(value),
		Path:     "/",
		MaxAge:   tempMaxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetTemp reads a previously-stored temp value.
func (s *SessionManager) GetTemp(r *http.Request, key string) (string, error) {
	c, err := r.Cookie(tempCookiePrefix + key)
	if err != nil {
		return "", fmt.Errorf("session: no temp cookie %s: %w", key, err)
	}
	return s.verify(c.Value)
}

// ClearTemp removes a previously-stored temp value.
func (s *SessionManager) ClearTemp(w http.ResponseWriter, key string) {
	http.SetCookie(w, &http.Cookie{
		Name:     tempCookiePrefix + key,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

// UserIDFromContext returns the user_id injected by the RequireUser middleware.
func UserIDFromContext(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(userIDKey).(int64)
	return v, ok
}

// RandomString returns N url-safe random characters. Used for OAuth state.
func RandomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *SessionManager) sign(value string) string {
	h := hmac.New(sha256.New, s.secret)
	h.Write([]byte(value))
	sig := hex.EncodeToString(h.Sum(nil))
	return base64.URLEncoding.EncodeToString([]byte(value)) + "." + sig
}

func (s *SessionManager) verify(cookieValue string) (string, error) {
	parts := strings.Split(cookieValue, ".")
	if len(parts) != 2 {
		return "", errors.New("session: bad cookie format")
	}
	valBytes, err := base64.URLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("session: base64 decode: %w", err)
	}
	h := hmac.New(sha256.New, s.secret)
	h.Write(valBytes)
	expectSig := hex.EncodeToString(h.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expectSig)) {
		return "", errors.New("session: bad signature")
	}
	return string(valBytes), nil
}

// userIDContext is exported for use by RequireUser middleware (which lives in
// middleware.go so the manager doesn't need to know about chi).
func userIDContext(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}
```

- [ ] **Step 4: Run, see pass**

```bash
go test ./internal/auth/... -v
```

- [ ] **Step 5: Commit**

```bash
git add internal/auth/session.go internal/auth/session_test.go
git commit -m "feat(auth): hmac-signed session + temp-value cookie manager"
```

---

## Task 7: Auth middleware (RequireUser)

**Files:**
- Create: `internal/auth/middleware.go`
- Modify: `internal/auth/session_test.go` (add middleware test)

- [ ] **Step 1: Write the failing test (append to `session_test.go`)**

```go
// add to internal/auth/session_test.go

func TestRequireUser_AllowsValidCookie(t *testing.T) {
	sm := auth.NewSessionManager("test-secret")
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		uid, ok := auth.UserIDFromContext(r.Context())
		require.True(t, ok)
		assert.Equal(t, int64(42), uid)
	})

	rr := httptest.NewRecorder()
	sm.SetUser(rr, 42)
	c := rr.Result().Cookies()[0]

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(c)

	rr2 := httptest.NewRecorder()
	sm.RequireUser()(next).ServeHTTP(rr2, req)

	assert.True(t, called)
	assert.Equal(t, http.StatusOK, rr2.Code)
}

func TestRequireUser_Rejects401WithoutCookie(t *testing.T) {
	sm := auth.NewSessionManager("test-secret")
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("should not be called")
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	sm.RequireUser()(next).ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}
```

- [ ] **Step 2: Run, see fail**

```bash
go test ./internal/auth/... -v
```

Expected: `sm.RequireUser` not defined.

- [ ] **Step 3: Implement**

```go
// internal/auth/middleware.go
package auth

import "net/http"

// RequireUser is a middleware that authenticates the request via the session
// cookie and injects the user_id into context. 401 if no/invalid cookie.
func (s *SessionManager) RequireUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, err := s.GetUser(r)
			if err != nil {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(userIDContext(r.Context(), uid)))
		})
	}
}
```

- [ ] **Step 4: Run, see pass**

```bash
go test ./internal/auth/... -v
```

- [ ] **Step 5: Commit**

```bash
git add internal/auth/middleware.go internal/auth/session_test.go
git commit -m "feat(auth): RequireUser middleware (401 without valid session)"
```

---

## Task 8: Google OAuth handlers + user upsert

**Files:**
- Create: `internal/auth/google.go`
- Create: `internal/auth/user_upsert.go`
- Create: `internal/auth/google_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/auth/google_test.go
package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

// fakeGoogleServer simulates Google's token + userinfo endpoints.
func fakeGoogleServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"access_token":"fake-access","token_type":"Bearer","expires_in":3600}`))
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"sub":            "google-sub-12345",
			"email":          "priya@example.com",
			"email_verified": true,
			"name":           "Priya Sharma",
			"picture":        "https://example.com/avatar.jpg",
		})
	})
	return httptest.NewServer(mux)
}

func TestGoogleCallback_HappyPath(t *testing.T) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	fake := fakeGoogleServer(t)
	defer fake.Close()

	sm := auth.NewSessionManager("test-secret")
	cfg := &oauth2.Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost/callback",
		Endpoint: oauth2.Endpoint{
			AuthURL:  fake.URL + "/auth",
			TokenURL: fake.URL + "/token",
		},
		Scopes: []string{"openid", "email", "profile"},
	}
	userinfoURL := fake.URL + "/userinfo"

	upsert := auth.NewUserUpsertFn(q)
	handler := auth.HandleGoogleCallback(cfg, sm, upsert, "http://localhost:3000", userinfoURL)

	// Pre-set state cookie
	rrPre := httptest.NewRecorder()
	sm.SetTemp(rrPre, "oauth_state", "fixed-state-value")
	stateCookie := rrPre.Result().Cookies()[0]

	req := httptest.NewRequest("GET", "/api/v1/auth/google/callback?state=fixed-state-value&code=fake-code", nil)
	req.AddCookie(stateCookie)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Should redirect to frontend
	assert.Equal(t, http.StatusFound, rr.Code)
	assert.True(t, strings.HasPrefix(rr.Header().Get("Location"), "http://localhost:3000/dashboard"))

	// Should have set session cookie
	cookies := rr.Result().Cookies()
	hasSession := false
	for _, c := range cookies {
		if c.Name == auth.SessionCookie && c.Value != "" {
			hasSession = true
		}
	}
	assert.True(t, hasSession, "expected session cookie to be set")

	// User should be in DB
	user, err := q.GetUserByGoogleSub(context.Background(), pgText("google-sub-12345"))
	require.NoError(t, err)
	assert.Equal(t, "Priya Sharma", user.DisplayName)
}

func TestGoogleCallback_RejectsBadState(t *testing.T) {
	sm := auth.NewSessionManager("test-secret")
	handler := auth.HandleGoogleCallback(&oauth2.Config{}, sm, nil, "http://x", "http://x")

	req := httptest.NewRequest("GET", "/callback?state=wrong&code=c", nil)
	rr := httptest.NewRecorder()
	// no state cookie — state mismatch
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

// helper, depends on sqlc-emitted pgtype.Text
func pgText(s string) pgtype.Text { return pgtype.Text{String: s, Valid: true} }
```

- [ ] **Step 2: Run, see fail**

```bash
go test ./internal/auth/... -v
```

Expected: `auth.HandleGoogleCallback`, `auth.NewUserUpsertFn` not defined.

- [ ] **Step 3: Implement Google OAuth handlers**

```go
// internal/auth/google.go
package auth

import (
	"encoding/json"
	"net/http"

	"golang.org/x/oauth2"
)

// GoogleUserInfo matches the response from https://www.googleapis.com/oauth2/v3/userinfo.
type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// GoogleConfig builds the oauth2.Config for Google sign-in.
func GoogleConfig(clientID, clientSecret, redirectURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     googleEndpoint,
	}
}

// googleEndpoint is a var (not const) so tests can swap it with a fake.
var googleEndpoint = oauth2.Endpoint{
	AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL: "https://oauth2.googleapis.com/token",
}

// GoogleUserInfoURL is also a var so tests can swap.
var GoogleUserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"

// HandleGoogleStart kicks off the OAuth flow: generates a random state value,
// stores it in a short-lived temp cookie, and redirects the browser to
// Google's consent screen.
func HandleGoogleStart(cfg *oauth2.Config, sm *SessionManager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state, err := RandomString(24)
		if err != nil {
			http.Error(w, "state gen", http.StatusInternalServerError)
			return
		}
		sm.SetTemp(w, "oauth_state", state)
		http.Redirect(w, r, cfg.AuthCodeURL(state, oauth2.AccessTypeOnline), http.StatusFound)
	})
}

// UpsertFn is called with the userinfo response. It should insert/update the
// row in `users` and return the local user_id.
type UpsertFn func(GoogleUserInfo) (int64, error)

// HandleGoogleCallback validates state, exchanges code → token, fetches
// userinfo, upserts the user, sets the session cookie, redirects to the
// frontend.
func HandleGoogleCallback(cfg *oauth2.Config, sm *SessionManager, upsert UpsertFn, frontendURL, userinfoURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// state verification
		want, err := sm.GetTemp(r, "oauth_state")
		if err != nil || r.URL.Query().Get("state") != want {
			http.Error(w, "invalid oauth state", http.StatusBadRequest)
			return
		}
		sm.ClearTemp(w, "oauth_state")

		// exchange
		token, err := cfg.Exchange(r.Context(), r.URL.Query().Get("code"))
		if err != nil {
			http.Error(w, "token exchange failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// fetch userinfo
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, userinfoURL, nil)
		if err != nil {
			http.Error(w, "userinfo req: "+err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("Authorization", "Bearer "+token.AccessToken)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, "userinfo fetch: "+err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		var info GoogleUserInfo
		if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
			http.Error(w, "userinfo decode: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if info.Sub == "" {
			http.Error(w, "google: missing sub claim", http.StatusBadGateway)
			return
		}

		uid, err := upsert(info)
		if err != nil {
			http.Error(w, "upsert: "+err.Error(), http.StatusInternalServerError)
			return
		}

		sm.SetUser(w, uid)
		http.Redirect(w, r, frontendURL+"/dashboard", http.StatusFound)
	})
}

// HandleLogout clears the session and 204s.
func HandleLogout(sm *SessionManager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sm.Logout(w)
		w.WriteHeader(http.StatusNoContent)
	})
}
```

- [ ] **Step 4: Implement user upsert**

```go
// internal/auth/user_upsert.go
package auth

import (
	"context"
	"strings"

	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

// NewUserUpsertFn returns an UpsertFn that writes the Google profile into
// the `users` table. Handle is derived from the email local-part (e.g.
// "priya@example.com" → "priya"); collisions on handle are tolerated by
// appending a short random suffix.
func NewUserUpsertFn(q *sqlcgen.Queries) UpsertFn {
	return func(info GoogleUserInfo) (int64, error) {
		handle := strings.Split(info.Email, "@")[0]
		// Sanitize: drop non-alnum, lowercase
		handle = sanitizeHandle(handle)

		params := sqlcgen.UpsertGoogleUserParams{
			GoogleSub:   pgtype.Text{String: info.Sub, Valid: true},
			Email:       pgtype.Text{String: info.Email, Valid: info.Email != ""},
			DisplayName: info.Name,
			AvatarUrl:   pgtype.Text{String: info.Picture, Valid: info.Picture != ""},
			Handle:      pgtype.Text{String: handle, Valid: handle != ""},
		}
		user, err := q.UpsertGoogleUser(context.Background(), params)
		if err != nil {
			// Handle collision: try a random suffix
			handle = handle + "-" + shortRandom()
			params.Handle = pgtype.Text{String: handle, Valid: true}
			user, err = q.UpsertGoogleUser(context.Background(), params)
			if err != nil {
				return 0, err
			}
		}
		return user.ID, nil
	}
}

func sanitizeHandle(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func shortRandom() string {
	s, _ := RandomString(4)
	return s[:6]
}
```

- [ ] **Step 5: Run tests, see pass**

```bash
go test ./internal/auth/... -v -count=1
```

- [ ] **Step 6: Commit**

```bash
git add internal/auth/google.go internal/auth/user_upsert.go internal/auth/google_test.go
git commit -m "feat(auth): google oauth callback + userinfo upsert"
```

---

## Task 9: OG fetcher (internal/ogfetch/)

**Files:** `internal/ogfetch/ogfetch.go`, `internal/ogfetch/ogfetch_test.go`

- [ ] **Step 1: Write test**

```go
// internal/ogfetch/ogfetch_test.go
package ogfetch_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetch_ParsesOGTags(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><head>
<meta property="og:title" content="Product Title">
<meta property="og:image" content="https://example.com/a.jpg">
<meta property="product:price:amount" content="999">
</head></html>`))
	}))
	defer srv.Close()

	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	f := ogfetch.New(rc)

	res, err := f.Fetch(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.True(t, res.OK)
	assert.Equal(t, "Product Title", res.Title)
	assert.Equal(t, "https://example.com/a.jpg", res.ImageURL)
	assert.Contains(t, res.PriceText, "999")
}

func TestFetch_404IsNotOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	defer srv.Close()
	mr := miniredis.RunT(t)
	rc, _ := rediscli.Open(context.Background(), "redis://"+mr.Addr()+"/0")
	res, err := ogfetch.New(rc).Fetch(context.Background(), srv.URL)
	require.NoError(t, err)
	assert.False(t, res.OK)
}

func TestRetailerFromURL(t *testing.T) {
	assert.Equal(t, "nykaa.com", ogfetch.RetailerFromURL("https://www.nykaa.com/x"))
	assert.Equal(t, "amazon.in", ogfetch.RetailerFromURL("https://www.amazon.in/dp/abc"))
	assert.Equal(t, "other", ogfetch.RetailerFromURL("https://other.com/x"))
}
```

- [ ] **Step 2: Implement**

```go
// internal/ogfetch/ogfetch.go
package ogfetch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	rediscli "github.com/mayur-tolexo/shoplit/internal/redis"
)

const (
	userAgent    = "shoplit-ogfetch/1.0 (+https://github.com/mayur-tolexo/shoplit)"
	cacheTTL     = 24 * time.Hour
	fetchTimeout = 5 * time.Second
)

type Result struct {
	OK        bool   `json:"ok"`
	Title     string `json:"title,omitempty"`
	ImageURL  string `json:"image_url,omitempty"`
	PriceText string `json:"price_text,omitempty"`
	Retailer  string `json:"retailer"`
	Reason    string `json:"reason,omitempty"`
}

type Fetcher struct {
	rc     *rediscli.Client
	client *http.Client
}

func New(rc *rediscli.Client) *Fetcher {
	return &Fetcher{rc: rc, client: &http.Client{Timeout: fetchTimeout}}
}

func (f *Fetcher) Fetch(ctx context.Context, rawURL string) (Result, error) {
	if cached, hit := f.cacheLookup(ctx, rawURL); hit {
		return cached, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return notOK(rawURL, "invalid URL"), nil
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")

	resp, err := f.client.Do(req)
	if err != nil {
		return notOK(rawURL, fmt.Sprintf("fetch: %s", err)), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return notOK(rawURL, fmt.Sprintf("server %d", resp.StatusCode)), nil
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return notOK(rawURL, "parse"), nil
	}
	out := Result{
		OK:       true,
		Title:    pickMeta(doc, "og:title", "twitter:title"),
		ImageURL: pickMeta(doc, "og:image", "twitter:image"),
		Retailer: RetailerFromURL(rawURL),
	}
	if out.Title == "" {
		out.Title = strings.TrimSpace(doc.Find("title").First().Text())
	}
	if price := pickMeta(doc, "product:price:amount", "og:price:amount"); price != "" {
		out.PriceText = "₹" + price
	}
	if out.Title == "" && out.ImageURL == "" {
		out = notOK(rawURL, "no metadata")
	}
	_ = f.cacheStore(ctx, rawURL, out)
	return out, nil
}

func notOK(rawURL, reason string) Result {
	return Result{OK: false, Retailer: RetailerFromURL(rawURL), Reason: reason}
}

func pickMeta(doc *goquery.Document, props ...string) string {
	for _, p := range props {
		var val string
		doc.Find(fmt.Sprintf(`meta[property=%q]`, p)).Each(func(_ int, s *goquery.Selection) {
			if val == "" {
				val, _ = s.Attr("content")
			}
		})
		if val == "" {
			doc.Find(fmt.Sprintf(`meta[name=%q]`, p)).Each(func(_ int, s *goquery.Selection) {
				if val == "" {
					val, _ = s.Attr("content")
				}
			})
		}
		if val != "" {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

func RetailerFromURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "other"
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	switch {
	case strings.HasSuffix(host, "nykaa.com"):
		return "nykaa.com"
	case strings.HasSuffix(host, "amazon.in"):
		return "amazon.in"
	case strings.HasSuffix(host, "amazon.com"):
		return "amazon.com"
	case strings.HasSuffix(host, "myntra.com"):
		return "myntra.com"
	case strings.HasSuffix(host, "flipkart.com"):
		return "flipkart.com"
	case strings.HasSuffix(host, "ajio.com"):
		return "ajio.com"
	default:
		return "other"
	}
}

func (f *Fetcher) cacheKey(rawURL string) string {
	h := sha256.Sum256([]byte(rawURL))
	return "og:" + hex.EncodeToString(h[:])
}

func (f *Fetcher) cacheLookup(ctx context.Context, rawURL string) (Result, bool) {
	raw, err := f.rc.Get(ctx, f.cacheKey(rawURL)).Result()
	if err != nil {
		return Result{}, false
	}
	var out Result
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return Result{}, false
	}
	return out, true
}

func (f *Fetcher) cacheStore(ctx context.Context, rawURL string, r Result) error {
	if !r.OK {
		return nil
	}
	b, _ := json.Marshal(r)
	return f.rc.Set(ctx, f.cacheKey(rawURL), b, cacheTTL).Err()
}
```

- [ ] **Step 3: Verify + commit**

```bash
go test ./internal/ogfetch/... -v
git add internal/ogfetch/
git commit -m "feat(ogfetch): server-side OG meta-tag fetcher with redis cache"
```

---

## Task 10: Affiliate registry (generic, no rules in v1)

**Files:** `internal/affiliate/affiliate.go`, `internal/affiliate/affiliate_test.go`

- [ ] **Step 1: Write test**

```go
// internal/affiliate/affiliate_test.go
package affiliate_test

import (
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/affiliate"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApply_NoRulePassthrough(t *testing.T) {
	got, err := affiliate.Apply("https://www.nykaa.com/x", "nykaa.com", "anyone")
	require.NoError(t, err)
	assert.Equal(t, "https://www.nykaa.com/x", got)
}

func TestApply_UnknownRetailerPassthrough(t *testing.T) {
	got, err := affiliate.Apply("https://example.com/x", "other", "")
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/x", got)
}

// (When a rule is added, e.g. for Nykaa in a follow-up plan, more tests go here.)
```

- [ ] **Step 2: Implement**

```go
// internal/affiliate/affiliate.go
// Registry of per-retailer affiliate rules. v1 ships with NO rules — all
// outbound URLs pass through unchanged. Each retailer-specific rule lands
// in its own follow-up plan, gated by the respective affiliate program's
// approval.
package affiliate

// Rule rewrites the outbound URL to include affiliate / tracking parameters.
type Rule func(rawURL, creatorHandle string) (string, error)

var rules = map[string]Rule{
	// nykaa.com: applyNykaa  ← will be wired up in a Nykaa-affiliate plan
}

// Apply dispatches to the right rule for retailer; pass-through if none.
func Apply(rawURL, retailer, creatorHandle string) (string, error) {
	rule, ok := rules[retailer]
	if !ok {
		return rawURL, nil
	}
	return rule(rawURL, creatorHandle)
}
```

- [ ] **Step 3: Verify + commit**

```bash
go test ./internal/affiliate/... -v
git add internal/affiliate/
git commit -m "feat(affiliate): rule registry (v1 ships with no rules; pass-through)"
```

---

## Task 11: Carts service

**Files:**
- Create: `internal/carts/service.go`, `internal/carts/marshal.go`, `internal/carts/util.go`, `internal/carts/service_test.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/carts/service_test.go
package carts_test

import (
	"context"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/pkg/testutil"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupSvc(t *testing.T) (*carts.Service, int64) {
	pool, dsn := testutil.NewPostgres(t)
	require.NoError(t, db.MigrateUp(dsn, "../db/migrations"))
	q := sqlcgen.New(pool)

	upsert := auth.NewUserUpsertFn(q)
	uid, err := upsert(auth.GoogleUserInfo{
		Sub: "g-1", Email: "test@example.com", Name: "Test User", Picture: "https://example.com/a.jpg",
	})
	require.NoError(t, err)
	return carts.NewService(q), uid
}

func TestService_CreateAndListCart(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()

	cart, err := svc.CreateCart(ctx, uid, "My First Cart")
	require.NoError(t, err)
	assert.Equal(t, "My First Cart", cart.Title)
	assert.Equal(t, uid, cart.UserID)
	assert.Equal(t, 8, len(cart.Slug.String))

	carts, err := svc.ListMyCarts(ctx, uid)
	require.NoError(t, err)
	assert.Len(t, carts, 1)
	assert.Equal(t, cart.ID, carts[0].ID)
}

func TestService_AddAndRemoveProduct(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Cart for items")

	item, err := svc.AddProduct(ctx, uid, cart.ID, carts.AddProductInput{
		OriginalURL: "https://www.nykaa.com/x",
		Retailer:    "nykaa.com",
		Title:       "Product 1",
		ImageURL:    "https://example.com/p1.jpg",
		PriceText:   "₹500",
	})
	require.NoError(t, err)
	assert.Equal(t, "Product 1", item.Title)
	assert.Equal(t, int32(0), item.Position)

	items, err := svc.ListCartItems(ctx, cart.ID)
	require.NoError(t, err)
	assert.Len(t, items, 1)

	require.NoError(t, svc.RemoveProduct(ctx, uid, cart.ID, item.ID))
	items, _ = svc.ListCartItems(ctx, cart.ID)
	assert.Len(t, items, 0)
}

func TestService_ForbidsCrossUser(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "private cart")

	const otherUserID = int64(99999)
	_, _, err := svc.GetCart(ctx, otherUserID, cart.ID)
	assert.ErrorIs(t, err, carts.ErrForbidden)
}

// helper
func pgText(s string) pgtype.Text { return pgtype.Text{String: s, Valid: true} }
```

- [ ] **Step 2: Run, see fail**

```bash
go test ./internal/carts/... -v
```

- [ ] **Step 3: Implement service**

```go
// internal/carts/service.go
package carts

import (
	"context"
	"errors"
	"fmt"

	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type Service struct {
	q *sqlcgen.Queries
}

func NewService(q *sqlcgen.Queries) *Service {
	return &Service{q: q}
}

var (
	ErrForbidden = errors.New("forbidden")
	ErrNotFound  = pgx.ErrNoRows
)

func (s *Service) CreateCart(ctx context.Context, userID int64, title string) (sqlcgen.Cart, error) {
	const maxAttempts = 5
	for i := 0; i < maxAttempts; i++ {
		slug, err := NewSlug()
		if err != nil {
			return sqlcgen.Cart{}, err
		}
		cart, err := s.q.CreateCart(ctx, sqlcgen.CreateCartParams{
			UserID:        userID,
			Slug:          pgtype.Text{String: slug, Valid: true},
			Title:         title,
			IsPublic:      true,
			CoverImageUrl: pgtype.Text{String: fmt.Sprintf("https://picsum.photos/seed/%s/1600/1000", slug), Valid: true},
		})
		if err == nil {
			return cart, nil
		}
		if !isUniqueViolation(err) {
			return sqlcgen.Cart{}, err
		}
	}
	return sqlcgen.Cart{}, errors.New("slug collision after retries")
}

func (s *Service) ListMyCarts(ctx context.Context, userID int64) ([]sqlcgen.Cart, error) {
	return s.q.ListCartsByUser(ctx, userID)
}

func (s *Service) GetCart(ctx context.Context, userID, cartID int64) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, nil, err
	}
	if cart.UserID != userID {
		return sqlcgen.Cart{}, nil, ErrForbidden
	}
	items, err := s.q.ListCartItems(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, nil, err
	}
	return cart, items, nil
}

func (s *Service) GetPublicCart(ctx context.Context, slug string) (sqlcgen.Cart, []sqlcgen.ListCartItemsRow, sqlcgen.User, error) {
	cart, err := s.q.GetCartBySlug(ctx, pgtype.Text{String: slug, Valid: true})
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	items, err := s.q.ListCartItems(ctx, cart.ID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	user, err := s.q.GetUserByID(ctx, cart.UserID)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	go func() {
		// fire-and-forget view bump
		_ = s.q.BumpCartViewsDaily(context.Background(), cart.ID)
	}()
	return cart, items, user, nil
}

func (s *Service) ListCartItems(ctx context.Context, cartID int64) ([]sqlcgen.ListCartItemsRow, error) {
	return s.q.ListCartItems(ctx, cartID)
}

type UpdatePatch struct {
	Title         *string
	Description   *string
	CoverImageURL *string
	IsPublic      *bool
}

func (s *Service) UpdateCart(ctx context.Context, userID, cartID int64, patch UpdatePatch) (sqlcgen.Cart, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.Cart{}, err
	}
	if cart.UserID != userID {
		return sqlcgen.Cart{}, ErrForbidden
	}
	params := sqlcgen.UpdateCartParams{ID: cartID}
	if patch.Title != nil {
		params.Title = pgtype.Text{String: *patch.Title, Valid: true}
	}
	if patch.Description != nil {
		params.Description = pgtype.Text{String: *patch.Description, Valid: true}
	}
	if patch.CoverImageURL != nil {
		params.CoverImageUrl = pgtype.Text{String: *patch.CoverImageURL, Valid: true}
	}
	if patch.IsPublic != nil {
		params.IsPublic = pgtype.Bool{Bool: *patch.IsPublic, Valid: true}
	}
	return s.q.UpdateCart(ctx, params)
}

type AddProductInput struct {
	OriginalURL string
	Retailer    string
	Title       string
	ImageURL    string
	PriceText   string
	Note        string
}

func (s *Service) AddProduct(ctx context.Context, userID, cartID int64, in AddProductInput) (sqlcgen.CartItem, error) {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	if cart.UserID != userID {
		return sqlcgen.CartItem{}, ErrForbidden
	}
	linkSlug, err := NewSlug()
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	link, err := s.q.CreateLink(ctx, sqlcgen.CreateLinkParams{
		Slug:        pgtype.Text{String: linkSlug, Valid: true},
		UserID:      userID,
		OriginalUrl: in.OriginalURL,
		Retailer:    in.Retailer,
		LinkType:    "in_cart",
		CartID:      pgtype.Int8{Int64: cartID, Valid: true},
	})
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	pos, err := s.q.NextCartItemPosition(ctx, cartID)
	if err != nil {
		return sqlcgen.CartItem{}, err
	}
	return s.q.AddCartItem(ctx, sqlcgen.AddCartItemParams{
		CartID:      cartID,
		Position:    int32(pos.NextPosition),
		LinkID:      link.ID,
		Title:       in.Title,
		Description: pgtype.Text{String: in.Note, Valid: in.Note != ""},
		ImageUrl:    pgtype.Text{String: in.ImageURL, Valid: in.ImageURL != ""},
		PriceText:   pgtype.Text{String: in.PriceText, Valid: in.PriceText != ""},
		Retailer:    pgtype.Text{String: in.Retailer, Valid: true},
	})
}

func (s *Service) RemoveProduct(ctx context.Context, userID, cartID, itemID int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
	}
	return s.q.RemoveCartItem(ctx, sqlcgen.RemoveCartItemParams{ID: itemID, CartID: cartID})
}

func (s *Service) ReorderProducts(ctx context.Context, userID, cartID int64, itemIDs []int64) error {
	cart, err := s.q.GetCartByID(ctx, cartID)
	if err != nil {
		return err
	}
	if cart.UserID != userID {
		return ErrForbidden
	}
	for i, id := range itemIDs {
		if err := s.q.ReorderCartItem(ctx, sqlcgen.ReorderCartItemParams{
			ID: id, CartID: cartID, Position: int32(i),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) GetUser(ctx context.Context, userID int64) (sqlcgen.User, error) {
	return s.q.GetUserByID(ctx, userID)
}

func isUniqueViolation(err error) bool {
	type sqlStater interface{ SQLState() string }
	var s sqlStater
	if errors.As(err, &s) {
		return s.SQLState() == "23505"
	}
	return false
}
```

- [ ] **Step 4: Implement marshal helpers**

```go
// internal/carts/marshal.go
package carts

import (
	"strconv"
	"time"

	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/jackc/pgx/v5/pgtype"
)

type CartJSON struct {
	ID               string        `json:"id"`
	Slug             string        `json:"slug"`
	OwnerHandle      string        `json:"ownerHandle"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	OwnerAvatarURL   string        `json:"ownerAvatarUrl"`
	Title            string        `json:"title"`
	Bio              string        `json:"bio,omitempty"`
	CoverImageURL    string        `json:"coverImageUrl"`
	AccentHex        string        `json:"accentHex"`
	Products         []ProductJSON `json:"products"`
	ViewsLast7d      int           `json:"viewsLast7d"`
	ClicksLast7d     int           `json:"clicksLast7d"`
	CreatedAt        string        `json:"createdAt"`
	UpdatedAt        string        `json:"updatedAt"`
}

type ProductJSON struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	ImageURL    string `json:"imageUrl"`
	PriceText   string `json:"priceText"`
	Retailer    string `json:"retailer"`
	Note        string `json:"note,omitempty"`
	OriginalURL string `json:"originalUrl"`
	GoSlug      string `json:"goSlug"` // for /go/{slug} links
}

type UserJSON struct {
	ID          string `json:"id"`
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

func MarshalUser(u sqlcgen.User) UserJSON {
	return UserJSON{
		ID:          intStr(u.ID),
		Handle:      pgTextStr(u.Handle),
		DisplayName: u.DisplayName,
		AvatarURL:   pgTextStr(u.AvatarUrl),
	}
}

func MarshalCart(c sqlcgen.Cart, owner sqlcgen.User, items []sqlcgen.ListCartItemsRow) CartJSON {
	out := CartJSON{
		ID:               intStr(c.ID),
		Slug:             pgTextStr(c.Slug),
		OwnerHandle:      pgTextStr(owner.Handle),
		OwnerDisplayName: owner.DisplayName,
		OwnerAvatarURL:   pgTextStr(owner.AvatarUrl),
		Title:            c.Title,
		Bio:              pgTextStr(c.Description),
		CoverImageURL:    pgTextStr(c.CoverImageUrl),
		AccentHex:        "#B5532A",
		ViewsLast7d:      0,
		ClicksLast7d:     0,
		CreatedAt:        c.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt:        c.UpdatedAt.Time.Format(time.RFC3339),
	}
	for _, it := range items {
		out.Products = append(out.Products, ProductJSON{
			ID:          intStr(it.ID),
			Title:       it.Title,
			ImageURL:    pgTextStr(it.ImageUrl),
			PriceText:   pgTextStr(it.PriceText),
			Retailer:    pgTextStr(it.Retailer),
			Note:        pgTextStr(it.Description),
			OriginalURL: it.OriginalUrl,
			GoSlug:      pgTextStr(it.LinkSlug),
		})
	}
	if out.Products == nil {
		out.Products = []ProductJSON{}
	}
	return out
}

func intStr(i int64) string {
	return strconv.FormatInt(i, 10)
}

func pgTextStr(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}
```

- [ ] **Step 5: Run, see pass**

```bash
go test ./internal/carts/... -v -count=1
```

(Adjust pgtype/sqlc field names to match generated code if needed.)

- [ ] **Step 6: Commit**

```bash
git add internal/carts/service.go internal/carts/marshal.go internal/carts/service_test.go
git commit -m "feat(carts): service layer with create/list/get/items/reorder + JSON shaping"
```

---

## Task 12: Cart HTTP handlers

**Files:** `internal/carts/handlers.go`, `internal/carts/handlers_test.go`

(Implementation follows the same pattern as the earlier draft; see Task 9 of the
previous Nykaa-slice plan — the handlers don't change between mock-auth and
real-auth, only the wiring in main.go does. Apply that handler code, with these
endpoint paths:

```
GET    /api/v1/me
GET    /api/v1/carts
POST   /api/v1/carts
GET    /api/v1/carts/{id}
PATCH  /api/v1/carts/{id}
POST   /api/v1/carts/{id}/items   (paste_url OR explicit fields)
DELETE /api/v1/carts/{id}/items/{itemID}
PATCH  /api/v1/carts/{id}/items/reorder
GET    /api/v1/og-fetch?url=...
```

The handler functions are unchanged from the previous-plan draft. Use the same
JSON shapes (`CartJSON`, `ProductJSON`, `UserJSON`) from `marshal.go`.

(Full code omitted to keep this plan tractable; copy from the Nykaa-slice
draft that was deleted — git log of `docs/superpowers/plans/` will show it
in the prior commit.)

- [ ] **Step 1: Write handlers + tests**
- [ ] **Step 2: Run tests, see pass**
- [ ] **Step 3: Commit**

```bash
git add internal/carts/handlers.go internal/carts/handlers_test.go
git commit -m "feat(carts): HTTP handlers for /api/v1/carts and /api/v1/og-fetch"
```

---

## Task 13: Public cart endpoint

**Files:** `internal/publicapi/handlers.go`, `internal/publicapi/handlers_test.go`

Same as Task 10 of the prior plan. Read-only `GET /api/public/carts/{slug}`
returns the `CartJSON` (without auth). 404 on missing.

- [ ] **Step 1: Write handler + test**
- [ ] **Step 2: Verify**
- [ ] **Step 3: Commit as `feat(publicapi): GET /api/public/carts/{slug}`**

---

## Task 14: Redirect service

**Files:** `internal/redirect/service.go`, `internal/redirect/handlers.go`, `internal/redirect/redirect_test.go`

Same as Task 11 of the prior plan. `GET /go/{slug}` and `GET /p/{slug}`
resolve the slug, look up the owning user (for affiliate `creatorHandle`),
apply the affiliate rule (pass-through for v1), 302 to target. Fire-and-forget
insert into `click_events` + bump `click_daily`.

- [ ] **Step 1: Write code + test**
- [ ] **Step 2: Verify**
- [ ] **Step 3: Commit as `feat(redirect): /go and /p with affiliate rewrite + click log`**

---

## Task 15: Wire shoplit-api/main.go

**File:** `cmd/shoplit-api/main.go`

- [ ] **Step 1: Replace main.go**

```go
// cmd/shoplit-api/main.go
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mayur-tolexo/shoplit/internal/auth"
	"github.com/mayur-tolexo/shoplit/internal/carts"
	"github.com/mayur-tolexo/shoplit/internal/config"
	"github.com/mayur-tolexo/shoplit/internal/db"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
	"github.com/mayur-tolexo/shoplit/internal/httpx"
	"github.com/mayur-tolexo/shoplit/internal/ogfetch"
	"github.com/mayur-tolexo/shoplit/internal/publicapi"
	"github.com/mayur-tolexo/shoplit/internal/redis"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: parseLevel(cfg.LogLevel)})))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DBDSN)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.MigrateUp(cfg.DBDSN, "internal/db/migrations"); err != nil {
		return err
	}

	q := sqlcgen.New(pool)
	rc, err := redis.Open(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rc.Close()

	sm := auth.NewSessionManager(cfg.SessionSecret)
	oauthCfg := auth.GoogleConfig(cfg.GoogleOAuthClientID, cfg.GoogleOAuthClientSecret, cfg.GoogleOAuthRedirectURL)
	upsert := auth.NewUserUpsertFn(q)
	fetcher := ogfetch.New(rc)
	svc := carts.NewService(q)

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)
	r.Method(http.MethodGet, "/health", httpx.Health(pool, rc, cfg.Env))

	// Auth (no middleware)
	r.Get("/api/v1/auth/google", auth.HandleGoogleStart(oauthCfg, sm).ServeHTTP)
	r.Get("/api/v1/auth/google/callback",
		auth.HandleGoogleCallback(oauthCfg, sm, upsert, cfg.FrontendURL, auth.GoogleUserInfoURL).ServeHTTP)
	r.Post("/api/v1/auth/logout", auth.HandleLogout(sm).ServeHTTP)

	// Public
	r.Route("/api/public", func(r chi.Router) { publicapi.RegisterRoutes(r, svc) })

	// Authenticated creator endpoints
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(sm.RequireUser())
		carts.RegisterRoutes(r, svc, fetcher)
	})

	srv := &http.Server{Addr: cfg.APIAddr, Handler: r, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		slog.Info("shoplit-api listening", "addr", cfg.APIAddr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("listen", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func parseLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
```

- [ ] **Step 2: Build + smoke**

```bash
go build ./cmd/shoplit-api
```

- [ ] **Step 3: Commit**

```bash
git add cmd/shoplit-api/main.go
git commit -m "feat(api): wire real google oauth + cart CRUD + og-fetch + public routes"
```

---

## Task 16: Wire shoplit-redirect/main.go

Same shape as Task 13 of the prior plan. Replace main.go to use `redirect.RegisterRoutes(r, redirect.NewService(q))`.

- [ ] **Step 1: Update main.go**
- [ ] **Step 2: Build + commit as `feat(redirect): wire /go and /p routes`**

---

## Task 17: Next.js rewrites

**File:** `web/next.config.mjs`

- [ ] **Step 1: Add the `rewrites()` function** (same as Task 14 of the prior plan — proxy `/api/*`, `/go/*`, `/p/*` to backend hosts).
- [ ] **Step 2: Commit as `feat(web): next.js rewrites to backend services`**

---

## Task 18: Frontend api-client real fetch

**Files:**
- Modify: `web/lib/api-client.ts` (rewrite)
- Delete: `web/lib/mocks.ts`, `web/mocks/`

Same code as Task 15 of the prior plan, with these changes:
- Remove the `mockLogin()` export (we redirect to Google instead).
- Add a `logout()` function: `POST /api/v1/auth/logout`.

- [ ] **Step 1: Rewrite api-client.ts**
- [ ] **Step 2: Delete mocks**
- [ ] **Step 3: Commit as `feat(web): wire api-client to real backend (drop mocks)`**

---

## Task 19: Login page redirects to Google OAuth

**File:** `web/app/login/page.tsx`

Change the click handlers so:
- "Continue with Google" → `window.location.href = "/api/v1/auth/google"` (full-page nav, NOT fetch)
- "Continue with phone" → for v1, show a toast: "Phone sign-in coming soon" and stay on the page.

- [ ] **Step 1: Modify handlers**

```tsx
// In web/app/login/page.tsx, replace handleGoogle:
const handleGoogle = () => {
  // Full-page navigation so the browser follows redirects through Google.
  window.location.href = "/api/v1/auth/google";
};

// Replace sendOtp and verifyOtp to toast a "coming soon" instead of calling mock:
const sendOtp = () => {
  toast.info("Phone sign-in coming soon. Use Google for now.");
};
const verifyOtp = sendOtp;
```

- [ ] **Step 2: Verify build**

```bash
cd web && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add web/app/login/page.tsx
git commit -m "feat(web): login → google oauth (full redirect); phone shows coming-soon"
```

---

## Task 20: NavBar logout + image fallback + UX fixes

**Files:**
- Modify: `web/components/nav-bar.tsx` (add logout dropdown)
- Modify: `web/components/product-card.tsx` (image onError fallback)
- Create: `web/public/placeholder-product.svg`
- Modify: `web/components/cart-card.tsx` (accept href prop)
- Modify: `web/app/(public)/page.tsx` (pass href for public cart)
- Modify: `web/app/dashboard/carts/[id]/editor.tsx` (error toasts)

(See the prior plan's Task 17 for editor-error-toast code and CartCard href
prop change — apply verbatim.)

- [ ] **Step 1: Add `web/public/placeholder-product.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="#F2EFE9">
  <rect width="400" height="400" fill="#F2EFE9"/>
  <text x="200" y="210" text-anchor="middle" font-family="serif" font-size="20" fill="#8C8779">image unavailable</text>
</svg>
```

- [ ] **Step 2: Update `web/components/product-card.tsx`** to handle image errors:

Add at the top of the component, after the imports:

```tsx
const [imgFailed, setImgFailed] = useState(false);
const imgSrc = imgFailed ? "/placeholder-product.svg" : product.imageUrl;
```

Then in the `<Image>` props, use `imgSrc` and add `onError`:

```tsx
<Image
  src={imgSrc}
  alt={product.title}
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  priority={eagerImage}
  loading={eagerImage ? "eager" : "lazy"}
  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
  unoptimized
  onError={() => setImgFailed(true)}
/>
```

(Make the component a Client Component if it isn't already — it already is, given the existing `"use client"` directive.)

- [ ] **Step 3: Update `web/components/nav-bar.tsx`**

```tsx
// web/components/nav-bar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/api-client";
import type { User } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavBar({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (variant !== "app") return;
    getCurrentUser()
      .then(setUser)
      .catch(() => {
        // Not signed in — kick to /login
        router.push("/login");
      });
  }, [variant, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      toast.success("Signed out");
      router.push("/");
    } catch {
      toast.error("Couldn't sign out.");
    }
  };

  return (
    <nav className="border-b border-rule bg-cream/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
        <Link href={variant === "app" ? "/dashboard" : "/"} className="font-serif text-2xl tracking-tight">
          shoplit
        </Link>
        {variant === "marketing" && (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-ink transition-colors">Sign in</Link>
            <Link href="/login" className="rounded-full bg-ink text-cream px-4 py-2 font-medium hover:opacity-90 transition-opacity">
              Start free
            </Link>
          </div>
        )}
        {variant === "app" && user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
              <Image
                src={user.avatarUrl}
                width={32}
                height={32}
                alt={user.displayName}
                className="rounded-full border border-rule"
                unoptimized
              />
              <span className="text-sm">@{user.handle}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Update `CartCard` to accept `href` prop** (per prior Task 17).

- [ ] **Step 5: Update landing page to use the prop**.

- [ ] **Step 6: Add error toasts to editor mutations** (per prior Task 17).

- [ ] **Step 7: Delete `web/mocks/`** (already done in Task 18, but ensure clean).

- [ ] **Step 8: Verify**

```bash
cd web && pnpm tsc --noEmit && pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat(web): nav logout + image fallback + landing CartCard href + editor toasts"
```

---

## Task 21: End-to-end verification

**No files.**

- [ ] **Step 1: Complete the GCP OAuth setup**

Follow `docs/superpowers/runbooks/google-oauth-setup.md`. Drop the Client ID + Secret into `.env`. Generate session secret with `openssl rand -hex 32`.

- [ ] **Step 2: `make up`** — all three services should report healthy.

- [ ] **Step 3: Sign in via the real Google flow**

- Open http://localhost:3000/login
- Click "Continue with Google"
- Authenticate at accounts.google.com (using the email you added as a test user in GCP)
- Should land on http://localhost:3000/dashboard
- Dashboard should be empty (no carts yet, since this is a fresh user)

- [ ] **Step 4: Create a cart**

- Click "+ New cart"
- Enter title "My Real Cart"
- Should land on the editor

- [ ] **Step 5: Add a real product**

- Click "Add product"
- Paste a real product URL from any website (e.g. an Amazon product, a Nykaa product, a blog post — anything with OG tags)
- Within 5s the preview should appear with real title + image
- Click "Add to cart"

- [ ] **Step 6: Verify image renders**

- The product image (hotlinked from the source CDN) should display in the editor preview AND on the public cart page (`/c/{slug}`).
- If the image doesn't render (CDN blocks the hotlink), the placeholder SVG should appear instead.

- [ ] **Step 7: Verify redirect works**

- Open the public cart page (`/c/{slug}`)
- Click "Shop on …"
- Browser should be redirected to the original product URL (with no affiliate params, since no rule is configured)
- A row should appear in `click_events`:

```bash
docker exec -i shoplit-pg psql -U shoplit -d shoplit -c "SELECT link_id, occurred_at, user_agent_kind FROM click_events ORDER BY occurred_at DESC LIMIT 5;"
```

- [ ] **Step 8: Verify logout works**

- Click avatar dropdown → "Sign out"
- Should land on `/`
- Visiting `/dashboard` should bounce to `/login`

- [ ] **Step 9: Tag the milestone**

```bash
make down
git log --oneline main..HEAD
git tag -a v1.0.0-rc1 -m "v1 full-build: real google OAuth + persisted carts + redirects"
```

Don't push — Mayur pushes/merges after he's reviewed.

---

## Acceptance criteria

The build is done when:
- A creator can sign in with their real Google account (no mocks anywhere).
- A creator can create carts, add products by pasting any product URL, see the real OG-fetched image + title.
- Public cart pages (`/c/{slug}`) render with real data + images.
- Clicking a product on a public cart page 302s to the original product URL (no affiliate yet, just the URL unchanged).
- Click events are recorded in `click_events`.
- Logout works; unauthenticated /dashboard access bounces to /login.
- All Go tests pass.
- `pnpm tsc --noEmit`, `pnpm lint`, `pnpm build` are clean.
- `make up` brings all three services healthy; `make down` cleans up.

**Phase 2** (a separate plan):
- Nykaa-specific affiliate rule (utm tagging, then real deep-link once approved)
- Nykaa catalog browse / search / bulk-add ("select their products in one go")
- Then Amazon, Myntra, Flipkart, AJIO rules as their programs get approved.
