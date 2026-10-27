/** Phase 217.1-14 — ChatLayout's fallback replacement tests.
 *
 * When activeView doesn't match any existing branch, UnknownViewFallback
 * renders with the view name, never a blank screen and never a product page.
 */

import { describe, it, expect } from "vitest"

// Load the layout source to assert structural properties.
// D-297-03 (Phase 297-01, REG-09): RE-TARGETED, not retired. The mount switch — and with it the
// trailing fallback — moved VERBATIM from ChatLayout into AppViewSwitch, so `LAYOUT` below is the
// switch's source. ChatLayout is read too, for the one-home arm at the bottom.
import layoutSource from "@/components/layout/AppViewSwitch.tsx?raw"
import chatLayoutSource from "@/components/layout/ChatLayout.tsx?raw"
import fallbackSource from "@/components/layout/UnknownViewFallback.tsx?raw"

const lf = (s: string) => s.replace(/\r\n/g, "\n")
const LAYOUT = lf(layoutSource)
const CHAT_LAYOUT = lf(chatLayoutSource)
const FALLBACK = lf(fallbackSource)
/** The LINE-ANCHORED comment stripper (`renameFence.test.ts:89`). */
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("ChatLayout fallback", () => {
  it("the trailing else renders UnknownViewFallback, not KnowledgeHealthPage", () => {
    // D-297-03: identity anchor — this is the switch, not an empty or wrong file.
    expect(LAYOUT).toContain("export function AppViewSwitch")
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

  it("D-297-03: the fallback has ONE home — ChatLayout's code no longer mounts it", () => {
    const code = codeOf(CHAT_LAYOUT)
    // Non-vacuity: the stripper kept code, and this really is ChatLayout rendering the switch.
    expect(code).toContain("export function ChatLayout")
    expect(code).toContain("<AppViewSwitch")
    expect(code).not.toContain("<UnknownViewFallback")
  })
})