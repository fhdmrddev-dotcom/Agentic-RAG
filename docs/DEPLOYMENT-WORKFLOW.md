# Deployment Workflow — branches, promotion & local↔cloud parity

**Audience:** operator (plain language on purpose).
**Purpose:** the day-to-day "how a change goes from my laptop to live, safely" guide.
**Companion doc:** [`DEPLOYMENT-PIPELINE.md`](./DEPLOYMENT-PIPELINE.md) — the *architecture* (what runs where, accounts, costs). This doc is the *process*.
**Last updated:** 2026-06-29

---

## 1. The one rule that matters most

> **Every change must work in BOTH local and cloud, and must never break the local setup.**

The codebase is built so local vs cloud is a **pure env-var switch** — no code differences
(`SUPABASE_URL`, `REDIS_URL`, provider keys, `SANDBOX_*`, `FRONTEND_URL`). Keep it that way:

- **Never hardcode** a URL, path, key, model name, or port. If it differs between laptop and
  cloud, it belongs in an env var or a settings row — not in code.
- A change that only works because of something on your laptop (a local file, a running
  service, a model your local key can serve) is **not done** until it also works on cloud.
- Cloud has things local doesn't (real Docker socket for the sandbox, a different DB, a
  different provider key). See §5 for the parity checklist.

---

## 2. The three branches

| Branch | Role | Auto-deploys to | Who pushes here |
|---|---|---|---|
| **`develop`** | Active development — the trunk. Everything lands here first. | **nothing** (local only) | every feature/fix commit |
| **`master`** | Staging / release-candidate. A batch that's ready to validate. Milestone tags (`vX.Y`) live here. | a staging env *(not stood up yet — see note)* | promote from `develop` when a batch is ready |
| **`production`** | Exactly what is LIVE. | **Vercel frontend + Coolify backend** (both watch this branch) | promote from `master` (or hotfix-cherry-pick) |

**Staging note:** a true staging environment needs a second of everything (Supabase project,
Redis, Vercel target, VPS app). It isn't stood up yet — `DEPLOYMENT-PIPELINE.md` decided
"2 environments for now." So today `master` is the **release-candidate / integration**
branch (validated locally), and when a staging env is created it will deploy from `master`
with zero workflow change.

**Mechanics recap (so the table is concrete):**
- Pushing to **`production`** triggers a Coolify backend rebuild **and** a Vercel frontend
  rebuild (both are wired to that branch). A backend-only change still rebuilds the frontend —
  harmless (same output).
- Coolify backend build settings: branch `production`, Base Directory `/backend`,
  Dockerfile `/Dockerfile`, port `8000`.

---

## 3. The normal promotion flow

```
  develop  ──(validate locally)──►  master  ──(promote)──►  production  ──►  LIVE
  (you code here)                   (release candidate)     (deploy branch)   (auto-build)
```

1. **Build + test on `develop`** locally. Run the app, exercise the change both ways
   (toggle on/off), confirm nothing regressed.
2. **Promote `develop` → `master`** when a batch is ready to be a release candidate:
   ```bash
   git checkout master && git merge --no-ff develop && git push origin master
   ```
   (Tag a milestone here when one ships: `git tag vX.Y && git push origin vX.Y`.)
3. **Promote `master` → `production`** to deploy:
   ```bash
   git checkout production && git merge --no-ff master && git push origin production
   ```
   Vercel + Coolify rebuild automatically. Watch the deploy logs for ✅/❌.
4. **Apply that release's cloud-side changes** (migrations, new env vars, settings rows) —
   see §5. Code deploying is **not** the same as the cloud being correctly configured.

> Always promote with `--no-ff` so each promotion is one traceable merge commit.
> Never develop directly on `master` or `production`.

---

## 4. Hotfix flow (urgent fix straight to live)

When production has a bug and you can't wait for the full `develop → master → production`
lap (this is what we did for the cloud deploy fixes), promote a **single commit** surgically
so you don't drag half-finished `develop` work into live:

**If the fix commit's parent is already the production tip → fast-forward (cleanest):**
```bash
git push origin <commit-sha>:production
```

**Otherwise → cherry-pick in a throwaway worktree (keeps your working tree untouched):**
```bash
git worktree add ../hotfix production
cd ../hotfix
git cherry-pick <commit-sha>
git push origin production
cd - && git worktree remove ../hotfix --force
git branch -f production origin/production    # realign local
```

Then **back-merge** so `master`/`production` don't drift: make sure the fix also lives on
`develop` (it usually originates there) and flows up through `master` on the next normal lap.

---

## 5. Local ↔ cloud parity checklist (run this for every change)

Code deploying is only half. These live **outside** the code and must be kept in sync per
environment. When a change touches the left column, do the right column **in cloud too**:

| If your change involves… | …then in CLOUD you must |
|---|---|
| **A new/changed env var** (`backend/.env.example` updated) | Add/update it in **Coolify** (backend) and/or **Vercel** (frontend, `VITE_*`), then redeploy. |
| **A DB schema change** | Apply the numbered `supabase/migrations/NNN_*.sql` by **pasting into the cloud Supabase SQL editor** (never `db push`/`db reset`). Then regen `full-schema.sql`. Do the same locally. |
| **A new app setting / seed row** | Settings live in `app_settings`/`user_settings`. A fresh cloud DB may be **missing seed rows** (`pg_dump --schema-only` skips data). Insert/verify the row in cloud (e.g. `app_settings 'global'`). |
| **A model / provider** | The cloud provider **key** (env) must serve the chosen model. Local and cloud keys can differ — a model that works locally can 404 on cloud (this caused the metadata-extraction bug: extraction defaulted to `gpt-4o`, which the cloud key couldn't serve). Pin known-good models. |
| **The code sandbox** | Cloud needs the Docker socket mounted into the backend container **and** the sandbox image built **on the VPS host** (`agentic-rag-sandbox:<tag>`). Local just uses your laptop's Docker. |
| **CORS / allowed origins** | `FRONTEND_URL` (Coolify) must list every live frontend origin, comma-separated. |

**Settings drift is the #1 cloud gotcha.** Many settings columns exist in the DB but some are
still env/hardcoded; the planned admin-panel milestone moves everything to DB control. Until
then, treat cloud config as a separate surface that can drift from local — verify it, don't
assume it.

---

## 6. "Am I about to break something?" pre-promotion checks

Before `master → production`:

- [ ] Ran the app **locally** and exercised the change (both on and off paths).
- [ ] No hardcoded local-only values (URLs/paths/keys/models) — env-var or settings instead.
- [ ] Any new env var is set in **both** local `.env` **and** the cloud dashboard.
- [ ] Any DB migration is applied to **both** local and cloud Supabase, and `full-schema.sql`
      is regenerated.
- [ ] Cross-provider: the change works across providers, not just the one you tested
      (provider-specific handling stays at the service boundary, never breaks the shared path).
- [ ] Watched the Coolify + Vercel deploy logs go ✅ after pushing.
- [ ] Smoke-tested the live app (login, chat stream, a doc ingest) on the real domain.

---

## 7. Quick reference — what lives where

| | Local | Production |
|---|---|---|
| Frontend | `npm run dev` (Vite) | Vercel (`https://superrag.cloud`) |
| Backend | `uvicorn` in your terminal | Coolify on the VPS (`https://api.superrag.cloud`) |
| Database | local Supabase (CLI/Docker) | Supabase cloud |
| Redis | local Docker compose | Upstash (`rediss://`) |
| Sandbox | laptop Docker | VPS Docker via mounted socket + host-built image |
| Deploy trigger | — | `git push origin production` |

---

## Changelog
- **2026-06-29** — Doc created. Captured the `develop → master → production` model, the
  local↔cloud parity rule + checklist, the normal promotion flow, and the
  fast-forward/worktree-cherry-pick hotfix recipes used during the cloud deploy bug-fix
  session (CORS, sandbox, metadata, image-chunk `embedding_model`, `chunk_count` total).
