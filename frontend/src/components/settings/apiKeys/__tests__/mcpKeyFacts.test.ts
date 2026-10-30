/**
 * Phase 304-05 (D-08, D-11, D-12, D-22, D-23) — the pure rules of the MCP key draft and card.
 *
 * Presets are derived from the SERVER's catalogue (D-11: never a retyped list), companions travel
 * with their lead (D-12), a ticked folder includes its subtree, and Create key names the first
 * unmet condition in the UI-SPEC §1c order. The module spells no copy and imports no React.
 */
import { describe, expect, it } from "vitest"
import factsRaw from "../mcpKeyFacts.ts?raw"
import {
  filterFolderRows,
  flattenFolders,
  mcpCreateBlocker,
  mcpScopeChips,
  presetFor,
  toolsForPreset,
  withCompanions,
} from "../mcpKeyFacts"
import { MCP_CATALOGUE, READ_ONLY_TOOLS, makeFolder } from "./fixtures"

const ASK = [...READ_ONLY_TOOLS, "ask_agent", "get_answer"]
const ALL = MCP_CATALOGUE.map((t) => t.name)

describe("304-05 presets from the server catalogue", () => {
  it("each preset is the catalogue's groups, in catalogue order", () => {
    expect(toolsForPreset("read", MCP_CATALOGUE)).toEqual(READ_ONLY_TOOLS)
    expect(toolsForPreset("ask", MCP_CATALOGUE)).toEqual(ASK)
    expect(toolsForPreset("run", MCP_CATALOGUE)).toEqual(ALL)
  })

  it("follows the catalogue, not a list of its own", () => {
    const renamed = MCP_CATALOGUE.map((t) => (t.name === "read_document" ? { ...t, name: "open_document" } : t))
    expect(toolsForPreset("read", renamed)).toContain("open_document")
    expect(toolsForPreset("read", renamed)).not.toContain("read_document")
  })

  it("presetFor names the preset whose set equals the tools, else custom", () => {
    expect(presetFor(READ_ONLY_TOOLS, MCP_CATALOGUE)).toBe("read")
    expect(presetFor([...READ_ONLY_TOOLS].reverse(), MCP_CATALOGUE)).toBe("read")
    expect(presetFor(ASK, MCP_CATALOGUE)).toBe("ask")
    expect(presetFor(ALL, MCP_CATALOGUE)).toBe("run")
    expect(presetFor(["search_knowledge_base"], MCP_CATALOGUE)).toBe("custom")
    expect(presetFor([], MCP_CATALOGUE)).toBe("custom")
    expect(presetFor(READ_ONLY_TOOLS, [])).toBe("custom")
  })

  it("withCompanions: get_answer with ask_agent; list_workflows + get_workflow_run with run_workflow", () => {
    expect(withCompanions(["ask_agent"], MCP_CATALOGUE)).toEqual(["ask_agent", "get_answer"])
    expect(withCompanions(["run_workflow"], MCP_CATALOGUE)).toEqual(["list_workflows", "run_workflow", "get_workflow_run"])
    // a companion never stays without its lead, and an unknown name is dropped
    expect(withCompanions(["get_answer", "search_knowledge_base", "nope"], MCP_CATALOGUE)).toEqual(["search_knowledge_base"])
  })
})

describe("304-05 flattenFolders — the narrowing tree", () => {
  const folders = [
    makeFolder({ id: "b", name: "Beta" }),
    makeFolder({ id: "a", name: "Alpha" }),
    makeFolder({ id: "a2", name: "Zed", parent_id: "a" }),
    makeFolder({ id: "a1", name: "Child", parent_id: "a" }),
    makeFolder({ id: "a1x", name: "Grandchild", parent_id: "a1" }),
    makeFolder({ id: "orphan", name: "Orphan", parent_id: "gone" }),
  ]

  it("orders each level by name, depth from the root, orphans at the top level", () => {
    const rows = flattenFolders(folders, new Set())
    expect(rows.map((r) => [r.folder.id, r.depth])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a1x", 2],
      ["a2", 1],
      ["b", 0],
      ["orphan", 0],
    ])
    expect(rows.find((r) => r.folder.id === "a1x")?.path).toBe("Alpha / Child / Grandchild")
  })

  it("a ticked folder includes its whole subtree (checked and not its own choice)", () => {
    const rows = flattenFolders(folders, new Set(["a"]))
    const by = Object.fromEntries(rows.map((r) => [r.folder.id, r]))
    expect(by.a.checked).toBe(true)
    expect(by.a.included).toBe(false)
    for (const id of ["a1", "a1x", "a2"]) {
      expect(by[id].checked).toBe(true)
      expect(by[id].included).toBe(true)
    }
    expect(by.b.checked).toBe(false)
  })

  it("terminates on a parent cycle and still lists every folder once", () => {
    const cyc = [makeFolder({ id: "x", name: "X", parent_id: "y" }), makeFolder({ id: "y", name: "Y", parent_id: "x" })]
    const rows = flattenFolders(cyc, new Set(["x"]))
    expect(rows.map((r) => r.folder.id).sort()).toEqual(["x", "y"])
  })

  it("filterFolderRows keeps names that match, case-insensitively", () => {
    const rows = flattenFolders(folders, new Set())
    expect(filterFolderRows(rows, "CHI").map((r) => r.folder.id)).toEqual(["a1", "a1x"])
    expect(filterFolderRows(rows, "  ")).toHaveLength(rows.length)
  })
})

describe("304-05 mcpCreateBlocker — the first unmet condition, in order", () => {
  const ok = {
    label: "claude-code-laptop",
    tools: READ_ONLY_TOOLS,
    folderMode: "all" as const,
    folderIds: [] as string[],
    catalogueLoaded: true,
    foldersLoaded: true,
  }

  it("all met → null", () => {
    expect(mcpCreateBlocker(ok)).toBeNull()
  })

  it("label → tool → folder (D-08) → loading", () => {
    expect(mcpCreateBlocker({ ...ok, label: "  ", tools: [], folderMode: "only" })).toBe("needLabel")
    expect(mcpCreateBlocker({ ...ok, tools: [], folderMode: "only" })).toBe("needTool")
    expect(mcpCreateBlocker({ ...ok, folderMode: "only" })).toBe("needFolder")
    expect(mcpCreateBlocker({ ...ok, catalogueLoaded: false, tools: [] })).toBe("waitTools")
    expect(mcpCreateBlocker({ ...ok, folderMode: "only", folderIds: ["a"], foldersLoaded: false })).toBe("waitFolders")
  })

  it("All folders does not wait for the folder list", () => {
    expect(mcpCreateBlocker({ ...ok, foldersLoaded: false })).toBeNull()
  })
})

describe("304-05 mcpScopeChips — the card's scope model", () => {
  it("a preset by key, All folders, no external", () => {
    expect(mcpScopeChips({ tools: READ_ONLY_TOOLS, folders: null, include_external: false }, MCP_CATALOGUE)).toEqual({
      tools: { preset: "read", count: 3, names: READ_ONLY_TOOLS },
      folders: { all: true, shown: [], more: [] },
      external: false,
    })
  })

  it("a hand-picked set is counted; folders after 4 collapse into more; external when included", () => {
    const folders = ["One", "Two", "Three", "Four", "Five", "Six"].map((name, i) => ({ id: String(i), name }))
    const m = mcpScopeChips({ tools: ["search_knowledge_base", "read_document"], folders, include_external: true }, MCP_CATALOGUE)
    expect(m.tools).toEqual({ preset: "custom", count: 2, names: ["search_knowledge_base", "read_document"] })
    expect(m.folders.all).toBe(false)
    expect(m.folders.shown.map((f) => f.name)).toEqual(["One", "Two", "Three", "Four"])
    expect(m.folders.more.map((f) => f.name)).toEqual(["Five", "Six"])
    expect(m.external).toBe(true)
  })

  it("no catalogue → counted, never a guessed preset", () => {
    expect(mcpScopeChips({ tools: READ_ONLY_TOOLS, folders: null, include_external: false }, undefined).tools.preset).toBe("custom")
  })
})

describe("304-05 mcpKeyFacts is pure", () => {
  it("imports no React and no copy", () => {
    expect(factsRaw).not.toMatch(/from "react"/)
    expect(factsRaw).not.toMatch(/Copy"/)
  })
})
