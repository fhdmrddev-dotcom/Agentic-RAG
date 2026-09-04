/**
 * Phase 221 plan 02 (D-221-04) — the pure leaf: a server verdict becomes a REMEDY.
 *
 * ⚠ The load-bearing tests here are the two that assert `api_off` and `scope_missing` DO NOT
 * produce the same thing. Both arrive as an HTTP 403 with `PERMISSION_DENIED`; their
 * remedies are opposite, and collapsing them is the measured defect this phase exists to
 * close — an operator sent to re-consent scopes that were already correct.
 */
import { describe, expect, it } from "vitest"

import {
  applicationAvailability,
  blockedApplicationCount,
} from "./applicationAvailability"
import type { ApplicationAvailabilityWire } from "./applicationAvailability"
import { AVAILABILITY_COPY } from "./grantsVocabulary"

const CONSOLE_URL =
  "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=877112366454"

function wire(
  app: string,
  state: ApplicationAvailabilityWire["state"],
  consoleUrl?: string | null,
): ApplicationAvailabilityWire {
  return { app, state, console_url: consoleUrl ?? null }
}

describe("applicationAvailability — a working application says nothing", () => {
  it("⭐ `ready` carries NO remedy at all", () => {
    const out = applicationAvailability(wire("drive", "ready"))
    expect(out.state).toBe("ready")
    // ⚠ `toBeUndefined`, not "is an empty object". The component branches on the absence.
    expect(out.remedy).toBeUndefined()
  })
})

describe("applicationAvailability — two 403s, two opposite remedies", () => {
  it("`api_off` names the console and carries the link Google supplied", () => {
    const out = applicationAvailability(wire("sheets", "api_off", CONSOLE_URL))
    expect(out.state).toBe("api_off")
    expect(out.remedy?.sentence).toBe(AVAILABILITY_COPY.API_OFF("Sheets"))
    expect(out.remedy?.action.href).toBe(CONSOLE_URL)
  })

  it("`scope_missing` carries NO href — the console cannot grant a scope", () => {
    const out = applicationAvailability(wire("contacts", "scope_missing"))
    expect(out.state).toBe("scope_missing")
    expect(out.remedy?.sentence).toBe(AVAILABILITY_COPY.SCOPE_MISSING("Contacts"))
    expect(out.remedy?.action.href).toBeUndefined()
  })

  it("⭐ the two remedies are DIFFERENT — sentence and destination both", () => {
    const off = applicationAvailability(wire("sheets", "api_off", CONSOLE_URL))
    const scope = applicationAvailability(wire("sheets", "scope_missing"))
    expect(off.remedy?.sentence).not.toBe(scope.remedy?.sentence)
    expect(Boolean(off.remedy?.action.href)).toBe(true)
    expect(Boolean(scope.remedy?.action.href)).toBe(false)
  })

  it("`api_off` with no usable URL still names the right place", () => {
    const out = applicationAvailability(wire("docs", "api_off", null))
    expect(out.remedy?.sentence).toBe(AVAILABILITY_COPY.API_OFF("Docs"))
    expect(out.remedy?.action.href).toBeUndefined()
    // The diagnosis survives; only the shortcut is lost.
    expect(out.remedy?.action.label).toBe(AVAILABILITY_COPY.API_OFF_ACTION_NO_LINK)
  })
})

describe("applicationAvailability — not knowing is its own answer", () => {
  it("`unknown` never says the API is switched off", () => {
    const out = applicationAvailability(wire("gmail", "unknown"))
    expect(out.remedy?.sentence).toBe(AVAILABILITY_COPY.UNKNOWN("Gmail"))
    expect(out.remedy?.sentence.toLowerCase()).not.toContain("switched off")
    expect(out.remedy?.action.href).toBeUndefined()
  })

  it("⚠ an UNRECOGNISED state degrades to `unknown`, never to `ready`", () => {
    // A server that grows a fifth state must not be read by an old client as "fine".
    const out = applicationAvailability({
      app: "drive",
      state: "quantum_superposition" as ApplicationAvailabilityWire["state"],
    })
    expect(out.state).toBe("unknown")
    expect(out.remedy).toBeDefined()
  })
})

describe("applicationAvailability — the console URL is whitelisted in the browser too", () => {
  it.each([
    ["https://evil.example.com/apis/api/sheets", "a foreign origin"],
    ["javascript:alert(1)", "a javascript: url"],
    ["http://console.cloud.google.com/x", "plain http"],
    ["//console.cloud.google.com/x", "a protocol-relative url"],
  ])("refuses %s (%s)", (url) => {
    const out = applicationAvailability(wire("sheets", "api_off", url))
    expect(out.remedy?.action.href).toBeUndefined()
  })

  it.each([
    "https://console.developers.google.com/apis/api/x/overview",
    "https://console.cloud.google.com/apis/api/x/overview",
  ])("accepts %s", (url) => {
    expect(applicationAvailability(wire("sheets", "api_off", url)).remedy?.action.href).toBe(url)
  })
})

describe("applicationAvailability — an unknown application still reads honestly", () => {
  it("falls back to the raw key rather than an empty name", () => {
    const out = applicationAvailability(wire("tasks", "api_off", CONSOLE_URL))
    expect(out.remedy?.sentence).toContain("tasks")
  })
})

describe("blockedApplicationCount", () => {
  it("counts only the states with a named cause", () => {
    expect(
      blockedApplicationCount([
        wire("drive", "ready"),
        wire("gmail", "ready"),
        wire("sheets", "api_off", CONSOLE_URL),
        wire("docs", "api_off", CONSOLE_URL),
        wire("calendar", "api_off", CONSOLE_URL),
        wire("contacts", "scope_missing"),
      ]),
    ).toBe(4)
  })

  it("⭐ `unknown` is NOT blocked — a dropped request is not their problem", () => {
    expect(blockedApplicationCount([wire("drive", "unknown"), wire("gmail", "unknown")])).toBe(0)
  })

  it("an empty or absent list is 0 — nothing was measured", () => {
    expect(blockedApplicationCount([])).toBe(0)
    expect(blockedApplicationCount(null)).toBe(0)
    expect(blockedApplicationCount(undefined)).toBe(0)
  })

  it("three api_off out of six is 3 — the D-221-12 acceptance figure", () => {
    const verdicts = [
      wire("drive", "ready"),
      wire("gmail", "ready"),
      wire("sheets", "api_off", CONSOLE_URL),
      wire("docs", "api_off", CONSOLE_URL),
      wire("calendar", "api_off", CONSOLE_URL),
      wire("contacts", "ready"),
    ]
    expect(blockedApplicationCount(verdicts)).toBe(3)
  })
})
