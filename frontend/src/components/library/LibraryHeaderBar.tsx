/**
 * Sketch 231 variant **A**, locked by the operator 2026-09-05 — the Library's one header row.
 *
 * ⭐ **212px → ~46px, and the arithmetic is the point.** The shipped header stacked four blocks
 * before a single functional pixel — title + sub-line (~62px), breadcrumb (~38px), the primary tab
 * strip (~56px), and the child tab strip (~56px) — **every one of them left-aligned inside a
 * full-width page, so 48% of that band was empty.** The operator marked exactly that rectangle on
 * a screenshot. This component is the reclaim: title, tabs and the queue pill share ONE row.
 *
 * ── ⛔ THE BREADCRUMB IS DELETED, AND THAT IS A DECISION ─────────────────────────────────────
 *
 * `LibraryBreadcrumb` rendered *Library › Documents* while the sidebar already said **Library**
 * and the tab already said **Documents**. Pure duplication. It carried information only when a
 * folder was selected — and the folder rail is showing that selection two inches below, which is
 * where a person is already looking. ⚠ If a future phase wants folder context in the header, it
 * belongs **inside this row**, not above it.
 *
 * ── ⚠ WHAT THIS COMPONENT DOES NOT CLAIM ────────────────────────────────────────────────────
 *
 * The sketch's variant A says the pill *"lives on the shell, so it survives leaving the page"*.
 * **It does not yet.** This renders inside `LibraryPage`, so navigating to Chat unmounts it. The
 * honest position is stated here rather than implied by a pill that looks persistent: making it
 * true means lifting it to `App.tsx` (above the route) with its own poll, which is a separate
 * change. ⛔ **Do not describe this pill as surviving navigation until it does.**
 *
 * ── the child tabs are NOT here, deliberately ───────────────────────────────────────────────
 *
 * They belong to whichever tab body owns them (`IngestionTab` has four). The operator caught the
 * first sketch cut deleting them: *"where are the children mini that was under ingestion"*.
 * **Folding a parent strip into one row is a space saving; swallowing its children is a lost
 * surface** — so the parents collapse here and the children stay where they are.
 */
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface LibraryHeaderBarProps {
  /** The active primary tab. */
  tab: string
  /** Ordered [value, label] pairs — five today. */
  tabs: ReadonlyArray<readonly [string, string]>
  onSelectTab: (next: string) => void
  /** ⛔ The page's one-line contract. It is GUARDED — `renameFence.test.ts` reads it out of the
   *  page source to prove the Documents→Library rename actually landed — so it may not be
   *  deleted to save space. In a single row it costs no vertical at all; it was only expensive
   *  as its own stacked block. */
  subtitle?: string
  /** Documents currently pending or processing. `0` renders the resting state. */
  inFlight: number
  /** Total documents, shown at rest so the row is never empty on the right. */
  totalDocuments?: number
  /** Where the pill lands. It must go somewhere — a control that lights up and goes nowhere is
   *  what sketch 231 fixed in its own variant C. */
  onOpenQueue: () => void
  /** The `<screen>-tabslist` shell hook (217.1-18). It rides on the VISIBLE control, because
   *  after this change there is only one. */
  listTestId?: string
  /**
   * Phase 244 plan 04 (SHELL-05 · BUG-260911-03) — HOW MANY THINGS EACH TAB OWES ATTENTION.
   *
   * The app-shell badge names a count and stops at the Library door; the operator's complaint
   * was that *"the badge creates a question it then refuses to answer"*. **The shell says THAT;
   * this row says WHERE.**
   *
   * ⚠ A tab that is absent — or `0` — renders NOTHING. No zero badge, no reserved space, no
   * dimmed dot. The resting Library is byte-identical to before.
   *
   * ⛔ This component DERIVES nothing and FETCHES nothing. It is handed a map, exactly as it is
   * handed `tabs` and `inFlight`. The verdict is the server's (`D-235-05`).
   */
  attention?: Readonly<Record<string, number>>
  className?: string
}

export function LibraryHeaderBar({
  tab,
  tabs,
  onSelectTab,
  subtitle,
  inFlight,
  totalDocuments,
  onOpenQueue,
  listTestId,
  attention,
  className,
}: LibraryHeaderBarProps) {
  const live = inFlight > 0

  return (
    <div
      data-testid="library-headerbar"
      className={cn(
        "flex items-center gap-4 flex-none border-b border-border/50 px-1 pb-3 mb-4",
        className,
      )}
    >
      {/* ⚠ `text-2xl`, matching every other page — MEASURED, not guessed: SettingsPage,
          WorkflowsPage and SkillsPage all use it. The first cut of this row shrank the title to
          `text-base` to save height, which made the Library the one page whose name was smaller
          than its siblings'. **Collapsing four stacked blocks into one row is the space saving;
          shrinking the page's own name is not** — the row is already only as tall as its tallest
          child, so the title costs nothing extra here. */}
      <h1 className="text-2xl font-headline font-bold text-foreground whitespace-nowrap">
        Library
      </h1>
      {/* ⚠ Hidden below `lg` rather than dropped: a row that wraps is a row that costs two rows,
          which would undo the reclaim this component exists for. */}
      {subtitle && (
        <p className="hidden lg:block truncate text-xs text-muted-foreground">{subtitle}</p>
      )}

      {/* The five primary tabs, as a segmented control rather than a full-width strip.
          ⛔ Written from `tabs` rather than hand-listed so the set cannot drift from the page. */}
      {/* ⚠ role="tablist"/"tab" lives HERE and nowhere else. The first cut kept the old
          `TabsList` hidden "to preserve the shell hook", which put TWO elements with
          role="tab" and the same name in the tree — `getByRole("tab", {name})` then threw
          `getMultipleElementsFoundError` in 41 cases. **A hidden duplicate of an interactive
          control is not a preserved contract, it is a second control.** The hook moved onto
          this element instead. */}
      <div
        role="tablist"
        data-testid={listTestId ?? "library-tabseg"}
        className="flex gap-0.5 rounded-lg border border-border/60 bg-card/60 p-0.5"
      >
        {tabs.map(([value, label]) => {
          // ⚠ Empty ⇒ render NOTHING. A `0` badge is a control that lights up to say there is
          // nothing to look at, and the reclaim this row exists for is exactly what that costs.
          const owed = attention?.[value] ?? 0
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              data-tab={value}
              onClick={() => onSelectTab(value)}
              className={cn(
                // `relative` anchors the mark below and is inert without it.
                "relative rounded-md px-3 py-1 text-xs transition-colors",
                tab === value
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {/* ⛔ `aria-hidden` IS NOT DECORATION — a badge may decorate a control's name, it
                  may NOT rename it. `IngestionTab.tsx:176-188` measured six `getByRole` cases
                  breaking when a tab's accessible name became "In progress 3", and there are
                  41+ `getByRole("tab", { name })` cases against THIS control. The count is what
                  a person SEES; the name a screen reader announces stays the tab's own.

                  ⚠ A COUNT, not a dot (D-244-15 left the draw to the builder). The shell has
                  already earned a number and the operator's own point is that *"the cost scales
                  the wrong way"* — a dot would throw that number away at exactly the moment it
                  starts being worth having. The warning tone and the pill shape are the SHIPPED
                  rail-badge vocabulary (D-244-18: this surface is operator-approved, so no new
                  mark is invented here). A source state is never drawn in the danger token. */}
              {owed > 0 && (
                <span
                  data-testid={`library-tab-attention-${value}`}
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-[16px] text-center"
                >
                  {owed}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ⭐ THE RECLAIMED CORNER DOES A JOB. The right half of this band was empty; it now carries
          the one fact that had no home — whether the Library is still reading anything. */}
      <button
        type="button"
        data-testid="library-queue-pill"
        data-live={live ? "true" : "false"}
        onClick={onOpenQueue}
        className={cn(
          "ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
          live
            ? "border-sky-500/50 bg-sky-500/10 text-sky-400"
            : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground",
        )}
      >
        {live ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {/* ⛔ "Reading", never "added". A file that is still being read is not in the Library
                yet, and the whole point of this row is to stop the surface saying it is. */}
            <span>
              Reading {inFlight} file{inFlight === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span>
            {typeof totalDocuments === "number"
              ? `${totalDocuments} document${totalDocuments === 1 ? "" : "s"}`
              : "Nothing reading"}
          </span>
        )}
      </button>
    </div>
  )
}
