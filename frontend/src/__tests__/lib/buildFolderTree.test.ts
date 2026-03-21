/**
 * Tests for the buildFolderTree utility in src/lib/folderTree.ts
 */
import { describe, it, expect } from "vitest"
import { buildFolderTree } from "@/lib/folderTree"
import type { Folder } from "@/types"

function makeFolder(overrides: Partial<Folder> & { id: string; name: string }): Folder {
  return {
    user_id: "user-1",
    parent_id: null,
    is_global: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("buildFolderTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildFolderTree([])).toEqual([])
  })

  it("returns all folders as roots when all have parent_id=null", () => {
    const folders: Folder[] = [
      makeFolder({ id: "c", name: "Charlie" }),
      makeFolder({ id: "a", name: "Alpha" }),
      makeFolder({ id: "b", name: "Bravo" }),
    ]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(3)
    expect(tree.map((n) => n.name)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("puts children under their parent", () => {
    const folders: Folder[] = [
      makeFolder({ id: "parent-1", name: "Parent" }),
      makeFolder({ id: "child-1", name: "Child", parent_id: "parent-1" }),
    ]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe("Parent")
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].name).toBe("Child")
  })

  it("deduplicates folders with same id", () => {
    const folder = makeFolder({ id: "dup-1", name: "Dup" })
    const tree = buildFolderTree([folder, folder, folder])
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe("Dup")
  })

  it("sorts children alphabetically at each level", () => {
    const folders: Folder[] = [
      makeFolder({ id: "p1", name: "Parent" }),
      makeFolder({ id: "c3", name: "Zebra", parent_id: "p1" }),
      makeFolder({ id: "c1", name: "Apple", parent_id: "p1" }),
      makeFolder({ id: "c2", name: "Mango", parent_id: "p1" }),
    ]
    const tree = buildFolderTree(folders)
    expect(tree[0].children.map((n) => n.name)).toEqual(["Apple", "Mango", "Zebra"])
  })

  it("treats orphan nodes (parent_id points to non-existent folder) as roots", () => {
    const folders: Folder[] = [
      makeFolder({ id: "orphan-1", name: "Orphan", parent_id: "does-not-exist" }),
    ]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe("Orphan")
    expect(tree[0].children).toHaveLength(0)
  })

  it("handles deeply nested tree", () => {
    const folders: Folder[] = [
      makeFolder({ id: "l1", name: "Level1" }),
      makeFolder({ id: "l2", name: "Level2", parent_id: "l1" }),
      makeFolder({ id: "l3", name: "Level3", parent_id: "l2" }),
    ]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].children[0].name).toBe("Level3")
  })
})
