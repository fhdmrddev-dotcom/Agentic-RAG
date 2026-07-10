/**
 * Phase 137 Plan 05 Task 1 (PANEL-01 / D-11) — CaseEditor spec.
 *
 * Asserts the prompt-first test-case CRUD leaf straight from the mocked owner-scoped
 * endpoints (BUG-260701-02 close):
 *   (1) rows lead with the PROMPT (expected_behavior as the quiet second line);
 *   (2) the raw test_case_id uuid NEVER appears as a visible label;
 *   (3) add / edit / delete call the existing CRUD client fns (no migration);
 *   (4) onCasesChanged fires with the FULL TestCase[] on load AND after a mutation —
 *       the container's single source for the stepper count + the run-history map.
 *
 * `@/lib/api` is fully mocked. Authored fresh (MEMORY project_frontend_vitest_rot) —
 * not leaning on a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import type { TestCase } from "@/types"

const listTestCases = vi.fn()
const createTestCase = vi.fn()
const updateTestCase = vi.fn()
const deleteTestCase = vi.fn()

vi.mock("@/lib/api", () => ({
  listTestCases: (...a: unknown[]) => listTestCases(...(a as [string])),
  createTestCase: (...a: unknown[]) => createTestCase(...(a as [string, unknown])),
  updateTestCase: (...a: unknown[]) => updateTestCase(...(a as [string, unknown])),
  deleteTestCase: (...a: unknown[]) => deleteTestCase(...(a as [string])),
}))

import { CaseEditor } from "./CaseEditor"

function mkCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: "tc-11111111-2222-3333-4444-555555555555",
    skill_id: "skill-1",
    user_id: "user-1",
    prompt: "Summarize the quarterly report",
    expected_behavior: "returns a concise summary with figures",
    order_index: 0,
    name: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("CaseEditor — prompt-first test-case CRUD (137-05 Task 1)", () => {
  beforeEach(() => {
    listTestCases.mockReset().mockResolvedValue([])
    createTestCase.mockReset().mockResolvedValue(mkCase())
    updateTestCase.mockReset().mockResolvedValue(mkCase())
    deleteTestCase.mockReset().mockResolvedValue(undefined)
  })

  it("rows lead with the prompt; the test-case uuid is not shown as a label", async () => {
    const c = mkCase()
    listTestCases.mockResolvedValue([c])
    render(<CaseEditor skillId="skill-1" />)

    // Prompt leads the row.
    expect(await screen.findByText("Summarize the quarterly report")).toBeInTheDocument()
    // expected_behavior is the quiet second line.
    expect(screen.getByText("returns a concise summary with figures")).toBeInTheDocument()
    // The raw uuid never appears as a visible label (closes BUG-260701-02).
    expect(screen.queryByText(c.id)).toBeNull()
    expect(screen.queryByText(/tc-11111111/)).toBeNull()
  })

  it("fires onCasesChanged with the full TestCase[] on initial load", async () => {
    const c = mkCase()
    listTestCases.mockResolvedValue([c])
    const onCasesChanged = vi.fn()
    render(<CaseEditor skillId="skill-1" onCasesChanged={onCasesChanged} />)

    await waitFor(() => expect(onCasesChanged).toHaveBeenCalled())
    const arg = onCasesChanged.mock.calls.at(-1)![0] as TestCase[]
    expect(Array.isArray(arg)).toBe(true)
    expect(arg).toHaveLength(1)
    expect(arg[0].id).toBe(c.id)
  })

  it("Add calls createTestCase then re-fires onCasesChanged with the new list", async () => {
    const existing = mkCase()
    const added = mkCase({ id: "tc-new", prompt: "", expected_behavior: "" })
    listTestCases.mockResolvedValueOnce([existing]).mockResolvedValue([existing, added])
    const onCasesChanged = vi.fn()
    render(<CaseEditor skillId="skill-1" onCasesChanged={onCasesChanged} />)

    await screen.findByText("Summarize the quarterly report")
    fireEvent.click(screen.getByRole("button", { name: /add test case/i }))

    await waitFor(() =>
      expect(createTestCase).toHaveBeenCalledWith(
        "skill-1",
        expect.objectContaining({ prompt: "", expected_behavior: "", order_index: 1 }),
      ),
    )
    await waitFor(() => {
      const arg = onCasesChanged.mock.calls.at(-1)![0] as TestCase[]
      expect(arg).toHaveLength(2)
    })
  })

  it("Edit calls updateTestCase with the edited prompt/expected_behavior", async () => {
    const c = mkCase()
    listTestCases.mockResolvedValue([c])
    render(<CaseEditor skillId="skill-1" />)

    await screen.findByText("Summarize the quarterly report")
    fireEvent.click(screen.getByRole("button", { name: /edit test case/i }))
    const promptInput = screen.getByPlaceholderText(/^prompt$/i)
    fireEvent.change(promptInput, { target: { value: "New prompt" } })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() =>
      expect(updateTestCase).toHaveBeenCalledWith(
        c.id,
        expect.objectContaining({ prompt: "New prompt" }),
      ),
    )
  })

  it("Delete calls deleteTestCase for that case", async () => {
    const c = mkCase()
    listTestCases.mockResolvedValue([c])
    render(<CaseEditor skillId="skill-1" />)

    await screen.findByText("Summarize the quarterly report")
    fireEvent.click(screen.getByRole("button", { name: /delete test case/i }))

    await waitFor(() => expect(deleteTestCase).toHaveBeenCalledWith(c.id))
  })
})
