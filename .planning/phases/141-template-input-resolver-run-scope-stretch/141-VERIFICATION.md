---
phase: 141-template-input-resolver-run-scope-stretch
verified: 2026-07-07T23:55:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "D-141-07 cross-provider render SMOKE: ONE representative model (OpenAI or Anthropic or Google) uploads a .docx template in a Deep turn and renders it via render_template"
    expected: "Deliverable produced, in-scope, byte-correct — proves the resolver did not regress the render happy path against the live run_claim column"
    why_human: "Live provider render + live model tool-call behavior; not reproducible via offline pytest/grep. Column has been live since Plan 03 (2026-07-07) but this smoke has not been run."
  - test: "(Optional lived-glance) In a shared thread, run a workflow phase that renders a template, then in a Deep turn call render_template — expect the honest 'belongs to a different run' message, not the workflow's template."
    expected: "Deep turn gets the D-141-05 honest relay string, never the workflow's template bytes"
    why_human: "Confirms the offline mock-pool repro matches live end-to-end agent behavior; optional per 141-VALIDATION.md but strengthens confidence beyond the raw-SQL proof already run by this verifier"
---

# Phase 141: template_input Resolver Run-Scope (STRETCH) Verification Report

**Phase Goal:** COLL-02 — a `template_input` template claimed by one run's context must NOT be resolvable by a foreign run's context (block workflow→Deep, Deep→workflow, and W1→W2), while PRESERVING same-mode reuse (Deep→Deep and same-workflow-run-across-phases).
**Verified:** 2026-07-07T23:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Roadmap SC#1 — resolver only resolves inputs scoped to the current run (workflow→Deep, Deep→workflow, W1→W2 all blocked) | ✓ VERIFIED | `claim_visible` 5-direction truth table green (`test_workflow_to_deep_blocked`, `test_deep_to_workflow_blocked`, `test_cross_workflow_run_blocked` all pass); **independently reproduced against the LIVE local DB** with a rollback-only psycopg2 probe: a foreign-claimed (`W1`) non-expired row was excluded by the exact production WHERE `(run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)` when queried with `own_claim='deep'`, and correctly surfaced only via the foreign-probe query — see Data-Flow Trace below |
| 2 | Roadmap SC#2 — `render_template` happy path unchanged for in-scope inputs, no regression | ✓ VERIFIED | `test_in_scope_render_unchanged` passes (own-upload Branch 2 + library Branch 1 resolve byte-identically); wave-merge blast-radius (`test_141_run_scope + test_workspace_template + test_citation_policy + test_llm_emit_executor`) = 79 passed, 0 failed (independently re-run) |
| 3 | Migration 092 adds a nullable text `run_claim` column, no default, no backfill (D-141-02/04) | ✓ VERIFIED | `supabase/migrations/092_workspace_files_run_claim.sql` contains `ADD COLUMN IF NOT EXISTS run_claim text`, no `NOT NULL`, no `DEFAULT`, no `UPDATE` backfill; `test_migration_092_additive_nullable` passes |
| 4 | Pure helper `claim_visible(row_claim, own_claim)` implements the eligibility truth (D-141-01) | ✓ VERIFIED | Read `template_asset_service.py:95-104` — `return row_claim is None or row_claim == own_claim`; matches the SQL WHERE it mirrors |
| 5 | Pure helper `own_claim_for_ctx(ctx)` keyed off `workflow_run_id` only (D-141-02) | ✓ VERIFIED | Read `template_asset_service.py:107-117` — `getattr(ctx, "workflow_run_id", None)` → `str(wf)` or `DEEP_CLAIM`; test asserts `run_id`/`parent_run_id` presence does not leak into the derivation |
| 6 | `resolve_template_source` Branch 2 filters ephemeral rows on the claim and stamps a NULL-claim row on first resolve (D-141-03) | ✓ VERIFIED | Read `template_asset_service.py:204-220,296-312` — WHERE carries `(run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)`; conditional `UPDATE ... WHERE run_claim IS NULL` + UPDATE-0 re-SELECT race fallthrough. Independently proven against live DB (rollback-only probe, see Data-Flow Trace) |
| 7 | Foreign-claimed non-expired row yields the honest "belongs to a different run" relay — never bytes, never foreign id/filename (D-141-05) | ✓ VERIFIED | Read `_foreign_error()` at `template_asset_service.py:194-202` — returns `bytes=None`, names only the condition; `test_resolver_foreign_claim_honest_error` + `test_resolver_claim_race_falls_through` pass; live-DB foreign-probe query independently confirmed it locates only the foreign row's `id` (never bytes) |
| 8 | Same-mode reuse preserved — Deep→Deep and same-`workflow_run`-across-phases still resolve | ✓ VERIFIED | `test_deep_to_deep_reuse`, `test_same_workflow_run_reuse` pass; live-DB probe: querying with `own_claim=W1` against a `W1`-claimed row returned the row (reuse works) |
| 9 | Own-claim is server-derived only — never from tool args (Tampering) | ✓ VERIFIED | `tool_dispatcher.py:2056` derives `own_claim = own_claim_for_ctx(ctx)`; `phase_types.py:1119` derives `own_claim = str(run_id)` from the raw harness bag's `run_id`. Neither reads `args`/tool input. `test_both_branch2_resolve_sites_pass_own_claim` passes |
| 10 | BOTH Branch-2 resolve callers pass the same own-claim; `_ProducerStreamCtx` carries `workflow_run_id` so a workflow emit render claims `str(W)`, never `'deep'` (Landmine 1 & 2) | ✓ VERIFIED | Read `phase_types.py:1026-1052` — `_ProducerStreamCtx.__init__` sets `self.workflow_run_id = getattr(inner, "run_id", None)`; `test_emit_ctx_carries_workflow_lineage` constructs the proxy directly and asserts `own_claim_for_ctx(...) == str(W)` — passes |
| 11 | Claim-aware WHERE never widens scope — `created_by`/`thread_id` preserved (V4) | ✓ VERIFIED | Read `template_asset_service.py:204-220` — `thread_id = $1 AND created_by = $2` retained on every probe query; `test_where_preserves_user_and_thread_scope` passes |
| 12 | Migration 092 applied to the live LOCAL Supabase DB; `run_claim` exists as nullable text, no default (D-141-02) | ✓ VERIFIED | Independently queried `information_schema.columns` via psycopg2 (`:54322`): `('YES', 'text', None)` — matches the SUMMARY claim exactly |
| 13 | `supabase/full-schema.sql` regenerated (no `--reset`) and committed with migration 092 | ✓ VERIFIED | `grep run_claim supabase/full-schema.sql` → 3 hits (column def line 1470 + COMMENT lines 1492/1495); `git log` shows `32b5cd63` (full-schema regen) and `fc668805` (migration, Plan 01) both on `develop` |

**Score:** 13/13 truths verified (all automated must-haves pass)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/092_workspace_files_run_claim.sql` | Additive nullable `run_claim` column, no default, no backfill, no new RLS | ✓ VERIFIED | Exists, static-contract test passes, applied live |
| `backend/app/services/template_asset_service.py` | `claim_visible` + `own_claim_for_ctx` + claim-aware Branch 2 | ✓ VERIFIED | Both helpers present + Branch 2 wired (WHERE, stamp, foreign probe, honest relay) |
| `backend/app/services/tool_dispatcher.py` | `own_claim` derived and threaded into the render handler | ✓ VERIFIED | `own_claim = own_claim_for_ctx(ctx)` at :2056, passed as kwarg at :2063 |
| `backend/app/services/harness/phase_types.py` | Emit-path own-claim + `_ProducerStreamCtx.workflow_run_id` stamp | ✓ VERIFIED | `_ProducerStreamCtx.__init__:1052` + `_exec_llm_emit:1119` both confirmed |
| `backend/tests/test_141_run_scope.py` | 15-test COLL-02 executable spec, fully green | ✓ VERIFIED | Independently re-run: 15 passed, 0 xfailed, 0.25s |
| `supabase/full-schema.sql` | Regenerated deploy artifact including `run_claim` | ✓ VERIFIED | `run_claim` present under `workspace_files`; committed `32b5cd63` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tool_dispatcher.py` (`_handle_render_template`) | `template_asset_service.resolve_template_source` | `own_claim=own_claim_for_ctx(ctx)` kwarg | ✓ WIRED | Confirmed at line 2056/2063 |
| `harness/phase_types.py` (`_ProducerStreamCtx`) | `tool_dispatcher.py` (via re-dispatch) | `_ProducerStreamCtx.workflow_run_id` read by `own_claim_for_ctx` inside the re-dispatched handler | ✓ WIRED | Confirmed by direct-construction test `test_emit_ctx_carries_workflow_lineage`, which passes |
| `harness/phase_types.py` (`_exec_llm_emit`) | `template_asset_service.resolve_template_source` | `own_claim=str(run_id)` kwarg | ✓ WIRED | Confirmed at line 1119/1126 |
| `test_141_run_scope.py` | `template_asset_service.py` | `import claim_visible / own_claim_for_ctx / resolve_template_source` | ✓ WIRED | Import present, all 15 tests collect and pass |

### Data-Flow Trace (Level 4 — live DB, not mock)

Because the code-review (141-REVIEW.md WR-01) flagged that the offline mock-pool tests never actually exercise the production SQL predicate (the mock recorder doesn't evaluate a WHERE clause — it hits the in-code `claim_visible` mirror instead), this verifier ran an independent **rollback-only** psycopg2 probe against the live local DB (`:54322`) using the EXACT SQL strings from `template_asset_service.py`:

| Query | Scenario | Result | Expected | Status |
|-------|----------|--------|----------|--------|
| Main SELECT (`run_claim IS NULL OR run_claim = $3 OR $3 IS NULL`) | `own_claim='deep'`, row claimed by foreign `W1` | `None` (excluded) | Excluded | ✓ FLOWING |
| Foreign probe (`run_claim IS NOT NULL AND run_claim <> $3`) | `own_claim='deep'`, row claimed by foreign `W1` | Found the `W1` row's `id` only | Found (drives the honest-error path) | ✓ FLOWING |
| Main SELECT | `own_claim=str(W1)`, row claimed by same `W1` | Found the row | Found (same-run reuse) | ✓ FLOWING |

All test rows were inserted and the transaction rolled back (`c.rollback()`); a post-check (`SELECT count(*) WHERE path='/probe-foreign.docx'`) confirmed zero residue. This closes the gap the code review flagged as advisory (WR-01) — the actual production SQL path (not just the pure-Python mirror) behaves as specified against the real schema.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Quick test file green | `pytest tests/test_141_run_scope.py -v` | 15 passed, 0 xfailed, 0.25s | ✓ PASS |
| Blast-radius neighbors green | `pytest tests/test_141_run_scope.py tests/test_workspace_template.py tests/unit/test_citation_policy.py tests/unit/test_llm_emit_executor.py -q` | 79 passed | ✓ PASS |
| Live column exists | psycopg2 `information_schema.columns` query | `('YES', 'text', None)` | ✓ PASS |
| Live SQL predicate (production WHERE, not mock) | rollback-only psycopg2 insert + query, 3 scenarios | All 3 matched expected (block / block-then-foreign-probe / reuse) | ✓ PASS |
| Pre-existing unrelated failure not attributable to 141 | `pytest tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint -q` | Fails on an unrelated `definition` key in `/workflows/published` serialization — no `run_claim`/template/resolver code in the traceback | ✓ PASS (confirmed unrelated) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| COLL-02 | 141-01, 141-02, 141-03 (all `requirements: [COLL-02]`) | The `template_input` resolver is scoped to the current run — a template uploaded in one run is not visible or accessible in another | ✓ SATISFIED | All 13 truths above verified; live DB confirms the claim mechanism is applied and functioning; cross-provider render SMOKE (D-141-07) is the one remaining item, routed to human verification below |

No orphaned requirements — REQUIREMENTS.md line 47 lists `COLL-02` as the only requirement mapped to this phase, and it is claimed by all 3 plans.

**Documentation staleness note (not a code gap):** REQUIREMENTS.md's Requirement Traceability table (line 89) still shows `COLL-02 (STRETCH) | Phase 141 | Pending (gated)` even though the same file's top-level requirement list (line 47) already shows `[x] COLL-02`, and ROADMAP.md's Milestone Progress table (line 446) still shows `141. ... | 0/TBD | Gated (behind CORE) | -` even though the phase's own Plans list (lines 386-388) shows all 3 plans `[x]`. This is the same `roadmap-progress-table-goes-stale` pattern the project has hit before (see project memory `reference_phase_complete_roadmap_gap.md`) — a tracking-table sync gap, not evidence the phase itself is incomplete. Flagged for the orchestrator to hand-fix both tables.

### Anti-Patterns Found

None. Scanned all 5 phase-modified files (`template_asset_service.py`, `tool_dispatcher.py`, `harness/phase_types.py`, `test_141_run_scope.py`, `092_workspace_files_run_claim.sql`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub-return patterns. The only `placeholder` hits are pre-existing, unrelated docx-template-placeholder domain terminology (e.g. `_PLACEHOLDER_TOKEN_RE`, `{{token}}` parsing) — not phase-141 debt markers.

**Advisory findings from 141-REVIEW.md (0 critical, 3 warning, 2 info) — none rise to BLOCKER; independently assessed below:**

| Finding | Severity (review) | This verifier's independent assessment |
|---------|--------------------|------------------------------------------|
| WR-01: offline tests don't exercise the production foreign-probe SQL path (mock recorder doesn't evaluate WHERE) | Warning | **Closed by this verification's live-DB Data-Flow Trace** — the actual production SQL was proven correct against the real schema. Test-coverage gap remains (worth fixing per the review's suggested patch) but does not indicate a functional defect. |
| WR-02: `test_both_branch2_resolve_sites_pass_own_claim` matches raw source including comments, not comment-stripped code (false-green risk on future edits) | Warning | Confirmed by direct read of `template_asset_service.py`/`tool_dispatcher.py`/`phase_types.py` — the actual call sites ARE correctly wired today (`own_claim = own_claim_for_ctx(ctx)`, `own_claim=own_claim` kwarg, `own_claim = str(run_id)`). The brittleness is a regression-guard weakness for FUTURE edits, not evidence today's wiring is wrong. |
| WR-03: emit-path step-1 vs step-4 own-claim derivation diverges when `ctx.run_id is None` (a case the review states "cannot occur on a real workflow run") | Warning | Confirmed via code read: `_build_phase_tool_context:354` sets `workflow_run_id=getattr(ctx, "run_id", None)` and the review traced `ctx.run_id` to always be `workflow_runs.id` on the emit path in production. Genuine footgun for future refactors, not a present-day leak. |
| IN-01: brittle string-slicing for the `UPDATE 0` race detection | Info | Correct for the single-row UPDATE it guards; a robustness nice-to-have. |
| IN-02: a failed emit phase still permanently claims the ephemeral upload (claim-on-first-resolve, not claim-on-delivery) | Info | Review confirms this is "consistent with the documented... design," i.e., intended behavior, not a defect. |

None of these change the goal-achievement verdict — the core mechanism (block foreign-claim resolution, preserve same-claim reuse, honest error, no scope widening) is proven correct via test suite + independent live-DB SQL execution + direct source read.

### Human Verification Required

### 1. Cross-provider render SMOKE (D-141-07)

**Test:** ONE representative model (OpenAI **or** Anthropic **or** Google) uploads a `.docx` template in a Deep turn and renders it via `render_template`.
**Expected:** Deliverable produced, in-scope, byte-correct — the render happy path is unaffected by the now-live `run_claim` column.
**Why human:** Live provider tool-call + live model behavior; not reproducible via offline pytest. The `run_claim` column has been live on the local DB since Plan 03 landed (2026-07-07), so this smoke is now runnable — it just has not been run yet. This is explicitly listed in `141-VALIDATION.md` "Manual-Only Verifications" and both Plan 03's `<success_criteria>` and its checkpoint's `<how-to-verify>` step 5 as an "optional lived-glance," but the phase's own VALIDATION.md marks it as the required cross-provider proof (not the SC#10 4-axis, since 141 is not on that headline list).

### 2. (Optional) Live cross-run repro lived-glance

**Test:** In a shared thread, run a workflow phase that renders a template, then in a Deep turn call `render_template`.
**Expected:** The honest "belongs to a different run" message (D-141-05), never the workflow's template bytes.
**Why human:** Confirms the offline mock-pool repro (`test_resolver_foreign_claim_honest_error`) and this verifier's rollback-only live-DB SQL probe match true end-to-end agent behavior through the harness/tool-dispatch layers. Listed as "optional" in `141-VALIDATION.md`; included here because it is cheap for the operator to fold into the same manual session as item 1.

### Gaps Summary

No gaps. All 13 automated/codebase-verifiable must-haves (2 roadmap Success Criteria + 11 plan-level truths spanning the claim contract, resolver wiring, and live migration apply) are VERIFIED against the actual codebase — not just SUMMARY.md narrative. This verification independently re-ran the test suite (15/15 + 79/79 blast-radius), re-queried the live DB schema, and additionally ran a rollback-only live-DB SQL probe that exercises the exact production WHERE/foreign-probe queries (something the offline mock-pool tests cannot do), closing the one gap the code review flagged as advisory (WR-01).

The phase goal — a `template_input` template claimed by one run's context is NOT resolvable by a foreign run's context, while same-mode reuse is preserved — is achieved in the codebase and now live on the local DB. The only remaining item is the D-141-07 cross-provider render SMOKE, a manual operator UAT that has not yet been run since the live column landed. Status is `human_needed`, not `passed`, per the verification decision tree (a non-empty human-verification list takes priority over an N/N automated score).

---

_Verified: 2026-07-07T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
