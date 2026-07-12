import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getSettings, updateSettings, getReembedProgress, getAuditLogs, exportAuditLogs } from "@/lib/api"
import type { FullAppSettings, ProviderInfo, SettingsUpdate, AuditEntry } from "@/lib/api"
import { Check, Eye, EyeOff, Save, RotateCcw, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MemorySection } from "@/components/settings/MemorySection"
import { ModelPillRow } from "@/components/settings/ModelPillRow"
import {
  ProviderPicker,
  EMBEDDING_PRESETS,
  EXTRACTION_PRESETS,
  type ProviderPickerValue,
} from "@/components/settings/ProviderPicker"
import { ReembedConfirmModal } from "@/components/settings/ReembedConfirmModal"
import { ReembedStatusCard } from "@/components/settings/ReembedStatusCard"
import { EngineHealthCard } from "@/components/settings/EngineHealthCard"
import { JudgeModelPicker } from "@/components/settings/JudgeModelPicker"

const KEY_PLACEHOLDER = "***"

const PROVIDER_META: Record<string, { label: string; defaultBase: string; keyLabel: string }> = {
  openai:     { label: "OpenAI",                    defaultBase: "api.openai.com",                    keyLabel: "API Key" },
  anthropic:  { label: "Anthropic",                 defaultBase: "api.anthropic.com",                 keyLabel: "API Key" },
  google:     { label: "Google Gemini",             defaultBase: "generativelanguage.googleapis.com", keyLabel: "API Key" },
  deepseek:   { label: "DeepSeek",                  defaultBase: "api.deepseek.com",                  keyLabel: "API Key" },
  moonshot:   { label: "Moonshot (Kimi)",           defaultBase: "api.moonshot.cn",                   keyLabel: "API Key" },
  minimax:    { label: "MiniMax",                   defaultBase: "api.minimax.chat",                  keyLabel: "API Key" },
  zhipu:      { label: "GLM (Zhipu)",               defaultBase: "open.bigmodel.cn",                  keyLabel: "API Key" },
  openrouter: { label: "OpenRouter (experimental)", defaultBase: "openrouter.ai",                     keyLabel: "API Key" },
  ollama:     { label: "Ollama",                    defaultBase: "http://localhost:11434",             keyLabel: "Base URL" },
}

// Phase 123.1-03 (D-09 / D-10) — the skill-builder model picker no longer uses a
// hardcoded cheap-only list. It now derives its options from the user's CONFIGURED
// per-provider models (the same `providers[].models` source the chat picker reads) so
// the operator can pick STRONG models (Sonnet/Opus, GPT-pro, Gemini-Pro), and so the
// LOCAL options come from the user's real providers (Ollama / LM Studio / OpenAI-compat)
// instead of placeholder ids (IN-02). A cheap-but-capable default stays pre-selected via
// the value="" Auto option (not forced); a custom persisted value is still selectable;
// and a SOFT amber hint (never a hard block) shows when a chosen model is unverified.

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

function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  hint?: string
}) {
  const displayValue = value === 0 ? "Auto" : value.toLocaleString()
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="flex-1 h-2 accent-primary cursor-pointer"
        />
        <span className="text-xs font-mono text-muted-foreground w-20 text-right shrink-0">
          {displayValue}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
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
    <Card className="ghost-border bg-card/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">{children}</div>
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
  const [exportError, setExportError] = useState<string | null>(null)

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
    setExportError(null)
    try {
      await exportAuditLogs(since, actionType)
    } catch {
      setExportError("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="ghost-border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base font-headline font-bold">Audit Log</CardTitle>
          <CardDescription>Your account activity — all significant actions recorded for security and compliance.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button size="sm" className="gap-2 gradient-primary" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
          {exportError && (
            <p className="text-xs text-destructive mt-1">{exportError}</p>
          )}
        </div>
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
  const [error, setError] = useState<string | null>(null)

  // Per-tab save states
  const [savingAI, setSavingAI] = useState(false)
  const [savedAI, setSavedAI] = useState(false)
  const [savingSearch, setSavingSearch] = useState(false)
  const [savedSearch, setSavedSearch] = useState(false)
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [savedIntegrations, setSavedIntegrations] = useState(false)

  // Tab persistence
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("settings_active_tab") ?? "0"
  })

  function handleTabChange(value: string) {
    setActiveTab(value)
    localStorage.setItem("settings_active_tab", value)
  }

  // Provider states
  const [providerStates, setProviderStates] = useState<ProviderState[]>([])
  const [activeProvider, setActiveProvider] = useState("")
  const isNativeProvider = ["openai", "anthropic", "google", "deepseek", "moonshot", "minimax", "zhipu"].includes(activeProvider)

  // LLM
  const [llmModel, setLlmModel] = useState("")

  // Embedding
  const [embeddingModel, setEmbeddingModel] = useState("")
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("")
  const [embeddingDimensions, setEmbeddingDimensions] = useState(1536)
  const [embeddingApiKey, setEmbeddingApiKey] = useState("")
  // Phase 111.1 — explicit provider (the picker stores the preset key; routes by
  // stored provider, never name-inference — D-06).
  const [embeddingProvider, setEmbeddingProvider] = useState("openai")
  // Phase 111.1 — extraction picker (D-09 reuse). The backend surfaces+persists
  // extraction_provider through the settings contract; the model/base_url/key are
  // UI defaults that travel with the preset (sent on save, harmless if ignored).
  const [extractionProvider, setExtractionProvider] = useState("openai")
  const [extractionModel, setExtractionModel] = useState("")
  const [extractionBaseUrl, setExtractionBaseUrl] = useState("")
  const [extractionApiKey, setExtractionApiKey] = useState("")
  // Phase 111.1 D-02/D-03 — confirm-on-save gate state. The modal fires BEFORE the
  // PUT when the embedding model OR dims changed; only Confirm commits the save.
  const [reembedModalOpen, setReembedModalOpen] = useState(false)
  const [reembedChunkCount, setReembedChunkCount] = useState<number | null>(null)
  const [pendingSearchSave, setPendingSearchSave] = useState<SettingsUpdate | null>(null)

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
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)

  // Sandbox
  const [sandboxEnabled, setSandboxEnabled] = useState(false)

  // Context & Sub-agent
  const [contextWindowMaxTokens, setContextWindowMaxTokens] = useState(0)
  const [subAgentMaxOutputTokens, setSubAgentMaxOutputTokens] = useState(8192)
  const [subAgentModel, setSubAgentModel] = useState("")
  const [subAgentModelError, setSubAgentModelError] = useState<string | null>(null)
  const [resolvedSubAgentModel, setResolvedSubAgentModel] = useState("")
  // Phase 123 (D-08 / TRIG-01) — the skill-builder model knob. "" = unset (the
  // resolver falls back to a strong default, surfaced as resolvedSkillBuilderModel).
  const [skillBuilderModel, setSkillBuilderModel] = useState("")
  const [resolvedSkillBuilderModel, setResolvedSkillBuilderModel] = useState("")
  const [llmMaxOutputTokens, setLlmMaxOutputTokens] = useState(0)
  const [openrouterToolStrategy, setOpenrouterToolStrategy] = useState<"quality" | "native" | "xml">("quality")

  // Phase 075.3 D-075.3-13: registry-known model_ids + inferred-provider hints
  // sourced from FullAppSettings.verified_models / .inferred_provider_for.
  // Used by ModelPillRow + selected-label badge to flag unregistered models.
  const [verifiedModels, setVerifiedModels] = useState<Set<string>>(new Set())
  const [inferredProviderFor, setInferredProviderFor] = useState<Record<string, string>>({})
  // Phase 149 (D-149-05): model_ids flagged `deprecated` in the registry. Plan 05
  // supplies `deprecated_models` in the settings payload; the picker lights up the
  // `deprecated` badge for these. Defensive default (absent → empty set → no badge).
  const [deprecatedModels, setDeprecatedModels] = useState<Set<string>>(new Set())

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
    // Phase 111.1 — provider selection. Fall back to "openai" / "custom" so an old
    // backend (or an unmapped provider) still renders a coherent picker.
    setEmbeddingProvider(data.embedding_provider || "openai")
    const exProvider = data.extraction_provider || "openai"
    setExtractionProvider(exProvider)
    // The extraction base_url/key aren't in the settings contract; seed those from the
    // matching preset. The MODEL now round-trips from the server (verify-work 111.1 fix:
    // it was previously dropped on save) — prefer the persisted value, fall back to the
    // preset default for an old backend / never-set value.
    const exPreset = EXTRACTION_PRESETS.find((p) => p.key === exProvider)
    setExtractionModel(data.extraction_model || exPreset?.model || "")
    setExtractionBaseUrl(exPreset?.base_url ?? "")
    setExtractionApiKey(exPreset?.local ? (exPreset.dummyKey ?? "") : (data.embedding_has_api_key ? KEY_PLACEHOLDER : ""))
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
    setTavilyApiKey(data.web_search_has_api_key ? KEY_PLACEHOLDER : "")
    setWebSearchMaxResults(data.web_search_max_results)
    setWebSearchEnabled(data.web_search_enabled)
    setSandboxEnabled(data.sandbox_enabled)
    setContextWindowMaxTokens(data.context_window_max_tokens ?? 0)
    setSubAgentMaxOutputTokens(data.sub_agent_max_output_tokens ?? 8192)
    setSubAgentModel(data.sub_agent_model ?? "")
    setResolvedSubAgentModel(data.resolved_sub_agent_model ?? "")
    setSkillBuilderModel(data.skill_builder_model ?? "")
    setResolvedSkillBuilderModel(data.resolved_skill_builder_model ?? "")
    setLlmMaxOutputTokens(data.llm_max_output_tokens ?? 0)
    setOpenrouterToolStrategy(data.openrouter_tool_strategy ?? "quality")
    // Phase 075.3 D-075.3-13: defensive ?? so an old backend response without
    // the fields doesn't crash the frontend; the badge simply won't render.
    setVerifiedModels(new Set(data.verified_models ?? []))
    setInferredProviderFor(data.inferred_provider_for ?? {})
    // Phase 149 (D-149-05): seed the deprecated set defensively (Plan 05 payload).
    setDeprecatedModels(new Set(data.deprecated_models ?? []))
  }

  useEffect(() => {
    getSettings()
      .then(hydrate)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSaveAIModel = async () => {
    // Plan 075.4-04 Task 1 (D-075.4-F3) — flushSync commits pending onChange
    // before snapshot; closes 2-click bug. See 075.4-04-DIAGNOSIS-settings-2click.md
    flushSync(() => { setSavingAI(true); setError(null); setSubAgentModelError(null) })
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
        context_window_max_tokens: contextWindowMaxTokens,
        sub_agent_max_output_tokens: subAgentMaxOutputTokens,
        sub_agent_model: subAgentModel,
        skill_builder_model: skillBuilderModel,
        llm_max_output_tokens: llmMaxOutputTokens,
        openrouter_tool_strategy: openrouterToolStrategy,
      }
      const updated = await updateSettings(body)
      hydrate(updated)
      setSavedAI(true)
      setTimeout(() => setSavedAI(false), 2500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save AI Model settings"
      if (msg.includes("is not available for provider")) {
        setSubAgentModelError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setSavingAI(false)
    }
  }

  // Phase 111.1 — the actual PUT (called directly on a no-change save, or AFTER the
  // operator confirms the re-embed gate on a model/dim change).
  const commitSearchSave = async (body: SettingsUpdate) => {
    setSavingSearch(true)
    setError(null)
    try {
      const updated = await updateSettings(body)
      hydrate(updated)
      setSavedSearch(true)
      setTimeout(() => setSavedSearch(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save Search settings")
    } finally {
      setSavingSearch(false)
    }
  }

  const handleSaveSearch = async () => {
    const body: SettingsUpdate = {
      embedding_model: embeddingModel,
      embedding_api_key: embeddingApiKey || KEY_PLACEHOLDER,
      embedding_base_url: embeddingBaseUrl,
      embedding_dimensions: embeddingDimensions,
      // Phase 111.1 — pin the explicit providers (route by stored provider, D-06/D-09).
      embedding_provider: embeddingProvider,
      extraction_provider: extractionProvider,
      extraction_model: extractionModel,
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
    }

    // Phase 111.1 D-02/D-03 — confirm-on-save gate. ONLY fire when the embedding
    // model OR dimensions actually changed (a no-change save commits silently).
    const modelChanged = !!s && embeddingModel !== s.embedding_model
    const dimsChanged = !!s && embeddingDimensions !== s.embedding_dimensions
    if (modelChanged || dimsChanged) {
      setPendingSearchSave(body)
      setReembedChunkCount(null)
      setReembedModalOpen(true)
      // Pull the LIVE chunk count for the gate's "how many chunks" fact (the
      // current-model total — what will go stale + re-embed). Best-effort.
      void getReembedProgress()
        .then((p) => setReembedChunkCount(p.total))
        .catch(() => setReembedChunkCount(null))
      return
    }

    await commitSearchSave(body)
  }

  const handleSaveIntegrations = async () => {
    setSavingIntegrations(true)
    setError(null)
    try {
      const body: SettingsUpdate = {
        tavily_api_key: tavilyApiKey || KEY_PLACEHOLDER,
        web_search_max_results: webSearchMaxResults,
        web_search_enabled: webSearchEnabled,
        sandbox_enabled: sandboxEnabled,
      }
      const updated = await updateSettings(body)
      hydrate(updated)
      setSavedIntegrations(true)
      setTimeout(() => setSavedIntegrations(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save Integrations settings")
    } finally {
      setSavingIntegrations(false)
    }
  }

  const handleReset = () => {
    if (s) {
      if (activeTab === "0" || window.confirm("Reset all unsaved changes across all tabs?")) {
        hydrate(s)
      }
    }
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

  // Phase 123.1-03 (D-09) — the skill-builder picker options derive from the user's
  // CONFIGURED per-provider models across ALL providers (not just the active one),
  // grouped per provider as <optgroup>s. Mirrors how the chat picker splits the
  // comma-separated `Models` lists. Empty providers fall out (no empty optgroup).
  const builderModelGroups = providerStates
    .map((ps) => ({
      provider: ps.id,
      label: PROVIDER_META[ps.id]?.label ?? ps.id,
      models: ps.models.split(",").map((m) => m.trim()).filter(Boolean),
    }))
    .filter((g) => g.models.length > 0)
  // The flat set of all configured model ids — used by the custom-persisted-value guard
  // so a stored id that IS configured doesn't also render as a duplicate "(current)" row.
  const builderConfiguredModels = new Set(builderModelGroups.flatMap((g) => g.models))

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      {/* Phase 111.1 D-03 — destructive re-embed confirm gate (sketch 025). Fires
          on a model/dim change BEFORE the PUT; only Confirm commits the save. */}
      <ReembedConfirmModal
        open={reembedModalOpen}
        chunkCount={reembedChunkCount}
        targetModel={embeddingModel}
        targetDims={embeddingDimensions}
        busy={savingSearch}
        onCancel={() => {
          setReembedModalOpen(false)
          setPendingSearchSave(null)
        }}
        onConfirm={async () => {
          const body = pendingSearchSave
          setReembedModalOpen(false)
          setPendingSearchSave(null)
          if (body) await commitSearchSave(body)
        }}
      />
      <div className="max-w-3xl w-full mx-auto space-y-8">

        {/* Header — no global Save button */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-headline font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Changes take effect immediately.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">{error}</p>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="0">AI Model</TabsTrigger>
            <TabsTrigger value="1">Search &amp; Retrieval</TabsTrigger>
            <TabsTrigger value="2">Integrations</TabsTrigger>
            <TabsTrigger value="3">Memory</TabsTrigger>
            <TabsTrigger value="4">Audit Log</TabsTrigger>
          </TabsList>

          {/* Tab 0: AI Model */}
          <TabsContent value="0">
            <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
              {/* LLM Providers SectionCard */}
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

              {/* Active Model SectionCard */}
              <SectionCard title="Active Model" description="Default model used when starting a new chat.">
                <FieldRow label="Model">
                  <TextInput value={llmModel} onChange={setLlmModel} placeholder="e.g. gpt-4o" />
                  {/* Phase 075.3 D-075.3-10/12: amber "unverified" chip next to the
                      currently-selected llmModel label when it's not in the registry. */}
                  {llmModel && !verifiedModels.has(llmModel) && (
                    <span
                      className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full ghost-border"
                      title={`This model isn't in our verified registry. Using inferred provider: ${inferredProviderFor[llmModel] ?? "ollama"}. Safe defaults applied (max_tokens=${(inferredProviderFor[llmModel] ?? "") === "openrouter" ? 4096 : 8192}, timeout=90s).`}
                    >
                      unverified
                    </span>
                  )}
                </FieldRow>
                {activeModels && (
                  <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-1">Available from active provider:</p>
                    <ModelPillRow
                      models={activeModels.split(",").map((m) => m.trim()).filter(Boolean)}
                      llmModel={llmModel}
                      verifiedModels={verifiedModels}
                      inferredProviderFor={inferredProviderFor}
                      deprecatedModels={deprecatedModels}
                      providerId={activeProvider}
                      onSelect={setLlmModel}
                    />
                  </div>
                )}
              </SectionCard>

              {/* Context & Sub-Agent SectionCard (D-05: below Active Model, reuses Save button per D-10) */}
              <SectionCard
                title="Context & Sub-Agent"
                description="Tune how much history the agent sees and how the sub-agent is configured."
              >
                {isNativeProvider ? (
                  <FieldRow label="Context depth (input)">
                    <span className="text-xs text-muted-foreground font-mono">
                      Model default (managed automatically)
                    </span>
                  </FieldRow>
                ) : (
                  <FieldRow label="Context depth (input)">
                    <SliderInput
                      value={contextWindowMaxTokens}
                      onChange={setContextWindowMaxTokens}
                      min={0}
                      max={200000}
                      step={1000}
                      hint={contextWindowMaxTokens === 0 ? "Using model default" : `${contextWindowMaxTokens.toLocaleString()} tokens`}
                    />
                  </FieldRow>
                )}
                {isNativeProvider ? (
                  <FieldRow label="Main model output tokens">
                    <span className="text-xs text-muted-foreground font-mono">
                      Model default (managed automatically)
                    </span>
                  </FieldRow>
                ) : (
                  <FieldRow label="Main model output tokens">
                    <SliderInput
                      value={llmMaxOutputTokens}
                      onChange={setLlmMaxOutputTokens}
                      min={0}
                      max={65536}
                      step={1024}
                      hint={llmMaxOutputTokens === 0 ? "Auto (per-model default)" : `${llmMaxOutputTokens.toLocaleString()} tokens`}
                    />
                  </FieldRow>
                )}
                {isNativeProvider ? (
                  <FieldRow label="Sub-agent output tokens">
                    <span className="text-xs text-muted-foreground font-mono">
                      Model default (managed automatically)
                    </span>
                  </FieldRow>
                ) : (
                  <FieldRow label="Sub-agent output tokens">
                    <SliderInput
                      value={subAgentMaxOutputTokens}
                      onChange={setSubAgentMaxOutputTokens}
                      min={4096}
                      max={65536}
                      step={1024}
                      hint="Generation tasks use at least 32,768 tokens regardless of this value"
                    />
                  </FieldRow>
                )}
                <FieldRow label="Sub-agent model">
                  <select
                    value={subAgentModel}
                    onChange={(e) => { setSubAgentModel(e.target.value); setSubAgentModelError(null) }}
                    className="w-full h-8 text-xs font-mono bg-muted/30 border border-input rounded px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Auto (cheapest)</option>
                    {subAgentModel &&
                      !activeModels.split(",").map((m) => m.trim()).includes(subAgentModel) && (
                        <option value={subAgentModel}>{subAgentModel} (current)</option>
                    )}
                    {activeModels
                      .split(",")
                      .map((m) => m.trim())
                      .filter(Boolean)
                      .map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                  </select>
                  {subAgentModelError && (
                    <p className="text-xs text-destructive mt-1">{subAgentModelError}</p>
                  )}
                </FieldRow>
                <FieldRow label="OpenRouter Tool Strategy" tooltip="How OpenRouter models handle tool calling. Quality = best reliability with routing. Native = assume native tool support. XML = force structured prompting for maximum compatibility.">
                  <select
                    value={openrouterToolStrategy}
                    onChange={(e) => setOpenrouterToolStrategy(e.target.value as "quality" | "native" | "xml")}
                    className="w-full h-8 text-xs font-mono bg-muted/30 border border-input rounded px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="quality">Quality (Recommended)</option>
                    <option value="native">Native</option>
                    <option value="xml">XML / Structured</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {openrouterToolStrategy === "quality" && "Uses :exacto routing and response healing for best tool reliability."}
                    {openrouterToolStrategy === "native" && "Assumes the selected model supports native tool calling."}
                    {openrouterToolStrategy === "xml" && "Forces structured JSON prompting. Safest for untested models."}
                  </p>
                </FieldRow>
                {/* D-09: Read-only resolved model labels for title & follow-up */}
                <FieldRow label="Title drafting">
                  <span className="text-xs text-muted-foreground font-mono">
                    {subAgentModel
                      ? subAgentModel
                      : `${resolvedSubAgentModel || "auto"} (auto)`}
                  </span>
                </FieldRow>
                <FieldRow label="Follow-up suggestions">
                  <span className="text-xs text-muted-foreground font-mono">
                    {subAgentModel
                      ? subAgentModel
                      : `${resolvedSubAgentModel || "auto"} (auto)`}
                  </span>
                </FieldRow>
              </SectionCard>

              {/* Phase 123.1-03 (D-09 / D-10) — Skill-builder model.
                  The model that WRITES candidate descriptions + seeds the Trigger
                  Tuner's benchmark cases. Now driven by the user's CONFIGURED
                  per-provider models (the chat-picker source) so STRONG models are
                  selectable; LOCAL options come from real providers (no paid-provider
                  SPOF, no placeholder ids). DECOUPLED from the benchmark TARGETS (the
                  builder writes, the targets measure). The Auto default stays
                  pre-selected (not forced); an unverified pick gets a SOFT amber hint,
                  never a hard block. */}
              <SectionCard
                title="Skill Trigger Tuner"
                description="The model that writes candidate descriptions and seeds benchmark cases when you tune a skill's triggers."
              >
                <div className="flex flex-col gap-1.5 py-2">
                  <label htmlFor="skill-builder-model" className="text-sm text-muted-foreground">
                    Skill-builder model
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="skill-builder-model"
                      value={skillBuilderModel}
                      onChange={(e) => setSkillBuilderModel(e.target.value)}
                      className="flex-1 h-8 text-xs font-mono bg-muted/30 border border-input rounded px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">
                        Auto · {resolvedSkillBuilderModel || "strong default"} (recommended)
                      </option>
                      {/* If the persisted value isn't one of the configured models
                          (e.g. a custom / removed id), keep it selectable so the
                          round-trip never drops it (D-10). */}
                      {skillBuilderModel && !builderConfiguredModels.has(skillBuilderModel) && (
                        <option value={skillBuilderModel}>{skillBuilderModel} (current)</option>
                      )}
                      {/* D-09: configured per-provider models, grouped as optgroups. */}
                      {builderModelGroups.map((g) => (
                        <optgroup key={g.provider} label={g.label}>
                          {g.models.map((m) => (
                            <option key={`${g.provider}:${m}`} value={m}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {/* D-10: SOFT amber hint when the chosen builder model isn't in the
                        verified registry — mirrors the Active-Model "unverified" chip.
                        NEVER a hard block / disabled option. */}
                    {skillBuilderModel && !verifiedModels.has(skillBuilderModel) && (
                      <span
                        className="shrink-0 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full ghost-border"
                        title="This model isn't in our verified registry. It may lack structured-output / forced-emission support the builder relies on — it's still selectable; the run will fall back gracefully if it can't emit."
                      >
                        unverified
                      </span>
                    )}
                  </div>
                  {/* Always-on no-SPOF footer + the explicit decoupled-from-targets note. */}
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground">
                    <span className="text-emerald-400">{"🔒"}</span>
                    <span>
                      {`${skillBuilderModel || resolvedSkillBuilderModel || "claude-haiku-4-5"} · your configured models · no single-point-of-failure`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    The builder <span className="italic">writes</span> candidates; the benchmark
                    targets <span className="italic">measure</span> firing — independent settings,
                    decoupled by design.
                  </p>
                </div>
              </SectionCard>

              {/* Save AI Model button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveAIModel}
                  disabled={savingAI || subAgentModelError !== null}
                  className="gap-1.5 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                >
                  {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAI ? <Check className="h-4 w-4" /> : <Save className="h-3.5 w-3.5" />}
                  {savedAI ? "Saved!" : savingAI ? "Saving\u2026" : "Save AI Model"}
                </Button>
              </div>

              {/* Phase 137.1 (EVAL-05 / 060-A) — eval engine health + the independent
                  judge model. Self-contained infra cards that live OUTSIDE the AI Model
                  save cycle: the board self-fetches + sweeps on demand; the judge picker
                  self-persists via setJudgeModel. Registry-only judge options come from
                  the verified-models registry the page already loads. */}
              <EngineHealthCard />
              <JudgeModelPicker registryModels={[...verifiedModels]} />
            </div>
          </TabsContent>

          {/* Tab 1: Search & Retrieval */}
          <TabsContent value="1">
            <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
              {/* Phase 111.1 — Embeddings & Extraction (sketches 024/026).
                  ONE reusable ProviderPicker drives BOTH the embedding model and
                  the extraction model (D-09); the always-on lock-icon endpoint
                  footer makes where-it-runs unmissable (BUG-260616-01 legibility
                  cure). The graceful-dip status card is the home for the re-embed
                  job (D-04/D-05). */}
              <SectionCard title="Embeddings & Extraction" description="Pick a model and pin where it runs. One picker, reused for both jobs — so a local model can never silently call the cloud.">
                <div className="space-y-4">
                  {/* Embedding model picker */}
                  <ProviderPicker
                    presets={EMBEDDING_PRESETS}
                    showDimensions
                    title="Embedding model"
                    description="Turns your documents into search vectors. Changing this re-embeds your library."
                    value={{
                      provider: embeddingProvider,
                      model: embeddingModel,
                      base_url: embeddingBaseUrl,
                      api_key: embeddingApiKey,
                      dimensions: embeddingDimensions,
                      threshold: retrievalThreshold,
                    }}
                    onChange={(next: ProviderPickerValue) => {
                      setEmbeddingProvider(next.provider)
                      setEmbeddingModel(next.model)
                      setEmbeddingBaseUrl(next.base_url)
                      setEmbeddingApiKey(next.api_key)
                      setEmbeddingDimensions(next.dimensions)
                      setRetrievalThreshold(next.threshold)
                    }}
                  />

                  {/* Extraction model picker — SAME component (D-09 reuse) */}
                  <ProviderPicker
                    presets={EXTRACTION_PRESETS}
                    reuseChip
                    title="Metadata extraction model"
                    description="Reads each document for title, summary, and custom fields. Pinning the endpoint here is what closes the local-model mis-route bug."
                    value={{
                      provider: extractionProvider,
                      model: extractionModel,
                      base_url: extractionBaseUrl,
                      api_key: extractionApiKey,
                      dimensions: 0,
                      threshold: 0,
                    }}
                    onChange={(next: ProviderPickerValue) => {
                      setExtractionProvider(next.provider)
                      setExtractionModel(next.model)
                      setExtractionBaseUrl(next.base_url)
                      setExtractionApiKey(next.api_key)
                    }}
                  />

                  {/* Graceful-dip re-embed status card (sketch 026) — the HOME */}
                  <ReembedStatusCard id="reembed-status-card" />
                </div>
              </SectionCard>

              {/* Reranking SectionCard */}
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

              {/* Retrieval SectionCard */}
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

              {/* Save Search Settings button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveSearch}
                  disabled={savingSearch}
                  className="gap-1.5 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                >
                  {savingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : savedSearch ? <Check className="h-4 w-4" /> : <Save className="h-3.5 w-3.5" />}
                  {savedSearch ? "Saved!" : savingSearch ? "Saving\u2026" : "Save Search Settings"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Integrations */}
          <TabsContent value="2">
            <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
              {/* Web Search SectionCard */}
              <SectionCard title="Web Search" description="Enable web search via Tavily to include live results in responses.">
                <FieldRow label="Enabled">
                  <Toggle checked={webSearchEnabled} onChange={setWebSearchEnabled} label={webSearchEnabled ? "On" : "Off"} />
                </FieldRow>
                {webSearchEnabled && tavilyApiKey === "" && (
                  <p className="text-xs text-amber-400 px-3 pb-1">
                    No Tavily API key configured \u2014 web search will not run.
                  </p>
                )}
                {webSearchEnabled && (
                  <div className="bg-card/40 rounded-md px-3 py-2">
                    <FieldRow label="Tavily API Key">
                      <ApiKeyInput value={tavilyApiKey} onChange={setTavilyApiKey} placeholder="tvly-\u2026" />
                    </FieldRow>
                    <FieldRow label="Max results">
                      <NumberInput value={webSearchMaxResults} onChange={setWebSearchMaxResults} min={1} max={20} />
                    </FieldRow>
                  </div>
                )}
              </SectionCard>

              {/* Code Execution Sandbox SectionCard */}
              <SectionCard title="Code Execution" description="Run Python code in a sandboxed Docker container.">
                <FieldRow label="Sandbox enabled">
                  <Toggle checked={sandboxEnabled} onChange={setSandboxEnabled} label={sandboxEnabled ? "On" : "Off"} />
                </FieldRow>
              </SectionCard>

              {/* Save Integrations button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveIntegrations}
                  disabled={savingIntegrations}
                  className="gap-1.5 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                >
                  {savingIntegrations ? <Loader2 className="h-4 w-4 animate-spin" /> : savedIntegrations ? <Check className="h-4 w-4" /> : <Save className="h-3.5 w-3.5" />}
                  {savedIntegrations ? "Saved!" : savingIntegrations ? "Saving\u2026" : "Save Integrations"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Memory — read-only, no Save button */}
          <TabsContent value="3">
            <div className="bg-card/50 ghost-border rounded-xl p-6">
              <MemorySection />
            </div>
          </TabsContent>

          {/* Tab 4: Audit Log — read-only + export, no Save button */}
          <TabsContent value="4">
            <div className="bg-card/50 ghost-border rounded-xl p-6">
              <AuditLogSection />
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
