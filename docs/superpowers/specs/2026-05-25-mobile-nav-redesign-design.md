# Mobile navigation redesign — Design

Date: 2026-05-25
Status: Approved for implementation

Frontend-only. Fixes three confirmed mobile-web nav problems:
1. **Bottom bar vanishes** — the tab bar lives in `dashboard/layout.tsx`, so it only exists on `/dashboard/*`; its Discover (`/discover`, public) and Add (`/add`, top-level) tabs lead off the dashboard → the bar disappears and you can't tab back.
2. **Can't tell the active tab** — active state is a subtle `text-ink` vs `text-muted`.
3. **Top bar cluttered on mobile** — logged-out marketing nav crams Discover + Feedback + Sign in + Start free at 360px; logged-in `/discover` shows the marketing nav inline links that duplicate the (missing) tab bar.

## Approach: a real mobile app shell

### 1. Global `MobileTabBar` (replaces `MobileBottomNav`)
- New `web/components/mobile-tab-bar.tsx` (`"use client"`). Props: `authed: boolean`.
- Renders `null` unless `authed && isPrimaryRoute(pathname)`, where
  `isPrimaryRoute = pathname === "/discover" || pathname === "/add" || pathname.startsWith("/dashboard")`.
  (Preserves today's behavior of showing on all `/dashboard/*` incl. the cart editor, and extends to `/discover` + `/add`.)
- Tabs (order): **Carts** `/dashboard` (Home icon) · **Discover** `/discover` (Compass) · **Add** center action `/add` (Plus, raised pill) · **Feed** `/dashboard/following` (Rss).
- Active detection per tab by exact pathname (`/dashboard` exact for Carts so it isn't always-active on sub-routes; `/discover`, `/dashboard/following`, and `/add` exact).
- **Active styling (fixes #2):** active tab → `text-accent` icon+label **and** a 2px accent indicator bar across the top edge of that tab (e.g. an absolutely-positioned `span` `h-0.5 bg-accent` at the item top). Inactive → `text-muted`.
- Keep the existing chrome: `fixed bottom-0 inset-x-0 z-30 border-t border-rule bg-cream/95 backdrop-blur sm:hidden`, `env(safe-area-inset-bottom)` padding, `h-16`, items `flex-1 min-h-[44px]`, center action `w-14 h-14 -translate-y-3` raised pill. Carry over the structure from the current `mobile-bottom-nav.tsx`.
- `aria-label="Mobile navigation"`; active item gets `aria-current="page"`.

### 2. Render the tab bar once, globally (fixes #1)
- In `web/app/layout.tsx` (root, server component — make it `async`): resolve the viewer once via `getCurrentUser({ cookie: cookies().toString() })` inside a try/catch (`authed = !!user`, never throw), and render `<MobileTabBar authed={authed} />` after `{children}`.
- **Remove** `<MobileBottomNav />` from `web/app/dashboard/layout.tsx` and delete `web/components/mobile-bottom-nav.tsx` (replaced). The dashboard layout keeps its NavBar + Footer.
- Net effect: the bar is present and consistent across Carts ↔ Discover ↔ Feed ↔ Add; absent on `/c/[slug]` (immersive), `/login`, marketing home `/`, legal, etc.

### 3. De-clutter the top bar on mobile (fixes #3)
Both states collapse to `logo (left) + one trailing element (right)` on mobile; **`sm:`+ is unchanged**.

`web/components/nav-bar.tsx`:
- **marketing variant, logged out:** hide the inline "Discover" + "Feedback" links and the separate "Sign in" link on mobile (wrap them in `hidden sm:flex`). Keep the **"Start free"** pill visible on mobile (it and Sign in both route to `/login`). At `sm:`+ everything shows as today.
- **marketing variant, logged in:** keep only the "Dashboard" pill on mobile; hide inline "Discover"/"Feedback" on mobile (`hidden sm:flex`). (This is what de-clutters `/discover` for a logged-in mobile user, now that the tab bar carries nav.)
- **app variant:** already hides its inline Discover/Feed links on mobile (`hidden sm:flex`) — leave as is (logo + avatar dropdown on mobile).

No change needed to `marketing-nav.tsx` (it only resolves the user and forwards to `NavBar`); all visibility logic lives in `nav-bar.tsx`.

## Files
- Create: `web/components/mobile-tab-bar.tsx`
- Modify: `web/app/layout.tsx` (async + auth + render bar), `web/app/dashboard/layout.tsx` (remove old bar), `web/components/nav-bar.tsx` (mobile link visibility)
- Delete: `web/components/mobile-bottom-nav.tsx`

## Edge cases
- Logged-out user on `/discover`: `authed=false` → no tab bar; marketing top nav (slimmed on mobile to logo + Start free). Correct.
- `/c/[slug]`, `/login`, `/` (home): not a primary route (or not authed) → no tab bar.
- Root-layout auth lookup adds one `getCurrentUser` per request; marketing pages already do this via `MarketingNav`, and it must fail-open (logged-out) so public pages never error.
- Cart editor `/dashboard/carts/[id]`: still shows the bar (matches today).

## Mobile requirements
≥44px tap targets; `env(safe-area-inset-bottom)`; `sm:hidden` on the bar; no horizontal overflow at 360px; the slim top bar must not wrap.

## Testing
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` (no logic regressions; existing suite stays green).
- Authoritative `pnpm build` + manual mobile-viewport check (360/768) by the integrator: tab bar present and consistent across Carts/Discover/Feed/Add with a clear active tab; top bar slim on mobile in both auth states; `/c/[slug]` and home bar-less.

## Out of scope
Hamburger/slide-over menu for logged-out secondary links (Discover/Feedback remain at `sm:`+ and in the footer); any backend change.
