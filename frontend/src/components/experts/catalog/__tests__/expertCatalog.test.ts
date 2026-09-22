/**
 * Phase 262 plan 03 — the catalog's pure decisions, before any component renders anything.
 *
 * ⛔ THE CENTRAL CASE IS (8), THE UNKNOWN FOLDER. It was driven RED first against a stub that
 * FILTERED unresolvable ids out — the silent drop is exactly the defect the discriminated union
 * exists to prevent, and the one system Expert proves the state is real rather than defensive:
 * migration 188 seeds its knowledge folder into ONE org, so every other org's `listFolders()`
 * resolves nothing for it (RESEARCH §4b / P-6).
 */

import { describe, it, expect } from "vitest"
import type { ExpertBundle } from "@/types"
import { filterExperts, categoriesOf, resolveFolderNames } from "../expertCatalog"

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
