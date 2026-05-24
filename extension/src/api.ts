// extension/src/api.ts
// API access goes through the service worker, NOT a direct fetch. A content
// script's fetch to shoplit.in is cross-origin from the page's origin and is
// blocked by CORS; the service worker holds host_permissions for shoplit.in
// and can call it freely. Popup and injected panel both route through here.
import type { Cart, ExtractedProduct } from "./types";

function send<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp: { ok: boolean; data?: T; error?: string }) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp?.ok) return reject(new Error(resp?.error || "error"));
      resolve(resp.data as T);
    });
  });
}

export async function listCarts(): Promise<Cart[]> {
  return send<Cart[]>({ type: "listCarts" });
}

export async function addProduct(cartId: string, p: ExtractedProduct, note: string): Promise<void> {
  await send({
    type: "addProduct",
    cartId,
    body: {
      title: p.title,
      image_url: p.imageUrl,
      price_text: p.priceText,
      original_url: p.url,
      retailer: p.retailer,
      note,
    },
  });
}
