---
sketch: 230
name: nothing-has-been-written-yet
phase: 233
requirement: PREV-02, PREV-03, LIB-09
guardrail: G-2
question: "When the buckets are a bar (229-C), what does the confirm look like — and where does a NAMED refusal live if prose is off the screen?"
winner: null
status: awaiting-operator
variants: 3
date: 2026-09-05
author: claude
tags: [preview, confirm, dry-run, two-tier-identity, refusal, animation, g-2]
---

# 230 · Nothing has been written yet

**G-2 sketch for Phase 233 / `PREV-03` + `PREV-02` + `LIB-09`.**

```
open  .planning/sketches/230-nothing-has-been-written-yet/index.html
node  .planning/sketches/230-nothing-has-been-written-yet/drive.cjs    # 47 assertions
```

> ⚠ **REBUILT 2026-09-05 (operator: *"too dense … a lot of text that's very messy and very polluted"*).**
> The first version put the reasoning **on the screen** — four consequence paragraphs, a notes column beside
> every variant, and three variants stacked on one page. **The critique was correct and the fix was
> structural, not cosmetic:** one variant at a time behind tabs, annotations **off by default**, on-screen
> copy cut to fragments, and every full sentence moved **behind a hover**. The first version is not kept —
> its variants were replaced, not re-labelled, because 229's winner changed what this sketch composes with.

## The clauses

| | |
|---|---|
| **SC#2** | close without confirming → the Library is exactly as it was: no document, chunk, folder or job |
| **SC#3** | where each file would land, **before any row exists** |
| **SC#4** | the files that arrive are the files the preview named — counts match |
| **SC#5** | a guessed-at file lands in the Library **or** in a **named refusal** — never silently in neither |

⭐ **The axis: where does a NAMED refusal live once prose is off the screen?** That is what separates
these three, and it is why the leanest variant is not the winner.

## The three variants

| | Variant | Shape | Verdict |
|---|---|---|---|
| **A** | **The bar dissolves** | 229-C's bar *is* the progress. The hatched segment shrinks file by file into *added* / *already here* / a new red *refused* | ✅ recommended |
| **B** | **The strip** | One row of pills + four dots that flip colour | ⛔ too spare — **fails SC#5** |
| **C** | **The drawer** | The read/write ledger, and a drawer of the four unknowns | ⚠ good ledger, wrong place for the resolution |

## Recommendation — A, with C's ledger reduced to one line

- **A** — no second screen and no new object: **the thing you were reading becomes the thing you are
  watching.** The hatched width physically moves into a real outcome as each file is opened. It composes
  directly with the bar the operator selected in 229.
- **C's zero-line only** — `0 documents · 0 chunks · 0 jobs · 0 folders` in the footer of every preview.
  The expanded read/write ledger is worth building **once**, behind a disclosure; as permanent chrome it is
  the density problem again.
- **B — kept as the *other* failure mode.** Four dots flip colour, so you see *that* two were refused.
  There is nowhere for *why*. **A refusal that is only a colour is a count**, and SC#5 requires a named one.
  Density is not the only way to fail this screen; this is the other way.

## The four unknowns, and how each ends

| File | Opened | Outcome |
|---|---|---|
| `NOTES` | UTF-8 text, 340 words | **added** → `/Operations` |
| `scan_2026-03-11.pdf` | no text layer, image-only | **refused**, named |
| `Q3 Pricing Review` (Google Doc) | exported; `sha256` matches | **already here** — not imported again, **not embedded again** |
| `→ Regional Rates` (shortcut) | target in an unreachable Shared Drive | **refused**, named |

⭐ **Row 3 is `PREV-02`'s two-tier identity visible in an outcome.** Tier 1 could not have known — Drive
publishes no hash for native Docs — so the preview said *"can't tell"* and it **was right**. Tier 2
`sha256` settled it at splice.

⭐ **`outcome` has exactly three values — `added`, `here`, `refused`.** There is deliberately no fourth, so
*"silently in neither"* is unrepresentable. `drive.cjs` asserts it.

## What to look for

1. **Press *Add 12 · read 4* in A.** Watch the hatched segment shrink and a red *refused* segment appear.
2. **Hover a refusal.** The row says *no text layer*; the sentence is one hover away. **Named, not printed.**
3. **In C, press *re-run rules*.** Evaluating a routing rule is a **read** — `dry_run=True`, `0 folders
   minted`. That is what `PREV-03` requires and what a naive build gets wrong by minting the destination
   folder up front.
4. **Press Cancel anywhere.** The toast is not "Cancelled" — it is *"Closed. 0 documents · 0 chunks ·
   0 jobs · 0 folders written."*
5. **Toggle `notes`** in the top bar if you want the reasoning. It is off by default, on purpose.

## Driven, not asserted

`drive.cjs` — **47 assertions**, and it **cross-checks 229's fixture** so the preview and the confirm cannot
come to disagree about the same folder (a ROADMAP failure mode in its own words).

| Planted defect | Fires |
|---|---|
| an unknown resolves to a non-terminal `skipped` | ✅ 3 (incl. the accounting: 25 of 26) |
| a refusal becomes a count instead of a name | ✅ 2 |
| 230 disagrees with 229 about what would be added | ✅ 2 (incl. the cross-check) |
| the preview writes one document before confirming | ✅ 1 |
| the re-embed cost claim is dropped | ✅ 1 |

`index.html` restored **md5-identical** after every plant.

## Related

- **229** — the four buckets (**winner: C**). A reuses its bar; `drive.cjs` cross-checks its fixture.
- **Phase 234** — the Library-tree destination map from the first version of this sketch is **deferred there**
  as the folder-mapping surface. One rule survives from it regardless: a projected row must be **visibly not
  a row** — dashed, a *would* verb, counts as `41 → 44` never as a new total.
