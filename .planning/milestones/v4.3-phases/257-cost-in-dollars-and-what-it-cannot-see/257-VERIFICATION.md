---
phase: 257-cost-in-dollars-and-what-it-cannot-see
verified: 2026-09-23
verification_mode: independent
verified_head: c6e29b42e
status: human_needed   # was gaps_found at independent verification; see the addendum at the end
score: 3/4 success criteria verified (SC#1 as an accepted PARTIAL by operator decision; SC#3 partial)
overrides_applied: 0
gaps:
  - truth: "SC#3 — a second conversion site added ANYWHERE makes a fence fail (METER-02)"
    status: partial
    reason: >
      The one-home half is now TRUE: F-13 is closed at f34106d5a. rates.py holds no arithmetic
      and interpolates pricing_service.cost_usd_sql(). The fence-half is only true for Python under
      backend/app/. Both detectors in test_257_single_token_conversion_home.py walk APP_DIR *.py
      only. A tokens*rate/1e6 written in frontend/src (which renders dollars) trips nothing. The
      fence's own comment at :63-66 says "A frontend counterpart fence is OWED". 257-REVIEW F-3 and
      257.1-FIXES "Still owed" record it too, with no routing and no operator decision. Today there
      are ZERO frontend conversion sites (measured by grep), so this is a missing guard, not a
      live defect.
    artifacts:
      - path: "backend/tests/unit/test_257_single_token_conversion_home.py"
        issue: "APP_DIR = backend/app; os.walk/rglob over *.py only (:16, :136, :192). The frontend is outside the fence."
    missing:
      - "A frontend fence (a vitest suite scanning frontend/src *.ts/*.tsx for per-million token arithmetic, e.g. /\\b(1_000_000|1000000|1e6)\\b/ next to a token/cost identifier), driven RED against a planted site and adopted into the count gate. About one new test file. /gsd:fast-sized under G-3, not a gap-closure round."
deferred: []
accepted_deviations:
  - truth: "SC#1 — every model the product can run has an input and output rate (METER-01)"
    decision: "Closed PARTIAL by operator decision: OpenRouter and self-hosted models stay unrated by design, each with a written reason"
    recorded_at:
      - ".planning/STATE.md:666-672 ('PHASE 257 CLOSE — 2026-09-19 ... SC#1 PARTIAL ... 14 stay unrated BY DECISION — 7 OpenRouter (a router has no single honest rate), 7 self-hosted (no API fee)')"
      - ".planning/ROADMAP.md:132 ('CLOSED 2026-09-19 with 2 of 4 SC fully met — a DECISION')"
      - "backend/tests/unit/test_257_1_every_model_has_a_rate.py:37-104 (UNRATED_BY_DESIGN + DB_ROSTER_UNRATED_BY_DESIGN, one reason per id)"
    correction: >
      The recorded figure "14 of 82" UNDERCOUNTS. Measured at HEAD on the live local DB, 26 of the 82
      roster models have no rate: the 14 db-only exemptions, plus the 12 code-roster exemptions
      already in UNRATED_BY_DESIGN (9 OpenRouter, 3 retired upstream). All 26 match the two
      reasoned dicts exactly. No model is unrated WITHOUT a reason, so the decision covers them, but
      the right figure is 26/82, not 14/82.
human_verification:
  - test: "Open /admin/spend from the operator rail and read the KPI row, the 'What This View Cannot See' card and the ledger for org 22f9c615"
    expected: "Total $28.3697. Rated 865, Unrated 321, No-tokens 345. The three gauge segments sum to 100%. 'View 321 Unrated Runs' filters the ledger to 321 rows. No figure reads $0.0000 for an unrated or unmeasured run."
    why_human: "The CR-06 / CR-07 / gauge / WR-08..12 fixes (2026-09-19), mig 185 and the F-13 SQL refactor (2026-09-23) all changed what this page renders. The only lived-experience pass on it was the operator's 257.1 session, BEFORE those changes. G-4 asks for a browser drive, and uat_257_scenarios.py drives the DB layer, not the page."
  - test: "Force a failed load (stop the backend) and open /admin/spend"
    expected: "An 'Unavailable' banner with Retry. No 'Tokens 0.0k', no 'Coverage 0%', no empty charts, no 100%-priced honesty card (CR-07)."
    why_human: "Visual state. The vitest cases mount it with a rejecting mock, not the real app."
  - test: "Open a chat thread whose runs mix a rated model, an unrated model (e.g. qwen3-coder:30b) and a rated-but-unmeasured run. Then open a workflow run page."
    expected: "Rated shows $x.xxxx in emerald. Unrated shows an amber 'Unrated' badge. Unmeasured shows 'No tokens recorded'. No coverage asterisk on chat messages."
    why_human: "The RunCard mounts (RunCard.tsx:409-457) have no rendering test. Only RunCostBadge in isolation is tested."
---

# Phase 257: Cost in Dollars, and What It Cannot See — Verification Report

**Phase Goal:** An operator can read spend **in dollars** per run and per org, through exactly one conversion, and the view states its own blind spots — so the first number anyone quotes is one that says what it does not include.
**Verified:** 2026-09-23 against HEAD `c6e29b42e` (includes F-13 fix `f34106d5a`)
**Mode:** independent. This verifier did not build or review this phase.
**Status:** gaps_found. One small gap (a frontend fence for SC#3), 3 human checks owed, SC#1 PARTIAL accepted by operator decision.
**Re-verification:** No. This is the first VERIFICATION.md for Phase 257.

## Goal Achievement — Success Criteria

| # | Success criterion | Status | Evidence (file:line at HEAD) |
|---|---|---|---|
| 1 | Every runnable model has an effective-dated input+output rate; a reprice adds a row; a past run's cost does not change | ⚠ **PARTIAL — ACCEPTED BY OPERATOR DECISION** | **Effective dating works.** `reprice_model` is INSERT-only and refuses a duplicate effective date with `RateAlreadyEffectiveError` → 409, never an upsert (`db/rates.py:279-337`, CR-05). The run page, chat and ledger all resolve the rate at the run's `started_at`, not `now()`: `workflow_runs.py:978-983`, `threads.py:410-418` via `resolve_effective_rate` (`rates.py:171-248`), and the SQL `mr.effective_from <= r.started_at` (`rates.py:378, 442, 496, 590`). A malformed `effective_at` refuses to price instead of falling back to `now()` (`rates.py:76-88, 193-204`, WR-11). `uat_257_scenarios.py::test_scenario_2_historical_rewrite` PASSED. **Coverage:** 56 of 82 roster models are rated. The other 26 are all exempted with a reason (see the correction under Accepted deviation). |
| 2 | An unrated model reads as **unrated** wherever cost is shown — never `$0.00`, never silently dropped from a total | ✓ VERIFIED | Python: no rate returns `cost_usd=None, is_rated=False` (`pricing_service.py:96-103`). SQL: `WHEN rate IS NULL THEN NULL` (`pricing_service.py:45`). The badge has 3 states and no `isRated` default (`RunCostBadge.tsx:44-82`). The summary counts unrated separately and only sums priced runs (`rates.py:390-400`). The honesty card names the unrated and unmeasured counts (`BlindSpotsCard.tsx:151-211`). A failed load gates every figure behind `hasData` (`AdminSpendPage.tsx:198`, CR-07). Live: every org's summary unrated count equals the ledger's `unrated` filter count (spot-check below). |
| 3 | Exactly one token→USD conversion, in one home; every caller goes through it; a second site added **anywhere** makes a fence fail | ⚠ **PARTIAL** | **One home: TRUE.** `pricing_service.compute_token_cost_usd` (`:81-131`) and its SQL spelling `cost_usd_sql()` (`:27-52`) come from the same `ONE_MILLION`/`QUANTIZE_FOUR_PLACES` constants. `rates.py:20` builds `_COST_USD_SQL = cost_usd_sql()` and interpolates it at `:370` and `:640`. `rates.py` contains no arithmetic: the fence regex finds 0 lines at HEAD vs **8 lines (4 copies) at `f34106d5a^`**, driven by me below. Python callers: `threads.py:421`, `workflow_runs.py:985`. Frontend: 0 conversion sites (grep). **Fence: backend Python only.** The AST detector (`test_…home.py:132-178`) and the text detector (`:187-199`) walk `backend/app/**/*.py`. A `.tsx` site is invisible, and the file says so itself (`:63-66`). → **gap** |
| 4 | An operator sees spend in dollars per **run** and totalled per **org**, and the view states what it cannot see (unrated runs; METER-06 gap) | ✓ VERIFIED (automated) · human check owed | **Per org:** `GET /admin/spend/{summary,runs,rates}` sits behind the operator gate (`admin.py:245-247` → `admin_spend.py`). The page is reachable from the rail (`ChatLayout.tsx:1009`, `NavPanel.tsx` operator entry, `App.tsx:152-153`). **Per run:** `WorkflowRunPage.tsx:1393-1396` and `RunCard.tsx:409-457` mount `RunCostBadge`. The producers stamp `cost_usd`/`is_rated` at `workflow_runs.py:968-1025` and `threads.py:376-428`, mapped at `lib/api/threads.ts:90-118`. **Blind spots:** the card lists unrated models, no-tokens runs, partial-coverage legs (METER-06's `token_coverage` marker, `rates.py:409-420`) and a SEED-300 residual (`BlindSpotsCard.tsx:151-260`). Live parity: summary and ledger agree in all 4 orgs, with 0 SQL↔Python mismatches. |

**Score:** 2 fully verified (SC#2, SC#4), 1 accepted PARTIAL by operator decision (SC#1), 1 partial gap (SC#3).

### Accepted deviation — SC#1 (operator decision, not a gap)

Recorded at `.planning/STATE.md:666-672`:

> *"**#1** every model has an effective-dated rate | ⚠ **PARTIAL** | … Coverage: the real roster is `MODEL_CAPABILITIES` (61, code) ∪ `model_capabilities_overrides` (51, DB) = **82**. Mig 184 closed the code half; mig 185 prices the 6 first-party DB-only ids. **14 stay unrated BY DECISION** — 7 OpenRouter (a router has no single honest rate), 7 self-hosted (no API fee)."*

The same decision is recorded at `.planning/ROADMAP.md:132` ("CLOSED 2026-09-19 with 2 of 4 SC fully met — a DECISION"). It is also encoded as two reasoned dicts in `backend/tests/unit/test_257_1_every_model_has_a_rate.py:37-104`.

⚠ **Correction to the recorded figure.** Measured at HEAD, the local DB (after mig 185) has code 61 + DB 51 = 82 in the union and **26 unrated, not 14**. The 26 are exactly `UNRATED_BY_DESIGN` (12: 9 OpenRouter, 3 retired upstream, each with a reason) plus `DB_ROSTER_UNRATED_BY_DESIGN` (14). No model is unrated without a written reason, so the decision covers all 26. But the "14 of 82" figure in STATE/ROADMAP/the audit understates the unrated set by 12.

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `supabase/migrations/183_model_rates.sql` | ✓ | table, RLS enabled (`:40`), select/insert policies (`:44`, `:52`) |
| `supabase/migrations/184_model_rates_complete_roster.sql` / `185_model_rates_db_roster.sql` | ✓ | 185 applied locally (`3a4520498`). Live `model_rates` = 59 rows / 59 models |
| `backend/app/services/pricing_service.py` | ✓ VERIFIED | the one home: Python + SQL spellings |
| `backend/app/db/rates.py` | ✓ VERIFIED | resolvers, summary, ledger, append-only reprice. No arithmetic of its own |
| `backend/app/api/admin_spend.py` | ✓ WIRED | mounted under `/admin/spend`, operator-gated |
| `frontend/src/pages/admin/AdminSpendPage.tsx` + `components/admin/spend/*` | ✓ WIRED | reachable via rail + deep link |
| `frontend/src/components/workflow/RunCostBadge.tsx` | ✓ WIRED | 2 mount sites, fed by 2 producers |
| `backend/tests/unit/test_257_single_token_conversion_home.py` | ⚠ PARTIAL | backend-only scope (see gap) |

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| AdminSpendPage KPI + BlindSpotsCard | summary counts / total | `get_org_spend_summary` SQL over `public.runs` ⋈ `model_rates` | yes: org 22f9c615 $28.3697 over 1186 runs | ✓ FLOWING |
| AdminSpendPage ledger | per-run rows | `get_spend_runs` | yes: 1186 rows, filters agree with summary | ✓ FLOWING |
| RunCostBadge in RunCard | `message.costUsd/isRated` | `threads.py` `_enrich_messages_with_runs` → `compute_token_cost_usd` | yes (batched rate history) | ✓ FLOWING |
| RunCostBadge on WorkflowRunPage | `run.cost_usd/is_rated` | `workflow_runs.py:968-1025` | yes | ✓ FLOWING |

## Behavioral Spot-Checks (commands run, literal result lines)

| Behavior | Command | Result | Status |
|---|---|---|---|
| 257 backend unit suites | `backend/venv/Scripts/python.exe -m pytest tests/unit/test_257_1_every_model_has_a_rate.py tests/unit/test_257_admin_spend_api.py tests/unit/test_257_pricing_service.py tests/unit/test_257_producer_cost_fields.py tests/unit/test_257_rates_db.py tests/unit/test_257_single_token_conversion_home.py -q -rs` | `38 passed, 3 warnings in 8.21s` (no skips; the Postgres parity case ran) | ✓ PASS |
| Fence + roster + G-4 DB scenarios, verbose | `… pytest tests/unit/test_257_single_token_conversion_home.py tests/unit/test_257_1_every_model_has_a_rate.py tests/uat_257_scenarios.py -v -rs` | all 4 fence cases PASSED incl. `test_sql_and_python_spellings_agree_in_postgres`; 4 roster cases PASSED; `test_scenario_1_the_free_lie` / `_2_historical_rewrite` / `_3_blind_spot_amnesia` PASSED. `11 passed, 1 warning in 1.97s` | ✓ PASS |
| SQL fence can fire (driven, no tree edit) | ran the fence's regex `_cost_per_million\s*/\s*[0-9]` over `git show f34106d5a^:backend/app/db/rates.py` and over HEAD `rates.py` | `old_rates.py offending lines: 8 [371, 372, 444, 445, 507, 508, 681, 682]` · `rates.py offending lines: 0 []` | ✓ PASS |
| 257 frontend suites | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/admin/spend/apportion100.test.ts src/components/workflow/RunCostBadge.test.tsx src/pages/admin/AdminSpendPage.test.tsx --maxWorkers=2` | `Test Files 3 passed (3)` · `Tests 33 passed (33)` | ✓ PASS |
| Live summary ↔ ledger ↔ Python parity at HEAD (read-only, local DB) | ad-hoc script: `get_org_spend_summary`, `get_spend_runs` (all/rated/unrated), then per-row `get_rate_for_model` + `compute_token_cost_usd` | `22f9c615 summary total 28.3697 rated 865 unrated 321 unmeasured 345 \| ledger total 1186 rated 865 unrated 321 sum 28.3697 \| SQL<->Python mismatches 0`. The other 3 orgs (0f5f702a, 4dd62c50, c1f18150) also agree with 0 mismatches | ✓ PASS |
| Roster coverage (read-only) | union of `MODEL_CAPABILITIES` and `model_capabilities_overrides` vs `model_rates` | `code 61 db 51 union 82 rated in roster 56 unrated 26` | ⚠ see SC#1 correction |
| Debt markers | `grep -nE "\bTBD\b\|FIXME\|XXX"` over the phase's source + migrations | no matches (exit 1) | ✓ |

No inherited failures came up in the targeted suites, so none needed proving at the base commit.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| METER-01 | 257-01, 257-02, 257-04 (+ migs 184/185) | Per-model effective-dated rate registry; an unrated model is visible as unrated, never free | ⚠ SATISFIED WITH ACCEPTED DEVIATION | Registry + append-only reprice + resolution at `started_at` all verified. The unrated arm verified (SC#2). 26/82 roster models are unrated by recorded operator decision (STATE.md:666-672), each with a reason |
| METER-02 | 257-01 (+ `f34106d5a`) | One token→USD conversion in one home, every caller uses it; a second site anywhere is the failure | ✓ SATISFIED (fence scope partial) | Exactly one home. SQL spelling generated there. 0 sites elsewhere in backend or frontend. Both Python callers route through it. Live SQL↔Python 0 mismatches. The frontend fence is owed (gap, SC#3) |
| METER-07 | 257-02, 257-03, 257-04 | Operator sees spend in dollars per run and per org; the view states what it cannot see (unrated, METER-06 gap) | ✓ SATISFIED (automated) · live browser pass owed | See SC#4. Human checks 1-3 below |

No orphaned requirements. REQUIREMENTS.md maps only METER-01/02/07 to Phase 257.

## Anti-Patterns / Residuals Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `backend/tests/unit/test_257_single_token_conversion_home.py` | 16, 136, 192 | fence scope = `backend/app/*.py` | ⚠ Warning (the gap) | a frontend conversion would not trip it |
| same | 187 | text regex matches only `_cost_per_million / <digit>` | ℹ Info | a SQL copy using a renamed alias column or `* 0.000001` would evade it. It does catch every spelling that existed |
| `backend/app/db/rates.py` | 376 vs 111 / 225 | SQL aggregate requires `mr.provider = r.provider OR mr.provider IS NULL`, while the Python resolvers treat a NULL run provider as "any provider" | ℹ Info (latent) | a run with NULL `provider` whose model has only provider-specific rates would read unrated in the ledger but priced on its own page. **Measured 0 such runs today** |
| `backend/app/db/rates.py` | 76-88 | a refused `effective_at` returns `None`, so the badge says "Unrated … no rate registered" | ℹ Info | never `$0.00` (SC#2 holds), but names the wrong cause for a malformed timestamp |
| `frontend/src/components/chat/RunCard.tsx` | 409-457 | cost mounts have no rendering test | ℹ Info | covered by human check 3 |
| 257-REVIEW F-4/F-5/F-7/F-15/F-33 | — | recorded tech debt (immutability by convention, legs≠total rounding, unbounded daily buckets, skipif'd UAT) | ℹ Info | already carried in `v4.3-MILESTONE-AUDIT.md` tech_debt. None falsifies an SC |

Review fixes checked in code, not taken from the reviews: CR-01 (rate at `started_at`), CR-02/CR-06 (`rated` means a rate exists; `unmeasured` counted separately, `rates.py:393-400`), CR-05 (409 on duplicate reprice, `rates.py:320-328`), CR-07 (`hasData` gate, `AdminSpendPage.tsx:198`), the gauge summing to 100 (`apportion100`, 33/33 vitest), WR-09 (batched rate history, `rates.py:135-168`, `threads.py:395`), WR-11 (refuse instead of `now()`), F-13 (`rates.py:20`). All present.

## Human Verification Required

1. **Spend page, live, after the post-review fixes.** Open `/admin/spend` from the rail. Expect $28.3697 / rated 865 / unrated 321 / no-tokens 345, a gauge summing to 100%, "View 321 Unrated Runs" filtering the ledger to 321 rows, and no `$0.0000` on an unpriced run. Why human: every change since the operator's 257.1 session (CR-06, CR-07, gauge, WR-08..12, mig 185, F-13) is unit-tested but has not been seen in the browser. G-4 asks for a browser drive.
2. **Failed-load state.** Stop the backend and open the page. Expect an "Unavailable" banner and Retry, with no false zeros and no all-clear honesty card.
3. **Run-level badges in chat and on a workflow run page.** Expect all three states (priced / Unrated / No tokens recorded) and no coverage asterisk on chat messages.

## Gaps Summary

The phase goal is substantively achieved. Dollars flow through one home and resolve at the run's own date. Per-run and per-org views agree with each other and with the Python arm across 1,194 live runs in 4 orgs. The view names what it cannot see. F-13 is genuinely closed at `f34106d5a`: the SQL expression now comes from `pricing_service`, and I drove the new text fence against the pre-fix file (8 offending lines).

**One gap remains.** SC#3 says a second conversion site added *anywhere* makes a fence fail, and the fence only watches backend Python. It is a missing guard, not a live defect: there are zero frontend conversion sites today. It is sized as one new test file (`/gsd:fast`), not a gap-closure round. It has been recorded as owed since 257-REVIEW F-3 with no routing and no operator decision. If the operator prefers to accept it rather than build it, record an override:

```yaml
overrides:
  - must_have: "a second conversion site added anywhere makes a fence fail"
    reason: "Fence covers backend/app Python, where all money arithmetic lives; frontend has no conversion site and renders server-computed figures only"
    accepted_by: "<operator>"
    accepted_at: "<ISO timestamp>"
```

**SC#1 is an accepted deviation**, not a gap. Correct its recorded count from 14 to **26 of 82** unrated (all reasoned).

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier, independent)_

---

## Addendum 2026-09-23 — gaps closed after this verification (v4.3 milestone close)

⚠ **These closures were made by the milestone-close orchestrator, not by this verifier.** Each was
driven RED-first and re-driven green with targeted suites; none has had an independent review
cycle. The verification above is left unedited, because it is what found them.

| Gap | Closed by | Proof |
|---|---|---|
| SC#3 — no frontend counterpart to the conversion fence | `856c09ea0` | `frontend/src/lib/api/__tests__/noFrontendTokenPricing.fence.test.ts` 3/3; RED against a planted conversion; token-count formatting not flagged; both gate knobs |
| F-13 (5 conversion sites) — closed before this verification ran | `f34106d5a` | as recorded above |

**Still owed (human):** the `/admin/spend` browser pass and run-level badge check listed under
`human_verification`. SC#1 remains an accepted PARTIAL by operator decision; note the verifier's
correction: **26** roster models are unrated by design, not 14.
