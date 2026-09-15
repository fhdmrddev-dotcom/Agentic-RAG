---
seed_id: SEED-284
title: Three file-local elapsed formatters now ship — one home is owed, and the third was accepted deliberately rather than overlooked
created: 2026-09-11
planted_during: Phase 243 (CHAT-01) — plan 243-04 task 3, at the moment the third one was written
status: planted
folded_into: null

priority: low
surface: Agentic-RAG
severity: trivial    # Nothing is wrong. Three small functions say the same thing three ways.
relates_to:
  - "`frontend/src/components/chat/RunCard.tsx:588-594` — `formatElapsed(ms: number)`: tenths of
    a second under a minute (`4.2s`), then `Nm Ns`. Feeds the run row's never-vanishes timer."
  - "`frontend/src/components/chat/MessageList.tsx:49-58` — `formatFloatingElapsed(createdAt?:
    string)`: takes a TIMESTAMP STRING, returns `null` when it is unparseable, whole seconds
    (`42s`) then `Nm Ns`. Feeds the floating run strip."
  - "`frontend/src/components/chat/ThinkingBlock.tsx` — `thoughtForLabel(ms?: number)`: whole
    seconds with PLURALISATION and a floor of one (`Thought for 1 second` /
    `Thought for 6 seconds`), no minute form, and the word when the value is absent. Feeds the
    reasoning fold's label. ⭐ ADDED BY 243-04, knowingly."
trigger_when: >
  THE NEXT PHASE WHOSE `files_modified` NAMES ANY OF `RunCard.tsx`, `MessageList.tsx` OR
  `ThinkingBlock.tsx` — because the extraction is only cheap when the plan already owes those
  files a ledger row + `docs/HOT-FILE-LEDGER.md` section update in the same commit. It fires
  EARLIER if a FOURTH formatter is about to be written: at four, "three near-duplicates" has
  stopped being a note and become a pattern.
trigger_paths:
  - "**/MessageList.tsx"
  - "**/RunCard.tsx"
  - "**/ThinkingBlock.tsx"
  - "docs/HOT-FILE-LEDGER.md"
renumbered_from: SEED-269
renumbered_because: >
  D-07/D-20: the OLDEST seed keeps the id, by the `created`-else-`planted` date. This file reads
  `created: 2026-09-11`;
  `SEED-269-explanations-are-noise-in-the-form-move-them-behind-an-info-affordance.md` reads
  `created: 2026-09-10` and is a day older, so it keeps id 269 and this seed moved to 284. No
  tie-break was needed and git was not consulted. ⛔ Not chosen by reference weight — D-07 rejects
  that rule by name.
---

# SEED-284 — one home for the elapsed formatter

## What was decided, and by whom

`243-PATTERNS.md` §F.2 named two near-duplicate elapsed formatters as an existing smell and told
243-04 to **decide** rather than inherit: extract one home, or state plainly that a third
file-local helper is being accepted and why. The plan then **closed the extraction option** and
this seed is the other half of that decision.

## ⛔ Why the extraction was NOT taken in 243-04, and the reason is mechanical

Extracting would edit `RunCard.tsx` **and** `MessageList.tsx`. **Neither is in 243-04's
`files_modified`** — so neither would have received the CLAUDE.md row + `docs/HOT-FILE-LEDGER.md`
section update `D-243-07` requires in the same commit.

⚠ **And the ledger gate reads `files_modified`, not the diff** (`scripts/check-hot-file-ledger.cjs`),
so it would have exited 0 over two unrecorded edits to G-5-firing files. **A guard that cannot see
the thing it guards is Phase 243's recurring finding** — it is the same shape as this phase's
own §10 needle, which matched zero files after a render-shape change, and the same shape as the
suite in `deferred-items.md` that no gate knob names. A duplicated four-line formatter is a
smaller debt than an edit no register knows about.

## What the extraction should actually produce

⚠ **NOT a lowest-common-denominator `formatElapsed`.** The three call sites genuinely differ, and
flattening them would be a behaviour change dressed as tidiness:

| | input | sub-minute | over a minute | absent/unparseable |
|---|---|---|---|---|
| `RunCard` | `number` (ms) | `4.2s` — **tenths** | `Nm Ns` | caller gates (`hasElapsed`) |
| `MessageList` | `string` (ISO) | `42s` — whole | `Nm Ns` | returns `null` |
| `ThinkingBlock` | `number \| undefined` (ms) | `Thought for 6 seconds` — **pluralised prose, floor of 1** | *(no minute form)* | returns the bare word |

A single home should therefore expose a **duration primitive** (ms → parts) with the three
*presentations* staying at their call sites, or one function with an explicit format argument.
⛔ Whoever takes it must not quietly give `RunCard` whole seconds or `ThinkingBlock` a `4.2s`.

## Acceptance criterion (so this seed can be answered rather than re-proposed)

**Done when:** exactly ONE module owns the ms→parts arithmetic; all three sites above call it; each
site's shipped STRING is byte-identical to what it emits today (pinned by the existing
`RunCard.timer.test.tsx`, `MessageList.runline.baseline.test.tsx` and
`ThinkingBlock.characterization.test.tsx` §14 cases, which must pass **unedited** — an edited fence
proves nothing about a refactor); and this seed's `status` is flipped with the phase named.

**Not done if** the only change is that the duplication moved.
