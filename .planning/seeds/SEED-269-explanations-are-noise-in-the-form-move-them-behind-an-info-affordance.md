---
seed_id: SEED-269
title: The app's explanations are GOOD but they are dumped inline as noise — move them behind an info affordance with a guided popup, app-wide
created: 2026-09-10
planted_during: Phase 241 — operator direction, 2026-09-10
status: planted
priority: high
scope: app-wide (137 files / 363 blocks measured) — NOT a Settings-only change
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

---

# ⚠ SCOPE RE-MEASURED 2026-09-10 — IT IS THE WHOLE APP, AND SETTINGS IS 5% OF IT

The original measurement above counted `SettingsPage.tsx` only. **Operator direction the same day:
*"not only this one thing but everything that needs clarification"*.** Re-measured across
`frontend/src`:

| | Measured |
|---|---|
| Files containing inline explanatory text | **137** |
| Total `text-xs/sm text-muted-foreground` blocks | **363** |
| `SettingsPage.tsx`'s share | **19 — about 5%** |

Top concentrations after Settings: `ModelDiscoveryPanel` (10) · `WatchedFoldersSection` (9) ·
`SkillEvalSection` (9) · `UsersAndAccess` (9) · `AuditTab` (9) · `ProviderPicker` (8) ·
`SkillTunerPage` (7) · `SsoTab` (7) · `IngestionTab` (7).

⛔ **This is a SYSTEM plus a migration, not a screen.** A phase that "does SEED-269" by rebuilding
the Retrieval card has done 2% of it. **G-8 caps a phase at 3-5 plans**, so this must be sequenced:
the pattern and its copy registry ship FIRST and prove themselves on one surface; adoption then
runs surface by surface, each wave measurable by the block count in the files it touched.

# ⛔ THE TRIAGE RULE — because 363 blocks are NOT 363 bugs

**Most of that text is fine where it is.** Blanket-replacing all of it would be a different, equally
bad failure: an app where you must click to learn anything. Four tiers, and the tier decides the
treatment:

| Tier | What it is | Treatment |
|---|---|---|
| **0 — Caption** | One short line that IS the label's meaning (*"Scope this conversation to a specific folder"*) | ⛔ **LEAVE IT INLINE.** It is not noise; it is the label finishing its sentence |
| **1 — Choice** | One or two sentences on what to pick | Move behind the `(i)`. Plain popup. **No diagram, no animation** |
| **2 — Trade-off** | Has a real COST the operator is buying (`SEED-258`'s shape) | Popup with the two-column cost table + a recommendation carrying its evidence |
| **3 — Mechanism** | A behaviour that CANNOT be explained in a sentence | Popup with a diagram, **animated ONCE on open** |

⭐ **ANIMATION IS RATIONED, AND THAT IS THE WHOLE POINT.** The operator asked for it *"when
needed... but we make it beautiful instead of getting noise"*. A motion on every one of 363 blocks
is the same disease with better production values. **Tier 3 is expected to be a handful of concepts
app-wide** — search breadth is one; grounding/governance, the publish gauntlet's judge wall, and
connection-scoped visibility are the other likely candidates. ⛔ **Never loop.** Play once on open,
settle, stop. A looping animation inside a form is noise by construction.

# The design is DONE and approved-in-principle — Stitch, 2026-09-10

Google Stitch, project `16478354618829749955`, against the app's real **"Deep Space Minimalist"**
design system (`assets/1a1900c0084a4f84aa3e040fef4c55df`). One worked example (search breadth) in
four treatments:

| | Screen | Verdict |
|---|---|---|
| Base | `Retrieval Settings & Inspector` | side panel + 3-stage pipeline. Invented product chrome — discard the chrome, keep the idea |
| **A** | `Search Settings - Inline Expansion` | ⭐ **the recommended container** — explanation opens inside the card under its own row; control and explanation physically joined |
| B | `Search Settings - Centered Modal` | most legible diagram, but hides the field you are asking about. Reserve for a future full "explain this" surface |
| **C** | `Search Settings - Shortfall Gap Bar` | ⭐ **the recommended diagram** — one bar, survivors in indigo, `35 filtered out` hatched, and a `target: 20` marker so the shortfall reads as a visible GAP |

⭐ **The recommendation is A's container with C's diagram**: proximity from A, and C's bar because it
shows the *shortfall* (the thing you act on) rather than the *mechanism*. A's layout jump is fixed
by animating the height open — the movement becomes the affordance instead of a glitch.

⚠ **These are ONE example rendered four ways.** They settle the pattern; they do not settle the 137
files. The phase's first plan builds the reusable container + copy registry from them.

# The acceptance bar, restated for app-wide scope

- **Count blocks before and after IN THE FILES THE WAVE TOUCHED**, and show nothing was DELETED —
  only moved or deliberately kept as Tier 0.
- ⛔ **Assert the CONTENT moved, never that an `(i)` exists.** A presence assertion that an icon
  renders proves nothing about whether the paragraph left the form — this project's own standing
  lesson, and the exact way Phase 235 shipped a defect behind a green fence.
- **Tier 3 count is a budget, not an outcome.** If a wave proposes more than one or two animated
  diagrams, that is a signal the tiering was applied too generously.
