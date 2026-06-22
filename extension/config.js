// Shared config + storage helpers for the Mini Manager Collection
// extension. No build step — plain ES modules loaded directly by the
// popup and options pages.

export const API_BASES = {
  prod: "https://mini-mainframe.com",
  local: "http://localhost:3000",
};

const DEFAULT_BASE_KEY = "prod";

/** Read the saved token + API base. Falls back to the prod base. */
export async function loadSettings() {
  const { token = "", apiBaseKey = DEFAULT_BASE_KEY } =
    await chrome.storage.sync.get(["token", "apiBaseKey"]);
  const base = API_BASES[apiBaseKey] ? apiBaseKey : DEFAULT_BASE_KEY;
  return { token, apiBaseKey: base, apiBase: API_BASES[base] };
}

/** Persist the token. */
export async function saveToken(token) {
  await chrome.storage.sync.set({ token: token.trim() });
}

/** Persist the API base selection ("prod" | "local"). */
export async function saveApiBase(apiBaseKey) {
  const key = API_BASES[apiBaseKey] ? apiBaseKey : DEFAULT_BASE_KEY;
  await chrome.storage.sync.set({ apiBaseKey: key });
}

/** The app's account/settings URL for the current base. */
export function settingsUrl(apiBase) {
  return `${apiBase}/user/account`;
}

/**
 * POST JSON to an extension API route with the bearer token attached.
 * Returns { ok, status, data }. Never throws on a non-2xx — the caller
 * branches on `status`.
 */
export async function apiPost(apiBase, token, path, body) {
  let res;
  try {
    res = await fetch(`${apiBase}/api/extension/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: "Couldn't reach Mini Manager. Is the API base correct?" },
    };
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}
