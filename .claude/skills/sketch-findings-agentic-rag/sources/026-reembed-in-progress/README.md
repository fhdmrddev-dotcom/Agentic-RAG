---
sketch: 026
name: reembed-in-progress
question: "While the background re-embed job runs, how does the UI honestly show 'search is catching up at reduced recall', progress, and a 'Re-embed now' re-kick for a failed/partial run?"
winner: "Synthesis (C status card as home + slim search pointer)"
tags: [phase-111.1, settings, re-embed, progress, graceful-dip, honesty, d-04, d-05, resumable, embed-05]
---

# Sketch 026: Re-embed In Progress (graceful-dip honesty — D-04 / D-05)

## Design Question
Execution is Option A "graceful-dip" (D-04): a background batched job runs; not-yet-re-embedded
chunks are filtered out of search, so **search stays up at reduced recall and fully recovers**
as the job completes. The job is **resumable + non-destructive** (D-05) — old vectors are kept
until each replacement is written, and a **"Re-embed now"** control re-kicks a failed/partial
run. The question: **where does this status live, and how does it tell the truth** about the dip
without alarming people — across running / partial-failed / complete states?

## How to View
open .planning/sketches/026-reembed-in-progress/index.html
(Use the state-cycler buttons in each variant to walk running → partial/failed → complete.)

## Variants
- **A: Inline strip** — a compact progress strip that lives in Settings right under the picker:
  pulse + title + count + thin bar + a "Search catching up · reduced recall" chip and re-kick
  button. Minimal footprint; weakest at warning a user who's searching elsewhere.
- **B: App-wide banner** — a slim banner riding the top of every page ("Search is catching up…")
  so anyone searching during the dip sees *why* results look thin, shown in-context over a fake
  documents-search page. Maximum honesty where search actually happens; must stay tasteful +
  auto-dismiss.
- **C: Status card + batches** — the richest surface: per-batch progress grid, re-embedded/total/
  ETA stats, an explicit non-destructive/resumable note, and Pause / Re-embed-now / Switch-back
  controls. The trustworthy home for a long, occasionally-failing job; likely pairs with A or B
  as the slim everyday indicator that links into it.
- **★ Synthesis (winner): C as home + slim search pointer** — C's rich status card stays the
  home in Settings; a single slim "search is catching up" pointer appears only on the Documents
  page (where the dip is felt) and deep-links into the card. The pointer auto-hides on completion.

## Decision (2026-06-16)
**Winner = Synthesis (C status card as home + a slim search pointer).** Operator picked C as the
home surface. C alone lives in Settings, but the recall dip is felt by whoever's *searching*
during the window — so a cheap one-line pointer (the whisper of B) appears where search actually
happens and links into the C card. This avoids B's full app-wide banner nagging every page while
still telling the truth to a searcher who never opened Settings. C carries all three states
(running / partial-failed / complete) with the D-05 "nothing was lost" promise + re-kick.

## What to Look For
- Does each variant make the **recall dip honest** without reading as "search is broken"?
- Does the **failed/partial** state clearly say *nothing was lost* and offer an obvious re-kick
  (the D-05 promise)?
- Right altitude for a typically ~6-minute job — is the full status card overkill, or worth it
  for large corpora?
- Could the winner be a **composition** (slim everyday indicator A or B + rich card C on click)?
