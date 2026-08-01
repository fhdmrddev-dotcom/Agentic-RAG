---
phase: 186-concurrency-autosave
plan: 18
subsystem: workflow-builder-publish
tags: [concurrency, publish-gauntlet, autosave, feature-flag, gap-closure, cr-03]
gap_closure: true
closes: [CR-03]
requires:
  - "the shipped `blockedReason` seam (184-11 / R12) and its 186-16 `saving` branch"
  - "`useDraftPersistence.saveNow`, ungated on the canvas flag by D-186-03"
provides:
  - "a publish refusal that is reachable on BOTH branches of the `visual_workflow_canvas` gate"
  - "the flag-OFF Save-then-Publish row that observed the hole open before it was closed"
  - "the CR-03 live check, shipped with the fix in `186-VALIDATION.md`"
affects:
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - .planning/phases/186-concurrency-autosave/186-VALIDATION.md
tech-stack:
  added: []
  patterns:
    - "a guard belongs at the same reachability as the thing it guards — the flag gates VERDICTS (claims about the workflow), never a fact about this client's own write loop"
    - "assert the PREMISE, don't argue it — the new row proves the flag-off write is reachable by call count before it asserts the refusal"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - .planning/phases/186-concurrency-autosave/186-VALIDATION.md
decisions:
  - "D-186-18-A: the fix is a one-line REORDER inside `blockedReason`, not a flush and not a new seam — `persistState.kind === \"saving\"` becomes the memo's first statement, above the `!canvasEnabled || builderPhase !== \"drafted\"` short-circuit"
  - "D-186-18-B: the four verdict branches STAY below the flag gate — D-181-01 constrains what the reverted surface may CLAIM about the workflow, and an outstanding write is not such a claim"
  - "D-186-18-C: D-181-01 compliance is measured, not asserted — the two byte-for-byte header pins pass with `FLAG_OFF_HEADER_MARKUP` unedited, because the new reading is unreachable at rest"
  - "D-186-18-D: the five-suite verification runs with `--fileParallelism=false`; under parallel workers `PublishGauntlet.test.tsx` flakes on `user-event` timeouts (measured: 46/46 green alone, 2 spurious failures in-aggregate) and that flake is unrelated to this plan"
metrics:
  tasks: 3
  commits: 3
  duration: ~30 min
  completed: 2026-08-01
---

# Phase 186 Plan 18: Publish Refuses an Outstanding Write on the Flag-OFF Surface Too Summary

CR-03 is closed: 186-16's refusal was placed one line BELOW a short-circuit that returns `null`
whenever `visual_workflow_canvas` is off, making it dead code on exactly the surface where the
write it guards against is still reachable by design — so the branch now runs first, and a chosen
**Save draft** on the reverted Builder refuses Publish with the same wait sentence the flag-on
surface gives.

## What Was Built

**The finding, re-derived from source before anything was changed** (not inherited from the
verification report): `WorkflowBuilderPage.tsx:1076` was
`if (!canvasEnabled || builderPhase !== "drafted") return null` and `:1077` was
`if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT`. Meanwhile `saveNow`
(`useDraftPersistence.ts:852-863`) gates on `haltedRef` and `holdRef` only — never on `enabled`
(D-186-03, stated in its own docblock at `:820-823`: *"automatic writes obey the flag, chosen ones
obey the person"*) — and `actionGroup` (`:1704-1727`) mounts BOTH `builder-save-draft` and
`renderPublish(definition, draftId, blockedReason, …)`, and is rendered by the `canvasEnabled`
branch (`:1740-1746`) **and** the plain-header branch (`:1748-1751`). Every line number in the plan
held against the live tree.

**Task 1 (RED).** One row appended to the existing `186-16` describe in
`WorkflowBuilderPage.canvas.test.tsx`: a deferred `updateWorkflowDraft`, a mount on
`FLAG_OFF_186_16`, one real edit, a press of `builder-save-draft`, then — in order — an assertion
that `mockUpdate` was called **exactly once** (the D-186-03 premise, measured), an assertion that
the captured `blockedReason` is `SAVING_PUBLISH_WAIT`, and after release an equality against the
captured `before` reading. The three pre-existing rows were left byte-identical.

**Task 2 (GREEN).** The `saving` branch became the memo's first statement. The logic delta is a
single-line move: `git diff -U0` filtered to non-comment lines shows exactly one `-`/`+` pair (the
flag line), no branch deleted, and the dependency array `[canvasEnabled, builderPhase,
persistState, phases, validation]` unchanged. The docblock was rewritten to state the rule it now
embodies rather than the one it used to: the flag hides **verdicts** (claims about the workflow —
D-182-06 says the server owns them, D-181-01 says the reverted surface must not show them); an
outstanding write carries no severity, no code, no tray row, never enters `verdicts`, and is a fact
about this client's own loop, so the flag has no jurisdiction over it.

**Task 3.** Row 8 of `186-VALIDATION.md`'s Manual-Only Verifications, worded against the FIXED
behaviour with the pre-fix failure named explicitly so the operator can recognise it on sight.

## Measurements

### RED, recorded verbatim

```
$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx -t "186-16"

 ✓ … > names the outstanding write while it is outstanding, and stops naming it when it lands  1462ms
 ✓ … > with the flag OFF nothing writes and nothing blocks (D-181-01)  2436ms
 ✓ … > the saving reason OUTRANKS the empty-draft invitation — the nearest obstacle is the one named  1092ms
 × … > a CHOSEN save on the flag-OFF surface blocks publish too (CR-03) — D-186-03's asymmetry cuts both ways  1277ms

 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 186-16 — an outstanding write blocks publish (WR-10) > a CHOSEN save on the flag-OFF surface blocks publish too (CR-03) — D-186-03's asymmetry cuts both ways
AssertionError: expected null to be 'Saving your last change — Publish wil…' // Object.is equality

- Expected:
"Saving your last change — Publish will be ready in a moment"

+ Received:
null

 ❯ src/pages/WorkflowBuilderPage.canvas.test.tsx:1923:42
```

**The failure is where the plan required it to be** — at the `latest()` / `SAVING_PUBLISH_WAIT`
assertion, *after* the `mockUpdate` call-count assertion had already passed. The premise holds:
the chosen write really is issued on the flag-off surface, so the refusal really was dead code
there.

### GREEN, and the before/after counts

Command (both runs identical, `--fileParallelism=false` — see D-186-18-D):

```
cd frontend && npx vitest run --fileParallelism=false \
  src/pages/WorkflowBuilderPage.canvas.test.tsx \
  src/pages/WorkflowBuilderPage.header.test.tsx \
  src/pages/WorkflowBuilderPage.test.tsx \
  src/pages/WorkflowBuilderPage.session.test.tsx \
  src/components/workflows/PublishGauntlet.test.tsx
```

| Point | Test Files | Tests |
|---|---|---|
| After Task 1 (RED committed), before the fix | 1 failed \| 4 passed (5) | **1 failed \| 198 passed (199)** |
| After Task 2 (the fix) | **5 passed (5)** | **199 passed (199)** |

Aggregate count is **non-decreasing**: the pre-plan tree held 198 tests across these five suites,
Task 1 added exactly `+1` (the only permitted delta), and 199 now pass. `it(` count in
`WorkflowBuilderPage.canvas.test.tsx`: **101 → 102**.

### Did the header pins move? No.

`git status --short frontend/src/pages/WorkflowBuilderPage.header.test.tsx` and
`git diff --stat` on it are both **empty** — `FLAG_OFF_HEADER_MARKUP` was not edited, and both
pins pass unchanged:

```
 ✓ Builder header, canvas flag OFF — the markup itself is pinned > matches the captured flag-off header byte for byte  142ms
 ✓ Builder header, canvas flag OFF — the markup itself is pinned > an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)  114ms
      Tests  27 passed (27)
```

D-181-01 therefore holds by measurement, for the reason the docblock now records: the new reading
requires a write the person explicitly requested to be outstanding, which is unreachable at rest.

### `git diff --stat` for the source change

```
 frontend/src/pages/WorkflowBuilderPage.tsx | 40 ++++++++++++++++++++++--------
 1 file changed, 29 insertions(+), 11 deletions(-)
```

Filtering that diff to non-docblock lines yields exactly one `-`/`+` pair — the moved flag line.
The 29/11 is otherwise entirely docblock prose. The render/logic budget the plan set (single-digit
insertions) is met with **1**.

### Source-order assertions (post-fix line numbers)

| Line | Statement | Required position |
|---|---|---|
| 1094 | `if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT` | above the gate ✅ |
| 1095 | `if (!canvasEnabled \|\| builderPhase !== "drafted") return null` | the gate |
| 1096 | `phases.length === 0` → `EMPTY_DRAFT_INVITATION` | below the gate ✅ |
| 1097 | `validation.kind === "degraded"` → `DEGRADED_SENTENCE` | below the gate ✅ |
| 1100 | `validation.verdicts.find(…)` | below the gate ✅ |
| 1102 | `}, [canvasEnabled, builderPhase, persistState, phases, validation])` | unchanged ✅ |

### Typecheck

`npx tsc --noEmit -p tsconfig.app.json` — **zero errors in any phase-186 file** (filtered on
`WorkflowBuilderPage`, `useDraftPersistence`, `PublishGauntlet`, `BuilderSaveRegion`). The project
carries substantial pre-existing typecheck rot elsewhere (`src/__tests__/**`, chat components); it
is untouched by this plan and out of scope.

### Zero migrations, zero package changes

`git diff HEAD~3 --stat -- frontend/package.json frontend/package-lock.json` is empty
(T-186-18-SC satisfied). No SQL migration was added or altered.

## Validation row

`186-VALIDATION.md` gained **row 8** — flag-OFF, edit, **Save draft**, then open Publish and
attempt the inner click. Expected: both controls disabled with `publish-blocked-reason` /
`publish-inner-blocked-reason` (both testids verified present in `PublishGauntlet.tsx` at `:935`
and `:697`) reading *"Saving your last change — Publish will be ready in a moment"*, no golden run
spent, and both controls live again the instant the save lands. The row names the failure shape
too: a gauntlet that burns a golden run and returns `draft_changed` for a pre-click edit is the
pre-fix behaviour. Status `to run`. Table row count 8 → 9 data rows (file `^| ` count 63 → 64);
row 4's ⛔ entry and the `**Approval:** pending` line are untouched (diff is 7 insertions, **0
deletions**).

## Deviations from Plan

**1. [Rule 3 - Blocking] The five-suite verification command was run with `--fileParallelism=false`**
- **Found during:** Task 2 baseline measurement
- **Issue:** Run under vitest's default parallel file execution, the aggregate produced
  non-deterministic results across three consecutive runs — 2 failed files / 3 failed tests, then
  3 failed / 5, then 2 failed / 3. The extra failures were all in
  `PublishGauntlet.test.tsx` (`user-event` typing/click timeouts, e.g. *"run the gauntlet"* button
  not found at `PublishGauntlet.test.tsx:78`), a file this plan does not modify.
- **Fix:** Measured the file in isolation — **46/46 green** — confirming load-induced flake rather
  than a regression, then ran the aggregate with `--fileParallelism=false` for both the before and
  the after measurement so the comparison is apples-to-apples.
- **Files modified:** none (a command-line change only)
- **Commit:** n/a — recorded here and as D-186-18-D

No other deviations. No Rule 1/2/4 conditions arose; no auth gates; no checkpoints.

## Threat Model Disposition

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-186-18-01 | accept | Unchanged. The client refusal is economics/UX; `publish_service.py`'s stage-0/stage-5 token guard is untouched and remains the boundary. Nothing moved from server to client. |
| T-186-18-02 | mitigate | Held. `SAVING_PUBLISH_WAIT` is a fixed client-authored constant with nothing interpolated; Task 2 changed only WHERE the branch is evaluated. Its single literal pin still lives in the flag-ON row. |
| T-186-18-03 | mitigate | Held and measured. The new row releases the deferred PATCH and asserts the reading returns to its captured `before` value — the disable ends by itself. |
| T-186-18-04 | mitigate | Held and measured. All four verdict branches remain below the flag gate (source-order table above), and both byte-for-byte header pins pass with `FLAG_OFF_HEADER_MARKUP` unedited. |
| T-186-18-SC | n/a | No installs; `package.json` and the lockfile are unchanged. |

## Known Stubs

None.

## Commits

| Task | Type | Hash | Description |
|---|---|---|---|
| 1 | test | `64042c12` | RED — a chosen Save on the flag-OFF Builder must block publish (CR-03) |
| 2 | fix | `bb693e10` | GREEN — lift the outstanding-write refusal above the flag gate (CR-03) |
| 3 | docs | `bbccf283` | add the CR-03 live row to 186-VALIDATION.md |

## What's Left / Follow-ups

- **Row 8 is `to run`.** CR-03 is closed at the unit level and in source order; the live operator
  confirmation is the remaining half, alongside the seven other `to run` rows already on the board.
- `186-VERIFICATION.md`'s last `human_verification` item still describes the *pre-fix* behaviour
  ("What the code currently does: neither the trigger nor the inner Publish button is disabled…").
  That report is a dated artifact of the 2026-08-01 pass and was deliberately not rewritten here —
  the next verification pass supersedes it.
