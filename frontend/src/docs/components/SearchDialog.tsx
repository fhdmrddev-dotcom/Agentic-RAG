// Phase 276-03 (UI-SPEC §Search) — the header "Search docs" dialog on every docs page except home.
// Modal: focus moves into the input, Tab stays inside, Esc (or opening a result) closes it and
// focus returns to whatever opened it.
import { useEffect, useRef } from "react"
import { SearchBox } from "./SearchBox"

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== "Tab" || !ref.current) return
      const items = Array.from(
        ref.current.querySelectorAll<HTMLElement>('input, button, a[href], [tabindex]:not([tabindex="-1"])'),
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      opener?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  return (
    <div className="d-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="d-dialog" role="dialog" aria-modal="true" aria-label="Search docs">
        <SearchBox variant="dialog" autoFocus onNavigate={onClose} />
      </div>
    </div>
  )
}
