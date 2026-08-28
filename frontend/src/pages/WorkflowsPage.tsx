/**
 * Phase 103-06 (REQ-7 / WFAUTH-04, sketch 021-A + 023-A) — the Workflows page:
 * the project-filtered browse + launch home (the three-homes contract's library
 * surface). NO router — the page is mounted by ChatLayout on
 * `activeView === "workflows"` and HOSTS the Builder (Plan 04) + the publish
 * gauntlet (Plan 05) as intra-page state (`"library" | "builder"`).
 *
 * The load-bearing contracts (the G-6 failure modes to avoid):
 *  - Workflows are a MODE of a thread, never page-resident. Run creates a NEW
 *    chat thread + kicks off a REAL server-side run (active_workflow_run_id set)
 *    + redirects into Chat — it reuses the EXISTING kickoff (createThread +
 *    sendMessage with workflow_definition_id), NEVER a bespoke /workflows/{id}/run
 *    (D-103-CONF-1). doRun is provided by ChatLayout via `onLaunch`.
 *  - A DRAFT cannot be Run (publish is the test — D12). Draft cards show Open✎ +
 *    Publish… only; the Run affordance is published-only.
 *  - Tweak forks a v(N+1) DRAFT via createWorkflowDraft (INSERT) — it NEVER
 *    UPDATEs the frozen published row (D12 / Pitfall 6).
 *  - The strictness-tier badge is DERIVED on every render from the real definition
 *    (citation_policy + the validator-kind set) via deriveTier — never a stored
 *    label (D10).
 *  - On a gauntlet PASS the view auto-returns to the library + surfaces a Run CTA
 *    on the new version (sketch 023-A).
 *
 * Honesty (D14 → 192-10 D-11): this paragraph used to claim that only the published-list read
 * and the publish write were live, and that the draft-CRUD affordances were therefore net-new.
 * ⚠ THAT CLAIM IS FALSE AND WAS MEASURED FALSE — all four draft-CRUD routes are live and gated
 * today (create, the drafts list, the update and the delete each carry the authoring
 * visibility dependency in `backend/app/api/workflows.py`), and three of their clients are
 * called from this very file. The banner that carried the claim to the user was DELETED rather
 * than re-worded, because a re-worded falsehood is a new falsehood. See the receipt at the
 * banner's old render site below.
 *
 * ⚠ Two endpoint literals in this file are deliberately DESCRIBED rather than spelled, and it
 * is not fastidiousness: D-11's mechanical check is a RAW SOURCE COUNT of the published-list
 * route string, so prose explaining that the string is absent would satisfy the very grep that
 * proves it absent. This is the trap 192-06, 192-08 and 192-09 each hit once, in three
 * different files. The ONE spelling that remains in this file is `NetNewFlag`'s tooltip, and
 * it is load-bearing: `WorkflowBuilderPage.header.test.tsx` pins the Builder breadcrumb band by
 * BYTE-EXACT `innerHTML` including that whole attribute. It is a Phase-193 residual, not 192's
 * — see `NetNewFlag`'s own docblock.
 */
// Phase 192-06 (D-01): `useMemo`, `Upload`, `X` and `cn` left with the Run modal and are
// gone from this line — READ OUT of the post-cut file (five `TS6133`s), never assumed:
// `noUnusedLocals` is on in `tsconfig.app.json`, so an orphaned import is a TYPE ERROR
// rather than a lint warning, and the page's typecheck baseline is what says which of the
// modal's imports the rest of the page still needs.
// Phase 192-08 (D-01): the delete Sheet's turn, read out the same way — `tsc` named exactly
// SEVEN orphans and they were removed on its say-so, not on a prediction: `Check`, `Loader2`
// and `AlertTriangle` (the terminal + banner glyphs); the WHOLE `ui/sheet` line (`TS6192`,
// all four names); and the two delete clients plus the preview type from the api seam — this
// page now reaches neither the preview endpoint nor the cascade endpoint at all, which is the
// property the one-direction row at the foot of `PublishedCardDelete.test.tsx` greps for, so
// their identifiers are described here rather than spelled. `MoreHorizontal` and `Trash2`
// STAY — the ⋯-menu and its Delete item are card chrome and did not move.
// Phase 192-10 (D-01/D-09): they stay no longer. `tsc` named FOUR orphans when the three card
// components left, and each was removed on its say-so: the whole `lucide-react` line and the
// whole `ui/dropdown-menu` line (`TS6192` ×2 — the ⋯-menu is the ONE card's chrome now), the
// shared `WorkflowSoul` (`TS6133` — consumed unchanged, by the card rather than by the page),
// and the whole `WorkflowDeleteSheet` line including its handle type, because the guard is
// mounted by the card that offers the action and a ref held here would point at nothing.
// Phase 192-10 (D-16): `useMemo` COMES BACK on this line, and it is worth one sentence why.
// 192-06 removed it with the Run modal — read out of `tsc`, not predicted. It returns because
// the merge is a DERIVATION over three pieces of state rather than a fourth piece of state:
// re-deriving `mergeLibrary(published, starters, drafts)` on every keystroke of a search field
// at 200 rows is the 045 real-scale lesson's cost, and a fourth `useState` holding the merged
// list is the drift where two sources of truth disagree about what the library contains.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
// Phase 192.1-03 (D-01): the draft-CREATE client is gone from this line, and it was READ OUT
// of `tsc` rather than predicted — exactly ONE orphan (`TS6133`), where 192-06 had five,
// 192-08 seven and 192-10 four. `noUnusedLocals` is on in `tsconfig.app.json`, so an import
// left behind by a cut is a TYPE ERROR, not a lint warning, and the typecheck baseline is what
// says which of the fork handlers' imports the rest of the page still needs. It needs all the
// others: the three list clients feed the three feeds, and all three types are read by
// `onOpenDraft`, the Builder seed state and the surviving `LibraryRow` adapters. This page now
// reaches no workflow WRITE endpoint at all — the fork's POST is the hook's.
import {
  listPublishedWorkflows,
  listStarterWorkflows,
  listDraftWorkflows,
  type PublishedWorkflow,
  type WorkflowDraftRow,
  type WorkflowDefinitionJSON,
} from "@/lib/api"
// Phase 184.1-01 (D-184.1-04): the ONE canvas-gate rule, imported rather than
// re-derived — three components now need the answer and a hand-copied three-part
// predicate is exactly the drift this project keeps getting bitten by.
import { type BuilderInitial, useCanvasGate } from "@/pages/WorkflowBuilderPage"
import { PublishGauntlet } from "@/components/workflows/PublishGauntlet"
// Phase 124-02 Task 1 (WUX-01): the soul atoms (tier + glyph + needs) now come from
// the ONE shared soulData module (Plan 01 extracted them VERBATIM from this page —
// the page is no longer their owner). The card renders the shared <WorkflowSoul>.
// (192-06: `entryInputKeys` went with the Run modal — it fed the modal's "This workflow
//  expects:" hint line and nothing else on this page. `DefShape` stays: the page still
//  reads `definition.project_folder_id` to pass the modal its author default.)
import { type DefShape } from "@/components/workflows/soulData"
// Phase 124-02 Task 2 (WUX-02): the Studio authoring entry forks into the two-door
// shell (047-A). The govern door delegates to the existing Builder (the shell mounts
// it; the page no longer mounts WorkflowBuilderPage directly).
import { WorkflowDoorSwitch } from "@/components/workflows/WorkflowDoorSwitch"
// Phase 192-06 (D-01): the Run modal was CUT out of this file — it was declared below
// `StarterCard` at `:1054-1405` of the 1407-line pre-move page, immediately above
// `export default WorkflowsPage`. HARD CUT: this page declares it nowhere and leaves NO
// re-export shim (a shim would preserve exactly the coupling the cut exists to remove,
// while every negative assertion about it stayed green). The render site below is
// byte-identical — same `key={runFor.id}`, same eight props.
import { RunModal } from "@/components/workflows/library/RunModal"
// Phase 192-08 (D-01): the WFIN-03 victim-naming delete Sheet was CUT out of this file the
// same way — 175 measured lines across FOUR spans (the `DeletePhase` union + its docblock, the
// `onDeleted` D-LOCK-04 docblock, the WFIN-03 surface comment + five state hooks + `descId`
// + `openDeleteSheet` + `handleDelete`, and the `<Sheet>` JSX). HARD CUT: this page declares
// none of them and leaves NO re-export shim. The Sheet owned its own state, so the card that
// offered the action kept only a ref to ASK it to open — a guard whose state stays behind is
// split, not moved. 192-10: that mount moved on with `PublishedCard`, so this page no longer
// names the Sheet at all — it is `WorkflowCard`'s heaviest guard grade and lives entirely there.
// Phase 192-10 (D-16 / D-17) — the merge and the narrow, IMPORTED as pure functions rather
// than written here. The page owns fetching, state and composition; it computes no predicate
// of its own, because a second copy of a predicate is a second answer to one question.
//
// ⚠ `UNBOUND` IS IMPORTED, AND THE PAGE'S OWN COPY IS DELETED IN THIS COMMIT. `192-05`
// re-homed the sentinel into `libraryFilter.ts` with a byte-identical value because fence F4
// forbids any module under `library/` from naming a `WorkflowsPage` specifier in any import
// form — so the sentinel had to live at or below the leaves. That left TWO identical
// declarations as a deliberate transient, recorded as such by both `192-05` and `192-07`, and
// closing it is this plan's job: one home, reached from here.
import {
  UNBOUND,
  chipCounts,
  filterLibrary,
  libraryDisplayName,
  matchReasons,
  mergeLibrary,
} from "@/components/workflows/library/libraryFilter"
import type { ChipId, LibraryRow, Provenance } from "@/components/workflows/library/libraryRow"
// Phase 192-10 (D-02 / D-09): the two surfaces this page now COMPOSES rather than declares.
// One persistent toolbar over one flat list of one card — the page owns fetching, filter
// state and layout, and declares no card, no filter item and no modal of its own.
import { RunLogPanel } from "@/components/workflows/history/RunLogPanel"
import { LibraryToolbar } from "@/components/workflows/library/LibraryToolbar"
import { WorkflowScheduleModal } from "@/components/workflows/WorkflowScheduleModal"
import { WorkflowCard } from "@/components/workflows/library/WorkflowCard"
// Phase 192.1-06 (LIB-05 / D-05 / D-34): the identity resolver, reached rather than written.
// The page owns the LIST — which is the only thing that can answer "what tells this row apart
// from its namesakes" — so it builds the index and hands each card its resolved value. The
// arithmetic (four-state lineage, the D-31 ranker, the O(1)-per-row claim) is proved without a
// DOM in `rowIdentity.test.ts`; nothing about it is re-derived here.
import { buildIdentityIndex, resolveIdentity } from "@/components/workflows/library/rowIdentity"
// Phase 192.1-03 (D-01 / G-5): the fork concern, reached rather than declared. See the call
// site below for why its POSITION in the component body is load-bearing, and the module's own
// header for the ledger row that made this cut due.
import {
  useWorkflowFork,
  type ForkSeed,
} from "@/components/workflows/library/useWorkflowFork"
// Phase 192.1-07 (LIB-05 / D-19): 162-B's name prompt. It is MOUNTED here and wired to the
// hook's pending fork; the page holds no fork logic of its own — see the mount below.
import { ForkNameDialog } from "@/components/workflows/library/ForkNameDialog"
import {
  LIBRARY_STATES,
  forkFailedMessage,
  sourceFailedMessage,
} from "@/components/workflows/library/libraryVocabulary"
import type { Folder } from "@/types"

// ── 192.1-03 (D-01 / G-5) — THE TWO PURE FORK LEAVES LEFT FROM HERE ────────────────────
//
// The 6-char base36 slug suffix and the 409 classifier were declared at this spot and are
// declared nowhere on this page now. Both were module-scope and closed over NOTHING, so the
// move was byte-preserving — verified by comparing the spans line for line, not asserted.
// They live in `library/libraryFork.ts` with their docblocks and WR-08's re-open trigger
// intact, and this page does not import them: their only two consumers were the two fork
// handlers, which left in the same commit. The hook reaches them; the page reaches the hook.
// The OD fence pins both halves of that (`librarySubtree.fences.test.ts` —
// `PAGE_MUST_NOT_DECLARE` names each in its own declaration family, driven RED against these
// very lines before they were deleted).

/**
 * A small violet net-new honesty flag (D14).
 *
 * ⚠ 192-10 (D-11) — THIS FUNCTION SURVIVES ON PURPOSE, AND ITS ONE REMAINING RENDER IS NOT
 * 192'S TO TOUCH. The page used to render it THREE times: on the honesty banner, on the
 * Drafts-shelf header, and in the BUILDER BREADCRUMB BAND. The first two were library surface
 * and left with the banner and the shelf; the third stays, and deleting the function with them
 * would have taken it too.
 *
 * `WorkflowBuilderPage.header.test.tsx` pins that band by BYTE-EXACT `innerHTML` — including
 * this component's ENTIRE tooltip string and its complete class list — and two further cases
 * require the `net-new-flag` testid to be present. That suite is pinned at 32.
 *
 * ⚠ TWO RESIDUALS ARE THEREFORE DEFERRED TO PHASE 193, NAMED HERE SO A LATER REVIEWER CANNOT
 * READ THEM AS 192'S OVERSIGHT:
 *   1. the hover-only tooltip attribute below — D-14 says touch has no hover, and the library
 *      subtree is fenced against it, but this render is Builder chrome and outside that fence;
 *   2. the developer vocabulary inside it — the same route literal D-11 removed from the
 *      library surface, still spelled here.
 * TRIGGER: whichever phase next edits the Builder breadcrumb band — Phase 193, which owns that
 * band — re-captures the byte-exact baseline and retires both in the same commit. Neither can
 * be fixed from 192 without editing a cross-phase assertion this plan is not allowed to move.
 */
function NetNewFlag({ label = "net-new" }: { label?: string }) {
  return (
    <span
      data-testid="net-new-flag"
      title="Net-new surface — only GET /workflows/published + POST /workflows/{id}/publish are live today"
      className="rounded-full border border-accent-violet/40 bg-accent-violet/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-accent-violet"
    >
      {label}
    </span>
  )
}

interface WorkflowsPageProps {
  /** The project folders (the filter rail's options) — from ChatLayout's useFolders. */
  folders: Folder[]
  /** doRun — defined in ChatLayout (it owns thread state): createThread →
   *  (upload staged template) → sendMessage(workflowDefinitionId, folder_id) → select
   *  + view + redirect to Chat. The page NEVER constructs a bespoke run route.
   *  Phase 152 (WFIN-01/02): the optional third arg carries the Run modal's two run
   *  inputs — a staged template `File` (uploaded to the launched thread, Landmine 8)
   *  and a per-run KB-folder override `folderId` (→ create_workflow_run.inputs, D-01).
   *  Both absent = today's byte-identical launch (D-06).
   *
   *  Phase 214-09 (STEP-02 / D-214-04): the third member `inputs` carries the values the
   *  Run modal collected for the definition's DECLARED entry inputs, keyed by their declared
   *  key. `{}` when the definition declares none; absent from a call site that collects none
   *  at all (the Test Run adapter below, `:907-923`, which passes no third argument and is
   *  deliberately NOT edited by that plan — an absent optional is safe there by construction).
   *
   *  ⛔ THIS TYPE WIDENING PROVES NOTHING ON ITS OWN, AND SAYS SO HERE SO THE NEXT READER
   *  DOES NOT READ IT AS PROOF. Under parameter CONTRAVARIANCE a narrower `doRun` stays
   *  assignable to this wider type: the extra key typechecks and is silently discarded. The
   *  hop from here into `doRun` → `postMessage` → `create_workflow_run.inputs` is owed to
   *  plans `214-12` (the `doRun` parameter) and `214-16` (the wire, already landed). The
   *  assertion that this dict actually arrives is a RUNTIME one, in `RunModal.test.tsx`, on
   *  the argument object handed to `onLaunch` — never on the build. */
  onLaunch: (
    def: PublishedWorkflow,
    kickoff: string,
    opts?: {
      templateFile?: File | null
      folderId?: string | null
      inputs?: Record<string, string>
    },
  ) => Promise<void>
  /**
   * SEED-190 — open a run's own surface. This is `ChatLayout.openRunSurface`, the SAME
   * callback the workspace panel's run seam already uses, threaded down so the run log adds a
   * DOOR to the existing room rather than a second room.
   *
   * ⚠ ABSENT WHEN THE CANVAS LAYER IS OFF, and the log renders its rows as plain text in that
   * case rather than as controls that go nowhere. The page passes it through untouched — it
   * constructs no run route of its own, exactly as it constructs no launch route of its own.
   */
  onOpenRun?: (runId: string) => void
}

/**
 * ⚠ THE THIRD MEMBER IS SEED-190's RUN LOG, AND IT LIVES HERE RATHER THAN IN `ActiveView`.
 *
 * The app has no router (`SEED-185`); navigation is a `useState` switch, and there are two
 * levels of it — `App.tsx`'s `ActiveView` (the top-level homes) and this page's own
 * `PageView` (library ↔ builder). The log is a sub-surface of the Workflows home, in the same
 * sense the Builder is: you reach it FROM the library, you go back TO the library, and it has
 * no nav-rail entry of its own. Adding an `ActiveView` member instead would have meant a
 * fourth top-level home, a `visibleNavItems` audience decision and an edit to the NAV_ITEMS
 * byte-identity lock — three changes to say "and also this page has a second screen".
 */
type PageView = "library" | "builder" | "run-log"

/**
 * 192-10 (D-16) — each feed's own answer, TRI-STATE and never boolean.
 *
 * `pending` is not a shade of `failed` and not a shade of `ok`: *"we have not asked yet"*,
 * *"there are none"* and *"we could not ask"* are three DIFFERENT FACTS, and the shipped
 * `DescribeKbPicker` rule is that a surface which collapses them lies about at least one.
 * A per-source record rather than a page-wide flag is also what makes the RUN CARVE-OUT
 * survivable: the gated drafts feed can be `failed` while the other two are `ok`.
 *
 * ⚠ A re-query does NOT return a source to `pending`. Previously-committed rows stay
 * rendered with their correct counts while the new answer is in flight (D-17's companion
 * rule); the in-flight fact is carried by `publishedUpdating` instead, because blanking a
 * settled source to signal motion is the count-zeroing the rule forbids by name.
 */
type SourceState = "pending" | "ok" | "failed"

export function WorkflowsPage({ folders, onLaunch, onOpenRun }: WorkflowsPageProps) {
  // Phase 184.1-01: does this page host the Builder's chrome, or has the Builder taken it?
  // Fail-closed and read through the shared rule — see `useCanvasGate`'s docblock for why
  // an ancestor has to ask at all (the three bands are contributed at three nesting levels).
  const canvasEnabled = useCanvasGate()
  const [pageView, setPageView] = useState<PageView>("library")
  /**
   * SEED-190 — which workflow the run log is filtered to, or `null` for the whole log.
   *
   * ⚠ IT IS A SLUG AND A NAME, NEVER A ROW ID. A workflow's runs span its published versions
   * and each version is its own `workflow_definitions` row, so a definition-scoped filter
   * would show a VERSION's history under the workflow's name. Measured on the dev database:
   * `pm-weekly-status-report` has 21 runs across 3 definition rows.
   *
   * ⚠ IT IS SET AND CLEARED ALONGSIDE `pageView`, never inferred from it. "The log, filtered"
   * and "the log, whole" are two screens, and the door from the header opens the second while
   * the door on a card opens the first — so the scope has to be part of the navigation rather
   * than a leftover from the last visit.
   */
  const [runLogScope, setRunLogScope] = useState<{ slug: string; name: string } | null>(null)
  const openRunLog = useCallback((scope: { slug: string; name: string } | null) => {
    setRunLogScope(scope)
    setPageView("run-log")
  }, [])
  // null = "All projects"; "__unbound__" = unbound; else a folder id.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  // 192-10 (D-06 / D-03): the always-on search text and the pressed chips. Both live HERE,
  // because the toolbar is presentational and the list they narrow is the page's.
  const [query, setQuery] = useState("")
  const [activeChips, setActiveChips] = useState<readonly ChipId[]>([])
  const [published, setPublished] = useState<PublishedWorkflow[]>([])
  // Phase 143 (WF-01): the curated Starters shelf (is_system_global + category='starter').
  const [starters, setStarters] = useState<PublishedWorkflow[]>([])
  const [drafts, setDrafts] = useState<WorkflowDraftRow[]>([])
  const [runFor, setRunFor] = useState<PublishedWorkflow | null>(null)
  /* Phase 204 (SCHED-01) — which workflow's schedules are open, or null.
     ⚠ It holds `{id, name}` and NOT a `PublishedWorkflow`, deliberately: the schedule dialog
     needs a definition id and a name to say, and nothing else. Widening it to the whole row
     would let a later edit reach for a field the dialog has no business reading. */
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null)
  const [kickoff, setKickoff] = useState("")
  // WR-05: in-flight guard so a double-tap of Run can't create two threads/runs.
  const [runSubmitting, setRunSubmitting] = useState(false)
  // What the Builder opens with:
  //   null            → a TRUE fresh build (the describe-first screen).
  //   { definition }  → an EXISTING definition loaded straight into the editing
  //                     view (Open a draft = edit-in-place; Tweak a published =
  //                     edit the freshly-forked copy). `draftId` is the row every
  //                     save PATCHes; `label` is the header caption.
  //
  // Phase 186-07 (D-186-07): `token` rides along — the OPAQUE concurrency token for the
  // row `draftId` names. It is carried at every seeding site below and echoed verbatim by
  // `useDraftPersistence`; nothing on this page reads inside it. `null` means "no token
  // yet", which is the honest reading for a route that has not created a row.
  const [builderInitial, setBuilderInitial] = useState<
    {
      definition: WorkflowDefinitionJSON
      draftId: string
      label: string
      token: string | null
    } | null
  >(null)
  // The post-publish Run CTA (sketch 023-A): set on a gauntlet PASS.
  const [runCta, setRunCta] = useState<{ slug: string; version: number } | null>(null)
  // 192.1-03 (D-01): the fork-failure notice STATE left with the fork concern — it is the
  // hook's, and this page reads it back off `useWorkflowFork` below. The notice's RENDER stays
  // here, in the failure region it has always shared with `failedSources`; see that render
  // site for why the region, not the state, is what belongs to the page.

  // ── Latest-wins race guards (Phase 103-ux) ──────────────────────────────────
  // Rapid project-filter clicks fire overlapping fetches; without a guard a SLOW
  // earlier response can land AFTER a faster later one and paint a STALE list (the
  // live symptom: "All projects" showed 7, a specific project showed 16, but the
  // rendered list lagged the selection). Each fetch takes a monotonic ticket; only
  // the most-recently-issued ticket is allowed to commit its result to state.
  //
  // ⚠ 192-10 (D-16/D-17): THREE TICKETS, NOT ONE, AND THE ASYMMETRY IS THE POINT. Only
  // `published` re-queries when the project changes (`refetchPublished` is the one callback
  // with `selectedProjectId` in its deps); starters and drafts are fetched once. A single
  // shared ticket across the merge would therefore either invalidate two settled sources on
  // every project click, or fail to invalidate the one that actually raced.
  const publishedSeqRef = useRef(0)
  const startersSeqRef = useRef(0)
  const draftsSeqRef = useRef(0)

  /**
   * 192-10 (D-16, T-192-26) — THE FOUR STATES, HELD APART, AND THE FAILURE STATE IS PER SOURCE.
   *
   * *There are none* and *we could not ask* are DIFFERENT FACTS (the shipped `DescribeKbPicker`
   * rule), and a page-wide `error` collapses them into one. It also collapses something worse:
   * `/workflows/drafts` is GATED (`require_visible("workflow_authoring")`) while `/published`
   * and `/starters` are the documented RUN CARVE-OUT, so one shared error path turns a 403 on
   * drafts into an empty LIBRARY — the gate re-introduced client-side on exactly the two feeds
   * the carve-out exists to protect. Per-source state is what makes that unavailable.
   */
  const [sourceState, setSourceState] = useState<Record<Provenance, SourceState>>({
    published: "pending",
    starter: "pending",
    draft: "pending",
  })
  /** A published re-query is in flight (D-17's companion rule). The previously-committed rows
   *  stay rendered with their correct counts under a quiet marker; nothing is zeroed. */
  const [publishedUpdating, setPublishedUpdating] = useState(false)

  const markSource = useCallback((source: Provenance, next: Exclude<SourceState, "pending">) => {
    setSourceState((prev) => (prev[source] === next ? prev : { ...prev, [source]: next }))
  }, [])

  const refetchPublished = useCallback(async () => {
    // "All projects" → no filter; "Unbound" → filter is not server-expressible as a
    // folder id, so we fetch all + narrow client-side to defs with no project_folder_id;
    // a real folder id → live ?project_folder_id= re-query (the narrows-only filter).
    const projectArg = selectedProjectId && selectedProjectId !== UNBOUND ? selectedProjectId : null
    const seq = ++publishedSeqRef.current
    // Phase 143 (D-143-2a): the Workflows-page Published shelf is MINE-only — pass
    // scope:"mine" so the curated Starters + the mig-061 dev scaffolds (both is_system_global)
    // stop double-rendering here; they live in the Starters shelf. Only THIS call site
    // opts in — the composer picker + WorkspacePanel keep the default global feed.
    setPublishedUpdating(true)
    try {
      const rows = await listPublishedWorkflows(projectArg, undefined, { scope: "mine" })
      // Latest-wins: a stale (superseded) response NEVER paints over a newer selection.
      if (seq !== publishedSeqRef.current) return
      if (selectedProjectId === UNBOUND) {
        setPublished(rows.filter((r) => !(r.definition as DefShape | undefined)?.project_folder_id))
      } else {
        setPublished(rows)
      }
      markSource("published", "ok")
    } catch (err) {
      // A superseded failure is as stale as a superseded success — it must not paint a
      // failure notice over a selection that has already moved on.
      if (seq !== publishedSeqRef.current) return
      markSource("published", "failed")
      throw err
    } finally {
      if (seq === publishedSeqRef.current) setPublishedUpdating(false)
    }
  }, [selectedProjectId, markSource])

  // Phase 143 (WF-01): the curated Starters feed — a single unscoped global fetch on
  // mount. Same latest-wins guard as the others (cheap insurance though a single
  // unscoped fetch rarely races).
  const refetchStarters = useCallback(async () => {
    const seq = ++startersSeqRef.current
    try {
      const rows = await listStarterWorkflows()
      if (seq !== startersSeqRef.current) return
      setStarters(rows)
      markSource("starter", "ok")
    } catch (err) {
      if (seq !== startersSeqRef.current) return
      markSource("starter", "failed")
      throw err
    }
  }, [markSource])

  const refetchDrafts = useCallback(async () => {
    const seq = ++draftsSeqRef.current
    try {
      const rows = await listDraftWorkflows()
      // Same latest-wins guard (drafts are re-fetched on mount + after publish/tweak).
      if (seq !== draftsSeqRef.current) return
      setDrafts(rows)
      markSource("draft", "ok")
    } catch (err) {
      if (seq !== draftsSeqRef.current) return
      // ⚠ THE ONE GATED FEED. A refusal here is a NORMAL outcome for a user without
      // `workflow_authoring` visibility, not an exception — it degrades to zero drafts and
      // says so, and it must NEVER be able to remove a published row or a starter from view.
      markSource("draft", "failed")
      throw err
    }
  }, [markSource])

  /**
   * ⚠ `Promise.allSettled`, NEVER `Promise.all` — this is the single highest-risk defect the
   * D-16 merge can ship, and the shape of the call is the whole mitigation.
   *
   * `GET /workflows/drafts` carries `require_visible("workflow_authoring")`; `GET
   * /workflows/published` and `GET /workflows/starters` carry NO dependency at all, because
   * they are the Phase-148 RUN CARVE-OUT — the feeds that keep Run working for every user.
   * `Promise.all` rejects on the FIRST rejection, so one 403 on the gated feed would abandon
   * the composition and leave a user staring at an EMPTY LIBRARY whose two visible feeds had
   * both answered successfully. `allSettled` waits for every outcome, each source commits
   * behind its own ticket, and a refused feed subtracts only itself.
   *
   * THE ASYMMETRY IS PRESERVED: the first run settles all three; every later run is a project
   * change, and only `published` re-queries (`refetchStarters` / `refetchDrafts` are `[]`-stable
   * so they can never re-trigger this effect). That is D-17's cause, kept rather than collapsed.
   *
   * ⚠ AND ONE HONEST QUALIFICATION, MEASURED RATHER THAN ASSUMED. Swapping this line to
   * `Promise.all` today does NOT break the library, and the test that proves the carve-out
   * stays green when you do — because the isolation that actually saves it is the per-source
   * `try`/`catch` in each `refetch*` above, each committing behind its own ticket. What
   * `allSettled` buys RIGHT NOW is that the aggregate settles without throwing; what it buys
   * LATER is the thing worth keeping, because the first consumer this aggregate acquires — a
   * settle-gated spinner, a telemetry hook, anything that reads the result — makes `all`
   * re-introduce the gate on the two carve-out feeds instantly and silently. It is therefore
   * pinned as SOURCE by `WorkflowsPage.test.tsx`, not claimed by a behavioural assertion that
   * cannot see the difference. The claim and the check match; neither overstates the other.
   */
  const didInitialLoadRef = useRef(false)
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true
      void Promise.allSettled([refetchPublished(), refetchStarters(), refetchDrafts()])
      return
    }
    refetchPublished().catch(console.error)
  }, [refetchPublished, refetchStarters, refetchDrafts])

  const folderName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null
      return folders.find((f) => f.id === id)?.name ?? null
    },
    [folders],
  )

  // ── 192-10 (D-16 / D-17) — THE ONE LIST ──────────────────────────────────────────────
  //
  // Three feeds → one flat `LibraryRow[]`, deduped by `id` with `provenance` assigned from
  // FEED ORIGIN, then narrowed. The page calls the pure functions and writes no predicate:
  // the dedupe key, the union semantics of the chips, the search scope and the three
  // per-provenance project rules all live in `libraryFilter.ts` and are unit-proved there
  // without a DOM.
  const rows = useMemo(
    () => mergeLibrary(published, starters, drafts),
    [published, starters, drafts],
  )

  // D-17's three rules, applied by `matchesProject` and NOT re-stated here: published rows
  // were already narrowed SERVER-side by the `?project_folder_id=` re-query above (the one
  // case the server cannot express — "no project" — is the `UNBOUND` narrow in
  // `refetchPublished`); drafts narrow CLIENT-side on `definition.project_folder_id`; and
  // starters are held OUT of the project filter entirely and stay visible, with the toolbar
  // stating that fact in words rather than leaving it to be inferred from a filter that looks
  // broken.
  /**
   * ── 192.2-09 (LIB-06 gap-closure round 1, WR-04) — THE SELECTION, AS ONE OBJECT ────────
   *
   * It was assembled inline inside the `filterLibrary` memo below, which was correct while
   * exactly one consumer read it. There are two now: the list is narrowed by it, and each row
   * is asked *why are you here* under it.
   *
   * ⚠ ONE OBJECT, NEVER TWO INLINE LITERALS. Two literals are two answers to one question and
   * would drift the first time a fourth selection field arrives — a row could then explain
   * itself under a selection that is not the one the list was narrowed by, which is exactly
   * the claim-the-surface-cannot-back failure this repair exists to end (T-192.2-41).
   */
  const selection = useMemo(
    () => ({ query, chips: activeChips, projectId: selectedProjectId }),
    [query, activeChips, selectedProjectId],
  )

  const visibleRows = useMemo(() => filterLibrary(rows, selection), [rows, selection])

  /**
   * D-03 — each chip's honest number, computed over the SAME rows the list renders and under
   * the SAME query and project. `chipCounts` deliberately takes no `chips` argument: the
   * number a chip shows is the number clicking IT gives you, which is what makes the promise
   * mechanical rather than aspirational.
   */
  const counts = useMemo(
    () => chipCounts(rows, query, selectedProjectId),
    [rows, query, selectedProjectId],
  )

  /**
   * ── 192.1-06 (LIB-05 / D-05 / D-28 / D-34) — THE IDENTITY INDEX, BUILT ONCE PER LIST ─────
   *
   * ⚠ THE DEPENDENCY ARRAY IS `[rows]` AND NOTHING ELSE, AND THE TRAP IS THREE LINES ABOVE.
   * `counts` (`:460` — MEASURED at this commit, not the `:472` the plan and PATTERNS both
   * quote; 192-14/15 moved it and a stale pointer is the failure Phase 189 banked) is keyed
   * `[rows, query, selectedProjectId]` because a chip's number must
   * describe the FILTERED view — that is correct for a chip and WRONG here, so this memo
   * deliberately does not "harmonise" with the one directly above it. Two independent reasons,
   * both requirements rather than optimisations:
   *
   *   1. **D-05 demands it.** `1 of N` is counted over the FULL merged library, BEFORE search,
   *      chip and project filtering. A count that shrank as you typed would both FLICKER and
   *      misdescribe the library — the discriminators answer *what tells this row apart from
   *      its namesakes*, which is a property of the library, not of the current view.
   *   2. **It makes typing free.** With `[rows]`, a keystroke re-runs `filterLibrary` only.
   *      The approved sketch's per-row `identity(row, rows)` is worst-case O(n³) — RESEARCH
   *      measured ≈ 230,000 inner-loop iterations per render on the operator's shape, twice a
   *      render, on every keystroke. `buildIdentityIndex` does that work once per LIST.
   *
   * ⚠ AND IT TAKES NO `failedSources` (D-28), which is a DECISION rather than an omission.
   * `1 of N` is NOT suppressed when a feed refuses. Drafts are 72 % of the operator's merged
   * rows, so a drafts 403 genuinely collapses `N` — and suppressing the count would remove a
   * discriminator at exactly the moment the list is hardest to read. The `source-failed` banner
   * below is the disclosure, and it is spent in ONE place rather than 106 times. **UAT row U7
   * is the named check**: fail the drafts feed at scale and confirm a reader is not misled.
   */
  const identityIndex = useMemo(() => buildIdentityIndex(rows), [rows])

  /**
   * ⚠ ONE CLOCK PER RENDER PASS — NOT ONE PER CARD, AND NOT ONE CAPTURED IN THE MEMO (P-1).
   *
   * There is no free option here and the trade is stated rather than engineered around:
   *
   *   · `Date.now()` read inside the card would let two cards in ONE render straddle a band
   *     boundary, so a list could show `59 min ago` above `1 hour ago` for the same instant.
   *   · `Date.now()` captured INSIDE the `[rows]`-keyed memo would FREEZE — a row could still
   *     read `just now` an hour later, because nothing invalidates that memo but a new list.
   *
   * So identity, lineage and `1 of N` are keyed on `[rows]` (none of them depends on time) and
   * `changed <rel>` is computed during render from this one value, which every card in the pass
   * shares. **The value therefore only refreshes when something else re-renders, and that is
   * ACCEPTED**: `relativeChanged.ts:39-43` records 188's `WorkflowRunPage` tick-gate bug as this
   * project's evidence that a live clock is its own defect class. Do NOT add a timer.
   */
  const now = Date.now()

  const toggleChip = useCallback((chip: ChipId) => {
    setActiveChips((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]))
  }, [])

  /** The one-click way out of a list filtered down to nothing (sketch 158). */
  const clearAllFilters = useCallback(() => {
    setQuery("")
    setActiveChips([])
    setSelectedProjectId(null)
  }, [])

  /** The sources that answered with a refusal, NAMED — never folded into one page-wide error. */
  const failedSources = useMemo(
    () => (Object.keys(sourceState) as Provenance[]).filter((s) => sourceState[s] === "failed"),
    [sourceState],
  )

  /**
   * ⚠ `loading` MEANS "NOTHING HAS ANSWERED YET", NOT "NOT EVERYTHING HAS ANSWERED", and the
   * difference is a defect this plan shipped once and then measured.
   *
   * The first version gated the list on all three feeds settling. That is wrong for the same
   * reason `Promise.all` is wrong, one layer up: it makes the two RUN CARVE-OUT feeds
   * conditional on the slowest — and the latest-wins guard drove it straight out, because that
   * case deliberately holds the published fetch open while the other two return. Two feeds had
   * committed real rows and the page rendered a loading line over them. Waiting for a feed that
   * has answered is the same lie as hiding a feed that failed.
   *
   * So: as soon as ANY source has an answer, its rows are shown; `updating` keeps saying that
   * more is coming until every source has settled, so a count is never presented as final early.
   */
  const anySettled = useMemo(
    () => (Object.keys(sourceState) as Provenance[]).some((s) => sourceState[s] !== "pending"),
    [sourceState],
  )
  const allSettled = useMemo(
    () => (Object.keys(sourceState) as Provenance[]).every((s) => sourceState[s] !== "pending"),
    [sourceState],
  )
  const loading = !anySettled

  // ── Open a draft: load THAT draft's definition into the Builder editing view
  //    (edit-in-place — saves PATCH the same row via its real id). ──
  //
  // ⚠ 192-14: DECLARED ABOVE `onTweak` ON PURPOSE, and the move is required rather than
  // stylistic. `onTweak` now lists this callback in its dependency array; a dep array is
  // evaluated at RENDER time, so a `const` declared further down the component body is a
  // temporal-dead-zone ReferenceError on every render — a crash, not a lint warning. The body
  // below is the shipped one verbatim; only its position changed.
  const onOpenDraft = useCallback((draft: WorkflowDraftRow) => {
    setBuilderInitial({
      definition: (draft.definition ?? {}) as WorkflowDefinitionJSON,
      draftId: draft.id,
      // WR-01 — the ONE library display-name rule; `??` here missed the empty string a
      // `setName` edit can now produce, putting `Edit ·  v3` in the builder's own label.
      label: `Edit · ${libraryDisplayName(draft.name, draft.slug)} v${draft.version}`,
      // 186-07: the ONE route that does not create — the drafts list itself now serves
      // the token (186-03), so an edit-in-place session is guarded from its first write.
      // `?? null` because a shelf row read before that field shipped simply has none, and
      // an unguarded first write is the honest fallback rather than a crash.
      token: draft.token ?? null,
    })
    setPageView("builder")
  }, [])

  /**
   * 192.1-03 (D-01 / G-5) — THE BUILDER HANDOFF, AS THE FORK CONCERN'S ONE WAY BACK.
   *
   * `setBuilderInitial` and `setPageView` are this page's Builder host and did NOT move; the
   * hook hands a seed back through this single callback instead. The reason is recorded in
   * the code the hook inherited (192-14, at the existing-draft branch): reusing ONE seeding
   * path is what threads 186-07's opaque concurrency token by construction instead of by
   * remembering to — a dropped token is a silent-clobber bug that typechecks. Taking the
   * setter into the hook would have re-opened two call sites for a future author to forget
   * one of; taking a callback leaves exactly one fork-time seeding site, and it is here.
   */
  const onForked = useCallback((seed: ForkSeed) => {
    setBuilderInitial(seed)
    setPageView("builder")
  }, [])

  // ── 192.1-03 (D-01 / D-29 / G-5) — THE FORK CONCERN, NOW ONE CALL ──────────────────────
  //
  // What used to be ~225 lines here — the 6-char slug suffix, the 409 classifier, the
  // `forkFailed` state, the by-slug draft index, both fork handlers and the two `LibraryRow`
  // adapters that feed them — is `library/useWorkflowFork.ts`. The ledger row for this file
  // named this exact seam and named WR-08 as the trigger; 162-B's name prompt is the second
  // concern that made it due, so the recommendation was produced first and taken.
  //
  // ⚠ THE CALL SITE'S POSITION IS LOAD-BEARING, AND IT TYPECHECKS EITHER WAY. It reads
  // `onOpenDraft` (declared immediately above), `refetchDrafts` and `drafts`, and a hook
  // argument is evaluated at RENDER time — so placing this where the draft index used to sit,
  // ABOVE `onOpenDraft`, is a temporal-dead-zone `ReferenceError` on every render: a crash,
  // not a lint warning. That is 192-14's warning nine lines up, inherited by the extraction
  // rather than retired by it. It is verified by running the page's suites, not by reading.
  //
  // `refetchDrafts` is passed IN and stays here: it owns `draftsSeqRef`, `setDrafts` and
  // `markSource("draft", …)` — the fetch-orchestration concern, which is still the page's.
  //
  // ⚠ 192.1-07 (D-19 / D-21): `rows` JOINS THE ARGUMENT OBJECT, and it strengthens the
  // position rule above rather than merely extending it. `rows` is declared further UP this
  // file than `onOpenDraft` is, so the hook call was already below both; a future author who
  // moves this call to where the draft index used to sit now has TWO temporal-dead-zone
  // crashes waiting rather than one. The list is passed IN because the page already merges it
  // for the filter, the chip counts and the identity index — a second merge inside the hook
  // would be a second answer to "what is in this library".
  const {
    forkFailed,
    draftBySlug,
    onForkNewVersion,
    onForkStarter,
    pendingFork,
    confirmFork,
    cancelFork,
    isClash,
  } = useWorkflowFork({
    drafts,
    rows,
    refetchDrafts,
    onOpenDraft,
    onForked,
  })

  // 186-07: a TRUE fresh build seeds nothing at all — no row exists yet, so there is no
  // token to carry. `useDraftPersistence` creates the row on the first write and adopts
  // the token that create returns, which is the same posture as `token: null`.
  const openBuilderFresh = useCallback(() => {
    setBuilderInitial(null)
    setPageView("builder")
  }, [])

  // ── 192-10 (D-09 / D-12) → 192.1-03 (D-29 / D-37) — THE CARD'S THREE REMAINING ADAPTERS ─
  //
  // ⚠ THIS BLOCK SAID "THE CARD'S FIVE CALLBACKS" UNTIL 192.1-03, AND IT IS REWRITTEN RATHER
  // THAN LEFT STANDING. Two of the five — the fork pair — moved into `useWorkflowFork` with
  // the handlers they exist to feed (D-29), and a docblock asserting five where three remain
  // is the wrong-pointer-in-prose failure Phase 189 banked: nothing typechecks prose, so the
  // only thing that keeps it true is amending it in the same commit that falsifies it (D-37).
  //
  // `WorkflowCard` speaks `LibraryRow`; the handlers speak the WIRE types. These three
  // adapters are what is left of that seam here, and each reads `row.source` — the original
  // wire object, kept whole by `libraryRow.ts` precisely so a handler never receives a rebuilt
  // object that has quietly lost a field (`onOpenDraft` needs the draft's opaque `token`; a
  // rebuilt object that drops it is the D-186-07 SILENT CLOBBER — a behaviour bug that
  // typechecks). They feed `onRun`, `onOpen` and `onDeleted`, none of which is the fork
  // concern — which is exactly why they stayed.
  //
  // The card's other two props, `onForkNewVersion` and `onForkStarter`, are read off the hook
  // above and passed through unchanged. ⚠ D-12'S NEVER-MERGED RULE MOVED WITH THEM and is
  // stated in full beside the two adapters it now governs, in `useWorkflowFork.ts` — the one
  // place that can enforce it, because it is the only place that still declares them.
  const handleRun = useCallback((row: LibraryRow) => {
    setRunFor(row.source as PublishedWorkflow)
    setKickoff("")
  }, [])

  const handleOpen = useCallback(
    (row: LibraryRow) => onOpenDraft(row.source as WorkflowDraftRow),
    [onOpenDraft],
  )

  /**
   * D-LOCK-04 — re-fetch after a CONFIRMED delete, never an optimistic vanish. BOTH feeds are
   * re-queried rather than only `published`: the card now hosts TWO delete grades (the Sheet's
   * cascade on a live row, and D-18's arm-to-confirm on a single draft), and a draft that was
   * really deleted must leave the merged list as surely as a published one does.
   */
  const handleDeleted = useCallback(() => {
    refetchPublished().catch(console.error)
    refetchDrafts().catch(console.error)
  }, [refetchPublished, refetchDrafts])

  /**
   * Phase 184-11 (D-184-16 debt 1) — the unsaved-work leave guard's host half.
   *
   * THERE IS NO ROUTER HERE (the three-homes contract: navigation is a `useState`
   * switch), so there is no route-change hook and no router blocker. The Builder knows
   * whether its draft is dirty; this page owns the `← Workflows` breadcrumb. So the
   * Builder REGISTERS a predicate and the breadcrumb asks it before switching view.
   *
   * A REF, not state: registering must not re-render this page, and the breadcrumb reads
   * the latest predicate at click time rather than through a closure that could be stale.
   * When no Builder is mounted — the fresh-build chooser, the describe door, the library
   * itself — the ref is null and `backToLibrary` behaves exactly as it did before this
   * plan.
   */
  const canLeaveBuilderRef = useRef<(() => boolean) | null>(null)
  const registerCanLeave = useCallback((canLeave: (() => boolean) | null) => {
    canLeaveBuilderRef.current = canLeave
  }, [])

  // ── Back to the library: refresh both shelves so a newly-created/edited draft
  //    (or a tweaked fork) appears WITHOUT a manual browser refresh. ──
  const backToLibrary = useCallback(() => {
    // The guard runs FIRST and its refusal is total: nothing is refetched, no view
    // changes, and the author is left exactly where they were with their work intact.
    if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return
    setPageView("library")
    refetchDrafts().catch(console.error)
    refetchPublished().catch(console.error)
  }, [refetchDrafts, refetchPublished])

  const onGauntletPublished = useCallback(
    (version: number, slug: string) => {
      setPageView("library")
      setRunCta({ slug, version })
      refetchPublished().catch(console.error)
      refetchDrafts().catch(console.error)
    },
    [refetchPublished, refetchDrafts],
  )

  // ── RUN LOG host (SEED-190 — the library's second screen, three-homes, no router). ──
  //
  // ⚠ IT MOUNTS BEFORE THE BUILDER'S BRANCH AND BEFORE THE LIBRARY'S RETURN, which is what
  // makes it reachable at all. This page's render is a chain of early returns ending in the
  // library, so a branch placed after that return is code nobody executes — the Phase-118
  // built-but-unreachable lesson, which this repository has now paid for twice.
  if (pageView === "run-log") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <button
            type="button"
            data-testid="run-log-back"
            onClick={() => {
              setRunLogScope(null)
              setPageView("library")
            }}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Workflows
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <RunLogPanel
            scope={runLogScope}
            // ⚠ ONLY OFFERED WHEN THERE IS A FILTER TO DROP. A "Show all runs" control on the
            // unfiltered log is a control that does nothing, which this codebase treats as
            // worse than an absent one.
            onClearScope={runLogScope === null ? undefined : () => setRunLogScope(null)}
            onOpenRun={onOpenRun}
          />
        </div>
      </div>
    )
  }

  // ── BUILDER host (the Build-card / Open / Tweak destination — three-homes, no router). ──
  if (pageView === "builder") {
    /**
     * Phase 184.1-01 (D-184.1-01 / D-184.1-02) — the breadcrumb group, declared once and
     * drawn either in this page's own band (flag off, exactly as it ships) or inside the
     * Builder's merged header row (flag on).
     *
     * `backToLibrary` — and with it the whole unsaved-work leave guard — stays owned HERE.
     * What moves is where the button is PAINTED, not what it closes over: the node travels
     * down as an opaque child and neither the door shell nor the Builder reads anything out
     * of it. That is the difference between this re-flow and a refactor.
     */
    const breadcrumbGroup = (
      <>
        <button
          type="button"
          data-testid="builder-back"
          onClick={backToLibrary}
          className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← Workflows
        </button>
        <span className="text-[13px] font-medium text-foreground">
          {builderInitial ? builderInitial.label : "Build a workflow"}
        </span>
        <NetNewFlag />
      </>
    )

    return (
      <div className="flex h-full flex-col bg-background">
        {/* D-184.1-01 — flag off ⇒ this band renders exactly as it always has, and the two
            merge props below are genuinely absent from the element. Flag on ⇒ no band here;
            the group is hosted downstream. */}
        {!canvasEnabled && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            {breadcrumbGroup}
          </div>
        )}
        <div className="min-h-0 flex-1">
          {/* WUX-02 (047-A): the Studio authoring entry forks into the two-door shell.
              A FRESH build opens at the "both" chooser; Open/Tweak land straight in the
              govern door with the loaded definition (D-01/D-05 — the fork is the Studio
              authoring entry). The govern door delegates to the existing Builder; the
              describe door carries a soul preview + the one-click switch strip. The
              library-card Run path is NOT routed through this shell (D-01). */}
          <WorkflowDoorSwitch
            // The current draft/definition powers the describe-door soul preview.
            def={builderInitial?.definition as DefShape | undefined}
            // Open/Tweak land in the govern door; a fresh build opens at "both".
            initialDoor={builderInitial ? "govern" : "both"}
            // Phase 184.1-01 — SPREAD-CONDITIONAL (the D-14 idiom): with the flag off both
            // keys are ABSENT from the element, so the door shell and the Builder are
            // reached by a call that is byte-for-byte the one that shipped.
            {...(canvasEnabled ? { inline: true, headerLead: breadcrumbGroup } : {})}
            // OPEN/TWEAK: the existing definition + its real row id flows straight
            // through to the Builder's `initial` (saves PATCH it). Absent → fresh build.
            //
            // 186-07: `token` is listed EXPLICITLY here, and that is the whole point of
            // the line. This is a hand-built object, not a spread — a token added to the
            // state above but forgotten here would produce a Builder that autosaves with
            // no guard at all, and the symptom would be a silent clobber rather than a
            // type error.
            initial={
              builderInitial
                ? ({
                    definition: builderInitial.definition,
                    draftId: builderInitial.draftId,
                    token: builderInitial.token,
                  } as BuilderInitial)
                : undefined
            }
            // Phase 184-11 (D-184-16 debt 1): the Builder registers its unsaved-work
            // predicate here; the breadcrumb above consults it.
            registerCanLeave={registerCanLeave}
            // Phase 200.3 (SEED-164 / D-03): Test Run from builder header
            onTestRun={async (_def, draftId) => {
              if (onLaunch && _def) {
                await onLaunch(
                  {
                    id: draftId ?? "",
                    slug: (typeof _def.slug === "string" ? _def.slug : "") || "workflow",
                    version: typeof _def.version === "number" ? _def.version : 1,
                    name: (typeof _def.name === "string" ? _def.name : "") || "Draft Workflow",
                    status: "draft",
                    definition: _def as DefShape,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  } as PublishedWorkflow,
                  "",
                )
              }
            }}
            renderPublish={(_def, draftId, blockedReason, onPublishRunning) =>
              draftId ? (
                <PublishGauntlet
                  definitionId={draftId}
                  // Phase 186-07 (D-186-12): the gauntlet reports its in-flight flag back
                  // to the Builder, which HOLDS autosave while it is set. Forwarded, never
                  // interpreted — this page adds no publish state of its own.
                  onRunningChange={onPublishRunning}
                  // Phase 184-11 (R12): the reason publish is blocked, straight from the
                  // Builder's live verdict. `undefined` on every other call site, which is
                  // what keeps their trigger byte-identical.
                  blockedReason={blockedReason}
                  // Phase 124-03 Task 2 (WUX-01, D-06): thread the authored definition
                  // (already supplied by the Builder's renderPublish) into the prepended
                  // pub-scale soul block. Additive only — zero change to the publish flow.
                  definition={_def as DefShape}
                  onPublished={(version) =>
                    // WR-04: the definition's own slug is the lookup key (the loaded
                    // definition carries it for Open/Tweak; the just-built draft
                    // carries it for a fresh build) — never the hardcoded "workflow"
                    // literal (which finds nothing in `published`, silently dropping
                    // the post-publish Run CTA).
                    onGauntletPublished(
                      version,
                      typeof _def.slug === "string"
                        ? _def.slug
                        : typeof (builderInitial?.definition as { slug?: unknown } | null)?.slug === "string"
                          ? ((builderInitial!.definition as { slug: string }).slug)
                          : "workflow",
                    )
                  }
                />
              ) : null
            }
          />
        </div>
      </div>
    )
  }

  // ── LIBRARY view ──
  //
  // 192-10 (RESEARCH OQ1) — THE POST-PUBLISH RUN CTA SURVIVES, UNCHANGED, ABOVE THE TOOLBAR,
  // and it is recorded here as a decision so a reviewer does not read its survival as an
  // oversight. It is a PAGE-LEVEL banner about a thing that just happened, not a card verb, so
  // D-09's "one primary verb per row" says nothing about it.
  //
  // Its lookup is RETARGETED to the merged list. It used to search `published` alone; a row
  // that arrives on a different feed would then be silently un-findable and the CTA would
  // simply not appear — the same class of failure WR-04 already fixed once on this banner when
  // a hardcoded slug literal found nothing.
  //
  // The `provenance !== "draft"` half is not decoration: a Tweak fork carries the SAME slug as
  // the published row it forked, so a slug match alone can land on a draft — and a CTA that
  // offers to Run a draft offers something the product refuses by design (D12).
  const runCtaRow = runCta
    ? rows.find((row) => row.slug === runCta.slug && row.provenance !== "draft")
    : undefined
  const runCtaWf = runCtaRow ? (runCtaRow.source as PublishedWorkflow) : undefined

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* ── Header ───────────────────────────────────────────────────────────────────
          ⚠ 200-PORT — STACKED, NOT SIDE BY SIDE, AND THE TITLE GROWS TO 24px.

          It read `flex items-center gap-3` with a 20px `h1` and a 13px sentence sitting on the
          SAME LINE, which made the page's name and its description one continuous run of text
          that the eye parses as a single sentence. Sketch 200 draws them as `h2` (24px, 600,
          `-0.02em`) over `body-md` (14px) — a title with a subtitle under it, the shape every
          other page-level header in this product uses.

          ⚠ THE SENTENCE IS THE SHIPPED ONE, NOT THE SHEET'S, AND THE DIFFERENCE IS DELIBERATE.
          The sheet writes *"…author, publish, and run."*; the shipped line ends *"…and Run into
          a thread."* That tail is a real product fact — Run opens a NEW CHAT THREAD and streams
          there, which the Run modal also states at its own footer — and adopting the sheet's
          wording would delete it. The sheet is the reference for STRUCTURE; it is not a licence
          to drop a true statement it had no way of knowing. */}
      {/* ⚠ SEED-190 — THE HEADER GAINS A SECOND DOOR, AND IT IS THE ONLY WAY TO THE WHOLE LOG.
          The card's ⋯ opens the log FILTERED to one workflow; nothing else on this page opens
          it whole, which is the screen the operator's complaint was actually about ("one place
          to see the history of the runs").

          ⚠ IT IS IN THE HEADER AND NOT IN THE TOOLBAR, deliberately. The toolbar is a strip of
          FILTERS over the list below it — its create control is the documented exception and
          `LibraryToolbar`'s own D-02 fence asserts that control is first in DOM order. A
          navigation door added there would sit inside a group whose contract is "these change
          what you see below", which this does not. The header is where the page says what it
          IS, and a second screen of the same home belongs beside that.

          ⚠ IT IS NOT A PRIMARY CONTROL and is not painted as one: the page has exactly one
          filled affordance (Build a workflow, in the toolbar) and a second would compete with
          it for the same glance. */}
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 pb-4 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Workflows
          </h1>
          <p className="text-[14px] leading-normal text-muted-foreground">
            Repeatable, locked automations — author, publish, and Run into a thread.
          </p>
        </div>
        <button
          type="button"
          data-testid="open-run-log"
          onClick={() => openRunLog(null)}
          className="mt-1 flex-none rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          Run log
        </button>
      </header>

      {/* ── 192-10 (D-11) — THE D14 HONESTY BANNER WAS REMOVED, AND IT WAS REMOVED BECAUSE
            ITS CLAIM WAS MEASURED FALSE, NOT BECAUSE IT WAS INCONVENIENT. ─────────────────
            The banner told the user that only the published-list read and the publish write
            were live, and that draft create/list/update/delete were net-new. D-11 asked for a
            plan-time check before touching it. RESEARCH performed that check and the answer is
            that all four draft-CRUD routes are LIVE and gated today — create, the drafts list,
            the update and the delete each carry `require_visible("workflow_authoring")` in
            `backend/app/api/workflows.py` — and three of their clients are called from THIS
            VERY FILE. A disclosure of a falsehood cannot be honestly re-worded: re-phrasing it
            would ship a NEW false statement in plainer language, which is strictly worse than
            the one it replaced. So it goes, and this comment is the receipt.

            It also carried the second half of D-11's ask: the published-list route string,
            rendered as user-visible text on the Published shelf's chip. That chip left with the
            shelf in this same commit, so no route literal reaches a reader of this page now.
            (The route is named in words here for the reason the file header states: the check
            is a raw source count, and prose spelling it would satisfy it.) */}

      {/* Post-publish Run CTA (sketch 023-A) */}
      {runCtaWf && (
        <div
          data-testid="run-cta"
          className="flex items-center justify-between border-b border-success/30 bg-success/10 px-6 py-2 text-[13px] text-foreground"
        >
          <span>
            Published <b>{runCtaWf.name}</b> v{runCta?.version}. Ready to run it.
          </span>
          <button
            type="button"
            onClick={() => {
              setRunFor(runCtaWf)
              setKickoff("")
              setRunCta(null)
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            ▶ Run now
          </button>
        </div>
      )}

      {/* ── 192-10 (D-16, T-192-26): THE HONEST STATES, HELD APART ───────────────────
          `loading` renders NO COUNT AT ALL, because a count of 0 during a load is a lie.
          A refused source is NAMED — "we couldn't load your drafts" — and the rows that
          did arrive stay on screen beneath it, because presenting a partial library as a
          complete one is the spoofing-of-completeness this section exists to prevent. */}
      {loading && (
        <p data-testid="library-loading" className="px-6 py-2 text-[12.5px] text-muted-foreground">
          {LIBRARY_STATES.loading}
        </p>
      )}
      {/* ⚠ THE COLOUR IS LOAD-BEARING, AND IT IS HERE BECAUSE UAT ROW U7 FAILED ON IT.
          This notice shipped as `border-warning/30 bg-warning/5 text-muted-foreground` — a
          warning tint at 5% behind words painted in the SAME grey as every other quiet line
          on the page. So the warning colour never reached the text, and the operator, driving
          U7 against a real blocked drafts feed, answered the row's own `fail:` clause
          verbatim: they would READ the collapsed count and MISS the banner. That is precisely
          the harm D-28 traded for when it chose to keep `N` on screen rather than suppress it
          — the count is only honest if its disclosure is read FIRST.

          Position was never the problem and is unchanged: measured at UAT, banner y=63 against
          the chip strip at y=115 and the first row at y=242. SALIENCE was the problem. The
          words now carry `text-warning` themselves.

          Class-only change — the DOM is byte-identical, so the three suites pinning this node
          (`WorkflowsPage.test.tsx:619`, `:1490` `toContain("your drafts")`, `:1518-1521`) pin
          the testid and the TEXT, never the class, and none of them can see this edit. */}
      {failedSources.map((source) => (
        <p
          key={source}
          data-testid={`library-source-failed-${source}`}
          className="border-b border-warning/40 bg-warning/10 px-6 py-2.5 text-[13px] font-medium text-warning"
        >
          {sourceFailedMessage(source)}
        </p>
      ))}

      {/* ── 192-15 (WR-03) — A FORK CLICK THAT FAILED, SAID OUT LOUD ────────────────────
          It sits HERE, with this page's other failure vocabulary and above the fold, because
          this region already IS the page's honest-failure home — extending it is one line of
          the same concern, where a parallel notice region somewhere else would be a second
          one (G-5: this file is on the hot-file ledger).

          There is NO toast library in this repo — verified: zero `sonner` imports, no
          `ui/toast` — and a gap-closure round is the wrong place to acquire a dependency.
          `role="status"` is the shipped `draft-delete-error` precedent from the card: it is
          what makes a message that appears AFTER a click announced rather than merely present,
          which matters most for the person least able to notice a new line on a busy page.

          EXACTLY ONE NODE. Two nodes carrying one `data-testid` is a selector that throws
          rather than a surface that reports twice (this page's own recorded rule, stated at
          the in-flight marker below).

          ⚠ 192.1-03 (D-01): THE STATE MOVED, THE RENDER DID NOT, and the split is the point.
          `forkFailed` is `useWorkflowFork`'s — the fork concern owns its own failure. WHERE
          the sentence appears is a page-LAYOUT decision, and the paragraph above is the whole
          argument for this spot; moving the JSX into the hook would carry a layout decision
          into a module that cannot see the region it belongs to, and would make the hook a
          `.tsx`. The markup below is byte-identical to what 192-15 shipped. */}
      {forkFailed && (
        <p
          data-testid="library-fork-failed"
          role="status"
          className="border-b border-warning/30 bg-warning/5 px-6 py-2 text-[12.5px] text-muted-foreground"
        >
          {forkFailedMessage(forkFailed.name, forkFailed.conflict)}
        </p>
      )}

      {/* ── 192.1-07 (LIB-05 / D-19 / D-21) — 162-B'S NAME PROMPT, MOUNTED AND NOTHING MORE ──
          Five props, every one of them read straight off `useWorkflowFork`. THE PAGE GAINS NO
          FORK LOGIC: it does not decide when to ask, it does not know what a clash is, it does
          not build a slug or a version, and it does not touch the Builder here. That boundary
          is the whole reason 192.1-03 cut the concern out first (D-01), and this mount is the
          test of whether the cut held — a seam you can build a feature on without reopening.

          ⚠ IT RENDERS UNCONDITIONALLY AND GATES ON `open`, rather than being wrapped in
          `{pendingFork && …}`. That is Radix's contract, not a style: the primitive owns the
          enter/exit transition and the focus return, and unmounting the tree underneath it
          takes both away. `sourceName` falls back to `""` for the closed frames, where nothing
          reads it.

          ⚠ IT SITS OUTSIDE THE SCROLLING LIST ON PURPOSE. `DialogContent` portals to
          `document.body` anyway, so its position in this tree decides nothing visual — but a
          dialog declared INSIDE the list would be unmounted by every empty/failed/filtered
          state below, which are exactly the states a person might be forking their way out of.
          Beside the failure notice is where this page keeps things that outlive the list. */}
      <ForkNameDialog
        open={pendingFork !== null}
        sourceName={pendingFork?.row.name ?? ""}
        onCancel={cancelFork}
        onCreate={confirmFork}
        isClash={isClash}
      />
      {/* The in-flight marker itself lives in the TOOLBAR, next to the counts it qualifies —
          it is the toolbar's `updating` prop, not a second marker here. Two nodes carrying one
          `data-testid` is a selector that throws rather than a surface that reports twice. */}

      {/* ── 192-10 (D-02 / D-05 / LIB-04 / SC#4) — ONE PERSISTENT TOOLBAR ──────────────
          157-B's claim, composed rather than described: create LEADS, search is always on,
          the three deleted shelf NAMES survive as three of the six chips (so the taxonomy
          outlives the shelves instead of being dropped with them), and the 200px project
          rail is now one control inside this bar — which also returns 200px of width to the
          grid, a measurable win at 200 workflows.

          ⚠ IT IS MOUNTED DURING THE FIRST LOAD, NOT AFTER IT, and that is a MEASURED
          requirement rather than a preference. The latest-wins guard exercises a state in
          which the mount fetch is still in flight while the project selection moves, so a
          toolbar withheld until the first settle would make the project control unreachable
          in exactly the state that guard exists to cover. `updating` therefore carries the
          INITIAL LOAD as well as a re-query: while it is set, the counts beside each chip are
          marked — machine-readably, via the toolbar's `data-state` — as describing rows that
          are not yet final, so a zero is never presented as a settled fact. */}
      <LibraryToolbar
        query={query}
        onQueryChange={setQuery}
        activeChips={activeChips}
        onToggleChip={toggleChip}
        counts={counts}
        projectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        folders={folders}
        updating={!allSettled || publishedUpdating}
        onCreate={openBuilderFresh}
        onClearAll={clearAllFilters}
      />

      {/* ── ONE FLAT LIST (D-02) ──────────────────────────────────────────────────────
          No shelf, no section header, no per-shelf empty line — a row's kind is carried by
          its own provenance mark on the card, and by the chips that can narrow to it. The
          three states below are held APART on purpose: nothing is rendered while the feeds
          are still settling (the loading line above says so), "you have none" and "none
          match what you asked for" are DIFFERENT FACTS, and the second one keeps the
          toolbar's way out one click away. */}
      {/* ⚠ 200-PORT — THE CANVAS GETS THE SHEET'S 24px MARGIN AND THE GRID GETS A CEILING.
          `px-6 py-5` becomes the sheet's even `p-6`, and the grid is capped at `max-w-[1200px]
          mx-auto` — its `max-w-[1200px] mx-auto`. Uncapped, a two-column grid on a wide monitor
          stretches each card past 900px, at which point a 14px name and an 11px meta line are
          separated by half a metre of empty card and the row stops reading as one object. The
          cap is what keeps the card's internal hierarchy legible at any window width; `gap-3`
          becomes the sheet's `gap-md` (16px) for the same reason. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {loading ? null : visibleRows.length > 0 ? (
          <div
            data-testid="library-list"
            className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 md:grid-cols-2"
          >
            {visibleRows.map((row) => (
              <WorkflowCard
                key={row.id}
                row={row}
                folderName={folderName(row.def?.project_folder_id)}
                onRun={handleRun}
                /* SEED-190 — the per-workflow door. The card hands up the SLUG (the identity
                   that survives a publish) and the name; this page turns that into the log's
                   scope. See `runLogScope`'s docblock for why it is not a definition id. */
                onRunLog={openRunLog}
                /* Phase 204 (SCHED-01) — the per-workflow schedules door. Additive, and it
                   hands up the row's ID rather than its slug: a schedule is a foreign key to
                   ONE definition version, which is the version that will run unattended. The
                   card explains the asymmetry with `onRunLog` in its own prop docblock. */
                onSchedule={setScheduleFor}
                onOpen={handleOpen}
                onForkNewVersion={onForkNewVersion}
                onForkStarter={onForkStarter}
                /* 192-14 — the sentence changes ONLY where the behaviour changes (D-14).
                   The `provenance === "published"` clause is load-bearing, not defensive: a
                   STARTER's fork runs `onUseStarter`, which ALWAYS mints a fresh
                   auto-suffixed slug at v1 and therefore always makes a genuinely new copy,
                   so "you already have one" would be false on a starter row even if some
                   draft happened to share its slug. Draft rows render no consequence
                   sentence at all, so they are unaffected either way. Only the page can
                   answer this — it alone holds the merged drafts feed. */
                hasExistingFork={row.provenance === "published" && draftBySlug.has(row.slug)}
                /* 192.1-06 (D-05 / D-08) — the 14th atom's content, RESOLVED HERE. The card
                   computes nothing about slugs or versions; it paints what this returns. The
                   index is keyed `[rows]` alone so `1 of N` describes the library rather than
                   the current search, and `now` is the ONE clock every card in this pass
                   shares — see both docblocks above for why neither can live in the other. */
                identity={resolveIdentity(identityIndex, row, now)}
                /* 192.2-05 (LIB-06 / P-1) — THE SAME `now`, HANDED TO THE SECOND CONSUMER.
                   D-01's line 2 carries a relative band (`Worked 2 days ago`), so the card
                   reads a clock too. It reads THIS one: a card left to `cardFace`'s own
                   default would give each of the 107 rows its own instant, and two rows in
                   one pass could then straddle a band boundary. One clock per render pass,
                   two consumers — never two clocks. */
                now={now}
                /* 192.2-09 (LIB-06 / WR-04) — WHY THIS ROW IS HERE, RESOLVED BY THE PAGE.
                   The third prop of exactly the kind the two above it are: only the page
                   holds the SELECTION, so only the page can answer *why is this row in the
                   filtered list*; the card paints what it is handed and derives nothing.
                   The SAME `selection` object that narrowed the list is what each row is
                   asked under — one object, never a second inline literal — so a row can
                   never explain itself under a selection the list was not narrowed by.
                   On a resting page this returns `[]` for every row and the card renders
                   nothing, which is what keeps D-03's subtraction intact. */
                matchReasons={matchReasons(row, selection)}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        ) : rows.length === 0 && failedSources.length > 0 ? (
          /**
           * ⚠ AN EMPTY LIST AND A FAILED FEED ARE DIFFERENT CLAIMS, and only one of them is
           * ours to make. `loading` is `!anySettled`, and a source that FAILED counts as
           * settled — so without this branch the all-feeds-fail path fell straight through to
           * `LIBRARY_STATES.empty` and told the user "You have no workflows yet" while the
           * banners above it said we could not load them. That is an affirmative statement
           * about the user's own data, made from evidence we do not have.
           *
           * `LIBRARY_STATES["source-failed"]` was authored in 192-05 for exactly this state and
           * had no consumer until this branch — the vocabulary knew the honest answer before
           * the page asked for it. Found by the 192 code review (CR-01), reproduced
           * independently at verification, fixed here under G-3 rather than as a gap round.
           */
          <p
            data-testid="library-empty-source-failed"
            className="text-[13px] italic text-muted-foreground"
          >
            {LIBRARY_STATES["source-failed"]}
          </p>
        ) : rows.length === 0 ? (
          <p data-testid="library-empty" className="text-[13px] italic text-muted-foreground">
            {LIBRARY_STATES.empty}
          </p>
        ) : (
          <p
            data-testid="library-filtered-empty"
            className="text-[13px] italic text-muted-foreground"
          >
            {LIBRARY_STATES["filtered-empty"]}
          </p>
        )}
      </div>

      {/* ── Schedule modal (204 SCHED-01) ────────────────────────────────────────────
            Mounted here for the same reason the Run modal is: this page owns the library
            selection, so it is the only place that knows WHICH workflow a per-row door was
            opened for. `key` forces fresh modal state between opens, exactly as RunModal's
            does — a stale cadence form carried across two different workflows is the shape
            that quietly schedules the wrong thing. */}
      {scheduleFor && (
        <WorkflowScheduleModal
          key={scheduleFor.id}
          workflow={scheduleFor}
          // 214-09 (STEP-02 / D-214-04): the definition, for its DECLARED entry inputs.
          // `onSchedule` hands this page a `{ id, name }` scope only, so the definition is
          // looked up out of the feed this page already owns rather than threaded through
          // the card — the card's prop surface is unchanged, and the modal grows no feed of
          // its own. `undefined` when the row is not in `published` (a starter or a draft
          // reached this door): the modal then renders exactly as it shipped.
          definition={
            (published.find((p) => p.id === scheduleFor.id)?.definition as DefShape | undefined) ??
            null
          }
          onClose={() => setScheduleFor(null)}
        />
      )}

      {/* ── Run modal (152 WFIN-01/02: scope <select> + staged template + provenance;
            D-LOCK-01/02). `key` forces fresh per-workflow modal state (staged file +
            scope pick reset between opens). ── */}
      {runFor && (
        <RunModal
          key={runFor.id}
          wf={runFor}
          folders={folders}
          authorDefaultFolderId={(runFor.definition as DefShape | undefined)?.project_folder_id ?? null}
          kickoff={kickoff}
          submitting={runSubmitting}
          onKickoffChange={setKickoff}
          onCancel={() => {
            if (runSubmitting) return
            setRunFor(null)
          }}
          onRun={async ({ templateFile, folderId, inputs }) => {
            // WR-05: one click = one thread. Ignore re-entry while a launch is in flight.
            if (runSubmitting) return
            const target = runFor
            const text = kickoff
            setRunSubmitting(true)
            try {
              // 152 (WFIN-01/02): thread the staged template + per-run folder override
              // through the existing launch (doRun uploads the file to the launched
              // thread, then create_workflow_run.inputs carries folder_id). Re-throw on
              // failure so the modal can render the server's 422 verbatim (do NOT close).
              // 214-09 (STEP-02 / D-214-04): the declared-input dict is FORWARDED in the
              // same commit that renders the fields. A field rendered but not forwarded is
              // BUG-260826-01 in a new costume — a declared intention no launcher honours —
              // so the consumer widens with the producer, never one release later.
              await onLaunch(target, text, { templateFile, folderId, inputs })
              setRunFor(null) // close only on a successful launch
            } finally {
              setRunSubmitting(false)
            }
          }}
        />
      )}
    </div>
  )
}

// ── 192-10 (D-01 / D-02 / D-09) — WHAT USED TO LIVE BELOW THIS LINE, AND WHY IT DOES NOT ──
//
// Four components were DECLARED here and are declared nowhere now. This page is composition:
// it owns fetching, merge and filter state, and the Builder handoff, and it declares no card,
// no filter item and no modal.
//
//  • `FilterItem`    — the project rail's toggle. Its shipped `aria-pressed` contract survives
//                      as the toolbar's chip skin; the rail itself is one `<select>` (D-05).
//  • `DraftCard`     — one of three cards for one list. Replaced by the ONE card (D-09).
//  • `PublishedCard` — the same, and it took the ⋯-menu and the delete-Sheet mount with it.
//  • `StarterCard`   — the same, and its "Use this →" is now the shared fork verb (D-12/D-13).
//
// ⚠ THE FUNCTION AND ITS LAST RENDER LEAVE IN THE SAME COMMIT, ALWAYS. `noUnusedLocals` and
// `noUnusedParameters` are on in `tsconfig.app.json`, so a helper left behind after its last
// call site is removed is a TYPE ERROR, not a lint warning — and every import those four
// declarations were the last consumer of had to go with them. Which imports those were was
// READ OUT of `tsc`, the same method 192-06 and 192-08 used for their own cuts, never guessed.
//
// `NetNewFlag` DELIBERATELY STAYS (see its own docblock above): only its two LIBRARY renders
// were removed. Its Builder-band render is Phase 193's surface and is asserted byte-exactly.
export default WorkflowsPage
