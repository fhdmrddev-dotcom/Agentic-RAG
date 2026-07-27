/**
 * Phase 184-13 Task 1 (CANVAS-02 · R6 · R12 · sketch 141-B) — CanvasToolbar.
 *
 * THE EDITING CONTROLS, WHERE EDITING HAPPENS. Sketch 141-B's decision was that
 * undo / redo and the save state float on the canvas rather than sitting in a page-wide
 * session strip, and that the way OUT (publish) stays in the header the Builder already
 * has. This component is the first half of that; the header half shipped in 184-11 and
 * is deliberately untouched.
 *
 * ── PITFALL 7 / zundo #207 — THE ONE RULE THIS FILE EXISTS TO GET RIGHT ───────────
 *
 * `canUndo` and `canRedo` are SELECTOR reads on the temporal store, through
 * `useBuilderTemporal`. They may NEVER be read as `store.temporal.getState().pastStates`
 * in a rendered value. The zundo maintainer, closing upstream issue #207 as
 * working-as-intended: *"Because you're using `getState()` within a React component,
 * changes to `futureStates` and `pastStates` never would force a re-render. […] you'll
 * need to access `futureStates` and `pastStates` with a selector for the values to be
 * reactive."* A `getState()` read here would render correctly on first paint and then
 * never update — the buttons would be permanently stuck at whatever the history looked
 * like when the toolbar mounted. That failure is silent, which is why the component's
 * own suite FALSIFIES it (the `getState()` form is planted and the reactivity test goes
 * red) rather than trusting this paragraph.
 *
 * The selectors read `.length`, not the arrays. `undo(n)` / `redo(n)` splice `pastStates`
 * in place and then call `set`, so a selector returning the ARRAY can compare equal to
 * itself and skip the render; a number cannot.
 *
 * SIDE-EFFECT CALLS ARE THE OTHER HALF OF THE SAME RULE, and they go the other way:
 * `store.temporal.getState().undo()` inside a click handler is correct and is what this
 * file does. That asymmetry is the shipped house rule (`usePanelReconcile.ts` — a
 * selector at `:58-60`, a `getState()` side effect at `:77`).
 *
 * ── WHAT THE SAVE STATE MAY SAY (R6) ─────────────────────────────────────────────
 *
 * `Saved · still a draft`, and no word that implies published, ever. Autosave does not
 * exist in this phase: an explicit save updates a draft row in place, it does not mint a
 * version and it does not re-arm the publish gauntlet. The literal is imported from
 * `builderStore.ts`, which is the ONE home of it — the page re-exports the same binding,
 * so the header and this toolbar cannot drift into two spellings.
 *
 * AT REST THIS SURFACE SAYS NOTHING. `idle` — a draft opened and not yet touched —
 * renders no chip at all, because there is no true sentence about a save that has not
 * happened. A chip reading "Saved" on a draft this session never wrote would be the same
 * class of lie as one reading "Published".
 *
 * ── THE COLOUR BUDGET (R9) ───────────────────────────────────────────────────────
 *
 * The error reading uses RAW hsl literals, never the `destructive` design token. R9
 * reserves that token for the `error` verdict mark and PROVES the reservation by counting
 * the token's name in the emitted HTML of a mid-build draft; a control that spent it here
 * would make a shipped scan report a colour it was never written to measure. This is the
 * same call 184-12's `✕` had to make, and the values are the same `canvas-184.css`
 * `.acts button.danger:hover` ones.
 *
 * ── WHAT THIS COMPONENT DOES NOT DO ──────────────────────────────────────────────
 *
 * It renders no verdict of its own, opens no request, and names no route: `onSave` and
 * `onTidyUp` are the caller's, and the save STATE arrives as a prop. Its own suite pins a
 * `fetch` spy at zero. Undo and redo call store actions only — an undo that wrote to the
 * server is exactly the surprise a no-autosave phase exists to prevent (D-184-03).
 */
import { StatusChip, type ChipTone } from "@/components/org/StatusChip"
import {
  useBuilderStore,
  useBuilderTemporal,
} from "@/components/workflows/BuilderStoreProvider"
import { SAVED_STILL_A_DRAFT } from "@/components/workflows/builderStore"
import { cn } from "@/lib/utils"

/**
 * The five readings the toolbar can be in.
 *
 * Wider than the store's `SaveState` by exactly one member: `dirty`. The store keeps
 * `dirty` as its own boolean (D-184-03 re-arms it on an undo), and the page joins the two
 * into this one union so the toolbar has a single thing to render rather than a boolean
 * and an enum it would have to combine itself.
 */
export type ToolbarSaveState = "idle" | "dirty" | "saving" | "saved" | "error"

/**
 * The words, and the tone each one wears. `idle` is deliberately absent from the table —
 * see the docblock: silence is the only honest reading at rest.
 *
 * `error` is absent too, because its words are the CALLER's (the 409 sentence, or the
 * generic failure line) and its tone is not one of the three the shared chip offers.
 */
const SAVE_READING: Record<
  Exclude<ToolbarSaveState, "idle" | "error">,
  { label: string; tone: ChipTone }
> = {
  dirty: { label: "Not saved yet", tone: "muted" },
  saving: { label: "Saving…", tone: "primary" },
  saved: { label: SAVED_STILL_A_DRAFT, tone: "success" },
}

/**
 * The error chip's classes. RAW hsl literals — see the colour-budget paragraph in the
 * docblock. Do not "tidy" these into `border-destructive` / `text-destructive`: the R9
 * scan counts that token's name across the whole emitted bottom region and expects zero
 * on a draft whose findings are all "not finished yet".
 */
const ERROR_CHIP =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
  "border-[hsl(0_72%_51%/0.6)] bg-[hsl(0_72%_51%/0.14)] text-[hsl(0_85%_74%)]"

export interface CanvasToolbarProps {
  /** What the surface may say about the save right now. */
  saveState: ToolbarSaveState
  /**
   * The failure sentence for `saveState: "error"` — the caller's, never composed here
   * (it carries the 409's "use Tweak" wording when that is the failure). When the caller
   * supplies none, the error chip falls back to the DIRTY words: a save that failed
   * really is a draft that is not saved yet, and that is a true sentence this component
   * already owns rather than a second spelling of a generic one it does not.
   */
  errorMessage?: string | null
  /** The explicit save. R6: there is no autosave in this phase. */
  onSave: () => void
  /** Clear this workflow's cosmetic nudges (`canvasNudge`'s per-draft key only). */
  onTidyUp: () => void
}

export function CanvasToolbar({
  saveState,
  errorMessage,
  onSave,
  onTidyUp,
}: CanvasToolbarProps) {
  const store = useBuilderStore()

  // ⚠ SELECTORS. Never `store.temporal.getState()` here — see the docblock and the
  // falsified test that guards it.
  const canUndo = useBuilderTemporal((t) => t.pastStates.length > 0)
  const canRedo = useBuilderTemporal((t) => t.futureStates.length > 0)

  // …and the side-effect half, which is exactly where `getState()` IS correct.
  const undo = () => store.temporal.getState().undo()
  const redo = () => store.temporal.getState().redo()

  const reading = saveState === "idle" || saveState === "error" ? null : SAVE_READING[saveState]

  return (
    <div
      data-testid="canvas-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-card/60 px-3 py-1.5",
        "backdrop-blur-sm",
      )}
    >
      <button
        type="button"
        data-testid="canvas-toolbar-undo"
        aria-label="Undo (⌘Z or Ctrl+Z)"
        title="Undo (⌘Z or Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[9px] border-0 bg-transparent text-[13px]",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        )}
      >
        <span aria-hidden="true">↶</span>
      </button>

      <button
        type="button"
        data-testid="canvas-toolbar-redo"
        aria-label="Redo (⇧⌘Z or Ctrl+Y)"
        title="Redo (⇧⌘Z or Ctrl+Y)"
        disabled={!canRedo}
        onClick={redo}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[9px] border-0 bg-transparent text-[13px]",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        )}
      >
        <span aria-hidden="true">↷</span>
      </button>

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />

      <button
        type="button"
        data-testid="canvas-toolbar-tidy"
        title="Put every step back on its lane — the arrangement is browser-local and is never saved"
        onClick={onTidyUp}
        className={cn(
          "rounded-[9px] border-0 bg-transparent px-2 py-1 text-[12px]",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        )}
      >
        Tidy up
      </button>

      <span className="flex-1" />

      {/* `role="status"` (implicitly polite) so a change is announced once, without the
          toolbar declaring an announcer region of its own. */}
      <span data-testid="canvas-toolbar-save-state" role="status">
        {saveState === "error" ? (
          <span data-testid="canvas-toolbar-save-error" className={ERROR_CHIP}>
            {errorMessage ?? SAVE_READING.dirty.label}
          </span>
        ) : reading ? (
          <StatusChip tone={reading.tone} testId="canvas-toolbar-save-chip">
            {reading.label}
          </StatusChip>
        ) : null}
      </span>

      <button
        type="button"
        data-testid="canvas-toolbar-save"
        onClick={onSave}
        disabled={saveState === "saving"}
        className={cn(
          "rounded-[9px] border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-foreground",
          "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        Save draft
      </button>
    </div>
  )
}

export default CanvasToolbar
