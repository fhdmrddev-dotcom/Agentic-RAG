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

/**
 * ── SKETCH 200 (`doors.html`) — THE PICKER HAS **THREE** DRAWN ARMS, NOT TWO ─────────────
 *
 * The sheet draws the knowledge picker in three states stacked one above the other: nothing
 * chosen, one chosen, and NO FOLDERS AT ALL. The shipped control could express only the first
 * two — with zero rows it returned the bare state marker, so *"you have no folders yet"* and
 * *"we could not ask"* both rendered as literally nothing and the author was told neither.
 *
 * ⚠ THE THIRD ARM IS WHY THIS FILE'S FOUR-STATE MACHINE ALREADY EXISTED AND WENT UNSPENT.
 * `PickerState` has carried `none` and `unavailable` apart since 187-26 precisely because they
 * are different facts; what was missing was a SURFACE for the distinction. A boolean
 * `hasFolders` could not have carried it (the house rule — `runFacts.ts` has four arms and
 * `DecisionsList` three for exactly this reason), and collapsing the two would make this file
 * report a fact it does not have.
 *
 * So each of the three below belongs to ONE arm and to no other:
 */

/** The `ready` + nothing-chosen arm — the sheet's dashed add control. */
export const DESCRIBE_KB_CHOOSE = "+ Choose what it can read"

/**
 * The `none` arm — asked, answered, and the answer was zero. A CONFIGURATION FACT in the
 * `DESCRIBE_KB_NOTE` register: no severity word, no verdict, and no claim about publishing.
 */
export const DESCRIBE_KB_EMPTY = "You have no folders yet"

/**
 * The `unavailable` arm — WE COULD NOT ASK, which is not the same claim as `DESCRIBE_KB_EMPTY`
 * and must never be spelled with it. A failed read knows nothing about how many folders exist,
 * so a surface that said "you have none" here would be inventing the server's answer.
 *
 * ⚠ SKETCH 200 DRAWS NO ARM FOR THIS STATE — it draws three, and this is a fourth. It is
 * authored rather than ported for the reason above: the sheet's third arm makes a claim this
 * state cannot support, so borrowing its words would be the fabrication the sheet's own
 * three-state finding exists to prevent.
 */
export const DESCRIBE_KB_UNAVAILABLE = "Your folders could not be loaded just now"

/** The remove control on the sheet's chosen row. A LABEL, never a rendered word — the row
 *  draws a glyph and this names it for a screen reader. */
export const DESCRIBE_KB_CLEAR_LABEL = "Remove the chosen knowledge base"

/** The sheet's `+ Upload documents` action on the empty arm. RENDERED ONLY WHEN A CALLER
 *  SUPPLIES A DESTINATION — see `onUploadDocuments`. */
export const DESCRIBE_KB_UPLOAD = "+ Upload documents"

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
  /**
   * Sketch 200's `+ Upload documents` action on the EMPTY arm — the one way out of having no
   * folders, offered where the author discovers they have none.
   *
   * ⚠ OPTIONAL, AND THE CONTROL RENDERS ONLY WHEN A CALLER SUPPLIES IT. The app has no url
   * router (`SEED-185`), so this component cannot navigate anywhere on its own, and a control
   * that looked like a way out and did nothing would be worse than the sentence alone. Absent
   * ⇒ the empty arm is a statement of fact with no affordance, which is honest. Present ⇒ the
   * sheet's control, wired to the destination its OWNER knows.
   */
  onUploadDocuments?: () => void
}

export function DescribeKbPicker({
  value,
  onChange,
  className,
  onUploadDocuments,
}: DescribeKbPickerProps) {
  const [state, setState] = useState<PickerState>("loading")
  const [options, setOptions] = useState<readonly FolderOption[]>([])
  /**
   * Sketch 200's arm 1 → arm 2 transition. The sheet draws a DASHED ADD CONTROL where the
   * shipped surface drew a permanently-open `<select>`; pressing it is what puts the chooser
   * on screen, and choosing is what replaces both with the sheet's chosen row.
   *
   * ⚠ IT IS DISCLOSURE STATE AND NOTHING ELSE. It caches no prop, mirrors no server fact and
   * is never read by any rule — `value` remains the parent's, and the select below is still
   * the ONE control that writes it. A picker that remembered a CHOICE here would be the second
   * source this file's docblock forbids; remembering whether a control is on screen is not
   * that.
   */
  const [choosing, setChoosing] = useState(false)

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

  // ── CR-R5-01 — WHAT IS SENT IS ALWAYS SOMETHING THE AUTHOR CAN SEE ──
  //
  // The parent owns `value` and deliberately keeps it across unmount (a considered pick is
  // not undone by looking around — `WorkflowDoorSwitch`). Compose that with the two
  // render-nothing states below and a THIRD case — a held id the server no longer offers
  // (deleted, or scoped away by RLS) — and the door could put a `project_folder_id` on the
  // wire that no control on screen shows. `<select>` renders such an id as a BLANK row
  // (`selectedIndex === -1`), so even the visible case is unreadable.
  //
  // That is not merely untidy: `POST /workflows/generate` tests `project_folder_id is None`
  // to mint `unbound_retrieval`, so a non-null id pointing at nothing SUPPRESSES the very
  // verdict this control exists to help the author satisfy, and quietly unblocks Publish.
  // The control built so the author would be ASKED would be answering on their behalf.
  //
  // So: once the request has SETTLED, an unofferable choice is surrendered back to the
  // parent. It fails toward UNBOUND — the state D-187-11 already reads as legitimate and
  // which the server says out loud — never toward a silent binding. `loading` is excluded
  // because "not asked yet" is not "not offered", and `unavailable` is INCLUDED for the
  // reason that matters here: when nothing renders, the author cannot see or change what
  // would be sent, whatever the reason for the emptiness.
  useEffect(() => {
    if (state === "loading") return
    if (value === "") return
    if (options.some((f) => f.id === value)) return
    onChange("")
  }, [state, options, value, onChange])

  // The state probe. `hidden` + `aria-hidden` — no surface, nothing in the accessibility
  // tree, and (being `display:none`) not a flex item, so an unoffered picker adds no gap
  // to the column it sits in. It exists so "there are none" and "we could not ask" are
  // distinguishable without either of them rendering a row.
  const stateMarker = (
    <span hidden aria-hidden="true" data-testid="describe-kb-state" data-state={state} />
  )

  /**
   * ── SKETCH 200 — THE SECTION FRAME, SHARED BY EVERY RENDERING ARM ────────────────────
   * The sheet gives the picker its own labelled section: a `font-data-md` label, then the arm
   * beneath it. The frame is identical across arms, so the label never jumps as the request
   * settles and the column's height does not shift under the author's cursor.
   *
   * ⚠ A `div` RATHER THAN THE SHIPPED `label` ELEMENT, and the change is required rather than
   * cosmetic: three of the four arms below wrap no form control at all, and a `label` around a
   * button is a labelling relationship the accessibility tree cannot make sense of. The one arm
   * that DOES own a control carries its own explicit `aria-label`, exactly as it always did.
   */
  const frame = (arm: React.ReactNode) => (
    <div className={["flex flex-col gap-2", className ?? ""].join(" ").trim()}>
      {stateMarker}
      <span className="font-mono text-[14px] leading-[1.4] text-foreground">
        {DESCRIBE_KB_LABEL}
      </span>
      <div className="flex flex-col gap-1">{arm}</div>
    </div>
  )

  // NOT ASKED YET. Neither "you have none" nor "we could not ask" is true here, so the surface
  // claims neither and the label does not flash a sentence it is about to replace.
  if (state === "loading") return stateMarker

  /**
   * ── ARM 4 — WE COULD NOT ASK. AUTHORED, NOT PORTED ───────────────────────────────────
   * A failed read knows nothing about how many folders exist, so it may not borrow arm 3's
   * words. It must not render nothing either: silence is what let this whole control vanish
   * without the author being told anything at all.
   */
  if (state === "unavailable") {
    return frame(
      <p
        data-testid="describe-kb-unavailable"
        className="text-[14px] leading-[1.5] text-muted-foreground"
      >
        {DESCRIBE_KB_UNAVAILABLE}
      </p>,
    )
  }

  /**
   * ── ARM 3 (SHEET) — NO FOLDERS AT ALL ────────────────────────────────────────────────
   * The sheet's row: the fact on the left, the way out on the right.
   *
   * ⚠ THE WAY OUT RENDERS ONLY WHERE ONE EXISTS. The sheet draws its control unconditionally
   * because a sheet has nowhere to go wrong; the app has no url router (`SEED-185`), so a
   * control here with no destination would be an affordance that does nothing — worse than the
   * fact standing alone. `onUploadDocuments` is how an owner supplies the destination.
   */
  if (state === "none" || options.length === 0) {
    return frame(
      <div
        data-testid="describe-kb-empty"
        className="flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70"
      >
        <span className="text-[14px] leading-[1.5] text-muted-foreground">
          {DESCRIBE_KB_EMPTY}
        </span>
        {onUploadDocuments ? (
          <button
            type="button"
            data-testid="describe-kb-upload"
            onClick={onUploadDocuments}
            className="shrink-0 font-mono text-[12px] text-primary transition-colors hover:text-foreground"
          >
            {DESCRIBE_KB_UPLOAD}
          </button>
        ) : null}
      </div>,
    )
  }

  const chosen = options.find((f) => f.id === value) ?? null

  /**
   * ── ARM 2 (SHEET) — ONE CHOSEN ───────────────────────────────────────────────────────
   * The sheet's chosen row: a folder glyph, the name, a document count, and a remove control
   * that appears under the cursor.
   *
   * ⚠ THE DOCUMENT COUNT IS NOT RENDERED, AND ITS ABSENCE IS THE HONEST READING. The sheet
   * draws `1,284 documents` beside the name. `Folder` carries `id`, `user_id`, `name`,
   * `parent_id`, `is_org_shared`, `created_at`, `updated_at` — AND NO COUNT — and `listFolders`
   * asks for nothing else, so there is no number to show. A plausible one invented on the
   * control that decides what a workflow may read is exactly the class of fabrication this
   * surface exists to prevent, so the slot renders nothing at all.
   *
   * ⚠ THE REMOVE CONTROL IS REVEALED ON FOCUS AS WELL AS ON HOVER. The sheet draws it
   * `opacity-0 group-hover` and carries no opinion about the keyboard; a control reachable only
   * by pointer is not reachable at all for an author who does not use one.
   */
  if (chosen !== null) {
    return frame(
      <div
        data-testid="describe-kb-chosen"
        className="group flex w-full items-center justify-between rounded border border-border bg-card px-4 py-2"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="shrink-0 text-[14px] text-muted-foreground">
            ▤
          </span>
          <span className="min-w-0 truncate text-[14px] leading-[1.5] text-foreground">
            {chosen.label}
          </span>
        </div>
        <button
          type="button"
          data-testid="describe-kb-clear"
          aria-label={DESCRIBE_KB_CLEAR_LABEL}
          onClick={() => {
            onChange("")
            setChoosing(false)
          }}
          className="flex shrink-0 items-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>,
    )
  }

  /**
   * ── ARM 1 (SHEET) — NOTHING CHOSEN ───────────────────────────────────────────────────
   * The sheet's dashed add control. Pressing it discloses the chooser, and the chooser is the
   * SHIPPED `select` under the SHIPPED test id — that id is what the operator's DOM probe looks
   * for, and a fourth spelling would make the next probe miss again.
   */
  return frame(
    <>
      {choosing ? (
        <select
          data-testid="project-folder-picker"
          aria-label={DESCRIBE_KB_LABEL}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border bg-card px-4 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-0"
        >
          <option value="">{DESCRIBE_KB_NONE}</option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          data-testid="describe-kb-choose"
          onClick={() => setChoosing(true)}
          className="flex w-full items-center justify-center rounded border border-dashed border-border bg-background p-2 text-[14px] leading-[1.5] text-muted-foreground transition-colors hover:border-primary hover:bg-muted focus:outline-none focus-visible:border-primary"
        >
          {DESCRIBE_KB_CHOOSE}
        </button>
      )}
      <span
        data-testid="describe-kb-note"
        className="text-[11.5px] leading-snug text-muted-foreground"
      >
        {DESCRIBE_KB_NOTE}
      </span>
    </>,
  )
}

export default DescribeKbPicker
