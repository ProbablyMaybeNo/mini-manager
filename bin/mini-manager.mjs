#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log(`mini-manager ${pkg.version}`);
  process.exit(0);
}

console.error("Usage: mini-manager --version");
process.exit(1);
