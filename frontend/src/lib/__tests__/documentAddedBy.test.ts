/**
 * Phase 271-03 Task 3 (FIND-01 / T-271-11 / 270 P-02 / 270 UAT G4-4a) — the ONE home of
 * "Added by". The detail panel's File section and the Find result column both read it, so
 * the two can never disagree about who added a document.
 *
 * Pinned: the connection is tested FIRST (a connector-placed file is owned by the person who
 * connected it, and must not read "You"), and the answer is never an email.
 */
import { describe, it, expect } from "vitest"

import type { Document } from "@/types"
import { NOT_RECORDED, addedBy } from "../documentAddedBy"

function doc(overrides: Partial<Document>): Document {
  return {
    id: "d1",
    user_id: "u-me",
    folder_id: null,
    filename: "a.pdf",
    file_path: "u-me/a.pdf",
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: null,
    metadata: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("addedBy", () => {
  it("names a connection with its name", () => {
    expect(
      addedBy(doc({ source_connection_id: "c1", source_connection_name: "Drive Finance" }), "u-me"),
    ).toBe("Drive Finance (connected source)")
  })

  it("tests the connection FIRST — an unnamed connection never reads 'You'", () => {
    expect(addedBy(doc({ source_connection_id: "c1", source_connection_name: null }), "u-me")).toBe(
      "a connected source",
    )
  })

  it("reads 'You' for the caller's own upload", () => {
    expect(addedBy(doc({}), "u-me")).toBe("You")
  })

  it("reads 'name not available' for someone else, and with no caller id", () => {
    expect(addedBy(doc({ user_id: "u-other" }), "u-me")).toBe("name not available")
    expect(addedBy(doc({}), undefined)).toBe("name not available")
  })

  it("never returns an email (P-02), whatever the row carries", () => {
    const rows = [
      doc({ user_id: "someone@example.com" }),
      doc({ user_id: "someone@example.com", source_connection_id: "c1" }),
      doc({ user_id: "u-me" }),
    ]
    for (const r of rows) {
      expect(addedBy(r, "u-me")).not.toContain("@")
      expect(addedBy(r, undefined)).not.toContain("@")
    }
  })

  it("NOT_RECORDED is the 270 wording", () => {
    expect(NOT_RECORDED).toBe("not recorded")
  })
})
