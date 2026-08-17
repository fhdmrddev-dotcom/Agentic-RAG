/**
 * Phase 195 Plan 03 Task 2 — the shared file-row helpers.
 *
 * What each block is FOR (a case that cannot fail defends nothing — the 192.1
 * lesson, where three fences swept against the empty string and passed green):
 *
 *  · formatBytes — the three branch boundaries the shipped surfaces actually
 *    render, PLUS a source-level byte-identity check against the pre-change
 *    original captured at `BASE_SHA`. The boundaries catch a behaviour drift;
 *    the identity check catches a "tidy-up" that keeps the boundaries green.
 *  · baseName — including the empty-string fallback, which is the only branch
 *    a caller can reach without noticing.
 *  · byNewestFirst — BOTH data regimes (§F7). The missing-key arm is the one
 *    the live deliverable actually takes, so it gets its own cases AND a
 *    two-row positive control whose sorted and unsorted orders differ.
 */
import { describe, it, expect } from "vitest"
import { formatBytes, baseName, byNewestFirst } from "../fileRowUtils"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import utilsSource from "../fileRowUtils.ts?raw"

describe("formatBytes", () => {
  it("renders bytes below 1 KiB with the B unit", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(376)).toBe("376 B")
  })

  it("1023 is the last B value (lower boundary of the KB branch)", () => {
    expect(formatBytes(1023)).toBe("1023 B")
  })

  it("1024 crosses into KB with one decimal place", () => {
    expect(formatBytes(1024)).toBe("1.0 KB")
  })

  it("1048575 is the last KB value (lower boundary of the MB branch)", () => {
    expect(formatBytes(1048575)).toBe("1024.0 KB")
  })

  it("1048576 crosses into MB with one decimal place", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB")
  })

  it("keeps ONE decimal place — not two, not zero (the shipped precision)", () => {
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})

describe("formatBytes — byte-identity with the pre-change original (this is a HOIST, not a rewrite)", () => {
  /**
   * The original, captured with:
   *
   *     git show f2eef045096efabdf7f05a1175271272b55617b9:\
   *       frontend/src/components/chat/OutputFileCard.tsx | sed -n '25,29p'
   *
   * `BASE_SHA` is read from `195-BASELINE.md` § "BASE_SHA — the commit this
   * phase is built on", NEVER derived as `HEAD~n`: a `HEAD~n` would silently
   * point somewhere else the moment a plan lands ahead of this one, and the
   * comparison would then be against a file this phase itself had already
   * changed — an identity check that verifies nothing.
   */
  const ORIGINAL_AT_BASE_SHA = [
    "function formatBytes(bytes: number): string {",
    "  if (bytes < 1024) return `${bytes} B`",
    "  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`",
    "  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`",
    "}",
  ].join("\n")

  const source = utilsSource as unknown as string

  it("⚠ the ?raw import resolved to REAL source (length + identity guard)", () => {
    // ⚠ NOT CEREMONY. A `?raw` import that resolves to "" makes every
    // `toContain` below pass and the suite reports green while measuring
    // nothing — Phase 192.1 measured exactly that against a RENAMED module.
    // Length alone is insufficient (any non-empty file passes it), so the
    // identity assertion names a symbol only THIS file can contain.
    expect(source.length).toBeGreaterThan(1000)
    expect(source).toContain("export function byNewestFirst")
    expect(source).toContain("export function formatBytes")
  })

  it("the hoisted body is character-for-character the BASE_SHA original (only `export ` differs)", () => {
    const match = source.match(/export function formatBytes[\s\S]*?\n\}/)
    expect(match).not.toBeNull()
    const hoisted = (match as RegExpMatchArray)[0].replace(/\r/g, "").replace(/^export /, "")
    expect(hoisted).toBe(ORIGINAL_AT_BASE_SHA)
  })
})

describe("baseName", () => {
  it("returns the last segment of a nested path", () => {
    expect(baseName("outputs/reports/q3.pptx")).toBe("q3.pptx")
  })

  it("returns a bare name unchanged", () => {
    expect(baseName("q3.pptx")).toBe("q3.pptx")
  })

  it("falls back to 'download' on a trailing slash (the segment is empty)", () => {
    expect(baseName("outputs/reports/")).toBe("download")
  })

  it("falls back to 'download' on the empty string", () => {
    expect(baseName("")).toBe("download")
  })

  it("keeps a leading-slash absolute path's last segment", () => {
    expect(baseName("/workspace/out/data.csv")).toBe("data.csv")
  })
})

describe("byNewestFirst — regime 1: RECONCILED (both keys present, the GET)", () => {
  it("sorts descending by created_at", () => {
    const older = { created_at: "2026-08-17T09:00:00Z" }
    const newer = { created_at: "2026-08-17T11:00:00Z" }
    expect(byNewestFirst(newer, older)).toBeLessThan(0)
    expect(byNewestFirst(older, newer)).toBeGreaterThan(0)
  })

  it("returns 0 for two identical timestamps", () => {
    const t = { created_at: "2026-08-17T09:00:00Z" }
    expect(byNewestFirst({ ...t }, { ...t })).toBe(0)
  })
})

describe("byNewestFirst — regime 2: LIVE SSE (no created_at — the regime the deliverable arrives in)", () => {
  // ⚠ §F7: `lib/api.ts:845-851` builds the live workspace file with NO
  // `created_at`, and `StreamsProvider.tsx:2947-2954` APPENDS it. A naive
  // DESC-only comparator therefore puts the just-produced deliverable LAST —
  // the exact inverse of D-12. These are the cases that catch that.
  it("`a` missing created_at sorts FIRST (negative)", () => {
    expect(byNewestFirst({}, { created_at: "2026-08-17T11:00:00Z" })).toBeLessThan(0)
  })

  it("`b` missing created_at sorts FIRST (positive)", () => {
    expect(byNewestFirst({ created_at: "2026-08-17T11:00:00Z" }, {})).toBeGreaterThan(0)
  })

  it("both missing → 0, i.e. stable insertion order is preserved", () => {
    expect(byNewestFirst({}, {})).toBe(0)
  })
})

describe("byNewestFirst — applied through [...list].sort()", () => {
  it("POSITIVE CONTROL: a two-row fixture whose unsorted and sorted orders DIFFER", () => {
    // Without a fixture whose two orders differ, this fence would pass on any
    // list forever (the `PendingAskCard.test.tsx:205-222` precedent).
    const input = [
      { path: "old.txt", created_at: "2026-08-17T09:00:00Z" },
      { path: "new.txt", created_at: "2026-08-17T11:00:00Z" },
    ]
    expect(input.map((f) => f.path)).toEqual(["old.txt", "new.txt"])
    const sorted = [...input].sort(byNewestFirst)
    expect(sorted.map((f) => f.path)).toEqual(["new.txt", "old.txt"])
  })

  it("⚠ THE DELIVERABLE CASE: the APPENDED row with NO created_at ends up at index 0", () => {
    // This is the shipped shape: two reconciled rows from the GET, then the
    // live SSE file appended at the END with no sort key.
    const input = [
      { path: "a.txt", created_at: "2026-08-17T09:00:00Z" },
      { path: "b.txt", created_at: "2026-08-17T10:00:00Z" },
      { path: "deliverable.pptx" } as { path: string; created_at?: string },
    ]
    expect(input[input.length - 1].path).toBe("deliverable.pptx")
    const sorted = [...input].sort(byNewestFirst)
    expect(sorted[0].path).toBe("deliverable.pptx")
    expect(sorted.map((f) => f.path)).toEqual(["deliverable.pptx", "b.txt", "a.txt"])
  })

  it("two live rows keep their arrival order behind the reconciled ones being sorted", () => {
    const input = [
      { path: "reconciled.txt", created_at: "2026-08-17T09:00:00Z" },
      { path: "live-1.pptx" } as { path: string; created_at?: string },
      { path: "live-2.pptx" } as { path: string; created_at?: string },
    ]
    const sorted = [...input].sort(byNewestFirst)
    expect(sorted.map((f) => f.path)).toEqual(["live-1.pptx", "live-2.pptx", "reconciled.txt"])
  })

  it("PURITY: sorting through a copy does not mutate the input array", () => {
    const input = [
      { path: "a.txt", created_at: "2026-08-17T09:00:00Z" },
      { path: "b.txt", created_at: "2026-08-17T11:00:00Z" },
    ]
    const inputCopy = input.map((f) => ({ ...f }))
    const sorted = [...input].sort(byNewestFirst)
    expect(input).toEqual(inputCopy)
    // and the sort really did something (so the purity case is not vacuous)
    expect(sorted.map((f) => f.path)).not.toEqual(input.map((f) => f.path))
  })
})
