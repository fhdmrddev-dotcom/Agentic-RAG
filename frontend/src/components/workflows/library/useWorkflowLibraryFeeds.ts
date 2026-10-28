/**
 * Phase 298-04 (D-26 / G-5) — the Workflows library's three feeds, moved out of `WorkflowsPage`.
 *
 * The WorkflowsPage ledger section names this seam: the fetch orchestration (three feeds, their
 * per-source state, the latest-wins tickets) lived in a FIRING page. This hook holds it.
 *
 * ⛔ MOVED VERBATIM, comments included. What stays in the page, by decision: the
 * `allSettled` effect that drives these callbacks (pinned as SOURCE by
 * `WorkflowsPage.test.tsx`), the leave-guard calls and the Run modal. A module under `library/`
 * never imports the page (fence F4), so everything this hook needs is imported from its homes.
 *
 * Phase 298-04 (D-08 / D-09 / UI-D8 / UI-D10) — then the org arm. Each feed's rows and settled
 * state are TAGGED with the org their request was SENT under (`getActiveOrgId()`, the header) and
 * read only while that org is the active one: a switch drops the old org's rows at once and reads
 * every source as `pending`, so the page shows "Loading your workflows…" and never the empty
 * sentence or a 0 chip. The latest-wins tickets drop a late old-org answer. On a switch after
 * mount `onOrgSwitch` runs DURING RENDER (the page resets its project filter to All before any
 * effect can ask for the old org's project), `refetchPublished` changes identity (the page's
 * effect re-asks published) and this hook re-asks starters and drafts. ⛔ No keyed remount.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  listPublishedWorkflows,
  listStarterWorkflows,
  listDraftWorkflows,
  type PublishedWorkflow,
  type WorkflowDraftRow,
} from "@/lib/api"
import { type DefShape } from "@/components/workflows/soulData"
import { UNBOUND } from "@/components/workflows/library/libraryFilter"
import type { Provenance } from "@/components/workflows/library/libraryRow"
import { useActiveOrgId } from "@/hooks/useActiveOrgId"
// The header seam, read from `_core` (never the barrel, which suites mock wholesale).
import { getActiveOrgId } from "@/lib/api/_core"

/** Rows held with the org their request was sent under; `undefined` = never answered. */
interface Tagged<T> {
  org: string | null | undefined
  rows: T[]
}
const UNANSWERED: Tagged<never> = { org: undefined, rows: [] }
const NO_PUBLISHED: PublishedWorkflow[] = []
const NO_DRAFTS: WorkflowDraftRow[] = []

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
export type SourceState = "pending" | "ok" | "failed"

export interface WorkflowLibraryFeedsArgs {
  /** The page's project filter: `null` = All projects, `UNBOUND` = unbound, else a folder id. */
  selectedProjectId: string | null
  /** 298-04 (UI-D10): called once per org switch after mount, DURING RENDER — the page resets
   *  its project filter to All here. */
  onOrgSwitch?: () => void
}

export interface WorkflowLibraryFeeds {
  published: PublishedWorkflow[]
  starters: PublishedWorkflow[]
  drafts: WorkflowDraftRow[]
  sourceState: Record<Provenance, SourceState>
  publishedUpdating: boolean
  refetchPublished: () => Promise<void>
  refetchStarters: () => Promise<void>
  refetchDrafts: () => Promise<void>
}

export function useWorkflowLibraryFeeds({ selectedProjectId, onOrgSwitch }: WorkflowLibraryFeedsArgs): WorkflowLibraryFeeds {
  // 298-04 — the org key and the switch-after-mount reset (during render, see the docblock).
  const activeOrgId = useActiveOrgId()
  const [seenOrg, setSeenOrg] = useState(activeOrgId)
  if (seenOrg !== activeOrgId) {
    setSeenOrg(activeOrgId)
    onOrgSwitch?.()
  }

  // 298-04: each feed's rows are TAGGED with the org they were asked under (see `Tagged`).
  const [publishedHeld, setPublished] = useState<Tagged<PublishedWorkflow>>(UNANSWERED)
  // Phase 143 (WF-01): the curated Starters shelf (is_system_global + category='starter').
  const [startersHeld, setStarters] = useState<Tagged<PublishedWorkflow>>(UNANSWERED)
  const [draftsHeld, setDrafts] = useState<Tagged<WorkflowDraftRow>>(UNANSWERED)

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
  const [heldSourceState, setSourceState] = useState<Record<Provenance, SourceState>>({
    published: "pending",
    starter: "pending",
    draft: "pending",
  })
  /** A published re-query is in flight (D-17's companion rule). The previously-committed rows
   *  stay rendered with their correct counts under a quiet marker; nothing is zeroed. */
  const [publishedUpdating, setPublishedUpdating] = useState(false)

  /** 298-04: the org each source's settled state belongs to (`undefined` = not yet settled). */
  const [settledOrg, setSettledOrg] = useState<Record<Provenance, string | null | undefined>>({
    published: undefined,
    starter: undefined,
    draft: undefined,
  })

  const markSource = useCallback(
    (source: Provenance, next: Exclude<SourceState, "pending">, org: string | null) => {
      setSourceState((prev) => (prev[source] === next ? prev : { ...prev, [source]: next }))
      setSettledOrg((prev) => (prev[source] === org ? prev : { ...prev, [source]: org }))
    },
    [],
  )

  const refetchPublished = useCallback(async () => {
    // "All projects" → no filter; "Unbound" → filter is not server-expressible as a
    // folder id, so we fetch all + narrow client-side to defs with no project_folder_id;
    // a real folder id → live ?project_folder_id= re-query (the narrows-only filter).
    const projectArg = selectedProjectId && selectedProjectId !== UNBOUND ? selectedProjectId : null
    const seq = ++publishedSeqRef.current
    // 298-04: the tag is the header this request carries, read at SEND time.
    const sentUnder = getActiveOrgId()
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
        setPublished({ org: sentUnder, rows: rows.filter((r) => !(r.definition as DefShape | undefined)?.project_folder_id) })
      } else {
        setPublished({ org: sentUnder, rows })
      }
      markSource("published", "ok", sentUnder)
    } catch (err) {
      // A superseded failure is as stale as a superseded success — it must not paint a
      // failure notice over a selection that has already moved on.
      if (seq !== publishedSeqRef.current) return
      markSource("published", "failed", sentUnder)
      throw err
    } finally {
      if (seq === publishedSeqRef.current) setPublishedUpdating(false)
    }
    // 298-04: `activeOrgId` is a dependency on purpose — a new identity on an org switch is what
    // makes the page's allSettled effect re-ask published for the new org.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, markSource, activeOrgId])

  // Phase 143 (WF-01): the curated Starters feed — a single unscoped global fetch on
  // mount. Same latest-wins guard as the others (cheap insurance though a single
  // unscoped fetch rarely races).
  const refetchStarters = useCallback(async () => {
    const seq = ++startersSeqRef.current
    const sentUnder = getActiveOrgId()
    try {
      const rows = await listStarterWorkflows()
      if (seq !== startersSeqRef.current) return
      setStarters({ org: sentUnder, rows })
      markSource("starter", "ok", sentUnder)
    } catch (err) {
      if (seq !== startersSeqRef.current) return
      markSource("starter", "failed", sentUnder)
      throw err
    }
  }, [markSource])

  const refetchDrafts = useCallback(async () => {
    const seq = ++draftsSeqRef.current
    const sentUnder = getActiveOrgId()
    try {
      const rows = await listDraftWorkflows()
      // Same latest-wins guard (drafts are re-fetched on mount + after publish/tweak).
      if (seq !== draftsSeqRef.current) return
      setDrafts({ org: sentUnder, rows })
      markSource("draft", "ok", sentUnder)
    } catch (err) {
      if (seq !== draftsSeqRef.current) return
      // ⚠ THE ONE GATED FEED. A refusal here is a NORMAL outcome for a user without
      // `workflow_authoring` visibility, not an exception — it degrades to zero drafts and
      // says so, and it must NEVER be able to remove a published row or a starter from view.
      markSource("draft", "failed", sentUnder)
      throw err
    }
  }, [markSource])

  // 298-04 — on an org switch after mount, re-ask the two feeds whose callbacks stay `[]`-stable
  // (published is re-asked by the page's effect, through `refetchPublished`'s new identity).
  const fetchedOrgRef = useRef(activeOrgId)
  useEffect(() => {
    if (fetchedOrgRef.current === activeOrgId) return
    fetchedOrgRef.current = activeOrgId
    void Promise.allSettled([refetchStarters(), refetchDrafts()])
  }, [activeOrgId, refetchStarters, refetchDrafts])

  // 298-04 — what the page sees: the ACTIVE org's rows and states, else none and `pending`.
  // ⚠ This is not a re-query returning a source to `pending` (the docblock above forbids that):
  // after a switch the held answer belongs to ANOTHER list, so there is no answer for this one.
  const published = publishedHeld.org === activeOrgId ? publishedHeld.rows : NO_PUBLISHED
  const starters = startersHeld.org === activeOrgId ? startersHeld.rows : NO_PUBLISHED
  const drafts = draftsHeld.org === activeOrgId ? draftsHeld.rows : NO_DRAFTS
  const allCurrent =
    settledOrg.published === activeOrgId && settledOrg.starter === activeOrgId && settledOrg.draft === activeOrgId
  const sourceState: Record<Provenance, SourceState> = allCurrent
    ? heldSourceState
    : {
        published: settledOrg.published === activeOrgId ? heldSourceState.published : "pending",
        starter: settledOrg.starter === activeOrgId ? heldSourceState.starter : "pending",
        draft: settledOrg.draft === activeOrgId ? heldSourceState.draft : "pending",
      }

  return {
    published,
    starters,
    drafts,
    sourceState,
    publishedUpdating,
    refetchPublished,
    refetchStarters,
    refetchDrafts,
  }
}
