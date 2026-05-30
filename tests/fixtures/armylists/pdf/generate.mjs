// One-off generator for a minimal valid PDF fixture used by
// tests/unit/lib/imports/pdfExtractor.test.ts. Run when the fixture
// needs regenerating:
//
//   node tests/fixtures/armylists/pdf/generate.mjs
//
// The output is checked in. We don't run this in CI — pdfkit is not a
// project dependency. The PDF here is hand-rolled against the PDF 1.4
// spec to keep us from pulling a fixture-only library.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Eight-line list. We separate lines with the PDF text operator pair
// `Tj` + `T*` (next-line) so pdf-parse emits a real newline between them.
const LINES = [
  "Warhammer App List",
  "Adeptus Astartes - 2000 pts",
  "Captain in Terminator Armour - 105 pts",
  "10x Intercessors - 200 pts",
  "10x Tactical Marines - 135 pts",
  "5x Terminators - 185 pts",
  "Redemptor Dreadnought - 210 pts",
  "Total: 835 pts",
];

function escapePdfString(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Build the content stream. T* advances to the next line of text using
// the leading set by `TL`.
const contentLines = [
  "BT",
  "/F1 12 Tf",
  "14 TL",
  "72 760 Td",
];
for (let i = 0; i < LINES.length; i += 1) {
  contentLines.push(`(${escapePdfString(LINES[i])}) Tj`);
  if (i < LINES.length - 1) contentLines.push("T*");
}
contentLines.push("ET");
const content = contentLines.join("\n");

// Assemble PDF objects.
const objects = [
  // 1 — catalog
  "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
  // 2 — pages
  "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  // 3 — page
  "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  // 4 — content stream
  `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  // 5 — Helvetica
  "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
];

// Now compute byte offsets for the xref table.
const header = "%PDF-1.4\n%\xff\xff\xff\xff\n";
let body = "";
const offsets = [0]; // entry 0 is always the free list head
for (const obj of objects) {
  offsets.push(header.length + body.length);
  body += obj;
}

const xrefStart = header.length + body.length;
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i += 1) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const out = Buffer.from(header + body + xref + trailer, "latin1");
const outPath = path.join(__dirname, "warhammer-app-marines.pdf");
fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${out.length} bytes)`);
