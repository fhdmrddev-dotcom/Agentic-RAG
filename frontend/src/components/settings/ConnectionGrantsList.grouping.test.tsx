/**
 * Phase 221 — the composed surface.
 *
 * ⚠ Fixtures are REAL SHAPE, measured 2026-08-31: Google's 15 actions across six
 * applications, and GitHub's 44 discovered tools at 27 read / 17 write.
 *
 * ⛔ **THE LOAD-BEARING TEST IN THIS FILE IS `the direction band carries no control`.** It
 * is the safety property of the phase, not a layout assertion — see `DirectionBand.tsx` for
 * the ROADMAP sentence it enforces. It was DRIVEN RED against a planted posture control and
 * restored; a guard nobody has seen fire is not a guard.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { McpDiscoveredTool } from "@/lib/api"
import { ConnectionGrantsList } from "./ConnectionGrantsList"
import type { ConnectionGrantsListProps } from "./ConnectionGrantsList"

vi.mock("@/lib/connectionMark", () => ({
  ConnectionMarkGlyph: () => <span data-testid="mark" />,
  connectionMark: () => ({ key: "x", Mark: () => null, ink: "self" }),
}))

function tool(
  name: string,
  opts: { app?: string; readOnly?: boolean; description?: string } = {},
): McpDiscoveredTool {
  const t: McpDiscoveredTool = { name }
  if (opts.app) (t as { app?: string }).app = opts.app
  if (opts.readOnly !== undefined) t.annotations = { readOnlyHint: opts.readOnly }
  if (opts.description) t.description = opts.description
  return t
}

const GOOGLE: McpDiscoveredTool[] = [
  tool("search_files", { app: "drive", readOnly: true, description: "Find files by name." }),
  tool("read_file", { app: "drive", readOnly: true }),
  tool("search_email", { app: "gmail", readOnly: true }),
  tool("read_email", { app: "gmail", readOnly: true }),
  tool("list_labels", { app: "gmail", readOnly: true }),
  tool("read_thread", { app: "gmail", readOnly: true }),
  tool("read_attachment", { app: "gmail", readOnly: true }),
  tool("list_sheet_tabs", { app: "sheets", readOnly: true }),
  tool("read_sheet", { app: "sheets", readOnly: true }),
  tool("read_doc", { app: "docs", readOnly: true }),
  tool("list_calendars", { app: "calendar", readOnly: true }),
  tool("list_events", { app: "calendar", readOnly: true }),
  tool("get_event", { app: "calendar", readOnly: true }),
  tool("find_free_time", { app: "calendar", readOnly: true }),
  tool("search_contacts", { app: "contacts", readOnly: true }),
]

const GITHUB: McpDiscoveredTool[] = [
  ...Array.from({ length: 27 }, (_, i) => tool(`get_thing_${i}`, { readOnly: true })),
  ...Array.from({ length: 17 }, (_, i) => tool(`create_thing_${i}`, { readOnly: false })),
]

const DEEPWIKI: McpDiscoveredTool[] = [
  tool("read_wiki_structure"),
  tool("read_wiki_contents"),
  tool("ask_question"),
]

function renderList(tools: McpDiscoveredTool[], overrides: Record<string, unknown> = {}) {
  const props = {
    tools,
    toolGrants: {},
    defaultPosture: "ask" as const,
    onChangeDefaultPosture: vi.fn(),
    onChangeToolGrant: vi.fn(),
    onResetToolGrant: vi.fn(),
    onChangeApplicationGrant: vi.fn(),
    ...overrides,
  }
  return { ...render(<ConnectionGrantsList {...(props as unknown as ConnectionGrantsListProps)} />), props }
}

describe("D-221-01/02 — Google renders as six applications", () => {
  it("draws a header per application, with its own count", () => {
    renderList(GOOGLE)
    for (const [app, label, n] of [
      ["drive", "Drive", 2],
      ["gmail", "Gmail", 5],
      ["sheets", "Sheets", 2],
      ["docs", "Docs", 1],
      ["calendar", "Calendar", 4],
      ["contacts", "Contacts", 1],
    ] as const) {
      const header = screen.getByTestId(`application-header-${app}`)
      expect(within(header).getByText(label)).toBeInTheDocument()
      expect(within(header).getByText(`${n} ${n === 1 ? "action" : "actions"}`)).toBeInTheDocument()
    }
  })

  it("every one of the 15 actions is reachable", () => {
    renderList(GOOGLE)
    for (const t of GOOGLE) {
      expect(screen.getByTestId(`action-row-${t.name}`)).toBeInTheDocument()
    }
  })

  it("D-221-05 — the application posture control writes an app: key", () => {
    const onChangeApplicationGrant = vi.fn()
    renderList(GOOGLE, { onChangeApplicationGrant })
    const header = screen.getByTestId("application-header-drive")
    fireEvent.click(within(header).getByRole("button", { name: "Allow" }))
    expect(onChangeApplicationGrant).toHaveBeenCalledWith("drive", "allow")
  })

  it("setting an application posture does not collapse the group", () => {
    // The header is a <button>; a posture click that bubbles would toggle it shut.
    renderList(GOOGLE)
    const header = screen.getByTestId("application-header-drive")
    fireEvent.click(within(header).getByRole("button", { name: "Deny" }))
    expect(screen.getByTestId("application-group-drive")).toHaveAttribute("data-open", "true")
  })
})

describe("D-221-09 — one component, both shapes", () => {
  it("GitHub renders NO application header and two bands", () => {
    renderList(GITHUB)
    expect(screen.queryAllByTestId(/^application-header-/)).toHaveLength(0)
    expect(screen.getByTestId("application-group-single")).toBeInTheDocument()
    expect(screen.getByTestId("direction-band-read")).toBeInTheDocument()
    expect(screen.getByTestId("direction-band-write")).toBeInTheDocument()
    expect(screen.getByTestId("direction-band-count-read")).toHaveTextContent("27")
    expect(screen.getByTestId("direction-band-count-write")).toHaveTextContent("17")
  })

  it("D-221-11 — a connector declaring no direction renders NO bands", () => {
    renderList(DEEPWIKI)
    expect(screen.queryByTestId("direction-band-read")).toBeNull()
    expect(screen.queryByTestId("direction-band-write")).toBeNull()
    // ...but every action is still listed and still grantable.
    expect(screen.getByTestId("action-row-ask_question")).toBeInTheDocument()
  })

  it("Google renders no bands today, because every application is reads-only", () => {
    renderList(GOOGLE)
    expect(screen.queryByTestId("direction-band-read")).toBeNull()
  })
})

describe("⛔ D-221-03 — the direction band carries NO control", () => {
  it("contains no button, no role=group and no aria-pressed", () => {
    renderList(GITHUB)
    for (const dir of ["read", "write"]) {
      const band = screen.getByTestId(`direction-band-${dir}`)
      expect(within(band).queryAllByRole("button")).toHaveLength(0)
      expect(band.querySelectorAll("[role='group']")).toHaveLength(0)
      expect(band.querySelectorAll("[aria-pressed]")).toHaveLength(0)
      expect(band.querySelectorAll("button,input,select,a")).toHaveLength(0)
    }
  })

  it("says the words, and only the words", () => {
    renderList(GITHUB)
    expect(screen.getByTestId("direction-band-read")).toHaveTextContent("Only reads")
    expect(screen.getByTestId("direction-band-write")).toHaveTextContent("Changes something")
  })
})

describe("D-221-10 — one search box, above the groups", () => {
  it("filters across applications and REMOVES a group that matches nothing", () => {
    renderList(GOOGLE)
    fireEvent.change(screen.getByPlaceholderText("Search 15 actions"), {
      target: { value: "calendar" },
    })
    expect(screen.getByTestId("application-header-calendar")).toBeInTheDocument()
    // ⚠ absent from the DOM, not rendered empty — an empty header is a group that looks
    // available and contains nothing.
    expect(screen.queryByTestId("application-header-gmail")).toBeNull()
    expect(screen.queryByTestId("application-header-drive")).toBeNull()
  })

  it("shows the empty state when nothing matches at all", () => {
    renderList(GOOGLE)
    fireEvent.change(screen.getByPlaceholderText("Search 15 actions"), {
      target: { value: "zzzzz" },
    })
    expect(screen.getByText("No action matches that.")).toBeInTheDocument()
  })

  it("counts the WHOLE set in its placeholder, never the filtered one", () => {
    renderList(GOOGLE)
    const box = screen.getByPlaceholderText("Search 15 actions")
    fireEvent.change(box, { target: { value: "calendar" } })
    expect(screen.getByPlaceholderText("Search 15 actions")).toBeInTheDocument()
  })
})

describe("inheritance is not an override (GRANT-02's one signal)", () => {
  it("a row inheriting an application posture carries NO overridden edge", () => {
    renderList(GOOGLE, { toolGrants: { "app:drive": "allow" } })
    const row = screen.getByTestId("action-row-search_files")
    expect(row.className).not.toContain("overridden")
    // it still SHOWS the inherited posture
    expect(within(row).getByRole("button", { name: "Allow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("a row with its own action grant DOES carry the edge and a reset link", () => {
    renderList(GOOGLE, { toolGrants: { read_file: "deny" } })
    const row = screen.getByTestId("action-row-read_file")
    expect(row.className).toContain("overridden")
    expect(within(row).getByTestId("grant-reset")).toBeInTheDocument()
  })

  it("D-221-06 — an application allow shows a WRITE as Ask, not Allow", () => {
    const withWrite = [
      tool("search_files", { app: "drive", readOnly: true }),
      tool("create_file", { app: "drive", readOnly: false }),
    ]
    renderList(withWrite, { toolGrants: { "app:drive": "allow" } })
    const read = screen.getByTestId("action-row-search_files")
    const write = screen.getByTestId("action-row-create_file")
    expect(within(read).getByRole("button", { name: "Allow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(within(write).getByRole("button", { name: "Ask first" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

describe("Invariant 8 — zero title attributes", () => {
  it("renders none, on either shape", () => {
    const { container, unmount } = renderList(GOOGLE)
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
    unmount()
    const second = renderList(GITHUB)
    expect(second.container.querySelectorAll("[title]")).toHaveLength(0)
  })
})
