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

// Inject an "Add to shoplit" button ONLY on single-product pages — placed on
// its own line right under the product title. A full-width wrapper guarantees
// it sits on its own row even inside the retailer's flex/grid title block.
function injectButton() {
  if (document.getElementById(BTN_ID)) return;
  if (!isProductPage(document)) return; // skip category/listing/search pages
  const product = extractProduct(document);
  if (!product) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "＋ Add to shoplit";
  Object.assign(btn.style, {
    display: "inline-flex", alignItems: "center", gap: "6px",
    background: "#B5532A", color: "#fff", border: "0", borderRadius: "999px",
    padding: "9px 16px", font: "600 14px system-ui, sans-serif", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,.18)",
  });
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
    onAdded: () => panel.remove(),
  });
}

// Retailer SPAs swap content without full reloads; retry button injection.
injectButton();
const obs = new MutationObserver(() => injectButton());
obs.observe(document.documentElement, { childList: true, subtree: true });
