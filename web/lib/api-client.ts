// web/lib/api-client.ts
// HTTP client to shoplit-api. Talks to the backend DIRECTLY (absolute URL)
// in both browser and server contexts — no Next.js rewrite proxy in the
// path, so there's no ambiguity about whether cookies survive the hop.
//
// Browser: cross-origin fetch to API_BASE with credentials:"include". The
// backend's CORS middleware allows the frontend origin + credentials, and
// because :3000 and :8080 are the same *site*, the SameSite=Lax session
// cookie is sent automatically.
//
// Server (Server Components): fetch() runs in Node, no browser cookie jar —
// callers pass `{ cookie }` from cookies().toString() (next/headers) and we
// forward it as a Cookie header. We DON'T import next/headers here because
// this file is also bundled into client components.
//
// API_BASE comes from NEXT_PUBLIC_API_BASE_URL (available in both server and
// client bundles); defaults to http://localhost:8080.

import type { Cart, Creator, OGResult, Product, User } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type AuthOpts = { cookie?: string };

function resolveURL(path: string): string {
  return API_BASE + path;
}

async function jsonFetch<T>(path: string, init?: RequestInit & AuthOpts): Promise<T> {
  const { cookie, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  if (cookie && !headers.has("Cookie")) {
    headers.set("Cookie", cookie);
  }
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(resolveURL(path), {
    credentials: "include",
    cache: "no-store",
    ...rest,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, `${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function getCurrentUser(opts?: AuthOpts): Promise<User> {
  return jsonFetch<User>("/api/v1/me", opts);
}

export async function listMyCoverImages(opts?: AuthOpts): Promise<string[]> {
  const r = await jsonFetch<{ covers: string[] }>("/api/v1/cover-images", opts);
  return r.covers ?? [];
}

export async function listMyCarts(opts?: AuthOpts): Promise<Cart[]> {
  return jsonFetch<Cart[]>("/api/v1/carts", opts);
}

export async function getCartBySlug(slug: string, opts?: AuthOpts): Promise<Cart | null> {
  try {
    return await jsonFetch<Cart>(`/api/public/carts/${slug}`, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// ─── DISCOVER / FOLLOW CREATORS ───────────────────────────────────────────

type PageOpts = { limit?: number; offset?: number };
// `q` is search-only — supported by listCreators (see below); pageQuery
// encodes it alongside limit/offset. URLSearchParams handles percent-encoding
// of spaces/special chars.
type CreatorListOpts = PageOpts & { q?: string };

function pageQuery(page?: CreatorListOpts): string {
  const sp = new URLSearchParams();
  if (page?.limit !== undefined) sp.set("limit", String(page.limit));
  if (page?.offset !== undefined) sp.set("offset", String(page.offset));
  if (page?.q !== undefined) sp.set("q", page.q);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

// Public discover list. `isFollowing` reflects the viewer when a session
// cookie is forwarded; false otherwise. A page shorter than `limit` is the end.
// Pass `{ q }` to search by handle/display name; an empty/absent `q` returns
// the popularity-ranked list (the backend trims+ignores blank `q`).
export async function listCreators(opts?: AuthOpts, page?: CreatorListOpts): Promise<Creator[]> {
  return jsonFetch<Creator[]>(`/api/public/creators${pageQuery(page)}`, opts);
}

// Public creator profile. Returns null on 404 (unknown/banned handle), mirroring
// getCartBySlug so pages can call notFound() cleanly.
export async function getCreatorProfile(
  handle: string,
  opts?: AuthOpts,
): Promise<{ creator: Creator; carts: Cart[] } | null> {
  try {
    return await jsonFetch<{ creator: Creator; carts: Cart[] }>(
      `/api/public/creators/${handle}`,
      opts,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function followCreator(
  handle: string,
): Promise<{ following: boolean; followerCount: number }> {
  return jsonFetch(`/api/v1/creators/${handle}/follow`, { method: "POST" });
}

export async function unfollowCreator(
  handle: string,
): Promise<{ following: boolean; followerCount: number }> {
  return jsonFetch(`/api/v1/creators/${handle}/follow`, { method: "DELETE" });
}

// Authed "Following" feed: public carts of creators the viewer follows, newest
// first. Requires a session (forwarded cookie on the server).
export async function getFollowingFeed(opts?: AuthOpts, page?: PageOpts): Promise<Cart[]> {
  return jsonFetch<Cart[]>(`/api/v1/following${pageQuery(page)}`, opts);
}

export async function getCartById(id: string, opts?: AuthOpts): Promise<Cart | null> {
  try {
    return await jsonFetch<Cart>(`/api/v1/carts/${id}`, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function createCart(title: string): Promise<Cart> {
  return jsonFetch<Cart>("/api/v1/carts", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateCart(id: string, patch: Partial<Cart>): Promise<Cart> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.bio !== undefined) body.description = patch.bio;
  if (patch.coverImageUrl !== undefined) body.cover_image_url = patch.coverImageUrl;
  if (patch.visibility !== undefined) body.visibility = patch.visibility;
  return jsonFetch<Cart>(`/api/v1/carts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function addProductToCart(cartId: string, draft: Omit<Product, "id">): Promise<Cart> {
  await jsonFetch(`/api/v1/carts/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({
      title: draft.title,
      image_url: draft.imageUrl,
      price_text: draft.priceText,
      original_url: draft.originalUrl,
      retailer: draft.retailer,
      note: draft.note,
    }),
  });
  const cart = await getCartById(cartId);
  if (!cart) throw new ApiError(404, `cart ${cartId} not found after item add`);
  return cart;
}

export async function updateProductInCart(
  cartId: string,
  productId: string,
  patch: Pick<Product, "title" | "priceText" | "imageUrl" | "note">,
): Promise<Cart> {
  await jsonFetch(`/api/v1/carts/${cartId}/items/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: patch.title,
      price_text: patch.priceText,
      image_url: patch.imageUrl,
      note: patch.note ?? "",
    }),
  });
  const cart = await getCartById(cartId);
  if (!cart) throw new ApiError(404, `cart ${cartId} not found after item update`);
  return cart;
}

export async function removeProductFromCart(cartId: string, productId: string): Promise<Cart> {
  await jsonFetch(`/api/v1/carts/${cartId}/items/${productId}`, { method: "DELETE" });
  const cart = await getCartById(cartId);
  if (!cart) throw new ApiError(404, `cart ${cartId} not found`);
  return cart;
}

export async function deleteCart(cartId: string): Promise<void> {
  await jsonFetch(`/api/v1/carts/${cartId}`, { method: "DELETE" });
}

export async function reorderProducts(cartId: string, productIds: string[]): Promise<Cart> {
  await jsonFetch(`/api/v1/carts/${cartId}/items/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ item_ids: productIds.map((id) => Number(id)) }),
  });
  const cart = await getCartById(cartId);
  if (!cart) throw new ApiError(404, `cart ${cartId} not found`);
  return cart;
}

export async function fetchOG(url: string): Promise<OGResult> {
  const r = await jsonFetch<{
    ok: boolean;
    canonical_url?: string;
    title?: string;
    image_url?: string;
    price_text?: string;
    retailer: string;
    reason?: string;
  }>(`/api/v1/og-fetch?url=${encodeURIComponent(url)}`);
  return {
    ok: r.ok,
    canonicalUrl: r.canonical_url,
    title: r.title,
    imageUrl: r.image_url,
    priceText: r.price_text,
    retailer: r.retailer as OGResult["retailer"],
    reason: r.reason,
  };
}

export async function mintExtensionToken(): Promise<string> {
  const r = await jsonFetch<{ token: string }>("/api/v1/extension/token", {
    method: "POST",
  });
  return r.token;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
}

// Upload a product/cover photo (multipart). Returns an absolute image URL that
// renders in both dev (api origin) and prod (same origin via Caddy). Let the
// browser set the multipart Content-Type boundary — don't set it manually.
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/uploads`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const data = (await res.json()) as { url: string };
  // S3 returns an absolute URL; the dev disk store returns a relative path.
  return /^https?:\/\//.test(data.url) ? data.url : API_BASE + data.url;
}

export async function submitFeedback(input: { message: string; email?: string; name?: string; page?: string }): Promise<void> {
  await jsonFetch("/api/public/feedback", { method: "POST", body: JSON.stringify(input) });
}

export interface FeedbackItem { id: string; message: string; email: string; name: string; page: string; createdAt: string }
export async function listFeedback(opts?: { cookie?: string }): Promise<FeedbackItem[]> {
  return jsonFetch<FeedbackItem[]>("/api/v1/feedback", opts);
}

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
