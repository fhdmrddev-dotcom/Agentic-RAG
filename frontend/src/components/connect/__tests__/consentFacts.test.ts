/**
 * Phase 307-03 (OAUTH-04; D-12, D-13, D-35, T-307-01, T-307-07) — the consent page's pure rules.
 *
 * `summarySentence` is the one sentence the member agrees to (UI-SPEC §1a item 6), built from the
 * live choices. `firstUnmetAllow` says why Allow is disabled, in the UI-SPEC order. `whyLine` is the
 * who-well's last line; every WEB case ends with "Only allow it if you just started connecting from
 * {host}." (the 307-03 security decision for /gsd:secure-phase). `redirectMatchesShown` is the last
 * gate before the browser leaves Syrel: it must parse, be https (or http on a loopback host), and
 * name exactly the host the page showed.
 */
import { describe, expect, it } from "vitest"
import { MCP_DRAFT_DEFAULT, type McpDraft } from "@/components/settings/apiKeys/mcpKeyFacts"
import { MCP_CATALOGUE } from "@/components/settings/apiKeys/__tests__/fixtures"
import { firstUnmetAllow, redirectMatchesShown, summarySentence, whyLine } from "../consentFacts"

const TAIL = "It stops working if you leave Acme Legal, and you can disconnect it any time in Settings → API keys."
const d = (over: Partial<McpDraft> = {}): McpDraft => ({ ...MCP_DRAFT_DEFAULT, ...over })
const s = (over: Partial<McpDraft> = {}, folderCount = 0) =>
  summarySentence({ draft: d(over), catalogue: MCP_CATALOGUE, folderCount, orgName: "Acme Legal" })

describe("307-03 summarySentence", () => {
  it("Read only + All folders + external off is the UI-SPEC sentence, word for word", () => {
    expect(s()).toBe(
      "This app will **search and read** in **everything you can see in Acme Legal, not mail or synced sources**, as you. " +
        "It can't ask the agent or run workflows. " + TAIL,
    )
  })

  it("Read and ask, Read ask and run", () => {
    expect(s({ preset: "ask" })).toBe(
      "This app will **search, read and ask the agent** in **everything you can see in Acme Legal, not mail or synced sources**, as you. " +
        "It can't run workflows. " + TAIL,
    )
    expect(s({ preset: "run" })).toBe(
      "This app will **search, read, ask the agent and run your published workflows** in **everything you can see in Acme Legal, not mail or synced sources**, as you. " +
        TAIL,
    )
  })

  it("Choose tools counts the tools granted, companions included", () => {
    expect(s({ preset: "custom", custom: ["search_knowledge_base"] })).toBe(
      "This app will **use 1 tool** in **everything you can see in Acme Legal, not mail or synced sources**, as you. " + TAIL,
    )
    expect(s({ preset: "custom", custom: ["search_knowledge_base", "list_documents"] })).toContain("**use 2 tools**")
  })

  it("Only these folders, with and without external", () => {
    expect(s({ folderMode: "only", folderIds: ["a", "b"] }, 2)).toContain(
      "in **2 folders in Acme Legal, not mail or synced sources**, as you.",
    )
    expect(s({ folderMode: "only", folderIds: ["a"], external: true }, 1)).toContain(
      "in **1 folder in Acme Legal, including mail and synced sources**, as you.",
    )
    expect(s({ external: true })).toContain("**everything you can see in Acme Legal, including mail and synced sources**")
  })

  it("never names the app: the subject is always This app", () => {
    expect(s().startsWith("This app will ")).toBe(true)
  })
})

describe("307-03 firstUnmetAllow — the UI-SPEC order", () => {
  const base = {
    orgOn: true,
    draft: d(),
    catalogue: MCP_CATALOGUE,
    foldersLoaded: true,
  }
  it("no switched-on org wins over everything", () => {
    expect(firstUnmetAllow({ ...base, orgOn: false, draft: d({ preset: "custom", custom: [] }), catalogue: null })).toBe("needOrg")
  })
  it("then Choose tools with none ticked", () => {
    expect(firstUnmetAllow({ ...base, draft: d({ preset: "custom", custom: [], folderMode: "only" }) })).toBe("needTool")
  })
  it("then Only these folders with none ticked", () => {
    expect(firstUnmetAllow({ ...base, draft: d({ folderMode: "only", folderIds: [] }) })).toBe("needFolder")
  })
  it("307 WR-06: ticked folders that would not be SENT (another org's picks) still block Allow", () => {
    const stale = d({ folderMode: "only", folderIds: ["old-org-folder"] })
    expect(firstUnmetAllow({ ...base, draft: stale, sentFolderCount: 0 })).toBe("needFolder")
    expect(firstUnmetAllow({ ...base, draft: stale, sentFolderCount: 1 })).toBeNull()
  })
  it("then the catalogue or the folders still loading", () => {
    expect(firstUnmetAllow({ ...base, catalogue: null })).toBe("waitTools")
    expect(firstUnmetAllow({ ...base, foldersLoaded: false, draft: d({ folderMode: "only", folderIds: ["x"] }) })).toBe("waitFolders")
  })
  it("nothing unmet: null", () => {
    expect(firstUnmetAllow(base)).toBeNull()
    expect(firstUnmetAllow({ ...base, foldersLoaded: false })).toBeNull() // All folders needs no list
  })
})

describe("307-03 whyLine — every web case ends with the 'just started connecting' clause", () => {
  const ONLY = (host: string) => `Only allow it if you just started connecting from ${host}.`
  it("loopback", () => {
    expect(whyLine({ redirect_kind: "loopback", name_source: "dcr", host_seeded: false, redirect_host: "localhost", published_host: null })).toBe(
      "It will send you back to an app on this computer. Only allow it if you just started connecting in Claude Code or another tool yourself.",
    )
  })
  it("CIMD on the web", () => {
    const t = whyLine({ redirect_kind: "web", name_source: "cimd", host_seeded: true, redirect_host: "claude.ai", published_host: "claude.ai" })
    expect(t).toBe(`Its details are published by claude.ai, so this name belongs to that address. ${ONLY("claude.ai")}`)
  })
  it("DCR on the seeded host keeps the clause (the realistic consent-phishing case)", () => {
    const t = whyLine({ redirect_kind: "web", name_source: "dcr", host_seeded: true, redirect_host: "claude.ai", published_host: null })
    expect(t).toBe(
      `This app registered itself, so Syrel can't check its name. It will send you back to claude.ai, which this deployment allows. ${ONLY("claude.ai")}`,
    )
  })
  it("DCR on any other host", () => {
    const t = whyLine({ redirect_kind: "web", name_source: "dcr", host_seeded: false, redirect_host: "app.example.com", published_host: null })
    expect(t.endsWith(ONLY("app.example.com"))).toBe(true)
  })
})

describe("307-03 redirectMatchesShown — the last gate before leaving Syrel (T-307-01)", () => {
  it("accepts the shown https host and a loopback http address on any port", () => {
    expect(redirectMatchesShown("https://claude.ai/api/mcp/auth_callback?code=x&state=y&iss=z", "claude.ai", "web")).toBe(true)
    expect(redirectMatchesShown("http://localhost:51234/callback?code=x", "localhost", "loopback")).toBe(true)
    expect(redirectMatchesShown("http://127.0.0.1:5000/cb?code=x", "127.0.0.1", "loopback")).toBe(true)
    expect(redirectMatchesShown("http://[::1]:5000/cb?code=x", "[::1]", "loopback")).toBe(true)
    expect(redirectMatchesShown("https://Claude.AI/cb", "claude.ai", "web")).toBe(true)
  })
  it("refuses another host, a look-alike, http on the web, and non-http schemes", () => {
    expect(redirectMatchesShown("https://evil.example/cb?code=x", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("https://claude.ai.evil.com/cb", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("https://evil.example@claude.ai.evil.com/cb", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("http://claude.ai/cb", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("http://claude.ai/cb", "claude.ai", "loopback")).toBe(false)
    expect(redirectMatchesShown("javascript:alert(1)//claude.ai", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("data:text/html,claude.ai", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("not a url", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("", "claude.ai", "web")).toBe(false)
    expect(redirectMatchesShown("https://claude.ai/cb", "", "web")).toBe(false)
  })
  it("with no kind known (deployment off), https any shown host, http only on loopback", () => {
    expect(redirectMatchesShown("https://claude.ai/cb?error=access_denied", "claude.ai", null)).toBe(true)
    expect(redirectMatchesShown("http://localhost:4000/cb", "localhost", null)).toBe(true)
    expect(redirectMatchesShown("http://claude.ai/cb", "claude.ai", null)).toBe(false)
  })
})
