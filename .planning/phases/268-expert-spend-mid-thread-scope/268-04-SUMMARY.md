---
phase: 268-expert-spend-mid-thread-scope
plan: 04
subsystem: live proof + closeout (metering / chat scope)
tags: [METER-08, CHAT-08, UAT, real-postgres, SC10-board, registers, seeds, prod-parity]
status: checkpoint — Task 4 (G-4 ×3 in Chrome, both themes) awaits the operator
requires:
  - phase: 268-01
    provides: runs.expert_id / expert_attributed (migration 197), org + Expert stamps, Continue accumulation
  - phase: 268-02
    provides: the one per_root CTE, the expert filter, expert_breakdown + window totals, the cockpit
  - phase: 268-03
    provides: PATCH folder arm + scope_changed event, ScopeEffect route, search.query audit run keys, chip/picker/card
provides:
  - real-Postgres reconciliation of the spend SQL (test_268_spend_rollup_pg.py)
  - 268-UAT-LOG.md + evidence/ (SC#1-SC#4, the 8-row SC#10 board, MT/PT/LM)
  - 268-PROD-PARITY.md (migration 197 before the backend, approval-gated)
  - seed answers (286, 314, 297, 303) and three new seeds (319 F-1, 320 non-run metering, 321 light theme)
  - hot-file ledger Phase 268 CLOSE + CLAUDE.md G-5 cells; STATE + ROADMAP
affects: [268 verification, the independent review, the next phase touching AdminSpendPage.tsx / agent_loop.py]
tech-stack:
  added: []
  patterns:
    - "Independent money check: rates picked and priced in Python (compute_token_cost_usd), compared with the API in integer ten-thousandths"
    - "A fixed UAT recipe is applied unchanged; a clearly-labelled variant turn measures the property the fixed recipe could not reach"
key-files:
  created:
    - backend/tests/integration/test_268_spend_rollup_pg.py
    - .planning/phases/268-expert-spend-mid-thread-scope/268-UAT-LOG.md
    - .planning/phases/268-expert-spend-mid-thread-scope/268-PROD-PARITY.md
    - .planning/phases/268-expert-spend-mid-thread-scope/evidence/ (16 files)
    - .planning/seeds/SEED-319-a-scope-change-does-not-reach-the-models-history.md
    - .planning/seeds/SEED-320-meter-non-run-llm-calls.md
    - .planning/seeds/SEED-321-admin-spend-light-theme.md
  modified:
    - .planning/phases/268-expert-spend-mid-thread-scope/268-VALIDATION.md
    - .planning/seeds/SEED-286-a-thread-s-folder-scope-cannot-be-changed-once-it-starts.md
    - .planning/seeds/SEED-314-chat-rows-stamped-with-the-oldest-org-not-the-active-one.md
    - .planning/seeds/SEED-297-boot-reconciler-nulls-cap-paused-token-totals.md
    - .planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - "268-04: drove in the operator-named org (fhdmrd's, 22f9c615) and authored the missing fixtures there through the API, rather than reusing 267's UAT org"
  - "268-04: the SC#10 fixed recipe was applied unchanged (7 rows blocked); a labelled variant turn measured retrieval scope separately (8/8)"
  - "268-04: F-1 (follow-up answered from history cites the dropped folder) recorded and seeded (SEED-319) for an operator decision, not fixed"
  - "268-04: research Q9 refuted by data (two Deep runs at continues_used=3, sole writer runs.py:1107), so no Q9 seed"
metrics:
  duration: "~2h45m"
  completed: 2026-09-28
  tasks: "3 of 5 executed + Task 2 operator-resolved; Task 4 = checkpoint"
---

# Phase 268 Plan 04: Live proof + closeout — Summary

**The spend SQL reconciles on real Postgres with every awkward row shape present; live in the operator's org, all
five Spend by Expert lines equal an independent Python sum to the ten-thousandth and every filter moves every card
together; a mid-thread scope change writes one event, survives reload, and every SEARCHING run afterwards reads only
the new subtree on all 8 providers. What does NOT hold: on a same-prompt follow-up, 6 of 8 providers answer from history
and cite the dropped folder's document (F-1, SEED-319).**

⏸ **Stopped at Task 4 (checkpoint:human-verify).** G4-1 / G4-2 / G4-3 need the operator's Chrome pass on both themes —
this session had no Chrome DevTools MCP tools. Task 5's closeout was done ahead of the reply; only its step (1) (append
the operator's reply verbatim as rows G4-1..3) remains for the continuation.

## Tasks

| Task | Status | Commit |
|---|---|---|
| 1 Real-PG reconciliation of the spend SQL | DONE (RED plant quoted) | `6fd38f39a` |
| 2 Operator brings the stack up | RESOLVED by the operator before spawn: *"stack up, org = fhdmrd@gmail.com"*; probes re-measured (below) | — |
| 3 Drive SC#1-SC#4 + SC#10 board + MT/PT/LM | DONE | `395d330d1` (roster, before any drive), `da142f6dd` (UAT log + evidence) |
| 4 G-4 in Chrome, both themes | **CHECKPOINT — awaiting the operator** | — |
| 5 Closeout | DONE except step (1) | see Commits |

## Task 1 — RED / GREEN (quoted)

`test_268_spend_rollup_pg.py` passed on its first run against the real SQL (the feature already existed; this is a
fence), so the plan's plant is the RED: removing the placeholder-shell token `FILTER` from `per_root` →
```
E       AssertionError: shell line double-counted: 160 (want 100)
3 failed, 6 passed, 1 warning in 1.70s
```
Restored; `git diff --quiet HEAD -- backend/app/db/rates.py` → exit 0. Both suites on the merged tree:
`pytest tests/integration/test_268_spend_rollup_pg.py tests/integration/test_268_two_org_rows.py -rs` → **`14 passed`**
(0 skipped). All money comparisons are integers of ten-thousandths.

268-02's request (an ask_user-resumed harness root in the fixture) was answered on the live DB instead: all **196**
real-model roots on harness threads with sub-agents have `input_tokens IS NULL` — no real-model root carries a box.

## Task 2 — preflight (quoted)

`/health` 200 · unauthenticated `/threads/<0-uuid>/scope-effect` **403** · Vite 200 · one listener on :8000 (PID 23176).
Org `22f9c615-0eec-440a-8804-ed4784d6f57f`: tier `enterprise`, `tier_capabilities(enterprise, experts, enabled)`;
`operator_users` row present; `GET /admin/me` 200. ⚠ The dev account is in **ONE** org today (memory said two).
`backend/.env` is unreadable to this agent, so provider keys were proven by completed runs, not listed.

## Task 3 — verdicts (full rows in `268-UAT-LOG.md`)

| Row | Verdict |
|---|---|
| SC#1-attribution / reconcile / subagent / filter / recon-footer figures | **PASS** — 5 lines API = independent; Σ 408,678 = window 40.8678 = independent; 1,238 runs |
| SC#1-continued | **OWED-manual** — cap not reached in two explorer attempts; unit RED + real-PG row named |
| SC#2 | **PASS** — none 38, unrecorded 1,191, empty window none = 0.0000 |
| SC#3-event / reload / retrieval | **PASS** (reload's provider-request half via the real `_reconstruct_history`, substitution named) |
| SC#4-biased / restricted / authz | **PASS** (biased on UAT-265 Billing SOP Advisor — Financial Analyzer is Restricted) |
| SC#10 board, fixed recipe | **1 PASS (moonshot) · 7 ⛔ SEED-319** — turn 2 did not search after one retry |
| SC#10 variant fresh-search turn | 8 / 8 retrieve only Q3 Contracts (not a pass-bar substitute) |
| MT-1 · PT-1 · LM-1 | **PASS** · **PASS** · **PASS on the one retry** |
| G4-1 · G4-2 · G4-3 | **awaiting the operator** |

## Final gates (verbatim)

**Backend unit** (`node scripts/check-backend-unit-baseline.cjs`, in `backend/`):
```
71 failed, 5950 passed, 1 skipped, 2 xfailed, 2 xpassed, 49 warnings in 317.54s (0:05:17)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
Failed SET vs `268-BASELINES.md` (71 ids): **NEW = [] · GONE = []**. 0 collection errors.

**Closed core** (`pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_255_extension_contract_guard.py`):
`13 passed`. Targeted 268 unit suites (insert_run stamp/sites, spend rollup, scope patch): `51 passed`.

**Vitest count gate** (repo root, `GSD_VITEST_MAX_WORKERS=2`, first and only run):
```
  total                                      8341    9089    +748
  total 9089  ·  failed 0  ·  pinned total 8341
count gate OK — 345/345 pinned files present, no per-file decrease, 0 failing.
```
In-scope pins, each `pinned current delta`: `AdminSpendPage.test.tsx 36 36 0` · `expertEventCopy.test.ts 26 26 0` ·
`ExpertSpendCard.test.tsx 19 19 0` · `ScopePicker.test.tsx 15 15 0` · `ExpertEventCard.test.tsx 14 14 0` ·
`expertThemeContrast.test.tsx 13 13 0` · `scopeCopy.test.ts 13 13 0` · `ScopeLedger.test.tsx 11 11 0` ·
`ChatArea.scopeChange.test.tsx 9 9 0` · `expertSpendCopy.test.ts 9 9 0` · `ExpertFilterPills.test.tsx 7 7 0` ·
`ScopeChip.test.tsx 7 7 0` · `apportion100.test.ts 4 4 0` · `AttributionDisclosures.test.tsx 2 2 0`.
⚠ The base's inherited red (`sketchComposition.test.tsx` ×2, frozen in `268-BASELINES.md`) was green on this one run —
an observation, not proof it is fixed. This plan touched no frontend file (`git diff --name-only 6fd38f39a~1..HEAD --
frontend/` → 0).

**tsc** (`npx tsc -p tsconfig.app.json --noEmit`): **70 → 70**. Set diff vs `268-BASELINES.md`: only
`src/lib/api.ts:254/255` → `:260/261` (the same two pre-existing TS2724/TS2305, moved 6 lines by 268-03's re-exports);
position-stripped the set diff is **empty**.

**Registers:** `node scripts/check-hot-file-ledger.cjs 268` → `ledger gate OK — every watched file has a row.` ·
`node scripts/check-claude-md-size.cjs` → `CLAUDE.md 117178 chars 78.1% of limit … [OK]` (under the 120,000 warn band) ·
`node scripts/check-seeds-register.cjs` → `seeds register gate OK — 328/328 parsed, 0 duplicate ids, 328/328 carry all 5
required keys`; unswept: **`134 carry no trigger_when at all`** and **`114 carry prose but no structured trigger`** (two
figures, never summed).

**Untouched hot files:** `git diff 220c82dde -- backend/app/services/retrieval_service.py
frontend/src/components/chat/MessageItem.tsx` → **empty** (G-5 not fired; SEED-224 extraction stays owed).

`graphify update .` ran on the main tree (34,037 nodes); `graphify-out/` left uncommitted (the operator's).

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 - Blocking] Drive session and fixtures in the operator-named org.** The org holds no Client ACME /
Q3 Contracts / HR Policies and no HR Advisor (267 built them in a separate UAT org whose user's password is gone). They
were authored through the API in the dev org, every write listed in the UAT log. The session was opened with local
GoTrue `admin/generate_link` + `verify` (no password read or changed; token in the scratchpad only).

**2. [Rule 1 - Harness bug, own script] jsonb decoded as text.** The first board row's scope check iterated a JSON
string's characters; the scratchpad helper gained a jsonb codec and the verdicts were recomputed from the DB. Not product
code.

**3. [Plan check defect] Task 3's `! grep -rn "eyJ" <phase dir>` cannot pass as written** — its only matches are the
PLAN file's own mentions of the string. Verified instead over every non-PLAN file: **0 hits**.

**4. [Named substitution] SC#3-reload's provider-request half.** No backend log (the console is the operator's; the
`uvicorn.*.log` files are from 2026-09-03) and no LangSmith key access. The real `_reconstruct_history` over the
thread's DB rows was used and named as the substitute.

**5. [Fixture substitution] SC#4-biased** ran on UAT-265 Billing SOP Advisor: Financial Analyzer's bundle is
`restricted`, not Biased (the same fact 267 recorded).

### Not done / owed

- Task 4 (G-4 ×3, both themes) — the checkpoint below.
- SC#1-continued live.
- Task 5 step (1) — the operator's reply appended verbatim to 268-UAT-LOG.md as G4-1..3.

## Findings

- **F-1 → SEED-319.** After `/Client ACME` → `/Client ACME/Q3 Contracts`, a same-prompt follow-up is answered from
  history by anthropic, google, deepseek, zhipu, minimax and openrouter, citing `ACME_MSA_2026.md` (dropped folder);
  deepseek labelled both documents *"under /Client ACME/Q3 Contracts"*. Mechanism: the event never reaches the model (by
  design) while the system prompt's folder note names the new folder. Retrieval is correct whenever a search runs. An
  operator design decision, not a defect this plan may fix.
- **Q9 refuted by data**: two Deep runs read `continues_used = 3`; the only writer is `runs.py:1107`. No seed.

## Known Stubs

None — this plan added a test, evidence and registers only.

## Threat Flags

None. No product code changed. T-268-30 (no token in evidence: 0 non-PLAN `eyJ` hits; session in the scratchpad),
T-268-31 (every board row cites runs rows whose model/provider match), T-268-32 (a turn without `search_documents` was
never scored PASS), T-268-33 (independent Python sum), T-268-34 (every setup write listed) and T-268-35 (no production
call of any kind) are met.

## Self-Check: PASSED

- FOUND: `backend/tests/integration/test_268_spend_rollup_pg.py`, `268-UAT-LOG.md`, `268-PROD-PARITY.md`,
  `SEED-319/320/321`, `evidence/` (16 files).
- FOUND in `git log`: `6fd38f39a` (Task 1), `395d330d1` (roster), `da142f6dd` (Task 3). The closeout commit is the one
  that adds this file.
- `268-PROD-PARITY.md` contains `get_advisors` and "explicit per-action operator approval"; STATE.md carries the
  Phase 268 guardrail block.
