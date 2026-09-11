/**
 * Phase 244 Plan 02 Task 1 (SHELL-04 / D-244-24) — THE ALLOW-LIST LOCKSTEP, AS A MECHANISM.
 *
 * ⛔ WHAT THIS REPLACES. `workspace.py`'s own comment read *"kept in lockstep with
 * TemplateUpload.tsx accept="* and `TemplateUpload.tsx`'s docblock read *"kept in lockstep with
 * workspace.py _ALLOWED_EXT"* — two comments pointing at each other, enforced by nothing, with a
 * THIRD hand-typed copy in the sketch's `COPY.engine.ALLOWED_EXT`. Three copies of one list, and
 * the only thing keeping them equal was that nobody had changed it since Phase 151. D-244-24
 * changes it (`.pdf`), which is exactly the moment a comment-enforced invariant rots.
 *
 * ⚠ A PRESENCE ASSERTION CANNOT SEE CONTENT DRIFT. So this does NOT assert that the constant
 * exists, or that some extension appears somewhere — it parses the server's FOUR `_*_EXT` set
 * literals out of `workspace.py` as source and asserts SET EQUALITY, element for element, against
 * the exported TS constant. A list that gains a member on one side and not the other goes red.
 *
 * ⚠ EVERY PATTERN TOLERATES CRLF — source files check out with Windows line endings on this box,
 * and a terminator spelled `\n` silently never matches, which yields an empty result that passes
 * VACUOUSLY. `[\s\S]` and `\r?\n` throughout, and every extraction is asserted non-empty BEFORE
 * any claim rests on it (the `acceptFormats.test.ts` precedent).
 *
 * ⚠ IF THIS FENCE DISAGREES WITH THE SERVER, THE TS CONSTANT IS WRONG. The server's
 * `validate_upload` is the real gate; `accept=` is a UX hint. Never widen the constant to satisfy
 * the frontend.
 */
import { describe, it, expect } from "vitest"

import { WORKSPACE_ALLOWED_EXT, WORKSPACE_ACCEPT_ATTR } from "../workspaceAllowedExt"

// The server's upload gate, read as source. Depth: __tests__ -> lib -> src -> frontend -> root.
import workspacePySource from "../../../../backend/app/api/workspace.py?raw"

// The one consumer, swept as source — a grep cannot see a literal that was re-introduced.
import templateUploadSource from "../../components/panel/TemplateUpload.tsx?raw"

/** Line-anchored comment stripper — the `^\s*` is load-bearing (`FileRow.sweep.test.ts:100-105`). */
const codeOf = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*#.*$/gm, "")

/** The four category sets the server unions into `_ALLOWED_EXT`. */
const CATEGORY_SETS = ["_OOXML_EXT", "_TEXT_EXT", "_IMAGE_EXT", "_PDF_EXT"] as const

/** Extract `NAME = {".a", ".b"}` from the python source and return its members. */
function serverSet(name: string): string[] {
  const code = codeOf(workspacePySource)
  const m = new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}`).exec(code)
  expect(m, `${name} set literal not found in workspace.py`).not.toBeNull()
  const members = [...m![1].matchAll(/"(\.[a-z0-9]+)"/g)].map((x) => x[1])
  expect(members.length, `${name} parsed to an EMPTY set — the fence would pass vacuously`).toBeGreaterThan(0)
  return members
}

describe("244-02 T1 — workspaceAllowedExt is in lockstep with workspace.py", () => {
  it("parses a non-empty server allow-list before anything rests on it", () => {
    expect(workspacePySource.length).toBeGreaterThan(1000)
    const all = CATEGORY_SETS.flatMap(serverSet)
    expect(all.length).toBeGreaterThanOrEqual(16)
  })

  it("the TS constant EQUALS the server's union, element for element", () => {
    const server = [...new Set(CATEGORY_SETS.flatMap(serverSet))].sort()
    expect([...WORKSPACE_ALLOWED_EXT].sort()).toEqual(server)
  })

  it("the server really unions all four categories into _ALLOWED_EXT", () => {
    // ⛔ Without this, a category could be parsed here and never reach the server's own gate —
    // the fence would agree with a set the door does not use.
    const code = codeOf(workspacePySource)
    const m = /_ALLOWED_EXT\s*=\s*([^\r\n]+)/.exec(code)
    expect(m, "_ALLOWED_EXT assignment not found").not.toBeNull()
    for (const name of CATEGORY_SETS) {
      expect(m![1]).toContain(name)
    }
  })

  it("includes .pdf — the D-244-24 ruling, on both sides", () => {
    expect(WORKSPACE_ALLOWED_EXT).toContain(".pdf")
    expect(serverSet("_PDF_EXT")).toEqual([".pdf"])
  })

  it("the accept attribute is the comma-joined constant, with no separate list", () => {
    expect(WORKSPACE_ACCEPT_ATTR).toBe(WORKSPACE_ALLOWED_EXT.join(","))
    expect(WORKSPACE_ACCEPT_ATTR).toContain(".pdf")
  })

  it("TemplateUpload holds NO hand-typed accept literal — it reads the constant", () => {
    const code = templateUploadSource.replace(/\/\*[\s\S]*?\*\//g, "")
    // The second hand-typed copy. If this pattern ever matches again, the rot came back.
    expect(code).not.toMatch(/accept="\.[a-z]/)
    expect(code).toContain("WORKSPACE_ACCEPT_ATTR")
  })
})
