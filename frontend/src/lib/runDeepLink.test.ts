/**
 * Phase 289-04 Task 1 (SC#3 / T-289-21) — `/app?run=<uuid>` is the run page's shareable
 * address. The value is attacker-controllable (it arrives in a shared link), so the reader
 * accepts a strict UUID and nothing else; the server still decides access.
 *
 * D-297-11 (Phase 297-02, D-18): RE-TARGETED, not retired. The run page now lives at
 * `/app/runs/<uuid>` and the router is the only History writer, so the write/clear helpers are
 * gone and `?run=` survives only as a LEGACY ALIAS the route table reads. The reader cases keep
 * their inputs and move onto the pure `readRunParam(search)`; the four write/clear cases are
 * replaced by the legacy-alias contract (executions stay at or above the 12 pinned).
 */
import { describe, expect, it } from "vitest"
import * as runDeepLink from "./runDeepLink"
import { isStrictUuid, readRunParam } from "./runDeepLink"
import { canonicalAddress, parseAppLocation } from "./appRoutes"

const UUID = "4f1c9a2e-1111-4222-8333-444455556666"

describe("readRunParam (the strict reader, now over a search string)", () => {
  it("returns a valid uuid, lowercased", () => {
    expect(readRunParam(`?run=${UUID.toUpperCase()}`)).toBe(UUID)
  })

  it.each([
    ["missing", ""],
    ["empty", "?run="],
    ["not a uuid", "?run=run-1"],
    ["a path", "?run=../x"],
    ["a uuid with a tail", `?run=${UUID}x`],
    ["an encoded script", "?run=%3Cscript%3E"],
  ])("returns null when the value is %s", (_label, search) => {
    expect(readRunParam(search)).toBeNull()
  })

  it("never throws on a non-string input", () => {
    expect(() => readRunParam(undefined as unknown as string)).not.toThrow()
    expect(isStrictUuid(undefined as unknown as string)).toBe(false)
  })
})

describe("?run= as a legacy alias (D-18) — the route table reads it, nothing writes it", () => {
  it("a valid link opens the run and is replaced by its /app/runs address", () => {
    expect(parseAppLocation("/app", `?run=${UUID}`)).toEqual({ view: "workflow-run", runId: UUID })
    expect(canonicalAddress("/app", `?run=${UUID}`)).toBe(`/app/runs/${UUID}`)
  })

  it("a junk value opens nothing (not-found) and the address is left alone", () => {
    expect(parseAppLocation("/app", "?run=run-1")).toEqual({ view: "not-found" })
    expect(canonicalAddress("/app", "?run=run-1")).toBeNull()
  })

  it("an uppercase id lands on the lowercase address", () => {
    expect(canonicalAddress("/app", `?run=${UUID.toUpperCase()}`)).toBe(`/app/runs/${UUID}`)
  })

  it("other params are ignored by the reader and kept by the rewrite", () => {
    expect(readRunParam(`?tab=files&run=${UUID}&x=1`)).toBe(UUID)
    expect(canonicalAddress("/app", `?tab=files&run=${UUID}`)).toBe(`/app/runs/${UUID}?tab=files`)
  })

  it("the write/clear helpers and the window reader are gone (the router is the only writer, D-33)", () => {
    const exported = Object.keys(runDeepLink)
    expect(exported).toContain("readRunParam")
    for (const retired of ["writeRunDeepLink", "clearRunDeepLink", "readRunDeepLink"]) {
      expect(exported).not.toContain(retired)
    }
  })
})
