/**
 * Tests for RunStepList.tsx (Phase 200.2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import rawSource from "./RunStepList.tsx?raw"
import { RunStepList } from "./RunStepList"
import type { WorkflowRunPhase, RunStepCitation } from "@/lib/api"
import * as api from "@/lib/api"
import {
  PROCESS_TRACE_LANDMARK,
  YIELD_WROTE_AN_ANSWER,
  EMPTY_TRACE_NO_STEPS,
} from "./runColumnVocabulary"
import { OUTCOME_FAILED } from "./receiptVocabulary"

vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...mod,
    getWorkflowRunPhaseCitations: vi.fn(),
  }
})

describe("RunStepList", () => {
  const mockGetCitations = vi.mocked(api.getWorkflowRunPhaseCitations)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleCitations: RunStepCitation[] = [
    {
      document_id: "doc-1",
      filename: "financial_report.pdf",
      chunk_index: 2,
      passage: "Q3 revenue grew by 18% with solid customer retention.",
    },
    {
      document_id: "doc-2",
      filename: "guidance.pdf",
      chunk_index: 0,
      passage: "Operating margin targets remain intact for next fiscal year.",
    },
  ]

  it("renders empty honest absence when phases is empty", () => {
    render(
      <RunStepList
        phases={[]}
        titleOf={(slug) => slug}
        runId="run-1"
      />
    )
    expect(screen.getByLabelText(PROCESS_TRACE_LANDMARK)).toHaveTextContent(EMPTY_TRACE_NO_STEPS)
  })

  it("renders step name and declared count yield (15 sources)", () => {
    const phase: WorkflowRunPhase = {
      slug: "search-docs",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 15,
      step_noun: "sources",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Search Documents"}
        runId="run-1"
      />
    )

    expect(screen.getByText("Search Documents")).toBeInTheDocument()
    expect(screen.getByTestId("step-yield-search-docs")).toHaveTextContent("15 sources")
  })

  it("renders 0 count yield as a real measurement (0 sources)", () => {
    const phase: WorkflowRunPhase = {
      slug: "search-empty",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 0,
      step_noun: "sources",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Search Documents"}
        runId="run-1"
      />
    )

    expect(screen.getByTestId("step-yield-search-empty")).toHaveTextContent("0 sources")
  })

  it("renders 'wrote an answer' when count is null and deliverable_text exists", () => {
    const phase: WorkflowRunPhase = {
      slug: "draft-response",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_single",
      deliverable_text: "Here is the drafted response text.",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Draft Response"}
        runId="run-1"
      />
    )

    expect(screen.getByTestId("step-yield-draft-response")).toHaveTextContent(YIELD_WROTE_AN_ANSWER)
  })

  it("slug-gate counter-test: wrote an answer renders regardless of slug name", () => {
    // Phase slug contains 'confirm' or 'emit' but phase_type is llm_single with text -> must render wrote an answer
    const phase: WorkflowRunPhase = {
      slug: "confirm_emit_check",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_single",
      deliverable_text: "Text output",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Confirm Check"}
        runId="run-1"
      />
    )

    expect(screen.getByTestId("step-yield-confirm_emit_check")).toHaveTextContent(YIELD_WROTE_AN_ANSWER)
  })

  it("renders standard outcome word when neither count nor text exists", () => {
    const phase: WorkflowRunPhase = {
      slug: "confirm-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_human_input",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Human Confirmation"}
        runId="run-1"
      />
    )

    // Ordinary completed steps with no count or text answer remain quiet in the log
    expect(screen.queryByTestId("step-yield-confirm-step")).toBeNull()
  })

  it("preserves outcome word on failed steps even if deliverable_text exists", () => {
    const phase: WorkflowRunPhase = {
      slug: "generate-step",
      phase_index: 0,
      status: "failed",
      phase_type: "llm_single",
      deliverable_text: "Partial text generated before failure",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Generation"}
        runId="run-1"
      />
    )

    expect(screen.getByTestId("step-yield-generate-step")).toHaveTextContent(OUTCOME_FAILED)
    expect(screen.queryByText(YIELD_WROTE_AN_ANSWER)).not.toBeInTheDocument()
  })

  it("prioritizes declared count over deliverable text when both exist", () => {
    const phase: WorkflowRunPhase = {
      slug: "hybrid-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 5,
      step_noun: "docs",
      deliverable_text: "Answer text",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Hybrid"}
        runId="run-1"
      />
    )

    expect(screen.getByTestId("step-yield-hybrid-step")).toHaveTextContent("5 docs")
    expect(screen.queryByText(YIELD_WROTE_AN_ANSWER)).not.toBeInTheDocument()
  })

  it("lazy fetches citations on click and expands card when citations exist", async () => {
    mockGetCitations.mockResolvedValueOnce(sampleCitations)

    const phase: WorkflowRunPhase = {
      slug: "gather-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 2,
      step_noun: "citations",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Gather"}
        runId="run-123"
      />
    )

    const stepCard = screen.getByTestId("step-card-gather-step")
    fireEvent.click(stepCard.firstElementChild!)

    await waitFor(() => {
      expect(mockGetCitations).toHaveBeenCalledWith("run-123", "gather-step")
      expect(screen.getByTestId("step-citations-gather-step")).toBeInTheDocument()
    })

    expect(screen.getByText("financial_report.pdf")).toBeInTheDocument()
    expect(screen.getByText(/Q3 revenue grew by 18%/)).toBeInTheDocument()
    expect(screen.getByText("guidance.pdf")).toBeInTheDocument()

    // Collapse on second click
    fireEvent.click(screen.getByRole("button", { name: /Hide retrieved citations/i }))
    expect(screen.queryByTestId("step-citations-gather-step")).not.toBeInTheDocument()
  })

  it("degrades gracefully to plain text without chevron when citations fetch returns empty", async () => {
    mockGetCitations.mockResolvedValueOnce([])

    const phase: WorkflowRunPhase = {
      slug: "no-citations-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 0,
      step_noun: "citations",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "No Citations"}
        runId="run-123"
      />
    )

    const stepCard = screen.getByTestId("step-card-no-citations-step")
    fireEvent.click(stepCard.firstElementChild!)

    await waitFor(() => {
      expect(mockGetCitations).toHaveBeenCalledTimes(1)
    })

    // No expandable citations container
    expect(screen.queryByTestId("step-citations-no-citations-step")).not.toBeInTheDocument()
    expect(screen.queryByText("▾")).not.toBeInTheDocument()
  })

  it("degrades gracefully without throwing when citations fetch rejects", async () => {
    mockGetCitations.mockRejectedValueOnce(new Error("Network Error"))

    const phase: WorkflowRunPhase = {
      slug: "error-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 1,
      step_noun: "source",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Error Step"}
        runId="run-123"
      />
    )

    const stepCard = screen.getByTestId("step-card-error-step")
    fireEvent.click(stepCard.firstElementChild!)

    await waitFor(() => {
      expect(mockGetCitations).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByTestId("step-citations-error-step")).not.toBeInTheDocument()
  })

  it("never renders similarity scores in expanded citation cards (D-10 / R-2)", async () => {
    mockGetCitations.mockResolvedValueOnce(sampleCitations)

    const phase: WorkflowRunPhase = {
      slug: "search-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 2,
      step_noun: "results",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Search Step"}
        runId="run-123"
      />
    )

    fireEvent.click(screen.getByTestId("step-card-search-step").firstElementChild!)

    await waitFor(() => {
      expect(screen.getByTestId("step-citations-search-step")).toBeInTheDocument()
    })

    const text = screen.getByTestId("step-citations-search-step").textContent || ""
    expect(text).not.toContain("0.9")
    expect(text).not.toContain("% match")
    expect(text).not.toContain("similarity")
  })

  it("does not render totals in the expanded passages region (D-11 / A-06)", async () => {
    mockGetCitations.mockResolvedValueOnce(sampleCitations)

    const phase: WorkflowRunPhase = {
      slug: "search-step",
      phase_index: 0,
      status: "completed",
      phase_type: "llm_agent",
      step_count: 2,
      step_noun: "results",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Search Step"}
        runId="run-123"
      />
    )

    fireEvent.click(screen.getByTestId("step-card-search-step").firstElementChild!)

    await waitFor(() => {
      expect(screen.getByTestId("step-citations-search-step")).toBeInTheDocument()
    })

    const text = screen.getByTestId("step-citations-search-step").textContent || ""
    expect(text).not.toContain("2 of 2")
    expect(text).not.toContain("2 total")
  })

  it("does not render run-level aggregate sum of step counts (A-09)", () => {
    const phases: WorkflowRunPhase[] = [
      { slug: "step-1", phase_index: 0, status: "completed", phase_type: "llm_agent", step_count: 10, step_noun: "docs" },
      { slug: "step-2", phase_index: 1, status: "completed", phase_type: "llm_agent", step_count: 5, step_noun: "docs" },
    ]

    const { container } = render(
      <RunStepList
        phases={phases}
        titleOf={(slug) => slug}
        runId="run-123"
      />
    )

    expect(container.textContent).not.toContain("15 docs")
    expect(container.textContent).not.toContain("15 total")
  })

  it("adheres to tense rule: uses liveOf reading when provided", () => {
    const phase: WorkflowRunPhase = {
      slug: "running-step",
      phase_index: 0,
      status: "active",
      phase_type: "llm_agent",
    }

    render(
      <RunStepList
        phases={[phase]}
        titleOf={() => "Active Search"}
        runId="run-123"
        liveOf={() => ({ reading: "running", label: "Searching web" })}
      />
    )

    expect(screen.getByText("Active Search")).toBeInTheDocument()
    // Glyph for running is ●
    expect(screen.getByText("●")).toBeInTheDocument()
  })

  // ── Source Sweeps ─────────────────────────────────────────────────────────

  it("source sweep: zero lucide imports in RunStepList.tsx", () => {
    expect(rawSource).not.toContain('from "lucide-react"')
    expect(rawSource).not.toContain("from 'lucide-react'")
  })

  it("source sweep: zero raw HTML injection in RunStepList.tsx", () => {
    expect(rawSource).not.toContain("dangerouslySetInnerHTML")
  })
})
