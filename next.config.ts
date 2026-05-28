import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the Turbopack workspace root to this directory so Next 16
  // doesn't get confused by sibling lockfiles further up the tree
  // (the monorepo root has its own package-lock.json for other apps).
  //
  // `path.resolve()` with no args returns `process.cwd()`, which is
  // always the app/ directory when Next dev/build is invoked here.
  // We deliberately avoid `import.meta.url` — Next 16 compiles this
  // config to CJS and `import.meta` blows up at runtime.
  turbopack: {
    root: path.resolve(),
  },
};

export default config;
