/**
 * Phase 136-04 Task 1 (GATE-01 / D-06) — the plain publish-gate status line +
 * owner-visible override record on the thin eval surface.
 *
 * Asserts the three renders that come straight from the SERVER gate (getPublishGate —
 * no client-side gate math, D-07):
 *   (a) met                 → the satisfied "X/N publish-ready" line;
 *   (b) unmet never_evaled  → the honest "Not publishable yet — run an eval" pointer;
 *   (c) last_override present → the owner-visible "Published without a passing eval"
 *                               override record (D-02).
 *
 * `@/lib/api` is fully mocked: getProviders/listEvalRuns/listProposals resolve empty +
 * subscribeToRun is a no-op, so the component mounts with getPublishGate as the unit
 * under test and no live backend. Authored fresh (MEMORY project_frontend_vitest_rot) —
 * not leaning on a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { PublishGate } from "@/types"

const getPublishGate = vi.fn()
const getProviders = vi.fn()
const listEvalRuns = vi.fn()
const listProposals = vi.fn()
const subscribeToRun = vi.fn()

vi.mock("@/lib/api", () => ({
  getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
  getProviders: (...a: unknown[]) => getProviders(...(a as [])),
  listEvalRuns: (...a: unknown[]) => listEvalRuns(...(a as [string])),
  listProposals: (...a: unknown[]) => listProposals(...(a as [string])),
  subscribeToRun: (...a: unknown[]) => subscribeToRun(...(a as [])),
}))

import { SkillEvalSection } from "./SkillEvalSection"

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: true,
    state: "passed",
    measured: 2,
    passed: 2,
    passing_run_id: "run-1",
    reason: "Eval passed 2/2 on the current version.",
    last_override: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("SkillEvalSection — publish-gate status line + override record (136-04)", () => {
  beforeEach(() => {
    getPublishGate.mockReset()
    getProviders.mockReset().mockResolvedValue({ providers: [], active: "", active_model: "" })
    listEvalRuns.mockReset().mockResolvedValue([])
    listProposals.mockReset().mockResolvedValue([])
    subscribeToRun.mockReset().mockResolvedValue(undefined)
  })

  it("(a) met → renders the satisfied X/N publish-ready line", async () => {
    getPublishGate.mockResolvedValue(mkGate({ met: true, state: "passed", measured: 2, passed: 2 }))

    render(<SkillEvalSection skillId="skill-1" />)

    // Server-computed satisfied status is rendered (refetch-not-optimistic, no client math).
    expect(await screen.findByText(/passed 2\/2/i)).toBeInTheDocument()
  })

  it("(b) unmet never_evaled → renders the 'Not publishable yet — run an eval' pointer line", async () => {
    getPublishGate.mockResolvedValue(
      mkGate({
        met: false,
        state: "never_evaled",
        measured: null,
        passed: null,
        passing_run_id: null,
        reason: "This skill has never had a completed eval.",
      }),
    )

    render(<SkillEvalSection skillId="skill-2" />)

    expect(
      await screen.findByText(/not publishable yet — run an eval/i),
    ).toBeInTheDocument()
  })

  it("(c) last_override present → renders the owner-visible 'Published without a passing eval' record", async () => {
    getPublishGate.mockResolvedValue(
      mkGate({
        met: false,
        state: "latest_failed",
        measured: 3,
        passed: 1,
        reason: "The latest eval on the current version failed.",
        last_override: { gate_state: "latest_failed", created_at: "2026-07-01T00:00:00Z" },
      }),
    )

    render(<SkillEvalSection skillId="skill-3" />)

    expect(
      await screen.findByText(/published without a passing eval/i),
    ).toBeInTheDocument()
  })
})
