/**
 * Phase 137-01 Task 2 (PANEL-01) — behavioral spec for the shared LifecycleStepper.
 *
 * Authored FRESH per the SEED-056 rot-avoidance rule (MEMORY project_frontend_vitest_rot)
 * — it does NOT import helpers from a rotted sibling spec. LifecycleStepper has no
 * `@/lib/api` dependency (it is a pure renderer of the PublishGate prop), so NO api mock
 * is needed: every render is deterministic from the props passed in.
 *
 * The load-bearing assertions:
 *   (1) passed + met            → the "Publish ready" copy renders;
 *   (2) never_evaled            → no fabricated pass; the Eval empty-state copy renders;
 *   (3) passed_on_older_version → the ⚡ collision as TWO labeled facts: a met-Gate label
 *                                 AND the newest run's failing count AND the stale
 *                                 "measured vN-1" message (never one flat contradiction);
 *   (4) last_override present   → the un-softened amber force-publish receipt renders;
 *   (5) variant="strip"         → one condensed line from the SAME PublishGate;
 *   (6) NO client recompute     → a met=false gate with passed>measured-favorable numbers
 *                                 still renders the not-met branch (proves T-137-01).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { PublishGate } from "@/types"
import { LifecycleStepper } from "./LifecycleStepper"

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: true,
    state: "passed",
    measured: 3,
    passed: 3,
    passing_run_id: "run-1",
    reason: "3/3 measured cases passed on the current version",
    last_override: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("LifecycleStepper — one-truth publish status (137-01)", () => {
  it("(1) passed + met → renders the 'Publish ready' copy", () => {
    render(<LifecycleStepper publishGate={mkGate()} caseCount={3} skillVersion={7} />)
    expect(screen.getByText(/Publish ready/i)).toBeTruthy()
    expect(screen.getByText(/Publishing is unlocked/i)).toBeTruthy()
  })

  it("(2) never_evaled → no fabricated pass; Eval empty-state copy renders", () => {
    render(
      <LifecycleStepper
        publishGate={mkGate({
          met: false,
          state: "never_evaled",
          measured: null,
          passed: null,
          passing_run_id: null,
        })}
        caseCount={3}
        skillVersion={7}
      />,
    )
    // The current-stage message points at running an eval — the empty state.
    expect(screen.getByText(/Eval is the next step/i)).toBeTruthy()
    expect(screen.getByText(/not run/i)).toBeTruthy()
    // No fabricated pass: the "Publish ready" / unlocked copy must be absent.
    expect(screen.queryByText(/Publish ready/i)).toBeNull()
    expect(screen.queryByText(/Publishing is unlocked/i)).toBeNull()
  })

  it("(3) passed_on_older_version → the ⚡ collision as two labeled facts", () => {
    // The gate met on an older passing run; the newest run added a case and FAILED (0/2).
    // A single PublishGate carries state + the honest count; the component binds each to
    // its stage so 1/1-vs-0/2 stop reading as one contradiction.
    render(
      <LifecycleStepper
        publishGate={mkGate({
          met: false,
          state: "passed_on_older_version",
          measured: 2,
          passed: 0,
          passing_run_id: null,
        })}
        caseCount={2}
        skillVersion={7}
      />,
    )
    // Fact A — the met-Gate label (a passing eval exists, bound to the older version).
    expect(screen.getByText(/passed on v6/i)).toBeTruthy()
    expect(screen.getByText(/passing eval exists/i)).toBeTruthy()
    // Fact B — the newest run's honest FAILING count on its own stage node.
    expect(screen.getByText("0/2")).toBeTruthy()
    // The stale-eval message names vN-1 vs the live vN — instantly actionable.
    expect(screen.getByText(/measured v6/i)).toBeTruthy()
    expect(screen.getByText(/the live skill is v7/i)).toBeTruthy()
    // met=false ⇒ still NOT ready to publish (the two facts never collapse into "ready").
    expect(screen.queryByText(/Publish ready/i)).toBeNull()
  })

  it("(4) last_override present → the amber force-publish receipt renders un-softened", () => {
    render(
      <LifecycleStepper
        publishGate={mkGate({
          last_override: { gate_state: "never_evaled", created_at: "2026-07-01T00:00:00Z" },
        })}
        caseCount={3}
        skillVersion={7}
      />,
    )
    expect(screen.getByText(/Published without a passing eval/i)).toBeTruthy()
    expect(screen.getByText(/force-publish recorded/i)).toBeTruthy()
  })

  it("(5) variant='strip' → one condensed line from the same PublishGate", () => {
    render(
      <LifecycleStepper
        publishGate={mkGate()}
        caseCount={3}
        skillVersion={7}
        variant="strip"
      />,
    )
    // The condensed state word + counts, derived from the SAME fields as the full view.
    expect(screen.getByText(/Ready to publish/i)).toBeTruthy()
    expect(screen.getByText(/3\/3 on v7/i)).toBeTruthy()
    // The strip is a condensation, not a second stepper — no per-stage message box.
    expect(screen.queryByText(/Publishing is unlocked/i)).toBeNull()
  })

  it("(6) reads server truth — met=false with favorable numbers still renders not-met", () => {
    // passed > measured (5 > 2): a naive client `passed >= measured` recompute would call
    // this "ready". The server says met=false / latest_failed, so the component MUST render
    // the not-met branch — proving there is no client-side gate arithmetic (T-137-01).
    render(
      <LifecycleStepper
        publishGate={mkGate({
          met: false,
          state: "latest_failed",
          measured: 2,
          passed: 5,
          passing_run_id: null,
        })}
        caseCount={2}
        skillVersion={7}
      />,
    )
    expect(screen.getByText(/The gate is holding/i)).toBeTruthy()
    expect(screen.queryByText(/Publish ready/i)).toBeNull()
    expect(screen.queryByText(/Publishing is unlocked/i)).toBeNull()
  })
})
