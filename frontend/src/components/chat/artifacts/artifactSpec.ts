/**
 * Phase 273-02 (ART-01/02/04/05 · D-12 · I-1 · I-2) — THE ONE HOME OF THE ARTIFACT WIRE TYPE AND ITS GUARD.
 *
 * `ArtifactRecord` is the `message_artifacts` row as JSON (spec_version 1, `273-01-PLAN.md`
 * <interfaces>). It is the `artifact` key of the `artifact` SSE event AND each item of a reloaded
 * message's `artifacts[]` — the same object both ways (I-2). ⛔ Declare it nowhere else:
 * `types/index.ts` re-exports it as a TYPE (273-05), it never re-declares the shape.
 *
 * `parseArtifactRecord(raw: unknown)` is the trust boundary. Everything that reaches it — live or on
 * reload — is untrusted: cells and titles may come from retrieved documents or a prompt-injected
 * model. It NEVER throws, and every failure maps to exactly ONE reason from the closed notice
 * catalogue (`NoticeReason`). The context it returns carries only (a) a component noun from the
 * closed set, (b) an alias from the closed alias table, (c) a number, or (d) a column NAME already
 * truncated to 40 characters — never a model-supplied kind string, never a validation path, never an
 * exception message (UI-SPEC §Notice reason catalogue).
 *
 * Hand-rolled `typeof` / `Array.isArray` narrowing in the `SearchDocumentsBody.tsx` style — no schema
 * library: `zod` is not in the tree and the research did not justify a dependency.
 *
 * I-1: the component set is CLOSED CODE. Membership is read through `own()` (the tree's one
 * prototype-key guard), so `__proto__`, `constructor` and `toString` are never components.
 * Adding a component is a code change here AND in the backend Literal — never a prompt, a setting or
 * a row. `artifactRegistry.ts` re-exports `ARTIFACT_COMPONENT_NAMES` as `ARTIFACT_COMPONENTS`.
 */
import { own } from "@/components/workflows/ownProperty"
import { kindAlias, truncateValue } from "./artifactCopy"

// ── The closed vocabulary ────────────────────────────────────────────────────────────────────

export type ComponentName = "chart" | "table" | "metric"
export type ChartKind = "line" | "bar" | "area" | "scatter"

/** The closed component table. Read ONLY through `own()`. */
const COMPONENT_TABLE: Record<string, ComponentName> = { chart: "chart", table: "table", metric: "metric" }
export const ARTIFACT_COMPONENT_NAMES = ["chart", "table", "metric"] as const

const CHART_KIND_TABLE: Record<string, ChartKind> = { line: "line", bar: "bar", area: "area", scatter: "scatter" }
export const CHART_KINDS = ["line", "bar", "area", "scatter"] as const

/** UI-D-01: line/bar/area ≤ 4 series (four palette slots); scatter ≤ 3 (all-pairs rule). */
export const MAX_SERIES: Record<ChartKind, number> = { line: 4, bar: 4, area: 4, scatter: 3 }
export const MAX_ROWS = 500
export const MAX_COLUMNS = 20
export const PALETTE_SLOTS = 4

const ID_RE = /^a_[0-9a-z]{10}$/
const LABEL_RE = /^(chart|table|metric) [1-9][0-9]*$/

// ── The wire types ───────────────────────────────────────────────────────────────────────────

export type Cell = string | number | null

export interface ArtifactColumn {
  name: string
  type: "number" | "string"
  unit: string | null
}

export interface ChartEncoding {
  kind: ChartKind
  x: string
  y: string[]
  stacked: boolean
  /** `slots[i]` is the palette slot (0..3) of `y[i]` — colour follows the entity (UI-D-07). */
  slots: number[]
}

export interface MetricEncoding {
  value_column: string
  compare_column: string | null
  label: string | null
  compare_label: string | null
}

export interface ArtifactSpec {
  title: string
  columns: ArtifactColumn[]
  rows: Cell[][]
  chart: ChartEncoding | null
  metric: MetricEncoding | null
}

export type LineageOperation =
  | { op: "filter_eq"; column: string; value: Cell }
  | { op: "filter_in"; column: string; values: Cell[] }
  | { op: "filter_range"; column: string; min: number | string | null; max: number | string | null }
  | { op: "top_n"; n: number; column: string }
  | { op: "sort"; column: string; direction: "asc" | "desc" }
  | { op: "select"; columns: string[] }

export interface CaptionSource {
  tool: string
  document: string | null
  page: number | null
}

export interface CaptionLineage {
  parent_label: string
  parent_row_count: number
  same_rows: boolean
  operations: LineageOperation[]
}

export interface ArtifactCaption {
  row_count: number
  /** `[]` ⇒ "Values provided by the agent" (no data-bearing tool ran this turn). */
  sources: CaptionSource[]
  /** Total before the server's 10-item cap. */
  source_count: number
  lineage: CaptionLineage | null
}

export interface ArtifactRecord {
  id: string
  thread_id: string
  user_id: string
  org_id: string | null
  run_id: string | null
  tool_call_id: string | null
  parent_id: string | null
  label: string
  component: ComponentName
  spec: ArtifactSpec
  caption: ArtifactCaption
  row_count: number
  spec_version: 1
  created_at: string
}

/** The reload placeholder for a referenced artifact id with no stored row. */
export interface ArtifactMissing {
  id: string
  missing: true
}

/** The closed notice catalogue (UI-SPEC). Every failure maps to exactly one. */
export type NoticeReason =
  | "unknown-chart-kind"
  | "unknown-component"
  | "missing-column"
  | "invalid-settings"
  | "too-many-rows"
  | "too-many-series"
  | "no-rows"
  | "data-missing"
  | "chart-unavailable"
  | "render-failed"

export interface NoticeContext {
  /** The component noun, from the closed set only. */
  noun?: ComponentName
  /** A column name, already truncated to 40 characters. */
  column?: string
  /** A chart-kind alias from the closed alias table — never a model string. */
  alias?: string
  max?: number
}

export type ParseResult =
  | { ok: true; record: ArtifactRecord }
  | { ok: false; reason: NoticeReason; ctx?: NoticeContext; id?: string }

// ── Narrowing helpers ────────────────────────────────────────────────────────────────────────

class Refusal {
  readonly reason: NoticeReason
  readonly ctx?: NoticeContext
  constructor(reason: NoticeReason, ctx?: NoticeContext) {
    this.reason = reason
    this.ctx = ctx
  }
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v)
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function isStr(v: unknown, min = 0, max = Infinity): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max
}

function strOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string"
}

/** Absent and null are the same for an optional nullable wire field. */
function isNullish(v: unknown): boolean {
  return v === null || v === undefined
}

function invalid(noun?: ComponentName): never {
  throw new Refusal("invalid-settings", noun ? { noun } : undefined)
}

function cellOk(v: unknown): v is Cell {
  return v === null || typeof v === "string" || isNum(v)
}

// ── Section parsers (each throws a Refusal; the entry point catches everything) ─────────────────

function parseColumns(raw: unknown, noun: ComponentName): ArtifactColumn[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_COLUMNS) invalid(noun)
  const seen = new Set<string>()
  return raw.map((c) => {
    if (!isObj(c) || !isStr(c.name, 1, 64)) invalid(noun)
    if (c.type !== "number" && c.type !== "string") invalid(noun)
    if (!isNullish(c.unit) && typeof c.unit !== "string") invalid(noun)
    const name = c.name as string
    if (seen.has(name)) invalid(noun)
    seen.add(name)
    return { name, type: c.type, unit: (c.unit as string | null | undefined) ?? null }
  })
}

function parseRows(raw: unknown, columns: ArtifactColumn[], noun: ComponentName): Cell[][] {
  if (!Array.isArray(raw)) invalid(noun)
  if (raw.length === 0) throw new Refusal("no-rows", { noun })
  if (raw.length > MAX_ROWS) throw new Refusal("too-many-rows", { noun })
  return raw.map((row) => {
    if (!Array.isArray(row) || row.length !== columns.length) invalid(noun)
    return row.map((cell, i) => {
      if (!cellOk(cell)) invalid(noun)
      if (cell === null) return null
      if (columns[i].type === "number" && typeof cell !== "number") invalid(noun)
      if (columns[i].type === "string" && typeof cell !== "string") invalid(noun)
      return cell
    })
  })
}

function columnByName(columns: ArtifactColumn[], name: unknown, noun: ComponentName): ArtifactColumn {
  if (typeof name !== "string") invalid(noun)
  const hit = columns.find((c) => c.name === name)
  if (!hit) throw new Refusal("missing-column", { noun, column: truncateValue(name as string) })
  return hit
}

function parseChart(raw: unknown, columns: ArtifactColumn[]): ChartEncoding {
  const noun: ComponentName = "chart"
  if (!isObj(raw)) invalid(noun)
  const kindRaw = raw.kind
  const kind = typeof kindRaw === "string" ? own(CHART_KIND_TABLE, kindRaw) : undefined
  if (!kind) {
    const alias = typeof kindRaw === "string" ? kindAlias(kindRaw) : undefined
    throw new Refusal("unknown-chart-kind", alias ? { noun, alias } : { noun })
  }
  if (!Array.isArray(raw.y) || raw.y.length < 1) invalid(noun)
  const y = raw.y as unknown[]
  if (y.length > MAX_SERIES[kind]) throw new Refusal("too-many-series", { noun, max: MAX_SERIES[kind] })
  const xCol = columnByName(columns, raw.x, noun)
  const yCols = y.map((name) => columnByName(columns, name, noun))
  if (yCols.some((c) => c.type !== "number")) invalid(noun)
  if (kind === "scatter" && xCol.type !== "number") invalid(noun)
  if (new Set(yCols.map((c) => c.name)).size !== yCols.length) invalid(noun)
  if (yCols.some((c) => c.name === xCol.name)) invalid(noun)
  if (typeof raw.stacked !== "boolean") invalid(noun)
  const slots = raw.slots
  if (!Array.isArray(slots) || slots.length !== y.length) invalid(noun)
  if (!slots.every((s) => isInt(s) && s >= 0 && s < PALETTE_SLOTS)) invalid(noun)
  if (new Set(slots).size !== slots.length) invalid(noun)
  return {
    kind,
    x: xCol.name,
    y: yCols.map((c) => c.name),
    stacked: raw.stacked as boolean,
    slots: slots as number[],
  }
}

function parseMetric(raw: unknown, columns: ArtifactColumn[]): MetricEncoding {
  const noun: ComponentName = "metric"
  if (!isObj(raw)) invalid(noun)
  const value = columnByName(columns, raw.value_column, noun)
  if (value.type !== "number") invalid(noun)
  let compare: string | null = null
  if (!isNullish(raw.compare_column)) {
    const c = columnByName(columns, raw.compare_column, noun)
    if (c.type !== "number") invalid(noun)
    compare = c.name
  }
  if (!isNullish(raw.label) && !isStr(raw.label, 0, 120)) invalid(noun)
  if (!isNullish(raw.compare_label) && !isStr(raw.compare_label, 0, 120)) invalid(noun)
  return {
    value_column: value.name,
    compare_column: compare,
    label: (raw.label as string | null | undefined) ?? null,
    compare_label: (raw.compare_label as string | null | undefined) ?? null,
  }
}

function parseOperation(raw: unknown, noun: ComponentName): LineageOperation {
  if (!isObj(raw)) invalid(noun)
  switch (raw.op) {
    case "filter_eq":
      if (!isStr(raw.column, 1) || !cellOk(raw.value ?? null)) invalid(noun)
      return { op: "filter_eq", column: raw.column as string, value: (raw.value ?? null) as Cell }
    case "filter_in":
      if (!isStr(raw.column, 1) || !Array.isArray(raw.values) || !raw.values.every(cellOk)) invalid(noun)
      return { op: "filter_in", column: raw.column as string, values: raw.values as Cell[] }
    case "filter_range": {
      const bound = (v: unknown) => isNullish(v) || isNum(v) || typeof v === "string"
      if (!isStr(raw.column, 1) || !bound(raw.min) || !bound(raw.max)) invalid(noun)
      return {
        op: "filter_range",
        column: raw.column as string,
        min: (raw.min ?? null) as number | string | null,
        max: (raw.max ?? null) as number | string | null,
      }
    }
    case "top_n":
      if (!isInt(raw.n) || raw.n < 1 || !isStr(raw.column, 1)) invalid(noun)
      return { op: "top_n", n: raw.n as number, column: raw.column as string }
    case "sort":
      if (!isStr(raw.column, 1) || (raw.direction !== "asc" && raw.direction !== "desc")) invalid(noun)
      return { op: "sort", column: raw.column as string, direction: raw.direction }
    case "select":
      if (!Array.isArray(raw.columns) || !raw.columns.every((c) => isStr(c, 1))) invalid(noun)
      return { op: "select", columns: raw.columns as string[] }
    default:
      return invalid(noun)
  }
}

function parseCaption(raw: unknown, noun: ComponentName): ArtifactCaption {
  if (!isObj(raw)) invalid(noun)
  if (!isInt(raw.row_count) || raw.row_count < 0) invalid(noun)
  if (!Array.isArray(raw.sources)) invalid(noun)
  const sources = raw.sources.map((s) => {
    if (!isObj(s) || !isStr(s.tool, 1)) invalid(noun)
    if (!strOrNull(s.document ?? null)) invalid(noun)
    if (!isNullish(s.page) && !isInt(s.page)) invalid(noun)
    return {
      tool: s.tool as string,
      document: (s.document as string | null | undefined) ?? null,
      page: (s.page as number | null | undefined) ?? null,
    }
  })
  if (!isInt(raw.source_count) || raw.source_count < 0) invalid(noun)
  let lineage: CaptionLineage | null = null
  if (!isNullish(raw.lineage)) {
    const l = raw.lineage
    if (!isObj(l) || !isStr(l.parent_label, 1) || !LABEL_RE.test(l.parent_label as string)) invalid(noun)
    if (!isInt(l.parent_row_count) || l.parent_row_count < 0) invalid(noun)
    if (typeof l.same_rows !== "boolean") invalid(noun)
    if (!Array.isArray(l.operations)) invalid(noun)
    lineage = {
      parent_label: l.parent_label as string,
      parent_row_count: l.parent_row_count as number,
      same_rows: l.same_rows as boolean,
      operations: (l.operations as unknown[]).map((op) => parseOperation(op, noun)),
    }
  }
  return { row_count: raw.row_count as number, sources, source_count: raw.source_count as number, lineage }
}

function parseRecord(raw: Obj): ArtifactRecord {
  const componentRaw = raw.component
  const component = typeof componentRaw === "string" ? own(COMPONENT_TABLE, componentRaw) : undefined
  if (!component) throw new Refusal("unknown-component")
  const noun = component

  if (!isStr(raw.id) || !ID_RE.test(raw.id)) invalid(noun)
  if (!isStr(raw.label) || !LABEL_RE.test(raw.label) || !raw.label.startsWith(`${component} `)) invalid(noun)
  if (raw.spec_version !== 1) invalid(noun)
  if (!isInt(raw.row_count) || raw.row_count < 0) invalid(noun)
  if (!isStr(raw.thread_id) || !isStr(raw.user_id)) invalid(noun)
  for (const k of ["org_id", "run_id", "tool_call_id", "parent_id"] as const) {
    if (!isNullish(raw[k]) && typeof raw[k] !== "string") invalid(noun)
  }
  if (!isNullish(raw.created_at) && typeof raw.created_at !== "string") invalid(noun)

  const spec = raw.spec
  if (!isObj(spec)) invalid(noun)
  if (!isStr(spec.title, 1, 120)) invalid(noun)
  const columns = parseColumns(spec.columns, noun)

  // Encoding first (an unknown kind is the more useful sentence than a row problem), then rows.
  let chart: ChartEncoding | null = null
  let metric: MetricEncoding | null = null
  if (component === "chart") {
    if (!isNullish(spec.metric)) invalid(noun)
    chart = parseChart(spec.chart, columns)
  } else if (component === "metric") {
    if (!isNullish(spec.chart)) invalid(noun)
    metric = parseMetric(spec.metric, columns)
  } else if (!isNullish(spec.chart) || !isNullish(spec.metric)) {
    invalid(noun)
  }

  const rows = parseRows(spec.rows, columns, noun)
  if (component === "metric" && rows.length !== 1) invalid(noun)

  const caption = parseCaption(raw.caption, noun)

  return {
    id: raw.id as string,
    thread_id: raw.thread_id as string,
    user_id: raw.user_id as string,
    org_id: (raw.org_id as string | null | undefined) ?? null,
    run_id: (raw.run_id as string | null | undefined) ?? null,
    tool_call_id: (raw.tool_call_id as string | null | undefined) ?? null,
    parent_id: (raw.parent_id as string | null | undefined) ?? null,
    label: raw.label as string,
    component,
    spec: { title: spec.title as string, columns, rows, chart, metric },
    caption,
    row_count: raw.row_count as number,
    spec_version: 1,
    created_at: (raw.created_at as string | undefined) ?? "",
  }
}

/** A string id safe to use as a React key / DOM id, or undefined. */
function safeId(raw: unknown): string | undefined {
  try {
    if (isObj(raw) && typeof raw.id === "string" && ID_RE.test(raw.id)) return raw.id
  } catch {
    /* a hostile getter — no id */
  }
  return undefined
}

/**
 * The trust boundary. Never throws; every failure is one catalogue reason.
 */
export function parseArtifactRecord(raw: unknown): ParseResult {
  try {
    if (!isObj(raw)) return { ok: false, reason: "invalid-settings" }
    if (raw.missing === true) return { ok: false, reason: "data-missing", id: safeId(raw) }
    return { ok: true, record: parseRecord(raw) }
  } catch (e) {
    const id = safeId(raw)
    if (e instanceof Refusal) {
      return e.ctx ? { ok: false, reason: e.reason, ctx: e.ctx, id } : { ok: false, reason: e.reason, id }
    }
    // Anything else (a hostile getter, an exotic object) is a settings failure. The exception's
    // message is DISCARDED here on purpose — it never reaches the page (D-12).
    return { ok: false, reason: "invalid-settings", id }
  }
}
