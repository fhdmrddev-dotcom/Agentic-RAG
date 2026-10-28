/**
 * Phase 299-03 (LINK-04 / LINK-05 / LINK-06; D-06..D-09 client, D-12..D-17, D-24) — THE ONE GATE.
 *
 * Every entity address passes through `LinkGate` before its page opens. It asks the server once
 * per kind:id, then the decision is one of: hold (the answer is not in yet), can't be opened (the
 * server's one 404), switch? (the item is in another of the person's orgs), or open.
 *
 * The harness: the org is a `vi.hoisted` value behind `useOrgOptional` (the ElsewhereLine.test.tsx
 * idiom), `resolveLink` is mocked, and the entity navigators are a fake that records its calls.
 * The child render-prop prints the decision as WORDS, so a case reads what the switch would draw.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { StrictMode, useEffect, useRef, useState } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

const org = vi.hoisted(() => ({
  value: null as null | {
    activeOrgId: string | null
    orgs: { org_id: string; name: string; role: string }[]
    loading: boolean
    switchOrg: (id: string) => void
  },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

const client = vi.hoisted(() => ({ resolveLink: vi.fn() }))
vi.mock("@/lib/api/links", () => ({ resolveLink: client.resolveLink }))

import { LinkGate, HOLDING_SENTENCE, type GateState } from "../LinkGate"
import { COPY_LOADING } from "@/pages/WorkflowRunPage"
import type { EntityLink } from "@/hooks/useAppNavigation"
import type { AppRoute } from "@/lib/appRoutes"
import type { Thread } from "@/types"
import gateSource from "../LinkGate.tsx?raw"
// Task 3: the prompt the gate hands the switch, the store it snapshots, and the real address
// binding the end-to-end case runs.
import { SwitchOrgPrompt } from "../SwitchOrgPrompt"
import { useStreamsStore } from "@/stores/streamsStore"
import { useAppNavigation } from "@/hooks/useAppNavigation"
import { useThreadAddress } from "@/hooks/useThreadAddress"

const ID = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e71"
const OTHER = "5d0c2a9e-3b1f-4c6d-8e7a-1f2b3c4d5e72"
const ORGS = [
  { org_id: "A", name: "Northwind", role: "owner" },
  { org_id: "B", name: "Acme Legal", role: "member" },
]

type Kind = "thread" | "workflow" | "run" | "expert"
function routeOf(kind: Kind, id: string): AppRoute {
  if (kind === "thread") return { view: "chat", threadId: id }
  if (kind === "workflow") return { view: "workflows", definitionId: id }
  if (kind === "run") return { view: "workflow-run", runId: id }
  return { view: "experts", bundleId: id }
}

function fakeLink(kind: Kind | null, id = ID): EntityLink {
  return {
    target: kind === null ? null : { kind, id },
    route: kind === null ? null : routeOf(kind, id),
    address: kind === null ? "/app" : `/app/x/${id}`,
    openThread: vi.fn(),
    openWorkflow: vi.fn(),
    openExpert: vi.fn(),
    leaveThread: vi.fn(),
    leave: vi.fn(),
    openRoute: vi.fn(),
    resume: vi.fn(),
  }
}

function thread(id: string, title = "Thread"): Thread {
  return { id, user_id: "u", title, folder_id: null, created_at: "", updated_at: "" }
}

function target(over: Record<string, unknown> = {}) {
  return {
    kind: "run",
    id: ID,
    org_id: "A",
    org_name: "Northwind",
    title: "Contract review",
    state: null,
    audience: "only_you",
    ...over,
  }
}

/** Prints the decision in words. */
function Probe({ gate }: { gate: GateState }) {
  const parts: string[] = [gate.status]
  if (gate.status !== "none") parts.push(gate.kind)
  if (gate.status === "holding") parts.push(gate.sentence)
  if (gate.status === "cant") parts.push(JSON.stringify(gate.route))
  if (gate.status === "prompt") parts.push(gate.target.org_name ?? "")
  return <p data-testid="gate">{parts.join(" | ")}</p>
}

interface Opts {
  threads?: Thread[]
  threadsPending?: boolean
  loadThreads?: () => Promise<void>
  selectThread?: (t: Thread) => void
  strict?: boolean
}

function mountGate(link: EntityLink | undefined, o: Opts = {}) {
  const loadThreads = o.loadThreads ?? vi.fn().mockResolvedValue(undefined)
  const selectThread = o.selectThread ?? vi.fn()
  const ui = (l: EntityLink | undefined, threads: Thread[], pending: boolean) => (
    <LinkGate
      entityLink={l}
      threads={threads}
      threadsPending={pending}
      loadThreads={loadThreads}
      selectThread={selectThread}
    >
      {(gate) => <Probe gate={gate} />}
    </LinkGate>
  )
  const wrap = (node: React.ReactNode) => (o.strict ? <StrictMode>{node}</StrictMode> : node)
  const r = render(wrap(ui(link, o.threads ?? [], o.threadsPending ?? false)))
  return {
    ...r,
    loadThreads,
    selectThread,
    rerenderWith: (l: EntityLink | undefined, threads: Thread[] = o.threads ?? [], pending = false) =>
      r.rerender(wrap(ui(l, threads, pending))),
  }
}

const gateText = () => screen.getByTestId("gate").textContent

beforeEach(() => {
  client.resolveLink.mockReset()
  org.value = { activeOrgId: "A", orgs: ORGS, loading: false, switchOrg: vi.fn() }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("no entity address", () => {
  it("renders the child with 'none' and asks the server nothing", () => {
    mountGate(fakeLink(null))
    expect(gateText()).toBe("none")
    expect(client.resolveLink).not.toHaveBeenCalled()
  })

  it("without a navigator object (a suite mounting the layout alone) it is inert", () => {
    mountGate(undefined)
    expect(gateText()).toBe("none")
  })

  it("on first mount it asks to resume a remembered sign-in target exactly once (StrictMode)", () => {
    client.resolveLink.mockReturnValue(new Promise(() => {}))
    const link = fakeLink(null)
    const g = mountGate(link, { strict: true })
    g.rerenderWith(link)
    g.rerenderWith(fakeLink("workflow"))
    expect(link.resume).toHaveBeenCalledTimes(1)
  })
})

describe("the holding sentences (UI-SPEC S2)", () => {
  it("one constant map; the run's is the run page's own COPY_LOADING", () => {
    expect(HOLDING_SENTENCE).toEqual({
      thread: "Opening the chat…",
      workflow: "Opening the workflow…",
      run: COPY_LOADING,
      expert: "Opening the Expert…",
    })
    expect(COPY_LOADING).toBe("Opening the run…")
  })
})

describe("a thread address", () => {
  it("holds while the active org's list has not answered — no server call", () => {
    mountGate(fakeLink("thread"), { threadsPending: true })
    expect(gateText()).toBe("holding | thread | Opening the chat…")
    expect(client.resolveLink).not.toHaveBeenCalled()
  })

  it("holds while the active org is not known yet (a fresh device)", () => {
    org.value = { activeOrgId: null, orgs: [], loading: true, switchOrg: vi.fn() }
    mountGate(fakeLink("thread"))
    expect(gateText()).toBe("holding | thread | Opening the chat…")
    expect(client.resolveLink).not.toHaveBeenCalled()
  })

  it("opens straight away when the thread is in the list — no server call", () => {
    mountGate(fakeLink("thread"), { threads: [thread(ID)] })
    expect(gateText()).toBe("open | thread")
    expect(client.resolveLink).not.toHaveBeenCalled()
  })

  it("settled and absent → asks the server once", async () => {
    client.resolveLink.mockReturnValue(new Promise(() => {}))
    mountGate(fakeLink("thread"), { threads: [thread(OTHER)] })
    await act(async () => {})
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
    expect(client.resolveLink).toHaveBeenCalledWith("thread", ID)
    expect(gateText()).toBe("holding | thread | Opening the chat…")
  })

  it("200 same org but absent from the list → the list is reloaded once, then open when found (and selected)", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ kind: "thread" }) })
    let reloaded: () => void = () => {}
    const loadThreads = vi.fn(() => new Promise<void>((r) => (reloaded = r)))
    const link = fakeLink("thread")
    const g = mountGate(link, { threads: [], loadThreads })
    await act(async () => {})
    expect(g.loadThreads).toHaveBeenCalledTimes(1)
    // While the reload is out, it holds — never a premature "can't be opened".
    expect(gateText()).toBe("holding | thread | Opening the chat…")
    const found = thread(ID, "Renewal")
    // The real list hook commits the rows before its promise settles.
    await act(async () => g.rerenderWith(link, [found]))
    await act(async () => reloaded())
    expect(gateText()).toBe("open | thread")
    expect(g.selectThread).toHaveBeenCalledWith(found)
    expect(g.loadThreads).toHaveBeenCalledTimes(1)
  })

  it("200 same org, reloaded and STILL absent → can't be opened", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ kind: "thread" }) })
    const g = mountGate(fakeLink("thread"), { threads: [] })
    await act(async () => {})
    await act(async () => {})
    expect(g.loadThreads).toHaveBeenCalledTimes(1)
    expect(gateText()).toBe(`cant | thread | ${JSON.stringify(routeOf("thread", ID))}`)
  })
})

describe.each<[Kind, string]>([
  ["workflow", "Opening the workflow…"],
  ["run", "Opening the run…"],
  ["expert", "Opening the Expert…"],
])("a %s address", (kind, sentence) => {
  it("holds with the kind's sentence, then asks the server ONCE per kind:id", async () => {
    let answer: (v: unknown) => void = () => {}
    client.resolveLink.mockReturnValue(new Promise((r) => (answer = r)))
    const link = fakeLink(kind)
    const g = mountGate(link)
    expect(gateText()).toBe(`holding | ${kind} | ${sentence}`)
    g.rerenderWith(link)
    await act(async () => {})
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
    expect(client.resolveLink).toHaveBeenCalledWith(kind, ID)
    await act(async () => answer({ status: "ok", target: target({ kind }) }))
    expect(gateText()).toBe(`open | ${kind}`)
  })

  it("the server's 404 → can't be opened, carrying the parsed route", async () => {
    client.resolveLink.mockResolvedValue({ status: "cant" })
    mountGate(fakeLink(kind))
    await act(async () => {})
    expect(gateText()).toBe(`cant | ${kind} | ${JSON.stringify(routeOf(kind, ID))}`)
  })

  it("a system-global item (org_id null) opens in the active org with no prompt (D-09 / D-35)", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ kind, org_id: null, org_name: null }) })
    mountGate(fakeLink(kind))
    await act(async () => {})
    expect(gateText()).toBe(`open | ${kind}`)
  })

  it("an item in another of the person's orgs → the switch prompt, never an open", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ kind, org_id: "B", org_name: "Acme Legal" }) })
    mountGate(fakeLink(kind))
    await act(async () => {})
    expect(gateText()).toBe(`prompt | ${kind} | Acme Legal`)
    expect(org.value!.switchOrg).not.toHaveBeenCalled()
  })
})

describe("the answer is cached for the gate's life (it does not depend on the active org)", () => {
  it("leaving the address and coming back asks nothing new", async () => {
    client.resolveLink.mockResolvedValue({ status: "cant" })
    const g = mountGate(fakeLink("workflow"))
    await act(async () => {})
    g.rerenderWith(fakeLink(null))
    g.rerenderWith(fakeLink("workflow"))
    await act(async () => {})
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
    expect(gateText()).toContain("cant | workflow")
  })
})

describe("an outage is never 'can't be opened' (T-299-25, Pitfall 5)", () => {
  it("a throw keeps holding and retries at 2 s, 4 s, 8 s, then every 8 s", async () => {
    vi.useFakeTimers()
    client.resolveLink.mockRejectedValue(new Error("503"))
    mountGate(fakeLink("run"))
    await act(async () => {})
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
    const step = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
    await step(1999)
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
    await step(1)
    expect(client.resolveLink).toHaveBeenCalledTimes(2)
    await step(4000)
    expect(client.resolveLink).toHaveBeenCalledTimes(3)
    await step(8000)
    expect(client.resolveLink).toHaveBeenCalledTimes(4)
    await step(8000)
    expect(client.resolveLink).toHaveBeenCalledTimes(5)
    expect(gateText()).toBe("holding | run | Opening the run…")
  })

  it("a retry that then answers decides normally", async () => {
    vi.useFakeTimers()
    client.resolveLink.mockRejectedValueOnce(new Error("503")).mockResolvedValue({ status: "cant" })
    mountGate(fakeLink("workflow"))
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(gateText()).toContain("cant | workflow")
  })

  it("leaving the address stops the retries", async () => {
    vi.useFakeTimers()
    client.resolveLink.mockRejectedValue(new Error("503"))
    const g = mountGate(fakeLink("run"))
    await act(async () => {})
    g.rerenderWith(fakeLink(null))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
  })
})

describe("missing and forbidden decide identically (T-299-23)", () => {
  it("a made-up id and a foreign id (both the one 404) give the same decision, id aside", async () => {
    client.resolveLink.mockResolvedValue({ status: "cant" })
    const a = mountGate(fakeLink("expert", ID))
    await act(async () => {})
    const first = a.container.innerHTML.split(ID).join("<id>")
    cleanup()
    const b = mountGate(fakeLink("expert", OTHER))
    await act(async () => {})
    expect(b.container.innerHTML.split(OTHER).join("<id>")).toBe(first)
  })
})

/** Comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("source facts", () => {
  it("one resolveLink call site, no router hook, no streams provider", () => {
    const code = codeOf(gateSource)
    expect(code.split("resolveLink(").length - 1).toBe(1)
    expect(code).not.toMatch(/useLocation|useNavigate/)
    expect(code).not.toContain("StreamsProvider")
    expect(code).not.toContain("dangerouslySetInnerHTML")
  })
})

// ══ Phase 299-03 Task 3 (D-16 / D-17 / D-19 / D-37 / D-39) — Stay, Back to it, Switch, Switch back ══

const T1 = "6e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e01"
const T2 = "6e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e02"
const RUN_ROUTE = routeOf("run", ID)

function setStreaming(ids: string[]) {
  useStreamsStore.setState({ streamingThreads: new Set(ids) })
}

/** The switch's prompt arm and notice slot, as AppViewSwitch draws them. */
function PromptProbe({ gate }: { gate: GateState }) {
  return (
    <div>
      {gate.notice}
      {gate.status === "prompt" ? <SwitchOrgPrompt {...gate.prompt} /> : <Probe gate={gate} />}
    </div>
  )
}

function mountPrompt(link: EntityLink, threads: Thread[] = []) {
  const ui = (l: EntityLink, th: Thread[]) => (
    <LinkGate entityLink={l} threads={th} threadsPending={false} loadThreads={vi.fn().mockResolvedValue(undefined)}>
      {(gate) => <PromptProbe gate={gate} />}
    </LinkGate>
  )
  const r = render(ui(link, threads))
  return { ...r, rerenderWith: (l: EntityLink, th: Thread[] = threads) => r.rerender(ui(l, th)) }
}

/** A link on the chat home (where Stay lands), with its own navigators. */
function homeLink(address = "/app"): EntityLink {
  return { ...fakeLink(null), address }
}

describe("the prompt, from the gate (D-16 / D-39)", () => {
  beforeEach(() => setStreaming([]))

  it("renders SwitchOrgPrompt with the server's title and org, and the active org's name", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    mountPrompt(fakeLink("run"))
    await act(async () => {})
    expect(screen.getByRole("heading", { level: 1, name: "This is in Acme Legal" })).toBeInTheDocument()
    expect(screen.getByText("You're working in Northwind. Switch to Acme Legal to open it?")).toBeInTheDocument()
    expect(screen.getByText("Contract review")).toBeInTheDocument()
    expect(org.value!.switchOrg).not.toHaveBeenCalled()
  })

  it("the tail and the chip only while a chat in the active org is answering (titles from the list)", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    setStreaming([T1, "not-in-this-org"])
    mountPrompt(fakeLink("run"), [thread(T1, "Renewal clause comparison")])
    await act(async () => {})
    expect(screen.getByText(/Your chat that's answering now keeps going\.$/)).toBeInTheDocument()
    expect(screen.getByText("“Renewal clause comparison” is still answering")).toBeInTheDocument()
  })
})

describe("Stay (D-17 / D-37 / UI-D9)", () => {
  beforeEach(() => setStreaming([]))

  it("changes no org, REPLACES the address once, then says so on the landed surface", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    const link = fakeLink("run")
    const g = mountPrompt(link)
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
    expect(org.value!.switchOrg).not.toHaveBeenCalled()
    expect(link.leave).toHaveBeenCalledTimes(1)
    expect(link.leave).toHaveBeenCalledWith()
    // The address lands on the previous place (the gate sees a new address with no target).
    g.rerenderWith(homeLink("/app"))
    const notice = screen.getByRole("status")
    expect(notice).toHaveTextContent("You stayed in Northwind. The link wasn't opened.")
    expect(screen.getByRole("button", { name: "Open it after all" })).toBeInTheDocument()
  })

  it("'Open it after all' pushes the link's route and the prompt shows again (no second request)", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    const link = fakeLink("run")
    const g = mountPrompt(link)
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
    const home = homeLink("/app")
    g.rerenderWith(home)
    fireEvent.click(screen.getByRole("button", { name: "Open it after all" }))
    expect(home.openRoute).toHaveBeenCalledWith(RUN_ROUTE)
    g.rerenderWith(fakeLink("run"))
    await act(async () => {})
    expect(screen.getByRole("heading", { level: 1, name: "This is in Acme Legal" })).toBeInTheDocument()
    expect(screen.queryByText(/You stayed in/)).toBeNull()
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
  })

  it("the notice goes away at the next navigation anywhere", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    const g = mountPrompt(fakeLink("run"))
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
    g.rerenderWith(homeLink("/app"))
    expect(screen.getByText("You stayed in Northwind. The link wasn't opened.")).toBeInTheDocument()
    g.rerenderWith(homeLink("/app/library"))
    expect(screen.queryByText(/You stayed in/)).toBeNull()
  })

  it("'Back to it' stays too, landing on the most recently started answering chat", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    setStreaming([T1, T2])
    const link = fakeLink("run")
    mountPrompt(link, [thread(T1, "One"), thread(T2, "Two")])
    await act(async () => {})
    expect(screen.getByText("2 chats are still answering")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Back to it" }))
    expect(link.leave).toHaveBeenCalledWith({ view: "chat", threadId: T2 })
    expect(org.value!.switchOrg).not.toHaveBeenCalled()
  })
})

describe("Switch (D-17 / D-37 / F4 / UI-D10)", () => {
  beforeEach(() => setStreaming([]))

  it("reads the answering chats BEFORE it calls switchOrg once, then shows 'Switching to …'", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    setStreaming([T1])
    const order: string[] = []
    const realGetState = useStreamsStore.getState
    const spy = vi.spyOn(useStreamsStore, "getState").mockImplementation(() => {
      order.push("getState")
      return realGetState()
    })
    const switchOrg = vi.fn(() => order.push("switchOrg"))
    org.value = { ...org.value!, switchOrg }
    mountPrompt(fakeLink("run"), [thread(T1, "Renewal")])
    await act(async () => {})
    order.length = 0
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    spy.mockRestore()
    expect(switchOrg).toHaveBeenCalledTimes(1)
    expect(switchOrg).toHaveBeenCalledWith("B")
    expect(order.indexOf("getState")).toBeGreaterThanOrEqual(0)
    expect(order.indexOf("getState")).toBeLessThan(order.indexOf("switchOrg"))
    expect(screen.getByRole("status")).toHaveTextContent("Switching to Acme Legal…")
  })

  it("once the active org is the item's, it opens — with 'Your chat in Northwind is still answering.' + Switch back", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    setStreaming([T1])
    const link = fakeLink("run")
    const g = mountPrompt(link, [thread(T1, "Renewal")])
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    org.value = { ...org.value!, activeOrgId: "B" }
    g.rerenderWith(link, [])
    expect(screen.getByTestId("gate")).toHaveTextContent("open | run")
    expect(screen.getByText("Your chat in Northwind is still answering.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Switch back" }))
    expect(org.value!.switchOrg).toHaveBeenLastCalledWith("A")
    expect(link.openThread).toHaveBeenCalledWith(T1)
    expect(screen.queryByText(/is still answering/)).toBeNull()
    expect(client.resolveLink).toHaveBeenCalledTimes(1)
  })

  it("with nothing answering at the switch, the item opens with no line", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    const link = fakeLink("run")
    const g = mountPrompt(link)
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    org.value = { ...org.value!, activeOrgId: "B" }
    g.rerenderWith(link)
    expect(screen.getByTestId("gate")).toHaveTextContent("open | run")
    expect(screen.queryByText(/is still answering/)).toBeNull()
  })

  it("the after-switch line goes away when the address changes", async () => {
    client.resolveLink.mockResolvedValue({ status: "ok", target: target({ org_id: "B", org_name: "Acme Legal" }) })
    setStreaming([T1])
    const link = fakeLink("run")
    const g = mountPrompt(link, [thread(T1, "Renewal")])
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    org.value = { ...org.value!, activeOrgId: "B" }
    g.rerenderWith(link, [])
    expect(screen.getByText("Your chat in Northwind is still answering.")).toBeInTheDocument()
    g.rerenderWith(homeLink("/app/library"), [])
    expect(screen.queryByText(/is still answering/)).toBeNull()
  })
})

// ── revision 1 (with 299-02's IN-01 guard): a THREAD link into another org, with a PRIOR selection,
//    driven end to end — the real router, the real useAppNavigation, the real useThreadAddress, and
//    an IN-01-style `selectThread(null)` on the org change, exactly as ChatLayout runs them. ──
const X = "7a1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e11"
const BT = "7a1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e22"
const LISTS: Record<string, Thread[]> = {
  A: [thread(X, "Renewal clause comparison")],
  B: [thread(BT, "Acme thread")],
}

function E2E() {
  const nav = useAppNavigation()
  const [orgId, setOrgId] = useState("A")
  // The mocked org context reads `org.value`; Switch updates it in the handler (never in render)
  // and re-renders this harness through the setter registered here.
  useEffect(() => {
    e2e.setOrg = setOrgId
  }, [])
  const [held, setHeld] = useState<{ org: string; rows: Thread[] }>({ org: "A", rows: LISTS.A })
  const pending = held.org !== orgId
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setHeld({ org: orgId, rows: LISTS[orgId] }), 0)
    return () => clearTimeout(t)
  }, [pending, orgId])
  const threads = pending ? [] : held.rows
  const [selected, setSelected] = useState<Thread | null>(null)
  // IN-01, as ChatLayout runs it: an org change drops the old org's selection.
  const lastOrg = useRef(orgId)
  useEffect(() => {
    if (lastOrg.current === orgId) return
    lastOrg.current = orgId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors ChatLayout's IN-01 effect, which is the behaviour under test
    setSelected(null)
  }, [orgId])
  const link = nav.entityLink
  const { holding } = useThreadAddress({
    threadId: link.target?.kind === "thread" ? link.target.id : null,
    onChatView: nav.activeView === "chat",
    threads,
    threadsPending: pending,
    selectedThread: selected,
    selectThread: setSelected,
    entityLink: link,
    activeOrgId: orgId,
  })
  return (
    <LinkGate entityLink={link} threads={threads} threadsPending={pending} loadThreads={async () => {}} selectThread={setSelected}>
      {(gate) => (
        <div>
          {gate.notice}
          {gate.status === "prompt" ? (
            <SwitchOrgPrompt {...gate.prompt} />
          ) : (
            <p data-testid="e2e">{`${gate.status}|${holding ? "holding" : (selected?.id ?? "none")}`}</p>
          )}
        </div>
      )}
    </LinkGate>
  )
}
const e2e = { switches: [] as string[], setOrg: null as null | ((id: string) => void) }

async function mountE2E() {
  org.value = {
    activeOrgId: "A",
    orgs: ORGS,
    loading: false,
    switchOrg: (id: string) => {
      e2e.switches.push(id)
      org.value = { ...org.value!, activeOrgId: id }
      e2e.setOrg?.(id)
    },
  }
  const router = createMemoryRouter([{ path: "*", Component: E2E }], { initialEntries: ["/app"] })
  const seen: string[] = []
  router.subscribe((s) => seen.push(s.location.pathname))
  render(<RouterProvider router={router} />)
  // A prior selection in org A: thread X is open.
  await act(async () => {
    await router.navigate(`/app/chat/${X}`)
  })
  await act(async () => {})
  expect(screen.getByTestId("e2e")).toHaveTextContent(`open|${X}`)
  // Then the link to org B's thread arrives in this tab.
  client.resolveLink.mockImplementation(async (kind: string, id: string) =>
    kind === "thread" && id === BT
      ? { status: "ok", target: target({ kind: "thread", id: BT, org_id: "B", org_name: "Acme Legal", title: "Acme thread" }) }
      : { status: "cant" },
  )
  await act(async () => {
    await router.navigate(`/app/chat/${BT}`)
  })
  await act(async () => {})
  expect(screen.getByRole("heading", { level: 1, name: "This is in Acme Legal" })).toBeInTheDocument()
  seen.length = 0
  return { router, seen }
}

describe("revision 1 — a thread link into another org, with a prior selection, end to end", () => {
  beforeEach(() => {
    setStreaming([])
    e2e.switches.length = 0
  })

  it("Switch: IN-01 drops X, the address STAYS /app/chat/<B-thread>, the gate holds, then the linked thread opens", async () => {
    const { router, seen } = await mountE2E()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    })
    expect(e2e.switches).toEqual(["B"])
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    await act(async () => {})
    expect(router.state.location.pathname).toBe(`/app/chat/${BT}`)
    expect(seen).not.toContain("/app")
    expect(screen.getByTestId("e2e")).toHaveTextContent(`open|${BT}`)
  })

  it("Stay: no switch; the address is replaced with /app and stays there (no spurious move)", async () => {
    const { router, seen } = await mountE2E()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
    })
    await act(async () => {})
    expect(e2e.switches).toEqual([])
    expect(router.state.location.pathname).toBe("/app")
    expect(router.state.historyAction).toBe("REPLACE")
    expect(seen.filter((p) => p !== "/app")).toEqual([])
    expect(screen.getByText("You stayed in Northwind. The link wasn't opened.")).toBeInTheDocument()
  })

  it("Back to it: no switch; lands on the answering chat X and keeps that address", async () => {
    setStreaming([X])
    const { router, seen } = await mountE2E()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back to it" }))
    })
    await act(async () => {})
    expect(e2e.switches).toEqual([])
    expect(router.state.location.pathname).toBe(`/app/chat/${X}`)
    expect(seen).not.toContain("/app")
    expect(screen.getByTestId("e2e")).toHaveTextContent(`|${X}`)
  })
})
