/**
 * P15.1 — PWA install (manifest + service worker + icons).
 *
 * Locks the PWA install contract so a future edit can't silently break
 * installability:
 *   - manifest.json is valid JSON with the required Lighthouse keys
 *   - start_url / display / short_name match the milestone spec
 *   - every icon the manifest references actually exists on disk
 *   - the service worker file exists and registers nothing it can't cache
 *   - the root layout wires up manifest + apple-touch + appleWebApp meta
 *   - manifest colours stay flush with the app theme tokens
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(root, rel));
}

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}
interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

describe("PWA manifest", () => {
  const raw = read("public/manifest.json");

  test("is valid JSON", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  const manifest = JSON.parse(raw) as Manifest;

  test("has the required install keys with spec values", () => {
    expect(manifest.name).toBe("Mini Manager");
    expect(manifest.short_name).toBe("Mini Manager");
    expect(manifest.start_url).toBe("/projects");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("colours match the app theme (no invented palette)", () => {
    // background = --color-bg (#0a0a0a, the body background)
    // theme     = viewport.themeColor in src/app/layout.tsx (#050607)
    expect(manifest.background_color.toLowerCase()).toBe("#0a0a0a");
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain(`themeColor: "${manifest.theme_color}"`);
  });

  test("declares 192 + 512 'any' icons and a 512 maskable icon", () => {
    const any = manifest.icons.filter((i) => (i.purpose ?? "any") === "any");
    expect(any.some((i) => i.sizes === "192x192")).toBe(true);
    expect(any.some((i) => i.sizes === "512x512")).toBe(true);
    expect(
      manifest.icons.some(
        (i) => i.purpose === "maskable" && i.sizes === "512x512",
      ),
    ).toBe(true);
  });

  test("every referenced icon file exists on disk and is a PNG", () => {
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(true);
      const rel = path.join("public", icon.src);
      expect(exists(rel), `${icon.src} should exist in public/`).toBe(true);
      // PNG magic bytes: 89 50 4E 47
      const head = fs.readFileSync(path.resolve(root, rel)).subarray(0, 4);
      expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(icon.type).toBe("image/png");
    }
  });
});

describe("PWA service worker", () => {
  test("public/sw.js exists", () => {
    expect(exists("public/sw.js")).toBe(true);
  });

  test("does not cache non-GET requests (no authed-write caching)", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain('request.method !== "GET"');
  });

  test("only precaches static shell assets that exist on disk", () => {
    const sw = read("public/sw.js");
    const block = sw.slice(sw.indexOf("SHELL_URLS"));
    const refs = [...block.matchAll(/"(\/[^"]+\.(?:png|json))"/g)]
      .map((m) => m[1])
      .filter((m): m is string => typeof m === "string");
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(exists(path.join("public", ref)), `${ref} precached`).toBe(true);
    }
  });
});

describe("root layout PWA wiring", () => {
  const layout = read("src/app/layout.tsx");

  test("links the manifest", () => {
    expect(layout).toContain('manifest: "/manifest.json"');
  });

  test("declares apple-touch-icon + apple web-app meta", () => {
    expect(layout).toContain("/icons/apple-touch-icon.png");
    expect(layout).toContain("appleWebApp");
    expect(layout).toContain("capable: true");
  });

  test("registers the service worker", () => {
    expect(layout).toContain("ServiceWorkerRegistrar");
  });
});
