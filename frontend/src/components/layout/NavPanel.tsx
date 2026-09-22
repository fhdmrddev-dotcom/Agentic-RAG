import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Sparkles, Shield, Menu, Receipt, type LucideIcon } from "lucide-react"
import { ProfileMenu } from "./ProfileMenu"
// Phase 166 Plan 05 (ADMIN-01 / D-166-05): NavPanel is inside OrgProvider in the app,
// so the indigo org-admin shield reads `canManage` via the non-throwing useOrgOptional()
// — render-only (the backend gate is the wall) and null-safe where no provider is mounted.
import { useOrgOptional } from "@/providers/OrgProvider"
import type { ActiveView } from "@/App"
// Phase 103 (REQ-7) — the single shared nav source (kills the triplication).
// Phase 148 (VIS-01 / D-04): the rail renders the effective-features-FILTERED
// `navItems` prop threaded from App (governed items already vanished per sketch
// 069-A) — NOT the raw NAV_ITEMS const — so a non-operator's rail hides the same
// governed features the mobile drawer does. Render-only; the API is the wall.
import type { NavItem } from "@/lib/nav-items"
// Phase 235 plan 09 (SURF-03): the badge's words and its popover. ⚠ The TYPE only — the
// registry that produces the conditions is read by `ChatLayout`, never here.
import type { AttentionCondition } from "./attentionConditions"
import { AttentionPopover } from "./AttentionPopover"

// Phase 156 (POLISH-01 / D-01, D-07, Wave 1): NavPanel is a PERMANENT icon rail —
// logo → New Chat (+) → nav icons → footer icons. The old collapsible w-64↔w-16 column
// (which MASKED its content, incl. New Chat + the thread list, on collapse — the
// SEED-045 Anchor-1 bug) is gone: the whole thread region moved to the dedicated
// `ChatHistoryColumn` (D-09), so this rail is stream-free and its growth can NEVER hide
// New Chat on any view — SC#1 by construction.
//
// Phase 156 REFINEMENT (operator 2026-07-16, sketch-left-layout Variant A): the rail
// still defaults to the thin 58px icon spine, but a deliberate ☰ click now EXPANDS it
// to ~210px with labels beside every icon — so the operator can "unfold it and see it
// fully" (their concern a). It is PINNED (never hover — the annoyance they flagged) and
// its open/closed choice is remembered by the parent (`nav_rail_expanded`, owned in
// ChatLayout; this component stays pure/presentational). Collapsed icons keep their
// hover tooltips; expanded rows drop the tooltip since the label is already visible.

interface Props {
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  // Phase 148 (VIS-01 / D-04): the effective-features-FILTERED nav list from App —
  // governed items the caller can't use are already dropped (the vanish, never a
  // locked/badged item). The operator shield stays OUTSIDE this list (isOperator).
  navItems: readonly NavItem[]
  // Phase 146 (ADMIN-01 / D-07): the App-level probe result, render-only. When true,
  // the amber operator shield renders at the rail bottom; when false/loading it
  // renders NOTHING (no placeholder, no reserved space). The shield lives OUTSIDE the
  // shared NAV_ITEMS array (a regression test locks that), so the array never leaks
  // the surface.
  isOperator: boolean
  // Phase 156 (D-02): the rail's New Chat (+) — reachable from EVERY view. Fires
  // onNewThread() then switches to chat, so "New Chat from Settings" works.
  onNewThread: (folderId?: string | null) => void
  onSignOut: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
  // Phase 156 REFINEMENT: the pinned ☰ expand/collapse state (icons ⇄ labels). Parent-
  // owned + persisted so this component stays pure; false = the default 58px icon rail.
  expanded: boolean
  onToggleExpanded: () => void
  // ── Phase 235 plan 09 (SURF-03 / D-235-01 / D-235-04) ────────────────────────────────
  //
  // The app-shell attention signal. ⛔ THIS COMPONENT IS A RENDERER, NOT A READER: the
  // conditions arrive as a PROP, resolved ONCE by `ChatLayout` from the producer registry.
  // A second read here would poll the verdict twice per render tree and the two answers
  // would eventually disagree about the same source — the exact failure D-235-05 exists to
  // prevent. `attentionConditions.ts` is deliberately NOT imported by this file.
  attentionConditions?: readonly AttentionCondition[]
  // The one door the popover opens. ⚠ When it is absent NOTHING renders — no badge and no
  // popover — so a caller that has not wired it gets silence rather than a dead control.
  onOpenLibraryHealth?: () => void
}

// One rail control, two renderings. Collapsed → a 40px icon square wrapped in a
// hover tooltip (the label lives in the tip). Expanded → a full-width row with the
// icon + a visible label, tooltip dropped (redundant). `className` carries the
// tone-specific colours (primary New-Chat wash, active highlight, amber shield, …).
function RailItem({
  expanded,
  icon: Icon,
  label,
  active,
  onClick,
  className,
  badge,
  testId,
}: {
  expanded: boolean
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
  className?: string
  // Phase 235 plan 09 (SURF-03 / D-235-04): a GENERIC decoration slot. This component does
  // not know what a badge MEANS, exactly as it does not know what `className` means — the
  // caller decides the tone and the content, and there is no branch here on either. That is
  // the shape the `className` prop above already established; a per-tenant `attentionCount`
  // prop would have put the shell's vocabulary inside a presentational rail control.
  //
  // ⛔ WHATEVER GOES IN HERE MUST BE `aria-hidden`. The button below carries
  // `aria-label={label}`, and a visible descendant text node RENAMES the control:
  // `IngestionTab.tsx:176-188` records the measurement — six `getByRole` cases broke when a
  // tab's accessible name became "In progress 3". A badge may decorate a control's name; it
  // may not rename it.
  badge?: React.ReactNode
  // The composition hook (screen prefix `rail`). Defaulted, so every rail control carries one
  // and the Library item can carry its own distinct kind.
  testId?: string
}) {
  const button = (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-testid={testId ?? "rail-rail-item"}
      className={cn(
        // `relative` is load-bearing: it is what an absolutely-positioned badge anchors to,
        // and it must hold at the 40px collapsed size as well as the full-width expanded row.
        "relative flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        expanded ? "w-full justify-start gap-3 px-3" : "w-10 justify-center",
        className,
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="text-sm font-medium truncate">{label}</span>}
      {badge}
    </button>
  )
  if (expanded) return button
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
    </Tooltip>
  )
}

export function NavPanel({
  activeView,
  onNavigate,
  navItems,
  isOperator,
  onNewThread,
  onSignOut,
  theme,
  onToggleTheme,
  expanded,
  onToggleExpanded,
  attentionConditions,
  onOpenLibraryHealth,
}: Props) {
  const isControlRoom = activeView === "control-room"
  // Phase 257.1 — mirrors the isControlRoom/isOrgAdmin actives above; see the rail entry below.
  const isAdminSpend = activeView === "admin-spend"
  const isOrgAdmin = activeView === "org-admin"
  // Phase 166 (ADMIN-01 / D-166-05): the render-only org-manage flag from OrgProvider.
  // useOrgOptional is non-throwing → null (canManage=false) where no provider is mounted.
  const canManage = useOrgOptional()?.canManage ?? false

  // ── Phase 235 plan 09 (SURF-03 / D-235-04) — the app-shell signal, resolved once here ──
  //
  // ⛔ NOTHING IS DERIVED. `attentionConditions` already carries the SERVER's verdict, with
  // the soft-failure debounce applied server-side (D-235-05). A healthy instance, and an
  // instance where one check failed and the next recovered, both arrive as an EMPTY array —
  // so both render nothing, and SC#4's *"a person who has ignored it once has not been
  // trained to ignore it always"* is honoured by having no second decider at all.
  const attention = attentionConditions ?? []
  // The navigator is what makes the signal actionable; without it there is nothing to open,
  // so a badge would be a control that does nothing. Silence is the honest answer.
  const showAttention = attention.length > 0 && Boolean(onOpenLibraryHealth)
  // ⚠ The count is the non-colour carrier and the sentence lives on the trigger's accessible
  // name — the design skill's word-badge rule (*the WORD carries the meaning; tone is
  // decoration*). No glyph is invented here: §4 records that inventing one teaches a
  // vocabulary the product does not have.
  // ⛔ THE WARNING TOKEN, NEVER THE DANGER ONE — sketch 233 §9 forbids the danger tone on a
  // source state, and the composition fence found a live violation of exactly that rule
  // elsewhere in this phase. ⚠ The forbidden token is named here in WORDS rather than spelled,
  // because a grep for it is one of this plan's acceptance measurements and a comment that
  // repeats a literal makes a code measurement satisfiable by prose (the 235-08 / 187-24
  // lesson, recorded twice in this phase now).
  // ⛔ THE BADGE ANCHORS DIFFERENTLY IN THE TWO RAIL WIDTHS, and one position cannot serve
  //    both (operator, 2026-09-09: *"the tag on the library in the navigation menu is not
  //    center aligned"*).
  //
  //    COLLAPSED the row is a 40×40 icon button, so `-top-1 -right-1` is the ordinary
  //    notification-dot corner and reads correctly. EXPANDED the row is a full-width 40px-tall
  //    strip with the label beside the icon — the same corner throws the badge to the far
  //    top-right, floating above the text baseline instead of sitting on it.
  //
  // ⚠ So it is CENTRED VERTICALLY when expanded and left as a corner mark when collapsed.
  //   `top-1/2 -translate-y-1/2` centres against the row rather than guessing an offset, which
  //   keeps holding if the row height ever changes.
  const attentionBadge = showAttention ? (
    <span
      data-testid="rail-badge"
      aria-hidden="true"
      className={cn(
        "absolute min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-[18px] text-center",
        expanded ? "right-3 top-1/2 -translate-y-1/2" : "-top-1 -right-1",
      )}
    >
      {attention.length}
    </span>
  ) : undefined

  return (
    // Phase 244 plan 09 (SHELL-01 / BUG-260828-08, gap G-5) — THE RAIL BOUNDS ITSELF.
    //
    // Measured in Chrome 2026-09-12: below a viewport height of ~540px the PAGE ROOT overflowed
    // (h=436 → #root scrollHeight 540 vs clientHeight 436, +104px; h=516 → +24px) and the whole
    // page scrolled. The overflowing element was THIS rail, not the transcript and not the panel
    // — the auto-margin footer block below measured bottom=540px, past the rail's own box, and
    // every ancestor up to <html> read `overflow-y: visible`, so the excess escaped to the page.
    //
    // ⭐ THE OVERFLOW RULE IN THE CLASS LIST BELOW (`overflow-y: auto`) IS THE FIX. This box is
    //    ALREADY bounded at the viewport (`h-full` inside `div.flex.h-screen`, measured
    //    height = viewport); the content escaped purely because the computed overflow was
    //    `visible`. With the rule, the rail scrolls its OWN content instead of the document.
    // ⭐ THE AUTOMATIC-MINIMUM-SIZE OVERRIDE BESIDE IT IS DEFENSIVE, not the fix — carried for
    //    symmetry with the five sites 244-01 established in the message column, and because that
    //    rule is direction-dependent. It costs nothing and removes a future question. Saying
    //    which of the two does the work matters: a comment that claims more than it can is its
    //    own defect.
    //    ⚠ 244-14 (review WR-05) — THIS SENTENCE USED TO SPELL THE TOKEN VERBATIM, WHICH MADE
    //    THE NOTE BELOW FALSE ABOUT ITSELF. `grep -c` read 2, not 1, and `244-09-SUMMARY`'s
    //    acceptance table published the other two tokens and omitted this one — so the table
    //    read clean on precisely the count the edit had broken. The token is now named by its
    //    CSS DECLARATION, the way the load-bearing one already is, and the SUMMARY carries the
    //    third row. ⛔ The remedy was never to loosen the grep: this is the 187-24 vacuity class
    //    reproduced inside the comment that cites 187-24.
    // ⛔ DO NOT "fix" this with a min-height on the page, #root or any ancestor — that makes the
    //    page scroll deliberately, which IS the bug.
    // ⛔ DO NOT shrink, re-order or delete the auto-margin footer block below. The footer is not
    //    too big; the rail could not scroll.
    //
    // Pinned by link 6 of `__tests__/ChatLayout.scrollFrame.test.tsx`. ⚠ That fence is a presence
    // assertion only (jsdom performs no layout); the pixels are `244-09-UAT-ROW.md`.
    // ⚠ The three class tokens are deliberately NOT spelled out verbatim in this comment:
    //    `244-09`'s acceptance counts their occurrences in this file with `grep -c`, and a comment
    //    mention would inflate that count and blind the check to a real second application.
    //    ⛔ MEASURED 2026-09-12 (244-14 / WR-05): this note was FALSE about one of the two when
    //    written — the count read 2. All three now read 1, and the SUMMARY publishes all three
    //    rather than the two that happened to be clean.
    <div
      className={cn(
        "hidden md:flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden shrink-0 bg-sidebar border-r border-border/20 py-3 motion-safe:transition-[width] motion-safe:duration-300",
        expanded ? "w-[210px] items-stretch px-2" : "w-[58px] items-center",
      )}
    >
      {/* Logo + the ☰ expand/collapse toggle. Collapsed → stacked & centered; expanded
          → logo left, toggle flush right (sketch Variant A .rail-toggle self-end). */}
      <div
        className={cn(
          "flex shrink-0",
          expanded ? "items-center justify-between w-full mb-1" : "flex-col items-center gap-1.5",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {/* PINNED toggle (never hover) — the label-reveal the operator asked for. The
            aria-label flips Expand⇄Collapse; the parent persists the choice. */}
        <button
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={expanded}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Menu className="w-[18px] h-[18px] shrink-0" />
        </button>
      </div>

      {/* New Chat (+) + the primary nav items. */}
      <div className={cn("flex flex-col gap-1 mt-4 flex-1", expanded ? "items-stretch" : "items-center")}>
        {/* Phase 156 (D-02 / SC#1): New Chat lives permanently on the rail — no state
            can hide it. From a non-chat view it also switches to chat. */}
        <RailItem
          expanded={expanded}
          icon={Plus}
          label="New chat"
          onClick={() => {
            onNewThread()
            onNavigate("chat")
          }}
          className="text-primary bg-primary/10 hover:bg-primary/20"
        />

        {navItems.map(({ view, icon, label }) => {
          // ⭐ The Library's `ActiveView` value is `"documents"`, not `"library"` — the page
          //    was renamed, the union member was not (`renameFence.test.ts` guards that).
          const isLibrary = view === "documents"
          const item = (
            <RailItem
              key={view}
              expanded={expanded}
              icon={icon}
              label={label}
              active={activeView === view}
              onClick={() => onNavigate(view)}
              testId={isLibrary ? "rail-rail-item-library" : "rail-rail-item"}
              badge={isLibrary ? attentionBadge : undefined}
              className={
                activeView === view
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
              }
            />
          )
          if (!isLibrary) return item
          // The popover anchors to the rail item, so the item gets a positioned wrapper. The
          // trigger is a SIBLING of the rail button rather than a child of it — a nested
          // button is invalid markup, and a trigger wrapped around the rail item would make
          // every Library click open a panel instead of going to the Library.
          return (
            <div key={view} className="relative">
              {item}
              {showAttention && onOpenLibraryHealth && (
                <AttentionPopover
                  conditions={attention}
                  onOpenLibraryHealth={onOpenLibraryHealth}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer: the org + operator shields, then the merged ProfileMenu identity anchor.
          Phase 166 (079-C): theme + Sign out moved INTO the ProfileMenu popover — there is
          no standalone theme RailItem and no bare Sign out RailItem here anymore. */}
      <div className={cn("flex flex-col gap-1 mt-auto", expanded ? "items-stretch" : "items-center")}>
        {/* Phase 166 (ADMIN-01 / D-166-05): the indigo org-admin Shield-mirror — the
            user-side mirror of the operator shield, sitting directly parallel to it
            (079-C). Same lucide Shield glyph, re-tinted org-INDIGO (never the operator
            zone's reserved warning tint). Rendered ONLY when canManage; honestly ABSENT
            (never disabled) for a member. Kept OUTSIDE navItems (the D-07 contract holds for
            the org shield too), active-highlights when in the org-admin shell. */}
        {canManage && (
          <RailItem
            expanded={expanded}
            icon={Shield}
            label="Organization admin"
            active={isOrgAdmin}
            onClick={() => onNavigate("org-admin")}
            className={
              isOrgAdmin
                ? "bg-indigo-500/15 text-indigo-400"
                : "text-indigo-400/80 hover:text-indigo-400 hover:bg-indigo-500/10"
            }
          />
        )}

        {/* Phase 146 (ADMIN-01 / D-07): the probe-gated operator shield. Amber lucide
            Shield (distinct from Governance's ShieldCheck), active-highlights when in
            the Control Room. Rendered ONLY when isOperator, and OUTSIDE navItems (the
            D-07 non-discoverable contract — nothing rendered for non-operators). */}
        {isOperator && (
          <RailItem
            expanded={expanded}
            icon={Shield}
            label="Control Room"
            active={isControlRoom}
            onClick={() => onNavigate("control-room")}
            className={
              isControlRoom
                ? "bg-amber-500/15 text-amber-400"
                : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
            }
          />
        )}

        {/* ── Phase 257.1 (METER-07 reachability) — THE THIRD LEG OF THE TRIAD ───────────
            Phase 257 shipped the `admin-spend` ActiveView (App.tsx:107) and its ChatLayout
            mount branch (:979) and NO ENTRY ACTION, so the only way to reach the spend
            cockpit was to TYPE `/admin/spend` into the address bar. Operator, on seeing it:
            *"this page is not available to navigate from the app, I have to navigate
            manually to /admin/spend."* That is verbatim the Phase-118 built-but-unreachable
            lesson this file's sibling comment already names, recurring one surface over.

            ⛔ OUTSIDE `navItems`, BESIDE Control Room, and that placement is not cosmetic.
            `nav-items.test.ts` LOCKS `NAV_ITEMS` to carry no operator view (D-07's
            non-discoverable contract: nothing is rendered at all for a non-operator, never a
            disabled or badged placeholder), and `NAV_ITEMS` also feeds ChatLayout's mobile
            drawer — an entry there would leak an operator surface to every member.
            `isOperator` is the same probe that gates the two shields above.

            The glyph is `Receipt` — distinct from both Shields (Control Room / Org admin)
            and from Governance's ShieldCheck, per the icon convention: a rail glyph is not
            reused across two homes. Emerald matches the spend surface's own rated-cost
            colour rather than borrowing the amber that means "operator" on the shield. */}
        {isOperator && (
          <RailItem
            expanded={expanded}
            icon={Receipt}
            label="Spend"
            active={isAdminSpend}
            onClick={() => onNavigate("admin-spend")}
            className={
              isAdminSpend
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10"
            }
          />
        )}

        {/* Phase 166 (ADMIN-03 / ADMIN-05 / 079-C): the merged rail-footer identity anchor
            (identity + role badge + org switcher at 2+ orgs + theme + Sign out). Replaces
            the bare Sign out RailItem; still receives theme/onToggleTheme/onSignOut and
            forwards them. `collapsed` mirrors the rail's icon-spine state. */}
        <ProfileMenu
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSignOut={onSignOut}
          collapsed={!expanded}
        />
      </div>
    </div>
  )
}
