import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Pencil, Trash2, Plus, CheckCircle2, Settings2, RotateCcw } from "lucide-react"
import {
  getSettings,
  upsertProvider,
  deleteProvider,
  activateProvider,
  updateEmbeddingSettings,
  updateRerankingSettings,
  updateRetrievalSettings,
  resetEmbeddingSettings,
  resetRerankingSettings,
  resetRetrievalSettings,
  type FullAppSettings,
  type LLMProvider,
} from "@/lib/api"

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ overridden }: { overridden: boolean }) {
  if (overridden) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
        <Settings2 className="h-3 w-3" /> Custom
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      System default (.env)
    </span>
  )
}

// ─── Read-only value display ──────────────────────────────────────────────────
function ReadOnlyValue({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{String(value)}</span>
    </div>
  )
}

// ─── Inline toggle ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
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

// ─── Section header with source badge + action button ─────────────────────────
interface SectionControlProps {
  overridden: boolean
  locked?: boolean
  onCustomize: () => void
  onReset: () => void
  resetting?: boolean
}

function SectionControl({ overridden, locked, onCustomize, onReset, resetting }: SectionControlProps) {
  if (locked) return null
  if (!overridden) {
    return (
      <Button size="sm" variant="outline" onClick={onCustomize} className="gap-1.5">
        <Settings2 className="h-3.5 w-3.5" /> Customize
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onReset}
      disabled={resetting}
      className="gap-1.5 text-muted-foreground hover:text-destructive"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {resetting ? "Resetting…" : "Reset to system defaults"}
    </Button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [s, setS] = useState<FullAppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Provider form
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [providerForm, setProviderForm] = useState<ProviderFormState>(emptyProviderForm())
  const [providerSaving, setProviderSaving] = useState(false)

  // Embedding edit mode
  const [embEditing, setEmbEditing] = useState(false)
  const [embModel, setEmbModel] = useState("")
  const [embBaseUrl, setEmbBaseUrl] = useState("")
  const [embApiKey, setEmbApiKey] = useState("")
  const [embDimensions, setEmbDimensions] = useState("")
  const [embSaving, setEmbSaving] = useState(false)
  const [embResetting, setEmbResetting] = useState(false)
  const [embMsg, setEmbMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Reranking edit mode
  const [rerankEditing, setRerankEditing] = useState(false)
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [rerankProvider, setRerankProvider] = useState("api")
  const [rerankModel, setRerankModel] = useState("")
  const [rerankApiKey, setRerankApiKey] = useState("")
  const [rerankTopN, setRerankTopN] = useState("")
  const [rerankSaving, setRerankSaving] = useState(false)
  const [rerankResetting, setRerankResetting] = useState(false)
  const [rerankMsg, setRerankMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Retrieval edit mode
  const [retrievalEditing, setRetrievalEditing] = useState(false)
  const [topK, setTopK] = useState("")
  const [threshold, setThreshold] = useState("")
  const [hybridEnabled, setHybridEnabled] = useState(false)
  const [candidateCount, setCandidateCount] = useState("")
  const [vectorWeight, setVectorWeight] = useState("")
  const [keywordWeight, setKeywordWeight] = useState("")
  const [rrfK, setRrfK] = useState("")
  const [retrievalSaving, setRetrievalSaving] = useState(false)
  const [retrievalResetting, setRetrievalResetting] = useState(false)
  const [retrievalMsg, setRetrievalMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function applySettings(data: FullAppSettings) {
    const normalized: FullAppSettings = { ...data, llm_providers: data.llm_providers ?? [] }
    setS(normalized)

    // Sync form state from effective values
    setEmbModel(normalized.embedding_model ?? "")
    setEmbBaseUrl(normalized.embedding_base_url ?? "")
    setEmbDimensions(normalized.embedding_dimensions != null ? String(normalized.embedding_dimensions) : "")
    setEmbApiKey("")

    setRerankEnabled(normalized.rerank_enabled ?? false)
    setRerankProvider(normalized.rerank_provider ?? "api")
    setRerankModel(normalized.rerank_model ?? "")
    setRerankApiKey("")
    setRerankTopN(normalized.rerank_top_n != null ? String(normalized.rerank_top_n) : "")

    setTopK(normalized.retrieval_top_k != null ? String(normalized.retrieval_top_k) : "")
    setThreshold(normalized.retrieval_match_threshold != null ? String(normalized.retrieval_match_threshold) : "")
    setHybridEnabled(normalized.hybrid_search_enabled ?? false)
    setCandidateCount(normalized.hybrid_candidate_count != null ? String(normalized.hybrid_candidate_count) : "")
    setVectorWeight(normalized.vector_search_weight != null ? String(normalized.vector_search_weight) : "")
    setKeywordWeight(normalized.keyword_search_weight != null ? String(normalized.keyword_search_weight) : "")
    setRrfK(normalized.rrf_k != null ? String(normalized.rrf_k) : "")

    // Auto-open edit mode if already overridden
    setEmbEditing(normalized.embedding_overridden ?? false)
    setRerankEditing(normalized.reranking_overridden ?? false)
    setRetrievalEditing(normalized.retrieval_overridden ?? false)
  }

  useEffect(() => {
    getSettings()
      .then(applySettings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Provider actions ───────────────────────────────────────────────────────

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

  // ── Embedding ──────────────────────────────────────────────────────────────

  async function handleSaveEmbedding() {
    setEmbSaving(true)
    setEmbMsg(null)
    try {
      const data = await updateEmbeddingSettings({
        embedding_model: embModel || undefined,
        embedding_base_url: embBaseUrl || undefined,
        embedding_api_key: embApiKey || undefined,
        embedding_dimensions: embDimensions ? Number(embDimensions) : undefined,
      })
      applySettings(data)
      setEmbMsg({ type: "ok", text: "Saved." })
      setTimeout(() => setEmbMsg(null), 3000)
    } catch (e: unknown) {
      setEmbMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed" })
    } finally {
      setEmbSaving(false)
    }
  }

  async function handleResetEmbedding() {
    setEmbResetting(true)
    try {
      applySettings(await resetEmbeddingSettings())
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setEmbResetting(false)
    }
  }

  // ── Reranking ──────────────────────────────────────────────────────────────

  async function handleSaveReranking() {
    setRerankSaving(true)
    setRerankMsg(null)
    try {
      const data = await updateRerankingSettings({
        rerank_enabled: rerankEnabled,
        rerank_provider: rerankProvider,
        rerank_model: rerankModel || undefined,
        rerank_api_key: rerankApiKey || undefined,
        rerank_top_n: rerankTopN ? Number(rerankTopN) : undefined,
      })
      applySettings(data)
      setRerankMsg({ type: "ok", text: "Saved." })
      setTimeout(() => setRerankMsg(null), 3000)
    } catch (e: unknown) {
      setRerankMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed" })
    } finally {
      setRerankSaving(false)
    }
  }

  async function handleResetReranking() {
    setRerankResetting(true)
    try {
      applySettings(await resetRerankingSettings())
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setRerankResetting(false)
    }
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  async function handleSaveRetrieval() {
    setRetrievalSaving(true)
    setRetrievalMsg(null)
    try {
      const data = await updateRetrievalSettings({
        retrieval_top_k: topK ? Number(topK) : undefined,
        retrieval_match_threshold: threshold ? Number(threshold) : undefined,
        hybrid_search_enabled: hybridEnabled,
        hybrid_candidate_count: candidateCount ? Number(candidateCount) : undefined,
        vector_search_weight: vectorWeight ? Number(vectorWeight) : undefined,
        keyword_search_weight: keywordWeight ? Number(keywordWeight) : undefined,
        rrf_k: rrfK ? Number(rrfK) : undefined,
      })
      applySettings(data)
      setRetrievalMsg({ type: "ok", text: "Saved." })
      setTimeout(() => setRetrievalMsg(null), 3000)
    } catch (e: unknown) {
      setRetrievalMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed" })
    } finally {
      setRetrievalSaving(false)
    }
  }

  async function handleResetRetrieval() {
    setRetrievalResetting(true)
    try {
      applySettings(await resetRetrievalSettings())
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setRetrievalResetting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
            Configure LLM providers, embedding, reranking, and retrieval. Each section shows whether it is reading from
            system defaults (<code className="text-xs bg-muted px-1 rounded">.env</code>) or a custom user override.
          </p>
        </div>

        {/* ── Section 1: LLM Providers ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">LLM Providers</CardTitle>
                <CardDescription className="mt-1">
                  {(s.llm_providers?.length ?? 0) === 0
                    ? "No providers configured — chat model list reads from AVAILABLE_MODELS in .env."
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

        {/* ── Section 2: Embedding ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Embedding
                  {s.embedding_model_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                  <SourceBadge overridden={s.embedding_overridden ?? false} />
                </CardTitle>
                <CardDescription>
                  {s.embedding_model_locked
                    ? "Locked — delete all documents to change embedding settings."
                    : "Model used to embed documents during ingestion."}
                </CardDescription>
              </div>
              <SectionControl
                overridden={s.embedding_overridden ?? false}
                locked={s.embedding_model_locked}
                onCustomize={() => setEmbEditing(true)}
                onReset={() => { void handleResetEmbedding() }}
                resetting={embResetting}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!embEditing ? (
              // Read-only view — shows current effective (.env) values
              <div className="divide-y">
                <ReadOnlyValue label="Model" value={s.embedding_model} />
                <ReadOnlyValue label="Dimensions" value={s.embedding_dimensions} />
                {s.embedding_base_url && <ReadOnlyValue label="Base URL" value={s.embedding_base_url} />}
                <ReadOnlyValue label="API Key" value={s.embedding_has_api_key ? "Saved (write-only)" : "Using LLM key fallback"} />
              </div>
            ) : (
              // Edit mode
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                    <Input value={embModel} onChange={(e) => setEmbModel(e.target.value)} disabled={s.embedding_model_locked} placeholder="text-embedding-3-small" className="text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Dimensions</label>
                    <Input type="number" value={embDimensions} onChange={(e) => setEmbDimensions(e.target.value)} disabled={s.embedding_model_locked} placeholder="1536" className="text-sm" />
                  </div>
                </div>
                {embDimensions && s.embedding_dimensions != null && Number(embDimensions) !== s.embedding_dimensions && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2">
                    Changing dimensions requires <code className="font-mono">SELECT resize_embedding_column({embDimensions})</code> in Supabase and re-uploading all documents.
                  </p>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Base URL (optional)</label>
                  <Input value={embBaseUrl} onChange={(e) => setEmbBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    API Key {s.embedding_has_api_key ? "(saved — leave blank to keep)" : "(optional)"}
                  </label>
                  <Input type="password" value={embApiKey} onChange={(e) => setEmbApiKey(e.target.value)} placeholder={s.embedding_has_api_key ? "••••••••" : "sk-..."} className="text-sm font-mono" />
                </div>
                {!s.embedding_model_locked && (
                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={() => { void handleSaveEmbedding() }} disabled={embSaving}>{embSaving ? "Saving…" : "Save"}</Button>
                    {embMsg && <p className={`text-sm ${embMsg.type === "ok" ? "text-green-600" : "text-destructive"}`}>{embMsg.text}</p>}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Reranking ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Reranking
                  <SourceBadge overridden={s.reranking_overridden ?? false} />
                </CardTitle>
                <CardDescription>
                  Re-score retrieved chunks with a cross-encoder for higher precision.
                  {!(s.reranking_overridden) && !s.rerank_enabled && " Currently disabled via .env — click Customize to override."}
                </CardDescription>
              </div>
              <SectionControl
                overridden={s.reranking_overridden ?? false}
                onCustomize={() => setRerankEditing(true)}
                onReset={() => { void handleResetReranking() }}
                resetting={rerankResetting}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!rerankEditing ? (
              <div className="divide-y">
                <ReadOnlyValue label="Enabled" value={s.rerank_enabled} />
                <ReadOnlyValue label="Provider" value={s.rerank_provider} />
                <ReadOnlyValue label="Model" value={s.rerank_model} />
                <ReadOnlyValue label="Top-N" value={s.rerank_top_n} />
                <ReadOnlyValue label="API Key" value={s.rerank_has_api_key ? "Saved (write-only)" : "Not set"} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Toggle checked={rerankEnabled} onChange={setRerankEnabled} />
                  <span className="text-sm">{rerankEnabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
                    <select
                      value={rerankProvider}
                      onChange={(e) => setRerankProvider(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="api">API (Cohere)</option>
                      <option value="local">Local (sentence-transformers)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Top-N</label>
                    <Input type="number" value={rerankTopN} onChange={(e) => setRerankTopN(e.target.value)} placeholder="5" className="text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                  <Input value={rerankModel} onChange={(e) => setRerankModel(e.target.value)} placeholder={rerankProvider === "api" ? "rerank-v3.5" : "cross-encoder/ms-marco-MiniLM-L-6-v2"} className="text-sm font-mono" />
                </div>
                {rerankProvider === "api" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      API Key {s.rerank_has_api_key ? "(saved — leave blank to keep)" : ""}
                    </label>
                    <Input type="password" value={rerankApiKey} onChange={(e) => setRerankApiKey(e.target.value)} placeholder={s.rerank_has_api_key ? "••••••••" : "API key…"} className="text-sm font-mono" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => { void handleSaveReranking() }} disabled={rerankSaving}>{rerankSaving ? "Saving…" : "Save"}</Button>
                  {rerankMsg && <p className={`text-sm ${rerankMsg.type === "ok" ? "text-green-600" : "text-destructive"}`}>{rerankMsg.text}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Retrieval ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Retrieval
                  <SourceBadge overridden={s.retrieval_overridden ?? false} />
                </CardTitle>
                <CardDescription>
                  Controls how many chunks are retrieved and how hybrid search weights are balanced.
                </CardDescription>
              </div>
              <SectionControl
                overridden={s.retrieval_overridden ?? false}
                onCustomize={() => setRetrievalEditing(true)}
                onReset={() => { void handleResetRetrieval() }}
                resetting={retrievalResetting}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!retrievalEditing ? (
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
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Top-K (final results)</label>
                    <Input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Match threshold (0–1)</label>
                    <Input type="number" min={0} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={hybridEnabled} onChange={setHybridEnabled} />
                  <span className="text-sm">Hybrid search (vector + keyword)</span>
                </div>
                {hybridEnabled && (
                  <div className="grid grid-cols-2 gap-3 pl-1">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Candidate count</label>
                      <Input type="number" value={candidateCount} onChange={(e) => setCandidateCount(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">RRF-K constant</label>
                      <Input type="number" value={rrfK} onChange={(e) => setRrfK(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Vector weight</label>
                      <Input type="number" min={0} step={0.1} value={vectorWeight} onChange={(e) => setVectorWeight(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Keyword weight</label>
                      <Input type="number" min={0} step={0.1} value={keywordWeight} onChange={(e) => setKeywordWeight(e.target.value)} className="text-sm" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => { void handleSaveRetrieval() }} disabled={retrievalSaving}>{retrievalSaving ? "Saving…" : "Save"}</Button>
                  {retrievalMsg && <p className={`text-sm ${retrievalMsg.type === "ok" ? "text-green-600" : "text-destructive"}`}>{retrievalMsg.text}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
