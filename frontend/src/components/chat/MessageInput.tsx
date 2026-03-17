import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ChevronDown, Cpu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Props {
  onSend: (content: string) => void
  disabled: boolean
  models?: string[]
  selectedModel?: string
  onModelChange?: (model: string) => void
}

export function MessageInput({ onSend, disabled, models = [], selectedModel, onModelChange }: Props) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    // Reset height
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
  const showModelSelector = models.length > 1 && selectedModel && onModelChange

  // Shorten long model names for display
  const displayName = (model: string) => {
    if (model.length <= 32) return model
    return model.slice(0, 30) + "…"
  }

  return (
    <div className="border-t bg-background px-6 py-4">
      <div
        className={cn(
          "rounded-xl border bg-background shadow-sm transition-shadow",
          "focus-within:ring-2 focus-within:ring-ring focus-within:shadow-md",
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
            className="w-full resize-none overflow-hidden min-h-[36px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          {/* Left: model selector */}
          <div className="flex items-center">
            {showModelSelector ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                      "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Cpu className="h-3 w-3 shrink-0" />
                    <span>{displayName(selectedModel!)}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="min-w-[200px] mb-1">
                  {models.map((m) => (
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
                        <span className="ml-auto text-[10px] text-muted-foreground">active</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              selectedModel && (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground/60">
                  <Cpu className="h-3 w-3" />
                  {displayName(selectedModel)}
                </span>
              )
            )}
          </div>

          {/* Right: send button + hint */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 hidden sm:block">
              Enter to send · Shift+Enter for newline
            </span>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
