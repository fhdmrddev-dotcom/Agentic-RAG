---
phase: 193-authoring-doors-template-placement
plan: 01
subsystem: workflow-authoring-doors
tags: [characterization-baseline, wave-0, count-gate, run-modal, door-switch]
requires: []
provides:
  - "WorkflowDoorSwitch.baseline.test.tsx — six whole-innerHTML captures of the UNMOVED tree at 501b3c14"
  - "The D-05 ml-auto pair, asserted on the judge badge's OWN class list (the whole-capture form is FALSE — measured)"
  - "RunModal.test.tsx — launch-failure visibility on a NON-admitting workflow, driven RED before it was trusted"
  - "count-gate BASELINE pin for the new suite (17), and a 29-case correction to the stale BASELINE_TOTAL marker"
affects:
  - "193-02..193-11 — every later wave is judged against these captures; a deletion in them is a re-capture and must be stated"
tech-stack:
  added: []
  patterns:
    - "192-03 capture idiom: one shared render→read helper, non-vacuity guard before every toBe, marker rows off the COMMITTED string"
    - "RunModal.test.tsx:408 dynamic-import idiom for EffectiveFeaturesProvider — the REAL gate, no module mock"
key-files:
  created:
    - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
  modified:
    - scripts/vitest-count-gate.cjs
    - frontend/src/pages/__tests__/RunModal.test.tsx
decisions:
  - "The GOVERN_INLINE row is captured with the canvas gate ON, because with it OFF the Builder does not host the merged header and the row's ml-auto fence could not fire"
  - "The D-05 pair is asserted on the judge badge's own class list, not on the whole capture — the whole-capture negative is FALSE on the shipped tree"
metrics:
  duration: ~35 min
  completed: 2026-08-13
---

# Phase 193 Plan 01: Wave-0 Characterization Baselines Summary

Six whole-`innerHTML` captures of `WorkflowDoorSwitch` and one launch-failure case, both taken on the
UNMOVED tree in commits that touch no source file — and three claims the plan inherited were measured
FALSE and corrected rather than forced.

## Worktree provenance

| Item | Value |
|---|---|
| Bootstrap | `bash scripts/bootstrap-worktree.sh .` ran FIRST — `BOOTSTRAP OK` |
| HEAD on arrival | `fda792141b0129de7b15dd40ddc1082e76f95a2a`, whose `merge-base` with the dispatched base was `3781a3fe` — **NOT a descendant of the dispatched base** |
| Action | `git reset --hard 501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406`, then re-bootstrapped |
| **Base SHA (asserted)** | **`501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406`** |
| Branch | `worktree-agent-a625e79e229e421c3` (in the `worktree-agent-*` namespace) |
| Vitest workers | `GSD_VITEST_MAX_WORKERS=4` exported on every run |

⚠ The Phase-192 finding reproduced exactly: this worktree came up on the wrong base. Had the
assertion been skipped, every capture below would have been taken against a tree nobody asked for,
with all gates still green.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 | `011b1a79` | `WorkflowDoorSwitch.baseline.test.tsx` (new), `scripts/vitest-count-gate.cjs` |
| 2 | `7eeaa133` | `frontend/src/pages/__tests__/RunModal.test.tsx` |

`git log --name-only 501b3c14..HEAD` lists **three paths, all of them test files or the gate script** —
no path under `frontend/src/**` that is not a `*.test.tsx`. D-08's property holds mechanically.

## The capture SHA, and the two exit-128 proofs verbatim

```
$ git rev-parse HEAD
501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406

$ git show HEAD:frontend/src/components/workflows/DoorHeaderStrip.tsx
fatal: path 'frontend/src/components/workflows/DoorHeaderStrip.tsx' does not exist in 'HEAD'
EXIT=128

$ git show HEAD:frontend/src/components/workflows/doorVocabulary.ts
fatal: path 'frontend/src/components/workflows/doorVocabulary.ts' does not exist in 'HEAD'
EXIT=128
```

Both are pasted into the suite's own docblock, so the proof is re-runnable rather than believed.

## The six captures — byte lengths

| Row | Bytes | `ml-auto` on the judge badge | host band |
|---|---|---|---|
| `CHOOSER_STANDALONE` | 2079 | — | absent |
| `CHOOSER_INLINE` | 2228 | — | `host-lead` present |
| `DESCRIBE_STANDALONE` | 3510 | — | absent |
| `DESCRIBE_INLINE` | 3583 | — | `host-lead` present |
| `GOVERN_STANDALONE` | 2172 | **present** | absent |
| `GOVERN_INLINE` | 2924 | **absent** | `host-lead` + `builder-header-bar` present |

Captured **twice** on the unchanged tree into two files and `diff`ed → *TWO RUNS AGREE BYTE FOR BYTE*.
Every string was written into the suite by mechanical substitution from the dump, never hand-typed.

## Three inherited claims measured FALSE — corrected, not forced

**1. `GOVERN_INLINE` captured with the canvas gate OFF renders NO door group at all.**
The plan's row 6 is `initialDoor="govern"` + `inline` + `headerLead`. Captured exactly that way, the
row measured **1400 bytes containing neither `both-doors` nor `judge-locked`** — because the govern
door hands its group to the Builder as `headerTrail`, and the Builder hosts that merged row only when
`preDraftHeaderHosted = canvasEnabled && (headerLead !== undefined || headerTrail !== undefined)`.
`useCanvasGate()` is `false` without an `EffectiveFeaturesProvider`, so the group was silently dropped
and the row's `ml-auto` negative would have passed **because nothing rendered** — a fence that cannot
fire, the 192.1 lesson. Fixed by driving the REAL gate through the REAL provider (the
`RunModal.test.tsx:408` dynamic-import idiom), `canvasOn` mirroring `inline` exactly as
`WorkflowsPage` does. The row is now 2924 bytes and carries the group.

**2. `DOOR_HTML_BASELINE.GOVERN_INLINE` DOES contain the substring `ml-auto`.**
The plan's acceptance criterion says it must not. Measured, `BuilderHeaderBar` puts `ml-auto` on its
OWN trailing group (`<div class="ml-auto flex shrink-0 items-center gap-2">`), so a whole-capture
negative is false on the shipped tree — and a whole-capture negative that passed would only ever have
been measuring the header bar, not the badge. The fence is therefore asserted on the **judge badge's
own class list**, extracted from the committed string by an attribute-order-independent reader:

```
GOVERN_STANDALONE  judge-locked class = "ml-auto inline-flex items-center gap-1 rounded-full …"
GOVERN_INLINE      judge-locked class =         "inline-flex items-center gap-1 rounded-full …"
```

asserted as `standalone === "ml-auto " + inline` — stronger than either `toContain`, and it pins the
source's own claim that the non-inline string is character-for-character what shipped. A POSITIVE
CONTROL row proves the reader is not returning `""` (which would make the negative half pass on a
broken helper).

**3. The count-gate `BASELINE_TOTAL` marker was stale by 29, not by the drift its own note implied.**
The marker read `⚠ 3384 (192.1-06)`; the gate printed `pinned total 3413` on an unmodified tree at
this plan's base. The 192.1-06 note directly above it says the marker "was NOT stale this time" and
that "the habit is what fixed it" — measured, the habit lapsed on the very next commit that moved a
pin. Corrected **on measurement, stated rather than overwritten**, with both wrong figures left
visible. The pinned FILE count in that note (63) was also one behind; the gate's own footer said
`64/64` before this plan's entry and `65/65` after.

## The mock set needed one member beyond the sketch harness

With the canvas gate ON, the Builder's hosted header mounts `useGroundingBundle`, and the capture died
at mount with *"No `getGroundingBundle` export is defined on the `@/lib/api` mock"*. Added and resolved
to `{ tools: [], folders: [], skills: [], degraded: [] }` — the identical value the four shipped
`WorkflowBuilderPage.*` suites use, so nothing about the capture is invented.

## Task 2 — the launch-failure case, driven RED

One case appended to `RunModal.test.tsx` as a **pure insertion: 111 insertions / 0 deletions**
(`git diff --numstat`), so not one `*_BASELINE` literal was touched. It renders `RunModal` directly
(the 192-06 isolated idiom) with a definition holding a single `programmatic` phase and **no**
`llm_emit` phase — asserted inside the test, with a non-vacuity guard first so an empty phase list
cannot satisfy it — drives `run-confirm`, rejects `onRun` with `"scope unavailable"`, and asserts
`run-upload-error` is present, carries `role="alert"`, holds that exact message and NOT the
`"Run failed"` fallback. It also records, as a measurement of the shipped tree, that the alert
currently shares a parent with `run-provenance` — i.e. it sits inside the block D-17 removes.

**Observed RED before it was trusted.** `{launchError && (` was planted as `{false && launchError && (`
in `library/RunModal.tsx` — the exact silence a naive D-17 cut produces — and the case failed with
*"Unable to find an element by: [data-testid=\"run-upload-error\"]"*. The plant was then reverted with
`git checkout -- <that one file>` and the suite returned to 33 passed. **No source file is in either
commit.**

## Verification

| Check | Result |
|---|---|
| `vitest run WorkflowDoorSwitch.baseline.test.tsx` | **17 passed, 0 failed** |
| `vitest run RunModal.test.tsx` | **33 passed, 0 failed** (was 32 pinned; a count INCREASE, and `193-11` owns the pin sweep) |
| `node ../scripts/vitest-count-gate.cjs` | **exit 0** — `total 3455 · failed 0 · pinned total 3430`, `65/65 pinned files present, no per-file decrease` |
| New suite's gate pin | **17**, read from the gate's own `actual` column (`WorkflowDoorSwitch.baseline.test.tsx — 17 new`), never hand-counted |
| Corrected `BASELINE_TOTAL` | **3430** (was marked 3384; measured 3413 before this plan's entry) |
| `tsc --noEmit -p tsconfig.app.json` | **33 errors — unmoved** |
| `eslint src/components/workflows/` | **10 errors, all pre-existing**; 0 in any file this plan touched |
| `eslint src/pages/__tests__/RunModal.test.tsx` | **0** |
| Residual gate gap | **+25** = the four inherited drifts (+24, declined for the ninth consecutive plan) + this plan's 1 unpinned new `RunModal` case |

## Deviations from Plan

### Auto-fixed / corrected

**1. [Rule 1 — Fence that could not fire] `GOVERN_INLINE` captured with the canvas gate on**
- **Found during:** Task 1, first dump
- **Issue:** With the gate off the row rendered no door group; its `ml-auto` negative was vacuous.
- **Fix:** `canvasOn` field on the capture row, driving the REAL `EffectiveFeaturesProvider`.
- **Commit:** `011b1a79`

**2. [Rule 1 — Inherited claim false] The D-05 `ml-auto` assertion re-scoped to the badge's class list**
- **Found during:** Task 1, second dump
- **Issue:** The plan's acceptance criterion (`GOVERN_INLINE` must not contain `ml-auto`) is false —
  `BuilderHeaderBar` carries the token itself.
- **Fix:** `classListOf()` + `standalone === "ml-auto " + inline`, plus a positive control.
- **Commit:** `011b1a79`

**3. [Rule 3 — Blocking] `getGroundingBundle` added to the api mock**
- **Found during:** Task 1
- **Issue:** Gate-on render threw at mount.
- **Fix:** Mocked to the shipped suites' empty bundle.
- **Commit:** `011b1a79`

**4. [Rule 2 — Honesty] `BASELINE_TOTAL` marker corrected by 29, file count by 2**
- **Commit:** `011b1a79`

### Not done, deliberately

- `RunModal.test.tsx`'s gate pin was NOT raised (32 → 33 is drift, not a gate failure; `193-11` owns
  the sweep, per the plan's own instruction).
- The four pre-existing pin drifts (+24) were not absorbed — recorded as still owed.
- `STATE.md` / `ROADMAP.md` untouched; no `gsd-sdk state.*` verb was called.

## Known Stubs

None.

## Threat Flags

None. No network surface, no schema, no auth path — two test files and a gate script.

## Self-Check: PASSED

- `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` — FOUND
- `scripts/vitest-count-gate.cjs` — FOUND (modified)
- `frontend/src/pages/__tests__/RunModal.test.tsx` — FOUND (modified)
- commit `011b1a79` — FOUND
- commit `7eeaa133` — FOUND
