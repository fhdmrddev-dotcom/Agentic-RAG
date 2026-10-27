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
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

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

import { ChatLayout } from "../ChatLayout"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { ADDRESS_NOT_FOUND_COPY, ADMIN_HOLD_COPY } from "../AddressNotFound"
import { COPY_LOADING } from "@/pages/WorkflowRunPage"
import type { ActiveView } from "@/App"
import addressNotFoundSource from "../AddressNotFound.tsx?raw"
import switchSource from "../AppViewSwitch.tsx?raw"

interface Opts {
  addressNotFound?: boolean
  canvas?: boolean
  featuresLoading?: boolean
  isOperator?: boolean
  operatorLoading?: boolean
  onNavigate?: (v: ActiveView) => void
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

  it("hides the chat history column (with the positive control)", () => {
    renderAt("chat")
    expect(screen.getByTestId("history-stub")).toBeInTheDocument()
    cleanup()
    renderAt("chat", { addressNotFound: true })
    expect(screen.queryByTestId("history-stub")).not.toBeInTheDocument()
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

/** Line-anchored comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

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

  it("the run hold's sentence has ONE spelling — the switch never writes it itself", () => {
    expect(switchSource).not.toContain("Opening the run…")
    expect(codeOf(switchSource)).toContain("sentence={COPY_LOADING}")
  })
})
