// extension/src/popup.ts
import type { ExtractedProduct, Msg } from "./types";
import { renderAddUI } from "./add-ui";

const root = document.getElementById("root")!;

function openConnect() {
  chrome.tabs.create({ url: "https://shoplit.in/connect-extension" });
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function main() {
  const tabId = await activeTabId();
  let product: ExtractedProduct | null = null;
  if (tabId !== undefined) {
    try {
      const resp = (await chrome.tabs.sendMessage(tabId, { type: "extract" } as Msg)) as Msg;
      if (resp?.type === "extracted") product = resp.product;
    } catch {
      product = null; // content script not present on this page
    }
  }
  await renderAddUI({ root, product, onConnectNeeded: openConnect });
}

main();
