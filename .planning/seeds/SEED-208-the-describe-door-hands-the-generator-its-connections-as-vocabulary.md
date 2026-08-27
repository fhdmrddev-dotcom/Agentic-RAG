---
seed_id: SEED-208
title: "Let the author pick the connections/tools a workflow needs AT THE DESCRIBE DOOR, before the AI drafts — the generator's vocabulary becomes the connected services and their granted tools, and a named-but-absent service produces a stated REFUSAL, never a step that fails at 03:00."
created: 2026-08-26
planted_during: conversation with the operator, 2026-08-26, while Gemini executed Phase 209 — offered as "just an idea… for you to assess"
status: folded            # FOLDED at /gsd:discuss-phase 214 (2026-08-28) -- STEP-06 / D-214-20 / D-214-21. SEED-207 gate discharged by Phase 211.
folded_into: 214
priority: high
surface: Agentic-RAG
relates_to:
  - .planning/research/connections-competitor-study.md §Q3 — INDEPENDENTLY recommends this exact control
  - SEED-205 — the connection journey; this is its AUTHORING moment
  - SEED-207 — one connection model; this door renders whatever that model exposes
  - Phase 187 — DescribeKbPicker.tsx, the folder-grounding picker (picker #1)
  - Phase 193.1 — DescribeTemplateRow.tsx (picker #2), AND the measured lesson this seed must obey
  - Phase 199 — doorVocabulary.ts DESCRIBE_REFUSAL, the refusal precedent
  - backend/app/api/workflows.py — /workflows/generate already takes project_folder_id + template_placeholders
trigger_when: >
  When the Connections & Open Platform milestone is scoped, OR when any work touches the describe
  door. ⚠ Sequence AFTER SEED-207: while two connection models coexist, this picker would have to
  render both shapes and would inherit the branch it exists to avoid.
---

# SEED-208 — the describe door hands the generator its connections as vocabulary

## Recorded verbatim, 2026-08-26

> *"Now the only gate is to describe it to the AI or build it myself, but in both ways we just
> should describe to the AI and the AI will draft the initial version. My idea is that in the main
> door we are attaching a document and describing to the AI and grounding it to a folder or
> something. Why can't we also add the option to the user at this specific door to select the tool
> or connections that is needed in this workflow before handing it over to AI? Is this possible, and
> making the task of the AI easier to know exactly which tool — and then let's see the connections
> tools available to build this workflow. Just an idea about connection and how it will be flexible
> at drafting stage, for you to assess."*

## ⭐ ASSESSMENT — DO IT. Our own research reached this independently and called it the only
## strategy compatible with this engine.

`connections-competitor-study.md` §Q3 surveyed how the leaders keep describe-to-build honest at
catalog scale, found **no product documents a refusal**, and concluded:

> *"Three strategies exist, and only two are available to us: (1) generate code for the missing
> service (Gumloop) — **excluded by our architecture verdict**; (2) propose it anyway and put the
> burden on the human (Zapier, with a documented warning) — **this is what a describe-to-build door
> does by default when nothing constrains the vocabulary**; (3) **constrain the model to the
> registry** — nobody documents doing this, but it is the only strategy compatible with our engine…
> **the draft-it-for-me door must be handed the connected services + their granted tools as its
> vocabulary, and a named-but-absent service must produce a stated refusal with a next action**
> (*"connect Slack"* / *"no read tool is granted on this connection"*), never a step that validates
> and fails at 03:00."*

The operator proposed the study's own recommendation without having it in front of them. **Two
independent routes to the same control is the strongest signal this register carries.**

## It is the THIRD picker in a row of two — not new architecture

| Picker | Ships | Constrains the generator by |
|---|---|---|
| `DescribeKbPicker.tsx` | Phase 187 | which KB folder it may ground to |
| `DescribeTemplateRow.tsx` | Phase 193.1 | which template it must fill |
| **connections / tools** | **this seed** | **which external services it may reach** |

`/workflows/generate` already accepts `project_folder_id` and `template_placeholders` for exactly
this reason. The extension point exists; this is the same seam a third time.

## ⚠ THE ONE ASSUMPTION THAT WAS ALREADY MEASURED FALSE HERE — do not repeat it

**Phase 193.1's central assumption was that handing the model template placeholders would make it
draft against them. It did not.** The model had to be TOLD a template was **PROVIDED**. Passing a
tool list into the payload and expecting the draft to honour it will fail the same way.

> The prompt must state that these ARE the available tools and that nothing else may be named.
> Data in the request is not instruction in the prompt.

## ⚠ THE REFUSAL ARM IS THE LOAD-BEARING HALF

The happy path ("Slack is connected, draft a Slack step") is the easy half and the one every vendor
documents. The half that decides whether this control is worth anything is the other one:

- author names a service with **no connection** ⇒ a stated refusal + next action (*"connect Slack"*),
- author names a tool that exists but is **not granted** ⇒ a different stated reason
  (*"no read tool is granted on this connection"*),
- never a plausible-looking generic step that validates now and fails in production.

**Precedent, already shipped:** `DESCRIBE_REFUSAL` (`doorVocabulary.ts`, Phase 199). The door already
knows how to refuse in a governed vocabulary; this is the same control with a new reason string.

## Design questions this seed does NOT settle

- **Granted vs ungranted tools in the vocabulary.** Granting is one click, so hiding ungranted tools
  may be too strict — an author may reasonably draft against a tool they will permit on the way.
  Showing them marked *"you will need to permit this"* is probably better than hiding, but that is a
  **sketch** question against the `screenshots/` Claude.ai reference (G-2), not a prose decision.
- **The control's shape** — chips, a multi-select, an `@`-mention inside the describe box. Sketch it.

## Two fences

1. **OPTIONAL, never a gate.** Pick nothing and behaviour is exactly today's. This makes the AI's job
   easier when used; it must not add a step to the path when it is not.
2. ⚠ **Sequence after `SEED-207`.** While a native capability connection and an MCP connection are
   different shapes, this picker would have to render both — inheriting the very branch that
   unification exists to remove, on a brand-new surface.
