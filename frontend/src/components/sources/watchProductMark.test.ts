/**
 * Phase 240 — a watched folder wears the mark of the PRODUCT it came from.
 *
 * ⛔ THE CASE THIS FILE EXISTS FOR is `a mail watch and a Drive watch on the SAME connection get
 * DIFFERENT marks`. Gmail and Drive share one Google connection here by design, so a row keyed on
 * `service_id` draws the same icon for both — the ambiguity the operator reported.
 */
import { describe, expect, it } from "vitest"

import { watchProductMarkKey } from "./watchProductMark"

describe("watchProductMarkKey", () => {
  it("gives a mail watch and a Drive watch DIFFERENT marks on the SAME connection", () => {
    // ⭐ The whole point, in one assertion.
    const mail = watchProductMarkKey("mailbox:INBOX:after:1788900000", "google")
    const drive = watchProductMarkKey("1CVGai6ItBA8-YnF3sGGemI8NdgAWdu_y", "google")
    expect(mail).toBe("google-gmail")
    expect(drive).toBe("google-drive")
    expect(mail).not.toBe(drive)
  })

  it("reads the ADDRESS, not the connection's name", () => {
    // ⚠ Phase 238 found a real defect where a Microsoft connection someone had typed "Google
    //   migration" into was read by the Google adapter. Identity comes from structure, not prose.
    expect(watchProductMarkKey("mailbox:INBOX", "google")).toBe("google-gmail")
    expect(watchProductMarkKey("some-drive-folder-id", "google")).toBe("google-drive")
  })

  it("draws NOTHING rather than borrowing a mark for a vendor it does not know", () => {
    // `connectionMark.tsx` records the rule: borrowing Gmail's mark for another vendor's mail is
    // the ROADMAP's own named mistake. No mark is honest; a wrong mark is not.
    expect(watchProductMarkKey("mailbox:INBOX", "microsoft")).toBeNull()
    expect(watchProductMarkKey("folder-123", "dropbox")).toBeNull()
    expect(watchProductMarkKey(null, null)).toBeNull()
  })

  it("handles the un-anchored and root mail addresses too", () => {
    expect(watchProductMarkKey("mailbox_root", "google")).toBe("google-gmail")
    expect(watchProductMarkKey("mailbox:Label_9", "google_workspace")).toBe("google-gmail")
  })

  it("resolves Microsoft Graph, OneDrive, and SharePoint watched folders to microsoft", () => {
    // WR-09 fix: Microsoft Graph folders wear the official Microsoft mark
    expect(watchProductMarkKey("01ABCDEF123456", "microsoft")).toBe("microsoft")
    expect(watchProductMarkKey("root", "microsoft_graph")).toBe("microsoft")
    expect(watchProductMarkKey("folder-abc", "onedrive")).toBe("microsoft")
    expect(watchProductMarkKey("docs-site", "sharepoint")).toBe("microsoft")
  })

  it("does not borrow mail marks for Microsoft mailboxes", () => {
    expect(watchProductMarkKey("mailbox:Inbox", "microsoft")).toBeNull()
    expect(watchProductMarkKey("mailbox_root", "microsoft_graph")).toBeNull()
  })
})

// ── the half that reading the source did NOT catch ──────────────────────────────────────────
//
// ⛔ THE KEY MUST ACTUALLY RESOLVE TO A MARK, AND THE FIRST VERSION OF THIS FEATURE DID NOT.
// `watchProductMarkKey` returned `"google-gmail"` correctly and the row still drew the neutral
// plug, because the glyph was handed `{ capability: key }` — and `connectionMark`'s capability
// arm keys on capability names (`gmail_read`), while `"google-gmail"` is a SERVICE id. Both
// tables live in the same module and both contain google-shaped strings, so reading the source
// was not enough: `connectionMark({capability:"google-gmail"})` answers `unknown`.
//
// ⚠ The operator found it by looking at the screen after I had told them it was fixed. This test
// is the thing that should have caught it, and it asserts the END of the chain rather than the
// middle: a key this module returns must resolve to a REAL mark, never the neutral plug.
import { connectionMark } from "@/lib/connectionMark"

describe("the key this module returns actually resolves to a product mark", () => {
  it("a mail watch resolves to the Gmail mark, not the neutral plug", () => {
    const key = watchProductMarkKey("mailbox:INBOX:after:1788900000", "google")
    expect(connectionMark({ service_id: key }).key).toBe("google-gmail")
  })

  it("a Drive watch resolves to the Drive mark, not the neutral plug", () => {
    const key = watchProductMarkKey("1CVGai6ItBA8", "google")
    expect(connectionMark({ service_id: key }).key).toBe("google-drive")
  })

  it("a Microsoft Graph / OneDrive watch resolves to the Microsoft mark, not the neutral plug", () => {
    const key = watchProductMarkKey("01ABCDEF123456", "microsoft_graph")
    expect(connectionMark({ service_id: key }).key).toBe("microsoft")
  })

  it("neither resolves to the neutral 'unknown' mark", () => {
    // The assertion that would have failed on the shipped-and-wrong version.
    for (const folder of ["mailbox:INBOX", "some-drive-folder"]) {
      const key = watchProductMarkKey(folder, "google")
      expect(connectionMark({ service_id: key }).key).not.toBe("unknown")
    }
    const msKey = watchProductMarkKey("01ABCDEF", "onedrive")
    expect(connectionMark({ service_id: msKey }).key).not.toBe("unknown")
  })
})
