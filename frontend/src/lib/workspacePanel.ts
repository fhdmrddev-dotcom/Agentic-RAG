/**
 * Phase 095.1 Plan 01 Task 1 — the deterministic, provider-independent
 * workspace-panel selector (D-095.1-01 / D-095.1-02).
 *
 * The PROBLEM: only providers that voluntarily call `write_todos` ever filled
 * the workspace todos panel. The operator's acceptance bar is OpenAI gpt-5.4-mini
 * parity — EVERY provider's panel should reflect the real tasks it performed,
 * including providers that never loop todos. We do NOT change model behavior;
 * we make the panel HONEST about what each run actually did.
 *
 * The SOLUTION (validated in spike-006 / spike-007): a pure selector over the
 * persisted `tool_calls` activity stream.
 *   1. A smart gate (`shouldPopulate`) decides — deterministically — whether a
 *      run earned a panel: the model called `write_todos`, OR there were ≥2
 *      MEANINGFUL tool calls. One-shot Q&A / single lookups stay clean.
 *   2. `deriveWorkspacePanel` projects read-only items with this precedence:
 *      real `write_todos` plan  >  per-meaningful-tool synthesis, where each
 *      item's label = `execute_code.description` > code-inferred > "Run code".
 *
 * Why a PURE selector over `tool_calls` (the 095 idiom, see stepCount.ts):
 *   `tool_calls` are persisted DB truth that `_mapMessageResponse` reconstructs
 *   on reload, so this selector is RELOAD-SAFE for free — it recomputes the
 *   identical panel next-day. NO backend change, NO new SSE event, NO migration.
 *
 * Pure logic — NO React, NO hooks, NO JSX. Deliberately importable from
 * non-component code (mirrors stepCount.ts). All returned labels are PLAIN
 * STRINGS (model/user-derived); the render consumer (Plan 02) renders them as
 * React text children, NEVER `dangerouslySetInnerHTML` (T-095.1-01-01). This
 * module returns DATA only; the XSS contract is enforced at the consumer.
 */
import type { ToolCall } from "@/types"
import { dedupToolCalls } from "./stepCount"

/**
 * The CONTEXT D-095.1-02 AUTHORITATIVE meaningful-tool set (broader than the
 * spike's 5). Tools that represent real "work steps" worth tracking — NOT
 * `write_todos` (the plan itself, which keeps its own always-populate branch),
 * NOT trivial read-only nav / meta-control tools.
 *
 * Producers + substantive retrieval (operator-inclusive). NOTE: the sub-agent
 * tool is named `task`, NOT the spike's `sub_agent` (RESEARCH Pitfall 3).
 */
export const MEANINGFUL_TOOLS = new Set<string>([
  // Producers
  "execute_code",
  "workspace_write",
  "workspace_delete",
  "task",
  "analyze_document",
  "save_skill",
  // Substantive retrieval
  "search_documents",
  "query_documents",
  "query_tables",
  "web_search",
])

/** Minimum MEANINGFUL deduped steps before an UNPLANNED run earns a panel. */
export const GATE_MIN_STEPS = 2

/** A derived, read-only panel item. Status mirrors the source tool/todo. */
export interface DerivedPanelItem {
  label: string
  status: "pending" | "in_progress" | "completed"
}

/**
 * Map a raw tool/todo status to the read-only panel status vocabulary.
 *
 * Frontend `ToolCall.status` is `running | done | interrupted | preparing`;
 * `write_todos` items carry `pending | in_progress | completed`. Normalize both:
 * `done`/`completed` → completed, `running`/`preparing`/`in_progress` →
 * in_progress, everything else (incl. `interrupted`) → pending.
 */
function mapStatus(s: string | undefined): DerivedPanelItem["status"] {
  switch (s) {
    case "done":
    case "completed":
      return "completed"
    case "running":
    case "preparing":
    case "in_progress":
    case "in-progress":
      return "in_progress"
    default:
      return "pending"
  }
}

// Ordered deterministic code-label rules (first match wins), ported verbatim
// from spike-007 RULES. Keyword scan of the code body, case-insensitive.
const LABEL_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\.to_csv\(|\bcsv\b/i, "Create CSV file"],
  [/savefig|matplotlib|seaborn|plt\./i, "Create chart"],
  [/from docx|Document\(|\.docx/i, "Create Word document"],
  [/from pptx|Presentation\(|\.pptx/i, "Create slides"],
  [/reportlab|\.pdf\b/i, "Create PDF"],
  [/to_excel|openpyxl|\.xlsx/i, "Create spreadsheet"],
  [/^\s*print\(/im, "Print output"],
]

/**
 * Infer a human label from an `execute_code` body when no description is given
 * (spike-007 `infer_label`). Precedence inside the function:
 *   1. a leading `#` comment (most honest) → its text, capitalized
 *   2. ordered keyword rules (.to_csv → CSV, savefig → chart, …)
 *   3. generic "Run code"
 */
export function inferLabel(code: string | undefined | null): string {
  if (code == null) return "Run code"
  // 1) a leading comment is the most honest label, if present
  for (const line of code.split("\n")) {
    const s = line.trim()
    if (s.startsWith("#") && s.length > 2) {
      // strip leading '#' and spaces, then capitalize (Python .capitalize():
      // first char upper, the rest lower)
      const text = s.replace(/^#+\s*/, "").trim()
      if (text.length === 0) break
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    }
    if (s) break // first non-empty, non-comment line → stop looking for a header comment
  }
  // 2) keyword inference
  for (const [rx, label] of LABEL_RULES) {
    if (rx.test(code)) return label
  }
  // 3) generic
  return "Run code"
}

/**
 * The SMART GATE — deterministic, provider-independent (spike-006
 * `should_populate`). Populate when the model called `write_todos` OR there
 * are ≥ GATE_MIN_STEPS deduped MEANINGFUL tool calls. `write_todos` is excluded
 * from the tally but triggers its own always-populate branch.
 *
 * Dedups FIRST (via the shared `dedupToolCalls`) so re-emitted snapshots of the
 * same call count once — never re-roll a Set-based dedup here.
 */
export function shouldPopulate(
  toolCalls: ToolCall[] | undefined | null,
): boolean {
  const deduped = dedupToolCalls(toolCalls)
  const wroteTodos = deduped.some((tc) => tc.name === "write_todos")
  const meaningful = deduped.filter((tc) => MEANINGFUL_TOOLS.has(tc.name))
  return wroteTodos || meaningful.length >= GATE_MIN_STEPS
}

// The `write_todos` args shape — read through `unknown` because the frontend
// ToolCall type declares `args: Record<string, string>` (the nested todos array
// is not in that type, so a direct cast is unsound — go via unknown).
interface WriteTodosArgs {
  todos?: Array<{ content: string; status: string }>
}

// Pretty display names for non-execute_code meaningful tools.
const PRETTY_TOOL_NAMES: Record<string, string> = {
  search_documents: "Search documents",
  query_documents: "Query documents",
  query_tables: "Query tables",
  web_search: "Web search",
  workspace_write: "Write workspace file",
  workspace_delete: "Delete workspace file",
  analyze_document: "Analyze document",
  save_skill: "Save skill",
  task: "Run sub-agent",
}

/**
 * Human label for a single meaningful tool call (the derive path).
 *
 * For `execute_code`: `tc.args.description` > `inferLabel(tc.args.code)` >
 * "Run code". For every other meaningful tool: a pretty display name, falling
 * back to the raw tool name. `args` is read through `unknown` (the type declares
 * `Record<string, string>`; `description`/`code` live there but TS can't prove
 * it for nested reads — RESEARCH Pitfall 4).
 */
export function humanize(tc: ToolCall): string {
  if (tc.name === "execute_code") {
    const args = tc.args as unknown as { description?: string; code?: string }
    const desc = args?.description
    if (typeof desc === "string" && desc.trim().length > 0) return desc
    return inferLabel(args?.code)
  }
  return PRETTY_TOOL_NAMES[tc.name] ?? tc.name
}

/**
 * Produce the panel item list deterministically (spike-006 `derive_panel`),
 * with the locked precedence:
 *   1. If `write_todos` was called → use the LATEST write_todos snapshot (the
 *      model's own plan + statuses) — richest, honor it.
 *   2. Else → one read-only item per deduped MEANINGFUL tool call, label from
 *      the humanize precedence chain, status mirrored from the call.
 *
 * Returns PLAIN-STRING labels only — the render consumer enforces the XSS
 * contract (text children, never innerHTML).
 */
export function deriveWorkspacePanel(
  toolCalls: ToolCall[] | undefined | null,
): DerivedPanelItem[] {
  const deduped = dedupToolCalls(toolCalls)

  // Precedence 1: honor an explicit write_todos plan (latest snapshot wins).
  const todosCalls = deduped.filter((tc) => tc.name === "write_todos")
  if (todosCalls.length > 0) {
    const latest = todosCalls[todosCalls.length - 1]
    const todos = (latest.args as unknown as WriteTodosArgs).todos ?? []
    return todos.map((t) => ({
      label: t.content,
      status: mapStatus(t.status),
    }))
  }

  // Precedence 2: derive one item per meaningful tool from activity.
  return deduped
    .filter((tc) => MEANINGFUL_TOOLS.has(tc.name))
    .map((tc) => ({
      label: humanize(tc),
      status: mapStatus(tc.status),
    }))
}
