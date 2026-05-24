# shoplit extension (dev)

## Dev load

1. `npm install && npm run build`
2. Chrome → chrome://extensions → enable Developer mode → "Load unpacked" → select `extension/dist`.
3. Copy the extension ID Chrome shows; set `NEXT_PUBLIC_EXTENSION_ID` for the web app (and rebuild the connect page) so the auto-handoff works. Without it, the copy-paste fallback is used.
4. Sign in at https://shoplit.in, open https://shoplit.in/connect-extension to connect.
5. Visit a product page on Nykaa/Myntra/Amazon/Flipkart/AJIO → click the toolbar icon or the "＋ shoplit" button → pick a cart → Add.

## Connect flow

- Navigating to `/connect-extension` while signed in mints a Bearer token via `POST /api/v1/extension/token`.
- If the extension is detected (via `externally_connectable`), the token is handed off directly using `chrome.runtime.sendMessage` → the service worker stores it in `chrome.storage.local`.
- If the extension is not detected (e.g., first load before granting permission, or a version mismatch), a copy-paste fallback is shown: copy the token and paste it into the extension popup manually.

## Manual E2E checklist

Record results in the PR description. For each retailer (Nykaa, Myntra, Amazon.in, Flipkart, AJIO):

- [ ] Open a product page; confirm the "＋ shoplit" floating button appears within 2 seconds of page load.
- [ ] Click the toolbar icon; confirm the popup shows the correct title, image, and price (populated from JSON-LD or OG tags).
- [ ] Select a cart from the dropdown and click "＋ Add to cart"; confirm the request succeeds (no error message).
- [ ] Open the cart's `/c/{slug}` page and confirm the product appears with title, image, and price.
- [ ] Confirm the product's "Shop" link redirects to the original product URL on the retailer site.

Expected: title + image populate on at least JSON-LD retailers (Nykaa, Amazon); price where present. Where a field is missing, the inline edit lets the user fix it before adding.

## Build and test

```bash
cd extension
npm install
npm run build    # esbuild → dist/
npx vitest run  # retailer classification + product extraction tests
```
