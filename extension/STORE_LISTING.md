# Chrome Web Store listing — Mini Mainframe Collection

Everything needed to submit the extension. Package the upload with
`node scripts/package-extension.mjs` then zip `dist/extension-store/` (see the
repo `extension/README.md`). The store build strips the localhost/dev host
permissions automatically.

One-time before you can submit: register a Chrome Web Store developer account
(one-time **$5** fee) at https://chrome.google.com/webstore/devconsole.

---

## Name
Mini Mainframe Collection

## Summary (max 132 characters)
Add any paint or model to your Mini Mainframe collection straight from a store's product page — one click, Owned or Wishlist.

## Category
Productivity

## Language
English

---

## Detailed description

Track your whole miniature-painting hobby without leaving the shop.

Mini Mainframe Collection adds a toolbar button (and the Alt+Shift+M shortcut)
that drops the product you're looking at straight into your collection on
**The Mini Mainframe** — tagged **Owned** or **Wishlist**, in one click, no
copy-pasting URLs.

**How it works**
1. Sign in to The Mini Mainframe and open **Settings → Browser extension**.
2. Click **Generate token**, copy it, and paste it into the extension's options.
3. On any supported store's product page, click the toolbar icon (or press
   Alt+Shift+M), choose Owned or Wishlist, and hit **Add to collection**.

**Supported stores**
Element Games, Wayland Games, Noble Knight Games, Miniature Market, Gamers Roll,
Amazon, and eBay. Other links still work in the app itself — you just add the
details yourself.

**You'll need a free Mini Mainframe account** — sign up at
https://mini-mainframe.com.

---

## Single purpose (required field)
The extension has one purpose: send the product page you're currently viewing to
your authenticated Mini Mainframe account so it's added to your paint/model
collection as Owned or Wishlist.

---

## Permission justifications (required per-permission)

- **activeTab** — Reads the URL of the tab you're actively on, only when you
  click the extension button, so the app can identify which product you want to
  add. No browsing history or background tab access.
- **storage** — Stores your Mini Mainframe API token and your API-base
  preference locally in the browser (chrome.storage.sync) so you don't paste the
  token every time. Nothing else is stored.
- **Host permission: https://mini-mainframe.com/** (and www) — The extension
  sends the product URL to the Mini Mainframe API at this origin, with your
  token, to create the collection entry. It talks to no other server.

---

## Privacy

**Privacy policy URL:** https://mini-mainframe.com/privacy

**Data handling disclosures (Web Store data-use form):**
- Does the extension collect user data? Yes — minimal.
- **Authentication information**: the Mini Mainframe API token, stored locally in
  the browser and sent only to mini-mainframe.com as a Bearer header. The token
  is a signed HMAC of the user's account id; nothing is stored on Mini
  Mainframe's servers, and regenerating it in the app instantly revokes the old
  one.
- **Web activity**: the URL of the product page is sent to mini-mainframe.com
  only when the user explicitly clicks Add — it is not tracked or logged
  passively.
- Not sold to third parties. Not used for advertising, credit, or lending.
  Used solely to provide the add-to-collection feature the user requested.

---

## Assets to attach in the dashboard

- **Store icon:** `extension/icons/icon128.png` (128×128) — already in the package.
- **Screenshots (required, at least 1; 1280×800 or 640×400 PNG/JPEG):**
  1. The extension popup open on an Element Games product page (Owned/Wishlist
     toggle + Add button visible).
  2. The Mini Mainframe **Collection** page showing added items.
  3. The **Account → Browser extension** token screen (where users get set up).
- **Small promo tile (optional, 440×280):** the Mini Mainframe wordmark on the
  dark/cyan brand background.

---

## Submission checklist
- [ ] $5 developer account registered
- [ ] `node scripts/package-extension.mjs` run, `dist/extension-store/` zipped
- [ ] Zip uploaded, version 1.0.0
- [ ] Icon + ≥1 screenshot attached
- [ ] Summary + description pasted
- [ ] Single-purpose + all permission justifications filled
- [ ] Privacy policy URL set + data-use form completed
- [ ] Category: Productivity · Language: English
- [ ] Submit for review (Google review typically takes a few days to ~2 weeks)
