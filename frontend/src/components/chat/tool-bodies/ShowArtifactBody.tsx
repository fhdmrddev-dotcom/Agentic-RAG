/**
 * Phase 273-05 (D-10 · SC#2 · L-3 · L-4 · UI-D-02) — the rail's words for a `show_artifact` step.
 *
 * The essence line (`summarize`) and the expanded body say what was shown, in plain words, and
 * never the spec: the artifact itself renders below the answer, so the rail only has to name it.
 *
 * ⛔ WHAT THIS FILE READS IS A CLOSED LIST, and it is the whole defence for L-3 / L-4. From a
 * success result (`show_artifact_tool.build_result`): `label`, `component`, `kind`, `stacked`,
 * `series_count`, `row_count`, `from_label`, `same_rows`, `operations`. From a refusal
 * (`models/artifact.py`, marker `status: "refused"`): `reason`, the plain sentence for people.
 * The result's model-facing explanation, its `columns` and its sampled `values` are NEVER read, so
 * no path here can print them. Every string that reaches the page is either one of our own phrases
 * (artifactCopy, toolNames) or a server-built fact rendered as React text.
 *
 * Shaped like `SearchDocumentsBody.tsx`: a named `summarize(tc)` for `TOOL_SUMMARIES` and a default
 * body `{ parsed }` for `TOOL_BODIES`. It never throws on any input.
 */
import type { ToolCall } from "@/types"
import { toolName } from "@/lib/toolNames"
import { own } from "@/components/workflows/ownProperty"
import {
  OPERATION_ORDER,
  cellPhrase,
  kindChipLabel,
  operationPhrase,
  rowsPhrase,
  truncateValue,
} from "../artifacts/artifactCopy"
import type { Cell, LineageOperation } from "../artifacts/artifactSpec"

/** The UI-SPEC's rail fallback when a refusal arrives without a usable reason. */
const REFUSED_FALLBACK = "its settings weren't valid"
/** The UI-SPEC's expanded-body tails. */
const SHOWN_BELOW = "Shown below the answer."
const SENT_BACK = "Sent back to the agent to fix."
/** A people-facing reason longer than this is cut (a belt: the server's reasons are short). */
const REASON_MAX_CHARS = 160

const COMPONENTS: Record<string, true> = { chart: true, table: true, metric: true }

type Described =
  | { kind: "done"; chip: string; component: string; series: number | null; rows: number | null; label: string | null; essence: string }
  | { kind: "refused"; reason: string }
  | { kind: "unreadable" }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? truncateValue(v.trim()) : null
}

function isCell(v: unknown): v is Cell {
  return v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v))
}

function bound(v: unknown): number | string | null {
  return v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ? v : null
}

/** A lineage op from the untrusted result, re-built field by field into the closed union. */
function asOperation(raw: unknown): LineageOperation | null {
  if (!isObject(raw)) return null
  if (raw.op !== "select" && typeof raw.column !== "string") return null
  const column = typeof raw.column === "string" ? raw.column : ""
  switch (raw.op) {
    case "filter_eq":
      return isCell(raw.value) ? { op: "filter_eq", column, value: raw.value } : null
    case "filter_in":
      return Array.isArray(raw.values) ? { op: "filter_in", column, values: raw.values.filter(isCell) } : null
    case "filter_range":
      return { op: "filter_range", column, min: bound(raw.min), max: bound(raw.max) }
    case "top_n":
      return count(raw.n) !== null ? { op: "top_n", n: count(raw.n) as number, column } : null
    case "sort":
      return { op: "sort", column, direction: raw.direction === "desc" ? "desc" : "asc" }
    case "select":
      return Array.isArray(raw.columns)
        ? { op: "select", columns: raw.columns.filter((c): c is string => typeof c === "string") }
        : null
    default:
      return null
  }
}

/** The rail's short form: a single-value filter names only the value (`filtered to Q3`). */
function railPhrase(op: LineageOperation): string {
  return op.op === "filter_eq" ? `filtered to ${cellPhrase(op.value)}` : operationPhrase(op)
}

function narrowing(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null
  const ops = raw.map(asOperation).filter((o): o is LineageOperation => o !== null)
  if (ops.length === 0) return null
  return ops
    .slice()
    .sort((a, b) => OPERATION_ORDER[a.op] - OPERATION_ORDER[b.op])
    .map(railPhrase)
    .join(", ")
}

function describeResult(parsed: unknown): Described {
  if (!isObject(parsed)) return { kind: "unreadable" }
  if (parsed.status === "refused") {
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : ""
    return {
      kind: "refused",
      reason: reason
        ? reason.length > REASON_MAX_CHARS ? `${reason.slice(0, REASON_MAX_CHARS - 1)}…` : reason
        : REFUSED_FALLBACK,
    }
  }
  const component = typeof parsed.component === "string" && own(COMPONENTS, parsed.component) ? parsed.component : null
  if (!component) return { kind: "unreadable" }

  const series = component === "chart" ? count(parsed.series_count) : null
  const chip = kindChipLabel(
    component,
    typeof parsed.kind === "string" ? parsed.kind : null,
    parsed.stacked === true,
    series ?? 0,
  )
  const rows = count(parsed.row_count)
  const label = text(parsed.label)
  const from = text(parsed.from_label)

  const narrowed = narrowing(parsed.operations)
  let essence: string
  if (component === "metric" || rows === null) essence = chip
  else if (from && parsed.same_rows === true) essence = `${chip} · same ${rowsPhrase(rows)} as ${from}`
  else if (from && narrowed) essence = `${chip} · ${from} rows ${narrowed} (${rowsPhrase(rows)})`
  else if (from) essence = `${chip} · ${rowsPhrase(rows)} from ${from}`
  else essence = `${chip} · ${rowsPhrase(rows)}`

  return { kind: "done", chip, component, series, rows, label, essence }
}

function parseResult(result: string | undefined): unknown {
  if (!result) return null
  try {
    return JSON.parse(result)
  } catch {
    return null
  }
}

/** The essence line: `Bar chart · 12 rows`, `refused · {reason}`, or the neutral phrase. */
export function summarize(tc: ToolCall): string {
  const d = describeResult(parseResult(tc.result))
  if (d.kind === "refused") return `refused · ${d.reason}`
  if (d.kind === "done") return d.essence
  return toolName("show_artifact")
}

export interface ShowArtifactBodyProps {
  parsed: unknown
}

/** The expanded body: one worded line, never the spec. */
export default function ShowArtifactBody({ parsed }: ShowArtifactBodyProps) {
  const d = describeResult(parsed)
  if (d.kind === "refused") {
    const sentence = /[.!?]$/.test(d.reason) ? d.reason : `${d.reason}.`
    return (
      <div className="space-y-0.5 text-xs" data-testid="show-artifact-body">
        <div className="text-foreground/80">{sentence}</div>
        <div className="text-muted-foreground">{SENT_BACK}</div>
      </div>
    )
  }
  if (d.kind === "unreadable") {
    return (
      <div className="text-xs text-muted-foreground" data-testid="show-artifact-body">
        {toolName("show_artifact")}
      </div>
    )
  }
  const parts = [d.chip]
  if (d.component === "chart" && d.series !== null) parts.push(`${d.series} series`)
  if (d.rows !== null && d.component !== "metric") parts.push(rowsPhrase(d.rows))
  if (d.label) parts.push(d.label)
  return (
    <div className="text-xs text-muted-foreground" data-testid="show-artifact-body">
      {`${parts.join(" · ")}. ${SHOWN_BELOW}`}
    </div>
  )
}
