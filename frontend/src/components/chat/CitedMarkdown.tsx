/**
 * Phase 153 Plan 05 (CITE-01) — the cited answer render path (074-A / 075-A).
 *
 * `CitedMarkdown` REUSES the shared `MarkdownRenderer` pipeline verbatim
 * (memoized `DOMPurify.sanitize(marked.parse(content))` into a ref'd div via
 * `dangerouslySetInnerHTML`) so the base render stays byte-identical to the
 * shared path (G-5 / D-14). On top, a post-mount `useLayoutEffect` walks the
 * sanitized HTML's text nodes with a `TreeWalker`, SKIPS `code`/`pre`/`a`
 * ancestors (Pitfall 2), and upgrades each `[n]` where `n ∈ [1, citations.length]`
 * (D-07) into a TRUSTED `<sup>` created via `document.createElement` — a node THIS
 * component owns, so its interactive attributes (`role`/`tabindex`/`aria-label`)
 * are set programmatically and are never re-parsed from model text or stripped by
 * DOMPurify (Pitfall 3 / V5). Out-of-range / `[0]` tokens stay literal (D-02
 * belt-and-suspenders over the backend strip).
 *
 * Interaction (UI-SPEC §Click-through Contract): hover/focus a marker → the
 * `CitationPeek` (153-04) previews the source; click/Enter pins it AND flashes the
 * matching footer row via `flashCitationRow` (153-02 marker→row direction). Esc /
 * outside-click unpins and restores focus to the marker (feeds Phase 155 a11y).
 *
 * Used ONLY on the settled cited-assistant path (MessageItem gates it on
 * `message.citations?.length`); the StreamingNarration body never sees markers
 * (D-05 attach-on-settle). No new package: `marked`/`dompurify` are the shared
 * pipeline, `CitationPeek` is vendored, the flash helpers are the 153-02 contract.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"
import { CitationPeek, type CitationAnchorRect } from "./CitationPeek"
import {
  CITATION_MARKER_ATTR,
  CITATION_ACTIVE_CLASS,
  flashCitationRow,
} from "@/lib/citationNav"

// Same options as MarkdownRenderer (shared pipeline — do not diverge).
marked.setOptions({ gfm: true, breaks: true })

/** `[n]` token. Only in-range members are upgraded; the rest stay literal. */
const MARKER_RE = /\[(\d+)\]/g
/** markerPop stagger (UI-SPEC §Streaming→Settle: `animationDelay = index * 60ms`). */
const STAGGER_MS = 60

interface Props {
  content: string
  citations: Citation[]
  className?: string
}

interface PeekState {
  n: number
  anchorRect: CitationAnchorRect
}

/** True when `node` sits inside a `code`/`pre`/`a` ancestor (skip it — Pitfall 2). */
function isInSkippedAncestor(node: Node, root: HTMLElement): boolean {
  let el: HTMLElement | null = node.parentElement
  while (el && el !== root) {
    const tag = el.tagName.toLowerCase()
    if (tag === "code" || tag === "pre" || tag === "a") return true
    el = el.parentElement
  }
  return false
}

/** Build a TRUSTED marker node (Pitfall 3): owned element, attributes set here. */
function createMarker(n: number, citation: Citation, staggerIndex: number): HTMLElement {
  const sup = document.createElement("sup")
  sup.className = "citation-marker citation-marker--attach"
  sup.setAttribute(CITATION_MARKER_ATTR, String(n))
  sup.setAttribute("role", "button")
  sup.setAttribute("tabindex", "0")
  sup.setAttribute("aria-label", `Citation ${n}: ${citation.filename}`)
  sup.textContent = String(n)
  sup.style.animationDelay = `${staggerIndex * STAGGER_MS}ms`
  return sup
}

export function CitedMarkdown({ content, citations, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [peek, setPeek] = useState<PeekState | null>(null)
  const [pinned, setPinned] = useState(false)

  // Refs keep the imperative (delegated) event handlers free of stale closures.
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned
  const citationsRef = useRef(citations)
  citationsRef.current = citations
  const activeMarkerRef = useRef<HTMLElement | null>(null)

  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content) as string),
    [content],
  )

  /** Toggle the active-ref accent on exactly one marker (imperative — the marker
   *  nodes are owned DOM, not React children). */
  const applyActiveMarker = useCallback((el: HTMLElement | null) => {
    const prev = activeMarkerRef.current
    if (prev && prev !== el) prev.classList.remove(CITATION_ACTIVE_CLASS)
    activeMarkerRef.current = el
    if (el) el.classList.add(CITATION_ACTIVE_CLASS)
  }, [])

  /** Unpin + close and restore focus to the originating marker (Esc / outside). */
  const closePeek = useCallback(() => {
    setPinned(false)
    setPeek(null)
    const el = activeMarkerRef.current
    activeMarkerRef.current = null
    if (el) {
      el.classList.remove(CITATION_ACTIVE_CLASS)
      if (typeof el.focus === "function") el.focus()
    }
  }, [])

  // Post-mount marker upgrade + delegated interaction listeners. Re-runs when the
  // sanitized HTML or the citation set changes; resets to a clean slate first so a
  // citations-only change never double-injects.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = html
    const k = citations.length

    if (k > 0) {
      // Collect candidate text nodes first — mutating during the walk invalidates it.
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let cur = walker.nextNode()
      while (cur) {
        textNodes.push(cur as Text)
        cur = walker.nextNode()
      }
      let staggerIndex = 0
      for (const node of textNodes) {
        const text = node.textContent ?? ""
        if (!text.includes("[")) continue
        if (isInSkippedAncestor(node, container)) continue
        MARKER_RE.lastIndex = 0
        let match: RegExpExecArray | null
        let lastIndex = 0
        let mutated = false
        const frag = document.createDocumentFragment()
        while ((match = MARKER_RE.exec(text)) !== null) {
          const n = parseInt(match[1], 10)
          if (n < 1 || n > k) continue // out-of-range / [0] → stays literal (D-07)
          mutated = true
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
          }
          frag.appendChild(createMarker(n, citations[n - 1], staggerIndex++))
          lastIndex = MARKER_RE.lastIndex
        }
        if (mutated) {
          if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)))
          }
          node.parentNode?.replaceChild(frag, node)
        }
      }
    }

    // ── Delegated interaction (listeners attached programmatically — Pitfall 3) ──
    const markerFrom = (t: EventTarget | null): HTMLElement | null =>
      t instanceof HTMLElement ? t.closest<HTMLElement>(`[${CITATION_MARKER_ATTR}]`) : null
    const nOf = (el: HTMLElement): number | null => {
      const raw = el.getAttribute(CITATION_MARKER_ATTR)
      const n = raw ? parseInt(raw, 10) : NaN
      return Number.isInteger(n) && n >= 1 && n <= citationsRef.current.length ? n : null
    }
    const rectOf = (el: HTMLElement): CitationAnchorRect => {
      const r = el.getBoundingClientRect()
      return { bottom: r.bottom, left: r.left }
    }
    const openPreview = (el: HTMLElement) => {
      const n = nOf(el)
      if (n == null) return
      setPeek({ n, anchorRect: rectOf(el) })
    }
    const pinMarker = (el: HTMLElement) => {
      const n = nOf(el)
      if (n == null) return
      setPeek({ n, anchorRect: rectOf(el) })
      setPinned(true)
      applyActiveMarker(el)
      // Scope the row flash to this message (falls back to document in isolation).
      const scope = el.closest<HTMLElement>('[data-testid="assistant-message"]') ?? document
      flashCitationRow(n, scope)
    }

    const onOver = (e: MouseEvent) => {
      if (pinnedRef.current) return
      const m = markerFrom(e.target)
      if (m) openPreview(m)
    }
    const onOut = (e: MouseEvent) => {
      if (pinnedRef.current) return
      const m = markerFrom(e.target)
      if (!m) return
      const to = e.relatedTarget
      if (to instanceof Node && m.contains(to)) return
      setPeek(null)
    }
    const onFocusIn = (e: FocusEvent) => {
      if (pinnedRef.current) return
      const m = markerFrom(e.target)
      if (m) openPreview(m)
    }
    const onClick = (e: MouseEvent) => {
      const m = markerFrom(e.target)
      if (!m) return
      e.preventDefault()
      pinMarker(m)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const m = markerFrom(e.target)
      if (!m) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        pinMarker(m)
      }
    }

    container.addEventListener("mouseover", onOver)
    container.addEventListener("mouseout", onOut)
    container.addEventListener("focusin", onFocusIn)
    container.addEventListener("click", onClick)
    container.addEventListener("keydown", onKeyDown)
    return () => {
      container.removeEventListener("mouseover", onOver)
      container.removeEventListener("mouseout", onOut)
      container.removeEventListener("focusin", onFocusIn)
      container.removeEventListener("click", onClick)
      container.removeEventListener("keydown", onKeyDown)
      activeMarkerRef.current = null
    }
  }, [html, citations, applyActiveMarker])

  // Outside-click dismissal for a pinned peek (the peek portals to body, so this
  // is a document-level listener that ignores clicks on the peek or a marker).
  useEffect(() => {
    if (!pinned) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (t.closest(".citation-peek")) return
      if (t.closest(`[${CITATION_MARKER_ATTR}]`)) return
      closePeek()
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [pinned, closePeek])

  const peekCitation = peek ? citations[peek.n - 1] : null

  return (
    <>
      {/* The layout effect SOLELY owns this div's innerHTML (sets the sanitized
          html, then injects the owned marker nodes). We deliberately do NOT use
          `dangerouslySetInnerHTML` here: React must not manage/re-apply the div's
          children, or a parent re-render (e.g. MessageItem's callback ref) would
          wipe the imperatively-injected markers. React owns zero children of this
          node, so the injected DOM survives re-renders. */}
      <div
        ref={containerRef}
        className={cn("markdown text-sm text-foreground leading-relaxed", className)}
      />
      {peek && peekCitation && (
        <CitationPeek
          citation={peekCitation}
          n={peek.n}
          anchorRect={peek.anchorRect}
          pinned={pinned}
          onPin={() => {
            if (pinned) {
              closePeek()
              return
            }
            setPinned(true)
            const el = containerRef.current?.querySelector<HTMLElement>(
              `[${CITATION_MARKER_ATTR}="${peek.n}"]`,
            )
            applyActiveMarker(el ?? null)
          }}
          onClose={closePeek}
        />
      )}
    </>
  )
}
