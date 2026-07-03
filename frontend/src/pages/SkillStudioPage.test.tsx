/**
 * Phase 137 Plan 06 Task 1 (PANEL-01) — SkillStudioPage shell spec + deriveLiveVersion.
 *
 * The shell is the D-01 focused full-surface: a persistent header (‹ Skills · name ·
 * v{N} · LIVE · condensed gate strip) + the three deep-linkable tabs (Evals landing ·
 * Triggering · Versions). This spec exercises the SHELL, so the three tab bodies are
 * stubbed — the leaves have their own specs (Plans 01/02/05). It also unit-tests the
 * shared `deriveLiveVersion` content-equality helper (W1 — one rule, one implementation,
 * consumed here AND by Plan 07's panel).
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import type { PublishGate, Skill, SkillVersion, TestCase } from "@/types"

// ── Stub the three tab bodies (we test the shell composition, not the leaves). ──
vi.mock("@/components/skills/studio/EvalsTab", () => ({
  EvalsTab: ({ skillId, skillVersion }: { skillId: string; skillVersion: number }) => (
    <div data-testid="evals-stub">
      evals · {skillId} · v{skillVersion}
    </div>
  ),
}))
vi.mock("@/components/skills/studio/VersionsTab", () => ({
  VersionsTab: ({ skillId, liveVersionNumber }: { skillId: string; liveVersionNumber: number }) => (
    <div data-testid="versions-stub">
      versions · {skillId} · v{liveVersionNumber}
    </div>
  ),
}))
vi.mock("@/components/skills/studio/TriggeringTab", () => ({
  TriggeringTab: ({ skillId }: { skillId: string }) => (
    <div data-testid="triggering-stub">triggering · {skillId}</div>
  ),
}))

// ── Mock the api surface consumed by the shell (+ the CRUD fns useSkills imports). ──
const listSkills = vi.fn()
const getPublishGate = vi.fn()
const listSkillVersions = vi.fn()
const listTestCases = vi.fn()

vi.mock("@/lib/api", () => ({
  listSkills: (...a: unknown[]) => listSkills(...(a as [])),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  toggleSkillEnabled: vi.fn(),
  toggleSkillGlobal: vi.fn(),
  getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
  listSkillVersions: (...a: unknown[]) => listSkillVersions(...(a as [string])),
  listTestCases: (...a: unknown[]) => listTestCases(...(a as [string])),
}))

import { SkillStudioPage, type StudioTab } from "./SkillStudioPage"
import { deriveLiveVersion } from "@/lib/skillVersion"

function mkSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    user_id: "u1",
    name: "Doc Summarizer",
    description: "desc",
    instructions: "INSTR-A",
    is_enabled: true,
    is_global: false,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function mkVersion(overrides: Partial<SkillVersion> = {}): SkillVersion {
  return {
    id: "ver-x",
    skill_id: "skill-1",
    user_id: "u1",
    version_number: 1,
    name: "Doc Summarizer",
    description: "desc",
    instructions: "INSTR-OLD",
    source: "manual",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function mkCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "tc-1",
    skill_id: "skill-1",
    user_id: "u1",
    prompt: "Summarize the doc",
    expected_behavior: "concise summary",
    order_index: 0,
    name: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: false,
    state: "never_evaled",
    measured: null,
    passed: null,
    passing_run_id: null,
    reason: "Run an eval on the current version.",
    last_override: null,
    ...overrides,
  }
}

// v3's instructions match the live skill (INSTR-A) → deriveLiveVersion resolves 3.
const VERSIONS: SkillVersion[] = [
  mkVersion({ id: "v3", version_number: 3, instructions: "INSTR-A", source: "self_improve" }),
  mkVersion({ id: "v2", version_number: 2, instructions: "INSTR-OLD-2" }),
  mkVersion({ id: "v1", version_number: 1, instructions: "INSTR-OLD-1", source: "backfill" }),
]

const onTabChange = vi.fn()
const onBack = vi.fn()

// Controlled harness: holds the tab so a tab click re-renders with the new body,
// while still asserting onTabChange fired (the deep-linkable contract).
function Harness({ initialTab = "evals" }: { initialTab?: StudioTab }) {
  const [tab, setTab] = useState<StudioTab>(initialTab)
  return (
    <SkillStudioPage
      skillId="skill-1"
      tab={tab}
      onTabChange={(t) => {
        onTabChange(t)
        setTab(t)
      }}
      onBack={onBack}
    />
  )
}

afterEach(() => cleanup())

describe("deriveLiveVersion — the shared content-equality rule (W1)", () => {
  it("matches the version whose instructions equal the live skill", () => {
    expect(deriveLiveVersion(mkSkill({ instructions: "INSTR-A" }), VERSIONS)).toBe(3)
  })
  it("falls back to the MAX version_number when no content matches", () => {
    expect(deriveLiveVersion(mkSkill({ instructions: "NO-MATCH" }), VERSIONS)).toBe(3)
  })
  it("returns 1 when there are no versions", () => {
    expect(deriveLiveVersion(mkSkill(), [])).toBe(1)
  })
})

describe("SkillStudioPage — shell, header, gate strip, tabs (137-06 Task 1)", () => {
  beforeEach(() => {
    onTabChange.mockReset()
    onBack.mockReset()
    listSkills.mockReset().mockResolvedValue([mkSkill()])
    getPublishGate.mockReset().mockResolvedValue(mkGate())
    listSkillVersions.mockReset().mockResolvedValue(VERSIONS)
    // Two cases → the strip's caseCount must read 2 (never a hardcoded 0).
    listTestCases.mockReset().mockResolvedValue([mkCase(), mkCase({ id: "tc-2" })])
  })

  it("landing tab is Evals", async () => {
    render(<Harness />)
    expect(await screen.findByTestId("evals-stub")).toBeInTheDocument()
    expect(screen.queryByTestId("triggering-stub")).toBeNull()
    expect(screen.queryByTestId("versions-stub")).toBeNull()
  })

  it("the header shows the skill name + the derived vN + a LIVE badge", async () => {
    render(<Harness />)
    expect(await screen.findByText("Doc Summarizer")).toBeInTheDocument()
    // v3 is derived ONCE at the shell via the shared helper (content-equality with v3).
    expect(await screen.findByText("v3")).toBeInTheDocument()
    expect(screen.getByText("LIVE")).toBeInTheDocument()
  })

  it("the header gate strip's caseCount is sourced from listTestCases length (never hardcoded 0)", async () => {
    render(<Harness />)
    // LifecycleStepper strip (never_evaled) renders "{caseCount} cases ready" = "2 cases ready".
    expect(await screen.findByText(/2 cases ready/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 cases ready/i)).toBeNull()
  })

  it("clicking Triggering calls onTabChange and renders the tuner stub", async () => {
    render(<Harness />)
    await screen.findByTestId("evals-stub")
    // The tabs carry role="tab" (proper tablist a11y), not the implicit button role.
    fireEvent.click(screen.getByRole("tab", { name: "Triggering" }))
    expect(onTabChange).toHaveBeenCalledWith("triggering")
    expect(await screen.findByTestId("triggering-stub")).toBeInTheDocument()
  })

  it("clicking Versions renders the versions stub", async () => {
    render(<Harness />)
    await screen.findByTestId("evals-stub")
    fireEvent.click(screen.getByRole("tab", { name: "Versions" }))
    expect(onTabChange).toHaveBeenCalledWith("versions")
    expect(await screen.findByTestId("versions-stub")).toBeInTheDocument()
  })

  it("a null skillId renders a calm guard with a back control that calls onBack", async () => {
    render(
      <SkillStudioPage skillId={null} tab="evals" onTabChange={onTabChange} onBack={onBack} />,
    )
    // No tab bodies mount without a target.
    expect(screen.queryByTestId("evals-stub")).toBeNull()
    const back = screen.getByRole("button", { name: /skills/i })
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalled()
  })

  it("the persistent header ‹ Skills back control calls onBack", async () => {
    render(<Harness />)
    await screen.findByText("Doc Summarizer")
    fireEvent.click(screen.getByRole("button", { name: /^skills$/i }))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })
})
