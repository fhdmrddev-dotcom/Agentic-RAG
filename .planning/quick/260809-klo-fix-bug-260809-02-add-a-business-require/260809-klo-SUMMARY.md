---
quick_id: 260809-klo
type: execute
mode: quick
title: "BUG-260809-02 — a business_requirement control on the canvas Builder"
status: complete_pending_uat
closes_bug: BUG-260809-02
bug_closed: false
requirements: [BUG-260809-02]
tasks_completed: 2
tasks_total: 2
commits:
  - da668c96
  - 1c58a3fb
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
decisions:
  - "D-klo-01 — the control is gated on `canvasEnabled`, mandatorily: the flag-off header is pinned byte-for-byte (D-181-01) and the canvas door does not exist with the flag off, so a gated control covers 100% of the reported surface."
  - "D-klo-02 — the behaviour is guarded on the recorded `updateWorkflowDraft` ARGUMENT, never on a DOM value: a controlled input echoing its own prop proves nothing about the PATCH payload."
  - "D-klo-03 — no client-side validation rule was added; whitespace is written THROUGH and the server keeps sole ownership of the emptiness verdict (D-182-06)."
metrics:
  duration_minutes: 62
  files_changed: 4
  insertions: 410
  deletions: 0
  tests_added: 11
---

# Quick 260809-klo: a `business_requirement` control on the canvas Builder — Summary

A one-line requirement control in the Builder header, gated on `canvasEnabled`, backed by a
`setBusinessRequirement` store action that rides the shipped PATCH path with **zero change
to the write loop** — closing the one authoring door of three that could not populate a
publish-required field.

## The bug, and why the fix is smaller than the report assumed

A workflow authored on the **canvas** could never be published: the publish gauntlet's
stage 1 refuses without `business_requirement`, and the field was reachable from the NL
door (the model emits it as part of the generated definition) and the template door (the
seeded starter row carries it) and **from nowhere else**. The live-cloud census in the bug
report is the evidence — of eight drafts, the only one with a `null` requirement was the
one built by hand.

Three of the four things a fix would normally need were **already shipped**, which is why
this is 410 insertions and not a phase:

1. The store already round-trips `meta`, and `selectDefinition` is literally
   `{ ...state.meta, phases: state.phases }` — the exact call `useDraftPersistence` makes
   to build the PATCH body. So a write into `meta` rides the shipped save path untouched.
2. The author-time warning already travels server → tray → `blockedReason` end to end.
   **Nothing needed building there, and nothing was** — a second warning would be a second
   truth-teller.
3. `business_requirement` was already declared on `BuilderDefinition`.

**The whole gap was the input.**

## What was built

| Task | What | Commit |
|---|---|---|
| 1 | `setBusinessRequirement` on the builder store — a structural mirror of `setProjectFolder`: drafted-guard, then ONE `set()` that writes `meta` and arms `dirty` together | `da668c96` |
| 2 | `requirementAffordance` in the header's `identityGroup` beside `kbAffordance`, plus the `REQUIREMENT_INVITATION` placeholder | `1c58a3fb` |

Both tasks were driven **RED-first**, and the RED was observed rather than assumed:

- **Task 1 RED:** 6 failed / 52 passed, every failure `store.getState(...).setBusinessRequirement is not a function`. **GREEN:** 58 passed / 0 failed.
- **Task 2 RED:** 5 failed, every failure `Unable to find an element by: [data-testid="business-requirement-input"]` (one on `builder-business-requirement`). **GREEN:** 5 passed.

## Numbers — before and after

### Typecheck

`cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`

| | Count |
|---|---|
| **Before (baseline, re-derived on `develop` before any edit)** | **33** |
| After Task 1 | 33 |
| **After Task 2 (final)** | **33** |

**Unmoved at 33, not 34** — the plan's done-criterion. (The bare `--noEmit` form checks
ZERO files; the `-p tsconfig.app.json` flag is load-bearing and was used throughout.)

### Scoped vitest — the plan's contractual four-suite gate

`GSD_VITEST_MAX_WORKERS=4 npx vitest run WorkflowBuilderPage.header.test.tsx WorkflowBuilderPage.canvas.test.tsx builderStore.test.ts ProblemsTray.test.tsx`

| | Files | Tests passed | Failed |
|---|---|---|---|
| **Before (baseline, re-derived — matched the plan exactly)** | 4 | **242** | **0** |
| **After (4 consecutive runs, all identical)** | 4 | **253** | **0** |

**Delta = +11, exactly the tests added** (6 store + 5 page). The 253 decomposes against the
count-gate pins, which is the cross-check that the number is real:
`WorkflowBuilderPage.canvas.test.tsx` 133 (128 pinned + 5) + `builderStore.test.ts` 58
(52 pinned + 6) + `WorkflowBuilderPage.header.test.tsx` **32, unchanged** +
`ProblemsTray.test.tsx` 30 = **253**.

`vitest-count-gate.cjs` is a count-**decrease** gate, so adding tests to pinned files is
safe and **no pin needed editing**. No existing `it(` was removed, renamed or edited.

### Scope

`git diff --stat HEAD~2 HEAD` → **exactly 4 files, 410 insertions, 0 deletions.**

The zero-deletion figure is the machine-checkable form of "nothing existing was edited".
Verified separately: `WorkflowBuilderPage.header.test.tsx` has **zero** diff (its
byte-for-byte flag-off `<header>` pin passes **UNEDITED** — the evidence D-181-01 holds);
`WorkflowCanvas.tsx`, `PhaseFormPanel.tsx`, `useDraftPersistence.ts` and everything under
`backend/` are untouched; `git diff … | grep -c "dangerouslySetInnerHTML"` → **0** (T-klo-01).

## ⚠ What I could NOT verify — owed manual UAT

**Verification step 5 — the live reload + publish check — DID NOT RUN. It is owed, not
passed.** Stating this plainly because a bug closed on a green unit suite alone is the
failure mode this project has recorded four times.

Both services are up (`localhost:5173` → 200, `localhost:8000/health` → 200), but **I have
no browser-automation tool available in this session**, so I could not drive the UI. The
unit tests prove the typed sentence reaches the `updateWorkflowDraft` argument; they cannot
prove the real app renders the control, that the real backend accepts the PATCH, or that
the real gauntlet's stage 1 passes.

**One thing I could check, and did, to save a confusing UAT run:** the flag is genuinely ON
in this environment — `app_settings.feature_visibility.visual_workflow_canvas.audience` is
`"everyone"` (read directly from local Postgres on `:54322`). So the control will be
visible.

**The owed row, to run first:**

> With `visual_workflow_canvas` ON, build a workflow from scratch on the canvas → type a
> requirement in the header → confirm the header reads `Saved · still a draft` → **reload
> the page** → the requirement is still there → `◆ Publish…` is no longer blocked on
> stage 1 ("Goal").

**Consequently `BUG-260809-02` was NOT flipped to `status: closed`.** The plan gates that
edit on step 5 actually running, and it did not. The bug report is left untouched for the
operator to close after the UAT row passes.

## Deviations from plan

**None affecting the implementation** — the plan's placement, gating, glyph choice and test
shapes were followed as written, and its three measured corrections (the store already
round-trips the field; the warning already ships; the `missing_business_requirement`
fixture is an invented string) all held on re-derivation.

One **discovery**, handled under the executor SCOPE BOUNDARY rather than fixed:

**Two shipped tests flake intermittently.** Running the wider six-suite command in Task 2's
`<verify>` block, `WorkflowBuilderPage.session.test.tsx`'s `[create, update, update]` row
failed 2 of 6 runs, and `WorkflowBuilderPage.canvas.test.tsx`'s D-14 rails positive control
failed 1 of 6. Neither is in the plan's contractual four-suite gate; neither was written or
edited here.

Judged a **timing flake, on evidence, not by assertion**: the failure identity *wanders*
between two unrelated suites (a logic regression fails the same assertion every time); it
**reproduces with parallelism entirely disabled** (`--no-file-parallelism`), so it is not
purely the worker-oversubscription class; both tests are of the known-fragile shape
(`vi.resetModules()` + dynamic whole-module re-import + a **1 s default** `waitFor`; and a
full `userEvent` describe→draft→save flow); and each passes reliably alone (the session
suite ran 23/23 green in isolation).

**The caveat is stated rather than hidden:** pre-change I measured 4/4 green canvas-alone
and 3/3 green six-suite, so I did **not** observe the flake before my change — but that
sample **cannot exclude a pre-existing rate**, since 4 clean runs of a ~1-in-6 event has
roughly a 48% chance of showing zero (0.83⁴). It is equally plausible that this task's ~90
added lines in `WorkflowBuilderPage.tsx` marginally lengthen the very dynamic import the
D-14 control waits on. **I could not distinguish the two readings with the samples taken
and am not claiming the flake is purely pre-existing.**

The pinned tests were deliberately **not** edited — widening a shipped test's timeout to
manufacture a green is the "fix the pin, not the cause" move this project has recorded
against. Full detail and a concrete re-open trigger are in
`260809-klo-deferred-items.md` (**D-klo-DEF-03**).

Every run in this task was capped at `GSD_VITEST_MAX_WORKERS=4` per CLAUDE.md.

## Deferred (carried forward with triggers)

Both plan deferrals were carried into `260809-klo-deferred-items.md` and **neither was
implemented**, per the task constraints:

- **D-klo-DEF-01** — the blocking copy names an internal field. A **backend** change (two
  sites, which must move in lockstep); a frontend rewrite would install the client-side
  message mapping D-182-06 forbids. Safe to defer now because the author reading that
  sentence has the control directly above the button they just pressed — the copy is
  unhelpful, but **no longer a dead end**.
- **D-klo-DEF-02** — `inputs` / `assets` / `category` reachability was **not measured** and
  is out of scope (`project_folder_id` *is* reachable, via D-186-15).
- **D-klo-DEF-03** — the test flake above.

## Threat flags

None. The threat register's three live dispositions were honoured: **T-klo-01** (XSS) — the
value renders only as a React `value` prop, and `dangerouslySetInnerHTML` is asserted absent
from the diff; **T-klo-03** (flag-off leakage) — mitigated by the `canvasEnabled` gate,
proven by the unedited byte pin *plus* Task 2's Test 4 negative **with its positive control
in the same test**; **T-klo-02** (prompt injection at the judge rubric) — accepted and
unchanged, since this adds a third writer of an existing field, not a new sink.
**T-klo-SC** — nothing was installed; no package manager ran.

## Known stubs

None. Every control added is wired to a real store action and a real save path.

## Self-Check: PASSED

- Commits `da668c96` and `1c58a3fb` — both found in `git log`.
- All four `files_modified` paths exist on disk and appear in the two commits.
- `git diff --diff-filter=D HEAD~2 HEAD` → **no deletions**.
- No push performed; both commits are local on `develop`.
- No docs artifact was committed (SUMMARY, PLAN, STATE, deferred-items and the bug report
  are left staged-free for the orchestrator's docs commit).
- ROADMAP.md not touched (quick tasks are separate from planned phases).
