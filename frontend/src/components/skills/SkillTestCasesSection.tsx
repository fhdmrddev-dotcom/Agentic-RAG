// ─────────────────────────────────────────────────────────────────────────────
// Phase 132 Plan 03 (EVAL-01 / VER-01) — THIN test-case editor + read-only
// version-history list.
//
// DELIBERATELY NON-DESIGNED / FUNCTIONAL-ONLY (--skip-ui, operator scope fence).
// This is the 132 persistence FOUNDATION made usable end-to-end; it must NOT
// introduce designed structure (no panel chrome, no tabs, no new design-system
// primitives beyond Input/Textarea/Button) that would pre-empt or constrain the
// Phase 137 sketch-gated Skill Evals panel (PANEL-01, G-2). Phase 137 SUPERSEDES
// this surface — keep it plain on purpose.
//
// Owner-scoping is enforced SERVER-SIDE on every route (Plan 02 `.eq("user_id")`);
// this client only renders what the owner-scoped API returns.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  listSkillVersions,
} from "@/lib/api"
import type { TestCase, SkillVersion } from "@/types"

interface Props {
  skillId: string
}

export function SkillTestCasesSection({ skillId }: Props) {
  const [cases, setCases] = useState<TestCase[]>([])
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Local edit buffers keyed by case id so inline edits don't refetch on each keystroke.
  const [edits, setEdits] = useState<Record<string, { prompt: string; expected_behavior: string }>>({})

  async function reload() {
    setError(null)
    try {
      const [c, v] = await Promise.all([listTestCases(skillId), listSkillVersions(skillId)])
      setCases(c)
      setVersions(v)
      setEdits(
        Object.fromEntries(
          c.map((tc) => [tc.id, { prompt: tc.prompt, expected_behavior: tc.expected_behavior }]),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test cases.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId])

  async function handleAdd() {
    setBusy(true)
    setError(null)
    try {
      await createTestCase(skillId, { prompt: "", expected_behavior: "", order_index: cases.length })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add test case.")
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(id: string) {
    const buf = edits[id]
    if (!buf) return
    setBusy(true)
    setError(null)
    try {
      await updateTestCase(id, { prompt: buf.prompt, expected_behavior: buf.expected_behavior })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save test case.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteTestCase(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete test case.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading test cases…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Test cases (add / edit / delete) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Eval test cases</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={handleAdd}
            disabled={busy}
          >
            <Plus className="h-3 w-3" />
            Add test case
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {cases.length === 0 ? (
          <p className="text-xs text-muted-foreground">No test cases yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cases.map((tc) => {
              const buf = edits[tc.id] ?? { prompt: tc.prompt, expected_behavior: tc.expected_behavior }
              const dirty = buf.prompt !== tc.prompt || buf.expected_behavior !== tc.expected_behavior
              return (
                <li key={tc.id} className="flex flex-col gap-2 rounded border border-border/30 p-3">
                  <Input
                    value={buf.prompt}
                    placeholder="Prompt"
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [tc.id]: { ...buf, prompt: e.target.value } }))
                    }
                  />
                  <Textarea
                    value={buf.expected_behavior}
                    placeholder="Expected behavior"
                    rows={2}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [tc.id]: { ...buf, expected_behavior: e.target.value },
                      }))
                    }
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSave(tc.id)}
                      disabled={busy || !dirty}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      onClick={() => handleDelete(tc.id)}
                      disabled={busy}
                      aria-label="Delete test case"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Version history (read-only, newest first) */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Version history</label>
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {versions.map((v) => (
              <li key={v.id} className="text-xs text-muted-foreground">
                v{v.version_number} · {v.source} · {new Date(v.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
