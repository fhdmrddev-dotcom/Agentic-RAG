/**
 * Phase 187-26 Task 1 (VOCAB-02 / VOCAB-03 · GAP A) — DescribeKbPicker.
 *
 * THE ONE PLACE THE LOOSE DOOR CAN SAY WHAT THIS WORK IS ABOUT, BEFORE THE AI DRAFTS.
 *
 * ── Why this file exists ──
 * D-187-11 reads an unbound retrieval workflow as *"the author has not yet said what this
 * is about"* — a state worth surfacing rather than forbidding. That reading is only honest
 * if the author was ASKED. On the "Describe & run" door they never were: the door had no
 * knowledge-base control at all, so every workflow born on the fast path was unbound, so
 * `unbound_retrieval` fired on any retrieval step and Publish was disabled out of the gate
 * for a reason the author was never given a chance to prevent. This component is the
 * somewhere-to-say-it.
 *
 * ── It is a CONTROL, never a GATE ──
 * Nothing about the door's CTA enablement passes through here. An author who ignores this
 * gets today's behaviour exactly, and the `unbound_retrieval` verdict then means what
 * D-187-11 says it means. The picker holds no `required`, no `disabled`, no validity
 * marking, and its own suite asserts all three as a property of the rendered tree.
 *
 * ── It reuses the SHIPPED test id, deliberately ──
 * `data-testid="project-folder-picker"` is the SAME id the Builder's two sites use (the
 * describe screen's own picker and the drafted header's bound-folder select). That is the
 * id the operator's DOM probe looked for on this door and did not find at 1.5 s / 3 s /
 * 5 s. The three sites never co-render — describe DOOR vs. Builder describe SCREEN vs.
 * drafted header are mutually exclusive surfaces — so there is no ambiguity to create, and
 * a fourth spelling would only make the next probe miss again. Do NOT invent one.
 *
 * ── A leaf: ONE api symbol, no store, no route ──
 * The component owns the request and the markup; the PARENT owns the choice. It reads
 * exactly one symbol from the api client (the org/RLS-scoped folder list) and names no
 * route, no store and no navigation seam — asserted at the source, with a positive control
 * over every needle, because a behaviour test only covers the paths a suite happened to
 * walk. `T-187-R5-01`: widening the visible set is the server's business, never this
 * component's.
 *
 * ── Two ways to have zero rows, held APART ──
 * "There are none" and "we could not ask" are DIFFERENT FACTS (the StarterTemplatePicker
 * rule). Both render nothing at all — no empty select, no placeholder row, no fabricated
 * folder (`T-187-R5-03`) — but they are distinct component states, observable through one
 * `hidden`/`aria-hidden` state marker that adds no surface and nothing to the
 * accessibility tree. Collapsing them would make this file report a fact it does not have.
 *
 * ── The quiet line states a CONFIGURATION FACT, never a verdict ──
 * D-184-15 / D-186-16, "invitation, never verdict"; the shipped `EMPTY_DRAFT_INVITATION`
 * is the precedent. The server owns every verdict (`T-187-R5-04`), so the line below may
 * carry no severity word and claims nothing about publishing succeeding or failing — a
 * word-class fence with positive controls holds it there.
 */
import { useEffect, useState } from "react"

import { listFolders } from "@/lib/api"

/** The question, asked in the Builder's own words so the door and the Builder's describe
 *  screen read as the same product rather than two dialects. */
export const DESCRIBE_KB_LABEL = "Which knowledge base should this use?"

/** The opt-out row, first in the list. Same wording as the Builder's shipped picker. */
export const DESCRIBE_KB_NONE = "No specific knowledge base"

/**
 * The quiet line beneath the select. A NEUTRAL CONFIGURATION FACT: it names what happens
 * either way and asks for nothing. No severity word, no claim about publishing, no verdict
 * — those belong to the server.
 */
export const DESCRIBE_KB_NOTE =
  "Optional — steps that read documents will search everything unless you pick one."

/** One offered row, already narrowed to the two fields this surface renders. */
interface FolderOption {
  id: string
  label: string
}

/**
 * What this component currently knows. FOUR states, because a request has four outcomes
 * and "we could not ask" is not "there are none".
 */
type PickerState = "loading" | "ready" | "none" | "unavailable"

export interface DescribeKbPickerProps {
  /** The chosen folder id, or `""` for none. The PARENT owns this — the component holds
   *  no copy of it, so there is no second source to drift from the one that is sent. */
  value: string
  /** The user picked a row. Always a folder id or `""`. Never `undefined`, never a name. */
  onChange: (id: string) => void
  /** Placement only. The component owns its own layout inside this box. */
  className?: string
}

export function DescribeKbPicker({ value, onChange, className }: DescribeKbPickerProps) {
  const [state, setState] = useState<PickerState>("loading")
  const [options, setOptions] = useState<readonly FolderOption[]>([])

  // ONE best-effort request on mount, in the `cancelled` idiom the Builder's own folder
  // effect uses. A failure renders nothing and never retries (`T-187-R5-05`): this is a
  // read that costs a round trip and buys an optional convenience, so a retry loop on the
  // fastest path in the product would be a poor trade.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const folders = await listFolders()
        if (cancelled) return
        const rows: FolderOption[] = []
        for (const f of folders) {
          const id = typeof f?.id === "string" ? f.id : ""
          // A row with no usable id cannot be chosen, so offering it would be offering a
          // dead option. Dropped rather than rendered as an unpickable blank.
          if (id.trim().length === 0) continue
          const name = typeof f?.name === "string" ? f.name : ""
          // TOTALITY (the CANVAS-01 contract's shape): a nameless folder names ITSELF.
          // A blank row is worse than a rough one — it is unreadable AND unrecognisable.
          rows.push({ id, label: name.trim().length > 0 ? name : id })
        }
        setOptions(rows)
        setState(rows.length > 0 ? "ready" : "none")
      } catch {
        if (cancelled) return
        // NOTHING is invented here: no cached list, no remembered rows, no fabricated
        // folder. Zero rows, and a state that says WHY it is zero.
        setOptions([])
        setState("unavailable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // The state probe. `hidden` + `aria-hidden` — no surface, nothing in the accessibility
  // tree, and (being `display:none`) not a flex item, so an unoffered picker adds no gap
  // to the column it sits in. It exists so "there are none" and "we could not ask" are
  // distinguishable without either of them rendering a row.
  const stateMarker = (
    <span hidden aria-hidden="true" data-testid="describe-kb-state" data-state={state} />
  )

  // Nothing to offer ⇒ nothing at all. No empty select, no placeholder, no copy.
  if (options.length === 0) return stateMarker

  return (
    <label className={["flex flex-col gap-1.5", className ?? ""].join(" ").trim()}>
      {stateMarker}
      <span className="text-[13px] text-muted-foreground">{DESCRIBE_KB_LABEL}</span>
      <select
        data-testid="project-folder-picker"
        aria-label={DESCRIBE_KB_LABEL}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{DESCRIBE_KB_NONE}</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <span data-testid="describe-kb-note" className="text-[11.5px] leading-snug text-muted-foreground">
        {DESCRIBE_KB_NOTE}
      </span>
    </label>
  )
}

export default DescribeKbPicker
