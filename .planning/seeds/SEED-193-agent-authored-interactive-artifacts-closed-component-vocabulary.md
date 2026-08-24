---
seed_id: SEED-193
title: The agent can only produce text and dead files — it should produce live artifacts, via a CLOSED component vocabulary the model composes rather than arbitrary agent-authored markup
created: 2026-08-23
planted_during: Operator note review, 2026-08-23 — three notes at once ("implement A2UI", image generation, and microsoft/data-formulator)
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-194 — image generation. Rides this rail — an image is one artifact type among several.
  - SEED-027 — tables in retrieval and multimodal chat. The DATA half of this seed; query_tables
    already returns structured rows that today can only become prose or a PNG.
  - SEED-046 — library health dashboard enrichment. Same underlying want (a view, not a paragraph)
    on a fixed surface instead of an agent-composed one.
  - SEED-185 — no URL router. ⚠ An artifact worth building is an artifact worth linking to, and
    today nothing in this app is addressable. Sequence AFTER the router or accept that artifacts
    are unshareable.
  - docs/SANDBOX-PACKAGES.md — matplotlib / plotly / seaborn / pandas are ALREADY installed; the
    generation half is largely solved and the RENDER half is what is missing.
  - Phase 095 build-once component inventory — the existing card vocabulary this would extend.
trigger_when: >
  NOT YET — this is milestone-shaped, not phase-shaped, and it should not be started inside v3.7.
  Re-open at the next /gsd:new-milestone as a candidate milestone theme, or earlier if either
  of these fires:
  (a) a user asks for a chart they then want to CHANGE (filter, re-encode, drill in) — that is the
      moment a PNG is provably the wrong artifact and the cheapest slice becomes justifiable;
  (b) SEED-194 (image generation) is planned — it needs an artifact render path, and building a
      one-off image card instead of the first vocabulary entry is how this seed gets pre-empted
      by a worse version of itself.
---

# The agent produces text and dead files. It should produce live artifacts.

## The three operator notes are one idea

- *"Implement A2UI"* — the delivery mechanism: the agent describes UI, the client renders it.
- *"Image generation … inspired by Gemini notebook"* — one artifact type (SEED-194).
- *"microsoft/data-formulator … we have rich source of data and refined output that can fit
  perfectly"* — the interaction model, and the strongest fit of the three.

They are the same move: **today a chart is a matplotlib PNG written to `/sandbox/output` and
rendered by `OutputFileCard` as a dead image.** You cannot filter it, re-encode it, drill into
it, or ask a follow-up against it. The agent already has pandas and plotly installed and already
has `query_tables` and `query_documents` returning structured rows — the data half is done. What
is missing is that the *output* of all that work collapses back into pixels and prose.

## What Data Formulator actually teaches (MIT, Microsoft Research)

Verified against the repository, 2026-08-23:

| Their idea | What we already have | What is missing |
|---|---|---|
| Charts compile from a **compact declarative spec**, not imperative plotting code | matplotlib/plotly in the sandbox; the agent writes plotting code every time | the spec layer — nothing between "Python code" and "PNG" |
| **Data threads** — branch a question, compare alternative analyses, keep both | chat threads; workflow runs; a run receipt | branching *within* an analysis, and comparing two answers side by side |
| **Data connectors** with awareness of relationships between sources | documents, folders, tables, relationships (Phase 117) | the analysis surface that consumes them as data rather than as passages |
| Composing results into a shareable report | file output, download | anything addressable (⚠ SEED-185) |

Their architecture is also familiar — Python backend, browser frontend, multi-provider LLM. The
transferable part is the *interaction model*, not the code.

## ⚠ The safe v1 is a CLOSED vocabulary, not arbitrary agent-authored UI

The tempting reading of "A2UI" is: let the model emit markup and render it. **Do not build that
first**, for a reason this project already has scar tissue about — a model-authored surface is a
surface nobody reviewed, and this app renders it inside an authenticated session next to the
user's documents.

The honest v1 inverts it: **the model picks from OUR registered components with typed props.**

- The component set is ours, built once, reviewed once, tested once — the Phase 095 build-once
  inventory is the precedent and probably the seed of the list (chart, table, comparison,
  metric, file, image).
- The model's output is a validated structure, not markup. Pydantic on the way in (project rule:
  Pydantic for structured LLM outputs), so an unknown component or a malformed prop is a
  *refusal*, not a render.
- Unknown component name ⇒ render nothing and say so. **Never fall back to raw text passthrough** —
  that is the escape hatch that turns a closed vocabulary back into an open one.
- Growth is a code change, deliberately. Adding a component is a phase; it is not something a
  prompt can do at runtime.

That constraint is not a compromise — it is what makes the feature shippable at all, and it is
the same "safe by construction" shape the graded-governance work (Phase 185) already established
on the workflow surface.

## The cheapest first slice, when this is taken

One component: **chart-as-spec**. The agent emits a validated chart spec instead of calling
matplotlib; the client renders it interactively; the underlying rows stay available so a
follow-up can re-encode the same data without re-running the query. That one slice proves the
whole rail (structured output → validated → registered component → interactive artifact) and is
independently useful the day it lands. Everything else — tables, images, comparisons, and
eventually the branch/compare "data thread" — is a second entry in the same registry.

⚠ Do not bundle the interaction model (branching, comparing) into that first slice. Data
Formulator's data threads are the *ambitious* half and they overlap with the workflow-run model
in ways nobody has thought through yet. Ship the artifact rail first; earn the thread.


---

## CONSIDERED AND DEFERRED 2026-08-24 — kept OUT of the Connections milestone, on purpose

The operator named A2UI, image generation and data-formulator in the SAME conversation that opened
the Connections milestone. They were considered together and separated: connections are about
REACHING other systems, artifacts are about what the agent PRODUCES. An image the model generates
is not a connector, and folding them makes one unshippable milestone.

This seed is the seed of the NEXT milestone after Connections. The one genuine seam — *"call an
external API in chat, the model decides, it generates an image and puts it in the artifact"* — is an
ARTIFACT concern that needs a connection, so Connections ships first (the call) and Artifacts second
(the render). See `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` -> "Deliberately NOT in this milestone".
