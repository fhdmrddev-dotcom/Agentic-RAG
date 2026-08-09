/**
 * Phase 137 Plan 02 Task 2 (PANEL-01 / VER-01 / D-05) — VersionsTab spec.
 *
 * Asserts the 056-B contract straight from the mocked owner-scoped endpoints:
 *   (1) one table row per version + the correct provenance chip word for each of
 *       the FIVE real SkillVersion.source values (Pitfall 1 — no override branch);
 *   (2) the live version row carries a LIVE badge;
 *   (3) a version with a matching eval run shows its passed/measured rollup;
 *       a version with no run shows "never evaled" (client-side join, Pitfall 2);
 *   (4) a force-promoted version (proposal.override_forced) shows its un-softened
 *       failed-gate evidence;
 *   (5) the any-to-any compare picker renders ONE unified diff (add + remove rows);
 *   (6) NO Restore / revert control exists (versions immutable — VER-01 / D-05).
 *
 * `@/lib/api` is fully mocked (listSkillVersions / listEvalRuns / listProposals);
 * `lineDiff` is the REAL util so the compare diff is exercised end-to-end. Authored
 * fresh (MEMORY project_frontend_vitest_rot) — not leaning on a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import type { SkillVersion, EvalRun, SkillProposal, PromotionGate } from "@/types"

const listSkillVersions = vi.fn()
const listEvalRuns = vi.fn()
const listProposals = vi.fn()

vi.mock("@/lib/api", () => ({
  listSkillVersions: (...a: unknown[]) => listSkillVersions(...(a as [string])),
  listEvalRuns: (...a: unknown[]) => listEvalRuns(...(a as [string])),
  listProposals: (...a: unknown[]) => listProposals(...(a as [string])),
}))

import { VersionsTab } from "./VersionsTab"

function mkVersion(overrides: Partial<SkillVersion> = {}): SkillVersion {
  return {
    id: "ver-x",
    skill_id: "skill-1",
    user_id: "user-1",
    version_number: 1,
    name: "Skill",
    description: "",
    instructions: "shared top\none body\nshared bottom",
    source: "manual",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function mkRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: "run-x",
    skill_id: "skill-1",
    skill_version_id: "ver-x",
    user_id: "user-1",
    provider: "anthropic",
    model: "claude-haiku",
    status: "completed",
    case_count: 3,
    error: null,
    created_at: "2026-07-02T00:00:00Z",
    completed_at: "2026-07-02T00:01:00Z",
    passed_count: 2,
    measured_count: 3,
    verdict_summary: null,
    matrix_group_id: null,
    feeds_gate: false,
    ...overrides,
  }
}

function mkGate(overrides: Partial<PromotionGate> = {}): PromotionGate {
  return {
    passed: false,
    no_regression: false,
    improved: false,
    prev_pass: 2,
    prev_fail: 0,
    still_pass: 1,
    newly_pass: 0,
    excluded_not_measured: 0,
    ...overrides,
  }
}

function mkProposal(overrides: Partial<SkillProposal> = {}): SkillProposal {
  return {
    id: "prop-x",
    skill_id: "skill-1",
    kind: "instruction",
    proposed_description: null,
    base_description: null,
    source_tuner_run_id: null,
    scoreboard_snapshot: null,
    base_skill_version_id: "ver-4",
    new_skill_version_id: "ver-5",
    re_eval_run_id: "run-r",
    source_eval_run_id: "run-s",
    proposed_instructions: "shared top\nfive body\nshared bottom",
    base_instructions: "shared top\nfour body\nshared bottom",
    rationale: "",
    evidence_summary: "",
    status: "promoted",
    override_forced: true,
    gate: mkGate(),
    created_at: "2026-07-02T00:00:00Z",
    updated_at: "2026-07-02T00:02:00Z",
    ...overrides,
  }
}

// Five versions newest-first (version_number DESC), one per real source value.
const VERSIONS: SkillVersion[] = [
  mkVersion({ id: "ver-5", version_number: 5, source: "self_improve", instructions: "shared top\nfive body\nshared bottom" }),
  mkVersion({ id: "ver-4", version_number: 4, source: "manual", instructions: "shared top\nfour body\nshared bottom" }),
  mkVersion({ id: "ver-3", version_number: 3, source: "import", instructions: "shared top\nthree body\nshared bottom" }),
  mkVersion({ id: "ver-2", version_number: 2, source: "tuner", instructions: "shared top\ntwo body\nshared bottom" }),
  mkVersion({ id: "ver-1", version_number: 1, source: "backfill", instructions: "shared top\none body\nshared bottom" }),
]

afterEach(() => cleanup())

describe("VersionsTab — 056-B table + compare + provenance joins (137-02)", () => {
  beforeEach(() => {
    listSkillVersions.mockReset().mockResolvedValue(VERSIONS)
    // A run only on ver-4 → its rollup renders; ver-3 stays "never evaled".
    listEvalRuns.mockReset().mockResolvedValue([mkRun({ id: "run-4", skill_version_id: "ver-4" })])
    // A force-promoted proposal binding to ver-5.
    listProposals.mockReset().mockResolvedValue([mkProposal()])
  })

  it("(1) renders a row per version with the correct provenance chip for each of the five sources", async () => {
    render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)

    // self_improve → proposal-promoted (the mapping case).
    expect(await screen.findByText("proposal-promoted")).toBeInTheDocument()
    expect(screen.getByText("hand-edited")).toBeInTheDocument() // manual
    expect(screen.getByText("imported")).toBeInTheDocument() // import
    expect(screen.getByText("tuner-promoted")).toBeInTheDocument() // tuner
    expect(screen.getByText("original")).toBeInTheDocument() // backfill

    // One <tr> per version in the body.
    const rows = document.querySelectorAll("tbody tr")
    expect(rows.length).toBe(5)
  })

  it("(2) the live version row shows a LIVE badge", async () => {
    render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)
    expect(await screen.findByText("LIVE")).toBeInTheDocument()
  })

  it("(3) a matching run shows the passed/measured rollup; a run-less version shows 'never evaled'", async () => {
    render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)
    // ver-4 has a 2/3 run.
    expect(await screen.findByText(/2\/3 passed · claude-haiku/)).toBeInTheDocument()
    // ver-3 (and others) have no run → the honest "never evaled" binding.
    expect(screen.getAllByText("never evaled").length).toBeGreaterThan(0)
  })

  it("(4) a force-promoted version shows its un-softened failed-gate evidence", async () => {
    render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)
    expect(await screen.findByText(/Force-promoted/i)).toBeInTheDocument()
    // The failed gate's un-softened "no regression: NO" counter is present.
    expect(screen.getByText("no regression")).toBeInTheDocument()
    expect(screen.getByText("NO")).toBeInTheDocument()
  })

  it("(5) selecting two versions in the compare picker renders one unified diff (add + remove rows)", async () => {
    const { container } = render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)
    await screen.findByText("proposal-promoted")

    // Explicitly compare v2 ↔ v5 (any-to-any, not adjacent-only).
    fireEvent.change(screen.getByLabelText("Compare from version"), { target: { value: "ver-2" } })
    fireEvent.change(screen.getByLabelText("Compare to version"), { target: { value: "ver-5" } })

    const addRows = container.querySelectorAll('[data-diff-type="add"]')
    const removeRows = container.querySelectorAll('[data-diff-type="remove"]')
    expect(addRows.length).toBeGreaterThan(0)
    expect(removeRows.length).toBeGreaterThan(0)
    // The added line is v5's body; the removed line is v2's body.
    expect(container.textContent).toContain("five body")
    expect(container.textContent).toContain("two body")
  })

  it("(6) exposes NO Restore / revert control (versions immutable — VER-01 / D-05)", async () => {
    render(<VersionsTab skillId="skill-1" liveVersionNumber={5} />)
    await screen.findByText("proposal-promoted")
    expect(screen.queryByText(/restore/i)).toBeNull()
    expect(screen.queryByText(/revert/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /restore|revert/i })).toBeNull()
  })

  // 176-02 (RENDER-04 / BUG-260706-01): the Studio shell bumps refreshNonce after a
  // version is promoted; VersionsTab must include it in its fetch-effect deps so its OWN
  // versions/runs/proposals self-fetch re-runs and the newly-promoted version appears —
  // with no reload. A skillId change must still refetch (existing behavior preserved).
  it("(7) a refreshNonce bump re-invokes listSkillVersions and updates the rows; a skillId change still refetches", async () => {
    const VERSIONS_BUMPED: SkillVersion[] = [
      mkVersion({
        id: "ver-6",
        version_number: 6,
        source: "self_improve",
        instructions: "shared top\nsix body\nshared bottom",
      }),
      ...VERSIONS,
    ]
    listSkillVersions
      .mockReset()
      .mockResolvedValueOnce(VERSIONS) // initial mount → 5 rows
      .mockResolvedValue(VERSIONS_BUMPED) // after the nonce bump → 6 rows

    const { rerender } = render(
      <VersionsTab skillId="skill-1" liveVersionNumber={5} refreshNonce={0} />,
    )

    // Initial mount → 5 rows, exactly one listSkillVersions call.
    expect(await screen.findByText("proposal-promoted")).toBeInTheDocument()
    expect(document.querySelectorAll("tbody tr").length).toBe(5)
    expect(listSkillVersions).toHaveBeenCalledTimes(1)

    // Bump ONLY the nonce (same skillId) → the self-fetch effect must re-run.
    rerender(<VersionsTab skillId="skill-1" liveVersionNumber={5} refreshNonce={1} />)
    await waitFor(() => expect(listSkillVersions).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(6))

    // A skillId change still refetches (deps also include skillId — existing behavior).
    rerender(<VersionsTab skillId="skill-2" liveVersionNumber={5} refreshNonce={1} />)
    await waitFor(() => expect(listSkillVersions).toHaveBeenCalledTimes(3))
    expect(listSkillVersions).toHaveBeenLastCalledWith("skill-2")
  })
})
