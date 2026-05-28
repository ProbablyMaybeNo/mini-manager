/* eslint-disable no-console */
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(here, "..", "..");
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(projectRoot, filePath);
    mkdirSync(dirname(abs), { recursive: true });
  }

  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log(`[migrate] running migrations against ${url}`);
  await migrate(db, {
    migrationsFolder: path.resolve(projectRoot, "drizzle"),
  });
  console.log("[migrate] done");

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
