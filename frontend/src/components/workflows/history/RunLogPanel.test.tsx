/**
 * SEED-190 — `RunLogPanel`'s behaviour.
 *
 * ⚠ THE HEADLINE CASES ARE §3 AND §4, and both are about a surface telling the truth when it
 * has nothing good to say:
 *
 *   §3 — A FAILURE IS NEVER RENDERED AS AN EMPTY LOG. *"We could not look"* and *"we looked
 *        and there is nothing"* are different facts, and showing the second when the first is
 *        true is how a surface tells a person their work is gone. This block asserts the two
 *        are never confusable, in BOTH directions.
 *
 *   §4 — THE THREE EMPTY STATES ARE THREE SENTENCES. *"You have not run anything"*, *"you
 *        have not run THIS"* and a failure are distinct. This repository has recorded the
 *        opposite fold four times (`runFacts` CR-01, `DecisionsList` D-20,
 *        `transcriptVocabulary`), and this is the refusal of a fifth.
 *
 * ⚠ THE FETCH IS MOCKED AT THE `@/lib/api` SEAM, never at `fetch`. The client function owns
 * the URL, the auth headers and the error class, and a suite that stubbed `fetch` would be
 * asserting this component against a URL it does not construct.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RunLogPanel } from "./RunLogPanel"
import {
  LOG_FAILED,
  LOG_SUBTITLE,
  LOG_UNAVAILABLE,
  NO_RUNS_AT_ALL,
  noRunsForWorkflow,
} from "./runLogVocabulary"
import type { WorkflowRunListItem, WorkflowRunListPage } from "@/lib/api"

const { listWorkflowRuns, ApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { listWorkflowRuns: vi.fn(), ApiError: MockApiError }
})

vi.mock("@/lib/api", () => ({ listWorkflowRuns, ApiError }))

function runOf(over: Partial<WorkflowRunListItem> = {}): WorkflowRunListItem {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Quarterly Business Review",
    workflow_slug: "qbr",
    workflow_version: 1,
    status: "completed",
    created_at: "2026-08-20T16:28:07.421051Z",
    step_total: 5,
    started_at: "2026-08-20T16:28:07.474637Z",
    completed_at: "2026-08-20T16:31:05.143715Z",
    ...over,
  }
}

function pageOf(runs: WorkflowRunListItem[], total = runs.length): WorkflowRunListPage {
  return { runs, total, limit: 50, offset: 0 }
}

beforeEach(() => {
  listWorkflowRuns.mockReset()
})

describe("RunLogPanel §1 — the whole log", () => {
  it("reads the log UNFILTERED when there is no scope, and says so", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 230))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)

    await screen.findByTestId("run-log-row-run-1")
    // ⚠ NO `slug` KEY AT ALL, not `slug: undefined`. The wire treats an absent slug as "the
    // whole log" and an UNKNOWN slug as an EMPTY log, so a stray `undefined` reaching the
    // query string would be a different request.
    expect(listWorkflowRuns).toHaveBeenCalledWith(
      expect.not.objectContaining({ slug: expect.anything() }),
    )
    expect(screen.getByTestId("run-log-subtitle")).toHaveTextContent(LOG_SUBTITLE)
  })

  it("states how much of the log is on screen — never the page size alone", async () => {
    // ⚠ THE PAGING LIE THIS PREVENTS: "1 run" on a screen showing 1 of 230. A count that
    // reports only what arrived reads as a complete answer.
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 230))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    const count = await screen.findByTestId("run-log-count")
    expect(count).toHaveTextContent("1")
    expect(count).toHaveTextContent("230")
  })

  it("a COMPLETE log states its total plainly, with no `showing`", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf(), runOf({ id: "run-2" })], 2))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    const count = await screen.findByTestId("run-log-count")
    expect(count).toHaveTextContent("2 runs")
    expect(count.textContent ?? "").not.toMatch(/showing/i)
  })

  it("renders NO count while the first page is in flight — a zero mid-load is a lie", () => {
    listWorkflowRuns.mockReturnValue(new Promise(() => {}))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    expect(screen.getByTestId("run-log-loading")).toBeInTheDocument()
    expect(screen.queryByTestId("run-log-count")).not.toBeInTheDocument()
    expect(screen.queryByTestId("run-log-empty")).not.toBeInTheDocument()
  })
})

describe("RunLogPanel §2 — the filter is by SLUG, across versions", () => {
  it("passes the scope's SLUG to the wire, never a definition id", async () => {
    // ⚠ THE TRAP THIS ASSERTS AGAINST. `workflow_runs.definition_id` points at ONE version
    // row, so a definition-scoped read shows a VERSION's history under the workflow's name.
    // Measured on the dev database: `pm-weekly-status-report` has 21 runs across 3 rows.
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 19))
    render(<RunLogPanel scope={{ slug: "qbr", name: "QBR" }} onOpenRun={vi.fn()} />)

    await screen.findByTestId("run-log-row-run-1")
    expect(listWorkflowRuns).toHaveBeenCalledWith(expect.objectContaining({ slug: "qbr" }))
    const call = listWorkflowRuns.mock.calls[0][0]
    expect(call).not.toHaveProperty("definition_id")
    expect(call).not.toHaveProperty("definitionId")
  })

  it("the filtered subtitle NAMES the workflow and says the rows span its versions", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 19))
    render(<RunLogPanel scope={{ slug: "qbr", name: "QBR" }} onOpenRun={vi.fn()} />)
    const subtitle = await screen.findByTestId("run-log-subtitle")
    expect(subtitle).toHaveTextContent("QBR")
    expect(subtitle).toHaveTextContent(/versions/i)
  })

  it("offers the way OUT of a filter, and only when there is one to leave", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 19))
    const onClear = vi.fn()
    const { rerender } = render(
      <RunLogPanel scope={{ slug: "qbr", name: "QBR" }} onClearScope={onClear} onOpenRun={vi.fn()} />,
    )
    await userEvent.click(await screen.findByTestId("run-log-clear-scope"))
    expect(onClear).toHaveBeenCalledTimes(1)

    // …and on the unfiltered log there is nothing to clear, so no control at all. A control
    // that does nothing is worse than an absent one.
    rerender(<RunLogPanel scope={null} onClearScope={onClear} onOpenRun={vi.fn()} />)
    await waitFor(() =>
      expect(screen.queryByTestId("run-log-clear-scope")).not.toBeInTheDocument(),
    )
  })

  it("dropping the filter RE-READS the wire unfiltered — the rows are not reused", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 19))
    const { rerender } = render(
      <RunLogPanel scope={{ slug: "qbr", name: "QBR" }} onOpenRun={vi.fn()} />,
    )
    await screen.findByTestId("run-log-row-run-1")
    listWorkflowRuns.mockResolvedValue(pageOf([runOf({ id: "run-9" })], 230))
    rerender(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    await screen.findByTestId("run-log-row-run-9")
    // The filtered row is GONE, not merged under an unfiltered heading.
    expect(screen.queryByTestId("run-log-row-run-1")).not.toBeInTheDocument()
  })
})

describe("RunLogPanel §3 — a failure is NEVER an empty log (the headline)", () => {
  it("a 5xx says we could not load it, and offers a retry", async () => {
    listWorkflowRuns.mockRejectedValue(new ApiError("boom", 500))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)

    const failed = await screen.findByTestId("run-log-failed")
    expect(failed).toHaveTextContent(LOG_FAILED)
    expect(screen.getByTestId("run-log-retry")).toBeInTheDocument()
    // ⚠ AND IT IS NOT THE EMPTY WORD. This is the assertion the whole block exists for.
    expect(screen.queryByText(NO_RUNS_AT_ALL)).not.toBeInTheDocument()
  })

  it("a canvas-off 404 says the log is UNAVAILABLE — a different fact from a 5xx", async () => {
    listWorkflowRuns.mockRejectedValue(new ApiError("gone", 404))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    const failed = await screen.findByTestId("run-log-failed")
    expect(failed).toHaveTextContent(LOG_UNAVAILABLE)
    expect(failed).not.toHaveTextContent(LOG_FAILED)
  })

  it("retrying re-reads, and a successful retry clears the failure", async () => {
    listWorkflowRuns.mockRejectedValueOnce(new ApiError("boom", 500))
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 1))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)

    await userEvent.click(await screen.findByTestId("run-log-retry"))
    await screen.findByTestId("run-log-row-run-1")
    expect(screen.queryByTestId("run-log-failed")).not.toBeInTheDocument()
  })

  it("the CONVERSE also holds — a real empty log is NOT dressed as a failure", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([], 0))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    await screen.findByTestId("run-log-empty")
    expect(screen.queryByTestId("run-log-failed")).not.toBeInTheDocument()
  })
})

describe("RunLogPanel §4 — the empty states are DIFFERENT SENTENCES (the headline)", () => {
  it("an empty WHOLE log says you have not run anything", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([], 0))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    expect(await screen.findByTestId("run-log-empty")).toHaveTextContent(NO_RUNS_AT_ALL)
  })

  it("an empty FILTERED log names the workflow, and is a different sentence", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([], 0))
    render(<RunLogPanel scope={{ slug: "qbr", name: "QBR" }} onOpenRun={vi.fn()} />)
    const empty = await screen.findByTestId("run-log-empty")
    expect(empty).toHaveTextContent(noRunsForWorkflow("QBR"))
    // ⚠ THE FOLD THIS REFUSES: one sentence for both would tell a person who has run 229
    // other workflows that they have never run anything.
    expect(empty).not.toHaveTextContent(NO_RUNS_AT_ALL)
    expect(noRunsForWorkflow("QBR")).not.toBe(NO_RUNS_AT_ALL)
  })
})

describe("RunLogPanel §5 — a row is a door into the run", () => {
  it("clicking a row opens THAT run, by its `workflow_runs.id`", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf({ id: "run-42" })], 1))
    const onOpenRun = vi.fn()
    render(<RunLogPanel scope={null} onOpenRun={onOpenRun} />)

    await userEvent.click(await screen.findByRole("button", { name: /open the run of/i }))
    expect(onOpenRun).toHaveBeenCalledWith("run-42")
  })

  it("with NO way to open a run, the rows are not controls at all", async () => {
    // ⚠ NOT A DISABLED BUTTON. With the canvas layer off the run surface does not exist, and
    // a control that goes nowhere is worse than a row that never claimed to be one.
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 1))
    render(<RunLogPanel scope={null} />)
    await screen.findByTestId("run-log-row-run-1")
    expect(screen.queryByRole("button", { name: /open the run of/i })).not.toBeInTheDocument()
    // …and the row's facts are still on screen — the log still reports.
    expect(screen.getByTestId("run-log-row-title")).toHaveTextContent("Quarterly Business Review")
  })

  it("a run whose workflow was deleted is still listed and still openable", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf({ workflow_name: "" })], 1))
    const onOpenRun = vi.fn()
    render(<RunLogPanel scope={null} onOpenRun={onOpenRun} />)

    const title = await screen.findByTestId("run-log-row-title")
    expect(title.textContent ?? "").not.toBe("")
    await userEvent.click(screen.getByRole("button", { name: /open the run of/i }))
    expect(onOpenRun).toHaveBeenCalledWith("run-1")
  })

  it("the outcome is a WORD, and the coloured dot beside it is hidden from the reader", async () => {
    // "Colour, and never colour alone" — the card's standing rule, which is not weaker here.
    listWorkflowRuns.mockResolvedValue(pageOf([runOf({ status: "failed" })], 1))
    const { container } = render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    await screen.findByTestId("run-log-row-run-1")

    const outcome = screen.getByTestId("run-log-row-outcome")
    expect((outcome.textContent ?? "").trim().length).toBeGreaterThan(0)
    expect(outcome.getAttribute("data-run")).toBe("failed")
    const dot = container.querySelector('span[aria-hidden="true"][data-run]')
    expect(dot).not.toBeNull()
    expect((dot?.textContent ?? "").trim()).toBe("")
  })
})

describe("RunLogPanel §6 — paging", () => {
  it("offers more only while there IS more, and appends rather than replaces", async () => {
    listWorkflowRuns.mockResolvedValueOnce(pageOf([runOf({ id: "a" })], 2))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    await screen.findByTestId("run-log-row-a")

    listWorkflowRuns.mockResolvedValueOnce({
      runs: [runOf({ id: "b" })],
      total: 2,
      limit: 50,
      offset: 1,
    })
    await userEvent.click(screen.getByTestId("run-log-more"))

    await screen.findByTestId("run-log-row-b")
    // ⚠ THE FIRST PAGE SURVIVES. A "load more" that replaced would look like paging and
    // behave like re-reading.
    expect(screen.getByTestId("run-log-row-a")).toBeInTheDocument()
    // …and with everything on screen the control is gone.
    await waitFor(() => expect(screen.queryByTestId("run-log-more")).not.toBeInTheDocument())
    // The second read asked for the next OFFSET, not for page 0 again.
    expect(listWorkflowRuns).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }))
  })

  it("a complete first page offers nothing more", async () => {
    listWorkflowRuns.mockResolvedValue(pageOf([runOf()], 1))
    render(<RunLogPanel scope={null} onOpenRun={vi.fn()} />)
    await screen.findByTestId("run-log-row-run-1")
    expect(screen.queryByTestId("run-log-more")).not.toBeInTheDocument()
  })
})
