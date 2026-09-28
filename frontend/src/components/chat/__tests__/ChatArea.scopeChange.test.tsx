/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12a / D-268-12d / UI-SPEC §5.3-§5.4, §6.1-§6.2, §9-D6) —
 * ChatArea is the ONE home of a scope change, beside the Expert one.
 *
 *   - the chip lives in the composer's chip row only when a thread exists; a new chat keeps the
 *     shipped `<select>`; the header folder pill is gone (§9-D6);
 *   - the at-rest ScopeEffect is read on thread load and re-read after every scope or Expert change;
 *   - success → the server's thread goes to the list owner, the transcript refetches — unless THIS
 *     thread streams, where the pending note is the receipt until the run ends (no 409, D-268-12a);
 *   - a refusal leaves the chip unmoved and states the server's reason inside the picker.
 *
 * Harness: the `ChatArea.expertThread.test.tsx` shape — real `StreamsProvider`, `useMessages` and
 * the network stubbed. ⛔ `@/lib/api`'s mock DECLARES `setThreadFolder` and `getScopeEffect` (the
 * 196-08 lesson: an undeclared export throws at mount).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import type { ExpertBundle, Folder, Message, Thread } from "@/types"
import type { ScopeEffect } from "@/lib/api/threads"

const h = vi.hoisted(() => ({
  messages: [] as unknown[],
  loadMessages: vi.fn(),
  sendMessage: vi.fn(),
  getExpert: vi.fn(),
  setThreadActiveExpert: vi.fn(),
  setThreadFolder: vi.fn(),
  getScopeEffect: vi.fn(),
}))

vi.mock("@/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: h.messages,
    loadMessages: h.loadMessages,
    sendMessage: h.sendMessage,
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    setViewingThread: vi.fn(),
    resumeFromFailed: vi.fn(),
  }),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-5.4",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-5.4"], is_active: true }],
      deprecated_models: [],
      disabled_models: [],
    }),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep", active_workflow_run_id: null }),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    listExperts: vi.fn().mockResolvedValue([]),
    getExpert: h.getExpert,
    setThreadActiveExpert: h.setThreadActiveExpert,
    setThreadFolder: h.setThreadFolder,
    getScopeEffect: h.getScopeEffect,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "token" } } }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { ChatArea } from "../ChatArea"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"

const FOLDERS = [
  { id: "f-acme", name: "Client ACME", parent_id: null },
  { id: "f-q3", name: "Q3 Contracts", parent_id: "f-acme" },
] as unknown as Folder[]

const THREAD = {
  id: "thread-A",
  title: "Q3 board prep",
  folder_id: "f-acme",
  created_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T10:00:00Z",
} as Thread

const TALK: Message[] = [
  { id: "u1", thread_id: "thread-A", user_id: "user-1", role: "user", content: "Q3?", created_at: "2026-09-28T10:00:01Z", updated_at: "2026-09-28T10:00:01Z" },
  { id: "a1", thread_id: "thread-A", user_id: "user-1", role: "assistant", content: "Up 9%.", created_at: "2026-09-28T10:00:02Z", updated_at: "2026-09-28T10:00:02Z", runStatus: "completed" },
]

const line = (over: Partial<ScopeEffect["next"]> = {}): ScopeEffect["next"] => ({
  folders: [],
  thread_folder: null,
  all_documents: false,
  connections: [],
  ...over,
})
const acme = { id: "f-acme", name: "Client ACME", doc_count: 4, path: "Client ACME" }
const q3 = { id: "f-q3", name: "Q3 Contracts", doc_count: 2, path: "Client ACME/Q3 Contracts" }
const HR = { id: "e-hr", name: "HR Advisor", scope_mode: "restricted" as const }
const AT_REST: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: acme }), stops: line(), saved: null }
const TO_Q3: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: q3 }), stops: line({ thread_folder: acme }), saved: null }
const HELD: ScopeEffect = {
  held: true,
  expert: HR,
  next: line({ folders: [{ id: "f-hrp", name: "HR Policies", doc_count: null }] }),
  stops: line(),
  saved: acme,
}

const HR_BUNDLE = {
  id: "e-hr",
  name: "HR Advisor",
  slug: "hr-advisor",
  description: "",
  scope_mode: "restricted",
  member_skills: [],
  required_connections: [],
  knowledge_folder_ids: ["f-hrp"],
  prompt_suggestions: [],
  visibility: "org",
  is_system: false,
  is_enabled: true,
} as unknown as ExpertBundle

function shell(ui: ReactNode) {
  return (
    <TooltipProvider>
      <StreamsProvider>{ui}</StreamsProvider>
    </TooltipProvider>
  )
}

async function applyQ3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("scope-chip"))
  const picker = await screen.findByTestId("scope-picker")
  await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
  await waitFor(() => expect(screen.getByTestId("scope-picker-apply")).not.toHaveAttribute("data-disabled"))
  await user.click(screen.getByTestId("scope-picker-apply"))
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  h.messages = TALK
  h.loadMessages.mockResolvedValue(undefined)
  h.getScopeEffect.mockImplementation(async (_t: string, d?: { folderId: string | null }) => (d ? TO_Q3 : AT_REST))
  h.setThreadFolder.mockImplementation(async (tid: string, fid: string | null) => ({ ...THREAD, id: tid, folder_id: fid }))
  h.getExpert.mockResolvedValue(HR_BUNDLE)
  h.setThreadActiveExpert.mockImplementation(async (tid: string, eid: string | null) => ({
    ...THREAD,
    id: tid,
    active_expert_id: eid,
  }))
})

afterEach(() => {
  cleanup()
  useStreamsStore.setState({ streamingThreads: new Set<string>() })
})

describe("where the chip lives (D-268-12d / §9-D6)", () => {
  it("(1) on a thread: the chip is in the composer's chip row, after `Using:`; the header pill is gone", async () => {
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={FOLDERS} />))
    const chip = await screen.findByTestId("scope-chip")
    const row = screen.getByTestId("active-connector-chips")
    expect(row.contains(chip)).toBe(true)
    expect(within(row).getByText("Using:")).toBeVisible()
    expect(within(chip).getByText("/Client ACME")).toBeVisible()
    const header = screen.getByRole("heading", { name: "Q3 board prep" }).parentElement as HTMLElement
    expect(within(header).queryByText("Client ACME")).toBeNull()
    expect(h.getScopeEffect).toHaveBeenCalledWith("thread-A")
  })

  it("(2) a brand-new chat keeps the shipped <select> and has no chip", async () => {
    render(shell(<ChatArea thread={null} onCreateThread={vi.fn()} folders={FOLDERS} />))
    expect(await screen.findByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "All documents" })).toBeInTheDocument()
    expect(screen.queryByTestId("scope-chip")).toBeNull()
  })

  it("(3) the at-rest payload decides `held`: a Restricted thread's chip says `· not searched` at rest", async () => {
    h.getScopeEffect.mockResolvedValue(HELD)
    render(shell(<ChatArea thread={{ ...THREAD, active_expert_id: "e-hr" } as Thread} onCreateThread={vi.fn()} folders={FOLDERS} />))
    const chip = await screen.findByTestId("scope-chip")
    await waitFor(() => expect(within(chip).getByText("· not searched")).toBeVisible())
  })
})

describe("applyScopeChange — the one scope PATCH home", () => {
  it("(4) success while idle: PATCH once, the server's thread to the list owner, effect re-read, transcript refetched", async () => {
    const onThreadUpdated = vi.fn()
    const user = userEvent.setup()
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} onThreadUpdated={onThreadUpdated} folders={FOLDERS} />))
    const readsBefore = () => h.getScopeEffect.mock.calls.filter((c) => c.length === 1).length
    await screen.findByTestId("scope-chip")
    const before = readsBefore()
    await applyQ3(user)
    await waitFor(() => expect(h.setThreadFolder).toHaveBeenCalledTimes(1))
    expect(h.setThreadFolder).toHaveBeenCalledWith("thread-A", "f-q3")
    await waitFor(() => expect(onThreadUpdated).toHaveBeenCalledWith(expect.objectContaining({ folder_id: "f-q3" })))
    await waitFor(() => expect(readsBefore()).toBeGreaterThan(before))
    await waitFor(() => expect(h.loadMessages).toHaveBeenCalledWith("thread-A"))
    await waitFor(() => expect(screen.queryByTestId("scope-picker")).toBeNull())
    expect(screen.queryByTestId("scope-pending-note")).toBeNull()
  })

  it("(5) a refusal: the chip does not move, the reason is stated in the picker, nothing is refetched", async () => {
    h.setThreadFolder.mockRejectedValue(new ApiError("Folder not found", 404))
    const onThreadUpdated = vi.fn()
    const user = userEvent.setup()
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} onThreadUpdated={onThreadUpdated} folders={FOLDERS} />))
    await applyQ3(user)
    const refusal = await screen.findByTestId("scope-refusal")
    expect(refusal.textContent).toBe(
      "Couldn't change the folder. Folder not found This chat still searches /Client ACME.",
    )
    expect(onThreadUpdated).not.toHaveBeenCalled()
    expect(h.loadMessages).not.toHaveBeenCalled()
    expect(within(screen.getByTestId("scope-chip")).getByText("/Client ACME")).toBeInTheDocument()
  })

  it("(6) a network failure reads `The server could not be reached.`", async () => {
    h.setThreadFolder.mockRejectedValue(new TypeError("Failed to fetch"))
    const user = userEvent.setup()
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={FOLDERS} />))
    await applyQ3(user)
    const refusal = await screen.findByTestId("scope-refusal")
    expect(refusal.textContent).toBe(
      "Couldn't change the folder. The server could not be reached. This chat still searches /Client ACME.",
    )
  })

  it("(7) while THIS thread streams the change is ALLOWED: no refetch, and the pending note is the receipt until the run ends", async () => {
    const user = userEvent.setup()
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={FOLDERS} />))
    await screen.findByTestId("scope-chip")
    act(() => useStreamsStore.setState({ streamingThreads: new Set([THREAD.id]) }))
    await applyQ3(user)
    await waitFor(() => expect(h.setThreadFolder).toHaveBeenCalledWith("thread-A", "f-q3"))
    const note = await screen.findByTestId("scope-pending-note")
    expect(note).toHaveAttribute("role", "status")
    expect(note.textContent).toBe(
      "The answer in progress keeps searching /Client ACME. /Client ACME/Q3 Contracts applies from your next message.",
    )
    expect(note).toBeVisible()
    expect(h.loadMessages).not.toHaveBeenCalled()
    act(() => useStreamsStore.setState({ streamingThreads: new Set<string>() }))
    await waitFor(() => expect(screen.queryByTestId("scope-pending-note")).toBeNull())
  })

  it("(8) the held variant of the pending note names the Expert", async () => {
    h.getScopeEffect.mockImplementation(async (_t: string, d?: { folderId: string | null }) =>
      d ? { ...HELD, saved: q3 } : HELD,
    )
    const user = userEvent.setup()
    render(shell(<ChatArea thread={{ ...THREAD, active_expert_id: "e-hr" } as Thread} onCreateThread={vi.fn()} folders={FOLDERS} />))
    await screen.findByTestId("scope-chip")
    act(() => useStreamsStore.setState({ streamingThreads: new Set([THREAD.id]) }))
    await applyQ3(user)
    const note = await screen.findByTestId("scope-pending-note")
    expect(note.textContent).toBe(
      "The answer in progress keeps its scope. /Client ACME/Q3 Contracts is saved for when HR Advisor leaves.",
    )
  })
})

describe("an Expert change re-reads the scope (§6.2)", () => {
  it("(9) the Restricted Expert leaves → the at-rest effect is read again, and no scope PATCH is sent", async () => {
    h.getScopeEffect.mockResolvedValue(HELD)
    const user = userEvent.setup()
    render(shell(<ChatArea thread={{ ...THREAD, active_expert_id: "e-hr" } as Thread} onCreateThread={vi.fn()} folders={FOLDERS} />))
    const chip = await screen.findByTestId("active-expert-chip")
    await waitFor(() => expect(h.getScopeEffect).toHaveBeenCalled())
    const before = h.getScopeEffect.mock.calls.length
    h.getScopeEffect.mockResolvedValue(AT_REST)
    await user.click(within(chip).getByRole("button", { name: /dismiss hr advisor/i }))
    await waitFor(() => expect(h.setThreadActiveExpert).toHaveBeenCalledWith("thread-A", null))
    await waitFor(() => expect(h.getScopeEffect.mock.calls.length).toBeGreaterThan(before))
    await waitFor(() => expect(within(screen.getByTestId("scope-chip")).queryByText("· not searched")).toBeNull())
    expect(h.setThreadFolder).not.toHaveBeenCalled()
  })
})
