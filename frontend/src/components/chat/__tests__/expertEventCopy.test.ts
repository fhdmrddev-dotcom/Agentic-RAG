/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-09 / D-267-11 / D-267-18 / D-267-19 / D-267-33) —
 * the ONE vocabulary module that turns a stored transcript payload into words.
 *
 * ⛔ THE FIXTURES ARE PARSED, NEVER RETYPED. `backend/tests/fixtures/phase267/*.json` are the
 * backend builders' real `model_dump(mode="json")` output (267-02 asserts them against the
 * builders), so a payload drift on either side reds a suite rather than a person's screen.
 *
 * ⛔ THE KIND ALLOWLIST IS CROSS-PINNED to `backend/app/models/message.py` by `?raw`: a kind added
 * on one side alone fails case (1). "handoff" is deliberately in neither set — it is a USER row.
 */
import { describe, expect, it } from "vitest"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import messagePySource from "../../../../../backend/app/models/message.py?raw"
// @ts-ignore — Vite `?raw` import.
import expertChangedRaw from "../../../../../backend/tests/fixtures/phase267/expert_changed.json?raw"
// @ts-ignore — Vite `?raw` import.
import expertHandoffRaw from "../../../../../backend/tests/fixtures/phase267/expert_handoff.json?raw"
// @ts-ignore — Vite `?raw` import.
import handoffMarkerRaw from "../../../../../backend/tests/fixtures/phase267/handoff_marker.json?raw"
import type { Message } from "@/types"
import type { ExpertChangedEvent, ExpertHandoffEvent, HandoffMarker } from "@/lib/api/threads"
import {
  EVENT_COPY,
  TRANSCRIPT_EVENT_KINDS,
  eventCardModel,
  eventTimeLabel,
  handoffCardModel,
  handoffEventModel,
  handoffMarkerOf,
  transcriptEventOf,
} from "../expertEventCopy"

const changed = JSON.parse(expertChangedRaw as string) as ExpertChangedEvent
const handoffEvent = JSON.parse(expertHandoffRaw as string) as ExpertHandoffEvent
const marker = JSON.parse(handoffMarkerRaw as string) as HandoffMarker

function row(role: Message["role"], payload: unknown): Message {
  return {
    id: "m-1",
    thread_id: "t-1",
    user_id: "u-1",
    role,
    content: "a sentence the card must NOT render from",
    created_at: "2026-09-25T14:32:00Z",
    updated_at: "2026-09-25T14:32:00Z",
    tool_calls: payload === undefined ? undefined : ([payload] as unknown as Message["tool_calls"]),
  }
}

const emptyLine = { folders: [], thread_folder: null, all_documents: false, connections: [] }

describe("TRANSCRIPT_EVENT_KINDS — one frontend home, cross-pinned to the backend", () => {
  it("(1) equals the frozenset literal in backend/app/models/message.py", () => {
    const src = messagePySource as string
    const m = src.match(/TRANSCRIPT_EVENT_KINDS\s*:\s*frozenset\[str\]\s*=\s*frozenset\(\{([^}]*)\}\)/)
    expect(m, "the backend literal moved — the cross-pin can no longer read it").not.toBeNull()
    const backend = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort()
    expect(backend.length).toBeGreaterThan(0)
    expect([...TRANSCRIPT_EVENT_KINDS].sort()).toEqual(backend)
  })

  it("(2) 'handoff' is in neither set — the summary is a USER row the model must see", () => {
    expect(TRANSCRIPT_EVENT_KINDS.has("handoff")).toBe(false)
  })
})

describe("transcriptEventOf / handoffMarkerOf — the two discriminators", () => {
  it("(3) a system row with an allowlisted kind yields its payload", () => {
    expect(transcriptEventOf(row("system", changed))).toEqual(changed)
    expect(transcriptEventOf(row("system", handoffEvent))).toEqual(handoffEvent)
  })

  it("(4) a system row with any other kind, or none, yields null", () => {
    expect(transcriptEventOf(row("system", { kind: "context_truncated" }))).toBeNull()
    expect(transcriptEventOf(row("system", { kind: "ask_user_prompt" }))).toBeNull()
    expect(transcriptEventOf(row("system", undefined))).toBeNull()
  })

  it("(5) the payload on a NON-system row is never treated as an event", () => {
    expect(transcriptEventOf(row("assistant", changed))).toBeNull()
    expect(transcriptEventOf(row("user", changed))).toBeNull()
  })

  it("(6) handoffMarkerOf reads only a USER row carrying kind 'handoff'", () => {
    expect(handoffMarkerOf(row("user", marker))).toEqual(marker)
    expect(handoffMarkerOf(row("assistant", marker))).toBeNull()
    expect(handoffMarkerOf(row("system", marker))).toBeNull()
    expect(handoffMarkerOf(row("user", undefined))).toBeNull()
    expect(handoffMarkerOf(row("user", { name: "search_documents" }))).toBeNull()
  })
})

describe("eventCardModel — the backend builder's real output, rendered to words", () => {
  it("(7) the fixture swap: header, tone, Now, Dropped, connections and the exclusion sub-line", () => {
    const m = eventCardModel(changed)
    expect(m.header).toBe("Financial Analyzer → HR Advisor")
    expect(m.variant).toBe("swap")
    expect(m.tone).toBe("violet")
    expect(m.now.items).toEqual(["HR Policies"])
    expect(m.now.connections).toEqual([])
    expect(m.dropped.items).toEqual(["Financial Reports & Filings", "/Client ACME (4)"])
    expect(m.dropped.connections).toEqual(["Slack"])
    expect(m.dropped.empty).toBe(false)
    expect(m.excludedSubline).toBe(
      "ACME_MSA_2026.pdf · ACME_SOW_03.docx · ACME_invoices_Q3.xlsx · Board_deck_Q3.pptx · Chat attachments stay readable.",
    )
  })

  it("(8) a join (before null) and a removal (after null)", () => {
    const join = eventCardModel({ ...changed, before: null })
    expect(join.header).toBe("HR Advisor joined")
    expect(join.tone).toBe("violet")
    expect(join.variant).toBe("join")
    const removal = eventCardModel({ ...changed, after: null, excluded: null })
    expect(removal.header).toBe("Financial Analyzer left")
    expect(removal.tone).toBe("neutral")
    expect(removal.variant).toBe("removal")
  })

  it("(9) an empty Dropped is the literal 'Nothing', flagged so the card mutes it", () => {
    const m = eventCardModel({ ...changed, dropped: emptyLine, excluded: null })
    expect(m.dropped.empty).toBe(true)
    expect(m.dropped.items).toEqual([EVENT_COPY.nothing])
    expect(EVENT_COPY.nothing).toBe("Nothing")
    expect(m.excludedSubline).toBeNull()
  })

  it("(10) a plain thread reads 'All your documents'; a nameless folder reads the shipped phrase", () => {
    const m = eventCardModel({
      ...changed,
      now: { ...emptyLine, all_documents: true },
      dropped: { ...emptyLine, folders: [{ id: null, name: null, doc_count: null }] },
      excluded: null,
    })
    expect(m.now.items).toEqual(["All your documents"])
    expect(m.dropped.items).toEqual(["a knowledge folder you cannot see"])
  })

  it("(11) more than five excluded names shows five and 'and {k} more' — k from the COUNT", () => {
    const names = ["a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf", "f.pdf"]
    const m = eventCardModel({ ...changed, excluded: { count: 9, names } })
    expect(m.excludedSubline).toBe(
      "a.pdf · b.pdf · c.pdf · d.pdf · e.pdf · and 4 more · Chat attachments stay readable.",
    )
  })

  it("(12) a zero-count exclusion writes no sub-line", () => {
    expect(eventCardModel({ ...changed, excluded: { count: 0, names: [] } }).excludedSubline).toBeNull()
  })

  it("(13) a thread folder with no count renders without the parenthesis", () => {
    const m = eventCardModel({
      ...changed,
      now: { ...emptyLine, thread_folder: { id: "f", name: "Client ACME", doc_count: null } },
    })
    expect(m.now.items).toEqual(["/Client ACME"])
  })
})

describe("handoffEventModel — the source thread's pointer (D-267-16 / D-267-33)", () => {
  it("(14) header, Here, Open label and the inherited-folder statement (the deleted label is retired, WR-09)", () => {
    const m = handoffEventModel(handoffEvent)
    expect(m.header).toBe("Contract Reviewer · new chat")
    expect(m.here).toBe("Financial Analyzer stays")
    expect(m.openLabel).toBe("Contract Reviewer · Q3 board prep →")
    expect(m).not.toHaveProperty("deletedLabel")
    expect(m.targetThreadId).toBe(handoffEvent.target_thread_id)
    expect(m.folderLine).toBe("Same folder: /Client ACME")
  })

  it("(15) no folder → no folder line; no staying Expert → no Here line", () => {
    const m = handoffEventModel({ ...handoffEvent, folder_name: null, stays_expert_name: null })
    expect(m.folderLine).toBeNull()
    expect(m.here).toBeNull()
  })
})

describe("handoffCardModel — the new thread's first message (D-267-15)", () => {
  it("(16) curly-quoted header and one bullet per summary item", () => {
    const m = handoffCardModel(marker)
    expect(m.header).toBe("Handed off from “Q3 board prep”")
    expect(m.bullets).toEqual(marker.summary)
    expect(m.paragraph).toBeNull()
  })

  it("(17) a source title over 60 characters is truncated with …", () => {
    const long = "A".repeat(75)
    expect(handoffCardModel({ ...marker, source_title: long }).header).toBe(
      `Handed off from “${"A".repeat(60)}…”`,
    )
  })

  it("(18) a legacy single-string summary renders as one paragraph", () => {
    const m = handoffCardModel({ ...marker, summary: "One line." as unknown as string[] })
    expect(m.bullets).toBeNull()
    expect(m.paragraph).toBe("One line.")
  })
})

describe("eventTimeLabel — HH:mm today, 'MMM d, HH:mm' otherwise", () => {
  it("(19) same local day → the time alone; another day → the date too", () => {
    const at = "2026-09-25T14:32:00Z"
    const sameDay = new Date(Date.parse(at) + 60_000)
    const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    expect(eventTimeLabel(at, sameDay)).toBe(time)
    const later = new Date(Date.parse(at) + 3 * 86_400_000)
    const other = eventTimeLabel(at, later)
    expect(other).toContain(time)
    expect(other).not.toBe(time)
  })
})
