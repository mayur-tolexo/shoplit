// extension/src/service-worker.ts
// The privileged context: holds host_permissions for shoplit.in, so it makes
// the cross-origin API calls (content scripts can't — CORS) and receives the
// token from the connect page via externally_connectable.

const BASE = "https://shoplit.in";

async function getToken(): Promise<string | null> {
  const v = await chrome.storage.local.get("token");
  return (v.token as string) || null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("unauthorized");
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

// API calls proxied from the popup + injected panel.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "listCarts") {
        const carts = await api<{ id: string; title: string }[]>("/api/v1/carts");
        sendResponse({ ok: true, data: carts.map((c) => ({ id: c.id, title: c.title })) });
      } else if (msg?.type === "addProduct") {
        await api(`/api/v1/carts/${msg.cartId}/items`, {
          method: "POST",
          body: JSON.stringify(msg.body),
        });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // async sendResponse
});

// Token handoff from the shoplit.in connect page.
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "shoplit-token" && typeof msg.token === "string") {
    chrome.storage.local.set({ token: msg.token }, () => sendResponse({ ok: true }));
    return true; // async response
  }
  sendResponse({ ok: false });
  return false;
});
