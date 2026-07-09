import { describe, expect, test } from "vitest";
import { exportableImageSrc, isProxiableBlobUrl } from "@/lib/shareCard/imageSrc";

describe("isProxiableBlobUrl", () => {
  test("true for an https Vercel Blob public-storage URL", () => {
    expect(
      isProxiableBlobUrl("https://abc123xyz.public.blob.vercel-storage.com/foo-bar.png"),
    ).toBe(true);
  });

  test("false for http (non-tls) even on the blob host", () => {
    expect(
      isProxiableBlobUrl("http://abc123xyz.public.blob.vercel-storage.com/foo.png"),
    ).toBe(false);
  });

  test("false for an unrelated host", () => {
    expect(isProxiableBlobUrl("https://evil.example.com/foo.png")).toBe(false);
  });

  test("false for a local object URL", () => {
    expect(isProxiableBlobUrl("blob:https://mini-mainframe.app/abc-123")).toBe(false);
  });

  test("false for an unparseable string", () => {
    expect(isProxiableBlobUrl("not a url")).toBe(false);
  });
});

describe("exportableImageSrc", () => {
  test("rewrites a Blob URL through the same-origin proxy", () => {
    const blobUrl = "https://abc123xyz.public.blob.vercel-storage.com/model-photo.png";
    expect(exportableImageSrc(blobUrl)).toBe(
      `/api/blob-proxy?url=${encodeURIComponent(blobUrl)}`,
    );
  });

  test("passes a local object URL through unchanged", () => {
    const objectUrl = "blob:https://mini-mainframe.app/abc-123";
    expect(exportableImageSrc(objectUrl)).toBe(objectUrl);
  });

  test("passes an already-same-origin path through unchanged", () => {
    expect(exportableImageSrc("/data/sample.png")).toBe("/data/sample.png");
  });
});
