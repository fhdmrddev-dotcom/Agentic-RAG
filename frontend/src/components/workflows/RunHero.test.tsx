/**
 * Tests for RunHero.tsx (Phase 200.2).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import rawSource from "./RunHero.tsx?raw"
import { RunHero } from "./RunHero"
import type { WorkspaceFile } from "@/types"
import type { WorkflowRunRead } from "@/lib/api"
import {
  HERO_EMPTY_CANCELLED,
  HERO_EMPTY_COMPLETED,
  HERO_EMPTY_UNKNOWN,
  HERO_HEADING_ANSWER,
  HERO_HEADING_BOTH,
  HERO_HEADING_FILE,
  HERO_HEADING_FILES,
  HERO_LANDMARK,
  heroEmptyFailedStep,
} from "./runColumnVocabulary"
import { HEADER_SPAN_NOT_RECORDED } from "./receiptVocabulary"

describe("RunHero", () => {
  const dummyRun: WorkflowRunRead = {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Test Workflow",
    workflow_slug: "test-workflow",
    workflow_version: 1,
    status: "completed",
    created_at: "2026-08-20T10:00:00Z",
    claimed_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:01:15Z",
    definition: null,
    phases: [
      {
        slug: "gather",
        phase_index: 0,
        status: "completed",
        phase_type: "llm_agent",
        started_at: "2026-08-20T10:00:00Z",
        completed_at: "2026-08-20T10:01:15Z",
      },
    ],
  }

  const sampleFile: WorkspaceFile = {
    id: "file-1",
    path: "/output/Quarterly-Report.docx",
    size_bytes: 45200,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    created_at: "2026-08-20T10:01:15Z",
    updated_at: "2026-08-20T10:01:15Z",
  }

  const sampleFile2: WorkspaceFile = {
    id: "file-2",
    path: "/output/RawData.csv",
    size_bytes: 12400,
    mime_type: "text/csv",
    created_at: "2026-08-20T10:01:10Z",
    updated_at: "2026-08-20T10:01:10Z",
  }

  it("D-03: returns null while run is live (isTerminal = false)", () => {
    const { container } = render(
      <RunHero
        run={{ ...dummyRun, status: "active" }}
        answer="Some live answer"
        files={[sampleFile]}
        filesLoading={false}
        isTerminal={false}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("returns null while filesLoading is true", () => {
    const { container } = render(
      <RunHero
        run={dummyRun}
        answer="Finished answer"
        files={[]}
        filesLoading={true}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("Arm 1 (Single File): renders single file heading and newest file in hero slot", () => {
    render(
      <RunHero
        run={dummyRun}
        answer={null}
        files={[sampleFile]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(HERO_HEADING_FILE)
    expect(screen.getByText("Quarterly-Report.docx")).toBeInTheDocument()
    expect(screen.getByText(/Ran 1m 15s/)).toBeInTheDocument()
  })

  it("Arm 1 (Multiple Files, D-15): newest file is in hero slot, remainder in list", () => {
    render(
      <RunHero
        run={dummyRun}
        answer={null}
        files={[sampleFile, sampleFile2]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(HERO_HEADING_FILES)
    expect(screen.getByText("Quarterly-Report.docx")).toBeInTheDocument()
    expect(screen.getByText("RawData.csv")).toBeInTheDocument()
  })

  it("Arm 2 (Answer Only): renders answer heading and markdown body", () => {
    render(
      <RunHero
        run={dummyRun}
        answer={"### Key Findings\n\nRevenue grew **14%** in Q3."}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(HERO_HEADING_ANSWER)
    expect(screen.getByText("Key Findings")).toBeInTheDocument()
    expect(screen.getByText(/Revenue grew/)).toBeInTheDocument()
  })

  it("Arm 3 (Both File and Answer): renders 'Deliverables' heading with file and answer", () => {
    render(
      <RunHero
        run={dummyRun}
        answer="Executive synthesis of the report."
        files={[sampleFile]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(HERO_HEADING_BOTH)
    expect(screen.getByText("Quarterly-Report.docx")).toBeInTheDocument()
    expect(screen.getByText("Executive synthesis of the report.")).toBeInTheDocument()
  })

  it("Four-Arm Distinct Set Assertion: each arm renders unique textContent", () => {
    const { container: c1 } = render(
      <RunHero run={dummyRun} answer={null} files={[sampleFile]} filesLoading={false} isTerminal={true} failedStepTitle={null} onDownload={vi.fn()} titleOf={(s) => s} />
    )
    const t1 = c1.textContent

    const { container: c2 } = render(
      <RunHero run={dummyRun} answer="An answer body" files={[]} filesLoading={false} isTerminal={true} failedStepTitle={null} onDownload={vi.fn()} titleOf={(s) => s} />
    )
    const t2 = c2.textContent

    const { container: c3 } = render(
      <RunHero run={dummyRun} answer="An answer body" files={[sampleFile]} filesLoading={false} isTerminal={true} failedStepTitle={null} onDownload={vi.fn()} titleOf={(s) => s} />
    )
    const t3 = c3.textContent

    const { container: c4 } = render(
      <RunHero run={dummyRun} answer={null} files={[]} filesLoading={false} isTerminal={true} failedStepTitle={null} onDownload={vi.fn()} titleOf={(s) => s} />
    )
    const t4 = c4.textContent

    const textSet = new Set([t1, t2, t3, t4])
    expect(textSet.size).toBe(4)
  })

  // ── D-16 Totality Suite ───────────────────────────────────────────────────

  it("D-16 Totality: completed run without deliverable", () => {
    render(
      <RunHero
        run={{ ...dummyRun, status: "completed" }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(HERO_EMPTY_COMPLETED)).toBeInTheDocument()
  })

  it("D-16 Totality: failed run with failedStepTitle", () => {
    render(
      <RunHero
        run={{ ...dummyRun, status: "failed" }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle="Data Ingestion"
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(heroEmptyFailedStep("Data Ingestion"))).toBeInTheDocument()
  })

  it("D-16 Totality: failed run without failedStepTitle resolves first failed phase title", () => {
    const failedRun: WorkflowRunRead = {
      ...dummyRun,
      status: "failed",
      phases: [
        { slug: "scrape-web", phase_index: 0, status: "failed", phase_type: "llm_agent" },
      ],
    }

    render(
      <RunHero
        run={failedRun}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={() => "Web Scraping"}
      />
    )
    expect(screen.getByText(heroEmptyFailedStep("Web Scraping"))).toBeInTheDocument()
  })

  it("D-16 Totality: cancelled run renders cancelled sentence (never finished)", () => {
    render(
      <RunHero
        run={{ ...dummyRun, status: "cancelled" }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(HERO_EMPTY_CANCELLED)).toBeInTheDocument()
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/finished/i)).not.toBeInTheDocument()
  })

  it("renders honest token budget exceeded sentence when circuit breaker tripped on tokens", () => {
    render(
      <RunHero
        run={{
          ...dummyRun,
          status: "cancelled",
          metadata: {
            circuit_breaker: {
              reason: "token_budget_exceeded",
              cumulative_tokens: 502100,
              max_tokens: 500000,
            },
          },
        }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(/Stopped: Token budget exceeded/)).toBeInTheDocument()
    expect(screen.getByText(/502,100 of 500,000 tokens/)).toBeInTheDocument()
  })

  it("renders honest duration limit exceeded sentence when circuit breaker tripped on duration", () => {
    render(
      <RunHero
        run={{
          ...dummyRun,
          status: "cancelled",
          metadata: {
            circuit_breaker: {
              reason: "max_duration_exceeded",
              elapsed_seconds: 1815,
              max_duration_seconds: 1800,
            },
          },
        }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(/Stopped: Duration limit exceeded/)).toBeInTheDocument()
    expect(screen.getByText(/1815s of 1800s/)).toBeInTheDocument()
  })

  it("D-16 Totality: unknown status falls back to never-success sentence", () => {
    render(
      <RunHero
        run={{ ...dummyRun, status: "some_unheard_of_status" }}
        answer={null}
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(HERO_EMPTY_UNKNOWN)).toBeInTheDocument()
  })

  it("renders 'Runtime not recorded' when phases carry no timestamps", () => {
    const untimedRun: WorkflowRunRead = {
      ...dummyRun,
      phases: [{ slug: "step-1", phase_index: 0, status: "completed", phase_type: "llm_agent" }],
    }

    render(
      <RunHero
        run={untimedRun}
        answer="Some answer"
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    expect(screen.getByText(HEADER_SPAN_NOT_RECORDED)).toBeInTheDocument()
  })

  it("R-4: neutral card styling — no accent background classes on section", () => {
    render(
      <RunHero
        run={dummyRun}
        answer="Some answer"
        files={[]}
        filesLoading={false}
        isTerminal={true}
        failedStepTitle={null}
        onDownload={vi.fn()}
        titleOf={(slug) => slug}
      />
    )
    const section = screen.getByLabelText(HERO_LANDMARK)
    expect(section.className).not.toContain("bg-primary")
    expect(section.className).not.toContain("bg-accent-violet")
  })

  // ── Source Sweeps ─────────────────────────────────────────────────────────

  it("source sweep: zero lucide imports in RunHero.tsx", () => {
    expect(rawSource).not.toContain('from "lucide-react"')
    expect(rawSource).not.toContain("from 'lucide-react'")
  })

  it("source sweep: zero raw HTML injection in RunHero.tsx", () => {
    expect(rawSource).not.toContain("dangerouslySetInnerHTML")
  })
})
