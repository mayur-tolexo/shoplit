// extension/src/popup.ts
import type { ExtractedProduct, Msg } from "./types";
import { renderAddUI } from "./add-ui";
import { retailerFromUrl } from "./retailer";

const root = document.getElementById("root")!;

function openConnect() {
  chrome.tabs.create({ url: "https://shoplit.in/connect-extension" });
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let product: ExtractedProduct | null = null;
  if (tab?.id !== undefined) {
    try {
      const resp = (await chrome.tabs.sendMessage(tab.id, { type: "extract" } as Msg)) as Msg;
      if (resp?.type === "extracted") product = resp.product;
    } catch {
      product = null; // content script not present on this page
    }
  }
  if (!product && tab?.url) {
    product = { title: "", imageUrl: "", priceText: "", url: tab.url, retailer: retailerFromUrl(tab.url) };
  }
  await renderAddUI({ root, product, onConnectNeeded: openConnect, onClose: () => window.close() });
}

main();
