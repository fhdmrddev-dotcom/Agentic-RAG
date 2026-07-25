---
id: SEED-133
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
