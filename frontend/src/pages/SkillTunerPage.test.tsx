/**
 * Phase 123 Plan 05 Task 2b (TRIG-01) — SkillTunerPage + CaseEditor + LiveRunCard tests.
 *
 * Composes the Task-2a scoreboard/candidates into the focused full-surface and locks
 * the 043-A live-run + case-editor honesty contract:
 *
 *  - Page-level author-confirm (T-123-05-02): a composed CandidateCard shows its
 *    held-out score; "Use" reveals an explicit diff-confirm strip (old vs new);
 *    confirming calls updateSkill (PATCH /skills) — nothing auto-applies.
 *  - LiveRunCard (T-123-05-03): a per-provider lane; a QUEUED provider shows queued,
 *    NOT a fake 0%/running percent; the elapsed timer is present and derives from a
 *    stable start-ts (does not reset on a transient stream-end).
 *  - CaseEditor (043-A): two columns (should-fire / should-NOT) with provenance tags
 *    and the 60/40 split bar; the should-NOT column reads as the false-fire rail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Skill } from "@/types"
import type { TunerScoreboard } from "@/lib/api"

// ── api.ts mock — useSkills() reads listSkills + writes updateSkill; the page also
//    calls startTunerRun / streamTunerRun / getTunerResults. ──
const listSkills = vi.fn()
const updateSkill = vi.fn()
const startTunerRun = vi.fn()
const streamTunerRun = vi.fn()
const getTunerResults = vi.fn()

vi.mock("@/lib/api", () => {
  class FakeApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    listSkills: (...a: unknown[]) => listSkills(...a),
    createSkill: vi.fn(),
    updateSkill: (...a: unknown[]) => updateSkill(...a),
    deleteSkill: vi.fn(),
    toggleSkillEnabled: vi.fn(),
    toggleSkillGlobal: vi.fn(),
    startTunerRun: (...a: unknown[]) => startTunerRun(...a),
    streamTunerRun: (...a: unknown[]) => streamTunerRun(...a),
    getTunerResults: (...a: unknown[]) => getTunerResults(...a),
    ApiError: FakeApiError,
  }
})

import { SkillTunerPage } from "./SkillTunerPage"
import { CaseEditor, type EditorCase } from "@/components/skills/tuner/CaseEditor"
import { LiveRunCard, type ProviderLane } from "@/components/skills/tuner/LiveRunCard"

const SKILL: Skill = {
  id: "skill-1",
  user_id: "user-1",
  name: "SQL Writer",
  description: "Fires on SQL.",
  instructions: "Write SQL.",
  is_enabled: true,
  is_global: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const SCOREBOARD: TunerScoreboard = {
  skill_id: "skill-1",
  candidates: [
    {
      index: 0,
      description: "Fires on SQL.",
      cells: [{ provider: "openai", model: "gpt-5.4-mini", axes: { fires: 0.7, no_false: 0.6 }, score: 0.65 }],
      held_out_score: 0.65,
      is_baseline: true,
    },
    {
      index: 1,
      description: "Use this skill when the user asks to write or fix SQL queries.",
      cells: [{ provider: "openai", model: "gpt-5.4-mini", axes: { fires: 0.95, no_false: 0.9 }, score: 0.925 }],
      held_out_score: 0.925,
      is_baseline: false,
    },
  ],
  winner_index: 1,
  winner_description: "Use this skill when the user asks to write or fix SQL queries.",
}

beforeEach(() => {
  vi.clearAllMocks()
  listSkills.mockResolvedValue([SKILL])
  updateSkill.mockResolvedValue({ ...SKILL })
  startTunerRun.mockResolvedValue({
    run_id: "run-1",
    skill_id: "skill-1",
    targets: [{ provider: "openai", model: "gpt-5.4-mini" }],
    case_count: 0,
    n: 3,
  })
  getTunerResults.mockResolvedValue(SCOREBOARD)
  // Stream helper drives the scoreboard in via onComplete then a done terminal.
  streamTunerRun.mockImplementation(async (_skillId, _runId, callbacks) => {
    callbacks.onComplete?.(SCOREBOARD)
    callbacks.onTerminal("done")
  })
})

describe("SkillTunerPage — page-level author-confirm, no auto-apply (T-123-05-02)", () => {
  it("running the benchmark renders candidate cards with held-out scores; Use → diff → confirm calls updateSkill", async () => {
    const user = userEvent.setup()
    render(<SkillTunerPage skillId="skill-1" onBack={vi.fn()} />)

    // The skill loads (current description visible).
    await screen.findByText(/current · live · drives firing/i)

    await user.click(screen.getByRole("button", { name: /run tuning/i }))

    // Candidate cards land (composed CandidateCard from Task 2a).
    const cards = await screen.findAllByTestId("candidate-card")
    expect(cards.length).toBeGreaterThanOrEqual(2)
    // Held-out score visible on the winning candidate.
    expect(screen.getByTestId("tuner-candidates").textContent).toMatch(/0\.92|0\.93/)

    // Nothing auto-applied on completion.
    expect(updateSkill).not.toHaveBeenCalled()

    // Winner card is first (sorted by held-out). Use → diff → confirm.
    const winnerCard = cards[0]
    await user.click(within(winnerCard).getByRole("button", { name: /^use$/i }))
    const strip = within(winnerCard).getByTestId("candidate-diff-confirm")
    expect(strip.textContent).toContain("Fires on SQL.")
    expect(updateSkill).not.toHaveBeenCalled()

    await user.click(within(strip).getByRole("button", { name: /confirm|save/i }))
    await waitFor(() => expect(updateSkill).toHaveBeenCalledTimes(1))
    expect(updateSkill).toHaveBeenCalledWith("skill-1", {
      description: "Use this skill when the user asks to write or fix SQL queries.",
    })
  })
})

describe("SkillTunerPage — a transient SSE timeout is NOT a run failure (reconnect/reconcile)", () => {
  it("a redis_timeout terminal reconciles to the finished scoreboard, never a hard failure", async () => {
    const user = userEvent.setup()
    // The SSE socket times out, but the bounded job already finished server-side.
    streamTunerRun.mockImplementation(async (_s: unknown, _r: unknown, callbacks: any) => {
      callbacks.onTerminal("error", "redis_timeout")
    })
    getTunerResults.mockResolvedValue(SCOREBOARD) // authoritative results ARE ready
    render(<SkillTunerPage skillId="skill-1" onBack={vi.fn()} />)
    await screen.findByText(/current · live · drives firing/i)
    await user.click(screen.getByRole("button", { name: /run tuning/i }))

    // Reconciled to done — candidates render and NO failure copy appears.
    const cards = await screen.findAllByTestId("candidate-card")
    expect(cards.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/the tuning run failed/i)).toBeNull()
    expect(screen.queryByText(/lost the live connection/i)).toBeNull()
  })

  it("a redis_timeout while still running reconnects the stream instead of failing", async () => {
    const user = userEvent.setup()
    let call = 0
    streamTunerRun.mockImplementation(async (_s: unknown, _r: unknown, callbacks: any) => {
      call += 1
      if (call === 1) callbacks.onTerminal("error", "consumer_timeout")
      else {
        callbacks.onComplete?.(SCOREBOARD)
        callbacks.onTerminal("done")
      }
    })
    // First reconcile: still running (404 → reject) → reconnect; final reconcile: ready.
    getTunerResults.mockRejectedValueOnce(new Error("not ready")).mockResolvedValue(SCOREBOARD)

    render(<SkillTunerPage skillId="skill-1" onBack={vi.fn()} />)
    await screen.findByText(/current · live · drives firing/i)
    await user.click(screen.getByRole("button", { name: /run tuning/i }))

    // The stream was reconnected (called a second time) and ended in success.
    await waitFor(() => expect(streamTunerRun).toHaveBeenCalledTimes(2))
    await screen.findAllByTestId("candidate-card")
    expect(screen.queryByText(/the tuning run failed/i)).toBeNull()
  })
})

describe("LiveRunCard — queued ≠ running, stable never-vanishing timer (T-123-05-03)", () => {
  const lanes: ProviderLane[] = [
    { provider: "openai", model: "gpt-5.4-mini", status: "running" },
    { provider: "anthropic", model: "claude-haiku-4-5", status: "queued" },
    { provider: "google", model: "gemini-3.5-flash", status: "done", score: 0.8 },
  ]

  it("a queued provider shows a queued state, NOT a fake percent", () => {
    render(
      <LiveRunCard lanes={lanes} startTs={Date.now() - 3000} phase="running" error={null} onCancel={vi.fn()} />,
    )
    const queuedLane = screen.getByTestId("lane-anthropic")
    expect(queuedLane.textContent?.toLowerCase()).toContain("queued")
    // No fabricated percent on a queued lane (queued ≠ running).
    expect(queuedLane.textContent).not.toMatch(/\d+%/)
    expect(queuedLane.textContent).not.toMatch(/0\s*%/)
  })

  it("the elapsed timer is present and derives from the stable start-ts (≈3s, not a reset 0)", () => {
    render(
      <LiveRunCard lanes={lanes} startTs={Date.now() - 3000} phase="running" error={null} onCancel={vi.fn()} />,
    )
    const timer = screen.getByTestId("live-run-timer")
    const match = timer.textContent?.match(/([\d.]+)\s*s/)
    expect(match).not.toBeNull()
    const seconds = parseFloat(match![1])
    // Derived from start-ts ~3s ago — a real elapsed value, never a reset 0.
    expect(seconds).toBeGreaterThanOrEqual(2)
    expect(seconds).toBeLessThan(10)
  })

  it("states the run reconciles on return (you can leave)", () => {
    render(
      <LiveRunCard lanes={lanes} startTs={Date.now()} phase="running" error={null} onCancel={vi.fn()} />,
    )
    expect(screen.getByTestId("live-run-card").textContent?.toLowerCase()).toMatch(/reconcile|background|leave/)
  })
})

describe("CaseEditor — two columns, provenance tags, 60/40 split bar (043-A)", () => {
  const cases: EditorCase[] = [
    { id: "c1", prompt: "Write a SQL query for me", should_fire: true, provenance: "seeded" },
    { id: "c2", prompt: "Fix this JOIN", should_fire: true, provenance: "you" },
    { id: "c3", prompt: "Summarize this PDF", should_fire: false, provenance: "sibling" },
    { id: "c4", prompt: "What's the weather?", should_fire: false, provenance: "seeded" },
  ]

  it("renders two columns — should-fire and should-NOT (the false-fire rail)", () => {
    render(<CaseEditor cases={cases} onChange={vi.fn()} skill={SKILL} />)
    const fireCol = screen.getByTestId("case-col-should-fire")
    const noCol = screen.getByTestId("case-col-should-not")
    // should-fire column carries the fire cases.
    expect(within(fireCol).getByText(/Write a SQL query for me/)).toBeTruthy()
    expect(within(fireCol).getByText(/Fix this JOIN/)).toBeTruthy()
    // should-NOT column = the false-fire rail.
    expect(within(noCol).getByText(/Summarize this PDF/)).toBeTruthy()
    expect(noCol.textContent?.toLowerCase()).toMatch(/false-fire|should not|should-not/)
  })

  it("shows per-row provenance tags (seeded / sibling / you)", () => {
    render(<CaseEditor cases={cases} onChange={vi.fn()} skill={SKILL} />)
    const editor = screen.getByTestId("case-editor")
    expect(editor.textContent?.toLowerCase()).toContain("seeded")
    expect(editor.textContent?.toLowerCase()).toContain("sibling")
    expect(editor.textContent?.toLowerCase()).toContain("you")
  })

  it("renders the 60/40 train/held-out split bar", () => {
    render(<CaseEditor cases={cases} onChange={vi.fn()} skill={SKILL} />)
    const split = screen.getByTestId("split-bar")
    expect(split.textContent?.toLowerCase()).toMatch(/held-out|held out|40/)
    expect(split.textContent?.toLowerCase()).toMatch(/train|60/)
  })
})
