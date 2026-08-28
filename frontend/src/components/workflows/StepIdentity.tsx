/**
 * Phase 214-08 Task 2 (STEP-04 · D-214-16 / D-214-17 · SC#4 · `SEED-206`) — THE ONE ELEMENT
 * THAT SAYS WHAT A STEP IS.
 *
 * A mark, the action's real name, and the connection's display name. Five surfaces mount it
 * in plan `214-11`: the panel's `PhaseCard` / `PhaseTimeline`, chat's `RunCard`, the run
 * page's `RunSpine` and `RunStepList`, and the approval pause.
 *
 * ── WHY ONE ELEMENT RATHER THAN FIVE CALL SITES ───────────────────────────────────────
 *
 * D-214-16: *"coverage should be a consequence of one component existing, not a list kept in
 * sync."* `SEED-206`'s own warning is that a PARTIAL answer leaves the seed live for the next
 * phase to rediscover — so the way to close it is a component the surfaces cannot each get
 * subtly wrong, not five patches that agree today.
 *
 * ── ⚠ IT RESOLVES NOTHING. BOTH NAMES ARE PROPS. ──────────────────────────────────────
 *
 * D-214-14's rule (*the caller resolves, the component renders*), and it is load-bearing
 * rather than tidy. `WorkflowRunPage` already holds a `titleOf` built from `nodeTitle(spec)`;
 * the chat panel's `PhaseCard` / `PhaseTimeline` have **no `titleOf` at all** — they read
 * `Phase` rows out of `StreamsProvider`. An element that resolved its own name would give
 * those two surfaces DIFFERENT answers for the same step, and "one element, five surfaces"
 * would become one element and five disagreements.
 *
 * So: no store, no context, no fetch, no lookup. The suite fences that from this source.
 *
 * ── ⚠ A NULL SERVICE RENDERS THE ACTION ALONE ─────────────────────────────────────────
 *
 * Never "the service is not known", never the capability id, never the slug. That is
 * `stepIdentityVocabulary`'s `STEP_IDENTITY_SERVICE_UNKNOWN`, and it is a separate composed
 * id rather than a fallback inside `STEP_IDENTITY` precisely so the honest shape has a name a
 * caller can be SEEN choosing. It is `grounding.py`'s *never draw a name the system cannot
 * know*, on a rendering surface.
 *
 * ⚠ A BLANK OR WHITESPACE SERVICE IS TREATED AS UNRESOLVED TOO. The wire ships `null` for
 * "not recorded" and never `""` — but a name that renders as nothing beside a separator is
 * the same lie as a fabricated one, and cheaper to prevent than to detect.
 *
 * ── ⚠ SIZE IS A MODIFIER, NEVER A FORK ───────────────────────────────────────────────
 *
 * Sketch 216 invariant #1. Both size Records — this file's text scale and
 * `lib/connectionMark.tsx`'s `SIZE_CLASS` — are keyed by the SAME four-token union, so a
 * fifth size widens a Record rather than adding a branch. The suite reads this source and
 * asserts neither `if (size` nor `size ===` appears in it.
 *
 * ── ⚠ THE SEPARATOR IS DERIVED FROM THE VOCABULARY, NOT RETYPED ──────────────────────
 *
 * Sketch 216 #5 wants the house middle dot as its OWN NODE, so a test can assert the element
 * rather than a substring. Writing the character here would be a second home for a governed
 * string, so it is EXTRACTED from `STEP_IDENTITY` at module load using two sentinel
 * codepoints that cannot occur in a display name. The consequence is the property the suite
 * actually checks: the element's text content is character-for-character the governed
 * composed string, in BOTH arms.
 *
 * ── ⚠ `data-` ATTRIBUTES CARRY A SHAPE, NEVER A WIRE ID ──────────────────────────────
 *
 * `ExternalActionSection.tsx`'s rule, which is sketch 216 invariant #4. `data-size` is a
 * presentation token and `data-service-resolved` is a boolean reading; no capability, no
 * `tool_name`, no `service_id` and no connection id reaches the DOM from here. The suite
 * sweeps the rendered markup for the five wire ids, with a positive control beside it.
 */
import {
  ConnectionMarkGlyph,
  type ConnectionMarkShape,
  type ConnectionMarkSize,
} from "@/lib/connectionMark"
import {
  STEP_IDENTITY,
  STEP_IDENTITY_SERVICE_UNKNOWN,
} from "@/components/workflows/stepIdentityVocabulary"
import { cn } from "@/lib/utils"

/**
 * The four sizes, ALIASED to the mark resolver's own union rather than re-declared.
 *
 * ⚠ Deliberately an alias and not a copy: two independently-written unions can drift by one
 * token, and the failure would be a mark drawn at a size the text was never scaled for —
 * visible to an eye and to no type checker.
 */
export type StepIdentitySize = ConnectionMarkSize

export interface StepIdentityProps {
  /** The connection's structural shape — whatever the caller holds that answers the mark. */
  shape: ConnectionMarkShape
  /** The tool's HUMAN name. RESOLVED BY THE CALLER (`titleOf` / `nodeTitle`). Never a slug. */
  action: string
  /** The connection's display name, RESOLVED BY THE CALLER. `null` ⇒ genuinely unresolvable. */
  service: string | null
  /** A modifier. It selects a class from a Record; it never selects a code path. */
  size: StepIdentitySize
  className?: string
}

/**
 * The text scale, one entry per size — the TYPE half of the four tokens whose MARK half is
 * `connectionMark.tsx`'s `SIZE_CLASS`. Both are keyed by the same union rather than by two
 * lists someone must remember to keep equal.
 *
 * Values follow sketch 216's four sizes (14 / 16 / 20 / 24 px marks against 10.5 / 11.5 / 13
 * / 15 px text), mapped onto the shipped Tailwind scale.
 */
const TEXT_CLASS: Record<StepIdentitySize, string> = {
  chip: "gap-1 text-xs",
  row: "gap-1.5 text-xs",
  spine: "gap-2 text-sm",
  canvas: "gap-2.5 text-base",
}

/** Sentinels for the extraction below. Control codepoints — never present in a real name. */
const LEFT_SENTINEL = "\u0001"
const RIGHT_SENTINEL = "\u0002"

/**
 * The house middle dot WITH its surrounding spaces, EXTRACTED from the governed composed id
 * rather than written here.
 *
 * ⚠ If the vocabulary's shape ever changes, this follows it. A literal would not, and the
 * drift would be invisible — both strings would still render, just differently.
 */
const SEPARATOR = STEP_IDENTITY({ action: LEFT_SENTINEL, service: RIGHT_SENTINEL })
  .split(LEFT_SENTINEL)[1]
  .split(RIGHT_SENTINEL)[0]

/**
 * The step's identity: its mark, its action, and the service it runs through.
 *
 * The mark is `aria-hidden` (inside `ConnectionMarkGlyph`) — a mark is never the accessible
 * name of anything here. The identity's accessible text is its two words.
 */
export function StepIdentity({ shape, action, service, size, className }: StepIdentityProps) {
  // A name the system cannot know is not drawn. `null`, `""` and whitespace are ONE case.
  const resolved = typeof service === "string" && service.trim().length > 0 ? service : null

  return (
    <span
      data-step-identity=""
      data-size={size}
      data-service-resolved={resolved === null ? "false" : "true"}
      className={cn("inline-flex min-w-0 items-center", TEXT_CLASS[size], className)}
    >
      <ConnectionMarkGlyph shape={shape} size={size} />
      <span className="inline-flex min-w-0 items-baseline">
        {/* ⚠ The action NEVER truncates before the service does — at the smallest size two
            rows of the same vendor differ only by their action (sketch 216 §3's note). */}
        <span data-step-identity-action="" className="flex-none">
          {resolved === null ? STEP_IDENTITY_SERVICE_UNKNOWN({ action }) : action}
        </span>
        {resolved === null ? null : (
          <>
            <span data-step-identity-separator="" className="flex-none whitespace-pre">
              {SEPARATOR}
            </span>
            <span data-step-identity-service="" className="truncate">
              {resolved}
            </span>
          </>
        )}
      </span>
    </span>
  )
}
