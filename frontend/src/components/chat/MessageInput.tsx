import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ChevronDown, Compass, Cpu, HardDrive, Layers, Plus } from "lucide-react"
// Phase 194.1 Plan 04 (RUN-01 / R1) — the composer's Stop is now the ONE shared
// `StopControl` every mount renders. The lucide `Square` moved WITH it (it is
// still the Stop control's mark on every variant, D-18); it is dropped from this
// import because this file no longer draws the control itself.
import { StopControl } from "./StopControl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MODEL_INFO } from "@/lib/model-info"
import { providerLogo, modelLogo } from "@/lib/providerLogo"
import { cn } from "@/lib/utils"
// Phase 154 (LANG-01 / D-03) — General/Explorer keep their already-plain labels
// (routed through the single-source term-map so nothing drifts) and gain a one-line
// helper. Additive DISPLAY strings only — no render-flow / stream logic; the
// "default"/"explorer" enum + MessageItem.tsx / StreamsProvider.tsx stay untouched (G-5).
import { TERM_MAP, usePlainLabel } from "@/lib/termMap"
import { ConnectorsFlyout } from "./ConnectorsFlyout"
import { ActiveConnectorChips } from "./ActiveConnectorChips"
import { ConnectedFilePickerModal } from "./ConnectedFilePickerModal"
import { listConnectorConnections, type ConnectorConnection } from "@/lib/api"

interface Provider {
  id: string
  name: string
  models: string[]
  is_active: boolean
}

interface Props {
  onSend: (content: string, activeConnectorIds?: string[]) => void
  disabled: boolean
  threadId?: string | null
  providers?: Provider[]
  selectedProvider?: string
  onProviderChange?: (providerId: string) => void
  models?: string[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  deprecatedModels?: Set<string>
  agentMode?: "default" | "explorer"
  onAgentModeChange?: (mode: "default" | "explorer") => void
  prefillMessage?: string | null
  onClearPrefill?: () => void
  /** Take the person to the connections surface — see `ConnectorsFlyout`. */
  onOpenConnections?: () => void
  workflowLocked?: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  openrouter: "OpenRouter",
  ollama: "Ollama",
}

// Per-thread unsent composer drafts (session-scoped, Slack-style). Keyed by
// thread id; the pre-creation "new chat" composer uses NEW_CHAT_DRAFT_KEY.
// Module-level on purpose: survives MessageInput re-renders and thread
// navigation without persisting anything.
const NEW_CHAT_DRAFT_KEY = "__new__"
const composerDraftsByThread = new Map<string, string>()

/** Test-only: reset the module-scoped draft map between test cases. */
export function _resetComposerDraftsForTest() {
  composerDraftsByThread.clear()
}

export function MessageInput({
  onSend,
  disabled,
  threadId,
  providers = [],
  selectedProvider,
  onProviderChange,
  models = [],
  selectedModel,
  onModelChange,
  deprecatedModels,
  agentMode = "default",
  onAgentModeChange,
  prefillMessage,
  onClearPrefill,
  onOpenConnections,
  workflowLocked = false,
}: Props) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Phase 216 (CHAT-05 / CHAT-06): active connectors per thread
  const [connections, setConnections] = useState<ConnectorConnection[]>([])
  const [activeConnectorIds, setActiveConnectorIds] = useState<string[]>([])
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    listConnectorConnections()
      .then((conns) => {
        if (!cancelled) setConnections(conns.filter((c) => c.is_enabled !== false))
      })
      .catch((err) => console.error("Failed to load connections", err))
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggleConnector = useCallback((id: string) => {
    setActiveConnectorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }, [])

  const handleRemoveConnector = useCallback((id: string) => {
    setActiveConnectorIds((prev) => prev.filter((item) => item !== id))
  }, [])

  // Per-thread drafts: on thread switch, stash the outgoing thread's unsent
  // text and restore the incoming thread's stash (or empty). First mount is a
  // no-op (prevDraftKeyRef seeds to the current key). valueRef mirrors `value`
  // so the switch effect reads the LATEST text, not a stale closure.
  const draftKey = threadId ?? NEW_CHAT_DRAFT_KEY
  const prevDraftKeyRef = useRef(draftKey)
  const valueRef = useRef(value)
  valueRef.current = value
  useEffect(() => {
    const prevKey = prevDraftKeyRef.current
    if (prevKey === draftKey) return
    const outgoing = valueRef.current
    if (outgoing.trim()) composerDraftsByThread.set(prevKey, outgoing)
    else composerDraftsByThread.delete(prevKey)
    setValue(composerDraftsByThread.get(draftKey) ?? "")
    prevDraftKeyRef.current = draftKey
  }, [draftKey])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => {
    if (prefillMessage) {
      setValue(prefillMessage)
      onClearPrefill?.()
    }
  }, [prefillMessage, onClearPrefill])

  // Phase 154 (LANG-01 / D-03) — the mode labels sourced from the term-map (plain
  // by default; for these keys plain === technical, so the visible label is
  // unchanged). The one-line helper text lives on the same term-map rows.
  const generalLabel = usePlainLabel("agentmode.default")
  const explorerLabel = usePlainLabel("agentmode.explorer")

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || workflowLocked) return
    onSend(trimmed, activeConnectorIds.length > 0 ? activeConnectorIds : undefined)
    setValue("")
    // Per-thread drafts: a successful hand-off consumes the draft.
    composerDraftsByThread.delete(draftKey)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Phase 092 (092-06 / F3): Send is also gated on the per-thread workflow lock.
  const canSend = !disabled && !workflowLocked && value.trim().length > 0
  const showProviderSelector = providers.length > 1 && selectedProvider && onProviderChange
  const showModelSelector = models.length > 1 && selectedModel && onModelChange

  const displayName = (model: string) => {
    if (model.length <= 32) return model
    return model.slice(0, 30) + "…"
  }

  const activeProviderLabel = selectedProvider
    ? (PROVIDER_LABELS[selectedProvider] ?? selectedProvider)
    : null

  const SelectedProviderMark = providerLogo(selectedProvider)
  const SelectedModelMark = modelLogo(selectedModel) ?? providerLogo(selectedProvider)

  // Cloud storage connections check
  const hasCloudStorage = connections.some(
    (c) =>
      c.service_id.includes("google") ||
      c.service_id.includes("workspace") ||
      c.service_id.includes("drive") ||
      c.service_id.includes("onedrive"),
  )

  return (
    <div className="px-4 pb-3 bg-transparent">
      <div className="max-w-4xl mx-auto">
        <div
          className={cn(
            "rounded-2xl ghost-border bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 transition-all duration-200",
            "focus-within:ring-2 focus-within:ring-primary/30 focus-within:shadow-lg focus-within:shadow-primary/5",
          )}
        >
          {/* Active Connector Chips Bar */}
          <div className="px-3 pt-2">
            <ActiveConnectorChips
              connections={connections}
              activeConnectorIds={activeConnectorIds}
              onRemoveConnector={handleRemoveConnector}
            />
          </div>

          {/* Text area */}
          <div className="px-4 pt-1 pb-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={workflowLocked ? "Workflow running — Cancel to switch back" : "Ask anything…"}
              title={workflowLocked ? "Workflow running — Cancel to switch back" : undefined}
              disabled={disabled || workflowLocked}
              rows={1}
              className="w-full resize-none overflow-hidden min-h-[36px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Left: Plus menu + provider + model + agent mode */}
            <div className="flex items-center gap-1">
              {/* Plus Button Menu (Claude.ai style) */}
              <DropdownMenu open={plusMenuOpen} onOpenChange={setPlusMenuOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add content and tools"
                    data-testid="composer-plus-btn"
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground",
                      "hover:text-foreground hover:bg-muted/60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      plusMenuOpen && "bg-muted text-foreground",
                      activeConnectorIds.length > 0 && "text-primary",
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="p-0 border-border/80 shadow-xl overflow-hidden mb-1">
                  {hasCloudStorage && (
                    <div className="p-1 border-b border-border/50">
                      <DropdownMenuItem
                        onSelect={() => {
                          setPlusMenuOpen(false)
                          setFilePickerOpen(true)
                        }}
                        className="text-xs cursor-pointer gap-2 py-1.5"
                      >
                        <HardDrive className="h-4 w-4 text-primary" />
                        <span>Import from Cloud Storage...</span>
                      </DropdownMenuItem>
                    </div>
                  )}
                  <ConnectorsFlyout
                    activeConnectorIds={activeConnectorIds}
                    onToggleConnector={handleToggleConnector}
                    onClose={() => setPlusMenuOpen(false)}
                    onOpenConnections={onOpenConnections}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Provider selector */}
              {showProviderSelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {SelectedProviderMark ? (
                        <SelectedProviderMark size={14} />
                      ) : (
                        <Layers className="h-3 w-3 shrink-0" />
                      )}
                      <span>{activeProviderLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
                    {providers.map((p) => {
                      const PMark = providerLogo(p.id)
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => onProviderChange!(p.id)}
                          className={cn(
                            "text-xs cursor-pointer gap-2",
                            p.id === selectedProvider && "font-medium bg-accent",
                          )}
                        >
                          {PMark ? (
                            <PMark size={14} />
                          ) : (
                            <Layers className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          {PROVIDER_LABELS[p.id] ?? p.id}
                          {p.id === selectedProvider && (
                            <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : activeProviderLabel ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                  {SelectedProviderMark ? <SelectedProviderMark size={14} /> : <Layers className="h-3 w-3" />}
                  {activeProviderLabel}
                </span>
              ) : null}

              {/* Model selector */}
              {showModelSelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {SelectedModelMark ? (
                        <SelectedModelMark size={14} />
                      ) : (
                        <Cpu className="h-3 w-3 shrink-0" />
                      )}
                      <span>{displayName(selectedModel!)}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[200px] mb-1">
                    {models.map((m) => {
                      const info = MODEL_INFO[m]
                      const isDeprecated = deprecatedModels?.has(m) ?? false
                      // Phase 149 (D-149-17) + model-icons pass: the model's OWN
                      // family mark per row (Claude/Gemini/Llama/… — MORE specific than the
                      // provider mark, and it differentiates rows within one provider, e.g.
                      // OpenRouter), falling back to the provider mark, then the Cpu glyph.
                      // Capability info stays DEMOTED to the hover tooltip so the model name
                      // stays primary (the operator's "context info makes it not very good"
                      // cleanup — visual-only). Single-source @lobehub (ICON CONVENTION).
                      const ModelMark = modelLogo(m) ?? providerLogo(selectedProvider)
                      const capTooltip = info
                        ? `${(info.contextWindow / 1000).toFixed(0)}k context · ${info.maxOutputTokens.toLocaleString()} output · ${info.bestFor} · Cost tier: ${info.costTier === 'low' ? 'Low ($)' : info.costTier === 'mid' ? 'Mid ($$)' : 'High ($$$)'}`
                        : undefined
                      return (
                        <DropdownMenuItem
                          key={m}
                          onSelect={() => onModelChange!(m)}
                          title={capTooltip}
                          className={cn(
                            "text-xs cursor-pointer items-center gap-2 py-1.5",
                            m === selectedModel && "font-medium bg-accent",
                          )}
                        >
                          {ModelMark ? (
                            <ModelMark size={13} />
                          ) : (
                            <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{m}</span>
                          {isDeprecated && (
                            <span
                              className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border shrink-0"
                              title="This model is deprecated. It still works, but consider moving to a newer model."
                            >
                              deprecated
                            </span>
                          )}
                          {m === selectedModel && (
                            <span className="text-[10px] text-primary font-semibold shrink-0">active</span>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                selectedModel && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                    {SelectedModelMark ? <SelectedModelMark size={14} /> : <Cpu className="h-3 w-3" />}
                    {displayName(selectedModel)}
                  </span>
                )
              )}

              {/* Agent mode selector (General/Explorer) — D-03: disabled-with-
                  tooltip while workflow-locked (controlled by the active
                  workflow), NOT hidden (avoids the layout jump). */}
              {onAgentModeChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={workflowLocked}>
                    <button
                      disabled={workflowLocked}
                      title={
                        workflowLocked
                          ? "Controlled by the active workflow"
                          : undefined
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        agentMode === "explorer" && "text-primary bg-primary/10",
                        workflowLocked && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
                      )}
                      data-testid="agent-mode-selector"
                    >
                      <Compass className="h-3 w-3 shrink-0" />
                      <span>{agentMode === "explorer" ? "Explorer" : "General"}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
                    <DropdownMenuItem
                      onSelect={() => onAgentModeChange("default")}
                      className={cn("text-xs cursor-pointer gap-2 items-start", agentMode === "default" && "font-medium bg-accent")}
                    >
                      <Cpu className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span>{generalLabel}</span>
                          {agentMode === "default" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                        </div>
                        {/* Phase 154 — one-line plain helper off the term-map (additive). */}
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">{TERM_MAP["agentmode.default"].helper}</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onAgentModeChange("explorer")}
                      className={cn("text-xs cursor-pointer gap-2 items-start", agentMode === "explorer" && "font-medium bg-accent")}
                    >
                      <Compass className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span>{explorerLabel}</span>
                          {agentMode === "explorer" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                        </div>
                        {/* Phase 154 — one-line plain helper off the term-map (additive). */}
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">{TERM_MAP["agentmode.explorer"].helper}</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

            </div>

            {/* Right: stop (while streaming) or send button */}
            <div className="flex items-center gap-2.5">
              {!disabled && (
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  Enter ↵ · Shift+Enter for newline
                </span>
              )}
              {disabled ? (
                /* Phase 194.1 Plan 04 (RUN-01 / R1 + R2 / D-05) — the composer owns
                   NO Stop state and NO Stop dispatcher. `StopControl` reads the
                   StreamsProvider stopping slice and calls `stopThread(threadId)`
                   itself, which is Phase 194 D-08 (*four mounts, ONE mechanism*)
                   made structural on the DISPLAY half too, not only the runtime one.

                   ⚠ `threadId` is not a new prop: `Props` has declared it since
                   099-08 (per-thread drafts). And gating the control on it loses no
                   live case — `ChatArea.tsx` passes `disabled={isStreaming}` where
                   `isStreaming = useStreamingForThread(thread?.id ?? null)`, which is
                   `false` whenever there is no thread, so `disabled` true implies a
                   thread exists.

                   ⚠ D-22: this arm used to dispatch the removed prop → `stopStreaming`
                   → `actions.stopStream`, NOT `stopThread`. Routing it at `stopThread`
                   is behaviour-preserving — after plan 03 the two resolver bodies are
                   mirrors and `stopStream` resolves `activeThreadIdRef.current`, which
                   IS this composer's thread — and it retires the second resolver as a
                   consequence rather than as extra scope. */
                <StopControl threadId={threadId ?? null} variant="composer" />
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  size="icon"
                  aria-label="Send message"
                  data-testid="composer-send"
                  className={cn(
                    "h-8 w-8 rounded-lg shrink-0 transition-all",
                    canSend && "gradient-primary hover:opacity-90 shadow-sm shadow-primary/20",
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2.5">
          AI can make mistakes. Verify important information.
        </p>
      </div>

      <ConnectedFilePickerModal
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        connections={connections}
        onFileImported={(doc) => {
          setValue((prev) => (prev ? `${prev}\nAttached file: ${doc.filename}` : `Please analyze attached file: ${doc.filename}`))
        }}
      />
    </div>
  )
}
