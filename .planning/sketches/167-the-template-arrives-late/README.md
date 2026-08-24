---
sketch: 167
name: the-template-arrives-late
question: "A template is attached to an already-drafted workflow. What does the app say about the mismatch — and what is it actually entitled to claim?"
winner: "C — name check, no claim (2026-08-14, operator). ⚠ B was NOT rejected for being wrong — it is the stronger idea, rejected on SIZE for what is a safety net rather than the headline feature. NO SEED PLANTED (that option was offered and declined); the re-open CONDITION is recorded instead."
tags: [phase-193.1, auth-03, sc3, reconcile, honesty, seed-157, seed-159, generated-from-build]
---

# Sketch 167: The template arrives late

> **SC#3:** *"A template attached to an already-drafted workflow surfaces any mismatch
> between that draft and the template's fields, rather than binding silently."*
>
> Sketches 165 and 166 fix the *new* workflow. This one is the safety net for every
> workflow that already exists — and for the draft-then-attach path **Phase 193 shipped**,
> which without SC#3 inherits the exact defect 193.1 exists to remove.

## How to view

```
start .planning/sketches/167-the-template-arrives-late/index.html
```

Five tabs: **A · Bind silently (today)** · **B · Ask the AI to reconcile** ·
**C · Name check, no claim** · **⚠ Why a verdict is impossible** · **The contract**.

Verified at 1440×900: no horizontal scroll, every rail measures exactly **320 px** (the
real inspector width), all reconcile blocks render, no failing audit rows.

## ⚠ The measurement that constrains every variant

**Nothing in the app can compute a coverage verdict at attach time.** This was measured,
not assumed:

| | at **attach** time | at **run** time |
|---|---|---|
| what exists | the template's placeholder keys; the draft's declared `output_keys`, phase slugs and `input_keys` | an actual emitted field map, with values and citations |
| what can be computed | whether a field name appears anywhere in the draft — **a heuristic** | `check_coverage` (`template_render_service.py:416-460`) — `covered_keys`, `covers_template`, `null_leaf_count`. **A verdict.** |
| how it fails | a step named `gather_status` legitimately feeding `overall_rag_status` reads as a gap; a run input reads as a gap | it doesn't — it measures what actually happened |
| so the copy may say | *"nothing in the steps **names** these"* | *"these fields came back empty"* |

That distinction is not pedantry. It is the difference between a panel an author trusts
and one they learn to dismiss.

## The variants

| | Approach | Cost |
|---|---|---|
| **A** | **Bind silently.** The shipped behaviour, rendered. The attach succeeds, the eight fields list honestly, and nothing relates them to the three steps on the canvas beside it. | Free. **SC#3 is unmet by exactly this much.** |
| **B** | **Ask the model.** Show the AI the draft *and* the placeholders; it returns a proposed diff (`ADD` a step that gathers risks · `CHANGE` the summary step · `KEEP` the run inputs). **Nothing applies until the author accepts.** | A second model call, a diff surface, an accept/reject path, and a new failure mode — a reconcile that proposes nonsense on a draft the author was happy with. |
| **C** | **Name check, and say so.** Computed from the definition the page already holds — no model call. **Three buckets:** produced by a step · supplied as a run input · named nowhere. Plus a disclaimer that is load-bearing, not decorative. | A heuristic that can cry wolf, and a disclaimer that must survive every future copy edit. |

## What to look for

1. **Tab A first.** Read the two rails side by side. Everything that changed is a fact
   about the *document*; nothing changed about the *workflow*. That gap is SC#3.
2. **In B, read the `KEEP` row last.** It is the model declining to flag `project_name`
   and `reporting_period` because the workflow already asks for them at run time. That
   judgement is free in B — and is precisely what variant C has to be *taught*.
3. **In C, the run-input bucket is the whole design.** In this fixture **2 of the 8**
   fields are run inputs: nothing produces them and nothing should. A two-bucket check
   would list them as gaps, and an author told twice that a correct workflow is broken
   stops reading the panel. **Three buckets, never two.**
4. **`reconcile.disclaim` is the single most important string on the page.** Without it,
   C asserts a coverage verdict it cannot compute — the same class of dishonesty
   `SEED-159` is about, one surface earlier.
5. **Both B and C are explicit acts.** Nothing rewrites a draft the author has been
   editing without being asked. That is not politeness — a reconcile that edited the
   canvas directly would be a second writer on the definition JSONB, which is the
   discipline Phase 186's `If-Match` token exists to protect.

## What is real here and what is proposed

| Region | Source | Drift risk |
|---|---|---|
| the attach section — heading, filename, the eight fields, the types note | **real rendered `TemplateAttachSection`** | **none — it *is* the build** |
| the eight field names | **parsed from the dump**, never re-typed | **none** |
| the three-bucket classification | **derived in `build.cjs`** from the parsed keys against the fixture draft | none — the page cannot show a classification the rule would not produce |
| every reconcile block and every string in it | **proposed** (`NEW` throughout) | ordinary |

## ⚠ Declared limits

1. **The enclosing `PhaseFormPanel` is NOT rendered.** It is 1095 lines with a large prop
   surface; drawing it would put a second full app surface on a page about one section
   inside it. **This sketch makes no layout claim about the panel** — only its 320 px rail
   width is borrowed. Same limit sketch 164 declared for its govern dump, for the same
   reason: a limit that lives only in someone's head is one the next reader won't know.
2. **Where a LARGE reconcile lives is unsettled.** Every stage puts it on the rail, because
   that is where the template arrives — but the changes it proposes are about the *canvas*,
   and the rail is 320 px. A four-row diff fits; a fifteen-row one does not. Escalation to
   the canvas, to a modal, or a capped "show all" is a **CONTEXT.md decision**, and no
   variant here should be read as having answered it.
3. **`SEED-159` is the run-time half of this honesty problem** — a field with no evidence
   renders as an empty cell, because `build_context` blanks null leaves *"for clean cells"*
   while `check_coverage` computes exactly the information being discarded. Named here so
   nobody solves it in this phase by accident.

## Reproduce

```bash
cp .planning/sketches/167-the-template-arrives-late/emit.test.tsx.src \
   frontend/src/components/workflows/__emit167.test.tsx
cd frontend && npx vitest run src/components/workflows/__emit167.test.tsx && cd ..
rm frontend/src/components/workflows/__emit167.test.tsx
node .planning/sketches/167-the-template-arrives-late/build.cjs
# tailwind: -c a copy of frontend/tailwind.config.js whose `content` is body.generated.html
node .planning/sketches/167-the-template-arrives-late/assemble.cjs
```

`build.cjs` reports **8 assertions, 0 failing** — including that the fixture actually
produces a three-bucket split (a two-bucket one could not demonstrate the false alarm) and
that every parsed field was classified exactly once.
