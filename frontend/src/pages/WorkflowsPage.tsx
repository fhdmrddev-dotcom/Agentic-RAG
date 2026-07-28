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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Upload, Check, X, MoreHorizontal, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  listPublishedWorkflows,
  listStarterWorkflows,
  listDraftWorkflows,
  createWorkflowDraft,
  getWorkflowDeletePreview,
  deleteWorkflowCascade,
  type PublishedWorkflow,
  type WorkflowDraftRow,
  type WorkflowDefinitionJSON,
  type WorkflowDeletePreview,
} from "@/lib/api"
// Phase 184.1-01 (D-184.1-04): the ONE canvas-gate rule, imported rather than
// re-derived — three components now need the answer and a hand-copied three-part
// predicate is exactly the drift this project keeps getting bitten by.
import { type BuilderInitial, useCanvasGate } from "@/pages/WorkflowBuilderPage"
import { PublishGauntlet } from "@/components/workflows/PublishGauntlet"
// Phase 124-02 Task 1 (WUX-01): the soul atoms (tier + glyph + needs) now come from
// the ONE shared soulData module (Plan 01 extracted them VERBATIM from this page —
// the page is no longer their owner). The card renders the shared <WorkflowSoul>.
import { entryInputKeys, type DefShape } from "@/components/workflows/soulData"
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
// Phase 124-02 Task 2 (WUX-02): the Studio authoring entry forks into the two-door
// shell (047-A). The govern door delegates to the existing Builder (the shell mounts
// it; the page no longer mounts WorkflowBuilderPage directly).
import { WorkflowDoorSwitch } from "@/components/workflows/WorkflowDoorSwitch"
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
  const [builderInitial, setBuilderInitial] = useState<
    { definition: WorkflowDefinitionJSON; draftId: string; label: string } | null
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
    })
    setPageView("builder")
  }, [])

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
            initial={
              builderInitial
                ? ({ definition: builderInitial.definition, draftId: builderInitial.draftId } as BuilderInitial)
                : undefined
            }
            // Phase 184-11 (D-184-16 debt 1): the Builder registers its unsaved-work
            // predicate here; the breadcrumb above consults it.
            registerCanLeave={registerCanLeave}
            renderPublish={(_def, draftId, blockedReason) =>
              draftId ? (
                <PublishGauntlet
                  definitionId={draftId}
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

/** The in-place delete lifecycle (D-LOCK-04), adapting the 064-B KillPhase machine:
 *  idle → deleting (Deleting…) → deleted (Deleted · recorded) | error (Try again). */
type DeletePhase = "idle" | "deleting" | "deleted" | "error"

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
  /** 152-04 (WFIN-03): re-fetch the Published shelf after a CONFIRMED cascade delete —
   *  the card leaves the list ONLY on server confirmation (D-LOCK-04: no optimistic
   *  vanish, no undo; hard-delete is irreversible). */
  onDeleted: () => void
}) {
  const def = wf.definition as DefShape | undefined
  const version = typeof def?.version === "number" ? def.version : undefined

  // ── WFIN-03 delete surface (D-LOCK-03/04/05). The ⋯-menu opens a victim-naming
  //    confirm Sheet (the shipped 064-B / ActiveRunsSection primitive): it names the
  //    EXACT server counts (Removed vs Kept), shows an amber cancel-first banner when a
  //    run is live, and transitions the card in place — never an optimistic vanish. ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [preview, setPreview] = useState<WorkflowDeletePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [deletePhase, setDeletePhase] = useState<DeletePhase>("idle")
  const descId = `wf-delete-${wf.id}`

  const openDeleteSheet = () => {
    // Fresh state each open, then fetch the EXACT server counts BEFORE offering the
    // destructive action — the sheet never renders placeholder/guessed counts (D-LOCK-03).
    setPreview(null)
    setPreviewError(null)
    setDeletePhase("idle")
    setSheetOpen(true)
    getWorkflowDeletePreview(wf.id)
      .then(setPreview)
      .catch((e) =>
        setPreviewError(e instanceof Error ? e.message : "Couldn’t load the delete preview"),
      )
  }

  const handleDelete = async () => {
    setDeletePhase("deleting")
    try {
      await deleteWorkflowCascade(wf.id)
      setDeletePhase("deleted")
      // Server-confirmed: re-fetch the shelf so the card leaves the list ONLY now
      // (D-LOCK-04 — the list is never filtered locally / optimistically).
      onDeleted()
    } catch {
      setDeletePhase("error")
    }
  }

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
                onClick={openDeleteSheet}
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

      {/* ── WFIN-03 victim-naming delete Sheet (D-LOCK-03/04/05 — the shipped 064-B /
            ActiveRunsSection bottom-sheet primitive). EXACT server-sourced Removed/Kept
            counts; an amber cancel-first banner ONLY when a run is live; an in-place
            lifecycle (Deleting… → Deleted · recorded) with NO optimistic vanish + NO undo.
            The single destructive-weighted control is Delete-forever. ── */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          // Never dismiss mid-delete (the action is in flight). A confirmed delete stays
          // open on its terminal state until the shelf re-fetch unmounts the card.
          if (!o && deletePhase === "deleting") return
          setSheetOpen(o)
        }}
      >
        <SheetContent side="bottom" aria-describedby={descId} className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Delete this workflow?</SheetTitle>
          </SheetHeader>
          <div id={descId} className="px-4 pb-4">
            {previewError ? (
              <div>
                <p role="alert" className="text-sm text-destructive">
                  {previewError}
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : preview === null ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading the exact counts…
              </p>
            ) : (
              <>
                {/* Removed group — danger-tinted heading + EXACT server counts (never guessed). */}
                <div>
                  <p className="text-[13px] font-semibold text-destructive">Permanently removed</p>
                  <p className="mt-1 text-sm text-foreground">
                    <span className="font-medium">{preview.name}</span> · {preview.versions} versions ·{" "}
                    {preview.runs} run records
                  </p>
                </div>
                {/* Kept group — neutral heading + the reassurance that closes "no orphaned
                    threads"; it ALWAYS renders (incl. the 0-threads variant). */}
                <div className="mt-6">
                  <p className="text-[13px] font-semibold text-foreground">Kept — not touched</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preview.threads > 0
                      ? `${preview.threads} chat threads become normal chats — transcripts & files stay. Your knowledge base is untouched.`
                      : "No chat threads to keep."}
                  </p>
                </div>
                {/* Amber cancel-first banner — ONLY when a run is live (D-LOCK-05); amber,
                    never red (the graded action-guards rule). */}
                {preview.in_flight > 0 && (
                  <div
                    role="status"
                    data-testid="delete-inflight-banner"
                    className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    <span>
                      {preview.in_flight === 1
                        ? "1 run is still in progress. It’s cancelled safely first, then the workflow is deleted."
                        : `${preview.in_flight} runs are still in progress. They’re cancelled safely first, then the workflow is deleted.`}
                    </span>
                  </div>
                )}
                {/* Action row / in-place lifecycle (adapts the 064-B KillPhase terminals). */}
                <div className="mt-5 flex items-center justify-end gap-2">
                  {deletePhase === "idle" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        data-testid="delete-forever"
                        onClick={() => void handleDelete()}
                        className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                      >
                        Delete forever
                      </button>
                    </>
                  )}
                  {deletePhase === "deleting" && (
                    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Deleting…
                    </span>
                  )}
                  {deletePhase === "deleted" && (
                    <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                      Deleted · recorded
                    </span>
                  )}
                  {deletePhase === "error" && (
                    <div className="flex items-center gap-2">
                      <span role="status" className="text-sm text-destructive">
                        Couldn’t delete the workflow
                      </span>
                      <button
                        type="button"
                        data-testid="delete-retry"
                        onClick={() => void handleDelete()}
                        className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
                {/* Recorded footer — the audit receipt honesty (D-LOCK-03). */}
                <p className="mt-4 text-[12px] text-muted-foreground">
                  ✎ Recorded with your name in the audit log.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
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

function RunModal({
  wf,
  folders,
  authorDefaultFolderId,
  kickoff,
  submitting,
  onKickoffChange,
  onCancel,
  onRun,
}: {
  wf: PublishedWorkflow
  /** The owner's project folders — the scope <select>'s option source (D-LOCK-01). */
  folders: Folder[]
  /** The workflow's author-time retrieval default (definition.project_folder_id).
   *  null = an unbound workflow (whole-KB default). */
  authorDefaultFolderId: string | null
  kickoff: string
  submitting: boolean
  onKickoffChange: (v: string) => void
  onCancel: () => void
  /** 152 (WFIN-01/02): launch carries the two run inputs — a staged template `File`
   *  and a per-run folder override `folderId` (null = stay on the workflow default,
   *  D-06). May reject (e.g. a template 422) → the modal renders the message inline. */
  onRun: (extras: { templateFile: File | null; folderId: string | null }) => void | Promise<void>
}) {
  const def = wf.definition as DefShape | undefined
  const keys = entryInputKeys(def)

  // ── WFIN-02 (D-LOCK-01) + WR-05: the KB-scope <select>. The "" option is ALWAYS the
  //    resting selection and truthfully labels the server-applied scope: for a BOUND
  //    workflow it reads "Workflow default" (the override channel is narrow-only, D-06 —
  //    "" resolves to the author default server-side, never whole-KB), and ONLY an
  //    UNBOUND workflow (no project_folder_id) reads "All documents" (where folderId:null
  //    genuinely means whole-KB). A real folder DIFFERENT from the author default is the
  //    only per-run override.
  const authorDefaultExists =
    !!authorDefaultFolderId && folders.some((f) => f.id === authorDefaultFolderId)
  // Initial selection is "" in every case — for a bound workflow "" now truthfully IS
  // the workflow default (WR-05); it never mislabels an author-scoped run as whole-KB.
  const [selectedFolderId, setSelectedFolderId] = useState<string>("")
  // ── WFIN-01 (D-LOCK-02): the staged template File. No thread exists yet — doRun
  //    uploads it to the launched thread (Landmine 8); this only stages it.
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  // The inline launch/upload error (the server's validate_upload 422 verbatim — it
  // surfaces at launch because the upload targets the launched thread, not on stage).
  const [launchError, setLaunchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // A4 composition guard (WR-03 — the client mirror of backend scope.py
  // resolve_run_scope_root, 152-06): a workflow that declares any per-phase folder_scope
  // must NOT offer an override whose OWN subtree misses a declared phase's folder_scope —
  // that would silently empty the phase's ∩ at retrieval (phase_types.py:326). Membership
  // in the author subtree is necessary but NOT sufficient (a child A of project P empties
  // a phase scoped to sibling B), so we intersect against each CANDIDATE's own subtree.
  const hasPhaseFolderScope = (def?.phases ?? []).some((p) => {
    const fs = (p.config as { folder_scope?: unknown } | undefined)?.folder_scope
    return Array.isArray(fs) && fs.length > 0
  })
  // Each declared phase's non-empty folder_scope id list. A phase with no folder_scope
  // imposes no constraint — dropped here, exactly like the backend's `if scope and …`.
  const phaseFolderScopes = useMemo<string[][]>(() => {
    return (def?.phases ?? [])
      .map((p) => {
        const fs = (p.config as { folder_scope?: unknown } | undefined)?.folder_scope
        return Array.isArray(fs) ? fs.filter((x): x is string => typeof x === "string") : []
      })
      .filter((fs) => fs.length > 0)
  }, [def])
  const authorDefaultName = authorDefaultExists
    ? folders.find((f) => f.id === authorDefaultFolderId)?.name ?? null
    : null
  // Override options = every OTHER owner-reachable folder. For a workflow that declares
  // per-phase folder_scope, mirror the CORRECTED backend A4 rule (scope.py, 152-08): the
  // override must satisfy BOTH the NECESSARY author-subtree membership AND the SUFFICIENT
  // per-phase intersection. No-scope workflows are unchanged.
  const overrideOptions = useMemo(() => {
    const candidates = folders.filter((f) => f.id !== authorDefaultFolderId)
    if (!hasPhaseFolderScope) return candidates
    const subtreeOf = (rootId: string): Set<string> => {
      const ids = new Set<string>()
      const visit = (rid: string) => {
        if (ids.has(rid)) return
        ids.add(rid)
        for (const f of folders) if (f.parent_id === rid) visit(f.id)
      }
      visit(rootId)
      return ids
    }
    // NECESSARY (author-subtree containment — mirrors scope.py's restored A4 check, 152-08):
    // for a BOUND folder_scope workflow, a candidate must be a MEMBER of the author's OWN
    // project subtree. A strict ANCESTOR/SIBLING of the bound project would WIDEN the run's
    // retrieval to unrelated sibling projects, so it must NEVER be offered. When there is no
    // author default (the UNBOUND + folder_scope shape) there is no declared boundary to
    // contain against — skip this filter and apply only the per-phase intersection (the
    // unbound path stays as shipped).
    const contained =
      authorDefaultFolderId != null
        ? candidates.filter((cand) => subtreeOf(authorDefaultFolderId).has(cand.id))
        : candidates
    // SUFFICIENT (per-phase intersection): keep a candidate ONLY when EVERY declared phase
    // folder_scope still intersects the CANDIDATE's OWN subtree — otherwise offering it steers
    // the run into empty retrieval (phase_types.py:326).
    return contained.filter((cand) => {
      const sub = subtreeOf(cand.id)
      return phaseFolderScopes.every((scope) => scope.some((id) => sub.has(id)))
    })
  }, [folders, hasPhaseFolderScope, phaseFolderScopes, authorDefaultFolderId])

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = "" // reset so re-selecting the same file fires change again
    if (!f) return
    setTemplateFile(f)
    setLaunchError(null)
  }

  const handleRun = async () => {
    setLaunchError(null)
    // Only a real folder that DIFFERS from the author default is a per-run override.
    // The "" option (labelled "Workflow default" for a bound wf, "All documents" for an
    // unbound one — WR-05) passes NO override (D-06). NOTE: the Plan-01 override channel
    // narrows only — a bound workflow cannot widen to whole-KB via this path (override
    // falls through to the author default), which is exactly why the "" label reads
    // "Workflow default" (not "All documents") on a bound workflow. Narrowing works.
    const normalized = selectedFolderId || null
    const folderId = normalized && normalized !== authorDefaultFolderId ? normalized : null
    try {
      await onRun({ templateFile, folderId })
    } catch (e) {
      // Surface the server's validate_upload message VERBATIM (never a friendlier lie).
      setLaunchError(e instanceof Error ? e.message : "Run failed")
    }
  }
  // WR-06 (a11y): a lightweight focus contract for the aria-modal dialog —
  // Escape-to-close, initial focus on the textarea, and Tab containment within the
  // dialog (a minimal trap, no heavy dep / no shadcn Dialog rewrite).
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Initial focus lands inside the dialog (the kickoff textarea).
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        if (!submitting) onCancel()
        return
      }
      if (e.key !== "Tab") return
      // Simple focus containment: keep Tab/Shift+Tab inside the dialog.
      const root = dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCancel, submitting])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Run ${wf.name}`}
      data-testid="run-modal"
      className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
    >
      <div className="w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span aria-hidden="true">📄</span>
          <span className="text-[15px] font-semibold text-foreground">{wf.name}</span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          {/* WFIN-02 (D-LOCK-01): the KB-scope <select> — native, byte-matching the
              ChatArea scope selector ("All documents / {folder}"). The author default
              is tagged "workflow default"; picking another = a per-run override. Hidden
              when there are no folders (matches ChatArea's folders.length guard). */}
          {folders.length > 0 && (
            <label data-testid="run-scope" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-foreground">Knowledge base:</span>
              <select
                data-testid="run-scope-select"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {/* WR-05: the "" option truthfully labels the server-applied scope.
                    Bound → "Workflow default" (with the folder name when the author
                    folder is visible, bare otherwise — never a whole-KB lie); unbound →
                    "All documents" (folderId:null genuinely means whole-KB). */}
                <option value="">
                  {authorDefaultFolderId
                    ? authorDefaultName
                      ? `Workflow default — 📁 ${authorDefaultName}`
                      : "Workflow default"
                    : "All documents"}
                </option>
                {overrideOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-foreground">What should this run work on?</span>
            <textarea
              ref={textareaRef}
              data-testid="run-kickoff"
              value={kickoff}
              onChange={(e) => onKickoffChange(e.target.value)}
              rows={3}
              placeholder="Describe the task for this run…"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {/* WFIN-01 (D-LOCK-02): a quiet, self-start template upload. The button STAGES
              the picked File in modal state (no thread exists yet — doRun uploads it to
              the launched thread, Landmine 8). Idle → validated-file card ({name} ✓ ✕)
              OR the inline 422 error (server message verbatim, role="alert"). Beneath it,
              the honest provenance note. */}
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp"
              aria-label="Upload template file"
              tabIndex={-1}
              className="hidden"
              onChange={onFilePicked}
            />
            {templateFile ? (
              <div
                data-testid="run-template-file"
                className="flex items-center gap-2 self-start rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px]"
              >
                <span className="text-foreground">{templateFile.name}</span>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <button
                  type="button"
                  aria-label="Remove template"
                  disabled={submitting}
                  onClick={() => {
                    setTemplateFile(null)
                    setLaunchError(null)
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="run-template-upload"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5",
                  "text-[12px] font-medium text-foreground/80 transition-colors",
                  "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {submitting ? "Uploading…" : "Upload template"}
              </button>
            )}
            {launchError && (
              <p data-testid="run-upload-error" role="alert" className="px-0.5 text-[11px] text-destructive">
                {launchError}
              </p>
            )}
            <p data-testid="run-provenance" className="px-0.5 text-[12px] text-muted-foreground">
              Stored untrusted — never run as code, never fed to the fill engine.
            </p>
          </div>
          {/* Declared input_keys → a HINT line only (never fake structured fields). */}
          <p data-testid="run-hint" className="text-[12px] text-muted-foreground">
            This workflow expects: <span className="font-mono text-foreground">{keys.join(", ")}</span>
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[12px] text-muted-foreground">
            Run opens a <b className="text-foreground">new chat thread</b> and streams there.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            {/* D-103-1: Run stays ENABLED even on empty input; WR-05: disabled only
                while a launch is in flight (one click = one thread). */}
            <button
              type="button"
              data-testid="run-confirm"
              disabled={submitting}
              onClick={() => void handleRun()}
              className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Running…" : "▶ Run workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkflowsPage
