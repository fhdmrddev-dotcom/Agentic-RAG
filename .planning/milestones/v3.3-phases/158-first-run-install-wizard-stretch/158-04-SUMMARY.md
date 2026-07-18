---
phase: 158-first-run-install-wizard-stretch
plan: 04
subsystem: infra
tags: [bash, ci, github-actions, docker-compose, deployment, drift-check, setup-store]

# Dependency graph
requires:
  - phase: 157-deployment-presets-runbook-stretch
    provides: "deploy/onebox.env.example preset + docker-compose.prod.yml + docs/OPERATOR.md Home-B runbook (the static artifacts this drift-check keeps honest)"
  - phase: 158-first-run-install-wizard-stretch (plan 02)
    provides: "migration 102 (app_settings.setup_complete) — referenced in the OPERATOR.md migration-currency note"
  - phase: 158-first-run-install-wizard-stretch (plan 03)
    provides: "services/setup_store.py (writes /data/setup.json 0600) — the code the setup_data volume persists"
provides:
  - "scripts/check-deploy-drift.sh — a 4-check static-tree drift gate for the Phase-157 deploy artifacts (preset keys, seed list, sandbox tag, compose parse) with an OMITTED_FROM_ONEBOX allowlist"
  - ".github/workflows/deploy-artifacts.yml — a lightweight deploy-drift CI job (ubuntu-latest, bash run, no new secrets/actions)"
  - "docker-compose.prod.yml setup_data:/data named volume on the backend service (D-02 compose half of the install-wizard setup-store)"
  - "CLAUDE.md 'Deployment-artifact parity (same-commit rule)' — the process control the drift-check enforces"
  - "docs/OPERATOR.md browser-wizard callout + setup_data volume note + migration-currency bump to 102"
affects: [future phases touching env vars / seed migrations / bundled services / sandbox tag, 158 wizard finalize plans (setup_data persistence), cloud-parity promotion]

# Tech tracking
tech-stack:
  added: []  # zero new deps — bash + GitHub Actions already present
  patterns:
    - "static-tree drift gate with a curated OMITTED_FROM_ONEBOX allowlist (naive env diff = 42 false positives)"
    - "same-commit deployment-artifact parity rule (analog of the Dockerfile.sandbox ↔ SANDBOX-PACKAGES.md sync)"
    - "docker-unavailable graceful fallback (structural check + loud WARN) so CI without docker still runs 3/4 checks"

key-files:
  created:
    - scripts/check-deploy-drift.sh
    - .github/workflows/deploy-artifacts.yml
  modified:
    - docker-compose.prod.yml
    - CLAUDE.md
    - docs/OPERATOR.md

key-decisions:
  - "check #3 (sandbox tag) implemented as 'every agentic-rag-sandbox:<tag> reference across preset/CLAUDE.md/OPERATOR.md/backend must be one value == the preset SANDBOX_IMAGE' — the Dockerfile itself carries no tag, so the build-command `-t` string is the checkable intent"
  - "check #2 WARN excludes the ubiquitous app_settings('global') boilerplate INSERT so it surfaces only genuine candidate seeds"
  - "OPERATOR.md references 'migration 102' in prose (not the .sql filename) so the drift-check seed extraction stays scoped to the 9 Step-3 seeds (highest listed stays 089)"
  - "added an explicit SETUP_STORE_PATH=/data/setup.json to the backend environment (plan-sanctioned optional) to self-document the volume's purpose"

patterns-established:
  - "OMITTED_FROM_ONEBOX allowlist: intentional preset omissions are registered (with a reason) in the script, never left to drift"
  - "WARN vs FAIL split: renamed/removed seed = hard fail; candidate-new-seed = non-blocking human-review WARN"

requirements-completed: []  # DEPLOY-02 is multi-plan; this plan ships only the D-16 fold + D-02 compose half — requirement stays open until the wizard plans land

# Metrics
duration: ~25min
completed: 2026-07-17
---

# Phase 158 Plan 04: Deployment-Artifact Drift-Check + setup_data Volume Summary

**A `set -euo pipefail` 4-check drift gate (`scripts/check-deploy-drift.sh`) that fails CI when the Phase-157 one-box artifacts drift, plus the `setup_data:/data` compose volume, a CLAUDE.md same-commit parity rule, and OPERATOR.md wizard/volume notes — the folded D-16 + D-02 compose half of DEPLOY-02.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-17
- **Tasks:** 3
- **Files created/modified:** 5 (2 created, 3 modified)

## Accomplishments
- **`scripts/check-deploy-drift.sh`** — a dependency-free bash gate mirroring `pending-cloud-migrations.sh`, with 4 static-tree checks: (1) preset keys `backend/.env.example` vs `deploy/onebox.env.example` minus a curated **42-key `OMITTED_FROM_ONEBOX`** allowlist (a naive diff yields 42 false positives); (2) every OPERATOR.md Step-3 seed migration exists (+ a soft WARN on candidate new seeds above the highest listed); (3) the `SANDBOX_IMAGE` tag is consistent across preset/CLAUDE.md/OPERATOR.md/backend; (4) `docker compose config` parses and reflects the `setup_data` volume (with a structural fallback + loud WARN when docker is unavailable). **Exit 0 on the clean tree; exit 1 naming the drift.**
- **Proven both directions:** clean tree → exit 0; injected `ZZ_FAKE_DRIFT_KEY` → exit 1 naming the key; reverted → exit 0.
- **`docker-compose.prod.yml`** gained a named **`setup_data:/data`** volume on the `backend` service (the 0600 install-wizard setup-store home), declared under a new top-level `volumes:` block, with `SETUP_STORE_PATH=/data/setup.json` pinned in the backend environment. The docker.sock mount + all existing wiring stayed byte-identical.
- **`.github/workflows/deploy-artifacts.yml`** — a `deploy-drift` job (ubuntu-latest, checkout + `bash scripts/check-deploy-drift.sh`), no new secrets/actions.
- **CLAUDE.md** now carries the **"Deployment-artifact parity (same-commit rule)"** beside the cloud-parity siblings; **OPERATOR.md** carries the browser-wizard callout (`/setup` + reading the setup token from `docker compose logs backend`), the `setup_data` volume note, and a migration-currency bump to 102 + a cloud-parity pending line.

## Task Commits

1. **Task 1: docker-compose.prod.yml setup_data volume (D-02)** — `44aef593` (feat)
2. **Task 2: check-deploy-drift.sh + CI job (D-16)** — `cf0c06c9` (feat)
3. **Task 3: CLAUDE.md parity rule + OPERATOR.md notes (D-16/D-02)** — `e04b1292` (docs)

## Files Created/Modified
- `scripts/check-deploy-drift.sh` (created) — the 4-check deployment-artifact drift gate + `OMITTED_FROM_ONEBOX` allowlist.
- `.github/workflows/deploy-artifacts.yml` (created) — CI job running the drift-check on the relevant paths.
- `docker-compose.prod.yml` (modified) — `setup_data:/data` backend mount + top-level `volumes:` declaration + `SETUP_STORE_PATH` env.
- `CLAUDE.md` (modified) — the same-commit deployment-artifact parity rule.
- `docs/OPERATOR.md` (modified) — browser-wizard callout, `setup_data` volume note, migration-currency → 102 + cloud-parity note.

## Verification Results
- `bash scripts/check-deploy-drift.sh` → **exit 0** on the clean tree (all 4 checks pass; 2 non-blocking WARNs).
- Fixture drift: append a fake required key to `backend/.env.example` → **exit 1** naming `ZZ_FAKE_DRIFT_KEY`; reverted (`git checkout --`) → tree clean → re-run **exit 0**.
- `grep -c "setup_data" docker-compose.prod.yml` = **3** (≥ 2); YAML `safe_load` confirms the top-level volume + backend mount + `SETUP_STORE_PATH`.
- `grep -c "set -euo pipefail" scripts/check-deploy-drift.sh` = **1**; `grep -c "OMITTED_FROM_ONEBOX"` = **7** (≥ 1); `bash -n` clean.
- `grep -ci "Deployment-artifact parity\|same-commit" CLAUDE.md` = **1**.
- `.github/workflows/deploy-artifacts.yml` parses and the `deploy-drift` job runs `bash scripts/check-deploy-drift.sh` on `ubuntu-latest`.
- OPERATOR.md seed extraction stays exactly **9** files (highest listed **089**) after the edits — the drift-check remains consistent.

## Decisions Made
- **check #3 sandbox-tag interpretation:** `Dockerfile.sandbox` carries no tag (the `-t` is a build-command flag), so the checkable "build intent" is the `agentic-rag-sandbox:<tag>` string in the tracked docs. The check asserts every such reference across `deploy/onebox.env.example` / `CLAUDE.md` / `docs/OPERATOR.md` / `backend/.env.example` collapses to one distinct tag that equals the preset `SANDBOX_IMAGE` (today `101.1`). A missed bump anywhere → a split → fail.
- **check #2 WARN noise control:** the candidate-seed heuristic excludes the ubiquitous `app_settings('global')` boilerplate insert, so on the current tree it surfaces exactly the genuine candidates `093_skill_creator_sandbox_library_awareness.sql`, `094_starter_workflows.sql`, `098_feature_visibility.sql` for human review (non-blocking).
- **OPERATOR.md wording:** referenced "migration 102" in prose rather than the `.sql` filename, to avoid polluting the drift-check's seed-filename extraction (which would move `highest` to 102 and silence the legit 090+ WARN).
- **SETUP_STORE_PATH env:** added explicitly (plan-sanctioned optional) so the compose file self-documents why `/data` is mounted; matches the `services/setup_store.py` code default from 158-03.

## Deviations from Plan
None — plan executed as written. The only optional item the plan offered (surfacing `SETUP_STORE_PATH` in the backend environment) was taken; it is additive and does not touch `env_file` or existing wiring. No deviation rules (1–4) were triggered — no bugs fixed, no missing-critical functionality added, no blocking issues, no architectural changes.

## Issues Encountered
- **`set -euo pipefail` counted twice initially** — the literal also appeared in a header comment ("same `set -euo pipefail` … style"), tripping the acceptance criterion `== 1`. Reworded the comment to "same strict-bash mode …" so only the directive line remains. Verified the script still exits 0.
- **`docker compose config` is denied in-session** (sandbox), so check #4 exercised its structural fallback + WARN here. CI's `ubuntu-latest` ships docker and runs the authoritative parse; Task 1's compose change was independently validated via a Python `yaml.safe_load` structural assertion.

## Known Stubs
None — the deliverables are a bash script, a CI YAML, a compose config, and docs. No UI components, no hardcoded empty data flowing to a render path.

## Threat Model Compliance
- **T-158-09 (setup_data volume — information disclosure):** the `setup_data:/data` volume comment documents the 0600 secret file it holds (infra config + finalize marker + token); it never enters the image or logs. Consistent with the mitigate disposition.
- **T-158-drift (157 artifacts drift — tampering):** `check-deploy-drift.sh` + the CLAUDE.md same-commit rule are exactly the mitigation the register specifies.
- **T-158-SC (CI actions — accept):** the CI job is a single `bash` run on `ubuntu-latest` with no new GitHub Actions or packages and no secrets, matching the accepted disposition.
- No new security surface introduced beyond the threat model — no new threat flags.

## Next Phase Readiness
- The `setup_data` volume is wired; the wizard finalize plans (158-05+) can rely on `/data/setup.json` persisting across `up -d --build` and restarts.
- **Human-review item surfaced by check #2 (non-blocking):** `093`, `094`, `098` carry seed-like INSERT/UPDATE above the highest runbook seed (089). A reviewer should confirm whether any belong in the OPERATOR.md Step-3 list or are fully covered by `full-schema.sql` regen. Not a blocker for this plan.
- **DEPLOY-02 remains open** — this plan delivered only the folded D-16 drift-check + the D-02 compose half. The wizard proper (middleware, `/setup` router, frontend flow, finalize) lands in the remaining 158 plans.
- **Cloud-parity still pending** (noted in OPERATOR.md): migrations 099–102 + `SECRETS_ENCRYPTION_KEY` at the next operator-gated promotion.

## Self-Check: PASSED

- Files verified on disk: `scripts/check-deploy-drift.sh`, `.github/workflows/deploy-artifacts.yml`, `docker-compose.prod.yml`, `CLAUDE.md`, `docs/OPERATOR.md`, `158-04-SUMMARY.md` — all FOUND.
- Commits verified in history: `44aef593`, `cf0c06c9`, `e04b1292` — all FOUND.
- `bash scripts/check-deploy-drift.sh` exit 0 on the clean tree; exit 1 on injected fixture drift (reverted).

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
