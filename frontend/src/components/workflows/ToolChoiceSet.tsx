/**
 * Phase 200 (the step-panel port, DES-02) — THE TOOL CHOICE SET, AND ITS ONE REVEAL.
 *
 * ── WHAT THIS IS FOR, MEASURED ──────────────────────────────────────────────────────────
 *
 * The reference sheet — `.planning/sketches/200-journey-interactive/screens/step-panel.html`
 * — draws **twelve** tool pills under `What this step can do`: two chosen, ten offered. The
 * shipped panel renders **twenty-eight**, because that is how many ids
 * `GET /workflows/grounding-bundle` offers and the shipped chip set printed every one of them
 * unconditionally. Twenty-eight pills is the "dense form" half of the operator's verdict on
 * this panel: the card that is supposed to say *what this step can do* instead says *here is
 * the whole registry*, and the two chosen tools — the only DECISION on the card — are lost
 * inside it.
 *
 * ⚠ NOTHING IS DROPPED. Every offered id is still reachable, in one click, from the same
 * card. What changes is that the person reads a sheet-sized set first.
 *
 * ── ⚠ WHAT MAY NEVER BE FOLDED, AND WHY THIS REVEAL IS ALLOWED WHEN THE CARDS' ARE NOT ──
 *
 * SEED-184 rule 3: a person may never be asked to click in order to discover a DECISION.
 * `StepCardSection.tsx` refuses a collapse for exactly that reason, so this component owes an
 * argument rather than an assertion. It is this — **the fold is over UNCHOSEN options only**,
 * and two classes are pinned open by construction:
 *
 *   1. **Every SELECTED tool.** What this step can do is the decision; it is never folded, on
 *      any count, and it renders FIRST.
 *   2. **Every UNREGISTERED tool** — one the definition names that the registry does not
 *      offer. It renders struck through and still pressable, because the server already
 *      answers `unregistered_tool` for it and hiding it would put a finding somewhere the
 *      author cannot act on while quietly editing their stored value out of sight. A finding
 *      folded behind a click is a finding met by surprise.
 *
 * What remains behind the reveal is the set of things the author has NOT chosen and the
 * registry HAS offered — a menu, not a fact. Folding a menu is what a menu is for.
 *
 * ── ⚠ WHY THE STATE LIVES HERE AND NOT IN THE PANEL — A SHIPPED FENCE, NOT A PREFERENCE ──
 *
 * `PhaseFormPanel.test.tsx` asserts an ABSOLUTE ZERO of `useState` / `useMemo` / `useEffect`
 * over the panel's own `?raw` source, and its docblock records why: *"not 'no increase' —
 * zero, because all three measured zero before this phase, and a non-decrease criterion on a
 * file that already reads 0 is a criterion that permits the first one."* A reveal is state, so
 * it lives in its own leaf and that pin passes UNEDITED — the `FieldGuidance.tsx` precedent
 * (`199-06`), created for this same reason and whose pin then passed untouched too.
 *
 * ── THE SEAM IS THE SHIPPED ONE ─────────────────────────────────────────────────────────
 *
 * `commit` takes the next id list and the caller joins it back into the comma string the
 * free-text field used, so a click still travels through exactly ONE parser. This component
 * introduces no second write path, and it is emphatically not an options SOURCE: the set an
 * author may choose FROM is `rails.toolOptions` and nothing else, because a client-assembled
 * whitelist would let knowledge-base content whitelist itself.
 */
import { useState } from "react"

import { toolName } from "./toolNames"

/**
 * How many pills the sheet draws before it stops.
 *
 * ⚠ TWELVE IS MEASURED FROM THE REFERENCE, NOT CHOSEN. `screens/step-panel.html` renders
 * exactly twelve `<button>` pills in that group — `Read a document` · `Search documents` ·
 * `Run code` · `Search a saved view` · `Write a file` · `Track its to-dos` · `Ask a person` ·
 * `Attach a skill file` · `Browse the web` · `Read related documents` · `Query tables` ·
 * `Remember something`. Those twelve are the sheet's PHRASING and do not map 1:1 onto the
 * ids the server offers, so what is ported is the SIZE of the readable set, never the list.
 *
 * ⚠ IT IS A FLOOR ON WHAT IS SHOWN, NOT A CEILING. When more than twelve tools are already
 * chosen, all of them still render — see `visible` below, where the pinned set is
 * concatenated BEFORE the budget is spent rather than truncated by it.
 */
const SHEET_VISIBLE_COUNT = 12

const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] focus:outline-none focus:ring-1 focus:ring-primary"

/** The reveal's two readings. Module scope so the words have one home, not an attribute. */
const REVEAL_MORE = (n: number) => `Show ${n} more`
const REVEAL_FEWER = "Show fewer"

export interface ToolChoiceSetProps {
  /** The ids this step already names. */
  tools: string[]
  /** The ids the SERVER offers — `rails.toolOptions`, never a client list. */
  options: string[]
  /** Commit the next id list through the caller's one comma seam. */
  commit: (next: string[]) => void
}

export function ToolChoiceSet({ tools, options, commit }: ToolChoiceSetProps) {
  const [expanded, setExpanded] = useState(false)

  const selected = new Set(tools)
  // Registry order first (the server's own ordering), then anything the definition names
  // that the registry lacks — appended rather than hidden.
  const offered = [...options, ...tools.filter((t) => !options.includes(t))]

  // ⚠ THE TWO PINNED CLASSES, ARGUED IN THE DOCBLOCK: a chosen tool is a decision and an
  // unregistered one is a finding. Neither is ever behind the reveal, at any count.
  const pinned = offered.filter((t) => selected.has(t) || !options.includes(t))
  const rest = offered.filter((t) => !pinned.includes(t))
  const budget = Math.max(0, SHEET_VISIBLE_COUNT - pinned.length)
  const shownRest = expanded ? rest : rest.slice(0, budget)
  const hiddenCount = rest.length - shownRest.length
  // Rendered in the OFFERED order, not pinned-first, so a person's eye tracks the same list
  // between the two readings and a pill does not appear to move when the reveal opens.
  const visibleSet = new Set([...pinned, ...shownRest])
  const visible = offered.filter((t) => visibleSet.has(t))

  return (
    <div
      data-rail="tools"
      data-testid="tools-rail"
      role="group"
      aria-label="What this step can do"
      className="flex flex-wrap gap-1.5"
    >
      {offered.length === 0 ? (
        <p data-testid="tools-empty" className="text-[11px] leading-snug text-muted-foreground">
          This workspace offers no tools for this step.
        </p>
      ) : (
        <>
          {visible.map((t) => {
            const on = selected.has(t)
            const unregistered = !options.includes(t)
            return (
              <button
                key={t}
                type="button"
                data-testid="tool-option"
                data-tool={t}
                data-unregistered={unregistered ? "true" : "false"}
                aria-pressed={on}
                title={unregistered ? `${t} — not in this workspace's tool registry` : t}
                onClick={() => commit(on ? tools.filter((x) => x !== t) : [...tools, t])}
                className={[
                  CHIP_BASE,
                  on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground",
                  unregistered ? "line-through" : "",
                ].join(" ")}
              >
                {toolName(t)}
              </button>
            )
          })}
          {/* The reveal renders ONLY when something is actually behind it — never a control
              that opens onto nothing, and never a "Show fewer" with nothing to fold. */}
          {(hiddenCount > 0 || expanded) && rest.length > budget && (
            <button
              type="button"
              data-testid="tools-reveal"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              // ⚠ THE 184-11 TRAP, one control over. The panel's persist seam is a field's
              // `onBlur`, so a press here would blur whatever field had focus and silently
              // PATCH a version. Asking to SEE the rest of a menu is not an edit.
              onMouseDown={(event) => event.preventDefault()}
              className={[CHIP_BASE, "border-dashed border-border bg-transparent text-muted-foreground hover:text-foreground"].join(" ")}
            >
              {expanded ? REVEAL_FEWER : REVEAL_MORE(hiddenCount)}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default ToolChoiceSet
