import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

interface Props {
  onSend: (content: string) => void
  disabled: boolean
}

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t bg-background px-4 py-4">
      <div className="max-w-2xl mx-auto flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="resize-none overflow-hidden min-h-[40px]"
        />
        <Button onClick={handleSend} disabled={disabled || !value.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
