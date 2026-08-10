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
 * Honesty (D14): only GET /workflows/published + POST /workflows/{id}/publish are
 * live; the draft-CRUD affordances + the Workflows nav entry wear a net-new violet
 * flag.
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
import { useCallback, useEffect, useRef, useState } from "react"
import { MoreHorizontal, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
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
// none of them and leaves NO re-export shim. The Sheet owns its own state, so `PublishedCard`
// keeps only a ref to ASK it to open — a guard whose state stays behind is split, not moved.
import {
  WorkflowDeleteSheet,
  type WorkflowDeleteSheetHandle,
} from "@/components/workflows/library/WorkflowDeleteSheet"
import type { Folder } from "@/types"

/** Sentinel for the "Unbound (no project)" filter (IR-04 — module-scope, not per-render). */
const UNBOUND = "__unbound__"

/** Phase 143 (WF-01 / D-143-1) — a 6-char base36 fork-slug suffix for the fresh-copy
 *  fork (`<starter-slug>-<hash>`). Robustly 6 chars of [a-z0-9] even if a single
 *  Math.random().toString(36) run falls short (rare), so it always matches the
 *  `<slug>-[a-z0-9]{6}` shape the fork/collision contract expects (Pitfall 5). */
function freshHash(): string {
  let h = ""
  while (h.length < 6) h += Math.random().toString(36).slice(2)
  return h.slice(0, 6)
}

/** A small violet net-new honesty flag (D14). */
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

export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {
  // Phase 184.1-01: does this page host the Builder's chrome, or has the Builder taken it?
  // Fail-closed and read through the shared rule — see `useCanvasGate`'s docblock for why
  // an ancestor has to ask at all (the three bands are contributed at three nesting levels).
  const canvasEnabled = useCanvasGate()
  const [pageView, setPageView] = useState<PageView>("library")
  // null = "All projects"; "__unbound__" = unbound; else a folder id.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
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

  // ── Latest-wins race guards (Phase 103-ux) ──────────────────────────────────
  // Rapid project-filter clicks fire overlapping fetches; without a guard a SLOW
  // earlier response can land AFTER a faster later one and paint a STALE list (the
  // live symptom: "All projects" showed 7, a specific project showed 16, but the
  // rendered list lagged the selection). Each fetch takes a monotonic ticket; only
  // the most-recently-issued ticket is allowed to commit its result to state.
  const publishedSeqRef = useRef(0)
  const startersSeqRef = useRef(0)
  const draftsSeqRef = useRef(0)

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
    const rows = await listPublishedWorkflows(projectArg, undefined, { scope: "mine" })
    // Latest-wins: a stale (superseded) response NEVER paints over a newer selection.
    if (seq !== publishedSeqRef.current) return
    if (selectedProjectId === UNBOUND) {
      setPublished(rows.filter((r) => !(r.definition as DefShape | undefined)?.project_folder_id))
    } else {
      setPublished(rows)
    }
  }, [selectedProjectId])

  // Phase 143 (WF-01): the curated Starters feed — a single unscoped global fetch on
  // mount. Same latest-wins guard as the others (cheap insurance though a single
  // unscoped fetch rarely races).
  const refetchStarters = useCallback(async () => {
    const seq = ++startersSeqRef.current
    const rows = await listStarterWorkflows()
    if (seq !== startersSeqRef.current) return
    setStarters(rows)
  }, [])

  const refetchDrafts = useCallback(async () => {
    const seq = ++draftsSeqRef.current
    const rows = await listDraftWorkflows()
    // Same latest-wins guard (drafts are re-fetched on mount + after publish/tweak).
    if (seq !== draftsSeqRef.current) return
    setDrafts(rows)
  }, [])

  useEffect(() => {
    refetchPublished().catch(console.error)
  }, [refetchPublished])

  useEffect(() => {
    refetchStarters().catch(console.error)
  }, [refetchStarters])

  useEffect(() => {
    refetchDrafts().catch(console.error)
  }, [refetchDrafts])

  const folderName = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null
      return folders.find((f) => f.id === id)?.name ?? null
    },
    [folders],
  )

  // ── Tweak: fork a v(N+1) DRAFT (INSERT) — never UPDATE the frozen published row —
  //    then open the FORKED copy's existing steps in the Builder (NOT the describe
  //    screen). The new draft id is captured so every save PATCHes the fork. ──
  const onTweak = useCallback(
    async (wf: PublishedWorkflow) => {
      const def = (wf.definition ?? {}) as Record<string, unknown>
      const currentVersion = typeof def.version === "number" ? (def.version as number) : 1
      const nextVersion = currentVersion + 1
      const forked = {
        ...def,
        slug: wf.slug,
        version: nextVersion,
        status: "draft",
      } as WorkflowDefinitionJSON
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
        console.error("[WorkflowsPage] Tweak fork failed", e)
      }
    },
    [refetchDrafts],
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
          if (attempt === 0 && String(e).includes("409")) continue
          console.error("[WorkflowsPage] starter fork failed", e)
          return
        }
      }
    },
    [refetchDrafts],
  )

  // ── Open a draft: load THAT draft's definition into the Builder editing view
  //    (edit-in-place — saves PATCH the same row via its real id). ──
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

  // 186-07: a TRUE fresh build seeds nothing at all — no row exists yet, so there is no
  // token to carry. `useDraftPersistence` creates the row on the first write and adopts
  // the token that create returns, which is the same posture as `token: null`.
  const openBuilderFresh = useCallback(() => {
    setBuilderInitial(null)
    setPageView("builder")
  }, [])

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
  const runCtaWf =
    runCta && published.find((w) => w.slug === runCta.slug)

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

      {/* Honesty banner (D14) */}
      <div className="border-b border-accent-violet/20 bg-accent-violet/5 px-6 py-2 text-[12px] text-muted-foreground">
        Drafts are yours to shape; <b className="text-foreground">Published</b> is live (
        <span className="font-mono text-[11px] text-success">GET /workflows/published</span>). Draft
        create/list/update/delete are <NetNewFlag />.
      </div>

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

      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-6 overflow-y-auto px-6 py-5">
        {/* ── Project filter rail (live ?project_folder_id= re-query) ── */}
        <nav aria-label="Project filter" className="flex flex-col gap-1">
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Project
          </p>
          <FilterItem label="All projects" active={selectedProjectId === null} onClick={() => setSelectedProjectId(null)} />
          {folders.map((f) => (
            <FilterItem
              key={f.id}
              label={f.name}
              active={selectedProjectId === f.id}
              onClick={() => setSelectedProjectId(f.id)}
            />
          ))}
          <FilterItem
            label="Unbound (no project)"
            active={selectedProjectId === UNBOUND}
            onClick={() => setSelectedProjectId(UNBOUND)}
          />
        </nav>

        {/* ── Shelves: Starters → Published → Drafts (BUG-260628-01 fold, D-143-5):
              runnable/curated on top, drafts below (they were burying published). ── */}
        <div className="flex flex-col gap-6">
          {/* Starters shelf (WF-01, D-143-5/8 — curated, fork-able global starters, on TOP) */}
          <section data-testid="starters-shelf">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Starters · {starters.length}
              </h2>
              <span
                title="Curated, official starter workflows — fork one into your own editable copy"
                className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase text-primary"
              >
                curated
              </span>
            </div>
            {starters.length === 0 ? (
              <p className="text-[13px] italic text-muted-foreground">No starters available yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {starters.map((wf) => (
                  <StarterCard key={wf.id} wf={wf} onUse={() => onUseStarter(wf)} />
                ))}
              </div>
            )}
          </section>

          {/* Published shelf (live-backed, MINE-only — D-143-2a; scaffolds+starters de-duped) */}
          <section data-testid="published-shelf">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Published · {published.length}
              </h2>
              <span
                title="The live, owner-scoped endpoint (mine-only via ?scope=mine)"
                className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-success"
              >
                GET /workflows/published
              </span>
            </div>
            {published.length === 0 ? (
              <p className="text-[13px] italic text-muted-foreground">
                No published workflows{selectedProjectId ? " for this project" : ""} yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {published.map((wf) => (
                  <PublishedCard
                    key={wf.id}
                    wf={wf}
                    folderName={folderName((wf.definition as DefShape | undefined)?.project_folder_id)}
                    onRun={() => { setRunFor(wf); setKickoff("") }}
                    onTweak={() => onTweak(wf)}
                    // 152-04 (WFIN-03): after a confirmed cascade delete, re-fetch the
                    // Published shelf so the card is removed ONLY on server confirmation
                    // (D-LOCK-04 — no optimistic vanish; the list never filters locally).
                    onDeleted={() => { refetchPublished().catch(console.error) }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Drafts & seeds shelf (below the runnable shelves; the Build-card lives here) */}
          <section data-testid="drafts-shelf">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Drafts &amp; seeds · {drafts.length}
              </h2>
              <NetNewFlag label="net-new list" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* The dashed "Build a workflow" build-card FIRST. */}
              <button
                type="button"
                data-testid="build-card"
                onClick={openBuilderFresh}
                className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-transparent p-4 text-center transition-colors hover:border-primary/60"
              >
                <span aria-hidden="true" className="text-2xl text-muted-foreground">
                  ＋
                </span>
                <span className="text-[14px] font-medium text-foreground">Build a workflow</span>
                <span className="text-[12px] text-muted-foreground">
                  Describe it in plain English → AI drafts it
                </span>
              </button>

              {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} onOpen={() => onOpenDraft(d)} />
              ))}
            </div>
          </section>
        </div>
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

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-[12.5px] transition-colors " +
        (active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground")
      }
    >
      <span className="truncate">{label}</span>
    </button>
  )
}

function DraftCard({ draft, onOpen }: { draft: WorkflowDraftRow; onOpen: () => void }) {
  const def = draft.definition as DefShape | undefined
  return (
    <div
      data-testid="draft-card"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4"
    >
      {/* Card chrome (NOT a soul atom): name/version header row + status pill. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">📝</span>
            <span className="truncate text-[14px] font-medium text-foreground">
              {draft.name ?? draft.slug}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">v{draft.version}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
          draft
        </span>
      </div>
      {/* WUX-01: the shared card-scale soul replaces the old TierBadge + PhaseChain +
          "entry needs" trio — the SAME essence the run header + publish summary show. */}
      <WorkflowSoul def={def} scale="card" />
      {/* D12: a draft CANNOT be Run — Open✎ + Publish… only (publish is the test). */}
      <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2">
        <button
          type="button"
          data-testid="draft-open"
          onClick={onOpen}
          className="rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/40"
        >
          ✎ Open
        </button>
        <button
          type="button"
          data-testid="draft-publish"
          onClick={onOpen}
          className="rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/40"
        >
          Publish…
        </button>
      </div>
    </div>
  )
}

function PublishedCard({
  wf,
  folderName,
  onRun,
  onTweak,
  onDeleted,
}: {
  wf: PublishedWorkflow
  folderName: string | null
  onRun: () => void
  onTweak: () => void
  /** Forwarded straight to <WorkflowDeleteSheet>, which is the single home of the D-LOCK-04
   *  re-fetch seam since 192-08 — the contract moved WITH the code that honours it, verbatim
   *  and with its docblock. Two copies of one contract is exactly the drift an extraction
   *  exists to remove, so this prop points at the owner rather than restating it. */
  onDeleted: () => void
}) {
  const def = wf.definition as DefShape | undefined
  const version = typeof def?.version === "number" ? def.version : undefined

  // Phase 192-08 (D-01): the `DeletePhase` union, the five state hooks, `descId`,
  // `openDeleteSheet` and `handleDelete` ALL left with the Sheet — a guard whose state
  // stays behind is not moved, it is split. What the card keeps is a way to ASK.
  // (Both mentions above deliberately avoid spelling the DECLARATION: the one-direction
  //  row at the foot of `PublishedCardDelete.test.tsx` is a raw source grep, and 192-06's
  //  deviation 2 recorded the same trap in the other direction.)
  const deleteSheetRef = useRef<WorkflowDeleteSheetHandle>(null)

  return (
    <div data-testid="published-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* Card chrome (NOT a soul atom): name/version header, folder chip, ⋯-menu + status pill. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">📄</span>
            <span className="truncate text-[14px] font-medium text-foreground">{wf.name}</span>
            {version !== undefined && (
              <span className="font-mono text-[11px] text-muted-foreground">v{version}</span>
            )}
          </div>
          {folderName && (
            <span className="mt-0.5 inline-block text-[11px] text-muted-foreground">📁 {folderName}</span>
          )}
        </div>
        {/* Right cluster: the NET-NEW ⋯ menu (Pitfall 8 — no menu existed on this card)
            sits immediately left of the published pill. Neutral treatment; the destructive
            weight lands ONLY on Delete-forever in the sheet (UI-SPEC Visual Hierarchy). */}
        <div className="flex flex-none items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Workflow actions"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                data-testid="published-delete"
                className="text-destructive focus:text-destructive"
                onClick={() => deleteSheetRef.current?.openDeleteSheet()}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Delete workflow…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
            published
          </span>
        </div>
      </div>
      {/* WUX-01: the shared card-scale soul (tier chip + glyph-dot spine + needs +
          output) replaces the old TierBadge + PhaseChain + "entry needs" trio. */}
      <WorkflowSoul def={def} scale="card" />
      {/* D-01: the Run/Tweak footer stays UNCHANGED — the Phase-121 one-click launch —
          it is NEVER routed through the two-door fork. */}
      <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2">
        <button
          type="button"
          data-testid="published-tweak"
          onClick={onTweak}
          title="Fork a new version into the Builder (the published row stays frozen)"
          className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-foreground hover:bg-accent/40"
        >
          ⑂ Tweak
        </button>
        <button
          type="button"
          data-testid="published-run"
          onClick={onRun}
          className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90"
        >
          ▶ Run
        </button>
      </div>

      {/* ── WFIN-03 victim-naming delete Sheet (D-LOCK-03/04/05) — MOVED VERBATIM in 192-08
            (D-01) to `components/workflows/library/WorkflowDeleteSheet.tsx`, which owns its
            own state AND its own JSX. All five properties of the heaviest guard grade went
            with it, comments included: exact server counts fetched BEFORE the destructive
            action is offered, the amber cancel-first banner only when a run is live, the
            in-place lifecycle, never dismissing mid-delete, and no optimistic vanish/undo.
            This card holds a ref and forwards two props; it decides none of it. ── */}
      <WorkflowDeleteSheet ref={deleteSheetRef} wf={wf} onDeleted={onDeleted} />
    </div>
  )
}

// Phase 143 (WF-01, D-143-8) — the curated Starter card. Reuses the EXACT PublishedCard
// chrome + the shared <WorkflowSoul scale="card"> (no new card design; G-2 waived), with
// two swaps: a "Starter" chip (the Glean verified-badge analog, cloned from the published
// pill) and a "Use this" fork affordance (data-testid="use-starter") wired to onUseStarter
// instead of the ⑂ Tweak / ▶ Run pair. The published starter row is never mutated by the
// card — "Use this" mints a fresh OWNED copy (createWorkflowDraft INSERT).
function StarterCard({ wf, onUse }: { wf: PublishedWorkflow; onUse: () => void }) {
  const def = wf.definition as DefShape | undefined
  return (
    <div data-testid="starter-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* Card chrome: name header + the curated "Starter" chip (filled primary — distinct
          from the outlined "published" pill so curated ≠ user-made reads at a glance). */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">✨</span>
            <span className="truncate text-[14px] font-medium text-foreground">{wf.name}</span>
          </div>
        </div>
        <span
          title="A curated, official starter — fork it into your own editable copy"
          className="shrink-0 rounded-full border border-primary/50 bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary"
        >
          Starter
        </span>
      </div>
      {/* The SAME shared card-scale soul the published + draft cards render. */}
      <WorkflowSoul def={def} scale="card" />
      {/* D-143-1/1a: "Use this" forks a FRESH owned copy (new slug + v1) into the Builder —
          NOT the same-slug Tweak. (Label omits the word "starter" so the "Starter" chip is
          the single curated marker on the card.) */}
      <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2">
        <button
          type="button"
          data-testid="use-starter"
          onClick={onUse}
          title="Fork a fresh personal copy of this starter into the Builder"
          className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90"
        >
          Use this →
        </button>
      </div>
    </div>
  )
}

export default WorkflowsPage
