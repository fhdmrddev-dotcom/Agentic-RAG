/**
 * Phase 184-08 Task 1 (VALID-03 · D-182-06 · sketch 139-A) — verdictModel.
 *
 * IT GROUPS AND IT COUNTS. IT CLASSIFIES NOTHING.
 *
 * The server answers `POST /workflows/validate` with a flat list of findings, each one
 * already carrying its own severity, its own wording and the phase SLUG it belongs to.
 * This module turns that flat list into the two shapes a canvas needs — a per-node
 * lookup and a tray listing — and it does so WITHOUT forming a single opinion about
 * any of them.
 *
 * ── NO CODE TABLE. THIS IS THE RED LINE, NOT A PREFERENCE (D-182-06) ──
 * There is no list of finding identifiers in this file. No severity derivation, no
 * friendly-message map, no allow-list, no special case for the dual-source
 * terminal-step finding, for the registry-availability finding, or for any other. The
 * lint vocabulary has exactly ONE owner — the backend modules that mint it — and a
 * second copy on the client is a copy that drifts. Phase 185 will ship more findings
 * as new identifiers in the module that owns them, and this file must need no edit at
 * all for the canvas to render them.
 *
 * The ONLY reason this module knows the string `"incomplete"` at all is to READ
 * `verdict.severity`. It compares against the SOFT value and treats everything else as
 * the hard one — which is not a classification, it is the route's own fail-closed
 * default mirrored rather than substituted for. A finding whose severity is a value
 * this client has never seen therefore renders as a problem, never as a note, and
 * never disappears. `?raw` source guards in `verdictModel.test.ts` fail the moment an
 * identifier table, a request, or a runtime import of the API client appears here, and
 * each of them carries a positive control so a broken guard is visible rather than
 * vacuously green.
 *
 * ── WHY `workflowWide` IS A SEPARATE ARRAY AND NOT A DROPPED CASE ──
 * A `phase` of `null` means the finding belongs to the workflow rather than to any one
 * step — "this still needs a one-line description" points at no node on the canvas.
 * Sketch 139 variant B lost exactly those findings from the surface entirely, and that
 * is the recorded reason variant A won. Keeping them in their own array is what gives
 * the tray a home to put them in.
 *
 * ── TOTALITY ──
 * An empty list, a finding with an identifier this client has never seen, a finding
 * with a severity outside the wire union, and a `phase` that matches no node on the
 * canvas all resolve honestly and never throw. Nothing is filtered, nothing is
 * re-ordered, nothing is rewritten: every field of every finding survives into the
 * grouped output byte-for-byte, so the renderer can show the server's own words.
 *
 * ── PURITY ──
 * Zero React, zero DOM, zero clock, zero randomness, and no runtime dependency on the
 * API client or on the editing store. The `Verdict` shape is imported as a TYPE ONLY
 * (erased at compile time) so that this module does not become a third declaration of
 * a wire shape that already has one home and one compile-time bridge — see the
 * `Verdict` docblock in the api client for why a second copy is the failure mode and
 * not the fix.
 */
import type { Verdict } from "@/lib/api"
// Type-only, and therefore erased: the live loop owns the cause union, and keying the
// sentences off it is what stops a second spelling of the same two words appearing here.
import type { DegradedValidationCause } from "@/hooks/useLiveValidation"

/**
 * The mark a node carries. Two values, because the canvas paints two: a red ✕ and a
 * dashed grey ○. There is no third — "we could not check" is a state of the CHECK, not
 * of a finding, and it belongs to the card's own degraded slot.
 */
export type NodeMark = "error" | "incomplete"

/**
 * The soft severity — the only wire value this module compares anything against.
 *
 * Everything that is not exactly this is treated as the hard severity, at the count,
 * at the mark and at the row. That single rule is applied in all three places so a
 * surface can never say "0 problems" while rendering a problem.
 */
const SOFT_SEVERITY = "incomplete"

/** The resting-state wording when the server returned nothing at all. It claims only
 *  what it can: the STATIC half. A publish still has to run its golden run and its
 *  judge, and this line must never be mistaken for that. */
export const NOTHING_OUTSTANDING = "Nothing to fix — the static checks pass"

/**
 * The two sentences a surface says when the check did not run at all (D-184-14).
 *
 * SAME BEHAVIOUR, DIFFERENT WORDS, ON PURPOSE. A shape rejection is reproducible: an
 * author who hits one and is told "try again" will try forever. An unreachable server
 * usually is worth retrying. Neither sentence renders the rejected body — that is
 * logged at the transport boundary and carried no further — and neither of them may
 * ever be swapped for silence or for the clean line above, because "we could not
 * check" rendering as "fine" is the single worst thing this surface can do.
 *
 * They live in this module, and not beside the component that says them, for a
 * mechanical reason worth writing down: a component file may not export shared
 * constants (`react-refresh/only-export-components`). It is also the right home —
 * every word a surface says ABOUT a check now sits in one pure module, next to the
 * resting-state line it has to be chosen against.
 */
export const DEGRADED_SENTENCE: Record<DegradedValidationCause, string> = {
  unreadable: "We couldn't check this — the workflow's shape isn't something we can read yet.",
  unreachable: "We couldn't reach the check.",
}

/** The grouped, counted view of one server response. */
export interface VerdictGroups {
  /**
   * Findings keyed by `verdict.phase`, which IS `node.id` and IS the phase `slug`.
   * The client derives that identity from nothing — the server guarantees it, and the
   * whole per-node rendering path is a map lookup on a key it was handed.
   */
  byPhase: Map<string, Verdict[]>
  /** Every finding whose `phase` is `null` — the ones that belong to no node. */
  workflowWide: Verdict[]
  /** Findings at the hard severity. Counted by reading `severity`, never by deriving it. */
  errorCount: number
  /** Findings at the soft severity. Same rule. */
  incompleteCount: number
  /**
   * The mark a node should carry, or `undefined` when the server said nothing about it.
   *
   * PRECEDENCE, NOT CLASSIFICATION: a step the server reported twice gets ONE mark, and
   * the harder of the two wins, because a card has one corner. The severities compared
   * here were all supplied by the server; this function only decides which of the
   * supplied values is shown when a node has several.
   */
  markFor(slug: string): NodeMark | undefined
}

/** The house singular/plural helper, kept local so no shared util grows a phase-184
 *  special case. */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * groupVerdicts — the whole module, in one pass over the server's list.
 *
 * Total by construction: a nullish list, a nullish entry and an unrecognised severity
 * are all handled without a throw, because the definition being validated is
 * author-supplied and a canvas must not go blank over a shape surprise.
 */
export function groupVerdicts(verdicts: readonly Verdict[]): VerdictGroups {
  const byPhase = new Map<string, Verdict[]>()
  const workflowWide: Verdict[] = []
  const marks = new Map<string, NodeMark>()
  let errorCount = 0
  let incompleteCount = 0

  for (const verdict of verdicts ?? []) {
    if (!verdict) continue

    // The one comparison in this file. Soft is the value we know; everything else is
    // hard, which mirrors the route's fail-closed default instead of second-guessing it.
    const soft = verdict.severity === SOFT_SEVERITY
    if (soft) incompleteCount += 1
    else errorCount += 1

    const slug = verdict.phase
    if (slug === null || slug === undefined) {
      workflowWide.push(verdict)
      continue
    }

    const bucket = byPhase.get(slug)
    if (bucket) bucket.push(verdict)
    else byPhase.set(slug, [verdict])

    // Precedence: hard wins, and once a node is hard it stays hard.
    if (!soft) marks.set(slug, "error")
    else if (!marks.has(slug)) marks.set(slug, "incomplete")
  }

  return {
    byPhase,
    workflowWide,
    errorCount,
    incompleteCount,
    markFor: (slug: string) => marks.get(slug),
  }
}

/**
 * summaryLine — the locked resting-state wording (sketch 139-A, CONTEXT `<specifics>`).
 *
 * *"1 problem · 2 things to finish."* THE TWO COUNTS ARE NEVER MERGED. Both severities
 * set `ok: false` and both block a publish, but only one of them is bad news:
 * "unfinished" is the state a canvas spends most of its life in, and a surface that
 * adds the two together into "3 problems" tells a person they have done something
 * wrong every time they pause halfway. Separating them IN WORDS, before anything is
 * opened, is the whole mechanism — which is why this string exists at rest and not
 * only inside an expanded tray.
 *
 * When one half is zero its clause is omitted entirely rather than rendered as a zero:
 * "0 problems · 3 things to finish" still leads with the word "problems".
 */
export function summaryLine(groups: VerdictGroups): string {
  const parts: string[] = []
  if (groups.errorCount > 0) parts.push(plural(groups.errorCount, "problem", "problems"))
  if (groups.incompleteCount > 0) {
    parts.push(plural(groups.incompleteCount, "thing to finish", "things to finish"))
  }
  return parts.length > 0 ? parts.join(" · ") : NOTHING_OUTSTANDING
}
