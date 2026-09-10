---
sketch: 231
name: the-space-budget-and-the-honest-confirm
phase: 233.1
requirement: PREV-03, LIB-02, LIB-09
guardrail: G-2
question: "When the work finishes AFTER you leave the page, what may the bar honestly say — and what does the page owe the functional parts instead of empty space?"
winner: "A"
status: locked
variants: 3
date: 2026-09-05
author: claude
tags: [library, space, ingestion, queue, honesty, g-2, acceptance-bar]
---

# 231 · The space budget and the honest confirm

**G-2 sketch for the Phase 233 follow-up.** Two questions the operator raised while driving the
shipped preview, on one surface.

```
open .planning/sketches/231-the-space-budget-and-the-honest-confirm/index.html
node .planning/sketches/231-the-space-budget-and-the-honest-confirm/drive.cjs   # 75 assertions
```

⚠ **Open tab `✕ today` first.** It is the shipped screen, measured — the variants only make sense
against it.

---

## ⭐ The deciding clause, and it did not exist when 229/230 were drawn

> **After you confirm and navigate away, what does the surface say when you come back?**

Sketch **230-A** won on *"the bar dissolves — the object you were reading becomes the object you
are watching"*, and it was drawn when **confirm did the work synchronously**. It no longer does.
`BUG-260905-04` routed connector imports onto the durable queue — correctly, because the old path
had no retries, unbounded parallelism, and silently degraded metadata — and that **changed what
`added` means**:

| | 230-A assumed | what actually happens now |
|---|---|---|
| confirm | reads each file, one at a time | **enqueues**, 5 concurrent, returns immediately-ish |
| `added` | the file is in the Library and searchable | the file is **accepted into a queue** |
| duration | seconds, on screen | minutes, **after you have gone** |

⛔ **The shipped reconciliation line says `preview said 12 → 12 added` while those 12 are still
`pending`.** That is an honesty defect of exactly the kind Phase 233 exists to prevent, and it was
introduced by the queue fix rather than inherited. **This sketch's job is to answer the new
question, not to repaint the old drawing.**

### The vocabulary that follows from it

⚠ **The three terminal outcomes do NOT change** — `added` · `here` · `refused`. SC#5 depends on
there being no fourth destination. What the queue adds is a **journey**, so the surface needs words
for the middle of it:

| | word | what it promises |
|---|---|---|
| in flight | **Waiting** | accepted, nothing read yet |
| in flight | **Reading** | being read now — *5 at a time*, so the wait has a reason |
| terminal | **Readable** | in the Library **and searchable** — the only word that means done |
| terminal | **Refused** | named cause on the row |

⭐ *"Readable"*, not *"added"*. **Added is what the system did; readable is what the person gets**,
and only the second one is worth saying.

---

## The space arithmetic, measured rather than felt

The operator's screenshot marked the top-right as dead. It is, and the waste is countable:

| Block | Cost |
|---|---|
| `Library` + sub-line | ~62px |
| breadcrumb `Library › Documents` | ~38px |
| primary tab strip | ~56px |
| **second** tab strip (Add files / In progress / …) | ~56px |
| **total before one functional pixel** | **~212px**, and **48% of that band is empty** |

Three findings, all from `LibraryPage.tsx:656-690`:

1. ⛔ **The breadcrumb is pure duplication.** It reads *Library › Documents* while the sidebar
   already says **Library** and the tab already says **Documents**. It carries information only
   when a folder is selected — and the folder rail is displaying that selection two inches below.
2. ⛔ **Two tab strips stack.** Parent and child, one above the other, so the deeper you navigate
   the less page you have.
3. ⛔ **The hero dropzone claims a full band for one action**, pushing the folder rail into a
   cramped scroll and the source tree into a box smaller than the folder it lists.

⚠ **AND THE WIDTH DECISION IS ALREADY MADE — DO NOT RE-PROPOSE IT.** Sketches 229/230 adopted a
1152px measure, Phase 233 shipped it on `LibraryPage`, and the operator **reverted** it the same
day: *"why is it not full-width like other pages"*. Re-measured, the convention is not one number —
**form-shaped pages are constrained (Settings, Connections: 1152); data-dense pages are full width
(Skills, Chat, Library)**. `drive.cjs` asserts this sketch declares **no width token at all**.

---

## The three variants

| | Variant | Shape | Deciding clause |
|---|---|---|---|
| **A** | **One bar, one strip** | title + tabs + a live **queue pill** in one 46px row | ✅ passes — the pill lives on the shell |
| **B** | **The rail owns the tabs** | primary tabs move into the sidebar; only one horizontal strip left | ⛔ **fails** — no home for the queue |
| **C** | **The queue is chrome** | a strip appears above the tabs and the preview bar migrates into it | ✅ passes, with room to spare |

### A — one bar, one strip

**212px → 46px.** Title, the five tabs and the queue pill share one row, and the breadcrumb is
deleted. The dropzone becomes a single line, and the reclaimed height goes to the folder rail and
the source tree.

⚠ **CORRECTED after the operator read the first cut.** This paragraph said *"the sub-tabs vanish
from this view because Add files IS the tab body"*, and that was wrong — *"where are the children
mini that was under ingestion and other tabs"*. **Folding a parent strip into one row is a space
saving; swallowing its children is a lost surface**, and the two are easy to confuse while counting
pixels. The four child tabs are back as an attached row, and *In progress* now carries a **live
count badge** — so the pill and the tab are the same fact at two scales.

⭐ **The dead corner is given the one job that needed a home** — the queue. Press *Add 12 · read 4*
and the panel bar re-colours to *reading*, while the same work appears in the header pill. **The
pill is on the shell, so it survives leaving the page.**

⚠ **The thing to judge:** the pill is small. Is a 52px bar enough signal for *"your 12 files are
still being read"*?

### B — the rail owns the tabs

**The most vertical space of the three**, because the five primary tabs move into the sidebar they
already belong under, leaving exactly one horizontal strip.

⛔ **And it fails the deciding clause.** There is nowhere on the shell for the queue to live, so the
confirm animates and then the page forgets. **Press Add, then imagine navigating to Chat and
back.** ⚠ It also changes the app's IA rather than this page's — every other page's tabs would have
to follow, or the Library becomes the one page that navigates differently.

**Kept as the counter-example, not deleted.** Its space win is real, and the point is that space is
not the only axis.

### C — the queue is chrome

Confirm and **the preview bar migrates into a strip above the tabs** — 230-A's promise kept, but
against a queue instead of a synchronous loop. The strip names the three live states in words
(*readable · reading · waiting*) where A's pill has only a bar.

⚠ **The cost is a row of chrome.** It is hidden at rest here; always-visible it would spend the
space this sketch exists to reclaim. **Judge whether it earns the row when it appears.**

---

## What to look for

1. **Open `✕ today`.** The dashed box is the measured dead band. Everything functional is below it.
2. **Press *Add 12 · read 4* in A**, then watch the header pill — not the panel.
3. **Press it in B**, and ask where that signal would be if you clicked *Chat*.
4. **Press it in C** and watch the bar physically move to the shell.
5. **Toggle `notes`** for the reasoning. Off by default, on purpose.

## ✅ LOCKED 2026-09-05 (operator): **A — one bar, one strip**

The recommendation below was **A + C's strip**. The operator chose **A whole**. It is kept unedited
rather than rewritten, because a superseded recommendation is evidence and an overwritten one is not.

**What A carries into the build:**

- **The header collapses to ONE row** — title, the five primary tabs as a segmented control, and the
  queue pill. `212px → ~46px`.
- ⛔ **The breadcrumb is deleted.** It duplicated the sidebar and the tab strip.
- ⭐ **The child tabs STAY** (the operator caught their absence in the first cut) and *In progress*
  carries a **live count badge**. The pill and the badge are the same fact at two scales, and the
  pill lands on that tab.
- **The dropzone becomes one line**, and the reclaimed height goes to the folder rail and the
  source tree.
- ⚠ **The vocabulary ships with it**: *Waiting → Reading → **Readable***. ⛔ The confirm may not
  call a queued file *added*.
- ⚠ **C's strip is NOT built.** Its job — surviving navigation — is carried by the pill instead, so
  **the pill has to actually live above the route**, not merely look like it does. That is the one
  thing to check at UAT: confirm, go to Chat, come back.

## Superseded recommendation — A's header with C's strip

**A's header with C's strip**, and they compose rather than compete: A decides *where the page
spends its pixels*, C decides *what happens when work outlives the panel*. A's pill becomes the
resting state and C's strip is what it expands into while a run is live — one object at two sizes,
not two designs.

⚠ **B's space win should still be harvested.** Moving the primary tabs into the rail is right on
its own merits; it just cannot be the *only* change, because it removes the surface the queue needs.

---

## Driven, not asserted

`drive.cjs` — **75 assertions**, extracted from the running sketch rather than copied from it. It
guards the width reversal, the breadcrumb deletion, the single tab strip, the slim dropzone, the
four buckets carried over from 229, the no-content-identity claim, and — the one that matters —
**that a shell-level home for the queue exists in A and C and is absent from B**.

| Planted defect | Fires |
|---|---|
| a width token is re-introduced | ✅ 1 |
| the breadcrumb comes back in a variant | ✅ 1 |
| the second tab strip is restacked | ✅ 1 |
| the hero dropzone returns | ✅ 1 |
| B is "fixed" by giving it a pill (deleting the counter-example) | ✅ 1 |
| the live vocabulary collapses "readable" back into "added" | ✅ 2 |

`index.html` restored **md5-identical** after every plant.

## Related

- **229** — the four buckets (winner **C**). This sketch carries its labels verbatim and its fixture.
- **230** — nothing has been written yet (winner **A**). ⚠ **Its dissolve is the thing this sketch
  has to re-answer**, because the confirm it was drawn against no longer exists.
- **218** — the Library and its tabs. The surface being re-budgeted here.
