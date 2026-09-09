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
})
