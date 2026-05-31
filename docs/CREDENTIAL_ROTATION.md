# Credential Rotation Playbook

Several credentials were pasted into chat history during the early Phase 1–9 setup. They still work, but anything that's been visible in a transcript should rotate before public launch. ~20 minutes total.

Order matters: rotate, update Vercel env vars, redeploy (auto-triggers on a push, OR via Redeploy button), verify.

---

## 1. Turso database token (`DATABASE_AUTH_TOKEN`)

**Why:** Database write access. Highest-blast-radius credential.

1. Go to [turso.tech](https://app.turso.tech) → dashboard.
2. Find the database (likely `mini-manager-<region>` or similar).
3. Settings → **Tokens** tab → **Rotate token** (or create new, then revoke old).
4. Copy the new token.
5. In Vercel: `mini-manager` project → Settings → **Environment Variables** → find `DATABASE_AUTH_TOKEN` → edit → paste new value → Save.
6. **Redeploy** (Vercel dashboard → Deployments → latest → triple-dot menu → "Redeploy"). The prebuild migration will run with the new token; should be a no-op since nothing's pending.
7. Verify: visit `https://miniaturemanager.vercel.app/sign-in`, log in, click around. If anything 500s, the new token didn't propagate — check env var is set for the **Production** environment.

---

## 2. Resend API key (`AUTH_RESEND_KEY`)

**Why:** Sends recovery-email verify links + password reset links. Lower blast radius (only emails), but free-tier API keys aren't free if abused.

1. Go to [resend.com/api-keys](https://resend.com/api-keys).
2. Find the current key labeled (whatever you named it — `mini-manager` likely).
3. **Create new** → name it `mini-manager-prod-2026-05` (date stamps help future-you) → copy.
4. Vercel → env vars → `AUTH_RESEND_KEY` → edit → new value → Save.
5. **Delete the old key** in Resend dashboard once the new one is verified working.
6. Redeploy.
7. Verify: sign up a fresh account, add a recovery email at `/settings`, check inbox for the verify link.

---

## 3. Groq API key (`GROQ_API_KEY`)

**Why:** Used by the messy-list import LLM fallback. Free tier (14,400 req/day, no billing) — but a leaked key could burn through the quota fast.

1. Go to [console.groq.com/keys](https://console.groq.com/keys).
2. **Create new key** → name `mini-manager-prod-2026-05` → copy.
3. Vercel → env vars → `GROQ_API_KEY` → edit → new value → Save.
4. **Delete the old key** in Groq dashboard.
5. Redeploy.
6. Verify: try a messy-list import at `/projects/import` with text that doesn't parse cleanly via heuristics (e.g. paste a Reddit-style army list). Should still parse via the LLM fallback.

---

## 4. NextAuth secret (`AUTH_SECRET`)

**Why:** Signs session cookies. Rotating invalidates all current sessions (everyone gets signed out) — that's the only inconvenience.

1. Generate a new secret locally:
   ```pwsh
   # PowerShell — 32 random bytes base64-encoded
   [Convert]::ToBase64String((1..32 | %{ Get-Random -Maximum 256 }))
   ```
2. Vercel → env vars → `AUTH_SECRET` → edit → new value → Save.
3. Redeploy.
4. Verify: open `https://miniaturemanager.vercel.app` in a fresh browser/incognito → confirm you can sign in cleanly. (Existing sessions in your normal browser will need to sign in again — that's expected.)

---

## 5. Stale keys to delete (no replacement needed)

These were pasted but the project no longer uses them. Just **revoke**, don't replace:

- **Anthropic API key** — was for the LLM fallback (P7), since swapped to Groq. Revoke at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
- **Gemini API key(s)** — tried, dropped due to zero free-tier quota. Revoke at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## Final verification

After all rotations + final redeploy:

```pwsh
# Quick smoke against prod
$urls = @(
  "https://miniaturemanager.vercel.app/",
  "https://miniaturemanager.vercel.app/sign-in",
  "https://miniaturemanager.vercel.app/pricing"
)
foreach ($u in $urls) {
  $r = Invoke-WebRequest -Uri $u -UseBasicParsing -SkipHttpErrorCheck
  Write-Host "$($r.StatusCode)  $u"
}
```

All three should return 200. If any return 500, check Vercel runtime logs for the offending env var.

Then a manual sign-up + sign-in + add-recovery-email + verify round, end-to-end. If that round is clean, rotation is done and we're safe to recruit users.
