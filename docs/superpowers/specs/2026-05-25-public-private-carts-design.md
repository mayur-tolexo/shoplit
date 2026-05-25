# Public & private carts — design

**Date:** 2026-05-25
**Status:** Approved direction (decisions locked)

## Problem

Today every cart is reachable by anyone who has (or guesses) the link — `/c/{slug}`
always resolves if the cart exists, is not archived, and `is_public = true`. Creators
want to **stage carts privately** — build them out, keep them for themselves until
they're ready, and only then share — without deleting/recreating or juggling slugs.

Roadmap item: *"Public & private carts — decide who can see each cart: keep some
public, others just for you until you're ready to share."*

## Decisions (locked)

- Each cart has a **visibility**: `public` or `private`.
  - **public** — anyone with the link can view `/c/{slug}` (today's behavior).
  - **private** — only the **owner** can view it; everyone else (logged-out, or a
    different logged-in user) gets a **404 / not-found**, identical to a cart that
    doesn't exist (no "this is private" leak).
- **Default is `public`.** New carts are public; **all existing carts stay public**
  (the column defaults to `'public'`, so there is no behavior change for them).
- The owner viewing **their own** private cart at `/c/{slug}` sees it **normally**
  (so "View live" / preview from the editor still works while private).
- This is a **single binary flip** (public ⇄ private). No per-person sharing,
  no password links, no "unlisted" middle tier (see Non-goals).

## New column vs. the existing `is_public`

The schema already has `carts.is_public BOOLEAN NOT NULL DEFAULT true`, and
`GetCartBySlug` filters `... AND is_public = true`. That boolean predates this work
and is **not** what we want for the feature, because:

- It is enforced **in SQL** (`GetCartBySlug` returns no row when `is_public = false`),
  so it would hide a private cart from **the owner too** — there's no place to make
  an owner exception.
- Per the roadmap we want a typed, extensible visibility concept, gated in the
  **service** (where the owner is known) rather than baked into the slug lookup.

**Decision:** introduce a dedicated `visibility TEXT NOT NULL DEFAULT 'public'`
column (CHECK `visibility IN ('public','private')`) as the source of truth for this
feature, and **drop the `is_public = true` predicate from `GetCartBySlug`** so the
service receives every non-archived cart and decides access from `visibility` +
the viewer's identity. `is_public` is left in place (other code seeds it on
create/update; removing it is out of scope) but is **no longer consulted on the
public read path**. A follow-up can retire `is_public` once nothing reads it.

## Access semantics

`carts.Service.GetPublicCart` already receives `viewerUserID int64` (0 when the
request has no logged-in user) — this plumbing is added by the in-flight
**accurate-analytics** change (see Dependency below). On top of it:

```
cart := GetCartBySlug(slug)            // archived rows already excluded; no is_public filter
if cart.Visibility == "private" && viewerUserID != cart.UserID:
    return ErrNotFound                 // → handler 404 → web notFound()
```

| Cart visibility | Viewer            | Result                  |
|-----------------|-------------------|-------------------------|
| public          | anyone            | 200, cart renders       |
| private         | owner             | 200, cart renders       |
| private         | logged-out        | 404 (not-found)         |
| private         | a different user  | 404 (not-found)         |

- "Not-found" reuses the existing `pgx.ErrNoRows` path so the handler already maps
  it to `http.NotFound`, and the web page already calls `notFound()` on a null cart
  — no new error type or status code is introduced.
- The view-bump for analytics still runs only for non-owner viewers (already true
  via the owner-exclusion in the analytics change); a private cart simply never
  reaches the bump for non-owners because it 404s first.

## Surfaces

### Backend
1. **Migration `0007_cart_visibility`** — add `visibility TEXT NOT NULL DEFAULT
   'public'` + `CHECK (visibility IN ('public','private'))` to `carts`. (0006 is
   reserved by the analytics change.)
2. **Queries / sqlc** — `carts.*` rows now carry `visibility`; `UpdateCart` can set
   it (COALESCE, like other fields); `GetCartBySlug` returns it and drops the
   `is_public` filter. Rerun `sqlc generate`.
3. **Service** — `GetPublicCart` gates as above; `UpdatePatch` gains
   `Visibility *string`; `UpdateCart` seeds + applies it.
4. **Handler** — `PATCH /api/v1/carts/{id}` accepts `visibility`.
5. **Marshal** — `MarshalCart` emits `visibility` in `CartJSON`.

### Web
6. **Editor toggle** — a Public/Private control in the editor's **"Settings"**
   `EditorSection`, wired through the existing debounced `patch({ visibility })`
   (600 ms) → `updateCart`. Picking "Private" shows a one-line helper that the link
   stops working for others until set back to Public.
7. **Dashboard badge** — a small **"Private"** badge on private cart cards
   (`cart-card.tsx`), so creators can tell at a glance which carts aren't live.
8. **Types / client** — `Cart` gains `visibility: "public" | "private"`;
   `updateCart` forwards `visibility` in the PATCH body.

## Dependency: accurate-analytics (must land first / coordinate)

This design **assumes** the accurate-analytics change
(`docs/superpowers/specs/2026-05-25-accurate-analytics-design.md`) has already added
the optional-viewer plumbing to the public read path:

- `internal/publicapi` holds the `*auth.SessionManager` and resolves the optional
  logged-in viewer from the forwarded cookie.
- `carts.Service.GetPublicCart` takes `viewerUserID int64`.
- `web/app/(public)/c/[slug]/page.tsx` forwards `cookies().toString()` to
  `getCartBySlug`.

We **do not redesign** that plumbing; the private-cart check is layered on top of
the `viewerUserID` it already provides. If this feature lands **before** analytics,
the implementer must add the same minimal viewer-resolution (one `SessionManager`
field on `publicapi`, one param on `GetPublicCart`, one cookie-forward on the web
page) — the plan notes this — but the expected order is analytics-first.

### Merge-coordination hotspots (both features edit these)

| File / symbol                                   | Analytics change                        | This change                              |
|-------------------------------------------------|-----------------------------------------|------------------------------------------|
| `internal/carts/marshal.go` `MarshalCart`       | adds `reach` param + `reachLast7d` JSON | adds `visibility` JSON field             |
| `internal/carts/service.go` `GetPublicCart`     | adds `viewerUserID`, skips self-view bump | adds the private-cart access gate        |
| `internal/publicapi/handlers.go`                | injects `SessionManager`, resolves viewer | passes through; relies on `viewerUserID` |
| `web/lib/types.ts` `Cart`                       | adds `reachLast7d: number`              | adds `visibility: "public" \| "private"` |
| `web/components/cart-card.tsx`                   | adds reach to the stats footer          | adds the "Private" badge                 |
| editor "Settings" `EditorSection`               | (untouched)                             | adds the visibility toggle               |

Both are **additive** at each site (new field / new param / new JSX), so conflicts
are mechanical: keep both additions. `MarshalCart`'s signature is touched by both —
land them in either order and merge the parameter list to
`MarshalCart(c, owner, items, views, clicks, reach, visibility…)` (this plan keeps
`visibility` read off the cart row, not a param, to minimize the signature churn —
see the plan).

## Non-goals (YAGNI)

- **No per-person sharing** ("Share with select people" is a separate roadmap item).
- **No password / token links.**
- **No "unlisted" tier** (link-only-but-not-indexed). Just public/private.
- No change to `/go/{slug}` redirect behavior — a private cart's product short-links
  are not separately disabled by this feature (out of scope; the cart page is the
  gate). Note this for a future hardening pass if needed.
- No retirement of the legacy `is_public` column in this change.

## Testing

- **Go (real-DB integration, the established `service_test.go` pattern via
  `testutil.NewPostgres` + `db.MigrateUp`):**
  - default visibility of a freshly created cart is `public`;
  - `UpdateCart` flips visibility to `private` and back;
  - `GetPublicCart(slug, viewerUserID=owner)` returns a **private** cart;
  - `GetPublicCart(slug, viewerUserID=0)` and `(…, otherUser)` on a private cart
    return `ErrNotFound`;
  - a **public** cart resolves for `viewerUserID=0`.
- **Web:** no RTL (per house pattern); gated by `npx tsc --noEmit` + `npx next lint`
  + `pnpm run build` + manual: toggle a cart to Private in the editor → reload its
  `/c/{slug}` while logged-out (incognito) → 404; while logged-in as owner → renders;
  dashboard shows the "Private" badge.
- **Gates:** `go test ./...`, `go build ./...`, web `tsc`/`lint`/`build`.
