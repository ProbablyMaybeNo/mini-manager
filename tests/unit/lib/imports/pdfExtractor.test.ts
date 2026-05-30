import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfText } from "@/lib/imports/pdfExtractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "armylists",
  "pdf",
);

function loadPdf(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(FIXTURE_DIR, name));
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

describe("extractPdfText", () => {
  test("extracts text from a basic single-page list PDF", async () => {
    const ab = loadPdf("warhammer-app-marines.pdf");
    const result = await extractPdfText(ab);

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Intercessors");
    expect(result.text).toContain("Tactical Marines");
    expect(result.text).toContain("Redemptor Dreadnought");
    expect(result.text).toContain("Adeptus Astartes");
  });

  test("rejects a 0-byte input with a friendly error", async () => {
    const empty = new ArrayBuffer(0);
    await expect(extractPdfText(empty)).rejects.toThrow(/empty/i);
  });

  test("rejects oversized input (>5 MB) before parsing", async () => {
    const big = new ArrayBuffer(6 * 1024 * 1024);
    await expect(extractPdfText(big)).rejects.toThrow(/too large/i);
  });

  test("rejects a corrupt buffer with a friendly error", async () => {
    const garbage = new TextEncoder().encode("this is not a pdf").buffer as ArrayBuffer;
    await expect(extractPdfText(garbage)).rejects.toThrow(/Could not read/i);
  });
});
