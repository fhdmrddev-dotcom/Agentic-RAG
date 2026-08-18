/**
 * Phase 192.2-04 Task 3 (LIB-06 — CONTEXT D-07 / D-08, threats T-13 / T-14 / T-15 / T-16) —
 * THE ONE PLACE THE RUN TRUTH BECOMES WORDS.
 *
 * ── WHAT THIS ANSWERS ────────────────────────────────────────────────────────────────────
 * *Does this one work?* — the question LIB-06 exists for. On real data it is answerable for
 * **89% of published rows** (32 of 36 carry at least one run), where the written purpose is
 * answerable for 14%. That measurement is why the run truth earned a line on a card this
 * phase is otherwise SUBTRACTING from.
 *
 * ── THREE ARMS, AND A BOOLEAN CANNOT EXPRESS THEM (D-08, T-13) ───────────────────────────
 * This is the whole design, and it is the single most likely place to ship a lie:
 *
 *   · `ran`     — it ran, and here is what happened. `worked` / `failed` / `stopped`.
 *   · `never`   — THE BACKEND LOOKED AND THERE IS NO RUN. The never-run arm; a real,
 *                 affirmative fact about the row, and the commonest one on a 69%-draft shelf.
 *   · `unknown` — THE WIRE DID NOT SAY. A frontend deployed AHEAD of its backend receives rows
 *                 with no run keys at all, and this arm is what it renders.
 *
 * ⚠ FOLDING `unknown` INTO `never` IS THE DEFECT, NOT A SIMPLIFICATION. It makes the product
 * state *"this has never run"* about a workflow that may have run a hundred times — a specific
 * false claim, printed confidently, about somebody's own work. Two arms cannot say it and a
 * boolean cannot say it. ⚠ AND THE APPROVED MOCKUP ITSELF HAD THAT BUG: sketch 179 variant
 * C's own `runWords` claimed "its own three-armed unknown" in its comment while shipping two arms
 * plus a `Never run` catch-all. The sketch was the acceptance bar for the LANGUAGE; it was never
 * the acceptance bar for the RESOLUTION, and this module deliberately did not copy it.
 *
 * ⚠ AMENDED 192.2-06 — THAT MOCKUP NO LONGER EXISTS. Its throwaway dev surface was torn down at
 * this phase's close, in the one commit its own teardown note required. **THIS FILE IS THEREFORE
 * THE ONLY HOME OF THE THREE-ARMED RESOLUTION** — a reader who goes looking for the sketch's
 * version will not find it, and the two-armed shape is preserved only as prose, in
 * `.planning/sketches/179-what-the-eye-lands-on-honestly/README.md` and in `192.2-04-SUMMARY.md`
 * §2. The pointer is amended rather than deleted because nothing in this repository typechecks
 * prose, and a dangling path is how a wrong pointer survives every gate.
 *
 * ── THE MAP IS CLOSED AND ITS DEFAULT IS NEVER SUCCESS (T-15) ────────────────────────────
 * `workflow_runs.status` admits SIX values today — `active` · `paused` · `cap_paused` ·
 * `completed` · `failed` · `cancelled` (`supabase/migrations/057_workflow_runs.sql:19`, widened
 * by `063_dual_mode_continue.sql`) — and the run lifecycle can add a seventh without this file
 * changing. Only the three TERMINAL ones map to an outcome. Everything else — a status this
 * build does not know, and the three IN-FLIGHT ones, which have no outcome yet BY DEFINITION —
 * resolves to `unknown`, which is the honest reading and is never a tick.
 *
 * ⚠ KNOWN LIMIT, STATED RATHER THAN DISCOVERED. A run that is `active` right now reads as
 * *Not recorded*, which is true (no outcome is on record) but says less than the surface could.
 * A fourth *running* arm is a PIXEL decision — it needs its own mark, its own word and probably
 * a live tick this project has already recorded as a defect class (`relativeChanged.ts`, the
 * 188 tick-gate bug). RE-OPEN TRIGGER: the first phase that renders in-flight state on the
 * library shelf. Until then the honest catch-all holds.
 *
 * ⚠ THE LOOKUP IS AN OWN-PROPERTY CHECK, NEVER `TABLE[key] ?? fallback`. `OUTCOME` is a plain
 * object literal, so it INHERITS `constructor`, `toString` and `__proto__`; a coalesce does not
 * fire its fallback for those names and hands back a *function* typed as the value type. That
 * is measured in this repository, not theoretical — `phaseStatusFromDb` shipped with exactly
 * that expression and returned `[Function Object]` for `"constructor"` (`runVocabulary.ts`'s
 * `own` helper, `modelFitness.ts`'s same rule). The status here arrives RAW FROM THE WIRE, so
 * an attacker-shaped or merely odd value reaching this table is a live path, not a hypothetical.
 *
 * ── NO SECOND TIME FORMATTER (T-16) ──────────────────────────────────────────────────────
 * The recency comes from `relativeBand` in `relativeChanged.ts` — the same nine bands the
 * identity line already renders, minus its `changed ` prefix. Two relative-time formats on ONE
 * card is visible drift, and a fourth spelling of the bands in this repository is exactly what
 * `relativeChanged.ts`'s own header argues against. It returns `null` for an absent or
 * unreadable instant rather than inventing one, and this module renders the outcome WITHOUT a
 * time in that case (T-14): never `new Date()`, never `just now`, never the epoch.
 *
 * ── THE WORDS ARE IMPORTED, NOT SPELLED (T-06, inherited from 192.2-02) ──────────────────
 * `libraryVocabulary.ts` owns every string this subtree renders and this module re-types none
 * of them. The DECISION lives here; the VOCABULARY lives there. That is the same split
 * `cardFace.ts` made for the state axis, one field over.
 *
 * ── A PURE, VALUE-ONLY LEAF ──────────────────────────────────────────────────────────────
 * No React, no `@/lib/api`, no DOM, no I/O and no store. Its input is a `LibraryRow` and an
 * instant, and nothing else. `now` is a PARAMETER with a `Date.now()` default — the exact
 * signature `relativeChanged` uses, and for the exact same reason (P-1): the page hoists ONE
 * `now` per render so every card agrees what time it is and two cards cannot straddle a band
 * boundary, while a suite injects a fixed instant and needs no clock mock.
 */
import type { LibraryRow } from "./libraryRow"
import { relativeBand } from "./relativeChanged"
import {
  RUN_FAILED,
  RUN_NEVER,
  RUN_STOPPED,
  RUN_UNKNOWN,
  RUN_WORKED,
} from "./libraryVocabulary"

/**
 * What a finished run DID. Three business outcomes, and none of them is a database spelling —
 * the system words (`completed` / `cancelled`) are an INPUT to this module and reach no
 * returned field, the property `cardFace.ts` already holds for the state axis.
 */
export type RunOutcome = "worked" | "failed" | "stopped"

/**
 * The run truth for one row, as a discriminated union with EXACTLY THREE ARMS.
 *
 * ⚠ EVERY ARM CARRIES A WORD. D-01 gives the outcome a 3px gutter mark and the standing
 * constraint on it is *"colour, and never colour alone"* — so no arm may be renderable as a
 * mark alone, and the type is what makes that true rather than a convention somebody keeps.
 */
export type RunFact =
  /** It ran. `when` is `null` when the feed carried a status but no readable instant. */
  | { kind: "ran"; outcome: RunOutcome; when: string | null; word: string }
  /** The backend looked and there is no run. NOT the same as `unknown`. */
  | { kind: "never"; word: string }
  /** The wire did not say — or said something this build cannot read. NOT the same as `never`. */
  | { kind: "unknown"; word: string }

/**
 * The three TERMINAL statuses, keyed by the database spelling — which is the only place it
 * appears in this module, and it appears as an INPUT KEY rather than as any returned value.
 *
 * Deliberately NOT total over the status column: the in-flight three (`active`, `paused`,
 * `cap_paused`) are absent on purpose, so they take the honest default below rather than
 * asserting an outcome that has not happened yet.
 */
const OUTCOME: Record<string, RunOutcome> = {
  completed: "worked",
  failed: "failed",
  cancelled: "stopped",
}

/** The word each outcome leads with. `satisfies` makes a fourth outcome a typecheck error. */
const OUTCOME_WORD = {
  worked: RUN_WORKED,
  failed: RUN_FAILED,
  stopped: RUN_STOPPED,
} as const satisfies Record<RunOutcome, string>

/**
 * Read one entry out of a status-keyed table SAFELY — see the ⚠ own-property paragraph in this
 * file's header. `hasOwnProperty.call` rather than `in`, so an inherited member is invisible.
 */
function ownOutcome(status: string): RunOutcome | undefined {
  return Object.prototype.hasOwnProperty.call(OUTCOME, status) ? OUTCOME[status] : undefined
}

/**
 * runFacts — resolve one row's run truth. Pure, O(1), and TOTAL over every value the two wire
 * fields can hold.
 *
 * The order of the tests below is the contract, and it is not interchangeable:
 *
 *  1. `lastRunStatus === undefined` → `unknown`. The key was absent from the payload. This is
 *     FIRST because it is the stale-deploy case and it must not fall through to anything that
 *     reads the timestamp.
 *  2. `lastRunStatus === null` → `never`. The backend joined and found no run row. A stronger
 *     fact than (1) and a different sentence.
 *  3. an unrecognised or blank status → `unknown`. T-15: never success, by default.
 *  4. a terminal status → `ran`, with a band if the instant is readable and `null` if it is not.
 *
 * @param row the normalized library row. Only its two run fields are read.
 * @param now the instant to measure recency against — hoist one per render (P-1).
 */
export function runFacts(row: LibraryRow, now: number = Date.now()): RunFact {
  const status = row.lastRunStatus

  // (1) the wire did not say — the key is absent from the payload entirely.
  if (status === undefined) return { kind: "unknown", word: RUN_UNKNOWN }

  // (2) the backend looked and there is no run. The never-run arm.
  if (status === null) return { kind: "never", word: RUN_NEVER }

  // (3) a status this build does not recognise, or an empty one. NEVER success.
  const outcome = ownOutcome(status)
  if (outcome === undefined) return { kind: "unknown", word: RUN_UNKNOWN }

  // (4) it ran. The band is `null` when the instant is absent or unreadable, and the word then
  // carries the outcome ALONE — which is honest, where a fabricated time would not be.
  const when = relativeBand(row.lastRunAt, now)
  const lead = OUTCOME_WORD[outcome]

  return { kind: "ran", outcome, when, word: when === null ? lead : `${lead} ${when}` }
}
