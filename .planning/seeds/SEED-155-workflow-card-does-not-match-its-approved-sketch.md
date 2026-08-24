---
id: SEED-155
title: "The workflow card does not look like the sketch that was approved for it — and it structurally CANNOT, because the sketch drew atoms the card's own components hide. Four complaints, three phases, one visual pass."
status: planted
planted: 2026-08-13
planted_by: Operator, driving UAT row U8 of Phase 192.1 with sketch 163 open beside the live library — recorded verdict "it does not read the same"
surface: Agentic-RAG
severity: medium
category: product / visual parity / sketch→build drift
priority: medium
scope: Medium — one visual pass over the workflow card and the library toolbar. Spans THREE phases' code, which is exactly why it is a seed and not a gap-closure round on any one of them.
affected_areas: [workflow-library, WorkflowCard, WorkflowSoul, PhaseSpine, LibraryToolbar, sketch-to-build-drift]
relates_to:
  - Phase 192.1 UAT row U8 — the FAIL this seed is captured from. The row's own scoping table dates each complaint.
  - Phase 124 — `WorkflowSoul` + `PhaseSpine`; owns two of the four complaints
  - Phase 192 — `LibraryToolbar.tsx`; owns one
  - Phase 192.1 — the counter chip; owns one, and it is the smallest
  - `.planning/sketches/163-the-assembled-card/index.html` — the approved mockup
  - feedback_sketch_to_build_drift (memory) — "close it with GENERATED contracts, not prose". This seed is the fourth occurrence of that lesson.
trigger_when:
  - Any phase touches the workflow card's visual composition, `WorkflowSoul`, `PhaseSpine` at card scale, or `LibraryToolbar`
  - A user or prospect reacts to how the Workflows page LOOKS (as opposed to what it does)
  - A new sketch is approved for any surface that consumes an existing component unchanged — the drift mechanism below applies verbatim
  - Anyone proposes "make the counter a pill" as an isolated fix — read § Why the small half is not a quick win first
---

# SEED-155: the card the sketch drew is not the card the build can render

## What happened

Phase 192.1 shipped the workflow identity line. Its acceptance bar was sketch 163, approved before
the build. At UAT the operator opened the sketch beside the live library and recorded:

> **it does not read the same**

Two screenshots were captured: `screenshots/Screenshot 2026-08-13 015756.png` (sketch) and
`…015804.png` (build). The verdict stands as a **FAIL** on row U8 of `192.1-UAT.md`.

## The four complaints, and who owns each

Dated with `git log --diff-filter=A`. **This changes only WHERE a fix goes — never whether the
complaint is valid.**

| Operator's words | Actual mechanism | Created | Owner |
|---|---|---|---|
| *"the cards are 2 bare line[s]"* | `PhaseSpine.tsx:50` — `const showNames = scale !== "card"`. At card scale the spine draws glyph DOTS only; the phase names exist solely in `title=` on hover (`:77`). The sketch hand-drew LABELLED chips (`👋 Waits for you → 📦 Makes the file`). | `c5a6c610` 2026-06-27 | **Phase 124** |
| description overwhelms the card | `WorkflowSoul`'s purpose hero — *"purpose is the largest text at EVERY size"* (`PURPOSE_CLASS`) | `c5a6c610` 2026-06-27 | **Phase 124** |
| *"the header and the search bar and the button to create workflow is more beautiful [in the mockup]"* | `LibraryToolbar.tsx` — build renders a 2-line OUTLINED box (*"Build a workflow / Describe it in plain English → AI drafts it"*); the mockup renders a solid filled `+ Create workflow`, full-width search on its own row, chips on a second row | `2dd9b748` 2026-08-11 | **Phase 192** |
| the counter is not a chip | `WorkflowCard` + `libraryVocabulary` — mockup renders `1 of 2` as a bordered pill visually separated from the `·`-joined run; build renders plain inline text in the same run | 2026-08-13 | **Phase 192.1** |

**Three of four are older than the phase that failed the row.** That is the whole reason this is a
seed: no gap-closure round on 192.1 could have fixed what 192.1 did not build, and per **G-7** a
closure round may never introduce new capability anyway.

## The root cause is structural, not carelessness

Sketch 163 **hand-wrote its own CSS and hand-drew a card the build never intended to produce.**

The real card **consumes `WorkflowSoul scale="card"` UNCHANGED by explicit decision** — the card's own
docblock says *"it does not rebuild the card's content and must not lose an atom."* And
`WorkflowSoul` has hidden its spine labels at card scale **since Phase 124, seven weeks before this
sketch was drawn.**

So: **the mockup was never achievable by the card as scoped, and the acceptance bar and the build
disagreed from the moment the sketch was approved.** Nobody chose wrong at build time. The approval
step compared a hand-drawn artifact against nothing.

⚠ `192.1-UAT.md`'s own § *"What NO automated check covers"* predicted the CLASS of this miss
(Tailwind vs hand-CSS) but **not** that the sketch would draw an atom the build structurally cannot.

## Why the small half is not a quick win

The obvious patch — "make the counter a pill" — is **not** a free restyle:

- The mockup's pill holds `1 of 2` — **six characters.**
- UAT row U4 changed that string to `43 share this name` — roughly **three times wider**, because
  `1 of 43` was read as an index rather than a collision count.

So the pill must be redesigned around text it was never drawn for. **Phase 192.1 therefore closed
with the plain-text counter accepted as a recorded deviation, routed here** rather than restyled in
place, because fixing the one badge would leave the three complaints the operator actually reacted
to untouched.

## What "done" looks like

One visual pass that treats the four complaints **together**, not one badge at a time:

1. Decide whether `PhaseSpine` should label at card scale — this is the biggest visual delta and it
   is a **Phase 124 contract change**, not a tweak. Note the `title=`-on-hover current answer is
   itself a D-14 violation candidate (touch has no hover).
2. Decide the purpose hero's weight at card scale.
3. Rework `LibraryToolbar` toward the mockup's shape (filled create button, full-width search, chips
   on their own row).
4. Counter chip, sized for `43 share this name`.

## The process fix, which matters more than the pixels

**A sketch that hand-writes its own CSS is not an acceptance bar — it is a drawing.** The banked
lesson (`feedback_sketch_to_build_drift`) already says to close this with **generated contracts, not
prose**: a `drive.cjs --emit` build contract shipped beside the sketch, and ONE `COPY` table the
build IMPORTS. 192.1 did import the COPY table (D-14) — which is why **no word was wrong** — and did
not have a contract for the card's SHAPE, which is exactly where it drifted.

**Concrete rule worth adopting when this is picked up:** if a sketch depicts a surface that consumes
an existing component unchanged, the sketch must RENDER that component, not redraw it. Any atom the
sketch draws that the real component hides is a drift the approval step cannot see.
