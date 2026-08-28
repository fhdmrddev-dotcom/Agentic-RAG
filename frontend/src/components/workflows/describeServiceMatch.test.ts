/**
 * Phase 214-13 Task 2 — describeServiceMatch tests (sketch 217 §4).
 *
 * THE PROPERTY THIS FILE IS ABOUT: **the fallback is the deliverable, not the match.** Each
 * of the five doubt cases below must fail the NAIVE implementation — a bare
 * `text.toLowerCase().includes(name)` passes the happy path and fails every one of them,
 * which is why they are written as the subject rather than as edge cases.
 */
import { describe, it, expect } from "vitest"

import {
  matchServiceRefusal,
  serviceAnchor,
  unconnectedServicesNamed,
  type ServiceCatalogEntry,
} from "./describeServiceMatch"

const CATALOG: ServiceCatalogEntry[] = [
  { id: "slack", name: "Slack" },
  { id: "notion", name: "Notion" },
  { id: "jira", name: "Jira" },
  { id: "custom_mcp", name: "Custom MCP" },
]

describe("serviceAnchor — it anchors only where it can", () => {
  it("an exact whole-word match anchors, on the AUTHOR'S own characters", () => {
    const text = "Every Monday, post the summary to Slack for the team."
    const anchor = serviceAnchor(text, CATALOG, [])
    expect(anchor).not.toBeNull()
    expect(anchor!.service).toBe("Slack")
    expect(text.slice(anchor!.start, anchor!.end)).toBe("Slack")
  })

  it("it is CASE-INSENSITIVE, and the author's casing survives", () => {
    const anchor = serviceAnchor("push it into slack every friday", CATALOG, [])
    expect(anchor).not.toBeNull()
    // Their word, not the catalog's spelling.
    expect(anchor!.service).toBe("slack")
  })

  it("a PUNCTUATION-ADJACENT match still anchors", () => {
    for (const text of ["send it to (Slack).", "…then Slack, and stop.", "Slack"]) {
      const anchor = serviceAnchor(text, CATALOG, [])
      expect(anchor, text).not.toBeNull()
    }
  })

  it("a MULTI-WORD catalog name anchors as one span", () => {
    const text = "route the result through Custom MCP at the end"
    const anchor = serviceAnchor(text, CATALOG, [])
    expect(anchor).not.toBeNull()
    expect(text.slice(anchor!.start, anchor!.end)).toBe("Custom MCP")
  })

  // ── THE FIVE DOUBTS. Every one returns null. ────────────────────────────────────────

  it("⭐ a SUBSTRING inside a longer word does NOT anchor and does NOT refuse", () => {
    // The naive `includes` implementation matches all three of these.
    for (const text of ["Notionally this runs weekly", "file it with Jirafe", "unSlacked reports"]) {
      expect(serviceAnchor(text, CATALOG, []), text).toBeNull()
      expect(matchServiceRefusal(text, CATALOG, []), text).toBeNull()
    }
  })

  it("⭐ TWO catalog names matching return null — the door falls back to UNANCHORED", () => {
    const text = "Read the Notion page and post it to Slack."
    expect(serviceAnchor(text, CATALOG, [])).toBeNull()
    const refusal = matchServiceRefusal(text, CATALOG, [])
    // …but it still REFUSES, and it still names a service. Only the mark is withheld.
    expect(refusal).not.toBeNull()
    expect(refusal!.anchor).toBeNull()
    // The FIRST-mentioned one — a fact about the author's sentence, not about our table.
    expect(refusal!.serviceId).toBe("notion")
  })

  it("⭐ the SAME service named TWICE returns null — two spans is a coin toss", () => {
    const text = "Post to Slack, and if that fails post to Slack again."
    expect(serviceAnchor(text, CATALOG, [])).toBeNull()
    const refusal = matchServiceRefusal(text, CATALOG, [])
    expect(refusal!.anchor).toBeNull()
    expect(refusal!.serviceId).toBe("slack")
  })

  it("⭐ a service that IS connected produces NO refusal at all", () => {
    const text = "Every Monday, post the summary to Slack."
    expect(serviceAnchor(text, CATALOG, ["slack"])).toBeNull()
    expect(matchServiceRefusal(text, CATALOG, ["slack"])).toBeNull()
    // POSITIVE CONTROL — the same text with nothing connected DOES refuse, so the null above
    // is the connection doing the work rather than the matcher being broken.
    expect(matchServiceRefusal(text, CATALOG, [])).not.toBeNull()
  })

  it("⭐ naming NOTHING produces no refusal, and the empty box is the resting case (#1)", () => {
    for (const text of ["", "   ", "Summarise last week's tickets and write it up."]) {
      expect(matchServiceRefusal(text, CATALOG, []), JSON.stringify(text)).toBeNull()
    }
  })
})

describe("unconnectedServicesNamed — the ordering and the guards", () => {
  it("orders by FIRST MENTION, not by catalog order", () => {
    // `Slack` is first in the catalog and second in the sentence.
    const named = unconnectedServicesNamed("Open a Jira ticket then tell Slack", CATALOG, [])
    expect(named.map((e) => e.id)).toEqual(["jira", "slack"])
  })

  it("a connected service drops out and the rest still list", () => {
    const named = unconnectedServicesNamed("Open a Jira ticket then tell Slack", CATALOG, ["jira"])
    expect(named.map((e) => e.id)).toEqual(["slack"])
  })

  it("connected ids are compared case-insensitively and trimmed", () => {
    expect(unconnectedServicesNamed("tell Slack", CATALOG, ["  SLACK "])).toEqual([])
  })

  it("a DUPLICATE catalog row for one service does not manufacture an ambiguity", () => {
    const withAlias: ServiceCatalogEntry[] = [...CATALOG, { id: "slack", name: "Slack" }]
    const anchor = serviceAnchor("post to Slack", withAlias, [])
    expect(anchor).not.toBeNull()
  })

  it("blank catalog rows are ignored rather than matching everything", () => {
    const ragged: ServiceCatalogEntry[] = [
      { id: "", name: "Slack" },
      { id: "ghost", name: "   " },
    ]
    expect(unconnectedServicesNamed("post to Slack", ragged, [])).toEqual([])
  })

  it("a regex-special catalog name is matched LITERALLY", () => {
    const odd: ServiceCatalogEntry[] = [{ id: "dotted", name: "Node.js" }]
    // The escape is what stops `.` from matching any character…
    expect(unconnectedServicesNamed("deploy to NodeXjs", odd, [])).toEqual([])
    // …and a name ending in a non-word character still anchors, which a `\b` suffix would
    // have inverted.
    const anchor = serviceAnchor("deploy to Node.js today", odd, [])
    expect(anchor).not.toBeNull()
    expect(anchor!.service).toBe("Node.js")
  })
})
