import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  Cpu,
  Database,
  FileCode,
  FileText,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
  Truck,
  Upload,
  Users,
  Wrench,
  X,
} from "lucide-react"

import type { ExpertBundle } from "@/types"
import {
  addExpertGrant,
  createExpert,
  draftExpert,
  draftSkillBody,
  getExpertGrants,
  removeExpertGrant,
  updateExpert,
  ExpertMemberSkillsUnknownError,
  SkillBodyDisabledError,
  type ExpertBundleCreate,
  type ExpertBundleUpdate,
  type ExpertGrant,
  type ExpertGrantCreate,
  type SuggestedNewSkill,
} from "@/lib/api/experts"
import { listFolders } from "@/lib/api/documents"
// ⛔ `createSkill` is the EXISTING, unchanged human write path (D-263-03). This studio
// adds NO second write path: `lib/api/skills.ts` is byte-identical after Phase 263.
import { createSkill, listSkills } from "@/lib/api/skills"
import { listConnectorConnections } from "@/lib/api/connectors"
import { SkillFormDialog } from "@/components/skills/SkillFormDialog"
import { ProposedSkillCard } from "./ProposedSkillCard"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"
import { cn } from "@/lib/utils"

export interface ExpertAuthoringStudioProps {
  initialData?: ExpertBundle | null
  onClose: () => void
  onSaved?: (bundle: ExpertBundle) => void
}

const AVAILABLE_ICONS = [
  { id: "chart", label: "Chart / Finance", icon: BarChart3 },
  { id: "scale", label: "Scale / Legal", icon: Scale },
  { id: "shield", label: "Shield / Security & HR", icon: Shield },
  { id: "briefcase", label: "Briefcase / Business", icon: Briefcase },
  { id: "truck", label: "Truck / Ops & Logistics", icon: Truck },
  { id: "terminal", label: "Terminal / Dev", icon: Terminal },
  { id: "cpu", label: "CPU / Engineering", icon: Cpu },
  { id: "database", label: "Database / Data", icon: Database },
  { id: "book", label: "Book / Knowledge", icon: BookOpen },
  { id: "file-text", label: "Document / General", icon: FileText },
  { id: "sparkles", label: "AI / General", icon: Sparkles },
]

const CATEGORY_PRESETS = [
  "General",
  "Finance",
  "Legal & Compliance",
  "Human Resources",
  "Engineering",
  "Operations",
  "Sales & Marketing",
]

function renderExpertGlyph(iconName: string, className = "h-5 w-5") {
  const found = AVAILABLE_ICONS.find((i) => i.id === iconName)
  const IconComponent = found ? found.icon : Sparkles
  return <IconComponent className={className} />
}

export function ExpertAuthoringStudio({
  initialData,
  onClose,
  onSaved,
}: ExpertAuthoringStudioProps) {
  const isEditing = Boolean(initialData?.id)

  // Form Fields
  const [name, setName] = useState(initialData?.name ?? "")
  const [slug, setSlug] = useState(initialData?.slug ?? "")
  const [icon, setIcon] = useState(initialData?.icon ?? "chart")
  const [category, setCategory] = useState(initialData?.category ?? "General")
  const [whenToUse, setWhenToUse] = useState(initialData?.when_to_use ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [exampleOutput, setExampleOutput] = useState(initialData?.example_output ?? "")
  const [scopeMode, setScopeMode] = useState<"restricted" | "biased">(
    initialData?.scope_mode ?? "biased",
  )
  const [toolFloorEnabled, setToolFloorEnabled] = useState(
    initialData?.tool_floor_enabled ?? true,
  )
  const [memberSkills, setMemberSkills] = useState<string[]>(
    initialData?.member_skills ?? [],
  )
  const [customSkillInput, setCustomSkillInput] = useState("")
  const [requiredConnections, setRequiredConnections] = useState<string[]>(
    initialData?.required_connections ?? [],
  )
  const [knowledgeFolderIds, setKnowledgeFolderIds] = useState<string[]>(
    initialData?.knowledge_folder_ids ?? [],
  )
  const [promptSuggestions, setPromptSuggestions] = useState<
    Array<{ title: string; prompt: string }>
  >(
    initialData?.prompt_suggestions && initialData.prompt_suggestions.length > 0
      ? initialData.prompt_suggestions
      : [
          { title: "Review Report", prompt: "Please analyze this quarterly report for key trends and risks." },
          { title: "Extract Metrics", prompt: "Extract all key operating metrics and calculate YoY variance." },
          { title: "Draft Summary", prompt: "Draft an executive summary highlighting the top takeaways." },
        ],
  )
  const [visibility, setVisibility] = useState<"org" | "granted" | "private" | "public">(
    (initialData?.visibility as any) === "granted" || (initialData?.visibility as any) === "restricted"
      ? "granted"
      : (initialData?.visibility as any) ?? "org",
  )
  const [grantRole, setGrantRole] = useState("org-admin")
  const [grantUserId, setGrantUserId] = useState("")
  const [grants, setGrants] = useState<ExpertGrantCreate[]>([])

  // AI Brainstorming State
  const [brainstormPrompt, setBrainstormPrompt] = useState("")
  const [brainstormFiles, setBrainstormFiles] = useState<File[]>([])
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  // Submitting / Saving state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Phase 263-04 (D-263-10): the names the SERVER refused, carried by the typed 422.
  // ⛔ Rendered as-is — never a list this client re-derives from a stale library snapshot.
  const [serverUnknownSkills, setServerUnknownSkills] = useState<string[]>([])

  // Phase 263-04 (PACK-14 / PACK-15) — the proposed capabilities the draft named and the
  // library does not have, plus the one-approval-at-a-time round trip through the
  // EXISTING SkillFormDialog.
  const [suggestedNewSkills, setSuggestedNewSkills] = useState<SuggestedNewSkill[]>([])
  const [generatingSkillName, setGeneratingSkillName] = useState<string | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [skillBodyDisabledNote, setSkillBodyDisabledNote] = useState<string | null>(null)
  const [skillDialogOpen, setSkillDialogOpen] = useState(false)
  // ⛔ STATE, not a literal computed in render: `SkillFormDialog`'s reset effect depends
  // on this object's IDENTITY, so a fresh literal each render would wipe what the author
  // is typing in the dialog.
  const [skillDialogInitial, setSkillDialogInitial] = useState<{
    name?: string
    description?: string
    instructions?: string
  }>({})

  // Grounding options
  const [availableFolders, setAvailableFolders] = useState<Array<{ id: string; name: string }>>([])
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; description?: string }>>([])
  // ⚠ Only TRUE once the library list was genuinely read. If `listSkills` fails we must
  // NOT conclude that every capability is phantom — that would lock Save with no recourse
  // over a transient network fault. The fence is advisory (D-263-09); the server is real.
  const [availableSkillsLoaded, setAvailableSkillsLoaded] = useState(false)
  const [availableConnections, setAvailableConnections] = useState<Array<{ id: string; name: string }>>([])

  // Auto-slug on name change if not manually edited
  const [slugModified, setSlugModified] = useState(isEditing)
  // 263-REVIEW.md WR-08 - the names this authoring session CREATED, and only those.
  // The stamp is a privilege widening (D-263-06): claiming the whole `memberSkills` set
  // meant a long-standing private skill became readable by the whole org because its
  // author ticked a checkbox. This list is what the server stamps born-for.
  const [bornSkills, setBornSkills] = useState<string[]>([])
  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugModified) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-"),
      )
    }
  }

  // Load resource options on mount
  useEffect(() => {
    let alive = true
    async function loadOptions() {
      try {
        const [folders, skills, connections] = await Promise.all([
          listFolders().catch(() => []),
          // ⚠ `null`, not `[]`, on failure (263-04): an empty library and an UNREAD
          // library are different facts, and only the first one may hold Save.
          listSkills().catch(() => null),
          listConnectorConnections().catch(() => []),
        ])
        if (alive) {
          setAvailableFolders(folders.map((f: any) => ({ id: f.id, name: f.name })))
          if (skills) {
            setAvailableSkills(skills.map((s: any) => ({ name: s.name, description: s.description })))
            setAvailableSkillsLoaded(true)
          }
          setAvailableConnections(connections.map((c: any) => ({ id: c.id, name: c.name })))
        }
      } catch {
        // Degrade gracefully
      }
    }
    void loadOptions()
    return () => {
      alive = false
    }
  }, [])

  // Load existing grants if editing
  useEffect(() => {
    if (initialData?.id && visibility === "granted") {
      let alive = true
      getExpertGrants(initialData.id)
        .then((gList) => {
          if (alive && gList.length > 0) {
            setGrants(
              gList.map((g) => ({
                grantee_type: g.grantee_type,
                grantee_id: g.grantee_id,
              })),
            )
          }
        })
        .catch(() => {})
      return () => {
        alive = false
      }
    }
  }, [initialData?.id, visibility])

  // Handle AI Drafting
  const handleGenerateDraft = async () => {
    if (!brainstormPrompt.trim() && brainstormFiles.length === 0) {
      setDraftError("Please provide a prompt description or attach files to draft.")
      return
    }
    setIsDrafting(true)
    setDraftError(null)
    try {
      const draft = await draftExpert(brainstormPrompt, brainstormFiles)
      setName(draft.name)
      setSlug(draft.slug)
      setIcon(draft.icon || "chart")
      setCategory(draft.category || "General")
      setWhenToUse(draft.when_to_use || "")
      setDescription(draft.description || "")
      if (draft.example_output) setExampleOutput(draft.example_output)
      setScopeMode(draft.scope_mode || "biased")
      setToolFloorEnabled(draft.tool_floor_enabled ?? true)
      if (draft.member_skills) setMemberSkills(draft.member_skills)
      // Phase 263-04 (PACK-14): the same guarded one-`if`-per-optional-field idiom.
      // ⛔ No client-side derivation — the SERVER already decided which list each name
      // belongs to, and re-splitting them here would be a second, disagreeing judgement.
      if (draft.suggested_new_skills) setSuggestedNewSkills(draft.suggested_new_skills)
      if (draft.required_connections) setRequiredConnections(draft.required_connections)
      if (draft.knowledge_folder_ids) setKnowledgeFolderIds(draft.knowledge_folder_ids)
      if (draft.prompt_suggestions && draft.prompt_suggestions.length > 0) {
        setPromptSuggestions(draft.prompt_suggestions)
      }
      setSlugModified(true)
    } catch (err: any) {
      setDraftError(err.message || "Failed to generate AI draft.")
    } finally {
      setIsDrafting(false)
    }
  }

  // Handle custom capability tag addition
  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim()
    if (!trimmed) return
    if (!memberSkills.includes(trimmed)) {
      setMemberSkills((prev) => [...prev, trimmed])
    }
    setCustomSkillInput("")
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Phase 263-04 — the proposed-capability round trip (PACK-14 / PACK-15)
  // ───────────────────────────────────────────────────────────────────────────

  /** Re-read the library after a proposal became a real row, so the advisory fence and
   *  the picker agree with `public.skills` rather than with a snapshot taken on mount. */
  const refreshAvailableSkills = useCallback(async () => {
    try {
      const skills = await listSkills()
      setAvailableSkills(skills.map((s: any) => ({ name: s.name, description: s.description })))
      setAvailableSkillsLoaded(true)
    } catch {
      // Degrade gracefully — the server re-checks independently at save time (D-263-09).
    }
  }, [])

  const handleRemoveProposal = (skillName: string) => {
    setSuggestedNewSkills((prev) => prev.filter((p) => p.name !== skillName))
    setProposalError(null)
  }

  /** `Create this skill →`. Drafts the body FIRST, in place on the card, then opens the
   *  EXISTING dialog pre-filled. ⛔ Never an empty dialog that fills in later, and never
   *  a second "Generate instructions" button. */
  const handleCreateProposal = async (proposal: SuggestedNewSkill) => {
    setGeneratingSkillName(proposal.name)
    setProposalError(null)
    setSkillBodyDisabledNote(null)

    let instructions = ""
    try {
      const body = await draftSkillBody({
        skill_name: proposal.name,
        skill_description: proposal.description,
        why_needed: proposal.why_needed,
        expert_name: name,
        expert_description: description,
      })
      instructions = body.instructions
    } catch (err: any) {
      if (err instanceof SkillBodyDisabledError) {
        // ⛔ D-263-14 gates GENERATION only. Manual creation is never blocked — the
        // dialog still opens, with an EMPTY body and the reason stated beside it.
        setSkillBodyDisabledNote(err.message)
      } else {
        // ⛔ Never fabricate a body to keep the flow moving: surface the real failure.
        setGeneratingSkillName(null)
        setProposalError(err?.message || "Failed to draft skill instructions. Try again.")
        return
      }
    }

    setGeneratingSkillName(null)
    setSkillDialogInitial({
      name: proposal.name,
      description: proposal.description,
      instructions,
    })
    setSkillDialogOpen(true)
  }

  /** The dialog's save. ⛔ `createSkill` is the EXISTING `POST /skills` — the same human
   *  write path `SkillsPage` uses (D-263-03), and the ONLY write this studio performs.
   *  Returns the created `Skill` so the dialog can surface its `lint_warnings`. */
  const handleSaveProposedSkill = async (body: SkillCreate | SkillUpdate): Promise<Skill> => {
    const created = await createSkill(body as SkillCreate)
    // D-263-05: the row is real NOW, so the fence must stop counting it as phantom.
    setAvailableSkills((prev) =>
      prev.some((s) => s.name === created.name)
        ? prev
        : [...prev, { name: created.name, description: created.description ?? undefined }],
    )
    setMemberSkills((prev) => (prev.includes(created.name) ? prev : [...prev, created.name]))
    setSuggestedNewSkills((prev) =>
      prev.filter((p) => p.name !== created.name && p.name !== skillDialogInitial.name),
    )
    // WR-08: born HERE, so this is the one place a name may join the claim set.
    setBornSkills((prev) => (prev.includes(created.name) ? prev : [...prev, created.name]))
    void refreshAvailableSkills()
    return created
  }

  // Handle Action Tiles change
  const handleActionTileChange = (index: number, field: "title" | "prompt", value: string) => {
    setPromptSuggestions((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
  }

  const handleAddActionTile = () => {
    if (promptSuggestions.length >= 5) return
    setPromptSuggestions((prev) => [...prev, { title: "New Action", prompt: "Explain..." }])
  }

  const handleRemoveActionTile = (index: number) => {
    if (promptSuggestions.length <= 1) return
    setPromptSuggestions((prev) => prev.filter((_, i) => i !== index))
  }

  // Handle Grants addition
  const handleAddGrant = (type: "role" | "user", id: string) => {
    const cleanId = id.trim()
    if (!cleanId) return
    if (grants.some((g) => g.grantee_type === type && g.grantee_id === cleanId)) return
    setGrants((prev) => [...prev, { grantee_type: type, grantee_id: cleanId }])
    if (type === "user") setGrantUserId("")
  }

  const handleRemoveGrant = (index: number) => {
    setGrants((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      setSaveError("Name and Slug are required.")
      return
    }
    setIsSaving(true)
    setSaveError(null)
    setServerUnknownSkills([])

    try {
      let saved: ExpertBundle
      if (isEditing && initialData) {
        const payload: ExpertBundleUpdate = {
          name,
          // WR-03: `slug` is NOT sent. It is immutable after creation (operator decision
          // 2026-09-22) - `get_expert_by_slug_service` resolves by it, so a rename silently
          // invalidates anything holding the old value. It used to be sent and SILENTLY
          // DROPPED by the server, and the studio reported success either way.
          icon,
          category,
          when_to_use: whenToUse,
          description,
          example_output: exampleOutput,
          scope_mode: scopeMode,
          tool_floor_enabled: toolFloorEnabled,
          member_skills: memberSkills,
          required_connections: requiredConnections,
          knowledge_folder_ids: knowledgeFolderIds,
          prompt_suggestions: promptSuggestions,
          visibility,
          born_skills: bornSkills,
        }
        saved = await updateExpert(initialData.id, payload)
      } else {
        const payload: ExpertBundleCreate = {
          name,
          slug,
          icon,
          category,
          when_to_use: whenToUse,
          description,
          example_output: exampleOutput,
          scope_mode: scopeMode,
          tool_floor_enabled: toolFloorEnabled,
          member_skills: memberSkills,
          required_connections: requiredConnections,
          knowledge_folder_ids: knowledgeFolderIds,
          prompt_suggestions: promptSuggestions,
          visibility,
          is_enabled: true,
          // WR-08: sent even when EMPTY. An absent field means "this client said nothing",
          // and the server must then stamp nothing - so an empty list is the positive
          // statement that nothing was created here, not the absence of one.
          born_skills: bornSkills,
        }
        saved = await createExpert(payload)
      }

      // Sync grants if visibility is 'granted'
      //
      // 263-REVIEW.md WR-04 - this block had TWO fail-open paths and both were silent.
      // A failed `getExpertGrants` returned [], so the removal loop never ran and every
      // grant the author deleted in the UI STAYED IN THE DATABASE; a failed
      // `removeExpertGrant` was swallowed outright. Either way the modal closed on a
      // success path. The ADDITIVE direction fails closed (less access), so only the
      // security-relevant direction was quiet - which is the asymmetry that matters.
      //
      // The save itself has already succeeded, so a failure here is a PARTIAL-SUCCESS
      // report, never a rollback: the Expert exists and the author must be told exactly
      // which access was not removed.
      const grantErrors: string[] = []
      if (visibility === "granted" && saved.id) {
        let currentGrants: Awaited<ReturnType<typeof getExpertGrants>> = []
        try {
          currentGrants = await getExpertGrants(saved.id)
        } catch {
          grantErrors.push("could not read current grants - no revocation was applied")
        }
        for (const cg of currentGrants) {
          if (!grants.some((g) => g.grantee_type === cg.grantee_type && g.grantee_id === cg.grantee_id)) {
            try {
              await removeExpertGrant(saved.id, cg.id)
            } catch {
              grantErrors.push(`could not revoke ${cg.grantee_type}:${cg.grantee_id}`)
            }
          }
        }
        // Additive failures are reported too, but they are not the dangerous direction.
        for (const g of grants) {
          if (!currentGrants.some((cg) => cg.grantee_type === g.grantee_type && cg.grantee_id === g.grantee_id)) {
            try {
              await addExpertGrant(saved.id, g)
            } catch {
              grantErrors.push(`could not grant ${g.grantee_type}:${g.grantee_id}`)
            }
          }
        }
      }

      onSaved?.(saved)
      if (grantErrors.length > 0) {
        // Saved, but access is not what the author just saw. Hold the modal open.
        setSaveError(`Expert saved, but: ${grantErrors.join("; ")}`)
        return
      }
      onClose()
    } catch (err: any) {
      // Phase 263-04 (D-263-10): the server refuses independently of the client fence,
      // and it NAMES each capability it could not find. ⛔ Render the SERVER's list —
      // re-deriving it here would answer with a stale client-side library snapshot,
      // which is exactly the disagreement the typed 422 exists to prevent.
      if (err instanceof ExpertMemberSkillsUnknownError) {
        setServerUnknownSkills(err.unknownSkills)
        setSaveError(err.message)
      } else {
        setServerUnknownSkills([])
        setSaveError(err.message || "Failed to save expert.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Count summary helpers for card preview
  const previewFoldersCount = knowledgeFolderIds.length
  const previewSkillsCount = memberSkills.length
  const previewConnectionsCount = requiredConnections.length

  // ── PACK-16's client fence (D-263-09 — ADVISORY; the server is the real one) ──────
  // ⛔ BOTH entry points. The draft path is the obvious one; `handleAddCustomSkill`
  // pushes ANY free-text string into `memberSkills` with no library check, and a fence
  // watching only the draft would leave that door wide open.
  // ⚠ De-duplicated so a name reachable both ways is counted once — the banner states a
  // COUNT, and a double-count would be a false claim about the blueprint.
  const phantomMemberSkills = availableSkillsLoaded
    ? memberSkills.filter((n) => !availableSkills.some((s) => s.name === n))
    : []
  const unresolvedCapabilities = Array.from(
    new Set([...suggestedNewSkills.map((p) => p.name), ...phantomMemberSkills]),
  )
  const hasUnresolvedCapabilities = unresolvedCapabilities.length > 0
  // The sketch's "N skills this Expert can actually use" — the RESOLVED count, not the
  // selected count, or the heading would vouch for a name the member check will strip.
  const resolvableSkillsCount = memberSkills.length - phantomMemberSkills.length

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Experts</span>
          </button>
          <div className="h-4 w-px bg-border/60" />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {isEditing ? `Edit Expert: ${initialData?.name}` : "Author New Domain Expert"}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Form & AI Drafting (7 cols) */}
        <div className="space-y-8 lg:col-span-7">
          {/* Section 1: AI Brainstorming Dropzone (PACK-09) */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
            <div className="flex items-center gap-2.5 text-primary">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold text-foreground">AI-Assisted Brainstorming & Drafting</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe what kind of expert you want, optionally attach reference files, and let AI synthesize the candidate draft row.
            </p>

            {/* Non-ingestion guarantee badge (PACK-09) */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <Shield className="mt-0.5 h-4 w-4 flex-none text-emerald-400" />
              <div>
                <span className="font-semibold text-emerald-200">Ephemeral In-Memory Guarantee:</span> Uploaded brainstorm files are analyzed ephemerally in a sandbox to synthesize this draft row. They are strictly <strong>NEVER</strong> ingested into your permanent library and are discarded immediately.
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Expert Purpose & Brainstorm Prompt
                </label>
                <textarea
                  value={brainstormPrompt}
                  onChange={(e) => setBrainstormPrompt(e.target.value)}
                  placeholder="E.g. A Senior Financial Analyst focused on analyzing 10-K filings, computing financial ratios, and drafting variance reports..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Attach Reference SOPs or Notes (Optional, ephemeral)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                    <Upload className="h-4 w-4" />
                    <span>Choose Files</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setBrainstormFiles(Array.from(e.target.files))
                        }
                      }}
                    />
                  </label>
                  {brainstormFiles.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {brainstormFiles.length} file(s) selected ({brainstormFiles.map((f) => f.name).join(", ")})
                    </span>
                  )}
                </div>
              </div>

              {draftError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 flex-none" />
                  <span>{draftError}</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleGenerateDraft}
                  disabled={isDrafting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isDrafting ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      <span>Synthesizing Draft...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Generate Candidate Draft</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Core Form */}
          <form onSubmit={handleSave} className="space-y-6">
            {/* Identity & Presentation */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>Identity & Presentation</span>
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground">Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="E.g. Financial Analyzer"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground">Slug *</label>
                  {/* 263-REVIEW.md WR-03 - readOnly in EDIT mode, and NOT disabled: the
                      value stays selectable and copyable. It used to be editable, and the
                      server dropped the change without a word while the studio reported
                      success. A grey-out with no reason is that same silence, so the
                      sentence below is part of the fix, not decoration. */}
                  <input
                    type="text"
                    required
                    readOnly={isEditing}
                    aria-readonly={isEditing || undefined}
                    value={slug}
                    onChange={(e) => {
                      if (isEditing) return
                      setSlugModified(true)
                      setSlug(e.target.value)
                    }}
                    placeholder="financial-analyzer"
                    className={cn(
                      "mt-1 w-full rounded-md border border-input px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                      isEditing ? "cursor-not-allowed bg-muted/40 text-muted-foreground" : "bg-background",
                    )}
                  />
                  {isEditing && (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Set when it was created - it is how saved references resolve, so it
                      cannot change.
                    </p>
                  )}
                </div>
              </div>

              {/* Icon Vector Glyph Picker */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Vector Icon Glyph
                </label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {AVAILABLE_ICONS.map((item) => {
                    const IconComponent = item.icon
                    const isSelected = icon === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                            : "border-border/60 hover:border-border hover:bg-accent/40 text-muted-foreground",
                        )}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="truncate max-w-[70px] text-[10px]">{item.label.split("/")[0].trim()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Array.from(new Set([...CATEGORY_PRESETS, category, "Research & Academia", "Education"])).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground">
                    When to Use (One-Liner Helper)
                  </label>
                  <input
                    type="text"
                    value={whenToUse}
                    onChange={(e) => setWhenToUse(e.target.value)}
                    placeholder="E.g. When evaluating balance sheets and 10-K filings."
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-foreground">
                    Detailed Operational Blueprint & Methodology *
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Autonomous capabilities, analytical frameworks & standards
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Define the expert's core mandate, analytical frameworks, quality rubrics, and deliverable standards..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-foreground">
                    Sample Deliverable / Output Snippet
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Concrete deliverable template or sample matrix
                  </span>
                </div>
                <textarea
                  value={exampleOutput}
                  onChange={(e) => setExampleOutput(e.target.value)}
                  rows={4}
                  placeholder="E.g. Markdown literature matrix with columns for Author/Year, Methodology, Findings, and Critical Critique..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Knowledge Scope & Additive Tool Floor (D-v4.3-01 / D-v4.3-02) */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span>Knowledge Scope & Deliverable Tool Floor</span>
              </h3>

              {/* Knowledge Scope Mode Radio */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">
                  Knowledge Scope Mode (D-v4.3-01 / SEED-303 S4 & S5)
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs transition-all",
                      scopeMode === "biased"
                        ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                        : "border-border/60 hover:border-border hover:bg-accent/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="scope_mode"
                      value="biased"
                      checked={scopeMode === "biased"}
                      onChange={() => setScopeMode("biased")}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-semibold text-emerald-300">+ Union Scope (Default)</span>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Combines the thread's existing folder with the Expert's knowledge folders. Existing chat context is preserved.
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs transition-all",
                      scopeMode === "restricted"
                        ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/40"
                        : "border-border/60 hover:border-border hover:bg-accent/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="scope_mode"
                      value="restricted"
                      checked={scopeMode === "restricted"}
                      onChange={() => setScopeMode("restricted")}
                      className="mt-0.5 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="font-semibold text-amber-300">🔒 Strict Isolation (Opt-in)</span>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Restricts retrieval exclusively to the Expert's knowledge folders. Thread documents are ignored with an upfront notice.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Additive Tool Floor Checkbox (D-v4.3-02 / S6) */}
              <div className="rounded-lg border border-border/60 bg-accent/20 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolFloorEnabled}
                    onChange={(e) => setToolFloorEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Preserve Deliverable Tool Floor (Recommended)
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Keeps deliverable-producing tools (<code className="text-primary font-mono text-[10px]">execute_code</code>, <code className="text-primary font-mono text-[10px]">workspace_write</code>, <code className="text-primary font-mono text-[10px]">render_template</code>, and <code className="text-primary font-mono text-[10px]">ask_user</code>) active so the Expert can write reports, calculate formulas, and produce artifacts.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Resources (Folders, Skills, Connections) */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span>Bound Knowledge & Capabilities</span>
              </h3>

              {/* Knowledge Folders */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Knowledge Folders ({knowledgeFolderIds.length} selected)
                </label>
                {availableFolders.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded-md border border-input bg-background/50 p-2">
                    {availableFolders.map((f) => {
                      const isSelected = knowledgeFolderIds.includes(f.id)
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setKnowledgeFolderIds((prev) =>
                              isSelected ? prev.filter((id) => id !== f.id) : [...prev, f.id],
                            )
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                            isSelected
                              ? "bg-primary/20 text-primary font-medium border border-primary/40"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          <span>{f.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No folders found in organization.</p>
                )}
              </div>

              {/* Member Skills & Specialized Capabilities.
                  Phase 263-04 / sketch 263 variant A: this ONE sub-block now carries TWO
                  headed groups — "In your library" (solid ⚡ pills, unchanged) and
                  "Proposed for this Expert" (dashed ⬡ cards). ⛔ No new studio screen and
                  no wizard step: B (a provisioning step) and C (a refusal sheet) were the
                  REJECTED alternatives. The Folders and Connections peers are untouched. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-foreground">
                    In your library{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      · {resolvableSkillsCount}{" "}
                      {resolvableSkillsCount === 1 ? "skill" : "skills"} this Expert can
                      actually use
                    </span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Specialized toolchains & capability tags
                  </span>
                </div>

                {/* Active Skills Pills */}
                {memberSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-primary/20 bg-primary/5">
                    {memberSkills.map((skillName) => (
                      <span
                        key={skillName}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/20 border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        <span>⚡ {skillName}</span>
                        <button
                          type="button"
                          onClick={() => setMemberSkills((prev) => prev.filter((s) => s !== skillName))}
                          className="hover:text-destructive ml-0.5 text-primary/70 hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Proposed for this Expert (263-04 / PACK-14 / D-263-01) ──────────
                    The capabilities the draft named that the library does not have.
                    A FOURTH inner part of this sub-block, inserted between the active
                    pills and the quick-add — it replaces nothing. */}
                {suggestedNewSkills.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <label className="block text-xs font-medium text-foreground">
                        Proposed for this Expert{" "}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          · {suggestedNewSkills.length} named by the draft, none in your
                          library yet
                        </span>
                      </label>
                      <span className="font-mono text-[11px] text-primary">
                        ⬡ = does not exist
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2">
                      {suggestedNewSkills.map((proposal) => (
                        <ProposedSkillCard
                          key={proposal.name}
                          proposal={proposal}
                          isGenerating={generatingSkillName === proposal.name}
                          onCreate={handleCreateProposal}
                          onRemove={handleRemoveProposal}
                        />
                      ))}
                    </div>
                    {proposalError && (
                      <p
                        data-testid="proposal-error"
                        className="text-[11px] text-destructive"
                      >
                        {proposalError}
                      </p>
                    )}
                    {skillBodyDisabledNote && (
                      <p
                        data-testid="skill-body-disabled-note"
                        className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] text-primary"
                      >
                        {skillBodyDisabledNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Quick add custom skill input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCustomSkill()
                      }
                    }}
                    placeholder="Type a capability tag (e.g. Thesis Structuring) and press Add..."
                    className="flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Available System Skills Toggle/Picker */}
                {availableSkills.length > 0 ? (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">
                      Or select from registered organization skills:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-md border border-input bg-background/50 p-2">
                      {availableSkills.map((s) => {
                        const isSelected = memberSkills.includes(s.name)
                        return (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => {
                              setMemberSkills((prev) =>
                                isSelected ? prev.filter((name) => name !== s.name) : [...prev, s.name],
                              )
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                              isSelected
                                ? "bg-primary/20 text-primary font-medium border border-primary/40"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            <span>{s.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No registered skills found in organization.</p>
                )}
              </div>

              {/* Required Connections */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  External Connections ({requiredConnections.length} selected)
                </label>
                {availableConnections.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded-md border border-input bg-background/50 p-2">
                    {availableConnections.map((c) => {
                      const isSelected = requiredConnections.includes(c.name)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setRequiredConnections((prev) =>
                              isSelected ? prev.filter((name) => name !== c.name) : [...prev, c.name],
                            )
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                            isSelected
                              ? "bg-primary/20 text-primary font-medium border border-primary/40"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          <span>{c.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No external connections configured.</p>
                )}
              </div>
            </div>

            {/* 3 Action Tiles Editor (PACK-03 / D-260-06) */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Action Tiles ({promptSuggestions.length} tiles)</span>
                </h3>
                {promptSuggestions.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddActionTile}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Tile</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {promptSuggestions.map((tile, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={tile.title}
                        onChange={(e) => handleActionTileChange(idx, "title", e.target.value)}
                        placeholder="Tile Title (e.g. Q3 YoY Variance)"
                        className="w-full rounded border border-input bg-background px-2.5 py-1 text-xs font-medium focus:border-primary focus:outline-none"
                      />
                      {promptSuggestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveActionTile(idx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={tile.prompt}
                      onChange={(e) => handleActionTileChange(idx, "prompt", e.target.value)}
                      rows={2}
                      placeholder="Prompt injected on 1-click execution..."
                      className="w-full rounded border border-input bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Access Grants & Visibility (PACK-10) */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Access Grants & Audience (PACK-10)</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { id: "org", label: "👥 Org-Wide", desc: "All org members" },
                  { id: "granted", label: "🛡️ Role / User Gated", desc: "Specific grants" },
                  { id: "private", label: "🔒 Private", desc: "Creator only" },
                  { id: "public", label: "🌐 Public", desc: "System / all orgs" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVisibility(v.id as any)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all",
                      visibility === v.id
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/60 hover:bg-accent/40 text-muted-foreground",
                    )}
                  >
                    <span>{v.label}</span>
                    <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{v.desc}</span>
                  </button>
                ))}
              </div>

              {visibility === "granted" && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <span className="text-xs font-semibold text-foreground">Configure Role & User Grants</span>

                  {/* Add role grant */}
                  <div className="flex items-center gap-2">
                    <select
                      value={grantRole}
                      onChange={(e) => setGrantRole(e.target.value)}
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                    >
                      <option value="org-admin">Role: org-admin</option>
                      <option value="member">Role: member</option>
                      <option value="dept-admin">Role: dept-admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddGrant("role", grantRole)}
                      className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      + Add Role Grant
                    </button>
                  </div>

                  {/* Add user grant */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={grantUserId}
                      onChange={(e) => setGrantUserId(e.target.value)}
                      placeholder="User UUID (e.g. 550e8400-e29b-...)"
                      className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddGrant("user", grantUserId)}
                      className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      + Add User Grant
                    </button>
                  </div>

                  {/* Current grants list */}
                  {grants.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Active Grants:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {grants.map((g, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                          >
                            <span className="text-primary font-medium">{g.grantee_type === "role" ? "Role:" : "User:"}</span>
                            <span className="font-mono text-[11px]">{g.grantee_id}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveGrant(idx)}
                              className="text-muted-foreground hover:text-destructive ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── PACK-16's honesty banner (263-04 / D-263-01 / D-263-09) ────────────
                ⛔ VIOLET, not destructive: a proposal is an opportunity, not an error.
                The destructive banner below stays, and belongs to the SERVER's 422. */}
            <div
              data-testid="unresolved-capabilities-banner"
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-xs",
                "border-primary/30 bg-primary/5 text-primary",
              )}
            >
              <span aria-hidden="true" className="flex-none font-mono leading-none">
                {hasUnresolvedCapabilities ? "⬡" : "✓"}
              </span>
              {hasUnresolvedCapabilities ? (
                <span>
                  <b>
                    {unresolvedCapabilities.length}{" "}
                    {unresolvedCapabilities.length === 1
                      ? "capability is not real yet."
                      : "capabilities are not real yet."}
                  </b>{" "}
                  Saved as-is, {unresolvedCapabilities.length === 1 ? "it" : "they"} would
                  be stripped at run time by the member check and this Expert would run
                  without {unresolvedCapabilities.length === 1 ? "it" : "them"} — silently.
                  Create or remove {unresolvedCapabilities.length === 1 ? "it" : "each one"}{" "}
                  first.{" "}
                  <span className="font-mono text-[11px]">
                    {unresolvedCapabilities.join(", ")}
                  </span>
                </span>
              ) : !availableSkillsLoaded ? (
                /* 263-REVIEW.md WR-05 - UNKNOWN is a third state, not a clean one.
                   `phantomMemberSkills` is [] when the library was never read, which made
                   the positive arm below assert a fact from an input it did not have: on a
                   failed `listSkills()` the phase's own honesty deliverable printed a green
                   tick and "all resolvable at run time" over names that do not exist.
                   Not holding Save on a failed read stays correct - vouching does not. */
                <span>
                  <b>Your skill library could not be read.</b> This blueprint names{" "}
                  {memberSkills.length}{" "}
                  {memberSkills.length === 1 ? "capability" : "capabilities"} and none of
                  them could be checked here - the server re-checks independently when you
                  save.
                </span>
              ) : (
                <span>
                  <b>Every capability in this blueprint exists.</b> {resolvableSkillsCount}{" "}
                  {resolvableSkillsCount === 1 ? "skill" : "skills"}, all resolvable by the
                  member check at run time.
                </span>
              )}
            </div>

            {saveError && (
              <div
                data-testid={serverUnknownSkills.length > 0 ? "server-refusal-banner" : "save-error-banner"}
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="h-4 w-4 flex-none" />
                <div className="min-w-0">
                  <span>{saveError}</span>
                  {serverUnknownSkills.length > 0 && (
                    // ⛔ The SERVER's own names (D-263-10), rendered as React text
                    // children so they are auto-escaped (T-263-20). No re-derivation,
                    // and no raw-HTML injection prop — deliberately not named here, so
                    // `grep -c` on it stays a usable fence instead of matching prose.
                    <ul className="mt-1 list-disc pl-4 font-mono text-[11px]">
                      {serverUnknownSkills.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {hasUnresolvedCapabilities && (
                <span className="mr-auto text-[11px] text-muted-foreground">
                  Save is held while proposed skills are unresolved.
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || hasUnresolvedCapabilities}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{isEditing ? "Update Expert" : "Save & Publish Expert"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live 5-Element Expert Card Reactive Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Live Reactive Card Preview (G-2)
              </span>
              <span className="text-[11px] text-muted-foreground">Updates synchronously</span>
            </div>

            {/* The 5-Element Card Component */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-lg transition-all hover:border-primary/50">
              {/* Element 1: Identity & Gem */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-inner">
                    {renderExpertGlyph(icon, "h-6 w-6")}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-base tracking-tight leading-tight">
                      {name.trim() || "Untitled Expert"}
                    </h4>
                    <span className="text-xs text-muted-foreground font-medium">{category}</span>
                  </div>
                </div>
              </div>

              {/* Element 2: Disentangled Badges */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {scopeMode === "biased" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                    <span>+</span> Union Scope
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                    <Lock className="h-3 w-3" /> Strict Isolation
                  </span>
                )}

                {visibility === "org" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Users className="h-3 w-3" /> Org-Wide
                  </span>
                )}
                {visibility === "granted" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    <Shield className="h-3 w-3" /> Granted ({grants.length} targets)
                  </span>
                )}
                {visibility === "private" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                )}
              </div>

              {/* Subtitle / When-to-use */}
              {whenToUse.trim() && (
                <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 italic">
                  &ldquo;{whenToUse}&rdquo;
                </p>
              )}

              {/* Element 3: Scope Envelope Chips */}
              <div className="mt-4 border-t border-border/50 pt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-[11px]">
                  <span>📁</span> {previewFoldersCount} folder{previewFoldersCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-[11px]">
                  <span>⚡</span> {previewSkillsCount} skill{previewSkillsCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-[11px]">
                  <span>🔌</span> {previewConnectionsCount} connection{previewConnectionsCount === 1 ? "" : "s"}
                </span>
              </div>

              {/* Element 4: 3 Visual Action Tiles (PACK-03) */}
              <div className="mt-4 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Action Tiles (1-Click Run)
                </span>
                <div className="space-y-1.5">
                  {promptSuggestions.slice(0, 3).map((tile, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    >
                      <span className="font-medium text-foreground truncate pr-2">{tile.title || "Action Tile"}</span>
                      <span className="text-muted-foreground group-hover:text-primary transition-colors text-[11px]">→</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Element 5: Deliverable Tool Floor indicator (SEED-303 S6) */}
              {toolFloorEnabled && (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                  <FileCode className="h-4 w-4 flex-none text-primary" />
                  <span>
                    <strong className="text-foreground">Additive Tool Floor:</strong> Delivers code execution, file writes, and template rendering.
                  </span>
                </div>
              )}

              {/* Sample Deliverable Preview */}
              {exampleOutput.trim() && (
                <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sample Deliverable Preview
                    </span>
                    <span className="text-[10px] text-primary font-medium">Turnkey Output</span>
                  </div>
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono line-clamp-4 bg-background/60 p-2 rounded border border-border/40 leading-relaxed overflow-hidden">
                    {exampleOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── The approval moment (263-04 / PACK-15 / D-263-03/04/05) ──────────────────
          The EXISTING SkillFormDialog, pre-filled. ⛔ Not a new dialog and not a new
          write path: `handleSaveProposedSkill` calls the same `POST /skills` the
          SkillsPage uses, and the row is written only on HUMAN approval. */}
      <SkillFormDialog
        open={skillDialogOpen}
        onOpenChange={(next) => {
          setSkillDialogOpen(next)
          if (!next) setSkillBodyDisabledNote(null)
        }}
        onSave={handleSaveProposedSkill}
        initialValues={skillDialogInitial}
      />
    </div>
  )
}
