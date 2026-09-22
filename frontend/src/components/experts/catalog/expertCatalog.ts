/**
 * Phase 262 plan 03 (PACK-11) — the catalog's pure decisions.
 *
 * Search, category derivation and knowledge-folder naming, decided here so the page is left with
 * nothing to decide but what to draw. No React, no fetch, no module-level state.
 *
 * ⛔ THE CATEGORY PILLS ARE DERIVED, NEVER LISTED. Sketch 261-262 draws five named pills; the
 * `category` column (migration 189) is free text defaulting to `'General'`, so a hardcoded pill
 * menu would advertise categories nobody authored — a sixth demo-Expert-class artefact in the
 * same phase that retired five (RESEARCH R-7 / plan 02). `categoriesOf` reads the rows. The page
 * prepends an "All" affordance; "All" is a UI control, never a member of the derived set.
 *
 * ⛔ AN UNRESOLVABLE FOLDER ID IS A REAL STATE, NOT DEFENSIVE PADDING. The one seeded system
 * Expert binds a knowledge folder whose row migration 188 seeds into a SINGLE org, so any other
 * org's `listFolders()` returns nothing for it (RESEARCH §4b / P-6). `ResolvedFolder` is a
 * discriminated union so a caller can say "a knowledge folder you cannot see" rather than render
 * a blank or silently shorten the list — this repository's own rule, recorded at
 * `nav-items.ts:104-117` ("unknown is not denied") and in the `SourceFolderPicker` ledger row
 * ("a failed child load renders a REASON").
 */

import type { ExpertBundle, Folder } from "@/types"

/**
 * A knowledge folder id, resolved or honestly not. ⛔ There is no third shape and no `name?:` —
 * an optional name would let a caller render `undefined` and call it a label.
 */
export type ResolvedFolder =
  | { id: string; known: true; name: string }
  | { id: string; known: false }

export interface CatalogFilter {
  /** Free text over the sketch's stated surface: "name, topic, or capability". */
  query: string
  /** A derived category value, or {@link ALL_CATEGORIES}. */
  category: string
}

/**
 * The "show everything" sentinel. ⚠ It is a plain string, so an Expert whose author typed the
 * literal category `all` would be unfilterable by that pill. Left as-is deliberately: a sentinel
 * that cannot collide would have to be spelled in the page too, and the collision costs one
 * unreachable pill rather than a wrong list.
 */
export const ALL_CATEGORIES = "all"

/** The four fields the sketch's search box promises. `member_skills` are already NAMES (RESEARCH §4b). */
function searchableText(e: ExpertBundle): string {
  return [e.name, e.description, e.when_to_use ?? "", ...(e.member_skills ?? [])].join("\n")
}

export function filterExperts(experts: ExpertBundle[], opts: CatalogFilter): ExpertBundle[] {
  const q = opts.query.trim().toLowerCase()
  const wantsCategory = opts.category !== ALL_CATEGORIES
  return experts.filter((e) => {
    // An Expert with no category is never returned under a NAMED category — it was not
    // categorised, and putting it under someone else's heading would be an invented fact.
    if (wantsCategory && (e.category ?? "").trim() !== opts.category) return false
    if (!q) return true
    return searchableText(e).toLowerCase().includes(q)
  })
}

export function categoriesOf(experts: ExpertBundle[]): string[] {
  const seen = new Set<string>()
  for (const e of experts) {
    const c = (e.category ?? "").trim()
    if (c) seen.add(c)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/**
 * Resolve folder ids to names, IN INPUT ORDER, with an honest entry for every id that cannot be
 * named. ⛔ Never drops, never returns a blank name.
 *
 * `folders` is typed by the two fields this function reads rather than by the whole `Folder`
 * shape — a `Folder[]` satisfies it, and nothing here can grow a dependency on a column it does
 * not use.
 */
export function resolveFolderNames(
  ids: string[],
  folders: Pick<Folder, "id" | "name">[],
): ResolvedFolder[] {
  const byId = new Map<string, string>()
  for (const f of folders) byId.set(f.id, f.name)
  return ids.map((id) => {
    const name = byId.get(id)
    // A folder that resolved to a blank name is treated as unnameable: rendering "" would be a
    // blank where a reason belongs, which is the same failure as dropping the id.
    if (typeof name === "string" && name.trim()) {
      return { id, known: true as const, name }
    }
    return { id, known: false as const }
  })
}
