import React, { useState } from "react"
import { X, DollarSign, Calendar, Info, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { repriceModel } from "@/lib/api/spend"

interface RepriceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialModelId?: string
  initialProvider?: string
}

export const RepriceModal: React.FC<RepriceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialModelId = "",
  initialProvider = "",
}) => {
  const [modelId, setModelId] = useState(initialModelId)
  const [provider, setProvider] = useState(initialProvider)
  const [inputCost, setInputCost] = useState("")
  const [outputCost, setOutputCost] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!modelId.trim()) {
      setError("Model ID is required.")
      return
    }

    const inVal = parseFloat(inputCost)
    const outVal = parseFloat(outputCost)

    if (isNaN(inVal) || inVal < 0) {
      setError("Input cost per million must be a non-negative number.")
      return
    }

    if (isNaN(outVal) || outVal < 0) {
      setError("Output cost per million must be a non-negative number.")
      return
    }

    setIsSubmitting(true)
    try {
      await repriceModel({
        model_id: modelId.trim(),
        provider: provider.trim() || null,
        input_cost_per_million: inputCost.trim(),
        output_cost_per_million: outputCost.trim(),
        effective_from: effectiveFrom.trim() ? new Date(effectiveFrom).toISOString() : null,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to register rate revision.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-400" />
              Reprice Model Rate
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Register a new effective-dated rate sheet in <code className="text-foreground">model_rates</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Append-Only Disclaimer */}
        <div className="my-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300 flex items-start gap-2.5 leading-relaxed">
          <Info className="h-4 w-4 flex-none mt-0.5 text-indigo-400" />
          <span>
            <strong>Append-Only Invariant:</strong> Repricing is strictly append-only. Completed runs remain priced at their original rates. Runs completed after this timestamp will price against this new rate.
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Model Identifier *
              </label>
              <input
                type="text"
                placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                required
                className="w-full text-xs rounded-lg px-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Provider (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. openai, anthropic"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full text-xs rounded-lg px-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Input Cost / 1M Tokens (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="2.500000"
                  value={inputCost}
                  onChange={(e) => setInputCost(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg pl-7 pr-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Output Cost / 1M Tokens (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="10.000000"
                  value={outputCost}
                  onChange={(e) => setOutputCost(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg pl-7 pr-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Effective From (Optional, defaults to now)
            </label>
            <input
              type="datetime-local"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full text-xs rounded-lg px-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-foreground"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              {isSubmitting ? "Registering Rate..." : "Save Rate Revision"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
