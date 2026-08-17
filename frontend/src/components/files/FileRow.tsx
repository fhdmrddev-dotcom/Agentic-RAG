import { forwardRef, type ReactNode } from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { Download, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fileIcon } from "@/lib/fileIcon"
import { formatBytes } from "./fileRowUtils"

/**
 * FileRow — the ONE file-row markup (Phase 195, RUN-03).
 *
 * Four surfaces hand-write the same row today: the chat output card
 * (`OutputFileCard.tsx:143-185`), the panel file list (`FilesSection.tsx:219-269`),
 * the run page's deliverable list (`WorkflowRunPage.tsx:1049-1082`) and the chat
 * final-outputs list. This is the EXTRACTION of that markup, not a new card —
 * SEED-148's adopted rule ("any plan that proposes a new card component should
 * be challenged") is honoured by building on nothing: no `components/ui/card.tsx`,
 * no class-variance-authority variants block, no feature surface of its own.
 *
 * ── ⚠ NEW GROUND, TWICE OVER — say so rather than let it read as house style ─
 *
 *  1. This is the tree's SECOND first-party `asChild` component. The only other
 *     is `components/ui/button.tsx:42-53`, whose mechanics are copied verbatim
 *     here (forwardRef · `const Comp = asChild ? Slot : …` · `cn` · displayName),
 *     with the fallback changed to `"div"` and the ref generic to `HTMLElement`.
 *  2. `components/files/` is the tree's FIRST shared non-primitive component
 *     directory. The other 17 `components/*` dirs are all feature-scoped, `ui/`
 *     is reserved for the 16 shadcn primitives, and `panel/PanelSection.tsx`
 *     being imported from `metadata/DocumentDetailPanel.tsx` is the shipped
 *     instance of exactly the mis-homing D-06 forbids. A shared row that lived
 *     in `chat/` would repeat it.
 *
 * ── IT HOLDS NO BUSINESS LOGIC ───────────────────────────────────────────────
 * Pure presentation: values, `ReactNode` slots and a caller-supplied wrapper
 * element. What stays in the CALLER, deliberately and mechanically:
 * **the preview activation, the viewed-thread read, the download call and the
 * section-level error.** That sentence is this phase's constraint recorded in
 * the code itself — `WorkflowRunPage.test.tsx:1464` and `:1478` each forbid a
 * NAMED TOKEN in raw page source (the viewed-thread selector hook, and the
 * previewer component), so a row that resolved a thread or named the previewer
 * would red a shipped fence the moment a surface adopted it. D-09's
 * "parameterise the activation" is a CALLBACK PROP and a caller-supplied
 * wrapper element — never a preview import.
 *
 * ⚠ AND THOSE TOKENS ARE DELIBERATELY ABSENT FROM THIS FILE, INCLUDING FROM
 * THIS COMMENT. Those fences grep RAW SOURCE, so quoting a forbidden identifier
 * in prose reds them exactly as loudly as calling it would — a docblock is not
 * exempt from a source sweep, and plan 195-07 adds one over this very file.
 * This paragraph exists because the first draft named all three and tripped its
 * own rule; the grep that caught it is in this plan's acceptance criteria.
 *
 * ── THE DEBT FIXED *HERE*, WHILE EXTRACTING (the NavRow.tsx:14-23 habit) ─────
 *  · The run page's id-less row is a silent non-interactive `<div>` with NO cue
 *    that the file cannot be fetched (`WorkflowRunPage.tsx:1066-1081`) — the ❌
 *    pattern `BUG-260523-03` already closed on the chat side. It gains the
 *    shipped `trailing="dead"` affordance, and NOTHING else about it changes.
 *    That single delta is the whole of what plan 06 ships.
 *
 * ── ⚠ `DENSITY` IS PER-SURFACE, NOT PER-FILE-IMPORTANCE ─────────────────────
 * D-095.1-06 REVERSED the hero/working split; `OutputFileCard`'s `variant` prop
 * is inert to this day. The record below is keyed by SURFACE ("where does this
 * row hang"), never by a file's importance, and it is deliberately a plain
 * `Record` rather than a class-variance-authority variants block: anything
 * shaped like a per-file variants block would re-introduce the retired pattern
 * as a code shape. (The library's three-letter name is spelled out rather than
 * abbreviated here for the same reason the two page-source tokens above are
 * paraphrased — a `grep -c` for it is one of this plan's acceptance criteria,
 * and prose is not exempt from a source sweep.)
 */

/** The trailing affordance. `dead` is the D-08 "no link" cue. */
export type FileRowTrailing = "download" | "spinner" | "dead" | "none"

type DensityKey = "chat" | "panel" | "run"

interface DensitySpec {
  iconPx: number
  iconRibbon: boolean
  iconTone: "category" | "inherit"
  /** The icon WRAPPER span's classes. For `panel`/`run` this is where the theme
   *  token lives; the tone-inherit glyph then paints with `currentColor`, so the
   *  page never has to name a panel-scoped token itself. */
  iconClass: string
  nameClass: string
  sizeClass: string
  trailingClass: string
  /** ⚠ LAYOUT ONLY — see the `mergeProps` note on `asChild` below. */
  rowClass: string
  /** Populated ONLY for `chat`. */
  deadOverrides: { iconClass?: string; nameClass?: string }
}

const DENSITY: Record<DensityKey, DensitySpec> = {
  // origin: OutputFileCard.tsx:143-185 (live) and :92-119 (dead)
  chat: {
    iconPx: 30,
    iconRibbon: true,
    iconTone: "category",
    iconClass: "flex-shrink-0",
    nameClass: "font-mono truncate text-foreground/80",
    sizeClass: "text-muted-foreground flex-shrink-0",
    trailingClass: "w-3.5 h-3.5 text-primary flex-shrink-0",
    rowClass: "flex items-center gap-2.5",
    // origin: OutputFileCard.tsx:98 and :100 — the dead skin dims the icon and
    // the name. ONLY chat has one, which is why the run page's id-less row
    // gains the affordance and nothing else.
    deadOverrides: { iconClass: "opacity-70", nameClass: "text-foreground/60" },
  },
  // origin: FilesSection.tsx:219-269. ⚠ `text-panel-muted-foreground` is a
  // DELIBERATE Phase 088-05 AA decision, not a synonym for `text-muted-
  // foreground`: in LIGHT theme `--muted-foreground` measured 4.01:1, below the
  // 4.5:1 AA floor, while the panel token measured 7.21:1 on the panel ground.
  // In DARK theme the two are IDENTICAL (`index.css:105`/`:151`), so a jsdom
  // assertion on a RESOLVED colour cannot tell them apart — which is why this
  // row carries the token as a CLASS per density and the suite asserts the
  // class name, never an `rgb()`.
  panel: {
    iconPx: 16,
    iconRibbon: false,
    iconTone: "inherit",
    iconClass: "flex-shrink-0 text-panel-muted-foreground",
    nameClass: "min-w-0 flex-1 truncate font-mono text-[13px] text-foreground/90",
    sizeClass: "flex-shrink-0 font-mono text-[10px] text-panel-muted-foreground",
    trailingClass: "h-3.5 w-3.5 flex-shrink-0 text-panel-muted-foreground",
    rowClass: "flex items-center gap-2",
    deadOverrides: {},
  },
  // origin: WorkflowRunPage.tsx:1049-1082
  run: {
    iconPx: 16,
    iconRibbon: false,
    iconTone: "inherit",
    iconClass: "shrink-0 text-muted-foreground",
    nameClass: "min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90",
    sizeClass: "shrink-0 font-mono text-[11px] text-muted-foreground",
    trailingClass: "h-3.5 w-3.5 shrink-0 text-muted-foreground",
    rowClass: "flex items-center gap-2",
    deadOverrides: {},
  },
}

export interface FileRowProps {
  /** When true the caller's `children` element becomes the rendered wrapper —
   *  an `<a href download>`, a `<button type="button">` or a
   *  `<div role="option" tabIndex={0}>`. That is how ONE markup serves three
   *  different a11y roots and three different activations. */
  asChild?: boolean
  /** The caller's wrapper element, marked with `<Slottable>`. */
  children?: ReactNode
  density: DensityKey
  /** The VISIBLE label. The caller derives it — the run page shows the
   *  basename, the panel shows the full path, chat shows `filename` verbatim.
   *  Rendered as a React text child; never as markup (T-195-03-01). */
  name: string
  /** Forwarded to `fileIcon` for mime-first resolution. */
  mimeType?: string
  /** OMITTED renders NO size cell — `OutputFileCard`'s `size?` case, where the
   *  relaxed prop shape has no size at all. `0` still renders ("0 B"). */
  sizeBytes?: number
  /** Appended inside the size cell, e.g. `" · v2"` (the panel's version meta). */
  metaSuffix?: string
  /** D-08's "Replaces: …" subline (BUG-260523-03's UI side). */
  supersedes?: string
  /** Chat's in-row error line. `null` renders nothing. ⚠ The RUN page's error
   *  is deliberately SECTION-level with `data-testid="run-download-error"` and
   *  no auto-clear — it does not come through here. */
  errorText?: string | null
  trailing?: FileRowTrailing
  /** Rendered BEFORE the size cell — the panel's Template badge + expiry group. */
  trailingSlot?: ReactNode
  className?: string
}

/** The D-08 dead-affordance copy, in ONE place so plan 06 cannot drift from it. */
const DEAD_TITLE = "Download unavailable — this file has no link"
const DEAD_LABEL = "Download unavailable"

export const FileRow = forwardRef<HTMLElement, FileRowProps>(function FileRow(
  {
    asChild = false,
    children,
    density,
    name,
    mimeType,
    sizeBytes,
    metaSuffix,
    supersedes,
    errorText,
    trailing = "none",
    trailingSlot,
    className,
  },
  // ⚠ `forwardRef` IS LOAD-BEARING, NOT HOUSE STYLE. `FilesSection.tsx:109` and
  // `:221-223` store each row element in a `Map<string, HTMLDivElement | null>`
  // to drive roving arrow-key focus, so a row that swallowed the ref would
  // break keyboard navigation of the panel list — silently, and only for
  // keyboard users. The generic is `HTMLElement` because this row is handed an
  // `<a>`, a `<div role="option">` AND a `<button>`.
  ref,
) {
  const d = DENSITY[density]
  const isDead = trailing === "dead"

  // ⚠ EXACTLY ONE CALL TO THE SHARED ICON MODULE IN THIS FILE — that is the
  // "ONE icon path" half of SC#2. It is parameterised by density, never
  // branched on.
  const icon = fileIcon(name, d.iconPx, {
    ribbon: d.iconRibbon,
    tone: d.iconTone,
    mimeType,
  })

  // ⚠ RADIX `mergeProps` JOINS `className`, IT DOES NOT `twMerge` IT
  // (`react-slot/dist/index.mjs`: `[slotProps, childProps].filter(Boolean).join(" ")`).
  // So `rowClass` carries LAYOUT ONLY — `flex items-center` plus the surface's
  // `gap-*`. Padding, border, background, hover, ring, text-align and width all
  // stay with the CALLER, which is precisely why the three shipped rows survive
  // adoption unchanged instead of fighting this component for the same property.
  const Comp = asChild ? Slot : "div"

  return (
    <Comp className={cn(d.rowClass, className)} ref={ref as never}>
      <Slottable>{children}</Slottable>
      <span className={cn(d.iconClass, isDead && d.deadOverrides.iconClass)}>{icon}</span>
      <span className="flex-1 min-w-0 flex flex-col">
        {/* React escapes text children; `name` and `supersedes` are backend/
            model-derived and are rendered as TEXT only (T-195-03-01). */}
        <span className={cn(d.nameClass, isDead && d.deadOverrides.nameClass)}>{name}</span>
        {supersedes && (
          <span className="text-[10px] text-muted-foreground truncate">
            Replaces: {supersedes}
          </span>
        )}
        {errorText && <span className="text-red-400 text-[10px] truncate">{errorText}</span>}
      </span>
      {trailingSlot}
      {sizeBytes != null && (
        <span className={d.sizeClass}>
          {formatBytes(sizeBytes)}
          {metaSuffix ?? ""}
        </span>
      )}
      {trailing === "download" && <Download className={d.trailingClass} aria-hidden="true" />}
      {trailing === "spinner" && (
        <Loader2 className={cn(d.trailingClass, "animate-spin")} aria-hidden="true" />
      )}
      {isDead && (
        // ⚠ THIS IS A `<span>`, NEVER A `<button>`, AND THAT IS NOT AN
        // AESTHETIC CHOICE. `WorkflowRunPage.test.tsx:991` asserts
        // `expect(region.querySelectorAll("button")).toHaveLength(0)` for the
        // id-less deliverable row. When plan 06 unifies that row onto this
        // component the row GAINS this affordance, and the only reason that
        // shipped absence fence keeps holding is that the affordance is not a
        // button. It must not read as luck, so it is written here in words: a
        // dead affordance is a STATEMENT OF FACT, not a control — there is
        // nothing to activate, so there is nothing to focus. `aria-disabled` is
        // a PRESENTATIONAL guard and never an authorization one (T-195-03-04);
        // this component performs no download and is handed no thread id or
        // file id, so it cannot be induced to fetch across a boundary.
        <span
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium flex-shrink-0",
            "border-red-500/40 bg-red-500/10 text-red-400 cursor-not-allowed",
          )}
          aria-disabled="true"
          title={DEAD_TITLE}
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          {DEAD_LABEL}
        </span>
      )}
    </Comp>
  )
})

FileRow.displayName = "FileRow"
