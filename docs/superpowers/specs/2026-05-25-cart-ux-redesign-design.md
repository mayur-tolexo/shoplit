# Cart UX Redesign — Design

**Date:** 2026-05-25
**Status:** Approved direction (pending spec review)

## Problem

Three cart surfaces have weak, mobile-hostile UX:

1. **Creator editor** (`/dashboard/carts/[id]`) — a two-column `lg:grid-cols-[1.4fr_1fr]` (controls | live preview). On mobile it stacks, so the **preview is buried below every control**, the page is one long scroll, and the *products* (the core task) sit midway down behind cover/accent controls.
2. **Dashboard cart list** — `CartCard` shows a "Copy link" button as `opacity-0 group-hover:opacity-100`, i.e. **hover-only → invisible and unusable on touch devices**. No per-cart views/clicks shown.
3. **Public cart page** (`/c/[slug]`) — hero is fine (contrast already fixed). Missing a creator identity header; `ProductCard` can be tightened for small screens.

No backend changes are needed: `Cart` already carries `viewsLast7d`, `clicksLast7d`, `ownerHandle`, `ownerAvatarUrl`, `ownerDisplayName`, and `products`.

## Surface 1 — Creator editor (the main work)

**Goal:** a clean, single-column, mobile-first editor organized around the task, with the preview one tap away instead of buried.

- **Reorder, Products-first.** Top of the editor is **Products** (the list + a prominent "Add a product"), because adding/arranging products is the core job. Below it, secondary settings.
- **Collapse the noise.** Group the rest into two collapsible sections:
  - **"Cover & look"** — cover image + `CoverPicker` (tiles tucked behind it) + accent color, collapsed by default once a cover exists.
  - **"Settings"** — rename/bio + the delete-cart action, collapsed by default.
  - A small reusable `EditorSection` (summary row with a chevron; expand/collapse; remembers nothing — stateless per mount) renders these.
- **Preview, one tap away.**
  - **Mobile:** a **"Preview" button pinned in the editor header** opens a **full-screen sheet** rendering the *real* cart look (hero + product grid, identical to the public page) from current editor state. A clear close (✕) returns to editing. No inline buried preview.
  - **Desktop (lg+):** keep a **sticky** side preview (current right column), so the side-by-side stays for big screens.
  - New `CartPreviewSheet` component renders the faithful preview (reuses `CartCover` hero treatment + `ProductCard` grid) and is shown as a full-screen overlay on mobile; on desktop the same preview content is the sticky panel. The old cramped `PreviewCartPage` mini-tile is replaced by this faithful preview.
- **Keep** existing behavior: debounced autosave, drag-reorder, inline product edit, the `ImageUploadButton` on add/edit, cover upload.

**Files:** `web/app/dashboard/carts/[id]/editor.tsx` (restructure), new `web/components/editor-section.tsx`, new `web/components/cart-preview-sheet.tsx`.

## Surface 2 — Dashboard cart list

**Goal:** real, tappable actions on mobile + at-a-glance performance.

- `CartCard` gains an **always-visible footer row** (below the cover): **`👁 <views> · 🖱 <clicks>` (7d)** on the left, a tap-friendly **Share** button on the right (copies the link; toast confirms). Remove the hover-only overlay button.
- The whole card continues to link to the editor; the Share button `stopPropagation`s so it doesn't navigate.
- Cover keeps the title/handle overlay; footer is plain `bg-cream` with `border-t border-rule`.

**Files:** `web/components/cart-card.tsx`.

## Surface 3 — Public cart page

**Goal:** a touch of identity + tighter product cards on phones.

- **Creator header strip** directly under the hero: avatar + `@handle` (links to nothing for now) + a muted **"N products"** count. Small, editorial, consistent with tokens.
- **ProductCard polish:** tighten mobile padding/typography, ensure the price/"Shop" row aligns, keep the whole-card tap target and retailer chip. Keep the 2-col mobile / 3-col desktop grid.
- Keep the existing sticky share bar and footer.

**Files:** `web/app/(public)/c/[slug]/page.tsx` (add header strip), `web/components/product-card.tsx` (polish).

## Non-goals (YAGNI)

- No backend/API/schema changes.
- No follow/social features (the @handle is display-only).
- No change to the redirect/click-tracking flow.
- No new data fetching — render from data already on `Cart`.

## Testing

- **Manual (mobile-first):** on a phone width — editor shows Products first, Preview button opens a full-screen real-cart sheet and closes cleanly; collapsible sections expand/collapse; dashboard card Share button works on tap and shows views/clicks; public cart shows the creator header and tighter cards. Desktop: editor keeps the sticky side preview.
- **Gates:** `npx tsc --noEmit`, `npx next lint`, `pnpm run build` all clean. Existing vitest unchanged.
