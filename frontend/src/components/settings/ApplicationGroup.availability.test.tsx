/**
 * Phase 221 plan 02 (D-221-04 / D-221-12) — the availability line, composed.
 *
 * ⛔ **THE LOAD-BEARING TEST IN THIS FILE IS `a ready application renders NOTHING`.** It
 * asserts the element is ABSENT — `queryBy…` returns null — and not that it is empty. An
 * empty element still takes a row and still costs a reader a glance, and six of them saying
 * "fine" is precisely the noise the 2026-08-31 audit deleted. It was DRIVEN RED against a
 * component that renders a `ready` line, and restored.
 *
 * ⚠ The second load-bearing pair is `api_off` vs `scope_missing`: both are HTTP 403
 * `PERMISSION_DENIED` upstream, and their remedies are OPPOSITE. A test that asserts they
 * DIFFER is the only thing standing between this surface and the measured defect where an
 * operator was told to re-consent scopes that were already correct.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { McpDiscoveredTool } from "@/lib/api"
import { ConnectionGrantsList } from "./ConnectionGrantsList"
import type { ApplicationAvailabilityWire } from "./applicationAvailability"

vi.mock("@/lib/connectionMark", () => ({
  ConnectionMarkGlyph: () => <span data-testid="mark" />,
  connectionMark: () => ({ key: "x", Mark: () => null, ink: "self" }),
}))

const CONSOLE_URL =
  "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=877112366454"

function tool(name: string, app: string): McpDiscoveredTool {
  const t: McpDiscoveredTool = { name, annotations: { readOnlyHint: true } }
  ;(t as { app?: string }).app = app
  return t
}

/** Real shape — the six applications, as discovered on the live connection. */
const GOOGLE: McpDiscoveredTool[] = [
  tool("search_files", "drive"),
  tool("search_email", "gmail"),
  tool("read_sheet", "sheets"),
  tool("read_doc", "docs"),
  tool("list_events", "calendar"),
  tool("search_contacts", "contacts"),
]

function renderList(availabilities?: ApplicationAvailabilityWire[]) {
  return render(
    <ConnectionGrantsList
      tools={GOOGLE}
      toolGrants={{}}
      defaultPosture="ask"
      onChangeToolGrant={() => {}}
      onResetToolGrant={() => {}}
      onChangeApplicationGrant={() => {}}
      applicationAvailabilities={availabilities}
    />,
  )
}

const ALL_READY: ApplicationAvailabilityWire[] = [
  { app: "drive", state: "ready" },
  { app: "gmail", state: "ready" },
  { app: "sheets", state: "ready" },
  { app: "docs", state: "ready" },
  { app: "calendar", state: "ready" },
  { app: "contacts", state: "ready" },
]

describe("silence is the healthy state", () => {
  it("⭐ a READY application renders ZERO availability elements — absent, not empty", () => {
    renderList(ALL_READY)
    for (const app of ["drive", "gmail", "sheets", "docs", "calendar", "contacts"]) {
      expect(screen.queryByTestId(`application-availability-${app}`)).toBeNull()
    }
  })

  it("no verdicts at all renders zero availability elements", () => {
    renderList(undefined)
    expect(screen.queryByTestId("application-availability-drive")).toBeNull()
  })

  it("the groups themselves still render — the absence is the LINE, not the application", () => {
    renderList(ALL_READY)
    expect(screen.getByTestId("application-group-drive")).toBeTruthy()
    expect(screen.getByTestId("application-group-contacts")).toBeTruthy()
  })
})

describe("api_off and scope_missing do not say the same thing", () => {
  it("`api_off` renders the console link", () => {
    renderList([
      { app: "sheets", state: "api_off", console_url: CONSOLE_URL },
      ...ALL_READY.filter((v) => v.app !== "sheets"),
    ])
    const line = screen.getByTestId("application-availability-sheets")
    expect(line.getAttribute("data-state")).toBe("api_off")
    const link = screen.getByTestId("availability-link-sheets") as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe(CONSOLE_URL)
    // ⚠ `noopener` on a `_blank` link to a vendor page is a security property, not styling.
    expect(link.getAttribute("rel")).toContain("noopener")
  })

  it("⭐ `scope_missing` renders NO console link", () => {
    renderList([
      { app: "contacts", state: "scope_missing" },
      ...ALL_READY.filter((v) => v.app !== "contacts"),
    ])
    expect(screen.getByTestId("application-availability-contacts")).toBeTruthy()
    expect(screen.queryByTestId("availability-link-contacts")).toBeNull()
  })

  it("⭐ the two are asserted to DIFFER, in one render", () => {
    renderList([
      { app: "sheets", state: "api_off", console_url: CONSOLE_URL },
      { app: "contacts", state: "scope_missing" },
      ...ALL_READY.filter((v) => v.app !== "sheets" && v.app !== "contacts"),
    ])
    const off = screen.getByTestId("availability-sentence-sheets").textContent
    const scope = screen.getByTestId("availability-sentence-contacts").textContent
    expect(off).not.toBe(scope)
    expect(screen.getByTestId("availability-link-sheets")).toBeTruthy()
    expect(screen.queryByTestId("availability-link-contacts")).toBeNull()
  })
})

describe("unknown never blames their configuration", () => {
  it("⭐ never renders the words `switched off`", () => {
    renderList([{ app: "gmail", state: "unknown" }, ...ALL_READY.filter((v) => v.app !== "gmail")])
    const line = screen.getByTestId("application-availability-gmail")
    expect(line.textContent?.toLowerCase()).not.toContain("switched off")
    expect(line.getAttribute("data-state")).toBe("unknown")
    expect(screen.queryByTestId("availability-link-gmail")).toBeNull()
  })
})

describe("a blocked application keeps its posture control", () => {
  it("⭐ DIMMED, never removed — a person may set a posture on what they are about to fix", () => {
    renderList([
      { app: "sheets", state: "api_off", console_url: CONSOLE_URL },
      ...ALL_READY.filter((v) => v.app !== "sheets"),
    ])
    const posture = screen.getByTestId("application-posture-sheets")
    expect(posture.getAttribute("data-blocked")).toBe("true")
    // The three buttons are still there AND still enabled.
    const buttons = posture.querySelectorAll("button")
    expect(buttons.length).toBe(3)
    for (const b of buttons) expect((b as HTMLButtonElement).disabled).toBe(false)
  })

  it("an `unknown` application is NOT marked blocked", () => {
    renderList([{ app: "docs", state: "unknown" }, ...ALL_READY.filter((v) => v.app !== "docs")])
    expect(screen.getByTestId("application-posture-docs").getAttribute("data-blocked")).toBe("false")
  })
})

describe("the link is not nested inside the header button", () => {
  it("⭐ no <a> has a <button> ancestor — invalid HTML, and an unclickable link", () => {
    renderList([
      { app: "sheets", state: "api_off", console_url: CONSOLE_URL },
      ...ALL_READY.filter((v) => v.app !== "sheets"),
    ])
    const link = screen.getByTestId("availability-link-sheets")
    expect(link.closest("button")).toBeNull()
  })
})
