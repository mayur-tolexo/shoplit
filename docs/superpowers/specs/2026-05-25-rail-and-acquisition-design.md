# Desktop nav rail + cart-page acquisition banner — Design

Date: 2026-05-25
Status: Approved for implementation

Two independent frontend-only features, disjoint files → parallelizable.

---

## Feature 1 — Fixed desktop nav rail (rail BELOW the top bar; desktop only)

Goal: on desktop (`lg+`), logged-in users get a permanently-visible left nav rail so navigating between primary pages is **one click** (not open-drawer-then-click). **Mobile/tablet (`< lg`) is unchanged** (top bar + drawer, phone bottom tab bar). The existing top bar is kept (chosen "rail below top bar" approach — do NOT remove or restructure the top bar or the page layouts).

### Components
- **`web/components/desktop-rail.tsx`** (`"use client"`), props `{ user: User }`:
  - `hidden lg:flex flex-col fixed left-0 top-[57px] bottom-0 w-56 z-30 border-r border-rule bg-cream overflow-y-auto py-4 px-3`. (`top-[57px]` ≈ the top bar's height so the rail sits just under it; fine-tune to match the rendered NavBar height.)
  - Vertical nav items (icon + label, `min-h-[44px]`, rounded, active = `bg-paper text-accent font-medium` via `usePathname`, inactive = `text-muted hover:bg-paper hover:text-ink`): **Dashboard** `/dashboard` (Home), **Discover** `/discover` (Compass), **Your feed** `/dashboard/following` (Rss), **Your profile** `/u/{handle}` (User; omit if no handle), **New cart** `/add` (Plus). Then, only when `user.isAdmin`: a divider + **Admin** `/dashboard/admin` (ShieldCheck).
  - Reuse the drawer's link set/idiom (`app-sidebar.tsx`) for consistency; account/sign-out stay in the top-bar avatar drawer (the rail is nav-only).
- **`web/components/app-frame.tsx`** (`"use client"`), props `{ user: User | null; children }`:
  - `const showShell = !!user && isAppRoute(pathname)` where `isAppRoute(p) = p === "/discover" || p === "/add" || p.startsWith("/dashboard") || p.startsWith("/u/")`.
  - Renders: `<div className={showShell ? "lg:pl-56" : undefined}>{children}</div>`, then `{showShell && user && <DesktopRail user={user} />}`, then `<MobileTabBar user={user} />`.
  - (The `lg:pl-56` shifts page content right of the rail on desktop only; below `lg` no padding. The top bar lives inside `children` and reflows within the padded width — acceptable; do not try to special-case it.)

### Wiring
- `web/app/layout.tsx`: where it currently renders `<MobileTabBar user={...} />` after `{children}`, instead wrap: `<AppFrame user={user}>{children}</AppFrame>` (AppFrame now renders MobileTabBar internally — remove the standalone MobileTabBar render/import from the root layout).
- **No other files change** for Feature 1 (top bar, `(public)`/`dashboard` layouts, drawer all stay).

### Mobile/tablet
`< lg`: rail is `hidden` (not rendered visually), no `lg:pl-56` effect → current mobile UX (top bar + drawer + phone bottom bar) is fully preserved.

### Files (1)
Create: `web/components/desktop-rail.tsx`, `web/components/app-frame.tsx`. Modify: `web/app/layout.tsx`.

---

## Feature 2 — "Create your own shoplit" banner on public cart pages

Goal: convert viewers of a shared cart (`/c/{slug}`, the `(share)` group) into shoplit signups with a **bold, on-brand** call-to-action.

### Component
- **`web/components/create-your-own-banner.tsx`** (server or simple client; no heavy state): a prominent, on-brand CTA card — `rounded-2xl bg-ink text-cream` (or an accent gradient) section with:
  - the shoplit logo/wordmark,
  - a punchy headline, e.g. **"Love this? Build your own shoplit."**,
  - one line of subtext (e.g., "Turn the products you love into one beautiful, shareable link — free."),
  - a primary button **"Create your shoplit — free"** → `/login`, and a quieter secondary link **"Discover creators"** → `/discover`.
  - Tasteful, generous padding; works at 360px (stacks), `≥44px` tap targets.

### Placement
- In `web/app/(share)/c/[slug]/page.tsx`: render `<CreateYourOwnBanner />` **after the products section, before the footer**. Leave the hero, products, `StickyShareBar`, and footer intact (don't disturb the immersive layout or the sticky share bar's spacing — keep enough bottom padding so the banner isn't hidden behind the sticky bar).

### Files (2)
Create: `web/components/create-your-own-banner.tsx`. Modify: `web/app/(share)/c/[slug]/page.tsx`.

---

## Verification (both)
`pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build` (each agent builds its own tree). Integrator: deploy `shoplit-web` (frontend-only); desktop visual check that the rail shows on `/dashboard`,`/discover`,`/u/*` (lg+) with content cleared of it and one-click nav; mobile unchanged; cart page shows the banner.

## Out of scope
Collapsible/resizable rail; removing the top bar on desktop; exit-intent popups; A/B testing the banner copy.
