// Phase 276-03 (D-08, UI-SPEC §Search) — search over the build-time index. No server, no AI.
// The index is fetched on the FIRST focus only; results appear after 2 characters (120ms debounce),
// max 8, in a WAI-ARIA 1.2 combobox. Empty / loading / error states use the exact UI-SPEC copy.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { SearchIcon } from "../icons"
import { navigate } from "../router"
import { loadSearchIndex, runSearch, type DocsIndex, type SearchHit } from "../search/searchIndex"
import { DocBadge } from "./DocBadge"

const MIN_CHARS = 2
const DEBOUNCE_MS = 120

type Status = "idle" | "loading" | "ready" | "error"

export interface SearchBoxProps {
  variant?: "hero" | "drawer" | "dialog"
  inputId?: string
  autoFocus?: boolean
  /** Called after a result is opened (the dialog closes itself through this). */
  onNavigate?: () => void
}

function HitBadge({ hit }: { hit: SearchHit }) {
  if (hit.release !== "shipped") return <DocBadge kind="unreleased" />
  if (hit.status === "stub") return <DocBadge kind="coming" />
  return null
}

export function SearchBox({ variant = "hero", inputId, autoFocus, onNavigate }: SearchBoxProps) {
  const uid = useId()
  const listId = `${uid}-results`
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [index, setIndex] = useState<DocsIndex | null>(null)
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  function start() {
    setOpen(true)
    if (started.current) return
    started.current = true
    setStatus("loading")
    loadSearchIndex().then(
      (ix) => {
        setIndex(ix)
        setStatus("ready")
      },
      () => {
        started.current = false
        setStatus("error")
      },
    )
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const hits = useMemo(
    () => (index && debounced.length >= MIN_CHARS ? runSearch(index, debounced) : []),
    [index, debounced],
  )

  useEffect(() => setActive(-1), [debounced])

  const typed = query.trim().length >= MIN_CHARS
  const searched = status === "ready" && debounced.length >= MIN_CHARS
  const showList = open && searched && hits.length > 0
  const announce = searched ? (hits.length > 0 ? `${hits.length} results` : "No results") : ""

  function openHit(hit: SearchHit) {
    setOpen(false)
    navigate(hit.url)
    onNavigate?.()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (variant !== "dialog" && open) {
        e.preventDefault()
        setOpen(false)
      }
      return
    }
    if (!showList) return
    const last = hits.length - 1
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (a >= last ? 0 : a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a <= 0 ? last : a - 1))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActive(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActive(last)
    } else if (e.key === "Enter") {
      e.preventDefault()
      openHit(hits[active >= 0 ? active : 0])
    }
  }

  return (
    <div className={`d-search d-search-${variant}`}>
      <div className="d-search-field">
        <SearchIcon className="d-search-icon" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-label="Search the docs"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="Search guides, features, errors…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onFocus={start}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {variant === "hero" && <kbd className="d-kbd">/</kbd>}
      </div>

      <div className="d-sr" aria-live="polite">
        {announce}
      </div>

      <ul id={listId} role="listbox" aria-label="Search results" className="d-search-list" hidden={!showList}>
        {showList &&
          hits.map((hit, i) => (
            <li
              key={hit.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-url={hit.url}
              className={`d-search-row${i === active ? " d-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => openHit(hit)}
            >
              <span className="d-search-row-text">
                <span className="d-search-title">{hit.title}</span>
                <span className="d-muted d-clamp1">
                  {hit.section}
                  {hit.summary ? ` · ${hit.summary}` : ""}
                </span>
              </span>
              <HitBadge hit={hit} />
            </li>
          ))}
      </ul>

      {open && typed && status === "loading" && (
        <div className="d-search-panel" role="status">
          <span className="d-muted">Loading search…</span>
        </div>
      )}
      {typed && status === "error" && (
        <div className="d-search-panel" role="alert">
          Search couldn't load. Refresh the page, or browse the sections below.
        </div>
      )}
      {open && searched && hits.length === 0 && (
        <div className="d-search-panel">
          <p className="d-card-title">No pages match "{debounced}"</p>
          <p className="d-muted">Try a feature name, like workflows, connections or Experts.</p>
          <a href="/docs#browse" onMouseDown={(e) => e.preventDefault()}>
            Browse every section
          </a>
        </div>
      )}
    </div>
  )
}
