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
    // Two ways to connect: (1) "Open connect page" attempts an automatic
    // handoff (needs the published extension ID); (2) paste the code shown on
    // that page — works for unpacked/dev with no ID coordination.
    root.innerHTML = `<div class="sl-pad">
      <p>Connect the extension to your shoplit account.</p>
      <button id="sl-connect" class="sl-btn">Open connect page</button>
      <p class="sl-msg">Then paste the connection code shown there:</p>
      <input id="sl-code" class="sl-input" placeholder="Paste connection code" />
      <button id="sl-save-code" class="sl-btn">Connect</button>
      <p id="sl-msg" class="sl-msg"></p>
    </div>`;
    root.querySelector<HTMLButtonElement>("#sl-connect")!.onclick = onConnectNeeded;
    root.querySelector<HTMLButtonElement>("#sl-save-code")!.onclick = () => {
      const code = root.querySelector<HTMLInputElement>("#sl-code")!.value.trim();
      if (!code) return;
      chrome.storage.local.set({ token: code }, () => {
        // Re-render now that we have a token.
        renderAddUI({ root, product, onConnectNeeded });
      });
    };
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
      <input id="sl-url" class="sl-input" value="${escapeAttr(product.url)}" placeholder="Product / affiliate link"/>
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
          // Creator can paste their own affiliate/short link to override the
          // detected product URL — this becomes the redirect target.
          url: $<HTMLInputElement>("#sl-url").value.trim() || product.url,
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
