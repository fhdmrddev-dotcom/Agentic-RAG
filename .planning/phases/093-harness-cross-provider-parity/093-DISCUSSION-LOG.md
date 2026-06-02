# Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 093-harness-cross-provider-parity (rescoped from "Anthropic Cross-Provider Parity")
**Areas discussed:** Phase identity/rescope, Provider-parity architecture, Stale-model root cause, Seed-workflow fixes + safe-by-construction, Output surfacing split, Phase packaging, Settings-at-scale theme

---

## Pre-work: live-code verification

Before presenting decisions, a 5-agent read-only workflow verified the 092 comprehensive audit's
claims against current code (post-092-07) and mapped the do-not-break surface. Result: audit holds
(5 minor precision corrections — e.g., `override_provider` is in `models/user_settings.py` not
`services/`; `_effective_model` returns `''` then falls through downstream). All F1–F8 confirmed
present. Honest scale confirmed: 2/5 phase-types, 1/4 seed workflows, 1/7 providers.

## Phase identity / rescope (opening decision)

| Option | Description | Selected |
|--------|-------------|----------|
| Harness hardening | Rescope 093 to the audit's "Phase A" (harness cross-provider + phase-types); re-defer PARITY-01 | ✓ |
| Keep narrow (PARITY-01) | Keep Deep-mode Anthropic polish; insert harness work as a separate phase | |
| Both in one 093 | One phase covering harness backend + Deep-mode polish | |

**User's choice:** Harness hardening. **Notes:** Operator added that PARITY-01's bugs exist but the
code-gen tool-card labels + Anthropic summary aren't reproducing now, and high Anthropic iteration
count "maybe this is the behaviour of anthropic." Set the **red line**: "please always investigate and
do not break working things." → PARITY-01 re-deferred; harness is the priority.

## Provider-parity architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Deep's path (shared gateway) | Route harness LLM calls through the same proven provider machinery via a shared gateway both consume | ✓ (upgraded) |
| Duplicate in harness | Add Anthropic/Google/STRUCTURED handling inside the harness (3rd copy) | |
| Lock goal, planner picks | Defer mechanism to research/plan | |

**User's choice:** Operator pushed deeper — "isn't it better to separate per feature? most reliable +
scalable + maintainable + easy to find bugs." This upgraded the recommendation to: extract the shared
**provider gateway** as its OWN foundational phase (092.5), Deep byte-identical, then 093 consumes it.

## Stale-model root cause / settings-at-scale

| Option | Description | Selected |
|--------|-------------|----------|
| Harness boundary only | Resolve model from provider at ctx-build; don't touch global setting | (folded into root-fix) |
| Also reset app-wide | Reset llm_model globally on provider switch | (rejected — surprises pinned-model users) |
| Both (guarded) | Boundary fix now + app-wide reset later | |

**User's choice:** "if we are planning to have admin and full controllability over app settings... we
fall into difficulties when we scale." → Root-fix via ONE shared model-resolver (resolve, don't mutate);
broader admin-settings theme seeded (SEED-024/SEED-012), not patched per-phase.

## Seed-workflow fixes + safe-by-construction

| Option | Description | Selected |
|--------|-------------|----------|
| Fix both | split_topic code fix + verify-gate route-forward | ✓ |
| Split fix only | Only revive the fan-out | |
| Split in 093, gate separate | Gate as separate migration | |

**User's choice:** Fix both — AND raised the key question: "if we build a workflow builder, how do we
guarantee user-built workflows won't need code fixes?" → D-10: harden the 5 phase-types into
safe-by-construction validated primitives + extend the publish-time reachability lint to catch
input/output-contract breaks (so bad workflows fail validation, not at runtime).

## Output surfacing split

| Option | Description | Selected |
|--------|-------------|----------|
| Plumbing in 093, chrome in 094 | 093 makes draft+answer reach screen via existing events; 094 builds the frame | ✓ |
| Plumbing + minimal draft UI in 093 | Pull a little UI forward | |
| All surfacing to 094 | 093 backend-only | |

**User's choice:** Plumbing in 093, chrome in 094 (sketch-first). Agree the event-shape contract now.

## Phase packaging (final structural confirmation)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate gateway phase first | 092.5 gateway (Deep byte-identical, own gate); 093 consumes it | ✓ |
| One phase, extraction first inside it | Gateway as 093's first isolated step | |
| You decide the boundary | Defer to planning | |

**User's choice:** Separate gateway phase first.

## Settings-at-scale theme handling

| Option | Description | Selected |
|--------|-------------|----------|
| Root-fix now + seed the wider theme | Shared resolver now; admin-settings theme → SEED-024/012 | ✓ |
| Tackle settings strategy now | Pull admin-settings design into 093 | |
| Root-fix only | No theme capture | |

**User's choice:** Root-fix now + seed the wider theme.

## Claude's Discretion
- Gateway consumption mechanism inside task_service; shared model-resolver signature/location; shared answer-surfacing helper shape (subject to the red line + additive constraints).

## Locked on evidence (not asked)
- ask_user fix = Option (i) endpoint-detects-workflow_run (mirrors the Continue endpoint's existing fallback).
- Resume/Continue surfacing = single shared helper `run_workflow` calls on success terminal.
- native-7 × 5-phase-type × 4-workflow live UAT gate + live-DB/real-provider tests (closes the mock blind spot).

## Deferred Ideas
- Phase 092.5 (gateway extraction, ships first), Phase 094 (legibility chrome, sketch-first), PARITY-01 (re-deferred), SEED-024/012 (admin settings at scale), SEED-028 (native Google service behind the gateway).

---

# Re-discuss session — Gap-Closure (post-LIVE-UAT)

**Date:** 2026-06-02
**Trigger:** `/gsd:discuss-phase 093` re-invoked after the mandatory LIVE cross-provider UAT (D-13) surfaced real backend gaps. Original D-01…D-14 unchanged + executed (5 plans shipped + verified `human_needed`).
**Areas discussed:** Gap-closure structure, Provider round-trip (Google+Moonshot), GLM/zhipu max_steps, S3 gpt-4o sub-agent default + S4 token persistence, Log-sink + re-UAT gate, Per-provider sub-agent setup (operator-added).

## Pre-work: code grounding
Read `task_service.py` (the `:299-300` ignored-`finish` site + `:271-273` ignored `reasoning_delta` + the `run_task_sub_agent` model resolution `:390-394`), `sub_agent_models.py` (resolver + `resolve_workflow_ctx_model`), and `config.py` (`_SUB_AGENT_MODEL_DEFAULTS` `:594-604` + `settings.llm_model="gpt-4o"` `:635`). Key insight: ONE ignored `finish` event causes the Google round-trip, the Moonshot round-trip, AND S4 — fixed together by consuming it.

## Q1 — Gap-closure structure

| Option | Description | Selected |
|--------|-------------|----------|
| Gap-closure plans in 093 (093-06+) | Stay in 093; PARITY-02 owned by 093; mirrors 092-05/06/07 | ✓ |
| New decimal phase 093.1 | Fresh insert phase; PARITY-02 spans two dirs | |

**User's choice:** Gap-closure plans in 093 (093-06+). → **D-15**

## Q2 — Areas to discuss
**User's choice (multiSelect):** ALL four (provider round-trip, GLM, S3+S4, log-sink+re-UAT) PLUS a free-text addition: *"how are you planning to set up sub-agent for each provider?"* — answered with the per-provider table in CONTEXT `<gap_closure>`.

## Q3 — Sub-agent model default (per provider)

| Option | Description | Selected |
|--------|-------------|----------|
| Fast per-provider tier (current design intent) | `_SUB_AGENT_MODEL_DEFAULTS`; user `sub_agent_model` override; fix the gpt-4o-bounce wiring | ✓ |
| Mirror the run's main model | Sub-agents use the user's picked model; higher cost/quality | |

**User's choice:** Fast per-provider tier. → **D-18**

## Q4 — GLM/zhipu max_steps gate

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnose-first; fix if bounded, defer-with-trigger if deep | Live GLM run + LangSmith + DB; don't block PARITY-02 indefinitely on one provider | ✓ |
| Hard gate — 093 doesn't close until GLM green | All-7 must pass, open-ended scope | |

**User's choice:** Diagnose-first; fix if bounded, defer-with-trigger if deep. → **D-19**

## Q5 — Backend log-sink

| Option | Description | Selected |
|--------|-------------|----------|
| Add now in 093 (small task) | uvicorn → logfile; agent self-scans re-UAT signals; reusable by 096 | ✓ |
| Defer to 096 | Lands with the automated UAT harness | |

**User's choice:** Add now in 093. → **D-20**

## Locked on evidence (not asked)
- Provider round-trip fix = consume the gateway `finish` event (mirror Deep's `_on_chunk` finish-branch + `_reconstruct_history`), provider-scoped + additive, D-14 byte-identical-Deep guard (`task_service.py` is shared). → **D-16**
- S4 token persistence = the same finish-event `usage` persisted to `runs.usage`. → **D-17**
- Re-UAT gate = per-workflow 2×2 rotation (findings-doc §9), backend-truth focus, PARITY-02 closes only when it passes; inherits the D-13 proof method. → **D-21**

## Reported-bugs cross-check (touchpoint)
- 3 open `surface: Agentic-RAG` reports (chat-tool-cards-scroll-collapse-duplicate, step-count-mismatch-timer-vs-panel, timer-disappears-long-runs) = all frontend; none overlap the 093 backend domain → left open, owned by 094/095.
- 2 closed twins (gemini-3-thought-signature, sub-agent-cross-provider-model-default-404) = the harness-path versions are now folded into 093 via D-16/D-18; the Deep-path closures still hold (not re-opened).

## Findings routed out of 093
S1 → 095 / 096 CONC-01; S2 + S5 → 094 (D-094-UNIFY); automated per-workflow UAT → 096.
