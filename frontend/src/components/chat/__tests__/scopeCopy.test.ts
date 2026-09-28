/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / UI-SPEC §7.2) — THE ONE HOME for the scope chip, picker
 * and pending-note words, plus the two wire calls they read.
 *
 * ⛔ Every §7.2 string is pinned verbatim. Shared literals (`All your documents`, `Chat attachments`,
 * the unnameable-folder phrase, `Nothing`) are IMPORTED by the module and asserted equal to their
 * home here, so a re-spelling fails rather than drifting.
 *
 * ⛔ `explainFor` is the only place the Biased / Restricted WORDS are chosen, from the SERVER
 * payload's `expert` — no component touches `scope_mode` (D-268-12c).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      }),
      refreshSession: async () => ({ data: { session: null } }),
    },
  },
}))

import { UNNAMEABLE_FOLDER } from "@/components/experts/catalog/ExpertDetailModal"
import { LEDGER_COPY } from "@/components/experts/catalog/expertCatalog"
import type { ScopeEffect } from "@/lib/api/threads"
import { getScopeEffect, setThreadFolder } from "@/lib/api"
import { EVENT_COPY } from "../expertEventCopy"
import { SCOPE_COPY, chipLabel, explainFor, folderPathOf, joinFolders } from "../scopeCopy"

const line = (over: Partial<ScopeEffect["next"]> = {}): ScopeEffect["next"] => ({
  folders: [],
  thread_folder: null,
  all_documents: false,
  connections: [],
  ...over,
})

const HR = { id: "e2", name: "HR Advisor", scope_mode: "restricted" as const }
const FA = { id: "e1", name: "Financial Analyzer", scope_mode: "biased" as const }

describe("SCOPE_COPY — every §7.2 string, exact", () => {
  it("(1) chip, picker and ledger words", () => {
    expect(SCOPE_COPY.heldSuffix).toBe("· not searched")
    expect(SCOPE_COPY.chipAria("/Client ACME")).toBe("Search scope: /Client ACME. Change folder")
    expect(SCOPE_COPY.chipAriaHeld("/Client ACME", "HR Advisor")).toBe(
      "Search scope: /Client ACME, not searched while HR Advisor is active. Change folder",
    )
    expect(SCOPE_COPY.title).toBe("Search in")
    expect(SCOPE_COPY.subIdle).toBe("Applies from your next message. Earlier answers keep their sources.")
    expect(SCOPE_COPY.subStreaming).toBe(
      "The answer in progress keeps its scope. This applies from your next message.",
    )
    expect(SCOPE_COPY.current).toBe("current")
    expect(SCOPE_COPY.ledger).toEqual({
      next: "Next message searches",
      stops: "Stops searching",
      saved: "Saved",
      searching: "Searching",
    })
    expect(SCOPE_COPY.nothingChanges).toBe("Nothing changes")
    expect(SCOPE_COPY.expertTag).toBe("Expert")
    expect(SCOPE_COPY.loading).toBe("Checking what your next message will search…")
    expect(SCOPE_COPY.previewError).toBe("Couldn't check what your next message will search.")
    expect(SCOPE_COPY.tryAgain).toBe("Try again")
    expect(SCOPE_COPY.apply).toBe("Apply")
    expect(SCOPE_COPY.applying).toBe("Applying…")
    expect(SCOPE_COPY.cancel).toBe("Cancel")
  })

  it("(2) refusal, network reason and the two pending notes", () => {
    expect(SCOPE_COPY.refusal("Folder not found", "/Client ACME")).toBe(
      "Couldn't change the folder. Folder not found This chat still searches /Client ACME.",
    )
    expect(SCOPE_COPY.networkReason).toBe("The server could not be reached.")
    expect(SCOPE_COPY.pending("/Client ACME", "/Client ACME/Q3")).toBe(
      "The answer in progress keeps searching /Client ACME. /Client ACME/Q3 applies from your next message.",
    )
    expect(SCOPE_COPY.pendingHeld("/Client ACME/Q3", "HR Advisor")).toBe(
      "The answer in progress keeps its scope. /Client ACME/Q3 is saved for when HR Advisor leaves.",
    )
  })

  it("(3) shared literals are imported, never re-spelled", () => {
    expect(SCOPE_COPY.allDocuments).toBe(EVENT_COPY.allDocuments)
    expect(SCOPE_COPY.allDocuments).toBe("All your documents")
    expect(SCOPE_COPY.chatAttachments).toBe(LEDGER_COPY.chatAttachments)
    expect(SCOPE_COPY.unnameable).toBe(UNNAMEABLE_FOLDER)
  })
})

describe("labels — the full path, truncated only past 32 characters", () => {
  const folders = [
    { id: "a", name: "Client ACME", parent_id: null },
    { id: "b", name: "Q3 Contracts", parent_id: "a" },
    { id: "c", name: "Signed and countersigned", parent_id: "b" },
  ]

  it("(4) folderPathOf walks parent_id; a folder not in the list is null", () => {
    expect(folderPathOf("b", folders)).toBe("Client ACME/Q3 Contracts")
    expect(folderPathOf("a", folders)).toBe("Client ACME")
    expect(folderPathOf("zz", folders)).toBeNull()
  })

  it("(5) chipLabel: All your documents / /{path} / …/{last} past 32 / the unnameable phrase", () => {
    expect(chipLabel(null, folders)).toEqual({ label: "All your documents", full: "All your documents", unnamed: false })
    expect(chipLabel("b", folders)).toEqual({
      label: "/Client ACME/Q3 Contracts",
      full: "/Client ACME/Q3 Contracts",
      unnamed: false,
    })
    const deep = chipLabel("c", folders)
    expect(deep.full).toBe("/Client ACME/Q3 Contracts/Signed and countersigned")
    expect(deep.label).toBe("…/Signed and countersigned")
    expect(chipLabel("zz", folders)).toEqual({ label: UNNAMEABLE_FOLDER, full: UNNAMEABLE_FOLDER, unnamed: true })
  })

  it("(6) joinFolders — 'A and B' / 'A, B and C' (the 267 gate-line rule)", () => {
    expect(joinFolders(["A"])).toBe("A")
    expect(joinFolders(["A", "B"])).toBe("A and B")
    expect(joinFolders(["A", "B", "C"])).toBe("A, B and C")
  })
})

describe("explainFor — the Biased / held words, chosen from the SERVER payload", () => {
  it("(7) no Expert → no box", () => {
    expect(explainFor({ held: false, expert: null, next: line(), stops: line(), saved: null }, "/X")).toBeNull()
  })

  it("(8) Biased → the info box sentence", () => {
    expect(explainFor({ held: false, expert: FA, next: line(), stops: line(), saved: null }, "/X")).toEqual({
      tone: "info",
      lead: null,
      text: "Financial Analyzer is Biased, so it adds its own folder to whatever you pick here.",
    })
  })

  it("(9) held → the bold lead + the Restricted sentence naming the folders and the draft", () => {
    const eff: ScopeEffect = {
      held: true,
      expert: HR,
      next: line({ folders: [{ id: "h", name: "HR Policies", doc_count: null }] }),
      stops: line(),
      saved: { id: "b", name: "Q3 Contracts", doc_count: 2, path: "Client ACME/Q3 Contracts" },
    }
    expect(explainFor(eff, "/Client ACME/Q3 Contracts")).toEqual({
      tone: "held",
      lead: "No effect while HR Advisor is active.",
      text: " Restricted reads HR Policies only. /Client ACME/Q3 Contracts is saved and is searched once HR Advisor leaves.",
    })
  })
})

describe("the wire — setThreadFolder / getScopeEffect (re-exported from @/lib/api)", () => {
  beforeEach(() => vi.restoreAllMocks())
  const reply = (status: number, body: unknown) =>
    vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

  it("(10) setThreadFolder(id) sends PATCH {folder_id}; null sends {clear_folder: true}", async () => {
    const f = reply(200, { id: "t-1" })
    await setThreadFolder("t-1", "f-9")
    expect(String(f.mock.calls[0][0])).toMatch(/\/threads\/t-1$/)
    expect((f.mock.calls[0][1] as RequestInit).method).toBe("PATCH")
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ folder_id: "f-9" })
    await setThreadFolder("t-1", null)
    expect(JSON.parse(String((f.mock.calls[1][1] as RequestInit).body))).toEqual({ clear_folder: true })
  })

  it("(11) a refusal throws the server's own sentence", async () => {
    reply(404, { detail: "Folder not found" })
    await expect(setThreadFolder("t-1", "f-9")).rejects.toThrow("Folder not found")
  })

  it("(12) getScopeEffect: at rest, a draft folder, and clear", async () => {
    const f = reply(200, { held: false })
    await getScopeEffect("t-1")
    expect(String(f.mock.calls[0][0])).toMatch(/\/threads\/t-1\/scope-effect$/)
    await getScopeEffect("t-1", { folderId: "f-9" })
    expect(String(f.mock.calls[1][0])).toMatch(/\/threads\/t-1\/scope-effect\?folder_id=f-9$/)
    await getScopeEffect("t-1", { folderId: null })
    expect(String(f.mock.calls[2][0])).toMatch(/\/threads\/t-1\/scope-effect\?clear=true$/)
  })

  it("(13) a preview refusal keeps the server's detail", async () => {
    reply(404, { detail: "Thread not found" })
    await expect(getScopeEffect("t-1")).rejects.toThrow("Thread not found")
  })
})
