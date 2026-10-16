/**
 * 284-REVIEW CR-01 — ONE clamp for every paged list (the browse pager and IngestionTab's three
 * status lists). A page past the end is now an empty 200 with the exact total; this is the rule
 * that moves the person off it, so "Try again" can never re-ask an impossible page.
 */
import { describe, it, expect } from "vitest"
import { clampPageOffset } from "@/lib/pageClamp"

describe("clampPageOffset", () => {
  it("an offset inside the list is kept", () => {
    expect(clampPageOffset(0, 52, 25)).toBe(0)
    expect(clampPageOffset(25, 52, 25)).toBe(25)
    expect(clampPageOffset(50, 52, 25)).toBe(50)
  })

  it("an offset at or past the end lands on the last real page — however far past", () => {
    expect(clampPageOffset(50, 50, 25)).toBe(25)
    expect(clampPageOffset(50, 49, 25)).toBe(25)
    expect(clampPageOffset(75, 3, 25)).toBe(0)
    expect(clampPageOffset(200, 101, 50)).toBe(100)
  })

  it("an empty list is page 1, never a page past nothing", () => {
    expect(clampPageOffset(50, 0, 25)).toBe(0)
    expect(clampPageOffset(0, 0, 25)).toBe(0)
  })
})
