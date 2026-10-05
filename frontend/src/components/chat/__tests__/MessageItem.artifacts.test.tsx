/**
 * Phase 273-05 (D-10 · D-16 · I-2 · SC#5) — the ONE `<ArtifactBlock>` mount in MessageItem.
 *
 * PLACEMENT (D-10): the artifact list sits directly after the answer text and before the run's
 * terminal status, the live indicators, the Generated-files panel and the reload seam cards.
 *
 * LIVE == RELOAD (I-2): a message built through the live path (`onArtifact` on StreamsProvider's
 * callbacks) and one built through the reload path (`_mapMessageResponse`, via `getMessages`) from
 * the SAME records render IDENTICAL `artifact-list` markup. The chart chunk is mocked to one static
 * component in both, so the comparison is about the path, never about recharts in jsdom.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "@/types"

vi.mock("@/components/chat/artifacts/ChartArtifact", () => ({
  default: ({ record }: { record: { label: string } }) => (
    <div data-testid="chart-stub">static chart for {record.label}</div>
  ),
}))

vi.mock("@/lib/api/_core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/_core")>()
  return { ...actual, API_BASE: "http://api.test", getAuthHeaders: vi.fn().mockResolvedValue({}) }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { MessageItem } from "@/components/chat/MessageItem"
import { makeStreamCallbacks } from "@/providers/StreamsProvider"
import { getMessages } from "@/lib/api/threads"
import { chartBar, table16 } from "@/components/chat/artifacts/__tests__/fixtures"

const NOW = "2026-10-03T09:41:12.512Z"
const ANSWER = "Revenue grew every quarter, led by the Americas."

function base(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-273",
    thread_id: "thread-273",
    user_id: "user-1",
    role: "assistant",
    content: ANSWER,
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    runStatus: "completed",
    ...overrides,
  } as Message
}

function renderItem(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** The live path: StreamsProvider's own callbacks stamp the records onto the message. */
function liveMessage(records: unknown[]): Message {
  let messages: Message[] = [base({ runStatus: "streaming" })]
  const setMessages = vi.fn((u: Message[] | ((p: Message[]) => Message[])) => {
    messages = typeof u === "function" ? u(messages) : u
  })
  const cbs = makeStreamCallbacks({ assistantId: "msg-273", threadId: "thread-273", setMessages })
  for (const r of records) cbs.onArtifact!(r)
  return { ...messages[0], runStatus: "completed" }
}

/** The reload path: the backend row, mapped by the one mapper. */
async function reloadMessage(records: unknown[]): Promise<Message> {
  const wire = { ...base(), artifacts: records }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [wire] }))
  const [m] = await getMessages("thread-273")
  return m
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("MessageItem — the one artifact mount (D-16)", () => {
  it("renders the list AFTER the answer text and BEFORE the Generated-files panel", async () => {
    renderItem(
      <MessageItem
        message={base({ artifacts: [chartBar, table16] as unknown as Message["artifacts"], finalOutputFiles: [{ filename: "revenue.xlsx", url: "https://x/y" }] })}
        isStreaming={false}
      />,
    )
    await screen.findByTestId("chart-stub")
    const list = screen.getByTestId("artifact-list")
    const answer = screen.getByText(ANSWER, { exact: false })
    const files = screen.getByTestId("final-outputs-panel")
    expect(answer.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(list.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Emission order inside the list.
    expect(list.textContent).toMatch(/static chart for chart 1[\s\S]*table 1/)
  })

  it("a message without artifacts renders no list", () => {
    renderItem(<MessageItem message={base()} isStreaming={false} />)
    expect(screen.queryByTestId("artifact-list")).toBeNull()
  })

  it("an empty artifacts array renders no list", () => {
    renderItem(<MessageItem message={base({ artifacts: [] })} isStreaming={false} />)
    expect(screen.queryByTestId("artifact-list")).toBeNull()
  })

  it("the page text never carries spec JSON", async () => {
    const { container } = renderItem(<MessageItem message={base({ artifacts: [chartBar, table16] as unknown as Message["artifacts"] })} isStreaming={false} />)
    await screen.findByTestId("chart-stub")
    expect(container.textContent).not.toContain('{"')
  })
})

describe("I-2 — live and reload render IDENTICAL DOM through the same mount", () => {
  it("the live message and the reloaded message produce the same artifact-list innerHTML", async () => {
    const records = [chartBar, table16]
    const live = liveMessage(records)
    const reload = await reloadMessage(records)
    expect(reload.artifacts).toEqual(live.artifacts)

    const a = renderItem(<MessageItem message={live} isStreaming={false} />)
    await screen.findByTestId("chart-stub")
    const liveHtml = screen.getByTestId("artifact-list").innerHTML
    a.unmount()

    renderItem(<MessageItem message={reload} isStreaming={false} />)
    await screen.findByTestId("chart-stub")
    await act(async () => {})
    const reloadHtml = screen.getByTestId("artifact-list").innerHTML

    expect(liveHtml.length).toBeGreaterThan(100) // non-vacuity: real cards rendered
    expect(liveHtml).toContain("table 1")
    expect(reloadHtml).toBe(liveHtml)
  })
})
