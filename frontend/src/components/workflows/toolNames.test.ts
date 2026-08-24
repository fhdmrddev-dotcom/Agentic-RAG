/**
 * Phase 200-04 Task 1 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-01` / `SP-MNR-01` / `SP-MNR-07`).
 *
 * ⚠ THE `constructor` CASE WAS WRITTEN AND OBSERVED RED BEFORE `toolNames.ts` EXISTED, and
 * the observation is recorded here rather than claimed. It was driven against the SHIPPED
 * panel — `PhaseFormPanel` rendered with `available_tools: ["constructor"]`, which is a value
 * the author can really produce, because the non-rails variant's tool field is a FREE-TEXT
 * COMMA FIELD (`PhaseFormPanel.rails.test.tsx:90`). Verbatim:
 *
 *     stderr | Functions are not valid as a React child. ... <span>{Object}</span>
 *     stdout | RENDERED CHIP TEXT >>> "ⓘ"
 *     AssertionError: expected 'ⓘ' to contain 'constructor'
 *
 * ⚠ THAT IS WORSE THAN THE PREDICTED FAILURE AND THE DIFFERENCE MATTERS. The register said
 * a FUNCTION would be *returned into JSX*; what actually happened is that React REFUSED the
 * child, so the chip's label rendered as **nothing at all** — a tool the step really names
 * vanished from the list of what that step can do. A governance surface silently dropped a
 * row. `[Function Object]` would at least have been visible.
 *
 * The cases below are the unit form of the same claim, kept permanently so the class cannot
 * come back, plus a POSITIVE CONTROL that reproduces the shipped `map[id] ?? id` shape and
 * proves it really is broken — without which every negative here could pass against a reader
 * that was never at risk.
 */
import { describe, it, expect } from "vitest"
import { TOOL_PHRASES, toolName } from "./toolNames"

/**
 * The ids the panel is actually handed, published in `200-CHECKLIST.md` §0 (X-13) and
 * derived there by EXECUTION rather than by reading a list:
 *
 *   `rails.toolOptions` ← `GroundingBundle.tools` ← `sorted(schema_tool_names)`
 *   (`backend/app/services/harness/grounding.py:521`) ← `{t["function"]["name"] for t in get_tools(None)}` (`:476`)
 *
 * ⚠ IT IS THE SCHEMA LIST, NOT A PER-USER ONE. `toolOptions` arrives per request and can be
 * the literal `"degraded"`; the atom is worded over *"every id the panel is handed"*, never
 * over the number 28. What this fixture pins is that the phrase table COVERS the schema, so
 * an id added server-side fails here rather than reaching a person as a schema token.
 */
const OFFERED_TOOL_IDS = [
  "analyze_document", "ask_user", "attach_skill_file", "execute_code", "fetch_document_file",
  "get_related_documents", "glob", "grep", "load_skill", "ls", "query_documents",
  "query_documents_by_view", "query_tables", "read_document", "read_skill_file", "recall",
  "remember", "save_skill", "search_documents", "task", "tree", "web_search",
  "workspace_delete", "workspace_diff", "workspace_list", "workspace_read", "workspace_write",
  "write_todos",
] as const

/** The two entries X-13 measured DEAD — named, so `SP-MNR-07` is checked and not assumed. */
const DEAD_MAP_ENTRIES = ["fetch_url", "list_folders"] as const

describe("toolName — the phrase a person reads", () => {
  it("NON-VACUITY — the table is real, and the fixture is the published offered set", () => {
    // Without this every negative below could pass against an empty module.
    expect(Object.keys(TOOL_PHRASES).length).toBeGreaterThan(20)
    expect(OFFERED_TOOL_IDS).toHaveLength(28)
    expect(new Set(OFFERED_TOOL_IDS).size).toBe(28)
  })

  it("names the tool rather than the id", () => {
    expect(toolName("search_documents")).toBe("Search documents")
    expect(toolName("read_document")).toBe("Read a document")
    expect(toolName("execute_code")).toBe("Run code")
  })

  it("⚠ RED-FIRST — `constructor` reads as itself (the EIGHTH live WR-04 sink)", () => {
    // Observed RED against the shipped `map[id] ?? id` before this module existed; the
    // verbatim output is in this file's docblock. This is the assertion that stays.
    expect(toolName("constructor")).toBe("constructor")
  })

  it("⚠ RED-FIRST — `__proto__` reads as itself too", () => {
    expect(toolName("__proto__")).toBe("__proto__")
  })

  it("every inherited Object member reads as itself — the whole class, not two names", () => {
    // `constructor` and `__proto__` are the two the register names; they are not the only
    // two that exist, and a guard that fixed only the named pair would leave the class open.
    for (const key of ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "toLocaleString"]) {
      expect(toolName(key), key).toBe(key)
    }
  })

  it("POSITIVE CONTROL — the shipped `?? id` shape really IS broken on those keys", () => {
    // The reader this module replaces, reproduced exactly. Without this case the assertions
    // above could pass against a lookup that was never at risk, and the fix would be
    // ceremony rather than a mitigation.
    const shippedShape = (id: string): string => {
      const map: Record<string, string> = { search_documents: "Search documents" }
      return map[id] ?? id
    }
    expect(typeof shippedShape("constructor")).toBe("function")
    expect(shippedShape("constructor")).not.toBe("constructor")
    // …and it is fine on an ordinary miss, which is what made the defect invisible.
    expect(shippedShape("a_tool_nobody_named")).toBe("a_tool_nobody_named")
  })

  it("an unnamed id falls back to the id, unchanged — the honest fallback stays", () => {
    expect(toolName("a_tool_nobody_named")).toBe("a_tool_nobody_named")
    expect(toolName("")).toBe("")
  })

  it("COVERAGE — every offered id resolves to a phrase (a SET, never a count)", () => {
    // ⚠ Asserted as a set difference, so a tool added to `get_tools(None)` later fails HERE
    // rather than silently regressing the screen into the half-named state `SP-1` describes.
    const unnamed = OFFERED_TOOL_IDS.filter((id) => toolName(id) === id)
    expect(unnamed).toEqual([])
  })

  it("SP-MNR-07 — the two DEAD entries are gone, and no entry names an unoffered id", () => {
    // X-13: `fetch_url` and `list_folders` were in the shipped map and are NOT in
    // `get_tools(None)`. Deleted rather than re-pointed — a phrase for an id nothing offers
    // is invisible until somebody counts.
    for (const dead of DEAD_MAP_ENTRIES) {
      expect(Object.keys(TOOL_PHRASES)).not.toContain(dead)
    }
    // The stronger claim, and the one that keeps a third dead entry from appearing: the
    // table's key set is EXACTLY the offered set.
    expect(Object.keys(TOOL_PHRASES).slice().sort()).toEqual([...OFFERED_TOOL_IDS].slice().sort())
  })

  it("SP-MNR-01 — no phrase is itself a raw snake_case id", () => {
    // The subtraction, stated over the table rather than over one render: a phrase that is
    // still an id would satisfy the coverage case above by accident if it differed from its
    // own key, so this checks the SHAPE of what a person reads.
    for (const [id, phrase] of Object.entries(TOOL_PHRASES)) {
      expect(phrase, id).not.toMatch(/^[a-z0-9]+(_[a-z0-9]+)+$/)
      expect(phrase, id).not.toContain("_")
    }
  })
})
