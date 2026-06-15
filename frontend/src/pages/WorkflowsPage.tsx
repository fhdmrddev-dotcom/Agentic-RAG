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
  listDraftWorkflows,
  createWorkflowDraft,
  type PublishedWorkflow,
  type WorkflowDraftRow,
  type WorkflowDefinitionJSON,
} from "@/lib/api"
import { deriveTier, type CitationPolicy, type ValidatorKind } from "@/components/workflows/deriveTier"
import { WorkflowBuilderPage, type BuilderInitial } from "@/pages/WorkflowBuilderPage"
import { PublishGauntlet } from "@/components/workflows/PublishGauntlet"
import type { Folder } from "@/types"

// ── Phase-type glyph vocabulary (mirrors PhaseSpineGraph by VALUE, not import —
//    the established 103-04 pattern; the 6th ◆ llm_emit "deliverable"). ──
const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙",
  llm_single: "✎",
  llm_agent: "🤖",
  llm_batch_agents: "⛓",
  llm_human_input: "☺",
  llm_emit: "◆",
}
const PHASE_TYPE_LABELS: Record<string, string> = {
  programmatic: "server",
  llm_single: "AI write",
  llm_agent: "agent",
  llm_batch_agents: "parallel",
  llm_human_input: "needs you",
  llm_emit: "deliverable",
}

/** A loose read-shape over the definition JSONB (we only read what the card needs). */
interface DefShape {
  project_folder_id?: string | null
  inputs?: Array<{ key?: string }> | null
  input_keys?: string[] | null
  phases?: Array<{
    slug?: string
    phase_index?: number
    name?: string | null
    config?: { phase_type?: string; citation_policy?: string; [k: string]: unknown }
    validators?: Array<{ kind?: string }> | null
  }> | null
  [k: string]: unknown
}

/** Sentinel for the "Unbound (no project)" filter (IR-04 — module-scope, not per-render). */
const UNBOUND = "__unbound__"

const ALL_VALIDATOR_KINDS: ReadonlySet<string> = new Set<ValidatorKind>([
  "citations_required",
  "output_file_valid",
  "freshness",
  "structure_check",
  "llm_judge_rubric",
])

/**
 * The citation_policy strictness order (loosest → strictest). Used to pick the
 * STRICTEST declared policy across multiple emit phases deterministically (WR-03).
 * Mirrors the deriveTier mapping intent — strict refines a workflow's whole tier up.
 */
const POLICY_ORDER: readonly CitationPolicy[] = ["draft", "partial", "flag", "strict"]

/** Return the stricter of two citation policies (the higher POLICY_ORDER rank). */
function stricterPolicy(a: CitationPolicy, b: CitationPolicy): CitationPolicy {
  return POLICY_ORDER.indexOf(b) > POLICY_ORDER.indexOf(a) ? b : a
}

/**
 * Derive the strictness tier for a card from its REAL definition (D10): the
 * citation_policy comes from the strictest llm_emit phase's config (default
 * "draft" when no emit phase declares one — no per-phase citation gate), and the
 * validator-kind set is the union across all phases. The badge is computed on
 * every render — there is NO stored tier string read anywhere.
 */
function tierForDefinition(def: DefShape | null | undefined) {
  const phases = def?.phases ?? []
  // Pick the STRICTEST citation_policy across all emit phases (WR-03 — deterministic
  // "stricter wins" via POLICY_ORDER, not iteration-order-dependent). Default "draft"
  // when there is no emit phase at all (the only place citation_policy lives).
  let citationPolicy: CitationPolicy = "draft"
  let sawEmit = false
  for (const p of phases) {
    if (p.config?.phase_type === "llm_emit") {
      const cp = p.config?.citation_policy
      if (cp === "strict" || cp === "flag" || cp === "partial" || cp === "draft") {
        citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
        sawEmit = true
      }
    }
  }
  const kinds = new Set<ValidatorKind>()
  for (const p of phases) {
    for (const v of p.validators ?? []) {
      if (v.kind && ALL_VALIDATOR_KINDS.has(v.kind)) kinds.add(v.kind as ValidatorKind)
    }
  }
  return deriveTier(citationPolicy, kinds)
}

/** The entry input_keys the card surfaces ("entry needs <keys>"). */
function entryInputKeys(def: DefShape | null | undefined): string[] {
  if (!def) return []
  if (Array.isArray(def.input_keys) && def.input_keys.length > 0) return def.input_keys
  const fromInputs = (def.inputs ?? []).map((i) => i?.key).filter((k): k is string => !!k)
  if (fromInputs.length > 0) return fromInputs
  // The wire kickoff is always content-only → kickoff_prompt (D-103-CONF-1).
  return ["kickoff_prompt"]
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

/** The phase-type chain (glyph + name + type label), color-honest and read-only. */
function PhaseChain({ def }: { def: DefShape | null | undefined }) {
  const phases = [...(def?.phases ?? [])].sort(
    (a, b) => (a.phase_index ?? 0) - (b.phase_index ?? 0),
  )
  if (phases.length === 0) {
    return <p className="text-[11px] italic text-muted-foreground">No phases</p>
  }
  return (
    <div data-testid="phase-chain" className="flex flex-wrap items-center gap-1">
      {phases.map((p, i) => {
        const type = p.config?.phase_type ?? "?"
        const glyph = PHASE_GLYPHS[type] ?? "•"
        const typeLabel = PHASE_TYPE_LABELS[type] ?? type
        const title = p.name?.trim() || p.slug || typeLabel
        return (
          <span key={p.slug ?? i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-muted-foreground">→</span>}
            <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
              <span aria-hidden="true">{glyph}</span>
              <span className="max-w-[120px] truncate">{title}</span>
              <span className="font-mono text-[8.5px] uppercase text-muted-foreground">{typeLabel}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** The tier badge (D10 — derived, glyph + label, non-color-alone). */
function TierBadge({ def }: { def: DefShape | null | undefined }) {
  const tier = tierForDefinition(def)
  return (
    <span
      data-testid="tier-badge"
      data-tier={tier.id}
      title={tier.description}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-foreground"
    >
      <span aria-hidden="true">{tier.glyph}</span>
      {tier.label}
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
  const draftsSeqRef = useRef(0)

  const refetchPublished = useCallback(async () => {
    // "All projects" → no filter; "Unbound" → filter is not server-expressible as a
    // folder id, so we fetch all + narrow client-side to defs with no project_folder_id;
    // a real folder id → live ?project_folder_id= re-query (the narrows-only filter).
    const projectArg = selectedProjectId && selectedProjectId !== UNBOUND ? selectedProjectId : null
    const seq = ++publishedSeqRef.current
    const rows = await listPublishedWorkflows(projectArg)
    // Latest-wins: a stale (superseded) response NEVER paints over a newer selection.
    if (seq !== publishedSeqRef.current) return
    if (selectedProjectId === UNBOUND) {
      setPublished(rows.filter((r) => !(r.definition as DefShape | undefined)?.project_folder_id))
    } else {
      setPublished(rows)
    }
  }, [selectedProjectId])

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
          <WorkflowBuilderPage
            // OPEN/TWEAK: load the existing definition straight into the editing
            // view with its real row id (saves PATCH it). Absent → fresh build.
            // The api layer's definition JSONB is intentionally opaque
            // (Record<string, unknown>); the Builder refines it internally, so the
            // initial pair is built once + cast at this single seam.
            initial={
              builderInitial
                ? ({ definition: builderInitial.definition, draftId: builderInitial.draftId } as BuilderInitial)
                : undefined
            }
            renderPublish={(_def, draftId) =>
              draftId ? (
                <PublishGauntlet
                  definitionId={draftId}
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

        {/* ── Shelves: Drafts ABOVE Published ── */}
        <div className="flex flex-col gap-6">
          {/* Drafts & seeds shelf (D8 — above Published; the Build-card lives here) */}
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

          {/* Published shelf (live-backed) */}
          <section data-testid="published-shelf">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Published · {published.length}
              </h2>
              <span
                title="The live, owner-scoped endpoint"
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
  const keys = entryInputKeys(def)
  return (
    <div
      data-testid="draft-card"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4"
    >
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
        <div className="flex shrink-0 items-center gap-1">
          <TierBadge def={def} />
          <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
            draft
          </span>
        </div>
      </div>
      <PhaseChain def={def} />
      <span className="text-[11px] text-muted-foreground">
        entry needs <span className="font-mono text-foreground">{keys.join(", ")}</span>
      </span>
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
  const keys = entryInputKeys(def)
  const version = typeof def?.version === "number" ? def.version : undefined
  return (
    <div data-testid="published-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
        <div className="flex shrink-0 items-center gap-1">
          <TierBadge def={def} />
          <span className="rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
            published
          </span>
        </div>
      </div>
      <PhaseChain def={def} />
      <span className="text-[11px] text-muted-foreground">
        entry needs <span className="font-mono text-foreground">{keys.join(", ")}</span>
      </span>
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
