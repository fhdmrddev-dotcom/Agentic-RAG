# Phase 194: Stop a Running Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-16
**Phase:** 194-stop-a-running-workflow
**Areas discussed:** G-5 guardrail handling, interrupted-phase state (SC#3), zombie/unstoppable runs (SC#2), Stop control placement (SC#1), post-stop aftermath, reported-bug routing

---

## Pre-discussion measurement (no options — this reframed the phase)

Before any question was asked, the cancel path was measured at HEAD. **Two planning artifacts
disagreed about the size of this phase and both were found half wrong**, which is recorded in
CONTEXT.md `<domain>` rather than resolved silently:

- `ROADMAP.md:494-495` — *"mostly UI over an endpoint that already exists"*, *"not a new runtime path"*.
- `STATE.md` §*PHASE 194 — TWO FINDINGS* — *"194 is a NEW runtime path… an endpoint, a DB writer, and
  harness-engine cooperation"*.

Measured: a harness run is driven by the **same producer task as a Deep run**, so `DELETE /runs/{id}`
already cancels it and the F2 block (`run_producer.py:254-277`) already writes
`workflow_runs.status='cancelled'`. STATE.md's four individual measurements were each correct; only
its **inference** was wrong — it searched the workflow-side modules for a cancel verb and concluded
none exists, when the cancel lives on the `runs` side by design.

⇒ The phase was re-framed from *"build cancel"* to *"is the shipped cancel reachable, honest and safe
from the workflow run surface?"*, and three gaps were measured, one per success criterion.

---

## G-5 guardrail handling

`RunCard.tsx` (20 commits / ~9 buckets) and `WorkspacePanel.tsx` (13 / ~8) both fire G-5 and **neither
is a row in the `CLAUDE.md` hot-file ledger** — surfaced before the feature, per the orchestrator
protocol.

| Option | Description | Selected |
|--------|-------------|----------|
| Honour by construction + write the rows | No extraction; 194 adds an affordance to surfaces that already own run state, and writes the two missing ledger rows as a deliverable | ✓ |
| Extract first, then build | A dedicated refactor wave before the Stop lands — the 192.1/193 order; costs a wave, buys a smaller surface for 195 | |
| Log an override and move on | Skip both; would be the first override in four phases | |

**User's choice:** Honour by construction + write the rows.
**Notes:** Recorded as D-01/D-02. **The override was offered and declined** — the fourth consecutive
phase, so the absence of a `STATE.md` guardrail-override entry is a measurement, not an omission.
D-01 carries an escape clause: if planning finds the Stop needs new state ownership in either file,
that is a second concern and the refactor recommendation is owed first.

---

## The interrupted phase's state (SC#3)

Measured: `finish_run` writes only the run row + anchor, so the in-flight `workflow_phases` row stays
`active` forever; and `workflow_phases_status_check` (mig 115) has no `cancelled` literal.

| Option | Description | Selected |
|--------|-------------|----------|
| New migration adding a `cancelled` literal | One ALTER widening the CHECK 6 → 7, mig-115 shape, plus a phase-terminalize write | ✓ |
| Leave the row; derive "interrupted" in the UI | No schema change, but the database keeps a row reading `active` on a terminal run | |
| Reuse `failed` or `skipped` | No migration, one write — but dishonest | |

**User's choice:** New migration.
**Notes:** D-04/D-05/D-06/D-07. Migration `119_*.sql` (highest existing is 118). The reuse option was
rejected in one move: *the phase did not fail and was not skipped — it ran and was interrupted*, in a
phase whose entire requirement is honesty. Mig 115's re-typed-`ARRAY` trap and negative-control shape
are carried over as requirements, not suggestions.

---

## Zombie / unstoppable runs (SC#2)

Measured: `_cancel_run_internals` Step 3b heals only the `runs` row; `finalize_run_terminal` never
touches `workflow_runs`. With `WORKER_COUNT=2` and a per-process `RUN_TASKS`, this is roughly half of
all missed Stops, not an edge case.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the arm to `workflow_runs` AND heal the two stuck rows | Full fix; also unblocks the delete half of BUG-260815-07 | ✓ |
| Fix the code path, leave the two stuck rows | No new run wedges; the historical rows cleaned separately | |
| Out of scope — live-producer case only | Smallest phase; RUN-01's *"at any point"* then qualified rather than met | |

**User's choice:** Extend the arm and heal the two stuck rows.
**Notes:** D-09 through D-12. The two rows have been `active` since **2026-06-14** and **2026-08-01**
and are a permanent delete blocker. D-12 requires the row ids and before/after status to be captured,
because *a data repair with no receipt is indistinguishable from a claim*. D-11 inherits the 064-B
honesty rule: a healed zombie renders *"recovered a stuck run"*, never *"killed"*.

---

## Where the Stop control lives (SC#1)

Multi-select. **All four were chosen.**

| Option | Description | Selected |
|--------|-------------|----------|
| The panel's phase spine | Primary; the panel owns the meaningful spine per the 094/103 split, and has no Stop at all today | ✓ |
| The composer Stop, made reliable during a harness run | Already ships; reachability during a harness run is unverified | ✓ |
| The `ActiveRunsTray` row | Already has per-run Stop + Stop-all through the same path | ✓ |
| The Workflows page / run history | Stop from the library, away from chat | ✓ |

**User's choice:** All four.
**Notes:** Pushed back on the fourth before locking it — three of the four are **one mechanism at
three mounts** (all route through `cancelRun`), but *"stop from the run history"* presumes a history
surface that does not exist (`BUG-260815-03`). A follow-up question narrowed it.

### Follow-up — what the fourth home meant

| Option | Description | Selected |
|--------|-------------|----------|
| Stop from the Workflows page row, no new history surface | Live runs actionable from the library using an id it already has | ✓ |
| Build the run-history surface too | Closes BUG-260815-03; roughly doubles the phase, new UI with zero review cycles | |
| Drop it — three homes is enough | Panel + composer + tray only | |

**User's choice:** Library row, live half only.
**Notes:** D-08 — four mounts, ONE mechanism; no second cancel path may be introduced, mirroring
`ActiveRunsTray`'s own shipped rule.

---

## The aftermath — what a stopped run shows

| Option | Description | Selected |
|--------|-------------|----------|
| Keep completed phases, mark the interrupted one, terminal | Honest about partial work without implying a finished deliverable | ✓ |
| Same, but resumable | The continuation machinery exists — but `cancelled` would then mean `paused` | |
| Collapse to a bare `cancelled` | Simplest; discards evidence the database still holds | |

**User's choice:** Keep completed phases, mark the interrupted one, terminal.
**Notes:** D-13/D-14. Resumability rejected because `workflow_runs.status` already carries a distinct
`paused` (migs 057/063) for exactly that meaning, and collapsing the two would defeat SC#2. The
engine's existing rule that completed phases' outputs stay durable is preserved verbatim.

---

## Reported-bug routing

Multi-select over the four open `surface: Agentic-RAG` reports whose `affected_areas` overlap this
domain. **All four were chosen initially.**

| Report | Sev | Selected | Outcome |
|--------|-----|----------|---------|
| `BUG-260815-07` — stuck-active runs block deletion | major | ✓ | **FOLDED** — reproducible half only; the non-reproducible delete failure stays open |
| `BUG-260815-04` — chat stuck on *"Starting workflow…"* | major | ✓ | **FOLDED** — blocks SC#1 |
| `BUG-260808-02` — approval hands off to chat | major | ✓ | **FOLDED** with a scope fence |
| `BUG-260815-03` — run history unreachable from canvas | major | ✓ | ⚠ **UN-FOLDED on measurement → DEFERRED to 195** |

**Notes:** `BUG-260815-03` was offered conditionally — *"fold only if you chose to build the
run-history surface"* — and the history surface had just been declined, so the combination was
contradictory. Surfaced rather than resolved silently, and a follow-up question settled it.

⚠ **`BUG-260815-04`'s string is DELIBERATE and byte-pinned.** `outerBannerLabel`
(`toolMeta.ts:92`), pinned by `toolMeta.test.ts:30` as a D-14 decision. The defect is that the surface
never **advances** out of its pre-tools state while `workflow_phases` rows are being written. Stated
three times in CONTEXT.md on purpose, because the obvious "fix" is to reword it — which would break a
nine-phase-old pin and change nothing a user experiences.

### Follow-up — how to record BUG-260815-03

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with a named trigger to 195 | 195 must read a completed run's outputs from the run surface — the natural home | ✓ |
| Fold the live half only, defer the rest | Splits one report into two states | |
| Fold it whole — build the history surface after all | Reverses the earlier answer | |

**User's choice:** Defer to 195 with a named trigger.
**Notes:** D-15. `re_open_trigger: "the first phase that renders a completed workflow run's phases
outside the chat thread"`. Marking it `folded_into: 194` would have put a bug in the *claimed* state
that the phase structurally cannot close — the bookkeeping failure this project's ROADMAP keeps
catching after the fact.

---

## Claude's Discretion

- Exact stopped-state wording on each of the four mounts, constrained by `RunCard`'s shipped
  vocabulary (D-14) and `references/icon-convention.md` §4 for any spine mark.
- Whether the panel Stop is per-run or per-phase, provided it reads as stopping the RUN and cannot be
  confused with skipping a phase.
- Test-fence design, subject to the standing rule that **a fence is only real once you have watched
  it fail** — every new fence driven RED against a real plant in production source.

## Deferred Ideas

- `BUG-260815-03` → Phase 195, with the trigger above (D-15).
- Moving the approval checkpoint off chat — a phase, not a task. Trigger: any plan whose
  `BUG-260808-02` fix requires relocating it.
- `BUG-260815-07`'s non-reproducible delete failure — stays open. Trigger: a second sighting.
- Scheduled / recurring runs + budget caps (Phase 105 carry-forward) — RUN-01 is their hard
  prerequisite; the spend-cap brake is not built here.
- Deep-run cancel behaviour — untouched; any change to it is a regression, not a deliverable.
