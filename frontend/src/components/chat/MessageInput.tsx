import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ChevronDown, Compass, Cpu, Info, Layers, Square } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MODEL_INFO } from "@/lib/model-info"
import { cn } from "@/lib/utils"

interface Provider {
  id: string
  name: string
  models: string[]
  is_active: boolean
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
}: Props) {
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
    if (!trimmed || disabled) return
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

  const canSend = !disabled && value.trim().length > 0
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
              placeholder="Ask anything…"
              disabled={disabled}
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
                    <TooltipProvider>
                      {models.map((m) => {
                        const info = MODEL_INFO[m]
                        return (
                          <DropdownMenuItem
                            key={m}
                            onSelect={() => onModelChange!(m)}
                            className={cn(
                              "text-xs cursor-pointer gap-2",
                              m === selectedModel && "font-medium bg-accent",
                            )}
                          >
                            <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {m}
                            {m === selectedModel && (
                              <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
                            )}
                            {info && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info
                                    className="h-3 w-3 shrink-0 text-muted-foreground/50 hover:text-muted-foreground ml-1"
                                    aria-label="Model information"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[200px] text-xs space-y-1">
                                  <div><span className="font-bold">Context:</span> {info.contextWindow.toLocaleString()} tokens</div>
                                  <div><span className="font-bold">Max output:</span> {info.maxOutputTokens.toLocaleString()} tokens</div>
                                  <div><span className="font-bold">Best for:</span> {info.bestFor}</div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </DropdownMenuItem>
                        )
                      })}
                    </TooltipProvider>
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

              {/* Agent mode selector */}
              {onAgentModeChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        agentMode === "explorer" && "text-primary bg-primary/10",
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
                  className="h-8 w-8 rounded-lg shrink-0 transition-all border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  size="icon"
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
