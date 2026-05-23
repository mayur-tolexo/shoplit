# shoplit Frontend UX Milestone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The spec at `docs/superpowers/specs/2026-05-23-shoplit-ux-design.md` is the source of truth for visual details — this plan references it but does not duplicate it.

**Goal:** Build all 7 pages of shoplit's v1 frontend in Next.js with mocked data, validating the customer-facing UX before backend wiring. After this milestone a visitor can click through landing → example cart → product (toast), and a creator (mock-logged-in) can edit a cart and see live preview.

**Architecture:** Single Next.js 14 app at `web/` (sibling to `cmd/` and `internal/`). App Router with React Server Components by default, Client Components opt-in. Tailwind CSS + CSS variables for tokens. shadcn/ui primitives (copy-paste, no runtime dep). Mock data via typed fixtures; `lib/api-client.ts` is the single interface pages call so backend wiring later is a one-file swap.

**Tech Stack:**
- Node 20+, pnpm 9+ (corepack)
- Next.js 14 (App Router)
- TypeScript 5 (strict)
- Tailwind CSS 3 + tailwind-merge + clsx
- shadcn/ui (primitives copied into `components/ui/`)
- `next/font/google` for Fraunces, Inter, Noto Sans Devanagari
- lucide-react for icons
- react-hook-form + zod for forms
- ESLint + Prettier
- (No runtime test framework in this milestone; verification is via `pnpm build` + `pnpm lint` + `pnpm tsc --noEmit` + manual visual inspection per page)

---

## File structure produced by this plan

```
web/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                          # / landing
│   │   ├── c/[slug]/page.tsx                 # /c/{slug} public cart
│   │   └── legal/
│   │       ├── privacy/page.tsx
│   │       └── terms/page.tsx
│   ├── login/page.tsx                        # /login
│   ├── dashboard/
│   │   ├── page.tsx                          # /dashboard cart list
│   │   ├── layout.tsx                        # auth-gated layout (mock)
│   │   └── carts/
│   │       ├── new/page.tsx
│   │       └── [id]/page.tsx                 # cart editor
│   ├── layout.tsx                            # root layout + fonts
│   ├── globals.css                           # CSS vars + Tailwind base
│   └── not-found.tsx
├── components/
│   ├── ui/                                   # shadcn primitives (generated)
│   ├── nav-bar.tsx
│   ├── product-card.tsx
│   ├── cart-card.tsx
│   ├── paste-url-preview.tsx
│   ├── color-picker.tsx
│   ├── phone-frame.tsx
│   ├── share-sheet.tsx
│   ├── empty-state.tsx
│   ├── retailer-icon.tsx
│   └── footer.tsx
├── lib/
│   ├── types.ts                              # Cart, Product, User, OGResult
│   ├── api-client.ts                         # pages call this; mocks under the hood
│   ├── mocks.ts                              # mock implementation of api-client
│   └── utils.ts                              # cn() helper (shadcn convention)
├── mocks/
│   ├── carts.ts                              # 3 example carts
│   ├── products.ts
│   ├── users.ts
│   └── og-fixtures.ts                        # URL → mock OG result map
├── public/
│   ├── og-default.png                        # placeholder OG image
│   ├── illustrations/
│   │   ├── empty-carts.svg
│   │   └── empty-products.svg
│   └── retailers/
│       ├── amazon.svg
│       ├── myntra.svg
│       ├── nykaa.svg
│       ├── flipkart.svg
│       └── ajio.svg
├── styles/
│   └── tokens.css                            # CSS variable definitions (imported from globals.css)
├── .eslintrc.json
├── .gitignore                                # node_modules, .next, etc.
├── .prettierrc
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── components.json                           # shadcn config
├── package.json
├── pnpm-lock.yaml
└── README.md
```

---

## Task 1: Bootstrap `web/` with Next.js + TypeScript + pnpm

**Files:**
- Create: `web/` directory with `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, etc. (whatever `create-next-app` generates)

- [ ] **Step 1: Ensure pnpm is available**

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm -v   # should print 9.x
```

If `corepack` is not available, install pnpm via `npm i -g pnpm` (requires admin).

- [ ] **Step 2: Scaffold Next.js 14 app into `web/`**

```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
pnpm dlx create-next-app@14 web \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias='@/*' --no-turbopack
```

Choose: TypeScript ✓, ESLint ✓, Tailwind ✓, `src/` dir ✗, App Router ✓, Turbopack ✗, alias `@/*`.

This creates `web/` with `app/`, `tailwind.config.ts`, `tsconfig.json`, `next.config.mjs`, `package.json`, `.gitignore`, etc.

- [ ] **Step 3: Verify it builds**

```bash
cd web
pnpm install
pnpm build
```

Expected: a clean Next.js production build (creates `.next/`).

- [ ] **Step 4: Update root `.gitignore`**

Make sure the existing `.gitignore` at the repo root (not the new one inside `web/`) covers `web/.next/`, `web/node_modules/`, etc. Append to `/Users/mayurdas/Documents/projects/go/src/shoplit/.gitignore`:

```gitignore

# frontend (web/) build artifacts
/web/.next/
/web/out/
/web/node_modules/
/web/.pnpm-store/
/web/pnpm-debug.log
```

(The Next.js scaffold also writes a `web/.gitignore` for itself; leave it.)

- [ ] **Step 5: Commit**

```bash
cd /Users/mayurdas/Documents/projects/go/src/shoplit
git add web/ .gitignore
git commit -m "feat(web): bootstrap next.js 14 + typescript + tailwind"
```

---

## Task 2: Configure design tokens — Tailwind config, fonts, globals.css

**Files:**
- Modify: `web/tailwind.config.ts`
- Modify: `web/app/globals.css`
- Create: `web/styles/tokens.css`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Write `web/styles/tokens.css`** (design-token CSS variables)

```css
/* web/styles/tokens.css
 * Design tokens per the shoplit UX spec
 * (docs/superpowers/specs/2026-05-23-shoplit-ux-design.md).
 * Override --accent inline on /c/{slug} pages per creator.
 */
:root {
  --ink: #1A1A18;
  --cream: #FAF8F4;
  --paper: #F2EFE9;
  --rule: #E5E1D8;
  --muted: #8C8779;
  --accent: #B5532A;        /* default — overridden per cart */

  --radius-sm: 0.375rem;
  --radius: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

- [ ] **Step 2: Replace `web/app/globals.css`** with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "../styles/tokens.css";

@layer base {
  html {
    color: var(--ink);
    background: var(--cream);
    -webkit-font-smoothing: antialiased;
  }
  body {
    @apply font-sans text-base leading-relaxed;
    min-height: 100vh;
  }
  h1, h2 {
    @apply font-serif tracking-tight;
  }
  h3, h4, h5, h6 {
    @apply font-sans;
  }
  ::selection {
    background: var(--accent);
    color: var(--cream);
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 3: Replace `web/tailwind.config.ts`** with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        cream: "var(--cream)",
        paper: "var(--paper)",
        rule: "var(--rule)",
        muted: "var(--muted)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-deva)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs:   ["0.75rem",   { lineHeight: "1.125rem" }],
        sm:   ["0.875rem",  { lineHeight: "1.375rem" }],
        base: ["1rem",      { lineHeight: "1.625rem" }],
        lg:   ["1.25rem",   { lineHeight: "1.875rem" }],
        xl:   ["1.5625rem", { lineHeight: "2.25rem"  }],
        "2xl":["1.9375rem", { lineHeight: "2.5rem"   }],
        "3xl":["2.4375rem", { lineHeight: "2.875rem" }],
        "4xl":["3.0625rem", { lineHeight: "3.5rem"   }],
        "5xl":["3.8125rem", { lineHeight: "4.25rem"  }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Wire fonts in `web/app/layout.tsx`**

Replace the default `layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Sans_Devanagari, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-noto-deva",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "shoplit",
  description: "Build a curated cart of products from Amazon, Myntra, Nykaa and more, then share it with a short URL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDeva.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify**

```bash
cd web
pnpm build
```

Expected: build succeeds; fonts download during build.

- [ ] **Step 6: Commit**

```bash
git add web/tailwind.config.ts web/app/globals.css web/styles/tokens.css web/app/layout.tsx
git commit -m "feat(web): design tokens, tailwind config, font loading"
```

---

## Task 3: Initialize shadcn/ui and install primitives

**Files:**
- Create: `web/components.json` (shadcn config)
- Create: `web/lib/utils.ts` (cn() helper)
- Create: `web/components/ui/*.tsx` (primitives via shadcn CLI)

- [ ] **Step 1: Init shadcn**

```bash
cd web
pnpm dlx shadcn@latest init
```

Answer prompts:
- TypeScript: yes
- Style: "default"
- Base color: "neutral" (we override via tokens.css)
- CSS variables: yes
- Tailwind config path: `tailwind.config.ts`
- Components directory: `components`
- Utils path: `lib/utils.ts`
- React Server Components: yes
- Write `components.json`: yes

This creates `web/components.json` and `web/lib/utils.ts`.

- [ ] **Step 2: Install primitives we need**

```bash
pnpm dlx shadcn@latest add button input label textarea card dialog dropdown-menu sonner tabs avatar skeleton sheet
```

(`sonner` is the modern shadcn toast.)

Creates files under `web/components/ui/`.

- [ ] **Step 3: Replace `web/lib/utils.ts`** if shadcn's version doesn't already match:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Mount toast container in root layout**

Edit `web/app/layout.tsx` (the one from Task 2), import and render `<Toaster />` from `sonner` (re-exported by shadcn):

```tsx
import { Toaster } from "@/components/ui/sonner";
// ... existing imports

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={...}>
      <body>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add web/components.json web/components/ui/ web/lib/utils.ts web/app/layout.tsx
git commit -m "feat(web): shadcn/ui primitives and toast container"
```

---

## Task 4: Add icons, forms, and dev dependencies

**Files:**
- Modify: `web/package.json` (via pnpm add)

- [ ] **Step 1: Install runtime deps**

```bash
cd web
pnpm add lucide-react react-hook-form zod @hookform/resolvers
```

- [ ] **Step 2: Install dev deps**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss eslint-config-prettier
```

- [ ] **Step 3: Add `.prettierrc`**

```bash
cat > .prettierrc <<'EOF'
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
EOF
```

- [ ] **Step 4: Verify**

```bash
pnpm build
pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/.prettierrc
git commit -m "feat(web): add lucide-react, react-hook-form, zod, prettier"
```

---

## Task 5: Define types and mocks

**Files:**
- Create: `web/lib/types.ts`
- Create: `web/mocks/users.ts`
- Create: `web/mocks/products.ts`
- Create: `web/mocks/carts.ts`
- Create: `web/mocks/og-fixtures.ts`

- [ ] **Step 1: Write `web/lib/types.ts`**

```ts
// Source of truth for the data shapes used by both mocks and (later) real API client.
// Pages and components import ONLY from this file.

export type Retailer =
  | "amazon.in"
  | "amazon.com"
  | "myntra.com"
  | "nykaa.com"
  | "flipkart.com"
  | "ajio.com"
  | "other";

export interface User {
  id: string;
  handle: string;          // e.g. "priya.styles"
  displayName: string;     // e.g. "Priya Sharma"
  avatarUrl: string;       // 64×64+ image
}

export interface Product {
  id: string;
  title: string;
  imageUrl: string;
  priceText: string;       // freeform; e.g. "₹3,499" or "$49"
  retailer: Retailer;
  note?: string;           // creator's personal note about this product
  originalUrl: string;     // where the product lives
}

export interface Cart {
  id: string;
  slug: string;            // /c/{slug}
  ownerHandle: string;     // foreign-key to User.handle
  ownerDisplayName: string;
  ownerAvatarUrl: string;
  title: string;
  bio?: string;
  coverImageUrl: string;
  accentHex: string;       // overrides --accent on /c/{slug}
  products: Product[];
  // mocked analytics for the dashboard
  viewsLast7d: number;
  clicksLast7d: number;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export interface OGResult {
  ok: boolean;
  title?: string;
  imageUrl?: string;
  priceText?: string;
  retailer: Retailer;
  reason?: string;         // when ok=false
}
```

- [ ] **Step 2: Write `web/mocks/users.ts`**

```ts
import type { User } from "@/lib/types";

export const currentUser: User = {
  id: "u_mayur",
  handle: "mayur",
  displayName: "Mayur Das",
  avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Mayur&backgroundColor=B5532A&textColor=FAF8F4",
};
```

- [ ] **Step 3: Write `web/mocks/products.ts`**

```ts
import type { Product } from "@/lib/types";

// Stock-free placeholder imagery via picsum.photos (seeded so each ID renders consistently).
const img = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export const productsDiwali: Product[] = [
  { id: "p1", title: "Embroidered Anarkali kurta set", imageUrl: img("kurta"), priceText: "₹3,499", retailer: "myntra.com", note: "Loved the fit on me 🧡", originalUrl: "https://www.myntra.com/example-kurta" },
  { id: "p2", title: "Kundan jhumka earrings", imageUrl: img("jhumka"), priceText: "₹1,199", retailer: "amazon.in", note: "Statement pair for festive nights.", originalUrl: "https://www.amazon.in/dp/example-jhumka" },
  { id: "p3", title: "Liquid matte lipstick — Rosewood", imageUrl: img("lipstick"), priceText: "₹650", retailer: "nykaa.com", note: "Wears for 6 hours through dinner.", originalUrl: "https://www.nykaa.com/example-lipstick" },
  { id: "p4", title: "Embellished potli bag", imageUrl: img("potli"), priceText: "₹899", retailer: "ajio.com", originalUrl: "https://www.ajio.com/example-potli" },
  { id: "p5", title: "Gold-plated maang tikka", imageUrl: img("tikka"), priceText: "₹749", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-tikka" },
  { id: "p6", title: "Hand-block printed dupatta", imageUrl: img("dupatta"), priceText: "₹1,299", retailer: "myntra.com", note: "Mix-and-match with kurta sets.", originalUrl: "https://www.myntra.com/example-dupatta" },
  { id: "p7", title: "Diya set (hand-painted, 6 pcs)", imageUrl: img("diya"), priceText: "₹399", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-diya" },
  { id: "p8", title: "Bronze incense holder", imageUrl: img("incense"), priceText: "₹549", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-incense" },
];

export const productsDesk: Product[] = [
  { id: "d1", title: "27\" 4K monitor (matte)", imageUrl: img("monitor"), priceText: "₹38,999", retailer: "amazon.in", note: "Pixel-perfect, no glare.", originalUrl: "https://www.amazon.in/dp/example-monitor" },
  { id: "d2", title: "Wireless mechanical keyboard", imageUrl: img("keyboard"), priceText: "₹12,499", retailer: "amazon.in", note: "Browns. Quiet enough for calls.", originalUrl: "https://www.amazon.in/dp/example-kb" },
  { id: "d3", title: "Aluminum laptop riser", imageUrl: img("riser"), priceText: "₹1,899", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-riser" },
  { id: "d4", title: "USB-C dock (4-port)", imageUrl: img("dock"), priceText: "₹4,299", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-dock" },
  { id: "d5", title: "Warm-white desk lamp", imageUrl: img("lamp"), priceText: "₹2,499", retailer: "flipkart.com", note: "Adjustable arm; great for late-night.", originalUrl: "https://www.flipkart.com/example-lamp" },
  { id: "d6", title: "Linen desk mat (large)", imageUrl: img("desk-mat"), priceText: "₹1,499", retailer: "myntra.com", originalUrl: "https://www.myntra.com/example-mat" },
];

export const productsSkincare: Product[] = [
  { id: "s1", title: "Gentle gel cleanser", imageUrl: img("cleanser"), priceText: "₹699", retailer: "nykaa.com", note: "No-stripping, every day.", originalUrl: "https://www.nykaa.com/example-cleanser" },
  { id: "s2", title: "Niacinamide 10% serum", imageUrl: img("serum"), priceText: "₹499", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-serum" },
  { id: "s3", title: "Hyaluronic acid moisturizer", imageUrl: img("moisturizer"), priceText: "₹899", retailer: "nykaa.com", note: "Plump skin all day.", originalUrl: "https://www.nykaa.com/example-mois" },
  { id: "s4", title: "Mineral SPF 50 sunscreen", imageUrl: img("spf"), priceText: "₹650", retailer: "amazon.in", note: "Non-greasy, no white cast.", originalUrl: "https://www.amazon.in/dp/example-spf" },
  { id: "s5", title: "Soft microfiber face towels (3pk)", imageUrl: img("towels"), priceText: "₹399", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-towels" },
];
```

- [ ] **Step 4: Write `web/mocks/carts.ts`**

```ts
import type { Cart } from "@/lib/types";
import { productsDiwali, productsDesk, productsSkincare } from "./products";

const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/1600/1000`;

export const carts: Cart[] = [
  {
    id: "c_priya_diwali",
    slug: "priya-diwali-2026",
    ownerHandle: "priya.styles",
    ownerDisplayName: "Priya Sharma",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Priya",
    title: "Diwali Edit 2026",
    bio: "My festival picks — outfits, jewelry, makeup, and a few home touches. Everything I'm actually wearing this Diwali ✨",
    coverImageUrl: cover("diwali-cover"),
    accentHex: "#B5532A",
    products: productsDiwali,
    viewsLast7d: 1840,
    clicksLast7d: 312,
    createdAt: "2026-04-12T10:00:00Z",
    updatedAt: "2026-05-18T14:23:00Z",
  },
  {
    id: "c_aarav_desk",
    slug: "aarav-desk-setup",
    ownerHandle: "aarav.makes",
    ownerDisplayName: "Aarav Mehta",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Aarav",
    title: "Desk Setup 2026",
    bio: "Everything on (and under) my desk. I've used each of these daily for at least 6 months.",
    coverImageUrl: cover("desk-cover"),
    accentHex: "#1A1A18",
    products: productsDesk,
    viewsLast7d: 980,
    clicksLast7d: 174,
    createdAt: "2026-03-02T10:00:00Z",
    updatedAt: "2026-05-10T09:15:00Z",
  },
  {
    id: "c_meera_skincare",
    slug: "meera-daily-skincare",
    ownerHandle: "meera.glow",
    ownerDisplayName: "Meera Kapoor",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Meera",
    title: "Daily Skincare Routine",
    bio: "5 things, in order. Boring + repetitive = great skin.",
    coverImageUrl: cover("skincare-cover"),
    accentHex: "#C7959B",
    products: productsSkincare,
    viewsLast7d: 2210,
    clicksLast7d: 421,
    createdAt: "2026-04-20T10:00:00Z",
    updatedAt: "2026-05-22T18:00:00Z",
  },
];
```

- [ ] **Step 5: Write `web/mocks/og-fixtures.ts`**

```ts
import type { OGResult } from "@/lib/types";

// Map of URL substring → mock OG result. The first match wins.
// Pages call this via api-client to simulate "paste URL → fetch OG".
const fixtures: Array<{ match: RegExp; result: OGResult }> = [
  {
    match: /amazon\.in\/dp\/(example|B0)/,
    result: {
      ok: true,
      title: "Sample Amazon product (mock)",
      imageUrl: "https://picsum.photos/seed/amzn/800/800",
      priceText: "₹2,499",
      retailer: "amazon.in",
    },
  },
  {
    match: /myntra\.com\/example/,
    result: {
      ok: true,
      title: "Sample Myntra product (mock)",
      imageUrl: "https://picsum.photos/seed/myntra/800/800",
      priceText: "₹1,899",
      retailer: "myntra.com",
    },
  },
  {
    match: /nykaa\.com\/example/,
    result: {
      ok: true,
      title: "Sample Nykaa product (mock)",
      imageUrl: "https://picsum.photos/seed/nykaa/800/800",
      priceText: "₹799",
      retailer: "nykaa.com",
    },
  },
  {
    match: /flipkart\.com\/example/,
    result: {
      ok: true,
      title: "Sample Flipkart product (mock)",
      imageUrl: "https://picsum.photos/seed/flipkart/800/800",
      priceText: "₹3,299",
      retailer: "flipkart.com",
    },
  },
];

export function lookupOG(url: string): OGResult {
  const hit = fixtures.find((f) => f.match.test(url));
  if (hit) return hit.result;
  return {
    ok: false,
    retailer: "other",
    reason: "We couldn't auto-fill from this URL. Please add the title and image manually.",
  };
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd web
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/types.ts web/mocks/
git commit -m "feat(web): typed mock data — carts, products, users, OG fixtures"
```

---

## Task 6: api-client (mocked) — the single interface pages call

**Files:**
- Create: `web/lib/api-client.ts`
- Create: `web/lib/mocks.ts`

- [ ] **Step 1: Write `web/lib/mocks.ts`** (the mock implementations)

```ts
// In-memory mock backing for api-client. Resets on every reload.
// Pages should NEVER import from here — they import api-client only.

import { carts as seedCarts } from "@/mocks/carts";
import { currentUser } from "@/mocks/users";
import { lookupOG } from "@/mocks/og-fixtures";
import type { Cart, OGResult, Product, User } from "./types";

let carts: Cart[] = JSON.parse(JSON.stringify(seedCarts));

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return currentUser;
}

export async function listMyCarts(): Promise<Cart[]> {
  await delay();
  // for the demo, all carts "belong to" the current user
  return [...carts];
}

export async function getCartBySlug(slug: string): Promise<Cart | null> {
  await delay();
  return carts.find((c) => c.slug === slug) ?? null;
}

export async function getCartById(id: string): Promise<Cart | null> {
  await delay();
  return carts.find((c) => c.id === id) ?? null;
}

export async function createCart(title: string): Promise<Cart> {
  await delay();
  const id = `c_new_${Math.random().toString(36).slice(2, 8)}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id;
  const newCart: Cart = {
    id,
    slug,
    ownerHandle: currentUser.handle,
    ownerDisplayName: currentUser.displayName,
    ownerAvatarUrl: currentUser.avatarUrl,
    title,
    bio: "",
    coverImageUrl: `https://picsum.photos/seed/${id}/1600/1000`,
    accentHex: "#B5532A",
    products: [],
    viewsLast7d: 0,
    clicksLast7d: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  carts = [newCart, ...carts];
  return newCart;
}

export async function updateCart(id: string, patch: Partial<Cart>): Promise<Cart> {
  await delay();
  const idx = carts.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`cart not found: ${id}`);
  const updated = { ...carts[idx], ...patch, updatedAt: new Date().toISOString() };
  carts = [...carts.slice(0, idx), updated, ...carts.slice(idx + 1)];
  return updated;
}

export async function addProductToCart(cartId: string, product: Omit<Product, "id">): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  const p: Product = { ...product, id: `p_new_${Math.random().toString(36).slice(2, 8)}` };
  cart.products = [...cart.products, p];
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function removeProductFromCart(cartId: string, productId: string): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  cart.products = cart.products.filter((p) => p.id !== productId);
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function reorderProducts(cartId: string, productIds: string[]): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  const byId = new Map(cart.products.map((p) => [p.id, p]));
  cart.products = productIds.map((id) => byId.get(id)!).filter(Boolean);
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function fetchOG(url: string): Promise<OGResult> {
  await delay(800); // simulate network
  return lookupOG(url);
}
```

- [ ] **Step 2: Write `web/lib/api-client.ts`** (the public interface — currently just re-exports mocks; later this file swaps to real HTTP)

```ts
// Single interface pages and components use to talk to "the backend".
// Today this re-exports the in-memory mock; in a later plan it swaps to
// real fetch() calls. Importers should NEVER reach into ./mocks directly.

export {
  getCurrentUser,
  listMyCarts,
  getCartBySlug,
  getCartById,
  createCart,
  updateCart,
  addProductToCart,
  removeProductFromCart,
  reorderProducts,
  fetchOG,
} from "./mocks";
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/mocks.ts web/lib/api-client.ts
git commit -m "feat(web): api-client interface + in-memory mock implementation"
```

---

## Task 7: NavBar, Footer, RetailerIcon — shared chrome

**Files:**
- Create: `web/components/nav-bar.tsx`
- Create: `web/components/footer.tsx`
- Create: `web/components/retailer-icon.tsx`
- Create: `web/public/retailers/{amazon,myntra,nykaa,flipkart,ajio}.svg`

- [ ] **Step 1: Add retailer SVGs**

For each retailer create a simple text-based wordmark SVG at `web/public/retailers/<name>.svg` (the implementer can use real brand SVGs from CDNs like simpleicons.org, but a typographic placeholder is acceptable for the milestone — colors should be tasteful, not the brand's primary):

`amazon.svg`, `myntra.svg`, `nykaa.svg`, `flipkart.svg`, `ajio.svg`. 24×24 viewBox, monochrome ink color so they read well on cream background. If unsure, use `<svg viewBox="0 0 24 24" xmlns="..."><text x="12" y="16" text-anchor="middle" font-family="Inter" font-size="9" font-weight="600" fill="#1A1A18">A</text></svg>` (first letter of the retailer) as a fallback.

- [ ] **Step 2: Write `web/components/retailer-icon.tsx`**

```tsx
import Image from "next/image";
import type { Retailer } from "@/lib/types";

const FILE_BY_RETAILER: Record<Retailer, string> = {
  "amazon.in": "/retailers/amazon.svg",
  "amazon.com": "/retailers/amazon.svg",
  "myntra.com": "/retailers/myntra.svg",
  "nykaa.com": "/retailers/nykaa.svg",
  "flipkart.com": "/retailers/flipkart.svg",
  "ajio.com": "/retailers/ajio.svg",
  other: "/retailers/amazon.svg",
};

const LABEL_BY_RETAILER: Record<Retailer, string> = {
  "amazon.in": "Amazon",
  "amazon.com": "Amazon",
  "myntra.com": "Myntra",
  "nykaa.com": "Nykaa",
  "flipkart.com": "Flipkart",
  "ajio.com": "AJIO",
  other: "shop",
};

export function retailerLabel(r: Retailer) { return LABEL_BY_RETAILER[r]; }

export function RetailerIcon({ retailer, size = 16 }: { retailer: Retailer; size?: number }) {
  return (
    <Image
      src={FILE_BY_RETAILER[retailer]}
      width={size}
      height={size}
      alt={LABEL_BY_RETAILER[retailer]}
      aria-hidden
    />
  );
}
```

- [ ] **Step 3: Write `web/components/nav-bar.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/api-client";

export async function NavBar({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const user = variant === "app" ? await getCurrentUser() : null;
  return (
    <nav className="border-b border-rule bg-cream/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
        <Link href={variant === "app" ? "/dashboard" : "/"} className="font-serif text-2xl tracking-tight">
          shoplit
        </Link>
        {variant === "marketing" && (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-ink transition-colors">Sign in</Link>
            <Link
              href="/login"
              className="rounded-full bg-ink text-cream px-4 py-2 font-medium hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        )}
        {variant === "app" && user && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={user.avatarUrl}
              width={32}
              height={32}
              alt={user.displayName}
              className="rounded-full border border-rule"
              unoptimized
            />
            <span className="text-sm">@{user.handle}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Write `web/components/footer.tsx`**

```tsx
import Link from "next/link";

export function Footer({ minimal = false }: { minimal?: boolean }) {
  return (
    <footer className="border-t border-rule mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-sm text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="font-serif text-base text-ink">shoplit</p>
        <nav className="flex items-center gap-5">
          <Link href="/legal/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-ink transition-colors">Terms</Link>
          {!minimal && (
            <a
              href="https://github.com/mayur-tolexo/shoplit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              GitHub
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Configure `next.config.mjs` for remote image hosts**

```js
// web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      // retailer CDNs (used later when real OG fetch lands)
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "assets.myntassets.com" },
      { protocol: "https", hostname: "images-static.nykaa.com" },
      { protocol: "https", hostname: "rukminim2.flixcart.com" },
    ],
  },
};
export default nextConfig;
```

- [ ] **Step 6: Verify build**

```bash
cd web
pnpm build
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add web/components/ web/public/retailers/ web/next.config.mjs
git commit -m "feat(web): nav-bar, footer, retailer-icon, image host whitelist"
```

---

## Task 8: ProductCard component (the customer-facing hero)

**Files:**
- Create: `web/components/product-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
}

export function ProductCard({ product, eagerImage = false }: ProductCardProps) {
  const handleShop = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.success(`Would redirect to ${retailerLabel(product.retailer)}`, {
      description: product.originalUrl,
      duration: 2500,
    });
  };

  return (
    <article className="group rounded-xl overflow-hidden border border-rule bg-cream transition-shadow hover:shadow-md">
      <a href="#" onClick={handleShop} aria-label={`Shop ${product.title} on ${retailerLabel(product.retailer)}`}>
        <div className="relative aspect-square bg-paper">
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={eagerImage}
            loading={eagerImage ? "eager" : "lazy"}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
        </div>
      </a>
      <div className="p-5 sm:p-6">
        <h3 className="font-serif text-xl leading-tight mb-1">{product.title}</h3>
        {product.note && (
          <p className="italic text-sm text-muted mb-2 leading-relaxed">"{product.note}"</p>
        )}
        <p className="text-sm text-muted mb-4">{product.priceText}</p>
        <button
          type="button"
          onClick={handleShop}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent text-cream font-medium py-3 px-4 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-cream"
        >
          <RetailerIcon retailer={product.retailer} size={16} />
          Shop on {retailerLabel(product.retailer)}
          <ExternalLink size={14} aria-hidden />
        </button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd web
pnpm tsc --noEmit
pnpm build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/components/product-card.tsx
git commit -m "feat(web): ProductCard component with mock shop toast"
```

---

## Task 9: CartCard and EmptyState components

**Files:**
- Create: `web/components/cart-card.tsx`
- Create: `web/components/empty-state.tsx`
- Create: `web/public/illustrations/empty-carts.svg`
- Create: `web/public/illustrations/empty-products.svg`

- [ ] **Step 1: Create empty-state SVGs**

For both `empty-carts.svg` and `empty-products.svg`, use a simple line illustration. Acceptable starter: a tasteful linear icon (e.g., a folded-paper or basket outline) in `--rule` color. Use a 240×180 viewBox so it has presence on the page. Example for `empty-carts.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="#E5E1D8" stroke-width="2">
  <rect x="60" y="40" width="120" height="100" rx="8" />
  <line x1="60" y1="70" x2="180" y2="70" />
  <circle cx="80" cy="55" r="3" fill="#E5E1D8" stroke="none" />
  <circle cx="92" cy="55" r="3" fill="#E5E1D8" stroke="none" />
  <line x1="80" y1="95" x2="160" y2="95" />
  <line x1="80" y1="110" x2="140" y2="110" />
  <line x1="80" y1="125" x2="150" y2="125" />
</svg>
```

Make `empty-products.svg` analogous — a different motif (e.g. an outline shopping bag). Implementer's discretion within the visual language.

- [ ] **Step 2: Write `web/components/empty-state.tsx`**

```tsx
import Image from "next/image";

interface EmptyStateProps {
  illustration: string;       // path under /public, e.g. "/illustrations/empty-carts.svg"
  title: string;
  body: string;
  cta?: React.ReactNode;      // a <Link> or <Button>
}

export function EmptyState({ illustration, title, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto py-16 px-4">
      <Image src={illustration} alt="" width={240} height={180} className="mb-6 opacity-90" />
      <h2 className="font-serif text-2xl mb-3">{title}</h2>
      <p className="text-muted mb-6 leading-relaxed">{body}</p>
      {cta}
    </div>
  );
}
```

- [ ] **Step 3: Write `web/components/cart-card.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { Cart } from "@/lib/types";

export function CartCard({ cart }: { cart: Cart }) {
  return (
    <Link
      href={`/dashboard/carts/${cart.id}`}
      className="block group rounded-xl overflow-hidden border border-rule bg-cream transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] bg-paper">
        <Image
          src={cart.coverImageUrl}
          alt={cart.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized
        />
      </div>
      <div className="p-5">
        <h3 className="font-serif text-xl mb-1 line-clamp-2">{cart.title}</h3>
        <p className="text-sm text-muted">
          {cart.products.length} {cart.products.length === 1 ? "product" : "products"}
          {" · "}{cart.viewsLast7d.toLocaleString()} views (7d)
          {" · "}{cart.clicksLast7d.toLocaleString()} clicks (7d)
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd web
pnpm tsc --noEmit
pnpm build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add web/components/cart-card.tsx web/components/empty-state.tsx web/public/illustrations/
git commit -m "feat(web): CartCard, EmptyState components + illustrations"
```

---

## Task 10: PasteUrlPreview component

**Files:**
- Create: `web/components/paste-url-preview.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Link2 } from "lucide-react";
import { fetchOG } from "@/lib/api-client";
import type { OGResult, Product, Retailer } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface PasteUrlPreviewProps {
  onResolved: (draft: Omit<Product, "id">) => void;
}

export function PasteUrlPreview({ onResolved }: PasteUrlPreviewProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<OGResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePaste = (newUrl: string) => {
    setUrl(newUrl);
    setError(null);
    setPreview(null);
    if (!newUrl.match(/^https?:\/\/.+/)) return;
    startTransition(async () => {
      try {
        const og = await fetchOG(newUrl);
        setPreview(og);
        if (!og.ok) setError(og.reason ?? "Couldn't fetch product details.");
      } catch (e) {
        setError("Something went wrong. Please add the product manually.");
      }
    });
  };

  const handleAdd = () => {
    if (!preview || !preview.ok) return;
    onResolved({
      title: preview.title!,
      imageUrl: preview.imageUrl!,
      priceText: preview.priceText ?? "",
      retailer: preview.retailer,
      originalUrl: url,
      note: "",
    });
    setUrl("");
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-2">Paste a product URL</span>
        <div className="relative">
          <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="url"
            value={url}
            onChange={(e) => handlePaste(e.target.value)}
            placeholder="https://www.myntra.com/example-kurta"
            className="w-full rounded-lg border border-rule bg-cream py-3 pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
      </label>

      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Fetching product details…
        </div>
      )}

      {preview && preview.ok && (
        <div className="flex gap-4 p-4 rounded-lg border border-rule bg-paper">
          {preview.imageUrl && (
            <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden bg-cream">
              <Image src={preview.imageUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{preview.title}</p>
            <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
              <RetailerIcon retailer={preview.retailer} size={12} />
              {retailerLabel(preview.retailer)} · {preview.priceText ?? "no price"}
            </p>
            <button
              type="button"
              onClick={handleAdd}
              className="mt-2 rounded-full bg-ink text-cream px-3 py-1 text-xs font-medium hover:opacity-90"
            >
              Add to cart
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-muted" role="status">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd web
pnpm tsc --noEmit
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add web/components/paste-url-preview.tsx
git commit -m "feat(web): PasteUrlPreview component with debounced mock OG fetch"
```

---

## Task 11: ColorPicker, PhoneFrame, ShareSheet components

**Files:**
- Create: `web/components/color-picker.tsx`
- Create: `web/components/phone-frame.tsx`
- Create: `web/components/share-sheet.tsx`

- [ ] **Step 1: Write `web/components/color-picker.tsx`**

```tsx
"use client";

const PRESETS = [
  "#1A1A18", // ink
  "#B5532A", // terracotta
  "#C7959B", // dusty rose
  "#7C7A52", // moss
  "#445E62", // teal
  "#5E4B8B", // plum
  "#A35C00", // amber
  "#225522", // forest
  "#9B2C3E", // wine
  "#3E5C76", // slate blue
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Set accent to ${p}`}
            className={`w-9 h-9 rounded-full border-2 transition-transform ${
              value.toUpperCase() === p.toUpperCase()
                ? "border-ink scale-110"
                : "border-rule hover:scale-105"
            }`}
            style={{ backgroundColor: p }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-muted">Custom:</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1A1A18"
          className="font-mono text-sm w-28 rounded-md border border-rule bg-cream px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="w-6 h-6 rounded border border-rule" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/components/phone-frame.tsx`**

```tsx
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto" style={{ maxWidth: 380 }}>
      <div className="relative rounded-[2.5rem] border-8 border-ink bg-ink shadow-2xl overflow-hidden" style={{ aspectRatio: "9 / 19" }}>
        {/* notch */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-ink z-10" />
        <div className="absolute inset-2 rounded-[2rem] bg-cream overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/components/share-sheet.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ShareSheet({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${slug}` : `/c/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fullUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Share your cart</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              readOnly
              value={fullUrl}
              className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm font-mono"
            />
            <Button onClick={handleCopy} variant="default">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <div className="flex justify-center py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" width={240} height={240} className="rounded-lg border border-rule" />
          </div>
          <p className="text-center text-sm text-muted">
            Scan with a phone camera, or share the link on WhatsApp / Instagram / Twitter.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd web
pnpm tsc --noEmit
pnpm build
git add web/components/color-picker.tsx web/components/phone-frame.tsx web/components/share-sheet.tsx
git commit -m "feat(web): ColorPicker, PhoneFrame, ShareSheet components"
```

---

## Task 12: Landing page `/`

**Files:**
- Replace: `web/app/page.tsx`
- Move existing default to `web/app/(public)/page.tsx`

- [ ] **Step 1: Restructure routes**

Move the default `app/page.tsx` from Task 1 into the `(public)` route group:

```bash
cd web
mkdir -p app/\(public\)
git mv app/page.tsx app/\(public\)/page.tsx
```

(If `app/page.tsx` was already replaced/empty during prior tasks, simply create the new file.)

- [ ] **Step 2: Write `web/app/(public)/page.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { CartCard } from "@/components/cart-card";
import { listMyCarts } from "@/lib/api-client";

export default async function LandingPage() {
  const exampleCarts = (await listMyCarts()).slice(0, 3);
  return (
    <>
      <NavBar variant="marketing" />
      <main>
        {/* HERO */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-6">
                Free shoppable carts for creators.
              </h1>
              <p className="text-lg text-muted mb-8 max-w-xl leading-relaxed">
                Bundle products from Amazon, Myntra, Nykaa and more into one shareable link
                your followers will actually love opening.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
                >
                  Start free
                </Link>
                {exampleCarts[0] && (
                  <Link
                    href={`/c/${exampleCarts[0].slug}`}
                    className="text-ink underline-offset-4 hover:underline transition-all"
                  >
                    See an example →
                  </Link>
                )}
              </div>
            </div>
            {exampleCarts[0] && (
              <div className="relative aspect-[9/16] max-w-sm w-full justify-self-center rounded-3xl overflow-hidden border border-rule shadow-xl">
                <Image
                  src={exampleCarts[0].coverImageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 90vw, 40vw"
                  className="object-cover"
                  priority
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-cream">
                  <p className="font-serif text-3xl leading-tight">{exampleCarts[0].title}</p>
                  <p className="text-sm opacity-80 mt-1">@{exampleCarts[0].ownerHandle}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <h2 className="font-serif text-3xl mb-10 text-center">How it works</h2>
            <ol className="grid gap-8 sm:grid-cols-3">
              <li>
                <p className="font-serif text-2xl mb-2">1.</p>
                <h3 className="font-medium mb-2">Paste any product URL</h3>
                <p className="text-muted text-sm leading-relaxed">From Amazon, Myntra, Nykaa, Flipkart, AJIO — we auto-fill the title and image.</p>
              </li>
              <li>
                <p className="font-serif text-2xl mb-2">2.</p>
                <h3 className="font-medium mb-2">Customize your cart</h3>
                <p className="text-muted text-sm leading-relaxed">Pick a cover image and accent color. Add a short bio. Reorder products with a drag.</p>
              </li>
              <li>
                <p className="font-serif text-2xl mb-2">3.</p>
                <h3 className="font-medium mb-2">Share the link</h3>
                <p className="text-muted text-sm leading-relaxed">A short, beautiful URL your followers can open from Instagram, WhatsApp, or anywhere.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* EXAMPLE CARTS */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="font-serif text-3xl mb-2 text-center">Real carts from real creators</h2>
          <p className="text-muted text-center mb-10">Tap to see what a follower sees.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exampleCarts.map((c) => (
              <CartCard key={c.id} cart={c} />
            ))}
          </div>
        </section>

        {/* VALUE PROPS */}
        <section className="border-t border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {[
                ["Free forever", "No paid tier, no card required."],
                ["All your links, one place", "Replace the link in your bio."],
                ["View + click analytics", "See what your followers love."],
                ["Funded by affiliate", "Revenue from purchases keeps it free."],
              ].map(([t, b]) => (
                <li key={t}>
                  <p className="font-medium mb-1">{t}</p>
                  <p className="text-muted leading-relaxed">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd web
pnpm build
```

Expected: clean. Visit `pnpm dev` and check `/` renders at both mobile (320px) and desktop widths.

- [ ] **Step 4: Commit**

```bash
git add web/app/
git commit -m "feat(web): landing page /"
```

---

## Task 13: Login page `/login`

**Files:**
- Create: `web/app/login/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"options" | "phone" | "otp">("options");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const handleGoogle = () => {
    toast.success("Signed in (mock)");
    setTimeout(() => router.push("/dashboard"), 300);
  };

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Please enter a 10-digit phone number");
      return;
    }
    toast.success("OTP sent (mock)");
    setMode("otp");
  };

  const verifyOtp = () => {
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }
    toast.success("Verified (mock)");
    setTimeout(() => router.push("/dashboard"), 300);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-6">
        <Link href="/" className="font-serif text-2xl tracking-tight">shoplit</Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-rule bg-cream p-8 shadow-sm">
            <h1 className="font-serif text-3xl mb-2 text-center">Sign in to shoplit</h1>
            <p className="text-sm text-muted text-center mb-8">Free, no card required.</p>

            {mode === "options" && (
              <div className="space-y-3">
                <button
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-full border-2 border-ink bg-cream py-3 px-4 font-medium hover:bg-paper transition-colors"
                >
                  <GoogleGlyph />
                  Continue with Google
                </button>
                <button
                  onClick={() => setMode("phone")}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-rule bg-cream py-3 px-4 font-medium text-muted hover:text-ink hover:border-ink transition-colors"
                >
                  <Phone size={16} />
                  Continue with phone
                </button>
              </div>
            )}

            {mode === "phone" && (
              <div className="space-y-4">
                <button onClick={() => setMode("options")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Back
                </button>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Phone number</span>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 rounded-md border border-rule bg-paper text-sm">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      className="flex-1 rounded-md border border-rule bg-cream px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </label>
                <button onClick={sendOtp} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
                  Send OTP
                </button>
              </div>
            )}

            {mode === "otp" && (
              <div className="space-y-4">
                <button onClick={() => setMode("phone")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Edit number
                </button>
                <p className="text-sm text-muted">We sent a 6-digit code to <strong className="text-ink">+91 {phone}</strong></p>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Enter OTP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="w-full rounded-md border border-rule bg-cream px-3 py-3 text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <button onClick={verifyOtp} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
                  Verify and continue
                </button>
                <p className="text-xs text-muted text-center">
                  Resend in 30s · <em>Mock: any 6 digits will succeed.</em>
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted text-center mt-6">
            By continuing you agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.74.13-1.46.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd web
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add web/app/login/
git commit -m "feat(web): /login page with mock google + phone OTP flow"
```

---

## Task 14: Dashboard `/dashboard` + `new cart` action

**Files:**
- Create: `web/app/dashboard/layout.tsx`
- Create: `web/app/dashboard/page.tsx`
- Create: `web/app/dashboard/carts/new/page.tsx`

- [ ] **Step 1: Write `web/app/dashboard/layout.tsx`**

```tsx
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar variant="app" />
      <main className="min-h-[calc(100vh-15rem)]">{children}</main>
      <Footer minimal />
    </>
  );
}
```

- [ ] **Step 2: Write `web/app/dashboard/page.tsx`**

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { listMyCarts } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { EmptyState } from "@/components/empty-state";

export default async function DashboardPage() {
  const carts = await listMyCarts();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl">Your carts</h1>
        <Link
          href="/dashboard/carts/new"
          className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New cart
        </Link>
      </div>

      {carts.length === 0 ? (
        <EmptyState
          illustration="/illustrations/empty-carts.svg"
          title="Your first cart is one paste away"
          body="Pick a product, paste the link, and we'll do the rest."
          cta={
            <Link
              href="/dashboard/carts/new"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90"
            >
              <Plus size={16} /> Create cart
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {carts.map((c) => (
            <CartCard key={c.id} cart={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `web/app/dashboard/carts/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCart } from "@/lib/api-client";
import { toast } from "sonner";

export default function NewCartPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your cart a title");
      return;
    }
    setPending(true);
    try {
      const cart = await createCart(title.trim());
      router.push(`/dashboard/carts/${cart.id}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
      <h1 className="font-serif text-3xl mb-3">Name your new cart</h1>
      <p className="text-muted mb-8 leading-relaxed">
        Something short and descriptive — your followers see this. You can change it later.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Diwali Edit 2026"
          className="w-full rounded-md border border-rule bg-cream px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-ink text-cream py-3 font-medium disabled:opacity-50 hover:opacity-90"
        >
          {pending ? "Creating…" : "Create cart"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd web
pnpm build
git add web/app/dashboard/
git commit -m "feat(web): /dashboard cart list + /dashboard/carts/new"
```

---

## Task 15: Cart editor `/dashboard/carts/[id]`

This is the biggest page in the milestone. It contains the editor + live preview.

**Files:**
- Create: `web/app/dashboard/carts/[id]/page.tsx`
- Create: `web/app/dashboard/carts/[id]/editor.tsx` (client component, since the page is server-rendered then hydrates)

- [ ] **Step 1: Write `web/app/dashboard/carts/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getCartById } from "@/lib/api-client";
import { CartEditor } from "./editor";

export default async function CartEditorPage({ params }: { params: { id: string } }) {
  const cart = await getCartById(params.id);
  if (!cart) notFound();
  return <CartEditor initialCart={cart} />;
}
```

- [ ] **Step 2: Write `web/app/dashboard/carts/[id]/editor.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ArrowDown, ExternalLink, GripVertical, Plus, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/color-picker";
import { PhoneFrame } from "@/components/phone-frame";
import { ProductCard } from "@/components/product-card";
import { PasteUrlPreview } from "@/components/paste-url-preview";
import { ShareSheet } from "@/components/share-sheet";
import {
  addProductToCart,
  removeProductFromCart,
  reorderProducts,
  updateCart,
} from "@/lib/api-client";
import type { Cart, Product } from "@/lib/types";

export function CartEditor({ initialCart }: { initialCart: Cart }) {
  const [cart, setCart] = useState<Cart>(initialCart);
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  const patch = async (changes: Partial<Cart>) => {
    setCart((c) => ({ ...c, ...changes }));
    startTransition(async () => {
      const updated = await updateCart(cart.id, changes);
      setCart(updated);
    });
  };

  const addProduct = async (draft: Omit<Product, "id">) => {
    const updated = await addProductToCart(cart.id, draft);
    setCart(updated);
    setAddOpen(false);
    toast.success("Product added");
  };

  const removeProduct = async (productId: string) => {
    const updated = await removeProductFromCart(cart.id, productId);
    setCart(updated);
  };

  const move = async (productId: string, direction: -1 | 1) => {
    const ids = cart.products.map((p) => p.id);
    const idx = ids.indexOf(productId);
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    const updated = await reorderProducts(cart.id, ids);
    setCart(updated);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Back to carts</Link>
        </div>
        <ShareSheet slug={cart.slug}>
          <Button variant="default"><Share2 size={16} /> Share</Button>
        </ShareSheet>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
        {/* LEFT — EDITOR */}
        <div className="space-y-8">
          {/* Cover image */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Cover image</h2>
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-rule bg-paper">
              <Image src={cart.coverImageUrl} alt="" fill className="object-cover" unoptimized />
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                value={cart.coverImageUrl}
                onChange={(e) => patch({ coverImageUrl: e.target.value })}
                placeholder="https://… image URL"
                className="flex-1 rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </section>

          {/* Title + Bio */}
          <section className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium mb-2">Title</span>
              <input
                type="text"
                value={cart.title}
                onChange={(e) => patch({ title: e.target.value })}
                className="w-full rounded-md border border-rule bg-cream px-3 py-3 font-serif text-2xl focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-2">Bio</span>
              <textarea
                value={cart.bio ?? ""}
                onChange={(e) => patch({ bio: e.target.value })}
                rows={3}
                placeholder="Tell your followers about this cart"
                className="w-full rounded-md border border-rule bg-cream px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </section>

          {/* Accent color */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Accent color</h2>
            <ColorPicker value={cart.accentHex} onChange={(hex) => patch({ accentHex: hex })} />
          </section>

          {/* Products */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-2xl">Products ({cart.products.length})</h2>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="default"><Plus size={16} /> Add product</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-2xl">Add a product</DialogTitle>
                  </DialogHeader>
                  <PasteUrlPreview onResolved={addProduct} />
                </DialogContent>
              </Dialog>
            </div>

            {cart.products.length === 0 && (
              <p className="text-sm text-muted">No products yet. Click "Add product" to paste your first link.</p>
            )}

            <ul className="space-y-2">
              {cart.products.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-rule bg-cream">
                  <GripVertical size={16} className="text-muted shrink-0" aria-hidden />
                  <div className="relative w-12 h-12 rounded-md overflow-hidden bg-paper shrink-0">
                    <Image src={p.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted">{p.priceText}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => move(p.id, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="p-1 rounded hover:bg-paper disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => move(p.id, +1)}
                      disabled={i === cart.products.length - 1}
                      aria-label="Move down"
                      className="p-1 rounded hover:bg-paper disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => removeProduct(p.id)}
                      aria-label="Remove product"
                      className="p-1 rounded hover:bg-paper text-muted hover:text-ink"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="text-sm">
            <Link
              href={`/c/${cart.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-ink underline-offset-4 hover:underline"
            >
              View live <ExternalLink size={14} />
            </Link>
          </div>
        </div>

        {/* RIGHT — PREVIEW */}
        <div className="hidden lg:block sticky top-24 self-start">
          <p className="text-sm text-muted text-center mb-3">Live preview</p>
          <PhoneFrame>
            <PreviewCartPage cart={cart} />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

function PreviewCartPage({ cart }: { cart: Cart }) {
  return (
    <div style={{ ["--accent" as any]: cart.accentHex }}>
      <div className="relative aspect-[5/4]">
        <Image src={cart.coverImageUrl} alt="" fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-cream">
          <p className="text-xs opacity-90">@{cart.ownerHandle}</p>
          <p className="font-serif text-xl leading-tight">{cart.title}</p>
        </div>
      </div>
      <div className="p-3 space-y-3">
        {cart.products.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No products yet.</p>
        ) : (
          cart.products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)
        )}
        {cart.products.length > 3 && (
          <p className="text-center text-xs text-muted">+ {cart.products.length - 3} more on the live page</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd web
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add web/app/dashboard/carts/\[id\]/
git commit -m "feat(web): /dashboard/carts/[id] editor with live preview"
```

---

## Task 16: Public cart page `/c/[slug]`

**Files:**
- Create: `web/app/(public)/c/[slug]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCartBySlug } from "@/lib/api-client";
import { ProductCard } from "@/components/product-card";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cart = await getCartBySlug(params.slug);
  if (!cart) return { title: "Not found · shoplit" };
  return {
    title: `${cart.title} · ${cart.ownerDisplayName}`,
    description: cart.bio ?? `${cart.products.length} curated products from ${cart.ownerDisplayName}.`,
    openGraph: {
      title: cart.title,
      description: cart.bio ?? "",
      images: [{ url: cart.coverImageUrl }],
    },
  };
}

export default async function PublicCartPage({ params }: { params: { slug: string } }) {
  const cart = await getCartBySlug(params.slug);
  if (!cart) notFound();
  return (
    <div style={{ ["--accent" as any]: cart.accentHex }}>
      {/* HERO */}
      <section className="relative w-full" style={{ height: "min(70vh, 640px)" }}>
        <Image
          src={cart.coverImageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 max-w-3xl mx-auto text-cream">
          <div className="flex items-center gap-2 mb-3">
            <Image src={cart.ownerAvatarUrl} alt="" width={32} height={32} className="rounded-full border border-cream/30" unoptimized />
            <span className="text-sm opacity-90">@{cart.ownerHandle}</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">{cart.title}</h1>
          {cart.bio && <p className="text-base opacity-90 max-w-xl leading-relaxed">{cart.bio}</p>}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
        {cart.products.length === 0 ? (
          <p className="text-center text-muted py-16">This cart is still being curated. Check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {cart.products.map((p, i) => (
              <ProductCard key={p.id} product={p} eagerImage={i < 2} />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-rule mt-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 text-sm text-muted text-center space-y-3">
          <p>curated by <strong className="text-ink">@{cart.ownerHandle}</strong></p>
          <p className="text-xs">
            shoplit links contain affiliate tags. We may earn a commission when you shop through them.
          </p>
          <p>
            <Link href="/" className="font-serif text-base text-ink hover:opacity-80">shoplit</Link>
            {" · "}
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
            {" · "}
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd web
pnpm build
```

Visit `http://localhost:3000/c/priya-diwali-2026` (after `pnpm dev`) and check mobile + desktop layouts. The accent color should be terracotta.

- [ ] **Step 3: Commit**

```bash
git add web/app/\(public\)/c/
git commit -m "feat(web): /c/[slug] public cart page (LTK-style stack)"
```

---

## Task 17: Legal pages + not-found

**Files:**
- Create: `web/app/(public)/legal/privacy/page.tsx`
- Create: `web/app/(public)/legal/terms/page.tsx`
- Create: `web/app/not-found.tsx`

- [ ] **Step 1: Write `web/app/(public)/legal/privacy/page.tsx`**

```tsx
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export const metadata = { title: "Privacy · shoplit" };

export default function PrivacyPage() {
  return (
    <>
      <NavBar variant="marketing" />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16 prose-shoplit">
        <h1 className="font-serif text-4xl mb-2">Privacy</h1>
        <p className="text-sm text-muted mb-8">Last updated: 2026-05-23</p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What we collect</h2>
        <p className="leading-relaxed text-ink">
          When you sign in, we store your email and/or phone number, your display name and avatar, and the carts and products you create.
          When a follower opens your cart page, we record an anonymous view and click count so you can see how your link is performing.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What we don't collect</h2>
        <p className="leading-relaxed text-ink">
          We don't load third-party tracking pixels. We don't sell your data. We don't profile your followers beyond the anonymous view/click counts described above.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Cookies</h2>
        <p className="leading-relaxed text-ink">
          We use a first-party session cookie to keep you signed in, and a single anonymous visitor cookie to dedupe view counts.
          That's it — no third-party cookies.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Affiliate disclosure</h2>
        <p className="leading-relaxed text-ink">
          Outbound product links are rewritten with affiliate tags. We may earn a commission when you shop through a shoplit link.
          This funds the service and keeps it free for creators and followers.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Deleting your data</h2>
        <p className="leading-relaxed text-ink">
          From your account settings (coming soon) you can delete your account. We hard-delete your profile, your carts and products.
          Click histories are retained anonymously (no PII), which means they remain in aggregate analytics but cannot be traced back to you.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Contact</h2>
        <p className="leading-relaxed text-ink">
          Questions? Reach us via the GitHub repo's issue tracker.
        </p>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Write `web/app/(public)/legal/terms/page.tsx`**

```tsx
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export const metadata = { title: "Terms · shoplit" };

export default function TermsPage() {
  return (
    <>
      <NavBar variant="marketing" />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <h1 className="font-serif text-4xl mb-2">Terms</h1>
        <p className="text-sm text-muted mb-8">Last updated: 2026-05-23</p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Using shoplit</h2>
        <p className="leading-relaxed text-ink">
          shoplit is a free service for creators to curate and share shoppable carts.
          By using it you agree to these terms. You can stop using it at any time and delete your account from the settings.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Your content</h2>
        <p className="leading-relaxed text-ink">
          You own the carts, product entries, descriptions and images you upload. You grant shoplit a non-exclusive license to host
          and display them on your cart's public page. Don't post anything that's illegal, abusive, or infringes someone else's rights.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Affiliate links</h2>
        <p className="leading-relaxed text-ink">
          When a follower clicks a product link on your cart, shoplit redirects them through our domain and appends affiliate tags.
          Any commission earned funds the service. This is disclosed on every public cart page and applies to all outbound links.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Our service</h2>
        <p className="leading-relaxed text-ink">
          shoplit is provided as-is. We work to keep it up and reliable but don't guarantee uninterrupted service.
          We don't sell goods ourselves; clicking through a cart takes you to a third-party retailer, governed by their own terms.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Our liability</h2>
        <p className="leading-relaxed text-ink">
          To the extent permitted by law, shoplit and its contributors are not liable for indirect or consequential losses
          arising from your use of the service. Don't rely on shoplit for anything mission-critical.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Changes to these terms</h2>
        <p className="leading-relaxed text-ink">
          We may update these terms occasionally. Material changes will be highlighted on the landing page.
          Continuing to use shoplit after a change means you accept the updated terms.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Contact</h2>
        <p className="leading-relaxed text-ink">
          Questions or disputes? Reach us via the GitHub repo's issue tracker.
        </p>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Write `web/app/not-found.tsx`**

```tsx
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export default function NotFound() {
  return (
    <>
      <NavBar variant="marketing" />
      <main className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
        <h1 className="font-serif text-4xl mb-3">Not found</h1>
        <p className="text-muted mb-8">This page doesn't exist or was removed.</p>
        <Link href="/" className="inline-flex rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90">
          ← Back to shoplit
        </Link>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd web
pnpm build
git add web/app/\(public\)/legal/ web/app/not-found.tsx
git commit -m "feat(web): /legal pages + global not-found"
```

---

## Task 18: Final verification — Lighthouse, a11y, end-to-end visual review

**Files:** none new; this task verifies the milestone.

- [ ] **Step 1: Run all checks**

```bash
cd web
pnpm tsc --noEmit
pnpm lint
pnpm build
```

Expected: all clean.

- [ ] **Step 2: Run dev server and visit every page**

```bash
pnpm dev
```

In a browser, visit and visually verify each of these renders correctly:
- `http://localhost:3000/` — landing
- `http://localhost:3000/login` — sign-in flows for Google + Phone OTP
- `http://localhost:3000/dashboard` — cart list (3 example carts)
- `http://localhost:3000/dashboard/carts/new` — create flow
- `http://localhost:3000/dashboard/carts/c_priya_diwali` — editor (live preview visible on desktop)
- `http://localhost:3000/c/priya-diwali-2026` — public cart (mobile + desktop)
- `http://localhost:3000/c/aarav-desk-setup` — different accent (dark)
- `http://localhost:3000/c/meera-daily-skincare` — different accent (rose)
- `http://localhost:3000/legal/privacy`, `/legal/terms`
- `http://localhost:3000/does-not-exist` — 404

Check mobile (DevTools emulate iPhone) and desktop widths.

- [ ] **Step 3: Lighthouse on the public cart page**

In Chrome DevTools → Lighthouse → "Mobile" + "Performance / Accessibility / Best Practices / SEO". Run against `/c/priya-diwali-2026`.

Target: ≥ 90 on Performance, Accessibility, Best Practices, SEO.

If Performance < 90: check images are using `unoptimized` only where necessary; consider adding `priority` and `sizes` to above-fold images. If Accessibility < 90: address axe findings (color contrast, missing labels, focus order).

- [ ] **Step 4: axe a11y scan**

Use the [axe DevTools](https://www.deque.com/axe/devtools/) browser extension (Chrome / Firefox) on each public page. Expected: zero violations.

- [ ] **Step 5: Final commit**

```bash
git status   # expect clean
git log --oneline main..HEAD   # review the branch's history
git tag -a v0.2.0-ux-milestone -m "Frontend UX milestone complete"
```

Don't push the tag automatically — Mayur pushes/merges after he's reviewed.

---

## Acceptance criteria for this milestone

The milestone is done when:
- All 7 pages render correctly at mobile (320–414px) and desktop (1280px+) widths
- A visitor can land on `/`, click through to an example cart, see products, and "Shop on Myntra" toasts an alert
- A creator (mock-logged-in) can:
  - Sign in via the mock Google or phone-OTP flows
  - See 3 example carts on `/dashboard`
  - Open `/dashboard/carts/[id]`, edit title / cover URL / bio / accent color
  - Add a product via paste URL (an Amazon / Myntra / Nykaa / Flipkart `example` URL hits the fixtures and returns a preview)
  - Remove and reorder products
  - See the live preview update in the phone-frame on the right pane
  - Click "Share" and see the QR + short URL + copy button
- `pnpm tsc --noEmit` clean
- `pnpm lint` clean
- `pnpm build` succeeds
- Lighthouse mobile score ≥ 90 on `/c/priya-diwali-2026` (Performance, Accessibility, Best Practices, SEO)
- axe DevTools scan: zero violations on every public page

When this passes, we move to **Plan 2 (Auth)** — replacing the mock `/login` handlers with real Google OAuth + MSG91 OTP — and **Plan 3 (Carts)** — replacing the in-memory mock in `web/lib/mocks.ts` with a real fetch-backed `web/lib/api-client.ts` against `shoplit-api`. Pages and components don't change.
