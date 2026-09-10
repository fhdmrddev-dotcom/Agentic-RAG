/**
 * The connections surface must be reachable by a caller who is not an operator.
 *
 * ⚠ THE DEFECT THIS PINS SHIPPED THROUGH FIVE PHASES AND WAS FOUND BY THE OPERATOR.
 * `NAV_ITEMS`' Settings entry carries `feature: "model_management"`, which
 * `backend/app/api/features.py:21` classifies Operators-only. `visibleNavItems` drops a
 * governed entry whose key is not strictly `true`, so for every member the Settings entry
 * vanished — and with it Connections, the whole point of Phases 211-216.
 *
 * The tag was CORRECT when Settings held only model management. It stopped being correct
 * when Settings grew a per-user tab, and nothing noticed because no test asked this
 * question: *can a member reach connections at all?*
 *
 * ⚠ THE ASSERTION IS DELIBERATELY ABOUT REACHABILITY, NOT ABOUT A LABEL. It does not care
 * which entry provides the door or what it is called — only that a fail-closed map still
 * leaves one. Renaming the entry keeps this green; re-governing it goes red, which is the
 * only behaviour worth pinning.
 */
import { describe, it, expect } from "vitest"
import { NAV_ITEMS, visibleNavItems } from "@/lib/nav-items"
import type { EffectiveFeatures } from "@/lib/api"

/** The map's fail-closed shape: every governed feature hidden (a member, or a blip). */
// ⚠ CORRECTED 2026-09-09. This read `{} as EffectiveFeatures`, and that fixture ENCODED THE BUG
// the operator later hit: an empty object is "we have not been told yet", NOT "this member is
// denied". `GET /features` builds its answer with a dict comprehension over EVERY governed
// feature (`api/features.py:61-78`), so a real member receives every key with an explicit
// boolean — `{}` only ever means loading, or a failed fetch.
//
// Standing in for a member with an empty object made `visibleNavItems` look correct while it was
// silently treating "unknown" as "denied", which is why a refresh sometimes lost Workflows,
// Settings and Control Room. The fixture now says what it means: explicitly DENIED.
const MEMBER: EffectiveFeatures = Object.fromEntries(
  NAV_ITEMS.filter((i) => i.feature).map((i) => [i.feature as string, false]),
) as EffectiveFeatures

describe("connections reachability for a non-operator", () => {
  it("leaves a connections door standing when every governed feature is hidden", () => {
    const visible = visibleNavItems(MEMBER)
    expect(visible.some((i) => i.view === "connections")).toBe(true)
  })

  it("keeps that door UNGOVERNED — a feature tag here would re-strand it", () => {
    const entry = NAV_ITEMS.find((i) => i.view === "connections")
    expect(entry).toBeDefined()
    // ⚠ If connections ever need governing they get their OWN key. Tagging this entry
    // `model_management` — whose audience is about MODELS — is the exact mistake above.
    expect(entry?.feature).toBeUndefined()
  })

  it("still hides the model_management Settings entry from a member", () => {
    // The original decision is not reverted: Settings itself stays operator-only,
    // because GET/PUT /settings carry require_visible("model_management").
    const visible = visibleNavItems(MEMBER)
    expect(visible.some((i) => i.view === "settings")).toBe(false)
  })

  it("shows both entries to an operator", () => {
    const operator = { model_management: true } as unknown as EffectiveFeatures
    const visible = visibleNavItems(operator)
    expect(visible.some((i) => i.view === "settings")).toBe(true)
    expect(visible.some((i) => i.view === "connections")).toBe(true)
  })
})

describe("a member can reach the skills home", () => {
  it("leaves the Skills entry standing when every governed feature is hidden", () => {
    // ⚠ `skill_studio` gates api/evals.py, api/skill_test_cases.py and api/skill_tuner.py.
    // `api/skills.py` — create, upload, edit, all twelve routes — is UNGATED, so a member
    // has always been allowed to make a skill and has never had a door to it.
    expect(visibleNavItems(MEMBER).some((i) => i.view === "skills")).toBe(true)
  })

  it("does not put the Studio in the primary nav at all", () => {
    // It is a separate ActiveView reached from a skill, and it stays gated at its own API.
    expect(NAV_ITEMS.some((i) => i.view === "skill-studio")).toBe(false)
  })
})
