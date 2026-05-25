# Cart UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three cart surfaces mobile-first and pleasant — a Products-first editor with a tap-to-preview full-screen sheet, dashboard cards with real (non-hover) actions + glanceable stats, and a public cart with a creator header and tighter product cards.

**Architecture:** Pure frontend (Next.js 14 App Router + Tailwind tokens ink/cream/paper/rule/muted/accent). Two new presentational components (`EditorSection`, `CartPreviewSheet`); targeted edits to the editor, `CartCard`, `ProductCard`, and the public cart page. No backend/API/type changes — all data (`viewsLast7d`, `clicksLast7d`, `ownerHandle`, `ownerAvatarUrl`, `products`) is already on `Cart`.

**Tech Stack:** React client components, Radix `Dialog` (already in `@/components/ui/dialog`), lucide-react icons, sonner toasts.

**Testing note:** `web/` has no React component test runner (vitest is configured node-env for pure libs only). Per the established pattern, UI tasks are gated by `npx tsc --noEmit` + `npx next lint` + `pnpm run build` + manual mobile checks — not RTL unit tests. Don't add RTL.

**Commit convention:** no `Co-Authored-By` trailer, no 🤖 emoji.

---

## Task 1: `EditorSection` collapsible

A small reusable expand/collapse section (chevron summary row + body). Used to tuck secondary editor controls away so Products lead.

**Files:**
- Create: `web/components/editor-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Collapsible settings group for the cart editor. Stateless across mounts —
// `defaultOpen` sets the initial state only.
export function EditorSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-rule bg-cream overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
      >
        <span className="font-serif text-lg">{title}</span>
        <ChevronDown
          size={18}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t border-rule">{children}</div>}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/editor-section.tsx
git commit -m "feat(web): EditorSection collapsible for the cart editor"
```

---

## Task 2: `CartPreviewSheet` (faithful cart preview)

Renders the *real* cart look (hero with strong scrim + creator line + product grid) from a `Cart`. Used as the editor's desktop sticky preview content and inside the mobile full-screen preview dialog. Replaces the cramped old `PreviewCartPage`.

**Files:**
- Create: `web/components/cart-preview-sheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
import Image from "next/image";
import { CartCover } from "@/components/cart-cover";
import { ProductCard } from "@/components/product-card";
import type { Cart } from "@/lib/types";

// A faithful, self-contained preview of how a cart looks on its public page.
// `fullPage` makes the hero taller for the full-screen mobile sheet; the
// default compact hero suits the desktop side panel / phone frame.
export function CartPreviewSheet({ cart, fullPage = false }: { cart: Cart; fullPage?: boolean }) {
  return (
    <div
      style={{ ["--accent" as string]: cart.accentHex } as React.CSSProperties}
      className="bg-cream"
    >
      {/* HERO */}
      <section className={`relative w-full ${fullPage ? "h-[40vh] min-h-[240px]" : "aspect-[5/4]"}`}>
        <CartCover coverImageUrl={cart.coverImageUrl} accentHex={cart.accentHex} title={cart.title} />
        <div className="absolute inset-0 bg-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-cream [text-shadow:0_1px_10px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-2 mb-1.5">
            <Image
              src={cart.ownerAvatarUrl}
              alt=""
              width={24}
              height={24}
              className="rounded-full border border-cream/40"
              unoptimized
            />
            <span className="text-xs font-medium">@{cart.ownerHandle}</span>
          </div>
          <h1 className="font-serif text-2xl leading-tight">{cart.title}</h1>
          {cart.bio && <p className="text-xs text-cream/95 mt-1 line-clamp-2">{cart.bio}</p>}
        </div>
      </section>

      {/* PRODUCTS */}
      <div className="p-4">
        {cart.products.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No products yet — add one to see it here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cart.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/cart-preview-sheet.tsx
git commit -m "feat(web): CartPreviewSheet — faithful cart preview for the editor"
```

---

## Task 3: Restructure the editor (Products-first + tap-to-preview)

Targeted edits to `web/app/dashboard/carts/[id]/editor.tsx`. **Preserve all existing state/handlers** (`cart`, `setCart`, `patch`, `addProduct`, `move`, `removeProduct`, `editProduct`, `handleDragEnd`, `handleDelete`, `deleting`, `sensors`) and the `SortableProductRow` component — only the top-level `return (...)` layout and imports change, plus deleting the old `PreviewCartPage`.

**Files:**
- Modify: `web/app/dashboard/carts/[id]/editor.tsx`

- [ ] **Step 1: Add imports + `previewOpen` state**

In the lucide import line (currently `import { ArrowUp, ArrowDown, Check, ExternalLink, GripVertical, Pencil, Share2, Trash2, X } from "lucide-react";`) add `Eye`:

```tsx
import { ArrowUp, ArrowDown, Check, ExternalLink, Eye, GripVertical, Pencil, Share2, Trash2, X } from "lucide-react";
```

Add the two new component imports next to the other `@/components` imports:

```tsx
import { EditorSection } from "@/components/editor-section";
import { CartPreviewSheet } from "@/components/cart-preview-sheet";
```

Immediately after `const [cart, setCart] = useState<Cart>(initialCart);` add:

```tsx
  const [previewOpen, setPreviewOpen] = useState(false);
```

- [ ] **Step 2: Replace the whole `return (...)` block**

Replace everything from `return (` (the component's top-level return, currently at the `<div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">`) through its matching closing `);` that ends the component (the `}` after line ~348, just before `function PreviewCartPage`) with:

```tsx
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink shrink-0">← Carts</Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-full border border-ink px-4 py-2 text-sm font-medium hover:bg-paper transition-colors"
          >
            <Eye size={15} /> Preview
          </button>
          <ShareSheet slug={cart.slug}>
            <Button variant="default"><Share2 size={16} /> Share</Button>
          </ShareSheet>
        </div>
      </div>

      {/* Editable title */}
      <div className="group/title relative mb-6">
        <input
          type="text"
          value={cart.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Untitled cart"
          aria-label="Cart title"
          className="w-full bg-transparent font-serif text-3xl sm:text-4xl tracking-tight px-0 py-1 border-0 border-b-2 border-transparent group-hover/title:border-rule focus:border-accent focus:outline-none transition-colors placeholder:text-muted/60"
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
        {/* LEFT — editor */}
        <div className="space-y-6">
          {/* PRODUCTS — the core task, first */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Add a product</h2>
            <PasteUrlPreview onResolved={addProduct} />

            <div className="flex items-center justify-between mt-6 mb-3">
              <h2 className="font-serif text-2xl">Products ({cart.products.length})</h2>
              <Link
                href={`/c/${cart.slug}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-sm text-ink underline-offset-4 hover:underline"
              >
                View live <ExternalLink size={14} />
              </Link>
            </div>

            {cart.products.length === 0 && (
              <p className="text-sm text-muted">No products yet. Paste a link above to add your first product.</p>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={cart.products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {cart.products.map((p, i) => (
                    <SortableProductRow
                      key={p.id}
                      product={p}
                      isFirst={i === 0}
                      isLast={i === cart.products.length - 1}
                      onMoveUp={() => move(p.id, -1)}
                      onMoveDown={() => move(p.id, +1)}
                      onRemove={() => removeProduct(p.id)}
                      onSave={(patch) => editProduct(p.id, patch)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>

          {/* COVER & LOOK */}
          <EditorSection title="Cover & look" defaultOpen={!cart.coverImageUrl}>
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-rule bg-paper mb-4">
              <CartCover coverImageUrl={cart.coverImageUrl} accentHex={cart.accentHex} title={cart.title} />
            </div>
            <CoverPicker
              value={cart.coverImageUrl}
              accentHex={cart.accentHex}
              title={cart.title}
              onChange={(url) => patch({ coverImageUrl: url })}
            />
            <div className="pt-2">
              <p className="text-sm font-medium mb-2">Accent color</p>
              <ColorPicker value={cart.accentHex} onChange={(hex) => patch({ accentHex: hex })} />
            </div>
          </EditorSection>

          {/* CART DETAILS */}
          <EditorSection title="Cart details">
            <label className="block text-sm font-medium mb-2 text-muted">Bio</label>
            <textarea
              value={cart.bio ?? ""}
              onChange={(e) => patch({ bio: e.target.value })}
              rows={3}
              placeholder="Tell your followers about this cart"
              className="w-full rounded-md border border-rule bg-cream px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </EditorSection>

          {/* SETTINGS / DANGER */}
          <EditorSection title="Settings">
            <h3 className="text-sm font-medium mb-1">Delete this cart</h3>
            <p className="text-sm text-muted mb-3">
              Its share link will stop working and it&apos;ll disappear from your dashboard. This can&apos;t be undone.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete cart
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete “{cart.title}”?</DialogTitle>
                  <DialogDescription>
                    The link <span className="font-mono">/c/{cart.slug}</span> will stop working and the cart leaves your dashboard. This can&apos;t be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <DialogClose asChild>
                    <button type="button" className="rounded-full px-4 py-2 text-sm text-muted hover:text-ink">Cancel</button>
                  </DialogClose>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete cart"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </EditorSection>
        </div>

        {/* RIGHT — desktop sticky preview */}
        <div className="hidden lg:block sticky top-24 self-start">
          <p className="text-sm text-muted text-center mb-3">Live preview</p>
          <PhoneFrame>
            <CartPreviewSheet cart={cart} />
          </PhoneFrame>
        </div>
      </div>

      {/* MOBILE full-screen preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-full w-screen h-[100dvh] sm:h-[100dvh] p-0 gap-0 rounded-none overflow-y-auto">
          <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between bg-cream/95 backdrop-blur border-b border-rule px-4 py-3 space-y-0">
            <DialogTitle className="font-serif text-lg">Preview</DialogTitle>
            <DialogClose asChild>
              <button type="button" aria-label="Close preview" className="text-muted hover:text-ink"><X size={20} /></button>
            </DialogClose>
          </DialogHeader>
          <DialogDescription className="sr-only">A preview of how your cart looks to followers.</DialogDescription>
          <CartPreviewSheet cart={cart} fullPage />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

> Note: the editable-title hint paragraph ("Click to edit · changes save as you type") is intentionally dropped to reduce noise; the underline-on-hover affordance remains.

- [ ] **Step 3: Delete the old `PreviewCartPage` function**

Remove the entire `function PreviewCartPage({ cart }: { cart: Cart }) { ... }` definition (it followed the component, ~lines 351-376) — it's replaced by `CartPreviewSheet`. Leave `SortableProductRow` and any other helpers intact.

- [ ] **Step 4: Remove now-unused imports**

If `tsc`/`lint` reports `ProductCard` or `Image` as unused in `editor.tsx` (they were only used by the deleted `PreviewCartPage`), remove them from the import list. Run the checks in Step 5 and delete whatever is flagged unused. (Do NOT remove `PhoneFrame`, `CartCover`, `ColorPicker`, `CoverPicker` — still used.)

- [ ] **Step 5: Typecheck + lint + build**

```bash
cd web && npx tsc --noEmit && npx next lint --dir app --dir components && pnpm run build
```
Expected: all clean; `/dashboard/carts/[id]` compiles.

- [ ] **Step 6: Manual check**

`npm run start` (or dev). At a phone width: title at top, **Add a product + Products list first**, then collapsible "Cover & look" / "Cart details" / "Settings"; the header **Preview** button opens a full-screen sheet showing the real cart (hero + grid) with a working ✕ close. At desktop width (lg+): the sticky phone-frame preview shows on the right and the mobile Preview button is hidden.

- [ ] **Step 7: Commit**

```bash
git add "web/app/dashboard/carts/[id]/editor.tsx"
git commit -m "feat(web): mobile-first cart editor — products first, tap-to-preview sheet"
```

---

## Task 4: Dashboard `CartCard` — real actions + glanceable stats

Replace the hover-only "Copy link" overlay with an always-visible footer: views/clicks chips + a tap-friendly Share button.

**Files:**
- Modify: `web/components/cart-card.tsx`

- [ ] **Step 1: Update the icon imports**

Change the lucide import to include stat + share icons:

```tsx
import { Check, Eye, MousePointerClick, Share2 } from "lucide-react";
```

- [ ] **Step 2: Remove the hover-only overlay button**

Delete the entire `{showCopy && ( <button ... Copy link ... </button> )}` block that's overlaid on the cover (the one with `opacity-0 group-hover:opacity-100`). Keep the `<CartCover .../>` inside the cover `div`. The `showCopy` prop and `handleCopy` function stay (handleCopy is reused by the footer button in Step 3).

- [ ] **Step 3: Replace the `<div className="p-5">…</div>` body with a stats + share footer**

```tsx
      <div className="p-4">
        <h3 className="font-serif text-lg mb-2 line-clamp-2">{cart.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye size={13} /> {cart.viewsLast7d.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick size={13} /> {cart.clicksLast7d.toLocaleString()}
            </span>
            <span className="text-muted/70">
              · {cart.products.length} {cart.products.length === 1 ? "item" : "items"}
            </span>
          </div>
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy link to ${cart.title}`}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-xs font-medium hover:border-ink hover:bg-paper transition-colors"
            >
              {copied ? <Check size={13} /> : <Share2 size={13} />}
              {copied ? "Copied" : "Share"}
            </button>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Typecheck + lint + build**

```bash
cd web && npx tsc --noEmit && npx next lint --dir components && pnpm run build
```
Expected: clean. If `Link2` is now unused, remove it from imports.

- [ ] **Step 5: Manual check**

On a phone width, the dashboard cards show **views/clicks + items** and a **Share** button that is tappable (no hover needed); tapping Share copies the link + toast, tapping the card opens the editor.

- [ ] **Step 6: Commit**

```bash
git add web/components/cart-card.tsx
git commit -m "feat(web): dashboard cards — tappable Share + glanceable stats (fix hover-only copy)"
```

---

## Task 5: Public cart — creator header + ProductCard polish

**Files:**
- Modify: `web/app/(public)/c/[slug]/page.tsx`
- Modify: `web/components/product-card.tsx`

- [ ] **Step 1: Add a creator header strip under the hero**

In `web/app/(public)/c/[slug]/page.tsx`, the products `<section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">` currently follows the hero `</section>`. Insert this header strip **between** the hero `</section>` and the products `<section>`:

```tsx
      {/* CREATOR HEADER */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 flex items-center gap-3">
        <Image
          src={cart.ownerAvatarUrl}
          alt=""
          width={44}
          height={44}
          className="rounded-full border border-rule shrink-0"
          unoptimized
        />
        <div className="min-w-0">
          <p className="font-medium leading-tight truncate">@{cart.ownerHandle}</p>
          <p className="text-sm text-muted">
            {cart.products.length} {cart.products.length === 1 ? "product" : "products"}
          </p>
        </div>
      </div>
```

(`Image` is already imported in this file.) Then change the products section's top padding from `py-12` to `pt-8 pb-12` so it sits closer to the new header:

Find `<section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">` and replace `py-12` with `pt-8 pb-12`.

- [ ] **Step 2: Polish `ProductCard` for small screens**

In `web/components/product-card.tsx`, replace the content `<div className="flex flex-1 flex-col p-3 sm:p-4">…</div>` block with tightened spacing/typography:

```tsx
      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="font-serif text-sm sm:text-base leading-snug line-clamp-2 mb-1">{product.title}</h3>
        {product.note && (
          <p className="italic text-xs text-muted line-clamp-1 mb-1">&ldquo;{product.note}&rdquo;</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="text-sm font-semibold text-ink truncate">{product.priceText || " "}</span>
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent shrink-0 transition-all group-hover:gap-1.5">
            Shop <ArrowUpRight size={14} aria-hidden />
          </span>
        </div>
      </div>
```

- [ ] **Step 3: Typecheck + lint + build**

```bash
cd web && npx tsc --noEmit && npx next lint --dir app --dir components && pnpm run build
```
Expected: clean.

- [ ] **Step 4: Manual check**

On a phone, the public cart shows the **creator header** (avatar, @handle, product count) under the hero, and product cards are tighter with aligned price/Shop rows. Desktop unchanged in spirit (3-col grid).

- [ ] **Step 5: Commit**

```bash
git add "web/app/(public)/c/[slug]/page.tsx" web/components/product-card.tsx
git commit -m "feat(web): public cart — creator header + tighter product cards"
```

---

## Task 6: End-to-end verification + deploy

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

```bash
cd web && npx tsc --noEmit && npx next lint && pnpm run build
```
Expected: clean (18+ pages generate).

- [ ] **Step 2: Manual matrix (phone width + desktop)**

- Editor: products-first; collapsibles; mobile Preview sheet opens/closes; desktop sticky preview.
- Dashboard: tappable Share + stats on cards.
- Public cart: creator header + tighter cards; sticky share bar still works; hero contrast intact.

- [ ] **Step 3: Deploy web**

```bash
# from repo root, after merge to main
SHOPLIT_DEPLOY_KEY="$HOME/.ssh/shop-lit.pem" ./deploy/redeploy.sh shoplit-web
```
(Web-only change — no API redeploy needed.)

---

## Notes for the implementer

- **No backend changes.** Everything renders from data already on `Cart`.
- **Preserve editor internals.** Only the editor's top-level `return` + imports change; `SortableProductRow`, debounced autosave, dnd handlers, inline product edit, and the `ImageUploadButton` integrations stay exactly as they are.
- **Radix `Dialog` is controlled** via `open`/`onOpenChange` — the mobile preview uses that; the delete dialog stays uncontrolled (trigger-based). Two separate `<Dialog>`s is fine.
- **Don't add RTL/component tests** — web uses tsc+lint+build+manual for UI, vitest only for pure libs.
- Commit messages: no `Co-Authored-By`, no 🤖.
```
