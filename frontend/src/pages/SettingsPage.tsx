import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSettings, type FullAppSettings } from "@/lib/api"

function ReadOnlyValue({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{String(value)}</span>
    </div>
  )
}

function EnvBadge() {
  return (
    <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      System default (.env)
    </span>
  )
}

export function SettingsPage() {
  const [s, setS] = useState<FullAppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then(setS)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !s) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error ?? "Failed to load settings"}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            All settings are configured via{" "}
            <code className="text-xs bg-muted px-1 rounded">.env</code>. UI-based configuration will be added in a future module.
          </p>
        </div>

        {/* ── LLM ───────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">LLM</CardTitle>
                <CardDescription>Language model used for chat completions.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Model" value={s.llm_model} />
              <ReadOnlyValue label="Available models" value={s.available_models.join(", ") || "—"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Embedding ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Embedding</CardTitle>
                <CardDescription>Model used to embed documents and queries.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Model" value={s.embedding_model} />
              <ReadOnlyValue label="Dimensions" value={s.embedding_dimensions} />
              {s.embedding_base_url && <ReadOnlyValue label="Base URL" value={s.embedding_base_url} />}
              <ReadOnlyValue label="API Key" value={s.embedding_has_api_key ? "Saved" : "Using LLM key fallback"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Reranking ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Reranking</CardTitle>
                <CardDescription>Re-score retrieved chunks with a cross-encoder.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Enabled" value={s.rerank_enabled} />
              <ReadOnlyValue label="Provider" value={s.rerank_provider} />
              <ReadOnlyValue label="Model" value={s.rerank_model} />
              <ReadOnlyValue label="Top-N" value={s.rerank_top_n} />
              <ReadOnlyValue label="API Key" value={s.rerank_has_api_key ? "Saved" : "Not set"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Retrieval ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Retrieval</CardTitle>
                <CardDescription>Controls chunk retrieval and hybrid search weights.</CardDescription>
              </div>
              <EnvBadge />
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <ReadOnlyValue label="Top-K" value={s.retrieval_top_k} />
              <ReadOnlyValue label="Match threshold" value={s.retrieval_match_threshold} />
              <ReadOnlyValue label="Hybrid search" value={s.hybrid_search_enabled} />
              {s.hybrid_search_enabled && (
                <>
                  <ReadOnlyValue label="Candidate count" value={s.hybrid_candidate_count} />
                  <ReadOnlyValue label="Vector weight" value={s.vector_search_weight} />
                  <ReadOnlyValue label="Keyword weight" value={s.keyword_search_weight} />
                  <ReadOnlyValue label="RRF-K" value={s.rrf_k} />
                </>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
