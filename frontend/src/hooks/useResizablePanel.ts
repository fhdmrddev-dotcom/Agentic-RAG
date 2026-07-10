import { useCallback, useEffect, useRef, useState } from "react"

interface UseResizablePanelOptions {
  /** localStorage key the chosen width is persisted under. */
  storageKey: string
  /** Width (px) used when nothing is stored yet — keep equal to the old fixed width
   *  so sibling side-rails stay visually consistent at rest. */
  defaultWidth: number
  /** Smallest the panel may shrink to. */
  minWidth: number
  /** Largest the panel may grow to (so it never swallows the whole page). */
  maxWidth: number
  /**
   * Which edge the drag handle lives on. A RIGHT-docked panel keeps its handle on
   * the LEFT edge, so dragging the cursor left widens it → `"left"` (the default).
   */
  side?: "left" | "right"
  /** Keyboard nudge step in px (arrow keys while the handle is focused). */
  step?: number
}

interface ResizableSeparatorProps {
  role: "separator"
  "aria-orientation": "vertical"
  "aria-valuenow": number
  "aria-valuemin": number
  "aria-valuemax": number
  tabIndex: 0
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onLostPointerCapture: (e: React.PointerEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

interface UseResizablePanelResult {
  /** Current panel width in px — feed to `style={{ width }}`. */
  width: number
  /** True while a drag is in progress (use to suppress text-selection / show grip). */
  isResizing: boolean
  /** Spread onto the drag-handle element (an ARIA separator with keyboard support). */
  separatorProps: ResizableSeparatorProps
}

/**
 * Drag- and keyboard-resizable side panel with a remembered width.
 *
 * Sketch 046-C (Skills editor surface): the Skills detail rail defaults to the
 * standard side-rail width so it stays consistent with every other panel, but the
 * author can drag (or arrow-key) the left-edge handle to widen it for editing long
 * instructions — and the chosen width persists across reloads via localStorage.
 */
export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side = "left",
  step = 24,
}: UseResizablePanelOptions): UseResizablePanelResult {
  const clamp = useCallback(
    (w: number) => Math.min(maxWidth, Math.max(minWidth, w)),
    [minWidth, maxWidth],
  )

  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved !== null) {
        const n = Number.parseInt(saved, 10)
        if (Number.isFinite(n)) return Math.min(maxWidth, Math.max(minWidth, n))
      }
    } catch {
      /* localStorage unavailable (private mode / SSR) — fall back to default */
    }
    return Math.min(maxWidth, Math.max(minWidth, defaultWidth))
  })

  const [isResizing, setIsResizing] = useState(false)
  const dragStart = useRef<{ x: number; w: number } | null>(null)

  const endDrag = useCallback(() => {
    dragStart.current = null
    setIsResizing(false)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      // Capture the pointer so move/up are routed to the handle even if the cursor
      // leaves the window mid-drag — and `lostpointercapture`/`pointercancel`
      // guarantee the drag ends, so a release outside the window can't strand it.
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStart.current = { x: e.clientX, w: width }
      setIsResizing(true)
    },
    [width],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = dragStart.current
      if (!start) return
      // Belt-and-suspenders: if the button is no longer held (e.g. released
      // off-window), stop tracking instead of following a button-less cursor.
      if (e.buttons === 0) {
        endDrag()
        return
      }
      // Right-docked panel (handle on the left): moving the cursor left widens it.
      const delta = side === "left" ? start.x - e.clientX : e.clientX - start.x
      setWidth(clamp(start.w + delta))
    },
    [side, clamp, endDrag],
  )

  // Persist only once the width settles (not on every drag frame).
  useEffect(() => {
    if (isResizing) return
    try {
      window.localStorage.setItem(storageKey, String(width))
    } catch {
      /* ignore persistence failures */
    }
  }, [storageKey, width, isResizing])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Grow on the arrow that matches the drag direction (ArrowLeft for a left handle).
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setWidth((w) => clamp(w + (side === "left" ? step : -step)))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setWidth((w) => clamp(w + (side === "left" ? -step : step)))
      }
    },
    [clamp, side, step],
  )

  return {
    width,
    isResizing,
    separatorProps: {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuenow": Math.round(width),
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onKeyDown,
    },
  }
}
