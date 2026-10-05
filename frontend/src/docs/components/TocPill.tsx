// Phase 276-03 (UI-SPEC P2 "Floating TOC pill") — rendered by the caller only when a page has
// >= 3 H2s. Collapsed by default; the active item is the last H2 whose top is above 140px.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ChevronIcon } from "../icons"
import type { Heading } from "../types"

const ACTIVE_LINE = 140

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function isPhone(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 720px)").matches
}

export function TocPill({ headings }: { headings: Heading[] }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const recompute = useCallback(() => {
    let current: string | null = null
    for (const h of headings) {
      const el = document.getElementById(h.id)
      if (el && el.getBoundingClientRect().top <= ACTIVE_LINE) current = h.id
    }
    setActive(current)
  }, [headings])

  // IntersectionObserver tells us when an H2 crosses the active line; a passive scroll listener
  // keeps the choice right between crossings. Both are guarded (jsdom has no IntersectionObserver).
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(recompute)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(() => recompute(), { rootMargin: `-${ACTIVE_LINE}px 0px 0px 0px` })
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el) io.observe(el)
      }
    }
    recompute()
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      io?.disconnect()
    }
  }, [headings, recompute])

  function choose(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })
      el.focus({ preventScroll: true })
      window.history.replaceState(window.history.state, "", `#${id}`)
      setActive(id)
    }
    if (isPhone()) setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  return (
    <aside className={`d-tocpill${open ? " d-open" : ""}`} aria-label="On this page" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="d-tocpill-head"
        aria-expanded={open}
        aria-controls="toc-list"
        onClick={() => setOpen((o) => !o)}
      >
        <span>On this page</span>
        <ChevronIcon className="d-chev" />
      </button>
      <ul id="toc-list" hidden={!open}>
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={active === h.id ? "d-active" : undefined}
              aria-current={active === h.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault()
                choose(h.id)
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
