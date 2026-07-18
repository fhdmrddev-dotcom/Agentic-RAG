---
phase: 158-first-run-install-wizard-stretch
plan: 01
subsystem: testing
tags: [pytest, vitest, nyquist-scaffold, importorskip, it-todo, asgi-middleware, config-overlay, setup-wizard, deploy]

# Dependency graph
requires:
  - phase: 157-deployment-presets-runbook-stretch
    provides: the onebox.env.example var surface + OPERATOR.md Home-B flow the wizard automates (the field set the scaffolds encode)
  - phase: 147-operator-maintenance
    provides: test_147_maintenance_mw.py — the pure-ASGI gate test template (503-body, allowlist-boundary, no-lifespan TestClient) test_setup_gate copies
  - phase: 150-secrets-at-rest
    provides: test_150_save_seam.py — the _StubPool encrypt-on-write idiom test_setup_provider copies verbatim in intent
  - phase: 156-operator-ux-polish
    provides: the 156-01 NavPanel it.todo Wave-0 scaffold precedent the 2 frontend stubs mirror
provides:
  - "The Wave-0 Nyquist test scaffold: 12 backend tests/test_setup_*.py + conftest fixtures + 2 frontend it.todo stubs — every 158-VALIDATION.md SC row has a named test file"
  - "The byte-identical invariant permanent home: test_setup_gate.py::test_configured_box_noop"
  - "conftest fixtures: setup_store_path (throwaway SETUP_STORE_PATH) + mock_submitted_supabase"
  - "Read-seam contracts the impl waves must satisfy: SetupMiddleware._is_finalized, setup_store.{setup_finalized,verify_token,get_or_create_token,write_store}, config.apply_setup_overlay, setup_service.{compute_setup_status,detect_environment,probe_submitted_postgres/redis,bootstrap_operator,persist_provider_key,run_smoke_checks}, user_settings.setup_complete"
affects: [158-02, 158-03, 158-04, 158-05, 158-06, SetupMiddleware, setup_store, setup_service, config-overlay, lifespan-guard, supabase-ts-shim, App-tsx-setup-branch]

# Tech tracking
tech-stack:
  added: []  # zero new packages — phase adds none (158-RESEARCH Package Legitimacy Audit)
  patterns:
    - "Two-mode Wave-0 scaffold: pytest.importorskip('app.<new-module>') for NEW-module tests (skip clean until impl) vs getattr/source-grep honest-RED for MODIFIED-module tests (fail RED until behavior lands)"
    - "Faithful test BODIES (not empty stubs) behind importorskip → later waves flip a real gate, never a moving target"
    - "Frontend it.todo scaffold: import only {describe,it}, zero unbuilt-symbol imports → collects GREEN pending"

key-files:
  created:
    - backend/tests/test_setup_gate.py
    - backend/tests/test_setup_token.py
    - backend/tests/test_setup_overlay.py
    - backend/tests/test_setup_boot_tolerant.py
    - backend/tests/test_setup_finalize.py
    - backend/tests/test_setup_idempotent.py
    - backend/tests/test_setup_status.py
    - backend/tests/test_setup_detect.py
    - backend/tests/test_setup_probe.py
    - backend/tests/test_setup_operator.py
    - backend/tests/test_setup_provider.py
    - backend/tests/test_setup_smoke.py
    - frontend/src/lib/__tests__/supabase.test.ts
    - frontend/src/pages/__tests__/SetupWizard.test.tsx
  modified:
    - backend/tests/conftest.py

key-decisions:
  - "importorskip for the 10 NEW-module tests, getattr/source-grep honest-RED for the 2 MODIFIED-module tests (overlay, boot_tolerant) — the plan's prescribed two-mode split"
  - "Wrote full faithful test bodies behind importorskip (not pass-stubs) so Waves 1-6 land green against a real gate"
  - "test_configured_box_noop drives the byte-identical invariant by monkeypatching a SetupMiddleware._is_finalized read seam (the maintenance _read_maintenance analog) — this DEFINES the read-seam contract for Wave 1"
  - "boot_tolerant RED is a source-grep for `setup_finalized` in main.py (the guard signal), not just symbol-existence — reduces false-green risk"
  - "Reworded the supabase.test.ts runtime-shim todo to avoid the literal 'hydrateSupabaseFromRuntime' token (plan action vs acceptance-grep contradiction; honored the grep + zero-unbuilt-imports intent)"
  - "Did NOT mark DEPLOY-02 complete — this is Wave 0 of 6 (test scaffold only); the requirement stays OPEN until the impl waves land"

patterns-established:
  - "Two-mode Nyquist scaffold (importorskip vs honest-RED) per module novelty"
  - "Read-seam-as-contract: the scaffold names the private read seam (_is_finalized) the impl must expose"

requirements-completed: []  # DEPLOY-02 is NOT completed by this Wave-0 scaffold — it stays OPEN (Wave 0 of 6)

# Metrics
duration: ~35 min
completed: 2026-07-17
---

# Phase 158 Plan 01: Wave-0 Nyquist Test Scaffold Summary

**12 backend `test_setup_*.py` contracts + shared conftest fixtures + 2 frontend `it.todo` stubs that clean-collect (10 importorskip-skip, 6 honest-RED, 10 frontend todos) and give every impl wave a real gate to flip green — including the byte-identical-invariant home `test_configured_box_noop`.**

## Performance

- **Duration:** ~35 min (commits span 2026-07-17T04:47→04:53 +04:00; reads/authoring preceded)
- **Started:** 2026-07-17T00:19Z (approx — PLAN_START_TIME not captured at spawn)
- **Completed:** 2026-07-17T00:54Z
- **Tasks:** 3
- **Files modified:** 15 (14 created, 1 modified)

## Accomplishments
- **The full Wave-0 Nyquist scaffold lands with ZERO collection errors** — the backend suite grows 2699 → 2705 (only the 2 RED modules add collected items; the 10 importorskip modules skip at import), and the frontend adds 10 clean todos.
- **The byte-identical invariant has a permanent home** — `test_setup_gate.py::test_configured_box_noop` proves a finalized (latched) box passes every route through untouched (single bool check, zero I/O), driven by monkeypatching a `SetupMiddleware._is_finalized` read seam (the Phase-147 `_read_maintenance` analog).
- **Every 158-VALIDATION.md SC row now maps to a named test file** — SC#1 (status/detect/probe/operator/provider/smoke), SC#2 (gate/finalize/idempotent/token), SC#3 (overlay/boot_tolerant + 2 frontend), so no impl wave chases a moving target.
- **conftest exposes the shared substrate** — `setup_store_path` (throwaway `SETUP_STORE_PATH` under tmp_path) + `mock_submitted_supabase`, reusing the existing `mock_asyncpg_pool` / `_reset_pg_pool_singleton` idioms verbatim.

## Task Commits

Each task committed atomically:

1. **Task 1: conftest fixtures + 6 SC#2/SC#3-invariant backend stubs** — `a18ac7b4` (test)
2. **Task 2: 6 step-contract backend stubs** — `c765fcdb` (test)
3. **Task 3: 2 frontend it.todo stubs** — `ff9d3597` (test)

**Plan metadata:** (this SUMMARY + VALIDATION.md frontmatter) — final docs commit below.

## Files Created/Modified
- `backend/tests/conftest.py` — added `setup_store_path` + `mock_submitted_supabase` fixtures (Phase 158 section)
- `backend/tests/test_setup_gate.py` — SetupMiddleware 503-vs-allowlist + `test_configured_box_noop` (byte-identical invariant); importorskip `app.middleware.setup`
- `backend/tests/test_setup_token.py` — 401 gate + `hmac.compare_digest` constant-time verify; importorskip `app.services.setup_store`
- `backend/tests/test_setup_overlay.py` — store-wins-over-placeholder infra overlay, app-tier untouched; honest-RED getattr on `app.config.apply_setup_overlay`
- `backend/tests/test_setup_boot_tolerant.py` — main.py:357 audit-drift guard deferred in setup mode; honest-RED source-grep on `main.py`
- `backend/tests/test_setup_finalize.py` — dual marker + sticky-True finalized latch; importorskip `app.services.setup_store`
- `backend/tests/test_setup_idempotent.py` — finalize-latch 409 + step idempotency; importorskip `app.api.setup`
- `backend/tests/test_setup_status.py` — needs_setup from static marker+placeholder check; importorskip `app.services.setup_service`
- `backend/tests/test_setup_detect.py` — light env-detect flags; importorskip `app.services.setup_service`
- `backend/tests/test_setup_probe.py` — submitted-value throwaway probes + SSRF-sanitized reason (`type(exc).__name__`); importorskip `app.services.setup_service`
- `backend/tests/test_setup_operator.py` — `admin.create_user(email_confirm=True)` + ON CONFLICT upsert + already_exists re-run; importorskip `app.services.setup_service`
- `backend/tests/test_setup_provider.py` — provider key → `save_app_settings` `enc:v1:` envelope (copies test_150 intent); importorskip `app.services.setup_service`
- `backend/tests/test_setup_smoke.py` — 5-way checklist; any red ⇒ all_green:false = finalize gate; importorskip `app.services.setup_service`
- `frontend/src/lib/__tests__/supabase.test.ts` — SC#3/D-07 runtime public-config shim + defensive import; 5 `it.todo`
- `frontend/src/pages/__tests__/SetupWizard.test.tsx` — SC#1/2 D-06 pre-auth `/setup` branch + finalized lock-out; 5 `it.todo`

## Decisions Made
- **Two-mode scaffold per module novelty (per plan):** 10 NEW-module files use `pytest.importorskip("app.<module>")` (skip clean until the module exists); 2 MODIFIED-module files (overlay, boot_tolerant) fail honest-RED via `getattr(...)`/source-grep so collection stays clean while the RED signal is real.
- **Faithful bodies, not pass-stubs:** the importorskip files carry full, faithful test bodies (real ASGI wiring, real fixture use, real assertions) so Waves 1-6 flip a *real* gate rather than a placeholder — directly satisfying the must_have "later waves land green against a real gate (not a moving target)".
- **Read-seam-as-contract:** `test_configured_box_noop` monkeypatches `SetupMiddleware._is_finalized`; boot_tolerant greps `main.py` for `setup_finalized`. These name the exact seams the impl must expose, so the scaffold is prescriptive, not just descriptive.
- **DEPLOY-02 stays OPEN:** this is Wave 0 of a 6-wave phase and ships test scaffolds only; marking the requirement complete would be false. `requirements-completed: []`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / plan self-contradiction] Reworded a frontend todo to satisfy the acceptance grep**
- **Found during:** Task 3 (frontend it.todo stubs)
- **Issue:** The plan's Task 3 `<action>` lists a todo string literally containing `"hydrateSupabaseFromRuntime"`, but the same task's `<acceptance_criteria>` requires `grep -c "hydrateSupabaseFromRuntime\|SetupWizard" .../supabase.test.ts` to equal **0**. Following the action verbatim would fail the acceptance gate.
- **Fix:** Worded that todo as "the runtime-config shim overlays runtime creds from GET /public-config, keeping baked VITE_* as fallback" — names the behavior without the exact export token. Honors both the acceptance grep (== 0) and the deeper intent ("import ZERO not-yet-built symbols"). No coverage lost: the Wave-3 assertion is still named.
- **Files modified:** `frontend/src/lib/__tests__/supabase.test.ts`
- **Verification:** `grep -c "hydrateSupabaseFromRuntime\|SetupWizard" src/lib/__tests__/supabase.test.ts` == 0; `npx vitest run` → 0 failures.
- **Committed in:** `ff9d3597` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking / plan-contradiction reconciliation)
**Impact on plan:** Zero scope loss — the behavior is still named; only the wording changed to satisfy the plan's own acceptance grep. No production code touched.

## Issues Encountered
- **`tsc -b` baseline instability (the MEMORY `tsc -b` lesson):** a warm-cache `npx tsc -b` reported 6 errors; a forced full rebuild reported 29 (the true SEED-056/049 baseline). Resolved by proving 0 net-new with a controlled comparison — moved the 2 new files out, ran `npx tsc -b --force` (29 errors), restored them, ran `--force` again (29 errors), `diff` identical. None of the 29 reference the new files. **0 net-new confirmed.**
- **Windows console renders em-dashes as `�`** in pytest output — a display artifact only; the UTF-8 test files parse and run correctly (house style already uses box-drawing/em-dash chars in `test_147`/`conftest`).

## Gate Results (acceptance criteria)
- **Task 1:** 6-file run = 6 RED (overlay×3, boot_tolerant×3) + 4 skipped, **0 errors**; `grep -c "def test_configured_box_noop"` == 1; `grep "SETUP_STORE_PATH" conftest.py` present; full suite collects 2705, **0 net-new collection errors**. ✅
- **Task 2:** 6-file run = **6 skipped, 0 errors** (all importorskip `setup_service`); each names ≥1 VALIDATION-docstring test; SSRF grep on `test_setup_probe.py` non-empty. ✅
- **Task 3:** `npx vitest run` = **10 todo, 0 failures, 0 import errors**; forbidden-token grep == 0; `tsc -b` **0 net-new** (29 == 29, `--force` diff identical). ✅
- **Overall:** `pytest tests/test_setup_*.py -q` = 6 failed (RED) + 10 skipped, 0 errors; no file modified outside `backend/tests/` + `frontend/src/**/__tests__/` (15/15 paths in scope). ✅

## Known Stubs
The entire deliverable is intentional test scaffolding (the plan's `nyquist_validation: true` purpose) — importorskip-skip / honest-RED / `it.todo` stubs are the artifact, not accidental gaps. **No production code was written**, so there are no production stubs that could mask an unmet goal. Each file's docstring names the exact Wave (1-6 / 3 / 8-11) that flips it green. These reds/skips are the expected pre-impl state.

## Next Phase Readiness
- **Wave 1+ can start immediately** — every impl module has a waiting contract: `app.middleware.setup` (gate + `_is_finalized`), `app.services.setup_store` (finalized latch, token, store I/O, INFRA_KEYS), `app.config.apply_setup_overlay`, the `main.py` lifespan setup-mode guard, `app.services.setup_service` (probes/operator/provider/smoke/status/detect), `app.api.setup` (router + `require_setup_token`), `user_settings.setup_complete`, and the frontend `supabase.ts` shim + `App.tsx` branch.
- **Carry-forward (for the orchestrator):** STATE.md / ROADMAP.md / REQUIREMENTS.md updates and the plan-advance are intentionally left to the orchestrator (project lesson: orchestrator owns STATE/ROADMAP writes; balloon-bug mitigation). **DEPLOY-02 must NOT be marked complete** — Wave 0 of 6. `158-VALIDATION.md` frontmatter is flipped to `wave_0_complete: true` / `nyquist_compliant: true` in the metadata commit.
- **No blockers.** Zero new packages, zero live-DB touches, zero out-of-scope edits.

## Self-Check: PASSED

- All 14 created test files + this SUMMARY verified present on disk (`[ -f ]`).
- All 3 task commits verified in git log: `a18ac7b4`, `c765fcdb`, `ff9d3597`.
- Full backend suite collects 2705 (0 net-new collection errors); `pytest tests/test_setup_*.py -q` = 6 RED + 10 skipped, 0 errors; frontend vitest = 10 todo, 0 failures; `tsc -b` 0 net-new (29 == 29 forced-diff identical).

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
