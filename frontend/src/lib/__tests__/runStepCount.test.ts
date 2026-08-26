/**
 * Phase 194.1 Plan 06 Task 1 — the step-count derivation and the hoisted formatter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO PROPERTIES THIS FILE DEFENDS, AND WHY EACH NEEDS A TEST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. **`stepsFrom` is TOTAL over the `workflow_phases.status` vocabulary.** Not
 *    "handles the five I thought of" — total. The literal set is PARSED OUT OF
 *    `supabase/migrations/119_workflow_phases_cancelled.sql` at test time and the
 *    derivation is driven once per literal found. A hand-typed set would test the
 *    typing; this tests the schema. Two of the seven literals were added in
 *    Phase 189 and Phase 194 respectively, so a set typed in Phase 188 would still
 *    be green today and still be wrong.
 *
 * 2. **`fmtElapsed` was HOISTED, not rewritten.** The body is compared against a
 *    constant captured with
 *    `git show f9e55b6d…:frontend/src/pages/WorkflowRunPage.tsx | sed -n 195,201p`
 *    — read out of the tree, never re-typed — plus a behavioural table over all
 *    three branches and both boundaries.
 *
 * ⚠ THE MIGRATION IS READ WITH `?raw` AND ITS SQL COMMENTS ARE STRIPPED FIRST.
 * That is not tidiness. Migration 119's `ARRAY[…]` block interleaves `--` comment
 * lines with the literals, and one of those comments quotes a rendered sentence.
 * A parser that harvested quoted text from the raw block would be reading prose as
 * schema — the same shape as `194.1-BASELINE.md` §9 Trap 2 (a raw sweep redding on
 * the prose documenting the thing it sweeps for) and `194.1-02`'s `updated_at`
 * fence. The strip is asserted to still leave the literals behind, so it cannot
 * quietly cover for an empty parse.
 */
import { describe, it, expect } from "vitest"
import { stepsFrom } from "@/lib/runStepCount"
import { fmtElapsed } from "@/lib/fmtElapsed"
import type { WorkflowPhaseState } from "@/lib/api"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import migration119 from "../../../../supabase/migrations/119_workflow_phases_cancelled.sql?raw"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import.
import fmtElapsedSource from "@/lib/fmtElapsed.ts?raw"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import.
import runPageSource from "@/pages/WorkflowRunPage.tsx?raw"

// ─────────────────────────────────────────────────────────────────────────────
// The literal set, DERIVED from the migration rather than typed here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip SQL line comments. See the ⚠ in the docblock — the block being parsed
 * contains comments that quote a rendered sentence, and prose is not schema.
 *
 * ⚠ THE CHARACTER CLASS IS `[^\r\n]`, NOT `.`, AND THAT WAS FOUND BY THE STRIP
 * FAILING RATHER THAN BY READING IT. `supabase/migrations/*.sql` files in this
 * repo carry **CRLF** line terminators (`file` reports *"with CRLF line
 * terminators"`; `od -c` shows `\r \n`). JavaScript's `.` excludes `\r` as well as
 * `\n`, so the obvious `line.replace(/--.*$/, "")` matches `-- foo` and then fails
 * its own `$` against the trailing `\r` — and strips **NOTHING AT ALL**, silently,
 * on every line of every migration. The first form of this helper did exactly
 * that; the case below caught it. A comment stripper that strips nothing is worse
 * than no stripper, because the parse downstream then reads prose as schema while
 * reporting green.
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\r\n]*/g, "")
}

function parseStatusLiterals(sql: string): string[] {
  const code = stripSqlComments(sql)
  const block = code.match(
    /ADD CONSTRAINT workflow_phases_status_check CHECK \(\s*status = ANY \(ARRAY\[([\s\S]*?)\]\)/,
  )
  if (!block) return []
  return [...block[1].matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])
}

const STATUS_LITERALS = parseStatusLiterals(migration119 as string)

describe("194.1-06 — the migration parse is real before anything is derived from it", () => {
  it("the swept migration is non-empty and is the right file", () => {
    const src = migration119 as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(500)
    expect(src).toContain("workflow_phases_status_check")
  })

  it("the comment strip leaves the ARRAY literals behind (it is not eating the block)", () => {
    const code = stripSqlComments(migration119 as string)
    expect(code).toContain("'cancelled'::text")
    expect(code).toContain("'recorded_not_sent'::text")
    // …and it DID strip something, so the strip is not a no-op dressed as a guard.
    // This clause is the one that caught the CRLF trap documented on the helper:
    // with `.` instead of `[^\r\n]` the two sides below are IDENTICAL.
    expect(code.length).toBeLessThan((migration119 as string).length)
    expect(code).not.toContain("--")
    // The prose that must NOT reach the parser: migration 119's ARRAY block
    // interleaves a comment quoting a rendered sentence. It is gone from `code`
    // and PRESENT in the raw file, so this asserts the strip's reach rather than
    // its mere existence.
    expect(migration119 as string).toContain("no deliverable produced")
    expect(code).not.toContain("no deliverable produced")
  })

  it("parses EXACTLY SEVEN status literals, and names them", () => {
    // Asserted non-empty FIRST: an absence assertion over an empty parse is
    // vacuously true, which is the 192.1 empty-sweep failure.
    expect(STATUS_LITERALS.length).toBeGreaterThan(0)
    expect(STATUS_LITERALS).toHaveLength(7)
    // The set is asserted as a SET, so a re-ordering of the migration does not red.
    expect([...STATUS_LITERALS].sort()).toEqual(
      [
        "active",
        "cancelled",
        "completed",
        "failed",
        "pending",
        "recorded_not_sent",
        "skipped",
      ].sort(),
    )
  })

  it("the parser DOES find a planted eighth literal (positive control)", () => {
    const planted = (migration119 as string).replace(
      "'cancelled'::text",
      "'cancelled'::text, 'abandoned'::text",
    )
    expect(parseStatusLiterals(planted)).toHaveLength(8)
    expect(parseStatusLiterals(planted)).toContain("abandoned")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// stepsFrom — total over the parsed set
// ─────────────────────────────────────────────────────────────────────────────

function row(status: string, i = 0): WorkflowPhaseState {
  return { slug: `p-${i}`, phase_index: i, status }
}

describe("194.1-06 — stepsFrom is TOTAL over every literal migration 119 allows", () => {
  it.each(STATUS_LITERALS)(
    "a run of three phases whose third is `%s` counts it as completed IFF it is `completed`",
    (literal) => {
      const phases = [row("completed", 0), row("completed", 1), row(literal, 2)]
      const out = stepsFrom(phases)
      expect(out).not.toBeNull()
      expect(out!.total).toBe(3)
      expect(out!.done).toBe(literal === "completed" ? 3 : 2)
    },
  )

  it("EVERY non-`completed` literal is counted as not-completed — asserted over the whole set at once", () => {
    const others = STATUS_LITERALS.filter((s) => s !== "completed")
    // Six of the seven. If a future migration adds an eighth this grows by itself.
    expect(others.length).toBe(STATUS_LITERALS.length - 1)
    const phases = others.map((s, i) => row(s, i))
    const out = stepsFrom(phases)
    expect(out).toEqual({ done: 0, total: others.length })
  })

  it("does not throw on a literal the schema does not allow — it counts as not-completed", () => {
    // Totality is structural: an unknown string is simply not `completed`.
    const out = stepsFrom([row("completed", 0), row("a-literal-nobody-has-written-yet", 1)])
    expect(out).toEqual({ done: 1, total: 2 })
  })
})

describe("194.1-06 — `0 of 0` is REFUSED rather than printed", () => {
  it("an empty array returns null", () => {
    expect(stepsFrom([])).toBeNull()
  })

  it("null and undefined return null (a Deep thread carries no phases key)", () => {
    expect(stepsFrom(null)).toBeNull()
    expect(stepsFrom(undefined)).toBeNull()
  })

  it("a run where NOTHING completed still reports its denominator — 0 of 3, not null", () => {
    // The refusal is about a zero DENOMINATOR, never a zero numerator. A run
    // stopped during phase 1 of 3 genuinely got 0 of 3, and that is a measurement.
    expect(stepsFrom([row("cancelled", 0), row("pending", 1), row("pending", 2)])).toEqual({
      done: 0,
      total: 3,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fmtElapsed — hoisted, not rewritten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ CAPTURED, NOT RE-TYPED. Produced by
 *
 *     git show f9e55b6db33606fca77ee84ce8ef3da3153d09e2:frontend/src/pages/WorkflowRunPage.tsx \
 *       | sed -n 195,201p
 *
 * and verified byte-for-byte with `od -c` (LF endings, two-space indent). If this
 * constant is ever edited to make a test pass, the fence has been retired rather
 * than satisfied.
 */
const FMT_ELAPSED_AT_BASE = [
  "function fmtElapsed(ms: number): string {",
  "  const total = Math.max(0, Math.floor(ms / 1000))",
  "  if (total < 60) return `${total}s`",
  "  const minutes = Math.floor(total / 60)",
  '  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`',
  '  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`',
  "}",
].join("\n")

describe("194.1-06 — fmtElapsed moved VERBATIM out of WorkflowRunPage", () => {
  it("the hoisted module contains the base body byte-for-byte", () => {
    const src = (fmtElapsedSource as string).replace(/\r\n/g, "\n")
    expect(src.length).toBeGreaterThan(500)
    // `export ` is the ONLY permitted addition, and it is asserted explicitly so
    // that "verbatim" cannot quietly come to mean "similar".
    expect(src).toContain(`export ${FMT_ELAPSED_AT_BASE}`)
  })

  it("a ONE-CHARACTER change inside the body would be caught (positive control)", () => {
    const planted = (fmtElapsedSource as string).replace(/\r\n/g, "\n").replace("total < 60", "total < 61")
    expect(planted).not.toBe((fmtElapsedSource as string).replace(/\r\n/g, "\n"))
    expect(planted).not.toContain(`export ${FMT_ELAPSED_AT_BASE}`)
  })

  it("WorkflowRunPage no longer DEFINES it, and imports it instead", () => {
    const page = runPageSource as string
    expect(page.length).toBeGreaterThan(4000)
    expect(page).not.toMatch(/^function fmtElapsed/m)
    expect(page).toMatch(/import \{ fmtElapsed \} from "@\/lib\/fmtElapsed"/)
    // …and it still USES it, so the removal is a move rather than a deletion.
    expect(page).toContain("fmtElapsed(end - anchorMs)")
    expect(page).toContain("fmtElapsed(nowMs - anchorMs)")
  })

  it("the three branches and both boundaries behave exactly as the contract states", () => {
    // `< 60s → 12s` · `< 60m → 4m 12s` · else `1h 06m` — the docblock's own table,
    // driven rather than trusted. Boundaries included on both sides.
    expect(fmtElapsed(0)).toBe("0s")
    expect(fmtElapsed(12_000)).toBe("12s")
    expect(fmtElapsed(59_999)).toBe("59s")
    expect(fmtElapsed(60_000)).toBe("1m 00s")
    expect(fmtElapsed(252_000)).toBe("4m 12s")
    expect(fmtElapsed(59 * 60_000 + 59_000)).toBe("59m 59s")
    expect(fmtElapsed(3_600_000)).toBe("1h 00m")
    expect(fmtElapsed(3_960_000)).toBe("1h 06m")
  })

  it("a negative duration clamps to 0s rather than rendering a minus sign", () => {
    // Clock skew between two wire timestamps is real; `Math.max(0, …)` is the
    // shipped guard and this is what it buys.
    expect(fmtElapsed(-5_000)).toBe("0s")
  })
})
