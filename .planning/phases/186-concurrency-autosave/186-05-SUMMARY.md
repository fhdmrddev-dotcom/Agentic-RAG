---
phase: 186-concurrency-autosave
plan: 05
subsystem: frontend
tags: [publish-gauntlet, fail-open, fail-closed, verdict-wording, xyflow-adjacent, sketch-020-B, sketch-051-A]

# Dependency graph
requires:
  - phase: 186-02
    provides: "the `draft_changed` blocked_stage — HTTP 200 + `published:false` + the golden run preserved — and the server sentence the client copy must not contradict"
  - phase: 127-02
    provides: "the energized spine, the lead-with-words headline, the demoted raw-verdict disclosure"
  - phase: 184-08
    provides: "`verdictModel.ts` — the pure module `DEGRADED_SENTENCE` lives in, and its D-182-06 source fences"
provides:
  - "A ninth spine row (`Commit`) for the publish flip, with `codes: ['draft_changed']`"
  - "`unknownBlock` — the fail-CLOSED reading of `findIndex`'s -1, consulted by BOTH spine reads"
  - "`BLOCKED_SENTENCE` + `blockedSentence()` — a total resolver whose fallback is a sentence, never a machine token"
  - "F7 — the guard that protects every future `blocked_stage`, not just this one"
affects: [187 validation envelope, any future blocked_stage the backend adds]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interpret a sentinel ONCE into a named state, above the loop, so two independent reads of it cannot drift apart"
    - "A wording map whose resolver is TOTAL is not an allow-list: nothing is filtered, because the fallback still renders the refusal"
    - "Prove a guard is load-bearing by removing it and observing red — a guard whose removal changes nothing is being credited for someone else's fix"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/verdictModel.ts
    - frontend/src/components/workflows/PublishGauntlet.test.tsx

key-decisions:
  - "The 9th stage is APPENDED after Judge, labelled `Commit`, rather than folded into the Judge row — a draft-moved refusal happens after the grader passed, so a Judge-row placement would tell the author the grader stopped them, which is false. Appending also leaves the golden-run row at index 5, which the running highlight addresses by index."
  - "`unknownBlock` is the SINGLE load-bearing guard. An earlier draft derived a second value (`allPassed = blockedStage == null && !running`) that independently closed the same hole, which made the falsification vacuous — the guard could be deleted with F7 staying green. Restructured to one guard whose removal is observable."
  - "`BLOCKED_SENTENCE` carries exactly two keys (`judge`, `draft_changed`). Not a stylistic minimum: `verdictModel.test.ts`'s `FORBIDDEN_CODES` fence forbids several real stage identifiers from appearing anywhere in that module, including in a comment. A larger map would have been a red fence, not a nicer surface."
  - "The four F7 claims are `expect.soft`. A soft failure still fails the test; what it buys is that a HALF-fix reports as a half-fix instead of hiding behind the first assertion."

patterns-established:
  - "Falsify the guard, not the feature: remove the named guard alone and record which claims go red and which stay green — the split names which repair owns which half"
  - "When a criterion is phrased as a grep over a literal, state the property the grep was standing in for and re-measure deliberately"

requirements-completed: [CONCUR-02]

# Metrics
duration: 15min
completed: 2026-08-01
---

# Phase 186 Plan 05: Publish Spine Fails Closed Summary

**An unrecognised `blocked_stage` can no longer paint the publish spine green: the `-1` that
`findIndex` returns for a stage this client has never seen is now interpreted once, into a
named fail-closed state that both spine reads consult, and the refusal headline says a
sentence instead of leaking the server's machine token to a business user.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-31T22:16:56Z (UTC; local date 2026-08-01)
- **Completed:** 2026-07-31T22:32:11Z
- **Tasks:** 2
- **Files modified:** 3 (0 created, 3 modified) — 316 insertions / 24 deletions across both commits

## Accomplishments

- **The fail-open is closed as a PROPERTY.** F7 drives a code no server will ever send, so the
  guard holds for every `blocked_stage` the backend adds after this phase with no edit here.
  Keyed on `draft_changed` it would have been a patch test.
- **Both `-1` reads are fixed, and the suite can tell them apart.** The node tone and the
  connector tone carry different class literals and get their own `expect`, so repairing one
  read cannot hide the other. The falsification below proves that separation is real.
- **The guard is provably load-bearing.** Removing `unknownBlock` alone re-reds F7. An earlier
  draft of the same fix would have passed that check while the guard did nothing — see
  Deviations.
- **No machine code reaches the screen, and no honesty was traded for it.** The headline is a
  sentence; the verbatim `blocked_stage` still renders inside the raw-verdict disclosure, and a
  new test pins that it was demoted rather than removed.
- **The client computes no verdict.** No allow-list of acceptable stages was added anywhere —
  the client renders what arrives and fails closed on what it has not seen (D-182-06 / VALID-03).
- **Zero backend, zero migrations, zero fenced files.**
  `git diff --name-only -- backend/ supabase/migrations WorkflowCanvas.tsx canvasNudge.ts` = **0 files**.

## Task Commits

1. **Task 1: F7 — render a bogus blocked_stage and prove the spine lies (RED first)** — `b2d7e7b5` (test)
2. **Task 2: Close both fail-opens and give the refusal a sentence** — `5a37e910` (feat)

## Files Created/Modified

- `frontend/src/components/workflows/PublishGauntlet.tsx` — the 9th `Commit` row + its
  `chequered-flag` glyph; `unknownBlock` derived once above the map and consulted by both
  `isPassed` and `connReached`; `wordedHeadline`'s refusal arm now calls `blockedSentence`.
  The icon-import comment no longer claims a count (it says "one per row, same order, same
  count" and hands the real guarantee to a render assertion), and the `STAGES` docblock states
  why the row is appended rather than inserted.
- `frontend/src/components/workflows/verdictModel.ts` — `BLOCKED_SENTENCE`,
  `BLOCKED_FALLBACK_SENTENCE` and the total `blockedSentence()` resolver, in
  `DEGRADED_SENTENCE`'s docblock style, including why a stage-wording map is not the code
  table that module's red line forbids.
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — F7 (the bogus stage, four
  soft claims) + the verbatim-still-rendered companion; a `draft_changed` describe block with
  the Commit-node block, the icon render proof and the running-highlight pin; the shipped
  stage-label test extended to nine labels and renamed.

## RED evidence (required by the plan's output spec)

Observed against the shipped component, before any fix, in isolation:

| # | Claim | Expected | Observed |
|---|---|---|---|
| 1 | ✓ badges on the spine | 0 | **8** |
| 2 | nodes carrying the pass tone (`bg-success/10`) | 0 | **8** |
| 3 | reached connectors (`bg-success/50`) | 0 | **7** |
| 4 | headline free of the raw code | — | `Blocked early — a-stage-this-client-has-never-heard-of` |

All four failed in one run because the claims are soft. `1 failed | 24 passed` at RED.

## Falsification of the `unknownBlock` guard (required by the plan's output spec)

Removing `unknownBlock ? false :` from **both** reads, changing nothing else:

| Claim | Result |
|---|---|
| ✓ badges | **RED — 9** (nine rows now) |
| pass-toned nodes | **RED — 9** |
| reached connectors | **RED — 8** |
| headline | **stays GREEN** |

That split is the honest reading and is worth keeping: the guard owns the *spine* half of the
fail-open and `blockedSentence` owns the *headline* half. Neither repair can be credited with
the other's fix, and a future editor who deletes one will see exactly which half breaks. Guard
restored; 29/29.

## Isolation vs whole-suite counts (required by the plan's output spec)

| Measure | Before | After |
|---|---|---|
| `PublishGauntlet.test.tsx` in isolation | 24 passed | **29 passed** |
| `src/components/workflows` + `src/pages` combined | — | **1789 passed / 44 files** |
| `npx tsc -b` errors | 33 (baseline) | **33**, 0 naming a touched file |
| `npx vite build` | — | exit **0** |
| `verdictModel.test.ts` (the D-182-06 fences) | 25 passed | **25 passed** |
| eslint on the 3 touched files | — | clean |

**On the known parallel-load flake.** The first combined run reported **3 failures**, the
second **2**, the third **0** — with no code change between them. All of them were shipped
`userEvent`-typing tests inside this same file ("named_failures key-detection…", "an
unrecognized named_failures shape…"), each failing as `Test timed out in 5000ms`; raising
`--testTimeout` to 20 s reduced but did not eliminate them. This is the recorded flake for this
exact file (185's plan noted 5-8 failures for it under whole-suite load, passing in isolation),
and it is recorded here rather than absorbed. Every reading used for a pass/fail judgement was
taken in isolation.

## Decisions Made

- **The 9th row is `Commit`, appended.** Sketch 020-B D2 has always carried the flip as its own
  row (`5 | Publish (flip to published) | … | already_published`), so this is the sketch's own
  model finally rendered, not new visual language. `already_published` was deliberately **not**
  moved onto it — that outcome arrives as a 409 with no verdict body, so the spine never sees a
  stage for it and the code would be dead.
- **`unknownBlock` is the only guard, on purpose.** See Deviations — an earlier draft made it
  redundant, which is worse than it sounds.
- **`BLOCKED_SENTENCE` has two keys, and the fence is the reason.** `verdictModel.test.ts`'s
  `FORBIDDEN_CODES` regex forbids several real stage identifiers from appearing anywhere in that
  module, comments included. A sentence for every stage would have turned that fence red. The
  fallback carries the rest honestly ("Publish was blocked — nothing was published. What stopped
  it is named below."), and the server's own words render underneath it.
- **The `draft_changed` headline leads, it does not repeat.** *"Blocked at the last step — the
  draft changed while it was being checked"*, with 186-02's full sentence (including *"re-publish
  to check the new version"*) rendering verbatim below as the block message. It does not
  contradict the server; it does not duplicate it either.
- **`blockedSentence` guards on the RESULT being a string.** A lookup on a plain object answers
  for inherited keys, so a stage named after something on the prototype would otherwise hand a
  non-string to a renderer. Matches the module's stated totality rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first draft of the fix made `unknownBlock` redundant, which would have shipped a vacuous falsification**

- **Found during:** Task 2, at the falsification step.
- **Issue:** The first shape derived a second value above the map —
  `allPassed = blockedStage == null && !running` — and used it as the tail branch. Because
  `unknownBlock` implies `blockedStage != null`, `allPassed` was already `false` for every
  unknown block, so it closed the hole on its own. Deleting `unknownBlock` would have left F7
  **green**. Two lines each looked deletable, and the plan's falsification check would have
  reported "no red" for a guard that was genuinely not load-bearing.
- **Fix:** Dropped `allPassed`, restored `!running` as the tail branch, and left `unknownBlock`
  as the single guard both reads consult first. The tail is honest precisely *because* the guard
  ran ahead of it, and that is written at the line.
- **Verification:** Removing the guard alone now re-reds F7 (9 / 9 / 8); restored, 29/29.
- **Committed in:** `5a37e910`, with the false start named in the commit message rather than
  quietly dropped.

**2. [Rule 3 - Blocking] An acceptance grep was measuring a literal the recommended fix contains**

- **Found during:** Task 2.
- **Issue:** The plan requires `grep -n "blockedIndex === -1 ? !running"` → **0 hits**, but
  RESEARCH's own recommended minimal form
  (`unknownBlock ? false : blockedIndex === -1 ? !running : …`) contains that literal. Satisfying
  the grep and following the recommended form were mutually exclusive as written. This is the
  phase-wide lesson for the fifth time — a criterion phrased as a literal count constrains more
  than the property it stands in for.
- **Fix:** Satisfied the **property** ("neither original expression survives unguarded") with a
  shape that also reads better: the placed-block case leads as a positive test
  (`blockedIndex >= 0 ? i < blockedIndex : !running`), so the `-1` sentinel is interpreted in
  exactly one place instead of three. The grep now reads 0 because the expression is genuinely
  restructured, not because a token was renamed around it.
- **Verification:** `grep -c "blockedIndex === -1 ? !running"` → 0; `grep -c "unknownBlock"` → 3;
  `grep -c 'blocked_stage ?? "unknown"'` → 0; `STAGES` rows → 9; `i === 5` still the golden run,
  pinned by a new test rather than by the grep.

**3. [Plan-adjacent] One shipped test was renamed and extended rather than left inaccurate**

- **Issue:** `"the 8 server-fixed stages render (the gauntlet spine)"` iterates a hard-coded
  label list and would have stayed green at nine rows while claiming eight.
- **Fix:** Renamed to name the eight checks plus the publish commit, and `"Commit"` added to the
  list — so the row count is asserted, not merely described. No assertion was weakened or
  removed; the file's count went 24 → 29, strictly up.
- **Impact:** None on behaviour. Recorded because the plan's own reading of "shipped tests
  unchanged" deserves an explicit exception.

---

**Total deviations:** 2 auto-fixed (1 real design bug caught by falsification, 1 blocking
criterion conflict) + 1 shipped-test accuracy edit
**Impact on plan:** None changes scope. No backend file, no migration, no fenced file, no new
package.

## Issues Encountered

- The parallel-load flake described above. Handled by taking every judgement reading in
  isolation and running the combined suite three times.
- Nothing else. `chequered-flag` was re-verified as present **and non-empty** in the installed
  `@iconify-json/fluent-emoji` (17,985-char body) before use, and the render assertion now
  guards it independently of that check.

## Known Stubs

None. Every surface is wired: the server's stage crosses the boundary, is placed or found
unplaceable, drives both spine reads through one named guard, selects a sentence through a total
resolver, and still renders verbatim one click away.

## Threat Flags

None. Every security-relevant surface is registered in the plan's `<threat_model>`:

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-05-01 spoofing of success | `unknownBlock` short-circuits both reads | F7, on a bogus code; falsified by removing the guard |
| T-186-05-02 raw token in user copy | `blockedSentence`, total, fallback is a sentence | F7 claim 4; the demoted-not-removed companion test |
| T-186-05-03 a client-side stage allow-list | none added — verified by the fix's shape and by `verdictModel.test.ts`'s fences staying green | 25/25 fences |
| T-186-05-04 a silently empty stage glyph | `chequered-flag` verified present + non-empty | the Commit-node `<svg>` child-count assertion |
| T-186-05-SC package installs | none performed | — |

## User Setup Required

None — no environment variables, no migrations, no cloud parity step. No deployment artefact
(`deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml`, `SANDBOX_IMAGE`) is
affected, so `scripts/check-deploy-drift.sh` is unmoved.

## Next Phase Readiness

- **186-06 (`useDraftPersistence`) is unaffected** — this plan touched no hook, no store and no
  transport client.
- **187's validation envelope inherits a client that fails closed on an unfamiliar verdict
  stage.** Any new `blocked_stage` it introduces renders as a refusal with a sentence and a
  non-green spine on the day it ships, with no frontend edit — which is the whole point of
  fixing this as a property.
- **`draft_changed` now renders end to end**, which closes the loop 186-02 opened.
- **No blockers.** The `PublishGauntlet.test.tsx` parallel-load flake is pre-existing and out of
  scope.

## Self-Check: PASSED

All 3 claimed files exist on disk; all 3 claimed commit hashes (`b2d7e7b5`, `5a37e910`,
`9daeb629`) resolve in `git log`.

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
