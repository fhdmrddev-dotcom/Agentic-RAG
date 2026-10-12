# 275-05 Task 1 — notes for the Task 2 / Task 3 executors

**Task:** merged-tree gates, failure-criteria matrix, threat register check, ledger close.
**Tree:** `develop`, base `71c61a6f0` (275-01..04 merged). PHASE_BASE `b41d51d6b`.
**Not done here, by instruction:** the G-4 Chrome drives (Task 2), the docs page / registers / owed rows (Task 3),
SUMMARY.md, STATE.md, ROADMAP.md.

## Where everything is

| Output | File |
|---|---|
| Every gate verdict line, verbatim, + backend FAILED-SET diff + tsc set diff + M-1 EXPLAIN | `275-BASELINES.md` → "275-05 Task 1 — merged-tree gates" |
| SC#1-4 matrix, the 7 failure criteria, the 44-row threat register, the D-31/D-32/D-33 negative fences | `275-G4-EVIDENCE.md` §1-§4 |
| Placeholders for Task 2 (§5 G-4 drives) and Task 3 (§6 limits / registers / owed rows) | `275-G4-EVIDENCE.md` §5, §6 |
| Ledger close (34 scan rows re-derived, 1 new row, 20 CLAUDE.md G-5 rows, a "Phase 275 close" section per file) | `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md` |

## Gate verdicts (one line each — the verbatim blocks are in BASELINES)

| Gate | Verdict | Exit |
|---|---|---|
| Backend unit baseline | `71 failed, 7146 passed, 1 skipped, 2 xfailed, 2 xpassed` · `[GATE PASSED] … (failed: 71 <= 71, errors: 0)` · **FAILED SET == base** | 0 |
| Live suites (275 hold/policy/retrievable/disposition + 272 RPC/scope) | `71 passed, 19 warnings in 19.94s`, no skips | 0 |
| Vitest count gate (cap 2, first run) | `total 10131 · failed 0 · pinned total 9344` · `count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing.` | 0 |
| tsc `-p tsconfig.app.json` | 66 errors = base; set diff = the two base `LibraryPage.tsx TS6133` moved 58 → 62, no new error | 2 (as at base) |
| `check-deploy-drift.sh` | `RESULT: PASS` (2 non-blocking WARNs, both read — see below) | 0 |
| `check-docs-coverage.cjs` | `docs coverage OK` (119 pages, 32 written / 87 stubs) | 0 |
| `test_276_openapi_snapshot_fresh.py` | `2 passed` | 0 |
| M-1 EXPLAIN | `document_chunks_embedding_idx` on the local DB AND on recall_bench (205 DDL in a rolled-back TX) | — |
| `check-hot-file-ledger.cjs <phase>` | `ledger gate OK — every watched file has a row.` (505 rows · 110 subject · 58 watched) | 0 |
| `check-claude-md-size.cjs` | `OK WITH WARNINGS` — 121,650 chars, 81.1% | 0 |
| Negative fences | `git diff --stat b41d51d6b -- retrieval_service.py scheduler_service.py` EMPTY; `document_governance.py` EMPTY | — |

## What Task 2 must know

- **Nothing in Task 1 proves a G-4 row.** SC#1, SC#2, SC#3 and SC#4 read "PASS (automated); G-4 … owed to Task 2" in
  the matrix. If a drive cannot run, its row is OWED with exact operator steps — never a pass (T-275-36).
- **Do NOT call a revoked function as `authenticated` on the local DB** — it crashes the Postgres backend
  (275-01 finding, `deferred-items.md`). The W-8 before/after RPC reads call `match_document_chunks` /
  `keyword_search_chunks`, which `authenticated` CAN execute (verified: `has_function_privilege` true for the
  helpers they use); check `has_function_privilege` first for anything else.
- The local-DB lock (`C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock`, noclobber) was RELEASED at
  the end of Task 1's DB work. Take it again before any fixture write.
- Task 1 left NO fixture rows, policies or holds in the local DB.
- Evidence names accounts by role only (T-275-37).

## What Task 3 must know

- `check-docs-coverage.cjs` is green on the merged tree (`119 pages (32 written / 87 stubs)`); the retention page is
  still a stub — Task 3 rewrites it.
- `check-deploy-drift.sh` PASSES with a WARN: `migration(s) above #198 carry seed-like INSERT/UPDATE — …
  204_retention_and_legal_hold.sql`. Measured: the two `INSERT INTO` statements (`:397`, `:428`) sit INSIDE the
  sticky-coverage trigger functions (`documents_sticky_hold_on_move`, `folders_sticky_hold_on_move`), not seeds.
  So the OPERATOR.md Step-3 seed list needs nothing for 204. Worth one line in the owed-rows section.
- The watch-purge storage orphan was NOT fixed by 275-02 (its SUMMARY says so) → file BUG-261012-01.
- CLAUDE.md is now **121,650 chars** (81.1%, WARN band since 275-01). The split is scheduled, not urgent.

## Deviations (Task 1)

1. **[Recorded] The threat-id grep counts 45, the id set is 44.** The plan's own pattern `T-275-[0-9]*` matches
   the bare prefix `T-275-` in plan 05's text (which quotes the grep). The register has one row per real id
   (01-44, no gaps), and the explanation is written beside the count in G4-EVIDENCE §3. The acceptance criterion
   "threat rows == the printed count" is therefore met as 44 == 45 − 1 bare token, stated rather than padded.
2. **[Rule 1 - Bug, ledger] Four triples written inside this phase counted six-digit quick-task buckets**
   (`DocumentList.tsx` 16→15, `LibraryPage.tsx` 21→19, `types/index.ts` 78→77, `scripts/vitest-count-gate.cjs`
   68→65). Corrected with "(was …)" beside the new value, and the reason in each file's close section.
3. **[Rule 2 - ledger completeness] Five FIRING files had no CLAUDE.md G-5 row**: `api/sources.py`,
   `models/document_search.py`, `retrieval_documents.py`, `findState.ts` (all crossed the threshold inside 275)
   and `document_view_resolver.py` (FIRED since 271, present in the scan list, absent from CLAUDE.md). Rows added.
4. **[Rule 2 - ledger completeness] `scripts/build-public-openapi.cjs` had no ledger row anywhere** (275-03 edited
   it under Rule 3). Scan-list row + section added (`scripts/` is gate-exempt, so the gate could not have asked).
5. **[Recorded] M-1 on the local DB now shows the HNSW index**, where 275-01's local EXPLAIN showed a top-N
   heapsort (identical before and after the swap, so no regression either way). The probes differ: Task 1 ran the
   RPC's INDEX-branch body (org gate + the three visibility arms + `d.retrievable`, threshold 0.0) with a STORED
   embedding as the query vector; 275-01's script is not in the tree, so the exact cause of the plan difference
   is NOT measured. Both readings are kept; the one claim made is that the index is chosen on the merged tree.
6. **[Recorded] The backend FAILED SET's one raw `comm` line** is the same interleaved `RuntimeWarning` artifact
   275-01/02/03 recorded (`test_explorer_agent.py::…uses_explorer_prompt` with a path glued on). Normalised to the
   test id, the set diff is EMPTY.
