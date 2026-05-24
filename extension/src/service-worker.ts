// extension/src/service-worker.ts
// Receives the token from the shoplit.in connect page (externally_connectable)
// and stores it. Exposes token get/set via chrome.storage for popup + content.

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "shoplit-token" && typeof msg.token === "string") {
    chrome.storage.local.set({ token: msg.token }, () => sendResponse({ ok: true }));
    return true; // async response
  }
  sendResponse({ ok: false });
  return false;
});
