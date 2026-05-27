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
- NextAuth.js v5 (magic-link in dev; OAuth deferred)
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
