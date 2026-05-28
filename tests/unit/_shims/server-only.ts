// Empty module — replaces the npm "server-only" package in test runs so
// modules that `import "server-only"` can be loaded by vitest in Node env.
// The real package exists only to trip the bundler when a server module
// is pulled into a client bundle.
export {};
