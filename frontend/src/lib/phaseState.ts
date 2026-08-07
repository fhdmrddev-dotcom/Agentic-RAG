/**
 * Phase 188 Plan 05 (RUNVIZ-01 / RUNVIZ-02 — SPEC Req 8, D-188-02) — the ONE
 * phase-state derivation, shared by the developer timeline and the business canvas.
 *
 * The PROBLEM this closes: the derivation lived in two places and was about to live in
 * a third. `DB_PHASE_STATUS` sat inside `providers/StreamsProvider.tsx`; the
 * terminal-run set sat inside `components/panel/PhaseTimeline.tsx`; and the canvas run
 * view would have been their second consumer, with nothing but code review standing
 * between the two views and a silent disagreement about what a step's state IS. The
 * milestone's own G-5 note asked for this extraction by name.
 *
 * THE RULE, and it is the whole point: this module holds the DERIVATION, never the
 * VOCABULARY. Two vocabularies are correct here — the developer panel has its own
 * harness words for a step the engine has not unlocked, the canvas has business words
 * for the same state, and the SPEC puts re-wording the shipped panel out of scope. Two
 * DERIVATIONS are not correct. So there are NO user-facing words in this file, no
 * glyphs, no colours, no styling classes: each view keeps its own presentation table
 * and consumes the functions below for the state itself. Req 8's acceptance is a grep
 * proving zero local re-derivations — NOT that the two views print identical strings
 * (D-188-02). `phaseState.test.ts` fences that sentence mechanically.
 *
 * Pure logic — no React, no hooks, no JSX, and exactly ONE import (`@/types`, which
 * imports nothing from the app). That single import is what makes an ESM cycle
 * impossible by construction, so this module is safely consumable from both the panel
 * tree and the canvas tree. No lib module in this tree imports a component today, and
 * this one must not become the first. (Mirrors `workspacePanel.ts` / `stepCount.ts`.)
 */
import type { Phase } from "@/types"

/**
 * Moved VERBATIM out of `providers/StreamsProvider.tsx` (Phase 098-UAT run-honesty fix
 * B): map a DB-native `workflow_phases.status` to the client `Phase["status"]` union
 * the developer panel renders (active → running, completed → done).
 *
 * Phase 188 Plan 05 move note — nothing about the map changed, only its address.
 *
 * ⚠ CORRECTED at Phase 189 Plan 08 (CONN-01 / D-08 / D-17), in the commit that falsified
 * it. This docblock used to say its FIVE keys "are exactly `workflow_phases_status_check`
 * (`pending | active | completed | failed | skipped`)". Migration 115 widened that CHECK
 * constraint to SIX literals, so the sentence became false the moment the migration
 * applied. The PROPERTY it was defending is unchanged and still holds — the keys of this
 * map are exactly the constraint's literals, which is what makes the Req-4 subset property
 * below PROVABLE rather than merely asserted: the set of statuses a reconcile can produce
 * is closed and known. Only the COUNT moved, so the count is no longer written down here;
 * a number in prose rots on every additive widening, and the rule does not.
 *
 * ⚠ D-17 — THE KEYS ARE DATABASE SLUGS, THE VALUES ARE CLIENT MEMBERS, AND THEY ARE
 * DIFFERENT SPELLINGS ON PURPOSE. The sixth key below is the snake_case literal Postgres
 * stores; its value is the kebab member this client's union carries, exactly as
 * `active`/`completed` have always mapped to `running`/`done`. The SENTENCE a person
 * eventually reads is a third spelling again and belongs to the vocabulary layers — this
 * module holds no words at all, per THE RULE at the top of the file.
 *
 * (The slug is NOT re-spelled in this prose, deliberately. 189-08's acceptance is a grep
 * proving the snake_case literal appears exactly ONCE outside the tests — a second
 * derivation is what that grep is looking for, and a docblock repeating the string would
 * make the count unreadable. The rule is stated; the string is written once, below.)
 */
export const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending",
  active: "running",
  completed: "done",
  failed: "failed",
  skipped: "skipped",
  // Phase 189 Plan 08 (CONN-01 / D-07) — the sixth literal, added by migration 115. The
  // governed external-action step's terminal: recorded, not transmitted. It maps to its
  // OWN client member rather than to any of the five above, because none of them is true
  // of it — see the `Phase["status"]` docblock in `@/types` for that argument in full.
  recorded_not_sent: "recorded-not-sent",
}

/**
 * TOTAL over every string. The five mapped server values resolve to their client
 * status; EVERY other string — a value from a newer server, a typo, a status this
 * client has never heard of — resolves to `unknown`.
 *
 * `unknown` is the honest catch-all, and it is never success. This derivation used to
 * be an inline `?? "done"` at its single call site, which meant an unrecognised server
 * value was reported to the user as a finished step (SPEC Req 3; the falsification was
 * observed RED and is recorded in `188-02-SUMMARY.md`). That is the third occurrence
 * of one lesson in this codebase — the publish gauntlet's `findIndex → -1` painted an
 * unrecognised blocked stage as 8/8 green. A fallback that claims MORE than its input
 * supports is a fail-open.
 *
 * The fallback lives inside this function rather than at each call site precisely so
 * that there is exactly ONE place it can be got wrong.
 *
 * ⚠ THE OWN-PROPERTY GUARD IS NOT CEREMONY, and it was measured RED before it was
 * written. `DB_PHASE_STATUS` is a plain object literal, so it INHERITS `constructor`,
 * `toString`, `__proto__` and friends. A bare index-and-coalesce therefore returns a
 * FUNCTION (or `Object.prototype`) for those keys — never nullish, so the coalesce
 * never fires — typed as a `Phase["status"]`. That value then misses the panel's
 * `STATUS_META` lookup and crashes the card reading `.glyph` off `undefined`. The
 * observed value for `constructor` was literally `[Function Object]`. It is
 * unreachable from the CHECK-constrained column today, which is precisely the argument
 * under which every fail-open in this file's history shipped: totality is a property
 * of the function, not of its current callers.
 */
export function phaseStatusFromDb(raw: string): Phase["status"] {
  if (!Object.prototype.hasOwnProperty.call(DB_PHASE_STATUS, raw)) return "unknown"
  return DB_PHASE_STATUS[raw]
}

/**
 * The readings the canvas can paint (D-188-04): the normal readings plus the explicit
 * unknown Req 3 mandates — the one a fail-open would otherwise hide behind.
 *
 * `retrying` is deliberately NOT a member. See the collapse rule below.
 *
 * Phase 189 Plan 08 (CONN-01 / D-07) — `"recorded-not-sent"` is the 8th member, and it is
 * SPELLED IDENTICALLY to its `Phase["status"]` member, exactly as `failed` and `skipped`
 * already are. That is deliberate twice over: it makes the switch arm below a one-line
 * identity, and it removes the one place where the two unions could drift apart.
 *
 * ⚠ WIDENING THIS UNION IS THE MECHANISM, NOT A SIDE EFFECT. Every downstream table keyed
 * by it is declared as an exhaustive `Record<CanvasReading, …>` precisely so that an added
 * member is a TYPECHECK ERROR at each of them until someone states what the new state
 * looks like. The compiler is the reminder; this member arms it. Until those tables are
 * filled, each of their own-property-guarded readers falls back to the unknown row — so
 * the intermediate state is honest rather than wrong, which is the whole point of a
 * fail-CLOSED floor.
 */
export type CanvasReading =
  | "not-started"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "waiting-for-you"
  | "recorded-not-sent"
  | "unknown"

/**
 * Derive one node's canvas reading from its run phase. The order of the arms is
 * load-bearing:
 *
 *  1. NO PHASE AT ALL → `not-started`, never `unknown`. A definition node with no
 *     matching run row is a step the harness has not reached yet, and that is a KNOWN
 *     state. `unknown` is reserved for a row that EXISTS and carries a status this
 *     client does not recognise. Conflating the two quietly loses SPEC Req 3's
 *     requirement that unknown stay visually distinct from both done and not-started:
 *     every un-started node of a fresh run would paint as the unknown state, and the
 *     one reading that is supposed to mean "we cannot tell" would become the most
 *     common thing on screen.
 *  2. `pendingAsk != null` → `waiting-for-you`, AHEAD of every status. A step blocked
 *     on the user is blocked on the user whatever its row says.
 *  3. Otherwise the status maps through — and `retrying` collapses into `running`
 *     HERE (D-188-03) and nowhere else. The developer panel still reads
 *     `phase.status === "retrying"` directly and keeps its own attempt wording; that
 *     is vocabulary, and vocabulary is not this module's business. Because the
 *     collapse happens in exactly one named place, SPEC Req 4's subset property —
 *     everything the canvas can paint is producible by a reconcile, so the canvas
 *     never paints a state a reload cannot restore — is a property of ONE function
 *     rather than of a scattering of call sites.
 *  4. `default` → `unknown`: the same honest catch-all as `phaseStatusFromDb`. It
 *     covers the `"unknown"` union member itself and anything a later widening adds,
 *     so a widened union can never fall through to a claim of success.
 */
export function canvasReading(phase: Phase | undefined): CanvasReading {
  if (!phase) return "not-started"
  if (phase.pendingAsk != null) return "waiting-for-you"
  switch (phase.status) {
    case "pending":
      return "not-started"
    case "running":
    case "retrying":
      return "running"
    case "done":
      return "done"
    case "failed":
      return "failed"
    case "skipped":
      return "skipped"
    // Phase 189 Plan 08 (CONN-01 / D-07) — a one-line identity, and it must NOT be folded
    // into the `done` arm above. The two states differ in the only way that matters here:
    // one asserts the step's work reached the outside, the other asserts it deliberately
    // did not. Sharing an arm would make that difference unrepresentable downstream, which
    // is the fail-open this whole module exists to refuse.
    case "recorded-not-sent":
      return "recorded-not-sent"
    default:
      return "unknown"
  }
}

/**
 * The run-level statuses that mean a run has STOPPED. Moved unchanged out of
 * `components/panel/PhaseTimeline.tsx:40`; its consumer there (the `aria-busy` flip)
 * is untouched by the move.
 *
 * `timed_out` IS CARRIED FORWARD UNCHANGED, by decision (D-188-21) and in spite of the
 * measurement below — which is recorded HERE so the deferral's re-open trigger
 * ("someone measures it") is satisfied rather than left standing, and so a later phase
 * can retire the member in one line with evidence instead of re-deriving it:
 *
 *   • The consumer reads `frame.run_status`, which comes from
 *     `GET /threads/{id}/workflow`.
 *   • In `backend/app/api/threads.py`, `run_status` is initialised `None` and assigned
 *     in EXACTLY ONE place — `run_status = wf_row["status"]`, where `wf_row` is
 *     `SELECT wr.status ... FROM workflow_runs wr ... WHERE wr.id = $1`.
 *   • `workflow_runs_status_check` is
 *     `active | paused | cap_paused | completed | failed | cancelled`. There is no
 *     `timed_out` in it.
 *   • The Deep producer `runs` row IS read a few lines further down, but its status
 *     feeds only a local `producer_terminal` boolean (which sets `lock_is_stale`) and
 *     never reaches `run_status`. That local check is where `timed_out` legitimately
 *     appears — almost certainly how the value was copied into this set originally.
 *
 * So the member is DEAD, not wrong. Deleting it during a move would have made this
 * commit a behaviour change dressed as a refactor; keeping it costs one string.
 */
export const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"])
