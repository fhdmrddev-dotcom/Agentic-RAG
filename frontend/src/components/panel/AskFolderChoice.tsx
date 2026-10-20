/**
 * Phase 295-06 (D-03 / D-39 / UI-SPEC A.3) — the folder chooser beneath the found-nothing
 * pause's "Search another folder" choice.
 *
 * A LEAF, by the WaitingOnLine rule: no hook, no API import, every string a text child.
 * `PendingAskCard` mounts it once, only while that choice is selected, and owns nothing new
 * for it: the selection lives in the shared ask draft (askDraftStore), keyed by tool_call_id.
 *
 * ⚠ IT CAN SHOW NOTHING THE SERVER DID NOT OFFER. Its rows come ONLY from the `folders` prop,
 * which is the prompt's own engine_pause.folders, bounded server-side by the run's scope root
 * with the already-searched folder removed (295-03). Every shipped folder picker reads the
 * user's WHOLE folder list client-side and would widen access past that bound, so this reuses
 * the shadcn Select PATTERN that the Library's move dialog draws and imports none of them
 * (T-295-06-01).
 *
 * Name only, never an id or a path; 16px of indent per depth level; a nameless row is dropped.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EnginePause } from "@/types"

export const FOLDER_CHOICE_LABEL = "Folder to search"
export const FOLDER_CHOICE_PLACEHOLDER = "Choose a folder…"
export const FOLDER_CHOICE_HELPER =
  "The step runs once more, searching only this folder. The workflow itself is not changed."

/** Horizontal indent per folder depth level, in px (UI-SPEC A.3). */
const INDENT_PER_DEPTH = 16
/** SelectItem's own left padding (`pl-8`, 32px), which leaves room for its check mark. */
const ITEM_BASE_INDENT = 32

interface AskFolderChoiceProps {
  /** The trigger's id; the visible label is tied to it with htmlFor. */
  id: string
  folders: EnginePause["folders"]
  /** The chosen folder id, from the ask draft. */
  value: string | undefined
  onChange: (folderId: string) => void
}

export function AskFolderChoice({ id, folders, value, onChange }: AskFolderChoiceProps) {
  const rows = folders.filter((f) => typeof f.name === "string" && f.name.trim().length > 0)
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground-dim))]"
      >
        {FOLDER_CHOICE_LABEL}
      </label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger id={id} className="min-h-[44px] w-full text-sm">
          <SelectValue placeholder={FOLDER_CHOICE_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {rows.map((f) => (
            <SelectItem
              key={f.id}
              value={f.id}
              className="text-sm"
              style={{ paddingLeft: ITEM_BASE_INDENT + Math.max(0, f.depth) * INDENT_PER_DEPTH }}
            >
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{FOLDER_CHOICE_HELPER}</p>
    </div>
  )
}
