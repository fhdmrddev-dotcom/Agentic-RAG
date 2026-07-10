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
import { useCallback, useEffect, useRef, useState } from "react"
import {
  listPublishedWorkflows,
  listStarterWorkflows,
  listDraftWorkflows,
  createWorkflowDraft,
  type PublishedWorkflow,
  type WorkflowDraftRow,
  type WorkflowDefinitionJSON,
} from "@/lib/api"
import { type BuilderInitial } from "@/pages/WorkflowBuilderPage"
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
   *  sendMessage(workflowDefinitionId) → select + view + redirect to Chat. The page
   *  NEVER constructs a bespoke run route. */
  onLaunch: (def: PublishedWorkflow, kickoff: string) => Promise<void>
}

type PageView = "library" | "builder"

export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {
  const [pageView, setPageView] = useState<PageView>("library")
  // null = "All projects"; "__unbound__" = unbound; else a folder id.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [published, setPublished] = useState<PublishedWorkflow[]>([])
  // Phase 143 (WF-01): the curated Starters shelf (is_global + category='starter').
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
    // scope:"mine" so the curated Starters + the mig-061 dev scaffolds (both is_global)
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
  //    is_global=false / status=draft / created_by=caller; the published starter row
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

  // ── Back to the library: refresh both shelves so a newly-created/edited draft
  //    (or a tweaked fork) appears WITHOUT a manual browser refresh. ──
  const backToLibrary = useCallback(() => {
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
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
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
        </div>
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
            // OPEN/TWEAK: the existing definition + its real row id flows straight
            // through to the Builder's `initial` (saves PATCH it). Absent → fresh build.
            initial={
              builderInitial
                ? ({ definition: builderInitial.definition, draftId: builderInitial.draftId } as BuilderInitial)
                : undefined
            }
            renderPublish={(_def, draftId) =>
              draftId ? (
                <PublishGauntlet
                  definitionId={draftId}
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
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
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

      {/* ── Run modal (D-103-1: read-only folder chip + ONE textarea + hint; enabled on empty) ── */}
      {runFor && (
        <RunModal
          wf={runFor}
          folderName={folderName((runFor.definition as DefShape | undefined)?.project_folder_id)}
          kickoff={kickoff}
          submitting={runSubmitting}
          onKickoffChange={setKickoff}
          onCancel={() => {
            if (runSubmitting) return
            setRunFor(null)
          }}
          onRun={async () => {
            // WR-05: one click = one thread. Ignore re-entry while a launch is in flight.
            if (runSubmitting) return
            const target = runFor
            const text = kickoff
            setRunSubmitting(true)
            try {
              await onLaunch(target, text)
              setRunFor(null)
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
}: {
  wf: PublishedWorkflow
  folderName: string | null
  onRun: () => void
  onTweak: () => void
}) {
  const def = wf.definition as DefShape | undefined
  const version = typeof def?.version === "number" ? def.version : undefined
  return (
    <div data-testid="published-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* Card chrome (NOT a soul atom): name/version header, folder chip, status pill. */}
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
        <span className="shrink-0 rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
          published
        </span>
      </div>
      {/* WUX-01: the shared card-scale soul (tier chip + glyph-dot spine + needs +
          output) replaces the old TierBadge + PhaseChain + "entry needs" trio. */}
      <WorkflowSoul def={def} scale="card" />
      {/* D-01: the Run button below stays the Phase-121 one-click launch-into-thread —
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
  folderName,
  kickoff,
  submitting,
  onKickoffChange,
  onCancel,
  onRun,
}: {
  wf: PublishedWorkflow
  folderName: string | null
  kickoff: string
  submitting: boolean
  onKickoffChange: (v: string) => void
  onCancel: () => void
  onRun: () => void | Promise<void>
}) {
  const def = wf.definition as DefShape | undefined
  const keys = entryInputKeys(def)
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
          {/* Read-only bound-folder chip (D-103-1 — the NAME, never a path; never a picker). */}
          <div data-testid="run-folder-chip" className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Knowledge base:</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              📁 {folderName ?? "Bound to the workflow"}
            </span>
          </div>
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
              onClick={() => void onRun()}
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
