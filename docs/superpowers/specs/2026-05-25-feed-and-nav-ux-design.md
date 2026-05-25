# "Your feed" activity stream + uniform navigation — Design

Date: 2026-05-25
Status: Approved for implementation

Two independent, frontend-only workstreams (disjoint file sets → parallelizable).

---

## Workstream A — "Your feed" activity stream

### Goal
Redesign `/dashboard/following` from a grid of cart cards into a single-column **activity stream of new-cart events** from creators you follow, newest-first.

### Why frontend-only
`getFollowingFeed()` already returns `Cart[]` (newest-first by `createdAt`) with everything an entry needs: `ownerHandle`, `ownerDisplayName`, `ownerAvatarUrl`, `createdAt`, `title`, `slug`, `products[]`. No backend, query, or migration change.

### Pieces
1. **`web/lib/relative-time.ts`** — pure `relativeTime(iso: string, now?: Date): string`:
   - `< 60s` → "just now"; `< 60m` → "Nm ago"; `< 24h` → "Nh ago"; `< 7d` → "Nd ago"; else short date "Mar 4" (and include year if a different year).
   - Pure + deterministic (accepts injectable `now`) so it is unit-testable in the repo's node-env vitest.
   - **`web/lib/relative-time.test.ts`** — cases for each bucket + boundary + older-than-a-week date formatting.

2. **`web/components/feed-item.tsx`** — presentational (no `"use client"` needed). Props: `cart: Cart`. Renders one entry:
   - Header: avatar + `@ownerHandle` linking to `/u/{ownerHandle}`, then `· {relativeTime(createdAt)}`.
   - Headline (muted, small): `shared a new cart`.
   - Cart title (`font-serif`) linking to `/c/{slug}`.
   - Thumbnail row: up to **4** product images (64px square, `rounded-lg`, `object-cover`, `unoptimized`); a neutral placeholder block when a product has no `imageUrl`; if `products.length > 4`, a trailing `+N` chip. Thumbnails link to `/c/{slug}` (the cart), not individual products.
   - Footer: `{products.length} products · View cart →` linking to `/c/{slug}`.
   - Use discrete links (creator vs cart) — do NOT wrap the whole card in one `<Link>`.
   - Card chrome: `rounded-2xl border border-rule bg-cream`, subtle hover shadow.

3. **`web/app/dashboard/following/page.tsx`** — rewrite the list section:
   - Centered single column: `mx-auto max-w-2xl ... space-y-4` (or `space-y-5`).
   - Keep the page heading; update copy to "Your feed" / subtitle "New carts from creators you follow."
   - Map feed → `<FeedItem cart={c} />`.
   - Keep & lightly refine the existing empty state (CTA → `/discover`).
   - Keep `force-dynamic`, the cookie-forwarding fetch, and the `/login` redirect on auth failure.

### Mobile
Single column at all widths; thumbnails (4×64 + gaps) fit at 360px; tap targets ≥44px (creator link, View-cart CTA); keep bottom-nav padding (`pb-24 sm:pb-10`).

### Out of scope (v1)
Tap-thumbnail-to-shop; unread/seen state; "items added to existing cart" events (only new-cart events selected); pagination UI.

### Files (A) — does NOT touch any nav component
Create: `web/lib/relative-time.ts`, `web/lib/relative-time.test.ts`, `web/components/feed-item.tsx`.
Modify: `web/app/dashboard/following/page.tsx`.

---

## Workstream B — Uniform navigation + auth-state fix

### Problems
1. **"Sign in" shows while signed in** on `app/(public)/feedback/page.tsx` and `app/not-found.tsx` — both render a bare `<NavBar variant="marketing" />` with **no `user` prop**, so the nav can't reflect login state. (feedback is a `"use client"` page, so it could not render the async server `MarketingNav` directly — hence the bare NavBar.)
2. **Inconsistent chrome** — each `(public)` page individually renders `<MarketingNav/>` + `<Footer/>`; there is no shared layout, so it drifts.

### Fix: a shared server layout for the public group
1. **Create `web/app/(public)/layout.tsx`** (server component):
   ```tsx
   import { MarketingNav } from "@/components/marketing-nav";
   import { Footer } from "@/components/footer";
   export default function PublicLayout({ children }: { children: React.ReactNode }) {
     return (
       <>
         <MarketingNav />
         <main className="min-h-[calc(100vh-15rem)]">{children}</main>
         <Footer />
       </>
     );
   }
   ```
   `MarketingNav` is the auth-aware server wrapper (resolves the session cookie → passes `user`), so EVERY public page — including client pages like feedback — now gets a login-state-correct nav. This both fixes the bug and removes the drift.

2. **Strip per-page chrome** from all `(public)` pages so chrome isn't doubled. For each of: `discover`, `feedback`, `get-extension`, `legal/extension-privacy`, `legal/privacy`, `legal/terms`, `mobile`, `page` (home), `roadmap`, `u/[handle]` — remove their own `<MarketingNav/>` / `<NavBar .../>` and `<Footer/>` and the now-unused imports, plus any redundant wrapping `<>...</>` / outer `<main>` that the layout now supplies. Leave only page content. (Do NOT touch `dashboard/following` — different route group, owned by workstream A.)

3. **Keep the cart page chrome-less.** `/c/[slug]` is an intentional immersive share page (its own hero + footer, no top nav). The new `(public)/layout.tsx` would wrap it, so move it out of the group: relocate
   `app/(public)/c/[slug]/page.tsx` → `app/(share)/c/[slug]/page.tsx`
   `app/(public)/c/[slug]/loading.tsx` → `app/(share)/c/[slug]/loading.tsx`
   Route groups don't affect URLs, so the public URL stays `/c/{slug}`. The `(share)` group has **no** layout (inherits root only) → identical chrome-less rendering as today. Change nothing else in those files.

4. **Fix `app/not-found.tsx`** (a server component): replace bare `<NavBar variant="marketing" />` + `<Footer/>` with `<MarketingNav/>` + `<Footer/>` (import `MarketingNav` from `@/components/marketing-nav`). It is app-root (not under `(public)`), so it does not inherit the public layout and keeps rendering its own chrome — just auth-aware now.

5. **Relabel "Following" → "Feed"** to match product language:
   - `web/components/nav-bar.tsx` — the app-variant "Following" link text → "Feed".
   - `web/components/mobile-bottom-nav.tsx` — the "Following" item label → "Feed".
   - Keep the route `/dashboard/following` (no file/route rename).

### Deliberately left as-is
`/login`, `/add`, `/connect-extension` are focused single-purpose flows (top-level routes, no chrome today). Leaving them chrome-light is intentional; not part of this pass.

### Uniformity result
- All public pages: one identical auth-aware `MarketingNav` + `Footer` from the shared layout.
- All dashboard pages: already share `dashboard/layout.tsx` (app nav + bottom nav + footer).
- `/c/[slug]`: intentionally chrome-less, preserved.
- The marketing↔app nav difference is by design (different contexts), but both are now auth-state-correct everywhere.

### Files (B) — does NOT touch workstream A's files
Create: `web/app/(public)/layout.tsx`.
Move: `web/app/(public)/c/[slug]/{page.tsx,loading.tsx}` → `web/app/(share)/c/[slug]/`.
Modify: the 10 `(public)/*` pages listed (strip chrome), `web/app/not-found.tsx`, `web/components/nav-bar.tsx`, `web/components/mobile-bottom-nav.tsx`.

---

## Verification (both workstreams)
Run from `web/`: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`. (The integrating engineer runs the authoritative `pnpm build` + live route check — agents must NOT run `pnpm build` to avoid clobbering `.next` concurrently.)

Post-integration route checks (build + serve): every page renders exactly one nav + one footer; feedback & a 404 show "Dashboard" (not "Sign in") when logged in; `/c/{slug}` still renders with no top nav; `/dashboard/following` shows the activity stream.
