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
 * closed set, (b) an alias from a closed alias table, (c) a number, (d) a closed item word, or (e) a
 * data value (column name, node id, term name, date string) already truncated to 40 characters —
 * never a model-supplied kind string, never a validation path, never an exception message
 * (UI-SPEC §Notice reason catalogue).
 *
 * Hand-rolled `typeof` / `Array.isArray` narrowing in the `SearchDocumentsBody.tsx` style — no schema
 * library: `zod` is not in the tree and the research did not justify a dependency (292 D-19 keeps it so).
 *
 * I-1: the component set is CLOSED CODE. Membership is read through `own()` (the tree's one
 * prototype-key guard), so `__proto__`, `constructor` and `toString` are never components.
 * Adding a component is a code change here AND in the backend Literal — never a prompt, a setting or
 * a row. `artifactRegistry.ts` re-exports `ARTIFACT_COMPONENT_NAMES` as `ARTIFACT_COMPONENTS`.
 *
 * Phase 292-02 (D-03..D-07 · I-3): the three ENCODED types — `diagram`, `comparison`, `timeline` —
 * each get one guard arm that mirrors plan 292-01's stored contract rule for rule (caps, enums,
 * references, duplicates, calendar dates, source shape, row_count parity). ONE deliberate asymmetry:
 * the backend refuses < 2 nodes and 0 edges; this guard RENDERS 1-25 nodes and 0-40 edges, so a
 * crafted or legacy row draws instead of erroring. A component never receives an unvalidated prop.
 */
import { own } from "@/components/workflows/ownProperty"
import { componentAlias, kindAlias, truncateValue } from "./artifactCopy"

// ── The closed vocabulary ────────────────────────────────────────────────────────────────────

/** 292-02 (D-01 · D-02 · I-1): SIX components, in the backend Literal's order. */
export type ComponentName = "chart" | "table" | "metric" | "diagram" | "comparison" | "timeline"
export type ChartKind = "line" | "bar" | "area" | "scatter"
/** The three components that draw their own typed encoding instead of `columns` / `rows` (D-03). */
export type EncodedComponent = "diagram" | "comparison" | "timeline"

/** The closed component table. Read ONLY through `own()`. */
const COMPONENT_TABLE: Record<string, ComponentName> = {
  chart: "chart",
  table: "table",
  metric: "metric",
  diagram: "diagram",
  comparison: "comparison",
  timeline: "timeline",
}
export const ARTIFACT_COMPONENT_NAMES = ["chart", "table", "metric", "diagram", "comparison", "timeline"] as const

const CHART_KIND_TABLE: Record<string, ChartKind> = { line: "line", bar: "bar", area: "area", scatter: "scatter" }
export const CHART_KINDS = ["line", "bar", "area", "scatter"] as const

/** 292 (UI-D-292-04): the closed node kinds. There is no `actor` (swimlanes lost at sketch time). */
export type NodeKind = "start" | "step" | "decision" | "end"
export const NODE_KINDS = ["start", "step", "decision", "end"] as const
/** Read ONLY through `own()`. */
export const NODE_KIND_TABLE: Record<string, NodeKind> = { start: "start", step: "step", decision: "decision", end: "end" }

/** 292 (D-05 · UI-D-292-10): favourable / unfavourable / neutral or partly / not stated. Stored lower-case. */
export type Verdict = "y" | "n" | "m" | "q"
export const VERDICTS = ["y", "n", "m", "q"] as const
/** Read ONLY through `own()`. */
export const VERDICT_TABLE: Record<string, Verdict> = { y: "y", n: "n", m: "m", q: "q" }

/** UI-D-01: line/bar/area ≤ 4 series (four palette slots); scatter ≤ 3 (all-pairs rule). */
export const MAX_SERIES: Record<ChartKind, number> = { line: 4, bar: 4, area: 4, scatter: 3 }
export const MAX_ROWS = 500
export const MAX_COLUMNS = 20
export const PALETTE_SLOTS = 4

// 292 caps — the backend's names and values (292-01 <interfaces>). String lengths are UTF-16 units,
// which is what `String.length` counts. ⚠ MIN_NODES / MIN_EDGES are the BACKEND's minimums, exported
// for the cross-stack fence; this guard deliberately renders 1-25 nodes and 0-40 edges.
export const MIN_NODES = 2
export const MAX_NODES = 25
export const MIN_EDGES = 1
export const MAX_EDGES = 40
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5
export const MAX_TERMS = 20
export const MAX_EVENTS = 40
export const MAX_NODE_LABEL_CHARS = 48
export const MAX_EDGE_LABEL_CHARS = 24
export const MAX_OPTION_CHARS = 40
export const MAX_TERM_CHARS = 60
export const MAX_EVENT_TITLE_CHARS = 80
export const MAX_EVENT_DETAIL_CHARS = 200
export const MAX_CATEGORY_CHARS = 24
export const MAX_EXCERPT_CHARS = 280
export const MAX_CELL_CHARS = 200
export const MAX_TITLE_CHARS = 120
export const MAX_SOURCE_DOCUMENT_CHARS = 200
export const NODE_ID_RE = /^[A-Za-z0-9_.-]{1,40}$/

const ID_RE = /^a_[0-9a-z]{10}$/
/** D-13: built FROM the six, so a label chip can only ever name a registered component. */
const LABEL_RE = new RegExp(`^(${ARTIFACT_COMPONENT_NAMES.join("|")}) [1-9][0-9]*$`)

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

/** 292 (D-07): a server-resolved source. The model never wrote any of these fields. */
export interface ArtifactSource {
  document: string | null
  page: number | null
  excerpt: string | null
}

/**
 * A source worth showing: it names a document or carries an excerpt. One rule for the caption note,
 * the tooltip and the timeline source line, so "has a source" can never mean two things.
 */
export function isResolvedSource(s: ArtifactSource | null): s is ArtifactSource {
  return s !== null && (s.document !== null || s.excerpt !== null)
}

export interface DiagramNode {
  id: string
  label: string
  kind: NodeKind
  source: ArtifactSource | null
}

export interface DiagramEdge {
  from: string
  to: string
  label: string | null
}

export interface DiagramEncoding {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export interface ComparisonCell {
  verdict: Verdict
  text: string | null
  source: ArtifactSource | null
}

export interface ComparisonTerm {
  name: string
  cells: ComparisonCell[]
}

export interface ComparisonEncoding {
  options: string[]
  terms: ComparisonTerm[]
}

export interface TimelineEvent {
  /** `YYYY-MM-DD` or `YYYY-MM`, a real calendar date (checked by `parseCalendarDate`). */
  date: string
  title: string
  detail: string | null
  category: string | null
  deadline: boolean
  source: ArtifactSource | null
}

export interface TimelineEncoding {
  events: TimelineEvent[]
}

/**
 * The parsed spec. A tabular record carries `columns` + `rows` (+ `chart` / `metric`) and null new
 * encodings; an encoded record carries exactly ONE of `diagram` / `comparison` / `timeline` and
 * parses to `columns: []`, `rows: []`, `chart: null`, `metric: null` (no such keys are stored).
 */
export interface ArtifactSpec {
  title: string
  columns: ArtifactColumn[]
  rows: Cell[][]
  chart: ChartEncoding | null
  metric: MetricEncoding | null
  diagram: DiagramEncoding | null
  comparison: ComparisonEncoding | null
  timeline: TimelineEncoding | null
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
  // 292-02 (D-20): the encoded types' codes.
  | "too-many-items"
  | "wrong-option-count"
  | "no-items"
  | "broken-link"
  | "ragged-term"
  | "bad-date"

/** The closed item words a notice may name: diagram → steps / links, comparison → terms / options, timeline → events. */
export type NoticeItems = "steps" | "links" | "terms" | "options" | "events"

export interface NoticeContext {
  /** The component noun, from the closed set only. */
  noun?: ComponentName
  /** A column name, already truncated to 40 characters. */
  column?: string
  /** A chart-kind or component alias from a closed alias table — never a model string. */
  alias?: string
  max?: number
  /** 292: a closed item word. */
  items?: NoticeItems
  /** 292: a count (the number of options a comparison carried). */
  count?: number
  /** 292: a data value (node id, term name, date string) as text, already truncated to 40. */
  value?: string
}

export type ParseResult =
  | { ok: true; record: ArtifactRecord }
  | { ok: false; reason: NoticeReason; ctx?: NoticeContext; id?: string }

/** What every registry component receives: a record that already passed the guard. */
export interface ArtifactBodyProps {
  record: ArtifactRecord
}

/**
 * A render-time failure that names its OWN catalogue reason (e.g. `chart-unavailable` when the
 * chart chunk fails to load). `ArtifactErrorBoundary` shows that reason; any other thrown value
 * shows `render-failed`. It carries a code, never a message for people.
 */
export class ArtifactNoticeError extends Error {
  readonly reason: NoticeReason
  constructor(reason: NoticeReason) {
    super(reason)
    this.name = "ArtifactNoticeError"
    this.reason = reason
  }
}

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

/** A required non-blank string within `max` UTF-16 units. */
function isText(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max
}

/**
 * An optional string: absent / null / blank → null (the server stores blanks as null), a string
 * within `max` units → itself, anything else refuses.
 */
function optText(v: unknown, max: number, noun: ComponentName): string | null {
  if (isNullish(v)) return null
  if (typeof v !== "string" || v.length > max) invalid(noun)
  return (v as string).trim() ? (v as string) : null
}

// ── Calendar dates (292 · D-06 · UI-D-292-18) ────────────────────────────────────────────────

/** A calendar date from INTEGER PARTS — `d` is null for month precision. Never a `Date` object. */
export interface CalendarDate {
  y: number
  m: number
  d: number | null
}

const DATE_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Days in month `m` (1-12) of year `y`; 0 for a month outside 1-12. */
export function daysInMonth(y: number, m: number): number {
  if (m === 2 && isLeap(y)) return 29
  return MONTH_DAYS[m - 1] ?? 0
}

/**
 * `YYYY-MM-DD` (a real calendar day) or `YYYY-MM`, parsed by hand into integer parts; anything else
 * is null. ⛔ Never a `Date` built from the ISO string: that is UTC midnight, the PREVIOUS day west of
 * Greenwich. Mirrors the backend: `^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$` plus `datetime.date(y, m, d)`
 * for a day — so year 0 is refused only at day precision, exactly where `datetime.MINYEAR` refuses it.
 */
export function parseCalendarDate(s: unknown): CalendarDate | null {
  if (typeof s !== "string") return null
  const hit = DATE_RE.exec(s)
  if (!hit) return null
  const y = Number(hit[1])
  const m = Number(hit[2])
  if (m < 1 || m > 12) return null
  if (hit[3] === undefined) return { y, m, d: null }
  const d = Number(hit[3])
  if (y < 1 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
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

// ── 292 encoded arms (D-03..D-07). Order inside each: shape and counts, then per-item fields, then
// cross-item rules (references, duplicates) — so the more useful sentence wins. ─────────────────

/** A stored source: null, or `{document ≤ 200 | null, page int ≥ 1 | null, excerpt ≤ 280 | null}`. */
function parseSource(raw: unknown, noun: ComponentName): ArtifactSource | null {
  if (isNullish(raw)) return null
  if (!isObj(raw)) invalid(noun)
  if (!isNullish(raw.document) && !isStr(raw.document, 0, MAX_SOURCE_DOCUMENT_CHARS)) invalid(noun)
  if (!isNullish(raw.page) && !(isInt(raw.page) && raw.page >= 1)) invalid(noun)
  if (!isNullish(raw.excerpt) && !isStr(raw.excerpt, 0, MAX_EXCERPT_CHARS)) invalid(noun)
  return {
    document: (raw.document as string | null | undefined) ?? null,
    page: (raw.page as number | null | undefined) ?? null,
    excerpt: (raw.excerpt as string | null | undefined) ?? null,
  }
}

function parseDiagram(raw: unknown): DiagramEncoding {
  const noun: ComponentName = "diagram"
  if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) invalid(noun)
  const rawNodes = raw.nodes as unknown[]
  const rawEdges = raw.edges as unknown[]
  if (rawNodes.length === 0) throw new Refusal("no-items", { noun, items: "steps" })
  if (rawNodes.length > MAX_NODES) throw new Refusal("too-many-items", { noun, items: "steps", max: MAX_NODES })
  if (rawEdges.length > MAX_EDGES) throw new Refusal("too-many-items", { noun, items: "links", max: MAX_EDGES })

  const nodes: DiagramNode[] = rawNodes.map((n) => {
    if (!isObj(n) || !isStr(n.id) || !NODE_ID_RE.test(n.id)) invalid(noun)
    if (!isText(n.label, MAX_NODE_LABEL_CHARS)) invalid(noun)
    // An absent kind is the default `step` (the server stores it explicitly); any other value must
    // be one of the closed four exactly as stored (lower-case), read through own().
    const kind = isNullish(n.kind) ? "step" : typeof n.kind === "string" ? own(NODE_KIND_TABLE, n.kind) : undefined
    if (!kind) invalid(noun)
    return { id: n.id as string, label: n.label as string, kind, source: parseSource(n.source, noun) }
  })
  const edges: DiagramEdge[] = rawEdges.map((e) => {
    if (!isObj(e) || !isStr(e.from, 1) || !isStr(e.to, 1)) invalid(noun)
    return { from: e.from as string, to: e.to as string, label: optText(e.label, MAX_EDGE_LABEL_CHARS, noun) }
  })

  // Cross-item, in the backend's order: uniqueness, references, duplicate pairs, self-loops.
  const ids = new Set<string>()
  for (const n of nodes) {
    if (ids.has(n.id)) invalid(noun)
    ids.add(n.id)
  }
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      if (!ids.has(end)) throw new Refusal("broken-link", { noun, value: truncateValue(end) })
    }
  }
  const pairs = new Set<string>()
  for (const e of edges) {
    // UI-D-292-27: any repeated from→to draws on top of itself, labels or not. Ids never contain a
    // space, so the joined key cannot be forged by two different pairs.
    const key = `${e.from} ${e.to}`
    if (pairs.has(key)) invalid(noun)
    pairs.add(key)
  }
  for (const e of edges) {
    if (e.from === e.to && e.label === null) invalid(noun)
  }
  return { nodes, edges }
}

function parseComparison(raw: unknown): ComparisonEncoding {
  const noun: ComponentName = "comparison"
  if (!isObj(raw) || !Array.isArray(raw.options) || !Array.isArray(raw.terms)) invalid(noun)
  const rawOptions = raw.options as unknown[]
  const rawTerms = raw.terms as unknown[]
  if (rawOptions.length < MIN_OPTIONS || rawOptions.length > MAX_OPTIONS) {
    throw new Refusal("wrong-option-count", { noun, count: rawOptions.length })
  }
  if (rawTerms.length === 0) throw new Refusal("no-items", { noun, items: "terms" })
  if (rawTerms.length > MAX_TERMS) throw new Refusal("too-many-items", { noun, items: "terms", max: MAX_TERMS })

  const options = rawOptions.map((o) => {
    if (!isText(o, MAX_OPTION_CHARS)) invalid(noun)
    return o as string
  })
  const terms: ComparisonTerm[] = rawTerms.map((t) => {
    if (!isObj(t) || !isText(t.name, MAX_TERM_CHARS) || !Array.isArray(t.cells)) invalid(noun)
    const cells = (t.cells as unknown[]).map((c): ComparisonCell => {
      if (!isObj(c)) invalid(noun)
      const verdict = typeof c.verdict === "string" ? own(VERDICT_TABLE, c.verdict) : undefined
      if (!verdict) invalid(noun)
      return { verdict, text: optText(c.text, MAX_CELL_CHARS, noun), source: parseSource(c.source, noun) }
    })
    return { name: t.name as string, cells }
  })

  if (new Set(options).size !== options.length) invalid(noun)
  for (const t of terms) {
    if (t.cells.length !== options.length) throw new Refusal("ragged-term", { noun, value: truncateValue(t.name) })
  }
  return { options, terms }
}

function parseTimeline(raw: unknown): TimelineEncoding {
  const noun: ComponentName = "timeline"
  if (!isObj(raw) || !Array.isArray(raw.events)) invalid(noun)
  const rawEvents = raw.events as unknown[]
  if (rawEvents.length === 0) throw new Refusal("no-items", { noun, items: "events" })
  if (rawEvents.length > MAX_EVENTS) throw new Refusal("too-many-items", { noun, items: "events", max: MAX_EVENTS })

  // ⚠ The stored order is the server's sort and this guard never re-sorts it; the rail model sorts
  // stably for display, which is a no-op on a sorted list.
  const events: TimelineEvent[] = rawEvents.map((ev) => {
    if (!isObj(ev) || typeof ev.date !== "string") invalid(noun)
    const date = ev.date as string
    if (!parseCalendarDate(date)) throw new Refusal("bad-date", { noun, value: truncateValue(date) })
    if (!isText(ev.title, MAX_EVENT_TITLE_CHARS)) invalid(noun)
    if (!isNullish(ev.deadline) && typeof ev.deadline !== "boolean") invalid(noun)
    return {
      date,
      title: ev.title as string,
      detail: optText(ev.detail, MAX_EVENT_DETAIL_CHARS, noun),
      category: optText(ev.category, MAX_CATEGORY_CHARS, noun),
      deadline: ev.deadline === true,
      source: parseSource(ev.source, noun),
    }
  })
  return { events }
}

const ENCODED_KEYS = ["diagram", "comparison", "timeline"] as const

function isEncoded(c: ComponentName): c is EncodedComponent {
  return c === "diagram" || c === "comparison" || c === "timeline"
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

/** The record envelope every component shares (ids, label, version), checked before the spec. */
function checkEnvelope(raw: Obj, component: ComponentName): void {
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
}

function envelope(raw: Obj, component: ComponentName, spec: ArtifactSpec, caption: ArtifactCaption): ArtifactRecord {
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
    spec,
    caption,
    row_count: raw.row_count as number,
    spec_version: 1,
    created_at: (raw.created_at as string | undefined) ?? "",
  }
}

/**
 * 292: the encoded record. The stored spec is `{title, <its one encoding>}` — a non-null `columns`,
 * `rows`, `chart`, `metric` or ANOTHER type's encoding is invalid; `row_count` and
 * `caption.row_count` must equal the item count; the caption carries no lineage (D-08: these are
 * never redrawn by reference).
 */
function parseEncodedRecord(raw: Obj, spec: Obj, component: EncodedComponent): ArtifactRecord {
  const noun: ComponentName = component
  for (const k of ["columns", "rows", "chart", "metric", ...ENCODED_KEYS] as const) {
    if (k !== component && !isNullish(spec[k])) invalid(noun)
  }

  let diagram: DiagramEncoding | null = null
  let comparison: ComparisonEncoding | null = null
  let timeline: TimelineEncoding | null = null
  let items: number
  if (component === "diagram") {
    diagram = parseDiagram(spec.diagram)
    items = diagram.nodes.length
  } else if (component === "comparison") {
    comparison = parseComparison(spec.comparison)
    items = comparison.terms.length
  } else {
    timeline = parseTimeline(spec.timeline)
    items = timeline.events.length
  }

  const caption = parseCaption(raw.caption, noun)
  if (caption.lineage !== null) invalid(noun)
  if (raw.row_count !== items || caption.row_count !== items) invalid(noun)

  const parsed: ArtifactSpec = {
    title: spec.title as string,
    columns: [],
    rows: [],
    chart: null,
    metric: null,
    diagram,
    comparison,
    timeline,
  }
  return envelope(raw, component, parsed, caption)
}

function parseRecord(raw: Obj): ArtifactRecord {
  const componentRaw = raw.component
  const component = typeof componentRaw === "string" ? own(COMPONENT_TABLE, componentRaw) : undefined
  if (!component) {
    // 292 (UI-D-292-21): only a word from the CLOSED component-alias table may reach the sentence.
    const alias = typeof componentRaw === "string" ? componentAlias(componentRaw) : undefined
    throw new Refusal("unknown-component", alias ? { alias } : undefined)
  }
  const noun = component
  checkEnvelope(raw, component)

  const spec = raw.spec
  if (!isObj(spec)) invalid(noun)
  if (!isStr(spec.title, 1, MAX_TITLE_CHARS)) invalid(noun)

  // 292: an encoded type branches BEFORE `parseColumns` (which requires ≥ 1 column).
  if (isEncoded(component)) return parseEncodedRecord(raw, spec, component)

  for (const k of ENCODED_KEYS) if (!isNullish(spec[k])) invalid(noun)
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

  const parsed: ArtifactSpec = {
    title: spec.title as string,
    columns,
    rows,
    chart,
    metric,
    diagram: null,
    comparison: null,
    timeline: null,
  }
  return envelope(raw, component, parsed, caption)
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
