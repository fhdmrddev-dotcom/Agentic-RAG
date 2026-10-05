/**
 * Phase 262 plan 03 — the catalog's pure decisions, before any component renders anything.
 *
 * ⛔ THE CENTRAL CASE IS (8), THE UNKNOWN FOLDER. It was driven RED first against a stub that
 * FILTERED unresolvable ids out — the silent drop is exactly the defect the discriminated union
 * exists to prevent, and the one system Expert proves the state is real rather than defensive:
 * migration 188 seeds its knowledge folder into ONE org, so every other org's `listFolders()`
 * resolves nothing for it (RESEARCH §4b / P-6).
 */

import { describe, it, expect, vi, afterEach } from "vitest"

// Phase 266-04: the install client functions read their headers from `_core`. Only
// `getAuthHeaders` is stubbed; every other export stays real. The pure selectors below never
// touch this module.
vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({
      "Content-Type": "application/json",
      Authorization: "Bearer tok-266",
      "X-Org-Id": "org-266",
    }),
  }
})

import type { ExpertBundle } from "@/types"
import { filterExperts, categoriesOf, resolveFolderNames, decodeEntities } from "../expertCatalog"
import { INSTALL_COPY, installView, inviteGate, provenanceByFolder } from "../expertCatalog"
import {
  CONNECTION_COPY,
  LEDGER_COPY,
  connectionGate,
  connectionLedgerColumns,
} from "../expertCatalog"
// ⛔ THE BACKEND'S OWN OVERLAY ROW (267-01), read as text — neither side mocks the other.
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import overlayRowRaw from "../../../../../../backend/tests/fixtures/phase267/expert_overlay_row.json?raw"
import { UNKNOWN_FAILURE_SENTENCE, SENTENCE_FOR_KIND } from "@/components/library/ingestionErrorVocabulary"
import { installExpert, listExpertInstalls } from "@/lib/api/experts"

function expert(over: Partial<ExpertBundle> & { name: string }): ExpertBundle {
  return {
    id: over.name,
    slug: over.name.toLowerCase().replace(/\s+/g, "-"),
    description: "",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    visibility: "org",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

const ALPHA = expert({
  name: "Contract Reviewer",
  description: "Reads master services agreements",
  category: "Legal",
  when_to_use: "When an indemnity clause needs a second opinion",
  member_skills: ["clause_extractor"],
})
const BETA = expert({
  name: "Margin Watcher",
  description: "Tracks unit economics",
  category: "Finance",
  when_to_use: "Quarter close",
  member_skills: ["ratio_tool"],
})
const GAMMA = expert({
  name: "Uncategorised One",
  description: "No category on the row at all",
})

const ALL = [ALPHA, BETA, GAMMA]

describe("expertCatalog · filterExperts", () => {
  it("(1) an empty query under `all` returns the list unchanged, in the same order", () => {
    const out = filterExperts(ALL, { query: "", category: "all" })
    expect(out).toEqual(ALL)
    expect(out.map((e) => e.name)).toEqual([
      "Contract Reviewer",
      "Margin Watcher",
      "Uncategorised One",
    ])
  })

  it("(2) matches the NAME case-insensitively", () => {
    expect(filterExperts(ALL, { query: "mArGiN", category: "all" }).map((e) => e.name)).toEqual([
      "Margin Watcher",
    ])
  })

  it("(3) searches description, when_to_use and member_skills — the sketch's stated surface", () => {
    // "Search by name, topic, or capability..." — sketch 261-262 §2, the catalog toolbar.
    expect(
      filterExperts(ALL, { query: "indemnity", category: "all" }).map((e) => e.name),
    ).toEqual(["Contract Reviewer"])
    expect(
      filterExperts(ALL, { query: "unit economics", category: "all" }).map((e) => e.name),
    ).toEqual(["Margin Watcher"])
    expect(
      filterExperts(ALL, { query: "CLAUSE_EXTRACTOR", category: "all" }).map((e) => e.name),
    ).toEqual(["Contract Reviewer"])
  })

  it("(4) a named category excludes a row with NO category; `all` includes it", () => {
    expect(filterExperts(ALL, { query: "", category: "Legal" }).map((e) => e.name)).toEqual([
      "Contract Reviewer",
    ])
    expect(filterExperts(ALL, { query: "", category: "all" })).toHaveLength(3)
  })

  it("(5) query and category compose — both narrow, neither is ignored", () => {
    expect(filterExperts(ALL, { query: "margin", category: "Legal" })).toEqual([])
    expect(
      filterExperts(ALL, { query: "margin", category: "Finance" }).map((e) => e.name),
    ).toEqual(["Margin Watcher"])
  })
})

describe("expertCatalog · categoriesOf", () => {
  it("(6) returns the distinct non-empty categories present, sorted, deduped", () => {
    const dupe = expert({ name: "Second Lawyer", category: "Legal" })
    expect(categoriesOf([...ALL, dupe])).toEqual(["Finance", "Legal"])
  })

  it("(7) an empty catalog yields NO pills — never a default menu of invented names", () => {
    expect(categoriesOf([])).toEqual([])
    // ⛔ The sketch draws five named pills. Deriving them from the rows is what keeps this
    // phase from shipping a SIXTH hardcoded demo artefact in the same phase that retired five
    // (RESEARCH R-7). A category nobody authored must not appear.
    expect(categoriesOf([GAMMA])).toEqual([])
  })
})

// 276-07 (276-04 issue 2): a stored category "Research &amp; Academic Methods" rendered the entity
// literally. React already escapes text, so decoding is DISPLAY-only and never touches filtering.
describe("expertCatalog · decodeEntities (276-07)", () => {
  it("decodes &amp; in a stored category", () => {
    expect(decodeEntities("Research &amp; Academic Methods")).toBe("Research & Academic Methods")
  })

  it("decodes the five named entities and nothing else", () => {
    expect(decodeEntities("&lt;b&gt; &quot;x&quot; &#39;y&#39;")).toBe(`<b> "x" 'y'`)
    expect(decodeEntities("A & B")).toBe("A & B")
    expect(decodeEntities("Plain text")).toBe("Plain text")
    expect(decodeEntities("&copy; &#x26;")).toBe("&copy; &#x26;")
  })

  it("is single-pass: &amp;lt; becomes &lt;, never <", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;")
  })

  it("filtering keeps the RAW value: a pill made from an encoded category still selects its row", () => {
    const encoded = expert({ name: "Scholar", category: "Research &amp; Academic Methods" })
    const pills = categoriesOf([encoded, ALPHA])
    expect(pills).toContain("Research &amp; Academic Methods")
    const pill = pills.find((p) => decodeEntities(p) === "Research & Academic Methods")!
    expect(filterExperts([encoded, ALPHA], { query: "", category: pill }).map((e) => e.name)).toEqual([
      "Scholar",
    ])
  })
})

describe("expertCatalog · resolveFolderNames", () => {
  it("(8) THE RED — an unresolvable id returns an UNKNOWN entry, never a silent drop", () => {
    const out = resolveFolderNames(["a", "b"], [{ id: "a", name: "SEC 10-K" }])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ id: "a", known: true, name: "SEC 10-K" })
    expect(out[1].known).toBe(false)
    expect(out[1].id).toBe("b")
    // and the input order is preserved, so a card can never re-order an Expert's scope
    expect(out.map((f) => f.id)).toEqual(["a", "b"])
  })

  it("(9) no ids yields an empty array — 'binds no folders' is distinguishable from 'binds folders I cannot see'", () => {
    expect(resolveFolderNames([], [{ id: "a", name: "SEC 10-K" }])).toEqual([])
    const unseeable = resolveFolderNames(["zzz"], [{ id: "a", name: "SEC 10-K" }])
    expect(unseeable).toHaveLength(1)
    expect(unseeable[0].known).toBe(false)
  })

  it("(10) a matched folder carrying a BLANK name is unknown, not a blank label", () => {
    const out = resolveFolderNames(["a"], [{ id: "a", name: "   " }])
    expect(out[0].known).toBe(false)
    expect(JSON.stringify(out[0])).not.toContain('"name"')
  })
})

// ── Phase 266-04 (PACK-18 / PACK-19 · D-266-01 / D-266-03) — the install state → control map ──
//
// ⛔ The selector is the ONE place install wording and state→control mapping live. Every case
// below goes through the fixture's OVERRIDE argument (`install`), never by editing its defaults,
// so an org-authored Expert (no `install` key) is exactly what the first ten cases already use.

type InstallStateName = "not_installed" | "installing" | "ready" | "failed"

function install(
  state: InstallStateName,
  over: Partial<{
    can_install: boolean
    cause: string | null
    cause_source: "document" | "install" | null
  }> = {},
) {
  return {
    state,
    folder_id: state === "ready" ? "folder-installed" : null,
    cause: null,
    cause_source: null,
    can_install: true,
    updated_at: "2026-09-24T00:00:00Z",
    ...over,
  } as NonNullable<ExpertBundle["install"]>
}

function firstParty(inst: ExpertBundle["install"]): ExpertBundle {
  return expert({ name: "Financial Analyzer", is_system: true, install: inst })
}

const DRIVER_DICT =
  "{'code': '23505', 'details': None, 'hint': None, 'message': 'duplicate key value violates unique constraint \"documents_completed_hash_unique_idx\"'}"

describe("expertCatalog · installView (266-04)", () => {
  it("(11) no install key, or install: null, is LEGACY — org-authored and corpus-less Experts behave as today", () => {
    expect(installView(ALPHA)).toEqual({ kind: "legacy" })
    expect(installView(firstParty(null))).toEqual({ kind: "legacy" })
    expect(installView(firstParty(undefined))).toEqual({ kind: "legacy" })
  })

  it("(12) ready → chat", () => {
    expect(installView(firstParty(install("ready")))).toEqual({ kind: "chat" })
  })

  it("(13) not_installed + can_install → the Install action", () => {
    expect(installView(firstParty(install("not_installed")))).toEqual({
      kind: "install",
      action: INSTALL_COPY.installAction,
    })
    expect(INSTALL_COPY.installAction).toBe("Install")
  })

  it("(14) failed + can_install → Retry, with the headline and a CLASSIFIED cause — never the raw driver dict", () => {
    const v = installView(
      firstParty(install("failed", { cause: DRIVER_DICT, cause_source: "document" })),
    )
    expect(v).toEqual({
      kind: "retry",
      action: INSTALL_COPY.retryAction,
      headline: INSTALL_COPY.failedHeadline,
      cause: SENTENCE_FOR_KIND.duplicate,
    })
    expect(INSTALL_COPY.retryAction).toBe("Retry install")
    expect(INSTALL_COPY.failedHeadline).toBe("Install failed — retry")
    // T-266-25: nothing of the driver's shape survives into anything a person reads.
    const text = JSON.stringify(v)
    expect(text).not.toContain("23505")
    expect(text).not.toContain("'code'")
    expect(text).not.toContain("{'")
  })

  it("(15) installing is a STATUS line regardless of can_install — nobody gets a button mid-install", () => {
    for (const can of [true, false]) {
      expect(installView(firstParty(install("installing", { can_install: can })))).toEqual({
        kind: "status",
        line: INSTALL_COPY.installing,
      })
    }
  })

  it("(16) not_installed + !can_install → the needs-an-admin line, no action", () => {
    expect(installView(firstParty(install("not_installed", { can_install: false })))).toEqual({
      kind: "status",
      line: INSTALL_COPY.needsAdmin,
    })
  })

  it("(17) failed + !can_install → a status line that still NAMES the cause", () => {
    expect(
      installView(
        firstParty(
          install("failed", {
            can_install: false,
            cause: "The corpus file could not be found on this server.",
            cause_source: "install",
          }),
        ),
      ),
    ).toEqual({
      kind: "status",
      line: INSTALL_COPY.failedNeedsAdmin,
      cause: "The corpus file could not be found on this server.",
    })
  })

  it("(18) a null cause is the vocabulary's honest fallback — never 'null' or 'undefined'", () => {
    for (const source of ["document", "install", null] as const) {
      const v = installView(firstParty(install("failed", { cause: null, cause_source: source })))
      expect(v).toMatchObject({ cause: UNKNOWN_FAILURE_SENTENCE })
      expect(JSON.stringify(v)).not.toMatch(/null|undefined/)
    }
  })

  it("(19) an install-sourced cause is the server's own sentence, passed through", () => {
    const v = installView(
      firstParty(
        install("failed", {
          cause: "Another install of this Expert is already running.",
          cause_source: "install",
        }),
      ),
    )
    expect(v).toMatchObject({ cause: "Another install of this Expert is already running." })
  })
})

describe("expertCatalog · inviteGate (266-04)", () => {
  it("(20) legacy and ready invite freely — null means 'no reason to refuse'", () => {
    expect(inviteGate(ALPHA)).toBeNull()
    expect(inviteGate(firstParty(null))).toBeNull()
    expect(inviteGate(firstParty(install("ready")))).toBeNull()
  })

  it("(21) every not-ready state returns its own reason line", () => {
    expect(inviteGate(firstParty(install("not_installed")))).toBe(INSTALL_COPY.inviteNotInstalled)
    expect(inviteGate(firstParty(install("not_installed", { can_install: false })))).toBe(
      INSTALL_COPY.inviteNotInstalled,
    )
    expect(inviteGate(firstParty(install("installing")))).toBe(INSTALL_COPY.inviteInstalling)
    expect(inviteGate(firstParty(install("failed")))).toBe(INSTALL_COPY.inviteFailed)
  })

  it("(22) the provenance label names the Expert", () => {
    expect(INSTALL_COPY.provenance("Financial Analyzer")).toBe("from Financial Analyzer")
  })

  it("(27) provenanceByFolder maps each installed folder to its Expert, and an empty list to {}", () => {
    expect(provenanceByFolder([])).toEqual({})
    expect(
      provenanceByFolder([
        { expert_bundle_id: "b-1", expert_name: "Financial Analyzer", folder_id: "f-1", state: "ready" },
        { expert_bundle_id: "b-2", expert_name: "Contract Reviewer", folder_id: "f-2", state: "installing" },
      ]),
    ).toEqual({ "f-1": "from Financial Analyzer", "f-2": "from Contract Reviewer" })
  })
})

// ── Phase 267-03 (PACK-22 · D-267-05 / D-267-06 / D-267-27) — THE CONNECTION GATE ─────────────
//
// ⛔ The wording is the deliverable, so every literal is pinned here and spelled nowhere else.
// ⛔ Readiness is a SERVER fact: `connection_state` and `can_connect` arrive on the overlay (267-01);
// the selectors only read them. ⛔ `brings` and `missing` come from ONE payload (D-267-27).

function conn(slug: string, name: string, connected: boolean) {
  return { slug, name, connected }
}

function withConnections(
  state: Array<{ slug: string; name: string; connected: boolean }>,
  can_connect: boolean,
  over: Partial<ExpertBundle> = {},
): ExpertBundle {
  return expert({
    name: "Sales Pipeline Coach",
    required_connections: state.map((c) => c.slug),
    connection_state: state,
    can_connect,
    ...over,
  })
}

describe("expertCatalog · CONNECTION_COPY (267-03)", () => {
  it("(28) the gate line joins one, two and three names — em dash U+2014, never a hyphen", () => {
    expect(CONNECTION_COPY.gateLine(["HubSpot"])).toBe("Requires HubSpot — not connected")
    expect(CONNECTION_COPY.gateLine(["HubSpot", "Salesforce"])).toBe(
      "Requires HubSpot and Salesforce — not connected",
    )
    expect(CONNECTION_COPY.gateLine(["HubSpot", "Salesforce", "Slack"])).toBe(
      "Requires HubSpot, Salesforce and Slack — not connected",
    )
    expect(CONNECTION_COPY.gateLine(["HubSpot"])).toContain("—")
  })

  it("(29) the member's words: the ask, the modal line and the card pill", () => {
    expect(CONNECTION_COPY.memberAsk(["HubSpot"])).toBe("Ask an org admin to connect HubSpot.")
    expect(CONNECTION_COPY.memberAsk(["HubSpot", "Salesforce"])).toBe(
      "Ask an org admin to connect HubSpot and Salesforce.",
    )
    expect(CONNECTION_COPY.modalMemberLine(["HubSpot"])).toBe(
      "Requires HubSpot — not connected. Ask an org admin to connect HubSpot.",
    )
    expect(CONNECTION_COPY.cardMemberPill(["HubSpot"])).toBe("An org admin must connect HubSpot")
    expect(CONNECTION_COPY.cardMemberPill(["HubSpot", "Salesforce"])).toBe(
      "An org admin must connect 2 services",
    )
  })

  it("(30) the admin's controls, the modal pill (middle dot U+00B7) and the ledger headings", () => {
    expect(CONNECTION_COPY.connectOne("HubSpot")).toBe("Connect HubSpot →")
    expect(CONNECTION_COPY.connectMany).toBe("Open Connections →")
    expect(CONNECTION_COPY.modalMissingPill("HubSpot")).toBe("HubSpot · not connected")
    expect(CONNECTION_COPY.modalMissingPill("HubSpot")).toContain("·")
    expect(LEDGER_COPY.brings).toBe("Brings")
    expect(LEDGER_COPY.missing).toBe("Missing")
    expect(LEDGER_COPY.more(2)).toBe("and 2 more")
  })
})

describe("expertCatalog · connectionGate (267-03)", () => {
  it("(31) no connection_state, an empty one, or every connection connected → null", () => {
    expect(connectionGate(ALPHA)).toBeNull()
    expect(connectionGate(withConnections([], true))).toBeNull()
    expect(
      connectionGate(withConnections([conn("notion", "Notion", true)], true)),
    ).toBeNull()
  })

  it("(32) one missing + can_connect → the Connect action, no ask", () => {
    const g = connectionGate(
      withConnections([conn("hubspot", "HubSpot", false), conn("notion", "Notion", true)], true),
    )
    expect(g).toEqual({
      missing: [{ slug: "hubspot", name: "HubSpot" }],
      brings: ["Notion"],
      line: "Requires HubSpot — not connected",
      action: { label: "Connect HubSpot →" },
      ask: null,
    })
  })

  it("(33) two missing + can_connect → Open Connections", () => {
    const g = connectionGate(
      withConnections(
        [conn("hubspot", "HubSpot", false), conn("salesforce", "Salesforce", false)],
        true,
      ),
    )
    expect(g?.action).toEqual({ label: "Open Connections →" })
    expect(g?.ask).toBeNull()
    expect(g?.line).toBe("Requires HubSpot and Salesforce — not connected")
  })

  it("(34) missing + !can_connect → the member's ask and NO action — a member never gets a button", () => {
    for (const can of [false, undefined]) {
      const g = connectionGate(
        withConnections([conn("hubspot", "HubSpot", false)], can as boolean),
      )
      expect(g?.action).toBeNull()
      expect(g?.ask).toBe("Ask an org admin to connect HubSpot.")
    }
  })

  it("(35) exactly one of action / ask is non-null, in every state", () => {
    for (const can of [true, false]) {
      for (const state of [
        [conn("a", "A", false)],
        [conn("a", "A", false), conn("b", "B", false)],
        [conn("a", "A", false), conn("b", "B", true)],
      ]) {
        const g = connectionGate(withConnections(state, can))!
        expect([g.action, g.ask].filter((v) => v !== null)).toHaveLength(1)
      }
    }
  })

  it("(36) brings keeps the payload's order; a blank name falls back to the slug, never a blank", () => {
    const g = connectionGate(
      withConnections(
        [conn("zeta", "Zeta", true), conn("hubspot", "  ", false), conn("alpha", "Alpha", true)],
        true,
      ),
    )!
    expect(g.brings).toEqual(["Zeta", "Alpha"])
    expect(g.missing).toEqual([{ slug: "hubspot", name: "hubspot" }])
    expect(g.line).toBe("Requires hubspot — not connected")
  })

  it("(37) THE WIRE — the backend's own overlay row produces the sentence from its own payload", () => {
    const row = JSON.parse(overlayRowRaw) as ExpertBundle
    const missingNames = row.connection_state!.filter((c) => !c.connected).map((c) => c.name)
    const connectedNames = row.connection_state!.filter((c) => c.connected).map((c) => c.name)
    // A fixture that stopped carrying a missing connection would make this case vacuous.
    expect(missingNames.length).toBeGreaterThan(0)
    const g = connectionGate(row)!
    expect(g.line).toBe(CONNECTION_COPY.gateLine(missingNames))
    expect(g.brings).toEqual(connectedNames)
    expect(g.action !== null).toBe(row.can_connect === true)
  })
})

describe("expertCatalog · gate order install → connection (267-03)", () => {
  const missing = [conn("hubspot", "HubSpot", false)]

  it("(38) an install that is not ready wins — the connection is never mentioned", () => {
    const e = withConnections(missing, true, {
      is_system: true,
      install: install("not_installed"),
    })
    expect(inviteGate(e)).toBe(INSTALL_COPY.inviteNotInstalled)
    expect(installView(e)).toEqual({ kind: "install", action: INSTALL_COPY.installAction })
    const busy = withConnections(missing, true, { install: install("installing") })
    expect(inviteGate(busy)).toBe(INSTALL_COPY.inviteInstalling)
    expect(installView(busy).kind).toBe("status")
  })

  it("(39) install ready or legacy + a missing connection → the gate line, and installView's connect arm", () => {
    for (const inst of [install("ready"), null, undefined]) {
      const e = withConnections(missing, true, { install: inst })
      expect(inviteGate(e)).toBe("Requires HubSpot — not connected")
      const v = installView(e)
      expect(v.kind).toBe("connect")
      expect(v).toEqual({ kind: "connect", gate: connectionGate(e) })
    }
  })

  it("(40) every connection connected → the shipped arms, unchanged", () => {
    const ok = withConnections([conn("notion", "Notion", true)], true)
    expect(installView(ok)).toEqual({ kind: "legacy" })
    expect(inviteGate(ok)).toBeNull()
    expect(installView({ ...ok, install: install("ready") })).toEqual({ kind: "chat" })
  })
})

describe("expertCatalog · connectionLedgerColumns (267-03)", () => {
  const e = withConnections(
    [conn("hubspot", "HubSpot", false), conn("notion", "Notion", true)],
    true,
    { knowledge_folder_ids: ["f1", "f2"], member_skills: ["pipeline_scorer"] },
  )

  it("(41) card: Brings = folder COUNT, skill names, connected names; Missing = the missing names", () => {
    expect(connectionLedgerColumns(e, "card")).toEqual([
      {
        tone: "yes",
        heading: LEDGER_COPY.brings,
        items: [{ label: "2 folders" }, { label: "pipeline_scorer" }, { label: "Notion" }],
      },
      { tone: "no", heading: LEDGER_COPY.missing, items: [{ label: "HubSpot" }] },
    ])
  })

  it("(42) dialog omits the folder count; one folder is singular on the card", () => {
    expect(connectionLedgerColumns(e, "dialog")[0].items).toEqual([
      { label: "pipeline_scorer" },
      { label: "Notion" },
    ])
    const one = { ...e, knowledge_folder_ids: ["f1"] }
    expect(connectionLedgerColumns(one, "card")[0].items[0]).toEqual({ label: "1 folder" })
  })

  it("(43) brings in the ledger and brings in the gate are the SAME list — one payload, two lists", () => {
    const g = connectionGate(e)!
    const cols = connectionLedgerColumns(e, "dialog")
    expect(cols[0].items.map((i) => i.label).slice(-g.brings.length)).toEqual(g.brings)
    expect(cols[1].items.map((i) => i.label)).toEqual(g.missing.map((m) => m.name))
  })

  it("(44) an Expert that brings nothing renders the Missing column alone", () => {
    const bare = withConnections([conn("hubspot", "HubSpot", false)], false)
    expect(connectionLedgerColumns(bare, "dialog")).toEqual([
      { tone: "no", heading: LEDGER_COPY.missing, items: [{ label: "HubSpot" }] },
    ])
  })
})

describe("lib/api/experts · install client (266-04)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("(23) installExpert POSTs to /experts/{id}/install with the auth headers and NO body", async () => {
    const result = {
      expert_bundle_id: "b-1",
      corpus_version: "sha256:abc",
      install: install("installing"),
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(result), { status: 202 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(installExpert("b-1")).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/experts\/b-1\/install$/)
    expect(init.method).toBe("POST")
    expect(init.headers["X-Org-Id"]).toBe("org-266")
    // T-266-24: the org travels only in the validated header, never in a body.
    expect(init.body).toBeUndefined()
  })

  it("(24) a 409 refusal throws an Error whose message is the server's detail.detail sentence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            detail: "This Expert is already being installed in this organisation.",
            error: "install_conflict",
          },
        }),
        { status: 409 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    await expect(installExpert("b-1")).rejects.toThrow(
      "This Expert is already being installed in this organisation.",
    )
  })

  it("(25) listExpertInstalls returns the parsed list on 200", async () => {
    const rows = [
      {
        expert_bundle_id: "b-1",
        expert_name: "Financial Analyzer",
        folder_id: "f-1",
        state: "ready",
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(listExpertInstalls()).resolves.toEqual(rows)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/experts\/installs$/)
  })

  it("(26) a 403 (tier refusal) is an EMPTY list, not an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: { error: "entitlement_required", upgrade_hint: "Upgrade" } }),
        { status: 403 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    await expect(listExpertInstalls()).resolves.toEqual([])
  })
})

describe("expertCatalog · an absent connection is named for a person (267-05 F-2)", () => {
  // Live drive 267-05 (evidence/03c): with NO connector_connections row at all, the server can only
  // echo the slug (`name: "google"`), so the card read "Requires google — not connected". The
  // curated service catalog names it; an uncurated slug still falls back to itself, never a blank.
  it("(F-2a) a slug-only name is replaced by the curated catalog name", () => {
    const g = connectionGate(withConnections([conn("google", "google", false)], true))
    expect(g?.missing).toEqual([{ slug: "google", name: "Google Workspace" }])
    expect(g?.line).toContain("Google Workspace")
    expect(g?.line).not.toMatch(/Requires google\b/)
  })

  it("(F-2b) a real server name is never overridden, and an uncurated slug stays itself", () => {
    const named = connectionGate(withConnections([conn("google", "Acme Google", false)], true))
    expect(named?.missing[0].name).toBe("Acme Google")
    const unknown = connectionGate(withConnections([conn("mcp.example.com", "mcp.example.com", false)], true))
    expect(unknown?.missing[0].name).toBe("mcp.example.com")
  })
})

// 267-REVIEW WR-06 (D-267-35) — a BIASED Expert on a chat with NO folder narrows retrieval to its own
// folders. The decision keeps that behaviour on condition it is STATED; on the threads it names (a
// catalog Start Chat, an invite on an empty unscoped chat) no statement existed anywhere. One pure
// selector turns the preview payload into the statement both doors render.
describe("267-REVIEW WR-06 — narrowingLedgerColumns", () => {
  const base = {
    expert_id: "e-fa",
    expert_name: "Financial Analyzer",
    mode: "biased",
    expert_folders: [{ id: "f1", name: "Financial Reports" }],
    thread_folder: null,
    excluded_count: 0,
    excluded_names: [],
  } as const

  it("biased, no thread folder, with folders → Will use its folders (+ attachments); Won't use All your documents", async () => {
    const { narrowingLedgerColumns } = await import("../expertCatalog")
    const cols = narrowingLedgerColumns({ ...base, expert_folders: [...base.expert_folders], excluded_names: [] })
    expect(cols).not.toBeNull()
    const [will, wont] = cols!
    expect(will.tone).toBe("yes")
    expect(will.heading).toBe("Will use")
    expect(new Set(will.items.map((i) => i.label))).toEqual(new Set(["Financial Reports", "Chat attachments"]))
    expect(wont.tone).toBe("no")
    expect(wont.heading).toBe("Won't use")
    expect(wont.items.map((i) => i.label)).toEqual(["All your documents"])
  })

  it("null when nothing narrows: restricted, a thread folder, or an Expert with no folders", async () => {
    const { narrowingLedgerColumns } = await import("../expertCatalog")
    const p = { ...base, expert_folders: [...base.expert_folders], excluded_names: [] }
    expect(narrowingLedgerColumns({ ...p, mode: "restricted" })).toBeNull()
    expect(narrowingLedgerColumns({ ...p, thread_folder: { id: "t", name: "HR", doc_count: 2 } })).toBeNull()
    expect(narrowingLedgerColumns({ ...p, expert_folders: [] })).toBeNull()
  })
})

// 267-REVIEW IN-06 — the server's `ScopePreviewThreadFolder.name` is `str | None` (a folder the caller
// cannot name), but the TS wire type claimed `string`. A type mismatch has no runtime symptom, so this
// fence reads both sources.
describe("IN-06 — the preview's thread_folder.name admits null on both sides", () => {
  it("server `name: str | None` ⇔ client `name: string | null`", async () => {
    const py = (await import("../../../../../../backend/app/models/thread.py?raw")).default as string
    expect(py).toMatch(/class ScopePreviewThreadFolder\(BaseModel\):[\s\S]*?name: str \| None/)
    const ts = (await import("../../../../lib/api/experts.ts?raw")).default as string
    expect(ts).toMatch(/thread_folder: \{ id: string; name: string \| null; doc_count: number \} \| null/)
  })
})
