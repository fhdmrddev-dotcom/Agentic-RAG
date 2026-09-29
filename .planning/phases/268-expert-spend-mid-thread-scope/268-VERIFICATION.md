---
phase: 268-expert-spend-mid-thread-scope
verified: 2026-09-29T00:00:00Z
verification_mode: reviewed   # independent review by Gemini (non-builder) at 04d23d1ca, each finding checked by Claude (0 blocking); the D-2 fix after it (a2274e435, runs.py) is self-verified
status: passed
score: 4/4 roadmap success criteria live-verified; both human_verification items discharged 2026-09-29 (see Closure)
overrides_applied: 0
human_verification:
  - test: "Independent code review of Phase 268 by an agent that did NOT build it (AGENTS.md two-agent separation / 'whoever reviews must not have shaped the build')."
    expected: "A reviewer with no shaping stake re-drives the review; any new findings triaged and closed or explicitly accepted."
    why_human: "268-REVIEW.md / 268-REVIEW-FIX.md (3 iterations, all findings resolved) were produced by the same build lineage as the code (gsd-code-reviewer / gsd-code-fixer inside this phase's own session chain), not by a separately-spawned non-builder agent. STATE.md itself lists this as 'Owed from 268' item #2, and 267's own VERIFICATION.md used the identical escalation for the identical reason — this is a project-wide pattern, not unique to 268."
  - test: "Drive SC#1-continued live: a Deep run that actually reaches cap_paused, then a Continue, in the operator's org, read back through /admin/spend."
    expected: "The Expert line's tokens equal the sum of the paused segment's and the continuation's persisted totals (the D-268-20 accumulation), observed end-to-end through the API a person would use, not only through a unit/integration fixture."
    why_human: "268-UAT-LOG.md records 'SC#1-continued — OWED-manual': two explorer-mode attempts (8-iteration cap) finished `completed` without reaching `cap_paused`. The mechanism is proven at the unit level (RED-then-GREEN, `test_268_continuation_tokens.py`, base finalizing only 30/10 instead of 130/50) and on real Postgres (`test_268_spend_rollup_pg.py`'s seeded continued-root fixture), but no live drive reached the cap, so SC#1's 'including … paused/continued runs' clause has no live-UAT row."
gaps: []
deferred: []
---

# Phase 268: Expert Spend & Mid-Thread Scope — Verification Report

**Phase Goal:** An operator can see what each Expert costs, and a user can change a thread's folder scope
after it starts — both visible where the person looks, and both true in the data.
**Requirements:** METER-08, CHAT-08
**Verified:** 2026-09-29
**Verification mode:** self-verified (⛔ not "reviewed" — see `human_verification` above)
**Status:** passed (closed 2026-09-29 — see Closure)
**Re-verification:** No — initial verification

## Summary

I independently re-derived, rather than trusted, the phase's central claims: I re-ran the full backend unit
baseline gate (`71 failed, 5974 passed, 1 skipped, 2 xfailed, 2 xpassed` — **identical** to the SUMMARYs'
figures) and the full vitest count gate (`346/346 pinned files present, no per-file decrease, 0 failing` —
also identical), ran the phase's 133 backend unit tests, its 20 real-Postgres integration tests, and 130 of
its frontend tests directly (all green), read the actual diffs of `db/runs.py`, `db/rates.py`,
`admin_spend.py`, `threads.py`, `tool_dispatcher.py`, `ChatArea.tsx`, `MessageInput.tsx` and
`AdminSpendPage.tsx` against what the plans specified (all matched, not stubs), and opened two of the
phase's own live-drive screenshots (`g4-1-light-spend-fa.png`, `g4-3-light-card.png`) to confirm the UI
states described in `268-UAT-LOG.md` are real pixels, not narration.

All four ROADMAP success criteria are backed by live evidence in a real org (`22f9c615-…`), not mocked
tests alone, with SQL/response evidence quoted per row in `268-UAT-LOG.md`, a real-Postgres reconciliation
of the spend SQL, an 8-row cross-provider board (re-driven after a mid-flight fix), and three G-4
lived-experience scenarios driven in Chrome on both themes with the operator's verbatim "approved". A
3-iteration code review (self-review chain, not independent) found and closed 1 critical + 6 warnings
(a genuine cross-org data leak in Harness Continue, a race condition on the folder PATCH, three shell
writers still guessing org), seeded one residual (SEED-322) and accepted two low-impact info findings by
explicit operator ruling — none of that leaves an open blocker in the code as it stands.

Two items are honestly self-disclosed by the phase as owed rather than concealed, and I am escalating both
rather than either hiding them or blocking on them outright: the AGENTS.md independent (non-builder) review,
and a live drive of SC#1's continued-run clause. Both are exactly the pattern Phase 267's own verification
used for its own owed items — this is consistent project practice, not a new bar invented here.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | Live runs with two Experts and one with none; `/admin/spend` groups/filters by Expert; each line's tokens/USD = sum of its runs' persisted usage, incl. sub-agent and paused/continued runs | ✓ VERIFIED (attribution, reconcile, sub-agent, filter — live); **continued-run clause proven by test only, not live** | `268-UAT-LOG.md` SC#1-attribution/-reconcile/-subagent/-filter all PASS with quoted runs rows + independent Python sum (Σ 408,678 = window 40.8678 = independent, 1,238 runs); `test_268_continuation_tokens.py` (RED→GREEN, re-run here: pass) + `test_268_spend_rollup_pg.py` continued-root fixture (re-run here: pass) prove the mechanism; no live cap_paused→Continue drive (SC#1-continued OWED-manual) |
| SC#2 | Runs with no Expert are their own line, never dropped, never mis-attributed | ✓ VERIFIED | `GET /admin/spend/summary` on a live org: `none` line present (38 runs) even on an empty-window query (`run_count 0`, `spend_usd "0.0000"`); `unrecorded` (pre-268) is a separate line (1,191 runs), never merged |
| SC#3 | A user changes a live thread's folder scope; the change appears in the transcript, survives reload, and the next turn's retrieval draws only from the new scope — verified against the run's retrieved-chunk records | ✓ VERIFIED, with a residual gap named by the phase itself (SEED-319) | Live: one `scope_changed` row per PATCH (org = thread's org), survives two `GET …/snapshot` reads; audit-join proof (`search.query` metadata → `document_ids` → `documents.folder_id`) shows the next SEARCHING run reads only the new subtree on 8/8 rows across two board drives. Residual: after the D-268-26 fix, 2/8 providers (openai, google) re-retrieve via `grep`/`read_document` instead of `search_documents` on the follow-up, so no audit row exists to score those two rows against the exact pass bar — but neither cites the dropped folder either |
| SC#4 | Changing scope mid-thread with an Expert active respects Restricted/Biased mode and says so | ✓ VERIFIED | Live: SC#4-restricted (HR Advisor) — held payload, "Saved / Searching: HR Policies only · HR Advisor is Restricted / Takes effect when HR Advisor leaves", next-turn documents all in HR Policies; SC#4-biased (UAT-265 Billing SOP Advisor, substituted for Financial Analyzer which is actually Restricted — substitution named, not hidden) — documents ⊆ `ScopeEffect.next`; SC#4-authz — cross-org folder id → 404, `threads.folder_id` unchanged. G4-3 Chrome screenshot (`g4-3-light-card.png`, opened directly by this verifier) shows the exact amber "Saved / Searching / Takes effect when HR Advisor leaves" card and the dashed "· NOT SEARCHED" chip |

**Score:** 4/4 roadmap success criteria hold on live evidence; 2 named sub-items (SC#1's continued-run clause,
SC#3's 2-provider audit gap) are honestly disclosed residuals, not concealed failures.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/197_runs_expert_attribution.sql` | `expert_id` (no FK) + `expert_attributed` (default false, no backfill) | ✓ VERIFIED | Read in full; matches D-268-04/06 exactly; applied to local DB (verify queries quoted in `268-01-SUMMARY.md`, re-confirmed present in `supabase/full-schema.sql:2563-2601`) |
| `backend/app/db/runs.py insert_run` | Stamp at the one INSERT, SQL parent copy for sub-agents | ✓ VERIFIED | Read in full: `INSERT … SELECT … COALESCE(p.org_id, $9) … CASE WHEN $8 IS NULL THEN $10 ELSE p.expert_id END …` — exactly the plan's shape |
| `backend/app/db/rates.py` | One `per_root` CTE feeding totals/breakdown/ledger | ✓ VERIFIED | `_per_root_cte`, `_expert_filter_sql`, `expert_breakdown`, `window_total_usd`, `partly_priced_harness_runs` all present and wired into both `get_org_spend_summary` and `get_spend_runs` |
| `backend/app/api/admin_spend.py` | `expert` query param, validated, bound not interpolated | ✓ VERIFIED | `Query(..., pattern=r"^(none|unrecorded|[0-9a-fA-F-]{36})$")`, forwarded to both routes |
| `backend/app/api/threads.py` | PATCH folder arm + `scope-effect` route + one-txn event write | ✓ VERIFIED | `_write_scope_change`, `ScopeChangeConflict` (WR-02 fix), `GET /{thread_id}/scope-effect`, `_authorize_thread_folder` all present |
| `backend/app/services/tool_dispatcher.py` | `run_id`/`thread_id`/`parent_run_id`/`folder_ids` on both `search.query` audit writes | ✓ VERIFIED | Both call sites confirmed by grep |
| `frontend/src/components/chat/ScopeChip.tsx` / `ScopePicker.tsx` | Composer chip + picker | ✓ VERIFIED, WIRED | Mounted via `MessageInput`'s `scopeSlot` prop, driven by `ChatArea.applyScopeChange`; confirmed rendering in live screenshot |
| `frontend/src/pages/admin/AdminSpendPage.tsx` + `ExpertSpendCard.tsx`/`ExpertFilterPills.tsx` | Expert pills, Spend-by-Expert table, reconciliation footer | ✓ VERIFIED, WIRED | `expertFilter` state threads into both `loadAll` and `goToLedgerOffset`; confirmed rendering (5 lines, `✓` footer, filter moving all four regions) in the live screenshot |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `send_message` | `register_run_start` → `insert_run` | `expert_id=born_for_bundle_id`, `org_id=active_org_id` | ✓ WIRED (grep-confirmed, unit-tested) |
| `AdminSpendPage.loadAll`/`goToLedgerOffset` | `GET /admin/spend/summary?expert=` / `/runs?expert=` | one `expertFilter` state in both call sites | ✓ WIRED (grep-confirmed; live screenshot shows all 4 regions moving together on a click) |
| `rename_thread` folder arm | `messages` `scope_changed` row | `_write_scope_change`, one user-JWT transaction | ✓ WIRED (unit + real-PG race test) |
| `tool_dispatcher.py search.query` | `audit_log.metadata` | additive `run_id`/`folder_ids` keys | ✓ WIRED (grep-confirmed, exercised live in the SC#10/SC#3 audit joins) |
| `agent_loop._reconstruct_history` | model-visible history | `scope_note.py`'s one provider-neutral note | ✓ WIRED (D-268-26 fix; live-proven via `_reconstruct_history` output quoted in the UAT log, and via the re-driven board dropping 6/8 dropped-folder citations to 0/8) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `AdminSpendPage` Expert lines | `expertLines` / `expertBreakdown` | `GET /admin/spend/summary` → `db/rates.py per_root` CTE → real `runs`/`model_rates` rows | Yes — independent Python sum matched the API exactly (408,678 = 408,678) | ✓ FLOWING |
| `ScopeChip`/`ScopePicker`/`ScopeEventCard` | `ScopeEffect` / `scope_changed` payload | `GET /threads/{id}/scope-effect` and the transcript row, both built server-side from `describe_expert_scope` | Yes — screenshot shows the exact server-composed wording (folder paths, Restricted rule) | ✓ FLOWING |

### Behavioral Spot-Checks (run directly by this verifier, not sourced from any SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend unit baseline holds at the documented ceiling | `node scripts/check-backend-unit-baseline.cjs` (backend/, venv) | `71 failed, 5974 passed, 1 skipped, 2 xfailed, 2 xpassed` — `[GATE PASSED]` | ✓ PASS |
| Frontend vitest count gate holds, no regression | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | `total 9102 · failed 0 · pinned total 8354` — `346/346 pinned files present, no per-file decrease, 0 failing` | ✓ PASS |
| Phase's own backend unit tests | 10 `test_268_*` files, 133 tests | `133 passed` | ✓ PASS |
| Phase's own real-Postgres integration tests | 5 `test_268_*` integration files, 20 tests | `20 passed` | ✓ PASS |
| Phase's own frontend tests (chip/picker/ChatArea/spend/theme) | 10 files, 130 tests | `130 passed` | ✓ PASS |
| Hot-file ledger / CLAUDE.md size / seeds register gates | `check-hot-file-ledger.cjs 268`, `check-claude-md-size.cjs`, `check-seeds-register.cjs` | all three `OK` | ✓ PASS |
| No leaked credentials in phase evidence | `grep -rn "eyJ" .planning/phases/268-…/` | 0 hits outside a PLAN.md's own prose about the check | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| METER-08 | 268-01, 268-02, 268-04 | Token/USD attributable per Expert; `/admin/spend` groups/filters | ✓ SATISFIED | Live reconciliation + code + tests, above |
| CHAT-08 | 268-03, 268-04 | Mid-thread folder scope change; transcript event; next-turn retrieval uses new scope | ✓ SATISFIED (with the SC#3 residual named above) | Live SC#3/SC#4 rows + G4-2/G4-3 Chrome |

Both requirements are declared in `268-01/02/03/04-PLAN.md` frontmatter and both appear in
`.planning/REQUIREMENTS.md`'s v4.4 table, mapped to Phase 268 — no orphans.

### Anti-Patterns Found

None outstanding. The 3-iteration code review (`268-REVIEW.md` iteration 2 + `268-REVIEW-FIX.md` iterations
1-3) is itself the anti-pattern sweep for this phase: it found and closed a real cross-org data leak
(CR-01: a two-org user's second Continue re-ran the first pause's tool calls because the org was dropped),
a race condition on the folder PATCH (WR-02), three harness shell writers still guessing org (WR-06), a
UI race between switching threads (WR-01), an unnameable-folder mislabel (WR-04), and a false "still
searches X" refusal message (re-review WR-01). One residual (an unrated Deep root's sub-agent USD not
disclosed the same way a harness shell's is) was seeded as SEED-322 by explicit operator ruling rather than
fixed, and two low-impact info findings were accepted by ruling. I re-ran the gates this iteration claims
and got identical figures — I have no independent finding of a missed anti-pattern.

### Human Verification Required

1. **Independent (non-builder) code review**, per AGENTS.md's two-agent separation rule — see frontmatter.
   This is explicitly recorded as owed in `STATE.md`'s own "Owed from 268" list, and is the same
   escalation Phase 267's verification used for its identical gap.
2. **A live drive of SC#1's continued-run clause** (a Deep run that reaches `cap_paused`, then Continues) —
   explicitly recorded as `OWED-manual` in `268-UAT-LOG.md`. The underlying mechanism (D-268-20 token
   accumulation) is proven at the unit level and on real Postgres, but no live end-to-end drive reached the
   cap.

### Gaps Summary

No ROADMAP success criterion is unmet. Two items are self-disclosed as owed rather than driven, and I am
routing both to the human-verification path rather than either hiding them or blocking the phase on them —
consistent with how Phase 267's own verification, immediately prior in this same milestone, treated its
identical class of owed item.

One documentation note, not a functional gap: `STATE.md` and `ROADMAP.md` still read as if Task 4 (the G-4
Chrome pass) were awaiting the operator, but `268-UAT-LOG.md` records the operator's verbatim "approved"
reply dated 2026-09-29, after `STATE.md`'s last edit. The orchestrator should refresh both registers to
reflect that G-4 is done, alongside whatever this verification report resolves.

---

_Verified: 2026-09-29_
_Verifier: Claude (gsd-verifier)_

## Closure (2026-09-29)

| Owed item | Result | Evidence |
|---|---|---|
| Independent review | **Done.** Gemini (did not build 268) reviewed `220c82dde..HEAD` → 1 Critical, 2 Warnings. Claude checked each: CR-01 refuted (org_id is NOT NULL since mig 105), WR-01 refuted (contradicts Pitfall 9 / T-268-25), WR-02 confirmed as Info. **0 blocking.** | `268-REVIEW.md` iteration 4 + "Claude check" section |
| SC#1-continued live | **PASS (seeded pause).** No provider reached `cap_paused` live in 3 attempts, so the pause was set by hand. A real Continue then added +139,903 / +297 tokens to the run and exactly the same to the HR Advisor line (8 runs unchanged; independent SUM agrees). | `268-UAT-LOG.md` § SC#1-continued PASS |
| Found on the way | **D-2 FIXED**: Continue's `continues_used` write was dropped by RLS (runs is SELECT-only). RED→GREEN real-PG test `test_268_continue_counts.py`; unit gate 71 = the 256 baseline set. **D-1 → SEED-323, D-3 → SEED-324** (both rare, both deferred). | `a2274e435` |

Production parity is unchanged and still owed: `268-PROD-PARITY.md` (migration 197 before the backend deploy).
