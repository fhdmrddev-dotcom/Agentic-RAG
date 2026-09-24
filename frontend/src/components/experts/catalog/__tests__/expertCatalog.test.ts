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
import { filterExperts, categoriesOf, resolveFolderNames } from "../expertCatalog"
import { INSTALL_COPY, installView, inviteGate, provenanceByFolder } from "../expertCatalog"
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
