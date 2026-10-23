/**
 * Phase 282-02 (FIX-07 / D-12 / D-24) — the ONE draft home for an `ask_user` pause.
 *
 * Every rendering of a pending question (the chat card, the panel card, the chat pointer's draft
 * line, WorkflowRunPage's direct card) reads its draft from this store, keyed by `tool_call_id`.
 * Nothing is copied between cards; copying is the roadmap's named failure.
 *
 * These cases pin the store's contract directly, with no component in the way:
 *   1. one draft per id, and a stable EMPTY_DRAFT for an unknown id (zustand v5 selector rule);
 *   2. GC on the ask slice — a draft whose ask left `pendingAsksByThread` is deleted;
 *   3. two threads keep independent drafts;
 *   4. `markSettled` clears the draft and records the settle in one write;
 *   5. the panel-home presence count is a refcount that never goes negative;
 *   6. `resetAskDrafts` empties everything, and the GLOBAL afterEach in setupTests.ts does it
 *      between cases without this file asking.
 */
import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import type { PendingAsk } from "@/types"
import { useStreamsStore } from "@/stores/streamsStore"
import {
  EMPTY_DRAFT,
  resetAskDrafts,
  useAskDraft,
  useAskDraftStore,
  useAskSettled,
  usePanelHomeMounted,
} from "@/stores/askDraftStore"

const ask = (id: string): PendingAsk => ({
  tool_call_id: id,
  prompt: `question ${id}`,
  options: ["a", "b"],
  timeout_seconds: 300,
})

describe("askDraftStore (282-02 / D-12) — one draft per ask", () => {
  it("Test 1: setChoice + setFreeText write one draft; an unknown id reads the SAME EMPTY_DRAFT twice", () => {
    const s = useAskDraftStore.getState()
    s.setChoice("tc-1", 1)
    s.setFreeText("tc-1", "why")
    expect(useAskDraftStore.getState().drafts["tc-1"]).toEqual({ choiceIndex: 1, freeText: "why" })

    const { result, rerender } = renderHook(() => useAskDraft("tc-unknown"))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(first).toBe(EMPTY_DRAFT)
    expect(first).toEqual({ choiceIndex: null, freeText: "" })
  })

  it("Test 2 (GC): an ask leaving pendingAsksByThread deletes its draft and settled entry, and keeps the others", () => {
    useStreamsStore.setState({
      pendingAsksByThread: new Map([
        ["t1", [ask("tc-1")]],
        ["t2", [ask("tc-2")]],
      ]),
    })
    const s = useAskDraftStore.getState()
    s.setChoice("tc-1", 0)
    s.setFreeText("tc-2", "keep me")
    useAskDraftStore.setState({ settled: { "tc-1": true } })

    useStreamsStore.setState({ pendingAsksByThread: new Map([["t2", [ask("tc-2")]]]) })

    const after = useAskDraftStore.getState()
    expect(after.drafts["tc-1"]).toBeUndefined()
    expect(after.settled["tc-1"]).toBeUndefined()
    expect(after.drafts["tc-2"]).toEqual({ choiceIndex: null, freeText: "keep me" })

    useStreamsStore.setState({ pendingAsksByThread: new Map() })
  })

  it("Test 3: drafts on asks in two different threads are independent", () => {
    useStreamsStore.setState({
      pendingAsksByThread: new Map([
        ["t1", [ask("tc-a")]],
        ["t2", [ask("tc-b")]],
      ]),
    })
    const s = useAskDraftStore.getState()
    s.setChoice("tc-a", 1)
    s.setFreeText("tc-b", "other thread")
    s.setChoice("tc-a", 0)
    expect(useAskDraftStore.getState().drafts["tc-b"]).toEqual({ choiceIndex: null, freeText: "other thread" })
    s.setFreeText("tc-b", "changed")
    expect(useAskDraftStore.getState().drafts["tc-a"]).toEqual({ choiceIndex: 0, freeText: "" })

    useStreamsStore.setState({ pendingAsksByThread: new Map() })
  })

  it("Test 4: markSettled clears the draft and makes the settled selector true", () => {
    const s = useAskDraftStore.getState()
    s.setChoice("tc-1", 1)
    s.markSettled("tc-1")
    expect(useAskDraftStore.getState().drafts["tc-1"]).toBeUndefined()
    const { result } = renderHook(() => useAskSettled("tc-1"))
    expect(result.current).toBe(true)
    const other = renderHook(() => useAskSettled("tc-2"))
    expect(other.result.current).toBe(false)
  })

  it("Test 5: the panel-home count is a refcount that never goes negative", () => {
    const s = useAskDraftStore.getState()
    s.addPanelHome("t1")
    s.addPanelHome("t1")
    s.removePanelHome("t1")
    const { result, rerender } = renderHook(() => usePanelHomeMounted("t1"))
    expect(result.current).toBe(true)
    s.removePanelHome("t1")
    rerender()
    expect(result.current).toBe(false)
    s.removePanelHome("t1")
    rerender()
    expect(result.current).toBe(false)
    expect(useAskDraftStore.getState().panelHomes["t1"]).toBeUndefined()
    const nullThread = renderHook(() => usePanelHomeMounted(null))
    expect(nullThread.result.current).toBe(false)
  })

  // ── Phase 295-06 (D-03 / D-32) — the chosen folder for "Search another folder" lives in the
  // SAME draft, keyed by `tool_call_id`, so the chat pointer and the panel card never disagree
  // about it (282-02's one-draft rule). One field, one action.
  describe("Test 7 (295-06): the chosen folder is part of the one draft", () => {
    it("7a: setFolder stores the folder on that ask's draft and useAskDraft returns it", () => {
      const s = useAskDraftStore.getState()
      s.setChoice("tc-f", 0)
      s.setFolder("tc-f", "f-leases")
      expect(useAskDraftStore.getState().drafts["tc-f"]).toEqual({
        choiceIndex: 0,
        freeText: "",
        folderId: "f-leases",
      })
      const { result } = renderHook(() => useAskDraft("tc-f"))
      expect(result.current.folderId).toBe("f-leases")
      // Another ask's draft is untouched.
      expect(useAskDraftStore.getState().drafts["tc-other"]).toBeUndefined()
    })

    it("7b: setChoice and setFreeText keep the chosen folder", () => {
      const s = useAskDraftStore.getState()
      s.setFolder("tc-f", "f-hr")
      s.setChoice("tc-f", 1)
      s.setFreeText("tc-f", "note")
      expect(useAskDraftStore.getState().drafts["tc-f"]).toEqual({
        choiceIndex: 1,
        freeText: "note",
        folderId: "f-hr",
      })
    })

    it("7c: clearDraft and markSettled drop the chosen folder with the rest of the draft", () => {
      const s = useAskDraftStore.getState()
      s.setFolder("tc-c", "f-a")
      s.clearDraft("tc-c")
      expect(useAskDraftStore.getState().drafts["tc-c"]).toBeUndefined()
      const cleared = renderHook(() => useAskDraft("tc-c"))
      expect(cleared.result.current.folderId).toBeUndefined()

      s.setFolder("tc-s", "f-b")
      s.markSettled("tc-s")
      expect(useAskDraftStore.getState().drafts["tc-s"]).toBeUndefined()
      const settled = renderHook(() => useAskDraft("tc-s"))
      expect(settled.result.current.folderId).toBeUndefined()
    })

    it("7d: EMPTY_DRAFT stays ONE frozen reference with no folder after a setFolder elsewhere", () => {
      useAskDraftStore.getState().setFolder("tc-x", "f-x")
      expect(Object.isFrozen(EMPTY_DRAFT)).toBe(true)
      expect(EMPTY_DRAFT).toEqual({ choiceIndex: null, freeText: "" })
      expect("folderId" in EMPTY_DRAFT).toBe(false)
      const { result, rerender } = renderHook(() => useAskDraft("tc-none"))
      const first = result.current
      rerender()
      expect(result.current).toBe(first)
      expect(first).toBe(EMPTY_DRAFT)
    })
  })

  describe("Test 6: resetAskDrafts, and the global afterEach that calls it", () => {
    it("6a: resetAskDrafts empties drafts, settled and panelHomes (and leaves state behind for 6b)", () => {
      const s = useAskDraftStore.getState()
      s.setChoice("tc-leak", 1)
      s.markSettled("tc-settled")
      s.addPanelHome("t-leak")
      resetAskDrafts()
      const after = useAskDraftStore.getState()
      expect(after.drafts).toEqual({})
      expect(after.settled).toEqual({})
      expect(after.panelHomes).toEqual({})

      // Leave state behind on purpose — 6b proves the GLOBAL afterEach (setupTests.ts) clears it.
      s.setChoice("tc-leak", 1)
      s.markSettled("tc-settled")
      s.addPanelHome("t-leak")
    })

    it("6b: the next case starts clean without calling resetAskDrafts itself", () => {
      const now = useAskDraftStore.getState()
      expect(now.drafts).toEqual({})
      expect(now.settled).toEqual({})
      expect(now.panelHomes).toEqual({})
    })
  })
})
