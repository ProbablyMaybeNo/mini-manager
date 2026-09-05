import {
  loadSettings,
  saveToken,
  settingsUrl,
  apiPost,
} from "./config.js";
import { SUPPORTED_STORES } from "./stores.js";

const $ = (id) => document.getElementById(id);

let state = {
  apiBase: "",
  token: "",
  url: "",
  status: "OWNED",
};

/** Show exactly one top-level view. */
function showView(which) {
  $("view-auth").classList.toggle("hidden", which !== "auth");
  $("view-stores").classList.toggle("hidden", which !== "stores");
  $("view-main").classList.toggle("hidden", which !== "main");
}

/**
 * The "here's where this works" screen. Shown after a token is saved, and
 * whenever the current tab isn't a store we can read.
 *
 * Both cases used to dead-end on a one-line message that named no alternative:
 * a new user's very first action is to paste a token, which they are never
 * doing while standing on a product page, so the setup flow ALWAYS ended in an
 * error (Ross, first real install, 2026-09-05). Naming the five stores turns
 * both of those into a next step.
 *
 * Rendered as DOM nodes rather than innerHTML — the list is local data, but the
 * popup parses no HTML strings anywhere and this is not the place to start.
 */
function showStores(lede, tone) {
  const el = $("stores-lede");
  el.textContent = lede;
  el.className = `lede ${tone || ""}`.trim();

  const list = $("stores-list");
  list.replaceChildren();
  for (const store of SUPPORTED_STORES) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = store.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = store.name;
    li.append(a);
    list.append(li);
  }
  showView("stores");
}

/**
 * Render the status line. `link` (optional) appends a trailing anchor —
 * built as a DOM node rather than innerHTML so the popup never parses a
 * string the API handed it.
 */
function setMsg(text, kind, link) {
  const el = $("msg");
  el.textContent = text;
  el.className = `msg ${kind || ""}`.trim();
  if (link) {
    el.append(" ");
    const a = document.createElement("a");
    a.className = "link";
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.label;
    el.append(a);
  }
  el.classList.toggle("hidden", !text);
}

function setStatusLine(text) {
  $("status").textContent = text || "";
  $("status").classList.toggle("hidden", !text);
}

/** Current active tab URL. */
async function activeTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || "";
}

function renderProduct(product, storeName) {
  $("p-name").textContent = product.name || "(untitled)";
  $("p-vendor").textContent = storeName || product.vendor || "";
  if (product.price != null) {
    const cur = product.currency || "USD";
    $("p-price").textContent = `${cur} ${Number(product.price).toFixed(2)}`;
    $("p-price").classList.remove("hidden");
  } else {
    $("p-price").textContent = "";
  }
  const img = $("p-image");
  if (product.image) {
    img.src = product.image;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
  }
  $("preview").classList.remove("hidden");
}

/** Hit /preview for the active tab and render a card (or a clean message). */
async function loadPreview() {
  setMsg("", "");
  $("preview").classList.add("hidden");
  setStatusLine("Reading page…");

  state.url = await activeTabUrl();
  if (!/^https?:/i.test(state.url)) {
    setStatusLine("");
    showStores("Not a product page.", "");
    return;
  }

  const { status, data } = await apiPost(state.apiBase, state.token, "preview", {
    url: state.url,
  });

  if (status === 401) {
    showView("auth");
    return;
  }
  if (status === 422) {
    setStatusLine("");
    // `supported: false` means the HOST isn't one we read; a 422 without it
    // means the host was right but the page had no product on it (a category
    // page, a search result). Different problems, different advice.
    if (data.supported === false) {
      showStores("We can’t read this site yet.", "");
    } else {
      setMsg(
        data.error || "Couldn’t find a product on this page — open the item itself.",
        "",
      );
    }
    return;
  }
  if (status !== 200 || !data.product) {
    setStatusLine("");
    setMsg(data.error || "Something went wrong reading the page.", "error");
    return;
  }

  setStatusLine("");
  renderProduct(data.product, data.store);
}

/** Add the current product at the selected status. */
async function add() {
  setMsg("Adding…", "");
  $("add").disabled = true;

  const { status, data } = await apiPost(state.apiBase, state.token, "add", {
    url: state.url,
    status: state.status,
  });

  $("add").disabled = false;

  if (status === 200 && data.item) {
    setMsg("Added ✓", "ok");
    $("add").textContent = "Added ✓";
    $("add").disabled = true;
    return;
  }
  if (status === 401) {
    showView("auth");
    return;
  }
  if (status === 402) {
    // The API hands back a relative `upgradeUrl`; resolve it against the
    // configured base so the link works from the popup's own origin.
    setMsg(
      data.error || "Collection limit reached — upgrade to add more.",
      "error",
      data.upgradeUrl
        ? { href: `${state.apiBase}${data.upgradeUrl}`, label: "View plans →" }
        : null,
    );
    return;
  }
  setMsg(data.error || "Couldn’t add this item.", "error");
}

function wireStatusToggle() {
  for (const btn of [$("t-owned"), $("t-wishlist")]) {
    btn.addEventListener("click", () => {
      state.status = btn.dataset.status;
      $("t-owned").setAttribute("aria-pressed", String(state.status === "OWNED"));
      $("t-wishlist").setAttribute(
        "aria-pressed",
        String(state.status === "WISHLIST"),
      );
    });
  }
}

async function init() {
  const settings = await loadSettings();
  state.apiBase = settings.apiBase;
  state.token = settings.token;

  // Settings links point at the configured base's account page.
  const link = settingsUrl(state.apiBase);
  $("settings-link").href = link;
  $("open-options").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  wireStatusToggle();
  $("add").addEventListener("click", add);

  $("save-token").addEventListener("click", async () => {
    const token = $("token").value.trim();
    if (!token) return;
    await saveToken(token);
    state.token = token;
    // Confirm the setup worked, then say where to use it. This used to call
    // loadPreview() straight away, which previewed whatever tab happened to be
    // open — never a product page, since nobody pastes a token while shopping —
    // so every first run ended on an error.
    showStores("Token added ✓", "ok");
  });

  if (!state.token) {
    showView("auth");
    return;
  }

  showView("main");
  await loadPreview();
}

init();
