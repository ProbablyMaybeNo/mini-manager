import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Route-level tests for the extension API. The DB- and network-bound
 * dependencies (token verification, scrape, insert) are mocked so we can
 * drive the REAL handler logic — auth gate, JSON parsing, and crucially
 * the supported-store URL gate — without a database or live fetch.
 */

const verifyExtensionToken = vi.fn<(t: string) => Promise<string | null>>();
const scrapeUrl = vi.fn();
const scrapeAndInsertWishlistItem = vi.fn();
// The extension add route USED to sit behind `isProUser` and no longer does
// (Ross, 2026-09-05 — the Web Store listing can't paywall its own first
// click). Still mocked, and deliberately answering `false` (a free user), so
// the "never consults the Pro gate" assertion below is a real regression
// guard rather than a vacuous one: if the gate ever comes back, this mock
// makes every add test 402 instead of silently passing.
const isProUser = vi.fn<(userId: string) => Promise<boolean>>();

vi.mock("@/lib/auth/extensionToken", () => ({ verifyExtensionToken }));
vi.mock("@/lib/scrape", () => ({ scrapeUrl }));
vi.mock("@/lib/wishlist/scrapeInsert", () => ({ scrapeAndInsertWishlistItem }));
vi.mock("@/lib/billing/enforce", () => ({ isProUser }));

// Imported AFTER the mocks are registered.
const { POST: previewPOST } = await import(
  "@/app/api/extension/preview/route"
);
const { POST: addPOST } = await import("@/app/api/extension/add/route");

const SUPPORTED = "https://www.elementgames.co.uk/some/product";
const UNSUPPORTED = "https://example.com/random-thing";

function req(body: unknown, token = "good-token"): Request {
  return new Request("https://app.test/api/extension/x", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      origin: "chrome-extension://abcdef",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyExtensionToken.mockReset();
  scrapeUrl.mockReset();
  scrapeAndInsertWishlistItem.mockReset();
  isProUser.mockReset();
  verifyExtensionToken.mockResolvedValue("user_1");
  isProUser.mockResolvedValue(false);
});

describe("POST /api/extension/preview", () => {
  test("401 when the token is invalid", async () => {
    verifyExtensionToken.mockResolvedValue(null);
    const res = await previewPOST(req({ url: SUPPORTED }, "bad"));
    expect(res.status).toBe(401);
    expect(scrapeUrl).not.toHaveBeenCalled();
  });

  test("422 for an unsupported store — never scrapes", async () => {
    const res = await previewPOST(req({ url: UNSUPPORTED }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { supported?: boolean };
    expect(body.supported).toBe(false);
    expect(scrapeUrl).not.toHaveBeenCalled();
  });

  test("400 for a non-URL body", async () => {
    const res = await previewPOST(req({ url: "not a url" }));
    expect(res.status).toBe(400);
    expect(scrapeUrl).not.toHaveBeenCalled();
  });

  test("scrapes + returns the product card for a supported store", async () => {
    scrapeUrl.mockResolvedValue({
      title: "Space Marines",
      price: 42.5,
      currency: "GBP",
      vendor: "Element Games",
      imageUrl: "https://img/x.jpg",
      category: "Box",
      raw: {},
    });
    const res = await previewPOST(req({ url: SUPPORTED }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { product: { name: string } };
    expect(scrapeUrl).toHaveBeenCalledOnce();
    expect(body.product.name).toBe("Space Marines");
  });

  test("422 when a supported page yields no product", async () => {
    scrapeUrl.mockResolvedValue(null);
    const res = await previewPOST(req({ url: SUPPORTED }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { supported?: boolean };
    expect(body.supported).toBe(true);
  });

  test("reflects the chrome-extension origin in CORS", async () => {
    scrapeUrl.mockResolvedValue(null);
    const res = await previewPOST(req({ url: SUPPORTED }));
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "chrome-extension://abcdef",
    );
  });
});

describe("POST /api/extension/add", () => {
  test("401 when the token is invalid", async () => {
    verifyExtensionToken.mockResolvedValue(null);
    const res = await addPOST(req({ url: SUPPORTED, status: "OWNED" }, "bad"));
    expect(res.status).toBe(401);
    expect(scrapeAndInsertWishlistItem).not.toHaveBeenCalled();
  });

  test("422 for an unsupported store — never inserts", async () => {
    const res = await addPOST(req({ url: UNSUPPORTED, status: "OWNED" }));
    expect(res.status).toBe(422);
    expect(scrapeAndInsertWishlistItem).not.toHaveBeenCalled();
  });

  test("400 when status is not OWNED/WISHLIST", async () => {
    const res = await addPOST(req({ url: SUPPORTED, status: "COMPLETE" }));
    expect(res.status).toBe(400);
    expect(scrapeAndInsertWishlistItem).not.toHaveBeenCalled();
  });

  test("inserts via the shared pipeline + returns the saved item", async () => {
    scrapeAndInsertWishlistItem.mockResolvedValue({
      ok: true,
      data: {
        id: "w1",
        title: "Space Marines",
        status: "OWNED",
        kind: "model",
        vendor: "Element Games",
        price: 4250,
        currency: "GBP",
        imageUrl: null,
        sourceUrl: SUPPORTED,
      },
    });
    const res = await addPOST(req({ url: SUPPORTED, status: "OWNED" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { id: string; status: string } };
    expect(scrapeAndInsertWishlistItem).toHaveBeenCalledOnce();
    const arg = scrapeAndInsertWishlistItem.mock.calls[0]?.[0] as {
      userId: string;
      status: string;
    };
    expect(arg.userId).toBe("user_1");
    expect(arg.status).toBe("OWNED");
    expect(body.item.id).toBe("w1");
  });

  test("402 when the free-tier cap is hit", async () => {
    scrapeAndInsertWishlistItem.mockResolvedValue({
      ok: false,
      error: "Free tier limit reached",
      upgradeUrl: "/pricing",
    });
    const res = await addPOST(req({ url: SUPPORTED, status: "WISHLIST" }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { upgradeUrl?: string };
    expect(body.upgradeUrl).toBe("/pricing");
  });

  // Un-gating guard. `isProUser` resolves `false` for every test in this
  // file (see the mock at the top), so a free user completing an add IS the
  // assertion — plus an explicit check that the handler never asked.
  test("a free (non-subscriber) user can add — the Pro gate is never consulted", async () => {
    scrapeAndInsertWishlistItem.mockResolvedValue({
      ok: true,
      data: {
        id: "w2",
        title: "Citadel Base: Abaddon Black",
        status: "WISHLIST",
        kind: "paint",
        vendor: "Element Games",
        price: 275,
        currency: "GBP",
        imageUrl: null,
        sourceUrl: SUPPORTED,
      },
    });
    const res = await addPOST(req({ url: SUPPORTED, status: "WISHLIST" }));
    expect(res.status).toBe(200);
    expect(isProUser).not.toHaveBeenCalled();
    expect(scrapeAndInsertWishlistItem).toHaveBeenCalledOnce();
  });
});
