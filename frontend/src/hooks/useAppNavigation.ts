import { useCallback, useEffect, useMemo, useRef, useState } from "react"
// Phase 297-02 (D-04 / D-08): the ONLY module in the tree that calls the router hooks. Every
// page and leaf keeps receiving navigators as props, so none of them needs a router to render.
import { useLocation, useNavigate } from "react-router"
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
// Phase 297-02 (D-11): the route table — the one home of the app's path vocabulary.
import { canonicalAddress, formatAppRoute, parseAppLocation, type AppRoute } from "@/lib/appRoutes"

export interface AppNavigation {
  /** The view on screen — one `ActiveView` member. */
  activeView: ActiveView
  /** The app's navigator: PUSHES the view's address (D-15). The view already on screen is a
   *  no-op (no duplicate history entry). Every `onNavigate("…")` call site in the tree reads this. */
  onNavigate: (next: ActiveView) => void
  /** The 403 visibility bounce home: REPLACES the current entry with `/app` (D-15), so Back does
   *  not return to the refused surface. Stable identity, so App's listener effect does not
   *  re-subscribe on every render. Since 297-02 it spends the Library hand-off like any other move
   *  to chat — the clear is keyed on the derived view so that a POP spends it too (Pitfall 5). */
  bounceHome: () => void
  /** The run on screen (`/app/runs/<id>`), or `null`. A `workflow_runs.id`, lowercased. */
  runId: string | null
  /** True when the address names nothing the app opens (D-14). The view then reads "chat". */
  addressNotFound: boolean
  /** Open a run's page by its `workflow_runs.id` — pushes `/app/runs/<id>`. */
  openRun: (runId: string) => void
  /** The skill the Skill Studio is open on (from `/app/skills/<id>`), or `null` off the studio. */
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
 * ⚠ CORRECTED 2026-10-27 (Phase 297-02) — THE PARAGRAPH ABOVE IS KEPT RATHER THAN OVERWRITTEN;
 * its first two sentences described 297-01 and are no longer true. The view, the run id and the
 * studio skill id are now DERIVED from the router's location through `parseAppLocation` (one
 * memo, no view state); the boot initializer is gone; one effect normalises a legacy or bare
 * address with a REPLACE (D-15, D-16). Navigators push, `bounceHome` replaces. The studio tab and
 * the Library tab stay component state — tab addresses are Phase 299.
 *
 * ⚠ `setLibraryTab(` has EXACTLY two writers, both in this module, counted over comment-stripped
 * code by `LibraryPage.tabAttention.test.tsx` (D-297-08). The Library hand-off comment block
 * below travelled WITH the state it describes, unedited: `LibraryPage.initialTab.test.tsx` uses a
 * phrase inside it as its stripper non-vacuity control (D-297-07).
 */
export function useAppNavigation(): AppNavigation {
  const location = useLocation()
  const navigate = useNavigate()
  // The address IS the view (D-07 / D-11). Total: an unknown address parses to not-found.
  const parsed = useMemo(
    () => parseAppLocation(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const addressNotFound = parsed.view === "not-found"
  const activeView: ActiveView =
    parsed.view === "not-found" || parsed.view === "pre-auth" ? "chat" : parsed.view
  const runId = parsed.view === "workflow-run" ? parsed.runId : null
  const studioSkillId = parsed.view === "skill-studio" ? parsed.skillId : null

  // The latest address, read by the navigators so they keep ONE identity across renders (App's
  // 403 listener depends on `bounceHome`). Synced after commit; every caller is an event handler.
  const here = useRef("")
  const lastRunId = useRef<string | null>(null)
  const lastSkillId = useRef<string | null>(null)
  useEffect(() => {
    here.current = `${location.pathname}${location.search}`
    if (runId) lastRunId.current = runId
    if (studioSkillId) lastSkillId.current = studioSkillId
  }, [location.pathname, location.search, runId, studioSkillId])

  // ONE normalising effect (D-13 / D-15 / D-16): a legacy alias or a bare prefix is REPLACED by
  // its canonical address, so Back never returns to the old shape. `canonicalAddress` answers
  // null for every address it must not touch (pre-auth, bare `/`, unknown, already canonical,
  // unknown params only), and the hash is carried across untouched (Pitfall 10: auth callbacks).
  useEffect(() => {
    const canonical = canonicalAddress(location.pathname, location.search)
    if (canonical === null) return
    const q = canonical.indexOf("?")
    const pathname = q < 0 ? canonical : canonical.slice(0, q)
    const search = q < 0 ? "" : canonical.slice(q)
    here.current = canonical
    void navigate({ pathname, search, hash: location.hash }, { replace: true })
  }, [location.pathname, location.search, location.hash, navigate])

  /** Navigate to a route; a no-op when it is the address already on screen (D-15). */
  const go = useCallback(
    (route: AppRoute, opts: { replace?: boolean } = {}) => {
      const target = formatAppRoute(route)
      if (target === here.current) return
      here.current = target
      void navigate(target, { replace: opts.replace === true })
    },
    [navigate],
  )

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
  // Phase 297-02: the selected skill is now the address (`/app/skills/<id>`); the tab stays state.
  const [studioTab, setStudioTab] = useState<StudioTab>("evals")
  const handleOpenStudio = (skillId: string, tab: StudioTab = "evals") => {
    setStudioTab(tab)
    go({ view: "skill-studio", skillId })
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
  //
  // ⚠ CORRECTED 2026-10-27 (Phase 297-02), beside the paragraph above rather than through it: the
  // app now HAS a router, and the Library's address is `/app/library`. The rule about the full
  // page reload still holds — a router navigation is not a reload — and the TAB still has no
  // address of its own (Phase 299), so the hand-off below is still component state.
  const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>(undefined)
  const handleOpenLibraryHealth = () => {
    setLibraryTab("health")
    go({ view: "documents" })
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
  //
  // ⚠ Phase 297-02 (Pitfall 5): the clear now runs on the DERIVED view rather than inside the
  // navigator. Back and Forward change the view without calling any navigator, so a clear that
  // lived in `handleNavigate` would let Back into the Library re-open the Health tab the person
  // had already left. The rule itself is unchanged and still owned by `libraryTabAfterNavigate`.
  // It runs while rendering, on the render where the view changes (React's "adjust state when
  // an input changes" pattern), so no frame ever shows a spent hand-off — an effect would paint
  // one frame with the stale tab first.
  const [viewSeen, setViewSeen] = useState<ActiveView>(activeView)
  if (viewSeen !== activeView) {
    setViewSeen(activeView)
    setLibraryTab((pending) => libraryTabAfterNavigate(pending, activeView))
  }
  const handleNavigate = (next: ActiveView) => {
    if (next === "workflow-run") {
      // A run view needs a run: return to the last one opened, or stay put.
      if (lastRunId.current) go({ view: "workflow-run", runId: lastRunId.current })
      return
    }
    if (next === "skill-studio") {
      if (lastSkillId.current) go({ view: "skill-studio", skillId: lastSkillId.current })
      return
    }
    go({ view: next })
  }
  const openRun = useCallback((id: string) => go({ view: "workflow-run", runId: id }), [go])
  // Phase 297-01 kept the 403 bounce as the bare view setter. Phase 297-02: a REPLACE to the
  // home address (D-15) — Back must not lead back to the surface the server just refused.
  const bounceHome = useCallback(() => go({ view: "chat" }, { replace: true }), [go])

  return {
    activeView,
    onNavigate: handleNavigate,
    bounceHome,
    runId,
    addressNotFound,
    openRun,
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
