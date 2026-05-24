# Mobile "Share to shoplit" (PWA Share Target) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let mobile creators add a product by sharing it from any shopping app into an installed shoplit PWA — link + title (+ price) pre-fill an add screen that posts explicit fields to the existing add API, never touching the IP-blocked server fetch.

**Architecture:** A static web manifest declares an Android Web Share Target (`GET /add?title&text&url`). A minimal service worker makes shoplit installable. A pure `parse-share.ts` turns the shared payload into `{ productUrl, title, priceText }`. A new `/add` page (auth-gated; returns the user to `/add` after Google login via a new OAuth `next=` param) renders a prefilled form with a cart picker and posts via a new `addSharedItem` client call. iOS/desktop fall back to a paste box on the same page.

**Tech Stack:** Next.js 14 App Router + TypeScript + Tailwind (tokens: ink/cream/paper/accent), Go (chi, oauth2), vitest (new in web), sharp (new dev dep for icon generation).

---

## Spec

Source: `docs/superpowers/specs/2026-05-24-shoplit-mobile-share-target-design.md`

## File Structure

**Backend (Go):**
- Modify `internal/auth/google.go` — `HandleGoogleStart` reads/stores a safe `next` path; `HandleGoogleCallback` redirects there.
- Modify `internal/auth/google_test.go` — tests for `next` round-trip + open-redirect guard.

**Web — PWA shell:**
- Create `web/vitest.config.ts`, modify `web/package.json` — add vitest + `test` script.
- Create `web/lib/parse-share.ts` + `web/lib/parse-share.test.ts` — the pure parser.
- Create `web/public/manifest.webmanifest` — manifest with `share_target`.
- Create `web/public/sw.js` — minimal service worker.
- Create `web/components/sw-register.tsx` — client SW registrar.
- Create `web/scripts/gen-pwa-icons.mjs` + `web/public/icons/{192,512,512-maskable}.png` — icons.
- Modify `web/app/layout.tsx` — link manifest, set theme color, mount registrar.

**Web — the /add flow:**
- Modify `web/lib/api-client.ts` — add `addSharedItem`.
- Create `web/app/add/page.tsx` — auth-gated server page (parse + fetch carts).
- Create `web/app/add/add-form.tsx` — client form (cart picker, submit, paste box, success).
- Modify `web/app/(public)/get-extension/page.tsx` — point the mobile section at the share flow.

---

## Task 1: OAuth `next=` return-to (backend)

Lets `/add` send a logged-out user through Google sign-in and land back on `/add` with the shared params intact. Reuses the existing temp-cookie mechanism (`SetTemp`/`GetTemp`/`ClearTemp`).

**Files:**
- Modify: `internal/auth/google.go:44-110`
- Test: `internal/auth/google_test.go`

- [ ] **Step 1: Write failing tests**

Append to `internal/auth/google_test.go`:

```go
func TestGoogleCallback_RedirectsToNext(t *testing.T) {
	sm := newTestSM(t) // existing helper used by the other callback tests
	upsert := func(GoogleUserInfo) (int64, error) { return 7, nil }
	srv := fakeGoogleServer(t)
	defer srv.Close()
	userinfoURL := srv.URL + "/userinfo"
	cfg := &oauth2.Config{Endpoint: oauth2.Endpoint{TokenURL: srv.URL + "/token"}}

	handler := auth.HandleGoogleCallback(cfg, sm, upsert, "http://localhost:3000", userinfoURL)

	// Pre-set the temp cookies the callback expects: state + next.
	rrPre := httptest.NewRecorder()
	sm.SetTemp(rrPre, "oauth_state", "fixed-state-value")
	sm.SetTemp(rrPre, "oauth_next", "/add?title=x&url=https%3A%2F%2Famzn.in%2Fd%2Fabc")
	req := httptest.NewRequest("GET", "/cb?state=fixed-state-value&code=fake-code", nil)
	for _, c := range rrPre.Result().Cookies() {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusFound {
		t.Fatalf("want 302, got %d", rr.Code)
	}
	if got := rr.Header().Get("Location"); got != "http://localhost:3000/add?title=x&url=https%3A%2F%2Famzn.in%2Fd%2Fabc" {
		t.Fatalf("redirect = %q", got)
	}
}

func TestGoogleCallback_RejectsUnsafeNext(t *testing.T) {
	sm := newTestSM(t)
	upsert := func(GoogleUserInfo) (int64, error) { return 7, nil }
	srv := fakeGoogleServer(t)
	defer srv.Close()
	cfg := &oauth2.Config{Endpoint: oauth2.Endpoint{TokenURL: srv.URL + "/token"}}
	handler := auth.HandleGoogleCallback(cfg, sm, upsert, "http://localhost:3000", srv.URL+"/userinfo")

	rrPre := httptest.NewRecorder()
	sm.SetTemp(rrPre, "oauth_state", "fixed-state-value")
	sm.SetTemp(rrPre, "oauth_next", "//evil.example.com/phish") // protocol-relative → unsafe
	req := httptest.NewRequest("GET", "/cb?state=fixed-state-value&code=fake-code", nil)
	for _, c := range rrPre.Result().Cookies() {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if got := rr.Header().Get("Location"); got != "http://localhost:3000/dashboard" {
		t.Fatalf("unsafe next should fall back to /dashboard, got %q", got)
	}
}

func TestGoogleStart_StoresNext(t *testing.T) {
	sm := newTestSM(t)
	cfg := auth.GoogleConfig("id", "secret", "http://localhost:8080/cb")
	handler := auth.HandleGoogleStart(cfg, sm)
	req := httptest.NewRequest("GET", "/api/v1/auth/google?next=%2Fadd%3Ftitle%3Dx", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusFound {
		t.Fatalf("want 302, got %d", rr.Code)
	}
	var found bool
	for _, c := range rr.Result().Cookies() {
		if c.Name == sm.TempCookieName("oauth_next") { // see Step 3 for this helper
			found = true
		}
	}
	if !found {
		t.Fatalf("expected an oauth_next temp cookie to be set")
	}
}
```

> Note for the implementer: the other tests in this file already construct a `SessionManager` (look for how `TestGoogleCallback_HappyPath` builds `sm`). If a `newTestSM(t)` helper does not exist, extract one from that test (same secret/config) so all tests share it. `fakeGoogleServer` already exists in this file.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `go test ./internal/auth/ -run TestGoogle -v`
Expected: compile error / FAIL — `oauth_next` not handled, no `TempCookieName` method.

- [ ] **Step 3: Add a `next` safety helper + cookie-name accessor**

In `internal/auth/google.go`, add near the top (after imports):

```go
// safeNextPath returns p only if it is a safe same-site relative path
// (begins with a single "/", no scheme, no protocol-relative "//"). Otherwise "".
func safeNextPath(p string) string {
	if p == "" || p[0] != '/' {
		return ""
	}
	if strings.HasPrefix(p, "//") {
		return ""
	}
	if strings.Contains(p, "://") {
		return ""
	}
	return p
}
```

Add `"strings"` to the import block.

In `internal/auth/session.go`, expose the temp cookie name so tests (and callers) don't guess it. Find where `SetTemp` builds its cookie name (a prefix + key) and add:

```go
// TempCookieName returns the cookie name SetTemp/GetTemp use for key.
func (s *SessionManager) TempCookieName(key string) string {
	return tempCookiePrefix + key // use whatever SetTemp already uses
}
```

> If `SetTemp` uses the bare `key` as the cookie name (no prefix), make `TempCookieName` return `key` and adjust the test's expectation accordingly. Match the existing implementation exactly.

- [ ] **Step 4: Store `next` in `HandleGoogleStart`**

Replace the body of `HandleGoogleStart` (`internal/auth/google.go:44-54`):

```go
func HandleGoogleStart(cfg *oauth2.Config, sm *SessionManager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state, err := RandomString(24)
		if err != nil {
			http.Error(w, "state gen", http.StatusInternalServerError)
			return
		}
		sm.SetTemp(w, "oauth_state", state)
		if next := safeNextPath(r.URL.Query().Get("next")); next != "" {
			sm.SetTemp(w, "oauth_next", next)
		}
		http.Redirect(w, r, cfg.AuthCodeURL(state, oauth2.AccessTypeOnline), http.StatusFound)
	})
}
```

- [ ] **Step 5: Honor `next` in `HandleGoogleCallback`**

Replace the final redirect in `HandleGoogleCallback` (`internal/auth/google.go:104`, the `sm.SetUser` + `http.Redirect` lines) with:

```go
		sm.SetUser(w, uid)

		dest := "/dashboard"
		if next, err := sm.GetTemp(r, "oauth_next"); err == nil {
			if safe := safeNextPath(next); safe != "" {
				dest = safe
			}
		}
		sm.ClearTemp(w, "oauth_next")
		http.Redirect(w, r, frontendURL+dest, http.StatusFound)
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `go test ./internal/auth/ -run TestGoogle -v`
Expected: PASS (incl. existing happy-path/bad-state tests).

- [ ] **Step 7: Commit**

```bash
git add internal/auth/google.go internal/auth/session.go internal/auth/google_test.go
git commit -m "feat(auth): support safe next= return-to through Google OAuth"
```

---

## Task 2: Add vitest to web

The parser needs unit tests; web has no test runner yet.

**Files:**
- Create: `web/vitest.config.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Install vitest**

Run: `cd web && npm install -D vitest@^2.1.0`
Expected: added to devDependencies.

- [ ] **Step 2: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Add the test script**

In `web/package.json` `"scripts"`, add:

```json
    "test": "vitest run"
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `cd web && npx vitest run`
Expected: exits 0 with "No test files found" (or runs zero tests).

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts
git commit -m "chore(web): add vitest test runner"
```

---

## Task 3: Share-text parser

Pure function turning an Android share payload into product fields. No retailer detection here — the add API fills `retailer` from `original_url`.

**Files:**
- Create: `web/lib/parse-share.ts`
- Test: `web/lib/parse-share.test.ts`

- [ ] **Step 1: Write failing tests**

`web/lib/parse-share.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseShare } from "./parse-share";

describe("parseShare", () => {
  it("amazon: title from text, url from url param", () => {
    const r = parseShare({
      text: "Cool Headphones https://amzn.in/d/abc123",
      url: "https://amzn.in/d/abc123",
    });
    expect(r.productUrl).toBe("https://amzn.in/d/abc123");
    expect(r.title).toBe("Cool Headphones");
    expect(r.priceText).toBe("");
  });

  it("nykaa: prefers the title param, strips boilerplate from text", () => {
    const r = parseShare({
      title: "Lakme Lipstick",
      text: "Check out this product I found on Nykaa: https://www.nykaa.com/lakme-lipstick/p/12345",
    });
    expect(r.productUrl).toBe("https://www.nykaa.com/lakme-lipstick/p/12345");
    expect(r.title).toBe("Lakme Lipstick");
  });

  it("nykaa: no title param → falls back to humanized url slug", () => {
    const r = parseShare({
      text: "Check out this product I found on Nykaa: https://www.nykaa.com/lakme-9to5-lipstick/p/12345",
    });
    expect(r.productUrl).toBe("https://www.nykaa.com/lakme-9to5-lipstick/p/12345");
    expect(r.title).toBe("lakme 9to5 lipstick");
  });

  it("flipkart: extracts a rupee price from text", () => {
    const r = parseShare({
      text: "Boat Earbuds ₹1,299 https://www.flipkart.com/boat/p/itm123",
    });
    expect(r.title).toBe("Boat Earbuds");
    expect(r.priceText).toBe("₹1,299");
    expect(r.productUrl).toBe("https://www.flipkart.com/boat/p/itm123");
  });

  it("ignores a title param that is itself a URL", () => {
    const r = parseShare({
      title: "https://www.myntra.com/x/123",
      text: "Nike Shoes https://www.myntra.com/x/123",
    });
    expect(r.title).toBe("Nike Shoes");
  });

  it("no url anywhere → empty productUrl", () => {
    const r = parseShare({ text: "just some text", title: "just some text" });
    expect(r.productUrl).toBe("");
    expect(r.title).toBe("just some text");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd web && npx vitest run lib/parse-share.test.ts`
Expected: FAIL — `parse-share` module not found.

- [ ] **Step 3: Implement `web/lib/parse-share.ts`**

```ts
export interface SharedInput {
  title?: string;
  text?: string;
  url?: string;
}

export interface ParsedShare {
  productUrl: string;
  title: string;
  priceText: string;
}

const URL_RE = /https?:\/\/[^\s"'<>]+/i;
const URL_RE_G = /https?:\/\/[^\s"'<>]+/gi;
const PRICE_RE = /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?/i;

// Boilerplate that retailer apps prepend to shared text.
const BOILERPLATE: RegExp[] = [
  /check out this product i found on[^:]*:?/i,
  /check out this[^:]*:?/i,
  /i found this on[^:]*:?/i,
];

function humanizeSlug(productUrl: string): string {
  try {
    const u = new URL(productUrl);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const t = decodeURIComponent(seg)
      .replace(/\.(html?|aspx)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Reject pure ids / too-short fragments.
    if (t.length < 3 || /^[0-9a-f]{6,}$/i.test(t)) return "";
    return t;
  } catch {
    return "";
  }
}

export function parseShare(input: SharedInput): ParsedShare {
  const text = (input.text ?? "").trim();
  const url = (input.url ?? "").trim();

  // 1. Product URL: explicit url param first, else first URL in text.
  let productUrl = url.match(URL_RE)?.[0] ?? "";
  if (!productUrl) productUrl = text.match(URL_RE)?.[0] ?? "";

  // 2. Title: title param (unless it's a URL) → text minus URLs/boilerplate → slug.
  let title = (input.title ?? "").trim();
  if (URL_RE.test(title) && title.match(URL_RE)?.[0] === title) title = "";
  if (!title) {
    let t = text.replace(URL_RE_G, " ");
    for (const re of BOILERPLATE) t = t.replace(re, " ");
    title = t.replace(/\s+/g, " ").trim();
  }
  if (!title) title = humanizeSlug(productUrl);

  // 3. Price from the text.
  const priceText = text.match(PRICE_RE)?.[0]?.replace(/\s+/g, " ").trim() ?? "";

  return { productUrl, title, priceText };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd web && npx vitest run lib/parse-share.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/parse-share.ts web/lib/parse-share.test.ts
git commit -m "feat(web): share-text parser for product url/title/price"
```

---

## Task 4: PWA manifest with Web Share Target

**Files:**
- Create: `web/public/manifest.webmanifest`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Create `web/public/manifest.webmanifest`**

```json
{
  "name": "shoplit",
  "short_name": "shoplit",
  "description": "Build a shoppable cart and share it with one link.",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FAF8F4",
  "theme_color": "#B5532A",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/add",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

- [ ] **Step 2: Link the manifest + theme color in `web/app/layout.tsx`**

In the `metadata` export, add the `manifest` key:

```ts
export const metadata: Metadata = {
  title: "shoplit",
  description: "Build a curated cart of products from Amazon, Myntra, Nykaa and more, then share it with a short URL.",
  manifest: "/manifest.webmanifest",
};
```

In the `viewport` export, add `themeColor`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B5532A",
};
```

- [ ] **Step 3: Verify it serves**

Run: `cd web && npm run build`
Expected: build succeeds. (Manual runtime check happens in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add web/public/manifest.webmanifest web/app/layout.tsx
git commit -m "feat(web): PWA manifest with Android Web Share Target"
```

---

## Task 5: Service worker + registration

Minimal SW so Android treats shoplit as installable. Network passthrough only — no caching of dynamic pages (avoids stale auth/content).

**Files:**
- Create: `web/public/sw.js`
- Create: `web/components/sw-register.tsx`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Create `web/public/sw.js`**

```js
// Minimal service worker: required for PWA installability.
// Network passthrough — intentionally no caching so pages never go stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith → the browser handles the request normally.
});
```

- [ ] **Step 2: Create `web/components/sw-register.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal; the app still works.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
```

- [ ] **Step 3: Mount it in `web/app/layout.tsx`**

Add the import:

```tsx
import { SwRegister } from "@/components/sw-register";
```

Render it inside `<body>` next to `<Toaster />`:

```tsx
      <body>
        {children}
        <Toaster position="bottom-center" richColors />
        <SwRegister />
      </body>
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/public/sw.js web/components/sw-register.tsx web/app/layout.tsx
git commit -m "feat(web): minimal service worker + registration for installability"
```

---

## Task 6: Generate PWA icons

**Files:**
- Create: `web/scripts/gen-pwa-icons.mjs`
- Create (generated, committed): `web/public/icons/192.png`, `512.png`, `512-maskable.png`
- Modify: `web/package.json` (devDep + script)

- [ ] **Step 1: Install sharp**

Run: `cd web && npm install -D sharp@^0.33.0`
Expected: added to devDependencies.

- [ ] **Step 2: Create `web/scripts/gen-pwa-icons.mjs`**

```js
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const svgPath = fileURLToPath(new URL("../app/icon.svg", import.meta.url));
const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const out = (name) => fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url));

await mkdir(outDir, { recursive: true });
const svg = await readFile(svgPath);

// "any" purpose — edge-to-edge rounded mark.
await sharp(svg).resize(192, 192).png().toFile(out("192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("512.png"));

// "maskable" — mark at ~80% on the brand background so it survives Android's
// circle/squircle mask without clipping.
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#B5532A" },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("512-maskable.png"));

console.log("PWA icons written → web/public/icons/");
```

- [ ] **Step 3: Add a generation script to `web/package.json`**

In `"scripts"`, add:

```json
    "gen-icons": "node scripts/gen-pwa-icons.mjs"
```

- [ ] **Step 4: Generate the icons**

Run: `cd web && npm run gen-icons && ls -la public/icons`
Expected: `192.png`, `512.png`, `512-maskable.png` exist (non-zero size).

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/scripts/gen-pwa-icons.mjs web/public/icons
git commit -m "feat(web): generate PWA app icons (any + maskable)"
```

---

## Task 7: `addSharedItem` API client

Posts explicit product fields with **no** `retailer` field, so the server detects the retailer from `original_url` (`addItem` sets it via `ogfetch.RetailerFromURL` when empty). Avoids the blocked OG fetch entirely.

**Files:**
- Modify: `web/lib/api-client.ts`

- [ ] **Step 1: Add the function**

Append to `web/lib/api-client.ts` (after `addProductToCart`):

```ts
// Add a product from shared/pasted fields. Sends no `retailer` field so the
// server detects it from original_url. Never triggers a server-side OG fetch.
export async function addSharedItem(
  cartId: string,
  fields: { title: string; priceText?: string; imageUrl?: string; originalUrl: string; note?: string },
): Promise<void> {
  await jsonFetch(`/api/v1/carts/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({
      title: fields.title,
      price_text: fields.priceText ?? "",
      image_url: fields.imageUrl ?? "",
      original_url: fields.originalUrl,
      note: fields.note ?? "",
    }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/api-client.ts
git commit -m "feat(web): addSharedItem client (explicit fields, server detects retailer)"
```

---

## Task 8: `/add` server page (auth gate + parse + carts)

**Files:**
- Create: `web/app/add/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, listMyCarts, API_BASE } from "@/lib/api-client";
import { parseShare } from "@/lib/parse-share";
import { AddForm } from "./add-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add a product · shoplit" };

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function AddPage({
  searchParams,
}: {
  searchParams: { title?: string | string[]; text?: string | string[]; url?: string | string[] };
}) {
  const cookie = cookies().toString();

  // Auth gate: send logged-out users through Google sign-in, returning to this
  // exact /add URL (params preserved) afterwards.
  const user = await getCurrentUser({ cookie }).catch(() => null);
  if (!user) {
    const qs = new URLSearchParams();
    for (const k of ["title", "text", "url"] as const) {
      const val = asString(searchParams[k]);
      if (val) qs.set(k, val);
    }
    const next = "/add" + (qs.toString() ? `?${qs.toString()}` : "");
    redirect(`${API_BASE}/api/v1/auth/google?next=${encodeURIComponent(next)}`);
  }

  const carts = await listMyCarts({ cookie }).catch(() => []);
  const initial = parseShare({
    title: asString(searchParams.title),
    text: asString(searchParams.text),
    url: asString(searchParams.url),
  });

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-serif text-3xl mb-1">Add to a cart</h1>
      <p className="text-sm text-muted mb-6">Shared from your shopping app — tweak and save.</p>
      <AddForm
        carts={carts.map((c) => ({ id: c.id, title: c.title, slug: c.slug }))}
        initial={initial}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck (will fail until Task 9 creates add-form)**

Run: `cd web && npx tsc --noEmit`
Expected: error `Cannot find module './add-form'` — resolved by Task 9. (Do not commit yet.)

- [ ] **Step 3: Commit together with Task 9.** (No separate commit — see Task 9 Step 5.)

---

## Task 9: `/add` client form

Cart picker (defaults to last-used via `localStorage`), editable fields, paste box (iOS/manual), submit via `addSharedItem`, success state. Matches existing input styling (rounded, `border-rule`, `bg-cream`, `focus:ring-accent`) used on the login page.

**Files:**
- Create: `web/app/add/add-form.tsx`

- [ ] **Step 1: Create the form**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { addSharedItem, createCart } from "@/lib/api-client";
import { parseShare, type ParsedShare } from "@/lib/parse-share";

type CartOpt = { id: string; title: string; slug: string };
const LAST_CART_KEY = "shoplit:lastCart";

const inputCls =
  "w-full rounded-md border border-rule bg-cream px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent";

export function AddForm({ carts, initial }: { carts: CartOpt[]; initial: ParsedShare }) {
  const [cartList, setCartList] = useState<CartOpt[]>(carts);
  const defaultCart = useMemo(() => {
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(LAST_CART_KEY);
      if (last && carts.some((c) => c.id === last)) return last;
    }
    return carts[0]?.id ?? "";
  }, [carts]);

  const [cartId, setCartId] = useState(defaultCart);
  const [title, setTitle] = useState(initial.title);
  const [priceText, setPriceText] = useState(initial.priceText);
  const [imageUrl, setImageUrl] = useState("");
  const [originalUrl, setOriginalUrl] = useState(initial.productUrl);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<CartOpt | null>(null);
  const [newCartTitle, setNewCartTitle] = useState("");

  // Paste box: re-parse pasted share text into the fields.
  const onPaste = (raw: string) => {
    const p = parseShare({ text: raw, url: raw });
    if (p.productUrl) setOriginalUrl(p.productUrl);
    if (p.title) setTitle(p.title);
    if (p.priceText) setPriceText(p.priceText);
  };

  const submit = async () => {
    if (!cartId) return toast.error("Pick a cart first.");
    if (!title.trim()) return toast.error("Add a title.");
    if (!originalUrl.trim()) return toast.error("Add the product link.");
    setBusy(true);
    try {
      await addSharedItem(cartId, { title: title.trim(), priceText, imageUrl, originalUrl: originalUrl.trim(), note });
      window.localStorage.setItem(LAST_CART_KEY, cartId);
      setAdded(cartList.find((c) => c.id === cartId) ?? null);
    } catch {
      toast.error("Couldn't add — try again.");
    } finally {
      setBusy(false);
    }
  };

  const addAnother = () => {
    setAdded(null);
    setTitle("");
    setPriceText("");
    setImageUrl("");
    setOriginalUrl("");
    setNote("");
  };

  const makeCart = async () => {
    if (!newCartTitle.trim()) return;
    try {
      const c = await createCart(newCartTitle.trim());
      const opt = { id: c.id, title: c.title, slug: c.slug };
      setCartList((l) => [opt, ...l]);
      setCartId(opt.id);
      setNewCartTitle("");
    } catch {
      toast.error("Couldn't create the cart.");
    }
  };

  if (added) {
    return (
      <div className="rounded-2xl border border-rule bg-paper p-6 text-center">
        <p className="font-serif text-2xl mb-1">Added ✓</p>
        <p className="text-sm text-muted mb-5">Saved to “{added.title}”.</p>
        <div className="flex flex-col gap-3">
          <button onClick={addAnother} className="rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
            Add another
          </button>
          <Link href={`/dashboard/carts/${added.id}`} className="rounded-full border border-ink py-3 font-medium hover:bg-paper">
            View cart
          </Link>
        </div>
      </div>
    );
  }

  if (cartList.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">You don’t have a cart yet — create one to start adding.</p>
        <input value={newCartTitle} onChange={(e) => setNewCartTitle(e.target.value)} placeholder="Cart name (e.g. My picks)" className={inputCls} />
        <button onClick={makeCart} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
          Create cart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!originalUrl && (
        <label className="block">
          <span className="block text-sm font-medium mb-1">Paste a product link</span>
          <textarea
            rows={2}
            onChange={(e) => onPaste(e.target.value)}
            placeholder="Paste the link or the whole “Check out this product…” text"
            className={inputCls}
          />
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium mb-1">Cart</span>
        <select value={cartId} onChange={(e) => setCartId(e.target.value)} className={inputCls}>
          {cartList.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Price</span>
        <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="₹ price" className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Product link</span>
        <input value={originalUrl} onChange={(e) => setOriginalUrl(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Image URL <span className="text-muted font-normal">(optional)</span></span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Leave blank for a placeholder" className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Note <span className="text-muted font-normal">(optional)</span></span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>

      <button onClick={submit} disabled={busy} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90 disabled:opacity-60">
        {busy ? "Adding…" : "＋ Add to cart"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Confirm `createCart` is exported**

Run: `cd web && grep -n "export async function createCart" lib/api-client.ts`
Expected: matches (it exists at `lib/api-client.ts:91`). If its signature differs from `createCart(title: string): Promise<Cart>`, adjust the `makeCart` call accordingly.

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors (resolves Task 8's missing-module error too).

- [ ] **Step 4: Lint**

Run: `cd web && npx next lint --dir app --dir lib --dir components`
Expected: no errors.

- [ ] **Step 5: Commit (Tasks 8 + 9 together)**

```bash
git add web/app/add/page.tsx web/app/add/add-form.tsx
git commit -m "feat(web): /add share-target screen — prefilled form, cart picker, paste fallback"
```

---

## Task 10: Mobile entry points & install instructions

Make the flow discoverable: tell mobile users to install + share, and give iOS/desktop a paste entry.

**Files:**
- Modify: `web/app/(public)/get-extension/page.tsx`

- [ ] **Step 1: Update the mobile section copy**

In `web/app/(public)/get-extension/page.tsx`, replace the `mobileSteps` array with the share-first flow:

```tsx
const mobileSteps = [
  { t: "Install shoplit", b: "Open shoplit.in in Chrome on your phone → menu (⋮) → “Add to Home screen”. (On iPhone: Safari → Share → Add to Home Screen.)" },
  { t: "Open a product & tap Share", b: "On Nykaa, Myntra, Amazon, Flipkart or AJIO, open the product and tap the app’s Share button." },
  { t: "Choose shoplit (Android)", b: "Pick shoplit from the share sheet — it opens with the link and title already filled in. iPhone: copy the link, open shoplit and paste it on the Add screen." },
  { t: "Pick a cart & add", b: "Choose the cart, tweak the price/image if you like, and add. Done — no typing it all out." },
];
```

- [ ] **Step 2: Add a direct link to the paste/add screen**

In the same file, inside the mobile `<section>` (after the `<ol>` of `mobileSteps`), add:

```tsx
          <Link
            href="/add"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90"
          >
            Add a product by link →
          </Link>
```

(`Link` is already imported in this file.)

- [ ] **Step 3: Verify build + lint**

Run: `cd web && npm run build && npx next lint --dir app`
Expected: build + lint pass.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(public)/get-extension/page.tsx"
git commit -m "feat(web): mobile share-to-shoplit instructions + add-by-link entry"
```

---

## Task 11: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test + build gate**

```bash
go test ./internal/auth/ -run TestGoogle -v
cd web && npx vitest run && npx tsc --noEmit && npx next lint && npm run build
```
Expected: Go auth tests pass; vitest passes; typecheck/lint/build clean.

- [ ] **Step 2: Manual — installability**

Serve a prod build (`cd web && npm run start`) or deploy to a staging origin over HTTPS. In Chrome DevTools → Application → Manifest: manifest parses, icons load, "Add to Home screen" / install prompt is available; Lighthouse PWA "installable" check passes.

- [ ] **Step 3: Manual — Android share flow**

On an Android phone with shoplit installed: open a product in Nykaa, Myntra, Amazon (incl. an `amzn.in` link), Flipkart, AJIO → Share → shoplit. Confirm `/add` opens with link + title (+ price when present) pre-filled, pick a cart, add, and verify the product appears on the cart (`/c/{slug}`) with the chosen cart remembered next time.

- [ ] **Step 4: Manual — logged-out return-to**

Sign out, then open an `/add?...` URL. Confirm Google sign-in runs and returns to `/add` with the shared params intact, then add succeeds.

- [ ] **Step 5: Manual — iOS / paste fallback**

On iPhone Safari (or desktop): open `/add`, paste a product link into the paste box, confirm fields populate, and add succeeds.

- [ ] **Step 6: Deploy**

```bash
# from repo root, after merge to main
SHOPLIT_DEPLOY_KEY="$HOME/.ssh/shop-lit.pem" ./deploy/redeploy.sh shoplit-web
SHOPLIT_DEPLOY_KEY="$HOME/.ssh/shop-lit.pem" ./deploy/redeploy.sh shoplit-api
```
(API redeploy is needed for the OAuth `next=` change.)

---

## Notes for the implementer

- **No backend changes beyond Task 1.** The add API already accepts explicit fields and detects the retailer from `original_url`.
- **Images degrade gracefully.** A blank `image_url` renders the existing gradient placeholder (CartCover / ProductCard). Photo upload is an explicit next phase, **out of scope here.**
- **Don't add caching to the service worker.** It exists only for installability; caching dynamic pages would serve stale auth/content.
- **Commit messages:** do not add `Co-Authored-By` or 🤖 trailers (project convention).
- **iOS** has no Web Share Target; the paste box on `/add` is its path. This is expected, not a bug.
