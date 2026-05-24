// extension/src/content.ts
import type { Msg } from "./types";
import { extractProduct, isProductPage } from "./extract";
import { renderAddUI } from "./add-ui";

// Respond to the popup's extract request.
chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.type === "extract") {
    sendResponse({ type: "extracted", product: extractProduct(document) } as Msg);
  }
  return false;
});

const BTN_ID = "sl-add-btn";
const BTN_STYLE_ID = "sl-btn-styles";

// White bag mark for the on-page button (button background is terracotta).
const BTN_MARK = `<svg viewBox="0 0 64 64" width="17" height="17" aria-hidden style="flex:none"><path d="M24 28 a8 8 0 0 1 16 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M18.5 27 h27 l2 19.2 a4.5 4.5 0 0 1-4.5 5 H21 a4.5 4.5 0 0 1-4.5-5 z" fill="#fff"/></svg>`;

function ensureButtonStyles() {
  if (document.getElementById(BTN_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = BTN_STYLE_ID;
  s.textContent = `
    @keyframes sl-btn-in { from{opacity:0;transform:translateY(6px) scale(.96)} to{opacity:1;transform:none} }
    .sl-fab-btn { display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg,#C2410C,#9A3412); color:#fff; border:0; border-radius:999px; padding:10px 18px; font:600 14px/1 system-ui,-apple-system,sans-serif; cursor:pointer; box-shadow:0 4px 14px rgba(154,52,18,.35); transition:transform .16s ease, box-shadow .16s ease; animation:sl-btn-in .26s ease both; }
    .sl-fab-btn:hover { transform:translateY(-2px); box-shadow:0 9px 24px rgba(154,52,18,.45); }
    .sl-fab-btn:active { transform:translateY(0); }`;
  (document.head || document.documentElement).appendChild(s);
}

// Inject an "Add to shoplit" button ONLY on single-product pages — placed on
// its own line right under the product title. A full-width wrapper guarantees
// it sits on its own row even inside the retailer's flex/grid title block.
function injectButton() {
  if (document.getElementById(BTN_ID)) return;
  if (!isProductPage(document)) return; // skip category/listing/search pages
  const product = extractProduct(document);
  if (!product) return;

  ensureButtonStyles();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sl-fab-btn";
  btn.innerHTML = `${BTN_MARK}<span>Add to shoplit</span>`;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel(product);
  };

  const title = visibleTitle();
  if (title) {
    const wrap = document.createElement("div");
    wrap.id = BTN_ID;
    wrap.style.cssText = "width:100%;margin:12px 0;display:block;";
    wrap.appendChild(btn);
    title.insertAdjacentElement("afterend", wrap);
  } else {
    btn.id = BTN_ID;
    Object.assign(btn.style, { position: "fixed", left: "18px", bottom: "18px", zIndex: "2147483647" });
    document.body.appendChild(btn);
  }
}

// The product title is almost always the first on-screen <h1>.
function visibleTitle(): HTMLElement | null {
  const heads = Array.from(document.querySelectorAll<HTMLElement>("h1"));
  return heads.find((h) => h.offsetParent !== null && (h.textContent ?? "").trim().length > 3) ?? null;
}

function togglePanel(product: ReturnType<typeof extractProduct>) {
  const existing = document.getElementById("sl-panel");
  if (existing) {
    existing.remove();
    return;
  }
  const panel = document.createElement("div");
  panel.id = "sl-panel";
  // Top-right, below typical sticky headers — clears bottom-corner chat widgets.
  Object.assign(panel.style, {
    position: "fixed", right: "18px", top: "84px", zIndex: "2147483647",
    width: "320px", maxHeight: "80vh", overflow: "auto",
    background: "#fbf7f0", color: "#1a1a1a",
    border: "1px solid #d9d2c5", borderRadius: "12px",
    boxShadow: "0 8px 28px rgba(0,0,0,.25)",
  });
  document.body.appendChild(panel);
  renderAddUI({
    root: panel,
    product,
    onConnectNeeded: () => window.open("https://shoplit.in/connect-extension", "_blank"),
    onClose: () => panel.remove(),
    onAdded: () => panel.remove(),
  });
}

// Retailer SPAs swap content without full reloads; retry button injection.
injectButton();
const obs = new MutationObserver(() => injectButton());
obs.observe(document.documentElement, { childList: true, subtree: true });
