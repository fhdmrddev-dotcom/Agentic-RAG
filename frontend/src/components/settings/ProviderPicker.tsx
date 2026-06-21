import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Lock, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Phase 111.1 Plan 06 — Reusable provider picker (sketch 024 winner: A's calm
 * preset `<select>` + C's ALWAYS-ON lock-icon endpoint footer).
 *
 * ONE component, reused for BOTH the embedding model and the extraction model
 * (D-09). Selecting a preset auto-fills base_url + a strong default model +
 * default dimensions + a recommended retrieval threshold into the still-editable
 * advanced overrides. Local presets (Ollama / LM Studio) relax the API key to a
 * dummy value and show a green "local" tag; the LM Studio base_url is used AS-IS
 * (already ends in /v1 — never double-appended).
 *
 * The always-on 🔒 endpoint footer (endpoint · dims · threshold · cloud/local
 * tag) is the LEGIBLE half of the BUG-260616-01 cure: you cannot read the model
 * without seeing where it runs — never behind "Advanced".
 *
 * Preset map source of truth: 111.1-PROVIDER-PRESETS.md (D-06/D-07 curation).
 * Model IDs are NOT hard-pinned in component logic — they live in the PRESETS
 * data table below, the editable picker default the operator confirms at first
 * use (D-07: UNVERIFIED IDs ship as defaults, never silently authoritative).
 */

const KEY_PLACEHOLDER = "***"

// ── Preset data (from 111.1-PROVIDER-PRESETS.md) ────────────────────────────
// Each preset auto-fills base_url + default model + default dims + recommended
// retrieval_match_threshold. `local` relaxes the key to a dummy + shows a green
// tag. `keyLabel` is the human note in the endpoint footer. UNVERIFIED ids are
// editable defaults (D-07), never blind-pinned as confirmed.

export interface ProviderPreset {
  key: string
  label: string          // <option> text
  base_url: string       // "" => SDK default (OpenAI) / operator-entered (custom)
  model: string          // editable default model id (D-07)
  dims: number           // default dimensions (flexible — never down-truncated, D-01)
  threshold: number      // recommended retrieval_match_threshold (D-11)
  local: boolean         // true => dummy key + green tag
  dummyKey?: string      // the relaxed dummy key for local providers
  keyNote: string        // footer note about credentials
}

// Embedding presets — the curated map (PROVIDER-PRESETS.md § Preset map).
export const EMBEDDING_PRESETS: ProviderPreset[] = [
  { key: "openai", label: "OpenAI · text-embedding-3-small (default)", base_url: "https://api.openai.com/v1", model: "text-embedding-3-small", dims: 1536, threshold: 0.3, local: false, keyNote: "uses your OpenAI key" },
  { key: "openai-large", label: "OpenAI · text-embedding-3-large (quality, 3072)", base_url: "https://api.openai.com/v1", model: "text-embedding-3-large", dims: 3072, threshold: 0.3, local: false, keyNote: "uses your OpenAI key" },
  { key: "google", label: "Google · gemini-embedding-001", base_url: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-embedding-001", dims: 3072, threshold: 0.3, local: false, keyNote: "uses your Google key" },
  { key: "ollama", label: "Ollama (local) · nomic-embed-text", base_url: "http://localhost:11434/v1", model: "nomic-embed-text", dims: 768, threshold: 0.3, local: true, dummyKey: "ollama", keyNote: "no key needed" },
  { key: "lmstudio", label: "LM Studio (local) · loaded GGUF embedder", base_url: "http://localhost:1234/v1", model: "nomic-embed-text", dims: 768, threshold: 0.3, local: true, dummyKey: "lm-studio", keyNote: "no key needed" },
  { key: "cohere", label: "Cohere · embed-v4 (Custom / compat)", base_url: "https://api.cohere.ai/compatibility/v1", model: "embed-v4.0", dims: 1536, threshold: 0.3, local: false, keyNote: "uses your Cohere key · compat mode" },
  { key: "jina", label: "Jina · jina-embeddings-v3", base_url: "https://api.jina.ai/v1", model: "jina-embeddings-v3", dims: 1024, threshold: 0.3, local: false, keyNote: "uses your Jina key" },
  { key: "mistral", label: "Mistral · mistral-embed", base_url: "https://api.mistral.ai/v1", model: "mistral-embed", dims: 1024, threshold: 0.3, local: false, keyNote: "uses your Mistral key" },
  { key: "custom", label: "Custom / OpenAI-compatible…", base_url: "", model: "", dims: 1536, threshold: 0.3, local: false, keyNote: "set base URL + key below" },
]

// Extraction presets — the SAME picker shape (D-09 reuse) for the metadata
// extraction model. Cloud LLMs + the two local servers; the local entries are
// what structurally close the BUG-260616-01 mis-route (route by stored provider,
// never name-inference).
//
// NOTE (SEED-088): the `model` below is only a sensible MODERN DEFAULT — the field
// stays editable so any served model id works today. These defaults are validated
// against live /models (2026-06-17) and exist in MODEL_CAPABILITIES. They are NOT a
// closed roster: the dynamic model registry (SEED-088, next phase) will replace
// these hardcoded defaults by sourcing the full per-provider model list live from
// each provider's /models (the same provider.models the chat picker already reads),
// so new models — and the full Anthropic Haiku/Opus/Sonnet set — appear with zero
// code change. Until then, type any other model id into the editable field.
export const EXTRACTION_PRESETS: ProviderPreset[] = [
  { key: "openai", label: "OpenAI · gpt-5.4-mini", base_url: "https://api.openai.com/v1", model: "gpt-5.4-mini", dims: 0, threshold: 0, local: false, keyNote: "uses your OpenAI key" },
  { key: "anthropic", label: "Anthropic · claude-sonnet-4-6", base_url: "https://api.anthropic.com/v1", model: "claude-sonnet-4-6", dims: 0, threshold: 0, local: false, keyNote: "uses your Anthropic key" },
  // verify-work 111.1 (2026-06-17): Google preset REMOVED for now — every Gemini model
  // (2.5-flash/-pro/-lite, 3-flash-preview, 3.5-flash) returns `model_failed_to_emit` via
  // the forced-emit path on BOTH the cross-provider OpenAI-compat route AND the native
  // adapter (Gemini won't commit the forced tool call for the optional-heavy emit schema).
  // Listing it would silently yield ZERO metadata — the exact trap 111.1 is closing. Still
  // reachable via Custom. Re-add when the forced-emit / COERCE-fallback fix lands (SEED-088).
  { key: "ollama", label: "Ollama (local) · qwen3:8b", base_url: "http://localhost:11434/v1", model: "qwen3:8b", dims: 0, threshold: 0, local: true, dummyKey: "ollama", keyNote: "no key needed" },
  { key: "lmstudio", label: "LM Studio (local) · loaded GGUF model", base_url: "http://localhost:1234/v1", model: "gemma-4-12b-qat", dims: 0, threshold: 0, local: true, dummyKey: "lm-studio", keyNote: "no key needed" },
  { key: "custom", label: "Custom / OpenAI-compatible…", base_url: "", model: "", dims: 0, threshold: 0, local: false, keyNote: "set base URL + key below" },
]

export interface ProviderPickerValue {
  provider: string       // the preset key (stored provider — routes by this, D-09)
  model: string
  base_url: string
  api_key: string        // "" = not set, "***" = saved (masked), real = new value
  dimensions: number     // embedding only; ignored when showDimensions=false
  threshold: number      // embedding only; recommended default that travels (D-11)
}

interface ProviderPickerProps {
  /** Which preset table to drive — embedding or extraction (the SAME component). */
  presets: ProviderPreset[]
  value: ProviderPickerValue
  onChange: (next: ProviderPickerValue) => void
  /** Embedding shows dims + threshold in the footer + advanced; extraction does not. */
  showDimensions?: boolean
  /** Section heading + sub-copy, so one component serves both surfaces. */
  title: string
  description: string
  /** A small "same picker" reuse chip on the extraction instance. */
  reuseChip?: boolean
}

// Resolve the operator-entered base_url to its host for the footer line. LM
// Studio / Ollama base_urls already end in /v1 — shown AS-IS (never appended).
function footerEndpoint(base_url: string): string {
  if (!base_url) return "— set a base URL —"
  return base_url
}

export function ProviderPicker({
  presets,
  value,
  onChange,
  showDimensions = false,
  title,
  description,
  reuseChip = false,
}: ProviderPickerProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // Which preset is currently selected? Match on provider key; the picker stores
  // the preset KEY as the provider so the backend routes by it (D-09), never by
  // inferring from the model name.
  const selectedKey = presets.some((p) => p.key === value.provider) ? value.provider : "custom"
  const selected = presets.find((p) => p.key === selectedKey)
  const isLocal = selected?.local ?? false

  function applyPreset(key: string) {
    const p = presets.find((pp) => pp.key === key)
    if (!p) return
    // Custom keeps whatever the operator already typed (only switches provider).
    if (p.key === "custom") {
      onChange({ ...value, provider: "custom" })
      setAdvancedOpen(true)
      return
    }
    onChange({
      provider: p.key,
      model: p.model,
      base_url: p.base_url,
      // Local presets relax the key to the dummy (Ollama `ollama` / LM Studio
      // `lm-studio`); cloud presets keep the saved key sentinel so we never
      // clobber a real key with a placeholder.
      api_key: p.local ? (p.dummyKey ?? "") : value.api_key,
      dimensions: showDimensions ? p.dims : value.dimensions,
      threshold: showDimensions ? p.threshold : value.threshold,
    })
  }

  // The always-on footer text (endpoint · dims · threshold · key note).
  const footerParts = [footerEndpoint(value.base_url)]
  if (showDimensions) {
    footerParts.push(`${value.dimensions} dims`)
    footerParts.push(`threshold ${value.threshold.toFixed(2)}`)
  }
  footerParts.push(selected?.keyNote ?? (isLocal ? "no key needed" : "uses provider key"))

  const isMasked = value.api_key === KEY_PLACEHOLDER

  return (
    <div className="bg-card/40 rounded-md px-4 py-3 space-y-3">
      {/* Section heading + reuse chip */}
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground font-headline">{title}</h4>
          {reuseChip && (
            <span className="text-[10px] font-mono uppercase tracking-wide text-primary bg-primary/10 ghost-border rounded-full px-2 py-0.5">
              same picker
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      {/* Provider preset <select> — generalized from the rerank pattern */}
      <div>
        <Label className="text-xs font-semibold text-foreground mb-1.5 block">Provider preset</Label>
        <select
          value={selectedKey}
          onChange={(e) => applyPreset(e.target.value)}
          className="h-8 w-full text-sm rounded-md bg-muted/30 ghost-border px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {presets.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Each preset auto-fills the endpoint, a strong default model
          {showDimensions ? ", recommended dimensions + retrieval threshold." : "."}
        </p>
      </div>

      {/* ALWAYS-ON 🔒 endpoint footer (sketch 024 winner) — where-it-runs is
          never a click away. The legible half of the BUG-260616-01 cure. */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 ghost-border",
          isLocal ? "bg-success/10 border-success/30" : "bg-primary/10",
        )}
      >
        <Lock className={cn("h-3.5 w-3.5 shrink-0", isLocal ? "text-success" : "text-primary")} />
        <span className="text-xs font-mono text-foreground/90 truncate" title={footerParts.join(" · ")}>
          {footerParts.join(" · ")}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
            isLocal ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
          )}
        >
          {isLocal ? "local" : "cloud"}
        </span>
      </div>

      {/* Advanced overrides — the picker auto-fills these; they STAY editable. */}
      <div className="border-t border-dashed border-border/60 pt-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
          Advanced overrides
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-2.5 animate-[fadeSlideUp_0.3s_ease-out]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Model ID</Label>
                <Input
                  value={value.model}
                  onChange={(e) => onChange({ ...value, model: e.target.value })}
                  placeholder="model id"
                  className="h-8 text-xs font-mono bg-muted/30 ghost-border"
                />
              </div>
              {showDimensions && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Dimensions</Label>
                  <Input
                    type="number"
                    value={value.dimensions}
                    onChange={(e) => onChange({ ...value, dimensions: Number(e.target.value) })}
                    min={64}
                    max={4096}
                    className="h-8 text-xs font-mono bg-muted/30 ghost-border"
                  />
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Flexible — never down-truncated.</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Base URL</Label>
              <Input
                value={value.base_url}
                onChange={(e) => onChange({ ...value, base_url: e.target.value })}
                placeholder="https://… or http://localhost:11434/v1"
                className="h-8 text-xs font-mono bg-muted/30 ghost-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">API key</Label>
                <div className="relative flex items-center">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={isMasked ? "" : value.api_key}
                    placeholder={isMasked ? "Key saved — enter new key to replace" : isLocal ? "dummy key (local)" : "Enter API key…"}
                    onChange={(e) => onChange({ ...value, api_key: e.target.value || "" })}
                    className="h-8 text-xs font-mono bg-muted/30 ghost-border pr-8"
                  />
                  {!isMasked && (
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {showDimensions && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Retrieval threshold</Label>
                  <Input
                    type="number"
                    value={value.threshold}
                    onChange={(e) => onChange({ ...value, threshold: Number(e.target.value) })}
                    min={0}
                    max={1}
                    step={0.05}
                    className="h-8 text-xs font-mono bg-muted/30 ghost-border"
                  />
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Travels with the preset.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
