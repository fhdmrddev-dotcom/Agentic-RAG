/**
 * Phase 231 · VIS-02 — the sentence is the deliverable, so it gets a guard.
 *
 * ⭐ SC#1 is a COVERAGE claim, not a copy claim: *"there is no configuration path where that
 *    sentence is absent."* So the tests that matter here are the ones that try to find a value
 *    for which the surface says nothing — including values no UI offers and values this client
 *    does not recognise. A test that only checks the happy path would pass on a surface that
 *    falls silent exactly where the criterion forbids it.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { IngestVisibilityField, IngestVisibilityFooter } from "../IngestVisibilityField"
import { AUDIENCE_ROWS, OFFERED_VISIBILITIES, scopeFooterSentence } from "../ingestVisibilityCopy"

const ORG = "Acme Corp"

describe("VIS-02 — the footer never falls silent", () => {
  // The known values, the inert one, and shapes a client can genuinely receive from a database
  // that has outlived this build.
  const VALUES = ["private", "org", "dept", "something-nobody-shipped", "", null, undefined]

  it.each(VALUES)("renders a non-empty sentence for %p", (value) => {
    const sentence = scopeFooterSentence(value as string, ORG, null)
    expect(sentence.trim().length).toBeGreaterThan(20)
  })

  it("names the scope rather than guessing when the value is unrecognised", () => {
    const sentence = scopeFooterSentence("something-nobody-shipped", ORG, null)
    expect(sentence).toContain("something-nobody-shipped")
    // ⚠ It must NOT claim an audience it cannot compute. Naming an audience for a value the
    //   client does not understand is the fail-open direction.
    expect(sentence).not.toContain("everyone")
  })

  it("says who, in real DOM text, not a title attribute", () => {
    render(<IngestVisibilityFooter visibility="org" orgName={ORG} memberCount={26} />)
    const el = screen.getByTestId("ingest-visibility-footer")
    expect(el.textContent).toContain("all 26 people in Acme Corp")
    // A reason nobody can read is not a reason (142-B).
    expect(el.getAttribute("title")).toBeNull()
  })

  it("does not fabricate a count when the roster size is unknown", () => {
    render(<IngestVisibilityFooter visibility="org" orgName={ORG} memberCount={null} />)
    const text = screen.getByTestId("ingest-visibility-footer").textContent ?? ""
    expect(text).toContain("everyone in Acme Corp")
    expect(text).not.toMatch(/\d+ people/)
  })
})

describe("VIS-02 — every offered choice states its own consequence", () => {
  it("offers exactly the scopes a person can actually be granted", () => {
    expect([...OFFERED_VISIBILITIES]).toEqual(["private", "org"])
  })

  it("⚠ NEVER offers the inert department scope (D-5)", () => {
    // A scope nobody can grant must not be offered. This is the guard that stops departments
    // shipping by accident the day someone adds the row.
    expect(OFFERED_VISIBILITIES).not.toContain("dept" as never)
    expect(AUDIENCE_ROWS.some((r) => (r.value as string) === "dept")).toBe(false)
  })

  it("gives every row a consequence, never a bare label", () => {
    for (const row of AUDIENCE_ROWS) {
      expect(row.consequence(ORG, 26).trim().length).toBeGreaterThan(30)
    }
  })

  it("states the gateway hazard on the widening choice (Pitfall 2)", () => {
    const org = AUDIENCE_ROWS.find((r) => r.value === "org")!
    // The connecting person's own access is being re-exported to people who lack it. If this
    // clause is ever dropped, the UI stops warning about the thing that makes sharing dangerous.
    expect(org.consequence(ORG, 26)).toContain("cannot open the originals at the source")
  })

  it("renders both choices with their sentences, and no third option", () => {
    render(
      <IngestVisibilityField value="private" onChange={vi.fn()} orgName={ORG} memberCount={26} />,
    )
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByText(/Nobody else in Acme Corp will see these documents/)).toBeTruthy()
    expect(screen.getByText(/cannot open the originals at the source/)).toBeTruthy()
  })

  it("warns that changing the scope does not re-scope what is already here", () => {
    render(
      <IngestVisibilityField
        value="org"
        onChange={vi.fn()}
        orgName={ORG}
        memberCount={26}
        isExisting
      />,
    )
    expect(screen.getByText(/keep the setting they arrived with/)).toBeTruthy()
  })
})
