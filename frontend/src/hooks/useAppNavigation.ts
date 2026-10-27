import { useCallback, useState } from "react"
// Type-only: `ActiveView` stays exported from App.tsx on ONE line (D-38 — the docs-coverage gate
// and the renameFence needle read it there). Erased under `verbatimModuleSyntax`, so this is
// not a runtime cycle (the ChatLayout precedent).
import type { ActiveView } from "@/App"
import type { StudioTab } from "@/pages/SkillStudioPage"
// Phase 235-08 (SURF-03): the Library's own tab union, so the payload below is typed by the
// SAME source the page reads rather than by a second string literal beside it.
import type { LibraryTab } from "@/pages/librarySelection"
// Phase 235 plan 15 (gap-closure round 1): the hand-off's LIFETIME rule, as a strict leaf.
import { libraryTabAfterNavigate } from "@/lib/libraryTabHandoff"
import { readRunDeepLink } from "@/lib/runDeepLink"

export interface AppNavigation {
  /** The view on screen — one `ActiveView` member. */
  activeView: ActiveView
  /** The app's navigator: sets the view AND spends a pending Library hand-off (the
   *  `libraryTabAfterNavigate` rule). Every `onNavigate("…")` call site in the tree reads this. */
  onNavigate: (next: ActiveView) => void
  /** The 403 visibility bounce home. Sets the view only — it does NOT spend the Library
   *  hand-off, exactly like the bare setter App's listener called before this hook existed.
   *  Stable identity, so App's listener effect does not re-subscribe on every render. */
  bounceHome: () => void
  /** The skill the Skill Studio is open on, or `null` before any studio entry. */
  studioSkillId: string | null
  /** The Skill Studio's active tab. */
  studioTab: StudioTab
  /** Open the Skill Studio on a skill (default tab: evals). */
  handleOpenStudio: (skillId: string, tab?: StudioTab) => void
  /** Open the Skill Studio on the Evals tab. */
  handleReviewEvals: (skillId: string) => void
  /** Change only the Skill Studio's tab. */
  handleStudioTabChange: (tab: StudioTab) => void
  /** Legacy Tuner door: open the Skill Studio on the Triggering tab. */
  handleTuneSkill: (skillId: string) => void
  /** The one-shot Library tab hand-off; `undefined` means "the page decides". */
  libraryTab: LibraryTab | undefined
  /** The attention route: hand the Library its Health tab and open it. */
  handleOpenLibraryHealth: () => void
}

/**
 * Phase 297 plan 01 (REG-09 / D-01) — App's view/tab state and its navigators, moved out of
 * `App.tsx` VERBATIM along the seam `docs/HOT-FILE-LEDGER.md` § `frontend/src/App.tsx` named.
 *
 * Behaviour-neutral by contract: every body below is the code App shipped, byte-for-byte, and
 * it is still plain `useState` — no address is read beyond the boot initializer App already had.
 * App calls this ONCE, at the position its first view `useState` used to hold, before any early
 * return (rules of hooks). The return shape is what ChatLayout already received as props, so no
 * navigator call site changes. Plan 297-02 derives `activeView` from the address here; router
 * hooks are called in this module and nowhere below it (D-08).
 *
 * ⚠ `setLibraryTab(` has EXACTLY two writers, both in this module, counted over comment-stripped
 * code by `LibraryPage.tabAttention.test.tsx` (D-297-08). The Library hand-off comment block
 * below travelled WITH the state it describes, unedited: `LibraryPage.initialTab.test.tsx` uses a
 * phrase inside it as its stripper non-vacuity control (D-297-07).
 */
export function useAppNavigation(): AppNavigation {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    // Phase 257 (METER-07): /admin/spend route
    if (typeof window !== "undefined" && (window.location.pathname === "/admin/spend" || window.location.pathname.startsWith("/admin/spend"))) {
      return "admin-spend"
    }
    // Phase 289-04 (SC#3): `/app?run=<uuid>` opens that run's page on boot. The query is KEPT
    // (no replaceState) so a reload stays on the run; the reader accepts a strict UUID only.
    if (readRunDeepLink()) return "workflow-run"
    // BUG-260903-01 / SEED-185: both OAuth callbacks land on `/app?connections=1&…`, and until
    // 2026-09-03 nothing read it — the person arrived on Chat with their result in the URL.
    // Read once, land on Connections, and drop the query so a reload does not re-route.
    const q = new URLSearchParams(window.location.search)
    if (q.get("connections") !== "1") return "chat"
    window.history.replaceState(null, "", window.location.pathname)
    return "connections"
  })
  // Phase 137-06 (PANEL-01 / D-01 / sketch 057-A): the unified Skill Studio is a
  // focused full-surface entered WITH a skillId + a tab (mirroring the shipped Tuner
  // ActiveView precedent — no router). App holds the selected-skill + active-tab state
  // and the navigators; all thread to ChatLayout so the reachability triad (ActiveView
  // union + the ChatLayout mount branch + the SkillsPage entry action) is owned
  // in-phase (the Phase-118 built-but-unreachable lesson). The single "Open studio"
  // button lives in the slim detail panel (Plan 07); this plan defines + threads the
  // navigators. The legacy Trigger Tuner is ABSORBED as the Studio's Triggering tab:
  // the "Tune triggers" / lint "Tune this →" handoff (handleTuneSkill) REDIRECTS to
  // Studio · Triggering (D-01 no orphan Tuner surface / D-06 lint re-point).
  const [studioSkillId, setStudioSkillId] = useState<string | null>(null)
  const [studioTab, setStudioTab] = useState<StudioTab>("evals")
  const handleOpenStudio = (skillId: string, tab: StudioTab = "evals") => {
    setStudioSkillId(skillId)
    setStudioTab(tab)
    setActiveView("skill-studio")
  }
  const handleReviewEvals = (skillId: string) => handleOpenStudio(skillId, "evals")
  const handleStudioTabChange = (tab: StudioTab) => setStudioTab(tab)
  // Legacy redirect (D-01 / D-06): the shipped "Tune triggers" + lint "Tune this →"
  // callers land in Studio · Triggering — no standalone Tuner surface remains.
  const handleTuneSkill = (skillId: string) => handleOpenStudio(skillId, "triggering")

  // Phase 235-08 (SURF-03 / D-235-04 / T-235-27): the Library's tab, held HERE beside
  // `activeView` and set by ONE navigator — the exact shape of `handleOpenStudio` above.
  //
  // ⛔ NO TWELFTH `ActiveView` MEMBER. The Library already has one, and the comment above
  // the union records that a member is not reachability. What was missing was never a view:
  // `LibraryPage`'s only prop was `onNavigate`, so the Health TAB had no external door at
  // all, and SURF-03's route (rail badge → popover → Health → source card) was impossible.
  //
  // ⚠ THIS REFUSAL IS PLAN-SCOPED AND STANDS UNCHANGED; Phase 262's member is NOT the thing
  // it refuses. 235-08 was refused a member because the surface it wanted ALREADY HAD ONE and
  // only lacked a door into one of its tabs. Phase 262's is a net-new top-level home with no
  // existing surface to enter — the `skill-studio` / `control-room` case, not this one — and
  // it ships with its ChatLayout branch and its rail entry in the same commit. ⛔ ITS LITERAL
  // IS DELIBERATELY NOT SPELLED HERE (D-262-04), for the identical reason the line below gives
  // about the URL API: an acceptance fence counts occurrences in this file, so prose naming it
  // would make a code measurement satisfiable by a comment (the 187-24 lesson). ⛔ AND DO NOT
  // DELETE THIS BLOCK TO "TIDY" IT: `LibraryPage.initialTab.test.tsx:502-503` uses the phrase
  // three lines up as its comment-stripper NON-VACUITY CONTROL — the pair that reds when the
  // stripper starts returning "" and silently turns every absence assertion in that suite green.
  //
  // ⛔ AND NO URL. This app has no router (`SEED-185`), so assigning the browser's location
  // here would be a full page reload onto a path that renders the chat home. ⚠ THAT API IS
  // DELIBERATELY NOT SPELLED IN THIS COMMENT: the acceptance criterion greps this file for
  // it, and prose that names it would make a code measurement satisfiable by a comment (the
  // 187-24 lesson, which `App.tsx:91-101` above already records once). `undefined` means
  // "the page decides", so the Library keeps its own default on every other entry into it.
  const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>(undefined)
  const handleOpenLibraryHealth = () => {
    setLibraryTab("health")
    setActiveView("documents")
  }
  // ⛔ Phase 235 plan 15 (gap-closure round 1 · verification G5) — AND IT IS ONE-SHOT.
  //
  // The line above was the ONLY write to `libraryTab` when 235-08 shipped, and the comment
  // above it claimed a behaviour nothing enforced: `LibraryPage` is mounted inside a ternary
  // in `ChatLayout`, so it UNMOUNTS on navigation away and re-seeds its reducer from
  // `initialTab` at every mount. After ONE click on the attention popover, every subsequent
  // entry into the Library opened on Health — the claim two paragraphs up, falsified by the
  // code beneath it. The clear belongs to the NAVIGATOR, not to a second writer: the hand-off
  // survives the trip INTO the Library and is spent by the next navigation anywhere else
  // (`libraryTabAfterNavigate` owns that rule and is tested without mounting anything).
  const handleNavigate = (next: ActiveView) => {
    setActiveView(next)
    setLibraryTab((pending) => libraryTabAfterNavigate(pending, next))
  }
  // Phase 297-01: the 403 visibility bounce's setter, kept exactly as App's listener called it —
  // the view only, never the hand-off (it bypassed `handleNavigate` before the move, too).
  const bounceHome = useCallback(() => setActiveView("chat"), [])

  return {
    activeView,
    onNavigate: handleNavigate,
    bounceHome,
    studioSkillId,
    studioTab,
    handleOpenStudio,
    handleReviewEvals,
    handleStudioTabChange,
    handleTuneSkill,
    libraryTab,
    handleOpenLibraryHealth,
  }
}
