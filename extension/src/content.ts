// extension/src/content.ts
import type { Msg } from "./types";
import { extractProduct } from "./extract";
import { renderAddUI } from "./add-ui";

// Respond to the popup's extract request.
chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.type === "extract") {
    sendResponse({ type: "extracted", product: extractProduct(document) } as Msg);
  }
  return false;
});

const BTN_ID = "sl-add-btn";

// Inject an "Add to shoplit" button on product pages — inline right under the
// product title (most retailers use the first visible <h1>), falling back to a
// floating bottom-LEFT button if no title node is found (right side tends to
// collide with retailer chat widgets).
function injectButton() {
  if (document.getElementById(BTN_ID)) return;
  const product = extractProduct(document);
  if (!product) return; // not a product page

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.textContent = "＋ Add to shoplit";
  Object.assign(btn.style, {
    background: "#B5532A", color: "#fff", border: "0", borderRadius: "999px",
    padding: "9px 16px", font: "600 14px system-ui, sans-serif", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,.18)", zIndex: "2147483647",
  });
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel(product);
  };

  const title = visibleTitle();
  if (title) {
    btn.style.display = "inline-flex";
    btn.style.margin = "12px 0";
    title.insertAdjacentElement("afterend", btn);
  } else {
    Object.assign(btn.style, { position: "fixed", left: "18px", bottom: "18px" });
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
    boxShadow: "0 8px 28px rgba(0,0,0,.25)", font: "14px system-ui, sans-serif",
  });
  // Reuse the popup styles inline (the panel lives in the host page).
  injectPanelStyles();
  document.body.appendChild(panel);
  renderAddUI({
    root: panel,
    product,
    onConnectNeeded: () => window.open("https://shoplit.in/connect-extension", "_blank"),
  });
}

function injectPanelStyles() {
  if (document.getElementById("sl-styles")) return;
  const s = document.createElement("style");
  s.id = "sl-styles";
  s.textContent = `
    #sl-panel .sl-pad{padding:14px;display:flex;flex-direction:column;gap:8px}
    #sl-panel .sl-row{display:flex;gap:8px;align-items:center}
    #sl-panel .sl-thumb{width:44px;height:44px;object-fit:cover;border-radius:8px;background:#eee}
    #sl-panel .sl-input{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d9d2c5;border-radius:8px;font:inherit;background:#fff}
    #sl-panel .sl-btn{padding:9px;border:0;border-radius:999px;background:#1a1a1a;color:#fbf7f0;font-weight:600;cursor:pointer}
    #sl-panel .sl-msg{margin:0;font-size:12px;color:#6b6b6b}`;
  document.head.appendChild(s);
}

// Retailer SPAs swap content without full reloads; retry button injection.
injectButton();
const obs = new MutationObserver(() => injectButton());
obs.observe(document.documentElement, { childList: true, subtree: true });
