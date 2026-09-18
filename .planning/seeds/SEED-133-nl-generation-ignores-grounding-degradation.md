---
seed_id: SEED-133
title: NL workflow generation ignores GroundingBundle.degraded — a folder-blind draft is presented as ok
status: open
planted: 2026-07-25
planted_by: Phase 182 round-3 gap closure
surface: Agentic-RAG
severity: warning
affected_areas: [workflow-authoring, grounding, nl-generation]
re_open_trigger: >
  Re-open when Phase 187 (VOCAB-02 NL-seeded canvas draft) is scoped — that phase makes NL
  generation a primary authoring path, which turns this from "a draft is quietly folder-blind"
  into "the canvas seeds nodes against a registry we could not read". Also re-open if a support
  report describes an NL-generated workflow whose folder_scope or skill_ref came back empty for
  no apparent reason.
trigger_when: unset
---

# SEED-133 — NL generation is the one grounding consumer that does not branch on `degraded`

## What

`grounding.assemble_grounding_bundle` records an unresolvable registry on
`GroundingBundle.degraded` (Phase 182 plan 182-11). As of the round-3 gap closure there are
four consumers, and three of them branch on it:

| Consumer | Branches on `degraded`? | Behaviour on a registry outage |
|---|---|---|
| `POST /workflows/validate` | yes (182-11) | one honest `grounding_unavailable` verdict |
| publish stage 2.6 | yes (182-11) | blocks with `grounding_unavailable` |
| `GET /workflows/grounding-bundle` | yes (round-3 fix) | serves what resolved + names what did not |
| `workflow_authoring` NL generation | **no** | silently produces a folder-blind draft as `{"ok": True}` |

## Why it was left open

The round-3 pass was explicitly scoped by the operator to two fixes plus a decision on SC#3.
This is the third item, and it is genuinely lower severity than the two that were fixed: an NL
draft is a starting point the author then edits and must still pass `/validate` and the publish
gauntlet — both of which now report the degradation honestly. Nothing unsafe SHIPS because of
this; the author just gets a worse first draft than they think.

## The disproven defence (do not re-derive it)

`grounding.py`'s module docstring used to defend this consumer with:

> its own fidelity check re-reads the folder tree through the ⊆ walk, so its behaviour is
> unchanged by this guard

That is false for the common case, and the round-3 verification disproved it against source.
A freshly NL-generated draft has no `project_folder_id` yet, and
`scope.resolve_project_subtree` returns `None` for an unbound definition
(`backend/app/services/harness/scope.py:124-125`) — so the ⊆ walk is a no-op that re-reads
nothing. The docstring has been corrected in place to say this; the claim is recorded here so a
future editor does not re-invent it from first principles.

## Fix sketch

Thread `bundle.degraded` into the NL-generation result the same way the other three consumers
do — either refuse to emit folder/skill-grounded config when the corresponding registry is
degraded, or return the draft with an explicit "generated without folder grounding" marker the
Studio can render. The mechanism already exists (`grounding.grounding_unavailable_finding`);
this is a consumer wiring gap, not a new design.

Related: [[SEED-131]] (the `/validate` always-200 invariant), and Phase 182's
`182-VERIFICATION.md` Truth 8.

---

## Trigger fired and was missed — 2026-08-06

**This seed's original re-open trigger was *"when Phase 187 is scoped."* Phase 187 was scoped,
planned across 29 plans, executed, verified and closed — and this seed was never consulted.** The
miss was caught only by `/gsd:audit-milestone` on 2026-08-06, which found
`grep -c degraded backend/app/services/workflow_authoring.py` → **0** while auditing the 182↔187
integration seam.

That is a lesson about the trigger, not about anyone's diligence: **a trigger phrased as a condition
someone has to remember to check is not a trigger.** It fires silently and nobody hears it.

### Status: OPEN — `accept`ed once, deliberately, with a harder trigger

`/gsd:secure-phase 187` (2026-08-06) registered this as **`T-187-SEED-133`** in
`.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-SECURITY.md` — the one row in that
phase's 152-threat register that the plan-time register never named. The operator dispositioned it
**`accept`** at the security gate, on the ground that the folder-blind draft still passes
`POST /workflows/validate` and the publish gauntlet (both of which DO honour `bundle.degraded`), so
the blast radius is a misleadingly confident first draft rather than an unsafe published workflow.

**The seed is NOT closed by that acceptance.** The defect is present in shipped code.

### Replacement trigger (binding — supersedes "when Phase 187 is scoped")

- **(a) Phase-bound:** `/gsd:discuss-phase 189` MUST surface this seed. 189 is the next phase on the
  authoring/generation surface. It is recorded in `STATE.md` alongside 189's other mandatory
  discuss-phase item (the `PhaseNodeCard.tsx` G-5 refactor recommendation).
- **(b) Mechanical, phase-independent:** while
  `grep -c degraded backend/app/services/workflow_authoring.py` returns **0**, the defect is live and
  the acceptance stands. The moment it returns non-zero, this seed is superseded and must be
  **re-verified, not re-accepted**.
- **(c) Immediate escalation:** if any consumer starts treating `POST /workflows/generate`'s
  `ok: true` as evidence the grounding registry was READ — rather than merely that the model returned
  a schema-valid definition — this stops being Medium and must be fixed BEFORE that consumer ships.

### The acceptance has a dependency that must be watched

The whole justification is that the sibling consumer is honest. If `api/workflows.py`'s validate path
(currently `:685-690`) ever stops branching on `bundle.degraded`, the downstream catch this
acceptance rests on disappears and **the disposition is void** — not weakened, void.
