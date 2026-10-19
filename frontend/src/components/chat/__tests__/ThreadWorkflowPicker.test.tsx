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
