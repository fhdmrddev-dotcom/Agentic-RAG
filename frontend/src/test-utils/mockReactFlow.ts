/**
 * Phase 183-01 Task 3 — the official React Flow jsdom mock, kept FILE-LOCAL.
 *
 * `<ReactFlow>` measures the DOM to lay out nodes and draw edges. jsdom implements
 * none of that, so without these four mocks a component suite that renders the
 * canvas throws `ReferenceError: ResizeObserver is not defined` and never paints an
 * edge. The recipe below is the one published in the React Flow testing guide
 * (reactflow.dev/learn/advanced-use/testing), reproduced verbatim in behaviour:
 *
 *   1. `ResizeObserver`     — fires its callback on a `setTimeout(…, 0)`
 *   2. `DOMMatrixReadOnly`  — parses `scale(n)` out of the transform into `m22`
 *   3. `offsetHeight` / `offsetWidth` getters on `HTMLElement.prototype`
 *   4. `SVGElement.prototype.getBBox`
 *
 * ⛔ Do NOT move any of this into `src/setupTests.ts`. `Object.defineProperties` on
 * `HTMLElement.prototype` is a GLOBAL mutation that would reach all ~205 suites, and
 * the measured baseline is already flaky (28-35 failures of 1877). Perturbing every
 * suite would destroy the failing-name differential Phase 183 grades on. Each canvas
 * suite imports and calls `mockReactFlow()` itself; the module-level `init` guard
 * makes repeated calls idempotent.
 *
 * Because mock #1 is asynchronous, edge assertions must go through `waitFor` — a
 * synchronous `querySelectorAll(".react-flow__edge")` immediately after `render()`
 * runs before the observer callback and is unreliable.
 */

/**
 * Build a COMPLETE `ResizeObserverEntry` for `target`.
 *
 * Deviation from the published recipe, and a necessary one: the guide's snippet passes
 * a bare `{ target }`, but `@xyflow/system@0.0.79` dereferences
 * `entry.contentRect.width` in `XYPanZoom`'s extent observer
 * (`node_modules/@xyflow/system/dist/esm/index.mjs:2923`). A bare entry throws
 * `TypeError: Cannot read properties of undefined (reading 'width')` from a timer
 * AFTER the assertions pass — vitest reports "2 passed" but still exits 1 on the
 * unhandled error. Filling in `contentRect` (plus the box-size arrays) from the
 * target's own rect keeps the mock faithful and the suite genuinely green.
 */
function resizeEntryFor(target: Element): ResizeObserverEntry {
  const rect = target.getBoundingClientRect()
  const boxSize = [{ inlineSize: rect.width, blockSize: rect.height }]
  return {
    target,
    contentRect: rect,
    borderBoxSize: boxSize,
    contentBoxSize: boxSize,
    devicePixelContentBoxSize: boxSize,
  } as unknown as ResizeObserverEntry
}

class ResizeObserverMock {
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    setTimeout(() => {
      this.callback([resizeEntryFor(target)], this as unknown as ResizeObserver)
    }, 0)
  }

  unobserve() {}

  disconnect() {}
}

class DOMMatrixReadOnlyMock {
  m22: number

  constructor(transform: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1]
    this.m22 = scale !== undefined ? +scale : 1
  }
}

let init = false

/** Install the four jsdom mocks React Flow needs. Idempotent; call it once per suite. */
export const mockReactFlow = () => {
  if (init) return
  init = true

  const g = globalThis as unknown as {
    ResizeObserver: unknown
    DOMMatrixReadOnly: unknown
  }
  g.ResizeObserver = ResizeObserverMock
  g.DOMMatrixReadOnly = DOMMatrixReadOnlyMock

  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 1
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 1
      },
    },
  })

  ;(
    globalThis.SVGElement as unknown as {
      prototype: { getBBox: () => { x: number; y: number; width: number; height: number } }
    }
  ).prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 })
}
