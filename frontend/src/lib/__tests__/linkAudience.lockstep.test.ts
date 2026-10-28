/**
 * Phase 299-04 (D-33 / D-34 / UI-D15 / T-299-32) — the link surface's "who can open it" line is
 * PINNED to the server's rule.
 *
 * The resolver (`backend/app/services/link_resolver.py` → `audience_of`) decides who a link opens
 * for. The client derives the same answer for the line it shows beside "Copy link", from the facts
 * the surface already holds. If the two drift, the line over-promises (says "members of Acme" for
 * something only its owner can open) or under-promises. This fence reads the shared case fixture
 * and the backend's finished-run literal at test time, so they cannot disagree without going red.
 *
 * ⛔ Do NOT replace the `?raw` reads with a hand-typed copy of the cases — that would be a second
 * source of the rule, which is the exact drift this file exists to catch.
 */
import { describe, expect, it } from "vitest"

import { audienceLine, audienceOf, linkNoun, TERMINAL_RUN_STATUSES, type Audience, type LinkAudienceKind } from "../linkAudience"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import casesJson from "../../../../backend/tests/unit/fixtures/link_audience_cases.json?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import resolverPy from "../../../../backend/app/services/link_resolver.py?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import leafSource from "../linkAudience.ts?raw"

type Case = { kind: LinkAudienceKind; facts: Record<string, unknown>; audience: Audience }
const cases = JSON.parse(casesJson as string) as Case[]

function backendTerminalStatuses(src: string): string[] {
  const line = src.split(/\r?\n/).find((l) => l.startsWith("TERMINAL_RUN_STATUSES"))
  if (!line) {
    throw new Error("could not find TERMINAL_RUN_STATUSES in link_resolver.py — update THIS parser, do not delete the fence")
  }
  return [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

const ONLY_YOU = "Opens only for you, on any device you're signed in on."

describe("299-04 — the audience leaf is in lockstep with the resolver", () => {
  it("actually read the backend sources (non-vacuity)", () => {
    expect(cases.length).toBeGreaterThanOrEqual(12)
    for (const kind of ["thread", "workflow", "run", "expert"]) {
      expect(cases.some((c) => c.kind === kind)).toBe(true)
    }
    expect((resolverPy as string)).toContain("def audience_of")
    expect(backendTerminalStatuses(resolverPy as string).length).toBeGreaterThan(0)
  })

  it("the finished-run statuses equal the backend literal", () => {
    expect([...TERMINAL_RUN_STATUSES].sort()).toEqual(backendTerminalStatuses(resolverPy as string).sort())
  })

  it.each(cases.map((c) => [c.kind, JSON.stringify(c.facts), c.audience, c] as const))(
    "%s %s → %s",
    (_kind, _facts, audience, c) => {
      expect(audienceOf(c.kind, c.facts)).toBe(audience)
    },
  )

  it("a run that has not finished never opens for members, even with an org", () => {
    for (const status of ["active", "running", "paused", "pending", "queued", undefined]) {
      expect(audienceOf("run", { status, has_org: true })).toBe("only_you")
    }
  })
})

describe("299-04 — the UI-D15 sentences", () => {
  it("each audience reads its sentence verbatim, with the org name substituted", () => {
    expect(audienceLine("only_you", "Acme Legal")).toBe(ONLY_YOU)
    expect(audienceLine("org_members", "Acme Legal")).toBe("Opens for members of Acme Legal.")
    expect(audienceLine("granted", "Acme Legal")).toBe("Opens for the people it's shared with in Acme Legal.")
    expect(audienceLine("everyone", "Acme Legal")).toBe("Opens for anyone signed in to Syrel.")
    expect(audienceLine("plan_experts", "Acme Legal")).toBe("Opens for anyone signed in whose plan includes Experts.")
    expect(audienceLine("managers_only", "Acme Legal")).toBe(
      "It's turned off, so it opens only for people who manage Experts in Acme Legal.",
    )
  })

  it("never claims members of an unnamed org: no org name falls back to the owner-only line", () => {
    expect(audienceLine("org_members", null)).toBe(ONLY_YOU)
    expect(audienceLine("granted", null)).toBe(ONLY_YOU)
    expect(audienceLine("managers_only", null)).toBe(ONLY_YOU)
    expect(audienceLine("everyone", null)).toBe("Opens for anyone signed in to Syrel.")
    expect(audienceLine("plan_experts", null)).toBe("Opens for anyone signed in whose plan includes Experts.")
  })

  it("every sentence appears in the leaf exactly once (one home)", () => {
    const src = leafSource as string
    for (const fragment of [
      "Opens only for you, on any device you're signed in on.",
      "Opens for members of ",
      "Opens for the people it's shared with in ",
      "Opens for anyone signed in to Syrel.",
      "Opens for anyone signed in whose plan includes Experts.",
      "It's turned off, so it opens only for people who manage Experts in ",
    ]) {
      expect(src.split(fragment).length - 1).toBe(1)
    }
  })

  it("the leaf imports nothing", () => {
    expect(/^\s*import\s/m.test(leafSource as string)).toBe(false)
  })

  it("names each kind with the noun the trigger uses", () => {
    expect(linkNoun("thread")).toBe("chat")
    expect(linkNoun("workflow")).toBe("workflow")
    expect(linkNoun("run")).toBe("workflow run")
    expect(linkNoun("expert")).toBe("Expert")
  })
})
