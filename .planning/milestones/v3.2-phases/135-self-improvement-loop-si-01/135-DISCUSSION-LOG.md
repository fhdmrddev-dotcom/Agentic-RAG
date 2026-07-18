# Phase 135: Self-Improvement Loop (SI-01) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 135-self-improvement-loop-si-01
**Areas discussed:** Proposal trigger & evidence, Promotion semantics, Diff review surface, Re-eval scope & gate rule (+ mandatory reported-bugs routing)

---

## Reported-bugs routing (pre-discussion mandate)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to SEED-100, 135 stays honest | Full reconciliation in SEED-100; 135 guarantees honest "interrupted — not promoted" + re-run path | ✓ |
| Fold minimal reconciliation into 135 | Startup sweep marking non-terminal runs interrupted | |
| Leave open, no 135 obligation | Risk: proposals stuck "awaiting re-eval" after restart | |

**User's choice:** Defer to SEED-100, 135 stays honest (Recommended)

---

## Proposal trigger & evidence

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand button | "Propose improvement" on the eval readout; user-initiated spend; Tuner precedent | ✓ |
| Hybrid nudge | Contextual nudge after failed runs, drafts on click | |
| Auto-draft after each run | Ambient drafting; token spend + stale proposal pile-up | |

**User's choice:** On-demand button (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Full bundle | Failed/not_measured cases + judge reasons + ratings/disagreements weighted + passing anchors + Tuner signal as optional context | ✓ |
| Eval evidence only | Skip Tuner signal | |
| Failures only, minimal | Just failed cases + judge reasons | |

**User's choice:** Full bundle (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Skill-builder resolver | resolve_skill_builder_model(settings) — Tuner's authoring resolver | ✓ |
| Judge model | Conflates author + grader roles | |
| User's active provider/model | Proposal quality varies per provider | |

**User's choice:** Skill-builder resolver (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One proposal at a time | Single reviewable diff per press; re-press after rejection | ✓ |
| 2-3 candidates, user picks | Tuner-style; 2-3× cost, heavier review UI | |
| You decide | Planner's call | |

**User's choice:** One proposal at a time (Recommended)

---

## Promotion semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Draft-version-first | Approval mints immutable version without touching live skill; re-eval gates the live apply | ✓ |
| Apply-on-approve, revert-on-fail | Live skill briefly runs unproven instructions | |
| Apply-on-approve, advisory re-eval | Weakest gate; violates SC#3 | |

**User's choice:** Draft-version-first (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Override allowed, with evidence | Default not-promoted; explicit force-promote with evidence shown, logged | ✓ |
| Hard block | Failed re-eval can never promote | |
| You decide | Planner's call | |

**User's choice:** Override allowed, with evidence (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Proposals table | Owner-scoped table with full lifecycle; version row only on approval | ✓ |
| Version row at draft time | Pollutes immutable version history with unapproved drafts | |
| Ephemeral until approved | Reload loses drafts; no rejection audit trail | |

**User's choice:** Proposals table (Recommended)

---

## Diff review surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inside SkillEvalSection | Proposal card under the eval readout; one home; 137 redesigns anyway | ✓ |
| Skill detail / edit view | Grows the Skills-tab surface (excluded this milestone) | |
| Separate proposals view | New IA for a thin phase | |

**User's choice:** Inside SkillEvalSection (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified line diff | Compact removed-red/added-green; micro-dep or in-repo LCS | ✓ |
| Side-by-side before/after | Wide; doubles scroll on long instructions | |
| Raw before/after blocks | Zero-dep but 'spot the change' is hard | |

**User's choice:** Unified line diff (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Approve/reject only | Editable-diff deferred to 137 sketch | ✓ |
| Editable before approve | Editor + diff interplay 137 should own | |
| You decide | Planner's call | |

**User's choice:** Approve/reject only (Recommended)

---

## Re-eval scope & gate rule

| Option | Description | Selected |
|--------|-------------|----------|
| Same as source run | Apples-to-apples; single-provider-per-run (133 D-01) | ✓ |
| User picks at approval | Confounds the comparison | |
| Full-roster fan-out | N× cost; SEED-100 territory | |

**User's choice:** Same as source run (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No regression + improvement | Case-matched vs source run; previously-passing still pass AND ≥1 previously-failing now passes | ✓ |
| Strict rollup (134 D-07) | All measured pass; blocks promotion on pre-existing unrelated failures | |
| You decide | Planner's call | |

**User's choice:** No regression + improvement (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Full both-arms run | Reuses 133 runner verbatim; first-class run for GATE-01 | ✓ |
| With-skill arm only | Cheaper but forks the shared runner | |
| You decide | Planner's call | |

**User's choice:** Full both-arms run (Recommended)

---

## Claude's Discretion

- Proposals table/column/enum names; router placement (evals.py vs sibling router)
- Proposer prompt + forced-emission schema (anti-injection: evidence woven as DATA)
- Diff util choice (micro-dep vs in-repo LCS)
- Concurrent-proposal policy (suggested: one open proposal per skill)
- SSE event vocabulary for proposal/re-eval progress (additive; reuse eval readout + heartbeat)
- Promotion-write trigger interplay (near-duplicate version row guard)
- Changed-case-set handling in the D-13 comparison (intersection recommended)

## Deferred Ideas

- Edit-before-approve (editable diff) → Phase 137 sketch candidate
- Multi-candidate proposals → future (137 / SI-02)
- Post-run "propose improvement?" nudge → 137 candidate
- Full-roster re-eval fan-out → SEED-100
- Backend-restart run reconciliation (BUG-260702-02) → SEED-100

## Process note

Operator asked mid-session to run the discussion as interactive AskUserQuestion menus with the
recommended option marked — selected via menus throughout (updates the earlier freeform-questions
preference for discuss-phase sessions).
