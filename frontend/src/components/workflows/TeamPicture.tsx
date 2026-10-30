/**
 * Phase 290-03 (VIS-01, D-06 .. D-16) — THE TEAM PICTURE, READ-ONLY, DRAWN FROM THE DEFINITION.
 *
 * `TeamPicture` renders exactly what `teamModel.deriveTeam` returns: the orchestrator on top,
 * the steps in run order, each step's gates nested under it, and one SVG path per
 * `lines[]` item. It adds no line of its own, so the SC#3 rule ("steps never pass work to
 * each other") holds here by construction: the only step-to-step path is a `jump`, and the
 * derivation emits one only for a resolvable `skip_to_phase`.
 *
 * `TeamViewSwitch` is the `Steps | Team` tablist the canvas header mounts (D-06). It is the
 * picture's ONE entry point and it lives here, beside the picture, so the hot canvas file
 * spends one mount on it rather than owning its markup.
 *
 * ── RULES THIS FILE KEEPS ─────────────────────────────────────────────────────────────────
 *  - **Never a second canvas (D-06).** No React Flow, no drag, no pan, no selection. No node
 *    is a button, a link or a tab stop; the picture is something you read.
 *  - **Reads only what the builder holds (D-07).** No API client import: the phases arrive as
 *    a prop, unsaved edits included, and nothing is written back.
 *  - **Author text is text (T-290-10).** Titles, criteria, kinds, sources and the workflow
 *    name render as JSX text or attribute values, never as HTML. Both are fenced in the
 *    suite over this file's raw source.
 *  - **Absence is said once, in words (D-12, D-13).** No empty card or slot stands in for a
 *    missing judge or check.
 *  - **Theme tokens only.** Light and dark both read from the CSS variables; no literal colour.
 *
 * Line geometry is measured after layout from the rendered node boxes and recomputed on
 * resize. With no layout (jsdom) every path still renders, with a degenerate `d`, so the
 * line SET is always testable even where the geometry is not.
 */
import { createElement, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"

import { phaseGlyph } from "@/lib/phaseGlyph"
import type { NameContext, PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { deriveTeam, type TeamGate, type TeamLine, type TeamLineKind, type TeamModel, type TeamStep } from "./teamModel"
import {
  FAIL_LEAD,
  GATE_CHECK,
  GATE_JUDGE,
  JUMP_LINE_LABEL,
  LEDGER_HEADING,
  LEDGER_NO_LINKS,
  ORCHESTRATOR_EYEBROW,
  ORCHESTRATOR_SUB,
  ORCHESTRATOR_SUB_ONE,
  TEAM_CAPTION,
  TEAM_EMPTY_BODY,
  TEAM_EMPTY_HEADING,
  TEAM_NO_GATES,
  TEAM_NO_JUDGE,
  TEAM_ONE_STEP,
  TEAM_SWITCH_LABEL,
  TEAM_SWITCH_STEPS,
  TEAM_SWITCH_TEAM,
  gateEyebrow,
  ledgerGate,
  ledgerHandoff,
  ledgerJump,
  ledgerSeats,
  orchestratorTitle,
  seatsLabel,
  teamFigureLabel,
  TEAM_SCROLL_REGION_LABEL,
} from "./teamVocabulary"

// ── the Steps | Team switch (D-06) ────────────────────────────────────────────────────────

export type TeamView = "steps" | "team"

const SWITCH_TAB = "rounded-md px-3 py-1.5 text-[13px] transition-colors"
const SWITCH_ON = "bg-primary/10 font-semibold text-primary"
const SWITCH_OFF = "text-muted-foreground hover:bg-accent/40 hover:text-foreground"

/**
 * 296-07 (290-IN-04) — the tablist's ids. Both tabs control ONE panel id: whichever view is
 * showing carries it (`teamViewPanelProps`), labelled by the selected tab. A builder renders one
 * canvas, so fixed ids are unique on the page.
 */
const TEAM_VIEW_PANEL_ID = "canvas-view-panel"
const TAB_ORDER: readonly TeamView[] = ["steps", "team"]
export const teamViewTabId = (view: TeamView): string => `canvas-view-tab-${view}`

/** The `role="tabpanel"` attributes for the container of `view`. */
export function teamViewPanelProps(view: TeamView) {
  return { role: "tabpanel", id: TEAM_VIEW_PANEL_ID, "aria-labelledby": teamViewTabId(view) } as const
}

/** The house segmented control (`builder-view-toggle`), worded, no glyph. 296-07 (290-IN-04):
 *  roving tabindex, ArrowLeft / ArrowRight (automatic activation), Home / End. */
export function TeamViewSwitch({
  view,
  onChange,
}: {
  view: TeamView
  onChange: (next: TeamView) => void
}) {
  const go = (next: TeamView) => {
    onChange(next)
    document.getElementById(teamViewTabId(next))?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: TeamView) => {
    const at = TAB_ORDER.indexOf(value)
    const last = TAB_ORDER.length - 1
    let next: TeamView | null = null
    if (event.key === "ArrowRight") next = TAB_ORDER[at === last ? 0 : at + 1]
    else if (event.key === "ArrowLeft") next = TAB_ORDER[at === 0 ? last : at - 1]
    else if (event.key === "Home") next = TAB_ORDER[0]
    else if (event.key === "End") next = TAB_ORDER[last]
    if (next === null) return
    event.preventDefault()
    go(next)
  }
  const tab = (value: TeamView, label: string, testId: string) => (
    <button
      type="button"
      role="tab"
      id={teamViewTabId(value)}
      aria-selected={view === value}
      aria-controls={TEAM_VIEW_PANEL_ID}
      tabIndex={view === value ? 0 : -1}
      data-testid={testId}
      onClick={() => onChange(value)}
      onKeyDown={(event) => onKeyDown(event, value)}
      className={[
        SWITCH_TAB,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        view === value ? SWITCH_ON : SWITCH_OFF,
      ].join(" ")}
    >
      {label}
    </button>
  )
  return (
    <div role="tablist" aria-label={TEAM_SWITCH_LABEL} className="flex items-center gap-1">
      {tab("steps", TEAM_SWITCH_STEPS, "canvas-view-steps")}
      {tab("team", TEAM_SWITCH_TEAM, "canvas-view-team")}
    </div>
  )
}

// ── line styles (UI-SPEC Color) ───────────────────────────────────────────────────────────

const LINE_STYLE: Record<TeamLineKind, { className: string; dash?: string; width: number }> = {
  handoff: { className: "stroke-primary/45", width: 1.4 },
  judge: { className: "stroke-accent-violet", dash: "2 4", width: 1.6 },
  check: { className: "stroke-muted-foreground/70", dash: "2 4", width: 1.3 },
  jump: { className: "stroke-warning", dash: "6 5", width: 1.6 },
}

/** Handoff bus drop below the orchestrator, and the jump run below the lowest gate. */
const BUS_DROP = 28
const JUMP_DROP = 32
const STEP_MIN = 128
const STEP_GAP = 16
const ORCHESTRATOR_WIDTH = 300

/*
 * ── LINES NEVER RUN BEHIND A CARD THEY DO NOT JOIN (290 WR-03, WR-04) ──────────────────────
 * The cards are translucent, so a line drawn behind one shows through and reads as a link.
 *  - A gate line leaves its card's LEFT edge into a rail inside the column's left indent
 *    (the gate list is indented `GATE_INDENT`), then runs up to its step's bottom. Each gate
 *    in a step has its own rail, and a later gate's rail sits further out, so it never
 *    touches an earlier gate's stub or card.
 *  - A jump leaves its check's RIGHT edge into the column gutter, runs down to its own LANE
 *    below the lowest gate, across, up the target column's gutter and into the target
 *    step's right edge. Each jump has its own lane (y) and gutter offset (x), so two jumps
 *    never share a segment, and each label sits on its own lane.
 */
const GATE_INDENT = 16
/** Rail x range inside the indent, measured from the step's left edge: outermost, innermost. */
const RAIL_OUTER = 4
const RAIL_INNER = 13
const RAIL_STEP = 3
/** Gutter offsets past a column's right edge, cycled by lane; the gutter is `STEP_GAP` wide. */
const JUMP_GUTTER = [4, 8, 12] as const
/** Vertical distance between two jump lanes; it clears the 11px label under each lane. */
const LANE_GAP = 22
/** The step row's bottom padding with one jump lane (`pb-14`); each extra lane adds `LANE_GAP`. */
const JUMP_PAD = 56

interface Box {
  top: number
  bottom: number
  left: number
  right: number
  cx: number
  cy: number
}

interface LabelBox {
  left: number
  top: number
  width: number
}

interface Geometry {
  d: string[]
  labels: Record<number, LabelBox>
}

const DEGENERATE = "M0 0"

/** A gate's place in its step's list, and how many gates that step has. */
interface Rank {
  k: number
  of: number
}

/** The rail x for gate `k` of `of`, from its step's left edge: later gates sit further out. */
function railX(stepLeft: number, { k, of }: Rank): number {
  const step = of > 1 ? Math.min(RAIL_STEP, (RAIL_INNER - RAIL_OUTER) / (of - 1)) : 0
  return stepLeft + RAIL_INNER - k * step
}

/** One `d` per line, from the measured node boxes. A missing box yields the degenerate path. */
function layoutLines(
  lines: readonly TeamLine[],
  box: (id: string) => Box | null,
  rankOf: (gateId: string) => Rank,
  lowestGate: number,
): Geometry {
  const d: string[] = []
  const labels: Record<number, LabelBox> = {}
  let lane = 0
  lines.forEach((line, i) => {
    const from = box(line.from)
    const to = box(line.to)
    if (line.kind === "jump") lane += 1
    if (from === null || to === null) {
      d.push(DEGENERATE)
      return
    }
    if (line.kind === "handoff") {
      d.push(`M${from.cx} ${from.bottom} V${from.bottom + BUS_DROP} H${to.cx} V${to.top}`)
    } else if (line.kind === "jump") {
      const own = lane - 1
      const off = JUMP_GUTTER[own % JUMP_GUTTER.length]
      const y = lowestGate + JUMP_DROP + own * LANE_GAP
      const sx = from.right + off
      const tx = to.right + off
      d.push(`M${from.right} ${from.cy} H${sx} V${y} H${tx} V${to.cy} H${to.right}`)
      labels[i] = { left: Math.min(sx, tx), top: y + 4, width: Math.abs(tx - sx) }
    } else {
      const x = railX(to.left, rankOf(line.from))
      d.push(`M${from.left} ${from.cy} H${x} V${to.bottom}`)
    }
  })
  return { d, labels }
}

const sameGeometry = (a: Geometry, b: Geometry) => JSON.stringify(a) === JSON.stringify(b)

// ── node faces ────────────────────────────────────────────────────────────────────────────

function stepNodeClass(phaseType: string): string {
  const base = "rounded-lg border px-3 py-2"
  if (phaseType === "programmatic") return `${base} border-border bg-muted/40`
  if (phaseType === "llm_human_input") return `${base} border-warning/45 bg-warning/10`
  return `${base} border-border bg-card`
}

function StepNode({ step, showTechnical }: { step: TeamStep; showTechnical: boolean }) {
  const Glyph = phaseGlyph(step.phaseType)
  return (
    <div data-team-node={step.id} className={stepNodeClass(step.phaseType)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
          {step.number}
        </span>
        {Glyph && createElement(Glyph, { className: "h-6 w-6 flex-none", "aria-hidden": true })}
      </div>
      <p data-testid="team-step-title" className="mt-1 line-clamp-2 text-[13px] font-semibold leading-[1.3] text-foreground">
        {step.title}
      </p>
      <p data-testid="team-step-role" className="mt-0.5 text-[11px] leading-[1.4] text-muted-foreground">
        {showTechnical ? step.technical : step.role}
      </p>
      {step.seats !== null ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {Array.from({ length: step.seatDots }, (_, k) => (
            <span
              key={k}
              data-testid="team-seat-dot"
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-primary/55 bg-primary/15"
            />
          ))}
          <span className="ml-1 text-[11px] text-muted-foreground">{seatsLabel(step.seats)}</span>
        </div>
      ) : null}
    </div>
  )
}

function GateCard({ gate, showTechnical }: { gate: TeamGate; showTechnical: boolean }) {
  const tone = gate.judge ? "border-accent-violet/55 bg-accent-violet/10" : "border-border bg-muted/40"
  return (
    <li
      data-testid="team-gate"
      data-team-node={gate.id}
      data-gate-kind={gate.judge ? "judge" : "check"}
      className={`rounded-md border px-3 py-2 text-[11px] leading-[1.4] ${tone}`}
    >
      <p
        data-testid="team-gate-eyebrow"
        className={[
          "font-mono text-[10px] uppercase tracking-wider",
          gate.judge ? "text-accent-violet-text" : "text-muted-foreground",
        ].join(" ")}
      >
        {gateEyebrow(gate.judge ? GATE_JUDGE : GATE_CHECK, gate.stepNumber)}
      </p>
      <p data-testid="team-gate-words" className="mt-0.5 text-foreground">
        {showTechnical ? gate.kind || gate.words : gate.words}
      </p>
      {gate.criteria !== null && !showTechnical ? (
        <p data-testid="team-gate-criteria" className="mt-0.5 line-clamp-3 text-muted-foreground">
          {`“${gate.criteria}”`}
        </p>
      ) : null}
      {gate.failure !== null ? (
        <p
          data-testid="team-gate-failure"
          className={["mt-0.5", gate.jumpTo !== null ? "text-warning" : "text-muted-foreground"].join(" ")}
        >
          {`${FAIL_LEAD} ${gate.failure}`}
        </p>
      ) : null}
    </li>
  )
}

// ── the ⌥ ledger (D-15) ───────────────────────────────────────────────────────────────────

function lineWords(line: TeamLine, numberOf: ReadonlyMap<string, number>): string {
  const n = (id: string) => numberOf.get(id) ?? 0
  if (line.kind === "handoff") return ledgerHandoff(n(line.to))
  if (line.kind === "jump") return ledgerJump(n(line.from), n(line.to))
  return ledgerGate(line.kind === "judge" ? GATE_JUDGE : GATE_CHECK, n(line.to))
}

function StrokeSample({ kind }: { kind: TeamLineKind }) {
  const style = LINE_STYLE[kind]
  return (
    <svg aria-hidden="true" width={32} height={8} className="flex-none">
      <line
        x1={0}
        y1={4}
        x2={32}
        y2={4}
        fill="none"
        className={style.className}
        strokeWidth={style.width}
        strokeDasharray={style.dash}
      />
    </svg>
  )
}

function Ledger({ model }: { model: TeamModel }) {
  const numberOf = new Map<string, number>()
  for (const s of model.steps) numberOf.set(s.id, s.number)
  for (const g of model.gates) numberOf.set(g.id, g.stepNumber)
  const batch = model.steps.filter((s) => s.seats !== null)
  return (
    <div data-testid="team-ledger" className="mt-4 rounded-md border border-border/60 px-3 py-2">
      <p
        data-testid="team-ledger-heading"
        className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        {LEDGER_HEADING}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {model.lines.map((line, i) => (
          <li key={i} data-testid="team-ledger-row" className="flex items-center gap-2 text-[11px]">
            <StrokeSample kind={line.kind} />
            <span className="text-foreground">{lineWords(line, numberOf)}</span>
            <span data-testid="team-ledger-source" className="font-mono text-[10px] text-muted-foreground">
              {line.source}
            </span>
          </li>
        ))}
      </ul>
      {batch.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {batch.map((s) => (
            <li key={s.id} data-testid="team-ledger-seat" className="flex items-center gap-2 text-[11px]">
              <span data-testid="team-ledger-seat-words" className="text-foreground">
                {ledgerSeats(s.number, s.seats ?? 0)}
              </span>
              <span data-testid="team-ledger-source" className="font-mono text-[10px] text-muted-foreground">
                {s.seatSource}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">{LEDGER_NO_LINKS}</p>
    </div>
  )
}

// ── the picture ───────────────────────────────────────────────────────────────────────────

export interface TeamPictureProps {
  phases: readonly PhaseSpecJSON[]
  kbTools?: readonly string[]
  nameContext?: NameContext
  showTechnical: boolean
  workflowName: string
}

export function TeamPicture({ phases, kbTools, nameContext, showTechnical, workflowName }: TeamPictureProps) {
  const model = useMemo(() => deriveTeam(phases, kbTools, nameContext), [phases, kbTools, nameContext])
  const innerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<Map<string, HTMLElement>>(new Map())
  const [geometry, setGeometry] = useState<Geometry>({ d: [], labels: {} })

  useLayoutEffect(() => {
    const root = innerRef.current
    if (root === null) return
    const measure = () => {
      const nodes = nodesRef.current
      nodes.clear()
      root.querySelectorAll<HTMLElement>("[data-team-node]").forEach((el) => {
        const id = el.dataset.teamNode
        if (id) nodes.set(id, el)
      })
      const base = root.getBoundingClientRect()
      const box = (id: string): Box | null => {
        const el = nodes.get(id)
        if (!el) return null
        const r = el.getBoundingClientRect()
        const top = r.top - base.top
        const left = r.left - base.left
        return {
          top,
          bottom: r.bottom - base.top,
          left,
          right: r.right - base.left,
          cx: left + r.width / 2,
          cy: top + r.height / 2,
        }
      }
      let lowestGate = 0
      const ranks = new Map<string, Rank>()
      for (const g of model.gates) {
        const b = box(g.id)
        if (b !== null) lowestGate = Math.max(lowestGate, b.bottom)
        const siblings = model.gates.filter((s) => s.stepId === g.stepId)
        ranks.set(g.id, { k: siblings.indexOf(g), of: siblings.length })
      }
      const rankOf = (id: string): Rank => ranks.get(id) ?? { k: 0, of: 1 }
      const next = layoutLines(model.lines, box, rankOf, lowestGate)
      setGeometry((prev) => (sameGeometry(prev, next) ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measure())
    observer.observe(root)
    return () => observer.disconnect()
  }, [model, showTechnical])

  const n = model.steps.length
  const plane =
    "h-full min-w-0 overflow-x-auto bg-background px-6 pb-[72px] pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  // 296-07 (290-IN-05) — a scroll REGION a keyboard can reach (Safari does not focus scroll
  // containers by itself). It holds no interactive node (D-06); it is only something to scroll.
  // 302-02 (FE-IN-06 / D-11): named apart from the figure inside it, so neither name is said twice.
  const region = { tabIndex: 0, role: "region", "aria-label": TEAM_SCROLL_REGION_LABEL } as const

  if (n === 0) {
    return (
      <div {...teamViewPanelProps("team")} className="min-h-0 flex-1">
        <div data-testid="team-plane" {...region} className={`${plane} flex flex-col items-center justify-center text-center`}>
          <p className="text-[13px] font-semibold text-foreground">{TEAM_EMPTY_HEADING}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{TEAM_EMPTY_BODY}</p>
        </div>
      </div>
    )
  }

  const gatesOf = (stepId: string) => model.gates.filter((g) => g.stepId === stepId)
  const jumps = model.lines.filter((l) => l.kind === "jump").length
  const minWidth = Math.max(ORCHESTRATOR_WIDTH, n * STEP_MIN + (n - 1) * STEP_GAP)

  return (
    <div {...teamViewPanelProps("team")} className="min-h-0 flex-1">
    <div data-testid="team-plane" {...region} className={plane}>
      <figure aria-label={teamFigureLabel(workflowName)} className="m-0">
        <div ref={innerRef} className="relative" style={{ minWidth }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {model.lines.map((line, i) => {
              const style = LINE_STYLE[line.kind]
              return (
                <path
                  key={i}
                  data-testid="team-line"
                  data-line-kind={line.kind}
                  data-line-source={line.source}
                  data-line-from={line.from}
                  data-line-to={line.to}
                  d={geometry.d[i] ?? DEGENERATE}
                  fill="none"
                  className={style.className}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                />
              )
            })}
          </svg>
          {model.lines.map((line, i) => {
            if (line.kind !== "jump") return null
            const at = geometry.labels[i] ?? { left: 0, top: 0, width: 0 }
            return (
              <span
                key={`jump-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute text-center text-[11px] text-warning"
                style={{ left: at.left, top: at.top, width: at.width }}
              >
                {JUMP_LINE_LABEL}
              </span>
            )
          })}

          <p
            data-testid="team-orchestrator"
            data-team-node="orchestrator"
            className="relative mx-auto w-[300px] rounded-lg border border-primary/45 bg-primary/10 px-3 py-2"
          >
            <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {ORCHESTRATOR_EYEBROW}
            </span>
            <span className="mt-0.5 line-clamp-3 block text-[13px] font-semibold leading-[1.3] text-foreground">
              {orchestratorTitle(n)}
            </span>
            <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
              {model.oneStep ? ORCHESTRATOR_SUB_ONE : ORCHESTRATOR_SUB}
            </span>
          </p>

          <ol
            className="relative mt-14 grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${n}, minmax(${STEP_MIN}px, 1fr))`,
              // One lane per jump (WR-04): the first takes `pb-14`, each further one a lane gap.
              paddingBottom: jumps > 0 ? JUMP_PAD + (jumps - 1) * LANE_GAP : undefined,
            }}
          >
            {model.steps.map((step) => {
              const gates = gatesOf(step.id)
              return (
                <li key={step.id} data-testid="team-step" data-step-number={step.number} className="min-w-0">
                  <StepNode step={step} showTechnical={showTechnical} />
                  {gates.length > 0 ? (
                    <ul className="mt-8 flex flex-col gap-2" style={{ marginLeft: GATE_INDENT }}>
                      {gates.map((g) => (
                        <GateCard key={g.id} gate={g} showTechnical={showTechnical} />
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>

          {model.oneStep ? (
            <p className="relative mt-3 text-center text-[12px] text-muted-foreground">{TEAM_ONE_STEP}</p>
          ) : null}
          {model.absence === "none" || model.absence === "noJudge" ? (
            <p data-testid="team-absence" className="relative mt-3 text-center text-[11px] italic text-muted-foreground">
              {model.absence === "none" ? TEAM_NO_GATES : TEAM_NO_JUDGE}
            </p>
          ) : null}
        </div>
        <figcaption
          data-testid="team-caption"
          className="mt-6 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground"
        >
          {TEAM_CAPTION}
        </figcaption>
      </figure>
      {showTechnical ? <Ledger model={model} /> : null}
    </div>
    </div>
  )
}
