---
phase: 264-born-for-skills-must-load-not-just-resolve
verified: 2026-09-22T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 — no independent §6.3 reviewer exists
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "L-1 through L-10 (264-VALIDATION.md Section A, the G-4 lived bar)"
    expected: "A non-author org member gets the born-for skill BODY end-to-end on a live chat run (positive: L-2/L-3; narrow: L-4/L-5/L-6/L-9/L-10; files/sandbox: L-7/L-8)"
    why_human: "Requires a real chat run with a live LLM turn calling load_skill/read_skill_file/execute_code; not drivable by a verifier without a running app + operator-observed UI"
  - test: "SC#10 4-axis board (264-VALIDATION.md Section B: P-1..P-8 cross-provider, M-1 multi-tool, T-1 parallel-thread, G-1 long-message)"
    expected: "Cross-provider roster (8 rows) each drives a real load_skill turn and returns the born-for body; multi-tool/parallel-thread/long-message rows each pass"
    why_human: "Requires live per-provider API calls and multi-thread orchestration; the ROADMAP/CLAUDE.md UAT recipe explicitly reserves this for operator-driven runs, not verifier automation"
---

# Phase 264: Born-For Skills Must LOAD, Not Just Resolve — Verification Report

**Phase Goal:** A skill born for an Expert is loadable by everyone that Expert serves, not only
the person who authored it.
**Verified:** 2026-09-22
**Status:** human_needed (all 5 automated ROADMAP success criteria VERIFIED; 2 human-verification items owed — see below)
**Re-verification:** No — initial verification

## Method

All claims below were independently re-derived against the shipped code and by re-running the
project's own gates/tests, base `e9d6a9410` → HEAD `e1192b462`. SUMMARY.md files were read for
orientation only; every checkmark here has its own command/output or file:line citation captured
in this session, not a citation of a summary.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A non-author member of the Expert's org can have the agent LOAD the instruction BODY of a born-for skill, driven end to end | ✓ VERIFIED | Ran `pytest tests/integration/test_v3_4_org_isolation.py -q -k "seed125 or born_for"` against the live local Postgres myself: **6 passed** (4 pre-existing SEED-125 + 2 new PACK-17 tests). `test_load_skill_born_for_same_org_non_author_pack17` asserts the returned `instructions` string equals the DB row's body for a SECOND org member, not a status word (`backend/tests/integration/test_v3_4_org_isolation.py`, appended hunk after :1141). Also ran the in-process unit fence `pytest tests/unit/test_264_load_skill_born_for.py -q` → 18/18 pass, built on a `_RecordingQuery.or_()` that **filters** rows via `_predicate_admits` (imported from the one-home grammar evaluator), confirmed `grep -c "def __getattr__"` = 0 in both new SC#1 files (no catch-all passthrough shape). |
| 2 | The born-for rule lives in ONE place — `app/utils/skill_visibility.py` is the single home; independent encodings measured at 1 | ✓ VERIFIED | Read `backend/app/utils/skill_visibility.py:60-215` — both `build_skill_visibility_or` and `skill_row_visible` carry the optional `expert_bundle_id`/keyword. `grep -n "born_for_bundle_id" backend/app/services/harness/phase_types.py backend/app/services/harness/grounding.py backend/app/services/eval_runner_service.py` → **zero matches** in all three (confirmed silent). `expert_service.py:310-330` shows the D-264-02 retirement: the hand-rolled fourth disjunct is GONE, replaced by delegation to `skill_row_visible` (verified by reading the function body — no second `born_for_expert_bundle_id` predicate construction exists in that file). Ran `pytest tests/unit/test_264_one_home_born_for_predicate.py -q` → part of the 80/80 passing run below, including its AST count-fence test. |
| 3 | Both encodings agree — driven against the SAME table of rows, including born-for cases | ✓ VERIFIED | `pytest tests/unit/test_264_one_home_born_for_predicate.py tests/unit/test_seed125_skill_visibility_filter.py -q` → included in the 80-passed run below. Read the fixture-table test structure: `test_both_encodings_agree_on_every_row` parametrizes over one shared row table and asserts `build_skill_visibility_or`'s admitted set vs `skill_row_visible`'s per-row boolean agree — including a `same_org_private_DISABLED_row_born_for_this_bundle` case. |
| 4 | The widening is narrow — NULL/absent bundle never matches, WRONG bundle never matches, DIFFERENT org never matches, each on the LOAD path | ✓ VERIFIED | Real-DB test case 3 (`None` bundle → refused), case 4 (wrong UUID bundle → refused), case 5 (disjoint-org caller B holding the **correct** bundle → refused — the SEED-125-shape check) all present and passing in `test_load_skill_born_for_same_org_non_author_pack17` (5-case table). Read `skill_row_visible`'s born-for arm (`skill_visibility.py:~205-215`): both `expert_bundle_id is not None` and `row_bundle is not None` guards present, plus the nesting-inside-org-gate structure (`,and(born_for_expert_bundle_id.eq.<bundle>,is_enabled.is.true)` spliced **inside** the inner `or(...)`, never a 4th top-level branch) confirmed by reading `build_skill_visibility_or`'s return statement directly. |
| 5 | Deep Mode / non-Expert runs are byte-identical — predicate unchanged with no Expert active | ✓ VERIFIED | `grep -n "startswith\|== _BASE" backend/tests/unit/test_seed125_skill_visibility_filter.py` confirms the SC#5 pins are `==` against three frozen literals (`_BASE_NO_ORG`, `_BASE_ONE_ORG`, `_BASE_TWO_ORGS`), replacing the old `startswith`/`in` containment shape — read the file's own comment at line 44-45 documenting the replacement and why (a nested append can satisfy a containment pin while still leaking). Ran `pytest tests/test_eval_runner.py::test_deep_mode_byte_identical_guard -q` myself → **1 passed**. Confirmed `agent_loop.py`'s Deep skill catalog (`.or_(f"user_id.eq.{current_user['id']},is_org_shared.eq.true")` at line ~1451) carries no `born_for` term — read directly, and `git diff e9d6a9410..HEAD -- backend/app/services/agent_loop.py` shows only 4 hunks (:268, :1332→1344, :2055→2073, :2937→2960), none touching the catalog region. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/utils/skill_visibility.py` | one home, optional `expert_bundle_id` keyword on both encodings | ✓ VERIFIED | Read directly, 215 lines; both functions carry the keyword, default `None`, byte-identical default output |
| `backend/app/services/tool_dispatcher.py` | `_resolve_skill_visibility_or(ctx, *, born_for=False)`, 3 sites opt in, 1 refuses in source | ✓ VERIFIED | `grep -n "born_for=True"` → 3 hits (:1369 load_skill, :1666 read_skill_file, :2283 execute_code injection); `_sibling_filter` at :1529 (save_skill) uses the default `born_for=False` with an in-source comment explaining the refusal |
| `backend/app/services/agent_loop.py` / `run_producer.py` / `task_service.py` | `born_for_bundle_id` carrier field, wired through RunContext → ToolContext → sub_ctx | ✓ VERIFIED | `grep -n "born_for_bundle_id"` across all three shows the field declaration, one bind, propagation through both ToolContext builds, and `task_service.py:662` propagating from `parent_ctx` |
| `backend/tests/integration/test_v3_4_org_isolation.py` | real-DB proof of SC#1 | ✓ VERIFIED | Ran myself against live local Postgres — 6/6 passed |
| `backend/tests/unit/test_264_*.py` (4 files) | unit-level fences for carrier, one-home, load-path, unchanged-sites | ✓ VERIFIED | Ran myself — 80/80 passed across all in-scope 264 + seed125 + 260 suites |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `run_producer._resolve_thread_scoping` | `RunContext.born_for_bundle_id` | 5-tuple return, `resolved.bundle_id` (access-checked, not raw `active_expert_id`) | ✓ WIRED | Read `run_producer.py:378-517`; confirmed the success return appends `resolved.bundle_id` from `resolve_expert_bundle` |
| `RunContext.born_for_bundle_id` | `ToolContext.born_for_bundle_id` | bind + 2 build-site kwargs in `agent_loop.py` | ✓ WIRED | `agent_loop.py:1352` binds, `:2080` and `:2967` pass the kwarg into both ToolContext builds |
| `ToolContext.born_for_bundle_id` | `_resolve_skill_visibility_or` | `getattr(ctx, "born_for_bundle_id", None) if born_for else None` at `tool_dispatcher.py:1340` | ✓ WIRED | Read directly; the bundle is passed THROUGH to `build_skill_visibility_or`, never re-derived |
| `_resolve_skill_visibility_or` | `build_skill_visibility_or` | `expert_bundle_id=str(_bundle) if _bundle is not None else None` | ✓ WIRED | Read directly at `tool_dispatcher.py:1341-1344` |
| harness sub-agent path (`task_service.py`) | `sub_ctx.born_for_bundle_id` | `parent_ctx.born_for_bundle_id` propagation | ✓ WIRED | `task_service.py:662` |
| `harness/phase_types.py`, `harness/grounding.py`, `eval_runner_service.py` | (deliberately not wired) | fenced UNCHANGED | ✓ CONFIRMED SILENT | `grep -n "born_for_bundle_id"` returns zero matches in all three files |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend unit baseline unchanged | `pytest tests/unit -q --continue-on-collection-errors` (run in `backend/`, this session) | `71 failed, 5490 passed, 2 xfailed, 2 xpassed, 46 warnings in 266.92s` — the 71 failures are `test_retrieval_service.py`, `test_sandbox_service.py`, `test_sql_service.py`, `test_streaming_reliability.py` cases, none in the born-for blast radius | ✓ PASS — matches the documented ceiling exactly, zero new failures |
| In-scope 264 + neighbouring suites | `pytest tests/unit/test_264_born_for_carrier.py tests/unit/test_264_one_home_born_for_predicate.py tests/unit/test_264_load_skill_born_for.py tests/unit/test_264_unchanged_sites_fenced.py tests/unit/test_seed125_skill_visibility_filter.py tests/unit/test_260_expert_chat_scoping.py -q` (this session) | `80 passed, 1 warning in 1.36s` | ✓ PASS |
| Real-DB SC#1 (both legs) | `pytest tests/integration/test_v3_4_org_isolation.py -q -k "seed125 or born_for" -v` (this session, local Supabase confirmed up on 54321/54322) | `6 passed, 23 deselected` | ✓ PASS |
| PACK-01 Closed-Core AST invariant | `pytest tests/unit/test_260_expert_chat_scoping.py -q -k "closed_core or zero_expert"` (this session) | `1 passed` | ✓ PASS |
| Deep-mode byte-identical guard | `pytest tests/test_eval_runner.py::test_deep_mode_byte_identical_guard -q` (this session) | `1 passed` | ✓ PASS |
| `check-claude-md-size.cjs` | `node scripts/check-claude-md-size.cjs` (this session) | `CLAUDE.md 116991 chars 78% ... [OK]` / EXIT 0 | ✓ PASS |
| `check-hot-file-ledger.cjs 264` | `node scripts/check-hot-file-ledger.cjs 264` (this session, arg corrected to phase number) | `scan list: 321 rows · subject: 18 files · watched: 6` / `ledger gate OK` | ✓ PASS |
| `check-gap-closure-rounds.cjs 264` | `node scripts/check-gap-closure-rounds.cjs 264` (this session) | `plans: 4 total · 0 gap-closure` / `G-7 clear` | ✓ PASS |
| `check-seeds-register.cjs --phase 264` | `node scripts/check-seeds-register.cjs --phase 264` (this session) | `seeds register gate OK — 310/310 parsed, 0 duplicate ids` / 14 seeds matched | ✓ PASS |
| Frontend vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (this session, repo root) | `total 8676 · failed 0 · pinned total 7935` / `count gate OK — 316/316 pinned files present, no per-file decrease, 0 failing` | ✓ PASS |
| Frontend diff over the whole phase range | `git diff --stat e9d6a9410..e1192b462 -- frontend/` (this session) | empty output | ✓ CONFIRMED — phase touched zero frontend source, as claimed |

### Specific Checks From the Verification Brief

| Item | Finding |
|---|---|
| SC#1's two halves both exist, and the fake is not a no-op | ✓ Confirmed both a wave-3 in-process test (`test_264_load_skill_born_for.py`) and a wave-4 real-Postgres test (`test_v3_4_org_isolation.py`) exist and pass. `grep -c "def __getattr__"` = 0 in both new SC#1 files — no catch-all passthrough. Read `_RecordingQuery.or_()` at `test_264_load_skill_born_for.py:111-113`: it narrows `self._rows` through `_predicate_admits`, a real filter, not a no-op. |
| SC#5's pin is `==` against a frozen literal, not `startswith`/`in` | ✓ Confirmed. `test_seed125_skill_visibility_filter.py:74,87,95,109` use `==` against `_BASE_NO_ORG` / `_BASE_ONE_ORG` / `_BASE_TWO_ORGS`; the file's own comment (line 44-45) documents why the old containment shape was replaced. |
| Full backend unit suite | ✓ Ran myself: `71 failed, 5490 passed, 2 xfailed, 2 xpassed` — ceiling exactly met, zero new red, zero of the 71 in this blast radius. |
| Per-site decisions: WIDEN at load_skill/read_skill_file/execute_code, NOT at save_skill | ✓ Confirmed by reading `tool_dispatcher.py` directly at each of the 4 call sites (:1369, :1529, :1666, :2283) with in-source comments naming each decision. |
| Unchanged/fenced: `harness/grounding.py`, `harness/phase_types.py`, `eval_runner_service.py` | ✓ Confirmed — `grep -n "born_for_bundle_id"` returns zero matches in all three. |
| D-264-02 prose retirements (rewrite, not delete) | ✓ Confirmed both. `test_seed125_skill_visibility_filter.py:186,264,268` retains the "which is the exact shape of SEED-125" / "The agent loop has no such scope" language inside a rewritten block; `expert_service.py:316-330` quotes the original "WHY THIS IS NOT IN skill_visibility.py" block verbatim with "~~five~~ FOUR call sites" struck through in place, followed by the new reasoning. |
| PACK-01 Closed-Core AST invariant green, not weakened | ✓ Ran myself: 1 passed. Read the test — it still asserts zero AST names/attributes containing "expert" in `agent_loop.py`. |
| SEED-129 non-touch (`agent_loop.py:1435` Deep skill catalog) | ✓ Confirmed independently. Read the catalog block directly (now at ~line 1451 after +18 net lines earlier in the file) — the query is `.or_(f"user_id.eq.{current_user['id']},is_org_shared.eq.true")` with no born-for term. `git diff e9d6a9410..HEAD -- agent_loop.py` shows 4 hunks (:268, :1332→1344, :2055→2073, :2937→2960); the catalog region is in none of them. |
| `check-landing-drift.cjs` failure — not this phase's | ✓ Confirmed. It fails at both base and HEAD with the identical `SURFACE_TABS.orgAdmin` vs `facts.ts` mismatch, and `git diff --stat e9d6a9410..HEAD -- frontend/` is empty, so the phase cannot be responsible. Not counted as a gap. |

### Owed Manual UAT (NOT scored as gaps)

`264-VALIDATION.md` (`status: authored`, `driven_by: TBD`) contains:

- **Section A — 10 G-4 lived rows (L-1 through L-10):** the defect reproduced on the pre-264 tree,
  the bar met for a non-author, the author unaffected, and 7 narrow/negative rows (no-Expert,
  wrong-Expert, different-org, files, sandbox, disabled, Deep-Mode-untouched). All verdict cells
  are blank.
- **Section B — the SC#10 4-axis board:** P-1 through P-8 (the 8-provider cross-provider roster），
  M-1 (multi-tool), T-1 (parallel-thread), G-1 (long-message). All verdict cells are blank.

These require a live chat run, a real LLM turn, and (for Section B) per-provider API calls — none
of which this verifier can drive. They are listed here by row id, as instructed, and are NOT
counted as gaps against the phase's automated-evidence score.

## Gaps Summary

None found. All five ROADMAP success criteria are independently verified against the shipped
code and by re-running the project's tests and gates in this session — not by trusting the four
SUMMARY.md files, which were used only for orientation. Every gate this session re-ran (backend
unit baseline, in-scope unit suites, real-DB integration suite, CLAUDE.md size, hot-file ledger,
gap-closure-rounds, seeds register, frontend vitest count gate) reproduced the exact figures the
SUMMARY.md files claimed. The one known-and-not-this-phase's failure (`check-landing-drift.cjs`)
is confirmed inherited by measurement (empty frontend diff across the whole phase range), not
taken on trust.

Two items of manual UAT are owed to the operator per `264-VALIDATION.md` and are reported above
as owed, not as gaps.

---

_Verified: 2026-09-22_
_Verifier: Claude (gsd-verifier)_
