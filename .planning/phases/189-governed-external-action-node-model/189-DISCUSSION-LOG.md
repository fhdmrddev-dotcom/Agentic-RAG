# Phase 189: Governed External-Action Node Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 189-governed-external-action-node-model
**Areas discussed:** G-5 routing (gate), Node structure, No-live-egress at run time, Decision record, Node face & governance marks

---

## G-5 Routing (guardrail gate, asked before any gray area)

Surfaced first per the orchestrator protocol — G-5 fires on `PhaseNodeCard.tsx`, measured at
**797 L across 4 distinct phases** (184, 185, 188, 188.1) rather than read off the ledger.

| Option | Description | Selected |
|--------|-------------|----------|
| Insert refactor phase 188.2 first | Dedicated behaviour-preserving extraction before the feature phase, the 188.1 shape | ✓ |
| Fold a bounded extraction into 189 as Wave 0 | One phase; mixes refactor and feature in one charter | |
| Proceed as-is, override recorded | Skip the refactor, record the override in STATE.md | |

**User's choice:** Insert 188.2 first.
**Notes:** The foil that argued against folding is 188's own history — it honoured its G-5 budget
by measurement (13 ins / 2 del vs a ≤15/≤4 cap), which capped the diff without reducing the file,
and 188.1 had to exist as a result. `BUG-260806-01` is a natural fold into 188.2.

---

## Node structure

| Option | Description | Selected |
|--------|-------------|----------|
| A 7th `phase_type`: `external_action` | Additive discriminated-union member, the `llm_emit`/101.1 path | ✓ |
| Config on the existing `llm_agent` | MCP tool name in `available_tools`; smallest diff | |
| A `programmatic` registry entry | Closed named operation, deterministic, no LLM | |

**User's choice:** A 7th `phase_type`.
**Notes:** Decided against config-on-`llm_agent` because it makes "external action" invisible in
the schema — the canvas would infer the node's nature from a tool-name string, the exact inference
the 187 face ladder exists to remove. `programmatic` was ruled out on authoring surface: those
phases are internal engine operations with no author-facing config.

| Option | Description | Selected |
|--------|-------------|----------|
| Named capability from a closed set | Closed server-known list; 190 binds each to a real MCP server | ✓ |
| One generic "external action" node | Free-text intent; specific action binds in 190 | |
| Author names the MCP server + tool | Most faithful to "MCP-backed" | |

**User's choice:** Named capability from a closed set.
**Notes:** The MCP-identifier option was weakened by a measured fact — there is **zero MCP code in
the backend**, so nothing could reject a typo until 190.

---

## Governance rails

| Option | Description | Selected |
|--------|-------------|----------|
| The capability IS an entry in `available_tools` | Rides `resolve_phase_available_tools` (D-08) + `_TOOL_REGISTRY` | ✓ |
| A separate capability field + parallel guard | Cleaner separation of concerns | |
| Both — mirrored server-side | Nicest authoring surface | |

**User's choice:** The capability IS an entry in `available_tools`.
**Notes:** Makes SC#1 literally true rather than approximately true. The mirrored option was
rejected on the project's own drift history (two representations of one fact).

| Option | Description | Selected |
|--------|-------------|----------|
| Armed and NOT disarmable on this node type | Structurally true; matches "cannot be wired around a gate" | ✓ |
| Armed by default, author may disarm | Consistent with the graded-governance philosophy | |
| Armed only for capabilities marked high-risk | Genuinely graded, mirrors the grounding dial | |

**User's choice:** Armed and NOT disarmable.
**Notes:** Independently corroborated after the fact — sketch 144 (Phase 185) had already reached
*"the unarmed outbound step on screen argues armed-on by default (= 189 SC#2)"*. The decision
matches the design record rather than inventing against it.

---

## What "no live egress" looks like at run time

| Option | Description | Selected |
|--------|-------------|----------|
| Record the intended action, continue | Structured record as output; 190 swaps the no-op behind an unchanged seam | ✓ |
| Stop with an honest "not connected yet" refusal | Maximally honest; workflow can never complete | |
| Skip the step, mark it not-run | Keeps whole-workflow demos working | |

**User's choice:** Record the intended action, continue.
**Notes:** Skip was argued against as the fail-open shape Phase 188 spent two plans closing
(`finalizeAllPhasesForThread` sweeping `pending` → `done`), which would also make the arming
decorative.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — it publishes, node's state visible | Real shippable slice; 190 upgrades a live workflow in place | ✓ |
| No — gauntlet blocks until a connector exists | Nobody ships a workflow whose external step does nothing | |
| Publishes, but the run refuses to launch | Fails fast and early | |

**User's choice:** Publishes, with the node's state visible.

| Option | Description | Selected |
|--------|-------------|----------|
| Its own worded phase status | Distinct from passed/done at every surface | ✓ |
| Standard done, honesty in the payload | Zero schema change | |
| Both — payload now, worded status in 190 | Keeps 189 migration-free | |

**User's choice:** Its own worded phase status.

| Option | Description | Selected |
|--------|-------------|----------|
| Phase output only — no new audit event | Honours the no-migration flag; `action_risk_pending` already records the approval | ✓ |
| Also a new `harness_audit` event (migration 115) | Strongest operator story | |
| Defer the audit receipt to 190 | Cleanest ledger semantics | |

**User's choice:** Phase output only.

### Follow-up: the status/migration collision (surfaced mid-area, not deferred)

The worded-status choice collided with 189's "no migration" flag. Measured:
`workflow_phases_status_check` caps `status` at five values, so a 6th is migration 115. Put back
to the operator as an explicit fork rather than resolved silently.

| Option | Description | Selected |
|--------|-------------|----------|
| Migration 115 — persist the 6th status | Amend the flag, on the Phase 185 / migration 114 precedent | ✓ |
| Derive at render, column stays `completed` | Zero migration; the 188 "State unknown" precedent | |
| Reuse the existing `skipped` status | No new value | |

**User's choice:** Migration 115.
**Notes:** The 185 precedent's recorded reasoning transferred word for word — *"the zero-migration
promise was a scoping convenience; the honest-pause vocabulary is a correctness property."*
`skipped` was rejected as lying in a different direction: the step did run and a human did approve.

---

## Where the own-vs-Open-Platform decision lives

| Option | Description | Selected |
|--------|-------------|----------|
| A doc under `docs/` + a D-entry in `prd-reset/DECISIONS.md` | Reasoning in the doc, citability in the register | ✓ |
| Only a D-entry in DECISIONS.md | One home, no duplication | |
| Update SEED-013 + SEED-014 in place | Keeps the connector story in one narrative | |

**User's choice:** Doc + D-entry.
**Notes:** Seeds were rejected as a home because they are a dormant backlog with re-open triggers —
a decision buried in one reads as still-pending.

| Option | Description | Selected |
|--------|-------------|----------|
| Record it, with a dated re-open trigger | The deep crawl already reached the verdict | ✓ |
| Re-validate against the current MCP ecosystem | The verdict dates from 2026-07-24 | |
| Record as provisional, decide in 190 | Honest about what has been tested | |

**User's choice:** Record with a dated re-open trigger.
**Notes:** "Provisional" was argued not to satisfy an operator HARD gate.

---

## The node's face and its governance marks

Before this area, the `sketch-findings-agentic-rag` skill was loaded rather than paraphrased (the
standing rule after four icon drifts came from paraphrasing the manifest), and the badge budget was
then verified in `PhaseNodeCard.tsx` itself rather than taken from the ledger.

| Option | Description | Selected |
|--------|-------------|----------|
| Spend slot 1 on the not-yet-connected state | Carries what the card cannot otherwise say; retires when 190 lands | ✓ |
| Spend it on the armed-for-approval state | Most consequential fact on the card | |
| Spend nothing — keep slot 1 free | Most conservative reading of the enforced budget | |

**User's choice:** The not-yet-connected state.
**Notes:** The shipped docblock confirmed 189 holds the **last** free word-badge (*"188 spends ZERO
badge slots: slot 1 is still empty and still reserved for Phase 189"*). Armed-state was argued
against as invariant for the type — and 185 set the precedent by spending no badge at all on
governance, using the corner seal instead.

| Option | Description | Selected |
|--------|-------------|----------|
| Config-derived from the chosen capability | Tier 2 of the 148-C ladder, computed at render | ✓ |
| One fixed type sentence for all external actions | Simplest, honest at the type level | |
| Technical capability name as title, sentence beneath | Most precise | |

**User's choice:** Config-derived from the chosen capability.
**Notes:** The fixed-sentence option reproduces the measured VOCAB-02 failure (only 10 of 119
phases carry a `phase.name`, so the generic sentence is what users see). The technical-title option
inverts 149-C, which puts the meaningful plain title first and swaps only the subtitle.

---

## Claude's Discretion

- The exact membership and naming of the closed capability set — constrained to align with 190's
  email / JIRA / Slack slice and to stay disjoint from `KB_TOOLS`.
- The exact status word (D-07) and badge word (D-12), constrained by the recorded vocabulary rules.
- The 7th `PHASE_GLYPHS` entry — mechanical under the single-source icon convention.

## Deferred Ideas

- A `harness_audit` event for the recorded intent → Phase 190 (trigger: the first live outbound call).
- An escape hatch to disarm action-risk on a low-consequence action → Phase 190 (trigger: real
  usage showing an external capability whose consequence does not warrant approval).
- A per-capability risk taxonomy — no egress exists in 189 to calibrate risk against.
- Who may extend the closed capability set, and how → with 190's credential/org-scoping work.
- How 190 swaps the no-op for a real call without re-authoring → a 190 planning concern.
- **Reviewed, not folded:** `spike-nl-workflow-authoring.md` (todo match, score 0.6 on generic
  keywords) — NL authoring is Phase 187's shipped territory, no genuine overlap.
