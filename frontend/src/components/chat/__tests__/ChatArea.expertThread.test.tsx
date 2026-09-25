/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-09 / D-267-12 / D-267-14 / D-267-16 / D-267-21) —
 * ChatArea is the ONE home of every Expert change on a thread.
 *
 *   (A) D-267-21, the defect research CONFIRMED: an Expert invited on a brand-new chat was lost —
 *       the thread was created without it, the hydration effect then cleared the chip, and the
 *       first run was unscoped. The create call now carries the Expert.
 *   (B) One PATCH home: the composer only REPORTS a choice; ChatArea writes it, reverts the chip
 *       and states the server's sentence on a refusal, and refetches the transcript so the
 *       persisted event appears without a reload — unless this thread is streaming, where the
 *       run-end reconcile brings the row in (RESEARCH pitfall 11).
 *   (C) "New chat with …" is ONE request; the list is refreshed BEFORE the new thread is opened
 *       (the `startScopedChat` order), and a refusal navigates nowhere.
 *
 * Harness: the `ChatArea.model.test.tsx` shape — real `StreamsProvider`, `useMessages` and the
 * network stubbed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect, type ReactNode } from "react"
import type { ExpertBundle, Folder, Message, Thread } from "@/types"

const h = vi.hoisted(() => ({
  messages: [] as unknown[],
  loadMessages: vi.fn(),
  sendMessage: vi.fn(),
  listExperts: vi.fn(),
  getExpert: vi.fn(),
  setThreadActiveExpert: vi.fn(),
  handoffThread: vi.fn(),
  listThreads: vi.fn(),
  getExpertScopePreview: vi.fn(),
}))

vi.mock("@/lib/api/experts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/experts")>()
  return { ...actual, getExpertScopePreview: h.getExpertScopePreview }
})

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

vi.mock("@/lib/api/threads", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/threads")>()
  return { ...actual, handoffThread: h.handoffThread }
})

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
    listExperts: h.listExperts,
    getExpert: h.getExpert,
    setThreadActiveExpert: h.setThreadActiveExpert,
    listThreads: h.listThreads,
  }
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

import { ChatArea } from "../ChatArea"
import { ThreadNavigationProvider, type ThreadNavigation } from "../threadNavigation"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"
import { useThreads } from "@/hooks/useThreads"

function expert(over: Partial<ExpertBundle>): ExpertBundle {
  return {
    id: "e-x",
    name: "Expert",
    slug: "expert",
    description: "Helps.",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: ["f-1"],
    prompt_suggestions: [],
    visibility: "org",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}
const FA = expert({ id: "e-fa", name: "Financial Analyzer", slug: "financial-analyzer" })
const CR = expert({ id: "e-cr", name: "Contract Reviewer", slug: "contract-reviewer" })

const THREAD: Thread = {
  id: "thread-A",
  title: "Q3 board prep",
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
} as Thread

const TALK: Message[] = [
  { id: "u1", thread_id: "thread-A", user_id: "user-1", role: "user", content: "Q3?", created_at: "2026-09-25T10:00:01Z", updated_at: "2026-09-25T10:00:01Z" },
  { id: "a1", thread_id: "thread-A", user_id: "user-1", role: "assistant", content: "Up 9%.", created_at: "2026-09-25T10:00:02Z", updated_at: "2026-09-25T10:00:02Z", runStatus: "completed" },
]

function shell(ui: ReactNode, nav?: ThreadNavigation) {
  const inner = <StreamsProvider>{ui}</StreamsProvider>
  return (
    <TooltipProvider>
      {nav ? <ThreadNavigationProvider value={nav}>{inner}</ThreadNavigationProvider> : inner}
    </TooltipProvider>
  )
}

async function openInvite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("composer-plus-btn"))
  await user.click(screen.getByTestId("invite-expert-door"))
  await screen.findByTestId("invite-expert-dialog")
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  h.messages = []
  h.loadMessages.mockResolvedValue(undefined)
  h.sendMessage.mockResolvedValue(undefined)
  h.listExperts.mockResolvedValue([FA, CR])
  // A preview that narrows nothing (a thread folder is set), unless a case says otherwise.
  h.getExpertScopePreview.mockResolvedValue({
    expert_id: "e-x",
    expert_name: "Expert",
    mode: "biased",
    expert_folders: [],
    thread_folder: { id: "tf", name: "Folder", doc_count: 0 },
    excluded_count: 0,
    excluded_names: [],
  })
  h.getExpert.mockImplementation(async (id: string) => (id === FA.id ? FA : CR))
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

describe("(A) D-267-21 — an invite on a brand-new chat reaches the created thread", () => {
  it("(1) the create call carries the Expert, and the chip survives the created thread's hydration", async () => {
    const created: Thread = { ...THREAD, id: "thread-new", active_expert_id: CR.id } as Thread
    const onCreateThread = vi.fn().mockResolvedValue(created)
    const user = userEvent.setup()
    const { rerender } = render(shell(<ChatArea thread={null} onCreateThread={onCreateThread} folders={[]} />))
    await openInvite(user)
    await user.click(await screen.findByTestId("invite-expert-btn-contract-reviewer"))
    // no thread yet → nothing to PATCH
    expect(h.setThreadActiveExpert).not.toHaveBeenCalled()
    await user.type(screen.getByRole("textbox"), "Review the MSA{Enter}")
    await waitFor(() => expect(onCreateThread).toHaveBeenCalledTimes(1))
    expect(onCreateThread).toHaveBeenCalledWith(null, CR.id)
    rerender(shell(<ChatArea thread={created} onCreateThread={onCreateThread} folders={[]} />))
    await waitFor(() => expect(h.getExpert).toHaveBeenCalledWith(CR.id))
    const chip = await screen.findByTestId("active-expert-chip")
    expect(chip.textContent).toContain("Contract Reviewer")
  })
})

// 267-REVIEW WR-01 — POST /threads now runs the binding gate, so a create can be refused by an
// ordinary gate outcome (no org, tier, revoked access). The composer used to fire `onSend` without
// awaiting it and then clear the textbox, the attachments and the draft: the rejection went
// unhandled, the typed message was gone and the server's sentence was shown nowhere.
describe("(A2) WR-01 — a refused create keeps the message and states the reason", () => {
  it("(1b) the refusal is shown, the typed text is back in the composer, and nothing is sent", async () => {
    const onCreateThread = vi
      .fn()
      .mockRejectedValue(new ApiError("Choose an organization before inviting an Expert.", 403))
    const user = userEvent.setup()
    render(shell(<ChatArea thread={null} onCreateThread={onCreateThread} folders={[]} />))
    await openInvite(user)
    await user.click(await screen.findByTestId("invite-expert-btn-contract-reviewer"))
    await user.type(screen.getByRole("textbox"), "Review the MSA{Enter}")
    await waitFor(() => expect(onCreateThread).toHaveBeenCalledTimes(1))
    const alert = await screen.findByTestId("expert-change-error")
    expect(alert).toHaveAttribute("role", "alert")
    expect(alert.textContent).toBe("Choose an organization before inviting an Expert.")
    expect(alert).toBeVisible()
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Review the MSA"))
    expect(h.sendMessage).not.toHaveBeenCalled()
  })
})

describe("(B) one PATCH home", () => {
  it("(2) the composer never PATCHes — MessageInput.tsx no longer imports the call", async () => {
    const src = (await import("../MessageInput.tsx?raw")).default as string
    expect(src.length).toBeGreaterThan(1000)
    expect(src).not.toMatch(/setThreadActiveExpert/)
    const area = (await import("../ChatArea.tsx?raw")).default as string
    expect(area).toMatch(/onCreateThread\(scopeFolderId, activeExpert/)
  })

  it("(3) selecting an Expert on a thread PATCHes ONCE, then refetches the transcript once", async () => {
    const user = userEvent.setup()
    render(shell(<ChatArea thread={THREAD} onCreateThread={vi.fn()} folders={[]} />))
    await openInvite(user)
    await user.click(await screen.findByTestId("invite-expert-btn-contract-reviewer"))
    await waitFor(() => expect(h.setThreadActiveExpert).toHaveBeenCalledTimes(1))
    expect(h.setThreadActiveExpert).toHaveBeenCalledWith(THREAD.id, CR.id)
    await waitFor(() => expect(h.loadMessages).toHaveBeenCalledTimes(1))
    expect(h.loadMessages).toHaveBeenCalledWith(THREAD.id)
  })

  it("(4) dismissing PATCHes null ONCE", async () => {
    const user = userEvent.setup()
    render(
      shell(<ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await screen.findByTestId("active-expert-chip")
    const chip = screen.getByTestId("active-expert-chip")
    await user.click(within(chip).getByRole("button", { name: /dismiss financial analyzer/i }))
    await waitFor(() => expect(h.setThreadActiveExpert).toHaveBeenCalledTimes(1))
    expect(h.setThreadActiveExpert).toHaveBeenCalledWith(THREAD.id, null)
  })

  it("(5) a refusal reverts the chip to the previous Expert and states the server's sentence", async () => {
    h.messages = TALK
    h.setThreadActiveExpert.mockRejectedValue(
      new ApiError("Choose an organization before inviting an Expert.", 403),
    )
    const user = userEvent.setup()
    render(
      shell(<ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await screen.findByTestId("active-expert-chip")
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-replace-btn-contract-reviewer"))
    const alert = await screen.findByTestId("expert-change-error")
    expect(alert).toHaveAttribute("role", "alert")
    expect(alert.textContent).toBe("Choose an organization before inviting an Expert.")
    expect(alert).toBeVisible()
    await waitFor(() =>
      expect(screen.getByTestId("active-expert-chip").textContent).toContain("Financial Analyzer"),
    )
    expect(h.loadMessages).not.toHaveBeenCalled()
  })

  // 267-REVIEW WR-02 — the refusal belongs to the thread it was made on. It used to be cleared only
  // by the next Expert change, so a role="alert" sentence about thread A stayed above B's composer.
  it("(5b) a refusal on thread A is gone once thread B is open", async () => {
    h.messages = TALK
    h.setThreadActiveExpert.mockRejectedValue(
      new ApiError("Choose an organization before inviting an Expert.", 403),
    )
    const user = userEvent.setup()
    const { rerender } = render(
      shell(<ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await screen.findByTestId("active-expert-chip")
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-replace-btn-contract-reviewer"))
    await screen.findByTestId("expert-change-error")
    rerender(
      shell(<ChatArea thread={{ ...THREAD, id: "thread-B", title: "Other" } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await waitFor(() => expect(screen.queryByTestId("expert-change-error")).toBeNull())
  })

  // 267-REVIEW WR-04 — this case used to read "(6) while THIS thread is streaming, a successful
  // change does not refetch": it pinned the defect. A change written while a run streams lands its
  // event row ABOVE the answer the previous Expert is still producing (the assistant row is written
  // at run end), so the event's `Now` line described an answer it did not produce. The change is now
  // refused in the ONE home with a visible reason (and the server answers 409 for the same state).
  it("(6) while THIS thread is streaming, removing the Expert is refused with a visible reason and no PATCH", async () => {
    const user = userEvent.setup()
    render(
      shell(<ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await screen.findByTestId("active-expert-chip")
    act(() => {
      useStreamsStore.setState({ streamingThreads: new Set([THREAD.id]) })
    })
    const chip = screen.getByTestId("active-expert-chip")
    await user.click(within(chip).getByRole("button", { name: /dismiss financial analyzer/i }))
    const alert = await screen.findByTestId("expert-change-error")
    expect(alert).toHaveAttribute("role", "alert")
    expect(alert.textContent).toBe("Wait for this answer to finish before changing the Expert.")
    expect(alert).toBeVisible()
    expect(h.setThreadActiveExpert).not.toHaveBeenCalled()
    expect(screen.getByTestId("active-expert-chip").textContent).toContain("Financial Analyzer")
    expect(h.loadMessages).not.toHaveBeenCalled()
  })

  it("(6b) while THIS thread is streaming, Replace is refused the same way", async () => {
    h.messages = TALK
    const user = userEvent.setup()
    render(
      shell(<ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />),
    )
    await screen.findByTestId("active-expert-chip")
    act(() => {
      useStreamsStore.setState({ streamingThreads: new Set([THREAD.id]) })
    })
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-replace-btn-contract-reviewer"))
    const alert = await screen.findByTestId("expert-change-error")
    expect(alert.textContent).toBe("Wait for this answer to finish before changing the Expert.")
    expect(h.setThreadActiveExpert).not.toHaveBeenCalled()
    expect(screen.getByTestId("active-expert-chip").textContent).toContain("Financial Analyzer")
  })
})

describe("(C) New chat with … — one request, refresh BEFORE open, refusal navigates nowhere", () => {
  it("(7) one handoff call with the composer's model; refreshThreads resolves before openThread", async () => {
    h.messages = TALK
    const newThread = { ...THREAD, id: "thread-B", title: "Contract Reviewer · Q3 board prep" } as Thread
    h.handoffThread.mockResolvedValue(newThread)
    const order: string[] = []
    const nav: ThreadNavigation = {
      findThread: () => null,
      refreshThreads: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 5))
        order.push("refresh")
      }),
      openThread: vi.fn(() => {
        order.push("open")
      }),
    }
    const user = userEvent.setup()
    render(
      shell(
        <ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />,
        nav,
      ),
    )
    await screen.findByTestId("active-expert-chip")
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-handoff-btn-contract-reviewer"))
    await waitFor(() => expect(nav.openThread).toHaveBeenCalledTimes(1))
    expect(h.handoffThread).toHaveBeenCalledTimes(1)
    const [tid, eid, opts] = h.handoffThread.mock.calls[0]
    expect(tid).toBe(THREAD.id)
    expect(eid).toBe(CR.id)
    expect(opts).toHaveProperty("model")
    expect(opts).toHaveProperty("provider")
    expect(order).toEqual(["refresh", "open"])
    expect(nav.openThread).toHaveBeenCalledWith(newThread)
    // a handoff never PATCHes the source thread
    expect(h.setThreadActiveExpert).not.toHaveBeenCalled()
  })

  it("(8) a refusal is shown in the dialog and nothing navigates", async () => {
    h.messages = TALK
    h.handoffThread.mockRejectedValue(new ApiError("This chat could not be summarised.", 502))
    const nav: ThreadNavigation = {
      findThread: () => null,
      refreshThreads: vi.fn(async () => {}),
      openThread: vi.fn(),
    }
    const user = userEvent.setup()
    render(
      shell(
        <ChatArea thread={{ ...THREAD, active_expert_id: FA.id } as Thread} onCreateThread={vi.fn()} folders={[]} />,
        nav,
      ),
    )
    await screen.findByTestId("active-expert-chip")
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-handoff-btn-contract-reviewer"))
    const alert = await screen.findByTestId("handoff-refusal")
    expect(alert.textContent).toBe(
      "Couldn't start a new chat with Contract Reviewer. This chat could not be summarised. Nothing was created.",
    )
    expect(nav.refreshThreads).not.toHaveBeenCalled()
    expect(nav.openThread).not.toHaveBeenCalled()
  })
})

// 267-REVIEW CR-01 — the thread list must hold the SERVER's answer after an Expert change. The
// change PATCHed the thread and threw the returned row away, and `useThreads` had no updater for
// `active_expert_id`; so swap A→B on T, open U, come back to T, and `selectThread` handed ChatArea
// the stale list object: the hydration effect loaded A, the chip said A, the server (and the next
// run) had B, and the persisted "A → B" event card directly above contradicted the chip.
//
// The harness is the pair ChatLayout wires: the REAL `useThreads` hook and the REAL ChatArea, with
// only the network stubbed. Case (10) pins that ChatLayout passes the same updater.
describe("(D) CR-01 — the list holds the server's Expert after a change", () => {
  const T: Thread = { ...THREAD, id: "thread-T", active_expert_id: FA.id } as Thread
  const U: Thread = { ...THREAD, id: "thread-U", title: "Other", active_expert_id: null } as Thread

  function Parent() {
    const api = useThreads()
    const { loadThreads } = api
    useEffect(() => {
      void loadThreads()
    }, [loadThreads])
    return (
      <>
        {api.threads.map((t) => (
          <button key={t.id} type="button" data-testid={`pick-${t.id}`} onClick={() => api.selectThread(t)}>
            {t.title}
          </button>
        ))}
        <ChatArea
          thread={api.selectedThread}
          onCreateThread={api.newThread}
          onThreadUpdated={api.patchThread}
          folders={[]}
        />
      </>
    )
  }

  it("(9) swap A→B on T, open U, come back to T: the chip says B", async () => {
    h.messages = TALK
    h.listThreads.mockResolvedValue([T, U])
    const user = userEvent.setup()
    render(shell(<Parent />))
    await user.click(await screen.findByTestId("pick-thread-T"))
    await waitFor(() =>
      expect(screen.getByTestId("active-expert-chip").textContent).toContain("Financial Analyzer"),
    )
    await openInvite(user)
    await user.click(await screen.findByTestId("expert-replace-btn-contract-reviewer"))
    await waitFor(() => expect(h.setThreadActiveExpert).toHaveBeenCalledWith(T.id, CR.id))
    await waitFor(() =>
      expect(screen.getByTestId("active-expert-chip").textContent).toContain("Contract Reviewer"),
    )

    await user.click(screen.getByTestId("pick-thread-U"))
    await waitFor(() => expect(screen.queryByTestId("active-expert-chip")).toBeNull())
    await user.click(screen.getByTestId("pick-thread-T"))
    await waitFor(() => expect(h.getExpert).toHaveBeenLastCalledWith(CR.id))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId("active-expert-chip").textContent).toContain("Contract Reviewer")
  })

  it("(9b) removing the Expert, then leaving and coming back, does not bring it back", async () => {
    h.listThreads.mockResolvedValue([T, U])
    const user = userEvent.setup()
    render(shell(<Parent />))
    await user.click(await screen.findByTestId("pick-thread-T"))
    const chip = await screen.findByTestId("active-expert-chip")
    await user.click(within(chip).getByRole("button", { name: /dismiss financial analyzer/i }))
    await waitFor(() => expect(h.setThreadActiveExpert).toHaveBeenCalledWith(T.id, null))
    await user.click(screen.getByTestId("pick-thread-U"))
    await user.click(screen.getByTestId("pick-thread-T"))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId("active-expert-chip")).toBeNull()
  })

  it("(10) ChatLayout hands ChatArea the list's own updater", async () => {
    const layout = (await import("../../layout/ChatLayout.tsx?raw")).default as string
    expect(layout.length).toBeGreaterThan(1000)
    expect(layout).toMatch(/onThreadUpdated=\{patchThread\}/)
  })
})

// 267-REVIEW WR-06 (D-267-35) — the catalog Start Chat door: an empty thread with no folder, bound
// to a biased Expert. No event is written there (D-267-12); the spotlight must state the narrowing.
describe("(E) WR-06 — the empty unscoped thread's spotlight states D-267-35", () => {
  it("(11) the spotlight shows Won't use · All your documents at rest", async () => {
    h.getExpertScopePreview.mockResolvedValue({
    expert_id: "e-cr",
    expert_name: "Contract Reviewer",
    mode: "biased",
    expert_folders: [{ id: "f1", name: "Contracts" }],
    thread_folder: null,
    excluded_count: 0,
    excluded_names: [],
  })
    render(
      shell(
        <ChatArea
          thread={{ ...THREAD, id: "thread-S", active_expert_id: CR.id, folder_id: null } as Thread}
          onCreateThread={vi.fn()}
          folders={[]}
        />,
      ),
    )
    await screen.findByTestId("expert-spotlight-card")
    const wont = await screen.findByTestId("scope-ledger-col-no")
    expect(wont.textContent).toContain("All your documents")
    expect(wont).toBeVisible()
    expect(h.getExpertScopePreview).toHaveBeenCalledWith(CR.id, null)
  })
})

// 267-REVIEW WR-07 — before the first message the dialog says "This chat · /Client ACME", but the
// preview was asked with no thread and no folder, so a restricted row stated nothing excluded; the
// thread handleSend then creates carries the folder and the run excludes its documents. The picked
// folder now travels with the preview request when there is no thread yet.
describe("(F) WR-07 — a brand-new chat's picked folder reaches the restricted preview", () => {
  it("(12) pick a folder, open the invite: the restricted row's preview is asked about THAT folder", async () => {
    const HR = expert({ id: "e-hr", name: "HR Advisor", slug: "hr-advisor", scope_mode: "restricted" })
    h.listExperts.mockResolvedValue([HR])
    const ACME = { id: "f-acme", name: "Client ACME" } as Folder
    const user = userEvent.setup()
    render(shell(<ChatArea thread={null} onCreateThread={vi.fn()} folders={[ACME]} />))
    await user.selectOptions(screen.getByRole("combobox"), "f-acme")
    await openInvite(user)
    await waitFor(() => expect(h.getExpertScopePreview).toHaveBeenCalled())
    expect(h.getExpertScopePreview).toHaveBeenCalledWith(HR.id, null, "f-acme")
  })
})
