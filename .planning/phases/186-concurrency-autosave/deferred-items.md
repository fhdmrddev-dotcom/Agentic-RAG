# Phase 186 — Deferred Items (recorded, not built)

Written by 186-08. Each entry names **what was consciously not built**, **why**, and a
**concrete re-open trigger** — the project rule is that every deferral gets one, so a
deferred idea is a scheduled decision rather than a lost one.

---

## 1. D-186-17 — the `folder_scope` ordering trap (carried forward, both directions)

**What is deferred:** making `folder_scope` editable per phase. 186 did not touch it.

**Why it matters to whoever does.** A phase that declares `folder_scope` while the
workflow has **no** `project_folder_id` raises a raw Pydantic 422 at the shape tier
(`_folder_scope_requires_project`, `backend/app/models/harness.py:294`). Under D-186-04's
hold-the-write rule the autosave loop **holds the write and says why** rather than
PATCHing — so a draft that reaches that state is **permanently unsaveable** from the
canvas. Every keystroke after it would be held. The workflow-level binding must therefore
be settable **first**, and the per-phase control must be **gated on it**.

**The bind direction is now closed.** 186-08 shipped the workflow-level binding as a
control on the built canvas (D-186-15), so the "you cannot set the thing the per-phase
field depends on" half of the trap no longer exists.

**The UNBIND direction is the addendum D-186-17 did not anticipate.** The header picker
can now clear a binding as well as set one. Clearing it on a workflow whose phases carry
`folder_scope` would spring exactly the same 422. It is **unreachable today, and pinned by
a test rather than assumed**: `PhaseFormPanel` renders `folder_scope` as a read-only
display and no authoring control writes it — asserted in
`frontend/src/pages/WorkflowBuilderPage.header.test.tsx` (*"PhaseFormPanel renders
folder_scope, and writes it nowhere"*), which reads the panel's source with comments
stripped and fails if any of the three write shapes appears.

A client-side *"you cannot unbind while a step scopes a folder"* refusal was **rejected**:
that is the client computing a validation rule, which is what D-182-06 forbids. The
server owns every verdict.

**Re-open trigger:** the first plan that proposes an **editable `folder_scope` control**.
That plan must (a) land/keep the workflow-level binding first, (b) gate the per-phase
control on a bound workflow, (c) decide what an unbind does when a phase scopes a folder —
and (d) delete the unreachability assertion above **in the same commit**, because the
moment the field is writable that test is asserting something that is no longer true.

---

## 2. `BUG-260731-03`'s verdict half → Phase 187 (unchanged)

**What is deferred:** the deterministic build-time `POST /workflows/validate` `incomplete`
verdict for an unbound workflow whose phases carry retrieval tools.

**Why here and not there.** D-186-14 split the bug: 186 folds the **minimum** fix (the
author-time binding **control**), 187 keeps the **necessary** one (the deterministic
verdict). The bug report's own `re_open_trigger` says explicitly that it must **not** flip
to `closed` when 186 ships. The reason is in the report's second same-day update: the
publish-gauntlet judge **passed a worse deliverable than it had failed an hour earlier**
(11 files across 5+ folders vs 3 across 3). A probabilistic hard wall that fails open under
variance is not a control for this failure mode; a structural property of the definition
should be checked deterministically on the canvas, before a golden run is spent.

186-08 therefore adds **no** verdict, **no** severity, **no** code, **no** problems-tray
row, **no** node mark and **no** `blockedReason` entry — enforced by a source fence with
both a positive and a negative control.

**Re-open trigger:** Phase 187 (SEED-132 validation-envelope work / its SC#3
safe-by-construction claim). `BUG-260731-03` stays `status: folded` until **both** halves
are verified.

---

## 3. The repair path is reachable only with `visual_workflow_canvas` ON

**What is deferred:** a knowledge-base control on the **flag-off** Builder surface.

**Why.** D-181-01 — the v3.6 revert foundation, this milestone's HARD gate #1 — promises
the flag-off Builder is byte-identical for everyone, operators included, and that promise
is pinned as literal markup in `WorkflowBuilderPage.header.test.tsx`. A new affordance
rendered unconditionally would mean the off-switch no longer reverts v3.6. The reporting
operator hit this bug **with the canvas on** (the report's own complaint is that
regeneration "discards the authored canvas"), so gating loses nothing for the person who
reported it. Flag-off keeps the shipped display-only chip, byte for byte — including
hiding when unbound.

**Re-open trigger:** the flag-off Builder being kept as a *supported* long-term surface
rather than a revert switch — i.e. the first time an operator is asked to author a
workflow with `visual_workflow_canvas` off. At that point the flag-off surface needs its
own binding control and the markup pin must be updated deliberately.

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 08*

---

## The frontend full-suite rot band is wider — and less STABLE — than SEED-056 records

**Status:** deferred, out of scope (executor scope boundary — none of it is caused by, or in a
file touched by, plan 186-09).

**What was observed.** Two consecutive full `npx vitest run` passes on the same tree reported
**43 failures / 12 files** and then **42 failures / 11 files**, and the failing SET differed
between them (`MessageItem` in one only; `model-info` and `WorkflowBuilderPage.session` in the
other only). SEED-056 records the band as "~14-17". The instability is the finding as much as the
size: a phase-verification gate that compares a single failure count against a single remembered
number will read as a regression or a fix at random.

**What was proven, so a later reader does not re-derive it:**

| Group | Failures | In isolation |
|---|---|---|
| 8 genuinely-rotten files (`streamsProvider`, `StreamsProvider.dedup`, `streamsProvider_075_9_clientkey`, `IngestionPage`, `MessageItem`, `Plan04.frontend`, `useMessages`, `model-info`) | 21 / 144 | **fail identically** — real rot, no parallel load needed |
| `PublishGauntlet.test.tsx` | 18 | **passes fully** |
| `WorkflowCanvas.test.tsx` | 2 | **passes fully** |
| the 5 suites importing `useDraftPersistence` + `builderStore.test.ts` + `PublishGauntlet` | 0 | **245 passed / 245** |

Total collected was **3556 on every run** — non-decreasing, so nothing was replaced or deleted
(the Phase 177 lesson).

**Why it is not fixed here.** Plan 186-09 changed three statements inside one function of
`useDraftPersistence.ts`. No file in the failing set imports that hook. Fixing 21 unrelated rotten
tests inside a gap-closure plan would bury the one change the phase's re-verification has to be
able to see.

**Re-open trigger:** the next `/gsd:verify-work 186` (or any phase gate) that wants to read the
frontend suite as a pass/fail signal. At that point the band needs to be measured **per file in
isolation**, not as a single whole-suite number — and `PublishGauntlet` / `WorkflowCanvas` need
their parallel-load flake fixed or their concurrency pinned, because they alone account for 20 of
the ~42 and are pure noise.

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 09*
