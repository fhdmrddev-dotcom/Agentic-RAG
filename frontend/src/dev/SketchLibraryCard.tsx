/**
 * THROWAWAY DEV-ONLY SKETCH SURFACE — sketch 179, step 3 of the Stitch→sketch loop.
 *
 * ⚠ NOT PRODUCTION. Reachable only at `/sketch-card` via the guarded pathname branch in
 * `main.tsx` — the same escape hatch `/setup` and `/invite` use, but gated at the root
 * rather than inside `App()`, because an early return there would skip the hooks below it
 * and because this surface must not depend on App's backend setup probe (this app has no
 * url router, SEED-185). Delete this file and that branch in one commit when the sketch
 * closes; any non-`/sketch-card` visit is byte-identical to before.
 *
 * WHY IT EXISTS AT ALL. `SEED-155` cost this project four complaints and three phases
 * because an approved sketch hand-drew a card the shipped components structurally could not
 * render. So variant A here is the REAL `WorkflowCard`, mounted with REAL fixtures and the
 * REAL `resolveIdentity`, and every proposed variant is typed against the REAL `LibraryRow`.
 * A proposal that needs a field we do not have therefore fails `tsc`, not review.
 *
 * THE ONE FIELD THAT DID NOT EXIST YET was declared in `ProposedRunFacts` below and marked as
 * owed. ⚠ IT SHIPPED IN PHASE 192.2 and that declaration is gone; every field on screen is now
 * data the library really carries. See the ⚠ block above `SketchRow`.
 */
import { useState } from "react"
import { WorkflowCard } from "@/components/workflows/library/WorkflowCard"
import {
  buildIdentityIndex,
  resolveIdentity,
} from "@/components/workflows/library/rowIdentity"
import type { LibraryRow } from "@/components/workflows/library/libraryRow"
import {
  FIXTURE_NOW,
  libraryRowOf,
} from "@/components/workflows/library/__fixtures__/libraryScale"

const DAY = 24 * 60 * 60 * 1000

/**
 * ⚠ THE OWED WIRE ADDITION. `workflow_runs` holds the data (228 rows live; 186 completed,
 * 31 failed, 11 cancelled) and 32 of 36 published definitions have at least one run — but
 * the library feeds do not join it, so `LibraryRow` carries no run facts at all today.
 * A LEFT JOIN LATERAL on `workflow_runs` + two keys on `PublishedWorkflow` /
 * `WorkflowDraftRow` is the whole backend half. Measured, not assumed.
 *
 * ⚠ SHIPPED IN PHASE 192.2 (plans 03 + 04), AND THE PARAGRAPH ABOVE IS KEPT RATHER THAN
 * REWRITTEN so the forecast can be read beside what landed. `LibraryRow` now carries
 * `lastRunAt` / `lastRunStatus` for real — as ISO-8601 STRINGS and a RAW status, not the epoch
 * milliseconds and the closed three-value union this mockup guessed. `ProposedRunFacts` is
 * therefore GONE and `SketchRow` is now plainly `LibraryRow` — which is the outcome this file's
 * own header asks for: *"a proposal that needs a field we do not have fails `tsc`, not review"*,
 * and the field now exists. The rendered pixels are unchanged: the three timestamps are the same
 * instants, written as the strings the wire really carries and read back through `runMs`.
 *
 * ⚠ AND `runWords` BELOW IS THE T-13 DEFECT, IN THE APPROVED MOCKUP ITSELF. Its comment claims
 * "its own three-armed unknown" and its code has TWO arms plus a `Never run` catch-all — so an
 * unrecognised status, and a feed that carries no run keys at all, both render as *never run*
 * about a workflow that may have run a hundred times. `library/runFacts.ts` deliberately does
 * NOT copy that fallback; it is where the three arms actually exist.
 */
type SketchRow = LibraryRow

/** The measured worst case: 41 distinct workflows sharing ONE name. */
const ROWS: SketchRow[] = [
  {
    ...libraryRowOf({
      id: "a",
      slug: "compliance-gap-report",
      name: "Compliance Gap Report",
      version: 2,
      updatedAt: new Date(FIXTURE_NOW - 2 * DAY).toISOString(),
    }),
    lastRunAt: new Date(FIXTURE_NOW - 2 * DAY).toISOString(),
    lastRunStatus: "completed",
  },
  {
    ...libraryRowOf({
      id: "b",
      slug: "compliance-gap-report-2",
      name: "Compliance Gap Report",
      version: 1,
      updatedAt: new Date(FIXTURE_NOW - 40 * DAY).toISOString(),
    }),
    lastRunAt: new Date(FIXTURE_NOW - 31 * DAY).toISOString(),
    lastRunStatus: "failed",
  },
  {
    ...libraryRowOf({
      id: "c",
      slug: "compliance-gap-report-3",
      name: "Compliance Gap Report",
      version: 1,
      provenance: "draft",
      updatedAt: new Date(FIXTURE_NOW - 9 * DAY).toISOString(),
    }),
    lastRunAt: null,
    lastRunStatus: null,
  },
  {
    ...libraryRowOf({
      id: "d",
      slug: "weekly-status-report",
      name: "Weekly Status Report",
      version: 4,
      updatedAt: new Date(FIXTURE_NOW - 1 * DAY).toISOString(),
    }),
    lastRunAt: new Date(FIXTURE_NOW - 4 * 60 * 60 * 1000).toISOString(),
    lastRunStatus: "completed",
  },
]

const INDEX = buildIdentityIndex(ROWS)
const noop = () => {}

/**
 * The shipped `lastRunAt` is an ISO-8601 STRING (`libraryRow.ts`), and `relTime` below measures
 * epoch milliseconds. This is the one-line bridge, and it is deliberately NOT a second date
 * parser: `null` and `undefined` both mean "no instant", and `Date.parse` of anything
 * unreadable yields `NaN`, which `relTime` already handles the way line 147 handles it.
 */
function runMs(at: string | null | undefined): number | null {
  return at == null ? null : Date.parse(at)
}

function relTime(ms: number | null | undefined): string | null {
  if (ms == null) return null
  const d = FIXTURE_NOW - ms
  if (d < 60 * 60 * 1000) return `${Math.max(1, Math.round(d / 60000))}m ago`
  if (d < DAY) return `${Math.round(d / 3600000)}h ago`
  return `${Math.round(d / DAY)}d ago`
}

/** The business vocabulary. System words (`published`/`draft`) never reach the user. */
function stateWords(row: SketchRow): { word: string; tone: string } {
  if (row.provenance === "starter") return { word: "Starter", tone: "text-[#895AF6]" }
  if (row.provenance === "draft") return { word: "Still building", tone: "text-[#F5A524]" }
  return { word: "Ready to run", tone: "text-[#21C45D]" }
}

/** The run truth, in words, with its own three-armed unknown. */
function runWords(row: SketchRow): { word: string; tone: string } {
  if (row.lastRunStatus === "failed")
    return { word: `Failed ${relTime(runMs(row.lastRunAt))}`, tone: "text-[#DC2626]" }
  if (row.lastRunStatus === "cancelled")
    return { word: `Stopped ${relTime(runMs(row.lastRunAt))}`, tone: "text-[#9AA3B5]" }
  if (row.lastRunStatus === "completed")
    return { word: `Worked ${relTime(runMs(row.lastRunAt))}`, tone: "text-[#21C45D]" }
  return { word: "Never run", tone: "text-[#6B7383]" }
}

/** VARIANT B — run-led. The run truth is the headline; the name defers to line two. */
function RunLedCard({ row }: { row: SketchRow }) {
  const run = runWords(row)
  const st = stateWords(row)
  return (
    <div className="rounded-[14px] border border-[#212631] bg-[#0D1117] p-4">
      <div className={`text-sm font-semibold ${run.tone}`}>{run.word}</div>
      <div className="mt-1 truncate text-[15px] text-[#F4F6FE]">{row.name}</div>
      <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-[#6B7383]">
        <span className={st.tone}>{st.word}</span>
        <span aria-hidden="true">·</span>
        <span>v{row.version}</span>
        <span aria-hidden="true">·</span>
        <span>changed {relTime(Date.parse(row.updatedAt ?? "")) ?? "unknown"}</span>
      </div>
    </div>
  )
}

/** VARIANT C — triage board. Outcome is a mark in the gutter; the library reads as health. */
function TriageCard({ row }: { row: SketchRow }) {
  const run = runWords(row)
  const st = stateWords(row)
  const bar =
    row.lastRunStatus === "failed"
      ? "bg-[#DC2626]"
      : row.lastRunStatus === "completed"
        ? "bg-[#21C45D]"
        : "bg-[#212631]"
  return (
    <div className="flex gap-3 rounded-[14px] border border-[#212631] bg-[#0D1117] p-4">
      <div className={`w-[3px] flex-none rounded-full ${bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] text-[#F4F6FE]">{row.name}</span>
          <span className="flex-none font-mono text-[11px] text-[#6B7383]">v{row.version}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[12px]">
          <span className={run.tone}>{run.word}</span>
          <span aria-hidden="true" className="text-[#212631]">
            |
          </span>
          <span className={st.tone}>{st.word}</span>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { id: "A", label: "A · Today (the real component)" },
  { id: "B", label: "B · Run-led" },
  { id: "C", label: "★ C · Triage board (winner)" },
] as const

export function SketchLibraryCard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("A")
  return (
    <div className="min-h-screen bg-[#060A0F] p-10 text-[#F4F6FE]">
      <div className="mx-auto max-w-[900px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#6B7383]">
          Sketch 179 · dev-only · /sketch-card
        </div>
        <h1 className="mt-2 text-2xl font-semibold">What the eye lands on, honestly</h1>
        <p className="mt-2 max-w-[68ch] text-sm text-[#9AA3B5]">
          Four rows. Three share one name — the measured worst case (41 distinct workflows
          named “Compliance Gap Report”). Variant A is the <b>real shipped component</b>,
          mounted with real fixtures and real identity resolution. B and C are proposals,
          typed against the real <code>LibraryRow</code>.
        </p>
        <div className="mt-4 rounded-[10px] border border-[#F5A524]/35 bg-[#F5A524]/10 p-3 text-[13px] text-[#9AA3B5]">
          ⚠ <b className="text-[#F5A524]">One owed field.</b> B and C lead with last-run +
          outcome, which the library feed does <b>not</b> carry today. The data exists
          (228 runs; 32 of 36 published rows have one) — it needs a join, not a migration.
        </div>

        <div className="mt-8 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-[8px] px-3 py-1.5 text-[13px] ${
                tab === t.id
                  ? "bg-[#A3A5FF] text-[#060A0F]"
                  : "border border-[#212631] text-[#9AA3B5]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          {ROWS.map((row) => {
            if (tab === "A") {
              return (
                <WorkflowCard
                  key={row.id}
                  row={row}
                  identity={resolveIdentity(INDEX, row, FIXTURE_NOW)}
                  onRun={noop}
                  onOpen={noop}
                  onForkNewVersion={noop}
                  onForkStarter={noop}
                  onDeleted={noop}
                />
              )
            }
            return tab === "B" ? (
              <RunLedCard key={row.id} row={row} />
            ) : (
              <TriageCard key={row.id} row={row} />
            )
          })}
        </div>
      </div>
    </div>
  )
}
