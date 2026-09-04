/**
 * BUG-260828-09 Task 3 — THE CARD A FAILED PUBLISH LEADS WITH.
 *
 * Three facts, in the order a person asks for them: WHICH step of their own workflow stopped
 * the run, WHY in the sentence the run already produced, and WHAT TO DO next. The ten-row
 * stage spine is a map of the checks — it is context, not an answer — and it stays below.
 * The raw verdict, the polymorphic `named_failures` and the engine's machine-prefixed
 * `reason` all stay behind the shipped `<details>`. **Nothing is removed; the order changes.**
 *
 * ⚠ THE FRAME IS `PublishRefusalList`'s, DELIBERATELY AND NOT COINCIDENTALLY. Same slot
 * (above the spine), same `rounded-lg border border-border bg-card` shell, same header
 * register, same `text-[13px]` body. Two cause blocks that looked like two different features
 * would tell an author the surface has two kinds of refusal in it, when it has one kind with
 * two producers. A publish can never render both: `PublishRefusalList` claims the
 * argument-gap entries out of `named_failures`, and this claims the step-level failure of the
 * golden RUN — which by construction is a run that started, so no argument gap blocked it.
 *
 * ⚠ G-2 IS OVERRIDDEN HERE, NOT SATISFIED. No operator-approved sketch exists for this card;
 * the operator authorised the build with the visual veto retained. It is authored from the
 * shipped design system and from the sibling refusal surface rather than invented, and the
 * wiring is design-independent: if the visual is rejected, the server field, the resolver,
 * the face ladder and the tests all survive a re-skin untouched. Recorded under
 * `STATE.md → Guardrail overrides`.
 *
 * ⚠ AND jsdom CANNOT PROVE THE THING THIS CARD IS FOR. Every `getBoundingClientRect` is zero
 * in jsdom, so no test here can show that a person reading the result can name the failing
 * step — which is the same blind spot the bug report names as the reason nothing caught this.
 * The tests below prove the WIRING (the sentence arrives, the slug never does); the operator
 * proves the READING, in a browser.
 */
import {
  BLOCKED_STEP_NEXT,
  BLOCKED_STEP_TITLE,
  blockedStepFace,
  blockedStepHeadline,
  blockedStepOf,
} from "@/components/workflows/publishBlockedStep"
import type { DefShape } from "@/components/workflows/soulData"

export interface PublishBlockedStepCardProps {
  /** The verdict's `blocked_step`, VERBATIM. This component does its own shape detection via
   *  `blockedStepOf`; the caller does not pre-narrow it. */
  step: unknown
  /** The authored definition, when the caller holds one. ⚠ ABSENT ⇒ the face falls to the
   *  server's `step_name` and then to the step's ordinal — never to the slug. */
  definition?: DefShape | null
}

/**
 * Renders NOTHING when the verdict carries no phrasable step-level cause — a lint block, a
 * judge block, a pre-fix server, a crash before any phase ran. So every stage the golden run
 * did not reach is byte-for-byte the surface that shipped.
 */
export function PublishBlockedStepCard({ step, definition }: PublishBlockedStepCardProps) {
  const blocked = blockedStepOf(step)
  if (!blocked) return null

  const face = blockedStepFace(blocked, definition)

  return (
    <section
      data-testid="publish-blocked-step"
      className="mt-2 rounded-lg border border-border bg-card"
    >
      <div className="border-b border-border px-3 py-2.5">
        <div
          data-testid="blocked-step-title"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {BLOCKED_STEP_TITLE}
        </div>
        {/* The step, in the author's own vocabulary. `blockedStepFace` is the ONLY thing that
            decides these words, and its own floor is that the slug is not one of its tiers. */}
        <div
          data-testid="blocked-step-headline"
          className="mt-1 text-[15px] font-bold leading-snug text-foreground"
        >
          {blockedStepHeadline(face)}
        </div>
      </div>

      {/* THE SERVER'S OWN SENTENCE, VERBATIM AND UNSTYLED-BY-MEANING. It is rendered as a
          text child — there is no `dangerouslySetInnerHTML` anywhere on this path — and it is
          not truncated, not clamped and not re-worded, because it is the only line on this
          surface that knows anything specific. */}
      <p
        data-testid="blocked-step-cause"
        className="px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-foreground"
      >
        {blocked.cause}
      </p>

      <p
        data-testid="blocked-step-next"
        className="border-t border-border px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"
      >
        {BLOCKED_STEP_NEXT}
      </p>
    </section>
  )
}
