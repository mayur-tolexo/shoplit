# shoplit Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 browser extension that adds a product to a shoplit cart directly from a retailer product page, plus the backend token auth it needs.

**Architecture:** The extension reads the live product DOM in the creator's browser (residential IP — no AWS bot-block), extracts product fields (JSON-LD → OG → per-site fallback), and POSTs them to the existing add-item API using a Bearer token. The token is minted by a new authenticated endpoint and handed to the extension by a `shoplit.in/connect-extension` page.

**Tech Stack:** Go (chi, sqlc, pgx) backend; Next.js 14 connect page; extension in TypeScript bundled with esbuild; vitest + jsdom for extraction tests.

Spec: `docs/superpowers/specs/2026-05-24-shoplit-browser-extension-design.md`

---

## File Structure

**Backend (shoplit-api):**
- `internal/db/migrations/0004_extension_tokens.{up,down}.sql` — token table
- `internal/db/queries.sql` — 3 new queries (modify)
- `internal/db/sqlc/*` — regenerated (modify)
- `internal/auth/middleware.go` — Bearer fallback in RequireUser (modify)
- `internal/auth/session.go` — `BearerResolver` type + `WithBearerResolver` (modify)
- `internal/exttoken/exttoken.go` — token generate/hash, resolver, mint handler (create)
- `internal/exttoken/exttoken_test.go` — tests (create)
- `cmd/shoplit-api/main.go` — wire resolver + mint route (modify)

**Frontend:**
- `web/lib/api-client.ts` — `mintExtensionToken()` (modify)
- `web/app/connect-extension/page.tsx` — connect/handoff page (create)

**Extension (`extension/`):**
- `manifest.json`, `package.json`, `tsconfig.json`, `build.mjs`
- `src/retailer.ts`, `src/extract.ts`, `src/api.ts`, `src/service-worker.ts`, `src/content.ts`, `src/add-ui.ts`, `src/popup.html`, `src/popup.ts`, `src/types.ts`
- `test/retailer.test.ts`, `test/extract.test.ts`, `test/fixtures/*.html`

---

## Phase A — Backend: token table, Bearer auth, mint endpoint

### Task 1: Migration — extension_tokens table

**Files:**
- Create: `internal/db/migrations/0004_extension_tokens.up.sql`
- Create: `internal/db/migrations/0004_extension_tokens.down.sql`

- [ ] **Step 1: Write the up migration**

```sql
-- 0004_extension_tokens.up.sql
-- Long-lived Bearer tokens for the browser extension. We store only the
-- SHA-256 hash of the token; the raw token is shown once at mint time.
CREATE TABLE extension_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX extension_tokens_user_idx ON extension_tokens(user_id);
```

- [ ] **Step 2: Write the down migration**

```sql
-- 0004_extension_tokens.down.sql
DROP TABLE extension_tokens;
```

- [ ] **Step 3: Apply against the local DB**

Run: `make migrate-up`
Expected: `4/u extension_tokens (...)` and no error.

- [ ] **Step 4: Commit**

```bash
git add internal/db/migrations/0004_extension_tokens.up.sql internal/db/migrations/0004_extension_tokens.down.sql
git commit -m "feat(db): extension_tokens table for extension Bearer auth"
```

### Task 2: sqlc queries for extension tokens

**Files:**
- Modify: `internal/db/queries.sql`
- Modify (generated): `internal/db/sqlc/*`

- [ ] **Step 1: Add the queries**

Append to `internal/db/queries.sql`:

```sql
-- ─── EXTENSION TOKENS ────────────────────────────────────────────────────────

-- name: CreateExtensionToken :exec
INSERT INTO extension_tokens (user_id, token_hash) VALUES ($1, $2);

-- name: GetExtensionTokenByHash :one
SELECT id, user_id, revoked_at FROM extension_tokens WHERE token_hash = $1;

-- name: TouchExtensionToken :exec
UPDATE extension_tokens SET last_used_at = now() WHERE id = $1;
```

- [ ] **Step 2: Regenerate sqlc**

Run: `$(go env GOPATH)/bin/sqlc generate`
Expected: no error; `internal/db/sqlc/queries.sql.go` now has `CreateExtensionToken`, `GetExtensionTokenByHash`, `TouchExtensionToken`.

- [ ] **Step 3: Verify build**

Run: `go build ./...`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add internal/db/queries.sql internal/db/sqlc
git commit -m "feat(db): sqlc queries for extension tokens"
```

### Task 3: exttoken package — generate, hash, resolver, mint handler

**Files:**
- Create: `internal/exttoken/exttoken.go`
- Test: `internal/exttoken/exttoken_test.go`
- Modify: `internal/auth/session.go` (add `BearerResolver` type)

- [ ] **Step 1: Add the BearerResolver type to auth/session.go**

Add near the top of `internal/auth/session.go` (after the `ctxKey` block):

```go
// BearerResolver resolves a raw Bearer token to a user_id. Returns an error if
// the token is unknown or revoked. Wired in by main via WithBearerResolver.
type BearerResolver func(ctx context.Context, token string) (int64, error)
```

- [ ] **Step 2: Write the failing test**

```go
// internal/exttoken/exttoken_test.go
package exttoken

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestGenerate_TokenHashesToStoredHash(t *testing.T) {
	raw, hash, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(raw) < 32 {
		t.Fatalf("raw token too short: %q", raw)
	}
	sum := sha256.Sum256([]byte(raw))
	if want := hex.EncodeToString(sum[:]); want != hash {
		t.Fatalf("hash mismatch: got %s want %s", hash, want)
	}
	// Two calls produce different tokens.
	raw2, _, _ := Generate()
	if raw == raw2 {
		t.Fatal("expected unique tokens")
	}
}

func TestHashToken_MatchesGenerate(t *testing.T) {
	raw, hash, _ := Generate()
	if HashToken(raw) != hash {
		t.Fatal("HashToken should equal the hash from Generate")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `go test ./internal/exttoken/...`
Expected: FAIL (package/functions undefined).

- [ ] **Step 4: Implement exttoken.go**

```go
// internal/exttoken/exttoken.go

// Package exttoken issues and resolves the long-lived Bearer tokens the
// browser extension uses to call the shoplit API. Only the SHA-256 hash of a
// token is stored; the raw token is returned once at mint time.
package exttoken

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mayur-tolexo/shoplit/internal/auth"
	sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"
)

// Generate returns a new random token and its SHA-256 hex hash.
func Generate() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", fmt.Errorf("exttoken: rand: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, HashToken(raw), nil
}

// HashToken returns the SHA-256 hex hash of a raw token.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Resolver returns an auth.BearerResolver backed by the extension_tokens table.
func Resolver(q *sqlcgen.Queries) auth.BearerResolver {
	return func(ctx context.Context, token string) (int64, error) {
		row, err := q.GetExtensionTokenByHash(ctx, HashToken(token))
		if err != nil {
			return 0, err
		}
		if row.RevokedAt.Valid {
			return 0, fmt.Errorf("exttoken: revoked")
		}
		_ = q.TouchExtensionToken(ctx, row.ID) // best-effort
		return row.UserID, nil
	}
}

// MintHandler issues a new token for the authenticated user (session cookie).
// Returns {"token":"..."} exactly once.
func MintHandler(q *sqlcgen.Queries) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		raw, hash, err := Generate()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := q.CreateExtensionToken(r.Context(), sqlcgen.CreateExtensionTokenParams{
			UserID:    uid,
			TokenHash: hash,
		}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"token": raw})
	}
}

// BearerToken extracts the token from an "Authorization: Bearer <t>" header.
func BearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const p = "Bearer "
	if strings.HasPrefix(h, p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}

// unused import guards (keep pgtype/strconv referenced if trimmed by tooling)
var _ = pgtype.Text{}
var _ = strconv.Itoa
```

Note: remove the two `var _ =` guard lines if `goimports` already keeps the file clean; they exist only so the file compiles if you paste incrementally. Run `gofmt`/`goimports` before committing and delete unused imports (`pgtype`, `strconv` are not actually needed — drop them).

- [ ] **Step 5: Tidy imports**

Edit the import block to only what's used: `context`, `crypto/rand`, `crypto/sha256`, `encoding/base64`, `encoding/hex`, `encoding/json`, `fmt`, `net/http`, `strings`, `github.com/mayur-tolexo/shoplit/internal/auth`, `sqlcgen "github.com/mayur-tolexo/shoplit/internal/db/sqlc"`. Delete the `pgtype`/`strconv` guard lines.

- [ ] **Step 6: Run tests + build**

Run: `go test ./internal/exttoken/... && go build ./...`
Expected: PASS + build success.

- [ ] **Step 7: Commit**

```bash
git add internal/exttoken internal/auth/session.go
git commit -m "feat(auth): exttoken package — generate, hash, resolve, mint"
```

### Task 4: Bearer fallback in RequireUser

**Files:**
- Modify: `internal/auth/session.go` (add `bearer` field + `WithBearerResolver`)
- Modify: `internal/auth/middleware.go`
- Test: `internal/auth/middleware_test.go` (create)

- [ ] **Step 1: Add the field + setter to session.go**

In `internal/auth/session.go`, add `bearer BearerResolver` to the `SessionManager` struct, and:

```go
// WithBearerResolver enables Authorization: Bearer auth as a fallback to the
// session cookie (used by the browser extension). Returns the manager for
// chaining.
func (s *SessionManager) WithBearerResolver(fn BearerResolver) *SessionManager {
	s.bearer = fn
	return s
}
```

- [ ] **Step 2: Write the failing test**

```go
// internal/auth/middleware_test.go
package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mayur-tolexo/shoplit/internal/auth"
)

func TestRequireUser_BearerFallback(t *testing.T) {
	sm := auth.NewSessionManager("test-secret").WithBearerResolver(
		func(_ context.Context, token string) (int64, error) {
			if token == "good" {
				return 42, nil
			}
			return 0, http.ErrNoCookie
		},
	)
	var gotUID int64
	h := sm.RequireUser()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUID, _ = auth.UserIDFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	// Valid bearer → 200 + uid.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req.Header.Set("Authorization", "Bearer good")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK || gotUID != 42 {
		t.Fatalf("bearer good: code=%d uid=%d", rr.Code, gotUID)
	}

	// Bad bearer + no cookie → 401.
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req2.Header.Set("Authorization", "Bearer nope")
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusUnauthorized {
		t.Fatalf("bearer bad: code=%d", rr2.Code)
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `go test ./internal/auth/... -run TestRequireUser_BearerFallback`
Expected: FAIL (bearer path not implemented; currently 401 even for "good").

- [ ] **Step 4: Implement the fallback in middleware.go**

```go
package auth

import (
	"net/http"
	"strings"
)

func (s *SessionManager) RequireUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, err := s.GetUser(r)
			if err != nil && s.bearer != nil {
				if tok := bearerToken(r); tok != "" {
					if id, berr := s.bearer(r.Context(), tok); berr == nil {
						uid, err = id, nil
					}
				}
			}
			if err != nil {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(userIDContext(r.Context(), uid)))
		})
	}
}

func bearerToken(r *http.Request) string {
	const p = "Bearer "
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}
```

- [ ] **Step 5: Run tests + build**

Run: `go test ./internal/auth/... && go build ./...`
Expected: PASS (new + existing auth tests) + build success.

- [ ] **Step 6: Commit**

```bash
git add internal/auth/session.go internal/auth/middleware.go internal/auth/middleware_test.go
git commit -m "feat(auth): accept Bearer token as a fallback in RequireUser"
```

### Task 5: Wire the resolver + mint route in main.go

**Files:**
- Modify: `cmd/shoplit-api/main.go`

- [ ] **Step 1: Wire the resolver onto the session manager**

Find `sm := auth.NewSessionManager(cfg.SessionSecret).WithSecure(cfg.CookieSecure)` and change to:

```go
sm := auth.NewSessionManager(cfg.SessionSecret).
	WithSecure(cfg.CookieSecure).
	WithBearerResolver(exttoken.Resolver(q))
```

Note: `q := sqlcgen.New(pool)` is defined a few lines below the current `sm` assignment. Move the `sm := ...` line to AFTER `q := sqlcgen.New(pool)` so `q` is in scope.

- [ ] **Step 2: Register the mint route under /api/v1**

In the `/api/v1` route group, add the mint endpoint alongside `carts.RegisterRoutes`:

```go
r.Route("/api/v1", func(r chi.Router) {
	r.Use(sm.RequireUser())
	r.Post("/extension/token", exttoken.MintHandler(q))
	carts.RegisterRoutes(r, svc, fetcher)
})
```

- [ ] **Step 3: Add the import**

Add `"github.com/mayur-tolexo/shoplit/internal/exttoken"` to the import block.

- [ ] **Step 4: Build + run the suite**

Run: `go build ./... && go test ./...`
Expected: success.

- [ ] **Step 5: Manual smoke (local stack running via `make up`)**

```bash
# forge a session cookie for an existing user, then mint a token:
# (use the same forging approach as the deploy runbook; against http://localhost:8080)
curl -s -X POST -H "Cookie: shoplit_session=<forged>" http://localhost:8080/api/v1/extension/token
# Expected: {"token":"..."}.  Then:
curl -s -H "Authorization: Bearer <that token>" http://localhost:8080/api/v1/me
# Expected: the user's JSON (Bearer auth works).
```

- [ ] **Step 6: Commit**

```bash
git add cmd/shoplit-api/main.go
git commit -m "feat(api): mint endpoint + Bearer resolver wired into /api/v1"
```

---

## Phase B — Frontend connect page

### Task 6: connect-extension page + api-client

**Files:**
- Modify: `web/lib/api-client.ts`
- Create: `web/app/connect-extension/page.tsx`

- [ ] **Step 1: Add mintExtensionToken to api-client.ts**

Add near the other authed calls:

```ts
export async function mintExtensionToken(): Promise<string> {
  const r = await jsonFetch<{ token: string }>("/api/v1/extension/token", {
    method: "POST",
  });
  return r.token;
}
```

- [ ] **Step 2: Create the connect page (client component)**

```tsx
// web/app/connect-extension/page.tsx
"use client";

import { useEffect, useState } from "react";
import { mintExtensionToken } from "@/lib/api-client";

// The published/dev extension ID. For unpacked dev, set this to the ID Chrome
// assigns at chrome://extensions (stable per machine). Replace before publish.
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? "";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (id: string, msg: unknown, cb?: (resp: unknown) => void) => void;
      };
    };
  }
}

export default function ConnectExtensionPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"working" | "handed" | "manual" | "error">("working");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    mintExtensionToken()
      .then((t) => {
        if (!alive) return;
        setToken(t);
        // Try to hand the token to the extension directly.
        const send = window.chrome?.runtime?.sendMessage;
        if (EXTENSION_ID && send) {
          try {
            send(EXTENSION_ID, { type: "shoplit-token", token: t }, () => {});
            setStatus("handed");
            return;
          } catch {
            /* fall through to manual */
          }
        }
        setStatus("manual");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-serif text-3xl mb-3">Connect the shoplit extension</h1>
      {status === "working" && <p className="text-muted">Generating your connection token…</p>}
      {status === "error" && (
        <p className="text-red-600">Couldn&apos;t generate a token. Make sure you&apos;re signed in and try again.</p>
      )}
      {status === "handed" && (
        <p className="text-ink">✓ Connected. You can close this tab and start adding products from any shop.</p>
      )}
      {status === "manual" && token && (
        <div className="space-y-3">
          <p className="text-muted">
            Paste this one-time code into the shoplit extension to connect it. Keep it private — it grants access to your carts.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-md border border-rule bg-paper px-3 py-2 text-sm">{token}</code>
            <button
              onClick={copy}
              className="rounded-md bg-ink text-cream px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd web && npx tsc --noEmit && npx next lint --dir app --dir lib`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/api-client.ts web/app/connect-extension/page.tsx
git commit -m "feat(web): connect-extension page mints + hands off extension token"
```

---

## Phase C — Extension

### Task 7: Scaffold (manifest, build, tsconfig, types)

**Files:**
- Create: `extension/package.json`, `extension/tsconfig.json`, `extension/build.mjs`, `extension/manifest.json`, `extension/src/types.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "shoplit-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "test": "vitest run"
  },
  "devDependencies": {
    "esbuild": "^0.23.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

Note: add `@types/chrome` to devDependencies too: `"@types/chrome": "^0.0.268"`.

- [ ] **Step 3: build.mjs (esbuild → dist/)**

```js
// extension/build.mjs
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    "service-worker": "src/service-worker.ts",
    content: "src/content.ts",
    popup: "src/popup.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome114",
  logLevel: "info",
});

await cp("manifest.json", "dist/manifest.json");
await cp("src/popup.html", "dist/popup.html");
await cp("icons", "dist/icons", { recursive: true }).catch(() => {});
console.log("built → dist/");
```

- [ ] **Step 4: manifest.json**

```json
{
  "manifest_version": 3,
  "name": "shoplit — add to cart",
  "version": "0.1.0",
  "description": "Add any product to your shoplit cart from Amazon, Myntra, Nykaa, Flipkart, AJIO.",
  "action": { "default_popup": "popup.html", "default_title": "Add to shoplit" },
  "background": { "service_worker": "service-worker.js", "type": "module" },
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://shoplit.in/*",
    "https://*.nykaa.com/*",
    "https://*.myntra.com/*",
    "https://*.amazon.in/*",
    "https://*.amazon.com/*",
    "https://*.flipkart.com/*",
    "https://*.ajio.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://*.nykaa.com/*",
        "https://*.myntra.com/*",
        "https://*.amazon.in/*",
        "https://*.amazon.com/*",
        "https://*.flipkart.com/*",
        "https://*.ajio.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "externally_connectable": { "matches": ["https://shoplit.in/*"] }
}
```

- [ ] **Step 5: src/types.ts**

```ts
// extension/src/types.ts
export type Retailer =
  | "amazon.in" | "amazon.com" | "myntra.com" | "nykaa.com"
  | "flipkart.com" | "ajio.com" | "other";

export interface ExtractedProduct {
  title: string;
  imageUrl: string;
  priceText: string;
  url: string;       // canonical
  retailer: Retailer;
}

export interface Cart {
  id: string;
  title: string;
}

// Messages
export type Msg =
  | { type: "extract" }
  | { type: "extracted"; product: ExtractedProduct | null };
```

- [ ] **Step 6: Install + build**

Run: `cd extension && npm install && npm run build`
Expected: `built → dist/` (service-worker.js, content.js, popup.js, manifest.json present in dist/). It is OK that content/popup/service-worker source files don't exist yet IF you create empty stubs; otherwise do this step after Task 13. To unblock the build now, create one-line stubs:

```bash
mkdir -p src && printf 'export {};\n' > src/service-worker.ts && printf 'export {};\n' > src/content.ts && printf 'export {};\n' > src/popup.ts && printf '<!doctype html><title>shoplit</title>\n' > src/popup.html
```

- [ ] **Step 7: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/build.mjs extension/manifest.json extension/src/types.ts extension/src/service-worker.ts extension/src/content.ts extension/src/popup.ts extension/src/popup.html
git commit -m "chore(extension): MV3 scaffold (manifest, esbuild, types)"
```

### Task 8: retailer.ts (hostname → retailer)

**Files:**
- Create: `extension/src/retailer.ts`
- Test: `extension/test/retailer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// extension/test/retailer.test.ts
import { describe, it, expect } from "vitest";
import { retailerFromUrl } from "../src/retailer";

describe("retailerFromUrl", () => {
  it("classifies known hosts", () => {
    expect(retailerFromUrl("https://www.nykaa.com/x/p/1")).toBe("nykaa.com");
    expect(retailerFromUrl("https://www.amazon.in/dp/B0")).toBe("amazon.in");
    expect(retailerFromUrl("https://amzn.in/d/abc")).toBe("amazon.in");
    expect(retailerFromUrl("https://www.myntra.com/x")).toBe("myntra.com");
    expect(retailerFromUrl("https://www.flipkart.com/x")).toBe("flipkart.com");
    expect(retailerFromUrl("https://www.ajio.com/x")).toBe("ajio.com");
    expect(retailerFromUrl("https://example.com/x")).toBe("other");
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `cd extension && npx vitest run test/retailer.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement retailer.ts**

```ts
// extension/src/retailer.ts
import type { Retailer } from "./types";

export function retailerFromUrl(raw: string): Retailer {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === "amzn.in") return "amazon.in";
  if (host === "amzn.to" || host === "a.co") return "amazon.com";
  if (host.endsWith("nykaa.com")) return "nykaa.com";
  if (host.endsWith("amazon.in")) return "amazon.in";
  if (host.endsWith("amazon.com")) return "amazon.com";
  if (host.endsWith("myntra.com")) return "myntra.com";
  if (host.endsWith("flipkart.com")) return "flipkart.com";
  if (host.endsWith("ajio.com")) return "ajio.com";
  return "other";
}
```

- [ ] **Step 4: Run → pass**

Run: `cd extension && npx vitest run test/retailer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/retailer.ts extension/test/retailer.test.ts
git commit -m "feat(extension): retailer classification from hostname"
```

### Task 9: extract.ts (JSON-LD → OG → fallback)

**Files:**
- Create: `extension/src/extract.ts`
- Test: `extension/test/extract.test.ts`
- Create fixtures: `extension/test/fixtures/jsonld.html`, `extension/test/fixtures/og.html`

- [ ] **Step 1: Create fixtures**

`extension/test/fixtures/jsonld.html`:

```html
<!doctype html><html><head>
<link rel="canonical" href="https://www.nykaa.com/p/18377191">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Skin1004 Centella Cream",
"image":["https://images-static.nykaa.com/x.jpg"],
"offers":{"@type":"Offer","price":"590","priceCurrency":"INR"}}
</script></head><body></body></html>
```

`extension/test/fixtures/og.html`:

```html
<!doctype html><html><head>
<meta property="og:title" content="OG Product Name">
<meta property="og:image" content="https://example.com/og.jpg">
<meta property="og:url" content="https://www.myntra.com/p/123">
<meta property="product:price:amount" content="1499">
</head><body></body></html>
```

- [ ] **Step 2: Write the failing test**

```ts
// extension/test/extract.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { extractProduct } from "../src/extract";

function docFrom(fixture: string, url: string): Document {
  const html = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8");
  return new JSDOM(html, { url }).window.document;
}

describe("extractProduct", () => {
  it("reads JSON-LD Product", () => {
    const p = extractProduct(docFrom("jsonld.html", "https://www.nykaa.com/x/p/18377191"));
    expect(p?.title).toBe("Skin1004 Centella Cream");
    expect(p?.imageUrl).toBe("https://images-static.nykaa.com/x.jpg");
    expect(p?.priceText).toBe("₹590");
    expect(p?.retailer).toBe("nykaa.com");
    expect(p?.url).toBe("https://www.nykaa.com/p/18377191");
  });

  it("falls back to OG tags", () => {
    const p = extractProduct(docFrom("og.html", "https://www.myntra.com/x"));
    expect(p?.title).toBe("OG Product Name");
    expect(p?.imageUrl).toBe("https://example.com/og.jpg");
    expect(p?.priceText).toBe("₹1499");
    expect(p?.retailer).toBe("myntra.com");
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `cd extension && npx vitest run test/extract.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement extract.ts**

```ts
// extension/src/extract.ts
import type { ExtractedProduct, Retailer } from "./types";
import { retailerFromUrl } from "./retailer";

function canonicalUrl(doc: Document): string {
  const link = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const ogUrl = meta(doc, "og:url");
  return link || ogUrl || doc.location?.href || "";
}

function meta(doc: Document, prop: string): string {
  const el =
    doc.querySelector(`meta[property="${prop}"]`) ||
    doc.querySelector(`meta[name="${prop}"]`);
  return el?.getAttribute("content")?.trim() || "";
}

function priceStr(amount?: string | number): string {
  if (amount === undefined || amount === null || `${amount}` === "") return "";
  const n = `${amount}`.replace(/[^\d.]/g, "");
  return n ? `₹${n}` : "";
}

function fromJsonLd(doc: Document, canonical: string): Partial<ExtractedProduct> | null {
  const blocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const products: any[] = [];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b.textContent || "");
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const it of items) {
        const t = it && it["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) products.push(it);
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  if (!products.length) return null;
  // Prefer the product whose url matches the canonical, else the first.
  const p = products.find((x) => x.url && canonical && x.url === canonical) || products[0];
  const image = Array.isArray(p.image) ? p.image[0] : p.image;
  const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  return {
    title: typeof p.name === "string" ? p.name.trim() : "",
    imageUrl: typeof image === "string" ? image : "",
    priceText: priceStr(offers?.price),
  };
}

export function extractProduct(doc: Document): ExtractedProduct | null {
  const url = canonicalUrl(doc);
  const retailer: Retailer = retailerFromUrl(url);

  const jsonld = fromJsonLd(doc, url) ?? {};
  const title = jsonld.title || meta(doc, "og:title") || meta(doc, "twitter:title") || doc.title.trim();
  const imageUrl = jsonld.imageUrl || meta(doc, "og:image") || meta(doc, "twitter:image");
  const priceText = jsonld.priceText || priceStr(meta(doc, "product:price:amount"));

  if (!title && !imageUrl) return null;
  return { title, imageUrl, priceText, url, retailer };
}
```

- [ ] **Step 5: Run → pass**

Run: `cd extension && npx vitest run test/extract.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add extension/src/extract.ts extension/test/extract.test.ts extension/test/fixtures
git commit -m "feat(extension): product extraction (JSON-LD → OG fallback)"
```

### Task 10: api.ts (Bearer API client)

**Files:**
- Create: `extension/src/api.ts`

- [ ] **Step 1: Implement api.ts**

```ts
// extension/src/api.ts
import type { Cart, ExtractedProduct } from "./types";

const BASE = "https://shoplit.in";

async function authed<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listCarts(token: string): Promise<Cart[]> {
  const carts = await authed<{ id: string; title: string }[]>(token, "/api/v1/carts");
  return carts.map((c) => ({ id: c.id, title: c.title }));
}

export async function addProduct(
  token: string,
  cartId: string,
  p: ExtractedProduct,
  note: string,
): Promise<void> {
  await authed<unknown>(token, `/api/v1/carts/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({
      title: p.title,
      image_url: p.imageUrl,
      price_text: p.priceText,
      original_url: p.url,
      retailer: p.retailer,
      note,
    }),
  });
}
```

- [ ] **Step 2: Build check**

Run: `cd extension && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/api.ts
git commit -m "feat(extension): Bearer API client (list carts, add product)"
```

### Task 11: service-worker.ts (token storage + messaging)

**Files:**
- Modify: `extension/src/service-worker.ts`

- [ ] **Step 1: Implement service-worker.ts**

```ts
// extension/src/service-worker.ts
// Receives the token from the shoplit.in connect page (externally_connectable)
// and stores it. Exposes token get/set via chrome.storage for popup + content.

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "shoplit-token" && typeof msg.token === "string") {
    chrome.storage.local.set({ token: msg.token }, () => sendResponse({ ok: true }));
    return true; // async response
  }
  sendResponse({ ok: false });
  return false;
});
```

Note: token reads happen directly via `chrome.storage.local.get` in popup/content; the service worker only handles the external handoff for v1.

- [ ] **Step 2: Build**

Run: `cd extension && npm run build`
Expected: `built → dist/`.

- [ ] **Step 3: Commit**

```bash
git add extension/src/service-worker.ts
git commit -m "feat(extension): service worker receives token from connect page"
```

### Task 12: add-ui.ts (shared add UI)

**Files:**
- Create: `extension/src/add-ui.ts`

- [ ] **Step 1: Implement a framework-free renderer used by popup + injected panel**

```ts
// extension/src/add-ui.ts
import type { Cart, ExtractedProduct } from "./types";
import { listCarts, addProduct } from "./api";

interface RenderOpts {
  root: HTMLElement;
  product: ExtractedProduct | null;
  onConnectNeeded: () => void;
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get("token", (v) => resolve((v.token as string) || null)),
  );
}

export async function renderAddUI({ root, product, onConnectNeeded }: RenderOpts) {
  const token = await getToken();
  if (!token) {
    root.innerHTML = `<div class="sl-pad"><p>Connect the extension to your shoplit account first.</p>
      <button id="sl-connect" class="sl-btn">Connect to shoplit</button></div>`;
    root.querySelector<HTMLButtonElement>("#sl-connect")!.onclick = onConnectNeeded;
    return;
  }
  if (!product) {
    root.innerHTML = `<div class="sl-pad"><p>Couldn't find a product on this page. Open a product page and try again.</p></div>`;
    return;
  }

  let carts: Cart[] = [];
  try {
    carts = await listCarts(token);
  } catch (e) {
    if ((e as Error).message === "unauthorized") return onConnectNeeded();
    root.innerHTML = `<div class="sl-pad"><p>Couldn't load your carts. Try again.</p></div>`;
    return;
  }

  const options = carts.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("");
  root.innerHTML = `
    <div class="sl-pad">
      <div class="sl-row">
        <img src="${escapeAttr(product.imageUrl)}" class="sl-thumb" alt=""/>
        <input id="sl-title" class="sl-input" value="${escapeAttr(product.title)}"/>
      </div>
      <input id="sl-price" class="sl-input" value="${escapeAttr(product.priceText)}" placeholder="₹ price"/>
      <select id="sl-cart" class="sl-input">${options}</select>
      <input id="sl-note" class="sl-input" placeholder="Note (optional)"/>
      <button id="sl-add" class="sl-btn">＋ Add to cart</button>
      <p id="sl-msg" class="sl-msg"></p>
    </div>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  $("#sl-add").onclick = async () => {
    const btn = $<HTMLButtonElement>("#sl-add");
    btn.disabled = true;
    try {
      await addProduct(
        token,
        $<HTMLSelectElement>("#sl-cart").value,
        {
          ...product,
          title: $<HTMLInputElement>("#sl-title").value.trim(),
          priceText: $<HTMLInputElement>("#sl-price").value.trim(),
        },
        $<HTMLInputElement>("#sl-note").value.trim(),
      );
      $("#sl-msg").textContent = "Added ✓";
    } catch (e) {
      if ((e as Error).message === "unauthorized") return onConnectNeeded();
      $("#sl-msg").textContent = "Couldn't add — try again.";
      btn.disabled = false;
    }
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
```

- [ ] **Step 2: Typecheck**

Run: `cd extension && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/add-ui.ts
git commit -m "feat(extension): shared add-UI (cart picker, edit, add)"
```

### Task 13: popup.html + popup.ts

**Files:**
- Modify: `extension/src/popup.html`, `extension/src/popup.ts`

- [ ] **Step 1: popup.html**

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { width: 320px; margin: 0; font: 14px/1.4 system-ui, sans-serif; color: #1a1a1a; background: #fbf7f0; }
  .sl-pad { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .sl-row { display: flex; gap: 8px; align-items: center; }
  .sl-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; background: #eee; }
  .sl-input { width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid #d9d2c5; border-radius: 8px; font: inherit; background: #fff; }
  .sl-btn { padding: 9px; border: 0; border-radius: 999px; background: #1a1a1a; color: #fbf7f0; font-weight: 600; cursor: pointer; }
  .sl-msg { margin: 0; font-size: 12px; color: #6b6b6b; }
</style>
</head>
<body><div id="root"></div><script type="module" src="popup.js"></script></body>
</html>
```

- [ ] **Step 2: popup.ts**

```ts
// extension/src/popup.ts
import type { ExtractedProduct, Msg } from "./types";
import { renderAddUI } from "./add-ui";

const root = document.getElementById("root")!;

function openConnect() {
  chrome.tabs.create({ url: "https://shoplit.in/connect-extension" });
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function main() {
  const tabId = await activeTabId();
  let product: ExtractedProduct | null = null;
  if (tabId !== undefined) {
    try {
      const resp = (await chrome.tabs.sendMessage(tabId, { type: "extract" } as Msg)) as Msg;
      if (resp?.type === "extracted") product = resp.product;
    } catch {
      product = null; // content script not present on this page
    }
  }
  await renderAddUI({ root, product, onConnectNeeded: openConnect });
}

main();
```

- [ ] **Step 3: Build**

Run: `cd extension && npm run build`
Expected: `built → dist/`.

- [ ] **Step 4: Commit**

```bash
git add extension/src/popup.html extension/src/popup.ts
git commit -m "feat(extension): toolbar popup (extract via content script + add UI)"
```

### Task 14: content.ts (extract responder + injected button/panel)

**Files:**
- Modify: `extension/src/content.ts`

- [ ] **Step 1: Implement content.ts**

```ts
// extension/src/content.ts
import type { Msg } from "./types";
import { extractProduct } from "./extract";
import { renderAddUI } from "./add-ui";

// Respond to the popup's extract request.
chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.type === "extract") {
    sendResponse({ type: "extracted", product: extractProduct(document) } as Msg);
  }
  return false;
});

// Inject a floating "+ shoplit" button when the page looks like a product.
function injectButton() {
  if (document.getElementById("sl-fab")) return;
  const product = extractProduct(document);
  if (!product) return; // not a product page

  const fab = document.createElement("button");
  fab.id = "sl-fab";
  fab.textContent = "＋ shoplit";
  Object.assign(fab.style, {
    position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647",
    background: "#B5532A", color: "#fff", border: "0", borderRadius: "999px",
    padding: "10px 16px", font: "600 14px system-ui, sans-serif", cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,.25)",
  });
  fab.onclick = () => togglePanel(product);
  document.body.appendChild(fab);
}

function togglePanel(product: ReturnType<typeof extractProduct>) {
  const existing = document.getElementById("sl-panel");
  if (existing) {
    existing.remove();
    return;
  }
  const panel = document.createElement("div");
  panel.id = "sl-panel";
  Object.assign(panel.style, {
    position: "fixed", right: "18px", bottom: "64px", zIndex: "2147483647",
    width: "320px", background: "#fbf7f0", color: "#1a1a1a",
    border: "1px solid #d9d2c5", borderRadius: "12px",
    boxShadow: "0 8px 28px rgba(0,0,0,.25)", font: "14px system-ui, sans-serif",
  });
  // Reuse the popup styles inline (the panel lives in the host page).
  injectPanelStyles();
  document.body.appendChild(panel);
  renderAddUI({
    root: panel,
    product,
    onConnectNeeded: () => window.open("https://shoplit.in/connect-extension", "_blank"),
  });
}

function injectPanelStyles() {
  if (document.getElementById("sl-styles")) return;
  const s = document.createElement("style");
  s.id = "sl-styles";
  s.textContent = `
    #sl-panel .sl-pad{padding:14px;display:flex;flex-direction:column;gap:8px}
    #sl-panel .sl-row{display:flex;gap:8px;align-items:center}
    #sl-panel .sl-thumb{width:44px;height:44px;object-fit:cover;border-radius:8px;background:#eee}
    #sl-panel .sl-input{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d9d2c5;border-radius:8px;font:inherit;background:#fff}
    #sl-panel .sl-btn{padding:9px;border:0;border-radius:999px;background:#1a1a1a;color:#fbf7f0;font-weight:600;cursor:pointer}
    #sl-panel .sl-msg{margin:0;font-size:12px;color:#6b6b6b}`;
  document.head.appendChild(s);
}

// Retailer SPAs swap content without full reloads; retry button injection.
injectButton();
const obs = new MutationObserver(() => injectButton());
obs.observe(document.documentElement, { childList: true, subtree: true });
```

- [ ] **Step 2: Build + typecheck**

Run: `cd extension && npx tsc --noEmit && npm run build`
Expected: no type errors; `built → dist/`.

- [ ] **Step 3: Commit**

```bash
git add extension/src/content.ts
git commit -m "feat(extension): content script — extract responder + injected button/panel"
```

### Task 15: Load unpacked + manual E2E verification

**Files:** none (verification + README)

- [ ] **Step 1: Create extension/README.md with load + connect steps**

```md
# shoplit extension (dev)

1. `npm install && npm run build`
2. Chrome → chrome://extensions → enable Developer mode → "Load unpacked" → select `extension/dist`.
3. Copy the extension ID Chrome shows; set `NEXT_PUBLIC_EXTENSION_ID` for the web app (and rebuild the connect page) so the auto-handoff works. Without it, the copy-paste fallback is used.
4. Sign in at https://shoplit.in, open https://shoplit.in/connect-extension to connect.
5. Visit a product page on Nykaa/Myntra/Amazon/Flipkart/AJIO → click the toolbar icon or the "＋ shoplit" button → pick a cart → Add.
```

- [ ] **Step 2: Manual E2E checklist (record results in the PR)**

For each of Nykaa, Myntra, Amazon.in, Flipkart, AJIO:
- Open a product page; confirm the "＋ shoplit" button appears.
- Toolbar popup shows the correct title + image + price.
- Add to a cart succeeds; the product appears on the cart's `/c/{slug}` page and the "Shop" link redirects to the product.

Expected: title + image populate on at least JSON-LD retailers (Nykaa, Amazon); price where present. Where a field is missing, the inline edit lets the user fix it before adding.

- [ ] **Step 3: Commit**

```bash
git add extension/README.md
git commit -m "docs(extension): dev load + connect + E2E checklist"
```

---

## Self-Review Notes

- **Spec coverage:** token table (T1), queries (T2), generate/hash/mint/resolver (T3), Bearer in RequireUser (T4), wiring (T5), connect page + handoff incl. copy-paste fallback (T6), MV3 manifest + activeTab/scripting/storage + externally_connectable (T7), generic extraction JSON-LD→OG (T9) across 5 retailers (T7 matches + T8 classification), popup (T13) + injected button/panel sharing add-ui (T12/T14), Bearer API reusing GET /carts + POST /carts/{id}/items (T10). All spec sections mapped.
- **Type consistency:** `ExtractedProduct`/`Cart`/`Msg` defined in T7 `types.ts` and used unchanged in T9–T14. Backend `CreateExtensionTokenParams{UserID, TokenHash}` matches the sqlc names from the query in T2. `auth.BearerResolver` defined T3, used T4/T5.
- **Out of scope (per spec):** Chrome Web Store publishing, Firefox/Safari, bulk import, revoke UI — none planned, intentional.
