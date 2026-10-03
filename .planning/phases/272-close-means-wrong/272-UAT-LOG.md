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

### Blocker cleared (2026-10-03, continuation of 272-05)

The operator added credits. Measured before anything was recorded: the five fixture jobs had resumed
on their own (`ingestion_jobs.status = completed`, `documents.status = completed`, one chunk each,
`embedding IS NOT NULL` on all five); one direct `text-embedding-3-small` call returned `EMBED OK dims
1536`; `/health` 200. `--seed` re-ran idempotently:

```
dev user d8a54002-6a29-4b88-b918-cff2aa4a06d5 · single org 22f9c615-0eec-440a-8804-ed4784d6f57f (asserted from org_members)
SEED field legal_entity exists type=enum options=['Acme GmbH', 'Beta Ltd']
SEED OK  272-board-acme-2025-09.md id=1aaae022-… status=completed date_typed=2025-09-15 legal_entity=Acme GmbH chunks=1
SEED OK  272-board-acme-2025-10.md id=7b0af230-… status=completed date_typed=2025-10-15 legal_entity=Acme GmbH chunks=1
SEED OK  272-board-beta-2025-10.md id=d66d6436-… status=completed date_typed=2025-10-20 legal_entity=Beta Ltd chunks=1
SEED OK  272-board-acme-2026-03.md id=bcdd9e20-… status=completed date_typed=2026-03-15 legal_entity=Acme GmbH chunks=1
SEED OK  272-board-beta-2026-03.md id=295ceacf-… status=completed date_typed=2026-03-18 legal_entity=Beta Ltd chunks=1
```

Confounders checked in the org (176 latest documents, 35 dated): October 2025 holds only the two
fixtures; one unrelated PDF is dated **2026-07-12** but has no `legal_entity`, so (c)'s combined filter
still resolves empty; only the five fixtures carry `legal_entity`. The org also holds "ACME
Corporation" documents (`acme_q3_2026_financial_report.md` and others). They are a realistic decoy
for (b), and Google cited one.

## SC#10 board (Task 3) — 20 / 24 PASS

Method, exactly as `272-VALIDATION.md` §3: `scripts/run-272-board.py --run`; roster derived at run
time from `MODEL_CAPABILITIES` (newest registry-backed id per provider + OpenRouter); one fresh thread
per row × prompt; per-request `model` + `provider` on `POST /threads/{id}/messages` (no global
setting mutated); verdicts from the run's `audit_log` `search.query` rows (`filters`, `result_kind`,
`document_ids`) plus every persisted `messages.tool_calls` entry and `messages.source_refs`. Effective
`runs.provider/model` == requested on all 24. Roster derivation verbatim: `evidence/board/board-run.log`.

```
| anthropic | claude-sonnet-5 | PASS | PASS | PASS |
| deepseek | deepseek-v4-pro | PASS | PASS | PASS |
| google | gemini-3.5-flash | FAIL | FAIL | FAIL |
| minimax | MiniMax-M3 | PASS | PASS | FAIL |
| moonshot | kimi-k2.6 | PASS | PASS | PASS |
| openai | gpt-5.6-luna | PASS | PASS | PASS |
| openrouter | z-ai/glm-5.2 | PASS | PASS | PASS |
| zhipu | glm-5.2 | PASS | PASS | PASS |
```

Per prompt: (a) 7/8 · (b) 7/8 · (c) 6/8. Every FAIL with its evidence:
- **google (a)** run `7bdfff7f`: both `search_documents` audits carry `filters: []`; it scoped by
  `query_documents` SQL (`… metadata->>'date' LIKE '2025-10%'`). The figures were right; **D-17 fails a
  correct answer without the filter**. Cited 8 documents, including `272-board-beta-2026-03.md`.
- **google (b)** run `d79bb11b`: the first call carried `legal_entity = Acme GmbH`. It was followed by
  `query_documents` ×4, `read_document`, an unfiltered search and a search filtered on `title = ACME
  Corporation …`. Citations include `acme_q3_2026_financial_report.md` and
  `acme_contract_renewal_schedule_2026.md`, which are not Acme GmbH.
- **google (c)** run `78784975`: no search carried entity + July; 14 tool calls (`query_documents` ×9,
  `grep` ×2, `search_documents` ×3), and the run ended *"The model produced 14 tool call(s) over 15
  step(s) and never wrote an answer"*. It made 6 citations.
- **minimax (c)** run `63ef49eb`: `search_documents(legal_entity = Acme GmbH)` with no date came first
  (`passages`, Sep + Mar); then entity + July (`no_documents_matched`). The answer says July has
  nothing, yet cites **EUR 1,180,000 (Sep 2025)** and **EUR 1,410,000 (Mar 2026)**. The D-09 lock only
  fires after an empty search, so a broader search run *before* it is outside its reach (CONTEXT D-22
  known limit, now observed).

**Deferred-idea trigger fired:** CONTEXT `<deferred>` — the admin "must filter" field flag, *"revisit if
the SC#10 board shows a provider that will not emit filters reliably"*. Google is that provider. It
was recorded, not built: the phase is not re-scoped.

⚠ **Finding F-2 — every passing (b) row, and G4-3.** `legal_entity = Acme GmbH` matches 3 documents
(`matched_document_count = 3`). Each of the 7 passing rows returned and cited 2, and several answers
claim *"two monthly financial reports"*. Cause, from the code: `retrieval_rank._select_filtered_vector_rows`
keeps only above-threshold rows (0.3) when any clears it (D-10 as written). Keyword RRF fusion
rescues one more at most. The (b) verdict rule, "every citation inside the filter", cannot see a
dropped in-filter document. Not fixed: changing D-10's semantics is a decision, and it needs a
backend restart. Routed to the operator.

## G-4 drive (Task 3) — real Chromium, rendered text at rest

No Chrome MCP in this executor, so the drive used Playwright 1.60 (`chromium-1223`, headless,
1600×1000, dark) from a scratch script outside the repo (271 precedent). It signed in through the UI
as the dev user, typed with key events, and ran against `http://localhost:5173/app.html` with the
operator's saved model **deepseek / deepseek-v4-flash**. This is a substitution for the Chrome MCP
drive and is named here.

| # | Result | Rendered text (verbatim) | Audit |
|---|---|---|---|
| G4-1 | PASS (F-1) | answer *"…October 2025 revenue splits as follows: Acme GmbH: EUR 1,240,000 [1] · Beta Ltd: GBP 860,000 [2]"*; `References · 2 sources` = `272-board-acme-2025-10.md`, `272-board-beta-2025-10.md`; card line **`Filtered: document date 1–31 Oct 2025`** after one click (at rest the run card is folded to `✓ done`) | `352d7fb5` passages |
| G4-2 | PASS (F-3) | *"No documents matched legal entity = Acme GmbH · document date 1–31 July 2026, so I can't give you a July revenue figure…"* + nearby Mar 2026 / Oct 2025 / Sep 2025; no number, no marker, no References. Card 1 `Filtered: legal entity = Acme GmbH · document date 1–31 Jul 2026` → `0 results`; card 2 `Filtered: legal entity = Acme GmbH` → `0 results` (this is the lock's refusal) | `d9bc7f2b` no_documents_matched · `c8b9c9ba` refused_retry |
| G4-3 | PASS by bar (F-2) | card **`Filtered: legal entity = Acme GmbH`** (canonicalised from `Acme Gmbh`); *"here are the two monthly figures in your documents: March 2026: EUR 1,410,000 · October 2025: EUR 1,240,000"*; `● Low confidence`. September 2025 is missing | `bb2b1072` passages, matched 3 |

Evidence: `evidence/g4-{1,2,3}-at-rest.png`, `-runcard-open.png`, `-references-open.png` (1 and 3),
`-dom.txt`, `-runcard-open-dom.txt`.

Findings (VALIDATION §4): **F-1** the finished run card folds, so the filter line is one click away
(RunCard is unchanged by 272: last touched `c570922f4`, Phase 257). **F-2** the dropped in-filter
document plus the false count. **F-3** `SearchDocumentsBody.tsx:14` renders `0 results` for any
non-array result (refusal, invalid filter and empty match all look the same; the workspace TODO
shows the refused call `COMPLETED`). That file is unchanged by 272, and the size of the fix is
`/gsd:fast`.

## Operator rulings at the Task 4 checkpoint (2026-10-03), executed

The table is in `272-VALIDATION.md` §4. The details follow.

### F-2 — "Fix in 272" (CONTEXT D-27)

The operator's intent: inside a matched filter set, return the best passage from **every** matched
document (up to `top_k`), with below-threshold ones marked `low_similarity`. Before this fix, a
document scoring under 0.3 was dropped whenever any other passage cleared it. TDD:

- RED `test(272-05)`. Seven cases in `backend/tests/unit/test_272_filtered_both_arms.py` failed on
  the shipped tree for the stated reasons (`['a1'] == ['a1','b1','c1']`, `{'dA'} == {'dA','dB'}`,
  and the missing `_cover_matched_documents`). One existing assertion, *"d2 is dropped"*, was changed
  on purpose: it pinned the D-10 behaviour that D-27 replaces.
- GREEN `fix(272-05)`. `retrieval_rank._select_filtered_vector_rows` keeps the above-threshold rows
  and adds the best row of each document that has none, marked. The new pure helper
  `_cover_matched_documents(rows, top_k)` takes each document's best-ranked row first, fills the
  remaining slots by rank, and keeps rank order. `retrieval_service.search_documents` uses it for
  the filtered cut on both paths. The reranker sees the full filtered selection
  (`top_n=len(candidates)`) and its output is cut with coverage. The unfiltered path is unchanged:
  `[:top_k]` and rerank `top_n=top_k`.
- Targeted runs: `pytest tests/unit -k 272` gave **143 passed**. `test_retrieval_service.py` showed 15
  failures, and they are the same 15 names listed in `272-BASELINES.md`, so they are inherited.
- Known limit (D-27): coverage only applies inside each arm's candidate pool.

### Google 0/3 — bounded investigation (provider-docs-first)

**Verdict: (ii) model behaviour, and the SC#4 Google rows (a) and (c) are recorded UNMET.** One
cause on our side contributed to row (b). That cause is F-2, now fixed, so (b) is re-run owed.

1. **Provider docs.** Fetched 2026-10-03:
   `https://ai.google.dev/gemini-api/docs/function-calling.md.txt`, sections "Notes and
   limitations" and "Best practices". Nested `array` of `object` parameters are in the supported
   OpenAPI subset. The only nesting caveat is for `any` mode (*"the API may reject very large or
   deeply nested schemas"*), and we run `auto`. Best practices say *"Keep active set to 10-20 tools
   maximum"*. `get_tools(None)` measured **28** tools, so we exceed Google's guidance. This is
   **recorded, not fixed**: the tool roster is shared across providers, and trimming it per provider
   is an architectural change (Rule 4) outside the bounded scope. It is a candidate cause of the tool
   wandering, not a proven one.
2. **Our sanitizer** (`google_service._sanitize_schema_for_google` / `_convert_tools_to_google`) was
   run on the live `search_documents` definition. `filters` comes out as `ARRAY` of `OBJECT` with
   all 6 item properties (`field, op, value, value2, values, unit`) and `items.required = [field,
   op]`. Nothing was stripped and the Tool constructs.
3. **Emission works.** Across the three runs Gemini emitted well-formed `filters` three times: (b)
   call 1 `legal_entity eq Acme GmbH`, (b) call 8 and (c) call 11 `title eq "ACME Corporation …"`.
   The declaration therefore reaches the model, and the model can fill it.
4. **Behaviour.** (a) and (c) opened with `query_documents` SQL (9 of the 14 calls in (c)). No run
   ever emitted a `date` filter, even after the SQL output showed `metadata.date` values. (c) ended
   at the agent loop's 15-step iteration cap: the 15th call is recorded as `iteration_cap_paused`, and
   the run says *"14 tool call(s) over 15 step(s) and never wrote an answer"*. That is the cap
   working as designed, not a loop defect. The model's exploration consumed the budget.
5. **Our contribution in (b).** The first call was correctly filtered, but it returned 2 of the 3 Acme
   GmbH reports (F-2). Gemini's next call, a `query_documents` SQL query, listed 3 reports. It then
   `read_document` the missing September report and widened to the "ACME Corporation" decoys. With
   F-2 fixed, the first call now returns all three. Re-run owed.

### F-3 — "Fast fix now"

- RED `test(272-05)`. New suite `frontend/src/components/chat/tool-bodies/SearchDocumentsBody.test.ts`:
  9 cases, 6 RED on the shipped tree. The five non-passage outcomes all read `0 results`
  (`expected 1 to be 5` distinct). A `?raw` case ties the keys the card reads to the keys the handler
  writes (`"error": "refused_retry"`, `"error": "invalid_filter"`, `"status":
  "no_documents_matched"`, `"not_searchable_yet"`, `"matched_documents": matched`, `"error":
  "retrieval_unavailable"`).
- GREEN `fix(272-05)`. The card now reads `refused — would drop the filter` / `invalid filter
  (<field>)` / `no documents matched` / `N matched — not searchable yet` / `search unavailable`.
  Passages and an empty array are unchanged. The suite is adopted in BOTH count-gate knobs (BASELINE
  `"SearchDocumentsBody.test.ts": 9` plus a file-level TARGETS entry, because `src/components/chat`
  has no directory entry) in the same commit.
- Gates: `npx tsc -p tsconfig.app.json --noEmit` reported **70** errors, the baseline count, with 0 in
  any touched file. The count-gate verdict is quoted below.

### Gates after the ruling fixes (main tree, 2026-10-03)

- **Backend unit gate** (`node scripts/check-backend-unit-baseline.cjs`, from `backend/`), verbatim:
  `71 failed, 6388 passed, 1 skipped, 2 xfailed, 2 xpassed` → `[GATE PASSED] Backend unit baseline
  satisfied (failed: 71 <= 71, errors: 0)`. The **failed SET equals `272-BASELINES.md`**: 71 names
  against 71. Diffing the sorted sets leaves one line, `test_no_change_save_does_not_reembed`, which
  has warning text (`C:\Vibe…`) glued to it. After stripping that text the sets are identical.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root), verbatim:
  `SearchDocumentsBody.test.ts  9  9  0` · `total 9469 · failed 1 · pinned total 8714` →
  `RESULT: COUNT GATE VIOLATED (1 reason(s))  [failing-tests]`. No per-file decrease, and every
  pinned file is present. The one failure, read from the gate's own JSON report BEFORE any re-run,
  is `src/pages/WorkflowBuilderPage.canvas.test.tsx` → *"clicking Canvas flips aria-selected …"*,
  `Error: STACK_TRACE_ERROR`. That file is **provably unmodified**: `git diff --numstat
  9c6cfdeb5 HEAD -- frontend/src/pages/` is empty and its last commit is `e3fe03121` (2026-08-28).
  It is one of SEED-171's five named cap-independent flaky suites, and it ran while a concurrent
  `tsc` was loading the box. Re-run alone afterwards: `154 passed`. That is an observation, and one
  green sample of a flaky suite does not prove it innocent.
- **Hot-file ledger gate** `node scripts/check-hot-file-ledger.cjs 272`: `ledger gate OK`.
  `SearchDocumentsBody.tsx` had no row for its entire life. It was added at `3 / 3 / 71`, the commit
  that took it across the G-5 threshold.
- **Not run:** `graphify update .`. `graphify-out/GRAPH_REPORT.md` already had uncommitted changes
  that are not this executor's, so it was left alone.
- **Workspace TODO `COMPLETED` on a refused call:** noted and not fixed. The panel's "Derived from
  activity" todo list takes its state from the tool call's completion, not from the result payload.
  That is a different file from these lines.

### F-1 — "Accept, plant a seed"

**SEED-333** (`.planning/seeds/SEED-333-finished-run-card-folds-away-the-filter-line.md`), allocated
as max(id)+1 (332 → 333). Status `planted`, routed to Phase 273, `trigger_paths` includes
`frontend/src/components/chat/RunCard.tsx`. `check-seeds-register.cjs --files` passes.

### MiniMax (c)

The operator made no separate ruling. It stays a FAIL under the D-22 known limit: a broader search
run *before* the empty one is outside the D-09 lock's reach.

## Re-run after the operator's restart (2026-10-03)

### Live stack, verified before anything was trusted

```
$ git rev-parse --abbrev-ref HEAD ; git rev-parse HEAD
develop
c29ec8635465af823590c30d6f3c902a392b1673
$ Get-NetTCPConnection -LocalPort 8000 -State Listen   (+ Win32_Process for uvicorn)
0.0.0.0 54676 python 2026-10-03T13:09:26.1366114+04:00
56028 parent=27748 start=10/3/2026 1:09:26 PM  backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
54676 parent=56028 start=10/3/2026 1:09:26 PM  C:\Python312\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
$ git log -1 --format=%cI 676024f6a
2026-10-03T12:56:34+04:00
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health
200
```

There is one listener and it started after the last fix commit.

**Behavioural probe.** One board (b) row: deepseek, run `7a7234da`, evidence in
`evidence/board-rerun-probe/`. The audit row is `6c74ddef`.
- The October report came back with `similarity 0.295` and `low_similarity: true`. A March row above
  the threshold came back beside it. Under D-10 as first written, that combination could not happen,
  so the process serves `6922624d6`.
- **The call returned 2 of 3 matched documents.** Its `matched_document_count` is 3. September is
  missing. The verdict line reads: `PASS · filtered call returned 2/3 matched docs · Sep 2025 cited:
  False`.

### Root cause: F-2's second cause, the dedup

`retrieval_rank._deduplicate_chunks` drops a chunk whose word-set Jaccard with a kept chunk is
≥ 0.85, and it compares chunks ACROSS documents. Measured on the stored fixture chunks:

```
272-board-acme-2025-09.md  272-board-acme-2025-10.md  0.900 DUP
272-board-acme-2025-09.md  272-board-acme-2026-03.md  0.810
272-board-acme-2025-10.md  272-board-acme-2026-03.md  0.810
272-board-acme-2025-10.md  272-board-beta-2025-10.md  0.767
(every other pair ≤ 0.727)
dedup keeps: ['272-board-acme-2025-10.md', '272-board-acme-2026-03.md']
```

The two reports differ only in the month name and the figure. The first diagnosis of F-2 named the
threshold alone, and that diagnosis was incomplete. It is corrected beside the original in
VALIDATION §3.

**Fix.** Rule 1 applies, because D-27 is the operator's ruling and this breaks it.
- RED `cfaa0fb4a` adds 8 cases to `test_272_filtered_both_arms.py`. A guard case asserts the fixture
  pair really crosses 0.85, so the rest cannot pass vacuously. Failing on the shipped tree: the pure
  cases (missing `same_document_only`), and the filtered `search_documents` case, hybrid and
  vector-only, which returned `{'dMar', 'dOct'}` instead of 3 documents. That is the live defect,
  reproduced. Passing on the shipped tree: the unfiltered pins.
- GREEN `1cef556f3` adds a keyword-only `same_document_only` to `_deduplicate_chunks`. The default,
  `False`, is the unfiltered behaviour. Both filtered dedup sites pass `same_document_only=filtered`.
- `test_272_pure_move` retires `_deduplicate_chunks` from its AST pin BY NAME (SEED-177). It proves
  the move was pure at `c29ec8635` and pins the divergence to the one kwarg.
- Targeted runs:
  - `pytest tests/unit -k 272`: **152 passed**.
  - `test_retrieval_service.py`: 15 failed, a **SET-IDENTICAL 15/15** match with `272-BASELINES.md`
    lines 77-91.
  - `pytest tests/unit -k "retriev or search or hybrid or rerank or dedup"`: `15 failed, 204 passed`,
    **0 new**. One name had warning text glued to it, as before.
- Ledger: both rows re-derived in the same commit as their sections. `retrieval_rank.py` is
  `4 / 1 / 161`; `retrieval_service.py` is `23 / 12 / 174`. `check-hot-file-ledger.cjs 272` OK.
- ⚠ **The reloader did NOT respawn on `1cef556f3`.** Listener PID 54676 was unchanged afterwards, so
  the fix is not live until restart #3.

### Board (a) ×8 and (c) ×8, re-run on the live process

Method as in the first board, written to `evidence/board-rerun/`. `scripts/run-272-board.py` gained
`--out` so a re-run can never overwrite `board/board-summary.json`. It also gained (b) coverage
NOTES: `returned N/M matched docs` and `Sep 2025 cited`. They are observations only. **The pass rule
is unchanged.**

Why only (a) and (c): neither prompt's filter co-matches the one near-duplicate pair, so the
un-restarted dedup cannot change their filtered results. (b) is owed after the restart.

```
| anthropic | claude-sonnet-5 | PASS | — | PASS |
| deepseek | deepseek-v4-pro | PASS | — | PASS |
| google | gemini-3.5-flash | FAIL | — | FAIL |
| minimax | MiniMax-M3 | FAIL | — | PASS |
| moonshot | kimi-k2.6 | PASS | — | PASS |
| openai | gpt-5.6-luna | PASS | — | PASS |
| openrouter | z-ai/glm-5.2 | PASS | — | PASS |
| zhipu | glm-5.2 | PASS | — | PASS |
```

(a) is 6/8, down from 7/8. (c) is 7/8, up from 6/8. Two verdicts changed, both MiniMax, in opposite
directions. **Neither is attributable to D-27 or F-3:**
- MiniMax (a), run `cb275a0c`, audit `8f69c46f`, **PASS → FAIL.** It made one unfiltered
  `search_documents("October revenue")` call (`filters: []`), then `query_documents` SQL, and cited
  5 documents including `nulfix.txt` and `sample.pdf`. D-27 changes filtered calls only, and F-3 is
  frontend only.
- MiniMax (c), run `63051a8b`, **FAIL → PASS.** There was no entity-only pre-search this time. It
  made two filtered-empty searches (July 2026, audit `33e17fd7`; July 2025, audit `7c45dbef`) and
  cited 0 documents.

Both are **unexplained: run-to-run model variance**. MiniMax's filter emission is not stable, so one
sample of a MiniMax row is not a measurement.

Google is unchanged in both rows:
- (a): `filters: []` again; it used SQL.
- (c): the first call was `legal_entity = Acme GmbH` with no date, then 13 more calls. It ended at the
  15-step cap with no answer.

### G-4 re-drive (Playwright Chromium, rendered text at rest)

`-rerun` evidence; the first drive's files are untouched.

- **G4-1 PASS.** The answer gives October 2025 with Acme GmbH EUR 1,240,000 and Beta Ltd GBP
  860,000. Citations are October only, and `References · 2 sources`. After one click the card shows
  **`Filtered: document date 1–31 Oct 2025`**; F-1 is accepted. Audit `a23161d1`.
- **G4-2 PASS, and F-3 is verified.** The card reads **`Searching documents→no documents matched`**,
  where it used to read `0 results`. The answer says nothing matched and gives no number, no citation
  and no References. Audit `a7b215f8`.
  - The model did not retry, so no refusal card appeared in this drive.
  - The refusal text was read on REAL persisted data instead: the first G4-2 thread (`d420779b`, with
    the lock's `refused_retry`, audit `c8b9c9ba`) was re-opened in the current frontend. Its card 2
    reads **`Searching documents→refused — would drop the filter`**
    (`evidence/g4-2-first-thread-*-rerun.*`).
- **G4-3 OWED.** It depends on `1cef556f3`, which is not live.

Scratch scripts (`g4drive-rerun.cjs`, `g4-2-refusal-rerender.cjs`) live in the session scratchpad,
outside the repo tree.

## Re-run after the operator's restart #3 (2026-10-03)

### Live stack, verified before anything was trusted

```
$ git rev-parse --abbrev-ref HEAD ; git log --oneline -1
develop
c0393f7b2 docs(272-05): post-restart re-run - board (a)/(c) x8, G4-1/G4-2, D-27 dedup cause
$ Get-NetTCPConnection -LocalPort 8000 -State Listen  (+ Get-Process StartTime)
0.0.0.0 pid=42856 python start=2026-10-03T13:46:55.1013188+04:00
$ git log -1 --format='%H %cI' 1cef556f3
1cef556f330d5f5d69a740fe97d5bf70104ed49a 2026-10-03T13:16:04+04:00
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health
200
```

One listener, and it started 30 minutes after the dedup fix commit.

**Behavioural probe 2**, before the 8 rows: `run-272-board.py --run --providers deepseek --prompts b
--out board-rerun-probe2`, run `ad675312`, audit `38ca454d`. Verdict line, verbatim:

```
BOARD deepseek (b) PASS run=ad675312-7c26-47d1-8364-75e44d839d78 status=completed | legal_entity=Acme GmbH filter: True · citations 3 all Acme GmbH: True · filtered call returned 3/3 matched docs · Sep 2025 cited: True · EUR 1,180,000 in answer: True
```

Probe 1 (before restart #3) read `2/3 · Sep 2025 cited: False`. The only change between them is the
process now serving `1cef556f3`, so the live code is proven by behaviour, not just by a timestamp.

### Board (b) ×8

`--prompts b --out board-rerun-b`. Evidence: `evidence/board-rerun-b/` (8 JSON, `board-summary.json`,
`board-run-b.log`, `board-verdicts-readout.txt`). ⚠ The `.log` is gitignored by `*.log`, like
`board-run.log` and `board-run-ac.log` before it, so it exists on disk only and the JSON files are the
committed record. The roster lines are identical to the (a)/(c)
re-run's (`diff` of the `SC10_ROSTER provider` lines is empty). Effective `runs.provider/model` ==
requested on all 8.

```
| anthropic | claude-sonnet-5 | — | PASS | — |
| deepseek | deepseek-v4-pro | — | PASS | — |
| google | gemini-3.5-flash | — | FAIL | — |
| minimax | MiniMax-M3 | — | PASS | — |
| moonshot | kimi-k2.6 | — | PASS | — |
| openai | gpt-5.6-luna | — | PASS | — |
| openrouter | z-ai/glm-5.2 | — | PASS | — |
| zhipu | glm-5.2 | — | PASS | — |
```

**(b) is 7/8, the same as the first board, and no verdict changed.** What changed is coverage: **all
8 filtered calls returned 3/3 matched documents** (the 7 passing rows of the first board each got 2),
and all 8 answers cite Sep 2025 at EUR 1,180,000. Attributed to **D-27** (threshold half `6922624d6`
plus dedup half `1cef556f3`) on every row. The pass rule is unchanged; the coverage note is an
observation the rule does not score.

**Google (b), run `1c791074`: FAIL, with the cause changed.** The first call (`legal_entity = Acme
GmbH`, audit `6732f57d`) returned all 3 reports, so it no longer needed the `read_document` on
September that it made on the first board. It then widened on its own: `query_documents`, an
unfiltered `search_documents` (audit `2efc5cec`, `filters: []`), and a search filtered on `title =
"ACME Corporation - Q3 2026 Financial Results and Form 10-K Report"` (audit `0b0889e6`). It cited
`acme_q3_2026_financial_report.md` and `acme_contract_renewal_schedule_2026.md`, which are not Acme
GmbH. Our contribution named in the Google investigation (F-2) is gone. What remains is model
behaviour, consistent with (a) and (c).

**Complete board after every fix: (a) 6/8 · (b) 7/8 · (c) 7/8 = 20/24**, against 20/24 on the first
board (7 · 7 · 6). Three of the four FAILs are Google (model behaviour, investigated). The fourth,
MiniMax (a), is run-to-run variance and was flipped PASS on the first board.

### G4-3 re-drive 2 (Playwright Chromium, rendered text at rest)

Same method as before, using `g4drive-rerun2.cjs g4-3` from the session scratchpad, which is
`g4drive-rerun.cjs` with the evidence suffix changed to `-rerun2`. Model = the saved deepseek /
deepseek-v4-flash. Thread `ec595218`, run `2839d9dd` (`completed`), audit `fb979f54` (`legal_entity eq
Acme GmbH`, `passages`, `matched_document_count = 3`, 3 `document_ids`).

- **PASS. F-2 is closed on the lived surface.** At rest the answer reads *"Acme GmbH's revenue appears
  in three monthly financial reports in your library:"*, then a table: **September 2025 EUR
  1,180,000** · October 2025 EUR 1,240,000 · March 2026 EUR 1,410,000. It ends *"…I've limited this to
  Acme GmbH as asked."*
- The confidence badge reads `● High confidence`; on the first drive it was `● Low confidence`.
- `References · 3 sources`: `272-board-acme-2025-09.md` (0.64), `-2025-10.md` (0.63), `-2026-03.md`
  (0.63).
- After one click, the card reads `Searching documents→View results` + **`Filtered: legal entity =
  Acme GmbH`** (visible, 659×20). It was canonicalised from the typed `Acme Gmbh` (D-20).
- **Observation O-1 (not a 272 defect, not fixed).** This answer named its sources in a *Source*
  table column instead of `[n]` markers. So there are **0 inline citation markers**, and the footer
  reads *"Unmarked claims read as general knowledge"* while References lists 3 sources. The first
  G4-3 drive and probe 2 both used `[n]` markers. This is model formatting variance, but the footer
  line overstates "unmarked" on a fully sourced answer. It is surfaced for the operator.

Evidence: `evidence/g4-3-at-rest-rerun2.png`, `g4-3-references-open-rerun2.png`,
`g4-3-runcard-open-rerun2.png`, `g4-3-dom-rerun2.txt`, `g4-3-runcard-open-dom-rerun2.txt`. The first
drive's and the `-rerun` files are untouched.

## Operator sign-off (Task 4, 2026-10-03)

| Item | Operator's selection (verbatim) | Recorded as |
|---|---|---|
| G-4 (G4-1, G4-2, G4-3) | **"Approved"** | Signed off, 2026-10-03, after the re-runs above. `272-VALIDATION.md` §4 sign-off column filled. |
| SC#4 | **"Close with Google recorded unmet"** | A DECISION, never "all passed". **Met on 6 of 8 rows.** Google `gemini-3.5-flash` is **UNMET** on (a)/(b)/(c). That is model behaviour, investigated: the schema reaches Gemini intact, it emitted well-formed filters 3 times, and it prefers `query_documents` SQL, widens on its own and hits the 15-step cap. Our F-2 part is fixed. MiniMax-M3 is **UNSTABLE**: run-to-run variance, and one sample is not a measurement. The deferred "must filter" flag trigger FIRED and is planted as **SEED-334** (relates to SEED-153). |
| O-1 | **"Plant a seed"** | **SEED-335**: the footer reads *"Unmarked claims read as general knowledge"* when an answer cites sources in a table column, while References lists 3 sources (relates to SEED-033). |

Both seeds were allocated as max(id)+1 (333 → 334 → 335), and `check-seeds-register.cjs --files` passes on each.

## OWED (recorded, never executed here)

1. ~~Operator: add OpenAI API credits~~ — done 2026-10-03; board and drive run (above).
2. ~~A ruling on F-1 / F-2 / F-3 and the Google board FAILs~~ — ruled 2026-10-03 and executed
   (above). **Still owed:** (i) an **operator backend RESTART**, because the `--reload` watcher does
   not restart on change, so the D-27 retrieval code and the F-3 card are not live until then;
   (ii) a re-run of the 8 board (b) rows, the 3 Google rows and G4-3 (plus the G4-2 card text) on the
   restarted backend; (iii) **operator G-4 sign-off** on G4-1..G4-3.
   **Update (re-run, 2026-10-03):**
   - (i) is done: the restart at 13:09.
   - (ii) is partly done: (a) ×8, (c) ×8, Google (a)/(c), G4-1 and the G4-2 card text are re-run.
   - **Still owed:**
     - ~~(iv) **operator restart #3**, so that `1cef556f3` (D-27 dedup half) is live.~~ Done
       (listener pid 42856, started 13:46:55).
     - ~~(v) then board (b) ×8 with `--prompts b --out board-rerun-b`, plus G4-3. Expected: all 3 Acme
       GmbH reports, including September 2025 at EUR 1,180,000.~~ Done: (b) 7/8 with 3/3 coverage on
       all 8, and G4-3 PASS with three figures (above).
     - ~~(iii) **the operator's G-4 sign-off on G4-1..G4-3 is the only item from (2) still owed.**~~
       Done: **"Approved"**, 2026-10-03 (see "Operator sign-off" below).
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

## HUMAN-UAT 1 — live re-drive of CR-01, CR-02, WR-02 after restart (2026-10-03)

**Live stack, verified first.** Exactly one listener on :8000, pid 30404
(`uvicorn app.main:app --reload`), started 17:00:26 +04. That is after the last fix commit
`e48c4eaf9` (15:07), the fix report `b98fef62e` (15:25) and HEAD `23166e577` (16:38). The same pid
was still listening after the drives. Dev user `d8a54002…`, single org `22f9c615…` (asserted from
`org_members`).

**Seed (idempotent, local only).** A custom date field `contract_end`, plus two fixtures:
`272-uat-tax-memo.md` (topics `["Tax","Audit"]`, date 2026-09-30, contract_end 2026-11-20) and
`272-uat-taxation-essay.md` (topics `["taxation","Public policy"]`, date 2026-08-10, contract_end
2027-06-30). A pre-existing `2025-1042S.pdf` carries `"withholding tax"`, which is a second non-match
control. The scratch driver reuses `scripts/run-272-board.py`'s kit and lives in the session
scratchpad, not the repo.

All runs: anthropic `claude-sonnet-5`, per-request model + provider, `POST /threads/{id}/messages`.
Verdicts are read from `audit_log` `search.query` rows and `messages.tool_calls`.

| Rule | Run | `search.query` audit rows (kind · filters) | Verdict |
|---|---|---|---|
| CR-01 (unforced prompt) | `376e459a` | **none.** The model chose `query_documents_by_view {topics eq "tax"}`, which returned `total: 0`, and it answered "No documents are tagged … tax" | **rule not exercised. A live false zero on a sibling tool** (Gaps G-1) |
| CR-01 (names search_documents) | `9450816b` | `bc7915d8` · passages · `topics eq tax` · matched 1 = `272-uat-tax-memo.md` | **PASS.** "Tax" matched; "taxation" and "withholding tax" did not |
| CR-02 | `a38193eb` | `1107efa2` · invalid_filter · `contract_end within_next 60 days`, then `fa15f0e4` · passages · `contract_end between 2026-10-03..2026-12-02` → the memo | **PASS.** Refused as kind 3, naming date/added/source_created/source_modified. Nothing ran on `date`. The retry matched on contract_end (the memo's document date, 2026-09-30, is outside the window) |
| WR-02 (unforced) | `09bc4bf2` | `fb90eb25` · no_documents_matched · July 2026 + Acme | rule not exercised. The model stopped and offered nearby months |
| WR-02 (prompt asks for the retries) | `27e7f5b8` | `68ff85d8` no_documents_matched (Jul 2026) → `9642bc15` **refused_retry** (`date after 2026-06-30`) → `c464f8b3` **refused_retry** (`between 2026-01-01..2026-12-31`) → `4e47eb73` no_documents_matched (Jul 2025, **allowed**) | **PASS.** Both wide retries were refused with `violated_fields: ["date"]`; the disjoint retry was searched |

**WR-02 supplementary proof (DIRECT HANDLER CALL, not a model run).** `handle_search_documents` was
called from the working tree with a hand-built `ToolContext` (`empty_filter_fields_in_run=set()`)
on a user-JWT client against the live local DB. Sequence: July 2026 Acme → no_documents_matched
(lock `date, legal_entity`) → `after` → refused → whole year → refused → **date dropped** → refused →
July 2025 → allowed → **Beta Ltd July 2026 (different value)** → allowed. This covers the dropped-field
and different-value arms that the model run did not try. It proves the code on live data, not the
uvicorn process. Its audit writes were rejected by `audit_log` RLS (42501), because the live agent
loop writes with the service-role client and this harness did not. So this proof has no audit ids.
That is a harness artefact, not a product defect.

**G-1 (open, recorded, not fixed).** The 271 compiler sends `topics eq` to `@>` with a scalar value
(`view_filter_compiler.py:169-170`). CR-01's rewrite lives only in
`retrieval_scope._compiler_condition`, so `query_documents_by_view` (and very likely Find and Views,
which use the same compiler) still return a false zero on a list field. Measured on the local DB:
`metadata @> {"topics":"tax"}` → 0, `{"topics":"Tax"}` → 0, `{"topics":["Tax"]}` → 1.

Evidence: `evidence/uat-rerun/` has 5 run JSONs plus the direct-handler JSON.
