# Mini Manager

Wargaming + painting companion. Plan armies, track every model from wishlist to complete, build paint recipes from a cross-brand library, carry the whole thing in your pocket at the hobby store.

**This is the v2 rewrite.** The legacy app lives next door in `../app-src/` and is reference-only until v2 ships.

See [`../V2-BUILD-PLAN.md`](../V2-BUILD-PLAN.md) for the full plan.

---

## Local dev

```bash
cd app
cp .env.example .env.local
npm install
npm run dev
# open http://localhost:3000
```

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind v4 (CSS-first @theme tokens)
- Drizzle ORM · better-sqlite3 (local dev) · Postgres (prod, deferred)
- NextAuth.js v5 (username + password via Credentials — Phase 9; OAuth deferred)
- IBM Plex Mono (chrome) · IBM Plex Sans (prose)

## Layout

```
app/
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── projects/          # Projects (home)
│   │   ├── library/           # Phase 2
│   │   ├── recipes/           # Phase 3
│   │   ├── tools/             # Phase 4
│   │   ├── wishlist/          # Phase 2
│   │   └── user/              # Profile + settings
│   ├── components/            # Shared UI
│   ├── db/                    # Drizzle schema, migrations, seed
│   └── lib/                   # Utilities, server actions
└── data/local.db              # Dev SQLite (gitignored)
```

## Environment variables

The required core (see `.env.example` for full list):

| Var | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | yes | NextAuth signing key. Generate with `openssl rand -base64 32`. |
| `DATABASE_URL` | yes | libsql URL — `file:./data/local.db` in dev, `libsql://...` in prod (Turso). |
| `DATABASE_AUTH_TOKEN` | prod only | Turso auth token. |
| `AUTH_RESEND_KEY` | **optional** | Resend API key. Only used for recovery-email verification (P9.5) and password reset (P9.6). When unset, both flows log the link to the dev console — same DX as the old magic-link transport. **Not required for sign-up.** |
| `AUTH_EMAIL_FROM` | optional | `From:` header on verify / reset emails. Falls back to `Mini Manager <no-reply@localhost>`. |
| `GROQ_API_KEY` | optional | Powers the LLM import-parser fallback (P7.5). |
| `ALLOW_TEST_AUTH` | dev / E2E | Set to `1` to expose the `/api/test/sign-in` shortcut Playwright uses. **Never set in production.** |

Sign-up is **frictionless** for free tier: username + password only, no email field. Adding a recovery email — and verifying it — happens in `/user` as the upgrade gate.

## Phase 1 roadmap

| ID | Task | Status |
|---|---|---|
| P1.1 | Scaffold `app/` directory | done |
| P1.2 | Drizzle schema + SQLite | pending |
| P1.3 | NextAuth (magic-link dev) | pending |
| P1.4 | Design tokens + root layout | done (in P1.1) |
| P1.5 | Projects dashboard + list | pending |
| P1.6 | New project modal + quick-add | pending |
| P1.7 | Project workspace + stage counter | pending |
| P1.8 | Named models panel | pending |
| P1.9 | Sub-project nesting + aggregation | pending |
