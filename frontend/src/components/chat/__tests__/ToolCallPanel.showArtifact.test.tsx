/**
 * Phase 273-05 (SC#2 · L-1..L-4 · UI-D-02 · UI-D-06) — the rail never prints the spec.
 *
 * `show_artifact`'s args ARE the spec (columns + up to 500 rows), and its refusal result carries a
 * model-facing explanation. Four shipped paths would have put one or the other on the page:
 *
 *   L-1  the live args panel streams `code_so_far` (the raw cumulative args JSON) while preparing
 *   L-2  "Show parameters" stringifies the args (the rows live; the placeholder on reload)
 *   L-3  GenericBody prints up to 1,500 chars of the raw result
 *   L-4  the `parsed.error` arm prints an error string in destructive italic
 *
 * Each is driven here through the mounted rail. Args visibility is ONE export (`ARGS_HIDDEN`), and
 * the refused node state is derived from the result's structured marker, never the tool name.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToolCallPanel } from "@/components/chat/ToolCallPanel"
import { ToolArgsBlock, ToolResultBlock } from "@/components/chat/ToolCallDetails"
import { StepRow } from "@/components/chat/StepRow"
import { nodeStateOf } from "@/components/chat/toolStepDerivation"
import { ARGS_HIDDEN } from "@/components/chat/tool-bodies"
import { toolName } from "@/lib/toolNames"
import { toolLabel } from "@/lib/toolMeta"
import type { ToolCall } from "@/types"

function renderUi(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

afterEach(() => cleanup())

const ROWS = Array.from({ length: 500 }, (_, i) => [`R${i}`, 1000 + i])
const SPEC_ARGS = {
  component: "chart",
  title: "Revenue by region",
  columns: [{ name: "region", type: "string" }, { name: "revenue", type: "number", unit: "$K" }],
  rows: ROWS,
  chart: { kind: "bar", x: "region", y: ["revenue"] },
}
const RAW_SPEC = JSON.stringify(SPEC_ARGS)
const MODEL_FACING = "Input should be 'line', 'bar', 'area' or 'scatter' [type=literal_error]"
const REFUSAL = JSON.stringify({ status: "refused", reason: '"pie" is not a chart kind', detail: MODEL_FACING })
const SUCCESS = JSON.stringify({
  artifact_id: "a_k3j9x0p2qd",
  label: "chart 1",
  component: "chart",
  kind: "bar",
  stacked: false,
  series_count: 1,
  row_count: 12,
  from_label: null,
  same_rows: null,
  operations: null,
  columns: [{ name: "region", type: "string" }],
  values: { region: ["Zanzibar Holdings"] },
  note: "Shown to the user below your answer as chart 1.",
})

function preparing(name: string, code: string): ToolCall {
  return {
    id: `preparing-0`,
    clientKey: `ck-${name}`,
    name,
    args: {},
    status: "preparing",
    argsCodeText: code,
    argsBytesStreamed: 3277,
  } as ToolCall
}

function done(name: string, result: string, args: Record<string, unknown> = SPEC_ARGS): ToolCall {
  return {
    id: `call_${name}`,
    name,
    args: args as Record<string, string>,
    status: "done",
    result,
    startedAt: 1_000,
    endedAt: 1_400,
  } as ToolCall
}

describe("ARGS_HIDDEN — the one home of args visibility", () => {
  it("livePanel hides execute_code and show_artifact; paramsBlock hides show_artifact only", () => {
    expect([...ARGS_HIDDEN.livePanel].sort()).toEqual(["execute_code", "show_artifact"])
    expect([...ARGS_HIDDEN.paramsBlock]).toEqual(["show_artifact"])
  })
})

describe("L-1 — preparing show_artifact never streams the spec", () => {
  it("the resting row is the header: `Preparing Show an artifact…` + the byte pill, no JSON", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[preparing("show_artifact", RAW_SPEC)]} isStreaming />)
    expect(container.textContent).toContain("Preparing Show an artifact…")
    expect(container.textContent).toContain("preparing · 3.2 KB")
    expect(container.textContent).not.toContain('{"')
  })

  it("expanded, the live panel is header-only — the raw spec never renders", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[preparing("show_artifact", RAW_SPEC)]} isStreaming />)
    fireEvent.click(screen.getByRole("button", { name: "Expand this step" }))
    expect(screen.getByTestId("tool-args-live-panel-header-only")).toBeTruthy()
    expect(container.textContent).not.toContain('{"')
    expect(container.textContent).not.toContain("R499")
  })

  it("the set is not widened: a web_search preparing call still shows its streamed body", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[preparing("web_search", '{"query":"fy25 revenue"}')]} isStreaming />)
    fireEvent.click(screen.getByRole("button", { name: "Expand this step" }))
    expect(screen.queryByTestId("tool-args-live-panel-header-only")).toBeNull()
    expect(container.textContent).toContain('{"query":"fy25 revenue"}')
  })
})

describe("L-2 — no parameters block for show_artifact (500 rows of args)", () => {
  it("the expanded done step has no `Show parameters` control and no args text", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[done("show_artifact", SUCCESS)]} />)
    fireEvent.click(screen.getByRole("button", { name: "Expand this step" }))
    expect(screen.queryByTestId("tool-args-block")).toBeNull()
    expect(container.textContent).not.toContain("parameters")
    expect(container.textContent).not.toContain("R499")
    expect(container.textContent).not.toContain('{"')
    expect(container.textContent).toContain("Shown below the answer.")
  })

  it("ToolArgsBlock returns nothing for show_artifact, and is unchanged for execute_code", () => {
    const a = renderUi(<ToolArgsBlock tc={done("show_artifact", SUCCESS)} />)
    expect(a.container.textContent).toBe("")
    a.unmount()
    renderUi(<ToolArgsBlock tc={done("execute_code", "{}", { code: "print(1)", description: "Sum it" })} />)
    expect(screen.getByTestId("tool-args-block").textContent).toContain("Show parameters")
  })

  it("a reloaded call with the rows placeholder prints no placeholder either", () => {
    const args = { ...SPEC_ARGS, rows: "<stored in artifact a_k3j9x0p2qd, 12 rows>" }
    const { container } = renderUi(<ToolCallPanel toolCalls={[done("show_artifact", SUCCESS, args)]} />)
    fireEvent.click(screen.getByRole("button", { name: "Expand this step" }))
    expect(container.textContent).not.toContain("stored in artifact")
  })
})

describe("L-3 / L-4 — the result goes to ShowArtifactBody, never GenericBody or the error arm", () => {
  it("a refusal renders the reason and `Sent back…`, never the model-facing text", () => {
    const { container } = renderUi(<ToolResultBlock tc={done("show_artifact", REFUSAL)} defaultOpen />)
    expect(container.textContent).toContain('"pie" is not a chart kind')
    expect(container.textContent).toContain("Sent back to the agent to fix.")
    expect(container.textContent).not.toContain("literal_error")
    expect(container.querySelector(".text-destructive")).toBeNull()
  })

  it("even a refusal that grew an `error` key never reaches the italic error renderer", () => {
    const withError = JSON.stringify({ status: "refused", reason: "6 series (max 4)", detail: MODEL_FACING, error: MODEL_FACING })
    const { container } = renderUi(<ToolResultBlock tc={done("show_artifact", withError)} defaultOpen />)
    expect(container.textContent).toContain("6 series (max 4)")
    expect(container.textContent).not.toContain("literal_error")
    expect(container.querySelector(".text-destructive")).toBeNull()
  })

  it("an unparseable result renders the neutral line, never the raw text (no GenericBody)", () => {
    const raw = '{"artifact_id":"a_k3j9x0p2qd","label":"chart 1","values":{"region":["Zanz'
    const { container } = renderUi(<ToolResultBlock tc={done("show_artifact", raw)} defaultOpen />)
    expect(container.textContent).toContain("Show an artifact")
    expect(container.textContent).not.toContain("Zanz")
    expect(container.textContent).not.toContain('{"')
  })

  it("another tool's result still dispatches as before (regression)", () => {
    const { container } = renderUi(<ToolResultBlock tc={done("web_search", "Plain text search result")} defaultOpen />)
    expect(container.textContent).toContain("Plain text search result")
  })
})

describe("UI-D-02 — the refused node, from the marker", () => {
  it("nodeStateOf reads the structured marker on a done call", () => {
    expect(nodeStateOf(done("show_artifact", REFUSAL))).toBe("refused")
    expect(nodeStateOf(done("show_artifact", SUCCESS))).toBe("done")
    // Another tool's own refusal vocabulary is untouched.
    expect(nodeStateOf(done("search_documents", JSON.stringify({ error: "refused_retry" })))).toBe("done")
    expect(nodeStateOf(done("search_documents", "not json"))).toBe("done")
    expect(nodeStateOf(preparing("show_artifact", RAW_SPEC))).toBe("active")
    expect(nodeStateOf({ ...done("show_artifact", REFUSAL), status: "running" })).toBe("active")
  })

  it("StepRow paints the refused node and step number amber (light/dark pair)", () => {
    renderUi(
      <StepRow snum={2} node="refused" isLast>
        <span>x</span>
      </StepRow>,
    )
    const node = screen.getByTestId("step-node")
    expect(node.getAttribute("data-node-state")).toBe("refused")
    for (const cls of ["bg-amber-600", "border-amber-600", "dark:bg-warning", "dark:border-warning"]) {
      expect(node.className).toContain(cls)
    }
    expect(node.className).not.toContain("bg-success")
    const snum = screen.getByTestId("step-snum")
    expect(snum.className).toContain("text-amber-700")
    expect(snum.className).toContain("dark:text-warning")
    expect(snum.className).not.toContain("text-success")
  })

  it("the mounted rail shows `Show an artifact → refused · {reason}` on an amber node", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[done("show_artifact", REFUSAL)]} />)
    expect(container.textContent).toContain('Show an artifact→refused · "pie" is not a chart kind')
    expect(screen.getByTestId("step-node").getAttribute("data-node-state")).toBe("refused")
    expect(container.textContent).not.toContain("literal_error")
  })

  it("a successful step reads `Show an artifact → Bar chart · 12 rows` on a done node", () => {
    const { container } = renderUi(<ToolCallPanel toolCalls={[done("show_artifact", SUCCESS)]} />)
    expect(container.textContent).toContain("Show an artifact→Bar chart · 12 rows")
    expect(screen.getByTestId("step-node").getAttribute("data-node-state")).toBe("done")
  })
})

describe("UI-D-06 — the phrase and the activity string", () => {
  it("toolName / toolLabel", () => {
    expect(toolName("show_artifact")).toBe("Show an artifact")
    expect(toolLabel("show_artifact")).toBe("Showing an artifact")
  })
})
