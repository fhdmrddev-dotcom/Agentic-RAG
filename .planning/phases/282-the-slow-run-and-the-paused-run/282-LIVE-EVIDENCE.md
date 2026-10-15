---
phase: 282-the-slow-run-and-the-paused-run
plan: 03
type: live-evidence
status: pending
created: 2026-10-15
merged_sha: 3c9bb11ab
---

# Phase 282 — Live evidence

Rows are defined in `282-VALIDATION.md` (authored before the drives). Every row below is filled with
pasted DOM / DB reads and run ids, or marked ⛔ / OWED with a reason — none is left blank at close.
No tokens, keys or document content are written here (T-282-15): run ids, counts, option names and
rendered sentences only.

## Merged-tree gates (Task 1, at `3c9bb11ab`, ledger commit `f3846d354`)

Recorded here so the continuation agent that writes `282-03-SUMMARY.md` has the verdict lines on disk.
Evidence files: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-282/` (`*_03*`).

- **Backend unit baseline** (`baseline_merged_03.log`, under the local-DB lock): `71 failed, 7508 passed, 1 skipped, 2 xfailed, 2 xpassed` · `Errors: 0` · `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)`. Failing SET vs `base_failed_d1ba70553.txt`: identical (71 = 71). The only `comm -3` line is the known log artifact — `test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results` with a RuntimeWarning glued onto the line (the same id is in the base set).
- **Root/integration set** (`root_merged_03.txt`): `12 failed, 44 passed` — the same 12 failure names as 282-01's HEAD run and as base (11 integration tests in `root_base_d1ba70553.txt` + the base-measured `test_196::test_emit_tier_joined_the_patch_allowlist`). `comm -3` on failure names: empty.
- **test_282_*** (4 files): `63 passed`.
- **Closed core** (`test_255_extension_contract_guard.py` + `test_259_closed_core_inventory.py`): `13 passed` — 7 phase types / 1 emitter / 30 tools unchanged.
- **Vitest count gate** (one run, repo root, `GSD_VITEST_MAX_WORKERS=2`; report `vitest_gate_282-03.report.json`): `count gate OK — 436/436 pinned files present, no per-file decrease, 0 failing` · `total 10300 · failed 0`. `WorkflowBuilderPage.canvas.test.tsx` 154/154 passed this run — the 282-02 load-timing red did not recur (one green sample; not proof the flake is gone). `ModelRegistryTab.test.tsx` measured **33** → pin raised 29 → 33 in `f3846d354`; re-gated against the same report: OK, pinned total 9431.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`, `tsc_merged_03.txt`): 103 lines; `comm -13` against each base file (`tsc_base_d1ba70553_01.txt`, `_02.txt`, sorted, duplicates kept) prints nothing. ⚠ A `sort -u` union of the two base files collapses duplicate continuation lines and falsely shows 11 "new" lines — compare as multisets.
- **Migrations:** `ls supabase/migrations | tail -1` → `206_retention_hold_hardening.sql` (none added).
- **Ledger gates:** `check-claude-md-size.cjs` exit 0 (92,607 chars); `check-hot-file-ledger.cjs 282` exit 0 (542 rows, 20 watched); `grep -c "provider_gateway/google.py" CLAUDE.md` = 1.
- **Seeds sweep** (`seeds_282-03.txt`): `seeds register gate OK — 361/361 parsed`; 37 `[trigger-fires]` path matches. Routing: SEED-172 → Task 3 on evidence (not path-matched by the sweep; folded by CONTEXT); SEED-289 → stays `deferred` per CONTEXT; every other match (SEED-027, 040, 052, 053, 054, 079, 177, 185, 188, 192, 194, 198, 249, 273, 280, 284, 287, 288, 291, 299, 300, 301, 303, 304, 308, 310, 314, 319, 323, 324, 327, 328, 334, 339, 346, 350) left unmodified — "path match only; 282 changed no subject of this seed". SEED-308 (Registry fields not read at runtime) names `max_tools` / `reasoning_off`, not the timeout; SEED-327 (forced_emit `system_prompt` dropped by the OpenAI-compat / Responses adapters) — 282 touched those adapters only to forward `timeout_s`.

## Operator setup (Task 2)

*(pending — the operator's reply is recorded here verbatim: backend sha, LM Studio model, keyed
providers, active org, row-6 decision)*

## Pre-drive proofs

- Backend sha the app is running: *(pending)*
- Active org (DOM switcher text + membership read): *(pending)*

## SC#10 board (D-16)

| # | Provider | Model | Axis | Thread / run ids | Run status | Final message names Blue | `runs.error` | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | multi-tool | pending | pending | pending | pending | pending |
| 2 | Anthropic | `claude-sonnet-5` | parallel-thread A | pending | pending | pending | pending | pending |
| 3 | Google | `gemini-3.5-flash` | parallel-thread B | pending | pending | pending | pending | pending |
| 4 | DeepSeek | `deepseek-v4-pro` | long-message (≥ 5 KB) | pending | pending | pending | pending | pending |
| 5 | Zhipu | `glm-5.2` | — | pending | pending | pending | pending | pending |
| 6 | MiniMax | `MiniMax-M3` | — | pending | pending | pending | pending | pending |
| 7 | Moonshot | `kimi-k2.6` | — | pending | pending | pending | pending | pending |
| 8 | OpenRouter | `z-ai/glm-5.2` | — | pending | pending | pending | pending | pending |

- Multi-tool tool events (row 1): *(pending)*
- Parallel-thread timestamps (A ask created / B completed / A answered / A completed): *(pending)*
- Long-message prompt byte length (row 4): *(pending)*
- A1 LangSmith nesting: *(pending)*

## G-4 rows (D-17)

### G4-1 — Deep pause, panel open (sketch 282 variant A)

*(pending)*

### G4-2 — Workflow pause, panel on the rail (BUG-260828-07)

*(pending)*

### G4-3 — Two threads paused at once

*(pending)*

### G4-4 — Slow local model past 600 s (D-26)

*(pending)*

### G4-5 — Registry refusal on screen (SC#1 live)

*(pending)*

### G4-6 — The timeout sentence (optional, needs approval)

*(pending)*

## Operator sign-off

*(pending — Task 4)*
