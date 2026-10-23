/**
 * Phase 295-06 (D-02 / D-03 / D-39 / UI-SPEC A.4) — the ONE pure reading of `ask.engine_pause`.
 *
 * `PendingAskCard` is a G-5-firing hot file, so every new conditional the found-nothing pause
 * needs lives here and the card reads only these results. Nothing here composes a prompt or a
 * choice: the server builds both (295-03), and these helpers only compare against its labels.
 */
import { describe, it, expect } from "vitest"
import type { PendingAsk } from "@/types"
import {
  ENGINE_CHOICE_SEARCH,
  ENGINE_CHOICE_STOP,
  answeredHeader,
  answeredReceipt,
  needsFolder,
  readEnginePause,
} from "../enginePause"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import helperSource from "../enginePause.ts?raw"

const FOLDERS = [
  { id: "f-contracts", name: "Contracts", depth: 0 },
  { id: "f-leases", name: "Leases", depth: 1 },
]

const pauseAsk = (over: Partial<PendingAsk> = {}): PendingAsk => ({
  tool_call_id: "tc-engine",
  prompt: "Searched Policies and found nothing for “Find the clauses”. How should the run continue?",
  options: ["Search another folder", "Continue without sources", "Stop the run"],
  timeout_seconds: null,
  run_id: "wr-engine",
  engine_pause: {
    kind: "no_sources",
    phase: "find_clauses",
    continue_allowed: true,
    locked: false,
    folders: FOLDERS,
  },
  ...over,
})

const ordinaryAsk: PendingAsk = {
  tool_call_id: "tc-plain",
  prompt: "Which dataset?",
  options: ["Search another folder", "Stop the run"],
  timeout_seconds: 300,
  run_id: "run-plain",
}

describe("enginePause — the server's labels, held once", () => {
  it("the two labels the card compares against match 295-03's server constants exactly", () => {
    expect(ENGINE_CHOICE_SEARCH).toBe("Search another folder")
    expect(ENGINE_CHOICE_STOP).toBe("Stop the run")
  })
})

describe("readEnginePause", () => {
  it("returns the server's pause with its folders when present", () => {
    const ep = readEnginePause(pauseAsk())
    expect(ep).not.toBeNull()
    expect(ep!.kind).toBe("no_sources")
    expect(ep!.locked).toBe(false)
    expect(ep!.folders.map((f) => f.name)).toEqual(["Contracts", "Leases"])
    expect(ep!.folders.map((f) => f.depth)).toEqual([0, 1])
  })

  it("returns null for an ordinary ask (no engine_pause)", () => {
    expect(readEnginePause(ordinaryAsk)).toBeNull()
  })

  it("returns null when engine_pause is not an object", () => {
    const bad = { ...ordinaryAsk, engine_pause: "yes" } as unknown as PendingAsk
    expect(readEnginePause(bad)).toBeNull()
    const nul = { ...ordinaryAsk, engine_pause: null } as unknown as PendingAsk
    expect(readEnginePause(nul)).toBeNull()
  })

  it("drops a folder row without a string name (or a blank one, or no id), and keeps the rest in order", () => {
    const ask = pauseAsk({
      engine_pause: {
        kind: "no_sources",
        phase: "find_clauses",
        continue_allowed: true,
        locked: false,
        folders: [
          { id: "f-1", name: "Board minutes", depth: 0 },
          { id: "f-2", depth: 1 } as unknown as { id: string; name: string; depth: number },
          { id: "f-3", name: "   ", depth: 1 },
          { name: "No id", depth: 0 } as unknown as { id: string; name: string; depth: number },
          { id: "f-5", name: 42, depth: 0 } as unknown as { id: string; name: string; depth: number },
          { id: "f-6", name: "HR", depth: 2 },
        ],
      },
    })
    expect(readEnginePause(ask)!.folders.map((f) => f.name)).toEqual(["Board minutes", "HR"])
  })

  it("reads a missing folders list as no folders, and a bad depth as 0", () => {
    const ask = {
      ...pauseAsk(),
      engine_pause: { kind: "no_markers", phase: "p", continue_allowed: true, locked: false },
    } as unknown as PendingAsk
    expect(readEnginePause(ask)!.folders).toEqual([])
    const neg = pauseAsk({
      engine_pause: {
        kind: "no_sources",
        phase: "p",
        continue_allowed: true,
        locked: false,
        folders: [{ id: "f", name: "Deep", depth: -3 }],
      },
    })
    expect(readEnginePause(neg)!.folders[0].depth).toBe(0)
  })
})

describe("needsFolder", () => {
  it("is true only while the Search another folder choice is selected on an engine pause with folders", () => {
    const ask = pauseAsk()
    expect(needsFolder(ask, 0)).toBe(true)
    expect(needsFolder(ask, 1)).toBe(false)
    expect(needsFolder(ask, 2)).toBe(false)
    expect(needsFolder(ask, null)).toBe(false)
  })

  it("is false for an ordinary ask whose option happens to read the same words", () => {
    expect(needsFolder(ordinaryAsk, 0)).toBe(false)
  })

  it("is false when the server offered no folders", () => {
    const ask = pauseAsk({
      engine_pause: { kind: "no_sources", phase: "p", continue_allowed: true, locked: false, folders: [] },
    })
    expect(needsFolder(ask, 0)).toBe(false)
  })

  it("follows the server's order: the search choice is found by its label, wherever it sits", () => {
    const ask = pauseAsk({ options: ["Stop the run", "Search another folder"] })
    expect(needsFolder(ask, 0)).toBe(false)
    expect(needsFolder(ask, 1)).toBe(true)
  })
})

describe("answeredHeader", () => {
  it("reads Answered · run stopped for a Stop answer on an engine pause", () => {
    expect(answeredHeader(pauseAsk(), "Stop the run")).toBe("Answered · run stopped")
  })

  it("keeps Answered · agent resumed for every other answer", () => {
    expect(answeredHeader(pauseAsk(), "Continue without sources")).toBe("Answered · agent resumed")
    expect(answeredHeader(pauseAsk(), "Search another folder — Contracts")).toBe("Answered · agent resumed")
    // An ordinary ask is byte-unchanged, even when its option reads "Stop the run".
    expect(answeredHeader(ordinaryAsk, "Stop the run")).toBe("Answered · agent resumed")
    expect(answeredHeader(ordinaryAsk, "prod_sales_2026")).toBe("Answered · agent resumed")
  })
})

describe("answeredReceipt — the words after `You answered`", () => {
  it("names the chosen folder for a folder answer", () => {
    expect(answeredReceipt(pauseAsk(), "Search another folder", "f-leases")).toBe(
      "Search another folder — Leases",
    )
  })

  it("is null for every other answer, so the card keeps its shipped receipt", () => {
    expect(answeredReceipt(pauseAsk(), "Continue without sources", undefined)).toBeNull()
    expect(answeredReceipt(pauseAsk(), "Stop the run", undefined)).toBeNull()
    expect(answeredReceipt(pauseAsk(), "Search another folder", undefined)).toBeNull()
    expect(answeredReceipt(pauseAsk(), "Search another folder", "f-not-offered")).toBeNull()
    expect(answeredReceipt(ordinaryAsk, "Search another folder", "f-leases")).toBeNull()
  })
})

describe("enginePause.ts — a pure module that says nothing it must not", () => {
  const src = helperSource as string
  const codeOnly = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n")

  it("the swept source is the real file", () => {
    expect(src).toContain("export function readEnginePause")
    expect(codeOnly.length).toBeGreaterThan(400)
  })

  it("imports no API module and no React", () => {
    expect(src).not.toMatch(/@\/lib\/api/)
    expect(src).not.toMatch(/from "react"/)
  })

  it("never-say sweep over its code", () => {
    for (const token of [
      "citations_required",
      "citation markers",
      "0/",
      "validator",
      "field_map",
      "aborted by user",
      "Proceed anyway",
      "Abort",
      "Proven",
      "N/A",
    ]) {
      expect(codeOnly, token).not.toContain(token)
    }
  })
})
