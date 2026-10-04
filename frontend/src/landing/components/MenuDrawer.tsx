// Phase 276-03 (D-01, G4-1, UI-SPEC P0 "Menu drawer") — the ≤720px full-screen menu, shared by
// the landing and the docs. It lives in src/landing so both entries can import it without the
// landing ever importing docs code; its classes live in landing.css for the same reason.
//
// A real modal: role="dialog" aria-modal, body scroll locked, focus trapped across the toggle
// button + the sheet, Esc or choosing a link closes it, and focus returns to the toggle.
import { useEffect, useRef, type ReactNode, type RefObject } from "react"

export interface MenuDrawerProps {
  open: boolean
  onClose: (restoreFocus: boolean) => void
  toggleRef: RefObject<HTMLButtonElement | null>
  appUrl: string
  demoUrl: string
  /** docs only — the drawer search box */
  top?: ReactNode
  /** docs only — the docs section links */
  sections?: ReactNode
}

const LINKS: { label: string; href: string }[] = [
  { label: "Features", href: "/#features" },
  { label: "Tour", href: "/#tour" },
  { label: "Workflows", href: "/#workflows" },
  { label: "Compare", href: "/#compare" },
  { label: "Security", href: "/#security" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/docs/changelog" },
]

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function MenuDrawer({ open, onClose, toggleRef, appUrl, demoUrl, top, sections }: MenuDrawerProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Esc closes; Tab cycles inside [toggle, ...sheet focusables].
  useEffect(() => {
    if (!open) return
    sheetRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose(true)
        return
      }
      if (e.key !== "Tab") return
      const sheet = sheetRef.current
      if (!sheet) return
      const items = [toggleRef.current, ...Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE))].filter(
        (el): el is HTMLElement => !!el,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      const inside = active && (active === toggleRef.current || sheet.contains(active))
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose, toggleRef])

  if (!open) return null

  return (
    <div
      ref={sheetRef}
      id="menu-drawer"
      className="menu-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      tabIndex={-1}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) onClose(false)
      }}
    >
      {top && <div className="menu-drawer-top">{top}</div>}
      <nav aria-label="Menu links">
        {LINKS.map((l) => (
          <a key={l.href} className="menu-drawer-row" href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      {sections && (
        <div className="menu-drawer-sections">
          <p className="eyebrow menu-drawer-eyebrow">Sections</p>
          <div className="menu-drawer-list">{sections}</div>
        </div>
      )}
      <a className="menu-drawer-row" href={appUrl}>
        Sign in
      </a>
      <a className="btn btn-primary d-btn-block" href={demoUrl}>
        Book a demo
      </a>
    </div>
  )
}
