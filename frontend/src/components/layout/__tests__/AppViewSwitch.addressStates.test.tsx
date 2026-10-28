/**
 * Phase 297-02 (LINK-01 / D-14, D-19, D-34, D-35, D-36) — the address states inside the layout.
 *
 * Two new states live in `AppViewSwitch`, never at App level (D-34: an App-level hold would
 * unmount the streams provider on every features refetch):
 *
 *   S1 — "This address doesn't open anything": an address that names nothing, and an admin
 *        address typed by a non-operator once the probe has answered (the SAME copy, so the
 *        state is not an existence oracle — T-297-07).
 *   S2 — a holding sentence while a cold deep link waits on the gate that decides it: the
 *        canvas feature for a run, the operator probe for the admin pages.
 *
 * ⛔ THE WORDS ARE THE DELIVERABLE, so every case asserts RENDERED TEXT (presence assertions
 * cannot see content drift — Phase 235). The source cases at the bottom pin the two positional
 * facts other fences depend on: one comment-stripped run comparison, and the fallback last.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useLayoutEffect } from "react"
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({
      "Content-Type": "application/json",
      Authorization: "Bearer tok-297",
    }),
  }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-297" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))
vi.mock("../NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("../ChatHistoryColumn", () => ({ ChatHistoryColumn: () => <div data-testid="history-stub" /> }))
vi.mock("../ThreadCommandPalette", () => ({ ThreadCommandPalette: () => <div data-testid="palette-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="workspace-panel-stub" />,
}))
vi.mock("@/components/chat/ChatArea", () => ({ ChatArea: () => <div data-testid="chat-area-stub" /> }))
vi.mock("@/components/admin/ControlRoomPage", () => ({
  ControlRoomPage: () => <div data-testid="control-room-stub">Control Room</div>,
}))
vi.mock("@/pages/admin/AdminSpendPage", () => ({
  AdminSpendPage: () => <div data-testid="admin-spend-stub">Spend</div>,
}))
// Partial: the page is stubbed, but its REAL `COPY_LOADING` stays, so the hold's sentence is the
// shipped constant rather than a copy written into this test.
vi.mock("@/pages/WorkflowRunPage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/pages/WorkflowRunPage")>()
  return { ...actual, WorkflowRunPage: () => <div data-testid="run-page-stub" /> }
})

// Phase 299-03: the pages the gate draws BEHIND the card (or opens), stubbed to print the linked id
// they were handed, and the resolver client the gate asks.
vi.mock("@/pages/WorkflowsPage", () => ({
  WorkflowsPage: (p: { linkedDefinitionId?: string | null }) => (
    <div data-testid="workflows-page-stub">{`linked:${String(p.linkedDefinitionId ?? null)}`}</div>
  ),
}))
vi.mock("@/components/experts/catalog/ExpertCatalogPage", () => ({
  ExpertCatalogPage: (p: { openBundleId?: string | null }) => (
    <div data-testid="experts-page-stub">{`open:${String(p.openBundleId ?? null)}`}</div>
  ),
}))
const links = vi.hoisted(() => ({ resolveLink: vi.fn() }))
vi.mock("@/lib/api/links", () => ({ resolveLink: links.resolveLink }))

import { ChatLayout } from "../ChatLayout"
import { useOperatorProbe } from "@/hooks/useOperatorProbe"
import { useEffectiveFeatures } from "@/hooks/useEffectiveFeatures"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { ADDRESS_NOT_FOUND_COPY, ADMIN_HOLD_COPY } from "../AddressNotFound"
import { COPY_LOADING } from "@/pages/WorkflowRunPage"
import type { ActiveView } from "@/App"
import addressNotFoundSource from "../AddressNotFound.tsx?raw"
import switchSource from "../AppViewSwitch.tsx?raw"
import type { EntityLink } from "@/hooks/useAppNavigation"
import type { AppRoute } from "@/lib/appRoutes"

interface Opts {
  addressNotFound?: boolean
  canvas?: boolean
  featuresLoading?: boolean
  isOperator?: boolean
  operatorLoading?: boolean
  onNavigate?: (v: ActiveView) => void
  /** Phase 299-03: App's entity navigators (a fake), so the gate is live. */
  entityLink?: EntityLink
}

function renderAt(activeView: ActiveView, o: Opts = {}) {
  const onNavigate = o.onNavigate ?? vi.fn()
  render(
    <EffectiveFeaturesProvider
      value={{
        features: o.canvas ? { visual_workflow_canvas: true } : {},
        loading: o.featuresLoading ?? false,
        refetch: vi.fn(),
      }}
    >
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={activeView}
        onNavigate={onNavigate}
        navItems={[]}
        isOperator={o.isOperator ?? false}
        operatorIdentity={null}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={null}
        studioTab="evals"
        onOpenStudio={vi.fn()}
        onReviewEvals={vi.fn()}
        onStudioTabChange={vi.fn()}
        onTuneSkill={vi.fn()}
        activeRunId={null}
        openRun={vi.fn()}
        addressNotFound={o.addressNotFound ?? false}
        operatorLoading={o.operatorLoading ?? false}
        entityLink={o.entityLink}
      />
    </EffectiveFeaturesProvider>,
  )
  return { onNavigate }
}

/** The S1 block's own text, read off its heading's container. */
function s1Text(): string {
  const heading = screen.getByRole("heading", { level: 1, name: ADDRESS_NOT_FOUND_COPY.heading })
  return heading.parentElement?.textContent ?? ""
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("S1 — an address that opens nothing (D-14)", () => {
  it("the copy is the locked UI-SPEC wording", () => {
    expect(ADDRESS_NOT_FOUND_COPY).toEqual({
      heading: "This address doesn't open anything",
      body: "It may be mistyped or out of date.",
      cta: "Go to Chat",
    })
    expect(ADMIN_HOLD_COPY).toBe("Opening…")
  })

  it("renders the heading, the body and a Go to Chat button that calls onNavigate('chat')", () => {
    const { onNavigate } = renderAt("chat", { addressNotFound: true })
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This address doesn't open anything")
    expect(screen.getByText("It may be mistyped or out of date.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Go to Chat" }))
    expect(onNavigate).toHaveBeenCalledWith("chat")
  })

  it("shows no chat grid, no fallback, no requested path and no icon", () => {
    renderAt("chat", { addressNotFound: true })
    expect(screen.queryByTestId("chat-area-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("workspace-panel-stub")).not.toBeInTheDocument()
    expect(screen.queryByText(/This view has no screen/)).not.toBeInTheDocument()
    const block = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement
    expect(block.textContent).toBe(
      "This address doesn't open anything" + "It may be mistyped or out of date." + "Go to Chat",
    )
    expect(block.querySelector("svg")).toBeNull()
  })

  // RE-TARGETED under 299-03 D-14 (UI-SPEC S1, sketch 299-1 B), never deleted: 297 hid the history
  // column on S1. 299's one card sits over the MAIN region only, with the history column live behind
  // it (clicking a row opens that chat and so replaces the card), so the same case now asserts the
  // column is SHOWN on S1, with the same positive control and the same rail assertion.
  it("D-14: keeps the chat history column live behind the card (with the positive control)", () => {
    renderAt("chat")
    expect(screen.getByTestId("history-stub")).toBeInTheDocument()
    cleanup()
    renderAt("chat", { addressNotFound: true })
    expect(screen.getByTestId("history-stub")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This address doesn't open anything")
    // The rail stays (D-43: it highlights Chat; NavPanel is not edited in 297).
    expect(screen.getAllByTestId("nav-stub").length).toBeGreaterThan(0)
  })
})

describe("S2 — the run hold on a cold /app/runs/<id> (D-19, D-34)", () => {
  it("while features load it says the run's own loading sentence, as a status", () => {
    renderAt("workflow-run", { canvas: false, featuresLoading: true })
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Opening the run…")
    expect(COPY_LOADING).toBe("Opening the run…")
    expect(screen.queryByText(/This view has no screen/)).not.toBeInTheDocument()
    expect(screen.queryByText("This address doesn't open anything")).not.toBeInTheDocument()
    expect(screen.queryByTestId("chat-area-stub")).not.toBeInTheDocument()
  })

  it("once features have loaded with the canvas off, the shipped fallback renders", () => {
    renderAt("workflow-run", { canvas: false, featuresLoading: false })
    expect(screen.getByText(/This view has no screen/)).toBeInTheDocument()
    expect(screen.queryByText("Opening the run…")).not.toBeInTheDocument()
  })

  it("with the canvas on, the run page renders", () => {
    renderAt("workflow-run", { canvas: true })
    expect(screen.getByTestId("run-page-stub")).toBeInTheDocument()
    expect(screen.queryByText("Opening the run…")).not.toBeInTheDocument()
  })
})

describe.each<[ActiveView, string]>([
  ["control-room", "control-room-stub"],
  ["admin-spend", "admin-spend-stub"],
])("D-35 — %s by address", (view, pageTestId) => {
  it("holds with 'Opening…' while the operator probe loads, showing neither page nor refusal", () => {
    renderAt(view, { operatorLoading: true })
    expect(screen.getByRole("status")).toHaveTextContent("Opening…")
    expect(screen.queryByTestId(pageTestId)).not.toBeInTheDocument()
    expect(screen.queryByText("This address doesn't open anything")).not.toBeInTheDocument()
  })

  it("for a non-operator shows S1 with copy byte-identical to an unknown address", () => {
    renderAt("chat", { addressNotFound: true })
    const unknown = s1Text()
    cleanup()
    renderAt(view, { isOperator: false, operatorLoading: false })
    expect(screen.queryByTestId(pageTestId)).not.toBeInTheDocument()
    expect(s1Text()).toBe(unknown)
  })

  it("for an operator shows the page", () => {
    renderAt(view, { isOperator: true, operatorLoading: false })
    expect(screen.getByTestId(pageTestId)).toBeInTheDocument()
    expect(screen.queryByText("This address doesn't open anything")).not.toBeInTheDocument()
  })
})

// ── Phase 299-03 (D-12..D-15, D-36) — the gate inside the layout ──────────────────────────────
const LINKED = "c41d8e2a-1b2c-4d3e-8f9a-9e2d5b7f0a63"
const FOREIGN = "c41d8e2a-1b2c-4d3e-8f9a-9e2d5b7f0a64"
type Kind = "thread" | "workflow" | "run" | "expert"
function linkTo(kind: Kind, id = LINKED): EntityLink {
  const route: AppRoute =
    kind === "thread"
      ? { view: "chat", threadId: id }
      : kind === "workflow"
        ? { view: "workflows", definitionId: id }
        : kind === "run"
          ? { view: "workflow-run", runId: id }
          : { view: "experts", bundleId: id }
  return {
    target: { kind, id },
    route,
    address: `/x/${id}`,
    openThread: vi.fn(),
    openWorkflow: vi.fn(),
    openExpert: vi.fn(),
    leaveThread: vi.fn(),
    leave: vi.fn(),
    openRoute: vi.fn(),
    resume: vi.fn(),
  }
}
const VIEW_OF: Record<Kind, ActiveView> = { thread: "chat", workflow: "workflows", run: "workflow-run", expert: "experts" }
const settle = () => act(async () => {})

describe("S1 for a link the server refuses: the generic area of its kind behind the card (D-12 / D-13)", () => {
  beforeEach(() => {
    links.resolveLink.mockReset()
  })

  it("a run: the Workflows library behind (no linked id), never the run page; the area is inert", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    renderAt("workflow-run", { canvas: true, entityLink: linkTo("run") })
    await settle()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This workflow run can't be opened")
    expect(screen.getByText("If someone sent you this link, ask them to check it.")).toBeInTheDocument()
    const behind = screen.getByTestId("workflows-page-stub")
    expect(behind).toHaveTextContent("linked:null")
    expect(behind.closest("[inert]")).not.toBeNull()
    expect(behind.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByTestId("run-page-stub")).not.toBeInTheDocument()
    expect(document.querySelector("code")?.textContent).toBe(`${window.location.host}/app/runs/${LINKED}`)
  })

  it("a workflow: the library behind with no linked id", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    renderAt("workflows", { entityLink: linkTo("workflow") })
    await settle()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This workflow can't be opened")
    expect(screen.getByTestId("workflows-page-stub")).toHaveTextContent("linked:null")
  })

  it("an Expert: the catalog behind with no open id; the exit is Go to Experts", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    const link = linkTo("expert")
    renderAt("experts", { entityLink: link })
    await settle()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This Expert can't be opened")
    expect(screen.getByTestId("experts-page-stub")).toHaveTextContent("open:null")
    fireEvent.click(screen.getByRole("button", { name: "Go to Experts" }))
    expect(link.openRoute).toHaveBeenCalledWith({ view: "experts" })
  })

  it("a chat: an empty main region (no composer, no welcome) beside the LIVE history column", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    const link = linkTo("thread")
    renderAt("chat", { entityLink: link })
    await settle()
    await settle()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This chat can't be opened")
    expect(screen.getByTestId("history-stub")).toBeInTheDocument()
    expect(screen.queryByTestId("chat-area-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("workspace-panel-stub")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Go to Chat" }))
    // D-15: a PUSH to the chat home, so Back returns to the card.
    expect(link.openRoute).toHaveBeenCalledWith({ view: "chat" })
  })

  it("Go to Workflows is a push through openRoute (D-15), never a silent fallback to chat", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    const link = linkTo("run")
    const { onNavigate } = renderAt("workflow-run", { canvas: true, entityLink: link })
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "Go to Workflows" }))
    expect(link.openRoute).toHaveBeenCalledWith({ view: "workflows" })
    expect(onNavigate).not.toHaveBeenCalledWith("chat")
  })

  it("a made-up id and a foreign id render the same main region, id aside (T-299-23)", async () => {
    links.resolveLink.mockResolvedValue({ status: "cant" })
    renderAt("workflow-run", { canvas: true, entityLink: linkTo("run", LINKED) })
    await settle()
    const first = (document.querySelector("main") as HTMLElement).innerHTML.split(LINKED).join("<id>")
    cleanup()
    renderAt("workflow-run", { canvas: true, entityLink: linkTo("run", FOREIGN) })
    await settle()
    expect((document.querySelector("main") as HTMLElement).innerHTML.split(FOREIGN).join("<id>")).toBe(first)
  })
})

describe("S2 / open: the gate holds, then opens the page with the linked id (299-03)", () => {
  beforeEach(() => {
    links.resolveLink.mockReset()
  })

  it.each<[Kind, string]>([
    ["workflow", "Opening the workflow…"],
    ["expert", "Opening the Expert…"],
    ["run", "Opening the run…"],
  ])("a %s address holds with its sentence while the answer is out", async (kind, sentence) => {
    links.resolveLink.mockReturnValue(new Promise(() => {}))
    renderAt(VIEW_OF[kind], { canvas: true, entityLink: linkTo(kind) })
    await settle()
    expect(screen.getByRole("status")).toHaveTextContent(sentence)
    expect(screen.queryByTestId("workflows-page-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("experts-page-stub")).not.toBeInTheDocument()
    expect(screen.queryByTestId("run-page-stub")).not.toBeInTheDocument()
  })

  it("an answer in the active org opens the page with the linked id; no card", async () => {
    links.resolveLink.mockResolvedValue({
      status: "ok",
      target: { kind: "workflow", id: LINKED, org_id: null, org_name: null, title: "W", state: "published", audience: "everyone" },
    })
    renderAt("workflows", { entityLink: linkTo("workflow") })
    await settle()
    expect(screen.getByTestId("workflows-page-stub")).toHaveTextContent(`linked:${LINKED}`)
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })
})

/** Line-anchored comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── 297-REVIEW WR-03 (2026-10-28) — the sign-in EDGE, driven, never set as props ──────────────
// Both probes start `loading = true`, but while App is signed out they answer for `null` at once
// and drop it to false. On the render where the session arrives they still read "answered, not an
// operator, no features" — the passive effect that re-arms `loading` runs only after that commit
// has painted. So for one frame a cold `/app/admin` showed S1 and a cold `/app/runs/<id>` showed
// the dev fallback. The cases below run the REAL hooks across `userId: null → "u-297"` and look
// at the DOM in a layout effect, i.e. in EVERY commit, so a one-frame flash cannot hide.
function SignInHarness({ userId, view }: { userId: string | null; view: ActiveView }) {
  const probe = useOperatorProbe(userId)
  const feats = useEffectiveFeatures(userId)
  useLayoutEffect(() => {
    const text = document.body.textContent ?? ""
    if (text.includes(ADDRESS_NOT_FOUND_COPY.heading)) flashes.push(`S1@${userId ?? "signed-out"}`)
    if (/This view has no screen/.test(text)) flashes.push(`fallback@${userId ?? "signed-out"}`)
  })
  return (
    <EffectiveFeaturesProvider value={feats}>
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={view}
        onNavigate={vi.fn()}
        navItems={[]}
        isOperator={probe.isOperator}
        operatorIdentity={probe.identity}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={null}
        studioTab="evals"
        onOpenStudio={vi.fn()}
        onReviewEvals={vi.fn()}
        onStudioTabChange={vi.fn()}
        onTuneSkill={vi.fn()}
        activeRunId={view === "workflow-run" ? "5d3f1a2b-7c4e-4f6a-9a8b-1c2d3e4f5a97" : null}
        openRun={vi.fn()}
        addressNotFound={false}
        operatorLoading={probe.loading}
      />
    </EffectiveFeaturesProvider>
  )
}
const flashes: string[] = []

describe.each<[ActiveView, string]>([
  ["control-room", ADMIN_HOLD_COPY],
  ["admin-spend", ADMIN_HOLD_COPY],
  ["workflow-run", COPY_LOADING],
])("WR-03 — signing in on a cold %s address holds from the FIRST signed-in commit", (view, hold) => {
  it("never paints S1 or the fallback between sign-in and the probes answering", async () => {
    flashes.length = 0
    // The probes never answer: the hold is the only correct state for the whole window.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})))
    const { rerender } = render(<SignInHarness userId={null} view={view} />)
    await act(async () => {})
    flashes.length = 0 // signed out is not under test (App shows AuthPage there)
    await act(async () => {
      rerender(<SignInHarness userId="u-297" view={view} />)
    })
    expect(flashes).toEqual([])
    expect(screen.getByText(hold)).toBeInTheDocument()
  })
})

describe("source facts other fences depend on", () => {
  it("AddressNotFound never renders the trailing fallback tag (one home for it)", () => {
    const code = codeOf(addressNotFoundSource)
    expect(code).toContain("export function AddressNotFound")
    expect(code).not.toContain("<UnknownViewFallback")
  })

  it("AppViewSwitch keeps ONE stripped run comparison, and the fallback stays the last arm", () => {
    const code = codeOf(switchSource)
    expect(code.split(`activeView === "workflow-run"`).length - 1).toBe(1)
    const fallback = code.lastIndexOf("<UnknownViewFallback")
    expect(fallback).toBeGreaterThan(code.lastIndexOf("<AddressNotFound"))
    expect(fallback).toBeGreaterThan(code.lastIndexOf("<AddressHolding"))
    expect(code.lastIndexOf("<AddressNotFound")).toBeGreaterThan(-1)
    // S1 is the FIRST arm of the non-chat side: it precedes every page mount there.
    const split = code.indexOf(`<main className="flex-1 overflow-hidden">`)
    const firstS1 = code.indexOf("<AddressNotFound", split)
    expect(firstS1).toBeGreaterThan(split)
    expect(firstS1).toBeLessThan(code.indexOf("<LibraryPage", split))
  })

  it("299-03 (D-28): the switch wraps its body in ONE LinkGate and still calls no React hook", () => {
    const code = codeOf(switchSource)
    expect(code.split("<LinkGate").length - 1).toBe(1)
    expect(code).not.toMatch(/\buse(State|Effect|Memo|Ref|Callback|Reducer|Context|LayoutEffect)\(/)
    // Non-vacuity: the stripper left the code in place.
    expect(code).toContain("export function AppViewSwitch")
  })

  it("the run hold's sentence has ONE spelling — the switch never writes it itself", () => {
    expect(switchSource).not.toContain("Opening the run…")
    expect(codeOf(switchSource)).toContain("sentence={COPY_LOADING}")
  })
})
