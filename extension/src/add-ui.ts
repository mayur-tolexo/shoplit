// extension/src/add-ui.ts
import type { Cart, ExtractedProduct } from "./types";
import { listCarts, addProduct } from "./api";

interface RenderOpts {
  root: HTMLElement;
  product: ExtractedProduct | null;
  onConnectNeeded: () => void;
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get("token", (v) => resolve((v.token as string) || null)),
  );
}

export async function renderAddUI({ root, product, onConnectNeeded }: RenderOpts) {
  const token = await getToken();
  if (!token) {
    root.innerHTML = `<div class="sl-pad"><p>Connect the extension to your shoplit account first.</p>
      <button id="sl-connect" class="sl-btn">Connect to shoplit</button></div>`;
    root.querySelector<HTMLButtonElement>("#sl-connect")!.onclick = onConnectNeeded;
    return;
  }
  if (!product) {
    root.innerHTML = `<div class="sl-pad"><p>Couldn't find a product on this page. Open a product page and try again.</p></div>`;
    return;
  }

  let carts: Cart[] = [];
  try {
    carts = await listCarts(token);
  } catch (e) {
    if ((e as Error).message === "unauthorized") return onConnectNeeded();
    root.innerHTML = `<div class="sl-pad"><p>Couldn't load your carts. Try again.</p></div>`;
    return;
  }

  const options = carts.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.title)}</option>`).join("");
  root.innerHTML = `
    <div class="sl-pad">
      <div class="sl-row">
        <img src="${escapeAttr(product.imageUrl)}" class="sl-thumb" alt=""/>
        <input id="sl-title" class="sl-input" value="${escapeAttr(product.title)}"/>
      </div>
      <input id="sl-price" class="sl-input" value="${escapeAttr(product.priceText)}" placeholder="₹ price"/>
      <input id="sl-image" class="sl-input" value="${escapeAttr(product.imageUrl)}" placeholder="Image URL"/>
      <select id="sl-cart" class="sl-input">${options}</select>
      <input id="sl-note" class="sl-input" placeholder="Note (optional)"/>
      <button id="sl-add" class="sl-btn">＋ Add to cart</button>
      <p id="sl-msg" class="sl-msg"></p>
    </div>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  $("#sl-add").onclick = async () => {
    const btn = $<HTMLButtonElement>("#sl-add");
    btn.disabled = true;
    try {
      await addProduct(
        token,
        $<HTMLSelectElement>("#sl-cart").value,
        {
          ...product,
          title: $<HTMLInputElement>("#sl-title").value.trim(),
          priceText: $<HTMLInputElement>("#sl-price").value.trim(),
          imageUrl: $<HTMLInputElement>("#sl-image").value.trim(),
        },
        $<HTMLInputElement>("#sl-note").value.trim(),
      );
      $("#sl-msg").textContent = "Added ✓";
    } catch (e) {
      if ((e as Error).message === "unauthorized") return onConnectNeeded();
      $("#sl-msg").textContent = "Couldn't add — try again.";
      btn.disabled = false;
    }
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
