// Phase 276-03 (D-01, G4-1, UI-SPEC P0 "Menu drawer") — the ≤720px full-screen menu, shared by
// the landing and the docs. It lives in src/landing so both entries can import it without the
// landing ever importing docs code; its classes live in landing.css for the same reason.
//
// A real modal: role="dialog" aria-modal, body scroll locked, focus trapped across the toggle
// button + the sheet, Esc or choosing a link closes it, and focus returns to the toggle.
//
// 276 G4-1: the sheet is PORTALED to document.body. Rendered in place it sat inside the sticky
// <header>, whose `backdrop-filter: blur(12px)` makes the header the containing block for fixed
// descendants — so `.menu-drawer`'s `top: 64px; bottom: 0` resolved against the 65px header and
// the open drawer measured 32px tall at a 390px viewport (landing and docs alike). React events
// still bubble through the React tree, so the docs link interceptor keeps working.
import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"

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
  /**
   * docs only — an extra class on the sheet. Portaled to <body>, the sheet sits outside
   * `.docs-root`, so the docs scope its tokens and pinned type scale to this class too.
   */
  className?: string
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

export function MenuDrawer({ open, onClose, toggleRef, appUrl, demoUrl, top, sections, className }: MenuDrawerProps) {
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
      // 276-REVIEW A-WR-04: ~~intervene only at the first/last item~~ — the browser's default
      // then moved focus from the toggle to the header CTA (outside the trap), so forward Tab
      // looped toggle <-> header CTA and never reached the sheet. EVERY Tab is now managed over
      // the item list, so focus can only ever land on the toggle or inside the sheet.
      e.preventDefault()
      const active = document.activeElement as HTMLElement | null
      const i = active ? items.indexOf(active) : -1
      let next: number
      if (i !== -1) {
        next = e.shiftKey ? (i === 0 ? items.length - 1 : i - 1) : (i + 1) % items.length
      } else if (active === sheet) {
        // the sheet itself (focused on open, tabIndex=-1): forward to its first control,
        // back to the toggle that sits before it
        next = e.shiftKey ? 0 : Math.min(1, items.length - 1)
      } else {
        next = e.shiftKey ? items.length - 1 : 0
      }
      items[next].focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose, toggleRef])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={sheetRef}
      id="menu-drawer"
      className={className ? `menu-drawer ${className}` : "menu-drawer"}
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
    </div>,
    document.body,
  )
}
