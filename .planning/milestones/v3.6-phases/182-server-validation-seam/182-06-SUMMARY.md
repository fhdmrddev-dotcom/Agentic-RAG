---
phase: 182-server-validation-seam
plan: 06
subsystem: api
tags: [fastapi, harness, publish-gauntlet, grounding, anti-drift, pytest, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plan 01)
    provides: "the ONE shared harness/grounding.py source — assemble_grounding_bundle + grounding_verdicts, the collector this stage delegates to"
  - phase: 182-server-validation-seam (plan 04)
    provides: "the per-node folder_scope keying (FolderScopeSubsetError.phase_slug) — every verdict this stage forwards is already node-keyed"
  - phase: 163-atomic-crux-membership-rls
    provides: "get_service_role_supabase(org_id) — the org-requiring service-role factory that REFUSES a falsy org (T-163-05b)"
  - phase: 102-publish-gauntlet
    provides: "publish_workflow's staged orchestration + _block + the D-08 {published, blocked_stage, named_failures} verdict"
provides:
  - "publish_service._grounding_fidelity_failures — publish stage 2.6, delegating to the SHARED grounding collector (zero rule re-implementation)"
  - "publish_service._resolve_publish_supabase — the ONE org-scoped service-role resolution on the publish path, shared with _drive_golden_run"
  - "blocked_stage == 'grounding_fidelity' — a new pre-run block in the existing D-08 vocabulary, needing no route branch"
  - "backend/tests/unit/test_182_publish_grounding_stage.py — 7 falsification-proven tests incl. the direct /validate-vs-publish agreement assertion"
  - "corrected parity claims in api/workflows.py + the create_draft/update_draft exclusion recorded as a decision in source"
affects: [184-editable-canvas-live-validation, 185-graded-governance, 187-business-vocabulary-ai-seeded-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anti-drift ENFORCEMENT: the preview seam and the enforcing gate call one collector, with an agreement test that fails if a second copy of a rule appears"
    - "Fail-closed pre-run gate: an unverifiable registry BLOCKS with a named failure instead of passing or raising into a sealed orchestration"
    - "One-construction-path helper for a BYPASSRLS client (a second copy is how an org-less fallback creeps back in)"
    - "Module-level patchable seam so a unit suite with an AsyncMock pool can never reach a real network client"

key-files:
  created:
    - backend/tests/unit/test_182_publish_grounding_stage.py
  modified:
    - backend/app/services/harness/publish_service.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_publish_service.py

key-decisions:
  - "The stage is APPENDED at 2.6 (after interactive_phase, before the golden run) so no currently-blocking definition changes which stage it blocks at — proven by a dedicated ordering test"
  - "Fail CLOSED on a registry-resolution failure (code grounding_unavailable, phase None): returning [] would silently publish an unverified definition — the exact defect this stage closes; raising would break the sealed-orchestration contract"
  - "_resolve_publish_supabase reaches the factory via `from app import dependencies as _deps` so the literal get_service_role_supabase appears exactly ONCE in the module — the acceptance criterion's grep is a real one-construction-path guard, not cosmetics"
  - "test_publish_service.py's grounding patch was folded into the Task-1 GREEN commit rather than Task 2, so no commit in this plan ships with a red suite"
  - "grounding_verdicts is never patched in the blocking tests — the real collector executes, or the test would only prove a mock fired"

patterns-established:
  - "Preview-vs-enforcement agreement test: run BOTH real code paths over one definition + one fake registry and assert set equality on the structural (code, phase) pairs"
  - "Measure a strictness change against the repo's own seeded data before calling it benign"

requirements-completed: []  # VALID-01 already marked complete at 182-03; this plan closes a goal-fidelity gap under the same ID

# Metrics
duration: 10min
completed: 2026-07-25
---

# Phase 182 Plan 06: Publish Grounding Enforcement Summary

**`publish_workflow` now ENFORCES grounding fidelity at a new stage 2.6 that calls the same shared `grounding_verdicts` collector `POST /workflows/validate` previews — so a definition with a hallucinated tool or an inaccessible skill reference can no longer paint red in `/validate` and publish green, and an agreement test asserts the two sides report the identical finding set.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-24T22:57:08Z
- **Completed:** 2026-07-24T23:07:18Z
- **Tasks:** 3 (Task 1 TDD — RED then GREEN)
- **Files modified:** 4 (2 source, 2 test — exactly the plan's `files_modified`, no deletions)

## Accomplishments

- **The phase-goal clause is now literally true.** `182-VERIFICATION.md` Truth 5 recorded that the seam's own header comment — "Every rule it previews is the SAME copy the publish gauntlet enforces" — was false for grounding fidelity: `publish_workflow` never called `grounding_verdicts`, so a hand-crafted or API-authored definition could create, validate red, and publish green with a tool that does not exist or a skill the author cannot reach. It is blocked now, at `blocked_stage == "grounding_fidelity"`, before any provider run.
- **Still exactly ONE copy of every grounding rule.** The stage delegates to `grounding.assemble_grounding_bundle` + `grounding.grounding_verdicts` and returns the collector's list **unchanged** — no re-shaping, no re-filtering, no re-classifying. A structural guard test asserts `publish_service.py` contains neither `available_tools` nor `skill_ref` (the vocabulary a re-implementation would have to reach for); both greps are 0.
- **The anti-drift property is ASSERTED, not inferred.** `test_validate_and_publish_report_the_same_grounding_findings` drives one definition (two violations on two distinct phases) through the **real** `/validate` route handler and the **real** publish orchestration over one fake registry, then asserts set equality on the `(code, phase)` pairs. Its failure message names the phase-goal clause and states that a divergence means a second copy of a rule has appeared.
- **Cheap gate, correct position.** Stage 2.6 runs after every existing cheap block and before the golden run — one folder read + one skill read + the in-process tool registry, no provider call. `test_lint_still_blocks_first_when_a_definition_fails_both` proves the stage was appended, not inserted: a definition failing both lint and grounding still blocks at `lint`, so no currently-blocking definition changed which stage it blocks at.
- **Fails closed.** A registry-resolution failure returns a single `grounding_unavailable` named failure and BLOCKS — it never publishes an unverified definition and never raises into the route. Pinned by test (d), which also fails when the stage is removed.
- **One service-role construction path.** `_resolve_publish_supabase` now owns the org-scoped BYPASSRLS resolution (Phase 163 / T-163-05b) for both stage 2.6 and `_drive_golden_run`; the literal `get_service_role_supabase` appears exactly once in the module.
- **Both false claims in source corrected**, with provenance: the seam header now pairs each of the four checks with the shared symbol AND the publish stage that enforces it, and records that the grounding half was added in this gap closure. The publish route docstring's enforced order now matches `publish_workflow`'s stage list exactly.

## Task Commits

1. **Task 1 RED — failing tests for the publish grounding stage** — `fbda9d46` (test)
2. **Task 1 GREEN — stage 2.6 + the two shared seams + docstring corrections** — `95a3c458` (feat)
3. **Task 2 — agreement / fail-closed / ordering / one-source regressions** — `31d40328` (test)
4. **Task 3 — corrected parity claims + the draft-route exclusion** — `7c33b664` (docs)

No REFACTOR commit — the change is additive and there was nothing to clean up.

## Files Created/Modified

- `backend/app/services/harness/publish_service.py` (+178/−27) — new `_grounding_fidelity_failures` (the stage-2.6 helper, placed beside `_interactive_phase_failures`, function-local grounding import, fail-closed `try`/`except` around ONLY the resolution + the two collector calls); new `_resolve_publish_supabase` (the shared org-scoped service-role resolution, carrying the Phase-163 explanation that used to live inline in `_drive_golden_run`, which now calls it); the stage-2.6 call site in `publish_workflow` with an explicit ordering rationale; module docstring updated with the corrected numbered stage list, the anti-drift paragraph, the NULL-`run_id` receipt sentence extended to stages 2.5/2.6, and the deliberate `create_draft`/`update_draft` exclusion recorded as a decision.
- `backend/app/api/workflows.py` (+39/−6) — the Phase-182 seam header comment now proves the parity claim with a per-check table (shared symbol → publish stage) plus a provenance sentence; the `POST /{definition_id}/publish` docstring lists the enforced stages in `publish_workflow`'s exact order and notes that `grounding_fidelity` falls through to a 200 structured verdict (no new route branch); a decision comment above `create_draft` (referenced from `update_draft`) records the deliberate no-grounding-on-draft choice. **The D-182-05 GATE paragraph is byte-unchanged** — confirmed by a targeted diff grep, since plan 182-05's decision note cites it by line.
- `backend/tests/unit/test_182_publish_grounding_stage.py` — **new, 7 tests / 413 lines.** (a) hallucinated tool blocks; (b) inaccessible `skill_ref` blocks; (c) grounded-clean still reaches the golden run; (d) fail-closed `grounding_unavailable`; (e) lint still blocks first; (f) the `/validate`-vs-publish agreement; (g) the structural one-source guard. Patches only the registry READ and the client resolution — never `grounding_verdicts`.
- `backend/tests/unit/test_publish_service.py` (+13) — the 6 tests that reach stage 2.6 now patch `_grounding_fidelity_failures` to `[]`, with one comment explaining the division of labour. **19 test definitions before and after**; no assertion, name, or structure touched.

## Seeded-Definition Audit (the behavior-change measurement)

Publish is now strictly stricter, so the plan required measuring the change against the repo's own seeded definitions rather than assuming it benign.

| Source | Declared `available_tools` | `skill_ref` count |
|---|---|---|
| `supabase/migrations/061_harness_seed_templates.sql` | `["search_documents", "execute_code"]`, `["search_documents", "web_search"]`, `["search_documents"]` | 0 |
| `supabase/migrations/066_eval_coverage_seed.sql` | `["search_documents", "web_search"]`, `["search_documents"]` | 0 |
| `supabase/migrations/094_starter_workflows.sql` | `["search_documents"]` | 0 |

- **Seeded tool-name set (union, 3):** `execute_code`, `search_documents`, `web_search`
- **Live registry set (28)** — `get_tools(None)` → `t["function"]["name"]`, run in the venv: `analyze_document, ask_user, attach_skill_file, execute_code, fetch_document_file, get_related_documents, glob, grep, load_skill, ls, query_documents, query_documents_by_view, query_tables, read_document, read_skill_file, recall, remember, save_skill, search_documents, task, tree, web_search, workspace_delete, workspace_diff, workspace_list, workspace_read, workspace_write, write_todos`
- **seeded − registry = ∅** (nothing seeded is unregistered)
- **registry − seeded = 25** (the seeds simply use a small slice of the registry — expected, not a finding)
- **`skill_ref` across all three files: 0** — Rule 3 is inert for seeded rows.

**Would any seeded definition now be blocked? NO.** Two independent reasons: (1) every seeded tool name is in the live registry and no seed declares a `skill_ref`; (2) all seeded rows are inserted with `status='published'` (5 + 4 + 2 literal `'published'` occurrences across the three files), so they never re-enter the publish path at all — stage 0 returns `already_published` long before stage 2.6. **No operator action required, no seed change proposed.**

## Decisions Made

- **Append at 2.6, never reorder.** Placing the stage before the existing gates would have changed which stage some currently-blocking definitions report — a silent behavior change for any client reading `blocked_stage`. Test (e) pins the choice.
- **Fail closed, with a distinct code.** `grounding_unavailable` (phase `None`) is deliberately NOT one of the three grounding rule codes: it says "we could not check", not "the definition is wrong". Returning `[]` on a resolution failure would silently publish an unverified definition — precisely the defect being closed. Raising would break `publish_workflow`'s sealed-orchestration contract.
- **Only the resolution + the two collector calls are wrapped.** The `try` is deliberately narrow so a bug in the block/receipt path still surfaces normally instead of being laundered into a `grounding_unavailable`. This also keeps the plan's warning about `grounding.py`'s bare `except ValueError` from widening: nothing here catches on a narrower or broader class than the collector already handles internally.
- **`from app import dependencies as _deps` instead of a direct symbol import.** The acceptance criterion pins `grep -c "get_service_role_supabase" == 1`, which is a genuine one-construction-path guard — a direct `from ... import` would make it 2 and the guard would stop distinguishing "shared" from "duplicated". The module-attribute form keeps the count honest and adds a cleaner patch seam.
- **No re-litigation of SEED-132.** The plan's prior-wave note warned against building the very bypass SEED-132 describes. Stage 2.6's failures travel as `named_failures` inside the existing D-08 verdict envelope — no new response vocabulary, no second error surface, no `@model_validator` added. `PublishVerdict` needs no change and the route needs no new branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved the `test_publish_service.py` patch-stack edit from Task 2 into the Task-1 GREEN commit**

- **Found during:** Task 1 verification
- **Issue:** The plan assigns `test_publish_service.py` to Task 2, but the moment stage 2.6 lands, the 6 pre-existing tests that reach it construct a **real** Supabase client (their `pool` is an `AsyncMock`, so `await pool.fetchval(...)` hands a truthy mock to the org-requiring factory). Observed directly: `6 failed, 20 passed`, with `SyncPostgrestClient` deprecation warnings proving live client construction. Committing Task 1 as specified would have shipped a commit with a red suite and a unit test making network calls.
- **Fix:** Applied the plan's own Task-2 edit (`patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[]))` in the 6 affected `with` blocks, plus the explanatory comment) inside the Task-1 GREEN commit. Same file, same edit, same content the plan prescribes — only the commit boundary moved.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Verification:** `28 passed` immediately after; test definition count re-confirmed at **19**; no assertion, name, or ordering changed.
- **Committed in:** `95a3c458`

**2. [Rule 2 - Missing Critical] Added a 7th test — the structural one-source guard**

- **Found during:** Task 2
- **Issue:** The plan's must-have "no rule is re-implemented inside `publish_service.py`" was only checked by two `grep` lines in the acceptance criteria — i.e. by the executor at execution time, not by anything that would catch a regression later. The 182-01/182-04 plans both shipped a structural one-source guard for exactly this reason.
- **Fix:** `test_publish_service_calls_the_shared_collector_and_implements_no_rule` reads the module source and asserts `grounding_verdicts` and `stage="grounding_fidelity"` are present while `available_tools` and `skill_ref` are absent, with failure messages naming D-182-06.
- **Files modified:** `backend/tests/unit/test_182_publish_grounding_stage.py`
- **Verification:** Green; the plan's `>= 6` test-count criterion is met at 7.
- **Committed in:** `31d40328`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical). No architectural change, no scope creep — the diff is exactly the 4 files in `files_modified`, no deletions, no migration, no new dependency, no frontend file.

## Falsification Check (recorded, as the plan requires)

The Task-1 stage insertion was temporarily replaced with `grounding_failures = []` (the helpers left intact, so the probe isolates the CALL SITE), the suite was re-run, then the file was restored from a scratchpad backup — **never** via `git checkout`, to avoid the index contamination plan 182-04 hit.

| State | Result |
|---|---|
| Task-1 RED (no seam, no stage) | **2 failed** — `AttributeError: ... does not have the attribute '_resolve_publish_supabase'` |
| Stage call site removed (falsification probe) | **4 failed, 3 passed** — (a) hallucinated tool, (b) skill_ref, (d) fail-closed, (f) agreement all FAIL; (c) clean-proceeds, (e) lint-first and (g) source-guard correctly still pass |
| Restored | **7 passed**; `md5sum` matches the pre-probe backup and `git diff HEAD` for the file is empty |

The plan required (a), (b) and (f) to fail; (d) fails too, which is strictly stronger.

## Verification

| Gate | Command | Result |
|---|---|---|
| Task 1 seams | `python -c "import ...publish_service as p; assert hasattr(p,'_grounding_fidelity_failures') and hasattr(p,'_resolve_publish_supabase')"` | exit 0 |
| Task 1 | `pytest tests/unit/test_182_publish_grounding_stage.py -q` | 2 passed (RED→GREEN) |
| Task 2 | `pytest tests/unit/test_182_publish_grounding_stage.py tests/unit/test_publish_service.py -q` | **27 passed** |
| Task 3 | `pytest tests/unit/test_182_validate.py tests/test_182_grounding_bundle.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py -q` | **30 passed** |
| Plan verification (11 files) | the `<verification>` command | **81 passed, 0 failed** (required ≥ 79) |
| Sibling 182 suites (no regression) | `pytest tests/unit/test_182_folder_scope_keying.py tests/unit/test_182_grounding_skill_org_gate.py tests/test_harness_resume.py -q` | **34 passed** |
| Scope | `git diff --stat 28d101d5..HEAD` | exactly the 4 `files_modified`; `--diff-filter=D` empty |

Grep criteria — `grounding_verdicts` in `publish_service.py` = **4** (≥1) · `stage="grounding_fidelity"` = **1** · `get_service_role_supabase` = **1** (exactly) · `create_draft` = **1** (≥1) · `available_tools` = **0** · `skill_ref` = **0** · stage line **222** < `_drive_golden_run(` call line **240** · `test_publish_service.py` test count = **19** (unchanged) · new-file test count = **7** (≥6) · `validate_workflow` in the new file = **1** · `named_failures` = **8** · patches targeting `grounding_verdicts` = **0** · `workflows.py`: `grounding_fidelity` = **2** (≥1), `They must NEVER stack` = **1**, `D-182-05` = **3** (≥2), `enforcing gate` = **3** (≥1) · `grounding` references inside `create_draft` / `update_draft` bodies (AST-scoped) = **0 / 0**.

## Threat Model Coverage

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-182-14 (EoP — publish accepting an ungrounded definition) | mitigate | **CLOSED — this is the gap.** Tests (a) and (b) prove the block; the falsification probe proves the tests have teeth. |
| T-182-15 (Info Disclosure — `named_failures` messages) | accept | Unchanged. The three grounding messages echo the caller's own submitted values (phase slug, tool name, skill UUID) back to the definition's owner; stage 0's owner-check runs first. The new `grounding_unavailable` message names no row, org or identifier. |
| T-182-16 (Info Disclosure — the service-role client) | mitigate | Held. `_resolve_publish_supabase` is the ONE construction path and goes through the org-requiring factory that refuses a falsy org; the literal appears exactly once in the module. No bare org-less BYPASSRLS client exists on the publish path. |
| T-182-17 (DoS — a new blocking read on the publish path) | mitigate | Held. One folder read + one org-membership read + one skill read, added to a request that was already about to drive a full provider run; `assemble_grounding_bundle` already wraps its blocking `supabase-py` skill read in `run_in_threadpool` (D-v2.5-01) — no new blocking call on the event loop. |
| T-182-18 (Tampering / fail-open — the stage's own failure path) | mitigate | Held and pinned by test (d): `grounding_unavailable` BLOCKS, and the call never raises. |
| T-182-19 (Repudiation — the governance trail) | mitigate | Held. The block goes through the existing `_block`, writing a `publish_blocked` receipt with `blocked_stage` + `named_failures` and a NULL `run_id`; the module docstring's receipt-keying paragraph now names stages 2.5 and 2.6 explicitly. No new audit path. |
| T-182-SC (package installs) | accept | Zero installs — no `requirements.txt` / `package.json` change. |

## Threat Flags

None. No new route, no schema change, no new auth path, no new file-access pattern. Stage 2.6 performs reads that `POST /workflows/validate` already performs for the same user on the same data.

## Known Stubs

None. Every symbol is real code; no placeholder value, no `TODO`/`FIXME`/`PLACEHOLDER` introduced.

## Deployment-Artifact Parity

No action required. No new env var, no `settings.*` attribute read, no seed-bearing migration, no bundled service, no sandbox-image change — `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and `SANDBOX_IMAGE` are unaffected (`scripts/check-deploy-drift.sh` has nothing to flag).

## TDD Gate Compliance

Task 1 carried `tdd="true"` and ran a clean RED → GREEN cycle: `test(182-06)` `fbda9d46` (observed 2 failed) → `feat(182-06)` `95a3c458` (2 passed). Task 2's tests were written after the implementation by the plan's own sequencing (they are regression + agreement guards over Task-1 behavior), so their RED substitute is the explicit falsification probe recorded above — the stronger evidence, since it isolates the call site rather than the whole change. No REFACTOR gate was needed.

## Issues Encountered

- The 6 `test_publish_service.py` failures at Task-1 GREEN were momentarily alarming because the deprecation warnings showed a **real** Supabase client being constructed inside a unit test. The plan predicted this exactly (its `<interfaces>` block warns about the AsyncMock `pool`), and the prescribed patchable seam is what makes it fixable in one line per test. Worth remembering: an `AsyncMock` pool makes every `await pool.fetchval(...)` truthy, so any new DB-touching stage on this path needs a module-level seam from day one.

## User Setup Required

None — backend-only, no migration, no env var, no external service, no package install.

## Next Phase Readiness

- **The 182-VERIFICATION Truth-5 gap is closed.** Both open gaps from that report are now addressed: SC#4 per-node keying (plan 182-04) and publish-enforcement (this plan). Plan 182-07 (fail-loud severity classifier / WR-05) is the remaining gap-closure item.
- **A live smoke remains outstanding** (the plan's `<human-check>`): with `visual_workflow_canvas` on, publish a draft declaring `available_tools: ["not_a_real_tool"]` and confirm HTTP 200 `{published: false, blocked_stage: "grounding_fidelity"}` with **no** new `workflow_runs` row, then confirm a clean draft still reaches the golden run. This is the only step that proves the org-scoped service-role client resolves against a real DB rather than a patched seam.
- **Phase 184** inherits a genuinely enforcing gate: a canvas that renders `/validate` verdicts now renders exactly what publish will block on, and the agreement test fails loudly if that stops being true.
- **Phase 185 (graded governance)** adds `grounding_mode` verdicts to the same envelope. Because stage 2.6 forwards the collector's list unchanged, any verdict 185 adds to `grounding_verdicts` is enforced at publish automatically — no second edit here. That is the intended property; it is also the reason 185 must not add an ADVISORY-only verdict to that collector without deciding whether publish should block on it.

## Self-Check: PASSED

| Claim | Verification |
|---|---|
| `backend/tests/unit/test_182_publish_grounding_stage.py` exists (413 lines ≥ min 120) | FOUND |
| `backend/app/services/harness/publish_service.py` modified | FOUND (contains `grounding_fidelity`) |
| `backend/app/api/workflows.py` modified | FOUND (contains `grounding`) |
| `backend/tests/unit/test_publish_service.py` modified | FOUND (19 test definitions) |
| Commit `fbda9d46` (Task 1 RED) | FOUND in `git log --all` |
| Commit `95a3c458` (Task 1 GREEN) | FOUND in `git log --all` |
| Commit `31d40328` (Task 2) | FOUND in `git log --all` |
| Commit `7c33b664` (Task 3) | FOUND in `git log --all` |
| Plan verification suite | 81 passed, 0 failed |
| No files deleted by any commit | `git diff --diff-filter=D 28d101d5..HEAD` empty |

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
