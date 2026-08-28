---
id: SEED-222
title: "Three verification blind spots, each measured at Phase 214's close — a named-but-nonexistent test path exits 0; a failure-count baseline scoped to one directory cannot see a global-default change; five gate suites run and guard nothing"
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, at plan `214-15`; items (a) and (b) measured by plan `214-14`, item (c) at the close's own gate run
surface: Agentic-RAG
severity: major
category: verification / guardrail integrity
priority: high
scope: >
  THREE separable defects in one seed because they share one root: a verification artefact that
  reports GREEN for a reason unrelated to the thing it claims to check. Each has its own fix and
  they can ship independently.
affected_areas: [verification, frontend/testing, backend/testing, ci]
related_seeds: [SEED-171, SEED-220]
related_bugs: []
relates_to:
  - scripts/vitest-count-gate.cjs — TARGETS vs BASELINE, the two knobs
  - backend/tests/unit — the failure-count baseline (68) this project quotes
  - .planning/phases/214-a-step-names-its-service-and-its-action/214-14-SUMMARY.md
re_open_trigger: >
  ⚠ ALL THREE ARE TRUE AT PLANTING. Re-open at whichever comes first: (1) any phase whose
  verification block CITES a test path — item (a) means that citation is worth nothing until the
  path is existence-checked; (2) any phase that changes a GLOBAL default (a feature flag's cold
  read, a config constant, a shared fixture) — item (b) means its chosen baseline directory is
  probably the wrong one; (3) any phase that creates a frontend suite — item (c) is the standing
  reason a new suite needs BOTH knobs checked rather than assumed; (4) the next re-derivation of
  the gate's figures, which is where the unpinned five will show up again as `— N new`.

  Mechanical checks that the gaps are still real, from the repo root:
    (a) cd frontend && npx vitest run src/does/not/exist.test.ts src/lib/apiBarrel.test.ts; echo $?
        --> exit 0 while one named path ran zero cases
    (c) GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs | grep " new"
---

# SEED-222: three verification blind spots

## (a) `npx vitest run` exits 0 when a named path does not exist

`214-14` declared three test paths that **do not exist in the tree**, and measured that vitest
**exits 0** when a non-existent path is named alongside real ones. It simply runs the real ones.

⚠ **Any verification that cites a path it did not existence-check has run zero of the cases it
believes it ran, and reported success.** This is not hypothetical: it happened inside this phase.

**The fix is one line per verification block** — existence-check every declared path before running,
and fail loudly on a miss. This plan (`214-15`) did exactly that before its own 36-suite in-scope run
and recorded `count=36 missing_flag=0`; that check should be a script, not a habit.

## (b) A failure-count baseline scoped to one directory cannot see a global-default change

`214-14` flipped `visual_workflow_canvas` to `everyone` at its **cold default** and thereby inverted
**18 assertions across seven suites — none of them in `backend/tests/unit`.**

⚠ **The baseline this project quotes for backend health is `backend/tests/unit` (68 failed).** It is
scoped to one directory, and a change to a GLOBAL default lands everywhere except there. A green
baseline said nothing about the eighteen assertions the flip inverted; they were found by reading the
diff, not by a gate.

**The fix is to name the blast radius rather than the directory** when a change is global: any phase
touching a cold default, a shared fixture or a config constant must run and record the suites that
READ it, not the suite that happens to be the standing baseline.

## (c) Five gate suites run and guard nothing

At this close the gate printed `— N new` for five suites that are executed by a `TARGETS` directory
entry and absent from `BASELINE`:

| suite | cases |
|---|---|
| `PromptVariableChips.test.tsx` | 3 |
| `RunHero.test.tsx` | 18 |
| `automationFacts.test.ts` | 11 |
| `nodeEffectBanner.test.ts` | 8 |
| `toolReadOnlyMap.test.ts` | 7 |

⚠ **An unpinned suite is not a lightly-guarded one, it is an UNGUARDED one** — its cases can be
deleted and the gate will not notice. `214-15` deliberately did not adopt them, because none guards a
file in Phase 214's diff and folding unrelated drift into a commit that did not cause it is the reason
twelve consecutive plans declined the pre-existing four. **Recorded here so the decision is visible to
a sweep instead of living only in a code comment.**

⚠ **And the same class produced a live miss in this phase**: `WorkflowScheduleModal.test.tsx` was
believed to be in NEITHER knob and was measured to be in TARGETS only — running, guarding nothing, on
a launch-critical surface. It is pinned at 9 by this close.
