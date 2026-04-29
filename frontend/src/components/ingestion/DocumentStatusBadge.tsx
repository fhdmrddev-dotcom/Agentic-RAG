import { cn } from "@/lib/utils"

interface Props {
  status: "pending" | "processing" | "completed" | "failed"
  /** Phase 56 D-13: granular sub-status; only consulted while status='processing'. */
  ingestionStep?: string | null
}

const styles: Record<Props["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
}

function ingestionStepLabel(step: string | null | undefined): string {
  if (step === "extracting") return "Extracting"
  if (step === "chunking") return "Chunking"
  if (step === "embedding") return "Embedding"
  if (step === "metadata") return "Extracting metadata"
  return "processing"
}

export function DocumentStatusBadge({ status, ingestionStep }: Props) {
  const label = status === "processing" ? ingestionStepLabel(ingestionStep) : status
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {status === "processing" && (
        <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
      )}
      {label}
    </span>
  )
}
