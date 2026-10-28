/**
 * Phase 298-04 (D-15 / UI-D11) — what a bound folder is called on a Builder picker.
 *
 * Three cases, and never a raw id:
 *   · a folder in the workflow's org (it is in the narrowed list)  → its name
 *   · a visible folder in ANOTHER org (the folder-labels read)     → its name plus where it lives
 *   · a folder the caller cannot see (no name, no label)           → `UNNAMED_KB_OPTION`, unchanged
 *
 * The marker is exactly `lives in {Org}` (`orgItemsCopy.LIVES_IN`): an em dash inside a native
 * `<option>`, a middot in a chip. It is real text, never a `title` (touch has no hover).
 *
 * ⛔ A PURE LEAF: strings in, a string out. No fetch, no React.
 */
import { UNNAMED_KB_OPTION } from "@/components/workflows/builderCopy"
import { LIVES_IN } from "@/components/org/orgItemsCopy"
import type { FolderLabel } from "@/lib/api/orgItems"

export interface FolderLabelInputs {
  /** The folder's name from the narrowed (in-org) list, when it is there. */
  inOrgName?: string | null
  /** The folder-labels read's answer for this id, when it has one. */
  label?: FolderLabel | null
  /** The org the picker is authoring in; a label naming THIS org reads as a plain name. */
  activeOrgId?: string | null
}

function labelled(id: string, opts: FolderLabelInputs, separator: string): string {
  void id // the id is the lookup key at the call site; it is never rendered
  const inOrg = opts.inOrgName?.trim()
  if (inOrg) return inOrg
  const label = opts.label
  if (label && label.name.trim().length > 0) {
    if (opts.activeOrgId != null && label.org_id === opts.activeOrgId) return label.name
    return `${label.name}${separator}${LIVES_IN(label.org_name)}`
  }
  return UNNAMED_KB_OPTION
}

/** The text of a native `<option>`: "Q3 Contracts — lives in Acme Legal". */
export function optionLabel(id: string, opts: FolderLabelInputs): string {
  return labelled(id, opts, " — ")
}

/** The text of a chip: "Q3 Contracts · lives in Acme Legal". */
export function chipLabel(id: string, opts: FolderLabelInputs): string {
  return labelled(id, opts, " · ")
}
