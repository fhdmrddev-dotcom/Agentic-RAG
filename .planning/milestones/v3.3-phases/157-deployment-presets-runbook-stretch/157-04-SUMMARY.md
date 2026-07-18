---
phase: 157-deployment-presets-runbook-stretch
plan: 04
subsystem: docs
tags: [operator-runbook, deployment, docker-compose, fresh-db-bootstrap, self-host, four-homes, security, cross-link]

# Dependency graph
requires:
  - phase: 157-01
    provides: "deploy/onebox.env.example — the env surface OPERATOR.md walks (cp -> ./.env, fill, Fernet key)"
  - phase: 157-02
    provides: "frontend/nginx.conf + Dockerfile — the :8080 ingress + /api/ rewrite the happy path opens against"
  - phase: 157-03
    provides: "docker-compose.prod.yml — the all-in-one stack `docker compose -f docker-compose.prod.yml up -d --build` stands up"
  - phase: 150-secrets-at-rest
    provides: "SECRETS_ENCRYPTION_KEY (Fernet, blank=plaintext+warn / malformed=refuse-boot) documented in the Security section"
  - phase: 146-operator-role
    provides: "OPERATOR_EMAILS bootstrap — documented as the REAL /admin gate (ENVIRONMENT is only a deploy marker now)"
provides:
  - "docs/OPERATOR.md — the day-0 stand-up-from-zero operator runbook (canonical home-B happy path + fresh-DB bootstrap + baked-in LESSONS + managed/A + C/D variant-deltas + verification checklist)"
  - "The superseded-history header note on the recovered VPS guide (file preserved, not deleted)"
affects: [157-05-d09-smoke, 158-install-wizard]

# Tech tracking
tech-stack:
  added: []  # docs only — no npm/pip/cargo packages, no Docker images
  patterns:
    - "Cross-link-not-duplicate: OPERATOR.md links the 3 DEPLOYMENT-*.md single sources; managed-map + day-2 promotion stay single-sourced (D-07)"
    - "Bake-in-lessons: each first-deploy gotcha (A3/A4/A5/A6/B1/B2/B3/SEC-01) is encoded inline where the operator meets it, tagged to its lessons-log entry (D-08)"
    - "4-homes framing: one codebase, home = configuration not a code change; scale is a dial inside a home (D-04)"

key-files:
  created:
    - docs/OPERATOR.md
  modified:
    - .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md

key-decisions:
  - "Recovered-guide note phrased so the literal contiguous string 'superseded by docs/OPERATOR.md' appears (markdown-link punctuation would break the acceptance grep token); a resolvable clickable link is provided separately in the same note"
  - "Happy path uses `cp deploy/onebox.env.example ./.env` (repo-root, not backend/.env) — matches the actual 157-01 preset header + the 157-03 compose `env_file: ./.env` (RESEARCH Q1 RESOLVED)"
  - "Documented ENVIRONMENT as a deploy marker ONLY, NOT the /admin gate — OPERATOR_EMAILS + operator_users is the real control (Phase 146 correction, RESEARCH Q4)"
  - "Homes B + A fully documented; C/D ship as SHORT variant-delta sections; the full sealed air-gapped runbook is explicitly deferred (D-04/D-05)"
  - "Documented the ACTUAL shipped contracts (nginx :8080, redis service `redis`, backend :8000, /api/ strip via rewrite, host.docker.internal) from the 157-01/02/03 artifacts, not the RESEARCH placeholders"

patterns-established:
  - "Operator runbook = canonical happy path first, then baked-in gotchas tagged to a lessons log, then short variant-deltas for the non-primary homes, then a run-on-a-real-box verification checklist"

requirements-completed: []  # DEPLOY-01 is phase-spanning (preset + frontend image + compose + OPERATOR.md + D-09 smoke). This plan authors ONLY the runbook; DEPLOY-01 stays OPEN until the Plan 05 D-09 smoke lands and the phase is verified (project false-green-avoidance convention, matching 157-01/02/03)

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 157 Plan 04: Day-0 Operator Runbook (OPERATOR.md) Summary

**`docs/OPERATOR.md` — the stand-up-from-zero operator runbook: the canonical home-B one-box `docker compose` happy path + the A6 fresh-DB bootstrap (full-schema + 9 seed migrations + the `app_settings 'global'` row) + baked-in LESSONS fixes (A3/A4/A5/B1/B2/B3/SEC-01) + a LOUD single-tenant docker.sock constraint + the managed (home A) variant map + short C/D variant-deltas + a real-box verification checklist, cross-linking (never duplicating) the 3 `docs/DEPLOYMENT-*.md`. The recovered VPS guide is preserved with a `superseded by docs/OPERATOR.md` header note.**

## Performance

- **Duration:** ~20 min (context load + authoring + static cross-link/token verification + commits)
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files:** 1 created (`docs/OPERATOR.md`, 360 lines), 1 modified (recovered guide, +8-line note only)

## Accomplishments
- Authored `docs/OPERATOR.md` (SC#2) — the front-door day-0 runbook that supersedes the recovered bare-VPS guide and walks a fresh operator to a working deployment.
- Wrote the canonical **home-B happy path** against the ACTUAL shipped artifacts: `git clone` → `cp deploy/onebox.env.example ./.env` → fill Supabase/keys + one provider key + `OPERATOR_EMAILS` + a generated Fernet `SECRETS_ENCRYPTION_KEY` → `docker compose -f docker-compose.prod.yml up -d --build` → open `http://localhost:8080` (the nginx ingress the 157-03 compose publishes).
- Baked in the **A6 fresh-DB bootstrap** with exact filenames verified against the live `supabase/migrations/` directory: paste `full-schema.sql` (Run without RLS), then the 9 seed migrations (`010`, `018`, `053`, `056`, `061`, `066`, then `087 → 088 → 089` in order), then `INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;`, then the skill-creator verify `SELECT` (expect 1).
- Baked in the remaining LESSONS fixes where the operator meets them: A4 (session pooler `:5432` IPv4, warns off `:6543` / direct `db.<ref>`), A5 (`rediss://` TLS for managed Redis), B1 (comma-split multi-origin `FRONTEND_URL`), B3 (pin known-good models per env), A3 (Coolify base-dir `/backend` + Ports 8000 + Domain `https://`, managed only), SEC-01 (`SECRETS_ENCRYPTION_KEY` generate + blank=plaintext-warn / malformed=refuse-boot).
- Encoded the **T-157-EOP mitigation** as a LOUD single-tenant-only callout on the `/var/run/docker.sock` = host-root mount, plus the `sandbox-image-keeper` pin + GHCR durable-fix note (B2).
- Documented **home A** as a document-only variant cross-linking `DEPLOYMENT-PIPELINE.md`, and **homes C/D** as short variant-deltas (home D: `LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL` + `EMBEDDING_BASE_URL` + self-hosted Supabase — zero new app code), with the full sealed air-gapped runbook explicitly deferred.
- Added a real-box **verification checklist** (/health 200 direct + through nginx, frontend loads, login, one non-code chat turn).
- Added the `superseded by docs/OPERATOR.md` header note to the recovered guide (kept as history; body untouched).
- Proved the doc **static cross-link + token check green**: all 6 baked-in tokens present (`full-schema`, `5432`, `rediss://`, `FRONTEND_URL`, `single-tenant`, `SECRETS_ENCRYPTION_KEY`), all 10 cross-link targets resolve on disk (incl. the 3 DEPLOYMENT-*.md), and both back-links resolve.

## Task Commits

Each task was committed atomically (docs-only; no app code, no STATE/ROADMAP):

1. **Task 1: Author the home-B happy path + fresh-DB bootstrap + cross-links** — `2c6df0c9` (docs)
2. **Task 2: Bake in remaining LESSONS + managed (A) + C/D deltas + verification checklist** — `a1977ec8` (docs)
3. **Task 3: Add the superseded header note to the recovered guide + validate cross-links** — `e1e51030` (docs)

_Plan metadata (this SUMMARY) committed separately after this file._

## Files Created/Modified
- `docs/OPERATOR.md` (created, 360 lines) — day-0 runbook: framing + 4-homes model + cross-links section + prerequisites + home-B happy path (clone → `./.env` → fresh-DB bootstrap → `docker compose up` → open `:8080`) + Configuration gotchas (A4/A5/B1/B3) + Security (SEC-01/B2/redis) + Home A managed variant (A3) + Homes C/D variant-deltas + Verification checklist.
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` (modified, +8 lines) — a top note block marking it `superseded by docs/OPERATOR.md`, with a do-not-follow warning and a resolvable link; the historical body is unchanged (561 → 569 lines).

## Decisions Made
- **Literal supersede token:** the note is worded so the exact contiguous string `superseded by docs/OPERATOR.md` appears (a markdown link `superseded by [docs/OPERATOR.md](...)` would have interrupted the phrase and failed the Task 3 acceptance grep). A resolvable clickable `[docs/OPERATOR.md](../../../docs/OPERATOR.md)` is provided separately in the same note.
- **`./.env` not `backend/.env`:** the happy path copies the preset to the repo-root `./.env`, matching the 157-01 preset usage-header and the 157-03 compose `env_file: ./.env` (RESEARCH Q1 RESOLVED). The CONTEXT `<specifics>` mentioned `backend/.env`, but the shipped artifacts settled on root `./.env` (it feeds BOTH the frontend `VITE_*` build-arg interpolation and the backend runtime env) — documenting the shipped reality, not the earlier sketch.
- **ENVIRONMENT correction:** written as a deploy marker only, explicitly NOT the `/admin` control (Phase 146 replaced the old env gate with `require_operator` + `OPERATOR_EMAILS` + `operator_users`), per the RESEARCH Q4 correction anchor.
- **Documented the shipped contracts, not the research placeholders:** nginx publishes `:8080` (compose `8080:80`), the `/api/` prefix is stripped by a `rewrite` (157-02's variable-upstream fix, not a trailing-slash `proxy_pass`), redis is the service `redis`, backend is `:8000`, and `host.docker.internal` reaches a local Supabase — all taken from the 157-01/02/03 SUMMARYs and the on-disk artifacts.
- **Scope honored:** homes B + A full, C/D short deltas, air-gapped deferred (D-04/D-05); every cross-link points out to the single-source DEPLOYMENT-*.md rather than duplicating the accounts map or the branch-promotion checklist (D-07).

## Deviations from Plan

None — plan executed as written. Both the OPERATOR.md content and the recovered-guide note satisfy every `<acceptance_criteria>` item across all three tasks. The one execution-time adjustment (phrasing the supersede note so the literal grep token is contiguous) is a correctness measure taken to MEET a Task 3 acceptance criterion, not a departure from plan intent — logged under Decisions Made. No app code, STATE.md, or ROADMAP.md was touched (per the sequential-executor instruction).

## Known Stubs
None. This is a documentation artifact — no code, no data-flow stubs, no unwired components. The `<angle-bracket>` tokens inside the doc's example env/DSN snippets are the correct fill-me form for a runbook (mirroring `deploy/onebox.env.example`), not stubs.

## Threat Surface
No new surface — this plan authors documentation only. It ENCODES the plan's `<threat_model>` mitigations rather than introducing surface:
- **T-157-EOP** (mitigate) — the LOUD "SINGLE-TENANT BOXES ONLY" callout on the `/var/run/docker.sock` = host-root mount is present, with the `sandbox-image-keeper` pin + GHCR durable fix; the doc constraint IS the control.
- **T-157-KEY** (mitigate) — the Security section documents generating + setting `SECRETS_ENCRYPTION_KEY` and its blank=plaintext-warn / valid=encrypt / malformed=refuse-boot behavior.
- **T-157-COR** (mitigate) — the comma-split multi-origin `FRONTEND_URL` guidance (list every live origin) is present.
- **T-157-TLS** (mitigate) — `rediss://` for managed Redis, the session pooler DSN, cloud Supabase `https://`, and managed Coolify domain `https://` (A3) are all documented.
- **T-157-RED** (mitigate) — the "don't expose Redis / no host port / never publish 6379 without `--requirepass`" note is present.
- **T-157-SC** (accept) — docs-only; no packages/images authored; slopcheck N/A.

No `threat_flag:` entries — a runbook introduces no network endpoint, auth path, or schema surface not already in the register.

## Issues Encountered
None. (Harmless Git `LF will be replaced by CRLF` notices on Windows — line-ending normalization only — on all three commits.) Static verification (token grep + cross-link resolution) ran clean; no Docker/live checks are in this plan's scope (the live `docker compose up` end-to-end proof is the Plan 05 D-09 smoke, by design).

## User Setup Required
None for this plan — it authors committable documentation. The operator-facing setup that OPERATOR.md itself describes (copy the preset, fill secrets, generate the Fernet key, bootstrap the DB, `docker compose up`) is walked in the doc and exercised end-to-end by the Plan 05 D-09 smoke.

## Next Phase Readiness
- `docs/OPERATOR.md` is complete and statically verified — **Plan 05 (D-09 smoke)** can now follow it verbatim: `cp deploy/onebox.env.example ./.env` → fill the local-smoke URL split (browser `VITE_SUPABASE_URL=http://127.0.0.1:54321` vs backend `SUPABASE_URL=http://host.docker.internal:54321`) → `docker compose -f docker-compose.prod.yml up -d --build` → verify `/health` 200 both direct (`:8000`) and through nginx (`:8080/api/health`) → one non-code chat turn.
- **DEPLOY-01 stays OPEN** until the Plan 05 D-09 smoke passes and the phase is verified (false-green-avoidance convention, matching 157-01/02/03).
- No blockers. All documented contracts match the on-disk artifacts (preset, compose, nginx).

## Self-Check: PASSED
- `docs/OPERATOR.md` — FOUND (360 lines)
- `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` — FOUND (569 lines, note present, body intact)
- Commit `2c6df0c9` (Task 1) — FOUND
- Commit `a1977ec8` (Task 2) — FOUND
- Commit `e1e51030` (Task 3) — FOUND
- Scope boundary held — only the two target files touched; no STATE.md / ROADMAP.md / app code modified.

---
*Phase: 157-deployment-presets-runbook-stretch*
*Completed: 2026-07-16*
