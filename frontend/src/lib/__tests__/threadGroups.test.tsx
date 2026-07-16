/**
 * Phase 156 (POLISH-01, Wave 0) — unit contract for the shared thread engine.
 *
 * Covers SC#3 date bucketing (every boundary via a fixed `now`), empty-bucket fold,
 * within-bucket DESC ordering, the shared `matchesTitle` predicate, `folderLabel`'s
 * three branches, and — the load-bearing one — the T-156-01 XSS proof: an
 * `<img onerror=…>` title renders as inert TEXT, and the module source never uses
 * dangerouslySetInnerHTML.
 *
 * `.tsx` (not the `.ts` named in the plan) because it renders `<HighlightTitle/>` —
 * JSX only typechecks in a `.tsx` file.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import type { Thread, Folder } from "@/types"
import {
  bucketFor,
  groupByDate,
  groupByFolder,
  matchesTitle,
  folderLabel,
  HighlightTitle,
} from "../threadGroups"
// Vite `?raw` inlines the module source as a string — a cwd-independent way to
// assert the source-level XSS guard (typed via `vite/client`).
import threadGroupsSource from "../threadGroups.tsx?raw"

afterEach(() => cleanup())

// Fixed reference "now": local noon on 2026-07-16. Thread timestamps are built as
// LOCAL midnights offset by N days from this — the same local-calendar basis
// `startOfDay` uses — so the boundary assertions are timezone-independent (the
// Jun-15…Jul-16 2026 window crosses no US/EU DST transition).
const NOW = new Date(2026, 6, 16, 12, 0, 0)
const daysAgoISO = (n: number, hour = 10): string =>
  new Date(2026, 6, 16 - n, hour, 0, 0).toISOString()

function mkThread(over: Partial<Thread> = {}): Thread {
  return {
    id: over.id ?? "t-1",
    user_id: "u-1",
    title: over.title ?? "Untitled",
    folder_id: over.folder_id ?? null,
    created_at: over.created_at ?? daysAgoISO(0),
    updated_at: over.updated_at ?? daysAgoISO(0),
    ...over,
  }
}

describe("bucketFor — calendar-day boundaries (SC#3)", () => {
  it("maps 0 / 1 / ≤7 / ≤30 / >30 days to the five buckets exactly", () => {
    expect(bucketFor(daysAgoISO(0), NOW)).toBe("Today")
    expect(bucketFor(daysAgoISO(1), NOW)).toBe("Yesterday")
    expect(bucketFor(daysAgoISO(2), NOW)).toBe("Last 7 days")
    expect(bucketFor(daysAgoISO(7), NOW)).toBe("Last 7 days")
    expect(bucketFor(daysAgoISO(8), NOW)).toBe("Last 30 days")
    expect(bucketFor(daysAgoISO(30), NOW)).toBe("Last 30 days")
    expect(bucketFor(daysAgoISO(31), NOW)).toBe("Older")
  })

  it("treats a future/edge same-day timestamp as Today (days <= 0)", () => {
    expect(bucketFor(new Date(2026, 6, 16, 23, 0, 0).toISOString(), NOW)).toBe("Today")
  })
})

describe("groupByDate — order, empty-fold, within-bucket DESC (SC#3, Pitfall 3)", () => {
  it("returns only non-empty buckets, in newest→oldest order", () => {
    const groups = groupByDate(
      [
        mkThread({ id: "today", updated_at: daysAgoISO(0) }),
        mkThread({ id: "older", updated_at: daysAgoISO(40) }),
      ],
      NOW,
    )
    // Yesterday / Last 7 days / Last 30 days are absent (folded).
    expect(groups.map((g) => g.label)).toEqual(["Today", "Older"])
  })

  it("sorts items within a bucket by updated_at DESC even when the input is oldest-first", () => {
    const groups = groupByDate(
      [
        mkThread({ id: "old", updated_at: daysAgoISO(0, 8) }),
        mkThread({ id: "new", updated_at: daysAgoISO(0, 18) }),
      ],
      NOW,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Today")
    expect(groups[0].items.map((t) => t.id)).toEqual(["new", "old"])
  })

  it("returns an empty array for no threads", () => {
    expect(groupByDate([], NOW)).toEqual([])
  })
})

describe("matchesTitle — case-insensitive substring + blank passthrough (SC#2)", () => {
  const t = mkThread({ title: "Q3 Revenue Variance" })

  it("matches case-insensitively on a substring", () => {
    expect(matchesTitle(t, "revenue")).toBe(true)
    expect(matchesTitle(t, "VARIANCE")).toBe(true)
    expect(matchesTitle(t, "xyz")).toBe(false)
  })

  it("passes through a blank or whitespace-only query", () => {
    expect(matchesTitle(t, "")).toBe(true)
    expect(matchesTitle(t, "   ")).toBe(true)
  })
})

describe("folderLabel — name / Unfiled / Folder (D-04)", () => {
  const folders: Folder[] = [
    {
      id: "f-1",
      user_id: "u-1",
      name: "Finance",
      parent_id: null,
      is_global: false,
      created_at: daysAgoISO(0),
      updated_at: daysAgoISO(0),
    },
  ]

  it("returns the folder name for a known id", () => {
    expect(folderLabel(folders, "f-1")).toBe("Finance")
  })

  it('returns "Unfiled" for a null folder id', () => {
    expect(folderLabel(folders, null)).toBe("Unfiled")
  })

  it('returns "Folder" for an unresolvable id', () => {
    expect(folderLabel(folders, "f-gone")).toBe("Folder")
  })
})

describe("groupByFolder — folder groups, Unfiled last, empty-fold, within-group DESC (Task 2 / D-04)", () => {
  const folders: Folder[] = [
    { id: "f-fin", user_id: "u-1", name: "Finance", parent_id: null, is_global: false, created_at: daysAgoISO(0), updated_at: daysAgoISO(0) },
    { id: "f-eng", user_id: "u-1", name: "Engineering", parent_id: null, is_global: false, created_at: daysAgoISO(0), updated_at: daysAgoISO(0) },
    { id: "f-empty", user_id: "u-1", name: "Empty", parent_id: null, is_global: false, created_at: daysAgoISO(0), updated_at: daysAgoISO(0) },
  ]

  it("groups by folder name in the folders-array order, with Unfiled LAST and empty folders dropped", () => {
    const groups = groupByFolder(
      [
        mkThread({ id: "unf", folder_id: null, updated_at: daysAgoISO(1) }),
        mkThread({ id: "eng", folder_id: "f-eng", updated_at: daysAgoISO(1) }),
        mkThread({ id: "fin", folder_id: "f-fin", updated_at: daysAgoISO(1) }),
      ],
      folders,
    )
    // Finance + Engineering follow the folders order; the "Empty" folder has no
    // threads → dropped; "Unfiled" (null folder) is always last.
    expect(groups.map((g) => g.label)).toEqual(["Finance", "Engineering", "Unfiled"])
  })

  it("sorts items within a folder by updated_at DESC", () => {
    const groups = groupByFolder(
      [
        mkThread({ id: "old", folder_id: "f-fin", updated_at: daysAgoISO(5) }),
        mkThread({ id: "new", folder_id: "f-fin", updated_at: daysAgoISO(1) }),
      ],
      folders,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Finance")
    expect(groups[0].items.map((t) => t.id)).toEqual(["new", "old"])
  })

  it('folds an unresolvable folder id into a "Folder" group (no thread dropped), before Unfiled', () => {
    const groups = groupByFolder(
      [
        mkThread({ id: "gone", folder_id: "f-deleted", updated_at: daysAgoISO(1) }),
        mkThread({ id: "unf", folder_id: null, updated_at: daysAgoISO(1) }),
      ],
      folders,
    )
    expect(groups.map((g) => g.label)).toEqual(["Folder", "Unfiled"])
  })

  it("returns an empty array for no threads", () => {
    expect(groupByFolder([], folders)).toEqual([])
  })
})

describe("HighlightTitle — safe match highlight (T-156-01 XSS control)", () => {
  it("wraps the matched slice in <mark> as plain text", () => {
    const { container } = render(<HighlightTitle title="Budget review" query="budget" />)
    const mark = container.querySelector("mark")
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe("Budget")
    expect(container.textContent).toBe("Budget review")
  })

  it("renders the plain title when the query is blank or has no match", () => {
    const blank = render(<HighlightTitle title="Budget review" query="  " />)
    expect(blank.container.querySelector("mark")).toBeNull()
    expect(blank.container.textContent).toBe("Budget review")
    cleanup()
    const miss = render(<HighlightTitle title="Budget review" query="zzz" />)
    expect(miss.container.querySelector("mark")).toBeNull()
    expect(miss.container.textContent).toBe("Budget review")
  })

  it("renders an <img onerror> title as INERT TEXT — no <img> element is created", () => {
    const payload = "<img src=x onerror=alert(1)>"
    const { container } = render(<HighlightTitle title={payload} query="img" />)
    // The payload is text, not an element: no <img> in the DOM.
    expect(container.querySelector("img")).toBeNull()
    // The literal string survives verbatim as visible text.
    expect(container.textContent).toBe(payload)
    // …and the matched "img" is still highlighted (as text) inside <mark>.
    const mark = container.querySelector("mark")
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe("img")
  })
})

describe("threadGroups source — no dangerouslySetInnerHTML (T-156-01 source guard)", () => {
  it("never uses dangerouslySetInnerHTML and does use a JSX <mark>", () => {
    expect(threadGroupsSource).not.toContain("dangerouslySetInnerHTML")
    expect(threadGroupsSource).toContain("<mark")
  })
})
