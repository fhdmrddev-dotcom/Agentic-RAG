/**
 * Phase 273-02 — realistic ArtifactRecord fixtures, exactly in the v1 WIRE shape
 * (`273-01-PLAN.md` <interfaces>; backend copy `backend/tests/unit/fixtures/artifact_record_v1.json`).
 *
 * Every record carries the full top-level key set the backend row carries, because 273-05's parity
 * fence compares this file's top-level keys against the backend fixture's. Values are realistic
 * business data, never `foo`.
 *
 * ⚠ Row counts are the DATA's, not the UI-SPEC's illustrative strings: a wide-format bar chart of
 * four quarters × four regions is FOUR rows (one per quarter, one column per region), so `chartBar`
 * reads `4 rows`. The 16-row long-format source table is `table16`.
 */

const THREAD = "6f1c2a7e-3b4d-4c1a-9e2f-0a8b7c6d5e41"
const USER = "1d2e3f40-5a6b-4c7d-8e9f-a0b1c2d3e4f5"
const ORG = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
const RUN = "c0ffee00-1234-4abc-9def-0123456789ab"

type Cell = string | number | null

function base(
  id: string,
  label: string,
  component: "chart" | "table" | "metric" | "diagram" | "comparison" | "timeline",
  spec: Record<string, unknown>,
  caption: Record<string, unknown>,
  rowCount: number,
  parentId: string | null = null,
) {
  return {
    id,
    thread_id: THREAD,
    user_id: USER,
    org_id: ORG,
    run_id: RUN,
    tool_call_id: `call_${id.slice(2, 8)}`,
    parent_id: parentId,
    label,
    component,
    spec,
    caption,
    row_count: rowCount,
    spec_version: 1,
    created_at: "2026-10-03T09:41:12.512Z",
  }
}

const QUARTERLY_SOURCE = [
  { tool: "query_tables", document: "Quarterly_Report_FY25.pdf", page: 4 },
]

const REGION_COLUMNS = [
  { name: "quarter", type: "string", unit: null },
  { name: "Americas", type: "number", unit: "$K" },
  { name: "EMEA", type: "number", unit: "$K" },
  { name: "APAC", type: "number", unit: "$K" },
  { name: "LATAM", type: "number", unit: "$K" },
]

const REGION_ROWS: Cell[][] = [
  ["Q1", 1210, 860, 640, 210],
  ["Q2", 1325, 905, 702, 238],
  ["Q3", 1402, 948, 731, 251],
  ["Q4", 1656, 1012, 798, 274],
]

/** Grouped bar, 4 quarters × Americas/EMEA/APAC/LATAM, slots [0,1,2,3]. */
export const chartBar = base(
  "a_k3j9x0p2qd",
  "chart 1",
  "chart",
  {
    title: "FY25 revenue by region · $K",
    columns: REGION_COLUMNS,
    rows: REGION_ROWS,
    chart: {
      kind: "bar",
      x: "quarter",
      y: ["Americas", "EMEA", "APAC", "LATAM"],
      stacked: false,
      slots: [0, 1, 2, 3],
    },
    metric: null,
  },
  { row_count: 4, sources: QUARTERLY_SOURCE, source_count: 1, lineage: null },
  4,
)

/** Line, monthly active accounts, two series. */
export const chartLine = base(
  "a_m4n8p1q7rs",
  "chart 2",
  "chart",
  {
    title: "Active accounts per month",
    columns: [
      { name: "month", type: "string", unit: null },
      { name: "Self-serve", type: "number", unit: null },
      { name: "Enterprise", type: "number", unit: null },
    ],
    rows: [
      ["Jan", 4120, 312],
      ["Feb", 4388, 318],
      ["Mar", 4602, 331],
      ["Apr", 4815, 340],
      ["May", 5034, 352],
      ["Jun", 5290, 367],
    ],
    chart: { kind: "line", x: "month", y: ["Self-serve", "Enterprise"], stacked: false, slots: [0, 1] },
    metric: null,
  },
  {
    row_count: 6,
    sources: [{ tool: "query_tables", document: "accounts_H1.xlsx", page: null }],
    source_count: 1,
    lineage: null,
  },
  6,
)

/** Area, always stacked, three channels. */
export const chartAreaStacked = base(
  "a_t5u6v7w8x9",
  "chart 3",
  "chart",
  {
    title: "Support tickets by channel",
    columns: [
      { name: "week", type: "string", unit: null },
      { name: "Email", type: "number", unit: null },
      { name: "Chat", type: "number", unit: null },
      { name: "Phone", type: "number", unit: null },
    ],
    rows: [
      ["W1", 182, 96, 41],
      ["W2", 175, 118, 38],
      ["W3", 191, 131, 44],
      ["W4", 168, 140, 35],
    ],
    chart: { kind: "area", x: "week", y: ["Email", "Chat", "Phone"], stacked: true, slots: [0, 1, 2] },
    metric: null,
  },
  {
    row_count: 4,
    sources: [
      { tool: "query_documents", document: "tickets_FY25.xlsx", page: null },
      { tool: "execute_code", document: null, page: null },
    ],
    source_count: 2,
    lineage: null,
  },
  4,
)

/** Scatter, deal size vs. sales-cycle days, two segments. */
export const chartScatter = base(
  "a_y0z1a2b3c4",
  "chart 4",
  "chart",
  {
    title: "Deal size vs. sales cycle",
    columns: [
      { name: "cycle days", type: "number", unit: "days" },
      { name: "Mid-market", type: "number", unit: "$K" },
      { name: "Enterprise", type: "number", unit: "$K" },
    ],
    rows: [
      [21, 38, null],
      [34, 52, null],
      [47, null, 210],
      [62, null, 340],
      [29, 44, null],
      [88, null, 415],
    ],
    chart: { kind: "scatter", x: "cycle days", y: ["Mid-market", "Enterprise"], stacked: false, slots: [0, 1] },
    metric: null,
  },
  { row_count: 6, sources: [], source_count: 0, lineage: null },
  6,
)

const LONG_ROWS: Cell[][] = []
for (const [q, ...vals] of REGION_ROWS) {
  const regions = ["Americas", "EMEA", "APAC", "LATAM"]
  regions.forEach((r, i) => LONG_ROWS.push([q as string, r, vals[i] as number]))
}

/** The 16-row long-format source table (quarter × region × revenue). */
export const table16 = base(
  "a_d5e6f7g8h9",
  "table 1",
  "table",
  {
    title: "FY25 revenue by quarter and region",
    columns: [
      { name: "quarter", type: "string", unit: null },
      { name: "region", type: "string", unit: null },
      { name: "revenue", type: "number", unit: "$K" },
    ],
    rows: LONG_ROWS,
    chart: null,
    metric: null,
  },
  { row_count: 16, sources: QUARTERLY_SOURCE, source_count: 1, lineage: null },
  16,
)

/** One value with a higher comparison: ▲ 8.1% vs Q3. */
export const metricWithDelta = base(
  "a_j1k2l3m4n5",
  "metric 1",
  "metric",
  {
    title: "Q4 revenue, Americas",
    columns: [
      { name: "Q4 revenue", type: "number", unit: "$K" },
      { name: "Q3 revenue", type: "number", unit: "$K" },
    ],
    rows: [[1656, 1532]],
    chart: null,
    metric: {
      value_column: "Q4 revenue",
      compare_column: "Q3 revenue",
      label: "Q4 revenue",
      compare_label: "Q3",
    },
  },
  { row_count: 1, sources: QUARTERLY_SOURCE, source_count: 1, lineage: null },
  1,
)

/** A comparison of zero: the percent is omitted, the absolute difference shown. */
export const metricZeroCompare = base(
  "a_o6p7q8r9s0",
  "metric 2",
  "metric",
  {
    title: "New-region revenue",
    columns: [
      { name: "FY25", type: "number", unit: "$K" },
      { name: "FY24", type: "number", unit: "$K" },
    ],
    rows: [[274, 0]],
    chart: null,
    metric: { value_column: "FY25", compare_column: "FY24", label: "LATAM revenue", compare_label: "FY24" },
  },
  { row_count: 1, sources: QUARTERLY_SOURCE, source_count: 1, lineage: null },
  1,
)

/** By-reference follow-up: table 1 (16 rows) filtered to quarter = Q3 → 4 of 16 rows. */
export const chartFromFilter = base(
  "a_u1v2w3x4y5",
  "chart 5",
  "chart",
  {
    title: "Q3 revenue by region · $K",
    columns: [
      { name: "quarter", type: "string", unit: null },
      { name: "region", type: "string", unit: null },
      { name: "revenue", type: "number", unit: "$K" },
    ],
    rows: LONG_ROWS.filter((r) => r[0] === "Q3"),
    chart: { kind: "bar", x: "region", y: ["revenue"], stacked: false, slots: [0] },
    metric: null,
  },
  {
    row_count: 4,
    sources: QUARTERLY_SOURCE,
    source_count: 1,
    lineage: {
      parent_label: "table 1",
      parent_row_count: 16,
      same_rows: false,
      operations: [{ op: "filter_eq", column: "quarter", value: "Q3" }],
    },
  },
  4,
  "a_d5e6f7g8h9",
)

/** By-reference re-encode with the row set unchanged: chart 1 redrawn as a stacked bar. */
export const chartRedrawn = base(
  "a_z6a7b8c9d0",
  "chart 6",
  "chart",
  {
    title: "FY25 revenue by region · $K",
    columns: REGION_COLUMNS,
    rows: REGION_ROWS,
    chart: {
      kind: "bar",
      x: "quarter",
      y: ["Americas", "EMEA", "APAC", "LATAM"],
      stacked: true,
      slots: [0, 1, 2, 3],
    },
    metric: null,
  },
  {
    row_count: 4,
    sources: QUARTERLY_SOURCE,
    source_count: 1,
    lineage: { parent_label: "chart 1", parent_row_count: 4, same_rows: true, operations: [] },
  },
  4,
  "a_k3j9x0p2qd",
)

/** No data-bearing tool ran this turn: "Values provided by the agent". */
export const noSource = base(
  "a_e1f2g3h4i5",
  "table 2",
  "table",
  {
    title: "Shortlisted vendors",
    columns: [
      { name: "vendor", type: "string", unit: null },
      { name: "annual cost", type: "number", unit: "$K" },
    ],
    rows: [
      ["Northwind Logistics", 184],
      ["Contoso Freight", 212],
      ["Fabrikam Shipping", 167],
      ["Tailspin Cargo", null],
      ["Adventure Works", 199],
    ],
    chart: null,
    metric: null,
  },
  { row_count: 5, sources: [], source_count: 0, lineage: null },
  5,
)

/** The reload placeholder for a referenced id with no stored row. */
export const missing = { id: "a_q9w8e7r6t5", missing: true as const }

// ── Phase 292-02 — the three encoded types, in the STORED shape (292-01 <interfaces>) ─────────
// A stored new-type spec carries `title` plus its ONE encoding key and nothing else: no columns,
// rows, chart or metric. Every optional field is present and explicit (`null` / `false`), exactly as
// the server dumps it. Sources are server-resolved {document, page, excerpt}; the model never wrote
// them.

const INVOICE_POLICY = "Invoice_Policy.pdf"

function src(excerpt: string, page: number | null = 3, document: string | null = INVOICE_POLICY) {
  return { document, page, excerpt }
}

/**
 * Invoice approval, 8 steps · 9 links: one back edge (a corrected invoice goes back to the inbox)
 * and one labelled self-loop (the approval reminder). Kinds start / step / decision / end.
 */
export const diagramInvoice = base(
  "a_dg1nv0c3x8",
  "diagram 1",
  "diagram",
  {
    title: "How an invoice gets approved",
    diagram: {
      nodes: [
        { id: "log", label: "Invoice logged in the AP inbox", kind: "start", source: src("Every supplier invoice is logged in the AP inbox on the day it arrives.") },
        { id: "match", label: "Matches the purchase order?", kind: "decision", source: src("Accounts Payable matches each invoice to its purchase order and goods receipt.") },
        { id: "query", label: "Query the supplier", kind: "step", source: null },
        { id: "reject", label: "Invoice rejected", kind: "end", source: null },
        { id: "approve", label: "Budget holder approves", kind: "step", source: src("The budget holder approves the invoice within three business days.", 4) },
        { id: "pay", label: "Schedule payment", kind: "step", source: null },
        { id: "post", label: "Post to the ledger", kind: "step", source: null },
        { id: "paid", label: "Invoice paid", kind: "end", source: null },
      ],
      edges: [
        { from: "log", to: "match", label: null },
        { from: "match", to: "approve", label: "Matches" },
        { from: "match", to: "query", label: "Doesn't match" },
        { from: "query", to: "log", label: "Corrected invoice" },
        { from: "query", to: "reject", label: "Supplier disputes" },
        { from: "approve", to: "approve", label: "Reminder after 3 days" },
        { from: "approve", to: "pay", label: null },
        { from: "pay", to: "post", label: null },
        { from: "post", to: "paid", label: null },
      ],
    },
  },
  {
    row_count: 8,
    sources: [{ tool: "search_documents", document: INVOICE_POLICY, page: 3 }],
    source_count: 1,
    lineage: null,
  },
  8,
)

type Verdict = "y" | "n" | "m" | "q"

function cell(verdict: Verdict, text: string | null, excerpt: string | null = null, document: string | null = null) {
  return { verdict, text, source: excerpt ? { document, page: null, excerpt } : null }
}

const ATLAS = "Atlas_MSA_2023.pdf"
const NORTHWIND = "Northwind_MSA_2024.pdf"
const KESTREL = "Kestrel_Proposal_2025.pdf"

/** Freight vendor contracts, 3 options × 7 terms, two `q` cells (sketch 3A data). */
export const comparisonContracts = base(
  "a_cmp7x2k9q1",
  "comparison 1",
  "comparison",
  {
    title: "Freight vendor contracts — key terms",
    comparison: {
      options: ["Atlas Logistics", "Northwind Freight", "Kestrel Cargo"],
      terms: [
        { name: "Initial term", cells: [cell("m", "3 years", "The initial term of this Agreement is three (3) years.", ATLAS), cell("m", "2 years"), cell("m", "3 years")] },
        { name: "Auto-renewal", cells: [cell("m", "1 year, unless notice"), cell("y", "None — must re-sign"), cell("m", "1 year, unless notice")] },
        { name: "Termination notice", cells: [cell("n", "90 days", "…by written notice at least ninety (90) days before the end of the then-current term.", ATLAS), cell("y", "30 days", "Either party may terminate for convenience on thirty (30) days’ written notice.", NORTHWIND), cell("m", "60 days")] },
        { name: "Liability cap", cells: [cell("y", "12 months’ fees"), cell("n", "6 months’ fees"), cell("y", "12 months’ fees")] },
        { name: "SLA credits", cells: [cell("y", "Up to 10% of monthly fee"), cell("q", "Not stated"), cell("m", "Up to 5% of monthly fee")] },
        { name: "EU data residency", cells: [cell("y", "Yes — Frankfurt"), cell("y", "Yes — Dublin"), cell("q", null)] },
        { name: "Price escalation", cells: [cell("m", "CPI, capped at 4%"), cell("y", "Fixed for 2 years"), cell("n", "CPI, no cap", "Annual adjustment in line with CPI.", KESTREL)] },
      ],
    },
  },
  {
    row_count: 7,
    sources: [
      { tool: "search_documents", document: ATLAS, page: 14 },
      { tool: "query_documents", document: null, page: null },
    ],
    source_count: 2,
    lineage: null,
  },
  7,
)

function event(
  date: string,
  title: string,
  detail: string | null,
  category: string | null,
  deadline = false,
  source: { document: string | null; page: number | null; excerpt: string | null } | null = null,
) {
  return { date, title, detail, category, deadline, source }
}

/** Atlas contract history and what's next: 9 events, server-sorted, one deadline (sketch 4A). */
export const timelineAtlas = base(
  "a_tl9e4v2n6b",
  "timeline 1",
  "timeline",
  {
    title: "Atlas Logistics contract — history and what’s next",
    timeline: {
      events: [
        event("2023-03-14", "MSA signed", "Three-year master services agreement for EU freight.", "Contract", false, {
          document: ATLAS,
          page: 1,
          excerpt: "This Master Services Agreement is entered into on 14 March 2023.",
        }),
        event("2023-04-01", "Services start", "First shipments under the agreement.", "Contract"),
        event("2024-02-09", "Amendment 1 — price +3.5%", "Fuel surcharge folded into the base rate.", "Price"),
        event("2024-11-20", "SLA breach notice", "Three missed delivery windows in October.", "SLA"),
        event("2025-01-15", "Service credits applied — $18.4K", "Credited against the January invoice.", "SLA"),
        event("2025-04-01", "Annual CPI uplift +2.9%", "Within the 4% cap.", "Price"),
        event("2026-04-01", "Annual CPI uplift +3.1%", "Within the 4% cap.", "Price"),
        event("2026-12-31", "Non-renewal notice deadline", "Last day to give 90 days’ notice before the term ends.", "Contract", true, {
          document: ATLAS,
          page: null,
          excerpt: "Either party may give notice of non-renewal at least ninety (90) days before the end of the term.",
        }),
        event("2027-03-31", "Initial term ends", "Renews for one year unless notice was given.", "Contract"),
      ],
    },
  },
  { row_count: 9, sources: [], source_count: 0, lineage: null },
  9,
)

/** The three encoded types, for suites that sweep every new renderer. */
export const ENCODED_VALID = [diagramInvoice, comparisonContracts, timelineAtlas] as const

export const ALL_VALID = [
  chartBar,
  chartLine,
  chartAreaStacked,
  chartScatter,
  table16,
  metricWithDelta,
  metricZeroCompare,
  chartFromFilter,
  chartRedrawn,
  noSource,
  // 292-02 — the three encoded types join once their renderers exist (Task 3).
  diagramInvoice,
  comparisonContracts,
  timelineAtlas,
] as const

/** A deep, JSON-safe clone so a test may mutate a fixture freely. */
export function clone<T>(v: T): T {
  return structuredClone(v)
}

/** An untyped record a test can corrupt in place (the guard is what types it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Mutable = Record<string, any>

/** A deep clone typed for in-place corruption. */
export function mutable(v: unknown): Mutable {
  return structuredClone(v) as Mutable
}
