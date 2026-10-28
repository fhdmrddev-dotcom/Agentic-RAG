/**
 * Phase 299-02 (LINK-02 / D-02, D-32; RESEARCH Pattern 3, Pitfalls 4-5) — THE OPEN THREAD LIVES IN
 * THE ADDRESS.
 *
 * `useThreadAddress` binds ChatLayout's selected thread to `/app/chat/<id>` both ways, without
 * touching StreamsProvider and without a router hook of its own (D-08: it is handed `entityLink`).
 *
 * Two harnesses:
 *   • REAL ROUTER — `useAppNavigation` + a `useState` thread selection + this hook, under a memory
 *     router in StrictMode (the exact tree shape main.tsx mounts). Every history entry the router
 *     commits is counted by location key, so a binding that writes two entries (or one where none is
 *     owed — a cold load, a Back) reds here (Pitfall 4: ping-pong / double entries).
 *   • FAKE LINK — the hook alone with a recording `entityLink`, for the call-count cases the router
 *     cannot attribute (leaveThread called once, never during an org change; inert without a link).
 */
import { StrictMode, createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import type { Thread } from "@/types"
import { useAppNavigation, type AppNavigation, type EntityLink } from "../useAppNavigation"
import { useThreadAddress } from "../useThreadAddress"
import hookSource from "../useThreadAddress.ts?raw"

const A = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e61"
const B = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e62"
const N = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e63"
const ORG_1 = "org-299-one"
const ORG_2 = "org-299-two"

function thread(id: string): Thread {
  return { id, user_id: "u", title: `Thread ${id.slice(-2)}`, folder_id: null, created_at: "", updated_at: "" }
}

// ── The real-router harness ─────────────────────────────────────────────────────────────────
interface ListState {
  threads: Thread[]
  pending: boolean
  org: string | null
}
const ListCtx = createContext<ListState>({ threads: [], pending: false, org: ORG_1 })

const box: {
  nav: AppNavigation | null
  selected: Thread | null
  select: ((t: Thread | null) => void) | null
  open: ((t: Thread) => void) | null
  holding: boolean
  selectCalls: Array<string | null>
} = { nav: null, selected: null, select: null, open: null, holding: false, selectCalls: [] }

function Harness() {
  const list = useContext(ListCtx)
  const nav = useAppNavigation()
  const [selected, setSelected] = useState<Thread | null>(null)
  const selectThread = useCallback((t: Thread | null) => {
    box.selectCalls.push(t?.id ?? null)
    setSelected(t)
  }, [])
  const target = nav.entityLink.target
  const { openThread, holding } = useThreadAddress({
    threadId: target?.kind === "thread" ? target.id : null,
    onChatView: nav.activeView === "chat",
    threads: list.threads,
    threadsPending: list.pending,
    selectedThread: selected,
    selectThread,
    entityLink: nav.entityLink,
    activeOrgId: list.org,
  })
  box.nav = nav
  box.selected = selected
  box.select = selectThread
  box.open = openThread
  box.holding = holding
  return null
}

function mount(entry: string, initial: ListState) {
  const router = createMemoryRouter([{ path: "*", Component: Harness }], { initialEntries: [entry] })
  const pushed = new Set<string>()
  const replaced = new Set<string>()
  router.subscribe((state) => {
    if (state.historyAction === "PUSH") pushed.add(state.location.key)
    if (state.historyAction === "REPLACE") replaced.add(state.location.key)
  })
  const tree = (list: ListState): ReactNode => (
    <StrictMode>
      <ListCtx.Provider value={list}>
        <RouterProvider router={router} />
      </ListCtx.Provider>
    </StrictMode>
  )
  const view = render(tree(initial))
  return {
    router,
    setList: (list: ListState) => view.rerender(tree(list)),
    pushes: () => pushed.size,
    replaces: () => replaced.size,
    where: () => `${router.state.location.pathname}${router.state.location.search}`,
  }
}

const nav = () => {
  if (!box.nav) throw new Error("the harness has not rendered")
  return box.nav
}
const flush = () => act(async () => {})

afterEach(() => {
  cleanup()
  box.nav = null
  box.selected = null
  box.select = null
  box.open = null
  box.holding = false
  box.selectCalls = []
})

describe("useThreadAddress — a thread address opens its thread (D-02, Pitfall 5)", () => {
  it("cold /app/chat/A while the list is pending: holding, nothing selected; once it settles with A, A is selected once and no entry is written", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [], pending: true, org: ORG_1 })
    await flush()
    expect(box.holding).toBe(true)
    expect(box.selected).toBeNull()
    expect(box.selectCalls).toEqual([])
    h.setList({ threads: [thread(A), thread(B)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    await flush()
    expect(box.holding).toBe(false)
    expect(box.selectCalls).toEqual([A])
    expect(h.pushes()).toBe(0)
    expect(h.replaces()).toBe(0)
    expect(h.where()).toBe(`/app/chat/${A}`)
  })

  it("a settled list that does NOT contain the address's thread leaves holding true (299-03's resolver decides)", async () => {
    mount(`/app/chat/${A}`, { threads: [thread(B)], pending: false, org: ORG_1 })
    await flush()
    expect(box.holding).toBe(true)
    expect(box.selected).toBeNull()
    expect(box.selectCalls).toEqual([])
  })

  it("a list refetch (same org, a new array) does not re-run the URL → selection binding", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    expect(box.selectCalls).toEqual([A])
    h.setList({ threads: [thread(A), thread(B)], pending: false, org: ORG_1 })
    await flush()
    h.setList({ threads: [thread(B), thread(A)], pending: false, org: ORG_1 })
    await flush()
    expect(box.selectCalls).toEqual([A])
  })

  it("the chat home (/app) is never holding", async () => {
    mount("/app", { threads: [], pending: true, org: ORG_1 })
    await flush()
    expect(box.holding).toBe(false)
  })
})

describe("useThreadAddress — picking, creating and launching write ONE entry (D-02, D-32)", () => {
  it("picking thread B on the chat view pushes /app/chat/B — exactly one entry", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A), thread(B)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => box.select!(thread(B)))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${B}`))
    await flush()
    expect(h.pushes()).toBe(1)
    expect(box.selected?.id).toBe(B)
  })

  it("New chat on the chat home pushes /app/chat/<newId> (D-32) — one entry", async () => {
    const h = mount("/app", { threads: [], pending: false, org: ORG_1 })
    await flush()
    // useThreads.newThread creates a REAL thread and selects it.
    act(() => box.select!(thread(N)))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${N}`))
    await flush()
    expect(h.pushes()).toBe(1)
    expect(box.holding).toBe(false)
  })

  it("openThread(thread) from the Library writes one entry and lands on that thread", async () => {
    const h = mount("/app/library", { threads: [thread(A)], pending: false, org: ORG_1 })
    await flush()
    act(() => box.open!(thread(N)))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${N}`))
    await flush()
    expect(h.pushes()).toBe(1)
    expect(box.selected?.id).toBe(N)
    expect(box.holding).toBe(false)
  })

  it("a selection made OFF the chat view, then the legacy Chat call, lands on the new thread with one entry (no stale thread)", async () => {
    // The Ask-in-chat / palette / run-page shape: select (or create) a thread elsewhere, then
    // onNavigate("chat"). The rail would return to the LAST thread address (A); the person asked
    // for N, so the binding corrects the address in place (a replace, not a second push).
    const h = mount(`/app/chat/${A}`, { threads: [thread(A), thread(N)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(h.where()).toBe("/app/library"))
    const before = h.pushes()
    act(() => {
      box.select!(thread(N))
      nav().onNavigate("chat")
    })
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${N}`))
    await flush()
    expect(h.pushes() - before).toBe(1)
    expect(box.selected?.id).toBe(N)
    await act(() => h.router.navigate(-1))
    await waitFor(() => expect(h.where()).toBe("/app/library"))
  })

  it("the rail's Chat from the Library returns to the open thread with one entry and no re-selection", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => nav().onNavigate("documents"))
    await waitFor(() => expect(h.where()).toBe("/app/library"))
    const before = h.pushes()
    act(() => nav().onNavigate("chat"))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${A}`))
    await flush()
    expect(h.pushes() - before).toBe(1)
    expect(box.selectCalls).toEqual([A])
  })
})

describe("useThreadAddress — Back and Forward move the selection, never the history (D-02)", () => {
  it("Back from /app/chat/B to /app/chat/A selects A and pushes nothing", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A), thread(B)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => box.select!(thread(B)))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${B}`))
    const pushes = h.pushes()
    await act(() => h.router.navigate(-1))
    await waitFor(() => expect(box.selected?.id).toBe(A))
    await flush()
    expect(h.where()).toBe(`/app/chat/${A}`)
    expect(h.pushes()).toBe(pushes)
  })

  it("Back to the chat home deselects", async () => {
    const h = mount("/app", { threads: [thread(A)], pending: false, org: ORG_1 })
    await flush()
    act(() => box.select!(thread(A)))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${A}`))
    await act(() => h.router.navigate(-1))
    await waitFor(() => expect(h.where()).toBe("/app"))
    await waitFor(() => expect(box.selected).toBeNull())
    expect(box.selectCalls.at(-1)).toBeNull()
  })

  it("a plain deselect on a thread address REPLACES it with /app — no push", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => box.select!(null))
    await waitFor(() => expect(h.where()).toBe("/app"))
    await flush()
    expect(h.router.state.historyAction).toBe("REPLACE")
    expect(h.pushes()).toBe(0)
  })
})

describe("useThreadAddress — the IN-01 org-change reset never drops the address (revision 1)", () => {
  it("thread A selected, address /app/chat/B: an org change + IN-01's deselect keep /app/chat/B; the new org's B is selected once it settles", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    act(() => nav().entityLink.openThread(B))
    await waitFor(() => expect(h.where()).toBe(`/app/chat/${B}`))
    await flush()
    expect(box.selected?.id).toBe(A) // B is not in org 1's list: holding
    expect(box.holding).toBe(true)
    h.setList({ threads: [], pending: true, org: ORG_2 })
    await flush()
    act(() => box.select!(null)) // ChatLayout's IN-01 effect
    await flush()
    expect(h.where()).toBe(`/app/chat/${B}`)
    expect(box.holding).toBe(true)
    h.setList({ threads: [thread(B)], pending: false, org: ORG_2 })
    await waitFor(() => expect(box.selected?.id).toBe(B))
    expect(h.where()).toBe(`/app/chat/${B}`)
    expect(box.holding).toBe(false)
  })

  it("/app/chat/A with A selected: an org change away and back keeps /app/chat/A and re-selects A", async () => {
    const h = mount(`/app/chat/${A}`, { threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    h.setList({ threads: [], pending: true, org: ORG_2 })
    await flush()
    act(() => box.select!(null))
    await flush()
    expect(h.where()).toBe(`/app/chat/${A}`)
    expect(box.holding).toBe(true)
    h.setList({ threads: [thread(B)], pending: false, org: ORG_2 })
    await flush()
    expect(h.where()).toBe(`/app/chat/${A}`)
    expect(box.holding).toBe(true)
    h.setList({ threads: [], pending: true, org: ORG_1 })
    await flush()
    h.setList({ threads: [thread(A)], pending: false, org: ORG_1 })
    await waitFor(() => expect(box.selected?.id).toBe(A))
    expect(h.where()).toBe(`/app/chat/${A}`)
    expect(h.replaces()).toBe(0)
  })
})

// ── The fake-link harness ───────────────────────────────────────────────────────────────────
function fakeLink(threadId: string | null): EntityLink & {
  openThread: ReturnType<typeof vi.fn>
  leaveThread: ReturnType<typeof vi.fn>
} {
  return {
    target: threadId ? { kind: "thread", id: threadId } : null,
    route: threadId ? { view: "chat", threadId } : null,
    openThread: vi.fn(),
    openWorkflow: vi.fn(),
    openExpert: vi.fn(),
    leaveThread: vi.fn(),
  }
}

interface HookProps {
  threadId: string | null
  selected: Thread | null
  org: string | null
  pending: boolean
}

describe("useThreadAddress — leaveThread is a person's deselect, never IN-01's (fake link)", () => {
  function setup(initial: HookProps) {
    const link = fakeLink(initial.threadId)
    const selectThread = vi.fn()
    const view = renderHook(
      (p: HookProps) =>
        useThreadAddress({
          threadId: p.threadId,
          onChatView: true,
          threads: [thread(A), thread(B)],
          threadsPending: p.pending,
          selectedThread: p.selected,
          selectThread,
          entityLink: link,
          activeOrgId: p.org,
        }),
      { initialProps: initial },
    )
    return { link, selectThread, view }
  }

  it("org unchanged: deselecting the address's thread calls leaveThread exactly once", () => {
    const { link, view } = setup({ threadId: A, selected: thread(A), org: ORG_1, pending: false })
    view.rerender({ threadId: A, selected: null, org: ORG_1, pending: false })
    expect(link.leaveThread).toHaveBeenCalledTimes(1)
    expect(link.openThread).not.toHaveBeenCalled()
  })

  it("an org change followed by IN-01's deselect does NOT call leaveThread", () => {
    const { link, view } = setup({ threadId: A, selected: thread(A), org: ORG_1, pending: false })
    view.rerender({ threadId: A, selected: thread(A), org: ORG_2, pending: true })
    view.rerender({ threadId: A, selected: null, org: ORG_2, pending: true })
    expect(link.leaveThread).not.toHaveBeenCalled()
    expect(link.openThread).not.toHaveBeenCalled()
  })

  it("once the new org's list has settled, a later deselect IS a person's again (leaveThread once)", () => {
    const { link, selectThread, view } = setup({ threadId: A, selected: thread(A), org: ORG_1, pending: false })
    view.rerender({ threadId: A, selected: thread(A), org: ORG_2, pending: true })
    view.rerender({ threadId: A, selected: null, org: ORG_2, pending: true })
    view.rerender({ threadId: A, selected: null, org: ORG_2, pending: false })
    expect(selectThread).toHaveBeenCalledWith(expect.objectContaining({ id: A }))
    view.rerender({ threadId: A, selected: thread(A), org: ORG_2, pending: false })
    view.rerender({ threadId: A, selected: null, org: ORG_2, pending: false })
    expect(link.leaveThread).toHaveBeenCalledTimes(1)
  })

  it("deselecting a thread the address does NOT name leaves the address alone", () => {
    const { link, view } = setup({ threadId: B, selected: thread(A), org: ORG_1, pending: false })
    // B is in the list, so it gets selected first; force the other shape directly:
    view.rerender({ threadId: B, selected: thread(A), org: ORG_1, pending: false })
    link.leaveThread.mockClear()
    view.rerender({ threadId: B, selected: null, org: ORG_1, pending: false })
    expect(link.leaveThread).not.toHaveBeenCalled()
  })

  it("holding is true exactly while the address's thread is not the selection", () => {
    const { view } = setup({ threadId: A, selected: null, org: ORG_1, pending: true })
    expect(view.result.current.holding).toBe(true)
    view.rerender({ threadId: A, selected: thread(A), org: ORG_1, pending: false })
    expect(view.result.current.holding).toBe(false)
    view.rerender({ threadId: null, selected: thread(A), org: ORG_1, pending: false })
    expect(view.result.current.holding).toBe(false)
  })
})

describe("useThreadAddress — without a link it is inert (suites mounting ChatLayout alone)", () => {
  it("openThread selects and calls the legacy chat navigator once; nothing else is written", () => {
    const selectThread = vi.fn()
    const legacyOpenChat = vi.fn()
    const view = renderHook(() =>
      useThreadAddress({
        threadId: null,
        onChatView: true,
        threads: [thread(A)],
        threadsPending: false,
        selectedThread: null,
        selectThread,
        entityLink: undefined,
        activeOrgId: ORG_1,
        legacyOpenChat,
      }),
    )
    expect(view.result.current.holding).toBe(false)
    act(() => view.result.current.openThread(thread(A)))
    expect(selectThread).toHaveBeenCalledTimes(1)
    expect(selectThread).toHaveBeenCalledWith(expect.objectContaining({ id: A }))
    expect(legacyOpenChat).toHaveBeenCalledTimes(1)
  })
})

/** Line-anchored comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("useThreadAddress — what it must never do, as source (D-02, D-08)", () => {
  it("never calls setViewingThread, never touches the streams provider, never a router hook", () => {
    const code = codeOf(hookSource)
    // Non-vacuity: the stripped source is the real module.
    expect(code).toContain("export function useThreadAddress")
    expect(code).not.toContain("setViewingThread")
    expect(code).not.toMatch(/StreamsProvider|useStreamActions|streamsStore/)
    expect(code).not.toMatch(/react-router|useLocation|useNavigate|useBlocker/)
    expect(code).not.toMatch(/window\.history|location\.(assign|replace|href)/)
  })
})
