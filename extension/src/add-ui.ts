// extension/src/add-ui.ts
// Framework-free add UI shared by the toolbar popup and the injected in-page
// panel. Renders into the given root; owns its own (injected) styles so popup
// and panel look identical. Every view has a header with a close (✕) button.
import type { Cart, ExtractedProduct } from "./types";
import { listCarts, addProduct } from "./api";

interface RenderOpts {
  root: HTMLElement;
  product: ExtractedProduct | null;
  onConnectNeeded: () => void;
  /** Close the surface (popup → window.close; panel → remove). */
  onClose?: () => void;
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
.sl-bar { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid #ece5d8; background:#fbf7f0; border-radius:12px 12px 0 0; }
.sl-logo { display:inline-flex; align-items:center; gap:7px; font-weight:700; font-size:14px; color:#1a1a1a; letter-spacing:-.01em; }
.sl-logo svg { width:18px; height:18px; }
.sl-x { background:none; border:0; font-size:17px; line-height:1; color:#8a8a8a; cursor:pointer; padding:3px 7px; border-radius:7px; transition:background .15s, color .15s; }
.sl-x:hover { background:rgba(0,0,0,.06); color:#1a1a1a; }
.sl-pad { padding:14px; display:flex; flex-direction:column; gap:10px; }
.sl-head { display:flex; gap:11px; align-items:flex-start; }
.sl-thumb { width:56px; height:56px; object-fit:cover; border-radius:10px; background:#ece7de; flex:none; }
.sl-input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #d9d2c5; border-radius:9px; font:inherit; background:#fff; transition:border-color .15s, box-shadow .15s; }
.sl-input:focus { outline:none; border-color:#B5532A; box-shadow:0 0 0 3px rgba(181,83,42,.16); }
.sl-title-in { font-weight:600; }
.sl-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:10px; border:0; border-radius:999px; background:#1a1a1a; color:#fbf7f0; font:inherit; font-weight:600; cursor:pointer; transition:transform .12s ease, opacity .15s, box-shadow .2s; }
.sl-btn:hover { transform:translateY(-1px); }
.sl-btn:active { transform:translateY(0); }
.sl-btn[disabled] { opacity:.75; cursor:default; transform:none; }
.sl-btn-accent { background:linear-gradient(135deg,#C2410C,#9A3412); box-shadow:0 3px 12px rgba(154,52,18,.3); }
.sl-spinner { width:15px; height:15px; border:2px solid rgba(255,255,255,.45); border-top-color:#fff; border-radius:50%; animation:sl-spin .7s linear infinite; }
.sl-msg { margin:0; font-size:12px; color:#6b6b6b; min-height:1em; }
.sl-success { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px 18px; text-align:center; }
.sl-check { width:56px; height:56px; border-radius:50%; background:#1f9d55; color:#fff; display:grid; place-items:center; font-size:30px; line-height:1; animation:sl-pop .42s cubic-bezier(.2,.8,.3,1.25); }
.sl-success strong { font-size:16px; }
.sl-sub { color:#6b6b6b; font-size:13px; animation:sl-fade .3s .15s both; }
`;

// shoplit bag mark, inline so it works in popup + content script.
const MARK = `<svg viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#B5532A"/><path d="M24 28 a8 8 0 0 1 16 0" fill="none" stroke="#F4EBDD" stroke-width="3.6" stroke-linecap="round"/><path d="M18.5 27 h27 l2 19.2 a4.5 4.5 0 0 1-4.5 5 H21 a4.5 4.5 0 0 1-4.5-5 z" fill="#F4EBDD"/></svg>`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get("token", (v) => resolve((v.token as string) || null)),
  );
}

export async function renderAddUI(opts: RenderOpts) {
  const { root, product, onConnectNeeded, onClose, onAdded } = opts;
  ensureStyles();

  // Wrap inner HTML in the shell (header + close) and wire the ✕.
  const paint = (inner: string) => {
    root.innerHTML =
      `<div class="sl-root"><div class="sl-bar"><span class="sl-logo">${MARK}shoplit</span>` +
      (onClose ? `<button class="sl-x" aria-label="Close">✕</button>` : ``) +
      `</div>${inner}</div>`;
    if (onClose) root.querySelector<HTMLButtonElement>(".sl-x")!.onclick = onClose;
  };
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

  const token = await getToken();

  if (!token) {
    paint(`<div class="sl-pad">
      <p style="margin:0">Connect the extension to your shoplit account.</p>
      <button id="sl-connect" class="sl-btn sl-btn-accent">Connect shoplit account</button>
      <p class="sl-msg">Already opened the connect page? Paste the code:</p>
      <input id="sl-code" class="sl-input" placeholder="Paste connection code" />
      <button id="sl-save-code" class="sl-btn">Connect</button>
    </div>`);
    $("#sl-connect").onclick = onConnectNeeded;
    $("#sl-save-code").onclick = () => {
      const code = $<HTMLInputElement>("#sl-code").value.trim();
      if (!code) return;
      chrome.storage.local.set({ token: code }, () => renderAddUI(opts));
    };
    return;
  }

  if (!product) {
    paint(`<div class="sl-pad"><p style="margin:0">Couldn't find a product on this page. Open a product page and try again.</p></div>`);
    return;
  }

  let carts: Cart[] = [];
  try {
    carts = await listCarts();
  } catch (e) {
    if ((e as Error).message === "unauthorized") return onConnectNeeded();
    paint(`<div class="sl-pad"><p style="margin:0">Couldn't load your carts. Try again.</p></div>`);
    return;
  }

  const options = carts.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.title)}</option>`).join("");
  paint(`<div class="sl-pad">
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
    </div>`);

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
      paint(`<div class="sl-success">
        <div class="sl-check">✓</div>
        <div><strong>Added!</strong></div>
        <div class="sl-sub">Saved to ${escapeHtml(cartName)}</div>
      </div>`);
      if (onAdded) setTimeout(onAdded, 1400);
    } catch (e) {
      if ((e as Error).message === "unauthorized") return onConnectNeeded();
      btn.disabled = false;
      btn.textContent = "＋ Add to cart";
      $("#sl-msg").textContent = "Couldn't add — try again.";
    }
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
