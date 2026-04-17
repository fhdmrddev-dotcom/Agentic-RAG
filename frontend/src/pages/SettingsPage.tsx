import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSettings, updateSettings, getAuditLogs, exportAuditLogs } from "@/lib/api"
import type { FullAppSettings, ProviderInfo, SettingsUpdate, AuditEntry } from "@/lib/api"
import { Check, Eye, EyeOff, Save, RotateCcw, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MemorySection } from "@/components/settings/MemorySection"

const KEY_PLACEHOLDER = "***"

const PROVIDER_META: Record<string, { label: string; defaultBase: string; keyLabel: string }> = {
  openai:     { label: "OpenAI",        defaultBase: "api.openai.com",                           keyLabel: "API Key" },
  anthropic:  { label: "Anthropic",     defaultBase: "api.anthropic.com",                        keyLabel: "API Key" },
  google:     { label: "Google Gemini", defaultBase: "generativelanguage.googleapis.com",        keyLabel: "API Key" },
  openrouter: { label: "OpenRouter",    defaultBase: "openrouter.ai",                            keyLabel: "API Key" },
  ollama:     { label: "Ollama",        defaultBase: "http://localhost:11434",                   keyLabel: "Base URL" },
}

// ── Small reusable components ─────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <Label className="text-sm text-muted-foreground shrink-0 w-44">{label}</Label>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-sm font-mono bg-muted/30 ghost-border"
    />
  )
}

function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="h-8 text-sm font-mono bg-muted/30 ghost-border"
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium transition-colors",
        checked ? "text-primary" : "text-muted-foreground",
      )}
    >
      <div className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}>
        <span className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-1",
        )} />
      </div>
      {label}
    </button>
  )
}

function ApiKeyInput({ value, onChange, placeholder = "Enter API key…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  const isMasked = value === KEY_PLACEHOLDER
  return (
    <div className="relative flex items-center">
      <Input
        type={show ? "text" : "password"}
        value={isMasked ? "" : value}
        placeholder={isMasked ? "Key saved — enter new key to replace" : placeholder}
        onChange={(e) => onChange(e.target.value || "")}
        className="h-8 text-sm font-mono bg-muted/30 ghost-border pr-8"
      />
      {!isMasked && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

function SectionCard({ title, description, children }: {
  title: string; description: string; children: React.ReactNode
}) {
  return (
    <Card className="ghost-border bg-card/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/30">{children}</div>
      </CardContent>
    </Card>
  )
}

// ── Provider card ─────────────────────────────────────────────────────────────

interface ProviderState {
  id: string
  api_key: string  // "" = not set, "***" = saved (masked), real = new value
  models: string   // comma-sep
  base_url: string
}

function ProviderCard({
  provider,
  state,
  isActive,
  onChange,
  onSetActive,
}: {
  provider: ProviderInfo
  state: ProviderState
  isActive: boolean
  onChange: (s: ProviderState) => void
  onSetActive: () => void
}) {
  const meta = PROVIDER_META[provider.id]
  const isOllama = provider.id === "ollama"

  return (
    <div className={cn(
      "rounded-lg p-4 ghost-border transition-all",
      isActive ? "bg-primary/5 border-primary/30" : "bg-muted/20",
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{meta?.label ?? provider.id}</span>
          {isActive && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              active
            </span>
          )}
          {provider.has_key && !isActive && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ghost-border">
              configured
            </span>
          )}
        </div>
        {!isActive && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSetActive}>
            Set active
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {isOllama ? (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Base URL</Label>
            <TextInput
              value={state.base_url || meta?.defaultBase || "http://localhost:11434"}
              onChange={(v) => onChange({ ...state, base_url: v })}
              placeholder="http://localhost:11434"
            />
          </div>
        ) : (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{meta?.keyLabel ?? "API Key"}</Label>
            <ApiKeyInput
              value={state.api_key}
              onChange={(v) => onChange({ ...state, api_key: v })}
            />
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Models (comma-separated)</Label>
          <TextInput
            value={state.models}
            onChange={(v) => onChange({ ...state, models: v })}
            placeholder={isOllama ? "llama3.2,mistral,codellama" : "model-a,model-b"}
          />
        </div>
      </div>
    </div>
  )
}

// ── Audit Log Section ─────────────────────────────────────────────────────────

const SINCE_OPTIONS = [
  { label: "All", value: undefined },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
] as const

const ACTION_TYPES = [
  "document.upload", "document.delete", "search.query",
  "code.execute", "skill.load", "thread.create",
  "thread.delete", "settings.update",
]

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDetails(actionType: string, metadata: Record<string, unknown>): string {
  switch (actionType) {
    case "document.upload": {
      const fname = (metadata.filename as string) ?? ""
      const size = metadata.file_size as number | undefined
      return size !== undefined ? `${fname} (${formatBytes(size)})` : fname
    }
    case "document.delete":
      return (metadata.filename as string) ?? ""
    case "search.query": {
      let text = (metadata.query_text as string) ?? ""
      if (text.length > 60) text = text.slice(0, 60) + "\u2026"
      return `\u201c${text}\u201d`
    }
    case "code.execute":
      return (metadata.language as string) ?? ""
    case "skill.load":
      return (metadata.skill_name as string) ?? ""
    case "thread.create":
    case "thread.delete":
      return "\u2014"
    case "settings.update": {
      const newSettings = (metadata.new_settings as Record<string, unknown>) ?? {}
      return Object.keys(newSettings).join(", ")
    }
    default:
      return ""
  }
}

function AuditLogSection() {
  const [page, setPage] = useState(1)
  const [since, setSince] = useState<string | undefined>(undefined)
  const [actionType, setActionType] = useState<string | undefined>(undefined)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAuditLogs(page, since, actionType)
      .then(({ entries: e, total: t }) => { setEntries(e); setTotal(t) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, since, actionType])

  const handleSinceChange = (value: string | undefined) => {
    setSince(value)
    setPage(1)
  }

  const handleActionTypeChange = (value: string) => {
    setActionType(value || undefined)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportAuditLogs(since, actionType)
    } catch {
      // Silently fail — export is best-effort
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="ghost-border bg-card/50 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base font-headline font-bold">Audit Log</CardTitle>
          <CardDescription>Your account activity — all significant actions recorded for security and compliance.</CardDescription>
        </div>
        <Button size="sm" className="gap-2 gradient-primary shrink-0" onClick={handleExport} disabled={exporting || loading}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {SINCE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => handleSinceChange(opt.value)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                since === opt.value
                  ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                  : "bg-muted/30 text-muted-foreground ghost-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <select
            className="ml-auto text-sm rounded-md bg-muted/30 ghost-border px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={actionType ?? ""}
            onChange={e => handleActionTypeChange(e.target.value)}
          >
            <option value="">All types</option>
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table or state */}
        {error ? (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
            Failed to load audit log. Refresh the page to try again.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-xs font-bold text-muted-foreground text-left pb-2 pr-4 w-40">Timestamp</th>
                <th className="text-xs font-bold text-muted-foreground text-left pb-2 pr-4 w-40">Action</th>
                <th className="text-xs font-bold text-muted-foreground text-left pb-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    No entries found for this period.
                  </td>
                </tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{formatTimestamp(entry.created_at)}</td>
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs bg-muted/30 px-2 py-1 rounded ghost-border">{entry.action_type}</span>
                  </td>
                  <td className="py-2 text-muted-foreground">{formatDetails(entry.action_type, entry.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!error && !loading && total > 0 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [s, setS] = useState<FullAppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Provider states
  const [providerStates, setProviderStates] = useState<ProviderState[]>([])
  const [activeProvider, setActiveProvider] = useState("")

  // LLM
  const [llmModel, setLlmModel] = useState("")

  // Embedding
  const [embeddingModel, setEmbeddingModel] = useState("")
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("")
  const [embeddingDimensions, setEmbeddingDimensions] = useState(1536)
  const [embeddingApiKey, setEmbeddingApiKey] = useState("")

  // Reranking
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [rerankProvider, setRerankProvider] = useState("api")
  const [rerankModel, setRerankModel] = useState("")
  const [rerankTopN, setRerankTopN] = useState(5)
  const [rerankApiKey, setRerankApiKey] = useState("")

  // Retrieval
  const [retrievalTopK, setRetrievalTopK] = useState(5)
  const [retrievalThreshold, setRetrievalThreshold] = useState(0.3)
  const [hybridEnabled, setHybridEnabled] = useState(true)
  const [hybridCandidates, setHybridCandidates] = useState(20)
  const [vectorWeight, setVectorWeight] = useState(1.0)
  const [keywordWeight, setKeywordWeight] = useState(1.0)
  const [rrfK, setRrfK] = useState(60)

  // Web search
  const [tavilyApiKey, setTavilyApiKey] = useState("")
  const [webSearchMaxResults, setWebSearchMaxResults] = useState(5)

  // Sandbox
  const [sandboxEnabled, setSandboxEnabled] = useState(false)

  const hydrate = (data: FullAppSettings) => {
    setS(data)
    setActiveProvider(data.active_provider)
    setLlmModel(data.llm_model)
    setProviderStates(data.providers.map((p) => ({
      id: p.id,
      api_key: p.has_key ? KEY_PLACEHOLDER : "",
      models: p.models.join(", "),
      base_url: p.base_url,
    })))
    setEmbeddingModel(data.embedding_model)
    setEmbeddingBaseUrl(data.embedding_base_url)
    setEmbeddingDimensions(data.embedding_dimensions)
    setEmbeddingApiKey(data.embedding_has_api_key ? KEY_PLACEHOLDER : "")
    setRerankEnabled(data.rerank_enabled)
    setRerankProvider(data.rerank_provider)
    setRerankModel(data.rerank_model)
    setRerankTopN(data.rerank_top_n)
    setRerankApiKey(data.rerank_has_api_key ? KEY_PLACEHOLDER : "")
    setRetrievalTopK(data.retrieval_top_k)
    setRetrievalThreshold(data.retrieval_match_threshold)
    setHybridEnabled(data.hybrid_search_enabled)
    setHybridCandidates(data.hybrid_candidate_count)
    setVectorWeight(data.vector_search_weight)
    setKeywordWeight(data.keyword_search_weight)
    setRrfK(data.rrf_k)
    setTavilyApiKey(data.web_search_enabled ? KEY_PLACEHOLDER : "")
    setWebSearchMaxResults(data.web_search_max_results)
    setSandboxEnabled(data.sandbox_enabled)
  }

  useEffect(() => {
    getSettings()
      .then(hydrate)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: SettingsUpdate = {
        active_provider: activeProvider,
        llm_model: llmModel,
        providers: providerStates.map((ps) => ({
          id: ps.id,
          api_key: ps.api_key || KEY_PLACEHOLDER,
          models: ps.models.split(",").map((m) => m.trim()).filter(Boolean),
          base_url: ps.base_url,
        })),
        embedding_model: embeddingModel,
        embedding_api_key: embeddingApiKey || KEY_PLACEHOLDER,
        embedding_base_url: embeddingBaseUrl,
        embedding_dimensions: embeddingDimensions,
        rerank_enabled: rerankEnabled,
        rerank_provider: rerankProvider,
        rerank_api_key: rerankApiKey || KEY_PLACEHOLDER,
        rerank_model: rerankModel,
        rerank_top_n: rerankTopN,
        retrieval_top_k: retrievalTopK,
        retrieval_match_threshold: retrievalThreshold,
        hybrid_search_enabled: hybridEnabled,
        hybrid_candidate_count: hybridCandidates,
        vector_search_weight: vectorWeight,
        keyword_search_weight: keywordWeight,
        rrf_k: rrfK,
        tavily_api_key: tavilyApiKey || KEY_PLACEHOLDER,
        web_search_max_results: webSearchMaxResults,
        sandbox_enabled: sandboxEnabled,
      }
      const updated = await updateSettings(body)
      hydrate(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (s) hydrate(s)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (error && !s) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  const activeModels = providerStates.find((p) => p.id === activeProvider)?.models ?? ""

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-3xl w-full mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-headline font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Changes are saved to <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded font-mono ghost-border">settings_override.json</code> and take effect immediately.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 gradient-primary">
              {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved!" : saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">{error}</p>
        )}

        {/* ── Providers ── */}
        <SectionCard
          title="LLM Providers"
          description="Configure API keys and models for each provider. The active provider is used by default for new chats."
        >
          <div className="space-y-3 py-2">
            {s?.providers.map((provider) => {
              const ps = providerStates.find((p) => p.id === provider.id)
              if (!ps) return null
              return (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  state={ps}
                  isActive={activeProvider === provider.id}
                  onChange={(updated) =>
                    setProviderStates((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                  }
                  onSetActive={() => {
                    setActiveProvider(provider.id)
                    const firstModel = ps.models.split(",")[0]?.trim()
                    if (firstModel) setLlmModel(firstModel)
                  }}
                />
              )
            })}
          </div>
        </SectionCard>

        {/* ── Active model ── */}
        <SectionCard title="Active Model" description="Default model used when starting a new chat.">
          <FieldRow label="Model">
            <TextInput value={llmModel} onChange={setLlmModel} placeholder="e.g. gpt-4o" />
          </FieldRow>
          {activeModels && (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-1">Available from active provider:</p>
              <div className="flex flex-wrap gap-1.5">
                {activeModels.split(",").map((m) => m.trim()).filter(Boolean).map((m) => (
                  <button
                    key={m}
                    onClick={() => setLlmModel(m)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full ghost-border transition-all",
                      llmModel === m
                        ? "bg-primary/10 text-primary border-primary/30 font-medium"
                        : "bg-muted/30 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Embedding ── */}
        <SectionCard title="Embedding" description="Model used to embed documents and queries for semantic search.">
          <FieldRow label="Model">
            <TextInput value={embeddingModel} onChange={setEmbeddingModel} placeholder="text-embedding-3-small" />
          </FieldRow>
          <FieldRow label="Dimensions">
            <NumberInput value={embeddingDimensions} onChange={setEmbeddingDimensions} min={64} max={4096} />
          </FieldRow>
          <FieldRow label="Base URL (optional)">
            <TextInput value={embeddingBaseUrl} onChange={setEmbeddingBaseUrl} placeholder="Leave blank to use active provider" />
          </FieldRow>
          <FieldRow label="API Key (optional)">
            <ApiKeyInput value={embeddingApiKey} onChange={setEmbeddingApiKey} placeholder="Leave blank to use active provider key" />
          </FieldRow>
        </SectionCard>

        {/* ── Reranking ── */}
        <SectionCard title="Reranking" description="Re-score retrieved chunks with a cross-encoder for higher precision.">
          <FieldRow label="Enabled">
            <Toggle checked={rerankEnabled} onChange={setRerankEnabled} label={rerankEnabled ? "On" : "Off"} />
          </FieldRow>
          {rerankEnabled && (
            <>
              <FieldRow label="Provider">
                <select
                  value={rerankProvider}
                  onChange={(e) => setRerankProvider(e.target.value)}
                  className="h-8 w-full text-sm rounded-md bg-muted/30 ghost-border px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="api">API (Cohere)</option>
                  <option value="local">Local (sentence-transformers)</option>
                </select>
              </FieldRow>
              <FieldRow label="Model">
                <TextInput value={rerankModel} onChange={setRerankModel} placeholder="rerank-v3.5" />
              </FieldRow>
              <FieldRow label="Top-N results">
                <NumberInput value={rerankTopN} onChange={setRerankTopN} min={1} max={50} />
              </FieldRow>
              {rerankProvider === "api" && (
                <FieldRow label="API Key">
                  <ApiKeyInput value={rerankApiKey} onChange={setRerankApiKey} />
                </FieldRow>
              )}
            </>
          )}
        </SectionCard>

        {/* ── Retrieval ── */}
        <SectionCard title="Retrieval" description="Controls how document chunks are retrieved and ranked.">
          <FieldRow label="Top-K chunks">
            <NumberInput value={retrievalTopK} onChange={setRetrievalTopK} min={1} max={50} />
          </FieldRow>
          <FieldRow label="Match threshold">
            <NumberInput value={retrievalThreshold} onChange={setRetrievalThreshold} min={0} max={1} step={0.05} />
          </FieldRow>
          <FieldRow label="Hybrid search">
            <Toggle checked={hybridEnabled} onChange={setHybridEnabled} label={hybridEnabled ? "On" : "Off"} />
          </FieldRow>
          {hybridEnabled && (
            <>
              <FieldRow label="Candidate count">
                <NumberInput value={hybridCandidates} onChange={setHybridCandidates} min={5} max={200} />
              </FieldRow>
              <FieldRow label="Vector weight">
                <NumberInput value={vectorWeight} onChange={setVectorWeight} min={0} max={10} step={0.1} />
              </FieldRow>
              <FieldRow label="Keyword weight">
                <NumberInput value={keywordWeight} onChange={setKeywordWeight} min={0} max={10} step={0.1} />
              </FieldRow>
              <FieldRow label="RRF-K constant">
                <NumberInput value={rrfK} onChange={setRrfK} min={1} max={200} />
              </FieldRow>
            </>
          )}
        </SectionCard>

        {/* ── Web search ── */}
        <SectionCard title="Web Search" description="Enable web search via Tavily. Leave key blank to disable.">
          <FieldRow label="Tavily API Key">
            <ApiKeyInput value={tavilyApiKey} onChange={setTavilyApiKey} placeholder="tvly-… (leave blank to disable)" />
          </FieldRow>
          <FieldRow label="Max results">
            <NumberInput value={webSearchMaxResults} onChange={setWebSearchMaxResults} min={1} max={20} />
          </FieldRow>
        </SectionCard>

        {/* ── Sandbox ── */}
        <SectionCard title="Code Execution" description="Run Python code in a sandboxed Docker container.">
          <FieldRow label="Sandbox enabled">
            <Toggle checked={sandboxEnabled} onChange={setSandboxEnabled} label={sandboxEnabled ? "On" : "Off"} />
          </FieldRow>
        </SectionCard>

        {/* -- Memory -- */}
        <MemorySection />

        {/* ── Audit Log ── */}
        <AuditLogSection />

        {/* Save (bottom) */}
        <div className="flex justify-end gap-2 pb-4">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 gradient-primary">
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save all changes"}
          </Button>
        </div>

      </div>
    </div>
  )
}
