import type { Folder } from "@/types"

export interface FolderNode extends Folder {
  children: FolderNode[]
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  // Deduplicate by id (guards against server-side global+owned duplicates)
  const unique = Array.from(new Map(folders.map((f) => [f.id, f])).values())
  unique.forEach((f) => map.set(f.id, { ...f, children: [] }))

  const roots: FolderNode[] = []
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function sortChildren(nodes: FolderNode[]): void {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}
