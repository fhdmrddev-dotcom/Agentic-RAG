/**
 * Phase 095.1 Plan 01 Task 1 — tests for the deterministic activity-derived
 * workspace-panel selector (D-095.1-01 / D-095.1-02).
 *
 * This is the TS port of the VALIDATED spike-006 (gate + derive) + spike-007
 * (code-label inference) fixture matrix, using CONTEXT's authoritative
 * MEANINGFUL_TOOLS set (broader than the spike's 5; uses `task` not `sub_agent`).
 *
 * Coverage (095.1-VALIDATION.md WORKSPACE-PARITY rows + spike assertions):
 *  GATE (shouldPopulate):
 *   - simple Q&A (0 tools) → false
 *   - single meaningful lookup (1 tool) → false
 *   - failed / 0-tool run → false
 *   - openai multi-step (≥2 meaningful) → true
 *   - any write_todos present → true (regardless of count)
 *   - read-only nav + meta tools never count toward the tally
 *  DERIVE (deriveWorkspacePanel):
 *   - anthropic 3-step (3 execute_code w/ descriptions) → 3 SEMANTIC items, none "Run code"
 *   - write_todos present → derives ITS todos (precedence 1), not generic "Run code" rows
 *  LABEL (inferLabel) — spike-007 cases:
 *   - print → "Print output"; to_csv → "Create CSV file"; savefig → "Create chart"
 *   - leading-comment-wins → capitalized comment text
 *   - generic → "Run code"
 *  PRECEDENCE per item: write_todos.content > tc.args.description > inferLabel(code) > "Run code"
 */
import { describe, it, expect } from "vitest"
import {
  MEANINGFUL_TOOLS,
  GATE_MIN_STEPS,
  shouldPopulate,
  inferLabel,
  deriveWorkspacePanel,
} from "../workspacePanel"
import type { ToolCall } from "@/types"

// Minimal ToolCall factory — only the fields the gate/derive touch matter.
// `args` is Record<string, string> per the type; nested shapes (todos) are
// stamped via the factory override and read through `unknown` in the module.
function tc(partial: Partial<ToolCall> & { args?: Record<string, unknown> }): ToolCall {
  return {
    name: partial.name ?? "search_documents",
    args: (partial.args ?? {}) as Record<string, string>,
    status: partial.status ?? "done",
    ...partial,
  } as ToolCall
}

describe("MEANINGFUL_TOOLS (CONTEXT D-095.1-02 authoritative set)", () => {
  it("includes the producers and substantive-retrieval tools", () => {
    // Producers
    expect(MEANINGFUL_TOOLS.has("execute_code")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("workspace_write")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("workspace_delete")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("task")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("analyze_document")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("save_skill")).toBe(true)
    // Substantive retrieval
    expect(MEANINGFUL_TOOLS.has("search_documents")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("query_documents")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("query_tables")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("web_search")).toBe(true)
  })

  it("uses `task`, NOT the spike's `sub_agent` (Pitfall 3 correction)", () => {
    expect(MEANINGFUL_TOOLS.has("task")).toBe(true)
    expect(MEANINGFUL_TOOLS.has("sub_agent")).toBe(false)
  })

  it("excludes read-only nav + meta/control tools from the meaningful set", () => {
    for (const t of [
      "ls", "tree", "grep", "glob", "read", "workspace_read",
      "workspace_list", "workspace_diff", "read_skill_file", "recall",
      "load_skill", "remember", "ask_user",
    ]) {
      expect(MEANINGFUL_TOOLS.has(t)).toBe(false)
    }
  })

  it("excludes write_todos from the meaningful TALLY", () => {
    expect(MEANINGFUL_TOOLS.has("write_todos")).toBe(false)
  })

  it("GATE_MIN_STEPS is 2", () => {
    expect(GATE_MIN_STEPS).toBe(2)
  })
})

describe("shouldPopulate (the smart gate)", () => {
  it("0 tools (simple Q&A) → false", () => {
    expect(shouldPopulate([])).toBe(false)
    expect(shouldPopulate(undefined)).toBe(false)
    expect(shouldPopulate(null)).toBe(false)
  })

  it("1 meaningful tool (single lookup) → false", () => {
    expect(shouldPopulate([tc({ name: "search_documents" })])).toBe(false)
  })

  it("a failed / 0-meaningful run (only read-only nav) → false", () => {
    expect(
      shouldPopulate([
        tc({ name: "ls" }),
        tc({ name: "read" }),
        tc({ name: "workspace_list" }),
      ]),
    ).toBe(false)
  })

  it("2 meaningful tools → true", () => {
    expect(
      shouldPopulate([
        tc({ name: "execute_code", clientKey: "a" }),
        tc({ name: "search_documents", clientKey: "b" }),
      ]),
    ).toBe(true)
  })

  it("any write_todos present → true regardless of meaningful count", () => {
    // a single write_todos with NO meaningful work still populates
    expect(shouldPopulate([tc({ name: "write_todos", clientKey: "wt" })])).toBe(true)
    // write_todos + one read-only tool → still true
    expect(
      shouldPopulate([
        tc({ name: "write_todos", clientKey: "wt" }),
        tc({ name: "read", clientKey: "r" }),
      ]),
    ).toBe(true)
  })

  it("counts only deduped meaningful tools (clientKey dedup before the tally)", () => {
    // two entries that share a clientKey count as ONE → only 1 meaningful → false
    expect(
      shouldPopulate([
        tc({ name: "execute_code", clientKey: "k1" }),
        tc({ name: "execute_code", clientKey: "k1" }),
      ]),
    ).toBe(false)
  })

  it("read-only nav + meta tools never count toward the threshold", () => {
    // 1 meaningful + a pile of excluded tools → still below GATE_MIN_STEPS
    expect(
      shouldPopulate([
        tc({ name: "search_documents", clientKey: "s" }),
        tc({ name: "ls", clientKey: "ls" }),
        tc({ name: "read", clientKey: "rd" }),
        tc({ name: "load_skill", clientKey: "load" }),
        tc({ name: "ask_user", clientKey: "ask" }),
      ]),
    ).toBe(false)
  })
})

describe("inferLabel (spike-007 code-label inference)", () => {
  it("print → 'Print output'", () => {
    expect(inferLabel("for i in range(1, 31):\n    print(i)")).toBe("Print output")
  })

  it("to_csv → 'Create CSV file'", () => {
    const code =
      "import numpy as np\nimport pandas as pd\n\nnp.random.seed(42)\nrows=100\n" +
      "df = pd.DataFrame({'id': range(1, rows+1)})\ndf.to_csv('/sandbox/out/sample_data.csv', index=False)"
    expect(inferLabel(code)).toBe("Create CSV file")
  })

  it("savefig → 'Create chart'", () => {
    const code =
      "import numpy as np\nimport matplotlib.pyplot as plt\nx=np.arange(1,21)\n" +
      "plt.plot(x,y, marker='o')\nplt.savefig('/sandbox/out/line_chart.png')"
    expect(inferLabel(code)).toBe("Create chart")
  })

  it("from docx → leading comment wins ('Build the quarterly report')", () => {
    const code =
      "# Build the quarterly report\nfrom docx import Document\ndoc=Document()\ndoc.save('report.docx')"
    expect(inferLabel(code)).toBe("Build the quarterly report")
  })

  it("from pptx (no comment) → 'Create slides'", () => {
    const code = "from pptx import Presentation\nprs=Presentation()\nprs.save('deck.pptx')"
    expect(inferLabel(code)).toBe("Create slides")
  })

  it("reportlab / .pdf → 'Create PDF'", () => {
    expect(inferLabel("from reportlab.pdfgen import canvas\nc = canvas.Canvas('out.pdf')")).toBe(
      "Create PDF",
    )
  })

  it("to_excel / openpyxl / .xlsx → 'Create spreadsheet'", () => {
    expect(inferLabel("df.to_excel('book.xlsx')")).toBe("Create spreadsheet")
  })

  it("genuinely unrecognizable code → 'Run code'", () => {
    expect(inferLabel("x = 2 + 2\nresult = x * 10")).toBe("Run code")
  })

  it("guards null/undefined code → 'Run code'", () => {
    expect(inferLabel(undefined)).toBe("Run code")
    expect(inferLabel("")).toBe("Run code")
  })

  it("a non-comment first line stops the comment scan (no mid-body comment hijack)", () => {
    // the leading line is code; a later '#' comment must NOT become the label
    const code = "df.to_csv('out.csv')\n# this is a trailing note"
    expect(inferLabel(code)).toBe("Create CSV file")
  })
})

describe("deriveWorkspacePanel — write_todos precedence (precedence 1)", () => {
  it("when write_todos is present, derives ITS todos (label = content, mapped status)", () => {
    const items = deriveWorkspacePanel([
      tc({
        name: "write_todos",
        clientKey: "wt",
        args: {
          todos: [
            { content: "Print the numbers", status: "completed" },
            { content: "Create the CSV", status: "in_progress" },
            { content: "Make the chart", status: "pending" },
          ],
        },
      }),
      // meaningful work also present — must NOT override the explicit plan
      tc({ name: "execute_code", clientKey: "ec", args: { code: "print(1)" } }),
    ])
    expect(items).toEqual([
      { label: "Print the numbers", status: "completed" },
      { label: "Create the CSV", status: "in_progress" },
      { label: "Make the chart", status: "pending" },
    ])
    // a real write_todos plan is NOT overwritten by derived "Run code" rows
    expect(items.some((i) => i.label === "Run code")).toBe(false)
  })

  it("uses the LATEST write_todos snapshot when several were emitted", () => {
    const items = deriveWorkspacePanel([
      tc({
        name: "write_todos",
        clientKey: "wt1",
        args: { todos: [{ content: "old plan", status: "pending" }] },
      }),
      tc({
        name: "write_todos",
        clientKey: "wt2",
        args: {
          todos: [
            { content: "new step A", status: "completed" },
            { content: "new step B", status: "pending" },
          ],
        },
      }),
    ])
    expect(items.map((i) => i.label)).toEqual(["new step A", "new step B"])
  })
})

describe("deriveWorkspacePanel — activity-derived (precedence 2)", () => {
  it("anthropic 3-step (3 execute_code w/ descriptions) → 3 semantic items, none 'Run code'", () => {
    const items = deriveWorkspacePanel([
      tc({
        name: "execute_code",
        clientKey: "a",
        status: "done",
        args: { description: "Print the numbers 1-30", code: "for i in range(1,31): print(i)" },
      }),
      tc({
        name: "execute_code",
        clientKey: "b",
        status: "done",
        args: { description: "Create the sample CSV", code: "df.to_csv('x.csv')" },
      }),
      tc({
        name: "execute_code",
        clientKey: "c",
        status: "running",
        args: { description: "Plot the line chart", code: "plt.savefig('c.png')" },
      }),
    ])
    expect(items).toHaveLength(3)
    expect(items.every((i) => i.label !== "Run code")).toBe(true)
    expect(items).toEqual([
      { label: "Print the numbers 1-30", status: "completed" },
      { label: "Create the sample CSV", status: "completed" },
      { label: "Plot the line chart", status: "in_progress" },
    ])
  })

  it("description-less execute_code falls back to code-inferred labels (not 'Run code')", () => {
    const items = deriveWorkspacePanel([
      tc({ name: "execute_code", clientKey: "a", status: "done", args: { code: "df.to_csv('a.csv')" } }),
      tc({ name: "execute_code", clientKey: "b", status: "done", args: { code: "plt.savefig('b.png')" } }),
    ])
    expect(items).toEqual([
      { label: "Create CSV file", status: "completed" },
      { label: "Create chart", status: "completed" },
    ])
  })

  it("non-execute_code meaningful tools get a pretty name", () => {
    const items = deriveWorkspacePanel([
      tc({ name: "search_documents", clientKey: "s", status: "done" }),
      tc({ name: "query_tables", clientKey: "q", status: "done" }),
    ])
    expect(items).toEqual([
      { label: "Search documents", status: "completed" },
      { label: "Query tables", status: "completed" },
    ])
  })

  it("only includes MEANINGFUL tools (read-only nav excluded from derived items)", () => {
    const items = deriveWorkspacePanel([
      tc({ name: "search_documents", clientKey: "s", status: "done" }),
      tc({ name: "ls", clientKey: "ls", status: "done" }),
      tc({ name: "execute_code", clientKey: "e", status: "done", args: { code: "print(1)" } }),
    ])
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.label)).toEqual(["Search documents", "Print output"])
  })

  it("dedups before deriving (shared clientKey collapses to one item)", () => {
    const items = deriveWorkspacePanel([
      tc({ name: "execute_code", clientKey: "k1", status: "done", args: { code: "print(1)" } }),
      tc({ name: "execute_code", clientKey: "k1", status: "done", args: { code: "print(1)" } }),
      tc({ name: "search_documents", clientKey: "k2", status: "done" }),
    ])
    expect(items).toHaveLength(2)
  })

  it("label precedence: description > inferLabel(code) > 'Run code'", () => {
    // description present → wins over inferable code
    const withDesc = deriveWorkspacePanel([
      tc({ name: "execute_code", clientKey: "a", status: "done", args: { description: "Tidy export", code: "df.to_csv('x.csv')" } }),
      tc({ name: "search_documents", clientKey: "b", status: "done" }),
    ])
    expect(withDesc[0].label).toBe("Tidy export")

    // no description, no recognizable code → "Run code"
    const generic = deriveWorkspacePanel([
      tc({ name: "execute_code", clientKey: "a", status: "done", args: { code: "x = 1 + 1" } }),
      tc({ name: "execute_code", clientKey: "b", status: "done", args: { code: "y = 2" } }),
    ])
    expect(generic[0].label).toBe("Run code")
    expect(generic[1].label).toBe("Run code")
  })

  it("status mapping: done→completed, running/preparing→in_progress, else pending", () => {
    const items = deriveWorkspacePanel([
      tc({ name: "execute_code", clientKey: "a", status: "done", args: { code: "print(1)" } }),
      tc({ name: "execute_code", clientKey: "b", status: "running", args: { code: "print(2)" } }),
      tc({ name: "execute_code", clientKey: "c", status: "preparing", args: { code: "print(3)" } }),
      tc({ name: "execute_code", clientKey: "d", status: "interrupted", args: { code: "print(4)" } }),
    ])
    expect(items.map((i) => i.status)).toEqual([
      "completed",
      "in_progress",
      "in_progress",
      "pending",
    ])
  })
})
