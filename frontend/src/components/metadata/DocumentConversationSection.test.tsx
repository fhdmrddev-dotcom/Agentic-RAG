/**
 * Phase 240 (SRC-05 SC#3) — the Conversation section, asserted on RENDERED CONTENT.
 *
 * ⛔ NO `data-testid` PRESENCE ASSERTIONS IN THIS FILE, AND THAT IS A RULE RATHER THAN A
 * PREFERENCE. Phase 235 shipped a green composition fence over a real defect because it asserted
 * that blocks were PRESENT by testid while their content drifted — *"presence assertions cannot
 * see content drift; assert the rendered CONTENT where the words are the deliverable."* Here the
 * words ARE the deliverable: a sender, a subject, "this message", and an honest truncation
 * sentence.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DocumentConversationSection } from "./DocumentConversationSection"

vi.mock("@/lib/api", () => ({
  fetchDocumentConversation: vi.fn(),
}))

const { fetchDocumentConversation } = await import("@/lib/api")
const mockFetch = fetchDocumentConversation as unknown as ReturnType<typeof vi.fn>

function message(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m-1",
    title: "Renewal",
    date: "2026-09-07T09:00:00Z",
    sender: "alice@example.com",
    is_open: false,
    ...over,
  }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe("DocumentConversationSection", () => {
  it("names every sibling by its subject and sender", async () => {
    mockFetch.mockResolvedValue({
      messages: [
        message({ id: "m-1", title: "Renewal", sender: "alice@example.com" }),
        message({ id: "m-2", title: "Re: Renewal", sender: "bob@example.com" }),
      ],
      total: 2,
      truncated: false,
    })

    render(<DocumentConversationSection docId="m-1" />)

    expect(await screen.findByText("Renewal")).toBeInTheDocument()
    expect(screen.getByText("Re: Renewal")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
  })

  it("marks the open message rather than hiding it", async () => {
    // ⚠ A list that silently omits the message you are looking at is a list you cannot orient
    //   yourself in — the reason `is_open` marks instead of filtering.
    mockFetch.mockResolvedValue({
      messages: [
        message({ id: "m-1", title: "Renewal", is_open: true }),
        message({ id: "m-2", title: "Re: Renewal" }),
      ],
      total: 2,
      truncated: false,
    })

    render(<DocumentConversationSection docId="m-1" />)

    expect(await screen.findByText("this message")).toBeInTheDocument()
    // The open message is still listed by name — not removed.
    expect(screen.getByText("Renewal")).toBeInTheDocument()
  })

  it("says how many messages the conversation has", async () => {
    mockFetch.mockResolvedValue({
      messages: [message({ id: "m-1" }), message({ id: "m-2" })],
      total: 14,
      truncated: false,
    })

    render(<DocumentConversationSection docId="m-1" />)

    expect(await screen.findByText(/14 messages in this conversation/)).toBeInTheDocument()
  })

  it("says so when the list is truncated — never a silent slice", async () => {
    // ⛔ TM-240-14. A capped list that does not say it is capped is the same lie as PostgREST
    //   quietly stopping at 1000, which `_fetch_readability` already records as a live trap.
    mockFetch.mockResolvedValue({
      messages: [message({ id: "m-1" }), message({ id: "m-2" })],
      total: 250,
      truncated: true,
    })

    render(<DocumentConversationSection docId="m-1" />)

    expect(await screen.findByText(/showing the first 2/)).toBeInTheDocument()
    expect(screen.getByText(/250 messages in this conversation/)).toBeInTheDocument()
  })

  it("renders nothing for a conversation of one", async () => {
    // A thread of one is a pile of one; an accordion body saying "1 message" would be noise on
    // almost every mail document in the Library.
    mockFetch.mockResolvedValue({
      messages: [message({ id: "m-1", is_open: true })],
      total: 1,
      truncated: false,
    })

    const { container } = render(<DocumentConversationSection docId="m-1" />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).not.toMatch(/conversation/i))
  })

  it("bounds its own height so it cannot bury the sections below it", async () => {
    // ⛔ BUG-260908-01 is a LIVE report about this exact panel: an unbounded section "buries every
    //   section below it". This assertion is the one structural check in the file, and it exists
    //   because repeating that defect one section over would be inexcusable.
    mockFetch.mockResolvedValue({
      messages: Array.from({ length: 40 }, (_, i) =>
        message({ id: `m-${i}`, title: `Message ${i}` }),
      ),
      total: 40,
      truncated: false,
    })

    render(<DocumentConversationSection docId="m-1" />)
    const list = await screen.findByRole("list", { name: "Conversation" })
    expect(list.className).toMatch(/max-h-/)
    expect(list.className).toMatch(/overflow-y-auto/)
  })

  it("reports a failure instead of rendering an empty conversation", async () => {
    // Honest states: empty ≠ loading ≠ error. An error that renders as "no messages" tells a
    // person their thread has one message when it may have fourteen.
    mockFetch.mockRejectedValue(new Error("boom"))

    render(<DocumentConversationSection docId="m-1" />)

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i)
  })

  it("opens a sibling when its row is clicked", async () => {
    const onOpenDocument = vi.fn()
    mockFetch.mockResolvedValue({
      messages: [
        message({ id: "m-1", title: "Renewal", is_open: true }),
        message({ id: "m-2", title: "Re: Renewal" }),
      ],
      total: 2,
      truncated: false,
    })

    render(<DocumentConversationSection docId="m-1" onOpenDocument={onOpenDocument} />)

    await userEvent.click(await screen.findByText("Re: Renewal"))
    expect(onOpenDocument).toHaveBeenCalledWith("m-2")
  })
})
