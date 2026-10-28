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
import { StrictMode } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"

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
