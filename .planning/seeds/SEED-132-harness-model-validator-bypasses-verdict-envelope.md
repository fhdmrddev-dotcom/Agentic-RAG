---
seed_id: SEED-132
title: "Two WorkflowDefinition @model_validator rules raise raw Pydantic 422s before POST /workflows/validate runs — the only validation rules not expressible in the {ok, verdicts} envelope, and both fire on exactly what a half-configured node looks like"
status: open
planted: 2026-07-25
phase_origin: "Phase 182 verification (182-VERIFICATION.md Anti-Patterns, WR-07) — surfaced at verification, deliberately deferred at gap closure. The gap-closure wave fixed the SC#4 keying blocker (182-04), the publish-enforcement gap (182-06) and the fail-open severity classifier (182-07). This one is deferred because the right fix depends on how the canvas renders a partially-configured node, which Phase 184 decides."
folded_into: null
category: "API surface / error-model consistency — a second, un-server-mapped error surface on a route whose entire purpose is to be the single machine-renderable source of validation truth. Not a security or correctness defect: the rules themselves are right, and the 422 is a legitimate tier. The cost is that a client must implement two rendering paths for one question."
related_seeds: [SEED-131]
related_decisions:
  - "D-182-06 (182-CONTEXT.md) — red line D-14: one lint copy, ZERO client-side re-implementation; the canvas is a pure client of this seam. This finding does NOT violate that rule and must not be written up as if it did: nothing is re-implemented client-side, and both rules live server-side in exactly one place. The tension is narrower — the client receives the ANSWER in two incompatible formats depending on which rule fired."
  - "D-182-03 — verdicts are `{code, phase, message, severity}`, per-node-keyed, with `incomplete` reserved for `not-yet-ready` conditions the author is still working through. Both bypassing rules are textbook `incomplete` conditions, so the taxonomy already has the right slot for them; they simply never reach the code that assigns it."
  - "182-RESEARCH.md:253 (Anti-Patterns) — `extra=\"forbid\" relaxation — never; the 422 IS the shape tier. Do not accept a lenient dict body to avoid 422s.` This constrains the solution space absolutely: the fix can NEVER be a looser request model."
  - "182-RESEARCH.md:133-136 (the request-flow diagram) — the shape tier is a DELIBERATE, documented layer that sits ahead of the handler and mirrors `create_draft`. The two `@model_validator` rules were placed there on purpose, and both carry in-line comments explaining that they are the STRUCTURAL half only, with the DB-aware half living elsewhere. This is a coherent design, not an oversight — which is why the fix is a mapping, not a relocation."
confirmed:
  - "Both rules exist and both are pre-handler. `backend/app/models/harness.py:252-264` (`_folder_scope_requires_project`) raises when a phase declares `folder_scope` while the workflow has no `project_folder_id`; `backend/app/models/harness.py:266-280` (`_skill_snapshot_requires_ref`) raises when a phase carries a `skill_snapshot` with no `skill_ref`. Both are `@model_validator(mode=\"after\")` on `WorkflowDefinition`, so FastAPI's body parse raises `ValidationError` -> HTTP 422 before `validate_workflow` is entered."
  - "The route's own docstring already documents the bypass as known behavior: `backend/app/api/workflows.py` (`validate_workflow`, :400-403) — `A phase declaring folder_scope on an unbound workflow also 422s at the shape tier (the @model_validator), so it never reaches this handler; an empty phases: [] IS shape-valid and lands here as an incomplete no_terminal.` So the asymmetry is acknowledged in source; what is missing is a decision about whether the client should have to care."
  - "Both trigger conditions are ordinary mid-authoring states, not malformed input. A phase gets a `folder_scope` before the workflow gets its `project_folder_id`; a `skill_snapshot` is present while the `skill_ref` is being re-picked. In both cases the author is mid-edit and the correct answer is `incomplete`, i.e. `you are still building` — the exact severity D-182-03 invented for this situation."
needs_confirmation:
  - "Whether the canvas will POST a definition in these states at all. If Phase 184's client serializer (`canvasModel.fromCanvas`) always emits `project_folder_id` before any per-phase `folder_scope`, and never emits a `skill_snapshot` without its `skill_ref`, the 422 is unreachable from the canvas and the priority drops to low. Confirm against the serializer's actual emission order at 184 sketch/plan time — do NOT assume it either way. Note the same 422 stays reachable from a hand-crafted API call regardless."
  - "Which mapping mechanism to use. Option A: a `RequestValidationError` exception handler scoped to this route that translates the two known validator messages into `{ok: false, verdicts: [...]}` with `severity: incomplete` — keeps the model untouched but couples the handler to message text, which is the prose-parsing pattern D-182-06 exists to discourage (even server-side). Option B: give the two validators typed exceptions carrying `phase_slug` and map on the TYPE, mirroring exactly what plan 182-04 did for `FolderScopeSubsetError` (a ValueError subclass with a structural `phase_slug` attribute and a byte-identical message, so every existing `except ValueError` caller was unaffected). Option B is the established in-repo precedent and preserves per-node keying; prefer it unless 184 finds a reason not to."
  - "Whether the mapping should apply to `/validate` ONLY. Every other route that parses a `WorkflowDefinition` (create_draft, update_draft) legitimately wants the 422 — a write request with a half-formed body SHOULD be refused. `/validate` is the only route whose contract says a dirty definition is advice rather than an error, so the mapping must be route-scoped, not global."
re_open_triggers:
  - "Phase 184 must render validation state for a PARTIALLY-CONFIGURED node (SC#4: `each node shows a per-node validation status derived from the server verdict, never a client-side guess`) and hits a 422 with no verdict payload — no `code`, no `phase`, no `severity`, so no node to attach a badge to. This is the primary trigger: the badge work and this gap are the same problem seen from two ends."
  - "Any proposal to let `/validate` accept a lenient body (a raw `dict`, `extra=\"allow\"`, or `extra=\"ignore\"`) in order to `avoid 422s`. REJECT IT — `182-RESEARCH.md:253` forbids relaxing `extra=\"forbid\"`; the 422 IS the shape tier and it is the same guard that makes an injected/unknown body key a hard refusal. The fix must be a 422-to-verdict MAPPING at the handler or a route-scoped FastAPI exception handler, never a looser model. Anyone reaching for the looser model has mis-diagnosed the problem."
  - "Phase 185 adds the per-node grounding-MODE verdict (GOVERN-01/02) to the same envelope. Graded governance is the milestone's headline claim, and it is claimed THROUGH this envelope — a governance surface with two incompatible error formats undermines the claim that the canvas can be a pure client of one seam. One uniform error envelope becomes load-bearing at that point."
  - "A third `@model_validator` is added to `WorkflowDefinition` or `PhaseConfig`. Each one silently widens the set of rules that cannot be expressed as a verdict; decide the mapping BEFORE adding it rather than growing the bypass set."
priority: high
suggested_phase: "Phase 184, alongside the per-node badge work (VALID-03) — the badge cannot be honest about a node the server refuses to describe, so the two land together. Cheap if done with the 182-04 typed-exception precedent (Option B); expensive if deferred until the canvas has already grown a second error-rendering path around it."
surface: Agentic-RAG
trigger_when: unset
---

# SEED-132 — two `@model_validator` rules bypass the `{ok, verdicts}` envelope

## The gap

`POST /workflows/validate` promises a machine-renderable envelope for every validation
question: `{ok, verdicts: [{code, phase, message, severity}]}`, per-node-keyed, with a severity
taxonomy that distinguishes "this is broken" from "you are still building" (D-182-03).

Two validation rules never reach it. They live on the request model itself and fire during
FastAPI's body parse:

| Rule | Location | Fires when | What the client gets |
|---|---|---|---|
| `_folder_scope_requires_project` | `backend/app/models/harness.py:252-264` | a phase declares `folder_scope` but the workflow has no `project_folder_id` | HTTP 422, raw Pydantic error body |
| `_skill_snapshot_requires_ref` | `backend/app/models/harness.py:266-280` | a phase carries a `skill_snapshot` with no `skill_ref` | HTTP 422, raw Pydantic error body |

No `code`. No `phase`. No `severity`. No `ok`. A client that wants to answer one question — "is
this workflow valid, and which node is unhappy?" — must implement two unrelated parsers.

## The honest framing (what this is NOT)

This is **not** a D-182-06 / D-14 violation, and writing it up as one would be wrong:

- Nothing is re-implemented client-side. Both rules exist exactly once, server-side.
- The 422 tier is deliberate and documented (`182-RESEARCH.md:133-136`), mirrors `create_draft`,
  and is the same guard that makes an unknown or injected body key a hard refusal.
- Both validators carry in-line comments stating they are the STRUCTURAL half only, with the
  DB-aware half deliberately living in `scope.py` / `skill_snapshot.py`. That separation is sound.
- The route's own docstring (`workflows.py:400-403`) already names the bypass, so nobody was
  misled.

What IS true is narrower and still worth fixing: the seam has **two error formats for one
question**, and the split falls in the worst possible place. Both bypassing conditions are exactly
what a **half-configured node looks like mid-authoring** — a `folder_scope` set before the project
binding, a `skill_snapshot` left behind while the `skill_ref` is re-picked. Those are the moments a
live canvas most needs a renderable per-node verdict, and they are precisely the moments the
envelope is unavailable.

## The solution space is constrained

`182-RESEARCH.md:253` states the hard boundary:

> **`extra="forbid"` relaxation** — never; the 422 IS the shape tier. Do not accept a lenient
> `dict` body to "avoid 422s".

So the fix is a **mapping**, at the handler or in a route-scoped exception handler — never a looser
model, never a relocated rule, never a client-side special case.

The in-repo precedent already exists. Plan 182-04 solved the structurally identical problem for the
folder-scope ⊆ check: it introduced `FolderScopeSubsetError`, a `ValueError` subclass carrying the
offending `phase_slug` as an **attribute** with a byte-identical message, so every pre-existing
`except ValueError` caller kept working unchanged while the seam gained structural per-node keying.
The same shape applies here: typed exceptions carrying `phase_slug`, mapped on TYPE rather than on
message text, so the resulting verdicts key to a node like every other verdict does.

## How we would know this is closed

1. `POST /workflows/validate` with a definition where one phase declares `folder_scope` and
   `project_folder_id` is `None` returns **HTTP 200** with a verdict carrying a stable `code`, the
   offending phase's `slug` in `phase`, and `severity: "incomplete"`. Same for a `skill_snapshot`
   without a `skill_ref`. Two tests, both of which must FAIL against today's code before being
   trusted.
2. The verdict's `phase` is populated **structurally** — a test asserts it directly, and a reader
   can confirm the slug is not recovered by splitting or regexing the message (the 182-04
   discipline; parsing prose server-side would legitimize the same pattern one layer down).
3. `POST /workflows` (`create_draft`) and `PATCH /workflows/{id}` (`update_draft`) still return
   **422** for the same bodies — a regression test pins this. The mapping is route-scoped to
   `/validate`; a write request with a half-formed body must still be refused.
4. `grep -n 'extra=' backend/app/models/harness.py` still shows `extra="forbid"` on
   `WorkflowDefinition`, and a body with an unknown key still 422s on `/validate`. The shape tier
   survives the fix intact.
5. Any client (or the Phase-184 canvas) can answer "which node is unhappy and how badly?" by
   reading `verdicts[]` alone, with no second parser for a Pydantic error body — verifiable by
   grepping the frontend for any handling of a 422 response from the validate route and finding
   none beyond a generic network-error path.
