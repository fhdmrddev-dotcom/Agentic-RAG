/**
 * Phase 271-03 (D-04) — the Phase 117 document typeahead, EXTRACTED out of
 * `CreateLinkDialog.tsx` so the Find Relationship filter mounts the SAME combobox as the
 * Add-link dialog. Never forked: a second copy would be a second set of hand-wired APG roles
 * to keep correct.
 *
 * MOVED, not rewritten — the state (`query`, `activeIndex`, the listbox id), the filter, the
 * keyboard walk, `choose`, and the input + listbox JSX are the dialog's own lines
 * (CreateLinkDialog.tsx :64-132 and :206-275 at Phase 270), including the WR-04 rule that
 * `aria-controls` names the listbox ONLY while it is in the tree. Two things are new:
 *   - `maxVisible` (default 8): Find offers at most 8 candidates (UI-SPEC S6). The dialog
 *     passes `Infinity`, which keeps its shipped uncapped list byte-for-byte.
 *   - `onChoose(null)` when typing invalidates a prior pick — the dialog used to clear its
 *     own `target` there; the owner of the chosen value now hears about it instead.
 *
 * a11y — the APG roles are wired BY HAND (there is no cmdk dep): the combobox role +
 * aria-expanded / aria-controls / aria-activedescendant / aria-autocomplete="list" on the
 * input, role="listbox" on the list, role="option" + a unique id per candidate.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** The minimum a candidate needs: an id and the name the person types against. */
export interface LinkTargetCandidate {
  id: string
  filename: string
}

interface Props<T extends LinkTargetCandidate> {
  candidates: readonly T[]
  /** Ids never offered (self, already-linked, …). Clarity only — the server is the gate. */
  excludeIds: ReadonlySet<string>
  /** The chosen candidate id, or null when nothing is picked. */
  value: string | null
  /** A pick, or `null` when typing invalidates the prior pick. */
  onChoose: (doc: T | null) => void
  placeholder: string
  /** At most this many options are rendered (default 8, UI-SPEC S6). */
  maxVisible?: number
  /** The input id, for an owner-rendered `<label htmlFor>`. Generated when omitted. */
  inputId?: string
  /** The listbox's accessible name. */
  listboxLabel?: string
  /** The text the input opens with (e.g. the name of an already-picked document). */
  initialQuery?: string
}

export function LinkTargetCombobox<T extends LinkTargetCandidate>({
  candidates,
  excludeIds,
  value,
  onChoose,
  placeholder,
  maxVisible = 8,
  inputId,
  listboxLabel = "Document candidates",
  initialQuery = "",
}: Props<T>) {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useRef(`rel-target-listbox-${Math.random().toString(36).slice(2)}`).current

  /** The actionable candidate set: drop excluded ids, then filter by the typed name. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((d) => !excludeIds.has(d.id))
      .filter((d) => (q === "" ? true : d.filename.toLowerCase().includes(q)))
      .slice(0, maxVisible)
  }, [candidates, excludeIds, query, maxVisible])

  // Keep the active descendant in range as the filtered set changes.
  useEffect(() => {
    setActiveIndex((i) => (i >= filtered.length ? filtered.length - 1 : i))
  }, [filtered.length])

  // A CHANGED exclusion set (the dialog's rel-type switch) resets the keyboard walk, as the
  // dialog's own chip handler did before the extraction. Keyed on the set's CONTENTS, not
  // its identity, so an owner that rebuilds an equal Set on every render does not reset the
  // walk under the person's arrow keys.
  const excludeKey = useMemo(() => [...excludeIds].sort().join("\u0000"), [excludeIds])
  useEffect(() => {
    setActiveIndex(-1)
  }, [excludeKey])

  function choose(doc: T) {
    onChoose(doc)
    setQuery(doc.filename)
    setActiveIndex(-1)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      choose(filtered[activeIndex])
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
  const listVisible = query.trim() !== "" || activeIndex >= 0 || value == null

  return (
    <>
      <input
        id={inputId ?? `${listboxId}-input`}
        type="text"
        role="combobox"
        aria-expanded={listVisible}
        // Only reference the listbox while it is actually in the tree (WR-04):
        // the <ul id={listboxId}> is conditionally rendered on listVisible, so a
        // static aria-controls would dangle (point at a non-existent element)
        // when collapsed. aria-expanded already conveys popup presence.
        aria-controls={listVisible ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChoose(null) // typing invalidates a prior pick
          setActiveIndex(-1)
        }}
        onKeyDown={onInputKeyDown}
        className={cn(
          "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground",
          "placeholder:text-panel-muted-foreground-dim",
          "focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      />
      {listVisible && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={listboxLabel}
          className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border/60"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-panel-muted-foreground">
              No matching documents
            </li>
          ) : (
            filtered.map((d, i) => (
              <li
                key={d.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={value === d.id}
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus in the input
                  choose(d)
                }}
                className={cn(
                  "cursor-pointer truncate px-3 py-2 text-sm",
                  i === activeIndex || value === d.id
                    ? "bg-accent text-foreground"
                    : "text-foreground hover:bg-accent/50",
                )}
              >
                {d.filename}
              </li>
            ))
          )}
        </ul>
      )}
    </>
  )
}

export default LinkTargetCombobox
