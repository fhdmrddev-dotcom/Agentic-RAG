/**
 * Phase 123 Plan 05 Task 2b (TRIG-01) — CaseEditor (sketch 043-A).
 *
 * Two columns — should-fire / should-NOT — with per-row provenance tags
 * (`seeded`/`sibling`/`held`/`you`), add/edit/remove, and the 60/40 train/held-out
 * split bar. The should-NOT column reads visually as the FALSE-FIRE RAIL (the
 * sibling-skill auto-seed generates realistic false-fire bait). The benchmark is
 * hybrid auto-seed + author edits (D-04); cases are ephemeral / client-held — never
 * persisted (only the winning description persists via PATCH /skills).
 *
 * The ~60/40 split mirrors the backend split_held_out (DEFAULT_HELD_OUT_TRAIN_RATIO =
 * 0.6 → first 60% train, rest held-out) — but the backend (skill_tuner.py) splits each
 * class (should_fire / should_not) INDEPENDENTLY then concatenates the held-out halves,
 * and split_held_out bumps the cut to n-1 when the floor would leave a class with zero
 * held-out (guarantees ≥1 held-out per non-trivial class). So the bar computes the
 * held-out count PER CLASS (heldOf(fire) + heldOf(noFire)) — not a single cut over the
 * combined list, which fabricates the count for unbalanced sets (e.g. 8 fire / 2 no-fire).
 * The labels read approximate (~60% / ~40%) because the exact ratio no longer holds for
 * small/unbalanced sets. The bar reads the honest train/held-out counts without lecturing.
 */
import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Skill } from "@/types"

/** One client-held benchmark case + its provenance (the auto-seed vs author tag). */
export interface EditorCase {
  id: string
  prompt: string
  should_fire: boolean
  /** auto-seed/authorship provenance (043-A): what the Tuner wrote vs what you own.
   *  Phase 123.1-04 (Pitfall 4): the `held` value is RESOLVED OUT of the union — the
   *  backend only ever emits `seeded` / `sibling`, the author adds `you`, and the
   *  train/held-out split is owned by the 60/40 split bar (NOT a per-case tag). So the
   *  union is now exactly the three provenances a case can actually carry. */
  provenance: "seeded" | "sibling" | "you"
}

interface Props {
  cases: EditorCase[]
  onChange: (cases: EditorCase[]) => void
  /** The skill being tuned — used to auto-seed the starter should-fire paraphrases. */
  skill: Skill
}

const TRAIN_RATIO = 0.6 // mirrors backend DEFAULT_HELD_OUT_TRAIN_RATIO

/** Held-out count for a single class of `n` cases — mirrors the backend `split_held_out`
 *  (skill_tuner_service.py): cut = floor(n * ratio), bumped to n-1 when cut >= n && n >= 2
 *  (guarantees ≥1 held-out per non-trivial class); held-out = n - cut. */
function heldOf(n: number): number {
  if (n === 0) return 0
  let cut = Math.floor(n * TRAIN_RATIO)
  if (cut >= n && n >= 2) cut = n - 1
  return n - cut
}

const PROVENANCE_LABEL: Record<EditorCase["provenance"], string> = {
  seeded: "seeded",
  sibling: "sibling",
  you: "you",
}

function ProvenanceTag({ provenance }: { provenance: EditorCase["provenance"] }) {
  return (
    <span
      data-testid="provenance-tag"
      className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground shrink-0"
    >
      {PROVENANCE_LABEL[provenance]}
    </span>
  )
}

function CaseColumn({
  testId,
  cases,
  onAdd,
  onRemove,
  isRail,
}: {
  testId: string
  cases: EditorCase[]
  onAdd: () => void
  onRemove: (id: string) => void
  isRail: boolean
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col gap-2 rounded-xl ghost-border p-3 shadow-sm min-w-0",
        isRail ? "bg-[hsl(0_50%_50%/0.06)]" : "bg-card/50",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-headline font-bold text-foreground">
            {isRail ? "Should NOT fire" : "Should fire"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {isRail ? "the false-fire rail (should-NOT precision)" : "should-trigger recall"}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd} aria-label="Add case">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {cases.length === 0 && (
          <li className="text-[11px] text-muted-foreground italic py-1">No cases yet — add one or run to auto-seed.</li>
        )}
        {cases.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-card/40 px-2 py-1.5 text-xs"
          >
            <span className="flex-1 min-w-0 text-foreground break-words">{c.prompt}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <ProvenanceTag provenance={c.provenance} />
              <button
                onClick={() => onRemove(c.id)}
                aria-label="Remove case"
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CaseEditor({ cases, onChange, skill: _skill }: Props) {
  const [draft, setDraft] = useState("")
  const [draftFire, setDraftFire] = useState(true)

  const fireCases = cases.filter((c) => c.should_fire)
  const noFireCases = cases.filter((c) => !c.should_fire)

  // ~60/40 split (deterministic, mirrors the backend): the backend splits EACH class
  // independently then concatenates the held-out halves, so the honest held-out count is
  // heldOf(fire) + heldOf(noFire) — NOT a single cut over the combined list (which
  // fabricates the count for unbalanced sets, e.g. 8 fire / 2 no-fire).
  const total = cases.length
  const heldOutCount = heldOf(fireCases.length) + heldOf(noFireCases.length)
  const trainCount = total - heldOutCount

  const addCase = (should_fire: boolean) => {
    const text = draft.trim()
    if (!text) return
    onChange([
      ...cases,
      { id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, prompt: text, should_fire, provenance: "you" },
    ])
    setDraft("")
  }

  const removeCase = (id: string) => onChange(cases.filter((c) => c.id !== id))

  return (
    <div data-testid="case-editor" className="flex flex-col gap-3">
      {/* Add bar — a quick add with a should-fire / should-NOT toggle. */}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCase(draftFire)
          }}
          placeholder="A user prompt to benchmark…"
          className="flex-1 text-xs rounded-lg px-2.5 py-1.5 bg-card/50 ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex rounded-lg ghost-border overflow-hidden text-[11px] font-mono">
          <button
            onClick={() => setDraftFire(true)}
            className={cn("px-2 py-1.5", draftFire ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          >
            fire
          </button>
          <button
            onClick={() => setDraftFire(false)}
            className={cn("px-2 py-1.5", !draftFire ? "bg-[hsl(0_50%_50%/0.15)] text-[hsl(0_70%_72%)]" : "text-muted-foreground")}
          >
            no
          </button>
        </div>
        <Button size="sm" className="h-8" onClick={() => addCase(draftFire)} disabled={!draft.trim()}>
          Add
        </Button>
      </div>

      {/* Two columns: should-fire / should-NOT (the false-fire rail). */}
      <div className="grid grid-cols-2 gap-3">
        <CaseColumn
          testId="case-col-should-fire"
          cases={fireCases}
          onAdd={() => addCase(true)}
          onRemove={removeCase}
          isRail={false}
        />
        <CaseColumn
          testId="case-col-should-not"
          cases={noFireCases}
          onAdd={() => addCase(false)}
          onRemove={removeCase}
          isRail
        />
      </div>

      {/* ~60/40 train/held-out split bar — honest PER-CLASS counts, no lecture. The winner
          is picked by the held-out set (never used to generate candidates). The exact ratio
          no longer holds for small/unbalanced sets, so the bar is driven by the real counts
          and the labels read approximate (~60% / ~40%). */}
      <div data-testid="split-bar" className="flex flex-col gap-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-card/40">
          <div
            className="bg-primary/40"
            style={{ width: total > 0 ? `${(trainCount / total) * 100}%` : `${TRAIN_RATIO * 100}%` }}
            aria-hidden="true"
          />
          <div className="bg-[hsl(var(--panel-status-active))]" style={{ flex: 1 }} aria-hidden="true" />
        </div>
        <p className="text-[10px] font-mono text-muted-foreground">
          {trainCount} train (~60%) · {heldOutCount} held-out (~40%) — the winner is picked by held-out
        </p>
      </div>
    </div>
  )
}
