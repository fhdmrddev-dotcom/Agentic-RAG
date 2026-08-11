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
import {
  listPublishedWorkflows,
  listStarterWorkflows,
  listDraftWorkflows,
  createWorkflowDraft,
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
  mergeLibrary,
} from "@/components/workflows/library/libraryFilter"
import type { ChipId, LibraryRow, Provenance } from "@/components/workflows/library/libraryRow"
// Phase 192-10 (D-02 / D-09): the two surfaces this page now COMPOSES rather than declares.
// One persistent toolbar over one flat list of one card — the page owns fetching, filter
// state and layout, and declares no card, no filter item and no modal of its own.
import { LibraryToolbar } from "@/components/workflows/library/LibraryToolbar"
import { WorkflowCard } from "@/components/workflows/library/WorkflowCard"
import {
  LIBRARY_STATES,
  forkFailedMessage,
  sourceFailedMessage,
} from "@/components/workflows/library/libraryVocabulary"
import type { Folder } from "@/types"

/** Phase 143 (WF-01 / D-143-1) — a 6-char base36 fork-slug suffix for the fresh-copy
 *  fork (`<starter-slug>-<hash>`). Robustly 6 chars of [a-z0-9] even if a single
 *  Math.random().toString(36) run falls short (rare), so it always matches the
 *  `<slug>-[a-z0-9]{6}` shape the fork/collision contract expects (Pitfall 5). */
function freshHash(): string {
  let h = ""
  while (h.length < 6) h += Math.random().toString(36).slice(2)
  return h.slice(0, 6)
}

/**
 * 192-15 (WR-03) — IS THIS FORK FAILURE A SLUG/VERSION COLLISION? ONE HOME FOR ONE QUESTION.
 *
 * It changes NOTHING about behaviour. `onUseStarter` already asked this question inline to
 * decide whether to retry, and `onTweak` now has to ask it to decide which true sentence to
 * show — and two copies of one predicate are two answers to one question waiting to disagree.
 *
 * ⚠ WR-08, RECORDED HONESTLY RATHER THAN HIDDEN BEHIND A TIDY NAME: keying control flow on
 * ERROR PROSE is fragile, and giving it a function does not make it less so. `createWorkflowDraft`
 * throws a bare `Error` whose MESSAGE carries the status (`…(status 409)`), so the status code is
 * only reachable as a substring. The real fix is a typed error at the throw site — an `api.ts`
 * change with callers OUTSIDE this page (notably `useDraftPersistence`), which is a new surface
 * and therefore out of scope for a gap-closure round under G-7. Naming it here is the honest
 * middle: the fragility now has exactly one place to be fixed instead of two.
 *
 * RE-OPEN TRIGGER: the next phase that touches `createWorkflowDraft`'s throw site replaces this
 * substring test with the typed error's own discriminator, in the same commit.
 */
function isForkConflict(e: unknown): boolean {
  return String(e).includes("409")
}

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
   *  Both absent = today's byte-identical launch (D-06). */
  onLaunch: (
    def: PublishedWorkflow,
    kickoff: string,
    opts?: { templateFile?: File | null; folderId?: string | null },
  ) => Promise<void>
}

type PageView = "library" | "builder"

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

export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {
  // Phase 184.1-01: does this page host the Builder's chrome, or has the Builder taken it?
  // Fail-closed and read through the shared rule — see `useCanvasGate`'s docblock for why
  // an ancestor has to ask at all (the three bands are contributed at three nesting levels).
  const canvasEnabled = useCanvasGate()
  const [pageView, setPageView] = useState<PageView>("library")
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
  /**
   * 192-15 (WR-03) — A FORK CLICK THAT FAILED, HELD UNTIL THE NEXT FORK ATTEMPT.
   *
   * It carries a DISPLAY NAME and a BOOLEAN, deliberately, rather than the error itself: a
   * shape that cannot hold server prose, a status code or an id cannot leak one to the surface
   * (T-192-40). The raw error keeps going to `console.error` at the boundary for whoever is
   * debugging — the `WorkflowDraftUnreadableError` posture, where the developer's evidence and
   * the person's sentence are two different things and one never replaces the other.
   */
  const [forkFailed, setForkFailed] = useState<{ name: string; conflict: boolean } | null>(null)

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
  const visibleRows = useMemo(
    () => filterLibrary(rows, { query, chips: activeChips, projectId: selectedProjectId }),
    [rows, query, activeChips, selectedProjectId],
  )

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

  /**
   * 192-14 (the U5 blocker) — THE DRAFTS THIS CALLER ALREADY OWNS, BY SLUG.
   *
   * Built from the `drafts` feed, which `GET /workflows/drafts` scopes server-side to
   * `created_by = caller`. A slug match here can therefore only ever resolve to a row this
   * person already owns — the lookup widens no scope and reaches no new endpoint.
   *
   * ⚠ THE HIGHEST VERSION WINS, and the rule is stated because "the draft for this slug" is
   * genuinely ambiguous: measured in the live DB on 2026-08-11, `pm-weekly-status-report`
   * carries `1:published, 2:draft, 3:published, 4:draft` — TWO drafts under one slug. Left to
   * insertion order the answer would be whichever the server happened to return first, which is
   * not an answer. The most recent fork is the one a person means by "my copy".
   */
  const draftBySlug = useMemo(() => {
    const bySlug = new Map<string, WorkflowDraftRow>()
    for (const d of drafts) {
      const held = bySlug.get(d.slug)
      if (!held || d.version > held.version) bySlug.set(d.slug, d)
    }
    return bySlug
  }, [drafts])

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
      label: `Edit · ${draft.name ?? draft.slug} v${draft.version}`,
      // 186-07: the ONE route that does not create — the drafts list itself now serves
      // the token (186-03), so an edit-in-place session is guarded from its first write.
      // `?? null` because a shelf row read before that field shipped simply has none, and
      // an unguarded first write is the honest fallback rather than a crash.
      token: draft.token ?? null,
    })
    setPageView("builder")
  }, [])

  // ── Tweak: fork a v(N+1) DRAFT (INSERT) — never UPDATE the frozen published row —
  //    then open the FORKED copy's existing steps in the Builder (NOT the describe
  //    screen). The new draft id is captured so every save PATCHes the fork.
  //
  //    ⚠ 192-14 — FIRST, THOUGH: if this caller ALREADY has a draft of this slug, the verb
  //    OPENS THAT DRAFT and creates nothing. That branch is the operator's 2026-08-11
  //    decision on the U5 blocker (`192-UAT.md` test 11), where a fork click 409'd twice and
  //    the surface said nothing at all. Opening the existing copy removes the collision
  //    class outright rather than making it rarer, and the card says so before the click
  //    (the card's `FORK_CONSEQUENCE_EXISTING` sentence, 192-13). ──
  const onTweak = useCallback(
    async (wf: PublishedWorkflow) => {
      // ── THE EXISTING-DRAFT BRANCH (192-14) ──
      // Nothing is created and nothing is fetched, so there is no request that can 409.
      // `onOpenDraft` is REUSED rather than a third `setBuilderInitial` call site added,
      // which is what threads 186-07's opaque concurrency token by construction instead of
      // by remembering to — a dropped token is a silent-clobber bug that typechecks.
      const existing = draftBySlug.get(wf.slug)
      if (existing) {
        onOpenDraft(existing)
        return
      }

      // ── THE CREATE PATH, DELIBERATELY UNCHANGED BELOW THIS LINE ──
      // `def.version` is read off the JSONB `definition`, where it is NULL on every live row
      // (the real version is the `version` COLUMN), so `nextVersion` is effectively the
      // constant 2. That is left ALONE on purpose: `PublishedWorkflow` carries no `version`
      // on the wire (root cause C in `192-UAT.md`), so the client is not told the real one,
      // and a "smarter" guess would only make the collision RARER — which is exactly what the
      // operator's decision rejected in favour of removing the failure class.
      //
      // ⚠ THE RESIDUAL, NAMED RATHER THAN SMOOTHED. Re-measured in the live local DB on
      // 2026-08-11: 18 slugs carry more than one version, and 2 of them —
      // `meridian-risk-summary-good-07aedc33` and `readonly_refusal_098uat` — are
      // `published + published` with NO draft at all. The branch above cannot help those:
      // their fork still 409s. Plan `192-15` is what makes that refusal VISIBLE instead of
      // silent. 16 of 18 is not "the class is gone", and this comment exists so nobody reads
      // it that way.
      const def = (wf.definition ?? {}) as Record<string, unknown>
      const currentVersion = typeof def.version === "number" ? (def.version as number) : 1
      const nextVersion = currentVersion + 1
      const forked = {
        ...def,
        slug: wf.slug,
        version: nextVersion,
        status: "draft",
      } as WorkflowDefinitionJSON
      // 192-15: clear any notice from a PREVIOUS attempt before making this one. A failure
      // message left standing over a later success is its own kind of lie (T-192-43).
      setForkFailed(null)
      try {
        const created = await createWorkflowDraft(forked)
        await refetchDrafts()
        // Load the fork's existing definition into the editing view with its NEW id.
        setBuilderInitial({
          definition: forked,
          draftId: created.id,
          label: `Tweak · ${wf.slug} v${nextVersion}`,
          // 186-07: the create response's own token guards the fork's first PATCH.
          token: created.token,
        })
        setPageView("builder")
      } catch (e) {
        // 192-15 (WR-03): the log STAYS — it is the developer's evidence — and the person
        // now gets a sentence too. This is the path the 2 measured `published + published`
        // residual slugs above take, and it is the only thing standing between them and a
        // dead button, so it reports rather than swallows. Tweak has NO retry and gains none:
        // its 409 is a deterministic collision, and a second identical write would fail
        // identically while making the surface look busy.
        console.error("[WorkflowsPage] Tweak fork failed", e)
        setForkFailed({ name: wf.name, conflict: isForkConflict(e) })
      }
    },
    [refetchDrafts, draftBySlug, onOpenDraft],
  )

  // ── Use this starter (WF-01, D-143-1): a FRESH-COPY fork. A sibling of onTweak
  //    with exactly two deltas — a NEW auto-suffixed slug + version:1 (NOT the
  //    same-slug Tweak's v(N+1)) — required because UNIQUE(slug, version) is GLOBAL
  //    across all users, so two forkers of ONE shared starter can't both mint
  //    <slug> v(N+1). The server (createWorkflowDraft → POST /workflows) forces
  //    is_system_global=false / status=draft / created_by=caller; the published starter row
  //    stays frozen. On a 409 slug/version collision (astronomically unlikely hash
  //    clash) retry once with a fresh hash (Pitfall 5). Lands in the Builder (D-143-1a). ──
  const onUseStarter = useCallback(
    async (starter: PublishedWorkflow) => {
      const def = (starter.definition ?? {}) as Record<string, unknown>
      // 192-15: same rule as Tweak — clear before attempting, so a stale notice can never
      // sit above a fork that has just succeeded. BEFORE the loop, not inside it: the retry
      // is one attempt from the person's point of view.
      setForkFailed(null)
      for (let attempt = 0; attempt < 2; attempt++) {
        // NOTE: `def` may carry `category:"starter"` — that is SAFE (Plan 01 added the
        // additive field to WorkflowDefinition); do NOT strip it from the fork body.
        const forked = {
          ...def,
          slug: `${starter.slug}-${freshHash()}`,
          version: 1,
          status: "draft",
        } as WorkflowDefinitionJSON
        try {
          const created = await createWorkflowDraft(forked)
          await refetchDrafts()
          setBuilderInitial({
            definition: forked,
            draftId: created.id,
            label: `From starter · ${starter.name}`,
            // 186-07: same as Tweak — the fresh copy's create response carries it.
            token: created.token,
          })
          setPageView("builder")
          return
        } catch (e) {
          // Retry ONCE on a slug/version collision; any other error surfaces + stops.
          //
          // ⚠ 192-15 — THE RETRY IS UNTOUCHED. Only the classification moved into
          // `isForkConflict` (byte-identical predicate, one home instead of two). Deleting the
          // retry would have been "fixing" the silence by removing the very behaviour that
          // needed reporting, so it is pinned from the inside by a case asserting exactly TWO
          // `createWorkflowDraft` calls (T-192-42).
          if (attempt === 0 && isForkConflict(e)) continue
          // The TERMINAL branch — the one that already logged and returned. Now it also says
          // so. Both fork handlers report, because they share ONE WORD on the card face (D-12)
          // and a person cannot tell which of them they clicked; a surface that reports only
          // half its failures is not honest.
          console.error("[WorkflowsPage] starter fork failed", e)
          setForkFailed({ name: starter.name, conflict: isForkConflict(e) })
          return
        }
      }
    },
    [refetchDrafts],
  )

  // 186-07: a TRUE fresh build seeds nothing at all — no row exists yet, so there is no
  // token to carry. `useDraftPersistence` creates the row on the first write and adopts
  // the token that create returns, which is the same posture as `token: null`.
  const openBuilderFresh = useCallback(() => {
    setBuilderInitial(null)
    setPageView("builder")
  }, [])

  // ── 192-10 (D-09 / D-12) — THE CARD'S FIVE CALLBACKS ─────────────────────────────────
  //
  // `WorkflowCard` speaks `LibraryRow`; the four shipped handlers above speak the WIRE types.
  // These five adapters are the whole seam, and each reads `row.source` — the original wire
  // object, kept whole by `libraryRow.ts` precisely so a handler never receives a rebuilt
  // object that has quietly lost a field (`onOpenDraft` needs the draft's opaque `token`; a
  // rebuilt object that drops it is the D-186-07 SILENT CLOBBER — a behaviour bug that
  // typechecks).
  //
  // ⚠ D-12 — THE TWO FORK ADAPTERS ARE SIBLINGS AND ARE NEVER MERGED. `onForkNewVersion`
  // reaches `onTweak` (SAME slug at version N+1) and `onForkStarter` reaches `onUseStarter`
  // (a FRESH auto-suffixed slug at version 1, retried once on a 409). They share one word on
  // the card face because the user's intent is identical; merging the handlers behind that
  // word breaks the GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one
  // shared starter. The card branches on `provenance` and constructs neither slug nor version.
  const handleRun = useCallback((row: LibraryRow) => {
    setRunFor(row.source as PublishedWorkflow)
    setKickoff("")
  }, [])

  const handleOpen = useCallback(
    (row: LibraryRow) => onOpenDraft(row.source as WorkflowDraftRow),
    [onOpenDraft],
  )

  const handleForkNewVersion = useCallback(
    (row: LibraryRow) => onTweak(row.source as PublishedWorkflow),
    [onTweak],
  )

  const handleForkStarter = useCallback(
    (row: LibraryRow) => onUseStarter(row.source as PublishedWorkflow),
    [onUseStarter],
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
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-semibold text-foreground">Workflows</h1>
          <span className="text-[13px] text-muted-foreground">
            Repeatable, locked automations — author, publish, and Run into a thread.
          </span>
        </div>
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
      {failedSources.map((source) => (
        <p
          key={source}
          data-testid={`library-source-failed-${source}`}
          className="border-b border-warning/30 bg-warning/5 px-6 py-2 text-[12.5px] text-muted-foreground"
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
          the in-flight marker below). */}
      {forkFailed && (
        <p
          data-testid="library-fork-failed"
          role="status"
          className="border-b border-warning/30 bg-warning/5 px-6 py-2 text-[12.5px] text-muted-foreground"
        >
          {forkFailedMessage(forkFailed.name, forkFailed.conflict)}
        </p>
      )}
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
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading ? null : visibleRows.length > 0 ? (
          <div data-testid="library-list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleRows.map((row) => (
              <WorkflowCard
                key={row.id}
                row={row}
                folderName={folderName(row.def?.project_folder_id)}
                onRun={handleRun}
                onOpen={handleOpen}
                onForkNewVersion={handleForkNewVersion}
                onForkStarter={handleForkStarter}
                /* 192-14 — the sentence changes ONLY where the behaviour changes (D-14).
                   The `provenance === "published"` clause is load-bearing, not defensive: a
                   STARTER's fork runs `onUseStarter`, which ALWAYS mints a fresh
                   auto-suffixed slug at v1 and therefore always makes a genuinely new copy,
                   so "you already have one" would be false on a starter row even if some
                   draft happened to share its slug. Draft rows render no consequence
                   sentence at all, so they are unaffected either way. Only the page can
                   answer this — it alone holds the merged drafts feed. */
                hasExistingFork={row.provenance === "published" && draftBySlug.has(row.slug)}
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
          onRun={async ({ templateFile, folderId }) => {
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
              await onLaunch(target, text, { templateFile, folderId })
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
