// extension/src/add-ui.ts
// Framework-free add UI shared by the toolbar popup and the injected in-page
// panel. Renders into the given root; owns its own (injected) styles so popup
// and panel look identical.
import type { Cart, ExtractedProduct } from "./types";
import { listCarts, addProduct } from "./api";

interface RenderOpts {
  root: HTMLElement;
  product: ExtractedProduct | null;
  onConnectNeeded: () => void;
  /** Called after a successful add (e.g. to close the injected panel). */
  onAdded?: () => void;
}

const STYLE_ID = "sl-styles";
const CSS = `
@keyframes sl-in { from { opacity:0; transform: translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes sl-spin { to { transform: rotate(360deg); } }
@keyframes sl-pop { 0%{transform:scale(0);} 55%{transform:scale(1.18);} 100%{transform:scale(1);} }
@keyframes sl-fade { from { opacity:0; } to { opacity:1; } }
.sl-root { animation: sl-in .24s cubic-bezier(.2,.7,.3,1); font: 14px/1.45 system-ui, -apple-system, sans-serif; color:#1a1a1a; }
.sl-pad { padding:16px; display:flex; flex-direction:column; gap:10px; }
.sl-head { display:flex; gap:11px; align-items:flex-start; }
.sl-thumb { width:56px; height:56px; object-fit:cover; border-radius:10px; background:#ece7de; flex:none; }
.sl-input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #d9d2c5; border-radius:9px; font:inherit; background:#fff; transition:border-color .15s, box-shadow .15s; }
.sl-input:focus { outline:none; border-color:#B5532A; box-shadow:0 0 0 3px rgba(181,83,42,.16); }
.sl-title-in { font-weight:600; }
.sl-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:10px; border:0; border-radius:999px; background:#1a1a1a; color:#fbf7f0; font:inherit; font-weight:600; cursor:pointer; transition:transform .12s ease, opacity .15s, background .2s; }
.sl-btn:hover { transform:translateY(-1px); }
.sl-btn:active { transform:translateY(0); }
.sl-btn[disabled] { opacity:.75; cursor:default; transform:none; }
.sl-btn-accent { background:#B5532A; }
.sl-link { background:none; border:0; color:#B5532A; font:inherit; font-weight:600; cursor:pointer; padding:4px; }
.sl-spinner { width:15px; height:15px; border:2px solid rgba(255,255,255,.45); border-top-color:#fff; border-radius:50%; animation:sl-spin .7s linear infinite; }
.sl-msg { margin:0; font-size:12px; color:#6b6b6b; min-height:1em; }
.sl-success { display:flex; flex-direction:column; align-items:center; gap:10px; padding:28px 18px; text-align:center; }
.sl-check { width:56px; height:56px; border-radius:50%; background:#1f9d55; color:#fff; display:grid; place-items:center; font-size:30px; line-height:1; animation:sl-pop .42s cubic-bezier(.2,.8,.3,1.25); }
.sl-success strong { font-size:16px; }
.sl-sub { color:#6b6b6b; font-size:13px; animation:sl-fade .3s .15s both; }
`;

function ensureStyles() {
  const doc = document;
  if (doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(s);
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get("token", (v) => resolve((v.token as string) || null)),
  );
}

export async function renderAddUI({ root, product, onConnectNeeded, onAdded }: RenderOpts) {
  ensureStyles();
  const token = await getToken();

  if (!token) {
    root.innerHTML = `<div class="sl-root"><div class="sl-pad">
      <p style="margin:0">Connect the extension to your shoplit account.</p>
      <button id="sl-connect" class="sl-btn sl-btn-accent">Connect shoplit account</button>
      <p class="sl-msg">Already opened the connect page? Paste the code:</p>
      <input id="sl-code" class="sl-input" placeholder="Paste connection code" />
      <button id="sl-save-code" class="sl-btn">Connect</button>
    </div></div>`;
    root.querySelector<HTMLButtonElement>("#sl-connect")!.onclick = onConnectNeeded;
    root.querySelector<HTMLButtonElement>("#sl-save-code")!.onclick = () => {
      const code = root.querySelector<HTMLInputElement>("#sl-code")!.value.trim();
      if (!code) return;
      chrome.storage.local.set({ token: code }, () => renderAddUI({ root, product, onConnectNeeded, onAdded }));
    };
    return;
  }

  if (!product) {
    root.innerHTML = `<div class="sl-root"><div class="sl-pad">
      <p style="margin:0">Couldn't find a product on this page. Open a product page and try again.</p>
    </div></div>`;
    return;
  }

  let carts: Cart[] = [];
  try {
    carts = await listCarts();
  } catch (e) {
    if ((e as Error).message === "unauthorized") return onConnectNeeded();
    root.innerHTML = `<div class="sl-root"><div class="sl-pad"><p style="margin:0">Couldn't load your carts. Try again.</p></div></div>`;
    return;
  }

  const options = carts.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.title)}</option>`).join("");
  root.innerHTML = `
    <div class="sl-root"><div class="sl-pad">
      <div class="sl-head">
        <img src="${escapeAttr(product.imageUrl)}" class="sl-thumb" alt=""/>
        <input id="sl-title" class="sl-input sl-title-in" value="${escapeAttr(product.title)}"/>
      </div>
      <input id="sl-price" class="sl-input" value="${escapeAttr(product.priceText)}" placeholder="₹ price"/>
      <input id="sl-image" class="sl-input" value="${escapeAttr(product.imageUrl)}" placeholder="Image URL"/>
      <input id="sl-url" class="sl-input" value="${escapeAttr(product.url)}" placeholder="Product / affiliate link"/>
      <select id="sl-cart" class="sl-input">${options}</select>
      <input id="sl-note" class="sl-input" placeholder="Note (optional)"/>
      <button id="sl-add" class="sl-btn sl-btn-accent">＋ Add to cart</button>
      <p id="sl-msg" class="sl-msg"></p>
    </div></div>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  $("#sl-add").onclick = async () => {
    const btn = $<HTMLButtonElement>("#sl-add");
    btn.disabled = true;
    btn.innerHTML = `<span class="sl-spinner"></span>Adding…`;
    const cartSel = $<HTMLSelectElement>("#sl-cart");
    const cartName = cartSel.options[cartSel.selectedIndex]?.text ?? "your cart";
    try {
      await addProduct(
        cartSel.value,
        {
          ...product,
          title: $<HTMLInputElement>("#sl-title").value.trim(),
          priceText: $<HTMLInputElement>("#sl-price").value.trim(),
          imageUrl: $<HTMLInputElement>("#sl-image").value.trim(),
          // Creator can paste their own affiliate/short link → redirect target.
          url: $<HTMLInputElement>("#sl-url").value.trim() || product.url,
        },
        $<HTMLInputElement>("#sl-note").value.trim(),
      );
      showSuccess(root, cartName, onAdded);
    } catch (e) {
      if ((e as Error).message === "unauthorized") return onConnectNeeded();
      btn.disabled = false;
      btn.textContent = "＋ Add to cart";
      $("#sl-msg").textContent = "Couldn't add — try again.";
    }
  };
}

function showSuccess(root: HTMLElement, cartName: string, onAdded?: () => void) {
  root.innerHTML = `<div class="sl-root"><div class="sl-success">
    <div class="sl-check">✓</div>
    <div><strong>Added!</strong></div>
    <div class="sl-sub">Saved to ${escapeHtml(cartName)}</div>
  </div></div>`;
  if (onAdded) setTimeout(onAdded, 1400);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
