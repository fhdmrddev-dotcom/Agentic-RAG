/**
 * Phase 184-07 Task 2 (D-184-11 · R10b · sketch 139 variant C, folded into A) —
 * StepTypePicker.
 *
 * THE `＋` MENU. Six step types, in plain language, at the point where the new step
 * will land.
 *
 * ── Each row is a PREVIEW OF THE CARD, not a description of it (187-18 / WR-03) ──
 * The row title asks `nodeTitle` — THE one title resolution — over the very phase the
 * caller will build with `minimalPhaseFor` once `onChoose` fires. It reads no
 * vocabulary map of its own, and that is the whole point of the WR-03 fix: this file
 * previously took the row title straight from the shipped sentence map, which is a
 * SECOND answer to a question with exactly one home. The two answers disagreed. The
 * author read **"Check with you"** in the menu, clicked it, and the card that landed
 * said **"Wait for your approval"** — two sentences for one choice, one click apart,
 * both sourced from the module whose premise is that titles resolve in one place.
 *
 * The drift survived a phase built to prevent it because it was SEMANTIC, not lexical:
 * both strings were imported identifiers, so every `?raw` fence and copy-identity guard
 * stayed green. `StepTypePicker.test.tsx` now measures the row against the resolver
 * instead of against a string, and fences this file at zero sentence-map reads.
 *
 * Beside the title sits the shared `renderPhaseMark(type)` element. **Never a text
 * glyph** — that single miss is most of why an earlier sketch batch read as *"very
 * basic … does not look very agentic"*, and the 3D mark is a locked rule of the sketch
 * language, not a preference. The supporting line stays `PHASE_TYPE_SUBTITLES[type]`
 * (beaten by the refusal reason when a row is refused), and the technical `phase_type`
 * identifier still appears only behind the ⌥ Technical-names reveal.
 *
 * ── The refusal: offered DISABLED, WITH its reason, never hidden (R10b) ──
 * Sketch 139 variant C's finding, folded into winner A as a build rule: an option that
 * vanishes teaches nothing, and an option greyed out mutely is worse — the author is
 * left to guess what they did wrong. So every row the definition's shape declines is
 * still rendered, disabled, with its sentence visible in the DOM beside it (not in a
 * `title`, not in a tooltip) and wired to the row through `aria-describedby`.
 *
 * ── This component AUTHORS NO REASON OF ITS OWN, and consults no server ──
 * Every row and every `disabledReason` comes from `definitionOps.allowedTypesAt`, the
 * pure shape predicate. The distinction is load-bearing and R10 states it: **a refusal
 * is a SHAPE rule, decided locally from the phases already in hand; a verdict is a
 * SERVER judgement.** Keeping the two visibly apart is what keeps D-182-06 intact — the
 * client never grows a second opinion about validity. This module therefore imports
 * nothing from the API client, names no server route, and opens no request; a `?raw`
 * fence and a whole-suite request spy in `StepTypePicker.test.tsx` both prove it, each
 * with a positive control.
 *
 * ── D-184-11 — there is no slug field here, deliberately ──
 * Choosing a type calls `onChoose(type)` and nothing else. The CALLER derives the slug
 * with `definitionOps.slugForType` and builds the phase with `minimalPhaseFor`, because
 * the slug is **node identity** on the canvas (`node.id === phase.slug`) and a
 * `skip_to_phase` target inside `on_failure`. Letting an author rename it would need a
 * cascade across both — a feature nobody asked for, and the failure mode is a silently
 * broken fallback branch. The plain-language TITLE is what the user names, in the
 * inspector, and it is free of all of that.
 *
 * ── The colour budget (sketch 137, load-bearing) ──
 * Type colour is a TINT BEHIND THE MARK only, read from the same `ICON_TINT` table the
 * canvas node face uses — one copy, so a picker row and the card it creates can never
 * disagree. Strong colour belongs to Phase 188's run status. The panel's entrance
 * animation keys off `open` and nothing else; no row animates on selection.
 *
 * ── `BUG-260807-02`, the KEYBOARD half — THE NATIVE `disabled` IS GONE, ON PURPOSE ──
 * The refusal rule above says every declined row is *"still rendered, disabled, with its
 * sentence visible in the DOM beside it … wired to the row through `aria-describedby`"*,
 * because *"an option that vanishes teaches nothing, and an option greyed out mutely is
 * worse — the author is left to guess what they did wrong"*. The NATIVE `disabled`
 * attribute contradicted that rule outright: a natively disabled button cannot receive
 * focus, so a keyboard or screen-reader author could never reach the row and therefore
 * never heard the reason this component exists to teach. WAI-ARIA APG for `menu` says a
 * disabled item SHOULD stay focusable precisely so it stays discoverable. So the row now
 * announces `aria-disabled` only, stays in the roving order, and is guarded in `onClick`.
 *
 * ⚠ THE CONSEQUENCE, STATED RATHER THAN DISCOVERED LATER: `onClick`'s `if (refused)
 * return` IS NOW THE ONLY THING PREVENTING A REFUSED CHOICE — for the mouse AND for the
 * keyboard. Before this, the browser swallowed a click on a disabled button and React's
 * own `shouldPreventMouseEvent` filtered `onClick` on top of that, so the guard had never
 * had to work; the shipped test that "proved" it used a click that could not even
 * dispatch. `StepTypePicker.test.tsx` now drives a real click, `Enter` and `Space` against
 * it, each with a POSITIVE CONTROL proving the event genuinely reaches the row.
 *
 * ⚠ `ArrowLeft` / `ArrowRight` DO NOTHING HERE, DELIBERATELY. `nextRovingIndex` is a
 * vertical-`menu` key map; `ExternalActionSection` maps Left/Right because it is a
 * `radiogroup`, where APG makes them synonyms of Up/Down. In a `menu` they belong to
 * submenus and menubars, neither of which exists here. That non-move is the falsification
 * control for the whole keyboard claim, in jsdom and on the live canvas alike.
 *
 * ⚠ FOCUS IS MOVED WITH `preventScroll`, AND THE PANEL IS SCROLLED BY HAND. The default
 * focus scroll — like `scrollIntoView` — walks up and scrolls the NEAREST SCROLLABLE
 * ANCESTOR, and `.react-flow` is `overflow: hidden`: programmatically scrollable, with no
 * scrollbar and no user gesture that can move it. That is the exact cheat that
 * manufactured a false 7/7 reachability reading in this bug's clipping half on
 * 2026-08-07, and the tell was that the falsification control refused to swing. So this
 * file calls `focus({ preventScroll: true })` and assigns `scrollTopToReveal`'s number to
 * its OWN panel's `scrollTop`. No CALL to that method appears anywhere in this file, and a
 * source fence with a positive control keeps it that way. ⚠ The fence matches the CALL
 * spelling (a dot, the name, a paren) rather than the bare identifier, precisely so this
 * paragraph may go on naming the trap — written bare, it went red against these very
 * lines, and a fence that forbids explaining itself is a fence that gets deleted.
 *
 * A LEAF, not a wired surface: it takes `phases` and an insertion `index`, renders, and
 * calls back. It creates no phase, holds no store reference and owns no placement, so
 * it renders in a plain unit test with no provider and no `ReactFlowProvider`. Reading
 * and writing its OWN panel's `scrollTop` is the panel's own business and is the only DOM
 * it touches.
 */
// ⚠ `KeyboardEvent` IS ALIASED, and the alias is load-bearing rather than stylistic.
// Imported under its own name it SHADOWS the global DOM `KeyboardEvent` that the shipped
// `window` Escape listener below is typed against, and `addEventListener` then matches no
// overload — measured as two net-new `tsc` errors against a baseline of 33.
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import {
  allowedTypesAt,
  minimalPhaseFor,
  type PhaseTypeId,
} from "@/components/workflows/definitionOps"
import { nextRovingIndex, scrollTopToReveal } from "@/components/workflows/editAffordance"
import { DEFAULT_TINT, ICON_TINT, renderPhaseMark } from "@/components/workflows/nodePresentation"
import {
  PHASE_TYPE_SUBTITLES,
  nodeTitle,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

/**
 * The slug the PREVIEW phase carries. Never rendered and never persisted: this object
 * exists only to be handed to `nodeTitle`, and the real slug is derived by the caller
 * with `slugForType` after `onChoose` (D-184-11, below). `nodeTitle` carries a
 * never-print-a-slug floor, so this value cannot reach the row — asserted, not assumed,
 * by "the preview is independent of the placeholder slug and index".
 */
const PREVIEW_SLUG = ""

export interface StepTypePickerProps {
  /** The definition's phases as they stand. Read-only — the picker mutates nothing. */
  phases: readonly PhaseSpecJSON[]
  /** The RENDER position the new step would take (`insertPhaseAt`'s index). */
  index: number
  /** The user picked a type. The caller derives the slug and builds the phase. */
  onChoose: (type: PhaseTypeId) => void
  /** Escape, or a click outside. REQUIRED — a menu with no way out is not a menu. */
  onDismiss: () => void
  /** Closed renders nothing at all: no hidden DOM, no stale focus trap. */
  open: boolean
  /**
   * `BUG-260807-02` — THE MEASURED BUDGET THE CALLER COMPUTED. **This leaf measures
   * nothing**, and must not start: it renders with no `ReactFlowProvider`, imports
   * nothing from `@xyflow/react`, holds no store reference and reads no DOM. The number
   * comes from `pickerPlacement`, which derives it from the live container size and
   * viewport transform in `PlaneEditingLayer`.
   *
   * Omitted or `null` = DO NOT BOUND, which is byte-for-byte the panel that shipped —
   * the answer for a container the library has not measured yet (jsdom always, and a
   * browser's first paint).
   */
  maxHeightPx?: number | null
}

export function StepTypePicker({
  phases,
  index,
  onChoose,
  onDismiss,
  open,
  maxHeightPx,
}: StepTypePickerProps) {
  const baseId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  // THE ROVING STOP. One index, so the whole menu is ONE tab stop — the APG `menu`
  // contract the `role` has been announcing since 184-07 without honouring it.
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ⚠ THE ROVING STOP RESETS DURING RENDER, NOT INSIDE THE EFFECT. React's documented
  // "adjusting state when a prop changes" pattern. A picker re-opened at the SAME mount
  // must start its walk at row 1 again, and doing that with a `setActiveIndex(0)` in the
  // effect body is a cascading re-render — which `react-hooks/set-state-in-effect`
  // correctly flags, measured as a net-new lint error against a baseline of 5.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setActiveIndex(0)
  }

  // Computed BEFORE the `open` early-return, because the keydown handler below needs the
  // row count and hooks may not be declared after a conditional return. `allowedTypesAt`
  // is pure and cheap, so hoisting it costs a closed picker nothing observable.
  const choices = allowedTypesAt(phases, index)

  // The app-wide reveal, READ (never owned) here — the shipped fail-closed accessor
  // (`WorkflowCanvas.tsx:181-183`). Null outside a provider means plain language, no
  // control, no crash.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  const dismiss = useCallback(() => onDismiss(), [onDismiss])

  // Escape closes, from anywhere. GATED on `open` (the `WorkflowBuilderPage.tsx:217-231`
  // precedent): no listener exists while the picker is closed, so it costs nothing at
  // rest and cannot accumulate across renders.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, dismiss])

  // A press outside the panel closes it. `mousedown` rather than `click`, so a press
  // that starts outside dismisses before any stray activation inside can land.
  //
  // ⚠ CAPTURE PHASE, and it is not defensive style — it is the only phase that works
  // here. The canvas plane is driven by d3-zoom, which calls `stopPropagation()` on
  // mousedown to own its pan gesture, so a bubble-phase listener on `window` NEVER sees
  // a press on the plane. Measured live: pressing `.react-flow__pane` reached window 0
  // times bubbling and 1 time capturing. The menu was therefore inescapable by clicking
  // away — the operator found it could only be closed by picking something, which turns
  // "let me see my options" into a forced choice.
  //
  // Capture fires before the target's own handlers, and the containment check below is
  // what keeps a press INSIDE the panel from dismissing it, so ordering costs nothing.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const panel = panelRef.current
      if (panel && event.target instanceof Node && !panel.contains(event.target)) dismiss()
    }
    window.addEventListener("mousedown", onPointer, true)
    return () => window.removeEventListener("mousedown", onPointer, true)
  }, [open, dismiss])

  // ── FOCUS IN, AND FOCUS BACK OUT ──────────────────────────────────────────────
  //
  // Measured live on 2026-08-08 before this existed: opening the menu left
  // `document.activeElement` on the `＋`, a real `ArrowDown` moved it nowhere, and a real
  // `Tab` jumped straight PAST the open menu to the NEXT door. Focus never entered a
  // `role="menu"` whose ARIA contract requires arrow-key roving focus.
  //
  // ⚠ THE OPENER IS CAPTURED FROM `document.activeElement`, NOT PASSED IN, AND THAT IS
  // THE DESIGN. There are TWO mount sites — the `＋` doors in `PlaneEditingLayer` and the
  // `canvas-add-first-step` empty-state door in `WorkflowCanvas` — so a ref threaded down
  // from one caller would cover one and strand the other. Capturing at open time covers
  // both for free and lets this plan modify NEITHER caller.
  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body ? active : null

    // Refs are attached during commit, i.e. before this effect runs, so row 0 is here.
    // `preventScroll` — see the ⚠ in the docblock; the default focus scroll walks
    // ancestors into `.react-flow`'s `overflow: hidden`.
    itemRefs.current[0]?.focus({ preventScroll: true })

    return () => {
      // RESTORE ONLY WHEN FOCUS WOULD OTHERWISE BE STRANDED. Dismissing by clicking the
      // canvas pane can hand focus to React Flow's own focusable wrapper; stealing it
      // back would fight something the user deliberately pressed. The contract that binds
      // is the weaker, honest one: focus is never left on `document.body`.
      //
      // On the NEXT frame, because the row holding focus is removed from the DOM as this
      // unmounts and `document.activeElement` does not fall back to the body until after.
      requestAnimationFrame(() => {
        if (!opener || !opener.isConnected) return
        const now = document.activeElement
        if (now === null || now === document.body) opener.focus({ preventScroll: true })
      })
    }
  }, [open])

  /**
   * ONE handler on the `role="menu"` container — row events bubble to it — rather than
   * one per row, so the key map has a single home.
   *
   * ⚠ ON `null` IT TOUCHES THE EVENT AT ALL. No `preventDefault`, no `stopPropagation`.
   * That is what keeps `Escape` reaching the gated `window` listener above and `Enter` /
   * `Space` reaching the button's own native activation. A handler that called
   * `preventDefault` unconditionally would make the menu inescapable — the defect the
   * operator already hit once, from the other direction.
   */
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Read the CURRENT row from the event's own target where possible. The keydown's
    // target IS the focused row, so this stays correct even if two presses land inside
    // one React batch and `activeIndex` has not re-rendered yet.
    const fromTarget = itemRefs.current.indexOf(event.target as HTMLButtonElement)
    const current = fromTarget >= 0 ? fromTarget : activeIndex

    const next = nextRovingIndex(event.key, current, choices.length)
    if (next === null) return
    // An arrow inside an open menu must not also scroll whatever sits behind it.
    event.preventDefault()
    setActiveIndex(next)

    const row = itemRefs.current[next]
    if (!row) return
    row.focus({ preventScroll: true })

    const panel = panelRef.current
    if (!panel) return
    // ⚠ `row.offsetTop` IS NOT PANEL-RELATIVE HERE. The panel is `position: static`, so
    // `offsetParent` is the `absolute` wrapper in `PlaneEditingLayer` — and something
    // else again at the `canvas-add-first-step` mount site. Rect deltas are the only
    // reading that is correct at both. Adding `position: relative` to the panel to make
    // `offsetTop` work would change the stacking context the clipping fix was measured
    // against, so it is not done.
    const rowBox = row.getBoundingClientRect()
    const panelBox = panel.getBoundingClientRect()
    panel.scrollTop = scrollTopToReveal({
      scrollTop: panel.scrollTop,
      clientHeight: panel.clientHeight,
      rowTop: rowBox.top - panelBox.top + panel.scrollTop,
      rowHeight: rowBox.height,
    })
  }

  if (!open) return null

  const atEnd = index >= phases.length

  return (
    <div
      ref={panelRef}
      data-testid="step-type-picker"
      role="menu"
      aria-label="Add a step"
      // A `role="menu"` that owns a keydown handler must itself be focusable
      // (`jsx-a11y/interactive-supports-focus`, and APG says the same). `-1` keeps it OUT
      // of the tab order — the roving stop on the rows is the menu's ONE tab stop — while
      // giving the container somewhere to put focus if a row ever goes missing.
      tabIndex={-1}
      className={[
        "w-[300px] rounded-[14px] border border-border bg-card p-[7px] shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
        // `BUG-260807-02` — the menu renders INSIDE `.react-flow`, which is
        // `overflow-y: hidden`, so before this line any row past the container's bottom
        // edge was clipped away WITH NO SCROLL PATH TO IT. Row 7 is `external_action`,
        // the type Phase 189 exists to ship, and it was unreachable from all three
        // insertion doors. The bound itself arrives as `maxHeightPx` below; these two
        // tokens are what turn the overflow into a scroll instead of a clip.
        "overflow-y-auto overscroll-contain",
        // ⚠ BOTH WHEEL GUARDS SHIP, AND ONLY ONE OF THEM ACTUALLY WORKS. `nowheel` is the
        // real one: `@xyflow/system`'s `createZoomOnScrollHandler`
        // (dist/esm/index.js:2764) short-circuits with `return null` — notably WITHOUT
        // calling `preventDefault`, so the native scroll proceeds on the scrollable
        // element — whenever `isWrappedWithClass(event, noWheelClassName)` is true, and
        // that helper (:2693) is an ANCESTOR WALK from the event target
        // (`event.target.closest('.' + className)`). `createFilter` (:2861) and
        // `createPanOnScrollHandler` (:2711) consult the same class, and `ReactFlow`'s
        // default `noWheelClassName` is `'nowheel'`.
        //
        // The `onWheel` `stopPropagation` below is belt-and-braces ONLY: React's
        // synthetic wheel is delegated to the ROOT container, so it fires AFTER the
        // native event has already bubbled through `.react-flow`'s d3-zoom listener and
        // cannot stop that listener. A previous attempt shipped it alone; the wheel still
        // zoomed the canvas, which would have made any scrollbar here decorative.
        //
        // `nopan` rides along so dragging the panel's own scrollbar cannot pan the plane.
        // MEASURED PACKAGE VERSIONS (the same pair `AFFORDANCE_Z`'s docblock records):
        // `@xyflow/react 12.11.2`, `@xyflow/system 0.0.79`.
        "nowheel nopan",
      ].join(" ")}
      // A NUMBER FROM THE CALLER, never a constant and never a measurement taken here. A
      // static `max-h-[min(46vh,340px)]` was tried on 2026-08-07 and reverted: the CSS
      // applied exactly as written and the rows were still unreachable, because bounding
      // the HEIGHT says nothing about where the panel's TOP sits (`panelBottom 682 >
      // reactFlowBottom 597`). `undefined` emits no inline `max-height` at all, which is
      // the shipped unbounded panel.
      style={{ maxHeight: typeof maxHeightPx === "number" ? `${maxHeightPx}px` : undefined }}
      onWheel={(event) => event.stopPropagation()}
      // ONE handler for the whole menu — row keydowns bubble here. See `onMenuKeyDown`
      // for why it must fall through untouched on every key it does not own.
      onKeyDown={onMenuKeyDown}
    >
      <div className="px-2 pb-[7px] pt-[5px] font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {atEnd ? "Add a step at the end" : `Add a step before step ${index + 1}`}
      </div>

      {choices.map((choice, rowIndex) => {
        const reason = choice.disabledReason
        const refused = typeof reason === "string" && reason.length > 0
        const reasonId = `${baseId}-why-${choice.type}`
        // WR-03 — ask the resolver the CARD asks, over the phase this click really
        // creates. No name context is passed: nothing is bound yet, and an omitted
        // context is the shipped safe direction (D-187-05 — absent ⇒ fall through,
        // never fabricate). No `??` floor either: `nodeTitle` already echoes an
        // unknown type honestly, and a second fallback here could disagree with it.
        const sentence = nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))
        const subtitle = PHASE_TYPE_SUBTITLES[choice.type] ?? ""

        return (
          <button
            key={choice.type}
            type="button"
            role="menuitem"
            data-testid={`step-type-choice-${choice.type}`}
            data-phase-type={choice.type}
            data-refused={refused ? "true" : "false"}
            // ⚠ NO NATIVE `disabled`. See the docblock: a natively disabled button cannot
            // take focus, so the refusal sentence — the whole point of R10b — was
            // unreachable by exactly the authors who most need it read aloud. The refusal
            // is announced by `aria-disabled` and ENFORCED by the `onClick` guard below,
            // which is now load-bearing for the mouse and the keyboard alike.
            aria-disabled={refused ? "true" : undefined}
            // ROVING TABINDEX — the menu is ONE tab stop, so Tab reaches it and Tab
            // leaves it, and the arrows do the walking inside.
            tabIndex={rowIndex === activeIndex ? 0 : -1}
            ref={(el) => {
              itemRefs.current[rowIndex] = el
            }}
            // The reason is REAL DOM text below, not a title attribute — assistive
            // technology reads the same sentence a sighted author reads.
            aria-describedby={refused ? reasonId : undefined}
            onClick={() => {
              if (refused) return
              onChoose(choice.type)
            }}
            className={[
              "flex w-full items-center gap-[10px] rounded-[9px] border-0 bg-transparent px-2 py-[7px]",
              "text-left text-[12.5px] text-foreground",
              refused
                ? // A REFUSED ROW CAN HOLD FOCUS NOW, SO IT MUST SHOW THAT IT DOES
                  // (WCAG 2.4.7). It carried `cursor-not-allowed opacity-[0.42]` and no
                  // focus style at all, because it could never be focused. The indicator
                  // spends NO new hue — `ring` and `accent` are the tokens already on the
                  // enabled row — so the sketch-137 colour budget is untouched: type
                  // colour stays a tint behind the mark and nothing else.
                  "cursor-not-allowed opacity-[0.42] focus-visible:bg-accent/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                : "cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
            ].join(" ")}
          >
            {/* The 3D mark, with the type tint BEHIND it — the whole colour budget
                for this row (sketch 137-D). Decorative: the sentence carries meaning. */}
            <span
              aria-hidden="true"
              data-testid={`step-type-mark-${choice.type}`}
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
              style={{ background: ICON_TINT[choice.type] ?? DEFAULT_TINT }}
            >
              {renderPhaseMark(choice.type)}
            </span>

            <span className="min-w-0">
              <span className="block">{sentence}</span>
              <small
                id={refused ? reasonId : undefined}
                data-testid={refused ? `step-type-reason-${choice.type}` : undefined}
                className={[
                  "block text-[10.5px] leading-snug",
                  refused ? "text-[hsl(38_92%_66%)]" : "text-muted-foreground",
                ].join(" ")}
              >
                {refused ? reason : subtitle}
              </small>
              {showTechnical && (
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  {choice.type}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
