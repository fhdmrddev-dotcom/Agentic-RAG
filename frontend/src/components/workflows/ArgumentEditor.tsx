/**
 * Phase 214-07 Task 2 (STEP-01 / STEP-02 / SC#1 / SC#2) — WHAT THIS STEP SENDS.
 *
 * ── WHAT THIS REPLACES, AND WHY NOTHING STANDS IN ITS PLACE ───────────────────────────
 * Until this phase the only way to say what an `external_action` step sends was a free-form box
 * labelled with a hand-written object literal, in `McpToolPicker`. That surface is DELETED
 * in this same commit and **nothing replaces it, not even as a fallback for the awkward tools**, because a
 * box under another name is the surface SC#1 forbids, and once it exists every hard case
 * routes to it. That is exactly how the box became the only surface in the first place.
 *
 * An argument this form cannot draw is NAMED by `argumentModel.renderable` and reported to
 * the author in words. An action whose shape we do not know says so and offers re-discovery.
 * Neither state offers a raw box, and a source fence with a positive control asserts it.
 *
 * ── ⭐ D-214-22 / INVARIANT #5 · ONE GRID TEMPLATE, COMPUTED ONCE ──────────────────────
 * The gutter is a COLUMN THAT WIDENS. This component computes ONE template string and hands
 * the identical string to every row, so a sourced row and an unsourced row have the same
 * label-column offset BY CONSTRUCTION rather than by anyone remembering. ⛔ A row may never
 * compute its own — that is how a lane gets inserted for one row and the form becomes two
 * layouts on a panel this phase already paid to widen.
 *
 * ── ⚠ D-214-08 · A LEFTOVER IS SHOWN, NEVER DROPPED ───────────────────────────────────
 * A `tool_args` key the schema does not declare is surfaced with a remove control. The
 * adapter already fails closed on it (`SmtpArgumentsInvalid`), so a silent drop would hide a
 * step that is ALREADY broken, on an outbound path, in a way the author cannot see.
 *
 * ── A LEAF ────────────────────────────────────────────────────────────────────────────
 * No context, no store reference, no fetch, no route string. Every answer arrives as a prop;
 * every write leaves through `onChangeArgs` / `onChangeSources`, which the ONE child on this
 * surface holding a store reference (`ConnectionPicker`) supplies.
 *
 * ⚠ NO RUNTIME `export const` beside the component — `react-refresh/only-export-components`
 * is an ERROR on this directory, measured.
 */
import {
  ARG_LEFTOVER,
  ARG_LEFTOVER_NEXT,
  ARG_SCHEMA_UNKNOWN,
  ARG_SCHEMA_UNKNOWN_NEXT,
  ARG_SECTION_HEADING,
} from "@/components/workflows/argumentVocabulary"
import {
  deriveRows,
  type ArgumentSource,
  type UpstreamPhase,
} from "@/components/workflows/argumentModel"
import { ArgumentRow } from "./ArgumentRow"

/**
 * The two widths of the ONE gutter column. ⚠ THE COLUMN EXISTS IN BOTH — `0px` is a WIDTH,
 * not an absence, which is the entire difference between widening a lane and inserting one.
 */
const GUTTER_OFF = "0px"
const GUTTER_ON = "118px"

/** The second track is byte-identical in both modes and is spelled ONCE. */
const BODY_TRACK = "minmax(0,1fr)"

const SECTION_CLASSES = "mt-2 border-t border-border/60 pt-2"

const HEADING_CLASSES = "text-[11px] font-medium text-foreground"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

const NEXT_CLASSES =
  "mt-1 rounded border border-border bg-card px-1.5 py-0.5 text-[10.5px] text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"

const LEFTOVER_ROW_CLASSES = "mt-1.5 flex items-center justify-between gap-2"

export interface ArgumentEditorProps {
  /** The bound action's `inputSchema`, from `schema_for_bound_tool`'s client counterpart.
   *  `null` / absent is D-214-07's unknown-shape state — never an empty form. */
  schema: unknown
  toolArgs: Record<string, unknown>
  argSources: Record<string, unknown>
  /** Every step that runs before this one, in run order, named by `nodeTitle`. */
  upstreamPhases: readonly UpstreamPhase[]
  /** The capability's body field, when the bound action has one. D-214-03's pre-set target. */
  bodyArgKey?: string | null
  onChangeArgs: (args: Record<string, unknown>) => void
  onChangeSources: (sources: Record<string, unknown>) => void
  /** The EXISTING re-discovery route — `discover_connection_tools`
   *  (`backend/app/services/connector_service.py:864`, verified at execute time). No new
   *  route is needed and none is added. Absent ⇒ the next action is not offered, because a
   *  control that cannot do anything is worse than none. */
  onRediscover?: () => void
}

export function ArgumentEditor({
  schema,
  toolArgs,
  argSources,
  upstreamPhases,
  bodyArgKey,
  onChangeArgs,
  onChangeSources,
  onRediscover,
}: ArgumentEditorProps) {
  const { rows, leftovers } = deriveRows(
    schema,
    toolArgs,
    argSources,
    upstreamPhases,
    bodyArgKey,
  )

  // ⭐ ONE TEMPLATE, COMPUTED ONCE. The gutter widens when this step has any source to read;
  // it is never inserted, and every row receives this same string.
  const anySourced = rows.some((row) => row.source !== null)
  const gridColumns = `${anySourced ? GUTTER_ON : GUTTER_OFF} ${BODY_TRACK}`

  const patchSource = (key: string, patch: Record<string, unknown>) => {
    const existing = argSources[key]
    const base = typeof existing === "object" && existing !== null ? existing : {}
    onChangeSources({ ...argSources, [key]: { ...base, ...patch } })
  }

  const handleChangeSource = (key: string, source: ArgumentSource) => {
    // ⚠ THE OTHER TWO FIELDS ARE CLEARED IN THE SAME PATCH. An `ask_key` left behind on a
    // row now reading *from an earlier step* is the half-clear hazard `ConnectionPicker`'s
    // AR-05 reasoning refused, one field down.
    patchSource(key, { source, ask_key: null, upstream_slug: null })
  }

  const handleChangeValue = (key: string, value: unknown) => {
    onChangeArgs({ ...toolArgs, [key]: value })
  }

  const handleChangeAskKey = (key: string, askKey: string) => {
    patchSource(key, { source: "ask", ask_key: askKey === "" ? null : askKey })
  }

  const handleChangeUpstream = (key: string, slug: string | null) => {
    patchSource(key, { source: "upstream", upstream_slug: slug })
  }

  const handleRemoveLeftover = (key: string) => {
    const next: Record<string, unknown> = {}
    for (const name of Object.keys(toolArgs)) {
      if (name !== key) next[name] = toolArgs[name]
    }
    onChangeArgs(next)
  }

  const heading = (
    <h4 data-testid="argument-editor-heading" className={HEADING_CLASSES}>
      {ARG_SECTION_HEADING}
    </h4>
  )

  // ── D-214-07 · THE SHAPE IS NOT KNOWN ────────────────────────────────────────────────
  // ⛔ IT INVENTS NO FIELDS, and it offers no box in their place. It says the one true thing
  // and names the one action that can change it.
  if (rows.length === 0) {
    return (
      <section
        data-testid="argument-editor"
        data-arg-state="unknown-shape"
        className={SECTION_CLASSES}
      >
        {heading}
        <p data-testid="argument-editor-unknown" className={NOTE_CLASSES}>
          {ARG_SCHEMA_UNKNOWN}
        </p>
        {onRediscover !== undefined && (
          <button
            type="button"
            data-testid="argument-editor-rediscover"
            className={NEXT_CLASSES}
            onClick={onRediscover}
          >
            {ARG_SCHEMA_UNKNOWN_NEXT}
          </button>
        )}
      </section>
    )
  }

  return (
    <section
      data-testid="argument-editor"
      data-arg-state="fields"
      // A SHAPE, NEVER A WIRE ID: how many arguments and whether the gutter is open. No
      // capability id, no tool name and no slug reaches this file's DOM.
      data-arg-count={String(rows.length)}
      data-arg-gutter={anySourced ? "on" : "off"}
      className={SECTION_CLASSES}
    >
      {heading}

      {rows.map((row) => (
        <ArgumentRow
          key={row.key}
          row={row}
          upstreamPhases={upstreamPhases}
          gridColumns={gridColumns}
          onChangeSource={handleChangeSource}
          onChangeValue={handleChangeValue}
          onChangeAskKey={handleChangeAskKey}
          onChangeUpstream={handleChangeUpstream}
        />
      ))}

      {/* ── D-214-08 · THE LEFTOVERS, SHOWN AND REMOVABLE (invariant #9) ─────────────── */}
      {leftovers.map((leftover) => (
        <div
          key={leftover.key}
          data-testid="argument-leftover"
          className={LEFTOVER_ROW_CLASSES}
        >
          <p className={NOTE_CLASSES}>{ARG_LEFTOVER({ arg: leftover.key })}</p>
          <button
            type="button"
            data-testid="argument-leftover-remove"
            className={NEXT_CLASSES}
            onClick={() => handleRemoveLeftover(leftover.key)}
          >
            {ARG_LEFTOVER_NEXT}
          </button>
        </div>
      ))}
    </section>
  )
}

export default ArgumentEditor
