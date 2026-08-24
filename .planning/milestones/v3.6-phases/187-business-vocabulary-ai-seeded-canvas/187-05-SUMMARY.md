---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 05
subsystem: frontend-workflow-builder
tags: [d-181-01, byte-identity, flag-off, describe-screen, markup-pin, vocab-03]
requires:
  - "frontend/src/pages/WorkflowBuilderPage.tsx (unmodified — the surface under pin)"
  - "frontend/src/providers/EffectiveFeaturesProvider.tsx (the visibility map)"
provides:
  - "FLAG_OFF_DESCRIBE_MARKUP — the byte-identity pin on the flag-off describe-screen CTA region"
  - "renderDescribeScreen(visibilityMap) — a settled fresh-build describe-screen harness"
  - "ctaRegion() / describeRegion() — the door's landing zone, resolved by walking up from describe-hint"
affects:
  - "187-14 / 187-13 / 187-15 — the template door and the quiet line must keep this green or they leaked flag-off"
tech-stack:
  added: []
  patterns:
    - "verbatim normalised outerHTML literal, written ONCE, asserted for two audiences"
    - "operator-like map asserted against the SAME literal, never a second copy"
    - "a formatting-independent negative guard beside the strict literal"
    - "a positive control that plants the door into the captured string so both guards are seen to bite"
key-files:
  created:
    - "frontend/src/pages/WorkflowBuilderPage.describe.test.tsx"
  modified: []
decisions:
  - "The pinned region is the CTA flex column (WorkflowBuilderPage.tsx:1450-1465), resolved by walking UP from describe-hint — never a class selector."
  - "The literal is captured with the CTA DISABLED, because an empty describe box is the state a person actually lands on."
  - "tsc -b is read as 'no NEW error, none in touched files' — 33 pre-existing errors at HEAD, unchanged (D-ITEM-01)."
metrics:
  duration: ~20 min
  completed: 2026-08-02
---

# Phase 187 Plan 05: Flag-Off Describe-Screen Markup Pin Summary

A verbatim `outerHTML` pin on the Builder's flag-off describe-screen CTA region, captured against
the unmodified page in wave 1, so the Phase-187 template door cannot ship to
`visual_workflow_canvas`-OFF users unnoticed.

## What Was Built

`frontend/src/pages/WorkflowBuilderPage.describe.test.tsx` — 7 tests, green on unmodified HEAD.

**Why it exists, measured rather than assumed.** `describeScreen`
(`WorkflowBuilderPage.tsx:1403-1495`) is constructed on **both** flag branches; only the
`BuilderHeaderBar` wrapper at `:1484-1493` is flag-dependent. So Req 6's "one quiet line under the
CTA" would render with `visual_workflow_canvas` OFF unless it is explicitly `canvasEnabled`-gated —
and no shipped test covered it. `WorkflowBuilderPage.header.test.tsx` pins the three header bands
and nothing below them; `WorkflowBuilderPage.canvas.test.tsx` pins flag-off *behaviours* on the
**drafted** view, which the describe screen never reaches.

**The harness.** `renderDescribeScreen(visibilityMap)` mounts `WorkflowBuilderPage` with **no
`initial`**, so the store boots `builderPhase === "empty"` and the page settles on the describe
screen (the fresh-build route — the only one that shows this surface). It awaits `describe-hint`,
then awaits `listSkills` having been called (the two mount fetches are sequential `await`s in one
effect at `:1107-1133`, so the second having fired proves the first already resolved and its
`setState` landed), then takes one more act-wrapped tick so the second `setState` lands too. Nothing
is captured from an unsettled render.

The `vi.hoisted` block enumerates the **whole** api surface the header pin enumerates — all 13
symbols including `mockListStarters` — because a factory mock that omits one hands back `undefined`
and the failure surfaces far from its cause.

**The region.** `ctaRegion()` walks **up** from `screen.getByTestId("describe-hint")` to its parent
element and asserts that parent contains the `Draft the workflow` button. A class-based selector
would silently start matching a different node after a Tailwind edit; the containment assertion
means a re-parenting that separated the hint from the CTA fails loudly here rather than quietly
pinning a smaller box. `describeRegion()` is that element's whitespace-normalised `outerHTML`.

**The three guards.**

1. `matches the captured flag-off describe-screen CTA region byte for byte` — the absent-key map
   against `FLAG_OFF_DESCRIBE_MARKUP`.
2. `an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)` — the
   operator-like variant against **the same constant**. D-181-01 stated as an equality, not as a
   second copied literal that could drift.
3. `says NOTHING about a template or a starter` — a formatting-independent negative guard,
   asserted over both `textContent` (the words) and the normalised markup (so an `aria-label` or
   `title` on a door trigger cannot hide from it). The literal is the strict half and a strict half
   alone tempts a re-capture; a re-capture would silently swallow a leaked door, and this guard
   cannot be quieted that way.

Plus a **positive control** (`both guards FIND a planted door`): the door shape 187-15 will add is
planted into the captured string, and both the byte comparison and the word guard are observed to
reject it. The page itself is deliberately not mutated to do this — the pin's credibility rests on
`WorkflowBuilderPage.tsx` being untouched.

Three `OFF_VARIANTS` (absent key / explicit false / operator-like) plus the no-provider fail-closed
row are carried across from the header pin verbatim, so the two files cannot disagree about what
"off" means.

## Key Decisions

- **The pinned region is the CTA flex column, not the whole describe screen.** That is where the
  door lands (`:1450-1465`). Pinning the whole screen would also pin the project picker, whose
  contents vary with `listFolders`, making the literal a fixture artefact rather than a promise.
- **The literal is captured with the CTA `disabled=""`.** `canDraft` is false while the describe box
  is empty, which is the state a person actually arrives on. A pin taken with text typed in would be
  pinning a screen nobody sees first.
- **The negative guard is a word CLASS (`/template|starter/i`), not a specific sentence.** The
  picker's trigger wording is fixed in plan 187-10's copy constants and does not exist yet; asserting
  the class means the guard bites whatever that copy turns out to say.

## Verification

| Check | Result |
|---|---|
| `npx vitest run …describe.test.tsx` | **7 passed** |
| `npx vitest run describe + header + canvas` | **122 passed** (baseline header+canvas = **115**, unchanged; +7 net-new) |
| `npx vitest run describe + header + canvas + session + WorkflowBuilderPage.test` | **161 passed / 5 files** |
| `npx tsc -b` | **33 errors, 0 in `src/pages/WorkflowBuilderPage.describe.test.tsx`** — identical to the HEAD baseline |
| `git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx` | **empty** — the page is unmodified (T-187-05-03) |
| `grep -c FLAG_OFF_DESCRIBE_MARKUP` | **5** (≥ 3 required) |
| `grep -c 'Draft the workflow</button>'` | **1** — the literal appears exactly once |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `describeRegion` split into `ctaRegion()` + `describeRegion()`**
- **Found during:** Task 1
- **Issue:** The plan describes one helper that returns the normalised `outerHTML`, but the
  formatting-independent negative guard of Task 2 needs the **element** (for `textContent`). Keeping
  one string-returning helper would have forced a second `getByTestId` + walk-up in the guard — a
  second copy of the resolution rule, which is exactly the drift this project's one-home discipline
  forbids.
- **Fix:** `ctaRegion(): Element` owns the walk-up and its containment assertion; `describeRegion():
  string` is `normalise(ctaRegion().outerHTML)`. One resolution, two readings.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.describe.test.tsx`
- **Commit:** `b9b58b39`

**2. [Rule 3 - Blocking] The `npx tsc -b` acceptance criterion is unmeetable and was read as intended**
- **Found during:** Task 1
- **Issue:** Both tasks require `npx tsc -b` to exit 0. It never has on this repo — **33 pre-existing
  errors** at HEAD (owners: `SettingsPage`, the `__tests__` tree, `MessageSkeleton`, `SkillFormDialog`,
  `lib/api.test.ts`), 0 of them in `src/pages/WorkflowBuilderPage.describe.test.tsx`. Plan 187-04
  measured the same 33 and logged it as `D-ITEM-01`.
- **Fix:** Read as "no NEW error, none in the touched file". Measured **34** with an unused
  `describeMarkup` helper in the first draft, corrected to **33** — exactly the HEAD baseline.
- **Files modified:** none (a criterion reading, not a code change)
- **Commit:** n/a

**3. [Rule 2 - Missing critical] A positive control was added for both guards**
- **Found during:** Task 2
- **Issue:** A pin that has only ever been observed green is a pin nobody has watched fail. Phase
  185's recorded lesson is exactly this ("observe falsification RED first"), and a captured literal
  is the easiest kind of assertion to write vacuously.
- **Fix:** `both guards FIND a planted door` plants the 187-15 door shape into the captured string
  and asserts the byte comparison and the word guard both reject it. The plant is on the string, not
  on the page — `WorkflowBuilderPage.tsx` stays untouched, which is threat T-187-05-03's mitigation.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.describe.test.tsx`
- **Commit:** `8dbb3b03`

### Scope-boundary notes

The 33 pre-existing `tsc` errors were **not** fixed — out of scope, already logged as `D-ITEM-01` in
the phase's `deferred-items.md` by plan 187-04.

## Carry Forward (what 187-13 / 187-14 / 187-15 must not rediscover)

1. **The describe screen renders on BOTH flag branches.** Only `preDraftHeaderHosted`
   (`WorkflowBuilderPage.tsx:1399-1400`) consults `canvasEnabled` on this route. Anything added
   inside `describeScreen` ships flag-OFF unless it carries its own `canvasEnabled` gate. This pin is
   what makes that fact loud.
2. **The pin is on the CTA flex column, and it is keyed to `describe-hint`.** A door mounted as a
   **sibling of that column** (above the CTA, or between the picker and the CTA) will NOT trip the
   byte pin — the pin covers the door's *stated* landing zone per the plan's `must_haves`, which is
   under the CTA. If 187-15 mounts elsewhere on the describe screen, widen the region deliberately
   rather than assuming coverage.
3. **The pinned literal contains the CTA in its `disabled` state.** A change to `canDraft`'s initial
   value reds this pin. That would be a real product change, not a test artefact.
4. **`npx tsc -b` has never exited 0 here** — 33 errors at HEAD, none in `components/workflows` or in
   this file. Read every 187 typecheck criterion as "no NEW error, none in touched files".

## Threat Flags

None. This plan adds test-only code and touches no network endpoint, auth path, file access pattern
or schema.

## Known Stubs

None.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.describe.test.tsx` — FOUND
- commit `b9b58b39` — FOUND
- commit `8dbb3b03` — FOUND
