import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ChevronDown, Compass, Cpu, Layers, Square, Sparkles, Workflow } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MODEL_INFO } from "@/lib/model-info"
import { cn } from "@/lib/utils"

interface Provider {
  id: string
  name: string
  models: string[]
  is_active: boolean
}

/** Phase 092 (MODE-01 / D-01) — a published workflow the Harness picker can start. */
interface WorkflowOption {
  id: string
  slug: string
  name: string
}

interface Props {
  onSend: (content: string) => void
  onStop?: () => void
  disabled: boolean
  providers?: Provider[]
  selectedProvider?: string
  onProviderChange?: (providerId: string) => void
  models?: string[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  agentMode?: "default" | "explorer"
  onAgentModeChange?: (mode: "default" | "explorer") => void
  prefillMessage?: string | null
  onClearPrefill?: () => void
  // ───────────────────────────────────────────────────────────────────────────
  // Phase 092 (MODE-01/02 — D-01/D-02/D-03/D-05) — dual-mode toggle + picker.
  // ───────────────────────────────────────────────────────────────────────────
  /** "deep" = the existing General/Explorer agent loop; "harness" reveals the
   *  workflow picker. Undefined = the toggle is hidden (back-compat). This is the
   *  LAUNCH-toggle state (the user's intent for the NEXT kickoff) — it drives the
   *  dropdown selection + the kickoff staging, NOT the displayed badge label. */
  workflowMode?: "deep" | "harness"
  onWorkflowModeChange?: (mode: "deep" | "harness") => void
  /** Phase 094 (D-02 — server truth): the DISPLAYED mode-pill label. Derived by
   *  the parent from `workflowLocked` (reconciled from `active_workflow_run_id`),
   *  NOT from the stale `workflowMode` launch toggle — this kills finding #5 (a
   *  running Harness workflow mislabeled "Deep"). Defaults to `workflowMode` when
   *  absent (back-compat). The dropdown items + kickoff staging keep reading
   *  `workflowMode`; only the badge TEXT reads this. */
  displayedMode?: "deep" | "harness"
  /** Published workflows the Harness picker lists (D-01). */
  publishedWorkflows?: WorkflowOption[]
  /** The staged workflow id — sent as workflow_definition_id on the next send (D-02). */
  selectedWorkflowId?: string | null
  onWorkflowSelect?: (workflowId: string) => void
  /** D-03/D-05 — true while this thread is workflow-locked. When true, BOTH the
   *  Deep/Harness toggle AND the General/Explorer selector are disabled-with-
   *  tooltip (NOT hidden — avoids the layout jump). Derived by the parent from
   *  useWorkflowLockForThread(owningThreadId) — never a global flag (SC#3). */
  workflowLocked?: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  openrouter: "OpenRouter",
  ollama: "Ollama",
}

export function MessageInput({
  onSend,
  onStop,
  disabled,
  providers = [],
  selectedProvider,
  onProviderChange,
  models = [],
  selectedModel,
  onModelChange,
  agentMode = "default",
  onAgentModeChange,
  prefillMessage,
  onClearPrefill,
  workflowMode = "deep",
  onWorkflowModeChange,
  displayedMode,
  publishedWorkflows = [],
  selectedWorkflowId,
  onWorkflowSelect,
  workflowLocked = false,
}: Props) {
  // Phase 094 (D-02): the DISPLAYED badge reads server truth. Back-compat: when
  // the parent passes no `displayedMode`, fall back to the launch toggle.
  const labelMode = displayedMode ?? workflowMode
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSend = () => {
    const trimmed = value.trim()
    // Phase 092 (092-06 / F3 — D-05): a locked thread cannot type/send. The
    // client disable is a COURTESY; the server 409 lock-refusal stays the
    // authority (StreamsProvider rolls back both optimistic bubbles on a 409).
    if (!trimmed || disabled || workflowLocked) return
    onSend(trimmed)
    setValue("")
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

  return (
    <div className="px-4 pb-3 bg-transparent">
      <div className="max-w-4xl mx-auto">
        <div
          className={cn(
            "rounded-2xl ghost-border bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 transition-all duration-200",
            "focus-within:ring-2 focus-within:ring-primary/30 focus-within:shadow-lg focus-within:shadow-primary/5",
          )}
        >
          {/* Text area */}
          <div className="px-4 pt-3 pb-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              // Phase 092 (092-06 / F3 — D-05): a locked thread shows the
              // "cancel to switch back" hint instead of the usual prompt.
              placeholder={workflowLocked ? "Workflow running — Cancel to switch back" : "Ask anything…"}
              title={workflowLocked ? "Workflow running — Cancel to switch back" : undefined}
              disabled={disabled || workflowLocked}
              rows={1}
              className="w-full resize-none overflow-hidden min-h-[36px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Left: provider + model + agent mode */}
            <div className="flex items-center gap-0.5">

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
                      <Layers className="h-3 w-3 shrink-0" />
                      <span>{activeProviderLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
                    {providers.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={() => onProviderChange!(p.id)}
                        className={cn(
                          "text-xs cursor-pointer gap-2",
                          p.id === selectedProvider && "font-medium bg-accent",
                        )}
                      >
                        <Layers className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {PROVIDER_LABELS[p.id] ?? p.id}
                        {p.id === selectedProvider && (
                          <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : activeProviderLabel ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/50">
                  <Layers className="h-3 w-3" />
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
                      <Cpu className="h-3 w-3 shrink-0" />
                      <span>{displayName(selectedModel!)}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[200px] mb-1">
                    {models.map((m) => {
                      const info = MODEL_INFO[m]
                      return (
                        <DropdownMenuItem
                          key={m}
                          onSelect={() => onModelChange!(m)}
                          className={cn(
                            "text-xs cursor-pointer items-start gap-2 py-2",
                            m === selectedModel && "font-medium bg-accent",
                          )}
                        >
                          <Cpu className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span>{m}</span>
                              {m === selectedModel && (
                                <span className="text-[10px] text-primary font-semibold">active</span>
                              )}
                            </div>
                            {info && (
                              <>
                                <span className="text-[10px] text-muted-foreground/60 font-normal truncate">
                                  {(info.contextWindow / 1000).toFixed(0)}k ctx · {info.maxOutputTokens.toLocaleString()} out · {info.bestFor}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 font-normal">
                                  <span className="font-medium">Cost tier:</span> {info.costTier === 'low' ? 'Low ($)' : info.costTier === 'mid' ? 'Mid ($$)' : 'High ($$$)'}
                                </span>
                              </>
                            )}
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                selectedModel && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/50">
                    <Cpu className="h-3 w-3" />
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
                      className={cn("text-xs cursor-pointer gap-2", agentMode === "default" && "font-medium bg-accent")}
                    >
                      <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                      General
                      {agentMode === "default" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onAgentModeChange("explorer")}
                      className={cn("text-xs cursor-pointer gap-2", agentMode === "explorer" && "font-medium bg-accent")}
                    >
                      <Compass className="h-3 w-3 shrink-0 text-muted-foreground" />
                      Explorer
                      {agentMode === "explorer" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Phase 092 (D-01/D-05): Deep/Harness toggle — sibling of the
                  agent-mode selector, same rounded-full idiom. Disabled-with-
                  tooltip while workflow-locked (Cancel to switch back), NOT
                  hidden (D-05). Harness = amber accent (paused/needs-you color
                  language); active iff a workflow run is/will be driven. */}
              {onWorkflowModeChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={workflowLocked}>
                    <button
                      disabled={workflowLocked}
                      title={
                        workflowLocked
                          ? "Workflow running — Cancel to switch back"
                          : undefined
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        workflowMode === "harness" && "text-amber-400 bg-amber-400/10",
                        workflowLocked && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
                      )}
                      data-testid="workflow-mode-selector"
                    >
                      <Workflow className="h-3 w-3 shrink-0" />
                      {/* Phase 094 (D-02): displayed label = server truth
                          (labelMode), NOT the stale workflowMode launch toggle.
                          The dropdown items below keep reading workflowMode. */}
                      <span>{labelMode === "harness" ? "Harness" : "Deep"}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[180px] mb-1">
                    <DropdownMenuItem
                      onSelect={() => onWorkflowModeChange("deep")}
                      className={cn("text-xs cursor-pointer gap-2", workflowMode === "deep" && "font-medium bg-accent")}
                    >
                      <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
                      Deep
                      {workflowMode === "deep" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onWorkflowModeChange("harness")}
                      className={cn("text-xs cursor-pointer gap-2", workflowMode === "harness" && "font-medium bg-accent")}
                    >
                      <Workflow className="h-3 w-3 shrink-0 text-muted-foreground" />
                      Harness
                      {workflowMode === "harness" && <span className="ml-auto text-[10px] text-amber-400 font-semibold">active</span>}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Phase 092 (D-01/D-02): published-workflow picker — only when
                  Harness is chosen and not locked. Selecting a workflow stages
                  its id; the next send carries workflow_definition_id (no auto-
                  start, no inputs form). */}
              {onWorkflowModeChange && workflowMode === "harness" && !workflowLocked && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selectedWorkflowId && "text-amber-400 bg-amber-400/10",
                      )}
                      data-testid="workflow-picker"
                    >
                      <Layers className="h-3 w-3 shrink-0" />
                      <span>
                        {publishedWorkflows.find((w) => w.id === selectedWorkflowId)?.name ??
                          "Pick workflow…"}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[220px] mb-1 max-h-[280px] overflow-y-auto">
                    {publishedWorkflows.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground/60">
                        No published workflows yet
                      </div>
                    ) : (
                      publishedWorkflows.map((w) => (
                        <DropdownMenuItem
                          key={w.id}
                          onSelect={() => onWorkflowSelect?.(w.id)}
                          className={cn(
                            "text-xs cursor-pointer gap-2",
                            w.id === selectedWorkflowId && "font-medium bg-accent",
                          )}
                          data-testid={`workflow-option-${w.slug}`}
                        >
                          <Workflow className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {w.name}
                          {w.id === selectedWorkflowId && (
                            <span className="ml-auto text-[10px] text-amber-400 font-semibold">picked</span>
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Right: stop (while streaming) or send button */}
            <div className="flex items-center gap-2.5">
              {!disabled && (
                <span className="text-[10px] text-muted-foreground/40 hidden sm:block">
                  Enter ↵ · Shift+Enter for newline
                </span>
              )}
              {disabled ? (
                <Button
                  onClick={onStop}
                  size="icon"
                  variant="outline"
                  aria-label="Stop generation"
                  data-testid="composer-stop"
                  className="h-8 w-8 rounded-lg shrink-0 transition-all border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
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

        <p className="text-[10px] text-muted-foreground/40 text-center mt-2.5">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}
