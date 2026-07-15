import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Brain, Loader2, Pencil, Trash2, Check, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface MemoryEntry {
  id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}

export function MemorySection() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  // Phase 155 (A11Y-01): focus the edit field via ref when a row opens for editing,
  // instead of the declarative `autoFocus` prop (jsx-a11y/no-autofocus) — same UX.
  const editInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editingKey) editInputRef.current?.focus()
  }, [editingKey])
  const [deleteTarget, setDeleteTarget] = useState<MemoryEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Load entries on mount
  useEffect(() => {
    setLoading(true)
    setError(null)
    supabase
      .from("user_memory")
      .select("id, key, value, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setEntries(data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Auto-dismiss action errors after 4 seconds
  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(null), 4000)
    return () => clearTimeout(t)
  }, [actionError])

  function startEdit(entry: MemoryEntry) {
    setEditingKey(entry.key)
    setEditValue(entry.value)
  }

  function cancelEdit() {
    setEditingKey(null)
  }

  async function saveEdit() {
    if (!editValue.trim() || !editingKey) return
    setSaving(true)
    const { error: err } = await supabase
      .from("user_memory")
      .update({ value: editValue.trim() })
      .eq("key", editingKey)
    if (err) {
      setActionError(err.message)
    } else {
      const now = new Date().toISOString()
      setEntries((prev) =>
        prev.map((e) =>
          e.key === editingKey ? { ...e, value: editValue.trim(), updated_at: now } : e
        )
      )
      setEditingKey(null)
    }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: err } = await supabase
      .from("user_memory")
      .delete()
      .eq("key", deleteTarget.key)
    if (err) {
      setActionError(err.message)
    } else {
      setEntries((prev) => prev.filter((e) => e.key !== deleteTarget.key))
    }
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <>
      <Card className="ghost-border bg-card/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-headline font-bold">Memory</CardTitle>
          <CardDescription>
            Facts and preferences the agent remembers about you across conversations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Action error banner */}
          {actionError && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg mb-4">
              {actionError}
            </p>
          )}

          {/* Error state */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
              Failed to load memories. Refresh to try again.
            </p>
          )}

          {/* Loading state */}
          {!error && loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!error && !loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Brain className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No memories stored yet. The agent will remember facts and preferences you tell it
                during conversations.
              </p>
            </div>
          )}

          {/* Entry list */}
          {!error && !loading && entries.length > 0 && (
            <div className="divide-y divide-border/30">
              {entries.map((entry) => (
                <div key={entry.id} className="group flex items-center gap-3 py-3">
                  {/* Key chip */}
                  <span className="font-mono text-xs bg-muted/30 px-2 py-1 rounded ghost-border shrink-0">
                    {entry.key}
                  </span>

                  {/* Value — display or edit */}
                  <div className="flex-1 min-w-0">
                    {editingKey === entry.key ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          aria-label={`Edit value for ${entry.key}`}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-transparent border-b border-primary/40 focus:outline-none px-1 py-0.5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editValue.trim()) saveEdit()
                            if (e.key === "Escape") cancelEdit()
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-primary"
                          onClick={saveEdit}
                          disabled={!editValue.trim() || saving}
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm truncate block">{entry.value}</span>
                    )}
                  </div>

                  {/* Created date */}
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>

                  {/* Action icons — visible on hover */}
                  {editingKey !== entry.key && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(entry)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete memory entry?</DialogTitle>
            <DialogDescription>
              This will permanently remove the memory for key{" "}
              <span className="font-mono font-medium text-foreground">{deleteTarget?.key}</span>.
              The agent won't recall it in future conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
