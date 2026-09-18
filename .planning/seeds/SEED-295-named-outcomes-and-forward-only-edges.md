---
seed_id: SEED-295
title: "Named outcomes + forward-only edges — the list-to-DAG change that adds NO executor and NO expression language. ⛔ UNJUSTIFIED until one real workflow is authored and recorded as blocked."
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: |
  Planted 2026-09-18 from an outside comparison document (archived at
  `screenshots/AGENTIC-RAG-VS-AIRIA-AND-THE-WORKFLOW-ENGINE-2026-09-18.md`, §5) that was then
  reconciled against the tree the same day. ⛔ **THE SEED IS PLANTED AS UNJUSTIFIED, DELIBERATELY.**
  The idea is coherent and the mechanism is cheap; what does not exist is a recorded case of a real
  business process that could not be authored. `SEED-141`'s own precondition — *"establish that the
  need is real"* — is still UNMET, and branching is currently supported by a competitor screenshot
  and a document, not by a blocked workflow of ours. The operator has taken that as the next step.
trigger_when: >
  ⛔ DO NOT SCOPE THIS UNTIL BOTH OF THESE ARE TRUE:

  (1) EVIDENCE — the operator (or anyone) has authored a real branching business process against the
  SHIPPED engine and recorded, concretely, where it broke or where the route was too indirect to
  find. Until that artifact exists this seed stays planted. A competitor screenshot is not evidence.

  (2) GATE D1 IS ANSWERED — what `INPUT_UNSATISFIED` means once "upstream" is path-dependent. See
  the Gate section. This is an ENGINEERING decision and may be answered by whoever scopes it.

  ⛔ GATE D2 (what "published" certifies) is an OPERATOR decision and is EXPLICITLY LEFT OPEN by the
  operator, 2026-09-18: *"It's a product claim, not an engineering pick — it decides what I can tell
  an enterprise or government buyer that 'published' means."* Three options are recorded below.
  Scoping may not choose one on the operator's behalf.

  Fire ALSO, independently, on: any phase proposing a conditional edge, a switch node, an
  approve/reject route, a loop, or a user-authored condition expression in the workflow engine.

  Fire ALSO if `EXT-01` (Phase 255) has NOT yet landed — the extension contract is what distinguishes
  "we add an edge model" (permitted) from "a partner adds an outcome type" (refused). Sequence after.
trigger_paths:
  - "backend/app/models/harness.py"
  - "backend/app/services/harness/reachability.py"
  - "backend/app/services/harness_engine.py"
  - "backend/app/services/harness/publish_service.py"
  - "backend/app/services/harness/validators.py"
  - "frontend/src/components/workflows/canvasModel.ts"
trigger_surfaces: [harness, workflow]
migration_note: "Likely: workflow_phases row semantics for a phase on an UNTAKEN path (skipped vs never-created). Not designed."
relates_to:
  - SEED-291 — the extension contract. ⭐ NOT A CONFLICT, A CONDITIONAL AUTHORISATION. It refuses branching *as a plugin concern* and then names the escape hatch verbatim - "Forward-only jumps are the minimal move if it is ever revisited." So this is permitted as ENGINE work by us and refused as a third-party extension point. That distinction is written down by EXT-01, which is why this sequences after Phase 255.
  - SEED-141 — utility nodes. Its "establish that the need is real" precondition is this seed's evidence gate, unmet.
  - SEED-152 — confidence on phase outputs. The SAFEST first outcome source: server-computed, so it needs no author-facing language and cannot be authored wrongly.
  - SEED-164 — a workflow that legitimately pauses for a person. Circles this without naming the edge model.
  - SEED-167 — living register. Its unmet rows #4/#5 carry the merge IN PROMPT TEXT, which is the same governance defect one subsystem over.
  - SEED-199 — canvas grammar.
  - v3.6 D-14 — the canvas never became a second runtime. ⛔ The red line this seed must not cross.
  - D-206-07 — the precedent for retiring a fence DELIBERATELY rather than tripping it by surprise.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-295: Named outcomes and forward-only edges

## The idea, in one line

Give every phase type the ability to declare **named outcomes**; let each outcome name a successor
phase by slug; constrain every edge to point **forward** in the existing index order.

**No eighth executor. No user-authored expression language.** Outcomes come from the step itself —
the human's choice, the validator's verdict, the confidence band.

---

## ⛔ THE GATE — two decisions, before any code

### D1 — what `INPUT_UNSATISFIED` means once "upstream" is path-dependent

⭐ **THIS IS THE FINDING THE SOURCE DOCUMENT MISSED ENTIRELY, AND IT IS THE REAL DIFFICULTY.**

`reachability.lint_workflow` checks a phase's `config.input_keys` against what upstream phases
produce. With named outcomes, **"upstream" becomes path-dependent**: a key produced only on the
Approve path is *unsatisfied* on the Reject path. A check that ignores this publishes a workflow
that strands at runtime — which is the exact class of defect `INPUT_UNSATISFIED` exists to prevent.

| Option | Behaviour | Cost |
|---|---|---|
| **(a) Pessimistic** *(recommended for v1)* | a key must be produced on EVERY path that reaches its consumer | refuses some workflows an author expects to work — but cannot publish a stranding run, and **degrades to exactly today's behaviour on a linear workflow** |
| (b) Per-path | enumerate paths, check each | correct; path count explodes without a cap |
| (c) Declared defaults | the author declares a fallback for a maybe-absent input | shifts the burden onto the person least able to see the problem |

**This is an engineering decision. Whoever scopes may answer it — but must answer it explicitly.**

### D2 — what "published" certifies · ⛔ OPERATOR DECISION, LEFT OPEN 2026-09-18

Today the publish gauntlet's **stage 3 golden run** executes *the only path*, so "published" means
*"this was really run end to end"*. With N outcomes it certifies **one path of N**.

⚠ **That materially weakens the immutability claim** — the source document spends §2 A6 praising
exactly this property (*"a model deprecation, a one-line prompt edit or an added connector trips no
alarm… you already prevent that structurally"*) and then proposes a change that erodes it, without
noticing. **It is a design constraint, not a bug to fix later.**

| Option | What "published" would mean | Cost |
|---|---|---|
| (a) Golden run **per outcome path** | every path was really run | N real LLM runs per publish |
| (b) **Primary path only, stated** | one declared path was really run, and the vocabulary says so out loud | cheap; the publish badge must not overclaim |
| (c) Per path, **capped at K** | up to K paths certified; publish refuses above K | a cap nobody can justify from first principles |

⛔ **The operator has explicitly declined to answer this yet**, on the grounds that it decides what
can be told to an enterprise or government buyer. **Scoping may not choose on their behalf.**

---

## ⚠ WHAT IS ALREADY TRUE — measured 2026-09-18, and most of it is the opposite of the document

| Claim in the source document | Measured |
|---|---|
| Reachability would need to become *"reachable on some path"* | ⭐ **It ALREADY IS.** `ORPHAN_PHASE` is a forward DFS from the entry over an `adjacency` map that already unions `i→i+1` **plus every `skip_to_phase` target**. The graph exists; nothing needs changing here |
| Forward-only is a cost you accept to get branching | ⭐ **INVERTED — it is a HOLE BEING CLOSED.** `_skip_targets` does **no direction check** and the engine does a raw `i = target_i`. **Backward skips are legal today**, and a cycle passes the lint whenever the terminal stays reachable. Termination today is bounded by `CircuitBreaker`, not by graph shape |
| An eighth executor would be needed | ❌ No. `PHASE_TYPE_REGISTRY_ENTRIES` holds exactly **7** and stays 7 |
| Resumability changes | ❌ No. The 2-phase write (active before work, completed after durable output) keys on phase identity, not successor |

---

## ⛔ AND THE ONE THAT MATTERS MOST — "you cannot route on a human's answer" is EFFECTIVELY TRUE TODAY

⚠ **THIS ENTRY CORRECTS A CLAIM MADE IN THIS PROJECT'S OWN REVIEW OF THE SOURCE DOCUMENT, on
2026-09-18, and the original is recorded rather than quietly dropped.** The review told the operator:

> ~~"`llm_human_input` already returns `{"answer": ...}` into accumulated outputs. A validator on the
> next phase + `skip_to_phase` gives you approve/reject **today**."~~

**Both halves are wrong, and it took ten minutes of measurement to find out:**

1. **A validator sees ONLY its own phase's output.** The signature is
   `async fn(output: dict, config: dict, ctx) -> GateResult` — there is no accumulated-outputs
   argument. So a validator on the *next* phase can never see the human's answer. The branch
   validator would have to sit on the `llm_human_input` phase **itself**.
2. **No shipped validator kind can read `answer` even there:**

| Kind | What it actually reads | Sees `answer`? |
|---|---|---|
| `regex_match` | `_output_text(output)` → **`output["text"]`**, which for `llm_human_input` is **the PROMPT** | ❌ matches the question, not the answer |
| `json_schema` | `_output_payload(output)` → `output["payload"]`, else falls back to `{"text": ...}` | ❌ |
| `llm_judge_rubric` | `_judge_graded_text(output)` → `output["text"]` | ❌ |
| `programmatic` | ✅ the **whole `output` dict** | ⛔ **but `PROGRAMMATIC_VALIDATOR_REGISTRY` is EMPTY — `@register_programmatic_validator` has ZERO call sites** |

⭐ **So approve/reject routing is NOT authorable today without a backend code change** — and the
change is **one function, ~10 lines, registered in a closed dict**. The routing half
(`on_failure: skip_to_phase:<slug>`) already works and already lints.

**The honest position, which is between the two claims:** the *document* said branching is
impossible — too strong, the mechanism is one registration away. The *review* said it works today —
also wrong. **What is true is that the shipped surface cannot express it, and the cheapest fix is
far smaller than an edge model.** ⛔ That is the first thing step 4 should test, and it may turn out
to be the whole answer.

---

## Shape, if it is ever built

Roughly **six phases** — SEED-291 already calls it *"milestone-sized"*, and the blast radius agrees:
**`phase_index` is touched by 11 backend files and 20 frontend files.**

| # | Phase | Note |
|---|---|---|
| 1 | Model + forward-only constraint + reachability adjacency | the adjacency union already exists |
| 2 | **`INPUT_UNSATISFIED` path-awareness** | D1. Its own phase — it is the hard finding, not a task |
| 3 | Engine outcome selection + run-row semantics for an untaken phase | the cursor jump exists; what a *not-taken* row MEANS does not |
| 4 | Publish gate | whatever D2 decides |
| 5 | Canvas: labelled edges + the second dimension | ⚠ `canvasModel.ts` mirrors `reachability.py` adjacency **line-for-line**; they move in one commit |
| 6 | Outcome sources — human choice first, then confidence (`SEED-152`) | ⛔ no eighth executor |

⚠ **Sequencing constraint, measured:** v4.3 Phase **256** (METER-03) is already flagged as that
milestone's worst G-5 exposure and names `harness_engine.py`. **This seed may not be worked
concurrently with 256.**

⛔ **A fence gets retired by this seed, and it must be DELIBERATE (D-206-07 precedent).**
`.claude/skills/sketch-findings-agentic-rag/references/canvas-frame-and-node-anatomy.md` records
*"Never imply a DAG. No `depends_on`, no parallel lanes — the canvas is a projection of a LINEAR
spine."* That finding is **correct today and would be retired by this seed**. A note has been added
there pointing here, so it cannot be tripped by surprise.

---

## What stays OUT, even if this is built

- **Backward edges and loops.** Termination, resumability and the publish gate all change. Separate
  milestone, with an explicit iteration cap.
- **A user-authored expression language.** Outcomes from the step itself are safer, need no learning,
  and cannot be authored wrongly.
- **Third-party outcome types.** Refused permanently by `SEED-291` / `EXT-01`.
