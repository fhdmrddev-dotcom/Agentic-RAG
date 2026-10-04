// The shared site header — the landing AND the docs (Phase 276, D-01). The landing passes no props,
// so its bundle gains no docs code; the docs pass current="docs" plus three slots.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { MenuDrawer } from "./MenuDrawer"

export interface NavigationProps {
  /** Marks the current section's link (aria-current="page"). */
  current?: "docs"
  /** docs only — the header "Search docs" trigger (desktop/tablet), left of Sign in */
  searchSlot?: ReactNode
  /** docs only — rendered at the top of the ≤720px drawer (the search box) */
  drawerTop?: ReactNode
  /** docs only — the section links listed in the drawer under "Sections" */
  drawerSections?: ReactNode
}

const LINK_STYLE = { fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" } as const
const CURRENT_STYLE = { ...LINK_STYLE, color: "hsl(226 60% 97%)", fontWeight: 600 } as const

export function Navigation({ current, searchSlot, drawerTop, drawerSections }: NavigationProps = {}) {
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || "/app"
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string | undefined) || "#start"
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // The toggle is the same element open or closed, so focus can return to it synchronously.
  const onClose = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) toggleRef.current?.focus()
  }, [])

  // A client-side navigation (docs search, links) or growing past the phone breakpoint closes it.
  useEffect(() => {
    if (!open) return
    const onPop = () => setOpen(false)
    const onResize = () => {
      if (window.innerWidth > 720) setOpen(false)
    }
    window.addEventListener("popstate", onPop)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("resize", onResize)
    }
  }, [open])

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid hsl(220 20% 16% / 0.6)",
        background: "hsl(216 45% 4% / 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Phase 276 (D-14/D-15): the static Iris lockup as an <img> — never inline SVG, the
            brand files share gradient ids "g"/"h" and two inline copies would collide. */}
        <a
          href="/"
          aria-label="Syrel home"
          style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
        >
          <img src="/brand/syrel-lockup-iris.svg" height={28} alt="" aria-hidden="true" />
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a className="hide-m" href="/#features" style={LINK_STYLE}>
            Features
          </a>
          <a className="hide-m" href="/#tour" style={LINK_STYLE}>
            Tour
          </a>
          <a className="hide-m" href="/#workflows" style={LINK_STYLE}>
            Workflows
          </a>
          <a className="hide-m" href="/#compare" style={LINK_STYLE}>
            Compare
          </a>
          <a className="hide-m" href="/#security" style={LINK_STYLE}>
            Security
          </a>
          <a
            className="hide-m"
            href="/docs"
            aria-current={current === "docs" ? "page" : undefined}
            style={current === "docs" ? CURRENT_STYLE : LINK_STYLE}
          >
            Docs
          </a>
          {searchSlot && <span className="hide-m nav-search-slot">{searchSlot}</span>}
          <a
            className="hide-m"
            href={appUrl}
            title="Existing customers sign in to their workspace"
            style={LINK_STYLE}
          >
            Sign in
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-outline show-m nav-menu-btn"
            aria-expanded={open}
            aria-controls="menu-drawer"
            onClick={() => (open ? onClose(true) : setOpen(true))}
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
            {open ? "Close menu" : "Menu"}
          </button>
          <a
            className="btn btn-primary"
            href={demoUrl}
            style={{ height: 36, padding: "0 14px" }}
          >
            Book a demo
          </a>
        </nav>
      </div>
      <MenuDrawer
        open={open}
        onClose={onClose}
        toggleRef={toggleRef}
        appUrl={appUrl}
        demoUrl={demoUrl}
        top={drawerTop}
        sections={drawerSections}
      />
    </header>
  )
}
