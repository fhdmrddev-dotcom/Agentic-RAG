/**
 * Phase 184-08 Task 1 (VALID-03 · D-182-06) — verdictModel tests.
 *
 * Two kinds of proof live here.
 *
 * 1. BEHAVIOURAL — grouping, precedence, counting and the locked two-count wording,
 *    including the totality cases (an unseen slug, an identifier this client has never
 *    seen, a severity outside the wire union, an empty list).
 * 2. STRUCTURAL — the `?raw` source guard (the `canvasModel.purity.test.ts:14-17` house
 *    idiom) proving the module contains no verdict-identifier table, opens no request
 *    and takes no RUNTIME dependency on the API client. Every negative assertion here
 *    carries a positive control, because a regex that cannot match anything satisfies
 *    every "not" perfectly.
 *
 * The forbidden identifiers are spelled in THIS file on purpose: they are the input to
 * the guard, and the guard reads the MODULE's source, never its own. That is the
 * D-ITEM-183-02 discipline — a fence must never force the file it protects to omit the
 * identifier its docblock needs, and it must never have to omit one itself.
 */
import { describe, it, expect } from "vitest"

import verdictModelSource from "./verdictModel?raw"
import { groupVerdicts, summaryLine, NOTHING_OUTSTANDING } from "./verdictModel"
// Phase 187-27 (GAP B) lands as a SEPARATE import statement so this file's whole diff is
// added lines only. Both names are read rather than re-typed: the record IS the union's
// membership list, and the sentence is the one the surface actually says.
import { DEGRADED_SENTENCE, type TrayCheckCause } from "./verdictModel"
import type { Verdict } from "@/lib/api"

/** A verdict exactly as the wire delivers one. Every field is the server's. */
function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    code: "no_terminal",
    phase: "summarize",
    message: "the workflow has no terminal phase",
    severity: "error",
    ...over,
  }
}

describe("verdictModel — grouping by the identity the server already guarantees", () => {
  it("buckets three phase-keyed verdicts across two slugs, plus one workflow-wide", () => {
    const groups = groupVerdicts([
      verdict({ code: "orphan_phase", phase: "draft", severity: "error" }),
      verdict({ code: "input_unsatisfied", phase: "draft", severity: "incomplete" }),
      verdict({ code: "no_terminal", phase: "summarize", severity: "incomplete" }),
      verdict({ code: "business_requirement", phase: null, severity: "incomplete" }),
    ])

    expect(groups.byPhase.size).toBe(2)
    expect(groups.byPhase.get("draft")).toHaveLength(2)
    expect(groups.byPhase.get("summarize")).toHaveLength(1)
    expect(groups.workflowWide).toHaveLength(1)
    expect(groups.workflowWide[0].code).toBe("business_requirement")
    // A workflow-wide finding is NOT also filed under a phase key.
    expect(groups.byPhase.has("")).toBe(false)
  })

  it("keeps every field of every verdict verbatim — nothing is rewritten", () => {
    const original = verdict({
      code: "unregistered_tool",
      phase: "gather",
      message: "tool 'summarise_pdf' is not registered",
      severity: "error",
    })
    const groups = groupVerdicts([original])
    const stored = groups.byPhase.get("gather")?.[0]
    expect(stored).toEqual(original)
    // By REFERENCE — the module copies no verdict and therefore cannot mutate one.
    expect(stored).toBe(original)
  })

  it("is total: an empty list groups to empty buckets and zero counts", () => {
    const groups = groupVerdicts([])
    expect(groups.byPhase.size).toBe(0)
    expect(groups.workflowWide).toEqual([])
    expect(groups.errorCount).toBe(0)
    expect(groups.incompleteCount).toBe(0)
    expect(groups.markFor("anything")).toBeUndefined()
  })
})

describe("verdictModel — markFor is PRECEDENCE over supplied values, never classification", () => {
  it("a slug carrying one error and one incomplete is marked error", () => {
    const groups = groupVerdicts([
      verdict({ phase: "draft", severity: "incomplete" }),
      verdict({ phase: "draft", severity: "error" }),
    ])
    expect(groups.markFor("draft")).toBe("error")
  })

  it("the harder severity wins regardless of arrival order", () => {
    const groups = groupVerdicts([
      verdict({ phase: "draft", severity: "error" }),
      verdict({ phase: "draft", severity: "incomplete" }),
    ])
    expect(groups.markFor("draft")).toBe("error")
  })

  it("a slug carrying two incompletes is marked incomplete", () => {
    const groups = groupVerdicts([
      verdict({ phase: "draft", severity: "incomplete" }),
      verdict({ phase: "draft", severity: "incomplete" }),
    ])
    expect(groups.markFor("draft")).toBe("incomplete")
  })

  it("a slug the server said nothing about has no mark at all", () => {
    const groups = groupVerdicts([verdict({ phase: "draft", severity: "error" })])
    expect(groups.markFor("summarize")).toBeUndefined()
  })

  it("a phase key matching no node on the canvas is still grouped, never dropped", () => {
    // Totality: the definition is author-supplied and the server validates the
    // definition it was HANDED. A key with no node is a tray row, not a crash.
    const groups = groupVerdicts([verdict({ phase: "a-step-that-was-deleted" })])
    expect(groups.byPhase.get("a-step-that-was-deleted")).toHaveLength(1)
    expect(groups.markFor("a-step-that-was-deleted")).toBe("error")
  })
})

describe("verdictModel — the counts READ severity, and change only when the response does", () => {
  it("counts the two severities verbatim", () => {
    const groups = groupVerdicts([
      verdict({ severity: "error" }),
      verdict({ severity: "incomplete", phase: "draft" }),
      verdict({ severity: "incomplete", phase: null }),
    ])
    expect(groups.errorCount).toBe(1)
    expect(groups.incompleteCount).toBe(2)
  })

  it("VALID-03: changing ONLY the server response changes the counts and the marks", () => {
    // Identical local state on both sides — the SAME slug, the same call, the same
    // module. The only thing that differs is the array the server sent.
    const before = groupVerdicts([verdict({ phase: "draft", severity: "incomplete" })])
    const after = groupVerdicts([verdict({ phase: "draft", severity: "error" })])

    expect(before.markFor("draft")).toBe("incomplete")
    expect(after.markFor("draft")).toBe("error")
    expect(before.errorCount).toBe(0)
    expect(after.errorCount).toBe(1)
  })
})

describe("verdictModel — a code or a severity this client has never seen", () => {
  it("an unrecognised CODE survives with its fields unchanged", () => {
    const future = verdict({
      code: "some_future_code",
      phase: "draft",
      message: "a rule that did not exist when this canvas shipped",
      severity: "error",
    })
    const groups = groupVerdicts([future])
    const stored = groups.byPhase.get("draft")?.[0]
    expect(stored?.code).toBe("some_future_code")
    expect(stored?.severity).toBe("error")
    expect(stored?.message).toBe("a rule that did not exist when this canvas shipped")
    expect(groups.errorCount).toBe(1)
  })

  it("an unrecognised SEVERITY survives verbatim AND fails closed at the mark", () => {
    // The wire type says two values; the wire itself is not bound by a TypeScript
    // union. A third value must not silently become the SOFT one — a surface that
    // reads an unknown severity as "not finished yet" is the "registry blip rendered
    // as a green light" failure sketch 139 names.
    const odd = { ...verdict({ phase: "draft" }), severity: "catastrophe" } as unknown as Verdict
    const groups = groupVerdicts([odd])
    expect(groups.byPhase.get("draft")?.[0].severity).toBe("catastrophe")
    expect(groups.markFor("draft")).toBe("error")
    expect(groups.errorCount).toBe(1)
    expect(groups.incompleteCount).toBe(0)
  })

  it("a workflow-wide verdict with an unrecognised code still has a home", () => {
    const groups = groupVerdicts([
      verdict({ code: "some_future_workflow_rule", phase: null, severity: "incomplete" }),
    ])
    expect(groups.workflowWide).toHaveLength(1)
    expect(groups.workflowWide[0].code).toBe("some_future_workflow_rule")
    expect(groups.incompleteCount).toBe(1)
  })
})

describe("verdictModel — summaryLine states the two severities in separate words", () => {
  const line = (errors: number, incompletes: number) => {
    const list: Verdict[] = []
    for (let i = 0; i < errors; i += 1) list.push(verdict({ phase: `e${i}`, severity: "error" }))
    for (let i = 0; i < incompletes; i += 1) {
      list.push(verdict({ phase: `n${i}`, severity: "incomplete" }))
    }
    return summaryLine(groupVerdicts(list))
  }

  it("renders the locked wording for 1 error + 2 incomplete", () => {
    expect(line(1, 2)).toBe("1 problem · 2 things to finish")
  })

  it("pluralises both halves independently", () => {
    expect(line(2, 1)).toBe("2 problems · 1 thing to finish")
    expect(line(1, 1)).toBe("1 problem · 1 thing to finish")
    expect(line(3, 3)).toBe("3 problems · 3 things to finish")
  })

  it("0 errors / 3 incomplete makes NO problem-count claim at all", () => {
    const text = line(0, 3)
    expect(text).toBe("3 things to finish")
    expect(text).not.toMatch(/problem/i)
    expect(text).not.toMatch(/\b0\b/)
  })

  it("2 errors / 0 incomplete makes no unfinished-count claim", () => {
    const text = line(2, 0)
    expect(text).toBe("2 problems")
    expect(text).not.toMatch(/finish/i)
    expect(text).not.toMatch(/\b0\b/)
  })

  it("an empty response claims only the STATIC half, never a publish", () => {
    expect(line(0, 0)).toBe(NOTHING_OUTSTANDING)
    expect(NOTHING_OUTSTANDING).toMatch(/static/i)
  })
})

/**
 * The source guards. `?raw` + a grep, each with a positive control proving the regex
 * is real. These are the machine-checkable half of D-182-06: the client renders the
 * server's vocabulary and owns none of it.
 */
describe("verdictModel — the D-182-06 fences (source guard)", () => {
  /** Every identifier the two backend lint modules and the route itself mint today.
   *  None of them may appear in the module — not in a table, not in a branch, not in
   *  a comment that would tempt the next author to add one. */
  const FORBIDDEN_CODES =
    /no_terminal|grounding_unavailable|business_requirement|orphan_phase|unregistered_tool|unregistered_skill|unsatisfiable_skip|input_unsatisfied|bad_index|folder_scope|interactive_phase/

  it("the module contains NO verdict-identifier table", () => {
    expect(verdictModelSource).not.toMatch(FORBIDDEN_CODES)
  })

  it("the control: that same regex DOES match a planted table", () => {
    // Without this, a typo in the pattern would make the fence above vacuous.
    expect('const PLAIN = { no_terminal: "…" }').toMatch(FORBIDDEN_CODES)
    expect('if (v.code === "grounding_unavailable") return "error"').toMatch(FORBIDDEN_CODES)
  })

  it("the module opens no request and reads no transport", () => {
    expect(verdictModelSource).not.toMatch(/fetch\(/)
    expect(verdictModelSource).not.toMatch(/XMLHttpRequest|EventSource|axios/)
    // Control.
    expect("const r = await fetch(url)").toMatch(/fetch\(/)
  })

  it("the API client is imported as a TYPE ONLY — never at runtime", () => {
    // Anchored on the VALUE-import form, and LINE-SCOPED. A type import is erased by
    // the compiler, so it creates no runtime edge; a value import would make a pure
    // grouping module depend on the transport layer.
    //
    // The line scoping is not cosmetic. Written as `[^;]*` the class matches newlines
    // too, so the module's own docblock sentence "a runtime import of the API client
    // appears here" bridged across twenty lines into the real type import and turned
    // the fence red — a guard that could only pass by deleting the paragraph
    // explaining it (D-ITEM-183-02, the trap this phase has now hit five times).
    const VALUE_IMPORT_FROM_API = /^import\s+(?!type\b)[^\n;]*from\s+["']@\/lib\/api["']/m
    expect(verdictModelSource).not.toMatch(VALUE_IMPORT_FROM_API)
    // Control: the regex matches a real value import…
    expect('import { validateWorkflow } from "@/lib/api"').toMatch(VALUE_IMPORT_FROM_API)
    // …and the type-only import IS present, so the module is not carrying a THIRD
    // declaration of a wire shape that already has one home.
    expect(verdictModelSource).toMatch(/import type \{ Verdict \} from "@\/lib\/api"/)
  })

  it("the module imports no store, no React and no component", () => {
    expect(verdictModelSource).not.toMatch(/from\s+["'][^"']*builderStore["']/)
    expect(verdictModelSource).not.toMatch(/from\s+["']react["']/)
    expect(verdictModelSource).not.toMatch(/useState|useEffect|createElement/)
    // Control.
    expect('import { useBuilderStore } from "@/components/workflows/builderStore"').toMatch(
      /from\s+["'][^"']*builderStore["']/,
    )
  })

  it("the module reads no DOM, no clock and no randomness", () => {
    expect(verdictModelSource).not.toMatch(/document\.|window\.|Date\.now|Math\.random/)
  })

  it("the ONLY severity literal in the module is the soft one", () => {
    // The hard severity is never compared against, because "not soft" is the
    // fail-closed read. If `"error"` ever appears as a comparison operand here, the
    // module has started classifying.
    expect(verdictModelSource).not.toMatch(/===\s*["']error["']/)
    expect(verdictModelSource).not.toMatch(/severity\s*===\s*["'](?!incomplete)/)
    // Control: the soft comparison IS there, exactly once as an operand.
    expect(verdictModelSource).toMatch(/verdict\.severity === SOFT_SEVERITY/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-27 (GAP B · VOCAB-02) — NEVER-RAN IS A CHECK STATE, AND IT HAS WORDS
//
// APPENDED; nothing above this line was edited except one added import statement.
//
// D-184-14's rule as SHIPPED covered `degraded` and did not cover never-ran. Opening an
// existing draft into the canvas issued ZERO `POST /workflows/validate` calls, and the
// tray said *"Nothing to fix — the static checks pass · checked by the server"* about a
// check nobody had made — for a definition the server marks `ok:false` the moment it is
// asked. That is the phase's own forbidden shape: *a check that did NOT RUN must never
// unblock a publish*.
//
// "Nobody has asked yet" is a MEMBER of the class the loop's union already names — *the
// check did not run* — not a competitor to it. So it rides that channel and earns the
// same treatment, and its sentence lives here beside the other two, because this module
// is the one home for every word a surface says ABOUT a check.
//
// EVERY COMPARISON IS AGAINST THE EXPORT (the 187-24 rule). A hand-typed copy keeps
// passing after the sentence is reworded, which is exactly the silent drift a one-home
// copy module exists to break.
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Anything that would let "nobody has asked" read as "we asked, and you are fine".
 *
 * A WORD CLASS, not a letter class: `\b` is applied wherever a word boundary is what is
 * actually meant, so `passenger` is not a pass claim and `broken` is not an "ok". The
 * negative controls below prove that, and the positive control — welded onto the SHIPPED
 * string rather than a convenient literal — proves the fence can fire at all.
 */
const PASS_CLAIM = /\bpass(es|ed)?\b|\bclean\b|\bfine\b|\bok\b|nothing to fix|checked by/i

describe("verdictModel — 187-27: the third check state and the words it may not say", () => {
  /** The union's members, READ from the total record rather than re-typed. Because
   *  `DEGRADED_SENTENCE` is declared `Record<TrayCheckCause, string>`, the compiler is
   *  the authority on this list: a member with no sentence is a typecheck error, so the
   *  iteration below can never be a stale hand-written trio. */
  const ALL_CAUSES = Object.keys(DEGRADED_SENTENCE) as TrayCheckCause[]

  it("DEGRADED_SENTENCE is TOTAL over the widened union, iterated rather than hand-looked-up", () => {
    // COMPILE-TIME HALF — a member added to `TrayCheckCause` without a sentence stops
    // this object being total, so this case cannot silently go out of date.
    const EXHAUSTIVE: Record<TrayCheckCause, true> = {
      unreadable: true,
      unreachable: true,
      "not-run": true,
    }
    expect([...ALL_CAUSES].sort()).toEqual(Object.keys(EXHAUSTIVE).sort())

    // RUNTIME HALF — every member the record declares answers a real sentence.
    for (const cause of ALL_CAUSES) {
      expect(typeof DEGRADED_SENTENCE[cause]).toBe("string")
      expect(DEGRADED_SENTENCE[cause].trim().length).toBeGreaterThan(0)
    }

    // …and no two members share a sentence: two different reasons a check produced no
    // answer must not read as the same reason.
    expect(new Set(ALL_CAUSES.map((c) => DEGRADED_SENTENCE[c])).size).toBe(ALL_CAUSES.length)
  })

  it("the third sentence is DISTINCT from both shipped ones AND from the clean line", () => {
    // By identity against the exports — never against a re-typed copy of any of them.
    expect(DEGRADED_SENTENCE["not-run"]).not.toBe(DEGRADED_SENTENCE.unreadable)
    expect(DEGRADED_SENTENCE["not-run"]).not.toBe(DEGRADED_SENTENCE.unreachable)
    expect(DEGRADED_SENTENCE["not-run"]).not.toBe(NOTHING_OUTSTANDING)
    expect(DEGRADED_SENTENCE["not-run"].trim()).not.toBe("")
  })

  it("it claims no pass and attributes nothing to the server — and neither does any sibling", () => {
    expect(DEGRADED_SENTENCE["not-run"]).not.toMatch(PASS_CLAIM)
    expect(DEGRADED_SENTENCE["not-run"]).not.toMatch(/\bserver\b/i)
    // The property is stated over the WHOLE union, so a fourth cause cannot arrive with
    // a pass claim in it and pass this file.
    for (const cause of ALL_CAUSES) {
      expect(DEGRADED_SENTENCE[cause]).not.toMatch(PASS_CLAIM)
      expect(DEGRADED_SENTENCE[cause]).not.toMatch(/\bserver\b/i)
    }
  })

  it("the CONTROLS — the class speaks about WORDS, and it provably fires", () => {
    // NEGATIVE controls: letters inside a longer word are not that word. Without these,
    // a `\b`-less pattern would look identical and quietly forbid ordinary English.
    expect("a passenger boarded").not.toMatch(PASS_CLAIM)
    expect("the pipe is broken").not.toMatch(PASS_CLAIM)
    expect("define the step").not.toMatch(PASS_CLAIM)
    expect("a cleanser").not.toMatch(PASS_CLAIM)
    expect("observer").not.toMatch(/\bserver\b/i)

    // POSITIVE controls, WELDED ONTO THE SHIPPED STRING — the fence is proved able to
    // fire on the very sentence it guards, not merely on a literal chosen to match.
    expect(`${DEGRADED_SENTENCE["not-run"]} Everything passed.`).toMatch(PASS_CLAIM)
    expect(`${DEGRADED_SENTENCE["not-run"]} · checked by the server`).toMatch(PASS_CLAIM)
    expect(`${DEGRADED_SENTENCE["not-run"]} the server said so`).toMatch(/\bserver\b/i)
    // …and the clean line, which DOES claim the static pass, is caught by the same class.
    expect(NOTHING_OUTSTANDING).toMatch(PASS_CLAIM)
  })
})
