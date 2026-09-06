---
phase: 235-the-source-says-what-it-did
plan: 13
subsystem: sources
gap_closure: true
gap_closure_round: 1
tags: [LIB-10, SURF-02, D-235-10, D-235-11, G3]
requires:
  - "backend/app/services/sources/failure_cause.py (the Cause union + HARD_CAUSES table)"
  - "backend/app/services/sources/health_verdict.py (verdict_for_runs — consumed UNCHANGED)"
  - "backend/app/services/watch_service.py seam 2 (the connection-disabled arm)"
  - "frontend/src/components/sources/sourceHealthVocabulary.ts (the zero-import vocabulary leaf)"
provides:
  - "Cause.connection_disabled — a fifth, HARD, WRITE-ONLY cause"
  - "SENTENCE_FOR_CAUSE.connection_disabled + CONTROL_FOR_CAUSE.connection_disabled (action: reconnect)"
  - "WORD_FOR_COUNT + COUNT_ORDER — the six stored counts as words, in the sketch's reading order"
  - "CHECKED_PREFIX — the prefix COPY.checkedAgo bakes a summed count into"
  - "FILE_FAILURE_HEADING + FILE_FAILURE_SCOPE_NOTE — the per-file list is a STATE, not a run"
  - "instantPhrase — the BUILD-CONTRACT's absolute instant, local time, null-safe"
  - "SourceFailureCause is now the ONE union the wire types use (lib/api/sources.ts imports it)"
affects:
  - "frontend/src/components/sources/WatchedFoldersSection.tsx — renders the fifth cause with NO edit"
  - "wave 2 render plans — they consume a settled vocabulary leaf instead of racing it"
tech-stack:
  added: []
  patterns:
    - "a new cause is a TABLE ROW on both sides of the wire, never a branch"
    - "WRITE-ONLY causes: one seam writes it, no classifier infers it, a negative test proves it"
    - "a union pinned by a fence is only pinned where the fence can read"
key-files:
  created: []
  modified:
    - backend/app/services/sources/failure_cause.py
    - backend/app/services/watch_service.py
    - backend/tests/unit/services/test_failure_cause.py
    - backend/tests/unit/services/test_watch_sync_runs.py
    - backend/tests/unit/services/test_source_health_verdict.py
    - frontend/src/components/sources/sourceHealthVocabulary.ts
    - frontend/src/components/sources/sourceHealthVocabulary.test.ts
    - frontend/src/components/sources/WatchedFoldersSection.test.tsx
    - frontend/src/lib/api/sources.ts
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "connection_disabled is HARD — one paused tick stops the source. Stated as a decision: the soft threshold would keep a definitively-off source silently un-updated for three cadences (18 h at the 6-hour cadence) for no gain, since the next tick reads exactly as little. Reversing it is removing one member from a frozenset; no branch moves."
  - "The control REUSES the `reconnect` action rather than inventing a fourth. `reconnect` is a DOOR — the Connections surface — and that is exactly where the switch lives, so the shipped 'three named actions' pin stays green by construction rather than by being loosened."
  - "The label is `Turn {name} back on`, NOT `Reconnect {name}`: re-authorising is not what is wrong, and telling a person to re-authorise a connection they deliberately turned off is a wrong instruction."
  - "The identifier is deliberately NOT spelled in the vocabulary leaf's docblock. The suite pins its occurrences at THREE (union, sentence table, control table) so reaching for a per-cause branch reds; a literal in a comment is still a literal (the Pitfall-8 discipline the fixture name already follows)."
  - "lib/api/sources.ts now IMPORTS SourceFailureCause instead of spelling the union twice more. `import type` is erased at build and the leaf has zero imports, so no runtime dependency and no possible cycle."
metrics:
  duration: ~75 min
  completed: 2026-09-06
---

# Phase 235 Plan 13: A switched-off connection says so, and offers a control that fixes it — Summary

Closes gap **G3** (SC#2, WARNING): a disabled connection resolved to `unknown` after three paused
ticks and was offered **Retry now** — a control that provably cannot change a state somebody chose
deliberately. It is now a fifth, HARD, **write-only** cause with its own sentence and its own
control, and the vocabulary leaf carries every word wave 2 needs.

## What was built

**Backend — the cause exists, and nothing can guess it.**
`Cause` is five members on one line (the frontend's `?raw` fence reads that exact shape).
`HARD_CAUSES` gained it, so **one** paused tick is enough. `watch_service.py` seam 2 — the only
code that knows the connection is off, because it just read `is_enabled` off the connection row —
writes `failure_cause="connection_disabled"` where it wrote `None`. `classify_failure_cause` gained
**no matcher and no status row**, and a negative test drives seven tempting strings
(`"connection is disabled"`, `"disabled"`, `"switched off"`, …) and ten status codes against that
rule, plus a live-source case proving neither `_STATUS_CAUSE` nor `_MATCHERS` names it.

⛔ **`health_verdict.py` is byte-unchanged** — `git diff --numstat 1cc213153 HEAD` on it is empty.
The streak logic was already correct; the defect was the missing cause, and the verdict follows
from `HARD_CAUSES` gaining a row. The test that proves it imports the module unmodified.

**Frontend — a row on each table, and the words wave 2 renders.**
`SENTENCE_FOR_CAUSE` and `CONTROL_FOR_CAUSE` each gained one entry. Five new exports, all
**siblings** of `COPY` (which stays pinned CLOSED at 26): `WORD_FOR_COUNT` + `COUNT_ORDER`,
`CHECKED_PREFIX`, `FILE_FAILURE_HEADING` + `FILE_FAILURE_SCOPE_NOTE`, `instantPhrase`. Zero imports
is still true. Every new string was folded into `allSentences`, so the five binding rules loop over
them too.

## ⭐ D-235-11 was DEMONSTRATED, not asserted

`WatchedFoldersSection.test.tsx` loops the control table rather than hand-writing four cases, so the
fifth cause **generated its own render case — and it passed first time against a byte-unmodified
`WatchedFoldersSection.tsx`.** The component needed no edit at all. That is what "the map is DATA,
never a branch in the card" actually means, measured rather than claimed.

## Measurements

| Gate | Base (plan-measured) | After | Verdict |
|---|---|---|---|
| Vitest count gate | `237/237 · total 7715 · failed 0 · pinned 6985` | `count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing.` · **total 7734 · failed 0 · pinned 6985** | ✅ +19, no per-file decrease |
| `sourceHealthVocabulary.test.ts` | **42** cases | **60** cases, 0 failed | ✅ **+18** |
| Composition fence `sourceComposition.test.tsx` | `16 failed \| 33 passed (49)` | `16 failed \| 33 passed (49)` | ✅ **identical — not worse** |
| `src/components/sources` + `library` + `layout` | — | `16 failed \| 581 passed (597)` — all 16 are the inherited composition fence | ✅ no new red |
| `tsc -p tsconfig.app.json --noEmit` | 66 errors | **66 errors** | ✅ back to base (the 67th was mine and is fixed) |
| Backend `pytest tests/unit -q --continue-on-collection-errors` | `71 failed, 3888 passed` | **see below** | ✅ ceiling met |
| `node scripts/check-claude-md-size.cjs` | 117,742 chars | **117,890 chars** (`+148`, budget ≤ 400) | ✅ exit 0, `[OK]` |

### Backend verdict lines, recorded VERBATIM — and the flake named rather than hidden

Three full runs were taken. Two read 72 and one read 71, on an unchanged tree:

```
71 failed, 3911 passed, 2 xfailed, 2 xpassed, 43 warnings in 383.35s (0:06:23)
72 failed, 3910 passed, 2 xfailed, 2 xpassed, 42 warnings in 126.65s (0:02:06)
72 failed, 3910 passed, 2 xfailed, 2 xpassed, 41 warnings in  99.07s (0:01:39)
```

⚠ **The 72nd was identified before anything was re-run, not guessed.** The `FAILED` lists of a
71-run and a 72-run were captured and diffed; the sole real difference is
`tests/unit/test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`
(the rest of the diff is warning text interleaved into two lines). It:

- is **provably unmodified by this plan** — `git diff --numstat 1cc213153 HEAD` names no email file;
- was last touched at **Phase 203** (`024c86f37`), months before this work;
- **passes in isolation** (`1 passed`), so it is order-dependent in the full run;
- lives in a subsystem this plan does not reach (email ingestion vs. source watches).

Per-suite, the three suites this plan owns went **77 → 100 passed, 0 failed** (`test_failure_cause.py`
39 → 62, `test_watch_sync_runs.py` 8 → 9, `test_source_health_verdict.py` 30 → 32).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two hand-written copies of the cause union in `lib/api/sources.ts`**
- **Found during:** Task 2, at `tsc --noEmit` after the vocabulary leaf was widened.
- **Issue:** `SyncRun.failure_cause` and `StoppedSource.cause` each spelled the four causes out
  inline. The `?raw` fence binds only the **vocabulary leaf** to `failure_cause.py`, so it is
  structurally blind to a copy in a third file. With the backend emitting a fifth cause, these wire
  types declared the server could not send what it had just started sending — **and the compiler
  agreed with the stale copy**, rejecting the new value at the render (`TS2322`).
- **Fix:** both fields now `import type { SourceFailureCause }` from the leaf, which puts them
  behind the fence. `import type` is erased at build and the leaf has zero imports, so this adds no
  runtime dependency from the API layer onto a component directory and a cycle is impossible.
- **Files modified:** `frontend/src/lib/api/sources.ts`
- **Commit:** `e6a2ead5a`
- ⚠ **The generalisable lesson, recorded in the ledger:** *a union pinned by a fence is only pinned
  where the fence can read.* Grep for hand-written copies before widening one.

**2. [Rule 3 - Blocking] A THIRD non-vacuity pin at 4, outside the plan's file list**
- **Found during:** Task 2, running the wider suite — not by reading the plan, which named only the
  two pins inside `sourceHealthVocabulary.test.ts`.
- **Issue:** `WatchedFoldersSection.test.tsx:235` asserts `expect(CAUSES).toHaveLength(4)` over
  `Object.keys(CONTROL_FOR_CAUSE)`. Widening the table reddened it.
- **Fix:** re-baselined 4 → 5 **deliberately, with the reason beside the number**. That one line was
  the file's ONLY edit — see the D-235-11 note above.
- **Files modified:** `frontend/src/components/sources/WatchedFoldersSection.test.tsx`
- **Commit:** `e6a2ead5a`

### Pins re-baselined deliberately (all with the derivation written beside the number)

| Pin | From | To | Where |
|---|---|---|---|
| `get_args(Cause)` length | 4 | 5 | `test_failure_cause.py` |
| `test_paused_arm_records_a_run_row` | `failure_cause is None` | `== "connection_disabled"` | `test_watch_sync_runs.py` (**rewritten, not deleted**) |
| `Object.keys(SENTENCE_FOR_CAUSE)` | 4 | 5 | `sourceHealthVocabulary.test.ts` |
| `backendCauses()` (`?raw` fence) | 4 | 5 | `sourceHealthVocabulary.test.ts` |
| `Object.keys(CONTROL_FOR_CAUSE)` | 4 | 5 | `WatchedFoldersSection.test.tsx` (deviation 2) |

**Left UNCHANGED, deliberately:** `Object.keys(COPY)` at **26** (every new export is a sibling) and
`SENTENCE_FOR_FILE_FAILURE` at **3** (this plan adds no per-file kind, only the heading and the
scope note that let wave 2 render the three that already exist).

**Left TRUE and GREEN, annotated as the legacy case:**
`test_paused_counts_toward_the_streak_but_classifies_as_unknown` — a paused row stored *before* this
change carries no cause, so three of them still resolve to `unknown`. That is the honest reading of
a row that recorded nothing; what changed is what NEW rows carry.

## Threat model dispositions honoured

| Threat | How |
|---|---|
| T-235c-01 (spoofing the cause from provider prose) | no matcher, no status row; seven strings × ten codes driven as an explicit negative case, on **both** halves of the wire (the client classifier has the mirror test) |
| T-235c-02 (a new sentence leaking mechanism) | every new string folded into `allSentences`, so rule 2 (severity) and rule 4 (mechanism) loop over them. `Object.keys(COPY)` offender list still `["readerOffOperator"]` |
| T-235c-03 (the two halves disagreeing) | the `?raw` fence re-pinned in the SAME plan that widened the backend union — and deviation 1 closed the two places the fence could not see |
| T-235c-SC (package installs) | none installed |

## Known Stubs

None. Every export added is consumed by a test in this plan; the five vocabulary exports are
authored *for* wave 2's render plans and are deliberately not yet mounted — that is the plan's
stated purpose (a settled leaf rather than a raced one), not an orphan.

## G-7 compliance

Round 1 of gap closure. **No user-facing capability was added beyond closing G3**: the fifth cause is
a sentence and a control for a state that already existed and was already reaching the surface
mislabelled. The five vocabulary exports are words, consumed by nothing in production yet.

## Files not touched, on purpose

`backend/app/services/sources/health_verdict.py` · `scripts/vitest-count-gate.cjs` ·
`.planning/STATE.md` · `.planning/ROADMAP.md` — all confirmed empty in
`git diff --numstat 1cc213153 HEAD`. No new suite file was created, so the gate's TARGETS/BASELINE
knobs needed no edit; the vocabulary suite's growth printed as `+18` inside an already-pinned file,
which is the gate working.

## Commits

| # | Hash | Gate | Message |
|---|---|---|---|
| 1 | `a2c5a1d03` | RED | `test(235-13): a switched-off connection is a named cause, guessed by nothing` |
| 2 | `15acd7238` | GREEN | `feat(235-13): a switched-off connection is a named, hard cause` |
| 3 | `b9a7c2e77` | RED | `test(235-13): the fifth cause and the words wave 2 renders` |
| 4 | `e6a2ead5a` | GREEN | `feat(235-13): the fifth cause says what happened and offers a control that fixes it` |

RED was genuine on both tasks: task 1's RED ran `6 failed, 94 passed`; task 2's RED was the `?raw`
fence going red on its own (`2 failed | 40 passed (42)`) the moment the backend union widened — the
real defect the fence exists to catch, not a planted one.

## Self-Check: PASSED

All five claimed files exist on disk; all four claimed commit hashes are present in `git log`.
`git diff --numstat 1cc213153 HEAD` confirms `health_verdict.py`, `scripts/vitest-count-gate.cjs`,
`.planning/STATE.md` and `.planning/ROADMAP.md` are untouched.
