---
phase: 278-one-home-for-tools-and-filters
verified: 2026-10-13T00:00:00Z
status: passed
score: 5/5
verification_mode: self-verified
independent_review: self
re_verification: false
gaps: []
---

# Phase 278: One Home for Tools and Filters - Verification

**Goal:** tool dispatcher split into registry + handlers, retrieval seam closed, filter vocabulary has one home, behaviour unchanged.
**Base:** `25b4235c5`. **HEAD:** `520d5e2ad`.

## Success criteria

| SC | Verdict | Evidence (re-derived in this session) |
|---|---|---|
| 1 | VERIFIED | `pytest test_278_registry_pin.py test_278_pure_move.py test_278_vocabulary_one_home.py` gave 52 passed. `len(_TOOL_REGISTRY)` is 30. `tool_dispatcher.py:102` is still the static dict literal `_TOOL_REGISTRY: dict[str, Callable] = {`. The file shrank to 274 lines and handlers live in `services/tools/` (families: agent_control, connector, documents, memory, render_template, runtime_gap, sandbox, skills, workspace). `test_259_closed_core_inventory.py` plus root-level `tests/test_141_run_scope.py` gave 22 passed. |
| 2 | VERIFIED | CLAUDE.md row 526 for `retrieval_service.py` is `24 / 13 / 176 (was 19 / 11 / 456)` with `~~extraction still OWED~~` struck through and `DISCHARGED 272-01 (278)` beside it. `docs/HOT-FILE-LEDGER.md` carries a `CORRECTED 2026-10-13 (Phase 278, SEAM-02)` paragraph at line 7965 and keeps the original, plus a section at line 19950. SEED-224 reads `status: partially-answered`. Triple re-derived with the CLAUDE.md recipe: 24 commits, 13 phases, 176 lines. This matches the row. |
| 3 | VERIFIED | `document_vocabulary.py` is imported by `retrieval_scope.py:53`, `document_search_service.py:58` and `view_filter_compiler.py:51`. `test_278_vocabulary_one_home.py` passes. RED evidence: strict-xfail RED commit `f9f105d68`, a `--runxfail` run that fails for the right reason, and three planted divergences (a divergent copy, a fourth-module copy and a divergent override) restored md5-identical (278-02-SUMMARY "RED drives"). REVIEW-FIX CR-01 and WR-02/03 also record plants. |
| 4 | VERIFIED | Backend gate at HEAD, from the orchestrator and not rerun: 71 failed, 7223 passed, 0 collection errors. The failing set is identical to `278-base-failed.txt` (71 = 71, empty diff). I ran the 272/275 pins (`tests/unit/test_272_*.py tests/unit/test_275_*.py`): 457 passed. Frontend: `git diff --name-only 25b4235c5..HEAD -- frontend` lists 0 files, so there is no per-file decrease by construction. The only red in the count gate is the SEED-171 flaky `WorkflowBuilderPage.canvas.test.tsx`, which is provably unmodified. That is an observation and not a claim that it is fine. |
| 5 | VERIFIED | Read-only local DB re-read: `audit_log` `b3d65512...` has `action_type=search.query` and `metadata.run_id=09c962aa-3aa6-4061-be0d-ae076c3f5b21`, thread `c1c1e6a7...`, 2026-10-13 03:39:02. `447164bb...` has `action_type=code.execute` on the same thread at 03:39:21. This is one live Anthropic native turn with two tools. 278-VALIDATION.md records the `runs` row `09c962aa` as completed, model claude-sonnet-5. I did not re-read the `runs` row: my query used a wrong column name (`id`), and the audit rows already carry that run_id. Key sets match the pre-278 rows (VALIDATION). |

**Score:** 5/5.

## Requirements

- SEAM-03: SC#1 and SC#5, satisfied.
- SEAM-02: SC#2, SC#4, satisfied.
- DEBT-09: SC#3, satisfied.

## Gates run

- `check-claude-md-size.cjs`: OK, 89,980 chars (60% of the 150k limit).
- `check-hot-file-ledger.cjs` on the phase dir: OK, 528 rows, 71 files, 17 watched.
- `check-seeds-register.cjs`: OK, 361/361 parsed.
- CR-01 fix (`774375682`): `tests/test_141_run_scope.py` passes.

## Inherited items and decisions (not gaps)

- `check-landing-drift.cjs` exits 1 because `frontend/src/landing/facts.ts:155` says 29 tools. The registry has had 30 since Phase 273. This is inherited and not caused by 278.
- `tests/integration` was not run, because it mutates the live DB. REVIEW-FIX WR-01 records this as a measured disposition.
- UAT scoreboard: the 7 other providers, the parallel-thread axis and the long-message axis are not run, by decision. 278 is behaviour-preserving, and CONTEXT gives Claude discretion that SC#5 is one native provider. The OpenRouter and other native rows are therefore owed and not omitted.
- Info findings IN-01..04 from the review are deferred with reasons (REVIEW-FIX).
- Count-gate red on the SEED-171 flaky `WorkflowBuilderPage.canvas.test.tsx` is inherited. The file is provably unmodified.

## Anti-patterns

No debt markers were introduced that I found. I did not scan for them exhaustively.

## Human verification

None required.

_Verifier: Claude (self-verified)._
