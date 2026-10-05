/**
 * Phase 274 plan 05 Task 1 (D-27 / the 274-02 ↔ 274-03 contract) — THE PROMOTE CONTRACT FENCE.
 *
 * 274-02 built the backend (`app/models/workspace_promote.py`, `app/api/workspace_promote.py`) and
 * 274-03 built the client (`lib/api/attachments.ts`, `lib/attachmentLifetime.ts`) in parallel
 * worktrees against a contract written in prose. A renamed field is a silent `undefined` in the
 * dialog, never a type error — so this suite reads the backend as SOURCE (`?raw`) on the merged
 * tree and asserts:
 *   (a) every wire key the client reads is declared as a field in the backend models;
 *   (b) the `LibraryLink` literal is exactly `Literal["saved", "already"]`;
 *   (c) the upload-prefix regex source `^[0-9a-f]{8}-` sits in BOTH the backend route module and
 *       `lib/attachmentLifetime.ts` — the two strip the SAME prefix or the Library name and the
 *       chip name disagree.
 * The negative case runs the same checker over a planted copy with one field renamed, proving the
 * fence can fire rather than passing vacuously.
 */
import { describe, it, expect } from "vitest"
import { WORKSPACE_UPLOAD_PREFIX } from "@/lib/attachmentLifetime"

import modelsSource from "../../../../../backend/app/models/workspace_promote.py?raw"
import routeSource from "../../../../../backend/app/api/workspace_promote.py?raw"
import lifetimeSource from "../../../lib/attachmentLifetime.ts?raw"
import clientSource from "../../../lib/api/attachments.ts?raw"

/** Every key `lib/api/attachments.ts` reads off the three routes' answers. */
const CLIENT_KEYS = [
  "outcome",
  "document_id",
  "folder_id",
  "document_status",
  "filename",
  "version_number",
  "promotable",
  "refusal",
  "duplicate_of",
  "next_version",
  "workspace_file_id",
  "link",
  "files",
] as const

const PREFIX_SOURCE = "^[0-9a-f]{8}-"

/** A pydantic field declaration: an indented `name: <type>` line inside a class body. */
function declaredFields(python: string): Set<string> {
  const out = new Set<string>()
  for (const m of python.matchAll(/^ {4}([a-z_][a-z0-9_]*)\s*:\s*\S/gm)) out.add(m[1])
  return out
}

function missingKeys(python: string): string[] {
  const fields = declaredFields(python)
  return CLIENT_KEYS.filter((k) => !fields.has(k))
}

describe("promote contract — backend models vs the attachment client", () => {
  it("non-vacuity: every ?raw source is real", () => {
    expect(modelsSource.length).toBeGreaterThan(500)
    expect(modelsSource).toContain("class PromoteResult(BaseModel)")
    expect(modelsSource).toContain("class LibraryLinksResponse(BaseModel)")
    expect(routeSource.length).toBeGreaterThan(500)
    expect(routeSource).toContain("@router.post(")
    expect(lifetimeSource).toContain("export const WORKSPACE_UPLOAD_PREFIX")
    expect(clientSource).toContain("export interface PromoteResult")
    // The checker sees real fields, not an empty set.
    expect(declaredFields(modelsSource).size).toBeGreaterThanOrEqual(CLIENT_KEYS.length)
  })

  it("(a) every key the client reads is a declared field in workspace_promote.py", () => {
    expect(missingKeys(modelsSource)).toEqual([])
  })

  it("(a') the client actually declares each of those keys (the list is not invented)", () => {
    for (const k of CLIENT_KEYS) expect(clientSource).toMatch(new RegExp(`\\b${k}\\??:`))
  })

  it("(b) the link outcome is exactly the two literals the client switches on", () => {
    expect(modelsSource).toContain('LibraryLink = Literal["saved", "already"]')
    expect(clientSource).toContain('"saved"')
    expect(clientSource).toContain('"already"')
  })

  it("(c) the upload-prefix regex is spelled identically in the backend route and the client rule", () => {
    expect(routeSource).toContain(`r"${PREFIX_SOURCE}"`)
    expect(lifetimeSource).toContain(`/${PREFIX_SOURCE}/`)
    expect(WORKSPACE_UPLOAD_PREFIX.source).toBe(PREFIX_SOURCE)
  })

  it("NEGATIVE: a planted rename of one field makes the checker fire", () => {
    const planted = modelsSource.replace(/^ {4}next_version:/m, "    next_version_number:")
    expect(planted).not.toBe(modelsSource)
    expect(missingKeys(planted)).toEqual(["next_version"])

    const plantedLiteral = modelsSource.replace('Literal["saved", "already"]', 'Literal["saved", "linked"]')
    expect(plantedLiteral).not.toContain('LibraryLink = Literal["saved", "already"]')
  })
})
