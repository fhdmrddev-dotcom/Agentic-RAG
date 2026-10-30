/**
 * Phase 302 plan 01 (FIX-01, BUG-261027-01) — the pure fold that turns a thread's messages into
 * the panel's "Generated files" list.
 *
 * The measured cause (302-RESEARCH F1): sandbox outputs never enter workspace_files; they live on
 * the thread's messages as `finalOutputFiles`. The panel now reads that same source. UI-D3: one
 * row per file NAME, latest turn wins; a name the workspace already lists is listed once, there.
 */
import { describe, it, expect } from "vitest"
import type { Message, WorkspaceFile } from "@/types"
import { deriveGeneratedFiles, GENERATED_FILES_LABEL } from "@/components/panel/generatedFiles"

function msg(id: string, created_at: string, files?: Message["finalOutputFiles"]): Message {
  return {
    id,
    thread_id: "t1",
    user_id: "u1",
    role: "assistant",
    content: "",
    created_at,
    updated_at: created_at,
    finalOutputFiles: files,
  } as Message
}

function ws(path: string): WorkspaceFile {
  return { path, size_bytes: 10, mime_type: "text/plain" }
}

const OLDER = msg("m1", "2026-10-27T10:00:00Z", [
  { filename: "c1.png", url: "/sandbox-outputs/u/e1/c1.png", size: 100 },
  { filename: "c2.png", url: "/sandbox-outputs/u/e1/c2.png", size: 200 },
])
const NEWER = msg("m2", "2026-10-27T10:05:00Z", [
  { filename: "c1.png", url: "/sandbox-outputs/u/e2/c1.png", size: 150 },
  { filename: "report.pdf", url: "/sandbox-outputs/u/e2/report.pdf", size: 900 },
])

describe("deriveGeneratedFiles (FIX-01 — the panel reads the chat's own source)", () => {
  it("returns the module's frozen EMPTY constant for nothing (same reference every call)", () => {
    const a = deriveGeneratedFiles([], [])
    const b = deriveGeneratedFiles([], [])
    expect(a).toEqual([])
    expect(a).toBe(b)
    expect(Object.isFrozen(a)).toBe(true)
  })

  it("newest turn first, source order inside a turn, one row per name with the newer url and instant", () => {
    const out = deriveGeneratedFiles([OLDER, NEWER], [])
    expect(out.map((f) => f.filename)).toEqual(["c1.png", "report.pdf", "c2.png"])
    expect(out[0]).toEqual({
      filename: "c1.png",
      url: "/sandbox-outputs/u/e2/c1.png",
      size: 150,
      producedAt: "2026-10-27T10:05:00Z",
    })
    expect(out[2]).toEqual({
      filename: "c2.png",
      url: "/sandbox-outputs/u/e1/c2.png",
      size: 200,
      producedAt: "2026-10-27T10:00:00Z",
    })
    expect(out.filter((f) => f.filename === "c1.png")).toHaveLength(1)
  })

  it("a message with no finalOutputFiles, or an empty list, contributes nothing", () => {
    const out = deriveGeneratedFiles([msg("a", "2026-10-27T09:00:00Z"), msg("b", "2026-10-27T09:01:00Z", []), OLDER], [])
    expect(out.map((f) => f.filename)).toEqual(["c1.png", "c2.png"])
    expect(deriveGeneratedFiles([msg("a", "2026-10-27T09:00:00Z"), msg("b", "x", [])], [])).toBe(
      deriveGeneratedFiles([], []),
    )
  })

  it("keeps a file with no url (url undefined) so the row can render its dead arm", () => {
    const out = deriveGeneratedFiles([msg("a", "2026-10-27T09:00:00Z", [{ filename: "lost.csv" }])], [])
    expect(out).toEqual([{ filename: "lost.csv", url: undefined, size: undefined, producedAt: "2026-10-27T09:00:00Z" }])
  })

  it("a workspace path equal to the name, or ending in '/' + name, removes that generated entry", () => {
    const out = deriveGeneratedFiles([OLDER, NEWER], [ws("c1.png"), ws("outputs/report.pdf")])
    expect(out.map((f) => f.filename)).toEqual(["c2.png"])
  })

  it("a workspace path that merely ENDS with the name (no slash) does not remove it", () => {
    const out = deriveGeneratedFiles([OLDER], [ws("xc1.png")])
    expect(out.map((f) => f.filename)).toEqual(["c1.png", "c2.png"])
  })

  it("producedAt is null when the producing message carries no instant", () => {
    const m = msg("a", "", [{ filename: "a.txt", url: "/sandbox-outputs/a.txt" }])
    ;(m as { created_at?: string }).created_at = undefined
    expect(deriveGeneratedFiles([m], [])[0].producedAt).toBeNull()
  })

  it("GENERATED_FILES_LABEL is exactly 'Generated files'", () => {
    expect(GENERATED_FILES_LABEL).toBe("Generated files")
  })
})
