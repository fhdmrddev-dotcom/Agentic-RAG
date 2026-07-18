---
phase: 157
slug: deployment-presets-runbook-stretch
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
---

# Phase 157 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **This is a docs + reference-config phase — there is NO automated app-test surface.**
> Validation is (a) static existence / parse / lint checks on the artifacts and
> (b) the D-09 operator-run LOCAL smoke test. Do NOT manufacture pytest/vitest
> targets for compose files, nginx config, `.env` presets, or markdown docs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — static checks only (no unit-test surface for docs/config artifacts) |
| **Config file** | none |
| **Quick run command** | `docker compose -f docker-compose.prod.yml config` (parses + interpolates — exit 0) |
| **Full suite command** | D-09 LOCAL smoke: `docker compose -f docker-compose.prod.yml up --build` (one-box preset → local Supabase via `host.docker.internal` + bundled redis) then curl `/health` → 200 |
| **Estimated runtime** | ~5–10 s static checks · ~3–6 min first `--build` for the smoke |

### Static checks (per artifact)

| Check | Command / assertion |
|-------|---------------------|
| Compose validity | `docker compose -f docker-compose.prod.yml config` exits 0 (parses + interpolates the root `.env`) |
| nginx syntax | `docker run --rm -v "$PWD/frontend/nginx.conf:/etc/nginx/conf.d/default.conf" nginx:1.27-alpine nginx -t` |
| Preset key sanity | every key in `deploy/*.env.example` exists in `backend/.env.example` OR is a documented gap (`FRONTEND_URL`, `ENVIRONMENT`, `VITE_*`) |
| Doc cross-links | `docs/OPERATOR.md` links to the 3 `docs/DEPLOYMENT-*.md` resolve; no dead reference to the superseded guide except the explicit "supersedes" note; recovered guide carries a "superseded by docs/OPERATOR.md" header note (file NOT deleted) |
| `.dockerignore` secret exclusion | `frontend/.dockerignore` excludes `.env*` so `.env.local` never enters the image |

---

## Sampling Rate

- **After every artifact commit:** Run the relevant static check — `docker compose config` after compose edits; `nginx -t` after nginx edits; preset-key trace after preset edits; link-resolve after OPERATOR.md edits.
- **After all artifacts exist:** Run every static check green.
- **Before `/gsd:verify-work`:** The full D-09 LOCAL smoke must be green — it is the ONLY end-to-end exercise of the new compose file (the live box uses `backend/Dockerfile` via Coolify, not this compose).
- **Max feedback latency:** ~10 s for static checks; the smoke is a one-time phase gate.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This map keys expected proof to the phase's
> net-new artifacts. Each artifact task's `<acceptance_criteria>` MUST include its
> static check below; SC#3 is proven once by the operator-run smoke (Manual-Only).

| Artifact | Requirement | Test Type | Automated / Static Command | Proof |
|----------|-------------|-----------|-----------------------------|-------|
| `deploy/onebox.env.example` (author FIRST) | DEPLOY-01 / SC#1 | static | key-trace vs `backend/.env.example` | every key traces to `.env.example` or a documented gap |
| `frontend/Dockerfile` + `nginx.conf` + `.dockerignore` | DEPLOY-01 / SC#1 | static | `nginx -t`; `.dockerignore` greps `.env*` | nginx syntax OK; secrets excluded |
| `docker-compose.prod.yml` | DEPLOY-01 / SC#1 | static | `docker compose -f docker-compose.prod.yml config` | exit 0 (interpolation + build.args + `extra_hosts` resolve) |
| `docs/OPERATOR.md` (+ recovered-guide header note) | DEPLOY-01 / SC#2 | static + review | link-resolve; baked-in A4/A5/A6/B1/B2/B3/SEC-01 present; supersede note present | cross-links resolve; lessons baked in |
| End-to-end deployment | DEPLOY-01 / SC#3 | **live smoke (manual)** | D-09 smoke (see Manual-Only) | `/health` 200 + login + one chat turn |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **None in the test-infrastructure sense** — there is no framework to install and no app-test surface for these artifacts.
- [ ] The "Wave 0"-equivalent ordering constraint: author `deploy/onebox.env.example` **first**, because both the compose `build.args`/interpolation and the backend `env_file:` runtime read from it — every other artifact depends on the env surface being settled.

*Existing infrastructure covers all phase requirements: N/A — this phase adds no code, so no test infra is needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-09 one-box smoke: the new compose stack actually serves a working app | DEPLOY-01 / SC#3 | Requires the operator to run Docker locally and confirm a real chat turn in a browser; no automated harness exercises the built compose end-to-end | 1. `cp deploy/onebox.env.example .env`; fill LOCAL Supabase URL/keys + one AI key + `SECRETS_ENCRYPTION_KEY`. 2. Operator runs `docker compose -f docker-compose.prod.yml up --build`. 3. Claude curls `http://localhost:<port>/health` → expect `200 {"status":"ok"}`. 4. Operator opens the nginx frontend in a browser, logs in (test creds), sends **one non-code chat turn**, confirms a reply. 5. Green = SC#3 satisfied. Landmines to watch: `VITE_*` must reach the frontend via `build.args` (build-time, not `env_file:`); `host.docker.internal` needs `extra_hosts: host-gateway` on Linux. |

---

## Validation Sign-Off

- [x] Every artifact task's `<acceptance_criteria>` includes its static check from the Per-Task map
- [x] Sampling continuity: each artifact commit runs its relevant static check
- [x] Wave 0 equivalent honored: `deploy/onebox.env.example` authored before compose/OPERATOR consume it
- [x] No watch-mode flags (N/A — no test runner)
- [ ] D-09 smoke green before `/gsd:verify-work` — pending 157-05 execution
- [x] `nyquist_compliant: true` set in frontmatter (checks wired into plan tasks — verified by gsd-plan-checker)

**Approval:** approved 2026-07-17 (gsd-plan-checker: 0 blockers; the D-09 smoke box stays open until 157-05 runs)
