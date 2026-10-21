/**
 * Phase 290-01 (VIS-01) — the team picture's vocabulary leaf.
 *
 * Exact-match assertions only (`toBe`, never `toContain` on words): a copy change is meant to
 * turn this file red, so the change is a decision rather than a drift. Every negative fence
 * below carries a positive control, so a matcher that cannot match cannot pass vacuously.
 */
import { describe, it, expect } from "vitest"

import * as teamVocabulary from "./teamVocabulary"
import teamVocabularySource from "./teamVocabulary?raw"
import {
  FAIL_ASK,
  FAIL_JUMP_MISSING,
  FAIL_LEAD,
  FAIL_STOP,
  GATE_ARMED_WORDS,
  GATE_CHECK,
  GATE_JUDGE,
  GATE_KIND_MISSING,
  GATE_KIND_WORDS,
  JUMP_LINE_LABEL,
  LEDGER_HEADING,
  LEDGER_NO_LINKS,
  ORCHESTRATOR_EYEBROW,
  ORCHESTRATOR_SUB,
  ORCHESTRATOR_SUB_ONE,
  TEAM_CAPTION,
  TEAM_EMPTY_BODY,
  TEAM_EMPTY_HEADING,
  TEAM_HEADER_HINT,
  TEAM_NO_GATES,
  TEAM_NO_JUDGE,
  TEAM_ONE_STEP,
  TEAM_STEP_UNTYPED,
  TEAM_SWITCH_LABEL,
  TEAM_SWITCH_STEPS,
  TEAM_SWITCH_TEAM,
  failJump,
  failRedoThen,
  gateEyebrow,
  ledgerGate,
  ledgerHandoff,
  ledgerJump,
  ledgerSeats,
  orchestratorTitle,
  seatsLabel,
  teamFigureLabel,
} from "./teamVocabulary"

/** Assemble a searched token so no retired word is a contiguous literal in this file. */
const tok = (...parts: string[]): string => parts.join("")

// ── 1. the constants, verbatim ────────────────────────────────────────────────────────────

describe("teamVocabulary — the constants, character for character", () => {
  it("the switch and header strings", () => {
    expect(TEAM_SWITCH_LABEL).toBe("Show steps or team")
    expect(TEAM_SWITCH_STEPS).toBe("Steps")
    expect(TEAM_SWITCH_TEAM).toBe("Team")
    expect(TEAM_HEADER_HINT).toBe("who does each step, and what checks it")
    expect(teamFigureLabel("Vendor risk review")).toBe("Team picture for Vendor risk review")
  })

  it("the orchestrator strings", () => {
    expect(ORCHESTRATOR_EYEBROW).toBe("Orchestrator")
    expect(ORCHESTRATOR_SUB).toBe(
      "Gives each step its turn and keeps one shared record. Every step reads what the earlier steps produced.",
    )
    expect(ORCHESTRATOR_SUB_ONE).toBe("Gives the step its turn and keeps what it produces.")
    expect(orchestratorTitle(1)).toBe("Syrel runs the one step")
    expect(orchestratorTitle(3)).toBe("Syrel runs the 3 steps in order")
  })

  it("the gate strings (D-16, D-17)", () => {
    expect(GATE_JUDGE).toBe("Judge")
    expect(GATE_CHECK).toBe("Check")
    expect(gateEyebrow(GATE_JUDGE, 3)).toBe("Judge · step 3")
    expect(gateEyebrow(GATE_CHECK, 1)).toBe("Check · step 1")
    expect(GATE_ARMED_WORDS).toBe("Stops and asks you before it acts")
    expect(GATE_KIND_MISSING).toBe("A check with no kind set")
  })

  it("the failure strings (D-10, D-19)", () => {
    expect(FAIL_LEAD).toBe("If it fails:")
    expect(FAIL_STOP).toBe("stop the run")
    expect(FAIL_ASK).toBe("ask you")
    expect(failRedoThen(1, FAIL_STOP)).toBe("redo the step (up to 1 time), then stop the run")
    expect(failRedoThen(2, FAIL_ASK)).toBe("redo the step (up to 2 times), then ask you")
    expect(failJump(5)).toBe("⤳ jump to step 5")
    expect(failRedoThen(2, failJump(4))).toBe("redo the step (up to 2 times), then ⤳ jump to step 4")
    expect(FAIL_JUMP_MISSING).toBe("jump to a step this workflow doesn't have, so the run stops")
    expect(JUMP_LINE_LABEL).toBe("⤳ only if the check fails")
  })

  it("the step, batch and absence strings (D-12, D-13, D-14)", () => {
    expect(TEAM_STEP_UNTYPED).toBe("A step with no type")
    expect(seatsLabel(20)).toBe("up to 20 at once")
    expect(seatsLabel(5)).toBe("up to 5 at once")
    expect(TEAM_ONE_STEP).toBe("One step, so there is no team to coordinate.")
    expect(TEAM_NO_GATES).toBe("Nothing checks this work.")
    expect(TEAM_NO_JUDGE).toBe("Checked by rule, not by a judge.")
    expect(TEAM_EMPTY_HEADING).toBe("No steps yet, so there is no team to show.")
    expect(TEAM_EMPTY_BODY).toBe("Add a step in Steps to see who does the work.")
    expect(TEAM_CAPTION).toBe(
      "Built from this workflow's definition. Steps never pass work to each other; each one reads what the earlier steps produced.",
    )
  })

  it("the ledger strings", () => {
    expect(LEDGER_HEADING).toBe("Every line on this picture")
    expect(LEDGER_NO_LINKS).toBe(
      "0 step-to-step links. The definition has no field for one, so none is drawn.",
    )
    expect(ledgerHandoff(1)).toBe("Orchestrator → step 1")
    expect(ledgerGate(GATE_JUDGE, 3)).toBe("Judge → step 3")
    expect(ledgerJump(2, 5)).toBe("⤳ step 2 → step 5, only if the check fails")
    expect(ledgerSeats(3, 5)).toBe("Step 3: up to 5 at once")
  })
})

// ── 2. GATE_KIND_WORDS ────────────────────────────────────────────────────────────────────

describe("GATE_KIND_WORDS — the ten ValidatorSpec kinds", () => {
  const KINDS = [
    "json_schema",
    "regex_match",
    "workspace_file_exists",
    "programmatic",
    "citations_required",
    "freshness",
    "structure_check",
    "output_file_valid",
    "llm_judge_rubric",
    "action_risk_approval",
  ]

  it("has exactly the 10 kinds as own keys", () => {
    expect(Object.keys(GATE_KIND_WORDS).sort()).toEqual([...KINDS].sort())
    for (const kind of KINDS) {
      expect(Object.prototype.hasOwnProperty.call(GATE_KIND_WORDS, kind), kind).toBe(true)
      expect(GATE_KIND_WORDS[kind].length, kind).toBeGreaterThan(0)
    }
  })

  it("citations_required reads the current words, not the retired badge (F-5)", () => {
    expect(GATE_KIND_WORDS.citations_required).toBe("Must point at the documents it used")
    const retired = tok("Must cite its ", "sources")
    // POSITIVE CONTROL — the detector finds the retired phrase when it is present.
    expect([`x ${retired} y`].some((w) => w.includes(retired))).toBe(true)
    expect(Object.values(GATE_KIND_WORDS).some((w) => w.includes(retired))).toBe(false)
  })

  it("every kind's words, verbatim", () => {
    expect(GATE_KIND_WORDS).toEqual({
      llm_judge_rubric: "Grades the work against a rubric",
      citations_required: "Must point at the documents it used",
      output_file_valid: "The file must open",
      regex_match: "Must match a set pattern",
      json_schema: "Must match a set shape",
      workspace_file_exists: "A named file must exist",
      freshness: "Its sources must be recent",
      structure_check: "Must have the right sections",
      programmatic: "A fixed check the server runs",
      action_risk_approval: "Asks you before it acts",
    })
  })
})

// ── 3. the formatters are total ───────────────────────────────────────────────────────────

describe("every formatter is total over hostile numbers", () => {
  const HOSTILE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0]

  const CALLS: { id: string; call: (n: number) => string }[] = [
    { id: "orchestratorTitle", call: (n) => orchestratorTitle(n) },
    { id: "gateEyebrow", call: (n) => gateEyebrow(GATE_CHECK, n) },
    { id: "failRedoThen", call: (n) => failRedoThen(n, FAIL_STOP) },
    { id: "failJump", call: (n) => failJump(n) },
    { id: "seatsLabel", call: (n) => seatsLabel(n) },
    { id: "ledgerHandoff", call: (n) => ledgerHandoff(n) },
    { id: "ledgerGate", call: (n) => ledgerGate(GATE_JUDGE, n) },
    { id: "ledgerJump", call: (n) => ledgerJump(n, n) },
    { id: "ledgerSeats", call: (n) => ledgerSeats(n, n) },
  ]

  it("returns a non-empty string for NaN, ±Infinity, -1 and 0, and never throws", () => {
    for (const { id, call } of CALLS) {
      for (const n of HOSTILE) {
        let out = ""
        expect(() => {
          out = call(n)
        }, `${id}(${n})`).not.toThrow()
        expect(typeof out, `${id}(${n})`).toBe("string")
        expect(out.length, `${id}(${n})`).toBeGreaterThan(0)
        expect(out, `${id}(${n})`).not.toMatch(/NaN|Infinity|-1/)
      }
    }
  })

  it("hostile numbers floor to 0; a fraction truncates", () => {
    expect(seatsLabel(Number.NaN)).toBe("up to 0 at once")
    expect(seatsLabel(-1)).toBe("up to 0 at once")
    expect(failRedoThen(Number.POSITIVE_INFINITY, FAIL_STOP)).toBe(
      "redo the step (up to 0 times), then stop the run",
    )
    expect(failRedoThen(1.5, FAIL_STOP)).toBe(failRedoThen(1, FAIL_STOP))
    expect(orchestratorTitle(1.9)).toBe(orchestratorTitle(1))
    // POSITIVE CONTROL — the output really changes with its argument.
    expect(seatsLabel(2)).not.toBe(seatsLabel(3))
  })

  it("every exported function is driven by this suite (totality, not a deny-list)", () => {
    const fns = Object.entries(teamVocabulary)
      .filter(([, value]) => typeof value === "function")
      .map(([id]) => id)
      .sort()
    expect(fns).toEqual([...CALLS.map((c) => c.id), "teamFigureLabel"].sort())
  })
})

// ── 4. the leaf property and the words it must not carry ──────────────────────────────────

describe("teamVocabulary — a TRUE LEAF that carries no step sentence and no seal label", () => {
  const ANY_IMPORT = /^\s*import\s/m
  const ANY_FROM = /from\s+["'][^"']+["']/
  const DYNAMIC_IMPORT = /import\s*\(/

  it("imports nothing at all", () => {
    // POSITIVE CONTROLS FIRST — each matcher is proven to match a planted string.
    expect('import type { X } from "./x"').toMatch(ANY_IMPORT)
    expect('import type { X } from "./x"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(teamVocabularySource).not.toMatch(ANY_IMPORT)
    expect(teamVocabularySource).not.toMatch(ANY_FROM)
    expect(teamVocabularySource).not.toMatch(DYNAMIC_IMPORT)
  })

  it("POSITIVE CONTROL — the loaded source really is this module", () => {
    expect(teamVocabularySource.length).toBeGreaterThan(1000)
    for (const id of Object.keys(teamVocabulary)) {
      expect(teamVocabularySource, id).toMatch(
        new RegExp(`export (const|function) ${id}\\b`),
      )
    }
  })

  it("no exported value is a shipped step sentence or the seal label (D-15)", () => {
    const forbidden = [
      tok("Work out how ", "to do it"),
      tok("Write it ", "up"),
      tok("Prepare the ", "inputs"),
      tok("Produce the ", "deliverable"),
      tok("Must prove ", "it"),
    ]
    const values = Object.values(teamVocabulary).filter(
      (v): v is string => typeof v === "string",
    )
    const kindWords = Object.values(GATE_KIND_WORDS)
    // POSITIVE CONTROL — the detector catches a planted forbidden value.
    expect([...values, forbidden[0]].some((v) => forbidden.includes(v))).toBe(true)
    expect([...values, ...kindWords].filter((v) => forbidden.some((f) => v.includes(f)))).toEqual(
      [],
    )
  })
})
