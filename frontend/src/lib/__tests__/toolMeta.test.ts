/**
 * Phase 174 / STATE-03 — unit tests for outerBannerLabel's pre-answer honesty.
 *
 * Wave-0 gap (RESEARCH Open Q6): there was NO dedicated toolMeta test locking the
 * D-14 byte-identical default. This file is the guard.
 *
 * Two load-bearing invariants:
 *  1. D-14 byte-identical: the pre-tools/pre-planning default MUST stay
 *     "Setting up agent…" (Deep) / "Starting workflow…" (harness) — a reasoning
 *     model streaming reasoning is the ONLY new copy path.
 *  2. STATE-03: when reasoningActive is true (derived from the already-stamped
 *     cross-provider message.reasoningContent), the pre-answer label reads
 *     "Reasoning…" instead of the dead "Setting up agent…".
 *
 * Pure-lib test — imports the function directly, no React (mirrors dedupMessages.test.ts).
 * Written against the extended 5-arg signature: the reasoningActive="Reasoning…" row
 * is RED until Task 2 adds the param + branch. Do NOT weaken the byte-identical
 * assertions to make RED pass — they ARE the D-14 guard.
 */
import { describe, it, expect } from "vitest"
import { outerBannerLabel } from "@/lib/toolMeta"
import type { ToolCall } from "@/types"

describe("outerBannerLabel — STATE-03 pre-answer honesty + D-14 guard", () => {
  it("D-14 byte-identical: the Deep pre-tools default stays 'Setting up agent…'", () => {
    // outerBannerLabel(activeTool, hasAnyTools, isPlanning, isHarness, reasoningActive)
    expect(outerBannerLabel(null, false, false, false, false)).toBe("Setting up agent…")
  })

  it("D-14 byte-identical: the harness pre-tools path stays 'Starting workflow…'", () => {
    expect(outerBannerLabel(null, false, false, true, false)).toBe("Starting workflow…")
  })

  it("STATE-03: reasoningActive=true in the pre-tools window reads 'Reasoning…'", () => {
    expect(outerBannerLabel(null, false, false, false, true)).toBe("Reasoning…")
  })

  it("STATE-03: reasoningActive does NOT override the isPlanning arm — stays 'Thinking…'", () => {
    expect(outerBannerLabel(null, false, true, false, true)).toBe("Thinking…")
    // and the plain planning row is unchanged regardless of reasoningActive
    expect(outerBannerLabel(null, false, true, false, false)).toBe("Thinking…")
  })

  it("STATE-03: reasoningActive does NOT leak into the tool arm (hasAnyTools=true skips it)", () => {
    const searchTool = { name: "search_documents" } as ToolCall
    // Even with reasoningActive=true, once a tool exists the render hands off to the
    // tool branch (Pitfall 1: this call site always passes hasAnyTools=false in prod,
    // so a tool arm is never reached WITH reasoningActive — this proves the scoping).
    expect(outerBannerLabel(searchTool, true, false, false, true)).toBe("Searching knowledge base…")
  })
})
