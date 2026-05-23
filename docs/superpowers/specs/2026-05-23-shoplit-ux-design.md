# shoplit Frontend UX & Visual Design

**Status:** Draft for review
**Date:** 2026-05-23
**Scope:** v1 frontend UX milestone — designed pages built in Next.js against mocked data, validating the customer-facing experience before backend wiring.

This doc supplements the architecture spec at `docs/superpowers/specs/2026-05-23-shoplit-design.md`. It defines the *visual* product — pages, layouts, brand identity, components, responsive behavior — for the Plan 5 frontend build, which has been pulled forward ahead of Plans 2–4.

---

## Goals

- Make the **public cart page** (`/c/{slug}`) feel like a curated magazine spread, so a creator's followers want to scroll, browse, and tap through.
- Establish a consistent shoplit chrome that stays out of the way; let each creator's accent color + cover image carry the personality.
- Mobile-first (Indian audience reaches creator links via Instagram / WhatsApp, predominantly mobile).
- A creator can produce a beautiful-looking cart in under 3 minutes from sign-up — without any design skill.
- Build the entire frontend against mocked data first. No backend wiring in this milestone — Plans 2-4 add real auth, cart APIs, and redirects afterward and only swap the data layer.

## Non-goals (this milestone)

- Real auth (UI mockups only; no Google/MSG91 integration yet)
- Real OG-fetch (paste-URL preview uses hardcoded fixtures)
- Real persistence (in-memory mock state, resets on reload)
- Multiple theme picker (only one visual system)
- Per-cart fonts / advanced styling
- Dark mode (deferred to v1.1)
- Analytics charts (deferred to a later plan)
- Settings page beyond a stub
- Custom domains for creators
- Multi-language UI (English; Indian creators use English / Hinglish)
- Internationalization framework (i18n stubs OK; no real translations)

## Locked decisions (from brainstorm)

| # | Decision |
|---|---|
| 1 | **Visual mood:** Editorial / magazine — LTK + Pinterest + Glossier reference |
| 2 | **Customization:** Minimal — cover image + accent color + bio per cart |
| 3 | **Cart page layout:** Vertical stack of large product cards (LTK-style) |
| 4 | **Form factor:** Mobile-first; web only |
| 5 | **Theme:** Light only in v1 |
| 6 | **Stack:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui base |
| 7 | **Data layer:** Mocked TypeScript fixtures; types shared with future real client |

## Brand identity

**Wordmark.** "shoplit" — all lowercase. Modern serif for the mark itself; communicates editorial/considered + approachable (not corporate).

**Color palette (CSS variables on `:root`):**

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1A1A18` | Body text, primary buttons, dark elements (warm near-black) |
| `--cream` | `#FAF8F4` | Page background, cards (warm off-white) |
| `--paper` | `#F2EFE9` | Subtle surfaces, hover state |
| `--rule` | `#E5E1D8` | Borders, dividers |
| `--muted` | `#8C8779` | Secondary text, captions |
| `--accent` | `#B5532A` (default) | Creator's choice per cart. shoplit-brand default is deep terracotta — warm, distinctive, not gendered |

shoplit's chrome is neutral; the creator's accent color is overridden via inline style on `/c/{slug}` so every cart looks personal without breaking quality.

**Typography:**

- **Display / H1–H2:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — modern serif, variable font, beautiful at display sizes
- **Body / H3–H6 / UI:** [Inter](https://fonts.google.com/specimen/Inter) — clean sans, exceptional readability
- **Devanagari fallback** (for Indian creator handles / bios with Hindi text): [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari) chained after Inter
- **Mono** (rare; raw URLs, debug): [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

Loaded via `next/font/google` (zero FOUC, hosted locally at build). `font-display: swap` for resilience on slow connections.

Modular scale (ratio 1.250, base 16px):

| Token | px | rem | Use |
|---|---|---|---|
| `text-xs` | 12 | 0.75 | meta, labels |
| `text-sm` | 14 | 0.875 | secondary body |
| `text-base` | 16 | 1.0 | body |
| `text-lg` | 20 | 1.25 | lead, large body |
| `text-xl` | 25 | 1.5625 | H4 |
| `text-2xl` | 31 | 1.9375 | H3 |
| `text-3xl` | 39 | 2.4375 | H2 |
| `text-4xl` | 49 | 3.0625 | H1 |
| `text-5xl` | 61 | 3.8125 | hero display |

Display sizes (h1, h2) use Fraunces; everything else uses Inter.

## Pages (v1 scope)

### Public (no login)
1. **`/`** — landing page (marketing + sign-up CTA)
2. **`/c/{slug}`** — public cart page (the customer-facing experience)
3. **`/legal/privacy`**, **`/legal/terms`** — boilerplate, linked from footer

### Creator (logged in)
4. **`/login`** — Google + Phone OTP entry
5. **`/dashboard`** — list of the creator's carts
6. **`/dashboard/carts/new`** — create cart (one-screen quick start)
7. **`/dashboard/carts/[id]`** — edit cart (products, settings, live preview)

### Deferred to later plans
- `/dashboard/analytics` (per-cart analytics)
- `/settings` (account settings)
- `/explore` (creator discovery — v2)

## Page-by-page design

### `/` Landing

**Hero:** Phone mockup on the right (desktop) / top (mobile) showing a beautiful example cart page. Left side / below:

> ## Free shoppable carts for creators.
> Bundle products from Amazon, Myntra, Nykaa and more into one shareable link your followers will actually love opening.

Primary CTA: **"Start free"** → `/login`. Secondary link: **"See an example →"** → `/c/example-priya-diwali`.

**Section 2 — How it works** (3 columns / vertical stack on mobile):
1. Paste any product URL
2. Customize your cart (cover, color, bio)
3. Share the link

**Section 3 — Example carts** (3 cards): three handcrafted demo carts (e.g. *Priya — Diwali edit*, *Aarav — desk setup*, *Meera — skincare routine*) so visitors can see real-feeling examples.

**Section 4 — Compact value prop** (4 bullets with icons): free forever • all your products in one link • click + view analytics • affiliate revenue funds it.

**Footer:** shoplit wordmark · GitHub · Privacy · Terms.

### `/login`

Centered card on cream background. Wordmark + 2-line headline ("Sign in to shoplit. Free, no card required.")

Two stacked options:
1. **Continue with Google** (Google's official button, primary visual weight)
2. **Continue with phone** (secondary; tapping toggles to a phone-input view)

**Phone flow:** country code dropdown (default +91) + 10-digit input → "Send OTP" → 6-input-box OTP screen → "Verify" → `/dashboard`. Re-send link with 30s cooldown. Resend countdown rendered as small italic muted text.

Mocked: any 10-digit number + any 6-digit OTP succeeds. Real auth wires in a later plan.

### `/dashboard`

**Top nav:** shoplit wordmark left; avatar dropdown right (account name, "Sign out").

**Page H1:** "Your carts" — Fraunces serif, large. Right-aligned **"+ New cart"** primary button.

**Grid:** 3 columns desktop, 2 columns tablet, 1 column mobile. Each cart card shows:
- Cover image (16:9, rounded corners)
- Title (Fraunces, 2 lines max)
- Meta row: "X products · Y views (7d) · Z clicks (7d)" in muted text
- Whole card is clickable → `/dashboard/carts/[id]`

**Empty state** (no carts yet): centered illustration + headline "Your first cart is one paste away" + body "Pick a product, paste the link, and we'll do the rest." + primary CTA "Create cart".

### `/dashboard/carts/[id]`

Two-pane layout on desktop (60/40 left/right); stacked on mobile (editor first, preview accessible via "Preview" toggle button in the header).

**Left pane (editor):**
- **Cover image picker** at top — drop zone OR "Paste image URL". Shows current cover or placeholder gradient.
- **Title** — inline-editable, Fraunces, large
- **Bio textarea** — supports bold + links via tiny formatting toolbar
- **Accent color picker** — 10 preset swatches in a row + "custom hex" expander
- **Products list** — vertical list of rows, each showing:
  - Drag handle (left, ⋮⋮)
  - Square image thumb (48px)
  - Title (1 line, truncated)
  - Price (muted)
  - ⋯ menu (Edit, Remove)
  - Whole row click → opens product detail in a side sheet (mobile: full-screen modal)
- **"+ Add product" button** (floating bottom on mobile, inline on desktop) → opens product-add modal

**Product-add modal:**
1. Single field at top: **"Paste a product URL"** (large, autofocused)
2. On paste, a preview card appears below within ~2s showing the OG-fetched title + image + retailer (mocked for the milestone)
3. Editable fields below: title, image, price, your note about this product (textarea, optional)
4. "Add to cart" button

**Right pane (preview):**
- A phone-frame component (mobile screen-sized rectangle with rounded corners + tiny notch detail)
- Inside the frame: real-time render of `/c/{slug}` as the creator edits
- "View live →" link in the corner opens the actual page in a new tab

**Top-right of page:** **"Share"** button → opens share modal:
- The short URL (large, copy button)
- QR code for the URL
- "Share on WhatsApp / Instagram / Twitter" buttons
- (Mocked: generated client-side)

### `/c/{slug}` — the customer page

**This is THE page.** Everything else exists to support what a follower sees here.

**Mobile layout (the primary):**

```
┌──────────────────────────────┐
│                              │
│   [   cover image hero   ]   │ ~50vh, full-width, edge-to-edge
│                              │
│   ●  @priya.styles           │ avatar (32px) + handle, overlaid bottom-left
│   Diwali Edit 2026           │ Fraunces 3xl, cream-on-image with subtle gradient
│   My festival picks ✨        │ Inter base, muted, 2-line truncate
│   ─────────                  │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │ product card 1
│  │   [ product image ]    │  │ 1:1 square, rounded top
│  └────────────────────────┘  │
│  Embroidered kurta set       │ Fraunces xl
│  "Loved the fit on me 🧡"    │ Inter sm italic, optional creator note
│  ₹3,499                      │ Inter base muted
│  ╭──────────────────────╮    │
│  │  Shop on Myntra  →   │    │ accent-color button, full-width
│  ╰──────────────────────╯    │
│                              │
│  …(more products stacked)…   │
│                              │
│  curated by @priya.styles    │ footer
│  shoplit links contain       │ compliance disclosure
│  affiliate tags. We may earn │
│  a commission when you shop  │
│  through them.               │
│                              │
│  shoplit · github · privacy  │
└──────────────────────────────┘
```

**Desktop layout:** same content, but the products grid breaks to 2 columns at ≥768px (matching the brainstormed "half-width on desktop" decision). Hero stays full-bleed at all sizes. No 3-column breakpoint — keeps cards generous and editorial-feeling even on wide screens.

**Component contract for `<ProductCard />`:**
- Props: `{ image, title, note?, price, retailer, link }` (link points to `/go/{slug}` which 302s with affiliate tag in production; in the UX milestone, link is `#` and shows an alert "would redirect to {retailer}")
- Tapping anywhere on the card OR the button triggers the link
- Image lazy-loads via `next/image` with `loading="lazy"` (except the first 2 products, which are eager)

### `/legal/privacy` and `/legal/terms`

Plain prose. Max-width 60ch. Inter, ink-on-cream, generous line-height. No header beyond the wordmark in a thin top bar.

Boilerplate templates (privacy: standard collection / cookies / data retention; terms: usage / affiliate disclosure / IP / limitation). Reviewed before launch — not part of this milestone's quality bar beyond "legible legal page exists".

## Components

shadcn/ui base (Button, Input, Label, Textarea, Card, Dialog, DropdownMenu, Toast, Tabs, Avatar, Skeleton) with the shoplit Tailwind config overrides.

Custom on top:

| Component | Purpose |
|---|---|
| `<ProductCard />` | Display product on `/c/{slug}` |
| `<CartCard />` | Display a cart preview on `/dashboard` |
| `<PasteUrlPreview />` | Debounced URL paste → mock OG preview (used in add-product modal) |
| `<ColorPicker />` | 10 swatches + custom hex (used in cart editor) |
| `<PhoneFrame />` | Renders children inside a phone-shaped frame (used in editor live preview) |
| `<ShareSheet />` | Short URL display + QR + social buttons |
| `<EmptyState />` | Illustration + headline + body + CTA (used wherever a page can be empty) |
| `<RetailerIcon />` | Logo lookup for amazon/myntra/nykaa/flipkart/ajio (small SVGs in `public/retailers/`) |
| `<NavBar />` | Top nav with wordmark + avatar dropdown |

## Responsive

Tailwind breakpoints (defaults):
- `sm` 640px — mobile-large
- `md` 768px — tablet → 2-column product grid kicks in
- `lg` 1024px — desktop
- `xl` 1280px — wide (stays 2-column for editorial scale)
- `2xl` 1536px — extra wide (rare)

Baseline: every component works at 320px width. Touch targets ≥44px. Body text never below 14px on mobile. Hero text uses `clamp()` (e.g. `clamp(2rem, 5vw, 3.5rem)`).

## Motion

Subtle by default. Tasteful, not playful:
- Page transitions: 200ms cross-fade (Next.js App Router built-in)
- Buttons / interactive elements: 100ms color or shadow transition on hover / press
- `<ProductCard />` first-paint: stagger-fade-in (50ms each, capped at 8 cards)
- Editor preview pane: smooth update without layout shifts
- Loading skeletons: gentle shimmer (300ms cycle)

`prefers-reduced-motion: reduce` disables non-essential animations.

Out of scope: parallax, Lottie animations, hero video, confetti, scroll-jacking.

## Empty / loading / error states

Designed, not afterthoughts.

| State | Where | Treatment |
|---|---|---|
| Empty (no carts) | `/dashboard` | Illustration + "Your first cart is one paste away" + CTA |
| Empty (no products) | `/dashboard/carts/[id]` | Large paste-URL input + "Paste a link to add your first product" |
| Empty cart | `/c/{slug}` (zero items) | Hero only + "This cart is still being curated. Check back soon." |
| Not found | `/c/unknown` | "This cart doesn't exist or was removed." + "← Browse shoplit" |
| Loading | Any data fetch | Skeleton screens matching final layout (not generic spinners) |
| Form error | Inputs | Red helper text below field, ≤2 lines |
| Action error | Buttons | Toast bottom-right (desktop) / bottom-center (mobile), 4s |
| Server 5xx | Any page | "Something went wrong. We're looking into it." + retry button |

## Accessibility

- Keyboard nav: Tab/Shift+Tab/Enter all work; visible focus rings (Tailwind default + override)
- Color contrast: ink-on-cream is AAA (~15:1); accent-on-cream verified ≥ AA per swatch
- Form fields: labels (visible or sr-only); errors associated via `aria-describedby`
- Images: alt text required (creator-provided for product images; auto for chrome)
- Motion: `prefers-reduced-motion` respected
- Reading order: matches DOM order; no `tabIndex > 0`
- Toast: announced via `aria-live="polite"`

## Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 14** (App Router, Server Components default, Client Components opt-in) |
| Styling | **Tailwind CSS** + CSS variables for design tokens |
| Components | **shadcn/ui** (copy-paste-able primitives — owned, no runtime dep) |
| Fonts | **Fraunces + Inter + Noto Sans Devanagari** via `next/font/google` |
| Icons | **Lucide React** (tree-shakeable, MIT) |
| Forms | **react-hook-form** + **zod** for validation |
| Data | Typed TS fixtures in `mocks/`; swapped with real client in later plan |
| Images | `next/image` with `remotePatterns` for retailer CDNs |
| Type safety | **TypeScript strict mode** |
| Lint/format | **ESLint** + **Prettier** |
| Package manager | **pnpm** |

## Repo layout

The Next.js frontend lives in `web/`, alongside `cmd/` and `internal/` (single repo, two ecosystems):

```
web/
├── app/
│   ├── (public)/
│   │   ├── page.tsx              # / landing
│   │   ├── c/[slug]/page.tsx     # public cart page
│   │   └── legal/{privacy,terms}/page.tsx
│   ├── login/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── carts/{new,[id]}/page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── not-found.tsx
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── nav-bar.tsx
│   ├── product-card.tsx
│   ├── cart-card.tsx
│   ├── paste-url-preview.tsx
│   ├── color-picker.tsx
│   ├── phone-frame.tsx
│   ├── share-sheet.tsx
│   ├── empty-state.tsx
│   └── retailer-icon.tsx
├── mocks/
│   ├── carts.ts                  # example carts
│   ├── products.ts
│   ├── users.ts
│   └── og-fixtures.ts            # paste-URL → mock OG response map
├── lib/
│   ├── types.ts                  # shared types — Cart, Product, User, OGResult
│   ├── api-client.ts             # async fns the pages call; backed by mocks in milestone
│   └── mocks.ts                  # mock-side of api-client
├── public/
│   ├── og-default.png
│   ├── illustrations/            # SVG empty-state art
│   └── retailers/                # amazon.svg, myntra.svg, …
├── styles/
│   └── tokens.css                # CSS variable definitions
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

`api-client.ts` and `mocks.ts` share the contract defined in `lib/types.ts`. Pages always import from `api-client.ts`. The wiring switch in a later plan is one file's worth of changes (`api-client.ts` reads from real backend instead of from mocks).

## Mock data (this milestone)

`mocks/carts.ts` contains 3 example carts:
1. *Priya — Diwali Edit 2026* — 8 products (kurta, jewelry, makeup); accent terracotta `#B5532A`
2. *Aarav — Desk Setup* — 6 products (monitor, keyboard, lamp); accent ink `#1A1A18`
3. *Meera — Daily Skincare* — 5 products (cleanser, serum, sunscreen); accent dusty rose `#C7959B`

`mocks/users.ts` contains one user (Mayur, with avatar) — `getCurrentUser()` always returns this in dev.

`mocks/og-fixtures.ts` maps common URLs (amazon.in/dp/abc, myntra.com/123) to canned OG responses. Unknown URLs return a generic "couldn't fetch" preview so the manual-entry fallback can be designed.

## Out-of-scope reminders

- Real OAuth / SMS
- Database persistence (state resets on reload)
- Click tracking (mocked numbers on dashboard)
- Search / discovery
- Per-cart analytics chart
- Public profile pages (`/u/[handle]`)
- Custom themes
- Theme picker
- Internationalization
- Dark mode

All of the above land in later plans, on top of this UX foundation.

## Risks & open questions

1. **Slow font load on Indian 4G:** Fraunces is a variable font (~80KB woff2); Inter is ~30KB. With `font-display: swap` and subset to Latin (+ Devanagari opt-in subset), first paint stays under 200ms even on 3G. Mitigation already baked into the plan; surface only if measurement shows otherwise.
2. **Hotlinked product images may be blocked:** retailer CDNs (e.g. amazon.in) sometimes refuse hotlinks. v1 falls back to a designed placeholder; Plan 5+ may need to proxy/cache images server-side.
3. **shoplit logo / wordmark:** no designer-made mark in v1. The lowercase Fraunces "shoplit" wordmark is acceptable for a v1 ship; a custom mark is v1.1 polish work.
4. **Indian-festive theme demand:** we declined the festive-themed direction in favor of universal editorial. If creators ask for festival color sets (Diwali / Holi / Eid palettes), the architecture supports adding "preset accent palettes" later — it's just data, not new code.

## Acceptance for this milestone

The milestone is done when:
- All 7 pages render correctly in dev (`pnpm dev`) at both mobile (320–414px) and desktop (1280px+) widths
- A new visitor can land on `/`, click through to an example cart, see products, "shop" buttons toast an alert (no real redirect yet)
- A creator can sign in (mocked), see 3 example carts, open one, edit title/cover/bio/accent, add a product via paste URL, reorder, remove, and preview the public view in real time
- Lighthouse mobile score ≥ 90 (Performance, Accessibility, Best Practices, SEO) for the public cart page
- Zero TypeScript errors; zero ESLint errors; zero a11y errors from `axe` on every public page
- All mock data is typed via `lib/types.ts` and consumed via `lib/api-client.ts`

When this milestone passes, we move to **Plan 2 (Auth)** which wires the login screen to real Google OAuth + MSG91 OTP, then **Plan 3 (Carts)** which wires the dashboard + editor + public cart to a real `shoplit-api` backend.

---

**End of UX design spec.**
