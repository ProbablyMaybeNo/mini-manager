import { describe, expect, test } from "vitest";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PROJECT,
  validateImageFile,
} from "@/lib/blob/limits";

/**
 * Recipe-card phase 1 — client-side pre-flight validation for project
 * model-photo uploads. Pure function, no DB / no network: the same rules
 * are re-enforced server-side (the upload-token route's
 * `allowedContentTypes` / `maximumSizeInBytes`), so this only needs to
 * pin the friendly-rejection behaviour.
 */
describe("validateImageFile", () => {
  test("accepts every allowed content type under the size cap", () => {
    for (const type of ALLOWED_IMAGE_CONTENT_TYPES) {
      expect(validateImageFile({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  test("rejects a disallowed content type", () => {
    const res = validateImageFile({ type: "image/gif", size: 1024 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/PNG, JPEG, or WEBP/);
  });

  test("rejects a file over the size cap", () => {
    const res = validateImageFile({
      type: "image/png",
      size: MAX_IMAGE_BYTES + 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/too large/);
  });

  test("accepts a file exactly at the size cap", () => {
    expect(
      validateImageFile({ type: "image/webp", size: MAX_IMAGE_BYTES }),
    ).toEqual({ ok: true });
  });

  test("sane defaults — non-zero cap on file size and image count", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_IMAGES_PER_PROJECT).toBeGreaterThan(0);
  });
});
