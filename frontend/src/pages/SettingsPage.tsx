import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"
import { getSettings, updateEmbeddingModel, type AppSettings } from "@/lib/api"

export function SettingsPage() {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [embeddingInput, setEmbeddingInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSettings()
      .then((s) => {
        setAppSettings(s)
        setEmbeddingInput(s.embedding_model)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveEmbeddingModel() {
    if (!embeddingInput.trim()) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const updated = await updateEmbeddingModel(embeddingInput.trim())
      setAppSettings(updated)
      setEmbeddingInput(updated.embedding_model)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !appSettings) {
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
            View and configure your LLM and embedding model settings.
          </p>
        </div>

        {/* LLM Models */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">LLM Models</CardTitle>
            <CardDescription>
              Models available for chat. Use the model selector in each conversation to switch. Add
              models via the <code className="text-xs bg-muted px-1 py-0.5 rounded">AVAILABLE_MODELS</code> environment variable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-28 shrink-0">Default model</span>
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{appSettings.llm_model}</span>
            </div>
            {appSettings.available_models.length > 1 && (
              <div className="flex items-start gap-2">
                <span className="text-sm text-muted-foreground w-28 shrink-0 pt-1">Available</span>
                <div className="flex flex-wrap gap-2">
                  {appSettings.available_models.map((m) => (
                    <span
                      key={m}
                      className="text-xs font-mono bg-muted px-2 py-1 rounded border"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Embedding Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Embedding Model
              {appSettings.embedding_model_locked && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription>
              The model used to generate embeddings when ingesting documents.{" "}
              {appSettings.embedding_model_locked
                ? "Locked because you have uploaded documents — all chunks must use the same embedding space. Delete all documents to change this."
                : "You can change this before uploading any documents."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appSettings.embedding_model_locked ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded border text-muted-foreground">
                  {appSettings.embedding_model}
                </span>
                <span className="text-xs text-muted-foreground italic">Read-only</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={embeddingInput}
                    onChange={(e) => {
                      setEmbeddingInput(e.target.value)
                      setSaveSuccess(false)
                      setSaveError(null)
                    }}
                    placeholder="e.g. text-embedding-3-small"
                    className="max-w-sm font-mono text-sm"
                  />
                  <Button
                    onClick={() => { void handleSaveEmbeddingModel() }}
                    disabled={saving || !embeddingInput.trim() || embeddingInput.trim() === appSettings.embedding_model}
                    size="sm"
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="text-sm text-green-600">Embedding model updated.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
