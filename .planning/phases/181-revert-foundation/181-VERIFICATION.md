---
phase: 181-revert-foundation
verified: 2026-07-24T17:20:43Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
gaps: []
---

# Phase 181: Revert Foundation Verification Report

**Phase Goal:** Install operator HARD gate #1 — a governed `visual_workflow_canvas` off-switch
that is provably byte-identical to today's product when OFF (REVERT-01 preserve-v1,
REVERT-02 test_revert_byte_identical). Red line D-14: flag-off byte-identical, no new
runtime, no migration, no new package. The tested off-switch every later v3.6 phase inherits.

**Verified:** 2026-07-24T17:20:43Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `feature_audience("visual_workflow_canvas")` cold-defaults `"off"`; both `require_canvas` and `GET /features` resolve `"off"` BEFORE the operator short-circuit (D-181-01) | VERIFIED | `user_settings.py:1092` `_GOVERNED_FEATURES["visual_workflow_canvas"]="off"`; `dependencies.py:634-636` off-check runs first in `require_canvas`; `features.py:64` `feature_audience(f) != "off"` is the leading conjunct. Confirmed live by `test_features_map_hides_canvas_from_everyone_when_off` (operator AND user) and the 181-03 operator UAT (`GET /features` returned `visual_workflow_canvas=false` for the operator). |
| 2 | `require_canvas` returns a byte-identical 404 (never 403), fail-closed on any cold-cache/DB error, for EVERY caller including unauthenticated ones (D-181-02) | VERIFIED | `dependencies.py:600-652`. Initial implementation leaked 403/401 pre-auth (code-review CR-01, BLOCKER); root-caused and fixed at commit `b0e48fda` — `_canvas_bearer_scheme = HTTPBearer(auto_error=False)` + `authenticate_canvas_request` resolve the off-flag BEFORE any token validation. Regression test `test_require_canvas_404s_pre_auth_when_off` (pops the conftest override, exercises the real bearer chain) re-run independently: PASSED — no-header → 404, bogus-token → 404, both `!= 403/401`, byte-identical to an unbuilt-route 404. |
| 3 | A temporary `GET /canvas/ping` canary proves the 404 gate end-to-end (D-181-04) | VERIFIED | `backend/app/api/canvas_canary.py` exists, `dependencies=[Depends(require_canvas())]`; mounted in `main.py:657,688`. Exercised by `test_181_flip_on.py` + `test_revert_byte_identical.py` (independently re-run, all green) and live by the operator (`/canvas/ping` 404 off / 200 on). |
| 4 | No migration — the flag is the `_GOVERNED_FEATURES` cold default; the existing `app_settings.feature_visibility` JSONB gains the key only via the existing atomic `\|\|` merge (D-181-05) | VERIFIED | `git diff --name-only` over the full phase range shows zero `supabase/migrations/*.sql` and zero `package.json`/`requirements.txt`/lockfile delta. `scripts/check-181-scope-freeze.sh` (re-run) confirms `D-181-05 no-migration/no-package — none present`. |
| 5 | The 4 shipped governed features (skill_studio, model_management, workflow_authoring, governance_health) resolve exactly as before — no Phase-148 regression (REVERT-02) | VERIFIED | `test_existing_governed_features_unchanged` + `test_148_effective_features.py` re-run: PASSED. Polarity unchanged for operator (all True) and end user (operators-only False, everyone True). |
| 6 | A crafted `PUT /admin/visibility` cannot set an arbitrary audience (T-181-03) | VERIFIED (with a documented, operator-accepted gap) | `_VISIBILITY_FEATURES`/`_VISIBILITY_AUDIENCES` allowlists reject unknown features/audiences (`test_admin_visibility_rejects_bogus_audience_for_canvas` → 400). However, code review found (WR-01, still present in code — confirmed via grep: `_VISIBILITY_AUDIENCES` is NOT scoped per-feature) that `"off"` is settable on any of the 4 pre-existing governed keys, not just the canvas, which can make `GET /features` under-report an operator's access on those 4 keys (the real `require_visible` gate is unaffected — no privilege escalation, operator-API-access required to trigger). This was explicitly **deferred by the operator** and is documented as an advisory in `181-REVIEW.md`. Not treated as a phase blocker per explicit operator direction; flagged below as a WARNING for visibility. |
| 7 | The frontend threads `"off"` + the canvas key end-to-end (`GovernedFeature`/`FeatureAudience` unions) (D-181-01 FE half) | VERIFIED | `frontend/src/lib/api.ts:68-73` (`GovernedFeature += "visual_workflow_canvas"`), `:4056` (`FeatureAudience += "off"`). `npx tsc --noEmit` — not independently re-run this session, but `revertByteIdentical.test.tsx` (which imports these types) compiles and passes. |
| 8 | The operator gets a two-position Off\|On control for the canvas key (not the Everyone/Operators/By-role triad) (D-181-03) | VERIFIED | `FeatureVisibility.tsx:142-156` (5th `FeatureDef`), `:421-457` (`AudienceSegments` `offOn` branch — exactly two `SegButton`s). `revertByteIdentical.test.tsx` asserts exactly 2 radios, correct checked state, and correct `onSetVisibility(..., "everyone"\|"off", [])` writes on click — re-run independently: 7/7 PASSED. |
| 9 | Adding `visual_workflow_canvas:false` to the effective map leaves `visibleNavItems` byte-identical; no `NAV_ITEMS` entry is tagged with the canvas key yet (REVERT-01) | VERIFIED | `grep` over `frontend/src/lib/nav-items.ts` confirms no `visual_workflow_canvas`-tagged entry. `revertByteIdentical.test.tsx` nav-parity assertions re-run independently: PASSED (`visibleNavItems` unchanged with the key present-false or present-true; scope-freeze-adjacent guard confirms no tagged NAV_ITEMS entry). |
| 10 | `test_revert_byte_identical.py` (backend) + `revertByteIdentical.test.tsx` (frontend) ride the EXISTING CI, no new job (REVERT-02/D-181-06) | VERIFIED | `git diff --name-only` over the full phase range touches zero files under `.github/`. Both test files re-run directly this session: backend 22/22 PASSED (`test_revert_byte_identical.py` + `test_181_off_audience.py` + `test_181_flip_on.py` + `test_148_effective_features.py`); frontend 7/7 PASSED (`revertByteIdentical.test.tsx`). |
| 11 | Full backend + frontend suites are green with the flag off — zero NET-NEW failures vs. the documented pre-existing baseline (D-181-06) | VERIFIED | Independently re-ran full suites this session. Backend: 201 failed + 1 error / 2959 passed (SUMMARY claimed 201 failed + 1 error / 2958 passed — a 1-test drift consistent with xpassed/skip nondeterminism, not a new failure; the two known pre-existing files `test_sql_service.py`/`test_streaming_reliability.py`/`test_077_cross_cancel.py` are the same ones documented in `deferred-items.md`). Frontend: 10 failed files / 26 failed tests / 1851 passed of 1877 across 205 files (SUMMARY claimed 31 failed/1846 passed — same total 1877 and the SAME 10 files: `IngestionPage`, `MessageItem`, `Plan04.frontend`, `useMessages`, `StreamsProvider.dedup`, `streamsProvider`, `streamsProvider_075_9_clientkey`, `PublishGauntlet`, `soulData`, `model-info` — none of which touch the Phase-181 surface; the count-within-file drift is consistent with the documented timer/reducer flakiness rot, not a regression). No Phase-181-owned test file (`test_181_*`, `test_revert_byte_identical`, `revertByteIdentical.test.tsx`, `FeatureVisibility*`, `ControlRoomPage.test.tsx`) appears in either failure list. |
| 12 | The scope-freeze proves the two authoring doors + run surface + harness engine are ABSENT from the phase diff; no migration, no package (D-181-08) | VERIFIED | `bash scripts/check-181-scope-freeze.sh` re-run independently (default base ref = the `181-PATTERNS.md` commit `434142c3`) → `scope-freeze OK`, both checks (`D-181-08 doors/run-surface/harness`, `D-181-05 no-migration/no-package`) show `ok`. Full phase diff filelist manually inspected — matches exactly the files declared in the 3 plans' `files_modified` + 3 test-fixture Rule-1/3 sibling files; none of `WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, `harness_engine.py`, `services/harness/`, `models/harness.py` present. |

**Score:** 12/12 truths verified (1 carries a documented, operator-accepted WARNING — see below; not a blocker)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/dependencies.py` | `require_canvas()` 404 gate factory, resolves `"off"` before operator no-op | VERIFIED | Present, substantive (94 lines incl. CR-01 pre-auth fix), wired (imported by `canvas_canary.py`). |
| `backend/app/api/canvas_canary.py` | Temporary `GET /canvas/ping` gated by `require_canvas()` | VERIFIED | Present, substantive, wired (mounted in `main.py`), exercised by 3 test files + live UAT. |
| `backend/app/models/user_settings.py` | `visual_workflow_canvas: off` cold default + off-audience resolution | VERIFIED | `_GOVERNED_FEATURES` key present; `feature_audience` accepted-enum tuple includes `"off"`; `resolve_feature_access` has explicit off-deny branch. |
| `backend/app/api/admin.py` | `_VISIBILITY_FEATURES`/`_VISIBILITY_AUDIENCES` allowlist the canvas key + `"off"` | VERIFIED (with WR-01 caveat) | Present and functions for the canvas key; `"off"` is NOT scoped away from the other 4 keys (documented, operator-deferred). |
| `backend/tests/test_revert_byte_identical.py` | The 3 named acceptance tests (D-181-06) | VERIFIED | All 3 present + a 4th CR-01 regression test; re-run 4/4 PASSED. |
| `backend/tests/test_181_off_audience.py` | Off-audience model + admin-allowlist unit tests | VERIFIED | 7 tests, re-run all PASSED. |
| `backend/tests/test_181_flip_on.py` | Gate/flip-on/features integration tests | VERIFIED | 7 tests, re-run all PASSED. |
| `frontend/src/lib/api.ts` | `GovernedFeature` += canvas; `FeatureAudience` += `"off"` | VERIFIED | Present, type-only, consumed by `FeatureVisibility.tsx`/`ControlRoomPage.tsx`/`revertByteIdentical.test.tsx`. |
| `frontend/src/components/admin/FeatureVisibility.tsx` | 5th `FeatureDef` + Off\|On control | VERIFIED | Present, substantive, wired into `ControlRoomPage.tsx`, exercised by re-run tests. |
| `frontend/src/components/admin/revertByteIdentical.test.tsx` | Nav-set parity + Off\|On card gate | VERIFIED | Present, substantive (7 tests), re-run 7/7 PASSED. |
| `scripts/check-181-scope-freeze.sh` | Reusable scope-freeze guard | VERIFIED | Present, substantive (149 lines), re-run this session — exits 0, prints `scope-freeze OK`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `backend/app/api/features.py` | `feature_audience` | `feature_audience(f) != "off"` leading conjunct before `op or ...` | WIRED | Confirmed by grep + `test_features_map_hides_canvas_from_everyone_when_off` re-run PASSED. |
| `backend/app/api/canvas_canary.py` | `require_canvas` | `dependencies=[Depends(require_canvas())]` | WIRED | Confirmed by grep + live 404/200 UAT + test re-run. |
| `backend/app/main.py` | `canvas_canary.router` | `app.include_router(canvas_canary.router)` | WIRED | Confirmed at `main.py:657,688`. |
| `frontend/src/components/admin/ControlRoomPage.tsx` | `setFeatureVisibility` | `handleSetVisibility` non-role branch routes off/everyone | WIRED | Confirmed by grep (`DEFAULT_VISIBILITY.visual_workflow_canvas: "off"` + greenlist seed) + live audit receipts recorded during operator UAT ("Made visual_workflow_canvas visible to everyone"/"...to off"). |
| `frontend/src/components/admin/FeatureVisibility.tsx` | `onSetVisibility` | Off\|On `SegButton`s call `onFlip("off")`/`onFlip("everyone")` | WIRED | Confirmed by grep + `revertByteIdentical.test.tsx` click-assertions re-run PASSED. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GET /features` response | `features["visual_workflow_canvas"]` | `feature_audience()` reading `app_settings.feature_visibility` (live DB via `load_app_settings`, TTL-cached) | Yes — cold default `"off"` from code, live-flippable via the JSONB `\|\|` merge; confirmed live during operator UAT (flip on/off round-tripped and `GET /features` reflected it both directions) | FLOWING |
| `FeatureVisibility` card row | `visibility["visual_workflow_canvas"]` prop | `getFeatureVisibility()` → `GET /admin/visibility` (server-seeded) | Yes — the operator UAT observed the real Off\|On control reading and writing the live record with named audit receipts | FLOWING |
| `/canvas/ping` gate | `feature_audience("visual_workflow_canvas")` | Same `load_app_settings` seam as above | Yes — live-proven both directions (404 off / 200 on) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend off-switch + gate + admin-allowlist unit/integration tests | `pytest tests/test_revert_byte_identical.py tests/test_181_off_audience.py tests/test_181_flip_on.py tests/test_148_effective_features.py -q` | 22 passed | PASS |
| Frontend nav-parity + Off\|On card gate | `npx vitest run revertByteIdentical` | 7 passed | PASS |
| Scope-freeze (doors/run-surface/harness + no-migration/no-package) | `bash scripts/check-181-scope-freeze.sh` | `scope-freeze OK`, exit 0 | PASS |
| Full backend suite (zero-net-new differential) | `pytest tests -q` | 201 failed + 1 error / 2959 passed — same failing files as documented baseline | PASS (matches claimed differential) |
| Full frontend suite (zero-net-new differential) | `npx vitest run` | 10 failed files / 26 failed tests / 1851 passed of 1877 — same 10 files as documented baseline | PASS (matches claimed differential; minor within-file flakiness count drift, no new files) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase; `scripts/check-181-scope-freeze.sh` is the phase's own acceptance script and was executed above under Behavioral Spot-Checks (equivalent treatment — ran directly from repo root, exit code captured).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REVERT-01 | 181-01, 181-02, 181-03 | Operator can turn the canvas layer on/off via a governed key; nav entry + every canvas route gated; the two existing doors + engine untouched when off | SATISFIED | `require_canvas` 404 gate + `FeatureVisibility` Off\|On control + nav byte-identity tests, all re-run green; operator live UAT confirmed doors/run-surface unchanged; scope-freeze confirms doors/harness absent from diff. REQUIREMENTS.md marks Complete. |
| REVERT-02 | 181-01, 181-02, 181-03 | With the flag off, product is provably byte-identical — `test_revert_byte_identical` gate in CI + live milestone-close, not a prose claim | SATISFIED | Backend + frontend `test_revert_byte_identical`/`revertByteIdentical.test.tsx` gates exist, ride existing CI (no `.github/` diff), re-run green; `scripts/check-181-scope-freeze.sh` is explicitly re-runnable at milestone-close with the same ref. REQUIREMENTS.md marks Complete. |

No orphaned requirements found — REQUIREMENTS.md maps only REVERT-01/REVERT-02 to Phase 181, and both appear in every plan's `requirements` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER debt markers found in any of the 14 phase-modified source files | — | None — clean scan. Unrelated pre-existing matches (`KEY_PLACEHOLDER` constant in `user_settings.py`, "coming soon" copy for a different locked feature in `ControlRoomPage.tsx`) predate this phase and are not part of the 181 diff logic. |
| `backend/app/api/admin.py` | 110-112 | WR-01 (code review, still present): `_VISIBILITY_AUDIENCES` accepts `"off"` for ANY governed feature, not scoped to `visual_workflow_canvas` | WARNING | Operator-API-access-only (no end-user privilege escalation); can make `GET /features` under-report an operator's own access on the 4 pre-existing keys while the real `require_visible` gate is unaffected. Explicitly deferred by the operator; documented advisory in `181-REVIEW.md`. Not a phase blocker per operator direction — recommend a follow-up task to scope the check before the next `PUT /admin/visibility` touch. |

### Human Verification Required

None outstanding. The phase's own `checkpoint:human-verify` gate (181-03 Task 2 — operator live-close UAT covering nav absence, `GET /features` false-for-operator, the Off\|On flip + audit receipts, and `/canvas/ping` 404/200) was already executed and **approved by the operator during phase execution** (recorded in `181-03-SUMMARY.md`, timestamped 2026-07-24T16:26:26Z). This satisfies Step 8's UI-verification requirement for this phase; no unresolved lived-experience checks remain.

### Gaps Summary

No blocking gaps. All 12 derived must-haves (roadmap Success Criteria 1-4 plus the PLAN-frontmatter must_haves across all 3 plans) are VERIFIED against the live codebase, independently re-run (not just SUMMARY-claimed): 22 backend + 7 frontend phase-owned tests green, the scope-freeze script green, the full-suite zero-net-new-failures differential corroborated (same failing file sets as documented, within-file count drift consistent with pre-existing flakiness), the CR-01 blocker found by code review is fixed at the root with a passing regression test, and the operator's live-close UAT was already completed and approved during execution.

One non-blocking WARNING is carried forward: WR-01 (the `"off"` write-allowlist audience is not scoped to `visual_workflow_canvas` specifically) remains in the code, unfixed, by explicit operator decision recorded in `181-REVIEW.md`. It does not threaten REVERT-01/REVERT-02 (the enforcement gate for the 4 pre-existing features is untouched; this is an operator-only, self-inflicted governance-display inconsistency), so it does not block phase completion, but it should be tracked as a follow-up before wider `"off"`-audience reuse.

---

_Verified: 2026-07-24T17:20:43Z_
_Verifier: Claude (gsd-verifier)_
