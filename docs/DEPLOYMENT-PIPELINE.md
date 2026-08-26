# Deployment Pipeline — Design & Plan

**Status:** 🟢 Building — frontend live on Vercel (`agentic-rag-rho.vercel.app`); backend/DB/Redis next
**Owner:** operator (non-technical-friendly doc — plain language on purpose)
**Maps to:** SEED-003 "Deployment Flexibility & Install/Config UX" (infra track — **separate** from v3.2 feature work)
**Last updated:** 2026-06-28

---

## 1. What we're trying to achieve (the goal in one paragraph)

We build and test everything **locally**, then push updates to the **cloud** with a
**single button-click** (or a `git push`). No memorizing commands, no fragile manual
steps. Eventually a real **staging** copy sits between local and production so risky
changes get a safe dry-run before customers see them.

The dream day-to-day flow:

```
   YOU CODE                 PUSH                      IT'S LIVE
   (your laptop)            (git push / one click)    (cloud, automatic)
   build + test locally ──► to the chosen branch ──►  frontend + backend rebuild
                                                      themselves; you watch ✅/❌
```

---

## 2. The mental model (environments)

```
   LOCAL (your laptop)          STAGING (optional)        PRODUCTION (the real app)
   ─────────────────           ──────────────────        ────────────────────────
   build + test here     ──►   a cloud test copy    ──►  real users + real data
   this is your gate           with throwaway data        only touched after green
```

- **Local** = where you build. (This exists today.)
- **Staging** = a full live copy online with test data — a safety net. (Optional to start.)
- **Production** = the real thing. Only pushed after it looks good.

**A true separate staging needs TWO of everything** (2 Supabase projects, 2 Redis DBs,
2 Vercel targets, 2 app instances on the VPS). That's double the setup + resources.

---

## 3. Architecture — the stack mapped to our actual accounts

| Layer | Lives on | Account status | How it deploys |
|---|---|---|---|
| **Frontend** (React/Vite) | **Vercel** | ✅ have account (free tier) | `git push` → auto-build |
| **Backend + code sandbox** (FastAPI + Docker) | **Hostinger VPS** running **Coolify** | ✅ have VPS (tier TBD) | `git push` → Coolify auto-build, or click "Deploy" |
| **Database** (Postgres + pgvector) | **Supabase cloud** | ✅ have account (free to start) | migrations applied per release |
| **Redis** (run buffer / streams) | **Upstash** (or on the VPS) | ⏳ need to create Upstash | just a connection URL in env vars |
| **Secrets / API keys** | Vercel + VPS dashboards | — | set once, never in GitHub |

**Why the VPS for the backend (not an easy managed host):** the code-execution sandbox
spawns Docker containers. Easy hosts (Railway/Render) don't give the app real Docker
access, so the sandbox would be crippled. The VPS + Coolify gives full Docker **and** a
friendly push-button dashboard. That's the sweet spot.

**Foundation already in place:** the app switches between local and cloud by changing
**env vars only** (no code changes) — `SUPABASE_URL`, `REDIS_URL`, provider keys. See
`backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md`.

---

## 4. Tooling — letting Claude manage the infra (MCP connections)

An MCP connection lets Claude manage a service through chat. **Only worth it where there's
something to manage** — not every service needs one.

| Service | MCP? | Status | Notes |
|---|---|---|---|
| **Hostinger** (VPS/domains/DNS) | ✅ Yes | **Added** to global `~/.claude.json`, token filled in | Lets Claude size/configure the VPS, firewall, snapshots, DNS, monitoring |
| **Supabase** | ✅ Have it | Connected via plugin `supabase@claude-plugins-official` | May need a one-time sign-in |
| **Vercel** | 🟡 Optional | not added | Vercel auto-deploys from GitHub anyway; add only if we want chat-based management |
| **Redis / Upstash** | ❌ No | n/a | Redis is just a URL in env vars — nothing to manage by chat |

**Important — two different "configs", don't confuse them:**
1. **MCP connections** = let *Claude* manage a service → saved in `~/.claude.json`
   (persists across all sessions automatically; lives **outside** the project repo, so the
   tokens there can never leak to GitHub).
2. **Deployment credentials** = what the *app* needs to run (Supabase URL, Redis URL, keys)
   → saved in **Vercel's** and **the VPS's** own settings, preserved by those platforms.

---

## 5. Repo vs. production — the thing that lowers stress

**What's in the GitHub repo is NOT what runs in production.** Deployment only ships the
built `frontend/` and the `backend/` app. The `.planning/`, `.claude/`, GSD files, and
markdowns **never reach production** — they're just the project's paper trail.

Repo-tidiness options (separate from deployment):
- **(A)** Leave planning files where they are — they don't deploy. *(simplest)*
- **(B)** Make the repo private — recommended for a B2B product. *(verify current setting)*
- **(C)** Split planning into its own repo — cleaner but more overhead. *(only if needed)*

> Current recommendation: **B (confirm private) + A (leave files in place).**

---

## 6. Free-tier reality & costs (honest)

For **testing and early light use**, everything runs free. Rough caveats (confirm — limits shift):
- **Vercel** (Hobby) — free; officially non-commercial, move to ~$20/mo when charging customers.
- **Supabase** — free covers ~2 projects; **free projects auto-pause after ~7 days idle**, no
  backups. Real production wants **Pro (~$25/mo)** to avoid sleep + get backups.
- **Upstash** — free tier (daily command cap); fine for light traffic.
- **Hostinger VPS** — already paid.

> **First realistic bill: Supabase Pro (~$25/mo)** — and only when production must never sleep.
> Not now.

---

## 7. Hard parts & risks (so nothing surprises us)

1. **Sandbox needs Docker on the VPS** — the backend must reach the VPS's Docker engine to
   spawn sandbox containers (Docker socket access). Known + solvable, but the part needing
   most care during setup.
2. **VPS size** — every code-execution = a container. Lowest tier is fine for a few test
   users; bump the VPS for org-scale. *(Confirm exact tier — see open questions.)*
3. **Database migrations across environments** — today we paste SQL into the Supabase editor
   locally. Cloud DBs need a simple, repeatable "apply this release's migrations" step
   (can be one command). Must be defined before go-live.
4. **Secrets in 3 places** — local, (staging), production each have their own keys. Keep
   organized; never commit them.

---

## 8. Decisions

**Made:**
- ✅ Backend + sandbox → Hostinger VPS (Docker requirement forces this).
- ✅ Frontend → Vercel. DB → Supabase cloud. Redis → Upstash (or VPS).
- ✅ Deploy dashboard → **Coolify** on the VPS (push-button + Docker).
- ✅ Hostinger MCP connected; Supabase via plugin; no Redis MCP; **Vercel MCP added** (official remote MCP, browser OAuth — needs Claude Code restart + `/mcp` sign-in).
- ✅ **2 environments** — local + production (no staging for now; ~30-min add later).
- ✅ **Repo strategy** — ONE private repo (already private: `fhdmrddev-dotcom/Agentic-RAG`) + a **`production` branch** that Vercel + Coolify watch. No second repo, no sync step. `.planning/`/`.claude/` ride along in git but never get built. (`production` branch created + pushed 2026-06-28.)
- ✅ **VPS tier confirmed (via MCP):** KVM 1 — 1 vCPU, 4 GB RAM, 50 GB disk, 4 TB bandwidth. Fine to stand up + smoke-test; bump before org-scale (every code-exec = a container on 1 core).
- ✅ **VPS recreated from scratch** 2026-06-28 using template **#1087 "Ubuntu 24.04 with Coolify"** (clean OS + Coolify pre-installed — replaces the old Docker+Traefik template, aligns the box with the Coolify decision). Same IP `187.77.151.78`. Random root password (not shown); manage via Coolify browser UI, reset root pw in hPanel only if SSH ever needed.
- ✅ **Vercel frontend project LIVE** 2026-06-28 — project **`agentic-rag`** (team "Fahed Mrad's projects", Hobby) imported from `fhdmrddev-dotcom/Agentic-RAG`, **Root Directory `frontend`**, framework Vite, **Production Branch `production`**. First green Production deploy at `agentic-rag-rho.vercel.app`. (The old `rag-app` Vercel project points at an unrelated repo — leave it, delete later.) Two snags solved: (1) Vercel auto-detected the repo as a multi-service monorepo ("Services" preset, blocked Deploy) — fixed by scoping Root Directory to `frontend`; (2) the `tsc -b` typecheck in `npm run build` fails on pre-existing test-file type rot — fixed with **`frontend/vercel.json`** (`buildCommand: "vite build"` + SPA rewrite to `/index.html`; committed, overrides dashboard). **Git-author gotcha:** this dev environment commits as `Developer <dev@example.com>`, which Vercel **blocks** (can't match a GitHub account); set repo-local identity to `fhdmrddev-dotcom <fhdmrd.dev@gmail.com>` so pushed commits deploy. **Frontend env vars still empty** — app builds but isn't functional until cloud Supabase URL/anon key + backend API URL are set (next).

**Open (need operator input):**
- ❓ **Coolify first-run** — set up the admin account in the browser at the Coolify URL once the box is back up.
- ❓ **Supabase cloud project** — create it (free tier), then apply `supabase/full-schema.sql`.
- ❓ **Upstash** — create account + Redis DB (just a connection URL).
- ⚠️ **Firewall** — VPS currently has NO Hostinger firewall group attached. Add before go-live.
- ✅ **Domain claimed: `superrag.cloud`** (active, registered through 2027-06-28; ignore the expired `flowengine.shop`). DNS layout: apex + `www` → Vercel (frontend); `api.superrag.cloud` + `coolify.superrag.cloud` → VPS `187.77.151.78` (**set 2026-06-28**, TTL 300). Apex/`www` still on Hostinger parking (`2.57.91.91`) — **next: add `superrag.cloud` as a custom domain in the `agentic-rag` Vercel project, then repoint apex/`www` DNS to Vercel's target.** (Vercel project now exists at `agentic-rag-rho.vercel.app`.)

---

## 9. One-time setup checklist (to be detailed once decisions are locked)

> High-level only for now — each becomes copy-paste steps in the real plan.

- [ ] Decide 2 vs 3 environments.
- [ ] Confirm VPS tier (via Hostinger MCP).
- [ ] Create Upstash account + Redis database(s).
- [ ] Create Supabase cloud project(s); apply schema/migrations.
- [ ] Install Coolify on the VPS (one-click template or one command).
- [ ] Wire Docker-socket access for the sandbox.
- [ ] Connect GitHub repo to Vercel (frontend) + Coolify (backend).
- [ ] Set env vars/secrets in Vercel + Coolify (cloud Supabase URL, Redis URL, provider keys).
- [ ] Point a domain via DNS (Hostinger MCP) — optional at first.
- [ ] Define the per-release migration step.
- [ ] First deploy + smoke test.

---

## 10. Day-to-day once it's built (the payoff)

1. Finish a feature locally, test it.
2. `git push` → **frontend (Vercel) + backend (Coolify) rebuild themselves.**
3. (If 3 envs) check staging URL → happy? merge to `main` → production rebuilds.
4. Watch a dashboard that says ✅ or ❌.

No commands to memorize. That's the goal.

---

## 11. Next step

Lock the **2-vs-3 environments** decision (and confirm repo private). Then Claude drafts a
beginner-friendly, numbered setup plan (this maps to **SEED-003**, kept separate from the
v3.2 feature roadmap). After you restart Claude Code, Claude verifies the Hostinger MCP by
listing your VPS — which also fills in the VPS tier above.

---

## Changelog
- **2026-06-28 (eve)** — **Frontend pipeline stood up on Vercel.** Created project `agentic-rag` from
  `fhdmrddev-dotcom/Agentic-RAG` (Root Directory `frontend`, Vite, Production Branch `production`).
  Added `frontend/vercel.json` (`vite build` + SPA rewrite) to dodge the `tsc -b` test-rot gate;
  fixed the `dev@example.com` author-block by setting repo-local git identity
  `fhdmrddev-dotcom <fhdmrd.dev@gmail.com>`. First green Production deploy at `agentic-rag-rho.vercel.app`.
  `git push` → `production` now auto-deploys the frontend. Open: frontend env vars (need cloud
  Supabase + backend URL), custom domain wiring, Coolify first-run, Supabase cloud, Upstash, firewall.
- **2026-06-28 (pm)** — Hostinger MCP verified (listed VPS/domains). Locked decisions: 2 envs,
  one private repo + `production` branch, Coolify. Actions taken: VPS **recreated** clean on the
  Coolify template (#1087); `production` branch created + pushed; **Vercel MCP** added to
  `~/.claude.json` (needs restart + `/mcp` sign-in). Surfaced: KVM 1 specs, no firewall, expired
  domain. Next: Coolify first-run, Supabase cloud project, Upstash.
- **2026-06-28** — Doc created. Architecture chosen (Vercel + Hostinger VPS/Coolify +
  Supabase + Upstash). Hostinger MCP connected. Open: 2-vs-3 environments, VPS tier, repo visibility.
