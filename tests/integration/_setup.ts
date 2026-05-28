// Runs once per worker before any integration test imports. Sets env
// flags so server modules behave as test-mode (test-only auth shortcut,
// in-memory DB URL fallback for any code path that reads DATABASE_URL
// directly).
// NODE_ENV is typed as a string literal union; assign through any to
// satisfy strict mode without polluting global type defs.
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= "test";
env.DATABASE_URL ??= ":memory:";
env.AUTH_SECRET ??= "test-only-secret-not-used-here";
