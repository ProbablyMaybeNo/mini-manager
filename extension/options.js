import {
  API_BASES,
  loadSettings,
  saveToken,
  saveApiBase,
  settingsUrl,
} from "./config.js";

const $ = (id) => document.getElementById(id);

function refreshSettingsLink() {
  const key = $("apiBase").value;
  $("settings-link").href = settingsUrl(API_BASES[key] || API_BASES.prod);
}

async function init() {
  const settings = await loadSettings();
  $("token").value = settings.token;
  $("apiBase").value = settings.apiBaseKey;
  refreshSettingsLink();

  $("apiBase").addEventListener("change", refreshSettingsLink);

  $("save").addEventListener("click", async () => {
    await saveApiBase($("apiBase").value);
    await saveToken($("token").value);
    const ok = $("saved");
    ok.style.display = "block";
    window.setTimeout(() => (ok.style.display = "none"), 1800);
  });
}

init();
