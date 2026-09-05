import { useEffect, useRef, useState } from "react"
import { FileText, TrendingUp, AlertTriangle, PackageOpen } from "lucide-react"

function AnimatedNumber({ value, duration = 300 }: { value: number | string; duration?: number }) {
  const isTest =
    (typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.MODE === "test")
  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (isTest || prefersReduced) {
    return <>{value}</>
  }

  return <AnimatedNumberInner value={value} duration={duration} />
}

function AnimatedNumberInner({ value, duration }: { value: number | string; duration: number }) {
  const hasAnimatedRef = useRef(false)
  const [display, setDisplay] = useState<number | string>(value)

  useEffect(() => {
    if (hasAnimatedRef.current) {
      setDisplay(value)
      return
    }

    const cleanStr = String(value).replace(/,/g, "")
    const match = cleanStr.match(/^([^0-9.-]*)([0-9]+(?:\.[0-9]+)?)(.*)$/)
    if (!match) {
      setDisplay(value)
      return
    }

    const prefix = match[1]
    const targetNum = parseFloat(match[2])
    const suffix = match[3]
    const hasCommas = String(value).includes(",")

    hasAnimatedRef.current = true

    const startNum = 0
    const startTime = performance.now()
    let rafId: number

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startNum + (targetNum - startNum) * ease)
      const formattedNum = hasCommas ? current.toLocaleString() : current.toString()
      setDisplay(`${prefix}${formattedNum}${suffix}`)

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        setDisplay(value)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration])

  return <>{display}</>
}

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
