---
id: BUG-261021-05
title: An escalated step is sealed 'Must prove it' in the builder and on the canvas, but the engine attaches no check to it
reported: 2026-10-21
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/workflow-builder, frontend/workflow-canvas, backend/harness-grounding]
folded_into: "296"
verified_closed_by: null
related_seeds: []
re_open_trigger: "CLOSE when 296-HUMAN-UAT optional row 9 (the escalated-step seal) reads PASS with evidence (set status closed, verified_closed_by \"296\", re_open_trigger null). A FAIL routes back to its owning 296 plan under G-7."
fixed_by_commit: "296-07: RED e074515f5, GREEN ef2832f46 (D-04 amended option b: the seal, gate row and attached-gate line no longer claim a check for escalated; the step says nothing is checked). The engine half (a real search tool) is SEED-384"
reproduces_on:
  branch: develop
  commit: ed9792704
  date: 2026-10-21
---

# BUG-261021-05: an escalated step is sealed "Must prove it", but nothing checks it

Filed by Phase 290 plan 290-04 under decision D-20 (file, do not fix). Found by 290-RESEARCH F-2 while building the team picture, then re-measured at execution on `develop` `ed9792704`. Every line number below was read at that commit.

## What we observed

On a step the author has escalated, the builder and the canvas both say the step must prove its work. The engine adds no check to that step. "Escalated" here means a grounding-dial step with no knowledge-base tool and `grounding_escalated: true`, for example an `llm_agent` whose only tool is `web_search`.

**What the client claims (frontend):**

- `frontend/src/pages/WorkflowBuilderPage.tsx:436-445`. `gatesFor` returns a locked gate row labelled `GOVERNANCE_GATE_ROW_LABEL` when `cause === "detected" || cause === "escalated"` (line 442). The label is defined at `frontend/src/components/workflows/definitionOps.ts:560-561` as *"Must prove it — retrieved sources, pointed at in the answer"*. Its docblock (`:403-435`) says the row is "an author-time warning about a real consequence, not decoration".
- `frontend/src/components/workflows/canvasModel.ts:382-384`. `isGrounded` is `groundingCauseOf(phase, kbTools) !== null`, so any non-null cause counts, including `escalated`. That boolean reaches `NodeCornerMarks.tsx:289-302` (through `canvasModel.ts:525` and `PhaseNodeCard.tsx:483`), which draws the corner seal `⛨` with the screen-reader label `GOVERNANCE_SEAL_LABEL` = *"Must prove it"* (`definitionOps.ts:505`).

**What the engine does (backend):**

- `backend/app/services/harness/grounding.py:1367`, `effective_phase`, is the only place the engine adds a gate. At `:1419-1433` it appends the `citations_required` validator (`on_failure="fail_run"`, `max_retries=2`) only when `grounding_cause(phase) == "detected"` (`:1424`). The comment at `:1419-1423` says so: *"Only 'detected': an 'already-set' step declared its own policy and an 'escalated' one is the author's own doing."*
- `grounding.py:1182-1188`, `grounding_cause`, returns `"escalated"` only when the step has no KB tool and no `citation_policy == "strict"`. Every backend caller of `grounding_cause(...)` compares it with `"detected"`: `grounding.py:1206`, `grounding.py:1424` and `backend/app/api/workflows.py:988`. None of them checks for `"escalated"`.
- `backend/app/services/harness/engine_ask.py:740-746`. `is_locked` reads the stored `grounding_escalated` bit directly. Its only consumers (`:948`, `:1132-1133`) narrow the choices of an engine pause, which removes "continue without sources". An engine pause only happens after a citations check fails, and only a `detected` step has that check. So on a step that is only escalated, the bit changes nothing at run time.
- The repo has no other read of `grounding_escalated` (`backend/app/models/harness.py:554` is the field declaration).

**How Phase 290 makes the conflict visible:** the team picture (`frontend/src/components/workflows/teamModel.ts:253`) draws the derived citations check only when `groundingCauseOf(...) === "detected"`, which matches the engine (decision D-18). For an escalated step it draws no gate and shows the absence line `TEAM_NO_GATES` = *"Nothing checks this work."* (`teamVocabulary.ts:160`). Open the same escalated step on two surfaces of one builder and you get two answers:
- **Steps view:** the corner seal reads "Must prove it", and the selected step's gates rail shows a locked "Must prove it — retrieved sources, pointed at in the answer" row.
- **Team view:** the step reads "Nothing checks this work."

The team picture is the one that matches what the engine does.

Not yet driven live. The planned G-4 rows in `290-VALIDATION.md` (at `/gsd:verify-work 290`) record how the two views read side by side on a real escalated step.

## Why it matters

A governance claim that the engine does not enforce gives false assurance. An author who escalates a web-research step to "must prove it" sees a seal and a locked gate row and reasonably assumes the run will be held to citations. It will not be: the step can answer with no sources and the run carries on. The builder's own docblock calls the row a warning about "a real consequence"; for this cause there is none. Severity is `major` rather than `blocking` because nothing is lost or leaked. The harm is that a promise is made and not kept, on the governance surface whose whole purpose is to be believed.

## Hypothesized cause

*Hypothesis, not finding.* The client takes any non-null grounding cause to mean "governed" (`isGrounded` is `!== null`, and `gatesFor` accepts `detected || escalated`). The engine gates only one of the three causes. Phase 185 (D-185-01/04/08) wrote both readings, and the engine comment calls escalation "the author's own doing, which the shipped paths already handle". As measured above, no shipped path handles it for a step without KB tools. So the authored escalation bit has a UI meaning and no engine meaning.

## Surface classification

`Agentic-RAG`. Both halves are this app's own code: the builder and canvas in `frontend/`, and the harness grounding seam in `backend/`.

## Suggested routing

- **Fold into in-flight phase:** n/a. Not folded into 290: D-20 decided to file this, not fix it, because 290 is a read-only picture phase with no backend change, and any fix changes either the engine or a governance claim.
- **Defer to future phase / milestone:** a governance-honesty phase. That phase has to decide which side moves:
  - (a) the engine adds the citations check to escalated steps too. This is a behaviour change, and it can make previously passing runs fail on steps with no KB tool, which have no retrieval path to satisfy the check (`grounding.py:1176-1178` gives this as the reason `folder_scope` is not an input); or
  - (b) the seal and the gate row stop claiming a check for `escalated`, and escalation says what it actually does.
- **Plant as seed:** not yet. Plant one if the routing decision is deferred past the next milestone.
- **External — note only:** no.

### Related observation (not a second bug)

The `already-set` cause has a smaller drift of the same kind. The frontend reads `already-set` only when the definition explicitly says `citation_policy: "strict"` (`phaseVocabulary.ts:377` `STRICT_CITATION_POLICY`, and the `already-set` arm that returns at `:445`; RESEARCH Open Question 2). The backend model defaults `citation_policy` to `"strict"` (`backend/app/models/harness.py:169`), so on the server an `llm_emit` step with no explicit policy reads `already-set`. Phase 290 deliberately does not draw an emit step's own sourcing policy as a gate (D-20). The 290 UAT records how "Nothing checks this work." reads on a writing step. Whether that sentence is honest there is for the same governance-honesty phase to decide, together with this report.

## Workarounds (prompt-side, code-side, or UI-side)

If a step must be held to citations, give it a knowledge-base tool (`search_documents`). That makes its cause `detected`, and the engine then adds the check. Use the team picture (`Steps | Team` switch, Phase 290) as the source of truth for which steps are actually checked.

## Reference / evidence links

- `.planning/phases/290-the-card-and-the-team-picture/290-RESEARCH.md`: F-2 and Open Question 2
- `.planning/phases/290-the-card-and-the-team-picture/290-CONTEXT.md`: D-18 and D-20
- Phase 185 graded governance: D-185-01/04/05/08/19
