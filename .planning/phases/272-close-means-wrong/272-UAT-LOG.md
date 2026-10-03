# Phase 272 — UAT log (plan 272-05)

## Step (0) — location assertion (before any read or write), verbatim

```
$ git rev-parse --show-toplevel
C:/Vibe Apps/Agentic RAG
$ git rev-parse --abbrev-ref HEAD
develop
$ git rev-parse HEAD
516de5cd91976c6d435f91992bb778b58935bf2f
$ git merge-base --is-ancestor 4b7e59e74 HEAD && echo "4b7e59e74 ancestor OK"
4b7e59e74 ancestor OK
$ git merge-base --is-ancestor 619af9ba7 HEAD && echo "619af9ba7 ancestor OK"
619af9ba7 ancestor OK
```

Main working tree, not a worktree. 272-01..04 SUMMARY files present. Pre-existing dirty files
(`.mcp.json`, `graphify-out/GRAPH_REPORT.md`, untracked `.planning/ui-reviews/`, `scratch/`,
`screenshots/`) are not this plan's and were never staged.

## SC#3 — the recall ladder (Task 1)

Full table, method, rule and result: `272-VALIDATION.md` §2. Raw: `evidence/recall-ladder.json`,
`evidence/recall-ladder-15000.json`. Script: `scripts/measure-filtered-recall.py` (refuses any DSN
whose database is not exactly the loopback `recall_bench`, and re-checks `current_database()`).

- **Bench prep (bench-only):** `recall_bench` was at the pre-200 signatures; migration 200's file
  was executed against it with asyncpg (no rebuild needed: the bench already had `date_typed`), then
  migration 201. Disjoint document groups got bench-only `metadata.date` months 2031-01 … 2031-06
  (500 / 1,000 / 2,000 / 5,000 / 10,000 / 15,000 chunks). A 25,000-chunk set was attempted and
  refused by the script (only 1,396 eligible documents); 15,000 was measured instead.
- **Result:** recall 1.000 at every filtered point; no HNSW node in any filtered plan up to 15,000
  chunks; `FILTERED_EXACT_MAX_CHUNKS = 2000`, `FILTERED_ITERATIVE_SCAN = "relaxed_order"` by the
  written rule (control p95 34.41 ms + 50 → bound 84.41; exact p95 2,000 = 46.20 ✅, 5,000 = 108.24 ✗).
  The values equal 272-03's provisional ones; they are now measured. Commit `b2f973f76`.
- `config.py`: the "default raised from 40 to 200" comment corrected (cites `521f4a025`); the value
  `hnsw_ef_search: int = 40` is unchanged — `git diff 516de5cd9 -- backend/app/config.py` touches
  comment lines only. No global knob changed (D-14).

### ⚠ The finding that changed the phase — migration 201 (Rule 1, commit `9f29fa4d2`)

The checklist's GENERIC-plan leg showed the unfiltered control's function call at **p50 1,586.7 ms**
(`evidence/ladder-run1-aborted.txt`). Isolated on the bench with rolled-back DDL, 12 sequential
calls per session (`evidence/plancache-diagnosis.txt`, scripts beside it):

| Scenario | calls 1-5 | calls 6-12 |
|---|---|---|
| unfiltered vector, migration 170 body, no btree (pre-272) | 3-22 ms | 3-8 ms |
| unfiltered vector, migration 170 body + btree | 3-16 ms | **452-1,027 ms** |
| unfiltered vector, migration 200 as applied | 13-85 ms | **488-1,557 ms** |
| unfiltered vector, 200 + `force_custom_plan` | 3.6-24 ms | 2.5-6.4 ms |
| 500-chunk filtered index branch, 200 as applied | 7-75 ms | **439-496 ms** |
| same + `force_custom_plan` | 8-26 ms | 8-20 ms |
| unfiltered keyword, pre-272 | 1.6-294 ms | 0.8-920 ms |
| unfiltered keyword, 200 as applied | 3-310 ms | **45 ms - 31.0 s** |
| unfiltered keyword, 200 + `force_custom_plan` | 1.7-420 ms | 4.6-408 ms |

PL/pgSQL plans each statement with real arguments for five calls, then may cache ONE generic plan
per session; with the new btree that plan joins every visible document to its chunks. A pooled
backend connection is one session, so every connection degrades after its fifth retrieval call —
**filtered or not**. Migration 201 (`ALTER FUNCTION … SET plan_cache_mode = force_custom_plan` on both
RPCs) was applied by Claude to the local dev DB and to `recall_bench` with asyncpg, twice each
(idempotent); its VERIFY block read **5/5 PASS** on both; ACLs unchanged
(`{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`). `full-schema.sql`
regenerated without `--reset`: `+2` lines (the two `SET plan_cache_mode TO 'force_custom_plan'`).
`check-schema-acl-parity.cjs`: OK. Integration pin `test_both_rpcs_pin_custom_plans`: **RED** with the
pin reset (`2 failed`), **GREEN** with 201 re-applied (suite `12 passed`). Migration 200's header now
says never to apply it without 201.

## Merged-tree gates (Task 1 step 4), verbatim

| Gate | Result |
|---|---|
| Backend unit (`node ../scripts/check-backend-unit-baseline.cjs`, in `backend/`) | `71 failed, 6382 passed, 1 skipped, 2 xfailed, 2 xpassed, 45 warnings in 493.32s (0:08:13)` · `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` Failed SET vs `272-BASELINES.md`: `71 71 NEW: [] GONE: [] SET-IDENTICAL` (one line had `RuntimeWarning: coroutine 'AsyncMockMixin._execute_mock_call' was never awaited` glued onto `test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize`; stripped before the diff) |
| `tests/test_098_scope_governance.py` | `1 failed, 5 passed` — the inherited `test_run_start_resolution` (`ValueError`), as at base |
| `tests/test_2171_search_error_audit.py` | `5 passed` |
| `tests/test_2171_trend_segments.py` | `2 passed` |
| `tests/test_147_flag_refuse.py` | `8 passed` |
| `tests/test_harness_whitelist.py` | `12 passed` |
| `tests/test_096_ci_workflow_regression.py` (`--timeout=60`) | Timeout in `run_lifecycle._watch` → `is_run_cancelled` → `logger.exception("is_run_cancelled: registry read failed …")`, exactly as at base (inherited hang) |
| every `tests/unit/test_272_*.py` (11 files) | `136 passed` |
| `tests/integration/test_272_*.py` + `test_266_two_org_fence.py` | `24 passed` (none skipped) |
| Tool inventory (`test_259` / `test_261` closed-core inventories + `test_085_tool_registration`) | `27 passed` — 29 tools unchanged |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, repo root) | `total 9460 · failed 0 · pinned total 8705` · `count gate OK — 375/375 pinned files present, no per-file decrease, 0 failing.` |
| `npx tsc -p tsconfig.app.json --noEmit` | **70 errors = 272-02's base 70**; **0** in any phase-touched frontend file (`toolMeta.ts`, `ToolCallPanel.tsx`, their two test files — the only frontend files in `git diff f49d9ea2d`) |
| `node scripts/check-hot-file-ledger.cjs 272` | `ledger gate OK — every watched file has a row.` (381 rows, 54 subject files, 14 watched) |
| `bash scripts/check-deploy-drift.sh` | `RESULT: PASS — the one-box deploy artifacts are in sync.` (docker compose denied here → structural fallback, WARN) — no new env var |
| `node scripts/check-schema-acl-parity.cjs` | `schema ACL parity OK` |
| `node scripts/check-claude-md-size.cjs` | `claude-md size gate OK — … all under 120000 chars.` |
| `node scripts/check-seeds-register.cjs` | `seeds register gate OK — 339/339 parsed, 0 duplicate ids, 339/339 carry all 5 required keys.` |
| D-05 fence: `git diff f49d9ea2d --name-only \| grep -c harness/validator_kinds.py` | `0` |
| D-01 fence: `git grep -n -i "must_filter" -- backend supabase frontend/src` | (empty) |
| Migrations since PHASE_BASE | `200_filtered_retrieval_document_scope.sql`, `201_retrieval_rpcs_force_custom_plan.sql` |

## Registers (Task 1 steps 5-6)

- **Ledger close** (`2451dbc30`): 14 scan-list rows re-derived with the recipe, `(was …)` kept, and a
  "Phase 272 — close re-derivation" section. `retrieval_service.py` extraction **DISCHARGED (272-01)**;
  `tool_dispatcher.py` registry/handler split (D-15) and `agent_loop.py` prompt-assembly seam
  (D-16, 27 lines) **OWED → 273**.
- **CLAUDE.md abridged rows left stale BY DECISION — warn band; split owed since 271.** CLAUDE.md is
  at 119,524 chars, 476 under the 120,000 warn band; refreshing nine rows would cross it. The gate
  reads the ledger's scan list, so G-5 still sees every row.
- **Seeds** (`bcd4b8df9`): SEED-273 → `partially-answered`, `partial: true` (filtered path answered;
  the unfiltered small-tenant cliff stays open by D-14). SEED-076: the exact-scan-over-a-resolved-set
  lever shipped; lever 4 stays deferred, trigger not fired.

## Live stack (Task 2 checkpoint)

- **Before the restart:** one listener on :8000, PID 41452 (uvicorn `--reload`, parent 19104), created
  `2026-10-03 00:47:28` local — before every 272 source commit (the last, `4b7e59e74`, is 10:26:09).
  The reloader had not respawned it through any of them, so it served pre-272 code. Local
  `audit_log` held **0** `search.query` rows carrying `result_kind`.
- **After the operator's restart:** `/health` 200; exactly ONE listener on :8000, PID 46408 (parent
  41740, both created `2026-10-03 10:41:19`), started after `4b7e59e74`. 272-05's own source edits
  are comment-only (constants unchanged in value), and migration 201 is DB-side, so the running
  process serves the merged tree's behaviour. ⚠ Observed: this reloader did NOT respawn on 272-05's
  `retrieval_rpc.py` edit either — `--reload` is not reloading on this box; any later
  behavioural edit needs an operator restart. A behavioural probe of the running process (an audit
  row carrying `filters` + `result_kind`) was not obtainable — see the blocker below.

## ⛔ BLOCKER for the board (Task 3) and G-4 — OpenAI credits exhausted

`run-272-board.py --seed` ran as the dev user (`fhdmrd@gmail.com`, `d8a54002-…`; **one** org,
`22f9c615-…`, asserted from `org_members` — the memory note "dev account is in two orgs" is stale):
the enum field `legal_entity` (`Acme GmbH`, `Beta Ltd`) was created (HTTP 201) and the five fixture
reports uploaded (HTTP 201 ×5), but **ingestion paused at the embedding step**:

```
ingestion_jobs.status = paused · stage = tables_embedded · last_error =
openai · 429 · Error code: 429 - {'error': {'message': 'You have no credits remaining. Add credits
to continue using the API at https://platform.openai.com/settings/organization/billing/.', ...
```

The embedding provider is `openai` / `text-embedding-3-small` (1536). Every `search_documents` call
embeds the query through the same key, so with no credits **every kind-1 search on every provider
row would read `retrieval_unavailable`** — running the board now would measure the billing state,
not filter emission. The board and the G-4 drive are therefore not run; nothing was recorded as a
pass or a fail. ⛔ Switching the embedding provider is NOT a workaround: a dims change deletes every
vector.

When credits are restored, the ingestion queue's circuit breaker probes the provider and resumes the
paused jobs itself (`ingestion_queue_service.py:145-151`). Then:
`backend/venv/Scripts/python.exe scripts/run-272-board.py --seed` (idempotent by filename: it
waits for ingestion, PATCHes `date` + `legal_entity`, asserts `date_typed` and chunks), then
`--run`.

## OWED (recorded, never executed here)

1. **Operator: add OpenAI API credits** (above). Then the board (8 rows × (a)/(b)/(c)) and the G4-1..3
   drive.
2. **Operator G-4 sign-off** on G4-1..G4-3 (Task 4) — OWED until the drive has run.
3. **Production parity, in this order, before the backend deploy:**
   a. A FREE read of the production `document_chunks` count (Supabase MCP `execute_sql` SELECT — not
      available to this executor, so OWED). If it is large, run alone first, outside any transaction:
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks (document_id);`
   b. Paste migration **200**, then **201 immediately after it** (200 without 201 regresses
      unfiltered search on every pooled connection), via the SQL editor. Each needs explicit
      per-action operator approval.
   c. Run both files' VERIFY blocks; check exactly ONE `match_document_chunks` and ONE
      `keyword_search_chunks` signature; then `get_advisors(security)`.
4. Phase 273: `tool_dispatcher.py` registry/handler split (D-15); `agent_loop.py` prompt-assembly
   seam (D-16).

## Review items carried (not fixed here)

- `scripts/check-schema-acl-parity.cjs` became DROP-aware in 272-03 (a later `DROP FUNCTION` retires
  exactly that signature's tuples). A reviewer should confirm the drop regex cannot match a
  non-DROP statement.
- 272-04's threat flag: `with_search_vocabulary` renders the caller's own field keys and enum option
  strings into the model's tool schema unescaped; a hostile option string could carry instructions
  to that caller's own model.
