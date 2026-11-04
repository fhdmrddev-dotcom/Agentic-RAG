---
phase: 305-connect-claude-code-and-cursor
plan: 03
subsystem: mcp-accountability
tags: [mcp, audit, rate-limits, spend, settings-knob, api-keys-ui]
requires:
  - "305-02: the three read tools, dispatch with marked limit / guard / audit slots, the MCP test harnesses"
  - "mig 222 applied locally: public.mcp_usage + app_settings.api_key_searches_per_minute"
provides:
  - "app/mcp/audit.py: one audit row per tools/call (api_key.read / api_key.refused, throttled refusals)"
  - "app/mcp/limits.py + rate_limit.check_key_limit: two independent per-key buckets with relayable sentences, fail closed"
  - "services/usage_sink.py + db/mcp_usage.py: search usage captured from embed_texts and written per call"
  - "db/rates.py: the mcp_usage leg of the one per_root CTE; ledger source / key / tool"
  - "the searches knob (api_key_searches_per_minute, 1..120) end to end"
  - "frontend: MCP key activity in honest words, the operator's third limit field, the key in the spend ledger"
affects: [305-04]
tech-stack:
  added: []
  patterns:
    - "dispatch sets ONE pending audit row per stage and writes it in finally — exactly one row on every exit path"
    - "a ContextVar usage sink opened by the MCP dispatcher, fed by the provider call (survives run_in_threadpool)"
    - "a second UNION ALL leg in the per_root CTE instead of a second spend dialect"
key-files:
  created:
    - backend/app/mcp/audit.py
    - backend/app/mcp/limits.py
    - backend/app/services/usage_sink.py
    - backend/app/db/mcp_usage.py
    - backend/tests/unit/test_305_audit.py
    - backend/tests/unit/test_305_limits.py
    - backend/tests/unit/test_305_settings_knob.py
    - backend/tests/unit/test_305_usage_sink.py
    - backend/tests/unit/test_305_spend_cte.py
    - backend/tests/integration/test_305_audit_live.py
    - backend/tests/integration/test_305_spend_live.py
    - frontend/src/components/settings/apiKeys/mcpCallWords.ts
    - frontend/src/components/settings/apiKeys/__tests__/mcpCallWords.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/ApiKeyActivity.mcp.test.tsx
  modified:
    - backend/app/security/api_key_auth.py
    - backend/app/security/mcp_principal.py
    - backend/app/mcp/dispatch.py
    - backend/app/mcp/server.py
    - backend/app/mcp/read_tools.py
    - backend/app/services/rate_limit.py
    - backend/app/services/openai_service.py
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/models/api_key.py
    - backend/app/api/api_keys.py
    - backend/app/db/rates.py
    - backend/tests/fixtures/phase293/api_keys_contract.json
    - frontend/src/lib/api/apiKeys.ts
    - frontend/src/lib/api/skills.ts
    - frontend/src/lib/api/spend.ts
    - frontend/src/types/spend.ts
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/components/settings/apiKeys/ApiKeyCard.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyActivity.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
    - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
    - frontend/src/components/settings/ApiKeyLimits.tsx
    - frontend/src/components/admin/spend/ExpertSpendCard.tsx
    - frontend/src/components/admin/spend/expertSpendCopy.ts
    - frontend/src/lib/api/__tests__/spendSummaryMapper.test.ts
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "A handler that answers with a refusal sentence (e.g. 'No document with that id is available to this key.') is audited outcome ok: the tool answered. outcome error is reserved for bad arguments and a handler that raised, so 'failed: the tool couldn't finish' is never said about an honest not-found."
  - "MCP call words live in a NEW sibling leaf mcpCallWords.ts, not in mcpKeyFacts.ts: mcpKeyFacts is copy-free by its 304 contract and fenced by its own test."
  - "dispatch takes an optional redis (defaults to app.dependencies.get_redis); the per-key counters and the refusal throttle share it."
  - "The mcp_usage NULL-token fallback row takes the member's embedding model and resolve_effective_embedding_provider; an entry recorded without a provider (embed_texts records none) is filled the same way."
  - "The ledger column header is reworded to 'Expert or key' per UI-SPEC; AdminSpendPage.tsx is untouched, and its test's header pin follows the copy."
requirements-completed: [KEY-07, GUARD-02]
duration: "~1 h 05 min"
completed: 2026-10-31
---

# Phase 305 Plan 03: Accountable MCP calls Summary

**Every MCP `tools/call` now leaves exactly one honest audit row naming the key, the tool and the outcome; two independent per-key buckets (reads, searches) refuse with a sentence the caller's model can relay and fail closed; and a search-only MCP session shows up in operator spend, attributed to the org and the key, through the one `per_root` CTE — then the member's key card, the operator's limits card and the spend ledger show it.**

## Tasks and commits

| # | Task | Commits |
|---|---|---|
| 1 | Per-call audit, the two buckets, the searches knob, the activity readback | `3c58ee294` (RED) · `f315d8c44` |
| 2 | Usage sink, the embed_texts hook, mcp_usage writes, the per_root CTE leg | `2a873a4f2` (RED) · `dda3eadff` |
| 3 | The member's key card shows MCP calls; the operator's searches field | `0b390e180` (RED) · `889bcaa21` |
| 4 | The key in the spend ledger; bookkeeping; full gates | `017c3d586` (RED) · `4e990683b` · `34c315a66` (tsc literals) · `09ca32711` (OpenAPI snapshot) · `65f4ef6bd` (ledger + CLAUDE.md + count-gate pins) |

## How each RED was driven

- Task 1: `test_305_audit.py` failed at collection (`McpPrincipal.__init__() got an unexpected keyword argument 'label'`); `test_305_limits.py` 7 failed (`cannot import name 'limits'`, no `check_key_limit`); `test_305_settings_knob.py` 8 failed (`KeyError: 'api_key_searches_per_minute'`); the contract arm and 4 `_call_from_audit` rows in `test_293_api_keys_routes.py` failed. The enforce_key_limit hash pin and the bucket-from-spec arm passed in RED by design (they are invariants).
- Task 2: `test_305_usage_sink.py` failed at collection (no `usage_sink`); all 7 `test_305_spend_cte.py` arms failed (no `mcp_usage` text in any spend SQL; `m.org_id` present in a rates.py comment).
- Task 3: 11 tests failed across 6 files (no `mcpCallWords` module, MCP keys had no strip, no `api-keys-limits-mcp`, no third limit field, reads hint unchanged).
- Task 4: 8 failed (no MCP arm, no copy keys, the mapper dropped the fields).

## Shipped

- **Reason vocabulary as shipped** (backend `app/mcp/audit.py` + `limits.py`, frontend `mcpCallWords.ts`): `api_key.refused` reasons `tool_not_granted` (tool named, or no `tool` key for an unknown name), `rate_limited:read`, `rate_limited:expensive` (`detail.limit`), `limiter_unavailable`, `maintenance`, with `outcome: "refused"`; `api_key.read` outcomes `ok`, `error` (`redaction_blocked` is 305-04's). Refusals go through `refusal_audit_slot`; a suppressed one writes nothing and the next row carries `detail.suppressed`.
- **One row per dispatch, on every path**: `dispatch` keeps a pending row per stage and writes it in `finally`; parametrised test over four paths plus each path's own test. No query text in any row (asserted on every unit row and the live rows).
- **Limits**: over the limit is `This key has made too many searches in the last minute. Try again in N seconds.` / `...too many reads...` as a tool error; Redis down is `UNAVAILABLE_DETAIL` as a tool error. Live: the second search with the knob at 1 is refused and audited.
- **Spend**: live, a search-only session of two searches wrote two `mcp_usage` rows (org, user, key, tool, model, provider, measured tokens), the summary's root count / window count / unrated count rose by 2, the embedding model shows Unrated (no `model_rates` row locally), No Expert rose by 2 and the lines reconcile with the window count; the ledger returns both with `source: mcp`, the key label, `mcp_tool: search_knowledge_base`, never coverage-complete. A search whose sink stayed empty wrote one row with `input_tokens` NULL.
- **A4 held**: a record made inside `run_in_threadpool` within `collecting()` is visible after it (`test_a_value_recorded_inside_run_in_threadpool_is_visible_after_it`).
- **test_268 pins**: **none changed**. The leg keeps `m.run_id = ro.run_id OR m.parent_run_id = ro.run_id` verbatim on the runs leg, `parent_run_id IS NULL` stays on one source line, the box-shell text is unchanged, and the ledger COUNT carries the same CTE and the new key join. One comment in rates.py was reworded (`m.org_id` -> "the member row's org") so the plan's `grep -c "m.org_id" = 0` holds; the 268 test checks generated SQL, which never had it.
- Frontend: MCP keys get the strip and Show activity (Time · Tool · Result; `✓ answered`, `✕ withheld: ...`, `✕ failed: ...`, `✕ refused: over the limit: 30 searches a minute`, `✕ refused: this key isn't allowed to use ...`); the member header line `Each AI tool key: {searches} searches and {reads} reads a minute. Set by your operator.`; the operator's third field `Searches per minute, per key` (1..120); the ledger cell `MCP · {label}` / `MCP · removed key`.

## Gate verdicts (verbatim)

- Backend baseline (final run, under the lock, after the snapshot fix): `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` Summary: `70 failed, 11188 passed, 1 skipped, 2 xfailed, 2 xpassed, 58 warnings in 750.34s (0:12:30)`. 70 = the measured base. The first run read `failed: 71 <= 71`; the one extra failure was `test_276_openapi_snapshot_fresh`, fixed in `09ca32711` (deviation 1).
- Vitest count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`, final run after the pins): `count gate OK — 593/593 pinned files present, no per-file decrease, 0 failing.` (total 13682, pinned 12642). The first run (before the spendSummaryMapper basename fix) also read `count gate OK — 593/593 ...`, but showed `spendSummaryMapper.test.ts pinned 2 actual 4`, which is what exposed the duplicate key (deviation 4).
- tsc (`npx tsc -p tsconfig.app.json --noEmit`): **61 errors = base 61**; none in any file this plan touched. The first run read 77; the 16 new were all `searches_per_minute` missing from two test literals (fixed in `34c315a66`).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/305-connect-claude-code-and-cursor`: `ledger gate OK — every watched file has a row.`
- `node scripts/check-claude-md-size.cjs`: `CLAUDE.md 108081 chars 72.1% of limit headroom 41919 [OK]` / `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- Targeted backend (Task 1 + 2 sets, the 305 unit suites, test_268_*, test_293_*, test_304_*, test_242, test_settings, embed_texts suites): all green. Live, under the lock: `test_305_audit_live`, `test_305_spend_live`, `test_305_tools_live`, `test_305_narrowed_tools_live` **19 passed**; `test_268_spend_rollup_pg`, `test_305_two_worker_stateless`, `test_305_refusals_live` **13 passed**; `test_304_narrowed_key_live` passed. No skips.
- Targeted frontend: `src/components/settings/apiKeys` + `ApiKeyLimits` + `src/pages/__tests__/SettingsPage*` **296 passed**; `src/components/admin/spend` + `src/pages/admin` **87 passed**.
- Acceptance greps: `user_settings.py` diff `+2 / -0`; `rate_limit.py` removes 0 lines; `md.get("kind") == "mcp"` in api_keys.py = 1; no change to `audit_service.py` and no new migration; `audit_key_call(` in mcp/audit.py = 0; `parent_run_id IS NULL` in rates.py = 1; `m.org_id` = 0; `FROM public.mcp_usage` = 2; usage_sink app imports = 0; openai_service removes 0 lines and has exactly 1 `usage_sink.record(`; `AdminSpendPage.tsx`, `admin_spend.py`, `SettingsPage.tsx`, `lib/api.ts`, `threads.py`, `agent_loop.py`, `dispatcher.py`, `config.py` unchanged; `isMcp` in ApiKeyCard 8 -> 6; apiKeyFacts `+4`; `source === "mcp"` in ExpertSpendCard = 1; no `| 0 / 0 / 0 |` row left for the four new backend files. Chat `_TOOL_REGISTRY` untouched (30).

## Deviations from Plan

1. **[Rule 1] OpenAPI snapshot regenerated.** The first full baseline read `failed: 71 <= 71`; the one failure above the measured base of 70 was `test_276_openapi_snapshot_fresh` (the new wire fields). Regenerated with `scripts/export-openapi.py` + `scripts/build-public-openapi.cjs` (`09ca32711`); the test is green.
2. **[Design] MCP call words in a new sibling leaf `mcpCallWords.ts`**, not in `mcpKeyFacts.ts`: that module is copy-free by its 304 contract, fenced by `mcpKeyFacts.test.ts` (`not.toMatch(/Copy"/)`). `apiKeyFacts.ts` delegates (+4 lines). New test file `mcpCallWords.test.ts` instead of extending `mcpKeyFacts.test.ts`.
3. **[Rule 3] Harness and neighbour tests.** `_mcp305_harness.py` gained `stub_accounting` / `stub_usage` (fake Redis, settings defaults, an audit recorder, a usage recorder) called from `stub_edge`, and `test_305_dispatch.py`'s two direct-dispatch arms call it; `phase305_mcp_client.mcp_session` points the dispatcher's Redis at its fake and the audit writer at the local stack; `phase304_fixtures.World.cleanup` deletes the world's `mcp_usage` rows. `test_242_settings_bounds_have_schema_constraints.py` lists the new bound (a new bound is a decision) and `test_settings.py`'s stub carries the field (the response requires it). `OrgApiKeysTab.test.tsx` and `apiKeyFacts.test.ts` limits literals gained `searches_per_minute` (tsc, `34c315a66`).
4. **[Plan adjustment] The ledger mapper tests went into the EXISTING `src/lib/api/__tests__/spendSummaryMapper.test.ts`** (pin raised 2 -> 4). The plan's path `components/admin/spend/__tests__/spendSummaryMapper.test.ts` was created first and then removed: the count gate pins by basename, so a second file of that name silently overwrote the 268 pin (measured: the gate read `pinned 2, actual 4`).
5. **[Plan adjustment] `AdminSpendPage.test.tsx` one-line header pin** follows the UI-SPEC rewording of `ledgerColumn` to `Expert or key`. `AdminSpendPage.tsx` itself is untouched (D-55).
6. **[Decision] A handler's refusal sentence is audited `outcome: ok`** (the tool answered), so a not-found document never reads "failed".
7. **[Plan text vs base] `grep -c "import" mcpKeyCopy.ts` = 0 cannot hold**: the 304 docblock already says "it imports nothing" (2 at base). The leaf property is held by the line-anchored check in `apiKeyFacts.test.ts` (no `^import` line), which passes.
8. **[Scope] The live readback asserts `list_key_calls` -> `_call_from_audit`** (the composition `GET /api-keys` serves) rather than an authenticated HTTP `GET /api-keys`, and the "run row reads source run" ledger arm is a unit test (the 304 world seeds no runs).
9. **[Note] `test_293_key_auth.py` was not extended**: its plan arms (`_audit_args` byte-identity, off-loop client build, principal label) live in `test_305_audit.py`.

## Threat surface

No surface beyond the register. T-305-12 (one row per path, throttled refusals, counted suppressions), T-305-13 (shared Redis buckets, fail closed, separate expensive bucket), T-305-14 (mcp_usage per search, NULL fallback, one CTE), T-305-28 (one ok expression; frontend never ticks a non-ok call), T-305-29 (no query text in any audit row, asserted), T-305-30 (org-constrained key join; org explicit on insert), T-305-31 (client built off the loop, tested) are implemented and tested.

## Known Stubs

None. `redaction_blocked` is worded and read back, and 305-04 is the plan that writes it.

## Owed

- **G-4 row 3 (D-42) at phase verification**: an answered MCP search reads `search_knowledge_base · ✓ answered` on the key card and Last used moves; an over-limit search reads `✕ refused: over the limit: {N} searches a minute` with the tall bar; Admin -> Spend shows `MCP · {label}` and `▲ Unrated`.
- `graphify update .` in the main checkout after merge.
- Cloud: no new migration in this plan (mig 222 is 305-01's); the deploy-time paste order is unchanged.

## TDD Gate Compliance

RED before GREEN for every task: `3c58ee294` -> `f315d8c44`, `2a873a4f2` -> `dda3eadff`, `0b390e180` -> `889bcaa21`, `017c3d586` -> `4e990683b`.

## Self-Check: PASSED

- Created files exist: backend/app/mcp/audit.py, backend/app/mcp/limits.py, backend/app/services/usage_sink.py, backend/app/db/mcp_usage.py, frontend/src/components/settings/apiKeys/mcpCallWords.ts and every test file listed in key-files.
- Commits present on the branch: 3c58ee294, f315d8c44, 2a873a4f2, dda3eadff, 0b390e180, 889bcaa21, 017c3d586, 4e990683b, 34c315a66, 09ca32711, 65f4ef6bd.
- The only file deletion is this plan's own `components/admin/spend/__tests__/spendSummaryMapper.test.ts` (deviation 4).
- The local-DB lock is released; no spawned uvicorn remains (the live harness kills its process tree); the operator's :8000 server was not touched.
- `scripts/vitest-count-gate.cjs` measures `411 / 87 / 6944` after the bookkeeping commit, the triple its rows carry.
