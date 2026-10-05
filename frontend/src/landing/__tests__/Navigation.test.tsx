// Phase 276-03 (D-01, G4-1) — ONE header for the landing and the docs: absolute hash links that
// work from /docs, a Docs link, and the ≤720px Menu drawer (a real modal dialog: Esc closes it and
// focus returns to the button). Docs-only slots render inside the drawer only when passed.
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Navigation } from "../components/Navigation"

afterEach(() => {
  document.body.style.overflow = ""
})

describe("Navigation (shared landing + docs header)", () => {
  it("lists every link, with absolute hash links and /docs", () => {
    render(<Navigation />)
    const nav = screen.getByRole("navigation", { name: "Main navigation" })
    const href = (name: string) => within(nav).getByRole("link", { name }).getAttribute("href")
    expect(href("Features")).toBe("/#features")
    expect(href("Tour")).toBe("/#tour")
    expect(href("Workflows")).toBe("/#workflows")
    expect(href("Compare")).toBe("/#compare")
    expect(href("Security")).toBe("/#security")
    expect(href("Docs")).toBe("/docs")
    expect(within(nav).getByRole("link", { name: /Sign in/ })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "Book a demo" })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "Docs" }).getAttribute("aria-current")).toBeNull()
  })

  it("marks Docs as the current page when current='docs'", () => {
    render(<Navigation current="docs" />)
    const nav = screen.getByRole("navigation", { name: "Main navigation" })
    expect(within(nav).getByRole("link", { name: "Docs" }).getAttribute("aria-current")).toBe("page")
  })

  it("opens a modal Menu drawer listing Docs and Changelog; Escape closes it and restores focus", () => {
    render(<Navigation />)
    expect(screen.queryByRole("dialog")).toBeNull()
    const button = screen.getByRole("button", { name: "Menu" })
    expect(button.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(button)

    const dialog = screen.getByRole("dialog", { name: "Menu" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(within(dialog).getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/docs")
    expect(within(dialog).getByRole("link", { name: "Changelog" }).getAttribute("href")).toBe("/docs/changelog")
    expect(within(dialog).getByRole("link", { name: "Book a demo" })).toBeInTheDocument()
    const toggle = screen.getByRole("button", { name: "Close menu" })
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(document.body.style.overflow).toBe("hidden")

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    const again = screen.getByRole("button", { name: "Menu" })
    expect(document.activeElement).toBe(again)
    expect(document.body.style.overflow).toBe("")
  })

  it("traps Tab and Shift+Tab inside the open drawer (toggle + sheet), never the header CTA (A-WR-04)", () => {
    render(<Navigation />)
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = screen.getByRole("dialog", { name: "Menu" })
    const toggle = screen.getByRole("button", { name: "Close menu" })
    const links = within(dialog).getAllByRole("link")
    const firstLink = links[0]
    const lastLink = links[links.length - 1]
    const inTrap = () => document.activeElement === toggle || dialog.contains(document.activeElement)

    // the sheet is focused on open; Shift+Tab from it goes back to the toggle
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(toggle)

    // forward Tab from the toggle lands INSIDE the dialog (it used to escape to the header CTA)
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(firstLink)

    // Tab from the last control wraps to the toggle; Shift+Tab from the toggle wraps to the last
    lastLink.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(toggle)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(lastLink)

    // focus parked OUTSIDE the trap (the header CTA) is pulled back in on the next Tab
    const headerCta = within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", {
      name: "Book a demo",
    })
    headerCta.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(inTrap()).toBe(true)

    // a full forward cycle never leaves the trap
    for (let n = 0; n < links.length + 2; n++) {
      fireEvent.keyDown(document, { key: "Tab" })
      expect(inTrap()).toBe(true)
    }

    // Escape closes and returns focus to the toggle
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Menu" }))
  })

  it("portals the open drawer to <body>, outside the backdrop-filtered <header> (G4-1)", () => {
    // The sticky header's `backdrop-filter` makes it the containing block for fixed descendants,
    // so a drawer rendered inside it resolved `bottom: 0` against the 65px header and measured
    // 32px tall at 390px. jsdom cannot measure layout, so pin the DOM position that fixes it.
    render(<Navigation drawerClassName="d-drawer" />)
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = screen.getByRole("dialog", { name: "Menu" })
    const header = document.querySelector("header")
    expect(header).not.toBeNull()
    expect(dialog.parentElement).toBe(document.body)
    expect(header!.contains(dialog)).toBe(false)
    expect(dialog.closest("header")).toBeNull()
    expect(dialog.id).toBe("menu-drawer")
    expect(dialog.classList.contains("menu-drawer")).toBe(true)
    expect(dialog.classList.contains("d-drawer")).toBe(true)
    // the toggle still controls the portaled sheet by id
    const toggle = screen.getByRole("button", { name: "Close menu" })
    expect(toggle.getAttribute("aria-controls")).toBe(dialog.id)
    expect(header!.contains(toggle)).toBe(true)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.getElementById("menu-drawer")).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Menu" }))
  })

  it("closes the drawer when a link inside it is chosen", () => {
    render(<Navigation />)
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = screen.getByRole("dialog", { name: "Menu" })
    fireEvent.click(within(dialog).getByRole("link", { name: "Features" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("renders the docs drawer slots inside the drawer only when passed", () => {
    const { unmount } = render(<Navigation />)
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    expect(screen.queryByText("Sections")).toBeNull()
    unmount()

    render(
      <Navigation
        current="docs"
        searchSlot={<button type="button">Search docs</button>}
        drawerTop={<input aria-label="drawer search" />}
        drawerSections={<a href="/docs/use">Use Syrel</a>}
      />,
    )
    expect(screen.queryByLabelText("drawer search")).toBeNull()
    expect(screen.getByRole("button", { name: "Search docs" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = screen.getByRole("dialog", { name: "Menu" })
    expect(within(dialog).getByLabelText("drawer search")).toBeInTheDocument()
    expect(within(dialog).getByText("Sections")).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: "Use Syrel" }).getAttribute("href")).toBe("/docs/use")
  })
})
