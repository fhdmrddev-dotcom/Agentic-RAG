/**
 * Phase 287-03 Task 2 (START-01) - the in-thread "Run a workflow" action + picker.
 *
 * ⛔ D-07 / T-287-09: the new modules read NOTHING from the conversation. Enforced by a stripped
 * source fence WITH a positive control, same shape as ChatLayout.launch.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const { mockList, mockSend, mockCreateThread } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSend: vi.fn(),
  mockCreateThread: vi.fn(),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, listPublishedWorkflows: mockList, createThread: mockCreateThread }
})
vi.mock("@/providers/StreamsProvider", async (importActual) => {
  const actual = await importActual<typeof import("@/providers/StreamsProvider")>()
  return { ...actual, useStreamActions: () => ({ sendMessage: mockSend }) }
})

import { ThreadWorkflowPicker } from "../ThreadWorkflowPicker"
import pickerSource from "../ThreadWorkflowPicker.tsx?raw"
import hookSource from "../useStartWorkflowInThread.ts?raw"
import { stripComments } from "@/lib/stripComments.testutil"

const THREAD = { id: "t-1", title: "My chat" } as never
const PLAIN = {
  id: "wf-plain",
  slug: "plain",
  name: "Plain flow",
  definition: { business_requirement: "Summarise the week" },
}
const DECLARED = {
  id: "wf-decl",
  slug: "decl",
  name: "Mail flow",
  definition: { inputs: [{ key: "to", label: "Recipient", required: true }] },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([PLAIN, DECLARED])
  mockSend.mockReturnValue(new Promise(() => {}))
})

async function openPicker() {
  fireEvent.click(screen.getByTestId("thread-workflow-trigger"))
  await screen.findByTestId("thread-workflow-list")
}

describe("ThreadWorkflowPicker", () => {
  it("does not fetch before it is opened, and is a plain action button", () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    expect(mockList).not.toHaveBeenCalled()
    const btn = screen.getByTestId("thread-workflow-trigger")
    expect(btn).toHaveTextContent(/run a workflow/i)
    expect(btn).not.toHaveAttribute("aria-pressed")
  })

  it("lists workflows by name with the one-line business requirement", async () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    expect(await screen.findByText("Plain flow")).toBeInTheDocument()
    expect(screen.getByText("Summarise the week")).toBeInTheDocument()
    expect(screen.getByText("Mail flow")).toBeInTheDocument()
  })

  it("an empty list says so and points at the Workflows page", async () => {
    mockList.mockResolvedValue([])
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    expect(await screen.findByTestId("thread-workflow-empty")).toHaveTextContent(/workflows page/i)
  })

  it("picking a no-input workflow sends once on this thread, never creating a thread", async () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-plain"))
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith("t-1", "Run Plain flow", {
      workflowDefinitionId: "wf-plain",
      inputs: {},
      surfaceId: "chat",
    })
    expect(mockCreateThread).not.toHaveBeenCalled()
  })

  it("declared inputs: cancel sends nothing; empty required is refused; valid values are sent verbatim", async () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-decl"))
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("chat-launch-cancel"))
    expect(screen.queryByTestId("chat-launch-form")).toBeNull()
    expect(mockSend).not.toHaveBeenCalled()

    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-decl"))
    fireEvent.click(await screen.findByTestId("chat-launch-confirm"))
    expect(await screen.findByTestId("chat-launch-required-refusal")).toBeInTheDocument()
    expect(mockSend).not.toHaveBeenCalled()

    fireEvent.change(screen.getByTestId("run-input-to"), { target: { value: "a@b.test" } })
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1))
    expect(mockSend).toHaveBeenCalledWith("t-1", "Run Mail flow", {
      workflowDefinitionId: "wf-decl",
      inputs: { to: "a@b.test" },
      surfaceId: "chat",
    })
    expect(mockCreateThread).not.toHaveBeenCalled()
  })

  it("busy (a normal turn is streaming): disabled, because sendMessage would drop the start (287 review WR-01)", () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} busy={true} />)
    expect(screen.getByTestId("thread-workflow-trigger")).toBeDisabled()
    // Not the workflow-lock sentence: nothing is "already running" as a workflow here.
    expect(screen.queryByTestId("thread-workflow-locked-reason")).toBeNull()
  })

  it("locked: disabled with the stated reason, and opening is impossible", () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={true} />)
    const btn = screen.getByTestId("thread-workflow-trigger")
    expect(btn).toBeDisabled()
    expect(screen.getByTestId("thread-workflow-locked-reason")).toHaveTextContent(
      "A workflow is already running in this thread",
    )
    fireEvent.click(btn)
    expect(mockList).not.toHaveBeenCalled()
  })

  it("not locked: no reason line is shown", () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    expect(screen.queryByTestId("thread-workflow-locked-reason")).toBeNull()
  })
})

describe("ThreadWorkflowPicker — 296-04 dismissal (287-IN-04b)", () => {
  it("the trigger names the list it controls and says whether it is open", async () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    const trigger = screen.getByTestId("thread-workflow-trigger")
    expect(trigger).toHaveAttribute("aria-controls", "thread-workflow-list")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await openPicker()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("thread-workflow-list")).toHaveAttribute("id", "thread-workflow-list")
  })

  it("Escape closes the list and returns focus to Run a workflow", async () => {
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByTestId("thread-workflow-list")).toBeNull())
    expect(document.activeElement).toBe(screen.getByTestId("thread-workflow-trigger"))
  })

  it("a pointer-down outside the picker closes the list; inside keeps it", async () => {
    render(
      <div>
        <p data-testid="outside">elsewhere</p>
        <ThreadWorkflowPicker thread={THREAD} locked={false} />
      </div>,
    )
    await openPicker()
    fireEvent.pointerDown(screen.getByTestId("thread-workflow-list"))
    expect(screen.getByTestId("thread-workflow-list")).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByTestId("outside"))
    await waitFor(() => expect(screen.queryByTestId("thread-workflow-list")).toBeNull())
  })
})

describe("ThreadWorkflowPicker — 296-04 a refused start (287-WR-02 / 287-IN-03)", () => {
  class FakeApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }

  it("a failed start shows its sentence under the trigger, with Retry start and Dismiss message", async () => {
    mockSend.mockRejectedValue(new FakeApiError("x", 500))
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-plain"))
    const line = await screen.findByTestId("thread-workflow-start-failure")
    expect(line).toHaveAttribute("role", "alert")
    expect(line).toHaveTextContent("Plain flow didn't start. Nothing ran.")
    expect(screen.getByRole("button", { name: "Retry start" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }))
    expect(screen.queryByTestId("thread-workflow-start-failure")).toBeNull()
  })

  it("locked (409): the sentence, and no Retry", async () => {
    mockSend.mockRejectedValue(new FakeApiError("x", 409))
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-plain"))
    expect(await screen.findByTestId("thread-workflow-start-failure")).toHaveTextContent(
      "A workflow is already running in this thread, so Plain flow didn't start.",
    )
    expect(screen.queryByRole("button", { name: "Retry start" })).toBeNull()
  })

  it("422 then Retry start re-opens the form holding the typed value", async () => {
    mockSend.mockRejectedValueOnce(new FakeApiError("x", 422))
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-decl"))
    fireEvent.change(await screen.findByTestId("run-input-to"), { target: { value: "a@b.test" } })
    fireEvent.click(screen.getByTestId("chat-launch-confirm"))
    await screen.findByTestId("thread-workflow-start-failure")
    fireEvent.click(screen.getByRole("button", { name: "Retry start" }))
    expect(await screen.findByTestId("chat-launch-form")).toBeInTheDocument()
    expect(screen.getByTestId("run-input-to")).toHaveValue("a@b.test")
  })
})

describe("ThreadWorkflowPicker - the conversation is never read (D-07 / T-287-09)", () => {
  const CODE = stripComments(pickerSource) + "\n" + stripComments(hookSource)

  it("the stripper really removes prose (positive control)", () => {
    expect(CODE.length).toBeLessThan(pickerSource.length + hookSource.length)
    const planted = stripComments(`const keep = 1\n// drop-me\n/* drop-me-too */\nconst x = 2`)
    expect(planted).not.toMatch(/drop-me/)
    expect(planted).toMatch(/const keep = 1/)
  })

  it("contains none of the forbidden needles in code", () => {
    const needles = [
      ["mess", "ages"].join(""),
      ["assist", "ant"].join(""),
      ["last", "Message"].join(""),
      ["gene", "rate"].join(""),
      ["use", "Threads"].join(""),
      ["create", "Thread"].join(""),
    ]
    for (const n of needles) expect(CODE).not.toContain(n)
    // POSITIVE CONTROL - each needle really matches the shape it forbids.
    expect(`await create${"Thread"}(x)`).toContain(needles[5])
    expect(`const v = use${"Threads"}()`).toContain(needles[4])
    expect(`props.mess${"ages"}.at(-1)`).toContain(needles[0])
  })
})

describe("ThreadWorkflowPicker — 298-02 a folder refusal (ORG-05 / UI-D12)", () => {
  const SENTENCE =
    "“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). Pick a folder from Personal."

  class CodedApiError extends Error {
    status: number
    code: string
    constructor(message: string, status: number, code: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }

  it("shows the server's sentence verbatim, with Dismiss and no Retry", async () => {
    mockSend.mockRejectedValue(new CodedApiError(SENTENCE, 422, "folder_in_other_org"))
    render(<ThreadWorkflowPicker thread={THREAD} locked={false} />)
    await openPicker()
    fireEvent.click(await screen.findByTestId("thread-workflow-item-wf-plain"))
    expect(await screen.findByTestId("thread-workflow-start-failure")).toHaveTextContent(SENTENCE)
    expect(screen.queryByRole("button", { name: "Retry start" })).toBeNull()
    expect(screen.getByRole("button", { name: "Dismiss message" })).toBeInTheDocument()
  })
})
