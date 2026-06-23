# Mini Mainframe Collection — browser extension

Add a paint or model to your [Mini Mainframe](https://miniaturemanager.vercel.app)
collection straight from a supported store's product page. Click the
toolbar icon (or press **Alt+Shift+M**) on a product page, pick **Owned**
or **Wishlist**, and hit **Add to collection** — no leaving the page.

Manifest V3, plain JavaScript, **no build step**. Load the `extension/`
folder directly.

## Supported stores

Games Workshop · Element Games · Wayland Games · Goblin Gaming · Noble
Knight Games · Miniature Market · Game Kastle · Gamers Roll · Amazon ·
eBay. (The server is the source of truth — `src/lib/scrape/stores.ts`.)

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome (or Edge: `edge://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. The **Mini Mainframe Collection** icon appears in the toolbar. Pin it.

## Generate + paste your token

1. Sign in to the app (`https://miniaturemanager.vercel.app`, or
   `http://localhost:3000` in dev).
2. Go to **Account → Browser extension** and click **Generate token**.
3. Click **Copy**.
4. Open the extension popup → **settings** (or right-click the icon →
   **Options**) → paste the token → **Save**.
   - If you're testing against a local dev server, switch **API base** to
     **Local dev — localhost:3000** on the same options screen.
5. **Regenerate** in the app at any time to revoke a leaked or old token;
   re-paste the new one.

The token never leaves your browser except as a `Bearer` header to the
Mini Mainframe API. It's a signed HMAC of your user id — there's no token
stored server-side, so regenerating (which bumps a version counter)
instantly invalidates every previous one.

## Use it

1. Visit a product page on a supported store.
2. Click the toolbar icon, or press **Alt+Shift+M**.
3. The popup scrapes the page and shows the product (name, price,
   vendor, thumbnail).
4. Choose **Owned** or **Wishlist** and click **Add to collection**.
5. You'll see **Added ✓**. The item is now in your collection in the app.

If the page isn't a supported store, the popup says so cleanly — nothing
is added.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest — action popup, `Alt+Shift+M` command, `activeTab` + `storage` permissions, host permissions for prod + localhost. |
| `popup.html` / `popup.js` | The popup: token gate → `/preview` card → Owned/Wishlist toggle → `/add`. |
| `options.html` / `options.js` | Set the token + choose the prod/local API base. |
| `config.js` | Shared storage + `fetch` helpers. |
| `icons/` | 16/48/128 placeholder PNGs. |

## API it talks to

- `POST /api/extension/preview` → `{ url }` → product card (or 422 for an
  unsupported store / unreadable page).
- `POST /api/extension/add` → `{ url, status }` → re-scrapes server-side
  and saves the item.

Both require `Authorization: Bearer <token>` and respond with permissive
CORS for `chrome-extension://` origins.

## Publishing to the Chrome Web Store (stub)

> Not done yet — needs Ross's call on the developer account.

1. Create / use a **Chrome Web Store developer account**
   (one-time US $5 registration fee).
2. Replace the placeholder `icons/` with final-art 128×128 (and the
   smaller sizes) plus store screenshots + a 440×280 promo tile.
3. Bump `manifest.json` `version`.
4. Zip the **contents** of `extension/` (not the folder itself):
   `cd extension && zip -r ../mini-manager-collection.zip .`
5. Upload at <https://chrome.google.com/webstore/devconsole>, fill in the
   listing (description, category = Productivity, privacy practices —
   declare the token + activeTab usage), and submit for review.
6. After approval, share the store URL. Edge Add-ons + Firefox AMO can
   reuse the same MV3 package with minor manifest tweaks if wanted later.
