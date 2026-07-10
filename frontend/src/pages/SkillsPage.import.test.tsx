/**
 * Phase 142 (SRH-01 / SC#1 / D-08): `buildImportMessage` surfaces the non-blocking
 * script-honesty note on the muted import line (D-09 — no new component).
 *
 * Authored fresh to pass at HEAD (MEMORY project_frontend_vitest_rot / SEED-056 — the
 * legacy vitest suite is partly rotted; this file does not depend on it). We unit-test the
 * pure message builder that `handleImport` calls, so the heavy page graph never mounts —
 * only `@/lib/supabase` is stubbed so importing the module doesn't construct a real client.
 */
import { describe, it, expect, vi } from "vitest"
import type { Skill } from "@/types"
import type { SkillImportResult } from "@/lib/api"

// SkillsPage -> useAuth -> @/lib/supabase constructs a real Supabase client at import time;
// stub it so the module loads under jsdom without env-driven network setup.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { buildImportMessage } from "./SkillsPage"

function mkSkill(name: string): Skill {
  return { id: name, name } as Skill
}

describe("buildImportMessage (Phase 142 SC#1 import note)", () => {
  it("appends the honesty note to the muted line when notes are present", () => {
    const result: SkillImportResult = {
      created: [mkSkill("JS Skill")],
      errors: [],
      notes: [
        {
          skill: "JS Skill",
          note: "'JS Skill' includes a step the sandbox can't run yet (helper.js); its instructions still work.",
        },
      ],
    }
    const msg = buildImportMessage(result)
    expect(msg.isError).toBe(false)
    expect(msg.text).toContain("1 skill imported.")
    expect(msg.text).toContain("Note:")
    expect(msg.text).toContain("helper.js")
  })

  it("shows the plain imported line with NO Note: when notes are absent", () => {
    const result: SkillImportResult = { created: [mkSkill("Py Skill")], errors: [] }
    const msg = buildImportMessage(result)
    expect(msg.isError).toBe(false)
    expect(msg.text).toBe("1 skill imported.")
    expect(msg.text).not.toContain("Note:")
  })

  it("treats an empty notes list as no note", () => {
    const result: SkillImportResult = { created: [mkSkill("Py Skill")], errors: [], notes: [] }
    const msg = buildImportMessage(result)
    expect(msg.text).toBe("1 skill imported.")
    expect(msg.text).not.toContain("Note:")
  })

  it("keeps the mixed created+failed line and still appends notes", () => {
    const result: SkillImportResult = {
      created: [mkSkill("A"), mkSkill("B")],
      errors: [{ skill: "C", error: "bad yaml" }],
      notes: [
        {
          skill: "A",
          note: "'A' includes a step the sandbox can't run yet (run.sh); its instructions still work.",
        },
      ],
    }
    const msg = buildImportMessage(result)
    expect(msg.isError).toBe(false)
    expect(msg.text).toContain("2 skills imported, 1 failed")
    expect(msg.text).toContain("Note:")
    expect(msg.text).toContain("run.sh")
  })

  it("reports the no-skills case as an error with no note", () => {
    const result: SkillImportResult = { created: [], errors: [{ skill: "x", error: "e" }] }
    const msg = buildImportMessage(result)
    expect(msg.isError).toBe(true)
    expect(msg.text).toBe("No skills were imported.")
  })
})
