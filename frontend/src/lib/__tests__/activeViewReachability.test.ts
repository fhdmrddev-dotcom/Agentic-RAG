/**
 * ⛔ THE REACHABILITY FENCE — the guard this project never had.
 *
 * Phase 262 / PACK-11 / D-262-04. `262-RESEARCH.md` R-2 measured that a **branchless 13th
 * `ActiveView` member ships GREEN today**:
 *
 *   - `ChatLayout.fallback.test.tsx` is four *source-text* assertions that mount nothing and
 *     enumerate nothing; its own fourth case is titled *"the compile-time exhaustiveness check
 *     is bypassed via as never"*.
 *   - `renameFence.test.ts` asserts only `members.length >= 10` — a FLOOR, not a correspondence.
 *   - ChatLayout's trailing `<UnknownViewFallback />` is a POSITIONAL fallback, not a `default:`
 *     that throws, so a member with no branch of its own renders the fallback silently at
 *     runtime and compiles clean (ternary chains do not narrow to `never`).
 *
 * So the union↔branch correspondence — the reachability triad's most important leg — was
 * carried by prose in three comment blocks and by nothing executable. This suite is the
 * executable half.
 *
 * ⛔ AST, NEVER GREP. `activeViewReachability` parses both files with `ts.createSourceFile`.
 * A `grep`-shaped check over `App.tsx` counts the member name wherever prose repeats it —
 * the 187-24 lesson, and the reason `App.tsx:96` deliberately refuses to spell its own twelfth
 * member in prose. The AST sees declarations only, so a comment cannot satisfy it.
 *
 * ⛔ AND IT REFUSES TO BE VACUOUS. A checker that silently parses zero members passes
 * everything; cases (6a)/(6b) drive both refusals. A guard nobody has seen fire is not a guard.
 */

import { describe, it, expect } from "vitest"

import { activeViewReachability } from "@/lib/activeViewReachability"

import appSourceRaw from "@/App.tsx?raw"
import layoutSourceRaw from "@/components/layout/ChatLayout.tsx?raw"

const lf = (s: string) => s.replace(/\r\n/g, "\n")
const APP = lf(appSourceRaw)
const LAYOUT = lf(layoutSourceRaw)

/** The member a synthetic 13th union entry carries. Deliberately a string that exists in
 *  NEITHER shipped file, so its appearance in `unbranched` can only come from the synthetic. */
const SYNTHETIC_MEMBER = "expert-catalog-synthetic"

/** Append one extra literal to the shipped `ActiveView` union. The SYNTHETIC is built with a
 *  regex; the MEASUREMENT is the AST. Building a fixture and measuring one are different jobs. */
function appWithExtraMember(member: string): string {
  const next = APP.replace(/(export type ActiveView\s*=[^\n]*)/, `$1 | "${member}"`)
  if (next === APP) throw new Error("fixture build failed: the ActiveView union line did not match")
  return next
}

describe("activeViewReachability · (1) self-guard — the raw imports are the files we think they are", () => {
  it("App.tsx?raw and ChatLayout.tsx?raw are non-empty and carry their own declarations", () => {
    // A sweep of the wrong file must not be able to read as a pass.
    expect(APP.length).toBeGreaterThan(1000)
    expect(LAYOUT.length).toBeGreaterThan(1000)
    expect(APP).toContain("export type ActiveView")
    expect(LAYOUT).toContain("export function ChatLayout")
  })
})

describe("activeViewReachability · (2) THE RED — a branchless member is caught", () => {
  it("a synthetic 13th union member with no ChatLayout branch lands in `unbranched`", () => {
    const report = activeViewReachability(appWithExtraMember(SYNTHETIC_MEMBER), LAYOUT)
    expect(report.unbranched).toEqual([SYNTHETIC_MEMBER])
  })

  it("and the synthetic member IS parsed as a member — the catch is not an artefact of parsing nothing", () => {
    const report = activeViewReachability(appWithExtraMember(SYNTHETIC_MEMBER), LAYOUT)
    expect(report.members).toContain(SYNTHETIC_MEMBER)
    expect(report.branched).not.toContain(SYNTHETIC_MEMBER)
  })
})

describe("activeViewReachability · (3) the SHIPPED pair", () => {
  it("every ActiveView member has a ChatLayout branch", () => {
    const report = activeViewReachability(APP, LAYOUT)
    expect(report.unbranched).toEqual([])
  })

  it("the union did not shrink while nobody was looking", () => {
    const report = activeViewReachability(APP, LAYOUT)
    expect(report.members.length).toBeGreaterThanOrEqual(12)
    expect(report.members).toContain("chat")
    expect(report.members).toContain("documents")
  })
})

describe("activeViewReachability · (4)/(5) the positional fallback must stay LAST", () => {
  it("the shipped layout puts <UnknownViewFallback> after every activeView comparison", () => {
    expect(activeViewReachability(APP, LAYOUT).fallbackIsLast).toBe(true)
  })

  it("a layout whose fallback precedes the last comparison reports fallbackIsLast false", () => {
    // P-1: the fallback is POSITIONAL. A branch placed after it is dead code that compiles.
    const syntheticLayout = `
      export function ChatLayout() {
        return (
          <div>
            {activeView === "chat" ? <Chat /> : <UnknownViewFallback view={activeView as never} />}
            {activeView === "documents" ? <Docs /> : null}
          </div>
        )
      }
    `
    expect(activeViewReachability(APP, syntheticLayout).fallbackIsLast).toBe(false)
  })

  it("a layout with NO fallback element at all is false, never true-by-absence", () => {
    const noFallback = `
      export function ChatLayout() {
        return <div>{activeView === "chat" ? <Chat /> : <Docs />}</div>
      }
    `
    expect(activeViewReachability(APP, noFallback).fallbackIsLast).toBe(false)
  })
})

describe("activeViewReachability · (6) the vacuity refusals — a report over nothing is worse than no report", () => {
  it("(6a) an app source with no ActiveView alias THROWS", () => {
    expect(() => activeViewReachability("export const x = 1\n", LAYOUT)).toThrow(/ActiveView/)
  })

  it("(6b) an app source whose ActiveView union parses to zero string members THROWS", () => {
    expect(() => activeViewReachability("export type ActiveView = string\n", LAYOUT)).toThrow(/ActiveView/)
  })

  it("(6c) a layout source with no `activeView === \"…\"` comparison THROWS", () => {
    expect(() => activeViewReachability(APP, "export function ChatLayout() { return null }\n")).toThrow(
      /activeView/,
    )
  })
})
