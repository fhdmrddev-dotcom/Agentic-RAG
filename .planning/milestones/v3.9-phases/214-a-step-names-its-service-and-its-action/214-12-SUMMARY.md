---
phase: 214-a-step-names-its-service-and-its-action
plan: 12
subsystem: ui
tags: [react, chat, workflows, run-launch, declared-inputs, D-214-04, contravariance, source-fences]

requires:
  - phase: 214-09
    provides: "`launchInputFields`, the library Run modal's declared-input fields, and the widened `WorkflowsPageProps.onLaunch`"
  - phase: 214-16
    provides: "`postMessage`'s `inputs` option, `MessageCreate.inputs`, both kickoff merge sites and `RESERVED_RUN_INPUT_KEYS`"
provides:
  - "`LaunchInputFields` — THE one declared-input field renderer, extracted from `RunModal`; the two-arm label rule travelled with it"
  - "`ChatLaunchForm` — the launch moment chat did not have; resolves BEFORE `createThread`"
  - "`doRun` widened with `inputs`, gated on `def.definition`'s declared list AND `opts?.inputs === undefined` — ONE collection point per launch"
  - "the collected dict reaching `postMessage`'s `inputs` option, asserted at RUNTIME rather than by the build"
  - "18 new cases in the pinned `ChatLayout.launch.test.tsx` + a new 15-case `LaunchInputFields.test.tsx`"
affects: [214-14, 214-15]

tech-stack:
  added: []
  patterns:
    - "a promise-resolving overlay: `doRun` awaits a form mounted outside the view split, so a cancel returns before any resource exists"
    - "an absence assertion paired with a positive control on the SAME fixture, differing only in the argument under test"
    - "a stripped-source fence with assembled needles AND a self-catching positive control"

key-files:
  created:
    - frontend/src/components/workflows/LaunchInputFields.tsx
    - frontend/src/components/workflows/LaunchInputFields.test.tsx
    - frontend/src/components/layout/ChatLaunchForm.tsx
  modified:
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/ChatLayout.launch.test.tsx

key-decisions:
  - "The shared renderer draws `launchInputFields`, NOT `entryInputFields` — plan 214-09's carry-forward, honoured. The plan's own `grep -c entryInputFields >= 1` criterion is satisfied only by PROSE, and re-importing the resolver to satisfy it would have re-opened BUG-260826-01."
  - "The three-prop `<interfaces>` signature was kept EXACTLY — no `testIdPrefix` was added — so `run-inputs` / `run-input-{key}` are the ONE testid vocabulary across all launchers and the six innerHTML captures could not move."
  - "The form is mounted OUTSIDE the `activeView` split. A launch is driven from whichever surface the person stands on and the ask must outlive the branch that started it; the overlay is `fixed inset-0`, so flow position is structural rather than visual."
  - "`undefined` and `{}` are different facts in the gate. An empty dict means 'collected, and the answer was nothing' and must NOT re-open the form."
  - "The `inputs` spread into `postMessage` is CONDITIONAL, matching 214-16's own client-side rule: a workflow declaring nothing posts the byte-identical pre-214 body."

patterns-established:
  - "A positive control must be able to FAIL: this plan's first `messages` control read `useMessages()`, whose capital M made it miss a lowercase needle — the control caught itself, and that is the only reason the four absences beside it are trustworthy."

requirements-completed: [STEP-02]

metrics:
  duration: ~45min
  completed: 2026-08-28
  tasks: 2
  commits: 2
---

# Phase 214 Plan 12: Chat Gets A Launch Moment, And Three Doors Get One Renderer — Summary

**`BUG-260826-01`'s recipient was unreachable from a thread because a thread had no form to ask
for it — chat's launch had no moment at all. It has one now, it resolves before anything is
created, and the door that had already asked is not made to ask twice.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 / 2
- **Files:** 3 created, 3 modified
- **Commits:** `33da2bc53`, `fb40b9521`

## Accomplishments

### Task 1 — the extraction plan `214-09` deferred, taken (`33da2bc53`)

`LaunchInputFields.tsx` is the field block out of `RunModal.tsx`, to the plan's three-prop
signature, returning `null` for an empty `fields` array. The **two-arm rule travelled with the
code** — an authored label renders as prose, a bare key renders the key in the mono face,
**absence renders the key and never a fabricated friendly name** — and `RunModal.tsx` keeps a
one-line pointer at the old site rather than an orphaned paragraph.

⭐ **This is plan `214-09`'s own named re-open trigger, discharged rather than re-deferred.** Its
stated reason for leaving the seam (*"an extraction with one consumer is not an extraction"*)
stopped holding the moment chat became the second live consumer.

### Task 2 — the chat launch moment (`fb40b9521`)

`ChatLaunchForm.tsx` is a sheet over the shared leaf, in the shipped `RunModal` dialog
composition (same scrim, same `w-[min(560px,92%)]` card, same 17px truncating title + dismiss).
It installs nothing. `doRun` gained a third-parameter `inputs` key and the two-term gate; the
dict rides `postMessage`'s `inputs` option that plan `214-16` added.

## ⭐ The double-prompt gate, which is the part that would have SHIPPED as a bug

```ts
let inputs = opts?.inputs
if (opts?.inputs === undefined) {
  const declared = launchInputFields(def.definition as DefShape | undefined)
  if (declared.length > 0) { /* …open the form, await the dict… */ }
}
```

**Three measured doors, not one** (`grep -n onLaunch frontend/src/pages/WorkflowsPage.tsx`):

| Door | Call site | Supplies `inputs`? | Result |
|---|---|---|---|
| Library Run modal | `WorkflowsPage.tsx:1351` | **yes** (collected in `RunModal`, plan `214-09`) | **not asked again** |
| Builder Test Run | `WorkflowsPage.tsx:909` — `onLaunch(def, "")` | no | gets the form for free |
| Chat launch | `ChatLayout.tsx:711` `onLaunch={doRun}` | no | this plan's branch |

The gate lives in `doRun` rather than in each door so a fourth door inherits it. ⚠ **A future
door is the ARGUMENT, not a fourth data point** — the count above is the measured one.

## ⚠ The silent-drop variant, and why the compiler is no help

`WorkflowsPageProps.onLaunch` was widened by `214-09` to carry `inputs`. Under **parameter
contravariance** a `doRun` whose `opts` stayed narrower remains assignable to it: the extra key
typechecks, is discarded, and **every build stays green**. So the fence is a runtime read off the
real call:

```ts
const sent = mockPostMessage.mock.calls[0][2] as { inputs?: Record<string, string> }
expect(Object.prototype.hasOwnProperty.call(sent, "inputs")).toBe(true)
for (const [k, v] of Object.entries(LIBRARY_COLLECTED)) expect(sent.inputs?.[k]).toBe(v)
```

`hasOwnProperty` rather than the value alone, because **absent and empty are different facts on
the wire**.

## ⚠ Every shipped fixture would have made this suite green while rendering nothing

Plan `214-09` measured it and this plan had to act on it: **every fixture in the repo declares
`inputs: [{ key: "kickoff_prompt" }]` and nothing else**, `kickoff_prompt` is in
`RESERVED_LAUNCH_INPUT_KEYS`, so `launchInputFields` returns `[]` and no field renders. A suite
run against the shipped fixtures alone would have passed having exercised **not one line of this
plan**. `DEF_WITH_INPUTS` is therefore authored, with **two keys on purpose** — one labelled, one
bare — so the two-arm rule is exercised through the real component and not only in its own unit
suite.

## The payload key path (for plan `214-14`'s seam audit)

```
ChatLaunchForm.onConfirm(dict)                       // projected onto the DECLARED keys
  → doRun's `inputs`
  → postMessage(threadId, kickoff, { inputs })       // client option, added by 214-16
  → request body key `inputs`                        // CONDITIONAL: omitted when empty
  → MessageCreate.inputs: dict[str, str] | None      // backend/app/models/message.py
  → BOTH kickoff merge literals, reserved keys STRIPPED via RESERVED_RUN_INPUT_KEYS
       · backend/app/api/threads.py:954            → workflow_runs.inputs (persisted jsonb)
       · backend/app/services/workflow_kickoff.py:524 → ctx.inputs (live mirror)
  → _external_action_inputs(accumulated_outputs, ctx)   // phase_types.py:1862
       (filters _NON_ACTION_RUN_INPUTS = {"kickoff_prompt"} at :1899-1903)
  → resolve_arguments' ask arm, by `spec.ask_key or name`
```

⚠ **The client key and the wire key are both spelled `inputs`, and the merge sites' key names are
the DECLARED keys verbatim.** Nothing in this path renames anything, which is what makes the seam
audit a name comparison rather than a mapping exercise.

## The six `RunModal` whole-`innerHTML` captures — byte-identical, and NOT re-baselined

**The strongest available proof, and it is a diff rather than a hash:**

```
git diff --stat 5e1c7ddc4 HEAD -- frontend/src/pages/__tests__/RunModal.test.tsx
    (empty)
```

The capture file is **byte-unchanged across this plan's entire diff**, and all 54 of its cases
pass. An extraction that moved so much as a class attribute would have reddened six of them. This
phase therefore re-baselined those strings **once** (in `214-09`), not twice.

sha256 of each capture's **decoded HTML**, measured at HEAD — and, because the file did not
change, these are equally the before values:

| Capture | decoded len | sha256 (decoded HTML) |
|---|---|---|
| `BOUND_WITH_FOLDERS` | 4516 | `017cd466991ec4d0508e8910e8092764b4f483ad9c28cacb763f8c2a911b8996` |
| `UNBOUND_NO_PROJECT` | 4537 | `d55b1c9c04e3888153ecd3ff6715369b284d3e63b4e712b34416b3da5305b21d` |
| `NO_FOLDERS_SCOPE_HIDDEN` | 3636 | `54bb8413f3e2949f235db5fe98987d3af2ab199e7b6e40bdba735b70ef95b802` |
| `TEMPLATE_STAGED` | 4763 | `e2f089d71529930154946f07c20e224bed34c4ac52c86b27e8b72da4eee0f077` |
| `LAUNCH_ERROR` | 4641 | `22b31d4f8779b21d866aac76fc350c438035562126a6d09bd251949e46c457e3` |
| `SUBMITTING` | 4553 | `c975dd1b3fd4eb346f9a68ea0fad81eee8d720cef21e30bbb1ea51fa99568836` |

### ⚠ These lengths do NOT match plan `214-09`'s table, and NOTHING CHANGED — the two measure different objects

`214-09` recorded `BOUND_WITH_FOLDERS` at **4720**; the decoded HTML is **4516**. The gap is the
JavaScript escaping: the source literal spends two characters on every `\"`. Measuring
`len(source literal) + 2` reproduces `214-09`'s figures on **five of six rows exactly** —
`4720 / 4743 / 4995 / 4851 / 4765` — with `NO_FOLDERS_SCOPE_HIDDEN` reading `3800` here against
its recorded `3798`, a two-character residual I did not chase because the file is provably
byte-unchanged.

**Recorded because a reader comparing the two tables would otherwise see a number move and
conclude a capture moved.** Nothing moved. The lesson is that a length is only comparable
alongside the method that produced it — decoded DOM and escaped source literal are different
objects, and this plan states which one it measured.

## Deviations from Plan

### 1. [Rule 1 — the 187-24 trap] `grep -c "entryInputFields" RunModal.tsx >= 1` is satisfied by PROSE, and honouring it in CODE would have been a defect

- **Found during:** Task 1, acceptance.
- **Measured:** the criterion reads **5** — every hit a comment. The file's *code* names
  `launchInputFields` (6 hits), which is what `214-09` deliberately put there.
- **Why the criterion is unsound:** `214-09`'s carry-forward said so in advance and named the
  consequence. `entryInputFields`' fallback arm returns `[{ key: "kickoff_prompt" }]` for a
  definition declaring nothing; that key is reserved and stripped by both merge sites, so drawing
  a form from it gives every workflow a box whose value the server discards — `BUG-260826-01` in
  a new costume.
- **Resolution:** the plan's `<interfaces>` types `fields` as `ReturnType<typeof entryInputFields>`,
  which is **`EntryInputField[]` — the identical type** `launchInputFields` returns. The component
  is typed `EntryInputField[]` and its docblock states the constraint the type cannot carry.
- ⚠ **The type could never have caught this.** Only the sentence and the callers can.

### 2. [Rule 1 — the 187-24 trap, again] `grep -c "workflows/.*\/run\b" ChatLayout.tsx` reads **2**, and both hits pre-date this plan

- `ChatLayout.tsx:56` and `:272` are **shipped comments that FORBID the route** (*"NEVER a
  bespoke /workflows/{id}/run route (D-103-CONF-1)"*).
- **Proven pre-existing:** `git show 5e1c7ddc4:…/ChatLayout.tsx | grep -cE 'workflows/.*/run\b'`
  → **2**. My diff added neither.
- **Resolution:** the sound fence is in the suite and it passes — the pattern is matched against
  **comment-stripped** code, with a positive control proving the pattern really does match
  `/workflows/abc-123/run`. Satisfying the raw grep would have required deleting shipped prose
  that documents the constraint.
- ⚠ **Third and fourth firings of this trap in one phase** (`214-09` recorded two). A raw-text
  grep cannot distinguish a control from a sentence describing its absence.

### 3. [Rule 1 — a positive control that could not fail] the `messages` needle control was wrong, and it caught itself

The first draft read `` expect(`const m = useMess${"ages"}()`).toContain("messages") `` — capital
**M**, so it **FAILED** against a lowercase needle. Fixed to `props.messages.at(-1)`.
⚠ **Recorded rather than quietly corrected: this is the only reason the four absence assertions
beside it are trustworthy.** A control that cannot fail proves nothing about the absences it
accompanies. (The interim "fix" of building the control string out of the needle itself was
rejected as tautological.)

## Verification

| Check | Result |
|---|---|
| `LaunchInputFields.test.tsx` | **green — 15** |
| `ChatLayout.launch.test.tsx` | **green — 35** |
| `RunModal.test.tsx` + `RunModal.a11y.test.tsx` | **green — 54 + 24**, file byte-unchanged |
| `WorkflowScheduleModal.test.tsx` (real path, verified to exist) + `WorkflowsPage.test.tsx` | **green — 9 + 59** |
| all six together | **`6 passed` / `196 passed`** |
| whole `src/components/layout` dir (ChatLayout blast radius) | **`9 passed` / `107 passed`** |
| `npx tsc --noEmit -p tsconfig.app.json` | **34** — the merged-tree baseline, held |
| `npx eslint` on all 6 touched files | **1 pre-existing error, see below** |

### Per-file counts — none decreased

| File | before | after | Δ |
|---|---|---|---|
| `ChatLayout.launch.test.tsx` | 17 | **35** | **+18** |
| `LaunchInputFields.test.tsx` | — (new) | **15** | **+15 new** |
| `RunModal.test.tsx` | 54 | 54 | ±0 |
| `RunModal.a11y.test.tsx` | 24 | 24 | ±0 |
| `WorkflowScheduleModal.test.tsx` | 9 | 9 | ±0 |
| `WorkflowsPage.test.tsx` | 59 | 59 | ±0 |

**For plan `214-15` to pin:** `frontend/src/components/workflows/LaunchInputFields.test.tsx` is a
**new file with 15 cases**. It lives under `src/components/workflows`, already a `TARGETS`
directory entry, so it raises the gate total without a `BASELINE` edit — but a `BASELINE` pin is
what would make a future deletion visible. `ChatLayout.launch.test.tsx` is already pinned and its
pin should rise from its shipped value to **35**.

### The six shipped launch cases pass with ZERO edits to their bodies

`git diff -U0` hunk headers on `ChatLayout.launch.test.tsx`:

```
@@ -144,0  +145,21 @@   the DEF_WITH_INPUTS fixture
@@ -153    +174   @@   the stub's onLaunch type
@@ -155    +176,5 @@   the stub's onLaunch type
@@ -157,18 +182,59 @@   the stub's drive buttons
@@ -178,0  +245,3  @@   the ChatLaunchForm?raw import
@@ -534,0  +604,271 @@  the appended 214-12 block
```

**No hunk falls between 178 and 534** — the entire shipped case range is untouched. That is the
regression fence in its falsifiable form: a plan that edited those assertions to make them pass
would have removed the fence rather than satisfied it.

### The count gate was NOT run, by instruction

The orchestrator owns the post-merge `scripts/vitest-count-gate.cjs` run and forbids it from a
worktree. **No `— N new` figure is recorded** for that reason; the per-file deltas above are the
deterministic half, as CLAUDE.md's own correction requires.

### Out of scope, provably unmodified

`npx eslint src/components/layout/ChatLayout.tsx` reports **1** error:
`'_loading' is assigned a value but never used` (now line 107, was 101 — it moved only because
this plan added imports above it). **Pre-existing at the base:**
`git show 5e1c7ddc4:…/ChatLayout.tsx | grep -n "_loading"` → `101: loading: _loading,`. Not
touched, not fixed — scope boundary.

## G-5 disposition — re-derived from git at this plan's HEAD

| File | ledger cell | plan's re-derivation | **measured now** | Verdict |
|---|---|---|---|---|
| `layout/ChatLayout.tsx` | 40 / 21 / 815 | *(deferred to execute time)* | **41 / 22 / 911** | ⚠ **FIRES — cell STALE on all three numbers** |
| `workflows/library/RunModal.tsx` | 4 / 3 / 526 | 6 / 4 / 655 | **8 / 5 / 713** | ⚠ **FIRES — the plan's own re-derivation was already stale, as `214-09` predicted** |
| `layout/ChatLaunchForm.tsx` | no row | — | **1 / 1 / 157** | young — owes a row |
| `workflows/LaunchInputFields.tsx` | no row | — | **1 / 1 / 91** | young — owes a row |

- **`ChatLayout.tsx` — honoured by construction, and the argument is that the new surface is a
  SIBLING rather than an addition.** The form is its own component in its own file; this file
  gained one import line, one local state hook, one `await` inside the existing `doRun`, and one
  conditional overlay at the end of the tree. **No new route, no new provider, no new panel
  branch.** Its four measured behaviours — the shipped kickoff pair, the template-upload ordering
  between `createThread` and `postMessage`, the WR-04 orphan cleanup, the canvas flag gate — are
  untouched, and **the six shipped launch cases passing unedited is the falsifiable form of that
  claim.** ⚠ This file was invisible to G-5 for its entire life until Phase 200 added its row;
  its cell is now wrong by a phase, a commit and 96 lines. **Correct it in `214-15`.**
- ⚠ **`ChatLayout.tsx` is the mount point of the CROSS-SURFACE workspace panel**, so a change
  here lands in CHAT first. `ChatLaunchForm` is deliberately mounted OUTSIDE the `activeView`
  split, and the shipped case asserting `WorkspacePanel` mounts only in the chat branch still
  passes unedited — the split was not disturbed.
- **`RunModal.tsx` — the extraction its row deferred is TAKEN HERE**, which is a **discharge**
  rather than a claim of construction. Its line count fell 730 → 713 while gaining an import,
  because the field markup left.
- **The two new files owe detail sections in `docs/HOT-FILE-LEDGER.md` at their third phase**, per
  the same-commit sync rule. `214-15` should add rows now rather than at the threshold — the
  ledger's own repeated finding is that a file absent from the scan list is invisible to its
  guardrail for its entire life.

## Threat register — dispositions as implemented

| Threat ID | Disposition | What actually guards it |
|---|---|---|
| `T-214-12-01` (the agent filling an outbound argument from conversation text) | **mitigated, structurally** | `ChatLaunchForm` is handed a name and a field list and hands back a dict; that is the whole of its access. Fenced against **comment-stripped** source with four assembled needles, a `useThreads`/api-module absence, and positive controls — one of which failed on its first draft and was fixed (Deviation 3). `grep -cE "messages\|assistant\|lastMessage\|generate"` on the file reads **0**. |
| `T-214-12-02` (a second launch path with a different governance story) | **mitigated** | No route added. `createThread` + `postMessage(workflowDefinitionId)` is still the launch, asserted by a stripped-source pattern with a positive control **and** by the six shipped cases passing unedited. The raw-grep form of this criterion is unsound (Deviation 2). |
| `T-214-12-03` (orphaned threads from abandoned launches) | **mitigated** | The form resolves **before** `createThread`. The cancel case pins `createThread`, `postMessage`, `deleteThread` **and** `onNavigate` at zero; a source-order case asserts the gate index precedes the `createThread` index, an ordering no render can observe. |
| `T-214-12-04` (the collected dict overwriting the KB-folder override) | **mitigated** | A dedicated case drives `{ folderId: "folder-9", inputs: {…} }` and asserts the exact options object carries **both**. The two are separate keys on `postMessage`; the server strips `folder_id` out of a launcher's `inputs` map anyway (`214-16`). |
| `T-214-12-05` (a chat launch that silently sends nothing) | **mitigated** | The confirm case asserts the **argument object** handed to `postMessage`, never the DOM — because a form whose values reach nothing fails identically to no form at all. |
| `T-214-12-SC` (package installs) | **mitigated** | Nothing installed. The sheet reuses the shipped `RunModal` composition and one already-imported `lucide-react` glyph. |

## Known Stubs

None. No hardcoded empty value flows to a rendered surface. The empty-string value an untouched
field sends is a **measured contract** — asserted with `hasOwnProperty` so absent and empty stay
distinguishable — not a placeholder, and it is the deliberate consequence of validating no
required-ness at any launcher.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust
boundary. The one new value crossing a boundary is a person-typed string entering an **existing**
dict on an **existing** route, whose reserved-key strip landed in `214-16`.

## Self-Check

- `frontend/src/components/workflows/LaunchInputFields.tsx` — FOUND
- `frontend/src/components/workflows/LaunchInputFields.test.tsx` — FOUND
- `frontend/src/components/layout/ChatLaunchForm.tsx` — FOUND
- `frontend/src/components/workflows/library/RunModal.tsx` — FOUND
- `frontend/src/components/layout/ChatLayout.tsx` — FOUND
- `frontend/src/components/layout/ChatLayout.launch.test.tsx` — FOUND
- commit `33da2bc53` — FOUND
- commit `fb40b9521` — FOUND

## Self-Check: PASSED
