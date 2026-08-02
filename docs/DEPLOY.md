# Mini Manager — Production Deploy Runbook

The app deploys to Vercel from `apps/Paint-planner/app/` in the monorepo. The production database is Turso (hosted libsql, same SQL as local dev — zero code change). Magic-link auth runs through Resend in prod.

This runbook is the canonical deploy guide. Update it when the production setup changes — future-you and any agent picking this up later will need it.

---

## 1. Production stack

| Service | URL pattern | Free-tier limit |
|---|---|---|
| Hosting | `paint-planner-pro.vercel.app` (or renamed) | 100 GB bandwidth / mo |
| Database | `libsql://<name>.turso.io` | 9 GB storage, 1B row reads / mo |
| Email | Resend API | 3,000 emails / mo, 100 / day |

---

## 2. Vercel project settings

**Project name:** `paint-planner-pro` (or rename to `mini-manager` to get `mini-manager.vercel.app`)

**Source repository:** `ProbablyMaybeNo/antigravity-ai-hub` · branch `main`

**Project settings → General:**

- **Root Directory:** `apps/Paint-planner/app`  ← critical for the monorepo
- **Framework Preset:** Next.js (auto-detected once root is correct)
- **Build Command:** default (`next build`)
- **Install Command:** default (`npm install`)
- **Output Directory:** default (`.next`)
- **Node Version:** 20.x or 22.x

**Project settings → Git:**

- **Production Branch:** `main`
- **Auto-deploy:** on push to `main`
- **Preview deployments:** on PRs (optional but useful)

---

## 3. Environment variables (Vercel dashboard)

Set all eight in **Settings → Environment Variables**. See `.env.production.example` for the canonical list with comments.

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Turso dashboard | `libsql://...turso.io` |
| `DATABASE_AUTH_TOKEN` | Turso dashboard | Write-capable token |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Reuse local `.env.local` value to keep dev sessions valid |
| `AUTH_URL` | This repo | `https://paint-planner-pro.vercel.app` (update if project renamed or custom domain added) |
| `AUTH_RESEND_KEY` | Resend dashboard | API key |
| `AUTH_EMAIL_FROM` | Manually set | Default: `Mini Manager <onboarding@resend.dev>` (Resend dev domain, only delivers to account email). Replace once custom domain is verified. |
| `GROQ_API_KEY` | Groq console | Required for P7.5 messy-list LLM fallback. Without it the fallback errors but clean text/PDF/.ros/.rosz imports still work. Free tier (no billing), get it at https://console.groq.com/keys |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | Powers AI recipes, paint scan and gallery moderation — all three call `claude-haiku-4-5`. The first two return a handled "not configured" error when unset; **gallery moderation fails OPEN**, so submissions skip the automated check and queue for human review. Prefer a key dedicated to this app over a shared personal one. |

**Do NOT set** `ALLOW_TEST_AUTH` in production — the test-only sign-in route returns 404 unless this is `1`. Keep it unset.

Apply each variable to: **Production**, **Preview**, and **Development** environments (Vercel's three envs). For test-only stuff like `ALLOW_TEST_AUTH=1`, scope to Preview/Dev only.

---

## 4. First-time database setup

Migrations run locally against the Turso URL once, before the first prod deploy.

```bash
cd apps/Paint-planner/app

# Export the Turso credentials into the current shell only — do NOT
# add them to .env.local (which is dev) or commit them anywhere.
$env:DATABASE_URL="libsql://<your-db>.turso.io"
$env:DATABASE_AUTH_TOKEN="<turso-token>"

npm run db:migrate
```

PowerShell sets env vars for the current process only — once the shell closes, the credentials are gone from disk. The `src/db/migrate.ts` script already honours both env vars (added when the migrations module was first written).

**Verify the migration:** Turso dashboard → database → SQL console:

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

Should list `user`, `session`, `account`, `verificationToken`, `project`, `named_model`, `recipe`, `recipe_zone`, `recipe_step`, `palette`, `inventory_entry`, `wishlist_item`, `__drizzle_migrations`.

---

## 5. First deploy

Once env vars are set and the database is migrated:

1. Vercel auto-deploys on the next `git push origin main`, OR
2. **Deployments → Redeploy** in the Vercel dashboard against the current `main` SHA.

The first build takes ~2-3 minutes. Watch the logs for any env-var-not-set errors.

After deploy:
1. Visit `https://paint-planner-pro.vercel.app`
2. Sign in with any email — Resend sends the magic link to that address (only to the Resend-account-owner's email while on the `onboarding@resend.dev` from-address)
3. Click the link → land on `/projects`
4. Smoke-test Flows 1, 2, 3 (create a project, browse the library, paste a wishlist URL)

---

## 6. Custom domain (later)

When ready for public launch:

1. Buy a domain from any registrar — `Cloudflare Registrar` sells `.com` at wholesale (~$10/yr). Suggested options: `minimanager.app`, `minimanager.io`, `mini-manager.app`.
2. Vercel → Project → Settings → Domains → Add → enter the domain.
3. Vercel walks you through the DNS records (one `A` record + one `CNAME`). Apply them at your registrar.
4. SSL provisions automatically within a few minutes.
5. Update `AUTH_URL` env var to the new domain. Trigger a redeploy so NextAuth picks up the change.
6. (Recommended) Switch Resend to a verified custom-domain from-address:
   - Resend → Domains → Add Domain → enter `minimanager.app` (or whatever)
   - Apply the DKIM / SPF DNS records Resend gives you
   - Update `AUTH_EMAIL_FROM=Mini Manager <noreply@minimanager.app>` in Vercel
   - Redeploy

---

## 7. Operational basics

**Logs:** Vercel → Project → Logs (live tail). Filter by route to debug a specific page.

**Database backups:** Turso retains 24 h of automatic backups on the free tier. Manual snapshot via CLI:

```bash
turso db shell <db-name> ".dump" > backup-$(Get-Date -Format yyyyMMdd).sql
```

**Rolling back a deploy:** Vercel → Deployments → previous green deploy → **Promote to Production**. No code change needed.

**Rotating credentials:** any time the Turso or Resend keys leak (chat log, screenshot, repo commit):

1. Generate a new token in the relevant dashboard
2. Update the Vercel env var
3. Trigger a redeploy
4. Revoke the old token

The app picks up the new credentials on the next deploy (no code change). Plan for rotation **after** every credential paste into a chat / ticket / shared doc.

---

## 8. What's NOT in production yet

These intentionally don't ship with the first deploy — flagged so a future audit knows they were considered:

- **Pricing tier gates** — `users.tier` column doesn't exist yet. First deploy is full-Pro-for-everyone for the dogfooding period. The tier-gating work is queued as `PHASE6.10_PRICING_GATES_PLAN.md` (to be written).
- **Stripe / Lemon Squeezy integration** — billing wiring follows tier gates.
- **Custom domain** — see §6 above.
- **Background jobs / cron** — none needed yet. Vercel Cron is available if we ever need scheduled tasks.
- **Image hosting** — paint catalog images and uploaded references are served directly from origin URLs in v1. CDN-fronting deferred.
- **Error tracking** (Sentry / similar) — defer until first user-reported errors.
