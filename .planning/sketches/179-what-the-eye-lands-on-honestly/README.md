---
sketch: 179
name: what-the-eye-lands-on-honestly
kind: rendered-sketch
acceptance_bar: true
question: "With 41 distinct workflows sharing one name, and only the fields the library actually carries, what should the card lead with?"
winner: "C"
tags: [library-card, renders-real-components, seed-155, g5-refactor-owed, business-vocabulary, last-run]
seeds: [SEED-155, SEED-184, SEED-185]
bugs: [BUG-260815-08]
built: 2026-08-19
renders_real_components: true
dev_route: "TORN DOWN 2026-08-19 by plan 192.2-06 — the route and its component were deleted in one commit, as this file required. It no longer exists; do not go looking for it."
---

# Sketch 179: What the eye lands on, honestly

Step 3 of the Stitch→sketch loop (`STITCH-BRIEF.md` §6.5): the direction from sketches 177/178
re-expressed against **the component that actually ships**.

## ⚠ This one RENDERS the real component

Variant A is the real `WorkflowCard`, mounted with the real `libraryRowOf` fixtures and the real
`resolveIdentity`. Variants B and C are proposals **typed against the real `LibraryRow`** — so a
proposal needing a field we don't have fails `tsc`, not review. `tsc -p tsconfig.app.json` is clean
for both new files.

That is the `SEED-155` guard, and it earned its keep immediately (below).

```bash
cd frontend && npm run dev     # → http://localhost:5173/sketch-card
```

## What rendering it revealed — the premise was wrong

**The Stitch cards assumed the shipped card is information-poor. It is the opposite.** The real card
carries **nine** rows of information: name + version, a YOURS chip, "needs a template", the state,
`3 share this name · changed 2 days ago`, the purpose sentence, `needs kickoff_prompt`, three phase
glyphs, `STRICT`, `produces: … · file`, a two-line fork-consequence paragraph, and the action.

Two consequences:

1. **The repeated-name problem is already partly solved and nobody noticed.** The shipped identity
   line literally says **`3 share this name · changed 2 days ago`**. Sketches 175, 176, 177 and 178 all
   treated "you can't tell them apart" as unsolved. It is *rendered today*.
2. **So the work is subtraction, not addition.** The operator's own mindset — *text is noise, cut it;
   the purpose survives* — is the correct prescription, and this card is the strongest possible
   argument for it.

## The measurements that shaped the variants

| Candidate differentiator | Populated on real rows |
|---|---|
| `business_requirement` (the purpose line) | **16 / 117 — 14%** |
| non-empty `phases` | **28 / 117 — 24%** |
| **last run + outcome** | **32 of 36 published — 89%** |

117 real rows (excluding `Global WF` / `Preview WF` test data), 96 distinct slugs, 37 distinct names.
**`Compliance Gap Report` appears 43 times across 41 distinct slugs** — not versions of one workflow,
41 separate ones. 69% of the library is drafts.

⚠ **`last_run` is the one field the library feed does not carry.** The data exists — `workflow_runs`
holds 228 rows (186 completed, 31 failed, 11 cancelled) — it is a `LEFT JOIN LATERAL` plus two wire
keys. **No migration.** B and C are drawn against it and it is named as owed.

## Variants

- **A — Today (control).** The real component, unchanged. Included because you cannot judge a
  redesign without the current thing beside it.
- **B — Run-led.** The run truth is the headline (*"Worked 2d ago" · "Failed 31d ago" · "Never run"*),
  the name drops to line two, everything else becomes one dim mono line. Three identically-named cards
  become instantly distinguishable.
- **C — Triage board.** Outcome becomes a 3px gutter mark; the name leads; run + state share one quiet
  line. The library reads as a health board rather than a catalogue.

## ✅ VERDICT — C, the triage board (operator, 2026-08-19)

⚠ **And C winning partially REFUTES the direction that produced it.** Sketches 177 and 178 both argued
*lead with lifecycle state, the name cannot be the differentiator*. **C keeps the name as the lead.**
What changed is not the headline but the encoding: the outcome moves to a **3px gutter mark**, and run
+ state share **one quiet line** underneath. The name stays where the eye already goes; the *answer to
"does this one work?"* arrives peripherally, in colour plus its word.

So the settled language for the library row is:

| Slot | Carries |
|---|---|
| gutter, 3px | last-run outcome — success / failure / never run. Colour, and never colour alone |
| line 1 | **the name**, and a dim mono version on the right |
| line 2 | the run truth in words, then the state in business words |
| everything else | **cut** — purpose sentence, `needs kickoff_prompt`, phase glyphs, STRICT, `produces:`, and the two-line fork-consequence paragraph all leave the resting card |

That is a subtraction of roughly seven of the shipped card's nine information rows. It is the operator's
*"text is noise, but the purpose survives"* applied at full strength — and the purpose survives here as
**"did it work, and is it ready"**, which on real data is answerable for 89% of published rows, where
the written purpose is answerable for 14%.

## What to look for

1. **Is leading with the run honest enough?** On a draft it reads "Never run" — which is the most
   useful fact in a library that is 69% drafts, but it is also the least flattering.
2. **B vs C is a question about what the library IS** — a catalogue you browse (C) or a set of things
   that either work or don't (B).
3. **Against A, is the subtraction too aggressive?** A carries the purpose sentence; B and C drop it —
   defensible, since it is populated on only 14% of real rows.

## ⚠ Carried obligations

- **G-5 on `WorkflowCard.tsx` (8 commits / 3 phases / 818 lines) is still UNDISCHARGED.** Whichever
  variant wins, the lead/defer decision must land in a **presentation module**, not as more conditional
  JSX. Confirmed against the file: the state pill lives in a different flex child from the name, so
  "state first" crosses a structural boundary — it is not a CSS change.
- **Two defects found by reading the component:** the card's marks are **emoji** (`📄 ✨ 📝`), against
  our own single-source icon convention; and its state words are **system vocabulary**
  (`published`/`draft`) rather than business vocabulary.
- **The fork-consequence paragraph** ("Opens a new private copy you can edit…") renders on every
  published card. Prime candidate for the cut.

## ✅ Teardown — DISCHARGED 2026-08-19 (plan `192.2-06`, Task 1)

**The obligation this section recorded has been met, and the original wording is preserved below
rather than overwritten** — this repository's house habit, because a teardown note that is edited
into the past tense cannot be audited against what it actually promised.

It said, verbatim:

> This sketch touches source. Two things to delete in one commit when it closes:
> `frontend/src/dev/SketchLibraryCard.tsx` and the `/sketch-card` branch in `frontend/src/main.tsx`.
> Any non-`/sketch-card` visit is byte-identical to before.

Both were deleted **in one commit**, as required. What was measured rather than asserted:

| Claim | Evidence |
|---|---|
| the component is gone | `frontend/src/dev/` no longer exists (the directory held only that one file) |
| the route is gone | `grep -rn "sketch-card\|SketchLibraryCard" frontend/src` → **no match, exit 1** |
| `main.tsx` is back to its pre-sketch shape | `git diff 17a508d7 -- frontend/src/main.tsx` → **empty**, i.e. byte-identical to the last commit before the sketch |
| nothing else depended on it | frontend typecheck error count unmoved at **33**, none under `library/` |

⚠ **Two docblocks still POINTED at the deleted path and were amended in the same commit** —
`library/runFacts.ts` and `library/WorkflowCard.tsx`. Nothing in this repository typechecks prose, so
a dangling pointer is exactly the kind of wrong reference that survives every gate. Neither was
deleted; both now say where the surface went.

⚠ **The sketch itself is NOT torn down and must not be.** It is this phase's G-2 evidence and it
carries the operator's verdict. Only the *source* surface went.

⚠ **One thing this sketch got WRONG outlived it, and is recorded here so the drawing is never
mistaken for the specification.** Variant C's own `runWords` carried the comment *"its own
three-armed unknown"* above a function with **two arms and a `Never run` catch-all** — so an
unrecognised status, and a feed carrying no run keys at all, both rendered *Never run*. That is a
specific false claim about somebody's work, and the shipped code deliberately does **not** copy it.
**The correct three-armed resolution lives in
`frontend/src/components/workflows/library/runFacts.ts`**, whose docblock now says so. The sketch
was the acceptance bar for the LANGUAGE; it was never the acceptance bar for the RESOLUTION.
