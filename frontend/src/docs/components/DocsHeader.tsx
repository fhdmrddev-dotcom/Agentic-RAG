// Phase 276-03 (D-01, UI-SPEC P0) — the docs use the landing's own header (one component, not a
// copy) with current="docs" and three docs-only slots: the "Search docs" trigger (omitted on home,
// where the hero box is the focal point), the drawer search box, and the 11 section links.
// The "/" shortcut focuses the hero box on home and opens the dialog elsewhere, unless typing.
import { useCallback, useEffect, useState } from "react"
import { Navigation } from "../../landing/components/Navigation"
import { docsUrl, useDocs } from "../docsData"
import { SearchIcon } from "../icons"
import { SearchBox } from "./SearchBox"
import { SearchDialog } from "./SearchDialog"

export const HERO_SEARCH_ID = "docs-hero-search"

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable
}

export function DocsHeader({ isHome }: { isHome: boolean }) {
  const { sections } = useDocs()
  const [dialog, setDialog] = useState(false)
  const close = useCallback(() => setDialog(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const hero = document.getElementById(HERO_SEARCH_ID)
      if (isHome && hero) {
        e.preventDefault()
        hero.focus()
      } else if (!isHome) {
        e.preventDefault()
        setDialog(true)
      }
    }
    const onPop = () => setDialog(false)
    document.addEventListener("keydown", onKey)
    window.addEventListener("popstate", onPop)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("popstate", onPop)
    }
  }, [isHome])

  return (
    <>
      <Navigation
        current="docs"
        searchSlot={
          isHome ? undefined : (
            <button type="button" className="btn btn-outline d-search-trigger" onClick={() => setDialog(true)}>
              <SearchIcon />
              Search docs
              <kbd className="d-kbd" aria-hidden="true">
                /
              </kbd>
            </button>
          )
        }
        drawerClassName="d-drawer"
        drawerTop={<SearchBox variant="drawer" />}
        drawerSections={sections.map((s) => (
          <a key={s.id} href={docsUrl(s.id)}>
            {s.title}
          </a>
        ))}
      />
      {dialog && <SearchDialog onClose={close} />}
    </>
  )
}
