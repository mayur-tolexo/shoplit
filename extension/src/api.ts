// extension/src/api.ts
import type { Cart, ExtractedProduct } from "./types";

const BASE = "https://shoplit.in";

async function authed<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listCarts(token: string): Promise<Cart[]> {
  const carts = await authed<{ id: string; title: string }[]>(token, "/api/v1/carts");
  return carts.map((c) => ({ id: c.id, title: c.title }));
}

export async function addProduct(
  token: string,
  cartId: string,
  p: ExtractedProduct,
  note: string,
): Promise<void> {
  await authed<unknown>(token, `/api/v1/carts/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({
      title: p.title,
      image_url: p.imageUrl,
      price_text: p.priceText,
      original_url: p.url,
      retailer: p.retailer,
      note,
    }),
  });
}
