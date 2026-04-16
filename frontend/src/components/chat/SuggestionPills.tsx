interface Props {
  questions: string[]
  onSelect: (question: string) => void
}

export function SuggestionPills({ questions, onSelect }: Props) {
  if (!questions.length) return null
  const visible = questions.slice(0, 3)
  return (
    <div className="mt-3 animate-fadeSlideUp">
      <p className="text-xs text-muted-foreground mb-2">Follow-up:</p>
      <div className="flex flex-wrap gap-2">
        {visible.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(q)}
            className="text-xs px-3 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border/50 text-foreground/80 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
