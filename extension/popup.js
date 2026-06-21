import {
  loadSettings,
  saveToken,
  settingsUrl,
  apiPost,
} from "./config.js";

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
  $("view-main").classList.toggle("hidden", which !== "main");
}

function setMsg(text, kind) {
  const el = $("msg");
  el.textContent = text;
  el.className = `msg ${kind || ""}`.trim();
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
    setMsg("Open a product page on a supported store, then click again.", "");
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
    setMsg(data.error || "This page isn’t a supported product.", "");
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
    setMsg(data.error || "Collection limit reached — upgrade to add more.", "error");
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
    showView("main");
    await loadPreview();
  });

  if (!state.token) {
    showView("auth");
    return;
  }

  showView("main");
  await loadPreview();
}

init();
