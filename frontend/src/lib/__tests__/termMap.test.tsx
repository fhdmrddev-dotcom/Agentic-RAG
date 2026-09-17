/**
 * Phase 154 Plan 01 Task 2 (TDD) — the single-source term-map + consumers.
 *
 * `termMap.ts` is the ONE glossary (D-02) mapping each display concern →
 * `{ plain, helper?, technical }`. `usePlainLabel` and `<PlainLabel>` render the
 * plain string by default and the technical string when the shared reveal is ON.
 *
 * The three contracts under test:
 *   1. round-trip — `usePlainLabel(key)` = plain when OFF (or no provider),
 *      technical when ON;
 *   2. the CARDINAL contract guard (D-02a / Pitfall 15) — every term's
 *      `technical` field holds the string that surface ships TODAY, VERBATIM, so
 *      the reveal never renames a wire enum / API field / audit-action value;
 *   3. unknown-key passthrough — an unmapped key returns `String(key)` (honest
 *      fallback, the AuditTab `platformLabel` idiom), never a throw.
 *
 * `<PlainLabel>` renders the label as an auto-escaped React text node — NEVER
 * `dangerouslySetInnerHTML` (T-154-02) — plus an optional ⓘ helper.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, renderHook, act, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"

import { TechnicalNamesProvider, useTechnicalNames } from "@/providers/TechnicalNamesProvider"
import { TERM_MAP, usePlainLabel } from "../termMap"
import type { TermKey } from "../termMap"
import { PlainLabel } from "../PlainLabel"

/**
 * The verbatim string each mapped surface ships TODAY (the `technical` side).
 * This table is the contract guard: if a relabel ever silently changed the
 * underlying wording, one of these assertions fails. Every key in TERM_MAP MUST
 * appear here and vice-versa.
 */
const SHIPPED_TECHNICAL: Record<string, string> = {
  // Surface A — document ingestion status badge (DocumentStatusBadge.tsx:16-27)
  "ingest.extracting": "Extracting",
  "ingest.extracting_tables": "Extracting tables",
  "ingest.extracting_images": "Extracting images",
  "ingest.chunking": "Chunking",
  "ingest.embedding": "Embedding",
  "ingest.metadata": "Extracting metadata",
  "status.pending": "pending",
  "status.processing": "processing",
  "status.completed": "completed",
  "status.failed": "failed",
  // ⚠ ADDED 2026-09-18. `status.paused` reached TERM_MAP at `0d2a98531` (Phase 230) and
  // never reached this table, so this bidirectional guard had been RED ever since. It was
  // working exactly as designed — it is the DRIFT that went unread, not the guard.
  "status.paused": "paused",
  // Surface B — document detail (DocumentDetailPanel.tsx:230)
  "doc.metadata_section": "Metadata",
  // Surface C — chat composer (MessageInput.tsx:327,337,345)
  "agentmode.default": "General",
  "agentmode.explorer": "Explorer",
  // Surface D — Settings (SettingsPage.tsx)
  "settings.tab.retrieval": "Search & Retrieval",
  "settings.temperature": "temperature",
  "settings.context_window": "context window max tokens",
  "settings.embedding": "Embedding model",
  "settings.reembed": "re-embed",
}

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

function providerWrapper({ children }: { children: ReactNode }) {
  return <TechnicalNamesProvider>{children}</TechnicalNamesProvider>
}

describe("termMap — the single-source glossary shape (D-02)", () => {
  it("exposes the spine keys the Wave-2 surfaces attach to", () => {
    // The acceptance keys named in the plan.
    expect(TERM_MAP["ingest.chunking"]).toBeDefined()
    expect(TERM_MAP["ingest.embedding"]).toBeDefined()
    expect(TERM_MAP["doc.metadata_section"]).toBeDefined()
    expect(TERM_MAP["settings.tab.retrieval"]).toBeDefined()
  })

  it("every entry has a non-empty plain + technical string", () => {
    for (const [key, term] of Object.entries(TERM_MAP)) {
      expect(typeof term.plain, `${key}.plain`).toBe("string")
      expect(term.plain.length, `${key}.plain`).toBeGreaterThan(0)
      expect(typeof term.technical, `${key}.technical`).toBe("string")
      expect(term.technical.length, `${key}.technical`).toBeGreaterThan(0)
    }
  })
})

describe("termMap — CONTRACT GUARD: technical === today's shipped string (D-02a / Pitfall 15)", () => {
  it("holds every technical field verbatim to the shipped display string", () => {
    for (const [key, expected] of Object.entries(SHIPPED_TECHNICAL)) {
      expect(TERM_MAP[key as TermKey]?.technical, `${key}.technical`).toBe(expected)
    }
  })

  it("has exactly the mapped keys the contract table covers (no drift either way)", () => {
    expect(Object.keys(TERM_MAP).sort()).toEqual(Object.keys(SHIPPED_TECHNICAL).sort())
  })

  it("spot-checks the plan's named guards", () => {
    expect(TERM_MAP["ingest.chunking"].technical).toBe("Chunking")
    expect(TERM_MAP["doc.metadata_section"].technical).toBe("Metadata")
    expect(TERM_MAP["status.pending"].technical).toBe("pending")
  })
})

describe("usePlainLabel — reveal-state round-trip", () => {
  it("returns the plain string when the reveal is OFF and the technical string when ON", () => {
    const { result } = renderHook(
      () => {
        const label = usePlainLabel("ingest.chunking")
        const ctx = useTechnicalNames()
        return { label, ctx }
      },
      { wrapper: providerWrapper },
    )

    // OFF (default) → plain.
    expect(result.current.label).toBe("Splitting into sections")

    // Flip ON → technical (today's shipped word).
    act(() => {
      result.current.ctx.toggle()
    })
    expect(result.current.label).toBe("Chunking")
  })

  it("returns the plain string with NO provider mounted (fallback to plain)", () => {
    const { result } = renderHook(() => usePlainLabel("ingest.embedding"))
    expect(result.current).toBe("Making it searchable")
  })

  it("passes an unknown key through as String(key) rather than throwing (AuditTab idiom)", () => {
    const { result } = renderHook(() => usePlainLabel("not.a.real.key" as TermKey))
    expect(result.current).toBe("not.a.real.key")
  })
})

describe("<PlainLabel> — auto-escaped text node + optional ⓘ helper", () => {
  it("renders the plain label by default and the technical label under the toggle", () => {
    function Harness() {
      const { toggle } = useTechnicalNames()
      return (
        <div>
          <PlainLabel term="doc.metadata_section" />
          <button type="button" onClick={toggle}>
            flip
          </button>
        </div>
      )
    }

    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )

    expect(screen.getByText("Details")).toBeInTheDocument()

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })
    expect(screen.getByText("Metadata")).toBeInTheDocument()
  })

  it("renders an accessible ⓘ helper when showHelper is set", () => {
    render(
      <TechnicalNamesProvider>
        <PlainLabel term="ingest.chunking" showHelper />
      </TechnicalNamesProvider>,
    )
    // The helper text is reachable via the ⓘ's accessible name / title.
    expect(
      screen.getByLabelText("Breaking the text into searchable pieces."),
    ).toBeInTheDocument()
  })

  it("omits the ⓘ when showHelper is not set", () => {
    render(
      <TechnicalNamesProvider>
        <PlainLabel term="ingest.chunking" />
      </TechnicalNamesProvider>,
    )
    expect(
      screen.queryByLabelText("Breaking the text into searchable pieces."),
    ).not.toBeInTheDocument()
  })
})
