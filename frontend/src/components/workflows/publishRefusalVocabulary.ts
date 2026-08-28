/**
 * Phase 214-03 Task 1 (STEP-03 · D-214-09 / D-214-10) — WHAT PUBLISH SAYS WHEN IT REFUSES.
 *
 * EVERY GOVERNED USER-FACING STRING ON THE PUBLISH-REFUSAL SURFACE, IN ONE HOME: the two
 * next actions, the title, the one-step headline, the four stage words, the golden-run
 * reassurance, and the not-retroactive note. Eleven flat ids and seven composed — which is
 * the WHOLE of sketch 215 §1 and not a subset of it.
 *
 * ── LOCK ELSEWHERE, MIRROR HERE ───────────────────────────────────────────────────────
 *
 * The words are LOCKED in
 * `.planning/sketches/215-publish-refuses-by-name/BUILD-CONTRACT.generated.md` §1 and
 * MIRRORED here: a change is a decision taken in that generated contract and reflected
 * here, never the other way round. `publishRefusalVocabulary.test.ts` RE-PARSES that
 * contract at test time and asserts the parsed id→value map equals its own literal table,
 * so a sentence edited in one place and not the other is a red test rather than a silent
 * disagreement.
 *
 * `doorVocabulary.ts`'s `DESCRIBE_REFUSAL` is this table's DIRECT PRECEDENT, and its five
 * rules bind every sentence below: a refusal SENTENCE is presentation, never a rule; no
 * severity word; no exclamation; no mechanism — it names what is missing and what to do;
 * and the dash is an EM DASH (U+2014), asserted by codepoint over the whole table.
 *
 * ── ⚠ THE ONE RULE SPECIFIC TO THIS TABLE: FIVE REFUSALS, NOT ONE ─────────────────────
 *
 * D-214-09 proves each source arm ON ITS OWN TERMS, so each failure is a DIFFERENT FACT
 * ABOUT THE WORLD and gets its own sentence:
 *
 *   • `no_source`            — the author has done nothing here yet.
 *   • `ask_undeclared`       — ⭐ `BUG-260826-01` itself: a declared intention no launcher
 *                              can honour. This gate exists because that exact shape
 *                              shipped once already.
 *   • `upstream_unreachable` — the named step exists but does not run first. The fix is the
 *                              GRAPH, not the form.
 *   • `shape_unknown`        — the action's declaration was never discovered. The fix is
 *                              re-discovery, not an edit.
 *   • `unrenderable`         — a required argument this form structurally cannot fill. The
 *                              fix is a different action.
 *
 * A single "this step is invalid" headline would collapse all five — which is
 * `BUG-260815-06`'s stage-naming failure wearing a new costume. That is why this is a table
 * of five sentences rather than one sentence with five causes behind it.
 *
 * ⚠ `REFUSE_SHAPE_UNKNOWN` IS THE ONE REFUSAL THAT MUST NOT NAME AN ARGUMENT (sketch 215
 * #2). It takes no `arg` parameter at all, so the restraint is STRUCTURAL rather than
 * remembered: there is no argument name in scope for it to print. The suite additionally
 * drives `REFUSAL_FOR_KIND.shape_unknown` with a distinctive argument name and asserts the
 * name does not appear in the result.
 *
 * ── ⭐ THIS MODULE IS THE DECLARING HOME OF `ArgumentGapKind` IN TYPESCRIPT ────────────
 *
 * The union below is DECLARED here and imported from nowhere. Every TypeScript consumer —
 * plan `214-07`'s `argumentModel.ts`, plan `214-10`'s `PublishRefusalList.tsx`, and plan
 * `214-14`'s S-4 cross-language check — imports it FROM THIS MODULE BY NAME.
 *
 * ⚠ A consumer that re-types the five literals inline has created a SECOND LIST, and S-4
 * would then be comparing `args.py`'s Python union against a copy of itself. The union
 * lives here; `REFUSAL_FOR_KIND` is keyed by it; that is the whole mechanism.
 *
 * ⚠ IT IS DECLARED HERE FOR A WAVE REASON, NOT A TASTE ONE. `argumentModel.ts` is created
 * in wave 2, and a wave-1 module cannot import from it. And it is not declared in
 * `lib/api/workflows.ts` because that file has one owner in wave 1, and a same-wave
 * cross-plan import is precisely the seam class this phase exists to stop creating.
 *
 * ── ZERO IMPORTS ──────────────────────────────────────────────────────────────────────
 *
 * ⛔ This module imports NOTHING AT ALL — not even the gap-kind union, which it DECLARES.
 * That keeps the leaf claim intact WITHOUT an exception, which is strictly stronger than
 * an "exactly one type-only import" allowance would have been: an ESM cycle through this
 * module is impossible by construction, and `publishRefusalVocabulary.test.ts` asserts the
 * claim by reading this file's own source rather than documenting it here.
 *
 * ── COMPOSED VALUES ARE FUNCTIONS TAKING NAMED ARGUMENTS ──────────────────────────────
 *
 * Precedent: `branchConditionOf` (`phaseVocabulary.ts:156-231`). Every composed id below
 * takes ONE OBJECT with named fields, never positional parameters — three of these
 * sentences carry two or three interpolations of the same TYPE, so a positional signature
 * would let a step name and an argument name swap places and still typecheck, producing a
 * sentence that reads perfectly and is false.
 *
 * ⚠ Every refusal NAMES THE STEP IN THE AUTHOR'S OWN WORDS (sketch 215 #1), never its
 * slug. The quotation marks are the CURLY pair (U+201C / U+201D).
 */

// ── ⭐ THE GAP-KIND UNION — DECLARED HERE, IMPORTED FROM NOWHERE ──────────────────────

/**
 * The five ways an argument can fail to be publishable, and TypeScript's ONE home for
 * them. The Python side declares the same five in `args.py`; plan `214-14`'s S-4 check
 * parses BOTH and asserts they agree, which is only meaningful because neither side is a
 * copy of a copy.
 *
 * ⚠ ADDING A SIXTH KIND IS A COMPILE ERROR until `REFUSAL_FOR_KIND` below gains its entry.
 * That is the whole reason the map is a `Record` keyed by this union rather than a `switch`
 * with a `default:` a new kind could fall out of in silence.
 */
export type ArgumentGapKind =
  | "no_source"
  | "ask_undeclared"
  | "upstream_unreachable"
  | "shape_unknown"
  | "unrenderable"

/**
 * Everything a refusal sentence can name. ⚠ ALL THREE FIELDS ARE REQUIRED, deliberately.
 *
 * A caller holding a `shape_unknown` gap has no argument name — and passes one anyway,
 * because `REFUSE_SHAPE_UNKNOWN` DOES NOT TAKE ONE and provably drops it. The alternative
 * (optional fields) would have forced a `?? ""` fallback inside the map, i.e. an ungoverned
 * empty string rendered inside curly quotes on a real screen. The restraint is proved by a
 * test that drives the map with a distinctive name and asserts its absence, which is a
 * stronger fence than a type could be here.
 */
export type ArgumentGapFacts = {
  /** The step's name AS THE AUTHOR WROTE IT — never a slug (sketch 215 #1). */
  readonly step: string
  /** The argument's declared name. Ignored by `shape_unknown`, by construction. */
  readonly arg: string
  /** The named earlier step. Used only by `upstream_unreachable`. */
  readonly upstream: string
}

// ── The two next actions ──────────────────────────────────────────────────────────────

/**
 * `REFUSE_NEXT` — the next action on four of the five kinds. It takes the reader to the
 * place the fix lives, which is the only next action a refusal can honestly offer when the
 * fix is an edit.
 */
export const REFUSE_NEXT = "Go to the step"

/**
 * `REFUSE_NEXT_REDISCOVER` — the next action on `shape_unknown` alone. The fix there is
 * re-discovery rather than an edit, so sending the reader to the step would be sending them
 * somewhere they can do nothing.
 */
export const REFUSE_NEXT_REDISCOVER = "Refresh actions"

// ── The headline ──────────────────────────────────────────────────────────────────────

/** `REFUSE_TITLE` — the surface's title. It states the outcome, with no severity word and
 *  no exclamation: nothing was published, and that is the whole fact. */
export const REFUSE_TITLE = "Not published"

/**
 * `REFUSE_COUNT_ONE` — the headline at exactly one blocked step.
 *
 * ⚠ Sketch 215 #6: THE COUNT AGREES WITH THE LIST. A headline claiming a number the list
 * does not have is the one lie this surface can tell while every sentence in it is true, so
 * the singular and the plural are separate ids rather than a pluralisation rule applied to
 * one string.
 */
export const REFUSE_COUNT_ONE = "One step cannot run as written."

// ── The stage spine ───────────────────────────────────────────────────────────────────

/** `STAGE_STRUCTURE` — the gauntlet stage this gate sits in. ⚠ Sketch 215 #4: NO HEADLINE
 *  NAMES A STAGE. The stage words live only on the spine, below the cause. */
export const STAGE_STRUCTURE = "Structure"

/** `STAGE_STRUCTURE_WHAT` — what that stage actually checks, in the reader's terms.
 *  ⚠ The separators are MIDDLE DOTS (U+00B7), not bullets and not full stops. */
export const STAGE_STRUCTURE_WHAT = "Reachable · terminal · inputs satisfied · no orphans"

/** `STAGE_PASSED` — a stage that ran and was satisfied. */
export const STAGE_PASSED = "Checked"

/** `STAGE_BLOCKED` — the ONE stage that stopped. Sketch 215 #8 binds it: exactly one. */
export const STAGE_BLOCKED = "Stopped here"

/**
 * `STAGE_NOT_REACHED` — every stage after the blocked one.
 *
 * ⚠ It is not "skipped" and it is certainly not `STAGE_PASSED`. A later stage reading
 * *Checked* would claim a check that never ran, which is the honesty failure this whole
 * spine exists to prevent.
 */
export const STAGE_NOT_REACHED = "Not reached"

// ── The two reassurances ──────────────────────────────────────────────────────────────

/**
 * `GOLDEN_NO_SEND` — what the golden run says on a passing row.
 *
 * The reader's actual question at this moment is *did it just email my customer?* This
 * answers it in the same breath as the result, rather than leaving it to be inferred.
 */
export const GOLDEN_NO_SEND = "Checked what each step would send. Nothing was sent."

/**
 * `ALREADY_PUBLISHED_NOTE` — the gate is NOT retroactive, said out loud.
 *
 * D-214-10 puts this check in the pre-golden-run lint, which short-circuits before anything
 * runs — so it applies at the NEXT publish and to nothing already live. Without this
 * sentence an author reasonably fears their running workflows just stopped. ⚠ Em dash.
 */
export const ALREADY_PUBLISHED_NOTE =
  "Published workflows keep running — this check applies the next time one is published."

// ── COMPOSED — the five refusals, one per gap kind ────────────────────────────────────

/** `REFUSE_NO_SOURCE` — no arm chosen, or *Set here* left empty. The author has not done
 *  this yet; the sentence says so without saying they were wrong to. */
export const REFUSE_NO_SOURCE = ({ arg, step }: { arg: string; step: string }): string =>
  `Nothing supplies “${arg}” in “${step}”.`

/**
 * `REFUSE_ASK_UNDECLARED` — ⭐ `BUG-260826-01`'s own shape: the step asks for something at
 * launch, and no launcher declares it. Both halves are named because the contradiction IS
 * the fact, and naming only one half would read as a typo rather than a mismatch.
 */
export const REFUSE_ASK_UNDECLARED = ({ step, arg }: { step: string; arg: string }): string =>
  `“${step}” asks for “${arg}” when it runs, but nothing asks for it.`

/** `REFUSE_UPSTREAM_UNREACHABLE` — the named step is real but does not run first. It names
 *  all three so the reader can see the ordering that is wrong. */
export const REFUSE_UPSTREAM_UNREACHABLE = ({
  step,
  arg,
  upstream,
}: {
  step: string
  arg: string
  upstream: string
}): string => `“${step}” takes “${arg}” from “${upstream}”, which does not run before it.`

/**
 * `REFUSE_SHAPE_UNKNOWN` — ⚠ THE ONE REFUSAL THAT NAMES NO ARGUMENT (sketch 215 #2).
 *
 * It takes no `arg` parameter, so there is no name in scope for it to print. We do not know
 * what the action declares; inventing an argument name here would print a fact nothing
 * computed, which is precisely what the whole surface refuses to do.
 */
export const REFUSE_SHAPE_UNKNOWN = ({ step }: { step: string }): string =>
  `We do not know what “${step}” needs.`

/** `REFUSE_UNRENDERABLE` — a required argument whose shape the form structurally cannot
 *  fill (D-214-06). ⚠ Em dash (U+2014). The fix is a different action — deliberately NOT a
 *  free-text door out of the model. */
export const REFUSE_UNRENDERABLE = ({ arg, step }: { arg: string; step: string }): string =>
  `“${arg}” in “${step}” is a list of items — nothing here can fill it in.`

// ── COMPOSED — the two counts ─────────────────────────────────────────────────────────

/** `REFUSE_COUNT_MANY` — the headline at two or more blocked steps. Its singular twin is
 *  the flat `REFUSE_COUNT_ONE`; sketch 215 #6 binds both to the rendered item count. */
export const REFUSE_COUNT_MANY = ({ count }: { count: number }): string =>
  `${count} steps cannot run as written.`

/** `REFUSE_REST_OK` — what is TRUE of everything else, said in the same breath. A refusal
 *  that only names failures leaves the reader guessing how much of their work survived. */
export const REFUSE_REST_OK = ({ count }: { count: number }): string =>
  `The other ${count} are ready.`

// ── ⭐ THE PAIRING — a Record keyed by the union, never a switch ──────────────────────

/**
 * The gap kind → its refusal sentence, as a `Record` over `ArgumentGapKind`.
 *
 * ⚠ THIS IS THE COMPILER-ENFORCED HALF OF D-214-09. A sixth kind added to the union above
 * makes this object a TYPE ERROR until it gains an entry — whereas a `switch` with a
 * `default:` would have absorbed the sixth kind in silence and rendered a generic sentence
 * for a failure the phase went to the trouble of distinguishing.
 *
 * Every entry is the composed function ITSELF, not a wrapper — so `shape_unknown`'s
 * restraint (it takes no `arg`) survives the indirection rather than being re-implemented
 * inside the map.
 */
export const REFUSAL_FOR_KIND: Record<ArgumentGapKind, (facts: ArgumentGapFacts) => string> = {
  no_source: REFUSE_NO_SOURCE,
  ask_undeclared: REFUSE_ASK_UNDECLARED,
  upstream_unreachable: REFUSE_UPSTREAM_UNREACHABLE,
  shape_unknown: REFUSE_SHAPE_UNKNOWN,
  unrenderable: REFUSE_UNRENDERABLE,
}

/**
 * The next action per gap kind. Four kinds send the reader to the step; `shape_unknown`
 * sends them to re-discovery, because the step is not where its fix lives.
 *
 * ⚠ Same `Record` reason as above: a sixth kind cannot silently inherit a default here
 * either, which is where a wrong next action would be least visible.
 */
export const REFUSAL_NEXT_FOR_KIND: Record<ArgumentGapKind, string> = {
  no_source: REFUSE_NEXT,
  ask_undeclared: REFUSE_NEXT,
  upstream_unreachable: REFUSE_NEXT,
  shape_unknown: REFUSE_NEXT_REDISCOVER,
  unrenderable: REFUSE_NEXT,
}
