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
import { useState, type ReactNode } from "react"
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
  /** Phase 123.1-05 (BUG-260624-01 #1): the FULL uncapped sibling-sourced should_not count
   *  from the backend (SeededCasesResponse.total). When provided AND greater than the shown
   *  sibling-provenance count, the should-NOT column shows an honest "showing N of M — capped"
   *  banner. Undefined (e.g. the seeded fetch failed) → no banner. */
  seededNotTotal?: number
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
      className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground shrink-0"
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
  capBanner,
}: {
  testId: string
  cases: EditorCase[]
  onAdd: () => void
  onRemove: (id: string) => void
  isRail: boolean
  /** Optional honest "showing N of M — capped" banner rendered ABOVE the list (should-NOT
   *  column only, Phase 123.1-05). Never silent truncation. */
  capBanner?: ReactNode
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
          <span className="text-sm font-headline font-bold text-foreground">
            {isRail ? "Should NOT fire" : "Should fire"}
            {/* Per-column count (Phase 123.1-05) — the shown case length next to the title. */}
            <span data-testid="case-col-count" className="ml-1.5 text-xs font-mono font-normal text-muted-foreground">
              {cases.length}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {isRail ? "the false-fire rail (should-NOT precision)" : "should-trigger recall"}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd} aria-label="Add case">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {capBanner}
      {/* Bounded + scrollable (Phase 123.1-05): a long seeded set scrolls inside a 340px
          column instead of stacking into an illegible wall (mirrors sketch 045-B
          `.case-list.capped { max-height: 340px }` + scrollbar-thin). */}
      <ul className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto scrollbar-thin">
        {cases.length === 0 && (
          <li className="text-xs text-muted-foreground italic py-1">No cases yet — add one or run to auto-seed.</li>
        )}
        {cases.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-card/40 px-2 py-1.5"
          >
            <span className="flex-1 min-w-0 text-sm text-foreground break-words">{c.prompt}</span>
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

export function CaseEditor({ cases, onChange, skill: _skill, seededNotTotal }: Props) {
  const [draft, setDraft] = useState("")
  const [draftFire, setDraftFire] = useState(true)
  // "show all N" reveals an HONEST explanation of the cap, never fabricated cases (Phase
  // 123.1-05). The backend deliberately withheld the rest to keep the benchmark focused/fast;
  // the editor has no withheld cases to reveal, so "show all" discloses what the cap is and how
  // the author can extend it (add cases) — it MUST NOT invent the seeded cases the backend cut.
  const [showCapNote, setShowCapNote] = useState(false)

  const fireCases = cases.filter((c) => c.should_fire)
  const noFireCases = cases.filter((c) => !c.should_fire)

  // Phase 123.1-05 (BUG-260624-01 #1): the honest cap banner. The backend caps the
  // sibling-sourced should_not at MAX_SEEDED_SHOULD_NOT and returns the full uncapped count as
  // `seededNotTotal`. The "shown" sibling count is the number of sibling-provenance cases in
  // the should-NOT column (author-added "you" cases never count toward the cap). The banner is
  // shown ONLY when total > shown — capping is never silent (a load-bearing honesty rule).
  const shownSiblingCount = noFireCases.filter((c) => c.provenance === "sibling").length
  const isCapped = seededNotTotal != null && seededNotTotal > shownSiblingCount

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

      {/* Two columns: should-fire / should-NOT (the false-fire rail). Full-width two-up grid
          (Phase 123.1-05): each column gets ~half the FULL page width once the page is
          full-width (no longer ~170px crammed in a 360px rail). Stacks on narrow widths. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          capBanner={
            isCapped ? (
              <div
                data-testid="cap-banner"
                className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-amber-200/90">
                    showing {shownSiblingCount} of {seededNotTotal} seeded · capped to keep the
                    benchmark focused
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCapNote((v) => !v)}
                    className="shrink-0 text-xs font-medium text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
                  >
                    show all {seededNotTotal}
                  </button>
                </div>
                {showCapNote && (
                  <p className="text-[11px] leading-snug text-amber-100/70">
                    The benchmark seeds the {shownSiblingCount} most relevant sibling skills as
                    false-fire bait — the rest are withheld so the run stays fast and the editor
                    legible. To benchmark against more, add your own should-NOT cases above.
                  </p>
                )}
              </div>
            ) : undefined
          }
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
