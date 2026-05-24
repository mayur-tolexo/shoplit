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

// Inject a floating "+ shoplit" button when the page looks like a product.
function injectButton() {
  if (document.getElementById("sl-fab")) return;
  const product = extractProduct(document);
  if (!product) return; // not a product page

  const fab = document.createElement("button");
  fab.id = "sl-fab";
  fab.textContent = "＋ shoplit";
  Object.assign(fab.style, {
    position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647",
    background: "#B5532A", color: "#fff", border: "0", borderRadius: "999px",
    padding: "10px 16px", font: "600 14px system-ui, sans-serif", cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,.25)",
  });
  fab.onclick = () => togglePanel(product);
  document.body.appendChild(fab);
}

function togglePanel(product: ReturnType<typeof extractProduct>) {
  const existing = document.getElementById("sl-panel");
  if (existing) {
    existing.remove();
    return;
  }
  const panel = document.createElement("div");
  panel.id = "sl-panel";
  Object.assign(panel.style, {
    position: "fixed", right: "18px", bottom: "64px", zIndex: "2147483647",
    width: "320px", background: "#fbf7f0", color: "#1a1a1a",
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
