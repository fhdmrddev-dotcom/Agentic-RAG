/**
 * Phase 307-03 (D-12, D-09, T-307-23) — the who-well: the name is a CLAIM, the redirect host is the FACT.
 *
 * A DCR client "calls itself" and carries "name not checked"; a CIMD client says where its details are
 * published, "verified"; a loopback redirect is "this computer". The host chip shows the hostname only
 * (never a port), `[::1]` keeps its brackets. The name is plain text, capped at 60 with the full value
 * in `title` — never HTML, never a link, never a logo.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ConsentClient } from "@/lib/api/oauth"
import { ConsentWhoIsAsking } from "../ConsentWhoIsAsking"

const DCR: ConsentClient = {
  name: "Claude",
  name_source: "dcr",
  published_host: null,
  redirect_host: "claude.ai",
  redirect_kind: "web",
  host_seeded: true,
}

describe("307-03 ConsentWhoIsAsking", () => {
  it("DCR: the name, 'calls itself', the host chip and 'name not checked'", () => {
    render(<ConsentWhoIsAsking client={DCR} />)
    expect(screen.getByTestId("consent-client-name")).toHaveTextContent("Claude")
    expect(screen.getByText("calls itself")).toBeInTheDocument()
    expect(screen.getByTestId("consent-host")).toHaveTextContent(/^claude\.ai$/)
    expect(screen.getByText("name not checked")).toBeInTheDocument()
    expect(screen.queryByText("verified")).toBeNull()
    expect(screen.queryByText("this computer")).toBeNull()
    expect(screen.getByTestId("consent-why").textContent).toMatch(
      /Only allow it if you just started connecting from claude\.ai\.$/,
    )
  })

  it("CIMD: 'Details published at {host}' and 'verified', no 'calls itself'", () => {
    render(
      <ConsentWhoIsAsking
        client={{ ...DCR, name_source: "cimd", published_host: "claude.ai" }}
      />,
    )
    expect(screen.getByText("Details published at claude.ai")).toBeInTheDocument()
    expect(screen.getByText("verified")).toBeInTheDocument()
    expect(screen.queryByText("calls itself")).toBeNull()
    expect(screen.queryByText("name not checked")).toBeNull()
  })

  it("loopback: 'this computer', the hostname without a port, and the laptop mark", () => {
    render(
      <ConsentWhoIsAsking
        client={{ ...DCR, redirect_host: "localhost:51234", redirect_kind: "loopback", host_seeded: false }}
      />,
    )
    expect(screen.getByTestId("consent-host")).toHaveTextContent(/^localhost$/)
    expect(screen.getByText("this computer")).toBeInTheDocument()
    expect(screen.getByTestId("consent-mark")).toHaveAttribute("data-kind", "loopback")
  })

  it("[::1] keeps its brackets", () => {
    render(<ConsentWhoIsAsking client={{ ...DCR, redirect_host: "[::1]", redirect_kind: "loopback" }} />)
    expect(screen.getByTestId("consent-host")).toHaveTextContent(/^\[::1\]$/)
  })

  it("a 300-character name is cut at 60 with the full value in title", () => {
    const long = "A".repeat(300)
    render(<ConsentWhoIsAsking client={{ ...DCR, name: long }} />)
    const el = screen.getByTestId("consent-client-name")
    expect(el.getAttribute("title")).toBe(long)
    expect(el.textContent).toBe(`${"A".repeat(60)}…`)
  })

  it("a name with markup renders as text, with no element and no link", () => {
    const { container } = render(<ConsentWhoIsAsking client={{ ...DCR, name: "<b>x</b>" }} />)
    expect(screen.getByTestId("consent-client-name")).toHaveTextContent("<b>x</b>")
    expect(container.querySelector("b")).toBeNull()
    expect(container.querySelector("a")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })
})
