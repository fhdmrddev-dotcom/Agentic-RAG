import { FileText, TrendingUp, AlertTriangle, PackageOpen } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface Props {
  totalDocuments: number
  retrievedCount: number
  flaggedCount: number
  unusedCount: number
}

interface StatCard {
  label: string
  value: number
  icon: React.ElementType
  iconClass: string
  valueClass: string
  description: string
}

export function HealthStatBar({ totalDocuments, retrievedCount, flaggedCount, unusedCount }: Props) {
  const cards: StatCard[] = [
    {
      label: "Library Size",
      value: totalDocuments,
      icon: FileText,
      iconClass: "text-muted-foreground",
      valueClass: "text-foreground",
      description: "total documents",
    },
    {
      label: "Active This Month",
      value: retrievedCount,
      icon: TrendingUp,
      iconClass: "text-primary",
      valueClass: "text-primary",
      description: "retrieved in 30 days",
    },
    {
      label: "Needs Attention",
      value: flaggedCount,
      icon: AlertTriangle,
      iconClass: flaggedCount > 0 ? "text-amber-400" : "text-muted-foreground",
      valueClass: flaggedCount > 0 ? "text-amber-400" : "text-foreground",
      description: "low confidence or stale",
    },
    {
      label: "Never Used",
      value: unusedCount,
      icon: PackageOpen,
      iconClass: unusedCount > 0 ? "text-orange-400" : "text-muted-foreground",
      valueClass: unusedCount > 0 ? "text-orange-400" : "text-foreground",
      description: "never retrieved",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="card-interactive relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-2 shadow-sm"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              <div className="p-1.5 rounded-md bg-muted/30 border border-border/30">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${card.iconClass}`} />
              </div>
            </div>
            <span className={`text-3xl font-bold font-headline tabular-nums leading-none tracking-tight ${card.valueClass}`}>
              <AnimatedNumber value={card.value} />
            </span>
            <span className="text-xs text-muted-foreground">{card.description}</span>
          </div>
        )
      })}
    </div>
  )
}
