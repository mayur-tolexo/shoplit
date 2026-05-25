# App-shell navigation — Design

Date: 2026-05-25
Status: Approved for implementation
Supersedes the ad-hoc top/bottom nav with one coherent model.

Frontend-only. Fixes: off-center `+`, inconsistent "Dashboard" entry, and overall nav incoherence; adds an open/close sidebar.

## The model (three coordinated pieces)

### 1. `MobileTabBar` — finalize to 5 tabs with a centered `+`
Current bar has 4 items (`+` lands 3rd of 4 → off-center). Go to 5 slots so `+` is dead-center (2 · + · 2):

```
 🏠        🧭        ⊕        📡        ◯
Dashboard Discover  (+)      Feed     Profile
```
- Dashboard → `/dashboard` (Home) · Discover → `/discover` (Compass) · **+** center raised → `/add` (Plus) · Feed → `/dashboard/following` (Rss) · **Profile** → `/u/{handle}` (the viewer's own avatar/User).
- Needs the viewer's `handle` for the Profile tab → root layout passes `user` (not just `authed`) to the bar. If `user.handle` is missing, omit the Profile tab and keep `+` centered with a balanced spacer.
- Active per exact pathname → `text-accent` + 2px accent top-indicator (already implemented for the others). Add `pathname.startsWith("/u/")` to `isPrimaryRoute` so the bar persists on profiles.
- Keep: `fixed bottom-0 ... sm:hidden`, opaque `bg-cream`, `env(safe-area-inset-bottom)`, ≥44px targets. (Rename file/exports stay `mobile-tab-bar.tsx`/`MobileTabBar`.)

### 2. `AppSidebar` — the open/close drawer (the "sidebar"), one consistent menu everywhere
New `web/components/app-sidebar.tsx` (`"use client"`), built on the existing `web/components/ui/sheet.tsx` (Radix sheet, `side="left"`). It is the SINGLE nav+account surface, opened/closed from a trigger in the top bar, on every page and breakpoint.
- Props: `user: User | null`.
- Trigger (rendered by this component so state is encapsulated): logged-in → the avatar button; logged-out → a `Menu` (☰) icon button. ≥44px.
- Drawer content, **logged in**: a header (avatar + display name + `@handle`), then nav links with active highlight — **Dashboard** `/dashboard`, **Discover** `/discover`, **Your feed** `/dashboard/following`, **Your profile** `/u/{handle}`, **New cart/Add** `/add`; a divider; **Feedback** `/feedback`; **Sign out** (calls `logout()` then routes `/`). Each link closes the drawer on navigation.
- Drawer content, **logged out**: **Discover**, **Feedback**, divider, **Sign in**, **Start free** (both → `/login`).
- Because this same menu renders identically on every page, "Dashboard" (and account/sign-out) is reachable the exact same way everywhere — fixing the "dashboard option should be the same everywhere" complaint.

### 3. Top bar — consistent on every page
`web/components/nav-bar.tsx`: the right side becomes **only the `<AppSidebar user={user}/>` trigger**, identical for both `marketing` and `app` variants. Remove the old inconsistent right-side controls (the marketing "Dashboard pill" + the app avatar dropdown + the desktop inline link rows). Left stays the logo.
- Logged out (marketing): keep the **Start free** pill visible on mobile + the `AppSidebar` trigger (☰) for Discover/Feedback/Sign in. At `sm:`+ this is fine too (drawer is the menu).
- `marketing-nav.tsx` unchanged (still resolves `user` → `NavBar`).
- Net top bar everywhere: `logo (left) + drawer trigger (right)` (logged-out marketing also shows the Start-free pill). No more pill-vs-dropdown divergence.

## Route / chrome behavior
- **Bottom tab bar**: shown only when `user` && `isPrimaryRoute(pathname)` where `isPrimaryRoute = path === "/discover" || path === "/add" || path.startsWith("/dashboard") || path.startsWith("/u/")`. (Unchanged mechanism; rendered globally from the root layout.)
- **AppSidebar trigger**: lives in the top bar, so it appears wherever a NavBar renders — all `(public)` pages (via `(public)/layout.tsx` → MarketingNav → NavBar) and all dashboard pages (via `dashboard/layout.tsx` → NavBar). Immersive `/c/[slug]` and `/login` have no NavBar → no trigger (intended).
- No route moves, no content reflow — the drawer overlays. This keeps the change low-risk.

## Files
- Create: `web/components/app-sidebar.tsx`
- Modify: `web/components/mobile-tab-bar.tsx` (5 tabs + Profile + `/u/` primary route), `web/components/nav-bar.tsx` (right side = AppSidebar trigger; drop pill/dropdown/inline links), `web/app/layout.tsx` (pass `user` to `MobileTabBar`)
- Reuse: `web/components/ui/sheet.tsx`, `web/lib/api-client.ts` `logout()`
- No deletions (MobileBottomNav already gone).

## Edge cases
- `user.handle` empty → no Profile tab (balanced spacer keeps `+` centered) and the drawer "Your profile" link is hidden.
- Drawer must close on route change (wire `onOpenChange`/close on link click) so it doesn't linger after navigation.
- Root-layout `getCurrentUser` already resolved for `MobileTabBar`; reuse that `user` (no extra fetch).
- Keep `sm:hidden` on the bottom bar; the drawer trigger shows at all widths.

## Mobile requirements
≥44px tap targets (trigger, tab items, drawer rows); drawer is a full-height left sheet; no horizontal overflow at 360px; bottom bar opaque with safe-area padding; content keeps `pb-24 sm:pb-…` where the bar overlaps.

## Testing
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and an authoritative `pnpm build` (single agent — may build).
- Manual (integrator, mobile + desktop): the same drawer opens from every page with Dashboard/Discover/Feed/Profile/Feedback/Sign out; bottom bar shows a centered `+` with 5 tabs and a clear active tab; top bar is `logo + trigger` consistently; logged-out shows the drawer with Discover/Feedback/Sign in + the Start-free pill.

## Out of scope
Docked/pinned desktop rail with content reflow (this ships an overlay drawer per "open and close"; docking is a later enhancement); notifications; settings page.
