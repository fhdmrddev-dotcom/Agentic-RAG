import { CheckCircle2, type LucideIcon } from "lucide-react"

interface Props {
  icon?: LucideIcon
  heading: string
  body: string
  variant?: "positive" | "neutral"
}

export function HealthEmptyState({ icon: Icon, heading, body, variant = "positive" }: Props) {
  const isPositive = variant === "positive"

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      {isPositive ? (
        <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-3 opacity-80" />
      ) : Icon ? (
        <Icon className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
      ) : null}
      <p className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-muted-foreground"}`}>
        {heading}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{body}</p>
    </div>
  )
}
