---
seed_id: SEED-218
title: The describe door's refusal offers a *connect* button that does nothing — `onOpenSettings` is threaded and lands on no handler
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, measured by plan `214-13` and recorded at the phase close; owner named, wiring not done
surface: Agentic-RAG
severity: major
category: frontend / reachability
priority: high
scope: >
  One prop, one owner. `214-13` named `frontend/src/pages/WorkflowsPage.tsx` as the component that
  should supply `onOpenSettings`; the prop is threaded through the refusal but no page supplies a
  handler, so the button renders and does nothing.
affected_areas: [frontend/workflows, frontend/settings, app-navigation]
related_seeds: [SEED-208, SEED-205]
related_bugs: []
relates_to:
  - frontend/src/components/workflows/DescribeServicePicker.tsx — renders the refusal
  - frontend/src/pages/WorkflowsPage.tsx — the named owner
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx — the mount
re_open_trigger: >
  ⚠ ALREADY TRUE AT PLANTING. Re-open at whichever comes first: (1) the operator drives
  `214-UAT.md` G4-8 and presses the button; (2) any phase whose `files_modified` names
  `WorkflowsPage.tsx` or `DescribeServicePicker.tsx`; (3) any phase that adds a second
  "go and connect it" affordance anywhere — this one should be wired before a sibling is added,
  or the app will carry two dead paths instead of one.

  Mechanical check that the gap is still real, from the repo root:
    grep -rn "onOpenSettings" frontend/src | grep -v "\.test\."
  If every hit is a declaration or a pass-through and none is a handler, the gap is live.
trigger_when: unset
---

# SEED-218: the refusal's connect button is a no-op

## What was measured

`214-13` shipped the describe door's refusal for a named-but-unconnected service. The refusal offers
two next actions, one of which is *connect it*. That action's callback prop, `onOpenSettings`, is
declared and threaded — and **no page supplies it**, so pressing the button does nothing.

The owner was named at plan time as `frontend/src/pages/WorkflowsPage.tsx`. It was not wired.

## Why it matters

⚠ **A refusal whose remedy is a dead button is worse than a refusal with no remedy**, because it
tells the author the fix is one click away and then withholds it. The whole point of `SEED-208` was
that a named-but-absent service produces *a stated refusal, never a step that fails at 03:00* — and
a stated refusal is only half the contract if the stated next action is inert.

⚠ **This is Phase 213's recorded failure shape**: a surface shipped and consumed by nothing, green
on every gate, caught by a driven check rather than by a suite. It is recorded here at the close
rather than left for the operator to find.

## Why Phase 214 did not fix it

`214-13` owns the refusal component and does not own the page; `214-04` owns the page and did not
know the prop existed. **Neither plan owned the seam**, which is the same cross-plan-seam failure
mode the 204 pre-flight recorded: both sides green, the join unowned.
