import type { LucideIcon } from "lucide-react"

interface Props {
  icon: LucideIcon
  heading: string
  body: string
}

export function HealthEmptyState({ icon: Icon, heading, body }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <Icon className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
      <p className="text-sm font-medium text-muted-foreground">{heading}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{body}</p>
    </div>
  )
}
