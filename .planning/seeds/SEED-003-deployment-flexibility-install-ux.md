---
id: SEED-003
status: dormant
planted: 2026-05-02
planted_during: v2.5 (after Phase 059 ship, before Phase 060 kickoff)
trigger_when: planning a milestone scoped to "distribution", "self-host", "packaging", "install", "deployment", "one-click setup", "enterprise install", or any milestone where the install/config experience for a non-developer operator becomes the bottleneck
scope: Large
---

# SEED-003: Deployment Flexibility & Install/Config UX

## Why This Matters

Today the app effectively assumes one deployment shape: a developer who can run a Python venv, a Vite dev server, a Supabase instance (local Docker or cloud), and a Docker daemon for the sandbox. That works for the people building it. It does not work for the actual range of intended users:

- **Single user, local install** — somebody who wants a private AI colleague over their own documents on their own laptop. Today this requires reading a multi-page setup guide and editing env vars by hand.
- **Single user, personal cloud** — same person, but on a small VPS or a managed Postgres. Today the deployment story for "production-but-just-me" is undocumented.
- **Small organization (5–50 users)** — a department or small company self-hosting on a single server. Today there is no install wizard, no operator UI, no scale-tier preset.
- **Mid/large organization (100s–10k+ users)** — needs k8s-shaped deployment, secrets management, horizontal scaling story. Today none of this is packaged.

The blocker is not the runtime architecture (the FastAPI + React + Supabase stack already runs in all of these shapes). The blocker is **everything around it**: install path, configuration UX, secrets management, deployment topology selection, scale-tier defaults, upgrade story.

This is genuinely large, genuinely cross-cutting, and would dilute any feature milestone if smuggled in. It deserves its own scoped milestone (or two) when feature velocity slows.

## When to Surface

**Trigger:** planning a milestone scoped to distribution, self-host, packaging, install UX, or enterprise deployment. Strong signals:
- Milestone description mentions "install", "deploy", "packaging", "distribution", "one-click", "self-host", "enterprise", or "operator UX"
- A pre-launch or pre-distribution readiness review is underway
- Inbound requests appear from non-developer users asking "how do I install this"
- A decision is being made about which Supabase deployment shapes to officially support
- Sales/distribution conversation starts (open source release, paid tier, hosted offering)

This seed should also be cross-checked against **SEED-004** (multi-tenancy) when planning. SEED-004 needs deployment substrate decisions — but the two can be planned independently as long as the tenancy seed doesn't lock in a deployment shape that this seed would disagree with.

## Scope (when triggered)

Likely scope when this becomes a milestone (or set of phases):

1. **Deployment-shape inventory & officially supported targets**
   Decide which deployment shapes are first-class supported, which are best-effort, which are explicitly unsupported. Candidates:
   - Single-binary / single-container "demo" mode (SQLite or embedded Postgres, no Supabase, sandbox optional) — for evaluators who want it running in 60 seconds
   - Docker Compose stack (Postgres + app + sandbox) — for single-user local production
   - Supabase Cloud + app container — for single-user / small-org cloud
   - Self-hosted Supabase + app — for orgs that want full control
   - Kubernetes (Helm chart) — for mid/large orgs

2. **Install wizard / first-run experience**
   - Browser-based first-run wizard: pick deployment shape → enter secrets → create admin user → choose model provider(s) → optional skills bootstrap → done
   - Replace "edit `.env` and restart" with an admin-only Settings UI for things that aren't secrets
   - Detect environment (Docker available? GPU? Postgres reachable? sandbox enabled?) and surface clearly in the wizard
   - Sane defaults per scale tier (single-user vs small-org vs enterprise) — workers count, AnyIO limit, rate limits, sandbox timeout, model provider preference

3. **Secrets management story**
   - Today: secrets are env vars. That works for `docker run` but not for k8s, not for ops teams that won't paste production secrets into a `.env` file
   - Decide: env vars only? File-based secrets (Docker/K8s-native)? Vault integration? Supabase Vault for app-level secrets?
   - Decide what is "infra secret" (DB URL, JWT secret) vs "app config" (model preferences, feature flags) — current rule says env vars are for secrets and infra only; this needs operationalizing

4. **Configuration UX**
   - Per-tenant / per-deployment settings (already have `app_settings` and `user_settings` — extend, don't replace)
   - Operator settings page distinct from end-user Settings page
   - Diagnostic/health page: "your install is missing X, Y is misconfigured"
   - Upgrade story: how does a 2026-Q3 install get to 2026-Q4 cleanly? Migration story for app_settings + schema migrations + skill catalog

5. **Packaging & distribution artifacts**
   - Official Docker images (versioned, signed)
   - `docker-compose.yml` reference stack
   - Helm chart or k8s manifests
   - Possibly: installer scripts for common shapes (`curl … | sh` style, with the user confirming each step)
   - Release process: tag → build → publish → changelog → upgrade notes

6. **Scale-tier presets**
   - Tier 1 (single user, local): 1 worker, AnyIO 200, no rate limits, sandbox optional, all telemetry off
   - Tier 2 (small org): N workers (CPU count), AnyIO higher, soft rate limits, telemetry opt-in
   - Tier 3 (enterprise): k8s, asyncpg hot path (depends on SEED-001), Redis for cross-worker state, full telemetry, sticky sessions if Realtime returns

## Why This Seed Avoids Doing It Now

Planting (vs scoping into v2.5 or v3.0) prevents:
- Over-investment in install UX before the feature surface stops moving (each new feature would mean updating the wizard)
- Locking in a deployment topology before SEED-001 (scale readiness) has produced real production telemetry
- Locking in a tenancy model before SEED-004 has decided isolated-vs-co-tenant — the tenancy decision shapes packaging
- Building Helm charts for a system that may still grow new infra dependencies (Redis, queue, vector store changes)

The right time is **after** the feature surface is stable AND **after or alongside** the tenancy decision (SEED-004), but **before** any external distribution / launch / paid tier conversation goes live.

## Companion Documents

- `.planning/PROJECT.md` — Constraints section: "Supabase deployment: Agnostic — works with local Docker or cloud" — this seed operationalizes that promise
- `.planning/PROJECT.md` — Out of Scope: "Multi-tenancy / Org-level transform" — coupled but distinct (SEED-004)
- `.planning/seeds/SEED-001-scale-readiness.md` — defines the "production scale" shape this seed packages for
- `.planning/seeds/SEED-004-org-multi-tenancy.md` — defines the tenancy model this seed packages for
- Existing `app_settings` / `user_settings` tables and Settings UI — the foundation to extend, not replace

## Decision Triggers

Surface this seed during `/gsd:new-milestone` if any of the following are true:
- Milestone scope mentions install, deploy, distribution, packaging, operator, self-host, or one-click
- A non-developer install path is being discussed
- A "how do we ship this" or "how do we let others install this" conversation is underway
- A decision about official deployment shapes (compose vs k8s vs SaaS vs all) is being made
- Inbound from users / customers / evaluators who can't get past the current install steps

## Notes

**Suggested decomposition when this seed surfaces:**

This is probably 2 milestones, not 1:
- **First milestone**: pick supported deployment shapes, build first-run wizard, formalize operator vs end-user settings split, ship Docker Compose reference stack. Targets the single-user-local and small-org cases.
- **Second milestone** (if/when needed): Helm chart, secrets management beyond env, scale-tier presets, upgrade automation. Targets the enterprise case. Depends on SEED-001 + SEED-004 being resolved.

**Why a wizard at all rather than "just better docs":**
Documentation can explain a process; it cannot detect that the user's Docker daemon isn't running, or that their Supabase URL is wrong, or that they typed their JWT secret into the wrong field. The first-run experience is where adoption is won or lost — in this category of app, "I tried to install it for an hour and gave up" is the dominant failure mode for non-developers.

---
*Planted 2026-05-02 between Phase 059 ship and Phase 060 kickoff. User flagged that the existing scale seed (SEED-001) covers concurrent-user runtime load but does not cover the install/config flexibility needed to actually serve a single local user, a personal cloud install, a 50-person org, or a 10,000-person org from the same codebase.*
