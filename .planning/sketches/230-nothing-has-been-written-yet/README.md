---
sketch: 230
name: nothing-has-been-written-yet
phase: 233
requirement: PREV-02, PREV-03, LIB-09
guardrail: G-2
question: "What makes 'nothing has been written' and 'here is where it lands' believable at the confirm — and how does the fourth bucket resolve honestly?"
winner: null
status: awaiting-operator
variants: 3
date: 2026-09-05
author: claude
tags: [preview, confirm, dry-run, two-tier-identity, refusal, animation, g-2]
---

# 230 · Nothing has been written yet

**G-2 sketch for Phase 233 / `PREV-03` + `PREV-02` + `LIB-09`.** Sketch 229 told the truth about four
buckets. This is the moment the preview has to **prove** two harder things: that looking cost nothing, and
that the fourth bucket resolves honestly once we actually open the files.

```
open .planning/sketches/230-nothing-has-been-written-yet/index.html
node .planning/sketches/230-nothing-has-been-written-yet/drive.cjs   # 38 assertions
```

## The clauses this surface answers

> **SC#2** — *"A person closes the preview without confirming and the Library is exactly as it was — no
> document row, no chunk, no folder, no job."*
> **SC#3** — *"The preview shows **where each file would land**, including any folder a rule would suggest,
> **before any row exists**."*
> **SC#4** — *"The files that arrive are the files the preview said would arrive — the counts match and the
> buckets were not optimistic."*
> **SC#5** — *"A file the preview could only guess at resolves honestly once read, landing either in the
> Library or in a **named refusal**, **never silently in neither**."*

## The three variants

| | Variant | Shape | Verdict |
|---|---|---|---|
| **A** | **The receipt, then the resolution** | Four consequence rows → confirm → the 12 land, then the 4 unknowns resolve **one at a time** → a reconciliation table | ✅ the only variant that answers SC#4 **and** SC#5 at all |
| **B** | **Destination-first — ghost rows in the Library** | The Library tree with dashed "would add" rows and `41 → 44 docs` projected counts | ⚠ answers a different question, at the wrong grain |
| **C** | **The zero-ledger** | Live read/write counters. Poke at the preview and watch the writes stay at 0 | ✅ as a **one-line footer**, not as a five-counter strip |

## Recommendation — A as the control, C's zero-line as its footer, B deferred

- **A** — the reconciliation table *is* the SC#4 receipt (*preview said 12 · 12 arrived · **0 unaccounted***),
  and the four rows resolving one at a time *are* the SC#5 guarantee made observable. A silent success
  message is exactly the design where a file falls through and nobody notices for a month.
- **C's zero-line only** — `0 documents · 0 chunks · 0 jobs · 0 folders` in the footer of every preview
  surface (it is already in 229). The expanded read/write ledger is worth building **once**, behind a
  "what has this done?" disclosure, because it is the only place a future accidental write becomes visible.
  The full five-counter strip as permanent chrome is too much.
- **B — deferred, not rejected.** SC#3 is worded at the **row** grain — *"where **each file** would land"* —
  and 229's rows already carry the destination and the rule chip. A tree that lights up six folders does not
  tell you where `Insurance Renewal.docx` goes; it is a summary of an answer, not the answer. But it answers
  a real second question — *what happens to my Library?* — so plant it as the folder-mapping surface
  **Phase 234 needs anyway**.

## The resolution is the centrepiece

Confirm in variant A and watch the four unknowns resolve. Each lands somewhere a person can read:

| File | What happened when we opened it | Outcome |
|---|---|---|
| `NOTES` (no extension) | UTF-8 plain text, 340 words | **added** → `/Operations` |
| `scan_2026-03-11.pdf` | No text layer — image-only PDF | **refused, by name** |
| `Q3 Pricing Review` (Google Doc) | exported; `sha256` matches a document already in the Library | **already here** — not imported again, **not embedded again** |
| `→ Regional Rates` (shortcut) | target is in a Shared Drive this connection cannot reach | **refused, by name** |

⭐ **The third row is Tier 2 doing its job.** Tier 1 could not have known — Drive publishes no hash for
native Docs — so the preview said *"we can't tell"* and it was **right**. That is `PREV-02`'s two-tier
identity visible in an outcome rather than described in a doc.

⭐ **`outcome` has exactly three values — `added`, `here`, `refused`.** There is deliberately no fourth,
because *"silently in neither"* is the failure SC#5 names, and `drive.cjs` asserts it is unrepresentable.

## What to look for

1. **Confirm in A**, then read the reconciliation table. Every one of the 26 is accounted for; `0 unaccounted`.
2. **In C, try to make it write something.** Open a subfolder, load the next page, **re-evaluate the routing
   rules**, re-sort. The write counters do not move; the read log grows.
3. **The rules button is the interesting one.** Evaluating a rule is a **read** — the engine answers *"where
   would this land"* without minting a folder. That is what `PREV-03` requires and exactly what a naive
   implementation gets wrong by creating the destination folder up front.
4. **Press Cancel anywhere.** The toast is not "Cancelled" — it is *"Closed. 0 documents · 0 chunks · 0 jobs ·
   0 folders written."*
5. **In B, look at how a projection renders**: dashed border, a `would add` verb, and counts shown as
   `41 → 44` rather than as a new total. Same rule as the 185 canvas seal — *a projection that renders like a
   fact is a lie with good typography.*

## The copy this sketch commits to

- **The confirm reads as consequences, not counts.** Every row has a verb: *will be added* · *will be
  skipped* · *nothing will be imported* · *we will open these four, then decide*.
- **The re-embed cost is stated as a cost NOT paid**, before the confirm — because the ROADMAP's named
  failure mode is that it "is only noticed on the bill".
- **A refusal is named**, never counted: *"No text layer — image-only PDF"*, not *"2 files failed"*.
- **Cancel prints the zeros.**

## Driven, not asserted

`drive.cjs` — **38 assertions**, and it deliberately **cross-checks sketch 229's fixture**, so the preview
and the confirm cannot come to disagree about the same folder. That disagreement is a ROADMAP failure mode
in its own words: *"the preview and the real import disagree about counts, or about where a file lands."*

| Planted defect | Fires |
|---|---|
| an unknown resolves to a non-terminal `skipped` | ✅ 3 assertions (incl. the accounting: 25 of 26) |
| the preview writes one document before confirming | ✅ 1 assertion |
| a refusal becomes a count instead of a name | ✅ 2 assertions |
| 230 disagrees with 229 about how many will be added | ✅ 2 assertions (incl. the cross-check) |

`index.html` restored **md5-identical** after every plant.

## Related

- **229** — the four buckets. This sketch's fixture is cross-checked against it by `drive.cjs`.
- **228** — who will see what this brings in. Its deferred variant C lives on 229's header.
- **Phase 234** — B's Library tree is the natural shape for folder mapping; carry it forward rather than
  re-deriving it.
