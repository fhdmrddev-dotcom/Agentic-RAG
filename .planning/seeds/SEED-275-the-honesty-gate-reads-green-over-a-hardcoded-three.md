---
seed_id: SEED-275
title: The verification-honesty gate reads GREEN over a hardcoded three-path scan set while 20 VERIFICATION.md files exist — and the phase whose whole job was verification debt produced no VERIFICATION.md at all
created: 2026-09-14
planted_during: v4.2 / DEBT-06 groundwork, while measuring which phases actually owe an independent review
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-274 — the backend ceiling pinned to an integer over a value that moves. ⚠ SAME FAMILY,
    DIFFERENT AXIS: 274 is a gate whose THRESHOLD is wrong; this is a gate whose SCAN SET is wrong.
    A gate can be sound in both its logic and its threshold and still prove nothing, if the set it
    reads over is not the set that exists.
  - SEED-171 — a red that is sometimes real and sometimes noise.
relates_to_registers:
  - "scripts/check-verification-honesty.cjs — `const PINNED = [...]`, three literal paths, plus
    `MIN_PINNED_FILES = 3`."
  - "CLAUDE.md § hot-file ledger — *'a hot file missing from a scan list is permanently invisible to
    its own guardrail'*, and the measured precedent that a 214-row table nobody reads end-to-end is
    not a scan list but a hope. The ledger was converted from a table to a GATE for exactly this
    reason; this gate has the defect the ledger was cured of."
  - "DEBT-06 (v4.2 REQUIREMENTS.md) — 'a row that reads NEITHER is an unmet DEBT-06, not a rounding
    error'. That check cannot be run against a scan set that excludes most rows."
trigger_when: >
  ANY of: (1) DEBT-06 is worked — this seed is its precondition, because the debt cannot be counted
  before the scan set is right; (2) a new phase closes and someone asks whether its verification is
  visible to any scan; (3) `check-verification-honesty.cjs` is edited for any reason; (4) a
  milestone is archived — archiving is precisely what removes a phase from the "active milestone"
  half of the subject set and drops it out of the gate.
---

# SEED-275 — the gate is green because it is not looking

## What is true, measured 2026-09-14

`node scripts/check-verification-honesty.cjs` prints:

```
subject: 3 files (3 pinned + 0 active)
OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED
honesty gate OK — 3/3 subject files carry verification_mode, 0 frontmatter review claims.
```

**Twenty `*-VERIFICATION.md` files exist under `.planning/`.** The gate reads three.

```js
const PINNED = [
  '.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md',
  '.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md',
  '.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VERIFICATION.md',
];
```

Those are exactly the three phases Phase 245 was created to fix. The set was correct **on the day it
was written** and has been frozen since.

## The three findings

### 1 ⛔ The scan set is hardcoded, and archiving a milestone silently drops phases out of it

The subject set is `PINNED ∪ activeSubjects()`. The active milestone is **v4.2**, whose only phase
(247) has no `VERIFICATION.md` yet — hence `0 active`. So **242, 243, 244 and 246 are scanned by
nothing**, despite all four post-dating the marker convention and all four carrying a marker.

⚠ **They happen to be fine. The gate cannot say so** — and the mechanism that hid them is not
neglect, it is *milestone archival*: the moment v4.1 closed, its phases left the active half and
were never added to the pinned half. **Every future milestone will do this on close.**

⭐ **This project already cured this exact disease once.** The hot-file ledger was a complete
214-row table in `CLAUDE.md` — and `App.tsx` still went **23 phases** with no row, `NavPanel.tsx`
11, `config.py` its entire life. The fix was to stop trusting a list and make the gate **derive**
what it must check (`check-hot-file-ledger.cjs` fails when a phase's `files_modified` names a
source file with no row). ⛔ **This gate has the defect the ledger was cured of.**

### 2 ⛔ Phase 239 carries no marker while its three cohort-mates do

| Phase | `verification_mode` |
|---|---|
| 238 | `self-verified` |
| **239** | **⛔ absent** |
| 240 | `self-verified` |
| 241 | `self-verified` |

Phase 245's plan named 238, 240 and 241 by hand; 239 was not on the list, so it got nothing. ⚠ And
239 is the phase whose dispatched code review returned **19 findings including 2 Criticals** — one
a destructive tool bindable as the file *reader*, then called by the watch loop on every file,
unattended. **The phase with the most review evidence in the milestone reads, to every scan, as
though it has none.** An absent marker is not neutral: the gate's own help text says a
`VERIFICATION.md` without `verification_mode` *"is not 'slightly under-documented' — it is a
self-verification that a future reader, and every scan, will take for a review."*

### 3 ⛔ Phase 245 produced no `VERIFICATION.md` at all

245 is *"The verification debt discharged or retired in writing."* Its directory holds
`245-VERDICT.md`, three SUMMARYs, a UAT, a discussion log and `deferred-items.md` — **and no
`245-VERIFICATION.md`.**

⭐ **So the phase that invented the marker, wrote the gate, and applied both to three other phases
is itself invisible to the instrument it built.** Not because anyone skipped a step — because the
gate keys on a filename that phase did not produce.

⚠ Pre-245 phases (222, 226, 228-237) carrying no marker is **expected, not a defect** — the
convention did not exist. Recording that here so a future sweep does not "fix" thirteen files that
were never in scope.

## What the answer should look like

**Not a longer `PINNED` array** — a longer hardcoded list is the same defect with a later expiry.

1. **Derive the subject set**: every `*-VERIFICATION.md` under `.planning/` whose phase number is
   **≥ the phase that introduced the convention (245)**, across `phases/` *and* `milestones/*-phases/`.
   Archival then cannot drop anything.
2. **Keep a floor** so an empty glob cannot read as success — the existing `MIN_PINNED_FILES`
   instinct is right, it is the literal paths that are wrong.
3. **Decide what a phase with no `VERIFICATION.md` at all means** (finding 3). Either the gate also
   asserts the file EXISTS for every closed phase, or `VERDICT.md` is declared an accepted
   equivalent and the gate reads both. ⛔ Silence is the one option with no defence.
4. **Drive it RED against a planted defect before trusting it.** A guard nobody has seen fire is not
   a guard — and Phase 242 measured two of this project's guards passing **vacuously**, including
   `check-hot-file-ledger.cjs` exiting `0` over **zero parsed files**.

## Why it is planted rather than fixed on the spot

Changing how a gate chooses its subject set is a design decision about what the gate *means*, and
finding 3 needs an operator ruling (`VERIFICATION.md` required, or `VERDICT.md` accepted). It is
also a precondition for `DEBT-06` rather than a part of it: **the debt cannot be counted until the
scan set is right**, and `DEBT-06` as written asks for exactly that count.

## Reference

- `scripts/check-verification-honesty.cjs` — `PINNED`, `MIN_PINNED_FILES`, `activeSubjects()`.
- `.planning/REQUIREMENTS.md` → `DEBT-06`.
- `.planning/milestones/v4.1-phases/245-*/245-01-PLAN.md` — where the three-file list originates.
- [[SEED-274]] — the threshold-shaped sibling of this scan-set-shaped defect.
