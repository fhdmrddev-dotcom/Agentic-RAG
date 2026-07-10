---
phase: 135-self-improvement-loop-si-01
verified: 2026-07-02T20:50:11Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "The proposer + re-eval behavior holds across providers (reuses the existing gateway; SC#10) with no shared-path fork — closed by live SC#10 4-axis UAT (U1-U11) in 135-HUMAN-UAT.md: full graded loops on OpenAI, Anthropic, Google; multi-tool, parallel-thread, long-message, honest-rejection, interrupted (CR-02 live), failed-gate+override (CR-01 live), and lived-experience all passed live."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "The skill detail panel communicates the human-approval model legibly at a glance (panel is not overloaded with stacked sections)."
    addressed_in: "Phase 137"
    evidence: "ROADMAP.md Phase 137 goal: 'The Skills UI gains a Skill Evals panel that consolidates the whole eval experience... without redesigning the rest of the Skills tab' — matches U11's operator UX finding verbatim (panel decongestion, approval-model legibility), already routed there in 135-HUMAN-UAT.md U11 notes."
---

# Phase 135: Self-Improvement Loop (SI-01) Verification Report

**Phase Goal:** The system closes the loop — it proposes instruction-body edits from eval results + Tuner signal, the user reviews the diff and approves, a new immutable version is created and automatically re-evaled before promotion; the system never auto-applies.
**Verified:** 2026-07-02T20:50:11Z
**Status:** passed
**Re-verification:** Yes — third pass, closing the live-UAT human-verification gate left open by the second pass (2026-07-02T15:35:00Z, `human_needed`, 4/5)

## What Changed Since the Prior Verification

Confirmed via `git diff d300c93f..HEAD --stat`: only `.planning/STATE.md` and `135-HUMAN-UAT.md` changed since the prior verification commit — **zero source-code files touched**. All prior automated findings (Truths 1-4, all artifacts, all key links, all tests) therefore stand unchanged and were spot-checked fresh in this session (see Artifacts table) rather than re-derived from scratch.

What's new: the SC#10 4-axis live UAT (U1-U11), authored in `135-VALIDATION.md` and mandated by D-15, was executed live on 2026-07-02 and its results persisted in `135-HUMAN-UAT.md` (committed `49ebea67`). This was the single remaining item blocking `passed` in the prior pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From an eval result + Tuner signal, the system proposes a concrete instruction-body edit as a reviewable diff — it never edits the live skill and never auto-applies (SI-01 SC#1) | VERIFIED (unchanged, spot-checked) | `skill_proposer_service.propose()` and the `POST /skills/{id}/proposals` INSERT-only path confirmed unchanged (no source diff since prior pass). Live UAT U1/U2/U3/U5/U7 all independently confirm real unified diffs rendered with rationale + evidence, and that `skills` rows were untouched pre-approval (md5 checks in U1/U2/U10 notes). |
| 2 | The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop) | VERIFIED (unchanged, spot-checked) | Code anchors re-confirmed present: `_APPROVED_STALE_GRACE_S`/`_approved_is_stale` (evals.py:82,91), the `approved` Reject branch in `SkillEvalSection.tsx` (:678,:697-709 `handleReject`). Live UAT U8 exercises the reject half directly: proposal `caa41619` → Reject → 200, `new_skill_version_id=NULL`, live skill md5 unchanged. U1/U2/U3/U5/U10 all exercise the approve half — new immutable draft versions created (e.g. U1: versions 5→6), live skill untouched pre-promotion. |
| 3 | An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate) | VERIFIED (unchanged, spot-checked) | `eval_inflight:{skill_id}` Redis-claim cross-worker check re-confirmed present in `reconcile_proposal` (evals.py:1253,1615). Live UAT U9 directly exercises this: operator restarted uvicorn mid-re-eval; first authenticated GET after restart honestly flipped the stuck proposal to `interrupted` (never an eternal spinner — the exact pre-fix CR-02 failure mode); re-run affordance worked; live skill untouched through kill+rerun. |
| 4 | A failed gate surfaces `not_promoted` with honest gate counts and is force-promotable with `override_forced=true` recorded (D-06) | VERIFIED (unchanged, spot-checked) | `ForcePromoteBody \| None = None` re-confirmed present (evals.py:1828). Live UAT U10 directly exercises this on proposal `05037da8`: default state verified `not_promoted` with failing evidence rendered first, then "Force promote anyway" → POST 200 (not 422 — the exact pre-fix CR-01 failure mode), DB shows `status=promoted`, `override_forced=true`, live skill instructions updated, failed-gate evidence still preserved in the UI per D-13. |
| 5 | The proposer + re-eval behavior holds across providers (reuses the existing gateway; SC#10) with no shared-path fork | **VERIFIED (was UNCERTAIN/human_needed)** | Live SC#10 4-axis UAT (`135-HUMAN-UAT.md`, committed `49ebea67`): 11 rows run, 10 passed, 1 blocked. Full GRADED loops (source run → propose → diff → approve → auto re-eval on the SAME provider+model per D-11 → honest gate verdict → live-skill-untouched-on-fail) proven live end-to-end on **OpenAI** (U1, upgraded blocked→pass after operator added credit — run `db317406`), **Anthropic** (U2, run `8437cfa4`), and **Google** (U3, run `43e605dc`, only provider with both arms graded with no schema-trap exposure). **U4 (OpenRouter) is blocked**, but by a third-party upstream failure (OpenRouter API 404 "No endpoints found" on both attempted dropdown models) — not a codebase defect; the native-safe assertion still held (no wedge/crash, arms surfaced honestly as `not_measured` with the raw provider error). Per project policy (`feedback_openrouter_is_experimental`), OpenRouter is experimental/not-prioritized and the required cross-provider axis is satisfied by the 3 native providers that completed graded loops. The other 3 SC#10 axes are all independently proven: multi-tool (U5 — Pitfall #1 draft-instructions-loaded seam proven live via a literal draft-only string found in the eval thread), parallel-thread (U6 — no cross-talk across 3 overlap samples), long-message (U7 — 25 KB instruction body, 626-line diff rendered without truncation). No shared-path fork observed anywhere in the 11 rows. |

**Score:** 5/5 truths verified (up from 4/5 — the human-verification gate is now closed by live evidence).

### Deferred Items

Not a phase-goal gap — an operator UX finding surfaced during live UAT, explicitly routed to a named future phase whose goal covers it directly.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | The skill detail panel (instructions editor + test cases + version history + eval runner + readout + proposal card, all stacked) does not communicate the human-approval model legibly at a glance | Phase 137 (PANEL-01) | `135-HUMAN-UAT.md` U11 notes: "OPERATOR UX FINDING (design input, not a 135 defect)... ROUTE TO PHASE 137 (skill-evals-panel-ui, PANEL-01)". `.planning/ROADMAP.md` Phase 137 goal: "The Skills UI gains a Skill Evals panel that consolidates the whole eval experience... without redesigning the rest of the Skills tab" — direct match. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/evals.py` | `ForcePromoteBody \| None = None`, cross-worker Redis-claim liveness in reconcile, approve except/revert, reconcile stale-`approved` self-heal, override map keyed on draft version name | VERIFIED (spot-checked fresh this session) | `grep` re-confirmed: `:1828 ForcePromoteBody | None = None`; `:82 _APPROVED_STALE_GRACE_S`; `:91 _approved_is_stale`; `:1188` self-heal call site; `:1253,1615` `eval_inflight` claim references. No source diff since prior pass (`git log` on this file's last 5 commits all predate the prior verification). |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Dedicated `approved` branch with a Reject escape, distinct from `re_evaling` spinner-only | VERIFIED (spot-checked fresh this session) | `grep` re-confirmed: `:435 handleReject`, `:678` Reject button in the spinner branch, `:697-709` dedicated `approved` branch with its own Reject wiring. No source diff since prior pass. |
| `frontend/src/lib/api.ts` | `forcePromoteProposal` sends `JSON.stringify({})` | VERIFIED (unchanged, not re-diffed — no source change) | Confirmed unchanged by `git log`/`git diff` scope check (only `.planning/` files changed since prior pass). |
| `backend/tests/*` (5 gap-closure tests) | All green | VERIFIED (unchanged — not re-run this session; no source change since the prior pass's fresh 43-test run) | Prior pass ran the full suite fresh and green; no source touched since, so re-running would be redundant regression-checking of an already-confirmed-stable state. |
| `.planning/phases/135-self-improvement-loop-si-01/135-HUMAN-UAT.md` | Live SC#10 4-axis UAT results (U1-U11) closing the human-verification gate | VERIFIED (new this pass) | Exists, committed (`49ebea67`), `status: partial` in frontmatter is stale metadata (testing is in fact complete per `## Current Test` = "[testing complete]" and the `## Summary` block: total 11, passed 10, blocked 1, issues 0) — the frontmatter `status` field wasn't flipped to `complete` but the content is unambiguously a finished UAT run, not a partial one. Flagged as a minor doc-hygiene note, not a gap. |

### Key Link Verification

All 5 key links from the prior pass (`forcePromoteProposal` → `force_promote_skill_proposal`; `reconcile_proposal` running branch → Redis claim; `approve_skill_proposal` → revert-on-failure; `_launch_reeval` override map → draft version name; `reconcile_proposal` → stale-`approved` self-heal) are unchanged (no source diff) and were spot-checked present. Live UAT adds direct behavioral proof on top of the static/test evidence:

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `frontend forcePromoteProposal` | `evals.py force_promote_skill_proposal` | body-less POST | WIRED (code+test, now also live-proven) | U10: "Force promote anyway" clicked live → 200 (not 422) → `override_forced=true`, live `skills.instructions` updated. |
| `evals.py reconcile_proposal` running branch | `eval_inflight:{skill_id}` Redis claim | claim value compare | WIRED (code+test, now also live-proven) | U9: real backend restart mid-re-eval → first GET after restart honestly reconciled to `interrupted`, no eternal spinner. |
| `evals.py approve_skill_proposal` | `status='proposed'` revert on failure | try/except + CAS | WIRED (code+test only — not separately exercised live; no live launch-failure was staged) | Unchanged from prior pass; not a regression, just not independently re-proven by UAT (the interrupted-mid-run case (U9) exercises a different failure mode). |
| `evals.py _launch_reeval` override map | draft version name | name-keyed map | WIRED (code-proven, now also live-proven) | U5: draft-only instruction string found live inside the re-eval's WITH-arm agent thread — the override seam measurably delivered the draft body, not the live skill. |
| `evals.py reconcile_proposal` early-return | stale `approved` self-heal | `_approved_is_stale` | WIRED (code+test only — not separately exercised live) | Unchanged from prior pass; the U9 interrupted case exercises the `running`-branch reconcile, not the stale-`approved` branch specifically. |

### Data-Flow Trace (Level 4)

Unchanged from prior pass (no source diff) — all three previously-FLOWING traces (`SkillEvalSection.tsx` proposal card status hydration, `force_promote_skill_proposal` response, `reconcile_proposal` claim read) remain FLOWING, now with live UAT corroboration (U1-U11 all show real, non-static DB state changes tracked live via psycopg2/DOM reads per the UAT notes).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No source drift since prior pass | `git diff d300c93f..HEAD --stat` | Only `.planning/STATE.md` + `135-HUMAN-UAT.md` changed | PASS |
| Key code anchors still present | `grep` on `ForcePromoteBody \| None`, `_approved_is_stale`, `eval_inflight`, `handleReject`/`approved` branch | All present at previously-cited lines | PASS |
| Live SC#10 4-axis UAT executed | `135-HUMAN-UAT.md` (committed `49ebea67`) | 11 rows, 10 pass, 1 blocked (third-party), 0 issues | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or discovered for this phase (unchanged from prior passes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| SI-01 | 135-01..09 (all, incl. gap-closure 08/09) | The system proposes instruction-body edits based on eval results + Tuner signal → user reviews the diff and approves → a new immutable skill version is created and auto-re-evaled before promotion — the human is always in the loop, the system never auto-applies. | **SATISFIED** | All 5 truths now VERIFIED — 4 by direct code+test evidence (unchanged from prior pass), the 5th (cross-provider, SC#10) now closed by live UAT proving the full loop end-to-end on OpenAI, Anthropic, and Google, plus multi-tool/parallel-thread/long-message/honest-rejection/interrupted/failed-gate-override/lived-experience. `.planning/REQUIREMENTS.md` line 76 still shows SI-01 as "Pending" — this is an orchestrator-owned doc-flip expected to happen at phase completion, not evidence of a code gap (the same drift is visible on EVAL-02/Phase 133, which is independently known-complete per project memory — confirming this is a systemic doc-lag pattern, not a 135-specific issue). |

No orphaned requirements — SI-01 is the only requirement ID mapped to Phase 135 in REQUIREMENTS.md, declared in all 9 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/evals.py` | `promotion_gate()` ~line 1092 | "not measured" gate-summary count undercounts cases `not_measured` on BOTH sides (only counts cases graded on exactly one side) | Minor (found live during U1, root-caused in-session with fix direction documented in `135-HUMAN-UAT.md` Gaps) | Display-only honesty gap in a total-provider-outage edge case (both source AND re-eval arms failed to grade). The actual gate VERDICT remained honest (`not_promoted`, no false promotion) in every observed case — only the displayed "not measured N" count under-reports in this rare double-outage scenario. Does not compromise SI-01's core safety guarantee (never wrongly promotes). Recommend filing as a follow-up (SEED or bug report), not a blocker to this phase's goal. |
| `backend/app/config.py` | ~lines 99-107, 353-363 | Eval-runner model dropdown drifts from `MODEL_CAPABILITIES` registry (some dropdown OpenRouter models 400 "Unknown model"; some registered models absent from dropdown) | Minor (found live during U4, root-caused in-session, pre-existing debt) | Blocked the OpenRouter UAT row from completing a full graded loop, but is a pre-existing model-curation issue in the 133 eval runner surface, not introduced by or specific to Phase 135's self-improve loop. Already flagged for `SEED-100` / `feedback_model_names_representative` per project memory. Does not affect SI-01's core loop mechanics (proven honest under the failure via native-safe behavior). |

No `TBD`/`FIXME`/`XXX` debt markers in any 135-touched file (unchanged from prior pass — no source touched since).

### Human Verification Required

None. The single remaining human-verification item from the prior pass (SC#10 4-axis live cross-provider UAT, U1-U11) has been executed and its results persisted in `135-HUMAN-UAT.md` (commit `49ebea67`): 10/11 passed live, 1 blocked by a third-party (OpenRouter) upstream failure unrelated to this codebase.

### Gaps Summary

No gaps remain that block phase-goal achievement. All 5 observable truths are VERIFIED — the 4 code/test-verified truths from the prior pass are unchanged (zero source drift confirmed via `git diff`), and the 5th (SC#10 cross-provider, previously routed to human verification) is now closed by live UAT evidence: full graded loops proven end-to-end on OpenAI, Anthropic, and Google, plus all other SC#10 axes (multi-tool, parallel-thread, long-message) and the D-13/D-14/D-06 mandatory scenarios (honest rejection, interrupted re-eval, failed-gate override) all passed live with no shared-path fork observed.

Two minor, pre-existing findings surfaced during the live UAT (a "not measured" gate-count display undercount in a rare total-provider-outage edge case, and an OpenRouter model dropdown↔registry drift) do not block the phase goal — both are root-caused with fix direction already documented in `135-HUMAN-UAT.md`, and neither compromises SI-01's core safety guarantee (the system never auto-applies and never falsely promotes). Recommend the operator file these as SEED/backlog items for a future cleanup pass.

One design finding (skill detail panel information density / approval-model legibility) is explicitly deferred to Phase 137 (PANEL-01), whose roadmap goal directly covers it.

U4 (OpenRouter) is the only UAT row not fully passed — blocked by a third-party upstream failure (OpenRouter API 404 on all attempted dropdown models), not a codebase defect. Per project policy, OpenRouter is experimental/not-prioritized; the required cross-provider axis is satisfied by the three native providers (OpenAI, Anthropic, Google) that completed full graded loops live.

**Recommendation:** Phase goal achieved. Ready for `/gsd:secure-phase 135` (still owed — no `135-SECURITY.md` exists yet) and then phase completion. Consider filing the two minor UAT-found gaps and the U4 dropdown-drift observation as SEED/backlog items before closing out.

---

_Verified: 2026-07-02T20:50:11Z_
_Verifier: Claude (gsd-verifier)_
