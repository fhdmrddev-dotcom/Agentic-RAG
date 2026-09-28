---
phase: 268-expert-spend-mid-thread-scope
plan: 02
subsystem: spend / metering (api + ui)
tags: [postgres, asyncpg, fastapi, react, vitest, metering, experts]

requires:
  - phase: 257
    provides: cost_usd_sql() — the one token->USD home; the /admin/spend cockpit and its CR-06/CR-07 honesty rules
  - phase: 268-01 (same wave, parallel)
    provides: migration 197 (runs.expert_id, runs.expert_attributed) — this plan's SQL READS those columns
provides:
  - one per_root CTE in db/rates.py feeding totals, daily, model donut, expert_breakdown, window totals, ledger rows and ledger COUNT
  - sub-agent roll-up into the root run (priced per member at its own rate) with the placeholder-root token rule
  - one validated `expert` param on GET /admin/spend/summary and /runs
  - expert_breakdown, window_total_usd, window_run_count, unpriced_subagents on the summary wire
  - /admin/spend Expert pills, statement line, Spend by Expert card + reconciliation footer, ledger Expert column + sub-agent tag, two Blind Spots tiles
affects: [268-04 real-Postgres proof of this SQL, 268-03 (shares expertThemeContrast.test.tsx), METER-08]

tech-stack:
  added: []
  patterns:
    - "One CTE text included by every spend query, so two regions of one page cannot be two dialects"
    - "Expert filter bound as $N and compared `expert_id::text = $N::text` — never interpolated, never `$N::uuid`"
    - "Placeholder-literal marker pinned by a writer-SET fence (the 256 forced_emit shape)"
    - "Client-side reconciliation in integer ten-thousandths as an independent check"

key-files:
  created:
    - backend/tests/unit/test_268_spend_rollup.py
    - backend/tests/unit/test_268_admin_spend_expert.py
    - frontend/src/components/admin/spend/expertSpendCopy.ts
    - frontend/src/components/admin/spend/ExpertFilterPills.tsx
    - frontend/src/components/admin/spend/ExpertSpendCard.tsx
    - frontend/src/components/admin/spend/AttributionDisclosures.tsx
    - frontend/src/components/admin/spend/__tests__/ExpertFilterPills.test.tsx
    - frontend/src/components/admin/spend/__tests__/ExpertSpendCard.test.tsx
    - frontend/src/components/admin/spend/__tests__/AttributionDisclosures.test.tsx
    - frontend/src/components/admin/spend/__tests__/expertSpendCopy.test.ts
  modified:
    - backend/app/db/rates.py
    - backend/app/api/admin_spend.py
    - backend/tests/unit/test_257_rates_db.py
    - frontend/src/types/spend.ts
    - frontend/src/lib/api/spend.ts
    - frontend/src/pages/admin/AdminSpendPage.tsx
    - frontend/src/pages/admin/AdminSpendPage.test.tsx
    - frontend/src/components/admin/spend/BlindSpotsCard.tsx
    - frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "268-02: the sub-agent roll-up SQL lives in db/rates.py beside the breakdown (D-268-15 one move) — one per_root CTE, one author"
  - "268-02: placeholder-root marker is the literal pair model='unknown' AND provider='unknown' (research option a), pinned by a 3-writer set fence; no new column"
  - "268-02: CR-06 rated/unrated/unmeasured keep their ROOT meaning — per_root exposes the root's own rate as input_cost_per_million so the ledger's is_rated reads the same column"
  - "268-02: incomplete_coverage_count follows the Expert filter through the THREAD (EXISTS over root runs in the workflow run's thread); unfiltered it is 257's figure exactly"
  - "268-02: a Spend by Expert line whose runs are all unpriced reports spend_usd null and renders '—' + the unrated chip, never a confident $0.0000; the synthesized zero-run No Expert line is a measured 0.0000"
  - "268-02: a selected Expert with no runs in the window keeps its pill and gets a $0.0000 row; the recon footer counts only server lines"

patterns-established:
  - "Spend leaves live under components/admin/spend/ and join the expertThemeContrast fence; AdminSpendPage/BlindSpotsCard's shipped dark-only classes stay (§9-D9)"

requirements-completed: [METER-08]

duration: ~95min
completed: 2026-09-28
---

# Phase 268 Plan 02: Expert Spend on /admin/spend Summary

**One `per_root` CTE now prices every run row (root and sub-agent) at its own rate through `cost_usd_sql()`, rolls it into its root and that root's Expert, and feeds every card, the Spend by Expert table, the window totals and the ledger — behind one validated `expert` filter that the whole cockpit follows.**

⚠ **ORG TOTALS NOW RISE, BY DESIGN (D-268-09):** sub-agent tokens and spend — which 257 excluded with a root-only predicate on every query — now count toward the run that started them and toward that run's Expert, so `/admin/spend` totals that include sub-agent work read higher than before; the Blind Spots card says so ("Sub-agent tokens now counted").

## Performance

- **Duration:** ~95 min
- **Tasks:** 3 / 3 (each RED → GREEN, 6 commits)
- **Files:** 20 (10 created, 10 modified) — exactly the plan's `files_modified`

## Base block (captured before the first edit, at `220c82dde`)

| Measure | Base |
|---|---|
| tsc `-p tsconfig.app.json --noEmit` | **70** errors, **62** unique (position-stripped) signatures; none in any spend file |
| `AdminSpendPage.test.tsx` | 26 |
| `expertThemeContrast.test.tsx` | 6 |
| `apportion100.test.ts` | 4 |
| `test_257_rates_db.py` | 12 |
| `test_257_admin_spend_api.py` | 5 |
| `test_257_single_token_conversion_home.py` | 4 |
| `test_257_pricing_service.py` | 8 |

(268-01 owns `268-BASELINES.md`; this plan did not write it.)

## Accomplishments

- **`db/rates.py`** — `_per_root_cte()` (roots → members → priced → per_root) is included by all six summary queries' spend half and by the ledger rows + COUNT. Roots are filtered by org + window + Expert; members are reached only through a root (no `m.org_id` predicate — Pitfall 7 / T-268-12); each member is priced with `cost_usd_sql("m", "rate")` at its own model/provider/`started_at`, with the rate's org taken from the root. The root-only predicate appears **once** in the file (pinned). The placeholder-root rule `SUM(tokens) FILTER (WHERE is_root OR NOT is_box_shell)` keeps a harness shell's box tokens from being double-counted while its USD still sums its priced sub-agents.
- **Expert filter** — `_expert_filter_sql("$N")` is one clause; the value is only ever a bound arg (test asserts a hostile value appears in args and never in SQL text). `expert_breakdown` + `window_total_usd` + `window_run_count` are computed with the filter bound to NULL (the navigator, D-268-10); `unpriced_subagents` counts unrated sub-agents under rated roots (D-268-25). The name join is `LEFT JOIN public.expert_bundles eb ON eb.id = ro.expert_id AND (eb.is_system OR eb.org_id = ro.org_id)` (T-268-11). `No Expert` is always a line; `Not recorded (before 268)` only when non-zero; missing join → `deleted: true`.
- **`api/admin_spend.py`** — `expert` Query on both routes with the uuid|none|unrecorded pattern (422 before the rates layer is awaited), lowercased before forwarding; four new summary keys, every 257 key unchanged.
- **Wire** — `ExpertSpendLine` + the new `SpendSummaryData` / `SpendRunItem` fields, mapped in `lib/api/spend.ts`; `expert` set only when given.
- **Cockpit** — `ExpertFilterPills` between Time and Coverage (overflow `More` above 6 Experts, selected overflow promoted, All + selected kept on load/failure); `filterPillClass` now styles all three pill groups (§9-D8); statement line + `clear`; KPI 1 `Spend · {name}`; chart/donut headers `· {name}`; `ExpertSpendCard` after the charts row with the integer-ten-thousandths recon footer and the D-268-23 rule line; ledger `Expert` column second (`LedgerExpertCell`), `incl. N sub-agents` tag, `filtered to {name}` header chip, filtered-empty sentence; Blind Spots grid `xl:grid-cols-3` with the two `AttributionDisclosures` tiles and the unpriced-sub-agents sentence in the unrated tile. **No `continued` tag** (D-268-24) — the only occurrence of the word is inside the required rule line.

## RED outputs (quoted)

- Task 1 `test_268_spend_rollup.py`: **`15 failed, 2 passed`**. The 2 that passed are the placeholder-writer SET fence and its reader-side companion — they pin source state that was already true at base (the three `model="unknown"` writers exist), which is what a fence is for; every behaviour test was red (`AttributeError: 'SpendSummary' object has no attribute 'expert_breakdown'`, `TypeError: get_spend_runs() got an unexpected keyword argument 'expert'`, SQL-shape assertions).
- Task 2 `test_268_admin_spend_expert.py`: **`20 failed`** (param ignored → `expert` kwarg absent; no 422; new keys missing).
- Task 3: **5 suite files failed to import + 17 page tests failed** (`Failed Tests 17`), including 7 pre-existing page cases that now read `spend-total-value`.

## Gate verdicts (verbatim)

- Backend Task-1/2 verify: `46 passed` (268 rollup + 257 rates_db/single_token_home/pricing/admin_spend_api), then `25 passed` (268 admin expert + 257 admin api).
- Targeted vitest: `Test Files 7 passed (7) · Tests 86 passed (86)`.
- Count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`, first run, no re-run):
  ```
    total                                      8280    9028    +748
    total 9028  ·  failed 0  ·  pinned total 8280
  count gate OK — 341/341 pinned files present, no per-file decrease, 0 failing.
  ```
  Per-file lines for this plan: `AdminSpendPage.test.tsx 36 36 0` · `ExpertSpendCard.test.tsx 19 19 0` · `expertSpendCopy.test.ts 9 9 0` · `expertThemeContrast.test.tsx 9 9 0` · `ExpertFilterPills.test.tsx 7 7 0` · `apportion100.test.ts 4 4 0` · `AttributionDisclosures.test.tsx 2 2 0`. The `+748` over the pinned total is other phases' unpinned suites (`RunHero`, `automationFacts`, … printed as `new`), not this plan.
- tsc set diff vs Base: **70 errors, added: (none), removed: (none)**.
- Backend baseline: `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)` — `71 failed, 5876 passed, 1 skipped, 2 xfailed, 2 xpassed`. The failed set, by file (no 257/268 spend suite among them): `test_061_consumer` 1 · `test_071_1_threadpool_sweep` 2 · `test_075_4_unknown_provider_error` 1 · `test_111_1_reembed_kickoff` 4 · `test_182_validate` 1 · `test_190_review_fix_data_layer` 1 · `test_200_1_phase_output_shape` 1 · `test_chat_tool_approval` 1 · `test_cross_worker_cancellation` 2 · `test_db_runs` 3 · `test_explorer_agent` 6 · `test_extraction_service` 2 · `test_forced_emit` 1 · `test_get_model_capability_inference` 1 · `test_lifespan` 3 · `test_module7_tools` 2 · `test_multimodal_query` 5 · `test_per_format_ingestion` 1 · `test_phase56_iteration_start` 1 · `test_published_workflow_ownership` 1 · `test_retrieval_service` 15 · `test_sandbox_service` 3 · `test_sql_service` 12 · `test_streaming_reliability` 1 (= 71; full node ids captured in the executor scratchpad for 268-03's diff against `268-BASELINES.md`).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/268-expert-spend-mid-thread-scope` → `ledger gate OK — every watched file has a row.`
- `git diff 220c82dde -- backend/app/services/retrieval_service.py` → empty (G-5 not fired; SEED-224 stays owed).
- Theme fence non-vacuity floor raised to **38** = 28 pairs in 267's six files (measured) + 10 in this plan's three leaves (measured).

## Acceptance greps

- `grep -c "cost_usd_sql(" backend/app/db/rates.py` ≥ 1 ✓ · `_cost_per_million / <digit>` in rates.py → none ✓
- `parent_run_id IS NULL` → exactly one line, inside `roots` ✓
- `grep -nE "f\".*expert|expert.*\{" backend/app/db/rates.py` → none ✓
- `grep -c expert backend/app/api/admin_spend.py` → 8 ✓
- Bare 50–400 hue steps without `dark:` in the three leaves → none ✓
- `test_257_rates_db.py` diff: only added lines, plus one `]` → `],` to append a list element; no assertion changed ✓

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 - Blocking] Seven existing `getByText("$148.6200")` loaded-signals scoped to the KPI element**
- **Found during:** Task 3 RED.
- **Issue:** with a realistic fixture the window total now legitimately renders twice (KPI 1 and the Spend by Expert `Org total` row), so an exact `getByText` would throw "multiple elements".
- **Fix:** KPI 1's value got `data-testid="spend-total-value"`; the seven signals now read `getByTestId("spend-total-value")).toHaveTextContent("$148.6200")` — the same value, asserted on the element it was always about. No other existing assertion changed; existing fixtures gained the new required fields.
- **Files:** `AdminSpendPage.test.tsx`, `AdminSpendPage.tsx` · **Commits:** `d95a650e1`, `4cc46a99d`

**2. [Rule 2 - Correctness] `incomplete_coverage_count` follows the Expert filter**
- UI-SPEC §5.6 says the Blind Spots counts follow the filter, but `workflow_runs` has no Expert column. The coverage query gained an `EXISTS` over root runs in the workflow run's thread, bound on the same `$N` filter; with the filter absent the arm never runs, so the unfiltered figure is 257's exactly. Commit `b5742b266`.

**3. [Rule 2 - Correctness] An unpriced Expert line renders `—`, not `$0.0000`**
- 257 CR-06's rule ("never a confident $0.00 for an unrated run") carried to the breakdown line. Pinned by `ExpertSpendCard.test.tsx` and `test_268_spend_rollup.py`.

None of these changed an architectural choice.

## Known Stubs

None. Every new element renders from server data (`expert_breakdown`, window totals, ledger attribution fields).

## Threat Flags

None beyond the plan's register. T-268-10 (bound param + 422), T-268-11 (org-constrained name join), T-268-12 (org predicate on roots only), T-268-13 (no new route; `require_operator` inherited), T-268-14 (one CTE + client recon), T-268-15 (placeholder rule + 3-writer set fence) and T-268-16 (names rendered as React text only) are each implemented and pinned by a test.

## Observations for 268-04 (not fixed here — out of scope)

- **This SQL needs migration 197.** `r.expert_id` / `r.expert_attributed` do not exist until 268-01's migration is applied; deploying this code before the migration would 500 every spend query. Deploy order: migration first.
- **The placeholder rule covers the three `model="unknown"` shells only.** The ask_user re-drive shell (`runs.py` ~:681) finalizes `ctx.producer_run_id` with the box totals; research traces that id to the resume shells, which are placeholders. 268-04's real-Postgres fixture should include one ask_user-resumed harness run to prove no real-model root carries a box that already sums its sub-agents.
- The real-PG proof that Σ lines = window total (deleted Expert, pre-268 row, sub-agent, placeholder shell) is 268-04 Task 1; the unit tests here pin SQL shape and plumbing only.
- `graphify update .` was not run from this worktree (it rewrites tracked `graphify-out/` files and would collide with the sibling worktree's merge); the orchestrator can run it once after the wave merges.

## Self-Check: PASSED

- Created files: all 10 present (verified below).
- Commits: `7fa074d5c`, `b5742b266`, `5906e2b32`, `cbf385781`, `d95a650e1`, `4cc46a99d` present in `git log`.
