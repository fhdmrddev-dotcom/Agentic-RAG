/**
 * Phase 274 plan 04 — HOW A LIBRARY FOLDER PATH IS SPELLED TO A PERSON on the attachment surfaces.
 *
 * Sketch 274's winner A (operator, 2026-10-05) draws every folder path as `Suppliers › Meridian ›
 * Pricing`: the folder list, the dialog's sentences, the chip segment's tooltip and the panel row.
 * 274-03 shipped the `/`-joined string from `folderPathOf` instead (its SUMMARY deviation #3); this
 * module is the one place the drawn spelling lives, so the list, the sentences and the after-mark
 * cannot come to spell one path two ways.
 *
 * ⛔ DISPLAY ONLY. `folderPathOf` (`components/chat/scopeCopy.ts`) stays `/`-joined and untouched:
 * the scope chip, `DocumentRow` and `FindQuickAdd` read it, and none of them is this phase's.
 * ⛔ The walk is over the folder NAMES, never a split of the `/`-joined string, so a folder whose
 * own name contains `/` is still one segment here.
 * ⛔ A folder this person cannot see (absent from `folders`) yields `null`: no name is invented
 * (T-274-25).
 */

/** The separator sketch 274 draws between path segments. */
export const FOLDER_PATH_SEPARATOR = " › "

interface FolderLike {
  id: string
  name: string
  parent_id: string | null
}

/** The folder's names from the top of the Library down to it, or null when it is not visible. */
export function folderPathParts(folderId: string | null | undefined, folders: readonly FolderLike[]): string[] | null {
  if (!folderId) return null
  const byId = new Map(folders.map((f) => [f.id, f]))
  const parts: string[] = []
  const seen = new Set<string>()
  let cur: string | null | undefined = folderId
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const f = byId.get(cur)
    if (!f) break
    parts.push(f.name)
    cur = f.parent_id
  }
  return parts.length ? parts.reverse() : null
}

/** The full path as a person reads it (`Suppliers › Meridian › Pricing`), or null. */
export function folderDisplayPath(folderId: string | null | undefined, folders: readonly FolderLike[]): string | null {
  const parts = folderPathParts(folderId, folders)
  return parts ? parts.join(FOLDER_PATH_SEPARATOR) : null
}
