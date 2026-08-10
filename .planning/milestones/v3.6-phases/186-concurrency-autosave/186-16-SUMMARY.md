---
phase: 186-concurrency-autosave
plan: 16
subsystem: workflow-builder-publish
tags: [concurrency, publish-gauntlet, autosave, r12, gap-closure]
gap_closure: true
closes: [WR-10]
requires:
  - "the shipped `blockedReason` seam (184-11 / R12)"
  - "`useDraftPersistence`'s `PersistState` (186-07)"
provides:
  - "a publish that cannot START on top of an outstanding autosave write"
  - "the refusal stated INSIDE the modal, beside the control it disables"
affects:
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
tech-stack:
  added: []
  patterns:
    - "one derived boolean, handed DOWN — the wrapper's `blocked` is the single emptiness test both controls read"
    - "a refusal on an existing seam, in preference to a new cross-component flush promise"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
    - .planning/phases/186-concurrency-autosave/deferred-items.md
decisions:
  - "D-186-16-A: the gate rides the existing `blockedReason` seam; `flushPendingWrites()` REJECTED because the gauntlet mounts unconditionally on both branches of the flag gate, so an unguarded flush is a write past the D-181-01 revert switch"
  - "D-186-16-B: the saving branch is ranked FIRST in the memo — the nearest obstacle is the one named"
  - "D-186-16-C: `conflict` / `error` are deliberately NOT blocked; only the bounded `saving` state is"
metrics:
  tasks: 2
  commits: 2
  duration: ~35 min
  completed: 2026-08-01
---

# Phase 186 Plan 16: Publish Refuses an Outstanding Write Summary

A gauntlet can no longer be started while an autosave PATCH is unanswered — the Builder's own
`persistState.kind === "saving"` now reaches the publish seam as a reason, it refuses the INNER
modal Publish as well as the header trigger, and the sentence renders beside both.

## What Was Built

**Task 1 — the page names the write** (`e7b2b237`)

- `SAVING_PUBLISH_WAIT`, a new exported constant beside `EMPTY_DRAFT_INVITATION`.
- ONE branch in the `blockedReason` memo, ordered after the flag/phase guard and **before**
  the empty-draft branch, with `persistState` added to the dependency array.
- The memo's docblock now records why this is not the client computing a verdict (D-182-06)
  and the ordering property that makes the gate sound without a promise.

**Task 2 — the gauntlet refuses, and says so from inside** (`3f06d112`)

- `canPublish = goldenInput.trim().length > 0 && !loading && !blocked`. `blocked` and
  `blockedReason` are passed DOWN from the wrapper; the emptiness test was not recomputed.
- A `publish-inner-blocked-reason` element beside the disabled inner button, tied with
  `aria-describedby` via its own `useId`.
- Two entries appended to `deferred-items.md`, each with a re-open trigger.

## The new sentence, verbatim

```
Saving your last change — Publish will be ready in a moment
```

Declared once, at `frontend/src/pages/WorkflowBuilderPage.tsx:285-298`:

```ts
export const SAVING_PUBLISH_WAIT = "Saving your last change — Publish will be ready in a moment"
```

It reads as a **wait**, not a fault: nothing is wrong and the author has nothing to fix. Pinned
as a literal exactly once, in the canvas suite, so a re-wording has to be deliberate.

## Task 1 RED — observed before the source edit, verbatim

Command: `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx -t "186-16" --testTimeout=30000`

```
 × names the outstanding write while it is outstanding, and stops naming it when it lands 2350ms
 × the saving reason OUTRANKS the empty-draft invitation — the nearest obstacle is the one named 2067ms

FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 186-16 — an
outstanding write blocks publish (WR-10) > names the outstanding write while it is
outstanding, and stops naming it when it lands
AssertionError: expected null to be 'Saving your last change — Publish wil…' // Object.is equality

FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 186-16 — an
outstanding write blocks publish (WR-10) > the saving reason OUTRANKS the empty-draft
invitation — the nearest obstacle is the one named
AssertionError: expected 'Add a step to get started' to be 'Saving your last change — Publish wil…'

Expected: "Saving your last change — Publish will be ready in a moment"
Received: "Add a step to get started"

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed | 84 skipped (87)
```

The pre-fix values are therefore recorded exactly as WR-10 predicted: `null` with a valid
draft (nothing at all refused the publish while a PATCH was outstanding), and the *validation*
invitation on the empty draft (the saving state was invisible to the seam).

**The one row that passed at RED is the D-181-01 control** — with the flag off no write is
issued and no reason is produced, which was true before this plan and had to stay true after.
It is included in the describe on purpose: a control that only starts passing after the fix
proves nothing about flag-off identity.

*Method note (honest):* the RED run used the sentence as a local literal, because importing a
not-yet-existing named export from the page is an ESM link error that fails the whole file and
reports nothing about `blockedReason`. Once the constant existed the literal was replaced by
the import plus a single character-identity pin, so the wording has one home.

## Measured diff — `frontend/src/pages/WorkflowBuilderPage.tsx`

```
 frontend/src/pages/WorkflowBuilderPage.tsx | 27 +++++++++++++++++++++++++--
 1 file changed, 25 insertions(+), 2 deletions(-)
```

**25 insertions — at the plan's cap of 25, not over it.** The first draft measured 26 and two
docblock lines were condensed to come in under the ceiling; this file is on the G-5 hot-file
ledger and the plan forbade growing it further. Of those, the **memo body is 2 lines**: one new
branch (`if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT`) and the dependency
array line, against a budget of 6. The mount line at `:1724` is untouched.

Fence checks, all measured after the edit:

| Check | Before | After |
|---|---|---|
| `grep -c "const blockedReason = useMemo"` | 1 | 1 (byte-identical anchor, now at `:1076`) |
| `grep -c "UNBOUND_KB_INVITATION"` | 4 | 4 |
| `grep -n "persistState"` inside the memo | absent | `:1078` (body) and `:1085` (deps) |

`WorkflowBuilderPage.header.test.tsx` — which carries the F16 source fence and the flag-off
header literal — passes unchanged, including all three fence cases (real source, planted
escape, prose-only negative control).

## Every consumer of `blockedReason`, and its flag-off reachability

Required by the plan's verification. All five read the SAME wrapper-derived `blocked`
(`PublishGauntlet.tsx:846`), whose input is the page's `blockedReason` prop.

| # | Consumer | Site | Reachable with `canvasEnabled` false? |
|---|---|---|---|
| 1 | the trigger's `disabled={blocked}` | `PublishGauntlet.tsx:921` | **No** |
| 2 | the trigger's `aria-describedby` | `:922` | **No** |
| 3 | the trigger's sibling reason span (`publish-blocked-reason`) | `:932-939` | **No** |
| 4 | the inner `canPublish` (`&& !blocked`) → the inner button's `disabled` | `:592`, `:705` | **No** |
| 5 | the inner reason element (`publish-inner-blocked-reason`) + its `aria-describedby` | `:694-701`, `:706` | **No** |

The reason all five are unreachable is one line and not five: `blockedReason`'s memo returns
`null` on `if (!canvasEnabled || builderPhase !== "drafted")` **before** any other branch runs
(`WorkflowBuilderPage.tsx:1077`), so `blocked` is `false` on the flag-off surface by
construction and every site above collapses to its shipped form. The hazard is also absent
there in the first place — the write loop's `enabled` requires `canvasEnabled`, so no autosave
ever runs with the flag off. This is asserted, not merely argued: the flag-off row in the new
canvas describe drives an edit, waits 2200 ms (past the 1000 ms debounce) and measures
`mockUpdate` calls = 0, `blockedReason` = `null`, and no reason element in the DOM.

## Test counts, measured per file in isolation at `--testTimeout=30000`

| Suite | Before | After |
|---|---|---|
| `PublishGauntlet.test.tsx` | **41 passed / 41** | **46 passed / 46** (+5) |
| `WorkflowBuilderPage.canvas.test.tsx` + `.header.test.tsx` (pair) | 111 (derived: 114 − the 3 added) | **114 passed / 114** (+3) |
| the 4-file acceptance set (adds `WorkflowsPage.test.tsx`) | — | **183 passed / 183**, 0 failures |

`npx vite build` exits **0**. `ls supabase/migrations \| tail -1` is still
`114_harness_audit_action_risk_pending.sql`; `git diff --stat frontend/package.json
frontend/package-lock.json` is empty (T-186-16-SC).

### Falsification, not just a green run

The plan's threat register asks that T-186-16-01 be falsifiable. It was falsified before being
claimed: `&& !blocked` was temporarily removed from `canPublish` and the suite re-run.

```
 × a reason arriving mid-modal disables Publish DESPITE a valid golden input, and says why INSIDE the modal
 × clicking the refused Publish issues NO publish request — the claim is that nothing left
 × the reason CLEARING re-opens the gate — one click, exactly one request
      Tests  3 failed | 2 passed | 41 skipped (46)
```

Exactly the three gate rows go red; the two identity rows (no prop supplied,
whitespace-only reason) correctly stay green because they do not depend on the gate. The
source was then restored and re-verified. **The `no request left` row is measured on the
mocked transport, not on the rendered outcome** — a golden run's cost is spent the moment the
request leaves — and the cleared-reason row is its positive control, so the disable above is
measuring the gate rather than a broken button.

## Corrections to claims inherited from the plan

Measured, not assumed. Each of these was stated in `186-16-PLAN.md` and is false against the
tree as it stands:

1. **`PublishGauntlet.test.tsx` had NO R12 blocked-trigger cases.** The plan's Task 2
   `read_first` says to read "the R12 blocked-trigger cases" there. `grep -n "blockedReason"`
   over that file returns nothing at HEAD~2 — every R12 assertion lives in
   `WorkflowBuilderPage.canvas.test.tsx` (`184-11 — a blocked publish NAMES its reason`). The
   new describe therefore introduces the component-level coverage of the prop, trigger half
   included by way of the byte-identity row.
2. **The prop docblock's "24 shipped assertions" is stale.** The file measured 41 in isolation
   before this plan. The docblock line was left untouched rather than silently corrected — it
   is not this plan's claim to re-make, and editing it would put a second number in flight.
3. **The canvas-pair baseline is 111, not 141.** The plan's verification block states "the
   verifier's canvas-pair baseline is 141". `canvas.test.tsx` + `header.test.tsx` measure 114
   after this plan added exactly 3 rows, so the pre-plan pair was 111. Whatever 141 counted, it
   was not these two files.
4. **`WorkflowsPage.test.tsx` exists** (the plan asked for this to be stated either way), and
   is included in the 183-test acceptance run above.

## Deviations from Plan

None of the deviation rules fired. No bug, missing-critical-functionality or blocking issue was
encountered; nothing architectural was needed. The four corrections above are measurement
findings recorded for the verifier, not changes to what was built.

## Deferrals recorded

Appended to `.planning/phases/186-concurrency-autosave/deferred-items.md` (`## ` headings 4 → 6,
`Re-open trigger` occurrences 4 → 6):

1. **The publish-time `flushPendingWrites()` seam — rejected on a safety argument.** The
   gauntlet mounts unconditionally on **both** branches of the flag gate, so a flush called
   from `runGauntlet` would issue an unrequested PATCH on the flag-off surface — the write past
   the revert switch that D-181-01 exists to forbid and that 186-13 closed for the hold
   release. Re-gating it on `enabled` makes it a conditional flush wearing a guarantee's
   clothes. Re-open trigger: a `draft_changed` refusal observed live **despite** this gate, or
   the first phase that gives the gauntlet a flag-aware seam of its own.
2. **Publish while the loop is in `conflict` or `error` — not blocked here.** `saving` is safe
   to block because it is *bounded* (`performWrite`'s `finally` always clears `inFlightRef`);
   `conflict` is not, and blocking it changes what an author may do with a draft that has a
   stale sibling tab. Re-open trigger: the first report of a publish shipping a definition the
   author had already been told was in conflict, or the phase that gives the conflict banner a
   publish-aware reading.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced; every
element added renders a value supplied by a live caller.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema surface was added — the
change is two client-side booleans and one rendered sentence. `supabase/migrations` is
unchanged and no dependency was added.

## What Was NOT Closed

- A publish attempted while the write loop is in `conflict` or `error` (deferred above, with a
  trigger). WR-10's window for the `saving` case is closed; this is a different finding.
- `186-VALIDATION.md` rows 3 / 3b (publish race, publish hold) become newly observable by hand
  but were deliberately **not** edited — 186-14 and 186-17 own that file this round, per the
  plan's own instruction.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND (modified, `SAVING_PUBLISH_WAIT` at `:298`)
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND (+147 lines, 0 deletions)
- `frontend/src/components/workflows/PublishGauntlet.tsx` — FOUND (`publish-inner-blocked-reason` at `:697`)
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — FOUND (+5 tests)
- `.planning/phases/186-concurrency-autosave/deferred-items.md` — FOUND (+2 entries)
- commit `e7b2b237` — FOUND
- commit `3f06d112` — FOUND
- no file deletions in either commit (`git diff --diff-filter=D` empty for both)
