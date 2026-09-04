/** Phase 217.1-14 — ChatLayout's fallback replacement tests.
 *
 * When activeView doesn't match any existing branch, UnknownViewFallback
 * renders with the view name, never a blank screen and never a product page.
 */

import { describe, it, expect } from "vitest"

// Load the layout source to assert structural properties
import layoutSource from "@/components/layout/ChatLayout.tsx?raw"
import fallbackSource from "@/components/layout/UnknownViewFallback.tsx?raw"

const lf = (s: string) => s.replace(/\r\n/g, "\n")
const LAYOUT = lf(layoutSource)
const FALLBACK = lf(fallbackSource)

describe("ChatLayout fallback", () => {
  it("the trailing else renders UnknownViewFallback, not KnowledgeHealthPage", () => {
    expect(LAYOUT).not.toContain("<KnowledgeHealthPage />")
    expect(LAYOUT).toContain("UnknownViewFallback")
    expect(LAYOUT).toContain("as never")
  })

  it("the fallback component names the unmounted view", () => {
    expect(FALLBACK).toContain("view has no screen")
    expect(FALLBACK).toContain("activeView")
  })

  it("the fallback renders something visible (no empty fragment)", () => {
    // The component produces a div with text, never an empty fragment.
    expect(FALLBACK).toContain("<div")
    expect(FALLBACK).toContain("</div>")
    expect(FALLBACK).toContain("text-muted-foreground")
  })

  it("the compile-time exhaustiveness check is bypassed via as never in a ternary", () => {
    // Ternary chains don't narrow to never, so `as never` is the escape hatch.
    // The exhaustiveness guarantee is provided by the static assertion in
    // renameFence.test.ts: ActiveView members must match ChatLayout branches.
    expect(LAYOUT).toContain("as never")
  })
})