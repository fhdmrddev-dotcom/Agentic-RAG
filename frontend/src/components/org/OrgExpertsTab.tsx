import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  Edit2,
  FileCode,
  Lock,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react"

import type { ExpertBundle } from "@/types"
import { deleteExpert, listExperts, updateExpert } from "@/lib/api/experts"
import { ExpertAuthoringStudio } from "@/components/experts/ExpertAuthoringStudio"
import { ExpertIcon } from "@/components/experts/expertIcon"
import { cn } from "@/lib/utils"

// Phase 262 (D-262-06): `ICON_MAP` + `renderExpertIcon` MOVED VERBATIM to
// `@/components/experts/expertIcon`. This was the only correct reader of the `icon` column in
// the repository, and two chat surfaces were guessing from `slug`/`name` instead — so the map
// became the one home rather than being deleted. Rendered output here is unchanged.

export function OrgExpertsTab() {
  const [experts, setExperts] = useState<ExpertBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  // Authoring studio modal/in-place mode
  const [isCreating, setIsCreating] = useState(false)
  const [editingExpert, setEditingExpert] = useState<ExpertBundle | null>(null)

  // Deletion confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listExperts(true, false, true)
      setExperts(data)
    } catch (err: any) {
      setError(err.message || "Failed to load experts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  // PACK-07 (v4.3 verification): "disable" had no surface — only SQL or an API client could
  // turn an Expert off. The toggle PATCHes is_enabled through the existing /experts route and
  // re-reads the list rather than trusting an optimistic flip.
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const handleToggleEnabled = async (exp: ExpertBundle) => {
    setTogglingId(exp.id)
    setError(null)
    try {
      await updateExpert(exp.id, { is_enabled: !exp.is_enabled })
      await fetchList()
    } catch (err: any) {
      setError(err.message || "Failed to update expert")
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteExpert(id)
      setDeletingId(null)
      await fetchList()
    } catch (err: any) {
      setError(err.message || "Failed to delete expert")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredExperts = useMemo(() => {
    if (!query.trim()) return experts
    const q = query.toLowerCase()
    return experts.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.when_to_use && e.when_to_use.toLowerCase().includes(q)),
    )
  }, [experts, query])

  // If in authoring studio mode (creating or editing)
  if (isCreating || editingExpert) {
    return (
      <ExpertAuthoringStudio
        initialData={editingExpert}
        onClose={() => {
          setIsCreating(false)
          setEditingExpert(null)
        }}
        onSaved={() => {
          setIsCreating(false)
          setEditingExpert(null)
          void fetchList()
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      {/* Top Banner & CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Organization Experts</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Author and manage specialized domain expert bundles, configure granular role/user access grants, and review AI draft synthesis.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>Author New Expert</span>
          </button>
        </div>
      </div>

      {/* Filter / Search bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experts by name, category, or role..."
            className="w-full rounded-lg border border-input bg-background/80 pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredExperts.length}</strong> of {experts.length} expert{experts.length === 1 ? "" : "s"}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {/* List / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-spin mr-2 text-primary" />
          Loading organization experts...
        </div>
      ) : filteredExperts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No Experts Found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {query.trim()
              ? "No expert bundles matched your filter search."
              : "Get started by authoring your organization's first specialized domain expert."}
          </p>
          {!query.trim() && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Author New Expert</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExperts.map((exp) => {
            const isGranted = exp.visibility === "granted" || exp.visibility === "restricted"
            return (
              <div
                key={exp.id}
                className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Top line: Icon + Title + System badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                        <ExpertIcon icon={exp.icon} className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm leading-snug">
                          {exp.name}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {exp.category || "General"}
                        </span>
                      </div>
                    </div>

                    {exp.is_system && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        System
                      </span>
                    )}
                  </div>

                  {/* Badges line: Scope Mode + Grants */}
                  <div className="flex flex-wrap gap-1.5">
                    {exp.scope_mode === "biased" ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        + Union Scope
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        <Lock className="h-2.5 w-2.5" /> Strict Isolation
                      </span>
                    )}

                    {exp.visibility === "org" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Users className="h-2.5 w-2.5" /> Org-Wide
                      </span>
                    )}
                    {isGranted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Shield className="h-2.5 w-2.5" /> Granted
                      </span>
                    )}
                    {exp.visibility === "private" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </span>
                    )}
                  </div>

                  {/* When to use description */}
                  {exp.when_to_use ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      &ldquo;{exp.when_to_use}&rdquo;
                    </p>
                  ) : exp.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">{exp.description}</p>
                  ) : null}

                  {/* Envelope stats */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>📁 {(exp.knowledge_folder_ids || []).length} folders</span>
                    <span>⚡ {(exp.member_skills || []).length} skills</span>
                    <span>🔌 {(exp.required_connections || []).length} conns</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    /{exp.slug}
                    {!exp.is_enabled && <span className="ml-2 font-sans text-amber-500">Disabled</span>}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingExpert(exp)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>

                    {!exp.is_system && (
                      <button
                        type="button"
                        onClick={() => void handleToggleEnabled(exp)}
                        disabled={togglingId === exp.id}
                        aria-pressed={!exp.is_enabled}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {exp.is_enabled ? "Disable" : "Enable"}
                      </button>
                    )}

                    {!exp.is_system && (
                      <button
                        type="button"
                        onClick={() => setDeletingId(exp.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <h4 className="font-semibold text-foreground">Delete Expert Bundle?</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this expert bundle? Existing chat threads will revert to unassisted deep chat.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deletingId)}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete Expert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
