// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 05 Task 1 (PANEL-01 / D-11) — the prompt-first test-case editor.
//
// Lifts the SkillTestCasesSection CRUD (state / load / add / save / delete / per-tc
// edit buffers) MINUS the version-history list (that moved to VersionsTab in Plan
// 02). Re-skinned PROMPT-FIRST (D-11): a row leads with the prompt (truncated one-
// line at rest) with expected_behavior as a quiet second line, and the raw
// test_case_id uuid NEVER renders as a label (closes BUG-260701-02 "opaque Case
// <uuid8>"). Same createTestCase/updateTestCase/deleteTestCase calls — no schema
// change, no migration.
//
// CaseEditor is the SINGLE fetcher of the skill's test cases: it fires
// `onCasesChanged(cases)` with the FULL TestCase[] after its initial load AND after
// every add/edit/delete, so EvalsTab (Plan 05) owns that list as the one source for
// the LifecycleStepper case count AND the RunHistory casesById map. A skill-switch
// guard (currentSkillRef) drops a mutation that resolves after a skill change so it
// can never clobber the new skill's list.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
} from "@/lib/api"
import type { TestCase } from "@/types"

interface Props {
  skillId: string
  /** Lifts the full loaded list up to the container after load + every mutation. */
  onCasesChanged?: (cases: TestCase[]) => void
}

export function CaseEditor({ skillId, onCasesChanged }: Props) {
  const [cases, setCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The case currently open for inline editing (prompt-first rows are read-only at rest).
  const [editingId, setEditingId] = useState<string | null>(null)
  // Transient "Saved ✓" confirmation so a successful save reads as success.
  const [savedId, setSavedId] = useState<string | null>(null)
  // Local edit buffers keyed by case id so inline edits don't refetch per keystroke.
  const [edits, setEdits] = useState<
    Record<string, { prompt: string; expected_behavior: string }>
  >({})

  // The live active skill — an in-flight load/mutation captures the skill it was for
  // and bails before any setState if the active skill changed while it was pending.
  const currentSkillRef = useRef(skillId)

  async function reload() {
    const requestedSkill = skillId
    setError(null)
    try {
      const c = await listTestCases(skillId)
      if (currentSkillRef.current !== requestedSkill) return
      setCases(c)
      setEdits(
        Object.fromEntries(
          c.map((tc) => [tc.id, { prompt: tc.prompt, expected_behavior: tc.expected_behavior }]),
        ),
      )
      // Single-source lift: the container derives caseCount + casesById from this.
      onCasesChanged?.(c)
    } catch (err) {
      if (currentSkillRef.current !== requestedSkill) return
      setError(err instanceof Error ? err.message : "Failed to load test cases.")
    } finally {
      if (currentSkillRef.current === requestedSkill) setLoading(false)
    }
  }

  useEffect(() => {
    currentSkillRef.current = skillId
    setLoading(true)
    setEditingId(null)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId])

  async function handleAdd() {
    setBusy(true)
    setError(null)
    try {
      await createTestCase(skillId, {
        prompt: "",
        expected_behavior: "",
        order_index: cases.length,
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add test case.")
    } finally {
      setBusy(false)
    }
  }

  function startEdit(tc: TestCase) {
    setEdits((prev) => ({
      ...prev,
      [tc.id]: { prompt: tc.prompt, expected_behavior: tc.expected_behavior },
    }))
    setEditingId(tc.id)
  }

  async function handleSave(id: string) {
    const buf = edits[id]
    if (!buf) return
    setBusy(true)
    setError(null)
    try {
      await updateTestCase(id, { prompt: buf.prompt, expected_behavior: buf.expected_behavior })
      setEditingId(null)
      await reload()
      setSavedId(id)
      setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 2000)
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
      if (editingId === id) setEditingId(null)
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Test cases</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
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
        <ul className="flex flex-col gap-2">
          {cases.map((tc) => {
            const editing = editingId === tc.id
            const buf = edits[tc.id] ?? { prompt: tc.prompt, expected_behavior: tc.expected_behavior }

            if (editing) {
              return (
                <li key={tc.id} className="flex flex-col gap-2 rounded-md border border-border/30 p-3">
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
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSave(tc.id)}
                      disabled={busy}
                    >
                      Save
                    </Button>
                  </div>
                </li>
              )
            }

            // ── Prompt-first row (D-11): prompt leads, expected_behavior is the quiet
            //    second line, and the uuid is never rendered as a label. ──
            return (
              <li key={tc.id} className="flex items-start gap-2 rounded-md border border-border/30 p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-xs font-medium text-foreground" title={tc.prompt}>
                    {tc.prompt || <span className="italic text-muted-foreground">Untitled test case</span>}
                  </p>
                  {tc.expected_behavior && (
                    <p
                      className="truncate text-[11px] text-muted-foreground"
                      title={tc.expected_behavior}
                    >
                      {tc.expected_behavior}
                    </p>
                  )}
                  {savedId === tc.id && (
                    <span className="text-[11px] text-emerald-500">Saved ✓</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(tc)}
                  disabled={busy}
                  aria-label="Edit test case"
                >
                  <Pencil className="h-3.5 w-3.5" />
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
