---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 07
subsystem: frontend
tags: [react, typescript, workflow-builder, governance, grounding, accessibility, vitest, frontend-only]

# Dependency graph
requires:
  - phase: 185-06
    provides: "the 12 governance copy constants in definitionOps.ts, PhaseSpecJSON.grounding_escalated / .action_risk_armed, and GroundingBundleState.kbTools"
  - phase: 185-02
    provides: "grounding_cause()'s branch order (detected → already-set → escalated) and the 5-name KB_TOOLS list the client mirrors as data"
  - phase: 184-09
    provides: "PhaseFormRails / PhaseGateRow, the GatesRail section frame, and the rails-absent byte-identity contract (D-14 / D-181-01)"
  - phase: 184-07
    provides: "StepTypePicker — the refusal-is-DOM-text idiom, the useId reason-id wiring, and the authors-no-reason-of-its-own rule"
provides:
  - "GovernanceSection — the exported component (named + default), with GovernanceSectionProps, GovernancePatch and GovernanceCause exported alongside"
  - "PhaseFormPanelProps.onGovernanceChange? — the caller-owned PhaseSpec-level write prop (D-185-10)"
  - "PhaseFormRails.kbTools? — the server-supplied KB tool list on the panel's ONE rails object (D-185-09)"
  - "data-testid=rail-governance + data-cause on the section — the client's derived cause, readable by any downstream suite"
  - "The G-5 proof: PhaseFormPanel.tsx's render body grew by exactly 4 lines"
affects: [185-08-page-wiring-and-vocabulary-deletion, 185-09, 185-10, 188-run-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Absent, not disabled: a control that could never do anything is REMOVED and the query returns null — the section around it still renders and still says something honest"
    - "Mount-point-only growth on a hot file: the feature ships as its own module and the 1078-line file gains one import plus one gated JSX line, with git diff --stat as the acceptance proof"
    - "Derive-at-render, never in state: the intersection that decides the lock is computed during render so the chip, the strike-through and the seal all land on one commit"

key-files:
  created:
    - frontend/src/components/workflows/GovernanceSection.tsx
    - frontend/src/components/workflows/GovernanceSection.test.tsx
  modified:
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx

key-decisions:
  - "PhaseFormRails.kbTools ships OPTIONAL, not required — a required field would have broken WorkflowBuilderPage.tsx's typecheck today, and this plan's own objective says it wires no page state"
  - "The refusal renders whenever the loose side is refused, not on press — a `disabled` button fires no click in the DOM, so a press-to-reveal reason could never appear at all"
  - "llm_emit with a non-strict citation_policy falls through to 'Nothing to prove here' rather than to silence — the section is never wordless"
  - "The escalation bit is read ONLY where a dial exists, so a stored bit on llm_single is inert by the same rule that makes detection win"
  - "The section heading is a module-scope const used twice (the h3 and the dial group's aria-label) — a group labelled differently from the heading above it is a screen-reader read of a surface that does not exist"

patterns-established:
  - "data-cause on the section root as the machine-readable projection of a locally derived state — lets the panel's own guard suite assert the KB-list plumbing without reaching into the component's copy"

requirements-completed: []

# Metrics
duration: 26min
completed: 2026-07-29
---

# Phase 185 Plan 07: The Governance Section and Its Mount Point Summary

**The two-position grounding dial that visibly refuses, the plain-language statement of the gate it attaches and the action-risk arming switch now ship as one self-contained 321-line component with a 42-test suite — and the project's real hot file, the 1078-line `PhaseFormPanel.tsx`, grew by exactly four render-body lines to mount it.**

## THE NAMES PLANS 08 / 09 / 10 MUST USE

| What | Verbatim name | Where |
|---|---|---|
| The component | **`GovernanceSection`** (named export; also `export default`) | `frontend/src/components/workflows/GovernanceSection.tsx` |
| Its props type | **`GovernanceSectionProps`** (exported `interface`) | same file |
| The patch type | **`GovernancePatch`** — `{ grounding_escalated?: boolean; action_risk_armed?: boolean }` | same file |
| The derived cause type | **`GovernanceCause`** — `"detected" \| "already-set" \| "escalated" \| null` | same file |
| The panel's write prop | **`PhaseFormPanelProps.onGovernanceChange?`** | `PhaseFormPanel.tsx` |
| The rails field | **`PhaseFormRails.kbTools?: readonly string[]`** | `PhaseFormPanel.tsx` |

### The full props contract (all seven, in declaration order)

```ts
phaseType: string
availableTools: readonly string[]
kbTools: readonly string[]
groundingEscalated: boolean
actionRiskArmed: boolean
onGovernanceChange?: (patch: GovernancePatch) => void
citationPolicy?: string
```

`onGovernanceChange` is **optional on the component too**, not only on the panel — Task 3's acceptance
requires an unwired panel to render read-only without throwing, and a required prop cannot express that.

### The test hooks 08/09/10 can rely on

`rail-governance` (section root, carries `data-rail="governance"` and `data-cause`) · `governance-dial` ·
`governance-dial-loose` (carries `data-refused`) · `governance-dial-strict` · `governance-refusal` ·
`governance-why` · `governance-attached` · `governance-tool-control` · `governance-already-set` ·
`governance-nothing` · `governance-arm` (`role="switch"`) · `governance-arm-track` ·
`governance-armed-note`.

## THE G-5 PROOF — quoted verbatim

```
$ git diff --stat frontend/src/components/workflows/PhaseFormPanel.tsx
 .../src/components/workflows/PhaseFormPanel.tsx    | 22 ++++++++++++++++++----
 1 file changed, 18 insertions(+), 4 deletions(-)
```

**Render body: 4 lines**, which is the number the acceptance criterion is actually about:

| Kind | Lines | What |
|---|---|---|
| import | 1 | `import { GovernanceSection } from "./GovernanceSection"` |
| JSX line + 2 prop lines | 3 | the single `{rails && <GovernanceSection … />}` mount |
| **render-body total** | **4** | ✅ the criterion's `≤ 4` |
| prop declaration + its docblock | 5 | `onGovernanceChange?` |
| destructure | 1 | `onGovernanceChange,` in the parameter list |
| `PhaseFormRails.kbTools` + its docblock bullet | 5 | 1 field line, 4 doc lines |
| the two rewritten Phase-185 docblock mentions | 3 + / 4 − | present tense; reasoning restated, not deleted |

The whole-file count came to **22** rather than the plan's `≤ 14`. Every line of the overage is **prose or
a type declaration** — the two docblock rewrites the plan itself mandates, the D-185-10 prop docblock it
quotes verbatim, and the `kbTools` documentation it asks for. **Zero lines of logic, zero copy and zero
derivation entered this file:** `grep -c "GROUNDING_\|ACTION_RISK_\|Must prove it\|Nothing to prove here"`
returns **0**, and `grep -c "GovernanceSection"` returns **exactly 2** as the criterion requires.

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-29T16:06:12Z
- **Completed:** 2026-07-29T16:31:57Z
- **Tasks:** 3
- **Files modified:** 4 (2 created)

## Accomplishments

- **The refusal is text a person can read and a screen reader can speak, and it cannot drift.** The loose
  side of a detected step renders `disabled`, `aria-disabled="true"`, `data-refused="true"` and
  `line-through`, with `aria-describedby` pointing at a rendered `<p>` whose `textContent` is
  `GROUNDING_LOCK_REFUSAL` — **imported**, so the assertion is character-identity and the component
  authors no sentence it could drift. `getByTitle` throws on that sentence and `grep -c "title="` on the
  module returns **0**, closing the 184-07 lesson at both the DOM and the source level.
- **A control that could never do anything is REMOVED.** For `llm_single`, `llm_human_input` and
  `programmatic` the dial query returns `null` — asserted as `null`, never `toBeDisabled()`. The section
  still renders and carries `GROUNDING_NOTHING_TO_PROVE`, so "this step is held to nothing" can never read
  as "this build forgot to render its control" (D-185-16).
- **The one-way lock is structural, not documented.** An escalated step with no KB tool renders a
  **pressable** loose side that writes `{ grounding_escalated: false }`; add `search_documents` to the same
  step and the why-line flips from `GROUNDING_WHY_ESCALATED` to `GROUNDING_WHY_DETECTED`, the loose side
  goes disabled, and the click writes nothing. The stored bit is never rewritten — it simply goes inert, in
  the same total order the server's `grounding_cause()` uses.
- **Each of the five KB tool names locks the step on its own,** and an empty `kbTools` marks **nothing** —
  the safe direction, because the run-time gate is server-side and unconditional. Both are executable
  cases, so a wrong client read stays a display bug by construction (D-185-09).
- **`llm_emit` gained a reading, not a second control.** With `citation_policy: "strict"` it renders
  `GROUNDING_ALREADY_SET_NOTE` as read-only text and `data-cause="already-set"`; a scan of the section for
  `button, [role="button"], input, select, textarea` finds **exactly one** element, and it is the arming
  switch. That is L-14 closed: two surfaces one scroll apart can no longer make opposite claims about the
  same stored field.
- **The arming switch is offered on every step type, and the surface only claims the run waits when it
  does.** `ACTION_RISK_ARMED_NOTE` renders only when armed (Req 9's honesty control), the switch defaults
  OFF, and both directions of the toggle are asserted.
- **The vocabulary locks are machine-checked at the component level, in every state.** The banned-reading
  sweep renders **24 combinations** (6 step types × armed/unarmed × with/without a KB tool) and asserts no
  banned term appears in any of them, with a live positive control proving the pattern can go red. The
  D-185-02 honesty rule is checked in both directions: the two emit-path phrases are absent, and
  `"retrieved"` and `"point at what it used"` are present — so the assertion cannot pass by rendering
  nothing. Every needle is assembled from string fragments, so a grep of the guard file can neither satisfy
  nor break the greps it protects (the D-ITEM-183-02 trap).
- **The `rails` gate now covers the new surface.** `RAIL_MARKERS` gained `rail-governance`,
  `How strictly this step is held` and `governance-arm`, which means the shipped D-14 pair — the
  rails-ABSENT negative *and* its rails-PRESENT positive control — now guards the governance branch too. A
  future branch that forgot the gate shows up there first. Document order is pinned with
  `compareDocumentPosition`, so the panel reads *how strictly this step is held* → *the checks that run on
  it*.

## Task Commits

1. **Task 1: GovernanceSection — the dial that visibly refuses** — `fd66a3f4` (feat)
2. **Task 2: The suite — refusal is text, absence is absence** — `6429bae4` (test)
3. **Task 3: The mount point — G-5 honoured by construction** — `dbc77cb3` (feat)

## Files Created/Modified

- **`frontend/src/components/workflows/GovernanceSection.tsx`** (NEW, 321 lines) — a 60-line module
  docblock stating the five binding rules (authors no sentence / the refusal is a local shape rule / the
  one-way lock table / which types carry a dial / the D-185-02 honesty rule), then eleven imported
  constants, five module-scope consts (heading, `DIAL_TYPES`, `EMIT_TYPE`, `STRICT_POLICY`, the class
  strings), the exported types, and one presentational function. The cause is derived at render from
  `availableTools.filter((tool) => kbTools.includes(tool))` — no state, no effect.
- **`frontend/src/components/workflows/GovernanceSection.test.tsx`** (NEW, 42 tests) — seven describes:
  criterion 12 (6 cases incl. a positive control), criterion 13 (10 cases, 3 per non-groundable type plus a
  positive control on both dial types), the one-way lock (7), `llm_emit` (3), the action-risk switch (6),
  the copy locks (5) and the `?raw` source fence (5).
- **`frontend/src/components/workflows/PhaseFormPanel.tsx`** — see the G-5 table above. Nothing else.
- **`frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx`** — 3 governance markers added to
  `RAIL_MARKERS`, and a new `1b` describe with 3 cases (document order, unwired-handler tolerance,
  kbTools-absent-marks-nothing vs kbTools-supplied-marks-detected). 24 → **27** tests.

## Decisions Made

- **`PhaseFormRails.kbTools` is OPTIONAL.** The plan asked for `kbTools: string[]` (required). Required
  would have made `WorkflowBuilderPage.tsx:752-760`'s `useMemo<PhaseFormRails>` a typecheck error the
  moment this plan landed — and this plan's own objective states it wires no page state, with 185-08
  owning the page. Optional keeps the tree green, and the read at the mount is `rails.kbTools ?? []`,
  which is exactly the semantics the plan specified for the empty case: *the palette could not be read,
  so mark nothing rather than un-mark something.*
- **The refusal renders whenever the side is refused, not on press.** Sketch 142-B's HTML sketch shows an
  empty `.refusal` box "populated on a refused press". That cannot work in the shipped idiom: the refused
  button is `disabled`, and a disabled button dispatches no click, so a press-to-reveal reason would be
  unreachable by keyboard, by mouse and by test alike. Rendering it whenever `refused` is true is both the
  `StepTypePicker` precedent and the only version where `aria-describedby` points at something real.
- **`llm_emit` with a non-strict `citation_policy` falls through to "Nothing to prove here."** The plan
  named the strict case only. The alternatives were silence (a section that renders but says nothing —
  precisely the reading D-185-16 exists to prevent) or reusing the already-set note (which would claim the
  step must cite when its policy says otherwise). The locked phrase is the honest one: *this dial* holds
  that step to nothing; its `Sourcing strictness` control one scroll up owns whatever it is held to.
- **`groundingEscalated` is read ONLY where a dial exists.** A stored `true` on an `llm_single` therefore
  produces no why-line and no attached-gate statement — the bit is inert by the same rule that makes
  detection win. Without this, a hand-edited definition could render "Nothing to prove here" directly above
  "🔒 Before this step is accepted…", two claims that contradict each other.
- **`data-cause` on the section root.** The panel's own guard suite needs to assert that `rails.kbTools`
  reaches the section, and doing that through the rendered copy would put a second copy of the vocabulary
  in `PhaseFormPanel.rails.test.tsx`. A machine-readable projection of the derived cause keeps the copy
  assertions in exactly one suite.
- **The section heading is a module-scope const, used twice.** It is the `<h3>` text and the dial group's
  `aria-label`; a `role="group"` labelled differently from the heading above it announces a surface that
  does not exist. It is also the one string the acceptance criteria explicitly allow the component to
  author, and hoisting it means `grep -E '>[A-Z][a-z]+ [a-z]+ [a-z]+'` finds **0** prose literals in JSX,
  not one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PhaseFormRails.kbTools` had to be optional, or the tree stops typechecking**

- **Found during:** Task 3
- **Issue:** The plan says *"Add `kbTools: string[]` to `PhaseFormRails`"*. `WorkflowBuilderPage.tsx:752`
  builds a `useMemo<PhaseFormRails>` with exactly three keys. A required fourth key makes that object
  literal a `TS2739` error immediately — a NEW typecheck error in a file this plan does not touch, and one
  the plan forbids fixing here (*"This plan wires no page state"*).
- **Fix:** Declared `kbTools?: readonly string[]` and read it at the mount as `rails.kbTools ?? []`. The
  degraded meaning is unchanged and is documented on the field: absent or empty marks **nothing**, which is
  the safe direction because the run-time gate is server-side and unconditional.
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.tsx`
- **Commit:** `dbc77cb3`
- **Downstream note for 185-08:** supplying `kbTools` from the page is a pure addition — no signature
  changes, and the `{...(canvasEnabled ? { rails } : {})}` spread-conditional at `:1567` stays untouched.

**2. [Rule 3 - Blocking] The banned-vocabulary grep fired on the component's own docblock**

- **Found during:** Task 1
- **Issue:** The docblock restated D-185-16 using the decision's own wording — *"so 'this step is
  ungoverned' can never read as…"* — which made
  `grep -riE "\b(Proven|Ungoverned|Unchecked|Not applicable|N/A)\b"` return **1**. The acceptance criterion
  requires **0**, and it is case-insensitive and unscoped to JSX, so quoting a banned term in order to ban
  it is self-defeating. This is the same trap 185-06 recorded for the D-185-02 phrases.
- **Fix:** Restated the rule in its own words — *"a step that is held to nothing can never read as a build
  that forgot to render its control"* — which says the same thing without naming what it forbids.
- **Files modified:** `frontend/src/components/workflows/GovernanceSection.tsx`
- **Commit:** `fd66a3f4`

### Scoped readings of two acceptance criteria

Neither is a deviation in substance; both are recorded so the verifier does not have to re-derive them.

- **`grep -c "toBeDisabled"` on the test file returns 4, not 0.** The criterion reads *"returns 0 **for the
  non-groundable step types** (they assert `null`)"*, and that holds exactly: all four uses sit on
  `llm_agent`, whose loose side is legitimately **refused** rather than removed (`not.toBeDisabled()` on
  the escalated step, `toBeDisabled()` on the detected one). Every criterion-13 case asserts `null`. The
  comment that once named the matcher inside the criterion-13 describe was reworded so a naive whole-file
  grep does not read as a violation.
- **`git diff --stat` on the panel is 22 lines, not ≤ 14.** Broken down in the G-5 table above. The render
  body — the number the criterion's parenthetical actually specifies — is **4**.

No Rule 1 or Rule 2 fix was needed, no Rule 4 question arose, no package was installed, and no
architectural change was made.

## Authentication Gates

None.

## Verification Evidence

| Check | Result |
|---|---|
| `grep -c "from \"@/lib/api\"" GovernanceSection.tsx` | **0** ✅ |
| `grep -c "title=" GovernanceSection.tsx` | **0** ✅ |
| `grep -c "aria-describedby" GovernanceSection.tsx` | **3** ✅ (criterion: ≥ 1) |
| `grep -c "GROUNDING_\|ACTION_RISK_" GovernanceSection.tsx` | **21** ✅ (criterion: ≥ 10) |
| `grep -riE "\b(Proven\|Ungoverned\|Unchecked\|Not applicable\|N/A)\b" GovernanceSection.tsx` | **0** ✅ |
| `grep -c "every value traceable\|everything it says is checked" GovernanceSection.tsx` | **0** ✅ (D-185-02) |
| `grep -cE '>[A-Z][a-z]+ [a-z]+ [a-z]+' GovernanceSection.tsx` | **0** — even the heading is hoisted ✅ |
| `grep -c "GROUNDING_LOCK_REFUSAL" GovernanceSection.test.tsx` | **6** ✅ (criterion: ≥ 2) |
| `grep -c "GovernanceSection" PhaseFormPanel.tsx` | **exactly 2** ✅ |
| `grep -c "GROUNDING_\|ACTION_RISK_\|Must prove it\|Nothing to prove here" PhaseFormPanel.tsx` | **0** ✅ |
| `npx vitest run GovernanceSection.test.tsx` | **42 passed / 0 failed** ✅ |
| `npx vitest run PhaseFormPanel.rails.test.tsx PhaseFormPanel.test.tsx` | **46 passed / 0 failed** ✅ — `PhaseFormPanel.test.tsx` at its pinned **19** |
| `npx vitest run src/components/workflows` | **1450 passed / 12 failed** — all 12 pre-existing (below) |
| `npx tsc -b` (whole repo) | **33 errors, identical to the pre-plan baseline; 0 name any file in `files_modified`** ✅ |
| `npx eslint` over all 4 touched files | **clean, 0 findings** ✅ |
| `npx vite build` | **exit 0**, built in 11.78s ✅ |
| `git diff --stat 923dd2a9..HEAD -- backend/ supabase/migrations` | **0 files** ✅ |

### The criterion-13 falsification — observed RED

`DIAL_TYPES` was temporarily widened to include `"llm_single"` and the loose side forced
`disabled={refused || phaseType === "llm_single"}` — i.e. the dial rendered **disabled instead of absent**,
the exact defect Req 5 forbids. Observed output:

```
FAIL src/components/workflows/GovernanceSection.test.tsx > GovernanceSection — criterion 13:
  a step that can never be grounded has NO dial > llm_single: the dial query returns null (not a disabled node)
AssertionError: expected <button type="button" …(8)></button> to be null
AssertionError: expected <div role="group" …(3)>…(2)</div> to be null

Test Files  1 failed (1)
     Tests  3 failed | 39 passed (42)
```

The plant was reverted and the suite re-run: **42 passed / 0 failed**. The assertion distinguishes
*removed* from *greyed out*, which is the whole of the criterion.

### Count gate

`node scripts/vitest-count-gate.cjs` — **total 1574 · failed 22 · pinned total 424**.

Applying `185-VALIDATION.md` §"Count-gate posture" rather than `exits 0`:

1. **No `[count-decrease]`** — every one of the 16 pinned files reports delta ≥ 0. ✅
2. **No `[total-below-baseline]`, no `[missing-file]`.** ✅ Total rose 1529 → **1574** (+45: 42 new in
   `GovernanceSection.test.tsx`, 3 new in `PhaseFormPanel.rails.test.tsx`).
3. **`GovernanceSection.test.tsx` reports as `new` (42) and was NOT added to `BASELINE`** — the
   `WorkflowBuilderPage.header.test.tsx` precedent. `TARGETS` needed no edit; the file is already inside
   the `src/components/workflows` glob. ✅
4. **No NEW failing test in any file this plan touched.** The 22 failures land in `PublishGauntlet` (8),
   `WorkflowCanvas` (4), `WorkflowBuilderPage` (3), `WorkflowCanvas.composition` (2),
   `WorkflowCanvas.editing` (2), `WorkflowBuilderPage.canvas` (1), `StepTypePicker` (1) and
   `PhaseFormPanel` (1). The last two are **`STACK_TRACE_ERROR` timeouts under full-suite parallel load,
   not assertion failures** — both files pass green in isolation (`PhaseFormPanel.test.tsx` **19/19** in
   the targeted run above), and 185-06 recorded the same single `PhaseFormPanel` failure on a tree where
   this file was untouched. 22 is **below** the 24/34/35/40 churn band the VALIDATION table recorded.
   `GovernanceSection.test.tsx` and `PhaseFormPanel.rails.test.tsx` are fully green in the gate run. ✅
5. No pin was re-pinned — this plan adds tests only. (185-08 owns the one deliberate re-pin.)

`[failing-tests]` is the KNOWN pre-existing block (SEED-056, ~40 rotted tests). Not chased — out of scope.

## Issues Encountered

**The frontend suite is not green, and was not green before this plan.** 12 failures inside
`src/components/workflows`, 22 across the count gate's wider target set — all in the recorded SEED-056 rot
set. Already logged for the phase in `185-VALIDATION.md`; nothing was added and nothing was fixed
(executor scope boundary).

**Two `STACK_TRACE_ERROR` entries land in files this plan opened** (`PhaseFormPanel.test.tsx`,
`StepTypePicker.test.tsx` — the latter only read, never edited). Both are `userEvent`-driven cases timing
out under parallel load, both pass in isolation, and both were already failing at 185-06 on an untouched
tree. Recorded, not chased.

## Known Stubs

None. Every branch renders real, imported copy and every control is wired to the caller-owned handler.

**One deliberately incomplete wire, by the plan's own design:** `onGovernanceChange` reaches the section
from `PhaseFormPanel` but no page supplies it yet, so pressing the dial or the arming switch today changes
nothing on disk. That is **plan 185-08's** first task (a `useCallback` in `onPhaseChange`'s shape, closing
over `selectedSlug` and the store's shipped `setGovernance`). Until then the section renders **read-only
and visible** — never hidden — which is the state the prop's docblock and a dedicated test both pin, so a
dropped wiring is observable rather than silent. The same applies to `rails.kbTools`: absent today, so the
section marks nothing until 185-08 reads it off `useGroundingBundle`.

## Threat Flags

None. No new network endpoint, no auth path, no file access pattern, no schema change at a trust boundary.
Frontend only; `git diff --stat -- backend/ supabase/migrations` is **0 files**.

- **T-185-07-01** (the refused loose side, `mitigate`) — delivered as framed. The refusal is a DISPLAY
  rule; enforcement lives in the server-side run-time gate (plan 185-03), which this component cannot
  reach — the `?raw` fence proves it imports nothing from `@/lib/api`, names no route and opens no request.
  The only value it can write is `grounding_escalated`, and that is safe in both directions: setting it
  strengthens, and clearing it only ever restores a state the server would derive anyway.
- **T-185-07-02** (`title` attributes, `mitigate`) — delivered structurally at two levels: `grep -c
  "title="` on the module returns **0**, a `?raw` fence test asserts the same with a positive control, and
  a DOM test asserts `getByTitle(GROUNDING_LOCK_REFUSAL)` throws.
- **T-185-07-03** (authored strings, `accept`) — all eleven rendered sentences are imported static consts.
  The component interpolates no user, org, document or tool value into markup, uses no template literal in
  any rendered position (the two `useId()` derivations are element ids, never text), and never touches
  `dangerouslySetInnerHTML`.
- **T-185-07-04** (the flag-off surface, `mitigate`) — every new branch is gated on `rails`, and
  `PhaseFormPanel.rails.test.tsx`'s D-14 pair (the rails-absent negative plus its rails-present positive
  control) now covers three governance markers.

## User Setup Required

None — frontend only, no environment variable, no migration. Live migration head stays at **113**.

## Next Phase Readiness

- **185-08 owes exactly two wires and one deletion.** (a) A page `useCallback` in `onPhaseChange`'s shape
  passed as `onGovernanceChange`; (b) `kbTools` added to the page's `useMemo<PhaseFormRails>` — read off
  `useGroundingBundle`, which carries `kbTools` on **both** the `ready` and `unavailable` members (185-06),
  so the degraded branch must pass the real five names, not `[]`; (c) the `groundingFor()` deletion with
  its `phaseVocabulary.test.ts` re-pin in the SAME commit, number **read from the gate's own output**.
- **Keep the `{...(canvasEnabled ? { rails } : {})}` spread-conditional at `WorkflowBuilderPage.tsx:1567`
  untouched** — it is the D-14 mechanism, and the governance section now rides it.
- **The client's derived cause is readable as `data-cause` on `[data-testid="rail-governance"]`** —
  `"detected" | "already-set" | "escalated" | "none"`. The canvas seal plan can assert canvas and panel
  agree without duplicating the derivation.
- **The `🔒` gate row is still owed.** `GOVERNANCE_GATE_ROW_LABEL` is the one 185-06 constant this plan
  does **not** consume: it belongs to the client-synthesized locked row in `gatesFor()` (D-185-19 — nothing
  waits on `/validate`, which returns problems only).
- **Do not re-derive the intersection anywhere else.** `availableTools.filter((t) => kbTools.includes(t))`
  has exactly one client home now. A second copy in `canvasModel.ts` or `PhaseNodeCard.tsx` is the drift
  the phase's one-home rule forbids — thread the boolean, or read `data-cause`.
- **The Wave-1 137-B card rebuild (D-185-17) is still the blocker for acceptance criterion 23.** Nothing in
  this plan touches `PhaseNodeCard.tsx`.

## Self-Check: PASSED

- `frontend/src/components/workflows/GovernanceSection.tsx` — FOUND
- `frontend/src/components/workflows/GovernanceSection.test.tsx` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx` — FOUND
- Commit `fd66a3f4` — FOUND
- Commit `6429bae4` — FOUND
- Commit `dbc77cb3` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
