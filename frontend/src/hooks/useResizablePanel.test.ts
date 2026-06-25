import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import { useResizablePanel } from "./useResizablePanel"

const OPTS = { storageKey: "k", defaultWidth: 384, minWidth: 340, maxWidth: 760 } as const

function key(name: string): React.KeyboardEvent {
  return { key: name, preventDefault: () => {} } as unknown as React.KeyboardEvent
}

function pointer(over: Partial<{ clientX: number; buttons: number; pointerId: number; setPointerCapture: (id: number) => void }> = {}): React.PointerEvent {
  return {
    preventDefault: () => {},
    pointerId: over.pointerId ?? 1,
    buttons: over.buttons ?? 1,
    clientX: over.clientX ?? 0,
    currentTarget: { setPointerCapture: over.setPointerCapture ?? (() => {}) },
  } as unknown as React.PointerEvent
}

describe("useResizablePanel", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("starts at defaultWidth when nothing is stored", () => {
    const { result } = renderHook(() => useResizablePanel(OPTS))
    expect(result.current.width).toBe(384)
  })

  it("restores a stored width, clamped to the allowed range", () => {
    window.localStorage.setItem("k", "999") // above maxWidth
    const { result } = renderHook(() => useResizablePanel(OPTS))
    expect(result.current.width).toBe(760)
  })

  it("ignores a corrupt stored value and falls back to the default", () => {
    window.localStorage.setItem("k", "not-a-number")
    const { result } = renderHook(() => useResizablePanel(OPTS))
    expect(result.current.width).toBe(384)
  })

  it("grows on ArrowLeft (left handle) and persists the new width", () => {
    const { result } = renderHook(() => useResizablePanel({ ...OPTS, step: 24 }))
    act(() => result.current.separatorProps.onKeyDown(key("ArrowLeft")))
    expect(result.current.width).toBe(408)
    expect(window.localStorage.getItem("k")).toBe("408")
  })

  it("shrinks on ArrowRight and clamps at minWidth", () => {
    const { result } = renderHook(() =>
      useResizablePanel({ ...OPTS, defaultWidth: 350, step: 24 }),
    )
    act(() => result.current.separatorProps.onKeyDown(key("ArrowRight")))
    expect(result.current.width).toBe(340) // 350 - 24 = 326, clamped up to minWidth
  })

  it("captures the pointer on drag start so a release outside the window still ends it", () => {
    const setPointerCapture = vi.fn()
    const { result } = renderHook(() => useResizablePanel(OPTS))
    act(() => result.current.separatorProps.onPointerDown(pointer({ clientX: 500, setPointerCapture })))
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    expect(result.current.isResizing).toBe(true)
  })

  it("drags to a wider width and refuses to track a button-less cursor (stuck-drag guard)", () => {
    const { result } = renderHook(() => useResizablePanel(OPTS))
    act(() => result.current.separatorProps.onPointerDown(pointer({ clientX: 500 })))
    // Move the cursor left (handle on the left edge widens the right-docked panel).
    act(() => result.current.separatorProps.onPointerMove(pointer({ clientX: 400, buttons: 1 })))
    expect(result.current.width).toBe(484) // 384 + (500 - 400)
    // A move with NO button held (released off-window) must END the drag, not follow.
    act(() => result.current.separatorProps.onPointerMove(pointer({ clientX: 300, buttons: 0 })))
    expect(result.current.isResizing).toBe(false)
    expect(result.current.width).toBe(484) // unchanged — did not chase the button-less cursor
  })

  it("ends the drag on lostpointercapture (e.g. window blur mid-drag)", () => {
    const { result } = renderHook(() => useResizablePanel(OPTS))
    act(() => result.current.separatorProps.onPointerDown(pointer({ clientX: 500 })))
    expect(result.current.isResizing).toBe(true)
    act(() => result.current.separatorProps.onLostPointerCapture(pointer({ clientX: 500 })))
    expect(result.current.isResizing).toBe(false)
  })

  it("persists only after the drag settles, not on every frame", () => {
    const { result } = renderHook(() => useResizablePanel(OPTS))
    expect(window.localStorage.getItem("k")).toBe("384") // mount persisted the default
    act(() => result.current.separatorProps.onPointerDown(pointer({ clientX: 500 })))
    act(() => result.current.separatorProps.onPointerMove(pointer({ clientX: 460, buttons: 1 })))
    expect(result.current.width).toBe(424) // 384 + 40, mid-drag
    expect(window.localStorage.getItem("k")).toBe("384") // NOT written mid-drag
    act(() => result.current.separatorProps.onPointerUp(pointer({ clientX: 460, buttons: 0 })))
    expect(window.localStorage.getItem("k")).toBe("424") // written once, on settle
  })

  it("exposes ARIA separator semantics for keyboard/AT users", () => {
    const { result } = renderHook(() => useResizablePanel(OPTS))
    const p = result.current.separatorProps
    expect(p.role).toBe("separator")
    expect(p["aria-orientation"]).toBe("vertical")
    expect(p["aria-valuemin"]).toBe(340)
    expect(p["aria-valuemax"]).toBe(760)
    expect(p["aria-valuenow"]).toBe(384)
    expect(p.tabIndex).toBe(0)
  })
})
