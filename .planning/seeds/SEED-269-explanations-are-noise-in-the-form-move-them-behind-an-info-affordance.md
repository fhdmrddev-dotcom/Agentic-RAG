---
seed_id: SEED-269
title: The app's explanations are GOOD but they are dumped inline as noise — move them behind an info affordance with a guided popup, app-wide
created: 2026-09-10
planted_during: Phase 241 — operator direction, 2026-09-10
status: planted
priority: high
surface: Agentic-RAG
severity: minor      # Nothing is broken. This is a UX-quality and readability problem across many surfaces.
folded_into: null
relates_to:
  - `frontend/src/pages/SettingsPage.tsx` — **16 inline `text-xs text-muted-foreground` help blocks
    measured 2026-09-10**, several of them multi-sentence paragraphs. The worst offenders are the
    Phase 241 HNSW controls, whose help text is now 4+ lines each.
  - `frontend/src/pages/SettingsPage.tsx:98` — `FieldRow({ label, children })`, the shared row
    component and the natural seam for an info affordance.
  - `frontend/src/components/ui/tooltip.tsx` and `dialog.tsx` — primitives that already exist and
    are **not currently used for this** anywhere in the app.
  - `frontend/src/components/settings/connectionFormCopy.ts`, `connectionsCopy.ts` — the copy
    modules; a moved explanation should live in a copy module, not inside a component.
trigger_when: >
  The next phase that touches Settings, or ANY phase whose scope includes explaining a parameter to
  an operator. ⭐ Also fires on its own merit as a dedicated cleanup phase — the operator asked for
  one explicitly on 2026-09-10.
---

# The operator's direction, 2026-09-10

> *"we are putting information which is good for the user in plain simple language ... but it is
> just inserted in the UI directly and it is a noise rather than good use of experience. It should
> be as information toaster where the user can click, it shows popup window with animation with
> visual guide if needed."*

⭐ **The content is not the problem — it is genuinely good.** Phase 241's own refusal copy
(*"filtered searches would come back near-empty while still reporting success"*) is the clearest
sentence in the product. **The problem is that every one of these explanations is on screen all the
time, for every operator, whether they want it or not.** A form where each field carries a
paragraph is a form nobody reads — and the paragraphs then hide the ones that matter.

# What is actually there today — measured, not estimated

| | Measured 2026-09-10 |
|---|---|
| Inline help blocks on `SettingsPage.tsx` alone | **16** |
| Info affordance (icon, button, popover) anywhere in the app | **none** |
| Unused primitives already available | `tooltip.tsx`, `dialog.tsx`, `sheet.tsx` |
| Natural seam | `FieldRow({ label, children })` — every row already goes through it |

⚠ **This is app-wide, not Settings-only.** The same pattern appears wherever the project has
written good explanatory prose into a component: the connection forms, the publish gauntlet, the
governance surfaces. Settings is simply where it is densest and easiest to measure.

# What to build

1. **An info affordance on the row**, not a paragraph under it — a small (i) beside the field label,
   reachable by keyboard, that opens a popup.
2. **A popup that teaches**: the one-sentence what-it-does, then what raising/lowering it COSTS,
   then a recommended value with the evidence for it. ⭐ Phase 241's copy is already written in
   exactly this shape and is the reference example — reuse it, do not rewrite it.
3. **Visual aid where a picture beats a sentence.** Search breadth is the obvious first candidate:
   *40 candidates walked → filters applied → 5 survive* is a diagram, and it is the single hardest
   idea in the product to convey in words.
4. **Copy lives in a copy module**, never inside the component — the project already has
   `connectionsCopy.ts` / `connectionFormCopy.ts` as the precedent.
5. **The field keeps a one-line summary.** ⛔ Moving ALL text behind a click is the opposite failure:
   an operator must still be able to tell what a field is without opening anything.

# ⛔ G-2 BINDS THIS — SKETCH BEFORE PLANNING

The project's own guardrail: *"Phase scope mentions live UI, panel render, badge, label, animation,
visual, or gold-standard comparison → propose `/gsd:sketch` BEFORE `/gsd:spec-phase` or
`/gsd:discuss-phase`. Operator-approved mockup is the acceptance bar."*

**The operator's direction names animation and visual guides explicitly, so G-2 fires on its face.**
⚠ **Do NOT let this get built ad hoc, one control at a time, by whatever phase happens to touch a
form next.** That is precisely how sixteen inline paragraphs accumulated: each was a reasonable
local decision. A pattern introduced without a sketch becomes the de-facto standard by accident.

⭐ Phase 241 deliberately did **not** build a one-off version on its two controls for this reason,
and shipped only the *recommendation* text — the part with no design risk.

# What Phase 241 already did, so the next phase does not redo it

- The two HNSW controls carry copy in the target shape (what it does · what it costs · the bound).
- **Search breadth now names a recommended value with its evidence**: *"200 is a good starting
  point — on our 100,000-passage test library it returned every result that should have been found
  ... Higher is not better: 1000 measured worse than 400."*
- ⛔ Both are still rendered as **inline paragraphs**. They are content ready for the new container,
  not an example of the new pattern.

# The measurable acceptance bar

**Count the inline help blocks before and after.** 16 on `SettingsPage.tsx` today; a phase that
claims this is done should be able to state the new number and show that no explanation was
DELETED, only moved. ⚠ A presence assertion that an (i) icon exists proves nothing about whether
the paragraph left the form — assert the CONTENT moved, which is this project's own standing lesson.

Related: [[feedback_stitch_plus_sketch_is_the_design_method]], [[SEED-258]] (a refusal states the
COST, not just the range — the copy shape this seed preserves), [[SEED-268]].
