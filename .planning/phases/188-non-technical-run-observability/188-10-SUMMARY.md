---
phase: 188
plan: 10
subsystem: deliverable-region-and-reciprocal-seam
tags: [wave-9, RUNVIZ-03, req-7, zero-net-new-backend, bidirectional-seam, download-not-preview, id-trap, two-knob-trap]
requires:
  - "188-08 — `WorkflowRunPage` and the deliverable frame its Known Stubs section assigned here; `run.thread_id` is on the payload precisely so no new endpoint is owed"
  - "188-09 — the run surface is mounted and reachable, and `onOpenThread` (the run → thread half of D-188-13) is wired and tested; this plan owes the counterpart"
provides:
  - "frontend/src/pages/WorkflowRunPage.tsx — the deliverable region: a `role=\"list\"` of one-click downloads sourced from the RUN's thread, both empty states, and no preview"
  - "frontend/src/components/panel/WorkspacePanel.tsx — `RunSeam`, the thread → run receipt, additive and harness-gated, with an OPTIONAL `onOpenRun` prop"
  - "frontend/src/components/layout/ChatLayout.tsx — `openRunSurface`, the memoised callback that threads the receipt into the same state `doRun` sets"
  - "frontend/src/pages/WorkflowRunPage.test.tsx — 45 → 60 tests"
  - "frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx — 31 → 39 tests, and ADOPTED into the count gate"
  - "scripts/vitest-count-gate.cjs — the `src/components/panel/__tests__/WorkspacePanel.test.tsx` TARGETS entry (the two-knob trap, SIXTH occurrence — an adoption this time, not a new file)"
affects:
  - "188-11 — pins `WorkflowRunPage.test.tsx` at **60** (was 45) and `WorkspacePanel.test.tsx` at **39** from the gate's printed `actual` column"
  - "the phase as a whole — SPEC Req 7 is now true of the PRODUCT and not only of the endpoint: a launched run stays reachable after navigating away"
tech-stack:
  added: []
  patterns:
    - "A 1:1 row relationship is a free endpoint: `run.thread_id` + an already-shipped thread-scoped read gives the run's files with ZERO backend diff — check for the join before specifying a new route"
    - "MIRROR a component's pure helpers, IMPORT nothing, when the component resolves its own scope from a global selector: reuse would make opening a run WRITE chat state"
    - "Two ids of the same shape are only distinguishable in a test if the FIXTURES disagree — and the honest source must be fenced in the source, not only asserted at the call"
    - "An effect that depends on a callback should key on its PRESENCE, not its identity: an inline arrow from the caller re-fires the effect on every render it causes"
    - "A source fence over a file whose docblocks EXPLAIN the rule must read stripped-comment code, and the stripper must be tested — measured again here, on `PhaseCard`"
    - "Do not claim an empty state while its read is in flight: `isLoading && empty` is not `empty`, and the wrong word has a short but load-bearing lifetime"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-188-10-A: the receipt's run id is resolved from `ThreadWorkflowState.active_workflow_run_id` and NEVER from `useWorkflowLockForThread(...).runId`, despite that field's docblock calling itself the anchor. MEASURED: the lock is written in three places and two of them write a PRODUCER `runs.run_id` — kickoff (`StreamsProvider.tsx:1967`, `runId: run_id` from the message POST) and the Continue re-subscribe (`:3019`, `runId: producerRunId`). Only the mount reconcile (`:1824`) writes the real anchor, and it is gated `wf.locked && !wf.lock_is_stale`, so the lock is CLEARED exactly when a run goes terminal — the case this line exists for. Both ids are bare uuids, so a swap typechecks and then resolves nothing."
  - "D-188-10-B: `RunSeam` is its own component with its own `getThreadWorkflow` read rather than a frame lifted out of `RunSoul`. Lifting would restructure a shipped Phase-124 component and put its 31 green tests at risk for one field; a second call of the SAME function is the plan's sanctioned shape (\"the same `getThreadWorkflow(threadId)` call the timeline uses rather than introducing a second source\"). Cost: one extra GET per panel mount on harness threads only."
  - "D-188-10-C: the effect keys on `enabled = onOpenRun != null`, not on `onOpenRun`. A caller passing an inline arrow gives a new identity every render; with the callback in the dep array the anchor read would re-fire on every render it caused, and its own `setRunId` causes one. `ChatLayout` ALSO memoises with `useCallback` — belt and braces, because only one of the two is under this file's control."
  - "D-188-10-D: a listing row with no `id` renders as a fact, not as a control. `WorkspaceFile.id` is optional in the type; a button for such a row would build `/threads/{tid}/workspace/files//raw` and 404. A dead control is worse than an honest line."
  - "D-188-10-E: the empty copy is withheld while the first files read is in flight. The plan specified two empty states; it did not specify the third moment, and the default there is to assert `This run produced no files.` about a run whose files have not been asked for yet."
  - "D-188-10-F: `WorkspacePanel.test.tsx` was EXTENDED and adopted into the gate rather than a fresh seam suite authored. The plan made this conditional on a measurement, and the measurement was taken FIRST: `1 passed (1) / 31 passed (31)`, zero pre-existing failures."
metrics:
  duration: ~70 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
  migrations: 0
  packages_installed: 0
---

# Phase 188 Plan 10: What the Run Made, and the Way Back to It — Summary

The run surface now lists the file its run produced and hands it over in one click — with
**zero net-new backend wire** — and the thread that anchors a run now carries one line back
to it. That second half is the load-bearing one: with `GET /runs` deferred and no router,
it is the ONLY route to a finished run.

## THE MEASUREMENTS

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json | grep -cE "error TS"
33                          # baseline AND after every task — not 0; a bare `npx tsc --noEmit`
                            # checks ZERO files, which is the trap this number exists to avoid

$ node scripts/vitest-count-gate.cjs
total 2421  ·  failed 0  ·  pinned total 1037
count gate OK — 26/26 pinned files present, no per-file decrease, 0 failing.
  WorkflowRunPage.test.tsx      —      60     new     # was 45
  WorkspacePanel.test.tsx       —      39     new     # newly EXECUTED by the gate; was 31

$ git diff --numstat 42d517b9 HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx
13	2	frontend/src/components/workflows/WorkflowCanvas.tsx

$ git status --porcelain backend/app frontend/src/components/panel/PhaseTimeline.tsx \
      frontend/src/components/panel/PhaseCard.tsx
(empty)

$ git diff --name-only HEAD~3 HEAD -- supabase/migrations/
(empty)
```

Gate total moved **2367 → 2421** (+54: +15 in the run-page suite, +39 from a suite the gate
had never executed). `WorkflowCanvas.tsx` was **not touched by this plan at all** — the
whole-phase diff is still **13 / 2** against the ≤15 / ≤4 cap, so the two remaining
insertions of headroom are still unspent.

**Zero backend files changed, and none needed to be.** A run is 1:1 with a thread,
`run.thread_id` is already on the `GET /workflow-runs/{id}` payload, and
`GET /threads/{tid}/workspace/files` carries **no run-state condition** — a terminal run's
thread lists its files exactly as a live one does. The SPEC excluded a new file endpoint;
none was owed and none was written.

## What Was Built

### Task 1 — the deliverable region (`783daab5`)

A `role="list"` of file rows inside the region 188-08 left framed. Each row is a `<button>`
whose accessible name is `Download {filename} ({size})`, calling the shipped bearer-authed
raw-bytes helper with **the run's thread id**. The per-extension office icon map and the
byte formatter are **mirrored**, not imported.

**Why mirrored and not reused.** The panel's own file list resolves its thread from the
globally-viewed-thread selector rather than from a prop. Mounting it here would mean
*writing chat's viewed thread as a side effect of opening a run* — a shared-path write from
a read-only surface. Only two pure helpers were copied; both are ~5 lines and neither reads
state. The absence of both the component and the selector is fenced in-suite with assembled
needles and positive controls.

**No preview, and no promise of one.** Every row is a download. DOCX / PPTX / XLSX / PDF are
download-only by decision and `render_template` emits `.docx`, so the flagship deliverable is
precisely the artefact a reviewer cannot read in place — Req 7 asks that it be *listed and
downloadable*, which is exactly what ships. Text / markdown / csv lose their in-place read on
this surface too; that is recorded in the code as deliberate, with `Open the chat thread`
named as the route to the panel that still renders them.

**Mobile drops the cap, not the region:** `md:max-h-[220px]` rather than a flat `max-h`, so
below 768px the list flows instead of hiding the rows the surface exists to hand over.

### Task 2 — the reciprocal seam (`befd3e96`)

An OPTIONAL `onOpenRun?: (runId: string) => void` on `WorkspacePanelProps`, threaded from
`ChatLayout` as a memoised `openRunSurface` that sets the same state `doRun` sets and opens
the same home. `RunSeam` renders one line — **`Open the run`** — inside the existing
`showTimeline` gate, as an additive sibling above the timeline section.

**With the callback absent it renders nothing**, which is why every existing caller and all
31 shipped panel tests stayed byte-unchanged through this task (verified: 21 files / 238
tests green with no pre-existing panel test edited).

`PhaseTimeline` and `PhaseCard` are untouched — `git status --porcelain` on both is empty —
and the panel's own G-5 docblock red line is now mechanically fenced rather than trusted.

### Task 3 — both directions fenced + the gate adoption (`bcac3a96`)

15 new cases on the run side, 8 on the thread side. The two thread-id fixtures are
**deliberately different values** (`thread-of-the-run` vs `thread-being-viewed`) with the
reason stated at the fixture, and the viewed-thread selector is exported from the mock as a
**decoy** — so if the page ever reached for it, it would resolve to the wrong answer visibly
rather than quietly. Same shape on the panel side: the lock fixture holds
`producer-run-DO-NOT-USE` while the anchor holds `workflow-run-anchor-1`.

## THE FALSIFICATIONS — five planted defects, all observed RED, all reverted

Verbatim (ANSI stripped, failing test names from `--reporter=verbose`):

**A. The list and the download re-keyed to the VIEWED thread** — the exact defect the
mirror-don't-import rule exists to prevent:

```
 × downloads with the RUN's thread id, the file id and the bare filename
 × sources the deliverable list from the RUN's thread, at exactly one call site
 × neither mounts the panel's file list nor names it — it reads the viewed thread
AssertionError: expected "vi.fn()" to be called with arguments: [ 'thread-of-the-run', …(2) ]
Tests  3 failed | 57 passed (60)
```

**B. Both empty states collapsed to the terminal one, and the in-flight guard removed:**

```
 × a LIVE run with no files says nothing has been written YET
 × claims NEITHER while the first read is still in flight
AssertionError: expected 'What this run producedThis run produc…' to contain 'No files yet — …'
Tests  2 failed | 58 passed (60)
```

**C. A preview pane added to the region:**

```
 × offers NO preview for the .docx row — no pane, no frame, only the download
AssertionError: expected <iframe title="preview" …(1)></iframe> to be null
Tests  1 failed | 59 passed (60)
```

**D. The harness gate removed from the receipt** (it would then render on Deep threads):

```
 × renders NOTHING on a Deep / no-run thread, even with the callback supplied
Tests  1 failed | 38 passed (39)
```

**E. The receipt resolving the WRONG id field** — the D-188-10-A defect:

```
 × opens the run with the THREAD ANCHOR id, never the lock's producer id
 × renders NOTHING when the thread has no anchor to open
 × does not read PhaseTimeline or PhaseCard internals for the receipt (the G-5 red line)
AssertionError: expected "vi.fn()" to be called with arguments: [ 'workflow-run-anchor-1' ]
Tests  3 failed | 36 passed (39)
```

Note E's second failure: with the wrong field the id is *always* truthy, so the null-anchor
degradation dies with it — the blast radius of the swap, not a bonus.

Every source file was restored from a pre-plant copy and each suite re-run green before
committing. **No `git stash` and no `git clean` were used** — the `tsc` baseline was taken
before any edit and plants were reverted with an explicit file copy.

## The two findings the plan asked to be recorded, with the measurement each

### 1. The `run_completed` refetch is keyed on the RUN's thread, not the viewed thread

**Read at `frontend/src/providers/StreamsProvider.tsx:1053-1063`** (the Phase-101.1-09 gap-4
fix). It sits inside the per-thread SSE **consumer factory** and closes over that factory's
`threadId` — the OWNING thread — and writes through
`replaceWorkspaceFilesForThread(threadId, files)`. Its own comment says so: *"Scoped to the
OWNING threadId (PANEL-09 closure)."*

So the conditional half of the plan's instruction **did not fire**: no terminal-transition
`reconcile()` was needed, and none was added. A run watched to completion from this surface
self-heals its own list. The list is additionally covered on first paint by the shipped hook,
which fetches on every thread-id change and therefore fills the moment the run read resolves.

*(One thing added anyway, as Rule 2 — see Deviations 2: the page's existing wake listener now
reconciles the file list as well as the phase slice.)*

### 2. `WorkspacePanel.test.tsx` was measured GREEN first, and therefore extended

```
$ npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx
Test Files  1 passed (1)
     Tests  31 passed (31)
```

Zero pre-existing failures, so the plan's first branch applied: the seam guard went **into**
the shipped suite and that file was added to `TARGETS`. Had it been red, the guard would have
gone into a fresh `WorkspacePanelRunSeam.test.tsx` and that file would be the entry instead —
the gate requires 0 failing forever, and adopting rot would make this phase its owner.

This is also the **sixth** occurrence of the two-knob trap, and the first that is an
ADOPTION rather than a new file. The gate's own comment had reserved this case in writing:
*"a later phase that wants … WorkspacePanel{,.derived} inside the gate should adopt them
deliberately, with its own measured number."* `WorkspacePanel.derived.test.tsx` is
deliberately **not** adopted — this plan does not read it.

## Verification

| Criterion | Result |
|---|---|
| The deliverable is listed and downloadable from the run | ✅ asserted + falsified (A) |
| …with ZERO net-new backend work and no new file endpoint | ✅ `git status --porcelain backend/app` empty; `run.thread_id` + the shipped read |
| `grep -c 'useWorkspaceFiles(' WorkflowRunPage.tsx` = 1, with the run's thread | ✅ **1**, `useWorkspaceFiles(run?.thread_id …)`; fenced on stripped code (§ Deviations 1) |
| `grep -c 'FilesSection'` = 0 · `grep -c 'FilePreview'` = 0 | ✅ **0** · **0**, both fenced in-suite with positive controls |
| `grep -c 'What this run produced'` = 1 | ✅ **1** |
| Both empty-state strings verbatim, each once | ✅ asserted on stripped code; falsified (B) |
| `grep -c 'dangerouslySetInnerHTML'` = 0 | ✅ **0** (Plan 08's fence still holds) |
| No preview promised for .docx/.pdf/.pptx/.xlsx | ✅ no iframe/embed/object/preview testid; exactly ONE control in the region; falsified (C) |
| `grep -c 'Open the run' WorkspacePanel.tsx` = 1 | ✅ **1** (one constant, one consumer) |
| `grep -c 'onOpenRun' WorkspacePanel.tsx` ≥ 2 · ChatLayout = 1 | ✅ **8** · **1** |
| `git status --porcelain PhaseTimeline.tsx PhaseCard.tsx` empty | ✅ empty; and `PhaseCard` is absent from the panel's stripped CODE |
| The receipt renders inside the existing `showTimeline` gate | ✅ read in the JSX and falsified (D) |
| Deep / no-run threads see nothing new | ✅ asserted with a positive control on the gate |
| Every existing caller byte-unchanged with the callback absent | ✅ asserted directly; 21 files / 238 tests green after Task 2 with no panel test edited |
| `npx vitest run src/pages/WorkflowRunPage.test.tsx` ≥ 4 more than 45 | ✅ **60 passed (60)** (+15) |
| A thread-side seam guard exists inside `TARGETS` | ✅ `WorkspacePanel.test.tsx — 39 new` in the gate's printed table |
| `node scripts/vitest-count-gate.cjs` exit 0, failed 0, total up | ✅ exit **0** · total **2421** (was 2367) · failed **0** · 26/26 |
| `npx tsc --noEmit -p tsconfig.app.json` = 33 | ✅ **33** at baseline and at every commit |
| `WorkflowCanvas.tsx` whole-phase ≤ 15 ins / ≤ 4 del | ✅ **13 / 2** — untouched by this plan |
| Zero migrations · no file deleted | ✅ both empty over `HEAD~3..HEAD` |
| No `git add -A`; `.planning/STATE.md` and `.claude/**` untouched | ✅ every commit staged by explicit path; the 6 files above are the entire diff |
| No `git stash`, no `git clean` | ✅ baseline taken before editing; plants reverted by explicit file copy |
| Zero packages installed | ✅ `package.json` and both lockfiles untouched |

## Deviations from Plan

### 1. [Measured correction] `grep -c 'useWorkspaceFiles'` cannot return 1 for a hook that is used

The criterion as written is unsatisfiable: an imported-and-called hook occupies at least two
LINES (the import and the call), and `grep -c` counts lines. The file measures **2**.

The load-bearing figure is the **call-site** count, and it is exactly **1** —
`grep -c 'useWorkspaceFiles('` returns 1, because an import statement carries no paren. That
is the form the suite fences, on stripped-comment code, together with the assertion that the
one call takes `run?.thread_id`. Same treatment for `downloadWorkspaceFile(`. This is the
same class of correction 188-09 recorded for its `onNavigate("chat")` count.

### 2. [Rule 2 — missing critical functionality] Four gaps the plan did not enumerate

- **A download that fails now says so where the user clicked.** The plan specified the call,
  not its rejection. `downloadWorkspaceFile` throws a typed error for 401 / 404 / network;
  unhandled it is a console-only failure under a row that appears to do nothing. Resolved
  with a local inline error line, and fenced by its own test.
- **A row with no `id` renders as a fact, not a control** (D-188-10-D). `WorkspaceFile.id` is
  optional in the type; a button would build a raw-bytes URL with an empty id segment.
- **Neither empty state is claimed while the first read is in flight** (D-188-10-E).
- **The wake listener now reconciles the file list too.** The page already attached
  `visibilitychange` / `online` for the phase slice; a lid closed while the last step is
  writing is *precisely* when the deliverable row appears unobserved, which is
  T-188-10-03's staleness by another route. One extra call in an effect that already exists.

### 3. [Rule 3 — a shipped suite would have gone red mid-plan] The run-page mocks were widened in Task 1

Adding `useWorkspaceFiles` to the page makes the module mock in `WorkflowRunPage.test.tsx`
incomplete, so all 45 shipped cases would have failed on Task 1's commit. Rather than ship a
red commit or merge two tasks, Task 1 widened the mock factory (and `beforeEach`) by the
minimum — no assertions added, no case renamed — and Task 3 layered the real fences on top.
Both commits are green.

### 4. [Rule 1 — vacuous fence] Two comments broke the greps they described

The **eighth and ninth** occurrences of the trap 187-24 named, recorded here as the rule it
has become rather than as two more incidents:

> A comment that spells a token an acceptance grep counts converts a measurement of the CODE
> into a measurement of the PROSE. Describe by ROLE; never quote the literal.

| Where | The prose | The break |
|---|---|---|
| `WorkflowRunPage.tsx:96` (pre-existing, Plan 08) | `fmtElapsed`'s docblock cited the panel file list by name | `grep -c 'FilesSection'` returned **1**, not 0 — this plan's own criterion, broken by a comment written two plans earlier |
| `WorkspacePanel.test.tsx` (new) | the G-5 fence asserted `PhaseCard` absent from the RAW panel source | went RED immediately: the panel's Phase-124 docblock *states the red line* and therefore spells both names |

The first is fixed by describing the component by role with a ⚠ note saying why the name is
left unspelled. The second is fixed the way this phase has fixed it five times now — the
fence reads **stripped-comment code**, with the stripper tested first, and the raw source is
asserted to still contain the token so the stripping is proven necessary rather than assumed.

### 5. [Measured correction] A typed spy, because the assertion that matters needs an index

`vi.fn()` wired through `(...a as [])` types its `mock.calls` entries as an empty tuple, and
`mock.calls[0][0]` — the thread-id assertion that is the entire point of the download test —
is then a compile error (it moved `tsc` to **34**). The spy is declared with its real
three-argument signature instead. Caught by the baseline number, which is why it is a control.

## Deferred Issues

**`src/pages/WorkflowBuilderPage.session.test.tsx` fails one case under parallel load only.**
Observed once in `npx vitest run src/pages/ src/components/panel/__tests__/ src/components/layout/`
(`pane click — the pending value is in the definition and the DISMISSAL ITSELF issues no
PATCH (WR-11)`, `expected 1 to be +0`, 1798 ms). Run in isolation the same file is
**23 passed (23)**, and the count gate reports `failed 0`.

Not attributable to this plan: that suite imports none of the six files changed here, and the
failing assertion is a PATCH-call count in the workflow Builder. It is a Phase-187-era suite
outside both gate knobs. Logged rather than fixed — out of scope, and 3 fix attempts on an
unrelated timing flake is exactly what the fix-attempt limit exists to prevent.
*Re-open trigger:* the case failing in isolation, or a second observation of it in CI.

## Known Stubs

**None.** This plan CLOSED the one stub the phase carried: 188-08's deliverable region
(`data-testid="run-deliverables"`) now fetches, lists and downloads. Every line added here is
live and exercised by a real render.

## Threat Flags

None. All five register entries were handled as specified:

- **T-188-10-01** (information disclosure — a thread-scoped read with a run-derived thread id)
  — **mitigated as designed.** No new endpoint and no widened scope: the thread id comes from
  the already-ownership-gated `GET /workflow-runs/{id}`, and
  `GET /threads/{tid}/workspace/files` applies `_verify_thread_ownership` (404 on a miss) with
  RLS on top. Two independent ownership checks, both pre-existing.
- **T-188-10-02** (tampering / XSS — filenames and paths) — **mitigated.** Filenames render as
  plain React text children and as `title=` values; the download helper receives the file id
  and filename as arguments, never as interpolated markup. `dangerouslySetInnerHTML` remains
  at **0** and is fenced with a positive control.
- **T-188-10-03** (spoofing of completeness — a stale list on a just-finished run) —
  **mitigated, and the mechanism MEASURED rather than assumed.** The list is keyed on the
  run's thread; the shipped terminal refetch is keyed on the OWNING thread (finding 1 above);
  the wake listener now reconciles the list as well. Asserted with differing thread fixtures;
  falsification A reds three tests on the plant.
- **T-188-10-04** (information disclosure — the receipt on a Deep thread) — **mitigated.** The
  receipt is inside the existing `showTimeline` gate; a Deep / no-run thread renders nothing
  new. Asserted directly with a positive control on the gate; falsification D reds it.
- **T-188-SC** (supply chain) — **accepted.** Zero packages installed; the lucide icons used
  (`Download`, and the file-kind set) are already in tree and already imported elsewhere in
  `frontend/src`. `package.json` and both lockfiles untouched.

No security-relevant surface outside the register was introduced: no endpoint, no auth path,
no new file-access route, no schema change.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `783daab5` | `pages/WorkflowRunPage.tsx`, `pages/WorkflowRunPage.test.tsx` | +227 / −17 |
| 2 | `befd3e96` | `panel/WorkspacePanel.tsx`, `layout/ChatLayout.tsx` | +112 / −0 |
| 3 | `bcac3a96` | `pages/WorkflowRunPage.test.tsx`, `panel/__tests__/WorkspacePanel.test.tsx`, `scripts/vitest-count-gate.cjs` | +392 / −4 |

## Notes for the Next Plans

- **188-11 (the pins).** Pin `WorkflowRunPage.test.tsx` at **60** (it was 45; 188-08's note
  is now stale) and `WorkspacePanel.test.tsx` at **39**, both from the gate's own printed
  `actual` column across two agreeing runs — never hand-counted from `it(` literals. All the
  stale-low pins 188-02/04/05/06/07/08 flagged remain owed, plus
  `ChatLayout.launch.test.tsx` at 12.
- **The seam is now BIDIRECTIONAL and the phase's Req 7 is true of the product.** A launched
  run stays reachable after navigating away: the thread's receipt is the route, and chat
  history is the index because `doRun` mints one thread per run. If a later phase ships
  `GET /runs` and the cross-workflow runs home, this line becomes a convenience rather than
  the only door — but it should not be deleted, because it is the only *contextual* route
  (from the run's own conversation).
- **`WorkspacePanel.derived.test.tsx` is still outside the gate**, deliberately. A phase that
  reads it should adopt it with its own measured number, as this one did for its sibling.
- **The two remaining `WorkflowCanvas.tsx` insertions are still unspent**, and the
  `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction 185-10 named **remains owed** at the next
  FEATURE touch of that file. This plan did not touch it.
- **The run band does not re-read after mount.** A run watched from `active` to `completed`
  on this surface keeps its original band and elapsed string until the page is re-entered,
  because `getWorkflowRun` is read once. The deliverable list is not affected (it self-heals
  via the SSE refetch), but the *live vs terminal* empty-state choice is derived from that
  stale status. Out of scope here — 188-08 owns the read — and recorded so a later plan can
  decide whether the band should follow the stream's terminal event.

## Self-Check: PASSED

Files verified present on disk:

- `FOUND: frontend/src/pages/WorkflowRunPage.tsx`
- `FOUND: frontend/src/pages/WorkflowRunPage.test.tsx`
- `FOUND: frontend/src/components/panel/WorkspacePanel.tsx`
- `FOUND: frontend/src/components/layout/ChatLayout.tsx`
- `FOUND: frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx`
- `FOUND: scripts/vitest-count-gate.cjs`
- `FOUND: .planning/phases/188-non-technical-run-observability/188-10-SUMMARY.md`

Commits verified in `git log`:

- `FOUND: 783daab5` — feat(188-10): the deliverable region — listed and downloadable, never previewed
- `FOUND: befd3e96` — feat(188-10): the reciprocal seam — a thread offers one line back to its run
- `FOUND: bcac3a96` — test(188-10): fence both directions of the seam and the whole deliverable contract

`git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
