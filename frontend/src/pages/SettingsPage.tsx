import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Plus, CheckCircle2 } from "lucide-react"
import {
  getSettings,
  upsertProvider,
  deleteProvider,
  activateProvider,
  type FullAppSettings,
  type LLMProvider,
} from "@/lib/api"

// ─── Read-only value display ──────────────────────────────────────────────────
function ReadOnlyValue({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{String(value)}</span>
    </div>
  )
}

function EnvBadge() {
  return (
    <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      System default (.env)
    </span>
  )
}

// ─── Provider form state ──────────────────────────────────────────────────────
interface ProviderFormState {
  id?: string
  name: string
  base_url: string
  api_key: string
  models_text: string
}

function emptyProviderForm(): ProviderFormState {
  return { name: "", base_url: "", api_key: "", models_text: "" }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [s, setS] = useState<FullAppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showProviderForm, setShowProviderForm] = useState(false)
  const [providerForm, setProviderForm] = useState<ProviderFormState>(emptyProviderForm())
  const [providerSaving, setProviderSaving] = useState(false)

  function applySettings(data: FullAppSettings) {
    setS({ ...data, llm_providers: data.llm_providers ?? [] })
  }

  useEffect(() => {
    getSettings()
      .then(applySettings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function startAddProvider() {
    setProviderForm(emptyProviderForm())
    setShowProviderForm(true)
  }

  function startEditProvider(p: LLMProvider) {
    setProviderForm({ id: p.id, name: p.name, base_url: p.base_url, api_key: "", models_text: p.models.join("\n") })
    setShowProviderForm(true)
  }

  async function handleSaveProvider() {
    setProviderSaving(true)
    try {
      const models = providerForm.models_text.split("\n").map((m) => m.trim()).filter(Boolean)
      const data = await upsertProvider({ id: providerForm.id, name: providerForm.name, base_url: providerForm.base_url, api_key: providerForm.api_key, models })
      applySettings(data)
      setShowProviderForm(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed")
    } finally {
      setProviderSaving(false)
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("Delete this provider?")) return
    applySettings(await deleteProvider(id))
  }

  async function handleActivateProvider(id: string) {
    applySettings(await activateProvider(id))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !s) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error ?? "Failed to load settings"}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure LLM providers here. Embedding, reranking, and retrieval settings are controlled via{" "}
            <code className="text-xs bg-muted px-1 rounded">.env</code>.
          </p>
        </div>

        {/* ── LLM Providers ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">LLM Providers</CardTitle>
                <CardDescription className="mt-1">
                  {(s.llm_providers?.length ?? 0) === 0
                    ? "No providers configured — model list reads from AVAILABLE_MODELS in .env."
                    : "The active provider's model list drives the chat model selector."}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={startAddProvider} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Add Provider
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(s.llm_providers ?? []).map((p) => (
              <div key={p.id} className="flex items-start justify-between rounded-lg border p-3 gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.is_active && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{p.base_url}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.models.length} model{p.models.length !== 1 ? "s" : ""}
                    {p.has_api_key && " · key saved"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.is_active && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => { void handleActivateProvider(p.id) }}>
                      Set Active
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditProvider(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { void handleDeleteProvider(p.id) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {showProviderForm && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">{providerForm.id ? "Edit Provider" : "Add Provider"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                    <Input value={providerForm.name} onChange={(e) => setProviderForm((f) => ({ ...f, name: e.target.value }))} placeholder="OpenRouter" className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Base URL</label>
                    <Input value={providerForm.base_url} onChange={(e) => setProviderForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://openrouter.ai/api/v1" className="h-8 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">API Key {providerForm.id && "(leave blank to keep existing)"}</label>
                  <Input type="password" value={providerForm.api_key} onChange={(e) => setProviderForm((f) => ({ ...f, api_key: e.target.value }))} placeholder={providerForm.id ? "••••••••" : "sk-..."} className="h-8 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Models (one per line)</label>
                  <textarea
                    value={providerForm.models_text}
                    onChange={(e) => setProviderForm((f) => ({ ...f, models_text: e.target.value }))}
                    placeholder={"openai/gpt-4o\nanthropic/claude-3.5-sonnet"}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { void handleSaveProvider() }} disabled={providerSaving}>{providerSaving ? "Saving…" : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowProviderForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Embedding (read-only) ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Embedding</CardTitle>
                <CardDescription>Model used to embed documents and queries. Configure via .env.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Model" value={s.embedding_model} />
              <ReadOnlyValue label="Dimensions" value={s.embedding_dimensions} />
              {s.embedding_base_url && <ReadOnlyValue label="Base URL" value={s.embedding_base_url} />}
              <ReadOnlyValue label="API Key" value={s.embedding_has_api_key ? "Saved" : "Using LLM key fallback"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Reranking (read-only) ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Reranking</CardTitle>
                <CardDescription>Re-score retrieved chunks with a cross-encoder. Configure via .env.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Enabled" value={s.rerank_enabled} />
              <ReadOnlyValue label="Provider" value={s.rerank_provider} />
              <ReadOnlyValue label="Model" value={s.rerank_model} />
              <ReadOnlyValue label="Top-N" value={s.rerank_top_n} />
              <ReadOnlyValue label="API Key" value={s.rerank_has_api_key ? "Saved" : "Not set"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Retrieval (read-only) ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Retrieval</CardTitle>
                <CardDescription>Controls chunk retrieval and hybrid search weights. Configure via .env.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Top-K" value={s.retrieval_top_k} />
              <ReadOnlyValue label="Match threshold" value={s.retrieval_match_threshold} />
              <ReadOnlyValue label="Hybrid search" value={s.hybrid_search_enabled} />
              {s.hybrid_search_enabled && (
                <>
                  <ReadOnlyValue label="Candidate count" value={s.hybrid_candidate_count} />
                  <ReadOnlyValue label="Vector weight" value={s.vector_search_weight} />
                  <ReadOnlyValue label="Keyword weight" value={s.keyword_search_weight} />
                  <ReadOnlyValue label="RRF-K" value={s.rrf_k} />
                </>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
