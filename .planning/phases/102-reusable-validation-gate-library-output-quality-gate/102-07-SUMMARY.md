---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 07
subsystem: api
tags: [harness, validation-gate, freshness, output_file_valid, ask_user, workspace, security, GATE-01]

# Dependency graph
requires:
  - phase: 102-06
    provides: "resolve_judge_model helper + schema_model=JudgeVerdict forced-emit judge wiring on validator_kinds.py (CR-01) — this plan reads validator_kinds.py after 06 landed"
provides:
  - "WR-01: freshness live path resolves the KB scope from folder_subtree_ids (the attribute every real ctx bag carries) — the GATE-01 'check the date first' preflight now fires on a live run instead of always failing 'no KB scope context'"
  - "WR-07: output_file_valid scopes the author-controlled config[path] through the run's workspace (get_file_by_path) — an out-of-workspace path is refused, never opened as a filesystem oracle; raw exception text dropped from the error"
  - "WR-08: honest version-ambiguity ask_user choices ('Proceed despite version ambiguity' / 'Abort') + a version_ambiguity_v1_cut note in the validator_ask_user_approved receipt"
affects: [102-verification, 102-secure-phase, 103, freshness, output_file_valid, ask_user-disposition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Author-controlled definition-JSONB paths are workspace-scoped via get_file_by_path(pool, thread_id, path) before any filesystem open (the workspace_file_exists pattern) — out-of-workspace = refused, never opened"
    - "Generic gate error messages (no raw {e} exception text) to avoid a differing-error filesystem oracle"
    - "Honest ask_user choices + a v1-cut receipt note when a presented choice would otherwise assert an unimplemented semantic"

key-files:
  created: []
  modified:
    - "backend/app/services/harness/validator_kinds.py — freshness folder_subtree_ids third fallback (WR-01); output_file_valid config[path] workspace scoping + generic error (WR-07)"
    - "backend/app/services/harness_engine.py — honest version-ambiguity choices + version_ambiguity_v1_cut receipt note (WR-08)"
    - "backend/tests/unit/test_freshness.py — 2 live-shape scope-resolution tests"
    - "backend/tests/unit/test_validator_kinds.py — 2 out-of-workspace refusal tests"
    - "backend/tests/unit/test_ask_user_disposition.py — 2 honest-choice + v1-cut-note tests"

key-decisions:
  - "WR-07: re-open the workspace-managed location (row.content_storage_path), NOT the raw config[path] — and only for the AUTHOR-supplied config[path] branch; the render-driver of.get(path) branch (produced this run, already workspace-managed) stays unchanged"
  - "WR-08: the version-ambiguity v1 cut is honest Proceed/Abort (matching the staleness pair) — version-scoped retrieval is not implemented, so both old non-abort choices already routed identically to Proceed; the receipt records the cut rather than asserting newest-version selection"

patterns-established:
  - "Definition-JSONB filesystem paths are owner-scoped through the workspace before any open (closes the unscoped filesystem oracle class)"
  - "ask_user choice sets must not assert unimplemented semantics; when a v1 cut is taken, the governance receipt carries the cut note"

requirements-completed: [GATE-01]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 102 Plan 07: GATE-01 Validator Live-Path Gaps + ask_user Honesty Summary

**Freshness now resolves its KB scope from the real ctx `folder_subtree_ids` (the preflight fires live), `output_file_valid` scopes author-controlled `config[path]` through the workspace (the filesystem oracle is closed), and version-ambiguity `ask_user` presents honest Proceed/Abort choices with a v1-cut receipt note.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13
- **Completed:** 2026-06-13
- **Tasks:** 3 (all TDD: RED test → GREEN fix)
- **Files modified:** 5 (2 source, 3 test)

## Accomplishments

- **WR-01 (blocker):** `_validate_freshness` adds `getattr(ctx, "folder_subtree_ids", None)` as the third fallback in the `folder_ids` resolution chain. Every real ctx bag (live kickoff, `_build_resume_context`, `publish_service._drive_golden_run`) carries `folder_subtree_ids` — neither `scope_folder_ids` nor `folder_scope` is ever set on a live ctx, so the live `timing="pre"` freshness gate always failed "no KB scope context". The GATE-01 "check the date first" preflight now actually fires on a live run.
- **WR-07 (security):** the author-controlled `config["path"]` branch of `_validate_output_file_valid` now resolves through `get_file_by_path(pool, thread_id, path)` (the `workspace_file_exists` pattern). An out-of-workspace path returns a workspace-not-found `GateResult` and is **never** passed to `assert_integrity` — the unscoped filesystem existence/type oracle driven by definition JSONB is closed. The integrity re-open uses the workspace-managed `content_storage_path`, not the raw `config["path"]`, and the raw `{e}` exception text is dropped from the error message (no differing-error oracle).
- **WR-08 (honesty):** `_ask_user_choices_from_finding` presents the honest pair `["Proceed despite version ambiguity", "Abort"]` for a `freshness:version_ambiguity` finding — replacing "Use newest version" / "Use as-is", which both routed identically to Proceed but implied unimplemented version-scoped retrieval. The `validator_ask_user_approved` receipt carries a `version_ambiguity_v1_cut` note on such an approval (the honest record that the user approved continuing with UNFILTERED retrieval); staleness/other receipts are unchanged.

## Task Commits

Each task was committed atomically (TDD RED test + GREEN fix per task):

1. **Task 1: WR-01 freshness ctx folder_subtree_ids fallback** - `aa437939` (fix)
2. **Task 2: WR-07 workspace-scope output_file_valid config[path] oracle** - `ba080a56` (fix)
3. **Task 3: WR-08 honest version-ambiguity choices + v1-cut receipt note** - `66de7a41` (fix)

## Files Created/Modified

- `backend/app/services/harness/validator_kinds.py` — WR-01 freshness `folder_subtree_ids` third fallback; WR-07 `output_file_valid` `config[path]` workspace scoping + generic integrity error
- `backend/app/services/harness_engine.py` — WR-08 honest version-ambiguity `ask_user` choices + `version_ambiguity_v1_cut` receipt metadata note
- `backend/tests/unit/test_freshness.py` — 2 live-shape tests (scope resolves from `folder_subtree_ids`: fresh PASS, stale `freshness:staleness|` fail)
- `backend/tests/unit/test_validator_kinds.py` — 2 refusal tests (out-of-workspace `config[path]` and no-workspace-context both refused without `assert_integrity`)
- `backend/tests/unit/test_ask_user_disposition.py` — 2 tests (honest choice set with staleness/generic unchanged; v1-cut note on the receipt, absent on a staleness Proceed)

## Decisions Made

- **WR-07 scoping boundary:** only the AUTHOR-supplied `config["path"]` branch needs the workspace lookup; the render-driver `of.get("path")` branch (produced this run, already workspace-managed) is left unchanged. The integrity re-open targets the workspace-managed `content_storage_path` from the resolved row, never the raw `config["path"]`.
- **WR-08 v1 cut:** the version-ambiguity choices are made honest (matching the staleness pair) rather than implementing version-scoped narrowing — that retrieval mode does not exist, and both prior non-abort choices already routed identically to Proceed. The cut is recorded in the receipt so the governance trail is truthful.

## Deviations from Plan

None - plan executed exactly as written. All three tasks followed TDD (RED test confirmed failing on the pre-fix path, GREEN fix, suite green) and matched the plan's action text, acceptance criteria, and key_links.

## Issues Encountered

None. The acceptance criterion "`_ask_user_choices_from_finding` no longer contains 'Use newest version' / 'Use as-is'" is satisfied in the function's return statements (the choice-set code); the strings remain only in the docstring's explanatory "NOT X" note documenting the WR-08 change, which is intentional and not a presented choice.

## Verification

- **Target suites (the acceptance bar):** `pytest tests/unit/test_freshness.py tests/unit/test_validator_kinds.py tests/unit/test_ask_user_disposition.py -q` → **20 passed, 0 failed** (14 at the wave base + 6 net-new this plan).
- **Per-suite:** test_freshness.py 5 passed; test_validator_kinds.py 7 passed; test_ask_user_disposition.py 8 passed.
- **key_links confirmed:** `validator_kinds.py` contains `folder_subtree_ids` (freshness) and `get_file_by_path` (output_file_valid); `harness_engine.py` contains `"Proceed despite version ambiguity"` and `version_ambiguity_v1_cut`.
- **SEED-056 net-new-failure proof:** the three target suites were **green at the wave base** (14 passed, 0 failed, captured before any change) and are **green now** (20 passed, 0 failed). The +6 are exactly the 6 tests added this plan. These suites carry no pre-existing rot, so net-new failures = **0** (the strongest bracket: zero failures on both sides).
- **G-5 RED LINE:** `git diff --stat HEAD~3 HEAD -- backend/app/api/threads.py backend/app/services/agent_loop.py` is empty — both byte-untouched. Deep stays byte-identical.

## Threat Model Compliance

All three STRIDE register entries handled:
- **T-102-07-01 (Information Disclosure — output_file_valid filesystem oracle):** mitigated — `config["path"]` resolves via `get_file_by_path` (owner-scoped); out-of-workspace path refused without an `assert_integrity` open; raw `{e}` exception text dropped. Acceptance test `config={"path":"/etc/passwd.docx"}` with `get_file_by_path → None` proves refusal + no open.
- **T-102-07-02 (Repudiation — version-ambiguity receipt):** mitigated — honest "Proceed despite version ambiguity" choice + `version_ambiguity_v1_cut` note make the governance trail truthful.
- **T-102-07-03 (Spoofing — freshness scope):** accepted as planned — `folder_subtree_ids` is the SAME server-resolved id list the engine already threads (never prompt-supplied); the third fallback does not widen the scope source.

## Known Stubs

None introduced. (The pre-existing `pdf` v1 STUB in `_validate_output_file_valid` is unchanged and out of scope per the plan's "Do NOT change the docx/pptx/xlsx integrity branch logic, the PDF stub, or the unknown-ext fail-closed.")

## Next Phase Readiness

- WR-01, WR-07, WR-08 from 102-REVIEW.md are closed at the unit level. Ready for 102 re-verification and `/gsd:secure-phase 102`.
- The freshness preflight is now live-functional; verification truth #2 (the "check the date first" preflight delivered live) should re-pass.
- STATE.md / ROADMAP.md were intentionally NOT modified — the orchestrator owns those for this gap-closure phase.

## Self-Check: PASSED

- FOUND: `.planning/phases/102-reusable-validation-gate-library-output-quality-gate/102-07-SUMMARY.md`
- FOUND commit `aa437939` (Task 1 — WR-01)
- FOUND commit `ba080a56` (Task 2 — WR-07)
- FOUND commit `66de7a41` (Task 3 — WR-08)

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-13*
