/**
 * Phase 274 plan 03 (D-10 amended) — the Library folder picker with NO Root option.
 *
 * Sketch 274's winner A draws a SEARCHABLE list of FULL folder paths: parents dim, leaf bold,
 * single-select. Both shipped pickers (`MoveToFolderDialog`, `UploadFolderPicker`) offer a top-level
 * "no folder" item; this one deliberately does not, because an unset folder is a refusal (D-10),
 * never a silent top-level save. So there is no sentinel value here either: `value` is a real
 * folder id or `null` (nothing picked yet).
 *
 * ⛔ IT COMMITS NOTHING. It returns a folder id to its owner and the owner decides what to do.
 *
 * a11y — the 035-A obligation (a listbox needs combobox/listbox wiring), wired BY HAND the way
 * `relationships/LinkTargetCombobox.tsx` does: `role=combobox` on the input with
 * `aria-expanded` / `aria-controls` / `aria-activedescendant` / `aria-autocomplete="list"`,
 * `role=listbox` on the list, `role=option` + `aria-selected` + a unique id per folder, and the
 * keyboard walk (ArrowDown / ArrowUp wrap, Enter chooses). The list is ALWAYS expanded — it is the
 * dialog's body, not a popup — so `aria-controls` never dangles while folders exist.
 *
 * Paths come from `folderDisplay.ts`, so the path a person reads here is the same string the
 * dialog's sentences use, spelled with the sketch's ` › ` (274-04 moved the DISPLAY off the
 * `/`-joined `folderPathOf`; that string still backs the search so a typed `/` keeps matching).
 * Folder names are rendered as text nodes only.
 */
import { useEffect, useId, useMemo, useState } from "react"
import { Folder as FolderGlyph } from "lucide-react"
import { folderPathOf } from "@/components/chat/scopeCopy"
import { FOLDER_PATH_SEPARATOR, folderDisplayPath } from "./folderDisplay"
import { cn } from "@/lib/utils"
import type { Folder } from "@/types"
import { COPY } from "./saveToLibraryCopy"

export interface FolderPathListboxProps {
  folders: Folder[]
  /** The picked folder id, or null while nothing is picked. Never a sentinel. */
  value: string | null
  onChange: (id: string | null) => void
  /** The id of an owner-rendered label naming this list. */
  labelledBy?: string
}

interface FolderRow {
  id: string
  /** The full path as displayed, ` › `-joined. */
  path: string
  /** The same path `/`-joined — search matches this too, so a typed `/` still finds it. */
  slashPath: string
  leaf: string
  /** The parent path with its trailing separator, or "" for a top-level folder. */
  parents: string
}

export function FolderPathListbox({ folders, value, onChange, labelledBy }: FolderPathListboxProps) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(-1)
  const baseId = useId()
  const listboxId = `${baseId}-folders`

  const rows = useMemo<FolderRow[]>(
    () =>
      folders
        .map((f) => {
          const parentPath = folderDisplayPath(f.parent_id, folders)
          return {
            id: f.id,
            path: folderDisplayPath(f.id, folders) ?? f.name,
            slashPath: folderPathOf(f.id, folders) ?? f.name,
            leaf: f.name,
            parents: parentPath ? `${parentPath}${FOLDER_PATH_SEPARATOR}` : "",
          }
        })
        .sort((x, y) => x.path.localeCompare(y.path)),
    [folders],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q === ""
      ? rows
      : rows.filter((r) => r.path.toLowerCase().includes(q) || r.slashPath.toLowerCase().includes(q))
  }, [rows, query])

  // Keep the active descendant in range as the filtered set changes.
  useEffect(() => {
    setActiveIndex((i) => (i >= visible.length ? visible.length - 1 : i))
  }, [visible.length])

  const optionId = (i: number) => `${listboxId}-opt-${i}`

  // The walked-to option stays in view inside the bounded list.
  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (visible.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % visible.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? visible.length - 1 : i - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      onChange(visible[activeIndex].id)
    }
  }

  const hasFolders = rows.length > 0

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        role="combobox"
        aria-expanded={hasFolders}
        aria-controls={hasFolders ? listboxId : undefined}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-labelledby={labelledBy}
        autoComplete="off"
        placeholder={COPY.a.search}
        value={query}
        // Typing filters; it never clears the pick (the pick is the owner's state).
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(-1)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground",
          "placeholder:text-muted-foreground",
          "focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      />
      {hasFolders ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="max-h-64 overflow-auto rounded-md border border-border/60 p-1"
        >
          {visible.map((r, i) => {
            const selected = value === r.id
            return (
              <li
                key={r.id}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus in the search box
                  setActiveIndex(i)
                  onChange(r.id)
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                  selected
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : i === activeIndex
                      ? "border-transparent bg-accent text-foreground"
                      : "border-transparent text-foreground hover:bg-accent/60",
                )}
              >
                <FolderGlyph size={14} aria-hidden="true" className="shrink-0 text-amber-500/70" />
                <span className="min-w-0 truncate">
                  {r.parents && <span className="text-muted-foreground">{r.parents}</span>}
                  <span className="font-semibold">{r.leaf}</span>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
      {!hasFolders ? (
        <p role="status" className="px-1 py-2 text-xs text-muted-foreground">
          {COPY.netNew.noFolders}
        </p>
      ) : visible.length === 0 ? (
        <p role="status" className="px-1 py-2 text-xs text-muted-foreground">
          {COPY.netNew.noFolderMatches}
        </p>
      ) : null}
    </div>
  )
}

export default FolderPathListbox
