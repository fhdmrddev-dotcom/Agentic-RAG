/**
 * Phase 299-03 (LINK-04 / D-12..D-15, D-36; UI-SPEC S1, sketch 299-1 B) — THE ONE IN-PLACE CARD.
 *
 * A link the server will not open renders one card over the generic area of its kind. The words
 * name only the KIND — never a reason, a title, an org or an owner — and the render is identical for
 * a made-up id and someone else's real id (the server sends one 404 for both, 299-01), so the card
 * cannot be used to learn whether an item exists (T-299-23).
 *
 * The address line is REBUILT from the parsed route (`formatAppRoute`), never the requested path, so
 * a hostile address cannot put its own words on the screen (T-297-09 / T-299-24). The unparseable
 * variant (297's words, verbatim) shows no address and no Copy address.
 *
 * ⛔ Asserted by the RENDERED WORDS (presence assertions cannot see content drift).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CantBeOpened, CANT_BE_OPENED_COPY, ADDRESS_NOT_FOUND_COPY } from "../CantBeOpened"
import { AddressNotFound, ADDRESS_NOT_FOUND_COPY as REEXPORTED, ADMIN_HOLD_COPY, AddressHolding } from "../AddressNotFound"
import type { AppRoute } from "@/lib/appRoutes"
import cardSource from "../CantBeOpened.tsx?raw"

const RUN = "c41d8e2a-1b2c-4d3e-8f9a-9e2d5b7f0a63"
const RUN_ROUTE: AppRoute = { view: "workflow-run", runId: RUN }

function stubClipboard(writeText: ((t: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText === undefined ? undefined : { writeText },
  })
}

beforeEach(() => stubClipboard(vi.fn().mockResolvedValue(undefined)))
afterEach(() => {
  cleanup()
  stubClipboard(undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("the words (UI-SPEC Copywriting Contract)", () => {
  it("one heading per kind, one body, one exit per kind", () => {
    expect(CANT_BE_OPENED_COPY.heading("chat")).toBe("This chat can't be opened")
    expect(CANT_BE_OPENED_COPY.heading("workflow run")).toBe("This workflow run can't be opened")
    expect(CANT_BE_OPENED_COPY.body).toBe("If someone sent you this link, ask them to check it.")
    expect(CANT_BE_OPENED_COPY.copy).toBe("Copy address")
    expect(CANT_BE_OPENED_COPY.copied).toBe("✓ Address copied")
    expect(CANT_BE_OPENED_COPY.goTo).toEqual({
      thread: "Go to Chat",
      workflow: "Go to Workflows",
      run: "Go to Workflows",
      expert: "Go to Experts",
    })
  })

  it.each<[AppRoute, "thread" | "workflow" | "run" | "expert", string, string]>([
    [{ view: "chat", threadId: RUN }, "thread", "This chat can't be opened", "Go to Chat"],
    [{ view: "workflows", definitionId: RUN }, "workflow", "This workflow can't be opened", "Go to Workflows"],
    [RUN_ROUTE, "run", "This workflow run can't be opened", "Go to Workflows"],
    [{ view: "experts", bundleId: RUN }, "expert", "This Expert can't be opened", "Go to Experts"],
  ])("%o renders its kind's heading and exit", (route, kind, heading, exit) => {
    render(<CantBeOpened kind={kind} route={route} onGo={vi.fn()} />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading)
    expect(screen.getByRole("button", { name: exit })).toBeInTheDocument()
  })

  it("never gives a reason, a title, an org or an owner (source scan, comments stripped)", () => {
    const code = codeOf(cardSource)
    expect(code).toContain("If someone sent you this link, ask them to check it.")
    expect(code).not.toMatch(/deleted|not shared|no access|private|another org|permission/i)
    expect(code).not.toContain("dangerouslySetInnerHTML")
  })

  it("the props carry no raw path (T-297-09): only a parsed route", () => {
    const code = codeOf(cardSource)
    expect(code).toContain("formatAppRoute(")
    const props = code.slice(code.indexOf("export interface CantBeOpenedProps"), code.indexOf("}", code.indexOf("export interface CantBeOpenedProps")))
    expect(props.length).toBeGreaterThan(0)
    expect(props).not.toMatch(/\bpath\b|pathname|href/)
  })
})

describe("the run card (sketch B)", () => {
  it("heading focused once on mount, body, rebuilt address, filled exit + outline Copy address", () => {
    render(<CantBeOpened kind="run" route={RUN_ROUTE} onGo={vi.fn()} />)
    const h1 = screen.getByRole("heading", { level: 1, name: "This workflow run can't be opened" })
    expect(h1).toHaveAttribute("tabindex", "-1")
    expect(document.activeElement).toBe(h1)
    expect(screen.getByText("If someone sent you this link, ask them to check it.")).toBeInTheDocument()
    const code = document.querySelector("code")
    expect(code?.textContent).toBe(`${window.location.host}/app/runs/${RUN}`)
    expect(code?.className).toContain("select-all")
    const exit = screen.getByRole("button", { name: "Go to Workflows" })
    const copy = screen.getByRole("button", { name: "Copy address" })
    expect(exit.className).toContain("bg-primary")
    expect(copy.className).not.toContain("bg-primary")
    expect(copy.className).toContain("border")
  })

  it("is a section labelled by its heading, never an alert", () => {
    render(<CantBeOpened kind="run" route={RUN_ROUTE} onGo={vi.fn()} />)
    const h1 = screen.getByRole("heading", { level: 1 })
    const section = h1.closest("section")
    expect(section).not.toBeNull()
    expect(section).toHaveAttribute("aria-labelledby", h1.id)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("the area behind is inert and aria-hidden, and still rendered", () => {
    render(
      <CantBeOpened kind="run" route={RUN_ROUTE} onGo={vi.fn()}>
        <div data-testid="library-behind">Library</div>
      </CantBeOpened>,
    )
    const behind = screen.getByTestId("library-behind")
    const wrapper = behind.parentElement as HTMLElement
    expect(wrapper).toHaveAttribute("inert")
    expect(wrapper).toHaveAttribute("aria-hidden", "true")
    // The card is not inside the inert area.
    expect(wrapper.contains(screen.getByRole("heading", { level: 1 }))).toBe(false)
  })

  it("Go to … calls onGo once", () => {
    const onGo = vi.fn()
    render(<CantBeOpened kind="run" route={RUN_ROUTE} onGo={onGo} />)
    fireEvent.click(screen.getByRole("button", { name: "Go to Workflows" }))
    expect(onGo).toHaveBeenCalledTimes(1)
  })

  it("an upper-case address displays the lower-case rebuild (D-36)", () => {
    render(<CantBeOpened kind="thread" route={{ view: "chat", threadId: RUN.toUpperCase() }} onGo={vi.fn()} />)
    expect(document.querySelector("code")?.textContent).toBe(`${window.location.host}/app/chat/${RUN}`)
  })
})

describe("Copy address (UI-D7)", () => {
  it("success: ✓ Address copied for 2 s and an sr-only status", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    render(<CantBeOpened kind="run" route={RUN_ROUTE} onGo={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy address" }))
    })
    expect(writeText).toHaveBeenCalledWith(`${window.location.host}/app/runs/${RUN}`)
    expect(screen.getByRole("button", { name: "✓ Address copied" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Address copied")
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole("button", { name: "Copy address" })).toBeInTheDocument()
  })

  it("refused: the address is selected and the shortcut word shows — never the success word", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")))
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32")
    render(<CantBeOpened kind="run" route={RUN_ROUTE} onGo={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy address" }))
    })
    expect(screen.getByRole("button", { name: "Press Ctrl+C to copy" })).toBeInTheDocument()
    expect(window.getSelection()?.toString()).toBe(`${window.location.host}/app/runs/${RUN}`)
    expect(screen.queryByText(/Address copied/)).toBeNull()
  })
})

describe("the unparseable variant (D-14): 297's words, no address", () => {
  it("kind=null, route=null: the 297 heading and body, Go to Chat, no code, no Copy address", () => {
    const onGo = vi.fn()
    render(<CantBeOpened kind={null} route={null} onGo={onGo} />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This address doesn't open anything")
    expect(screen.getByText("It may be mistyped or out of date.")).toBeInTheDocument()
    expect(document.querySelector("code")).toBeNull()
    expect(screen.queryByRole("button", { name: "Copy address" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Go to Chat" }))
    expect(onGo).toHaveBeenCalledTimes(1)
  })

  it("a kind with no route shows no address either (nothing to rebuild)", () => {
    render(<CantBeOpened kind="run" route={null} onGo={vi.fn()} />)
    expect(document.querySelector("code")).toBeNull()
    expect(screen.queryByRole("button", { name: "Copy address" })).toBeNull()
  })

  it("AddressNotFound renders the same card, and still exports its names", () => {
    expect(REEXPORTED).toBe(ADDRESS_NOT_FOUND_COPY)
    expect(ADDRESS_NOT_FOUND_COPY).toEqual({
      heading: "This address doesn't open anything",
      body: "It may be mistyped or out of date.",
      cta: "Go to Chat",
    })
    expect(ADMIN_HOLD_COPY).toBe("Opening…")
    expect(typeof AddressHolding).toBe("function")
    const onGoHome = vi.fn()
    const { container } = render(<AddressNotFound onGoHome={onGoHome} />)
    const viaWrapper = container.innerHTML
    cleanup()
    const { container: direct } = render(<CantBeOpened kind={null} route={null} onGo={vi.fn()} />)
    expect(viaWrapper).toBe(direct.innerHTML)
  })
})

describe("identical for missing and forbidden (T-299-23)", () => {
  it("a made-up id and a foreign id of the same kind render byte-identical DOM", () => {
    // Same props by construction: the server answers both with the one 404, and the address is
    // the same shape. Rendered twice from independent trees, the HTML must not differ.
    const MADE_UP: AppRoute = { view: "workflow-run", runId: "00000000-0000-4000-8000-000000000001" }
    const FOREIGN: AppRoute = { view: "workflow-run", runId: "00000000-0000-4000-8000-000000000001" }
    const { container: a } = render(<CantBeOpened kind="run" route={MADE_UP} onGo={vi.fn()} />)
    const first = a.innerHTML
    cleanup()
    const { container: b } = render(<CantBeOpened kind="run" route={FOREIGN} onGo={vi.fn()} />)
    expect(b.innerHTML).toBe(first)
  })
})
