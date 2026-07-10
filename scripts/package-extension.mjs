/* Package the browser extension for the Chrome Web Store.
 *
 * Produces `dist/extension-store/` — a copy of `extension/` with a
 * review-clean manifest (dev/localhost host permissions stripped, only the
 * production origins kept) and no repo-only files (README / listing docs).
 * Zip that folder for upload:  Compress-Archive dist/extension-store/* dist/mini-mainframe-extension.zip
 *
 * The repo `extension/` stays dev-capable (localhost host perms + Local API
 * base) for load-unpacked testing; this only affects the store build.
 *
 *   node scripts/package-extension.mjs
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "extension");
const OUT = resolve(ROOT, "dist", "extension-store");

// Origins the STORE build is allowed to talk to. Dev origins
// (localhost:*, the old *.vercel.app preview) are dropped so the Web Store
// review doesn't flag broad/dev host access.
const PROD_HOSTS = [
  "https://mini-mainframe.com/*",
  "https://www.mini-mainframe.com/*",
];

// Repo-only files that must not ship in the store package.
const EXCLUDE = new Set(["README.md", "STORE_LISTING.md"]);

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await cp(SRC, OUT, {
    recursive: true,
    filter: (from) => {
      const name = from.slice(SRC.length + 1);
      return !EXCLUDE.has(name);
    },
  });

  const manifest = JSON.parse(await readFile(resolve(SRC, "manifest.json"), "utf8"));
  manifest.host_permissions = PROD_HOSTS;
  await writeFile(
    resolve(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );

  console.log(`[package-extension] wrote ${OUT}`);
  console.log(`[package-extension] host_permissions = ${PROD_HOSTS.join(", ")}`);
  console.log(
    "[package-extension] zip it:  Compress-Archive -Path dist/extension-store/* -DestinationPath dist/mini-mainframe-extension.zip -Force",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
