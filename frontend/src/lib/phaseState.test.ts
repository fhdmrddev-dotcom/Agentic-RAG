/**
 * Phase 188 Plan 05 (RUNVIZ-01 / RUNVIZ-02 — SPEC Req 3, Req 4, Req 8) — the fence
 * around the ONE phase-state derivation.
 *
 * Four properties are measured here, and the fifth block is what stops the other four
 * being quietly bypassed by a second derivation appearing somewhere else:
 *
 *   1. TOTALITY — `phaseStatusFromDb` returns a real client status for every string,
 *      and its fallback is the honest unknown, never success (Req 3).
 *   2. THE SUBSET PROPERTY — everything the canvas can paint is producible by a
 *      reconcile, so the canvas never paints a state a reload cannot restore. This is
 *      why `retrying` is not a `CanvasReading` value at all (Req 4 / D-188-03).
 *   3. PRECEDENCE — no phase at all is `not-started` (a KNOWN state), never `unknown`;
 *      and a pending ask outranks every status.
 *   4. PARITY — the developer panel and the business canvas read the SAME source
 *      value. Two vocabularies, one derivation (Req 1 / D-188-02).
 *   5. THE SOURCE FENCE — exactly one import, exactly one declaration of each
 *      function, and zero vocabulary in the module (Req 8's acceptance).
 *
 * The module's own source is read with Vite's `?raw` loader, never the node fs sync
 * read: `tsconfig.app.json` gives tests no `node` types, so that call does not even
 * typecheck here, and `frontend/src` contains zero source fences built on it (the
 * `PublishGauntlet.test.tsx:38-46` note). The token itself is deliberately NOT spelled
 * anywhere in this file — a comment quoting what a grep forbids makes the grep vacuous
 * (187-24, and 188-02 had to reword for exactly this reason).
 *
 * EVERY absence assertion below carries a POSITIVE CONTROL proving the needle can
 * match, so an absence is a measurement rather than a tautology. Every needle literal
 * is ASSEMBLED FROM PARTS so this file's own source can never satisfy a grep run over
 * it (the 187-24 lesson).
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 */
import { describe, it, expect } from "vitest"
import type { Phase } from "@/types"
import phaseStateSource from "./phaseState?raw"
import {
  DB_PHASE_STATUS,
  phaseStatusFromDb,
  canvasReading,
  TERMINAL_RUN_STATUSES,
  type CanvasReading,
} from "./phaseState"

// ── Fixtures ────────────────────────────────────────────────────────────────────
//
// Minimal Phase factory — only the two fields `canvasReading` reads matter, but the
// whole interface is satisfied so a later field addition surfaces here at compile time.
function mkPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    slug: "collect-inputs",
    phaseIndex: 0,
    phaseType: "programmatic",
    status: "pending",
    subAgents: [],
    pendingAsk: null,
    ...overrides,
  }
}

/**
 * The paintable readings, declared as an EXHAUSTIVE `Record<CanvasReading, …>` so the
 * compiler — not this comment — is what keeps the list in step with the union. Adding a
 * reading without touching this file is a typecheck error.
 *
 * 189-08 (CONN-01 / D-07): the forcing FIRED. `"recorded-not-sent"` was added to
 * `CanvasReading` and this table stopped typechecking until the row below landed —
 * recorded here because that is the mechanism the union widening exists for, and an
 * unrecorded forcing looks identical to a table someone remembered to update.
 */
const PAINTABLE_TABLE: Record<CanvasReading, true> = {
  "not-started": true,
  running: true,
  done: true,
  failed: true,
  skipped: true,
  "waiting-for-you": true,
  "recorded-not-sent": true,
  unknown: true,
}
const PAINTABLE = new Set<string>(Object.keys(PAINTABLE_TABLE))

/**
 * Every member of `Phase["status"]`, enumerated the same compiler-forced way.
 *
 * ⚠ This is the stand-in for reading the developer panel's own key set: `STATUS_META`
 * (`components/panel/PhaseCard.tsx:67`) is NOT exported, so it cannot be imported here.
 * It is declared `Record<Phase["status"], StatusMeta>`, which means the COMPILER is
 * already the panel's parity guarantee — the panel physically cannot be missing a key
 * for a status this derivation can produce. This table asserts the other half: that
 * every value `phaseStatusFromDb` yields is a member of that same union.
 */
const ALL_PHASE_STATUSES: Record<Phase["status"], true> = {
  pending: true,
  running: true,
  done: true,
  failed: true,
  retrying: true,
  skipped: true,
  "recorded-not-sent": true,
  unknown: true,
}
const PHASE_STATUSES = Object.keys(ALL_PHASE_STATUSES) as Phase["status"][]

/** The expected reading for each member of the union — the collapse rule, tabulated. */
const EXPECTED_READING: Record<Phase["status"], CanvasReading> = {
  pending: "not-started",
  running: "running",
  retrying: "running",
  done: "done",
  failed: "failed",
  skipped: "skipped",
  // 189-08 (D-07): its own reading, spelled identically to its status. NOT `done`.
  "recorded-not-sent": "recorded-not-sent",
  unknown: "unknown",
}

/**
 * The `workflow_phases_status_check` values, each with the client status it maps to and
 * the reading the canvas then paints. One table drives totality AND parity, so the two
 * blocks cannot disagree about what the server can send.
 *
 * The sixth row arrived with migration 115 (189-06). ⚠ Its first column is the SNAKE_CASE
 * DATABASE SLUG and its second is the KEBAB CLIENT MEMBER — D-17, and they are different
 * spellings on purpose. A row that used one spelling for both would be testing a map that
 * does not exist.
 */
const DB_TABLE = [
  ["pending", "pending", "not-started"],
  ["active", "running", "running"],
  ["completed", "done", "done"],
  ["failed", "failed", "failed"],
  ["skipped", "skipped", "skipped"],
  ["recorded_not_sent", "recorded-not-sent", "recorded-not-sent"],
] as const satisfies ReadonlyArray<readonly [string, Phase["status"], CanvasReading]>

// Unmapped inputs, ASSEMBLED so this file's source carries no bare status literal a
// later fence could trip over (187-24).
const UNMAPPED = ["quaran", "tined"].join("")
const UNMAPPED_CASED = ["COMPL", "ETED"].join("")
const PROTOTYPE_KEY = ["const", "ructor"].join("")
const PROTOTYPE_KEY_2 = ["__pro", "to__"].join("")
const PROTOTYPE_KEY_3 = ["toStr", "ing"].join("")

// ── 1. TOTALITY (SPEC Req 3) ────────────────────────────────────────────────────

describe("phaseStatusFromDb — total over every string, and never claims success", () => {
  for (const [dbValue, clientStatus] of DB_TABLE) {
    it(`maps the server value at index ${DB_TABLE.findIndex((r) => r[0] === dbValue)} to its client status`, () => {
      expect(phaseStatusFromDb(dbValue)).toBe(clientStatus)
    })
  }

  it("resolves an unmapped status to unknown — and explicitly NOT to done (Req 3)", () => {
    expect(phaseStatusFromDb(UNMAPPED)).toBe("unknown")
    // THE FALSIFICATION THIS FUNCTION EXISTS FOR. Success is never INFERRED from a
    // value this client cannot name; the shipped code read the completed status here
    // until 188-02, which is the publish gauntlet's `findIndex → -1` fail-open, third
    // occurrence.
    expect(phaseStatusFromDb(UNMAPPED), "an unrecognised server status is never success").not.toBe(
      "done",
    )
  })

  it("is case-SENSITIVE — a differently-cased known value is still unknown, not success", () => {
    expect(phaseStatusFromDb(UNMAPPED_CASED)).toBe("unknown")
    expect(phaseStatusFromDb(UNMAPPED_CASED)).not.toBe("done")
    // POSITIVE CONTROL — the lower-cased form of the SAME string does map, so the
    // assertion above measures the casing and not a broken lookup.
    expect(phaseStatusFromDb(UNMAPPED_CASED.toLowerCase())).toBe("done")
  })

  it("is total over the empty string and whitespace", () => {
    expect(phaseStatusFromDb("")).toBe("unknown")
    expect(phaseStatusFromDb("   ")).toBe("unknown")
  })

  it("is total over INHERITED object keys — a prototype name is not a status", () => {
    // A plain object literal inherits `constructor`, `toString`, `__proto__` &c. A bare
    // index-and-coalesce therefore returns a FUNCTION (or Object.prototype) for these,
    // typed as a status — which would then miss the panel's STATUS_META lookup and
    // crash the card on `.glyph`. Unreachable from the CHECK-constrained column today,
    // which is exactly the argument under which every fail-open in this codebase has
    // shipped. Totality is a property of the function, not of its current callers.
    for (const key of [PROTOTYPE_KEY, PROTOTYPE_KEY_2, PROTOTYPE_KEY_3]) {
      expect(phaseStatusFromDb(key), `${key} is not a phase status`).toBe("unknown")
      expect(typeof phaseStatusFromDb(key)).toBe("string")
    }
    // POSITIVE CONTROL — the inherited members really are reachable by index on a
    // plain object literal, so the three assertions above are measuring something.
    expect(({} as Record<string, unknown>)[PROTOTYPE_KEY_3]).toBeDefined()
  })

  it("yields ONLY members of the Phase status union, for every input tried", () => {
    const tried = [...DB_TABLE.map((r) => r[0]), UNMAPPED, UNMAPPED_CASED, "", PROTOTYPE_KEY]
    for (const raw of tried) {
      expect(PHASE_STATUSES, `${raw} produced a value outside the union`).toContain(
        phaseStatusFromDb(raw),
      )
    }
  })
})

// ── 1b. THE SIXTH SLUG (Phase 189 Plan 08 — CONN-01 / D-07 / D-17) ──────────────
//
// ⚠ THE BASELINE THIS BLOCK SUPERSEDES, MEASURED BEFORE IT WAS WRITTEN. At HEAD, the
// slug missed `phaseStatusFromDb`'s own-property guard, resolved to `unknown`, fell
// through `canvasReading`'s `default:` to `unknown`, and rendered as the canvas's honest
// unknown word — NEVER as success. That is why migration 115 was free to land a wave
// ahead of any client vocabulary, and it is the floor these cases must not regress into a
// claim of success. The observation was driven (a temporary probe asserting
// `phaseStatusFromDb("recorded_not_sent") === "unknown"` PASSED against this tree) and is
// recorded in `189-08-SUMMARY.md`.
//
// Both NEGATIVES are asserted explicitly. Asserting only the positive would still pass if
// the value were ALSO aliased to `done` somewhere — which is exactly this phase's stated
// failure mode: a governed step that sent nothing reading as one that succeeded.

describe("the sixth DB slug — its OWN status, neither success nor unreadable", () => {
  it("resolves to its own client member, and explicitly NOT to done or unknown", () => {
    expect(phaseStatusFromDb("recorded_not_sent")).toBe("recorded-not-sent")
    expect(
      phaseStatusFromDb("recorded_not_sent"),
      "a step that deliberately sent nothing must never read as one that succeeded",
    ).not.toBe("done")
    expect(
      phaseStatusFromDb("recorded_not_sent"),
      "the slug is now RECOGNISED — leaving it on the unknown floor would lose D-07",
    ).not.toBe("unknown")
  })

  it("keeps the unknown FLOOR intact for a status nobody ships", () => {
    // The floor is the half of D-07 that a widening is likeliest to quietly delete: it is
    // tempting to read "the map is now complete" as "the fallback is now dead code".
    expect(phaseStatusFromDb("a_status_nobody_ships")).toBe("unknown")
    expect(phaseStatusFromDb("a_status_nobody_ships")).not.toBe("done")
    expect(phaseStatusFromDb("a_status_nobody_ships")).not.toBe("recorded-not-sent")
    // …and the same floor one derivation further on: an unrecognised status still paints
    // as the unknown reading, never as the new one and never as success.
    const unrecognised = canvasReading(
      mkPhase({ status: "a_status_nobody_ships" as unknown as Phase["status"] }),
    )
    expect(unrecognised).toBe("unknown")
    expect(unrecognised).not.toBe("done")
    expect(unrecognised).not.toBe("recorded-not-sent")
  })

  it("paints its OWN reading — and a pending ask still outranks it", () => {
    expect(canvasReading(mkPhase({ status: "recorded-not-sent" }))).toBe("recorded-not-sent")
    expect(canvasReading(mkPhase({ status: "recorded-not-sent" }))).not.toBe("done")
    // The precedence ABOVE the switch is unchanged by the new arm. A step blocked on the
    // user is blocked on the user whatever its row says — including this row.
    expect(
      canvasReading(mkPhase({ status: "recorded-not-sent", pendingAsk: "Which supplier?" })),
    ).toBe("waiting-for-you")
  })

  it("still refuses an INHERITED prototype key now that the map has grown", () => {
    // Pinned again HERE, beside the growth, rather than trusted from the block above: the
    // own-property guard is what makes `DB_PHASE_STATUS` safe to enlarge at all, and a
    // future widening that "simplifies" it back to `TABLE[raw] ?? "unknown"` would pass
    // every positive case in this file and hand back `[Function Object]` for this one.
    expect(phaseStatusFromDb(PROTOTYPE_KEY)).toBe("unknown")
    expect(phaseStatusFromDb(PROTOTYPE_KEY)).not.toBe("recorded-not-sent")
    expect(typeof phaseStatusFromDb(PROTOTYPE_KEY)).toBe("string")
    // POSITIVE CONTROL — the inherited member really is reachable by index on a plain
    // object literal, so the refusal above is a measurement.
    expect((DB_PHASE_STATUS as Record<string, unknown>)[PROTOTYPE_KEY]).toBeDefined()
  })
})

// ── 2. THE Req-4 SUBSET PROPERTY (D-188-03) ─────────────────────────────────────

describe("canvasReading — the canvas can only paint what a reconcile can restore", () => {
  it("lands inside the paintable set for every RECONCILABLE status", () => {
    // Exactly the statuses a reconcile can produce: the five mapped values plus the
    // honest fallback. Built from the shipped map, never re-typed.
    const RECONCILABLE = new Set<Phase["status"]>([
      ...(Object.values(DB_PHASE_STATUS) as Phase["status"][]),
      "unknown",
    ])
    // 6 → 7 at 189-08: the sixth CHECK literal maps to a sixth distinct client status,
    // plus the honest fallback. Derived from the shipped map, so it moves with it.
    expect(RECONCILABLE.size).toBe(7)
    for (const status of RECONCILABLE) {
      expect(PAINTABLE.has(canvasReading(mkPhase({ status })))).toBe(true)
    }
  })

  it("never paints retrying — it is not a CanvasReading value at all", () => {
    expect([...PAINTABLE]).not.toContain("retrying")
    // POSITIVE CONTROL — the membership check does find a reading that IS in the set,
    // so the absence above is a measurement and not a broken assertion.
    expect([...PAINTABLE]).toContain("running")
    expect(PAINTABLE.size).toBe(8) // 7 → 8 at 189-08 (D-07)
  })

  it("makes retrying INDISTINGUISHABLE from running by construction (D-188-03)", () => {
    const retrying = canvasReading(mkPhase({ status: "retrying" }))
    const running = canvasReading(mkPhase({ status: "running" }))
    expect(retrying).toBe("running")
    expect(retrying).toBe(running)
    // The pair is what makes the absence above meaningful: `retrying` is not dropped,
    // it is COLLAPSED, and the collapse happens in one named place.
  })

  it("handles every member of the status union without falling outside the set", () => {
    for (const status of PHASE_STATUSES) {
      const reading = canvasReading(mkPhase({ status }))
      expect(PAINTABLE.has(reading), `${status} produced an unpaintable reading`).toBe(true)
      expect(reading).toBe(EXPECTED_READING[status])
    }
  })
})

// ── 3. PRECEDENCE ───────────────────────────────────────────────────────────────

describe("canvasReading — precedence: absence is known, a pending ask outranks all", () => {
  it("reads a MISSING phase as not-started, never unknown", () => {
    expect(canvasReading(undefined)).toBe("not-started")
    // A definition node with no matching run row is a step the harness has not reached
    // — a KNOWN state. Conflating it with `unknown` would make the one reading that
    // means "we cannot tell" the most common thing on a fresh canvas, and would lose
    // Req 3's requirement that unknown stay visually distinct from not-started.
    expect(canvasReading(undefined), "an un-started node is not an unreadable one").not.toBe(
      "unknown",
    )
  })

  it("reads an EXISTING row with an unrecognised status as unknown", () => {
    // The contrast that gives the assertion above its meaning: `unknown` is reserved
    // for a row that exists and carries a status this client does not recognise.
    expect(canvasReading(mkPhase({ status: "unknown" }))).toBe("unknown")
    expect(canvasReading(mkPhase({ status: "unknown" }))).not.toBe("not-started")
  })

  it("lets a pending ask outrank a done status", () => {
    expect(canvasReading(mkPhase({ status: "done", pendingAsk: "Which supplier?" }))).toBe(
      "waiting-for-you",
    )
  })

  it("lets a pending ask outrank a failed status", () => {
    expect(canvasReading(mkPhase({ status: "failed", pendingAsk: "Which supplier?" }))).toBe(
      "waiting-for-you",
    )
  })

  it("lets a pending ask outrank EVERY member of the status union", () => {
    for (const status of PHASE_STATUSES) {
      expect(
        canvasReading(mkPhase({ status, pendingAsk: "Which supplier?" })),
        `${status} should still be waiting on the user`,
      ).toBe("waiting-for-you")
    }
  })

  it("treats a null pendingAsk as no ask, and an EMPTY-STRING ask as an ask", () => {
    // POSITIVE CONTROL for the block above — without this, every assertion there is
    // consistent with the function simply always returning the waiting reading.
    expect(canvasReading(mkPhase({ status: "done", pendingAsk: null }))).toBe("done")
    // `!= null` is the shipped predicate, so an empty ask string still means the step
    // is blocked on the user. Pinned deliberately: a `pendingAsk` truthiness check
    // would silently un-block a step whose question failed to render.
    expect(canvasReading(mkPhase({ status: "done", pendingAsk: "" }))).toBe("waiting-for-you")
  })
})

// ── 4. PARITY WITH THE DEVELOPER VIEW (SPEC Req 1 / D-188-02) ───────────────────

describe("parity — two vocabularies, ONE derivation", () => {
  for (const [dbValue, clientStatus, reading] of DB_TABLE) {
    it(`derives one value that both views read, for server row #${DB_TABLE.findIndex((r) => r[0] === dbValue)}`, () => {
      // The whole parity claim in three lines: the server value produces a client
      // status; that status is a member of the union the panel's STATUS_META is keyed
      // by (compiler-enforced there — see ALL_PHASE_STATUSES above); and the canvas
      // reading is a function of THAT SAME value, with no second mapping in between.
      const status = phaseStatusFromDb(dbValue)
      expect(status).toBe(clientStatus)
      expect(PHASE_STATUSES).toContain(status)
      expect(canvasReading(mkPhase({ status }))).toBe(reading)
    })
  }

  it("keeps the panel's union and the canvas's readings the same SIZE, eight each", () => {
    // Not the same VALUES — that is the point of D-188-02. The panel says one thing
    // about a step the engine has not unlocked and the canvas says another; both are
    // functions of one derivation. Equal cardinality is the shape of that mapping.
    // 7 → 8 at 189-08: BOTH unions grew by exactly one, together, which is what keeps
    // the mapping a mapping rather than letting the canvas quietly lose a state.
    expect(PHASE_STATUSES).toHaveLength(8)
    expect(PAINTABLE.size).toBe(8)
    // …and the mapping is NOT the identity: two statuses collapse into one reading,
    // so one reading has no status of its own.
    expect(new Set(Object.values(EXPECTED_READING)).size).toBe(7)
  })

  it("exposes exactly the workflow_phases_status_check keys, no more", () => {
    expect(Object.keys(DB_PHASE_STATUS).sort()).toStrictEqual(
      DB_TABLE.map((r) => r[0])
        .slice()
        .sort(),
    )
  })
})

// ── 5. THE SOURCE FENCE (SPEC Req 8 acceptance) ─────────────────────────────────
//
// Needles are ASSEMBLED FROM PARTS so this file's own source cannot satisfy a grep run
// over it (the 187-24 lesson), and every absence assertion carries a positive control.

const TYPES_MODULE = ["@/ty", "pes"].join("")
const API_MODULE = ["@/lib", "/api"].join("")
const PROVIDERS_PREFIX = ["@/pro", "viders/"].join("")
const COMPONENTS_PREFIX = ["@/comp", "onents/"].join("")
const DECL_READING = ["export function ", "canvasReading"].join("")
const DECL_FROM_DB = ["export function ", "phaseStatusFromDb"].join("")
const PANEL_WORD_LOCKED = ["Loc", "ked"].join("")
const PANEL_WORD_RUNNING = ["Runn", "ing"].join("")
const PANEL_WORD_COMPLETE = ["Comp", "lete"].join("")
const CANVAS_WORD_NOT_STARTED = ["Not ", "started"].join("")
const CANVAS_WORD_WAITING = ["Paused for ", "your answer"].join("")
const CANVAS_WORD_UNKNOWN = ["State ", "unknown"].join("")
const CLASS_TOKEN = ["te", "xt-"].join("")
const COLOR_FN = ["hs", "l("].join("")
const TIMED_OUT = ["timed", "_out"].join("")
const RUNS_CHECK = ["workflow_runs", "_status_check"].join("")

/** An import statement for `mod`, built at runtime — the positive-control sample. */
const sampleImport = (mod: string) => ["import { x } from ", '"', mod, '"'].join("")
const importFrom = (mod: string) => new RegExp(`from\\s+["']${mod}`)

describe("phaseState — source fence: one import, one declaration each, zero vocabulary", () => {
  it("declares EXACTLY ONE import, and it is the types module", () => {
    const importLines = phaseStateSource.match(/^import .*$/gm) ?? []
    expect(importLines).toHaveLength(1)
    expect(importLines[0]).toContain(TYPES_MODULE)
    // That single import is what makes an ESM cycle impossible by construction — the
    // types module imports nothing from the app, so both the panel tree and the canvas
    // tree can consume this one safely.
  })

  it("imports nothing from the api client, no provider and no component", () => {
    for (const mod of [API_MODULE, PROVIDERS_PREFIX, COMPONENTS_PREFIX]) {
      expect(phaseStateSource, `${mod} must not be reachable from a lib module`).not.toMatch(
        importFrom(mod),
      )
      // POSITIVE CONTROL — the needle really does match an import of that module, so
      // its absence above is a measurement and not a tautology.
      expect(sampleImport(mod)).toMatch(importFrom(mod))
    }
  })

  it("declares canvasReading EXACTLY ONCE", () => {
    const decls = phaseStateSource.match(new RegExp(DECL_READING, "g")) ?? []
    expect(decls).toHaveLength(1)
    // POSITIVE CONTROL — the needle matches a real declaration line.
    expect([DECL_READING, "(phase: Phase | undefined)"].join("")).toMatch(
      new RegExp(DECL_READING),
    )
  })

  it("declares phaseStatusFromDb EXACTLY ONCE", () => {
    const decls = phaseStateSource.match(new RegExp(DECL_FROM_DB, "g")) ?? []
    expect(decls).toHaveLength(1)
    expect([DECL_FROM_DB, "(raw: string)"].join("")).toMatch(new RegExp(DECL_FROM_DB))
  })

  it("holds NO vocabulary — not the panel's words, not the canvas's", () => {
    // Req 8's acceptance is zero local re-derivations, NOT identical strings. The two
    // views are SUPPOSED to say different things; the module they share must therefore
    // say nothing at all.
    const words = [
      PANEL_WORD_LOCKED,
      PANEL_WORD_RUNNING,
      PANEL_WORD_COMPLETE,
      CANVAS_WORD_NOT_STARTED,
      CANVAS_WORD_WAITING,
      CANVAS_WORD_UNKNOWN,
    ]
    for (const word of words) {
      expect(phaseStateSource, `${word} is presentation, not derivation`).not.toContain(word)
    }
    // POSITIVE CONTROL — every needle matches a sample carrying it, so six absences
    // are six measurements.
    const sample = words.join(" · ")
    for (const word of words) expect(sample).toContain(word)
  })

  it("holds NO styling — no class token, no colour function", () => {
    expect(phaseStateSource).not.toContain(CLASS_TOKEN)
    expect(phaseStateSource).not.toContain(COLOR_FN)
    // POSITIVE CONTROL for both needles.
    const sample = [CLASS_TOKEN, "foreground ", COLOR_FN, "220 30% 100%)"].join("")
    expect(sample).toContain(CLASS_TOKEN)
    expect(sample).toContain(COLOR_FN)
  })

  it("carries timed_out forward UNCHANGED, with the measurement on record (D-188-21)", () => {
    expect(TERMINAL_RUN_STATUSES.has(TIMED_OUT)).toBe(true)
    expect(TERMINAL_RUN_STATUSES.size).toBe(4)
    // The deferral's re-open trigger was "someone measures it". The docblock records
    // that measurement by naming the CHECK constraint the value is absent from, so a
    // later phase can retire the member in one line with evidence rather than by
    // re-deriving it. This assertion is what keeps the evidence attached to the value.
    expect(phaseStateSource).toContain(RUNS_CHECK)
  })
})
