# Public & private carts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each cart a `visibility` of `public` or `private`. Private carts 404 for everyone except their owner; public carts (and all existing carts) behave exactly as today. Add a Public/Private toggle in the editor's Settings section and a "Private" badge on dashboard cards.

**Architecture:** New `carts.visibility TEXT NOT NULL DEFAULT 'public'` column (CHECK `public|private`) as the source of truth; the legacy `is_public` boolean is left in place but **removed from the `GetCartBySlug` predicate** so the slug lookup returns private carts too and the *service* makes the owner-exception decision. `carts.Service.GetPublicCart` already receives `viewerUserID int64` from the in-flight accurate-analytics change — the private gate is layered on top: `visibility == "private" && viewerUserID != cart.UserID → ErrNotFound` (reuses `pgx.ErrNoRows`, so the existing handler 404 + web `notFound()` paths just work). Web: a debounced toggle in the editor + a card badge + one type/client field.

**Dependency (read first):** `docs/superpowers/specs/2026-05-25-accurate-analytics-design.md`. This plan **assumes** that change already:
- gave `internal/publicapi` the `*auth.SessionManager` and resolved the optional viewer,
- changed `carts.Service.GetPublicCart` to take `viewerUserID int64`,
- made `web/app/(public)/c/[slug]/page.tsx` forward `cookies().toString()` to `getCartBySlug`.
If analytics has **not** landed yet, Task 4 below includes a fallback note to add that minimal plumbing. Migration **0006** is reserved by analytics — this feature uses **0007**.

**Merge-coordination hotspots** (both features add to these — keep both additions): `MarshalCart`, `GetPublicCart`, `publicapi/handlers.go`, `web/lib/types.ts` `Cart`, `web/components/cart-card.tsx`, the editor Settings `EditorSection`.

**Testing note:** Go uses real-DB integration tests (`pkg/testutil.NewPostgres` + `db.MigrateUp`), per `internal/carts/service_test.go` — **not** fakes. Web has no React test runner; UI is gated by `tsc`/`lint`/`build` + manual, per the house pattern. Don't add RTL.

**Commit convention:** no `Co-Authored-By` trailer, no 🤖 emoji.

---

## Task 1: Migration `0007_cart_visibility`

Add the visibility column with a safe default so existing carts stay public.

**Files:**
- Create: `internal/db/migrations/0007_cart_visibility.up.sql`
- Create: `internal/db/migrations/0007_cart_visibility.down.sql`

- [ ] **Step 1: Write the up migration**

`internal/db/migrations/0007_cart_visibility.up.sql`:

```sql
-- Per-cart visibility: 'public' (anyone with the link) or 'private' (owner only).
-- Defaults to 'public' so all existing carts keep their current behavior.
ALTER TABLE carts
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));
```

- [ ] **Step 2: Write the down migration**

`internal/db/migrations/0007_cart_visibility.down.sql`:

```sql
ALTER TABLE carts DROP COLUMN visibility;
```

- [ ] **Step 3: Commit**

```bash
git add internal/db/migrations/0007_cart_visibility.up.sql internal/db/migrations/0007_cart_visibility.down.sql
git commit -m "feat(db): 0007 add carts.visibility (public|private), default public"
```

---

## Task 2: Queries + `sqlc generate`

The cart row must carry `visibility`; `UpdateCart` must be able to set it; `GetCartBySlug` must return it and stop filtering on the legacy `is_public` so the owner can fetch their own private cart.

**Files:**
- Modify: `internal/db/queries.sql`
- Regenerate: `internal/db/sqlc/*` (via `sqlc generate` — do not hand-edit)

- [ ] **Step 1: Drop the `is_public` filter from `GetCartBySlug`**

In `internal/db/queries.sql`, change:

```sql
-- name: GetCartBySlug :one
SELECT * FROM carts WHERE slug = $1 AND archived_at IS NULL AND is_public = true;
```

to:

```sql
-- name: GetCartBySlug :one
-- No is_public/visibility filter here: the service gates private carts so the
-- OWNER can still fetch their own. archived carts remain excluded.
SELECT * FROM carts WHERE slug = $1 AND archived_at IS NULL;
```

- [ ] **Step 2: Add `visibility` to the `UpdateCart` query**

Change:

```sql
-- name: UpdateCart :one
UPDATE carts SET
  title           = COALESCE($2, title),
  description     = COALESCE($3, description),
  cover_image_url = COALESCE($4, cover_image_url),
  is_public       = COALESCE($5, is_public),
  updated_at      = now()
WHERE id = $1
RETURNING *;
```

to:

```sql
-- name: UpdateCart :one
UPDATE carts SET
  title           = COALESCE($2, title),
  description     = COALESCE($3, description),
  cover_image_url = COALESCE($4, cover_image_url),
  is_public       = COALESCE($5, is_public),
  visibility      = COALESCE($6, visibility),
  updated_at      = now()
WHERE id = $1
RETURNING *;
```

> `SELECT *` and `RETURNING *` mean `CreateCart`, `GetCartByID`, `GetCartBySlug`, `ListCartsByUser`, and `UpdateCart` automatically pick up the new column after regeneration — no other query text changes. `CreateCart` does not set `visibility`, so new carts use the column DEFAULT `'public'`.

- [ ] **Step 3: Regenerate sqlc**

```bash
sqlc generate
```

Expected, in `internal/db/sqlc/`:
- `models.go` `Cart` struct gains `Visibility string \`json:"visibility"\``.
- `queries.sql.go`: every cart `row.Scan(...)` gains `&i.Visibility`; `getCartBySlug` const loses `AND is_public = true`; `UpdateCartParams` gains `Visibility pgtype.Text \`json:"visibility"\`` (a 6th param) and `updateCart` passes it.

(Do not hand-edit generated files; if `sqlc` isn't installed, install per the repo's existing tooling, then rerun.)

- [ ] **Step 4: Verify it compiles**

```bash
go build ./...
```
Expected: clean (the service still passes the old 5-field `UpdateCartParams` — Task 3 wires the 6th).

- [ ] **Step 5: Commit**

```bash
git add internal/db/queries.sql internal/db/sqlc
git commit -m "feat(db): carts carry visibility; GetCartBySlug drops is_public filter; UpdateCart sets visibility"
```

---

## Task 3: Service — update path + access gate (TDD)

`GetPublicCart` already has `viewerUserID int64` (analytics change). Add the private gate; extend `UpdatePatch`/`UpdateCart` to carry visibility.

**Files:**
- Modify: `internal/carts/service.go`
- Modify: `internal/carts/service_test.go`

- [ ] **Step 1: Write the failing tests first**

Append to `internal/carts/service_test.go`. These follow the existing real-DB pattern (`setupSvc`).

> **Coordination:** `GetPublicCart` takes `viewerUserID int64` as its 2nd param after analytics lands. If analytics has NOT landed and the signature is still `GetPublicCart(ctx, slug)`, do Task 4 Step 0 (add the param) before these tests compile.

```go
func TestService_NewCartDefaultsPublic(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, err := svc.CreateCart(ctx, uid, "Defaults")
	require.NoError(t, err)
	assert.Equal(t, "public", cart.Visibility)
}

func TestService_UpdateVisibility(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Toggle me")

	priv := "private"
	updated, err := svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &priv})
	require.NoError(t, err)
	assert.Equal(t, "private", updated.Visibility)

	pub := "public"
	updated, err = svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &pub})
	require.NoError(t, err)
	assert.Equal(t, "public", updated.Visibility)
}

func TestService_GetPublicCart_PrivateGate(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Secret")
	priv := "private"
	_, err := svc.UpdateCart(ctx, uid, cart.ID, carts.UpdatePatch{Visibility: &priv})
	require.NoError(t, err)

	// Owner sees their own private cart.
	got, _, _, err := svc.GetPublicCart(ctx, cart.Slug, uid)
	require.NoError(t, err)
	assert.Equal(t, cart.ID, got.ID)

	// Logged-out viewer (0) → not found.
	_, _, _, err = svc.GetPublicCart(ctx, cart.Slug, 0)
	assert.ErrorIs(t, err, carts.ErrNotFound)

	// A different user → not found.
	_, _, _, err = svc.GetPublicCart(ctx, cart.Slug, uid+99999)
	assert.ErrorIs(t, err, carts.ErrNotFound)
}

func TestService_GetPublicCart_PublicVisibleToAnon(t *testing.T) {
	svc, uid := setupSvc(t)
	ctx := context.Background()
	cart, _ := svc.CreateCart(ctx, uid, "Open")
	got, _, _, err := svc.GetPublicCart(ctx, cart.Slug, 0)
	require.NoError(t, err)
	assert.Equal(t, cart.ID, got.ID)
}
```

> The existing `TestService_GetPublicCart` (3-arg call) must be updated to pass a `viewerUserID` (e.g. `svc.GetPublicCart(ctx, cart.Slug, uid)` or `0`) — do that in this step so the package compiles.

Run: `go test ./internal/carts/` → fails to compile / fails (gate + Visibility field not wired).

- [ ] **Step 2: Add the private gate in `GetPublicCart`**

In `internal/carts/service.go`, the `GetPublicCart` body already fetches `cart` via `GetCartBySlug` and has `viewerUserID int64` in scope (from analytics). Immediately after the `GetCartBySlug` call succeeds, add the gate **before** the items/user fetch and the view bump:

```go
	cart, err := s.q.GetCartBySlug(ctx, slug)
	if err != nil {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, err
	}
	// Private carts are visible only to their owner; everyone else gets a
	// not-found (same as a nonexistent cart — no "this is private" leak).
	if cart.Visibility == "private" && viewerUserID != cart.UserID {
		return sqlcgen.Cart{}, nil, sqlcgen.User{}, ErrNotFound
	}
```

(`ErrNotFound` is already `pgx.ErrNoRows`, so the handler's `errors.Is(err, pgx.ErrNoRows)` branch maps it to 404.)

- [ ] **Step 3: Carry visibility through the update path**

In the `UpdatePatch` struct, add:

```go
type UpdatePatch struct {
	Title         *string
	Description   *string
	CoverImageURL *string
	IsPublic      *bool
	Visibility    *string
}
```

In `UpdateCart`, seed the param from the current row and apply the patch (mirrors the existing fields). `UpdateCartParams.Visibility` is `pgtype.Text` (COALESCE param), so seed it Valid from `cart.Visibility`:

```go
	params := sqlcgen.UpdateCartParams{
		ID:            cartID,
		Title:         cart.Title,
		Description:   cart.Description,
		CoverImageUrl: cart.CoverImageUrl,
		IsPublic:      cart.IsPublic,
		Visibility:    pgtype.Text{String: cart.Visibility, Valid: true},
	}
	...
	if patch.Visibility != nil {
		params.Visibility = pgtype.Text{String: *patch.Visibility, Valid: true}
	}
```

- [ ] **Step 4: Run the tests**

```bash
go test ./internal/carts/
```
Expected: green (new tests pass; existing ones still pass).

- [ ] **Step 5: Commit**

```bash
git add internal/carts/service.go internal/carts/service_test.go
git commit -m "feat(carts): private-cart access gate in GetPublicCart + visibility in UpdateCart"
```

---

## Task 4: Handler + marshal

Accept `visibility` on the PATCH; emit it in the cart JSON.

**Files:**
- Modify: `internal/carts/handlers.go`
- Modify: `internal/carts/marshal.go`
- Modify: `internal/publicapi/handlers.go` (only if analytics has NOT landed — see Step 0)

- [ ] **Step 0 (only if accurate-analytics has NOT merged): add the viewer param**

If `GetPublicCart` is still `GetPublicCart(ctx, slug)` (no `viewerUserID`), add the minimal plumbing now, matching the analytics design so it merges cleanly:
- `internal/carts/service.go`: add `viewerUserID int64` as the 2nd param of `GetPublicCart`.
- `internal/publicapi/handlers.go`: give `RegisterRoutes`/`getPublicCart` the `*auth.SessionManager`, resolve the optional session user (0 if none), pass it as `viewerUserID`.
- `web/app/(public)/c/[slug]/page.tsx`: `getCartBySlug(params.slug, { cookie: cookies().toString() })` in both `PublicCartPage` and `generateMetadata`.
- `cmd/shoplit-api/main.go`: pass the `SessionManager` into `publicapi.RegisterRoutes`.

If analytics HAS landed, **skip this step** — the param already exists; `publicapi/handlers.go` already passes `viewerUserID` and needs no change here.

- [ ] **Step 1: Accept `visibility` in the update handler**

In `internal/carts/handlers.go` `updateCart`, extend the request body and the patch:

```go
		var body struct {
			Title         *string `json:"title,omitempty"`
			Description   *string `json:"description,omitempty"`
			CoverImageURL *string `json:"cover_image_url,omitempty"`
			IsPublic      *bool   `json:"is_public,omitempty"`
			Visibility    *string `json:"visibility,omitempty"`
		}
```

```go
		cart, err := svc.UpdateCart(r.Context(), uid, id, UpdatePatch{
			Title: body.Title, Description: body.Description,
			CoverImageURL: body.CoverImageURL, IsPublic: body.IsPublic,
			Visibility: body.Visibility,
		})
```

> Defense-in-depth: an invalid value can't slip past the DB — the CHECK constraint rejects anything other than `public`/`private` (the request errors 500). The web client only ever sends those two, so no extra validation is added here (keep it lean; add a 400 guard later if a public API is exposed).

- [ ] **Step 2: Emit `visibility` in `MarshalCart`**

In `internal/carts/marshal.go`, add to `CartJSON`:

```go
	Visibility       string        `json:"visibility"`
```

and set it in `MarshalCart` (the cart row carries it — no signature change needed):

```go
		Visibility:       c.Visibility,
```

> **Merge note:** the analytics change adds a `reach` param + `reachLast7d` field to `MarshalCart`. This change adds **no parameter** (reads `visibility` off `c`), so the two edits don't collide on the signature — keep both the `reach` param/field and the `Visibility` field.

- [ ] **Step 3: Build + test**

```bash
go build ./... && go test ./...
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add internal/carts/handlers.go internal/carts/marshal.go
git commit -m "feat(carts): accept visibility on PATCH; include visibility in cart JSON"
```

---

## Task 5: Web — types + api-client

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/lib/api-client.ts`

- [ ] **Step 1: Add `visibility` to the `Cart` type**

In `web/lib/types.ts`, inside `interface Cart`, add (e.g. after `accentHex`):

```ts
  visibility: "public" | "private";   // 'private' carts 404 for non-owners
```

> **Merge note:** analytics adds `reachLast7d: number` to the same interface — keep both new fields.

- [ ] **Step 2: Forward `visibility` in `updateCart`**

In `web/lib/api-client.ts` `updateCart`, add to the body assembly:

```ts
  if (patch.visibility !== undefined) body.visibility = patch.visibility;
```

(placed alongside the existing `title`/`bio`/`coverImageUrl` mappings).

- [ ] **Step 3: Typecheck**

```bash
cd web && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/lib/api-client.ts
git commit -m "feat(web): Cart.visibility type + updateCart forwards visibility"
```

---

## Task 6: Web — editor Public/Private toggle

A small control at the top of the editor's **"Settings"** `EditorSection`, above the delete-cart block, wired through the existing debounced `patch`.

**Files:**
- Modify: `web/app/dashboard/carts/[id]/editor.tsx`

- [ ] **Step 1: Add icons to the lucide import**

Add `Globe` and `Lock` to the editor's lucide-react import line:

```tsx
import { ArrowUp, ArrowDown, Check, ExternalLink, Eye, Globe, GripVertical, Lock, Pencil, Share2, Trash2, X } from "lucide-react";
```

(Keep whatever names are already imported; just add `Globe` and `Lock`.)

- [ ] **Step 2: Insert the visibility control at the top of the Settings section**

In the `<EditorSection title="Settings">` block, insert this **before** the existing `<h3 ...>Delete this cart</h3>`:

```tsx
            {/* VISIBILITY */}
            <div className="pb-4 mb-4 border-b border-rule">
              <h3 className="text-sm font-medium mb-1">Visibility</h3>
              <p className="text-sm text-muted mb-3">
                {cart.visibility === "private"
                  ? "Only you can open this cart. The share link won't work for anyone else until you make it public."
                  : "Anyone with the link can view this cart."}
              </p>
              <div className="inline-flex rounded-full border border-rule p-0.5 bg-cream" role="group" aria-label="Cart visibility">
                <button
                  type="button"
                  aria-pressed={cart.visibility === "public"}
                  onClick={() => patch({ visibility: "public" })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    cart.visibility === "public" ? "bg-ink text-cream" : "text-muted hover:text-ink"
                  }`}
                >
                  <Globe size={14} aria-hidden /> Public
                </button>
                <button
                  type="button"
                  aria-pressed={cart.visibility === "private"}
                  onClick={() => patch({ visibility: "private" })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    cart.visibility === "private" ? "bg-ink text-cream" : "text-muted hover:text-ink"
                  }`}
                >
                  <Lock size={14} aria-hidden /> Private
                </button>
              </div>
            </div>
```

> `patch({ visibility })` reuses the existing 600 ms debounced autosave (optimistic `setCart` + PATCH), exactly like `title`/`bio`/`coverImageUrl`. No new state or handler.

- [ ] **Step 3: Typecheck + lint + build**

```bash
cd web && npx tsc --noEmit && npx next lint --dir app && pnpm run build
```
Expected: clean.

- [ ] **Step 4: Manual check**

Open a cart editor → expand **Settings** → toggle **Private**: the helper text updates, and after ~0.6 s the PATCH fires (network tab shows `visibility:"private"`). Toggle back to **Public**.

- [ ] **Step 5: Commit**

```bash
git add "web/app/dashboard/carts/[id]/editor.tsx"
git commit -m "feat(web): Public/Private visibility toggle in the cart editor Settings"
```

---

## Task 7: Web — "Private" badge on dashboard cards

**Files:**
- Modify: `web/components/cart-card.tsx`

- [ ] **Step 1: Add the `Lock` icon to the lucide import**

```tsx
import { Check, Eye, Lock, MousePointerClick, Share2 } from "lucide-react";
```

- [ ] **Step 2: Overlay a "Private" badge on the cover**

Inside the cover `<div className="relative aspect-[16/10] bg-paper">`, after `<CartCover .../>`, add:

```tsx
        {cart.visibility === "private" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/85 text-cream px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            <Lock size={11} aria-hidden /> Private
          </span>
        )}
```

> Placed on the cover (not the footer) so it reads at a glance without competing with the views/clicks chips. `top-2 left-2` keeps it clear of the analytics stats row in the footer.

- [ ] **Step 3: Typecheck + lint + build**

```bash
cd web && npx tsc --noEmit && npx next lint --dir components && pnpm run build
```
Expected: clean.

- [ ] **Step 4: Manual check**

On the dashboard, a cart toggled to Private shows a small **🔒 Private** pill on its cover; public carts show nothing extra.

- [ ] **Step 5: Commit**

```bash
git add web/components/cart-card.tsx
git commit -m "feat(web): 'Private' badge on private cart cards"
```

---

## Task 8: End-to-end verification + deploy

**Files:** none (verification only).

- [ ] **Step 1: Full gates**

```bash
go test ./... && go build ./...
cd web && npx tsc --noEmit && npx next lint && pnpm run build
```
Expected: all clean.

- [ ] **Step 2: Manual matrix**

- Toggle a cart to **Private** in the editor.
- As the **owner** (logged in), open `/c/{slug}` → renders normally; editor "View live" works.
- **Logged-out** (incognito), open `/c/{slug}` → **404 / not-found** (same as a bogus slug; no "private" leak).
- As a **different logged-in user**, open `/c/{slug}` → 404.
- Toggle back to **Public** → the link works for everyone again.
- Existing carts (never touched) → still public, unchanged.
- Dashboard shows the **Private** badge only on private carts.

- [ ] **Step 3: Deploy**

```bash
# from repo root, after merge to main — run migrations, then redeploy api + web
SHOPLIT_DEPLOY_KEY="$HOME/.ssh/shop-lit.pem" ./deploy/redeploy.sh shoplit-api
SHOPLIT_DEPLOY_KEY="$HOME/.ssh/shop-lit.pem" ./deploy/redeploy.sh shoplit-web
```
(Backend + web change. Confirm the 0007 migration applied. `shoplit-redirect` is unaffected by this feature.)

---

## Notes for the implementer

- **Order vs. analytics.** This plan assumes accurate-analytics (0006 + `viewerUserID` plumbing) lands first. If it hasn't, do Task 4 Step 0 to add the minimal viewer-resolution; otherwise leave `publicapi/handlers.go` and the public web page untouched (analytics owns those edits).
- **`is_public` stays.** We intentionally don't remove the legacy boolean — `CreateCart`/`UpdateCart` still set it; we only stop *reading* it on the public path. Retiring it is a separate cleanup.
- **No new error type.** Private → `ErrNotFound` (= `pgx.ErrNoRows`) so the existing 404 path is reused end-to-end.
- **Debounce reuse.** The editor toggle uses the same `patch()` autosave as every other field — don't add bespoke save logic.
- **No RTL/component tests** for web (house pattern: tsc+lint+build+manual). Go tests are real-DB integration via `testutil.NewPostgres`.
- Commit messages: no `Co-Authored-By`, no 🤖.
```