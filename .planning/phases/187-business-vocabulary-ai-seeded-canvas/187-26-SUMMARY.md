---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 26
subsystem: workflow-studio-authoring
tags: [gap-closure, round-5, grounding, describe-door, additive-optional-prop, d-187-14]
gap_closure: true
gap_closure_round: 5
gap_closure_base: 15339441

requires:
  - "WorkflowDoorSwitch.tsx — the shipped two-door shell and its describe→govern handoff (Phase 124)"
  - "WorkflowBuilderPage.tsx — the shipped `projectFolderId` state and `onDraft`'s `project_folder_id` spread (Phase 103-ux)"
  - "lib/api.listFolders() — the org/RLS-scoped folder list"
provides:
  - "DescribeKbPicker — the loose door's knowledge-base picker, its own component file"
  - "WorkflowBuilderPageProps.initialProjectFolderId — one additive-optional prop, zero render-body change"
  - "a loose-door workflow that CAN be born bound, proved on the request the client sends"
affects:
  - "the 'Describe & run' door — one optional control beneath the textarea"
  - "nothing else: no backend file, no migration, no enablement rule, no shared path"

tech-stack:
  added: []
  patterns:
    - "the StarterTemplatePicker shape: one api symbol, no store, no route name, positive-controlled source fence"
    - "the D-187-14 mount-cap discipline: new surface in its own file, the hot page gains a mount and not a feature"
    - "'there are none' vs 'we could not ask' held in DISTINCT state, observable through a hidden/aria-hidden state marker"

key-files:
  created:
    - frontend/src/components/workflows/DescribeKbPicker.tsx
    - frontend/src/components/workflows/DescribeKbPicker.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx

decisions:
  - "D-187-26-01: the picker's copy constants live in and are EXPORTED BY the component, not added to definitionOps — the anti-drift property is kept (the suite imports the identifiers, never re-types the strings) without widening this plan's two-file set"
  - "D-187-26-02: the two zero-row causes are made observable through a `hidden`/`aria-hidden` state marker — a probe, not a surface; 'renders nothing' stays asserted strictly and separately"
  - "D-187-26-03: a folder row with no usable id is DROPPED rather than offered, because an unpickable option is a dead control; a folder with no NAME still renders (labelled by its id) because it is choosable"
  - "D-187-26-04: `goBoth` deliberately does NOT clear the folder choice — pinned, so the behaviour is chosen rather than inherited"

metrics:
  duration_minutes: 38
  tasks_completed: 3
  files_created: 2
  files_modified: 4
  tests_added: 42
  commits: 3
  completed: 2026-08-04
---

# Phase 187 Plan 26: Describe-Door Knowledge-Base Picker (GAP A) Summary

The loose "Describe & run" door can now bind a knowledge base **before** the AI generates, so a
fast-path workflow is no longer born unbound — and the choice is proved to reach
`generateWorkflow`'s `project_folder_id` on the request the client actually sends, not on a prop
being present.

## What shipped

**GAP A was the root cause of the whole round-5 chain.** The describe door renders its own composer
and never mounts `WorkflowBuilderPage`, so it had no knowledge-base control at all; "Draft the
workflow" then hands off with `autoDraft`, which generates immediately on mount, so the Builder's own
picker never gets a frame either. Every fast-path workflow was therefore born unbound,
`unbound_retrieval` fired on any retrieval step, and Publish was disabled out of the gate for a
reason the author was never given a chance to prevent.

D-187-11 reads that state as *"the author has not yet said what this is about"* — a reading that is
only honest if the author was **asked**. This plan builds the somewhere-to-say-it.

| # | Task | Commit |
|---|---|---|
| 1 | `DescribeKbPicker` — a leaf that reads one api symbol and invents nothing | `f5a28e7e` |
| 2 | the door mounts it, and the choice reaches generate | `74aff9f9` |
| 3 | prove the fences bite, and measure every gate | *(measurement only — the three probes were applied to real source, observed RED, and reverted; no source change survives, so the task carries no commit of its own)* |

## The mount cap (D-187-14) — measured, not asserted

`git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx`:

```
6	1	frontend/src/pages/WorkflowBuilderPage.tsx
```

Exactly the budget the plan priced: **6 insertions / 1 deletion**, no renegotiation. The one deletion
is edit 3, the `useState` initializer — named in advance, and not in the render body.

The stronger property D-187-14 literally states, proved with the added-lines-only method
(§(a1) of `187-VALIDATION.md`, using `[ \t]` — `[[:space:]]` does not work inside a bracket
expression on this machine's grep):

```
$ echo "$D" | grep -cE '^\+[ \t]*<[A-Z]'                        # new JSX elements
0
$ echo "$D" | grep -cE '^\+[ \t]*(function|const [A-Za-z]+ = \()' # new declarations
0
```

Zero new JSX elements, zero new props on existing JSX elements, zero new component or helper
functions. The whole of this plan's share of the 1858-line page:

```diff
@@ -519,0 +520,3 @@ export interface WorkflowBuilderPageProps {
+  /** Phase 187-26 (GAP A): the loose door's KB choice, made BEFORE the AI drafts.
+   *  ABSENT ⇒ the describe screen is byte-identical to today (D-181-01). */
+  initialProjectFolderId?: string
@@ -556,0 +560 @@ export function WorkflowBuilderPage({
+  initialProjectFolderId,
@@ -584,0 +589 @@ export function WorkflowBuilderPage({
+  // Phase 187-26 (GAP A): the loose door may now have bound one before generate ran.
@@ -586 +591 @@ export function WorkflowBuilderPage({
-    typeof initial?.definition.project_folder_id === "string" ? initial.definition.project_folder_id : "",
+    typeof initial?.definition.project_folder_id === "string" ? initial.definition.project_folder_id : (initialProjectFolderId ?? ""),
```

The new surface lives in its own file — the shape CLAUDE.md's ledger praises in its
`PhaseFormPanel.tsx` row (Phase 185 "added a mount point, not a feature"). Per the plan's own
precision note: `WorkflowBuilderPage.tsx` is **not** a row in that ledger, and this summary does not
claim it is.

## RED observed before green, both times

**Task 1** — the suite was written and run before the component existed:

```
Error: Failed to resolve import "./DescribeKbPicker?raw" from
"src/components/workflows/DescribeKbPicker.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

Then green: **30 passed (30)**.

**Task 2** — the before-state re-derived at HEAD on the unmodified shell, which is the operator's own
measurement reproduced mechanically (they probed the DOM for `project-folder-picker` at 1.5 s / 3 s /
5 s and found it absent, with zero `/folders` requests on that screen):

```
 × renders a KB picker ON THE DESCRIBE DOOR — the control the operator probed for and did not find
 × offers NOTHING when there are no folders — the door stays exactly as it ships
 × with NOTHING chosen the CTA is enabled by TEXT ALONE, and one click still hands off
 × choosing NOTHING sends NO project_folder_id key at all — absent, not undefined, not ''
 × a folder chosen on the door reaches generateWorkflow's project_folder_id
 × the choice SURVIVES a look around the chooser — a pick is not lost by curiosity
 × SOURCE: the door mounts the picker component and wires the id to the govern mount
TestingLibraryElementError: Unable to find an element by: [data-testid="project-folder-picker"]
 Test Files  1 failed (1)
      Tests  7 failed | 14 passed (21)
```

Then green: all three suites, **70 passed (70)**.

## The three falsification probes

Each was **applied to real source**, driven through real `vitest`, observed RED with raw output, then
reverted — with the revert **proved by sha256**, not assumed. Per the 187-24 lesson, `git checkout --`
was **not** used: a sidecar copy reversed exactly what it applied.

| # | Probe | Observed RED | Revert proved |
|---|---|---|---|
| P-16 | deleted the `<DescribeKbPicker>` mount from the describe door | 7 failed / 14 passed — `Unable to find an element by: [data-testid="project-folder-picker"]` | sha256 `e47b0eaa…d3b08` restored, `git diff --numstat` empty against the committed task-2 state |
| P-17 | severed the wire only — dropped `initialProjectFolderId` from the govern-door mount | **2 failed / 19 passed** — precisely the round-trip case (`expected "vi.fn()" to be called with arguments: [ ObjectContaining{…} ]`) and its source fence | sha256 `e47b0eaa…d3b08` restored |
| P-18 | planted a fabricated fallback row in the failure branch | 2 failed / 28 passed — `expected <select …(3)>…(2)</select> to be null`, plus the no-remembered-list case | sha256 `d9f54844…07114` restored |

P-17 is the informative one: the picker still rendered and 19 cases still passed, so the probe
isolates the **wire** rather than the mount. That is what makes the round-trip fence a statement
about the request reaching the generator, and not a restatement of "the picker is on screen".

## Every gate, measured

| # | Gate | Result |
|---|---|---|
| 1 | the three suites | **0 failed.** `DescribeKbPicker.test.tsx` **30**, `WorkflowDoorSwitch.test.tsx` **21**, `WorkflowBuilderPage.describe.test.tsx` **19** — 70 total |
| 2 | `node scripts/vitest-count-gate.cjs` | **exit 0** — `count gate OK — 18/18 pinned files present, no per-file decrease, 0 failing`. `WorkflowDoorSwitch.test.tsx 13 → 21 (+8)`; `DescribeKbPicker.test.tsx — 30 new`. Total 2149, pinned total 715. **No pin was lowered**; the `PublishGauntlet.test.tsx` parallel flake did not recur |
| 3 | `npx tsc --noEmit -p tsconfig.app.json` | **33 `error TS` lines**, ZERO in this plan's files and ZERO in `src/components/workflows/` |
| 4 | `npx vite build` | **exit 0** — `✓ built in 4.70s` |
| 5 | zero backend files, zero migrations | `git diff --name-only 15339441 HEAD -- backend/ supabase/migrations` → EMPTY; `git status --porcelain supabase/migrations` → EMPTY |
| 6 | zero false completion records | no SDK completion verb called — see "State writes" below |

### A correction to the plan's stated typecheck baseline

The plan's `<done>` says *"reports 33 error lines"*. Re-derived rather than inherited: **33 is the
count of lines matching `error TS`**; the raw output is **61 lines**, because several TS errors emit
indented continuation lines. Both numbers are stable at HEAD and neither moved during this plan. The
plan's figure is correct once the metric is stated precisely, which it now is.

The plan's warning about the bare form was also re-verified and holds:
`npx tsc --noEmit` from `frontend/` reports **0** — vacuous, checking nothing
(`D-ITEM-187-23-02`: the root tsconfig is a solution file with `files: []`).

## Deviations from Plan

### 1. [Rule 3 — blocking] The picker's copy constants live in the component, not in `definitionOps`

- **Found during:** Task 1
- **Issue:** The house pattern `StarterTemplatePicker` follows is that a component *"authors no
  sentence of its own"* — its strings are identifiers imported from `definitionOps`, because a
  sentence living inside a component is one nobody can test for drift. But this plan's declared file
  set is two files, and `definitionOps.ts` is not among them; adding a constant there would silently
  widen the plan's blast radius into a shared copy home that three other surfaces read.
- **Fix:** The three strings are declared **and exported** by `DescribeKbPicker.tsx`, and the suite
  **imports the identifiers** rather than re-typing the sentences. The anti-drift property is
  preserved exactly — a copy change moves the surface and every assertion in one edit — without
  touching a file this plan did not price. If a later plan gives this surface a sibling, the
  constants should move to `definitionOps` then, when there is a second reader to justify it.
- **Files:** `DescribeKbPicker.tsx`, `DescribeKbPicker.test.tsx`
- **Commit:** `f5a28e7e`

### 2. [Rule 1 — bug] A type error in the plan's own suite shape

- **Found during:** Task 1 verification
- **Issue:** Reading `onChange.mock.calls[0][0]` off a helper whose return type is a union
  (`Mock<Procedure> | ((id: string) => void)`) produced `TS2339: Property 'mock' does not exist` — a
  real error in `src/components/workflows/`, which the task's own done-criterion forbids.
- **Fix:** The mock is declared locally in that one case and passed in explicitly, so the `.mock`
  read is a typed observation rather than a cast. No `as any`, no suppression.
- **Commit:** `f5a28e7e`

### 3. [Rule 1 — bug] Pre-existing STATE.md drift, repaired rather than committed as-is

- **Found during:** Task 3, gate 6
- **Issue:** `.planning/STATE.md` was already dirty in the working tree before this plan started —
  an SDK/orchestrator write that **regressed** `last_activity` from *"Phase 187 round-4 gap closure
  complete (plans 22-25); 25/25 plans, count gate 18/18 green"* back to *"Phase 187 execution
  started"*, rewound `last_updated` to an earlier timestamp, and corrupted a line inside a block
  explicitly marked *"(Historical, superseded — the 185 execution detail below was accurate when
  written:)"* by rewriting 185's `Plan: 1 of 25` to `1 of 29`. This is exactly the false-record class
  the guard names. Committing it unmodified would have laundered a regression of a true record into
  a less-true one.
- **Fix:** `last_activity`/`last_updated` rewritten to a statement that is true of this plan; the
  185-historical line restored to `1 of 25`; `total_plans: 101` kept (correct — round 5 added plans
  26-29 to the prior 97). Nothing else in the file was touched.
- **Files:** `.planning/STATE.md`

## State writes — what was and was not done

Per the standing false-completion guard, and recorded so the next reader can audit it:

- **`requirements.mark-complete` was NOT called.** `VOCAB-02` and `VOCAB-03` remain unmarked in
  `REQUIREMENTS.md`; `git status --porcelain .planning/REQUIREMENTS.md` is EMPTY. The orchestrator
  marks REQ-IDs at phase end, once behaviour is genuinely observable.
- **`state.advance-plan` was NOT called.**
- **`roadmap.update-plan-progress` was NOT called.** The two ROADMAP edits were made by hand and are
  each individually true: the wave-13 checkbox for `187-26` is ticked (this plan did complete), and
  the stale phase progress-table row `0/? · Not started` is corrected to `26/29 · In progress`, which
  it demonstrably is — plans 01-25 shipped across rounds 1-4. **No checkbox for `187-27`, `187-28` or
  `187-29` was touched**; all three remain `- [ ]`.
- `completed_plans` incremented 96 → 97, a single honest step for this one plan.

## Known Stubs

None. Every surface this plan adds is wired to live data: the picker reads the shipped
`listFolders()`, and the choice it produces travels the existing handoff into the existing
`POST /workflows/generate` field. No hardcoded empty value flows to a rendered element, and no
placeholder copy ships.

## Threat surface

No new surface beyond the plan's register. `T-187-R5-01` through `-05` are all mitigated as planned:
the component reads exactly one api symbol (fenced at the source with positive controls over every
needle) and names no route; it forwards a chosen id to a field the server already owns, offering only
ids `listFolders()` returned, with no free-text id path; a nameless folder renders its own id rather
than a borrowed or fabricated name; the quiet line is held to a configuration fact by a word-class
fence; and the single best-effort request is cancelled on unmount and never retries.

`T-187-R5-SC` held: **zero package-manager installs**, zero new dependencies.

## Verification against the plan's success criteria

- [x] A workflow generated through the loose door CAN carry a `project_folder_id`, proved by the
      client's own request
- [x] Nothing about the fast path's speed changed — the CTA is enabled by text alone, asserted
      directly (empty box still disables; text alone still enables with nothing chosen; one click
      still hands off)
- [x] Zero folders and a failed fetch each render no picker and no invented row, and are held apart
      in distinct component state
- [x] `git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` = **6 / 1**
- [x] Zero new JSX elements, zero new props on existing JSX elements, zero new declarations in the page
- [x] Three probes (P-16, P-17, P-18) observed RED with raw output and each revert proved by sha256
- [x] `node scripts/vitest-count-gate.cjs` exit 0, no pinned file's count decreased
- [x] `npx tsc --noEmit -p tsconfig.app.json` = 33 `error TS` lines, none in this plan's files;
      `vite build` exit 0
- [x] Zero migrations, zero backend files, zero SDK completion verbs called

## What this does NOT close

`187-26` closes GAP A only. `unbound_retrieval` will still fire — correctly — for an author who
declines the picker, and that is the design: the control is optional by construction, so the verdict
now means what D-187-11 says it means. GAP B (the never-ran fail-open, `187-27`) and GAP C (the
stale doc claim, `187-28`) are untouched by this plan and remain open.

**Owed to the operator, and not satisfiable by any test in this plan:** the round-5 manual row
**M15** ("bind before the AI drafts") is authored in `187-29`, and the operator's seeded-rows caveat
is binding on it — the existing `workflow_definitions` rows are test data of unknown vintage, so M15
must also be performed against a **freshly generated** draft.
