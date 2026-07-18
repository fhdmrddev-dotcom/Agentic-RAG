---
phase: 149-model-registry-discovery
plan: 06
subsystem: backend
tags: [model-registry, operator-gated, no-dead-default, model-lock, discovery, ssrf-safe, enabled-enforcement, sse-fallback, g5-override]

# Dependency graph
requires:
  - phase: 149-05
    provides: "GET/PATCH /admin/models registry read+write, _MODEL_CAP_COLUMNS allowlist, load_all_model_overrides(), invalidate_model_overrides_cache(), model.capability.set receipt pattern, is_default/is_locked from app_settings"
  - phase: 149-02
    provides: "model_discovery_service.discover_all(keyed) + compute_diff(current, discovered) + keyed_from_settings() + PROVIDER_ENDPOINTS code-constant allowlist"
  - phase: 146
    provides: "require_operator router gate (byte-identical 404) + operator_audit_floor receipt plumbing"
  - phase: 147
    provides: "save_app_settings honest-failure discipline (False → 500, never a false 2xx) + _DIRECT_COLUMNS code-constant write allowlist + the G-5 threads.py override precedent"
provides:
  - "Two-part no-dead-default guard (D-149-09): PATCH enabled=false on the org-default OR locked model → 409 BEFORE any write; PUT .../lock refuses locking a DISABLED model → 409 — the two halves together structurally forbid a dead org default"
  - "PUT /admin/models/{id}/lock (D-149-07) — the DEDICATED lock/unlock seam (body {locked}), SEPARATE from PATCH: locked=true pins llm_model + llm_model_locked=true (single lock max); locked=false clears the flag; ✎ model.lock / model.unlock; honest *.write_failed → 500 on a failed persist"
  - "POST /admin/models/discover (D-149-11) — operator-gated fan-out (keyed_from_settings → discover_all → compute_diff over MODEL_CAPABILITIES ∪ load_all_model_overrides) returning the EPHEMERAL propose-only diff + honest per-provider outcomes; SSRF-gated provider selection; ✎ model.discover; no proposals table (D-149-12)"
  - "threads.py enabled-enforcement fallback (D-149-10): a disabled resolved model runs on the org default with an honest inline model_disabled_fallback SSE notice naming BOTH models — single-seam additive guard, shared path byte-identical for enabled models"
  - "llm_model_locked added to main._DIRECT_COLUMNS (code-constant, SQLi-safe write allowlist)"
affects: [149-07, model-registry-tab, settings-model-picker, chat-request-path]

# Tech tracking
tech-stack:
  added: []  # zero new packages (T-149-SC accept)
  patterns:
    - "Two-halves invariant guard: an availability property (no dead default) enforced by TWO refusals at TWO write seams (disable-path + lock-path), each 409-refusing BEFORE any write rather than silently self-healing — honest consequence, no hidden side-effect write"
    - "Dedicated non-column endpoint for a settings pin: lock is a PUT .../lock writing app_settings (llm_model + llm_model_locked), NOT a model_capabilities_overrides column — matches the pre-built api.ts setModelLock seam"
    - "SSRF allowlist-before-fanout: a client provider selection is validated against set(PROVIDER_ENDPOINTS) (code constant) → 422 BEFORE the service is invoked; iteration is only ever over the constant, never a client value (mirrors _MODEL_CAP_COLUMNS)"
    - "Single-seam enabled-enforcement: a pure (effective_model, notice) helper at the ONE shared resolution point; no per-provider fork; reuses the canonical _emit informational-event shape rather than a new emitter"

key-files:
  created:
    - backend/tests/test_149_default_guard.py
    - backend/tests/test_149_discover_endpoint.py
    - backend/tests/test_149_fallback_notice.py
  modified:
    - backend/app/main.py
    - backend/app/api/admin.py
    - backend/app/api/threads.py

key-decisions:
  - "The disable guard reads _load_settings_from_db (cached app_settings) and checks locked FIRST (locked ⇒ 'unlock it first') then default ('pick a new default first'), since a locked model is always the default — the two messages stay distinguishable by lock state."
  - "The lock-path guard 409-REFUSES locking a disabled model rather than auto-enabling it (honest consequence, symmetric with the disable guard; no hidden side-effect write) — this is the second half that closes the dead-default gap."
  - "The discover endpoint returns compute_diff's {new,changed,vanished} at the top level (per the plan's explicit contract) PLUS an additive per-provider `providers` summary (names+status only, no body/key echo — T-149-04) so the tab can show which providers ran vs skipped/errored. The Plan-04 api.ts DiscoveryResult stub is reconciled by Plan 07's consuming tab."
  - "threads.py: the G-5 override was honored EXACTLY — a minimal in-place _resolve_enabled_model helper + a call at the single resolution seam + one best-effort _emit after register_run_start. No new endpoint, no per-provider fork, the shared chunk/SSE emitter untouched."
  - "The fallback org default is passed as _user_settings.llm_model (which is app_settings.llm_model — there is no per-user model store); the Task-1 guards guarantee it is always enabled, so the fallback target can never itself be disabled."

patterns-established:
  - "No-dead-default = disable-guard ∧ lock-guard: an availability invariant maintained by refusing at BOTH write seams, so the request-path fallback target is provably always enabled."

requirements-completed: [MODEL-02]

# Metrics
duration: ~15min
completed: 2026-07-12
---

# Phase 149 Plan 06: Registry Governance — Guards, Lock, Discovery, Fallback Summary

**The registry now governs the request path: a two-part 409 guard makes a dead org default structurally impossible (can't disable the current default/locked model; can't lock a disabled one), the dedicated `PUT /admin/models/{id}/lock` pins the single ENABLED org default, `POST /admin/models/discover` runs the Plan-02 fan-out behind the operator gate (SSRF-validated, ephemeral diff, ✎ receipt), and a disabled model never breaks a conversation — the next message falls back to the org default with an honest inline SSE notice naming both models. The `threads.py` touch is the minimal single-seam guard the pre-approved G-5 override allows — no new endpoint, no per-provider fork.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-12T07:44:57Z
- **Completed:** 2026-07-12T07:59:46Z
- **Tasks:** 3 (all `tdd="true"`)
- **Files:** 6 (3 test files created, 3 source files modified)

## Accomplishments

- **Task 1 — no-dead-default guard + lock (`admin.py`, `main.py`):** the PATCH capability handler now refuses (409, BEFORE any write) disabling the current org default (`"pick a new default first"`) or the locked model (`"unlock it first"`), reading the cached app_settings row via `_load_settings_from_db`. The dedicated `PUT /admin/models/{id}/lock` (body `{locked}`, separate from PATCH) pins `llm_model` + `llm_model_locked=true` on lock — but FIRST refuses (409) locking a currently-disabled model (`"enable it first"`), the second half of the guard; unlock clears `llm_model_locked`. Both stamp ✎ `model.lock`/`model.unlock`; a failed persist stamps `*.write_failed` + raises a real 500. `llm_model_locked` joined `main._DIRECT_COLUMNS`.
- **Task 2 — `POST /admin/models/discover` (`admin.py`):** resolves keyed providers via `keyed_from_settings()`, fans out through `discover_all`, builds the current registry union (built-in `MODEL_CAPABILITIES` ∪ `load_all_model_overrides()` with a `provider` on every entry), and returns `compute_diff`'s ephemeral `{new,changed,vanished}` + an additive per-provider outcome summary. A provider selection is validated against `set(PROVIDER_ENDPOINTS)` → 422 BEFORE any fan-out (SSRF-safe). Stamps ✎ `model.discover`; no proposals table.
- **Task 3 — enabled-enforcement fallback (`threads.py`):** a minimal single-seam guard at the ONE shared model-resolution point — `_resolve_enabled_model(resolved, org_default)` returns `(org_default, notice)` when the resolved model has a disabled override (read from the cached all-rows set), else `(resolved, None)` byte-identically. When a fallback occurred, one best-effort `_emit(redis, run_id, "model_disabled_fallback", ...)` after `register_run_start` puts an honest notice naming both models on the run stream. No new endpoint, no per-provider fork, shared SSE emitter untouched.

## Task Commits

Each task committed atomically (test + implementation together per task):

1. **Task 1: two-part no-dead-default guard + PUT .../lock lock/unlock** — `701641bf` (feat)
2. **Task 2: POST /admin/models/discover operator-gated discovery run** — `82cff337` (feat)
3. **Task 3: enabled-enforcement fallback notice at the shared resolution seam** — `6725efeb` (feat)

**Plan metadata:** committed by the orchestrator (SUMMARY.md + shared tracking files).

## Files Created/Modified

- `backend/app/main.py` — `llm_model_locked` added to `_DIRECT_COLUMNS` (code-constant write allowlist).
- `backend/app/api/admin.py` — the disable-path 409 guard in `set_model_capability`; the `ModelLockUpdate` model + `PUT /admin/models/{id}/lock` (`set_model_lock`) with the lock-path 409 guard; the `DiscoverRequest` model + `POST /admin/models/discover` (`run_model_discovery`).
- `backend/app/api/threads.py` — `load_all_model_overrides` added to the settings import; the `_resolve_enabled_model` helper; the single-seam call at the resolution point (~1090); the best-effort fallback-notice `_emit` after `register_run_start`.
- `backend/tests/test_149_default_guard.py` — disable-default/locked 409-no-write; ordinary-disable success; lock-enabled pins default; lock-disabled 409-no-save; unlock clears flag; lock persistence-failure 500; `_DIRECT_COLUMNS` assertion; non-operator 404 on PUT .../lock.
- `backend/tests/test_149_discover_endpoint.py` — bad-selection 422-no-fanout; happy-path diff + per-provider outcomes + `model.discover` stamp; empty-body runs-all; non-operator 404 on POST .../discover.
- `backend/tests/test_149_fallback_notice.py` — disabled→fallback+notice naming both; enabled→no-fallback/no-notice; absent-override byte-identical; read-blip swallowed; the on-the-wire `_emit` payload carries both names + the `model_disabled_fallback` type.

## Decisions Made

- **Refuse, don't self-heal:** both guard halves 409-refuse rather than auto-mutating (auto-enabling a locked-disabled model, or auto-re-pointing a disabled default) — honest consequence, no hidden side-effect write. This keeps the two halves symmetric and the operator in control.
- **Discover response shape:** returns `compute_diff`'s `{new,changed,vanished}` (the plan's explicit contract) plus an additive `providers` summary (names+status+ok only). The Plan-04 `api.ts` `DiscoveryResult` stub (`{providers:[{new_models,...}]}`) is an interface-first placeholder; Plan 07's consuming tab reconciles the exact render shape. No secret/body echo (T-149-04).
- **G-5 override honored exactly:** the `threads.py` change is a minimal in-place fallback-notice guard at the single resolution seam for D-149-10 — no new endpoint, no file growth beyond the guard, no per-provider fork, the shared Deep/workflow SSE path byte-identical for enabled models.

## Deviations from Plan

None — plan executed as written. One explicit Claude-discretion choice the plan delegated: the fallback SSE event name is `model_disabled_fallback` (distinct from the existing title-generation `fallback_model` event to avoid a semantic collision), reusing the canonical `_emit` shape as the plan directs.

## Security (threat model)

All Plan-06 threat-register mitigations are implemented and tested:

- **T-149-14 (SSRF):** the discover endpoint validates any provider selection against `set(PROVIDER_ENDPOINTS)` → 422 BEFORE `discover_all` is called; the service is never invoked on the reject path (test asserts `assert_not_awaited`). No client value ever becomes a request URL. Tested in `test_149_discover_endpoint.py::test_bad_provider_selection_422_no_fanout`.
- **T-149-15 (dead default):** the disable guard AND the lock guard BOTH 409-refuse (disabling the org-default/locked model; locking a disabled model) BEFORE any write, so the threads.py fallback target is provably always enabled. Tested (`test_disable_org_default_409_no_write`, `test_disable_locked_model_409_unlock_first`, `test_lock_disabled_model_409`).
- **T-149-16 (silent routing change):** the disabled-model fallback is honest + non-silent — it names both models via the existing informational `_emit` shape and never breaks mid-conversation. Tested (`test_149_fallback_notice.py`).
- **T-149-17 (repudiation):** lock/unlock/discover stamp ✎ `model.lock` / `model.unlock` / `model.discover` receipts via `operator_audit_floor`; a failed lock/unlock persist stamps `*.write_failed` + 500 (honest, no false success).
- **T-149-21 (EoP / SC#4):** both new non-GET routes inherit the router `require_operator` 404 gate; each carries its OWN non-operator 404 regression test (`test_lock_non_operator_404`, `test_discover_non_operator_404`) — the 146 auto-gate covers GET only.
- **T-149-SC:** zero new packages.

## Known Stubs

None. The lock/guard/discover endpoints are fully wired to real services (`save_app_settings`, `model_discovery_service`) and the request-path fallback is live at the shared seam. The Model Registry tab that consumes `setModelLock` + `runModelDiscovery` (the Plan-04 api.ts seams) is Plan 07 — a deliberate cross-plan handoff, not a stub.

## TDD Gate Compliance

All three tasks are `tdd="true"`. Tests and implementation were committed together per task (each task's verify block was run green before its commit — the Plan-05 discipline). No plan-level `type: tdd` gate applies (this is a `type: execute` plan); no MVP+TDD runtime gate mode was passed by the orchestrator.

## Verification

- `pytest tests/test_149_default_guard.py tests/test_149_discover_endpoint.py tests/test_149_fallback_notice.py` → **18 passed**.
- Full 149 suite (all 8 files) → **38 passed**.
- Adjacent regression green: `test_146_operator_gate.py`, `test_147_operator_kill.py`, `test_147_flag_refuse.py`, `test_147_flag_failure_semantics.py` (30 passed); `test_148_disable.py`, `test_148_enable.py`, `test_148_effective_features.py` (5 passed).
- `import app.api.threads` OK (hot-file touch does not break module load).

## Next Phase Readiness

- Plan 07's Model Registry tab can consume `PUT /admin/models/{id}/lock` (`setModelLock`) and `POST /admin/models/discover` (`runModelDiscovery`) directly — the endpoint paths + request shapes match the Plan-04 api.ts seams; the discover response exposes `{new,changed,vanished}` + `providers`.
- MODEL-02's operator flow is complete: no dead default is possible, the single org default is lockable/pinnable, discovery runs operator-gated + SSRF-safe, and the request path enforces `enabled` with an honest fallback.
- No blockers.

## Self-Check: PASSED

- Created files verified present: `test_149_default_guard.py`, `test_149_discover_endpoint.py`, `test_149_fallback_notice.py`, `149-06-SUMMARY.md`.
- Modified files verified present: `main.py`, `admin.py`, `threads.py`.
- Commits verified in git log: `701641bf` (Task 1), `82cff337` (Task 2), `6725efeb` (Task 3).
- Full 149 suite: 38 passed; adjacent regression: 35 passed.
- STATE.md / ROADMAP.md NOT modified by this executor (orchestrator owns those writes).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
