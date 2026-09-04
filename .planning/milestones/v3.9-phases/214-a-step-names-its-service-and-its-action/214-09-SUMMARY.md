---
phase: 214-a-step-names-its-service-and-its-action
plan: 09
subsystem: ui
tags: [react, workflows, run-launch, scheduling, declared-inputs, characterization-pins]

requires:
  - phase: 214-03
    provides: the governed vocabularies bound by this phase's copy
  - phase: 214-16
    provides: "`MessageCreate.inputs`, both kickoff merge sites, and `RESERVED_RUN_INPUT_KEYS`"
provides:
  - "`launchInputFields(def)` — `entryInputFields` minus the reserved run-scaffolding keys; ONE home for the rule, shared by both launchers"
  - "the library Run modal renders a real text field per DECLARED entry input, under the two-arm rule"
  - "`RunModalProps.onRun` widened with `inputs: Record<string,string>` — always present, `{}` when none"
  - "`WorkflowsPageProps.onLaunch` widened with an optional `inputs`, and `:1351` forwards it in the SAME commit"
  - "the schedule modal renders the same fields and merges them into `createSchedule`'s `inputs`, ALONGSIDE `kickoff_prompt`"
  - "the six whole-`innerHTML` captures re-baselined BY RULE, with before/after sha256 recorded"
affects: [214-12, 214-15, 214-14]

tech-stack:
  added: []
  patterns:
    - "the 199-10 re-baseline route: specify the delta up front, apply it to the COMMITTED strings by script, refuse to run unless the arithmetic holds"
    - "a client-side mirror of a backend frozenset, with the same-commit divergence rule written where the mirror lives"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx
    - frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx

key-decisions:
  - "The form draws `launchInputFields`, NOT `entryInputFields` — the latter's fallback arm makes every workflow declare `kickoff_prompt`, which is RESERVED and stripped server-side. A field whose value the server discards is BUG-260826-01 in a new costume."
  - "A declared key spelled `kickoff_prompt` would win over the textarea's value; the collision cannot arise from either form because the resolver strips it first, and `_NON_ACTION_RUN_INPUTS` excludes that key from action inputs by NAME anyway."
  - "The field region sits with the FIELDS, not in the modal's ⓘ info group — that group is what the dialog SAYS about the run; this is what it ASKS."
  - "The schedule modal takes an OPTIONAL `definition` prop and fetches nothing; `WorkflowsPage` looks it up out of the feed it already owns, so `WorkflowCard`'s prop surface is untouched."
  - "No required-ness is validated at either launcher: an empty field sends an empty string and the executor's schema is the arbiter."

patterns-established:
  - "Two arms, never three, survives a change of MEDIUM: an authored label becomes the field's `<Label>` in the body face; a bare key becomes the field's label in the mono face; absence renders the KEY."
  - "An accessibility contract before a typographic one — the mono arm's ACCESSIBLE NAME is the raw key, asserted with a negative control against an invented friendly name."

requirements-completed: [STEP-02]

duration: 34min
completed: 2026-08-28
---

# Phase 214 Plan 09: The Launch Moment Asks For What The Workflow Declares — Summary

**A shipped refusal ran out of reasons: the Run modal's *"never fake structured fields"* hint line became real per-key fields on two launchers, and the six whole-`innerHTML` captures were re-baselined by rule rather than re-captured — but the fields never appeared where anyone was looking, because every fixture in the suite declares only a RESERVED key.**

## Performance

- **Duration:** ~34 min
- **Tasks:** 2 / 2
- **Files modified:** 8 (2 beyond the plan's `files_modified` — see Deviations)
- **Commits:** `cb00deffd`, `b7d58b67a`

## Accomplishments

### Task 1 — the hint becomes fields (`cb00deffd`)

- `soulData.ts` gained `RESERVED_LAUNCH_INPUT_KEYS` + `launchInputFields(def)`.
- `RunModal.tsx`: the `run-hint` `<p>` is gone; `launchFields` renders one labelled `<input type="text">` per declared key; `inputValues` state; `handleRun` projects onto the declared keys and hands `onRun` an `inputs` dict.
- `RunModalProps.onRun` and `WorkflowsPageProps.onLaunch` widened, and `WorkflowsPage:1351` forwards the dict — **all in one commit**.
- The Test Run adapter (`WorkflowsPage.tsx:907-923`) was READ and **not edited**; `git diff -U0` shows no hunk in that range.

### Task 2 — the schedule door (`b7d58b67a`)

- `WorkflowScheduleModal` takes an optional `definition`, renders the same fields **above** the cadence controls, and merges their values into `createSchedule`'s `inputs` **alongside** `kickoff_prompt`.
- The cadence contract is untouched: same keys, same explicit-`null` discipline, same order — pinned by deep equality in both arms.

## ⭐ Where the chain stops, stated rather than claimed

| Door | Reaches | Owed to |
|---|---|---|
| **Schedule** | **the run.** `scheduler_service.py:139-162` already spreads a schedule's stored `inputs` into `run_inputs`. **Complete end to end at this commit.** | — |
| **Library Run** | `onLaunch`'s third argument, and no further. | `214-12` (the `doRun` parameter). `214-16` already landed `postMessage`'s option and the server merge. |

⛔ **Nothing in this plan's suites asserts that a value reaches the backend**, and every new test block says so in its own docblock. `onLaunch` is a stub in these files; a case that stubbed it and then announced the backend had received something would be Phase 204's exact shape — each side's suite supplying the other side's half.

⚠ **And the compiler could not have told anyone.** `onLaunch`'s type widened, but under parameter **contravariance** a narrower `doRun` stays assignable: the extra key typechecks and is silently discarded. Every assertion here is on the **argument object at runtime**; a green `tsc` proves nothing about this hop, and that sentence is now in `WorkflowsPage.tsx` beside the type.

## ⚠ The measured surprise — the fields do not appear in any of the six captures

`entryInputFields`'s last arm returns `[{ key: "kickoff_prompt" }]` for a definition that declares nothing, and **every fixture in `RunModal.test.tsx`, `RunModal.a11y.test.tsx` and `WorkflowsPage.test.tsx` declares exactly `inputs: [{ key: "kickoff_prompt" }]`**. `kickoff_prompt` is in `RESERVED_RUN_INPUT_KEYS` (`backend/app/models/message.py:27`, planted by `214-16`), so:

- had the form drawn `entryInputFields`, **every workflow in the library would have grown a text box beside the kickoff textarea collecting the same fact, and the server would have STRIPPED the value on arrival** — a control that lies about what it does, which is `BUG-260826-01` one layer up;
- drawing `launchInputFields` instead, the six captures lose the hint node and gain **nothing**.

So the six captures' delta is a pure removal, and the new fields are exercised by their own fixtures. This is recorded as the finding rather than as a footnote: the acceptance criterion *"a definition with `inputs: []` renders zero text inputs beyond the pre-existing controls"* is satisfied by **every shipped fixture in the repo**, and a plan that had only run those fixtures would have shipped a green suite that never rendered a single field.

## The six whole-`innerHTML` captures — re-baselined BY RULE, not re-captured

**Route taken: 199-10's, not 193-07's.** A re-capture reads the NEW render and writes it down, ratifying whatever the edit did including anything unintended. The delta was specified in advance and applied to the **committed** strings by script.

- **THE RULE:** delete the exact `<p>` node under testid `run-hint` — one node, named up front — and change nothing else.
- **THE REFUSAL:** the script exits non-zero unless the node occurs in **exactly six** captures. It found six, and **zero** in the two `run-destination` captures.
- **`git diff --numstat` on the test file after the script: `6  6`** — six lines changed, six lines changed. Nothing else moved.

The node, verbatim and byte-identical in all six (it renders the unlabelled arm because the fixtures' one key carries no label):

```html
<p data-testid="run-hint" class="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info mt-0.5 h-4 w-4 flex-none" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg><span>This workflow expects: <span class="font-mono text-foreground">kickoff_prompt</span></span></p>
```

### Before → after, per capture

⚠ **The full BEFORE strings are not pasted here and that is deliberate**: they run 4,396–5,593 chars each (~31 KB for six), and a pasted copy is a *transcription* — the thing this repo's own capture rule says stops being evidence. They are recoverable **verbatim and byte-exact** at `git show e08f4367f:frontend/src/pages/__tests__/RunModal.test.tsx`, and the sha256 below pins each one so a recovered string can be proved to be the one that was measured.

| Capture | before len | before sha256 | after len | after sha256 | Δ |
|---|---|---|---|---|---|
| `BOUND_WITH_FOLDERS` | 5318 | `4a910ed9814de8c762a440c99760f0ab78a0aa1d0172819981e19af64b6e1e37` | 4720 | `e6a18d369162106e29bd8f350d24afa38c267aa2c0edcda37cccca25409916f6` | **−598** |
| `UNBOUND_NO_PROJECT` | 5341 | `6c0b10c2e80be84b013d342d1292189e7a5c4608e3b61bb6b8d64eaf71050504` | 4743 | `3346efb382c51cd6b6bf3e3ac55b85d5c861ee7c7a8b749645725ba23a48e118` | **−598** |
| `NO_FOLDERS_SCOPE_HIDDEN` | 4396 | `f16a356225fe2ebb02696f0070b3af43a6d2706b187c9ba5789bd104e34d8c18` | 3798 | `f30169d951670c91ccf5f8e156b9cc9dc545e219b6e422c9a9c0ddb246771cc5` | **−598** |
| `TEMPLATE_STAGED` | 5593 | `30e956d81e472ea0a7fd299e816898fdda9237ee7a23b6f97d767d7c329df5ca` | 4995 | `a1e67050f4798473886e6ac93acc94a4a08f4602a94f2b09e9ba4cac758787c1` | **−598** |
| `LAUNCH_ERROR` | 5449 | `89d2beea0896b16580a621e09cac08ebb78d254677f74236c8545bdbb3405d59` | 4851 | `1a325312d811e17ec9d06b96bc6756285b915e005518f2aad3f5087c9d239dc0` | **−598** |
| `SUBMITTING` | 5363 | `c63856584a0a2be5ac057ce59222372dd3e841bf25796f0ad12d9077332288ed` | 4765 | `ab3dc450b667e32b5e132ee6cecbbf11604277d3aa795a0636d1f0e31ab05860` | **−598** |
| `GATE_OFF` *(destination — UNTOUCHED)* | 81 | `b4cbf1c550f30547dde1a0762124868fef97a0da4b2b15374ad86df54c85df58` | 81 | *(unchanged)* | 0 |
| `GATE_ON` *(destination — UNTOUCHED)* | 139 | `a4f69768591432bd13cd993728e147c00b9c63e7d60d201c22e8753bf39250bd` | 139 | *(unchanged)* | 0 |

**−598 six times, exactly the node's length.** ⚠ **What this does NOT prove:** that the new fields are right. It proves the six states lost the hint node and nothing else.

The arithmetic is not left as prose — a new case (`"214-09's re-baseline states its reason, and its arithmetic is CHECKED, not asserted"`) reads the **committed strings** and asserts the node and its sentence are absent from all six while the destination captures still appear verbatim inside them, with a positive control proving the absence matchers can fire.

### Three other pins moved deliberately, each inverted rather than deleted

1. `RUN_MODAL_HTML_BASELINE.BOUND_WITH_FOLDERS`'s testid list dropped `"run-hint"` and gained an explicit `not.toContain` — a re-introduction reds.
2. The 199-10 **resting-text** pin lost exactly the substring `This workflow expects: kickoff_prompt` (36 chars) and nothing else. The previous value is quoted in the comment, not overwritten.
3. `WorkflowsPage.test.tsx:969` asserted `run-hint` **present**; it is now `queryByTestId(...) === null` plus a zero-fields assertion.

## Deviations from Plan

### 1. [Rule 3 — blocking] The plan's schedule-modal test path does not exist, and its acceptance criterion passes VACUOUSLY

- **Found during:** Task 2 setup (and the baseline run of Task 1).
- **Issue:** `files_modified` and both verify blocks name `frontend/src/components/workflows/WorkflowScheduleModal.test.tsx`. The real path is **`frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx`**.
- ⚠ **Why this matters more than a typo:** `npx vitest run <nonexistent path>` alongside other paths **exits 0**. The criterion *"…exits 0"* would have been reported GREEN having executed **zero** of the cases it names. Measured on the baseline run: four paths passed in, `Test Files 3 passed`.
- **Fix:** used the real path throughout. Verified 3 → 9 cases.

### 2. [Rule 2 — missing critical functionality] `soulData.ts` edited, though it is not in `files_modified`

- **Issue:** the field list had to exclude the reserved keys, and that rule must have **one** home. The backend's own comment on `RESERVED_RUN_INPUT_KEYS` says *"ONE frozenset, imported by BOTH merge sites — this plan's whole complaint is a fact living in two places, so it does not add a third."* Spelling the exclusion inline in two components would have added a fourth and a fifth.
- **Fix:** `RESERVED_LAUNCH_INPUT_KEYS` + `launchInputFields` live in `soulData.ts` beside `entryInputFields`, with an explicit **same-commit divergence rule** in the docblock. Checked first: no sibling plan in this phase names `soulData.ts`.
- ⚠ **A divergence from the backend frozenset is a SILENT DATA LOSS, not a type error.** That sentence is in the source, not only here.

### 3. [Rule 3 — blocking] `WorkflowsPage.test.tsx` edited, though it is not in `files_modified`

Three assertions there were made false by Task 1 (`run-hint` present; two `onLaunch` payload literals). The plan's own `<verification>` runs this suite, so leaving it red was not an option.

### 4. [Rule 1 — the 187-24 trap, twice, on this plan's own criteria]

- `grep -c 'data-testid="run-hint"' RunModal.tsx` must be **0**. The docblock quotes the deleted node, so the first draft read **1** — the fence counting its own prose. **Fixed by naming the testid instead of spelling the attribute**, with the reason written in the comment so the next author does not "restore" it.
- `grep -ciE "…key/value|free-form…" WorkflowScheduleModal.tsx` must be **0**. The refusal comment read **2**. **The refusal is worded around its own fence, and says so.** The fence that actually guards the claim is in the suite: comment-stripped source, a positive control, and a check that the only text input the component grows is keyed by `f.key`.

⚠ **Both criteria were satisfiable only by degrading the prose.** A raw-text grep cannot distinguish a control from a sentence describing its absence; that is the standing lesson and it fired twice in one plan.

## Verification

| Check | Result |
|---|---|
| `RunModal.test.tsx` + `RunModal.a11y.test.tsx` | **green** (78) |
| `WorkflowScheduleModal.test.tsx` (real path) | **green** (9) |
| `WorkflowsPage.test.tsx`, `PublishedCardDelete.test.tsx` | **green** |
| all five together | **`5 passed` / `188 passed`** |
| `soulData.test.ts` + `src/components/workflows/library` (the `launchInputFields` blast radius) | **`14 passed` / `748 passed`** |
| `npx tsc --noEmit -p tsconfig.app.json` | **34** — the merged-tree baseline, held |
| `npx eslint` on all 8 touched files | **0** |

### Per-file counts

| File | before | after | gate pin |
|---|---|---|---|
| `RunModal.test.tsx` | 46 | **54** (+8) | 40 — **not below**, ✓ |
| `RunModal.a11y.test.tsx` | 20 | **24** (+4) | 20 — ✓ |
| `WorkflowsPage.test.tsx` | 59 | **59** (±0 — existing cases edited, none added) | 59 — ✓ |
| `WorkflowScheduleModal.test.tsx` | 3 | **9** (+6) | ⚠ **UNPINNED — see below** |

⚠ **`WorkflowScheduleModal.test.tsx` IS IN NEITHER `BASELINE` NOR `TARGETS`.** `grep -n "WorkflowScheduleModal" scripts/vitest-count-gate.cjs` returns **nothing**. A launch-critical surface's only suite is invisible to the gate: its six new cases raise no total, and a future commit deleting all nine would decrease nothing the gate watches. **`214-15` should adopt it** — that is the whole gap, and adopting a suite raises the total, which is the desirable direction.

### The count gate was NOT run, by instruction

The orchestrator's dispatch forbids running `scripts/vitest-count-gate.cjs` from a worktree (it owns the post-merge run, and `count gate OK` is not reliably reachable on demand). **This plan therefore records no `— N new` figures.** It creates **no new test file**, so it owes `214-15` no `BASELINE` pin for a path that does not yet exist; what it owes `214-15` is the per-file deltas above and the adoption gap.

## G-5 disposition — re-derived from git at this plan's HEAD

| File | ledger cell | plan's re-derivation | **measured now** | Verdict |
|---|---|---|---|---|
| `library/RunModal.tsx` | 4 / 3 / 526 | 6 / 4 / 655 | **7 / 5 / 730** | ⚠ **fires — the plan's own re-derivation is ALREADY stale** |
| `pages/WorkflowsPage.tsx` | 41 / 16 / 1383 (*satisfied 192/192.1*) | (deferred) | **43 / 17 / 1415** | fires; **honoured by construction** (one prop signature + two forwarded keys) |
| `WorkflowScheduleModal.tsx` | **no row** | (deferred) | **3 / 3 / 601** | ⚠ **FIRES EXACTLY AT THRESHOLD, and it has never had a row** |
| `soulData.ts` | 9 / 7 / 373 (*⚠ absent at 7 phases*) | — | **11 / 9 / 465** | ⚠ **fires — cell stale, and this plan touched it** |

- **`RunModal.tsx` — honoured by construction, argued.** The diff replaces one render block with another of comparable size, adds one state hook and one prop key. The modal's job was always *collect what a run needs and hand it to `onRun`*; the declared inputs are the third thing it collects. **The seam a future extraction would take — the field renderer — is identified and deliberately not taken**, because an extraction with one consumer is not an extraction.
  ⭐ **`214-12` is its named re-open trigger** and must either share this renderer or say why not.
- ⚠ **A CARRY-FORWARD FOR `214-12`, MEASURED:** its acceptance criterion `grep -c "entryInputFields" frontend/src/components/workflows/library/RunModal.tsx` **is ≥ 1 today and will read 0 after that plan's extraction** — this plan removed that import. `RunModal.tsx` now names **`launchInputFields`**, and the `fields` prop in `214-12`'s `<interfaces>` should be typed `ReturnType<typeof launchInputFields>` (identical to `entryInputFields`'s — `EntryInputField[]`) or the criterion re-pointed at the new name. ⛔ **Do not "fix" this by importing `entryInputFields` back into the component** — that is the exact resolver whose fallback arm draws a field for a key the server strips.
- **`WorkflowScheduleModal.tsx`** crossed 3 phases **in the commit that this plan wrote**, on a launch-critical path at 601 lines, with no ledger row and no gated suite. `214-15` owes it both.
- **`soulData.ts`**'s cell reads *"⚠ absent at 7 phases (added 197)"* and now measures **9 / 465**. Correct the cell in `214-15` rather than trusting it — *satisfied* and *stale* are the same failure this ledger records repeatedly.

## Threat register — dispositions as implemented

| Threat ID | Disposition | What actually guards it |
|---|---|---|
| `T-214-09-01` (a launcher key overwriting a reserved run input) | **mitigated, and STRONGER than planned** | The plan expected a comment plus a test. What shipped is a **structural** exclusion: `launchInputFields` never renders a field for a reserved key on either surface, so the collision cannot be authored from a launcher at all. The declared-wins ordering is still written down (the schedule modal's merge comment) for the arm that cannot currently arise. Asserted: `run-input-kickoff_prompt` / `schedule-input-kickoff_prompt` are `null` while the key IS declared by the fixture. |
| `T-214-09-02` (a value reaching an undeclared adapter key) | **mitigated, unchanged** | `handleRun` and `onCreate` both **project onto the declared key list**, never hand `inputValues` over raw — so a key that stopped being declared between two renders cannot ride along. This plan adds no path around `resolve_arguments`. |
| `T-214-09-03` (a field rendered but never forwarded) | **mitigated** | The consumer widened in the SAME commit as the producer. Asserted with `hasOwnProperty` on the argument object, not only `toHaveBeenCalledWith` — `{}` and `undefined` are different facts and the presence of the key is checked explicitly. |
| `T-214-09-04` (a scheduled run's stored input value) | **accepted, recorded** | Unchanged by this plan and NOT answered by it. `BUS-018`'s *"whose credential runs a workflow scheduled at 03:00"* is still open. |
| `T-214-09-05` (a free-form dict editor) | **mitigated** | Not built. The fence is comment-stripped source + a positive control + a check that the only grown text input is keyed by `f.key`. ⚠ The plan's raw `grep` form of this criterion is unsound (see Deviation 4). |
| `T-214-09-SC` (package installs) | **mitigated** | Nothing installed. |

## Known Stubs

None. No hardcoded empty value flows to a rendered surface; the empty `inputs` dict is a measured contract, asserted in both arms, not a placeholder.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust boundary. The one new value crossing a boundary — a launcher-typed string — enters an existing dict on an existing route whose reserved-key strip landed in `214-16`.

## Self-Check

- `frontend/src/components/workflows/soulData.ts` — FOUND
- `frontend/src/components/workflows/library/RunModal.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx` — FOUND
- `frontend/src/pages/WorkflowsPage.tsx` — FOUND
- `frontend/src/pages/__tests__/RunModal.test.tsx` — FOUND
- `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` — FOUND
- `frontend/src/pages/WorkflowsPage.test.tsx` — FOUND
- `frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx` — FOUND
- commit `cb00deffd` — FOUND
- commit `b7d58b67a` — FOUND

## Self-Check: PASSED
