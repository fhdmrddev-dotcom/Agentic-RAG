---
sketch: 229
name: the-four-buckets
phase: 233
requirement: PREV-01, LIB-09
guardrail: G-2
question: "How do four buckets read so the fourth one's uncertainty is FELT, not filed away?"
winner: "C"
status: locked
variants: 3
date: 2026-09-05
author: claude
tags: [preview, drive, buckets, honesty, animation, g-2, acceptance-bar]
---

# 229 · The four buckets

**G-2 sketch for Phase 233 / `PREV-01` + `LIB-09`.** A person points at a Drive folder. Before anything
is imported they must see **four** honestly-labelled lists — and the fourth, *"can't tell without reading
it"*, is the one every tidy design deletes.

```
open .planning/sketches/229-the-four-buckets/index.html
node .planning/sketches/229-the-four-buckets/drive.cjs     # 64 assertions
```

> ⚠ **REBUILT 2026-09-05 (operator: *"even 229 includes a lot of text and noise"*).** The design decisions
> are unchanged; the **presentation** was the defect. Three variants no longer stack on one page — they sit
> behind tabs with **C first and marked**; the notes columns became a `notes` toggle that is **off by
> default**; and every full reason moved **behind a hover**, so a row shows a 3-4 word fragment and nothing
> more. `drive.cjs` now guards the density too: annotations-off, one-variant-at-a-time, and reasons-behind
> -the-row are asserted, so the noise cannot come back unnoticed.

## The criterion decides the axis

> **SC#1:** *"A person points at a Drive folder and sees **four lists** before anything is imported: what
> would be **added**, what is **already here (matched by source file, not by content)**, what **type is not
> supported**, and what **cannot be told without reading it**."*

⭐ **So the deciding axis is whether a bucket can DISAPPEAR — not which layout is prettiest.** All three
variants show four buckets at rest. Only some still show four after the user touches something. The
ROADMAP names the failure mode itself: *"A bucket is dropped to make the screen tidier — three buckets is
the version that lies."* That single reading separates them.

## The three variants

| | Variant | Shape | Verdict |
|---|---|---|---|
| **A** | **Four lanes — the sort you watch** | Buckets are columns. Files fly from the scanner head into a lane, one at a time. | ✅ **guarantees four by construction** — there is no control that removes a lane |
| **B** | **One list, a verdict column** | The shipped `DocumentList` table shape; buckets become filter chips; a sweep resolves each verdict in place | ⛔ **fails the clause** — a filter chip *is* a control that removes a bucket |
| **C** | **The proportional spine** | One segmented bar carrying the whole folder + accordions below | ⚠ strong on proportion, weaker below the bar |

## ✅ LOCKED 2026-09-05 (operator): **C — the proportional spine**

The recommendation below was **A + C's bar**. The operator chose **C whole**. It is kept unedited
rather than rewritten, because a superseded recommendation is evidence and an overwritten one is not.

**What C carries into the build:**

- **The segmented bar is the primary object.** One bar, always summing to the folder's file count, with
  the *can't tell* segment **hatched and animating** so uncertainty is proportional rather than numeric.
- **The legend beneath it carries the four verbatim labels** and the *matched by source file, not by content*
  qualifier. `drive.cjs` asserts the legend region makes no hash claim.
- **The four buckets are accordions.** ⚠ **The one risk C carries and A did not:** an accordion can be
  collapsed. Collapsing hides the **files**, never the bucket or its count — that is what keeps SC#1 met —
  but the build must not add a "collapse all" or a chip that removes a section. **`drive.cjs` should gain a
  guard for that at plan-phase**, because the count staying visible is now doing the whole job.
- **The bar is what sketch 230 composes with**, and it is why 230's confirm was rebuilt around it.

## Superseded recommendation — A as the control, C's bar folded in as its header

**A and C are not rivals.** A is the structure; C's bar is the one thing counts cannot convey.

- **A** — the buckets are *structure*, not *state*. A screenshot at any moment contains all four counts.
  Same reading that decided sketch 228: a clause worded *"there is no path where it is absent"* can only be
  met **by construction, never by audit**.
- **C's bar only** — mounted above A's lanes. A count of `4` beside a count of `12` is arithmetic; a hatched
  segment holding a visible sixth of the bar is a *feeling*. Its accordions are dropped; A's lanes replace them.
- **B — rejected on the criterion, not on taste.** Its *row* (file · verdict · where/why) is worth keeping.
  Its *filter semantics* are the defect. Try it in the browser: turn off the fourth chip and the surface
  reads as a clean three-way split, one click away, and it survives a screenshot and a handover.

## Why the animation is load-bearing

Not decoration, and this is the part to judge in the browser:

- Files **fly from the scanner head into a lane**, so the pass is a thing you watch rather than a spinner
  followed by a result.
- **Three lanes settle. The fourth does not.** It keeps a hatched ground and a breathing count. You *watch
  the preview decline to guess* — the honesty claim made kinetic instead of written in a caption nobody reads.
- Remove the animation and the surface is still honest. Remove the fourth lane and it is not. That is the
  test for whether motion earned its place.

## What to look for

1. **Watch C settle**, then look at the hatched segment and the fourth count a minute later — still
   unsettled, on purpose.
2. **Hover an unknown's fragment.** The row says *no hash for Docs*; the reason is one hover away.
3. **Open tab B and turn off the fourth chip.** That state is the whole argument for why B lost.
4. **Toggle `notes`** if you want the reasoning. Off by default, on purpose.

## The copy this sketch commits to

| Bucket | Label (verbatim) | The qualifier that must travel with it |
|---|---|---|
| 1 | **Will be added** | destination per file, incl. any rule-suggested folder |
| 2 | **Already here** | ⭐ *matched by source file, not by content* — **never** a hash claim |
| 3 | **Type not supported** | we can't read this kind of file; nothing is imported |
| 4 | **Can't tell without reading it** | Drive doesn't tell us enough; each row says why |

⛔ **`PROJECT.md`'s "a `content_hash` lookup, not a guess" is FALSE for a list-only pass** and must not be
reinstated in the copy. `documents.py:620` hashes raw **bytes** — which requires the download this preview
exists to avoid — Google Drive publishes **no** hash at all for native Docs/Sheets/Slides, and Microsoft
Graph guarantees only `quickXorHash`, documents `sha256Hash` as unsupported, and populates hashes **after**
the item is downloaded.

**Tier 1 identity only, at preview time**: `(source_system, external_id, source_version)` compared for
**equality**, never called a hash. Tier 2 `sha256` still runs at splice — see sketch 230, where one file
resolves that way.

## Driven, not asserted

`drive.cjs` — **64 assertions, extracted from the running sketch rather than a copy of it**: bucket counts
sum to the scan total, four sections exist with no removal control, every unknown carries a full reason
behind its fragment, every added row carries a destination, the labels are verbatim in all three variants,
and the "already here" copy makes no hash claim. **It also guards the density** — annotations off by
default, one variant on screen at a time, reasons behind the row.

⚠ **A guard was proven broken before it was trusted.** The first version of the "already here must not
overclaim a hash" check searched the **whole document**, so rewriting one variant's copy to *"matched by
content hash"* still passed: the phrase survived elsewhere and the sub-region regex silently matched
nothing at all. **Region-scoped, given a "region was found" assertion, and re-driven RED** — it now fires
**four** assertions on that defect. Recorded rather than quietly fixed, because a guard that cannot fail on
the defect it names is decoration, and this one was written by the same session that wrote the thing it
was guarding.

| Planted defect | Fires |
|---|---|
| the legend overclaims a content hash | ✅ 4 |
| the fourth section is dropped | ✅ 2 |
| a filter chip is added to the winner | ✅ 2 |
| annotations render by default again | ✅ 1 |
| an unknown loses its reason | ✅ 1 |

`index.html` restored **md5-identical** after every plant.

## Related

- **228** — who will see what this brings in. Its variant **C was deferred to Phase 233**, whose preview
  "shares the surface and can name a real file count". This is that surface; the connection's visibility
  sentence belongs in its header.
- **230** — nothing has been written yet. The confirm moment, and how the fourth bucket resolves.
- **218** — the Library and its tabs. The `drive.cjs` pattern comes from there.
