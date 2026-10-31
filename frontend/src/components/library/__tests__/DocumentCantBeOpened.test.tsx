/**
 * Phase 305-02 (D-17 / D-52; UI-SPEC Surface 4) — the in-page refusal for a by-id open that 404'd.
 *
 * The words are 299's ONE copy home (`CANT_BE_OPENED_COPY`), asserted as RENDERED TEXT rather than
 * by test id (a presence assertion cannot see content drift). It names only the kind — never a
 * title, an org or an owner — so missing and forbidden render the same DOM (T-305-26).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CANT_BE_OPENED_COPY } from "@/components/layout/CantBeOpened"
import { DocumentCantBeOpened } from "../DocumentCantBeOpened"
import componentSource from "../DocumentCantBeOpened.tsx?raw"

afterEach(cleanup)

describe("DocumentCantBeOpened", () => {
  it("renders the 299 words for a document: the heading and the body", () => {
    render(<DocumentCantBeOpened onDismiss={() => {}} />)
    const heading = screen.getByRole("heading", { name: CANT_BE_OPENED_COPY.heading("document") })
    expect(heading.textContent).toBe("This document can't be opened")
    expect(screen.getByText(CANT_BE_OPENED_COPY.body).textContent).toBe(
      "If someone sent you this link, ask them to check it.",
    )
  })

  it("is a labelled section, never an alert", () => {
    render(<DocumentCantBeOpened onDismiss={() => {}} />)
    const card = screen.getByTestId("document-cant-be-opened")
    expect(card.tagName).toBe("SECTION")
    const labelledBy = card.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toBe(CANT_BE_OPENED_COPY.heading("document"))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("moves focus to the heading once on arrival", () => {
    render(<DocumentCantBeOpened onDismiss={() => {}} />)
    const heading = screen.getByRole("heading", { name: CANT_BE_OPENED_COPY.heading("document") })
    expect(heading.getAttribute("tabindex")).toBe("-1")
    expect(document.activeElement).toBe(heading)
  })

  it("has exactly one action, Dismiss, which calls onDismiss", () => {
    const onDismiss = vi.fn()
    render(<DocumentCantBeOpened onDismiss={onDismiss} />)
    const buttons = screen.getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual(["Dismiss"])
    fireEvent.click(buttons[0])
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("never retypes the words: they come from CANT_BE_OPENED_COPY", () => {
    expect(componentSource).toContain("CANT_BE_OPENED_COPY")
    expect(componentSource).not.toMatch(/can't be opened|can’t be opened|ask them to check it/)
  })
})
