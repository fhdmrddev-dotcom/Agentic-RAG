---
phase: 267-an-expert-adds-scope
plan: 05
subsystem: verification + registers — live proof of PACK-21..25 and the phase close
tags: [experts, uat, rls, cross-provider, g-4, registers, ledger]
requires:
  - "267-01..04 (every surface this plan proves live)"
provides:
  - "backend/tests/integration/test_267_transcript_rows_rls.py — two-org real-RLS fence for the event and handoff rows"
  - ".planning/phases/267-an-expert-adds-scope/267-VALIDATION.md — the 4-axis scoreboard, authored before the drive"
  - ".planning/phases/267-an-expert-adds-scope/267-UAT-LOG.md + evidence/ — SC#1..SC#5, SC#10 ×8, 4 axes, G-4 ×3, UI rows"
  - "F-1 / F-2 fixes (backend/app/dependencies.py, expertCatalog.ts), landed by the orchestrator inside this plan"
affects: [267-verification, SEED-303, SEED-309, SEED-314, docs/HOT-FILE-LEDGER.md, CLAUDE.md]
tech-stack:
  added: []
  patterns:
    - "Two-org integration subject: assert the trigger's LIMIT-1 org differs from the thread's, plus a no-org_id control that lands in the wrong org"
    - "Zero-retrieval UAT row backed by a no-Expert positive control"
key-files:
  created:
    - backend/tests/integration/test_267_transcript_rows_rls.py
    - .planning/phases/267-an-expert-adds-scope/267-VALIDATION.md
    - .planning/phases/267-an-expert-adds-scope/267-UAT-LOG.md
    - .planning/phases/267-an-expert-adds-scope/evidence/ (00-10 .txt, g4-*.png)
  modified:
    - backend/app/dependencies.py (F-1, cdb173609)
    - frontend/src/components/experts/catalog/expertCatalog.ts (F-2, cdb173609)
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md
    - .planning/seeds/SEED-309-expert-surface-guards-that-cannot-fail.md
    - .planning/seeds/SEED-314-chat-rows-stamped-with-the-oldest-org-not-the-active-one.md
decisions:
  - "UAT subject U1 is single-org (clean Chrome drive); U2 is the D-267-34 two-org shape (trigger org C first, member of A)"
  - "A revoked 'Google Workspace' connection row was inserted locally so SC#2 exercises the research's revoked shape after the absent case was recorded"
  - "SC#5-retrieval's zero-row outcome is backed by a no-Expert positive control, not counted as a silent pass"
  - "SC#4 used its one permitted retry after a 502; both attempts are recorded"
  - "F-1/F-2 fixed inside the phase (RED first); F-3 is SEED-314; F-4 owed; F-5 by design; O-1 routed to SEED-303"
metrics:
  duration: "~5h wall (including a usage-limit pause and the orchestrator's Chrome drive)"
  completed: 2026-09-26
  tasks: 5
  commits: 8
---

# Phase 267 Plan 05: Live Proof and Phase Close Summary

PACK-21..25 were proven live as fresh users in a fresh local org, with a SQL or response quote for every row. A two-org real-RLS test proves that every row this phase writes lands in the thread's org. All 8 native providers plus OpenRouter used `web_search` + `workspace_write` on an Expert thread, and all 8 handoffs succeeded. The three G-4 scenarios passed in Chrome. Two UAT defects were fixed RED-first (F-1, F-2). The registers now record what shipped, what is owed and what was found.

## Commits

| # | Hash | Type | What |
|---|---|---|---|
| T1 | `36a52b851` | test | real-RLS two-org fence: org_id, handoff rollback, allowlisted read-back |
| T3a | `839d511bd` | docs | 267-VALIDATION.md, the 4-axis scoreboard, authored before the drive |
| T3b | `6b139e936` | docs | 267-UAT-LOG.md + evidence 00–09 (SC#1..SC#5, board, 4 axes) |
| F RED | `13856a7e9` | test | F-1 / F-2 failing tests (orchestrator) |
| F GREEN | `cdb173609` | fix | F-1 `feature_visible` refreshes settings; F-2 slug named from the service catalog (orchestrator) |
| T5a | `5e5a60696` | docs | G-4 rows, finding resolutions, O-1, screenshots |
| T5b | `8b0609c47` | docs | registers: 34 ledger rows + Phase 267 close section; CLAUDE.md cells |
| T5c | `53481b516` | docs | STATE, ROADMAP, SEED-309 / 303 / 314 |

## Task 1 — the RLS fence (TDD)

`pytest tests/integration/test_267_transcript_rows_rls.py -rs -q` → **`5 passed`** (0 skipped).
- Subject U is in two orgs. The fixture takes A as whatever the trigger's own `LIMIT 1` query picks, and B as the other org, never assumed.
- A control insert as U with no `org_id` lands in A. `_write_expert_change` and `write_handoff` run as U under `open_user_conn` + `assert_auth_uid`, and every row lands in B. The new thread inherits the folder, and the source keeps its Expert.
- When the third handoff INSERT violates the real `messages_role_check`, zero of the three rows remain. The test shows the first two INSERTs did execute before the failure.
- On U's RLS read, `_visible_transcript_rows` keeps the `expert_changed` row and drops `ask_user_prompt`.

**RED plant**
- The plant: the explicit `org_id` was removed from the event INSERT in `api/threads.py`.
- Result: `1 failed, 4 passed` — `AssertionError: expert_changed row org_id=b02dbc4b-… — expected the THREAD's org 30097f1f-…, not the trigger's b02dbc4b-…`.
- Restored with `git checkout -- backend/app/api/threads.py`; `git diff --quiet HEAD -- backend/app/api/threads.py` exit 0; re-run `5 passed`. No seeded row remains (SQL count 0/0/0).

## Task 3 — live results (details: 267-UAT-LOG.md)

| Row | Verdict |
|---|---|
| SC#10 board ×8 (openai `gpt-5.6-sol`, anthropic `claude-sonnet-5`, google `gemini-3.5-flash`, deepseek `deepseek-v4-pro`, zhipu `glm-5.2`, minimax `MiniMax-M3`, moonshot `kimi-k2.6`, openrouter `deepseek/deepseek-v4-pro`) | **8/8 PASS**. Each row cites its runs row with matching model/provider, both tools `done`, `/rate.md` in `workspace_files`, and a 201 handoff with 4–6 items |
| MT-1 / PT-1 / LM-1 | PASS / PASS (paired rows streamed concurrently, timestamps quoted) / PASS (6163-byte prompt) |
| SC#2 | PASS: admin `can_connect true`, member `false`; revoked row named "Google Workspace". It exposed F-1 and F-2 |
| SC#3 swap / reload / remove | PASS: one org-A event row, returned by two snapshot reads, then a "left" row |
| SC#5-count | PASS: preview **4** = SQL **4** (identical predicate, run under U1's RLS) |
| SC#5-retrieval | PASS as a zero-retrieval outcome: 0 documents, answer cites no Client ACME file. Positive control: with no Expert, the same question retrieved `ACME_MSA_2026.md` from Client ACME |
| SC#4 | PASS on the one retry; attempt 1 was **502** and wrote nothing (F-4) |
| D-267-34 live (two-org U2) | PASS for 267's rows; the send path's rows land in org C (F-3 = SEED-314) |

## Task 4 — G-4 (Chrome, the orchestrator)

G4-1, G4-2, G4-3, UI-catalog and UI-doubleclick all PASS. The orchestrator drove them in Chrome as `uat267-u1`. **Operator confirmation is OWED**: the run was autonomous, so no verbatim reply exists and none is invented. The member view of the catalog was skipped in Chrome. G4-2 discharged 267-04's owed live check: the event card appears exactly once after the refetch and after a reload. Screenshots are `evidence/g4-00` … `g4-04a`.

## Findings and their resolutions

- **F-1** — `feature_visible` read a cold per-worker settings cache, so an org-admin got `can_connect: false`. FIXED `cdb173609`, RED first `13856a7e9`. The 22 visibility-gate files ran 328 passed / 1 failed; the one failure, `test_182_validate::test_interactive_phase_verdict_is_incomplete_and_per_node`, is inherited.
- **F-2** — an absent connection was named by its slug. FIXED in the same commits: `connectionName` falls back to the curated service catalog.
- **F-3** — this is SEED-314. The live evidence is appended to the seed and the seed's status is unchanged.
- **F-4** — the handoff 502 is OWED/observed. It did not reproduce, and its cause is only in the backend log.
- **F-5** — BY DESIGN: migration 187 seeds Financial Analyzer as restricted.
- **O-1** — on a restricted → restricted swap, the `Dropped` line over-states the change. Routed to SEED-303.

## Final gates (verdict lines verbatim)

- **Backend unit** — `node scripts/check-backend-unit-baseline.cjs` → `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` (`71 failed, 5823 passed, 1 skipped, 2 xfailed, 2 xpassed`). The failed-SET diff against `267-BASELINES.md` is empty in substance. The one differing line is `test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool` with a `RuntimeWarning: coroutine 'handle_query_tables' was never awaited` concatenated onto the same id, the output artefact 267-01 and 267-02 also recorded. The F-1 test (`test_267_connection_overlay.py`) is inside `tests/unit` and passed.
- **Closed core** — `pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_255_extension_contract_guard.py tests/unit/test_267_connection_overlay.py tests/integration/test_267_transcript_rows_rls.py` → `42 passed`. Measured counts: executors **7**, emitters **1**, tools **29**, programmatic **2**.
- **Vitest** — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` → `total 8953 · failed 0 · pinned total 8202`, then `count gate OK — 336/336 pinned files present, no per-file decrease, 0 failing.`
  - In-scope per-file counts:
    - `expertCatalog.test.ts` 44 → **46 (+2)** (the F-2a/F-2b cases; the pin was not bumped)
    - `ExpertAuthoringStudio` 29
    - `ExpertDetailModal` 20
    - `InviteExpertDialog` 20
    - `ExpertCatalogPage` 19
    - `expertEventCopy` 19
    - `entitlementRefusal` 13
    - `ExpertEventCard` 10
    - `ChatArea.expertThread` 8
    - `MessageItem.transcriptEvent` 8
    - `ScopeLedger` 8
    - `ExpertCard.connection` 6
    - `HandoffCard` 3
    - `ChatLayout.startChat` 2
  - All of these are unchanged except `expertCatalog.test.ts` (+2).
- **Typecheck** — `npx tsc -p tsconfig.app.json --noEmit` → **70** errors. The set diff against the base set (line/column stripped) is empty in both directions.
- **Seeds** — `node scripts/check-seeds-register.cjs` → `seeds register gate OK — 325/325 parsed, 0 duplicate ids, 325/325 carry all 5 required keys.`
- **Registers** — `check-hot-file-ledger.cjs 267` → `ledger gate OK — every watched file has a row.`; `check-claude-md-size.cjs` → `claude-md size gate OK` with CLAUDE.md at **116,523** chars (was 118,795).

**Deploy parity:** no migration was written (`ls supabase/migrations | tail -1` → `196_documents_dedup_idx_org_scoped.sql`), there was no production write, no env var was added and the Supabase MCP was not used. The deploy-parity checklist for this phase is **code-only**.

## Deviations from Plan

1. **[Rule 3] A revoked Google connection fixture was added.** The UAT org had no Google connection at all, so SC#2 first recorded the absent case. A local `connector_connections` row (`revoked`, no secrets) then reproduced the research's revoked shape.
2. **[Rule 2, T-267-55] A positive control was added to SC#5-retrieval.** One extra cheap run proves the zero-retrieval result is caused by the scope and not by a broken query.
3. **SC#4 needed its one permitted retry.** The first attempt's 502 is recorded, and an in-process run was used to look for the cause.
4. **F-1 and F-2 were fixed inside this plan**, RED-first, by the orchestrator, on the coordinator's direction. Their commits are listed above and in the dependencies.py / expertCatalog.ts ledger rows.
5. **The ledger covers 34 files, not the plan's list.** `models/thread.py` and `scripts/vitest-count-gate.cjs` were touched by the phase, so all 34 files from `git diff --name-only 785c03274..HEAD` were re-derived. Six files crossed the G-5 threshold in 267 and are named as such.
6. **SEED-314 was edited** (a body evidence section only; frontmatter unchanged), on the coordinator's direction. That seed is outside the plan's `files_modified`.
7. A board driver bug (a `left()` call on the `bytea` column `content_inline`) broke only the evidence collector. All board evidence was re-derived from the DB with no provider re-run.

## Known Stubs

None.

## Observations for the verifier

- ROADMAP's progress row for **266** still reads `0/? Not started`. It is stale and was left untouched because it is outside this plan.
- The OpenRouter row used native tools on this box: the Model Registry DB overrides `native_tools` to `true`. The non-native OpenRouter path was not exercised.
- Answer content diverged across providers (2.50% / 2.25% / 2.00%). The pass bar was tool success, not answer accuracy.

## Self-Check: PASSED

- Files exist: `backend/tests/integration/test_267_transcript_rows_rls.py`, `267-VALIDATION.md`, `267-UAT-LOG.md`, `evidence/00…10 + g4-*.png`.
- Commits `36a52b851`, `839d511bd`, `6b139e936`, `13856a7e9`, `cdb173609`, `5e5a60696`, `8b0609c47` and `53481b516` are present in `git log`.
- The JWT-prefix grep (the plan's T-267-50 check) over the phase dir matches only three lines of `267-05-PLAN.md`: the plan's own grep command and its threat-register text. No evidence, log or summary file contains a JWT or either UAT password (checked).
