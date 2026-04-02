import { Zap } from "lucide-react"

interface Props {
  onTryInChat?: (skillName: string) => void
}

export function SkillsPage({ onTryInChat: _onTryInChat }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-headline font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Skills
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Define reusable AI behaviors that the agent loads on demand.
        </p>
      </div>
      <p className="text-muted-foreground text-sm">Skills page coming soon...</p>
    </div>
  )
}
