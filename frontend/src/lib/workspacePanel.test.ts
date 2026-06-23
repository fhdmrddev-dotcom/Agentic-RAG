/**
 * Phase 122 Plan 04 (TDP-01) — VERIFY the existing frontend label floor.
 *
 * This test does NOT rebuild humanize()/inferLabel()/PRETTY_TOOL_NAMES (D-122-08).
 * It PINS the precedence chain TDP-01 relies on so a regression is caught:
 *
 *   execute_code  →  description  >  inferLabel(code)  >  "Run code"
 *   other tool    →  PRETTY_TOOL_NAMES[name]  ??  name   ← the bare-name floor (Pitfall 4)
 *
 * The bare-name assertion is the LOAD-BEARING one: it documents the surface the SC#10
 * UAT watches — a non-mapped tool renders its raw snake_case name, never a blank or a
 * generic label. Per D-122-08, PRETTY_TOOL_NAMES is extended ONLY if the SC#10 UAT
 * actually surfaces a bare name; this test does not pre-emptively add entries.
 */
import { describe, it, expect } from "vitest"
import type { ToolCall } from "@/types"
import {
  humanize,
  inferLabel,
  deriveWorkspacePanel,
} from "./workspacePanel"

/** Minimal ToolCall factory — only the fields humanize() reads matter here. */
function tc(name: string, args: Record<string, string> = {}): ToolCall {
  return { name, args, status: "done" }
}

describe("inferLabel — the deterministic code-label floor (verified, not rebuilt)", () => {
  it("returns 'Run code' for null/undefined code", () => {
    expect(inferLabel(null)).toBe("Run code")
    expect(inferLabel(undefined)).toBe("Run code")
  })

  it("honors a leading # comment as the label", () => {
    expect(inferLabel("# build the chart\nimport matplotlib")).toBe("Build the chart")
  })

  it("falls back to the generic 'Run code' when nothing matches", () => {
    expect(inferLabel("x = 1 + 1")).toBe("Run code")
  })
})

describe("humanize — execute_code precedence (description > inferLabel(code) > 'Run code')", () => {
  it("uses the description when present", () => {
    expect(humanize(tc("execute_code", { description: "Generating Q3 chart" }))).toBe(
      "Generating Q3 chart",
    )
  })

  it("falls back to inferLabel(code) when description is absent", () => {
    expect(humanize(tc("execute_code", { code: "# plot sales\nimport matplotlib" }))).toBe(
      "Plot sales",
    )
  })

  it("ignores a blank/whitespace description and uses the code floor", () => {
    expect(humanize(tc("execute_code", { description: "   ", code: "df.to_csv('x')" }))).not.toBe(
      "   ",
    )
  })

  it("falls back to 'Run code' when neither description nor a recognizable code label exists", () => {
    expect(humanize(tc("execute_code", { code: "x = 1" }))).toBe("Run code")
    expect(humanize(tc("execute_code", {}))).toBe("Run code")
  })
})

describe("humanize — the bare-name floor for non-execute_code tools (Pitfall 4)", () => {
  it("returns the PRETTY_TOOL_NAMES label for a mapped tool", () => {
    expect(humanize(tc("search_documents"))).toBe("Search documents")
    expect(humanize(tc("task"))).toBe("Run sub-agent")
  })

  it("falls back to the BARE tool name for a non-mapped tool (the SC#10-UAT-watched floor)", () => {
    // query_documents_by_view has no PRETTY_TOOL_NAMES entry → ?? name returns the raw name.
    // This is the floor TDP-01's UAT watches: never a blank, never a generic label.
    expect(humanize(tc("query_documents_by_view"))).toBe("query_documents_by_view")
    expect(humanize(tc("get_related_documents"))).toBe("get_related_documents")
  })
})

describe("deriveWorkspacePanel — the precedence chain is wired through to the public derive path", () => {
  it("labels an execute_code item from its description", () => {
    const items = deriveWorkspacePanel([
      tc("search_documents"),
      tc("execute_code", { description: "Creating the risk-register .docx" }),
    ])
    const labels = items.map((i) => i.label)
    expect(labels).toContain("Search documents")
    expect(labels).toContain("Creating the risk-register .docx")
  })
})
