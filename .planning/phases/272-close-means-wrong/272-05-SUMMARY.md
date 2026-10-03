---
phase: 272-close-means-wrong
plan: 05
subsystem: retrieval / cross-provider UAT / chat tool card
tags: [FIND-07, SC#3, SC#4, SC#10-board, G-4, recall-ladder, plan-cache, D-27, F-3, seeds]
requires:
  - "272-01..04 merged into develop (filters contract, document-scope RPCs, result kinds, retry lock)"
provides:
  - "FILTERED_EXACT_MAX_CHUNKS = 2000 and FILTERED_ITERATIVE_SCAN = relaxed_order, set from a measured ladder by a written rule"
  - "migration 201 — both retrieval RPCs pinned to force_custom_plan (fixes a pooled-connection regression migration 200 introduced)"
  - "D-27 — every matched document keeps its best passage (threshold half + same-document-only dedup on the filtered path)"
  - "F-3 — the search card names refusals, invalid filters, empty matches, not-searchable-yet and unavailable"
  - "the 8-row SC#10 board (20/24) with the re-runs, and the G-4 drive, operator-approved"
  - "SEED-333 (run card folds the filter line), SEED-334 (admin must-filter flag, trigger FIRED), SEED-335 (absence hint overstates unmarked)"
affects: [273]
tech-stack:
  added: []
  patterns:
    - "measure the generic-plan leg, not only the custom plan — PL/pgSQL caches a generic plan after 5 calls per session"
    - "coverage cut: each matched document's best row first, then fill by rank"
    - "dedup is scoped to one document on the filtered path; unfiltered behaviour pinned unchanged"
    - "a re-run is published BESIDE the first board, with every changed verdict attributed"
key-files:
  created:
    - supabase/migrations/201_retrieval_rpcs_force_custom_plan.sql
    - scripts/measure-filtered-recall.py
    - scripts/run-272-board.py
    - frontend/src/components/chat/tool-bodies/SearchDocumentsBody.test.ts
    - .planning/seeds/SEED-333-finished-run-card-folds-away-the-filter-line.md
    - .planning/seeds/SEED-334-admin-must-filter-field-flag.md
    - .planning/seeds/SEED-335-absence-hint-overstates-unmarked-on-a-fully-sourced-answer.md
    - .planning/phases/272-close-means-wrong/272-UAT-LOG.md
    - .planning/phases/272-close-means-wrong/evidence/
  modified:
    - backend/app/services/retrieval_rpc.py
    - backend/app/services/retrieval_rank.py
    - backend/app/services/retrieval_service.py
    - backend/app/config.py
    - supabase/migrations/200_filtered_retrieval_document_scope.sql
    - supabase/full-schema.sql
    - frontend/src/components/chat/tool-bodies/SearchDocumentsBody.tsx
    - scripts/vitest-count-gate.cjs
    - backend/tests/unit/test_272_filtered_both_arms.py
    - backend/tests/unit/test_272_pure_move.py
    - backend/tests/integration/test_272_rpc_document_scope.py
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/272-close-means-wrong/272-VALIDATION.md
    - .planning/phases/272-close-means-wrong/272-CONTEXT.md
    - .planning/phases/272-close-means-wrong/272-05-PLAN.md
    - .planning/seeds/SEED-273-hnsw-iterative-scan-cost-inflection-and-recall-cliff.md
    - .planning/seeds/SEED-076-filtered-vector-search-recall-pgvector-index-scale.md
    - .planning/seeds/SEED-153-close-means-wrong-dimensions-must-be-filters.md
decisions:
  - "FILTERED_EXACT_MAX_CHUNKS = 2000: the largest size whose exact p95 is within control p95 + 50 ms (34.41 + 50 = 84.41; 2,000 → 46.20 ms, 5,000 → 108.24 ms) with no HNSW node in the plan"
  - "FILTERED_ITERATIVE_SCAN = relaxed_order; global knobs unchanged (hnsw_ef_search 40, iterative_scan off) per D-14"
  - "Migration 200 must never ship without 201: the new btree makes PL/pgSQL's cached generic plan join every visible document to its chunks, so every pooled connection slows down after its fifth retrieval call, filtered or not"
  - "D-27 (operator ruling, refines D-10): inside a matched filter set, every matched document returns its best passage up to top_k, and below-threshold ones are marked low_similarity"
  - "SC#4 closed BY DECISION ('Close with Google recorded unmet'): met on 6 of 8 rows; Google UNMET on (a)/(b)/(c), model behaviour; MiniMax-M3 UNSTABLE"
  - "G-4 signed off by the operator: 'Approved', 2026-10-03"
metrics:
  duration: "~3 h 25 min (10:28 base → 13:53 last task commit, including three operator restarts and a credits blocker)"
  completed: 2026-10-03
  tasks: 4
  files: 27
---

# Phase 272 Plan 05: Prove filtered retrieval on the live stack Summary

This plan proved filtered retrieval on the live stack. It set the exact-scan threshold from a measured recall ladder, ran the 8-row cross-provider board (20/24), and drove the three lived scenarios in a real browser, which the operator approved. Along the way it found and fixed three real defects: a plan-cache regression that migration 200 had introduced (fixed by migration 201), a matched document silently dropped from filtered results (D-27, which had two causes), and a search card that read `0 results` for every non-passage outcome (F-3).

Ran on the main tree, `develop`, sequentially. Base `516de5cd9`. Last task commit `617d45754`.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 (Rule 1) | `9f29fa4d2` | fix: migration 201 pins both retrieval RPCs to `force_custom_plan`, plus an integration pin and the full-schema regen |
| 1 | `b2f973f76` | perf: filtered-path constants set from the SEED-273 ladder; the stale `config.py` ef_search comment corrected (value 40 unchanged) |
| 1 | `2451dbc30` | docs: ledger close, 14 phase-touched triples re-derived |
| 1 | `bcd4b8df9` | docs: SEED-273 → `partially-answered`; SEED-076 lever noted |
| 1 | `017621df2` | docs: SC#3 ladder, merged-tree gates, the OpenAI-credits board blocker |
| 3 | `9c6cfdeb5` | docs: SC#10 board 20/24, the G-4 drive, findings F-1/F-2/F-3, SEED-153 routed |
| 4 RED | `7fcfeee09` | test: D-27 cases, every matched document keeps its best passage |
| 4 GREEN | `6922624d6` | fix: D-27 threshold half (`_select_filtered_vector_rows`, `_cover_matched_documents`) |
| 4 RED | `7955aba30` | test: F-3 cases, the search card names each non-passage result |
| 4 GREEN | `676024f6a` | fix: F-3 `SearchDocumentsBody.summarize`, suite adopted in both count-gate knobs |
| 4 | `36907e5e3` | docs: ledger re-derivation after the ruling fixes |
| 4 | `c29ec8635` | docs: Task 4 rulings, D-27 in CONTEXT, the Google investigation, SEED-333 |
| 4 RED | `cfaa0fb4a` | test: D-27 dedup cases, near-identical matched documents survive |
| 4 GREEN | `1cef556f3` | fix: D-27 second cause, `_deduplicate_chunks(same_document_only=True)` on the filtered path |
| 4 | `c0393f7b2` | docs: post-restart re-run, board (a)/(c) ×8, G4-1/G4-2, the dedup cause |
| 4 | `617d45754` | docs: restart #3 re-run, board (b) ×8 at 3/3 coverage, G4-3 with three figures |

Task 2 was a human-action checkpoint (the operator restarted the backend and frontend) and has no commit.

## SC status

| SC | Status | Evidence |
|---|---|---|
| SC#1 (filter emitted and applied, visible on the card) | **Met.** On 6 of 8 board rows on every prompt, and on G4-1/G4-3 in the browser (`Filtered: document date 1–31 Oct 2025`, `Filtered: legal entity = Acme GmbH`). The line is visible after one click (F-1, SEED-333). | VALIDATION §3, §4 |
| SC#2 (fail closed, no unfiltered retry) | **Met.** G4-2 shows no number and no citations. The D-09 lock's `refused_retry` was observed live (audit `c8b9c9ba`) and now reads `refused — would drop the filter` (F-3). Known limit D-22 (non-search tools are not locked) was observed once on MiniMax (c), board 1. | VALIDATION §4, §5 |
| SC#3 (recall measured, threshold from data) | **Met.** Recall 1.000 at every filtered point up to 15,000 chunks. No HNSW node in any filtered plan. Custom AND generic plans read. No `idx_scan` cited. | VALIDATION §2, `evidence/recall-ladder*.json` |
| SC#4 (8-row board, emission required) | **Met on 6 of 8 rows, BY OPERATOR DECISION** ("Close with Google recorded unmet"). This is not "all passed". Google `gemini-3.5-flash` is **UNMET** on (a)/(b)/(c) because of model behaviour, which was investigated. The schema reaches Gemini intact and it emitted well-formed filters 3 times, but it prefers `query_documents` SQL, widens on its own and hits the 15-step cap. Our part, F-2, is fixed. MiniMax-M3 is **UNSTABLE**: run-to-run variance, and one sample is not a measurement. | VALIDATION §3, §3b, §4 sign-off |

**Board totals.** First board: (a) 7/8, (b) 7/8, (c) 6/8, so 20/24. After every fix: (a) 6/8, (b) 7/8 with **3/3 matched-document coverage on all 8**, (c) 7/8, so again 20/24. Every changed verdict is attributed. Both MiniMax flips are variance, and the (b) coverage change is D-27.

**G-4.** G4-1 PASS, G4-2 PASS (F-3 verified), G4-3 PASS with all three Acme GmbH figures. **Operator sign-off: "Approved", 2026-10-03.**

## Gates (verbatim, from 272-UAT-LOG.md)

- **Backend unit, merged tree:** `71 failed, 6382 passed, 1 skipped, 2 xfailed, 2 xpassed` → `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` The failed set is SET-IDENTICAL to 272-BASELINES.md.
- **Backend unit, after the ruling fixes:** `71 failed, 6388 passed, 1 skipped, 2 xfailed, 2 xpassed` → `[GATE PASSED]`, SET-IDENTICAL after stripping one glued warning line.
- **After the dedup fix (targeted):** `pytest tests/unit -k 272` → **152 passed**. `test_retrieval_service.py` → 15 failed, SET-IDENTICAL 15/15 with 272-BASELINES.md lines 77-91. `-k "retriev or search or hybrid or rerank or dedup"` → `15 failed, 204 passed`, 0 new.
- **Integration:** `tests/integration/test_272_*.py` plus `test_266_two_org_fence.py` → `24 passed`. The migration-201 pin was RED with the pin reset (`2 failed`) and GREEN with 201 re-applied.
- **Tool inventory:** `27 passed`. There are still 29 tools.
- **Vitest count gate, merged tree:** `total 9460 · failed 0 · pinned total 8705` · `count gate OK — 375/375 pinned files present, no per-file decrease, 0 failing.`
- **Vitest count gate, after F-3:** `total 9469 · failed 1 · pinned total 8714`. The one failure is `WorkflowBuilderPage.canvas.test.tsx` (`STACK_TRACE_ERROR`). That file is provably unmodified (last commit `e3fe03121`) and is one of SEED-171's five flaky suites. Its filename was captured from the gate's JSON before any re-run, and alone it reads `154 passed`. This is an observation, not proof of innocence.
- **tsc:** `npx tsc -p tsconfig.app.json --noEmit` → 70 errors, which is the base count, with 0 in any phase-touched file.
- **Ledger, deploy drift and ACL parity:** `check-hot-file-ledger.cjs 272` → `ledger gate OK`. `check-deploy-drift.sh` → `RESULT: PASS`. `check-schema-acl-parity.cjs` → `schema ACL parity OK`.
- **CLAUDE.md size:** `check-claude-md-size.cjs` → OK, under 120,000.
- **Seeds register, at this close:** `seeds register gate OK — 342/342 parsed, 0 duplicate ids, 342/342 carry all 5 required keys.`
- **Fences:** D-05 (`validator_kinds.py` in the phase diff) → `0`. D-01 (`git grep -i must_filter`) → empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1, Bug] Migration 200 regressed every pooled connection after its fifth retrieval call.**
- **Found during:** Task 1, on the ladder's generic-plan leg. The unfiltered control's function call read p50 1,586.7 ms.
- **Issue:** PL/pgSQL caches one generic plan per session after five custom-plan calls. With 200's new btree, that plan joins every visible document to its chunks. The slowdown hits both filtered and unfiltered calls, and keyword search reached up to 31.0 s.
- **Fix:** Migration 201 adds `ALTER FUNCTION … SET plan_cache_mode = force_custom_plan` to both RPCs. It was applied twice each to the local dev DB and to `recall_bench`, and its VERIFY block read 5/5 PASS. ACLs are unchanged. `full-schema.sql` was regenerated without `--reset` (+2 lines). An integration pin was added, and 200's header now says never to apply it without 201.
- **Files:** `supabase/migrations/201_*.sql`, `200_*.sql` (header), `supabase/full-schema.sql`, `test_272_rpc_document_scope.py`
- **Commit:** `9f29fa4d2`

**2. [Operator ruling, then Rule 1] D-27 / F-2: a matched document was silently dropped, and the answer stated a false count.** There were two causes.
- **Cause 1, threshold.** `_select_filtered_vector_rows` kept only above-0.3 rows whenever any row cleared the threshold. Fixed with TDD in `7fcfeee09` → `6922624d6`. The new `_cover_matched_documents` keeps each document's best row first.
- **Cause 2, dedup.** `_deduplicate_chunks` compared Jaccard similarity across documents. The Sep and Oct Acme reports score 0.900, so September collapsed into October. This was found by live probe 1 (2/3 coverage). Fixed with TDD in `cfaa0fb4a` → `1cef556f3`: `same_document_only=True` applies on the filtered path only. `test_272_pure_move` retires `_deduplicate_chunks` from its AST pin by name, which proves the move was pure at `c29ec8635`.
- **Live proof.** After restart #3, probe 2 returned `3/3 matched docs · Sep 2025 cited: True`, and board (b) reached 3/3 on all 8 rows. The unfiltered path is unchanged and pinned.
- **Files:** `retrieval_rank.py`, `retrieval_service.py`, `test_272_filtered_both_arms.py`, `test_272_pure_move.py`

**3. [Operator ruling "Fast fix now"] F-3: the search card read `0 results` for a refusal, an invalid filter and an empty match alike.**
- **Fix:** Five distinct summaries. A `?raw` case ties the keys the card reads to the keys the handler writes. The suite is adopted in both count-gate knobs. `SearchDocumentsBody.tsx` got its first ledger row, at the commit that took it across the G-5 threshold.
- **Commits:** `7955aba30` → `676024f6a`

**4. [Plan deviation, recorded] `files_modified` was widened** twice in the PLAN frontmatter: once for the Task 4 ruling files and once for the dedup fix. Both are marked as deviations in the plan.

### Seeds

- **SEED-333** (F-1, operator "Accept, plant a seed"): a finished run card folds the `Filtered:` line away at rest. Routed to 273.
- **SEED-334** (new at this close): the admin "must filter" field flag. The CONTEXT `<deferred>` trigger *fired* on Google's board rows. Status `planted`; relates to SEED-153. No existing seed covered the flag; SEED-153 only names the trigger.
- **SEED-335** (O-1, operator "Plant a seed"): `AbsenceHint.tsx:55` reads *"Unmarked claims read as general knowledge"* on a fully sourced answer that cites in a table column (0 inline markers, while References lists 3 sources). Relates to SEED-033.
- **SEED-273** → `partially-answered`. **SEED-076**: the lever is noted and lever 4 stays deferred. **SEED-153**: the chat half is answered; `partial: true` kept.

## Auth / environment gates

- **OpenAI credits exhausted.** This was an operator action, not a deviation. Ingestion paused at embedding with a `429`. The board was not run until the operator added credits, and the paused jobs then resumed on their own.
- **Operator restarts.** Three restarts were needed (Task 2, after the ruling fixes, and after `1cef556f3`), because `uvicorn --reload` does not respawn on this box. Every run was preceded by a single-listener check and a behavioural probe.

## OWED (recorded, never executed here)

1. **Production parity, in this order, before the backend deploy:**
   a. A FREE read of the production `document_chunks` count. If it is large, run `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document_id …` alone first.
   b. Migration **200**, then **201 IMMEDIATELY** after it, each with explicit per-action operator approval. 200 without 201 regresses unfiltered search on every pooled connection.
   c. Both VERIFY blocks; exactly one `match_document_chunks` and one `keyword_search_chunks` signature; then `get_advisors(security)`.
2. **Phase 273 seams:** the `tool_dispatcher.py` registry/handler split (D-15), and the `agent_loop.py` prompt-assembly seam (D-16, 27 lines this phase).
3. **Review items:**
   - Confirm that `scripts/check-schema-acl-parity.cjs`'s DROP-aware regex cannot match a non-DROP statement.
   - `with_search_vocabulary` renders field keys and enum option strings unescaped into the tool schema (272-04 threat flag).
4. **Workspace TODO:** the panel's activity-derived todo marks a lock-refused `search_documents` call as `COMPLETED`. Its state comes from tool completion, not the result payload. Noted and not fixed.
5. **CLAUDE.md** abridged rows were left stale BY DECISION (warn band; the split has been owed since 271). The ledger scan list is current.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-272-24..28 were mitigated as planned:
- the `recall_bench` DSN guard;
- no production write;
- the single asserted org with explicit `X-Org-Id`;
- verdicts computed from `audit_log` plus `messages.tool_calls`, with raw JSON kept;
- a single-listener check plus a behavioural probe before every board.

## TDD Gate Compliance

- `test(272-05)` `7fcfeee09` → `fix(272-05)` `6922624d6` (D-27 threshold)
- `test(272-05)` `7955aba30` → `fix(272-05)` `676024f6a` (F-3)
- `test(272-05)` `cfaa0fb4a` → `fix(272-05)` `1cef556f3` (D-27 dedup)

The GREEN gates are `fix(...)` rather than `feat(...)`, because each corrects shipped behaviour.

## Self-Check: PASSED

- All 16 listed commits are present in `git log` (`516de5cd9..HEAD` holds exactly these 16 before this summary's commit).
- The created files exist: migration 201, both scripts, `SearchDocumentsBody.test.ts`, SEED-333/334/335, the UAT log and `evidence/`.
- `node scripts/check-seeds-register.cjs` exits 0 (342/342).
- STATE.md and ROADMAP.md are untouched (the orchestrator owns them).
