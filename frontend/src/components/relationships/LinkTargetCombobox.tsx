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
 *
 * Phase 284-04 (D-15 / R-05 / UI-SPEC "Pickers on server search") — SERVER MODE, switched on by
 * `onQueryChange`. The owner searches `POST /document-search` and hands the answer in as
 * `candidates`; the box then:
 *   - reports every keystroke (and a pick's name) through `onQueryChange`, and does NOT filter
 *     the candidates by name — the server's match IS the answer (RESEARCH Pitfall 10: a typed
 *     `*` is a server wildcard a client `includes` would drop). Exclusion still applies;
 *   - says what the search is doing in ONE line AFTER the listbox, never inside it, so the
 *     listbox gains no non-option children: "Searching…" (`role="status"`) while `loading`, the
 *     previous options kept with `aria-busy` + `opacity-60`; "More documents match. Type more of
 *     the name to narrow." when `hasMore`; a `role="alert"` "Couldn’t search documents." with
 *     "Try again" (`onRetry`) on `error`, previous options kept. "No matching documents" shows
 *     only after a completed empty answer.
 * Client mode (no `onQueryChange`) is unchanged, byte for byte.
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
  /** 284-04 SERVER MODE: the typed text (and a pick's name). Present → no client name filter. */
  onQueryChange?: (query: string) => void
  /** Server mode: a search for the current text is in flight. */
  loading?: boolean
  /** Server mode: the last search failed (the previous options stay on screen). */
  error?: boolean
  /** Server mode: the server matched more documents than are shown. */
  hasMore?: boolean
  /** Server mode: "Try again" after a failed search. */
  onRetry?: () => void
  /** Server mode: the status line's text colour — the panel/dialog token by default; a page
   *  popover passes its own muted token. */
  statusClassName?: string
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
  onQueryChange,
  loading = false,
  error = false,
  hasMore = false,
  onRetry,
  statusClassName = "text-panel-muted-foreground",
}: Props<T>) {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useRef(`rel-target-listbox-${Math.random().toString(36).slice(2)}`).current
  const serverMode = onQueryChange !== undefined

  /** The actionable candidate set: drop excluded ids, then (client mode only) filter by the
   *  typed name — in server mode the candidates ARE the server's name match. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((d) => !excludeIds.has(d.id))
      .filter((d) => (serverMode || q === "" ? true : d.filename.toLowerCase().includes(q)))
      .slice(0, maxVisible)
  }, [candidates, excludeIds, query, maxVisible, serverMode])

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
    onQueryChange?.(doc.filename) // server mode: the owner's query follows the input
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
          onQueryChange?.(e.target.value) // server mode: the owner searches for it
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
          aria-busy={serverMode && loading ? true : undefined}
          className={cn(
            "mt-1 max-h-44 overflow-y-auto rounded-md border border-border/60",
            serverMode && loading && "transition-opacity opacity-60",
          )}
        >
          {serverMode && filtered.length === 0 && (loading || error) ? null : filtered.length === 0 ? (
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
      {/* Server mode: what the search is doing — AFTER the listbox, never inside it. */}
      {serverMode && listVisible && error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          Couldn’t search documents.{" "}
          <button type="button" onClick={onRetry} className="text-xs text-primary hover:underline">
            Try again
          </button>
        </p>
      ) : serverMode && listVisible && loading ? (
        <p role="status" aria-live="polite" className={cn("mt-1 text-xs", statusClassName)}>
          Searching…
        </p>
      ) : serverMode && listVisible && hasMore ? (
        <p role="status" aria-live="polite" className={cn("mt-1 text-xs", statusClassName)}>
          More documents match. Type more of the name to narrow.
        </p>
      ) : null}
    </>
  )
}

export default LinkTargetCombobox
