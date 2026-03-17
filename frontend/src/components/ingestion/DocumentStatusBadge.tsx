import { cn } from "@/lib/utils"

interface Props {
  status: "pending" | "processing" | "completed" | "failed"
}

const styles: Record<Props["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
}

export function DocumentStatusBadge({ status }: Props) {
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
      {status}
    </span>
  )
}
