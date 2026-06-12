---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 05
subsystem: api
tags: [harness, publish, golden-run, judge, forced-emit, QUAL-01, workflow, fastapi, audit]

# Dependency graph
requires:
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: "Plan 01 business_requirement field + harness_judge_model setting + 6 receipt kinds; Plan 02 migration 070 LIVE on :54322 (is_golden_run column + publish/judge CHECK kinds); Plan 03 the llm_judge_rubric machinery (JudgeVerdict + JUDGE_RUBRIC_CORE + forced_emit judge shot); Plan 04 the engine seams the judge gate reuses (timing/ask_user/policy)"
  - phase: 091-harness-engine
    provides: "reachability.lint_workflow (the publish stage-1 structural lint) + run_workflow (the golden-run engine drive) + create_workflow_run (the atomic run+phases+anchor txn)"
  - phase: 101.1-guaranteed-emission-layer
    provides: "the forced_emit sealed-shot seam (the judge rides it — truncation-safe, honest fail) + the WR-02 fail_phase output persist (the structural_gate failure-reason harvest)"
  - phase: 098-project-folder-binding
    provides: "resolve_project_subtree (the golden run's resolved KB folder scope) + the additive-optional WorkflowDefinition.project_folder_id binding"
provides:
  - "POST /workflows/{definition_id}/publish — the ONLY draft->published path (D-07), on api/workflows.py (G-5: NOT threads.py)"
  - "publish_service.publish() — the 4-stage orchestration: business_requirement -> lint -> REAL golden run (is_golden_run=True) -> judge verdict -> flip (D-07/D-08)"
  - "get_definition(by id, owner-scoped, drafts included) + create_workflow_run is_golden_run kwarg + publish_definition (the draft->published flip) on db/workflows.py"
  - "the D-08 structured verdict shape: {published, blocked_stage, named_failures, golden_run_id} (machine-renderable for 103, nothing prose-only)"
  - "the QUAL-01 hard blocker LIVE: a lint-clean workflow whose judge fails CANNOT publish; governance receipts (publish_attempted/blocked/succeeded + judge_verdict) written on every path"
  - "test_publish_flip.py un-marked GREEN: the draft->published flip allowed + published->edit blocked, proven LIVE against :54322"
affects: [103-nl-workflow-authoring (the Workflows page is a client of this endpoint), 105-budget-preflights (reuse the timing:pre seam), 107-receipt-view (the publish/judge receipts)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sealed publish orchestration (the forced_emit posture): publish() branches internally and returns a structured D-08 dict, NEVER raises into the route; the golden-run drive is wrapped -> a mid-run crash returns blocked_stage='golden_run_error', never a 500"
    - "Out-of-threads.py ctx build (G-5): the golden-run ctx mirrors harness_engine._build_resume_context (the canonical resume-path SimpleNamespace) — ephemeral validation thread + service-role supabase + resolved folder scope + resolve-never-mutate ctx model — so a real run drives without growing threads.py"
    - "Honest receipt keying: publish_attempted is written AFTER the golden run row exists (real run_id); a stage-0/1/2 block (before any run) writes publish_blocked keyed to a NULL run_id (harness_audit.run_id is nullable) with the definition id in metadata"
    - "404-collapse for owner-scope (V4/T-102-05-06): get_definition returns None for both not-found AND cross-user; the route 404s uniformly (no existence leak — the 101.1-09 precedent)"

key-files:
  created:
    - "backend/app/services/harness/publish_service.py"
  modified:
    - "backend/app/db/workflows.py"
    - "backend/app/api/workflows.py"
    - "backend/tests/unit/test_publish_service.py"
    - "backend/tests/unit/test_publish_flip.py"

key-decisions:
  - "publish() is the canonical name; publish_workflow is an alias (the Wave-0 stubs assert hasattr(publish_service, 'publish_workflow'))"
  - "The golden run gets an EPHEMERAL validation thread (create_workflow_run requires a thread_id) — the simplest viable anchor (plan Task 2 note); titled '[validation] publish golden run — <name>', folder-bound when the workflow is project-bound"
  - "The judge model resolves to Settings.harness_judge_model, else the first forced_emission-capable default (claude-opus-4-8 / gpt-5.5) — the INDEPENDENT judge (D-03), never the run model; a no-resolution is an honest {failure} block, never a silent pass"
  - "publish_definition returns -1 (not a raise) when the row is not a draft — the caller already owner-checked + state-checked; the status='draft' WHERE guard makes a double-publish idempotent"
  - "test_publish_flip.py un-marked to a REAL live round-trip against :54322 (seed draft -> flip allowed -> published->edit raises CheckViolation -> rollback) — the Plan-05 + live-070 un-mark-on-landing this plan owns"

patterns-established:
  - "the D-08 structured verdict is the publish ABI: every block names {blocked_stage, named_failures, golden_run_id}; the route maps not_found->404, already_published->409, business_requirement->400, every other block + success->200 — 103 renders the verdict, never re-derives it"
  - "the judge verdict parse lives in the caller (publish_service / validator), NOT in forced_emit: the forced shot returns its EmitFieldMap result, the caller re-validates the raw dict as a JudgeVerdict — forced_emit stays byte-untouched"

requirements-completed: []  # QUAL-01 is MULTI-PLAN — it marks complete at phase verification (the 099/WFSKILL-01 convention), NOT at this final-plan landing

# Metrics
duration: ~9min
completed: 2026-06-12
---

# Phase 102 Plan 05: The Server-Side Publish Path (QUAL-01) Summary

**The QUAL-01 output-quality gate ships LIVE: `POST /workflows/{id}/publish` (on api/workflows.py — G-5, NOT threads.py) is the ONLY draft->published path, enforcing `business_requirement` -> structural lint -> a REAL golden run (`is_golden_run=True`, no mocks/no opt-out) -> the `llm_judge_rubric` forced-emission verdict -> the flip; a lint-clean workflow whose judge fails CANNOT publish. `publish_service.publish()` is a sealed orchestration that returns the D-08 structured verdict and never raises into the route; the draft->published flip is proven allowed (and published->edit still blocked) LIVE against :54322.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-12T07:35:03Z
- **Completed:** 2026-06-12T07:44:20Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- **`db/workflows.py` (the publish substrate):** `get_definition(by id, owner-scoped, DRAFTS included)` mirrors the `list_published_workflows` RLS predicate (`created_by = $2 OR is_global`) for a single id — a non-owner gets `None` (the route 404s, no existence leak, V4); `create_workflow_run` gains `is_golden_run: bool = False` (keyword-only — every existing caller stays byte-identical, the migration-070 column set on the live run row); `publish_definition` flips `status` draft->published keyed by id, RETURNING the version, with a `status='draft'` WHERE guard making a double-publish idempotent. `$N` placeholders only (0 f-string SQL added).
- **`publish_service.py` (the 4-stage orchestration, D-07/D-08):** `publish()` runs (0) load+owner-check, (1) `business_requirement` present (D-13 publish-time invariant), (2) `lint_workflow` (short-circuits BEFORE any golden run), (3) the REAL golden run on the project KB (`is_golden_run=True`), (4) the judge verdict over the run's final output (the QUAL-01 hard blocker), (5) the flip. Every block returns `{published: False, blocked_stage, named_failures, golden_run_id}` AND writes a `publish_blocked` receipt; the attempt writes `publish_attempted` (keyed to the real golden run id once it exists); a success writes `publish_succeeded` + a `judge_verdict` receipt. The function NEVER raises into the route — a golden-run crash returns `blocked_stage="golden_run_error"` (the forced_emit sealed-orchestration backstop).
- **The golden-run drive (`_drive_golden_run`, G-5-safe):** mirrors `harness_engine._build_resume_context` (the canonical out-of-threads.py ctx template) — creates an ephemeral validation thread (the run anchor `create_workflow_run` requires), builds a minimal validation `SimpleNamespace` ctx with the service-role supabase + the run owner's resolved ctx model (resolve-never-mutate) + the project's resolved `folder_subtree_ids` (so the golden run retrieves ONLY the bound KB), then drives `run_workflow` end-to-end and harvests the terminal status + the final phase output for the judge.
- **The judge shot (`_judge_golden_output`):** reuses the Plan-03 `JudgeVerdict` + `JUDGE_RUBRIC_CORE` (the business_requirement woven as DATA — T-102-03-02) and the independent `harness_judge_model` (D-03, never the run model); the verdict rides `forced_emit` (truncation-safe); a `failure`/None result is an honest `{failure}` block (never a silent pass). The author's per-workflow criteria ride a declared `llm_judge_rubric` ValidatorSpec.config (D-04), else the standard core alone judges (the free-form archetype, D-09).
- **`POST /workflows/{id}/publish` route (api/workflows.py — G-5):** joins the EXISTING workflows router (already mounted in `main.py` — no new registration); `PublishRequest`(golden_input) + `PublishVerdict`(machine-renderable D-08 shape); delegates to `publish_service.publish` (imported as a MODULE — patchable); HTTP mapping `not_found->404` (no existence leak), `already_published->409`, `business_requirement->400` (D-13), lint/structural/judge block or success ->200 structured verdict; `definition_id: UUID` path param -> 422 on a malformed id (V5).
- **`test_publish_flip.py` un-marked LIVE:** seed a draft -> the draft->published flip (publish_definition's exact UPDATE) is ALLOWED by the `workflow_definitions_block_published` immutability trigger -> a published->edit raises `CheckViolation` (still blocked) -> rollback (no pollution). Proven against :54322.

## Task Commits

Each task was committed atomically:

1. **Task 1: get_definition + is_golden_run kwarg + publish_definition flip** - `14d375ee` (feat)
2. **Task 2: publish_service 4-stage orchestration (D-07/D-08, QUAL-01)** - `d2d05b59` (feat)
3. **Task 3: POST /workflows/{id}/publish route (G-5: api/workflows.py)** - `d08c3b0c` (feat)
4. **Un-mark: publish-flip live round-trip against :54322** - `ba79174a` (test)

**Plan metadata:** (final docs commit) — SUMMARY + STATE + ROADMAP

_TDD note: per the project's Wave-0 un-mark-on-landing convention (098/099/101.1/102-03/102-04), the RED deliverable (the xfail-marked test stubs) shipped in Plan 01; this plan's GREEN un-marks fold into each task's feat commit. RED was re-confirmed live (`test_publish_service.py` = 3 xfailed at the wave base). The 3 thin Plan-01 stubs were strengthened to real behavior tests (mocking the golden-run + judge BOUNDARIES per `feedback_mock_completeness`) + 3 extra service tests (good-output-publishes, cross-user-not-found, golden-run-error-structured) + 4 route-level HTTP-mapping tests (404/400/200-success/200-judge-block) = 10 GREEN; the live publish-flip round-trip un-marks separately as a `test(...)` commit._

## Files Created/Modified
- `backend/app/services/harness/publish_service.py` *(NEW, 584 lines)* — the 4-stage publish orchestration + `_drive_golden_run` (the resume-path-mirroring ctx) + `_judge_golden_output` (the forced judge shot) + the `_block`/`_safe_audit` receipt helpers
- `backend/app/db/workflows.py` — `get_definition` (owner-scoped, drafts) + `create_workflow_run` `is_golden_run` kwarg (in the INSERT) + `publish_definition` (the draft->published flip)
- `backend/app/api/workflows.py` — the `POST /{definition_id}/publish` route + `PublishRequest`/`PublishVerdict` + the `publish_service` module import + the HTTP-status mapping (404/409/400/200)
- `backend/tests/unit/test_publish_service.py` — un-marked + strengthened (10 tests: 6 service + 4 route)
- `backend/tests/unit/test_publish_flip.py` — un-marked to the live draft->published round-trip against :54322

## Decisions Made
- **`publish()` is the canonical orchestration name; `publish_workflow` is a back-compat alias.** The Wave-0 stubs assert `hasattr(publish_service, "publish_workflow")`; the route + the rest of the service call `publish`. Both are exported (the alias is `publish = publish_workflow`).
- **The golden run gets an EPHEMERAL validation thread** (`create_workflow_run` requires a `thread_id`) — the simplest viable anchor (the plan's Task 2 note offered create-an-ephemeral-thread OR accept-a-thread-id; the ephemeral path keeps the endpoint self-contained). It is titled `[validation] publish golden run — <name>` and folder-bound when the workflow is project-bound; the blocking supabase-py `.insert` is wrapped with `run_in_threadpool` (D-v2.5-01).
- **The judge model resolves to `Settings.harness_judge_model`, else the first `forced_emission`-capable default** (`claude-opus-4-8` then `gpt-5.5` — both confirmed forceable in the Plan-01 SUMMARY) — the INDEPENDENT judge (D-03), never the run model; an unresolvable model is an honest `{failure}` block.
- **The `publish_attempted` receipt is written AFTER the golden run row exists** (the documented receipt-keying choice, plan Task 2 note) so it carries a real `run_id`; a stage-0/1/2 block writes `publish_blocked` keyed to a NULL `run_id` (`harness_audit.run_id` is nullable — full-schema.sql:452) with the definition id in metadata. The governance trail is honest about whether a real run was created.
- **`_safe_audit` swallows a receipt-write failure** (logged, never fails the publish) — the receipt is the governance trail, not the gate; a transient DB hiccup on the INSERT must not 500 a decision already made.
- **`test_publish_flip.py` un-marked to a REAL live round-trip** — the plan's verification line (the draft->published flip allowed + published->edit blocked, against :54322 once 070 is live + Plan 05 lands) is now satisfied with a seed-flip-edit-rollback round-trip, not a stub.

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed their named files (`db/workflows.py`, `publish_service.py`, `api/workflows.py`); `threads.py` is byte-untouched (G-5 satisfied — proven by `git diff --stat`); the golden run is a REAL run with no mocks (D-05); the judge rides `forced_emit` unmodified (the verdict parse lives in the caller); the publish flip is the allowed path while published->edit stays blocked. The Plan-01 thin stubs were strengthened to real behavior tests (the un-mark-on-landing convention explicitly invites this — the stubs pinned the contract, this plan satisfies the behavior); the live publish-flip un-mark is the Plan-05-owned half the Plan-01 + Plan-02 SUMMARYs both flagged.

## Authentication Gates
None — no auth-gated step in this plan (offline unit work + a live :54322 DB round-trip). The live golden-run publish path (a real provider judge shot against the project KB) is exercised by the VALIDATION.md SC#10 4-axis rows at phase verification, not here.

## SEED-056 Net-New-Failure Proof
- **Plan-05 target suite:** `test_publish_service.py` (10) + `test_publish_flip.py` (1 live) = **11 passed / 0 failed**.
- **Wider harness/workflow slice** (`-k "workflow or publish or harness or emit or validator or gate or audit or reachability or freshness or timing or citation or ask_user"`): **166 passed / 3 failed**. The 3 failures (`test_075_4_final_output_files_payload`×2 + `test_phase56_iteration_start`) are **PRE-EXISTING ROT proven by base-checkout**: with `db/workflows.py` + `api/workflows.py` reverted to the wave base `c0fe3633`, the **same 3 fail IDENTICALLY** (`publish_service.py` is a new file no pre-existing test imports). They are production-source-assertion tests (they grep `threads.py`/`task_service.py` source) that import NONE of this plan's changed modules. Source restored clean to HEAD (`git status --short` empty for both files); the 11 Plan-05 tests re-confirmed GREEN after restore. **Net-new failures introduced by this plan = 0.**

## Threat Surface
All changes fall inside the plan's `<threat_model>` (T-102-05-01..06):
- **T-102-05-01 (EoP — publishing another user's draft):** mitigated — `get_definition` owner-scopes (`created_by = $2 OR is_global`); a non-owner gets `None` -> the route 404s; the owner-check runs BEFORE any lint/golden-run work (V4).
- **T-102-05-02 (gameable verdict silently passing bad output):** mitigated — the judge rides `forced_emit` (truncation-safe, honest fail); a `failure`/None verdict is a `judge` block; the golden run is REAL (no mocks, no opt-out, D-05); publish_attempted/blocked/succeeded + judge_verdict receipts (INSERT-only).
- **T-102-05-03 (prompt injection via business_requirement / golden_input):** mitigated — `JUDGE_RUBRIC_CORE` is a FIXED prompt; the requirement is woven as clearly-delimited DATA; `overall_passed` is schema-bound (the verdict re-validated as a `JudgeVerdict`); the judge is the independent `harness_judge_model` (D-03).
- **T-102-05-04 (DoS — publish spam / golden-run cost):** mitigated as designed — publish is a rare deliberate authenticated event (D-05 accepts the cost); owner-scope bounds the surface; the golden run rides the existing wall-clock + step caps. Rate-limiting is noted future hardening (not built v1).
- **T-102-05-05 (the publish flip bypassing the immutability trigger):** mitigated — the flip is `WHERE id=$1 AND status='draft'`; the trigger ALLOWS `OLD.status='draft'`; a published->edit still raises `CheckViolation` — proven LIVE by `test_publish_flip.py` against :54322.
- **T-102-05-06 (a not_found leaking another user's draft existence):** mitigated — `get_definition` returns `None` for both not-found AND cross-user; the route 404s uniformly (the 101.1-09 404-collapse precedent).

No new auth path or trust-boundary surface beyond the ONE planned publish endpoint (authed via `Depends(get_current_user)`, owner-scoped in `get_definition`). **No threat flags.**

## Known Stubs
None. The publish path is a complete behavior contract: a REAL golden-run drive (`run_workflow` end-to-end, no mocks — D-05), a REAL judge shot (`forced_emit`), a REAL DB flip (`publish_definition`), and a REAL live publish-flip round-trip test. The unit tests mock the golden-run + judge BOUNDARIES to assert the pipeline ORDER + the hard-blocker contract deterministically — but the REAL acceptance is the LIVE golden run at publish time (D-05 / Pitfall 4, the documented "the live UAT is the gate, not the mocked unit test" posture), exercised by the VALIDATION.md SC#10 4-axis cross-provider rows at phase verification. The "placeholder" strings in `db/workflows.py` refer to SQL `$N` query placeholders, not code stubs. No source stubs flow empty data to a UI (the Workflows page that consumes this endpoint is Phase 103).

## Next Phase Readiness
- **Phase 103 (NL authoring / Workflows page) unblocked:** the `POST /workflows/{id}/publish` endpoint + the machine-renderable `PublishVerdict` are the contract 103's page renders (the page is just a client — it never re-derives the verdict). The `citation_policy` family (Plan 04) surfaces as one plain-language authoring question; the rubric auto-draft anchors on the `business_requirement` this endpoint enforces.
- **QUAL-01 ready for phase verification:** the hard blocker is LIVE (lint-clean + judge-fail CANNOT publish); the golden run is a real run on the project KB; the publish/judge governance receipts are written. The live acceptance (D-05) is the SC#10 4-axis golden-run scoreboard, run at `/gsd:verify-work 102`.
- **Phase 107 (receipt view):** the `publish_attempted/blocked/succeeded` + `judge_verdict` receipts (with the definition id always in metadata, real run_id when a golden run exists) are the governance rows the VIEW surfaces.

## Self-Check: PASSED

- `backend/app/services/harness/publish_service.py` — FOUND.
- `backend/app/api/workflows.py` contains `@router.post("/{definition_id}/publish"` + `PublishRequest`/`PublishVerdict` — FOUND.
- `backend/app/db/workflows.py` contains `get_definition`, `publish_definition`, `is_golden_run` in the workflow_runs INSERT — FOUND.
- Commit `14d375ee` (Task 1) — FOUND in git history.
- Commit `d2d05b59` (Task 2) — FOUND in git history.
- Commit `d08c3b0c` (Task 3) — FOUND in git history.
- Commit `ba79174a` (publish-flip un-mark) — FOUND in git history.
- All 11 Plan-05 tests GREEN; net-new failures = 0 (base-checkout proven against `c0fe3633`); `threads.py` byte-untouched (G-5).

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-12*
