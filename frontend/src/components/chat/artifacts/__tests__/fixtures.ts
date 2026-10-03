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
  component: "chart" | "table" | "metric",
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
] as const

/** A deep, JSON-safe clone so a test may mutate a fixture freely. */
export function clone<T>(v: T): T {
  return structuredClone(v)
}
