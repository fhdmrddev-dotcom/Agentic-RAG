/**
 * Phase 135 Plan 06 Task 1 — unit tests for the pure LCS unified line diff
 * (SI-01, D-09). Covers every case in the plan <behavior>: unchanged, pure
 * insert, pure delete, replace (remove + add for the changed line), empty-base
 * (all add), and empty-next (all remove). No dependency — the util is an in-repo
 * LCS (D-09 recommended path — sidesteps the jsdiff supply-chain surface).
 */
import { describe, it, expect } from "vitest"
import { lineDiff, type DiffRow } from "./lineDiff"

/** Reconstruct the "next" text from the rows (unchanged + add lines, in order). */
function rebuildNext(rows: DiffRow[]): string {
  return rows
    .filter((r) => r.type !== "remove")
    .map((r) => r.text)
    .join("\n")
}

/** Reconstruct the "base" text from the rows (unchanged + remove lines, in order). */
function rebuildBase(rows: DiffRow[]): string {
  return rows
    .filter((r) => r.type !== "add")
    .map((r) => r.text)
    .join("\n")
}

describe("lineDiff", () => {
  it("classifies identical input as all 'unchanged'", () => {
    const rows = lineDiff("a\nb\nc", "a\nb\nc")
    expect(rows.every((r) => r.type === "unchanged")).toBe(true)
    expect(rows.map((r) => r.text)).toEqual(["a", "b", "c"])
  })

  it("surfaces a pure insert as a single 'add' row, surrounding lines 'unchanged'", () => {
    const rows = lineDiff("a\nc", "a\nb\nc")
    const adds = rows.filter((r) => r.type === "add")
    expect(adds).toHaveLength(1)
    expect(adds[0].text).toBe("b")
    expect(rows.filter((r) => r.type === "remove")).toHaveLength(0)
    expect(rows.filter((r) => r.type === "unchanged").map((r) => r.text)).toEqual(["a", "c"])
  })

  it("surfaces a pure delete as a single 'remove' row", () => {
    const rows = lineDiff("a\nb\nc", "a\nc")
    const removes = rows.filter((r) => r.type === "remove")
    expect(removes).toHaveLength(1)
    expect(removes[0].text).toBe("b")
    expect(rows.filter((r) => r.type === "add")).toHaveLength(0)
    expect(rows.filter((r) => r.type === "unchanged").map((r) => r.text)).toEqual(["a", "c"])
  })

  it("surfaces a replaced line as one 'remove' (old) + one 'add' (new)", () => {
    const rows = lineDiff("a\nb\nc", "a\nB\nc")
    const removes = rows.filter((r) => r.type === "remove")
    const adds = rows.filter((r) => r.type === "add")
    expect(removes.map((r) => r.text)).toEqual(["b"])
    expect(adds.map((r) => r.text)).toEqual(["B"])
    // The unchanged surround is preserved.
    expect(rows.filter((r) => r.type === "unchanged").map((r) => r.text)).toEqual(["a", "c"])
  })

  it("treats an empty base as all 'add'", () => {
    const rows = lineDiff("", "x\ny")
    expect(rows.every((r) => r.type === "add")).toBe(true)
    expect(rows.map((r) => r.text)).toEqual(["x", "y"])
  })

  it("treats an empty next as all 'remove'", () => {
    const rows = lineDiff("x\ny", "")
    expect(rows.every((r) => r.type === "remove")).toBe(true)
    expect(rows.map((r) => r.text)).toEqual(["x", "y"])
  })

  it("round-trips: unchanged+remove rebuilds base, unchanged+add rebuilds next", () => {
    const base = "alpha\nbeta\ngamma\ndelta"
    const next = "alpha\nBETA\ngamma\nepsilon\ndelta"
    const rows = lineDiff(base, next)
    expect(rebuildBase(rows)).toBe(base)
    expect(rebuildNext(rows)).toBe(next)
  })
})
