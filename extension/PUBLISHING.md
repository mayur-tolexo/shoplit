# Publishing the shoplit extension to the Chrome Web Store

Everything you upload is in this folder. The current packaged file is
**`shoplit-extension-0.1.1.zip`** (rebuild with `npm run build` then re-zip —
see bottom). Below is the exact copy to paste into the Developer Dashboard.

> ## ⚠️ Resubmission (v0.1.1) — what changed and why
> Version **0.1.0** was rejected under **Use of Permissions** (ref *Purple
> Potassium*): it requested **`scripting`** but never called `chrome.scripting`.
>
> **Fix in v0.1.1:** permissions narrowed to **`["storage"]`** only.
> - Removed **`scripting`** — the content script is injected statically via the
>   manifest `content_scripts` key, which needs no `scripting` permission.
> - Removed **`activeTab`** — the popup's `tabs.sendMessage` to the content
>   script is already covered by the retailer `host_permissions`, and
>   `tabs.create` / `tabs.query` (we only read `tab.id`) need no permission. So
>   `activeTab` was unused too; removed pre-emptively to keep permissions minimal.
>
> No functionality changed. When you resubmit, in the dashboard's reviewer-notes
> field you can state: *"Removed the unused `scripting` permission (and the
> redundant `activeTab`); the extension now requests only `storage`."*

## 0. One-time setup
1. Go to **https://chrome.google.com/webstore/devconsole**.
2. Sign in with the Google account you want to own the listing.
3. Pay the **one-time $5 registration fee** and complete the account/identity
   verification (Chrome requires a verified publisher).

## 1. Create / update the item
- **First submission:** Dashboard → **Add new item** → upload `shoplit-extension-0.1.1.zip`.
- **Resubmitting the rejected item:** open the existing item → **Package** → **Upload
  new package** → choose `shoplit-extension-0.1.1.zip` (the version bump to 0.1.1
  is required — Chrome rejects re-uploads with the same version).

It parses the manifest; the listing fields below are unchanged from before.

## 2. Store listing (copy/paste)

**Name:** `shoplit — add to cart`

**Summary (≤132 chars):**
`Add products to your shoplit cart in one click from Amazon, Myntra, Nykaa, Flipkart & AJIO — right from the product page.`

**Description:**
```
shoplit lets creators build a shoppable, link-in-bio cart of products they love
and share it with a short link. This extension is the fastest way to fill it.

On any product page at Amazon, Myntra, Nykaa, Flipkart or AJIO, click "Add to
shoplit" (it appears under the product title) or the toolbar icon. shoplit reads
the product — title, image, price, link — and you pick which cart to drop it in.
Done. You can also paste your own affiliate or short link for the product.

• One-click add from the product page
• Works across the major Indian shopping sites
• Edit the title, price, image or link before saving
• Connects securely to your shoplit account

Free, like the rest of shoplit. Sign up at https://shoplit.in
```

**Category:** Shopping
**Language:** English

## 3. Privacy tab (required)

**Single purpose:**
`Add a product from a supported retailer's page to the user's shoplit cart.`

**Permission justifications:**
- **storage** — Store the user's shoplit connection token locally so they stay signed in.
- **host permission — retailer sites** (amazon, myntra, nykaa, flipkart, ajio) — Show the "Add to shoplit" button and read the product on supported shopping sites.
- **host permission — shoplit.in** — Call the shoplit API to list the user's carts and add the product.
- **Remote code:** No — all code is bundled in the package.

**Data usage** (check these): collects *Authentication information* (the connection token) and *User activity* (the product the user chooses to add). Certify: not sold to third parties, not used for unrelated purposes, not used for creditworthiness/lending.

**Privacy policy URL:** `https://shoplit.in/legal/extension-privacy`

## 4. Graphics
- **Store icon (128×128):** auto-pulled from the package (`icons/128.png`). ✅
- **Screenshots (required, 1280×800 or 640×400, 1–5):** capture on a real product page:
  1. A product page with the **"＋ Add to shoplit"** button under the title.
  2. The **add panel** open (cart picker + product).
  3. The product showing up on your **shoplit cart** (`shoplit.in/c/...`).
- **Small promo tile (440×280):** optional.

## 5. Submit
- **Visibility:** Public (or Unlisted if you want to share only by link first).
- Click **Submit for review.** Review typically takes a few hours to a few days.

## 6. After it's approved
1. Copy the **published extension ID** from the dashboard.
2. On the server, set it so the connect handoff is automatic for everyone:
   ```
   ssh … 'cd shoplit && sed -i "s/^EXTENSION_ID=.*/EXTENSION_ID=<published-id>/" deploy/.env'
   ./deploy/redeploy.sh shoplit-web
   ```
3. Add an "Install the extension" link on the dashboard pointing to the store URL.

## Rebuild + repackage
```
cd extension
npm run build
( cd dist && zip -rq ../shoplit-extension-$(node -p "require('./manifest.json').version").zip . -x '*.DS_Store' )
```
Bump `version` in `manifest.json` for each new store upload (Chrome rejects re-uploads with the same version). Also re-run the same `dist → web/public/shoplit-extension.zip` zip so the site's manual-download copy stays in sync.
