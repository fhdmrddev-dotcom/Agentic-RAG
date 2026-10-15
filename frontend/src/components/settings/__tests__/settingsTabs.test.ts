/**
 * Phase 283-01 (FIX-01 / D-03, D-14) — THE SETTINGS TAB REGISTRY.
 *
 * `settingsTabs.ts` is the tab-REGISTRATION seam the G-5 hot-file ledger recorded as OWED on
 * `pages/SettingsPage.tsx`: every tab id, its audience, the strip order and the fallback for a
 * persisted choice the caller can no longer use are declared ONCE there, and the page asks.
 *
 * ⚠ THESE CASES REPRODUCE THE PAGE'S RULE AS OF PHASE_BASE `9a0b78622` — they are a
 *   behaviour-preserving pin, not a new rule. Two cases are deliberately "today" and are named
 *   as the ones 283-02 (D-05) changes: the fallback is the first `everyone` tab ("3") for BOTH
 *   roles, and an unknown id passes through untouched.
 *
 * ⚠ THE SOURCE-ORDER FENCE (last block) EXISTS BECAUSE THE LABELS ARE NOT RENDERED FROM HERE.
 *   `scripts/check-docs-coverage.cjs` and `scripts/check-landing-drift.cjs` scrape the LITERAL
 *   `<TabsTrigger>` labels from SettingsPage.tsx in SOURCE order, so the strip stays literal JSX
 *   (orchestrator ruling 2 / RESEARCH Option A). The registry order and the JSX order are two
 *   registers of one fact; this fence is what stops them drifting apart.
 */
import { describe, expect, it } from "vitest"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import settingsPageSrc from "@/pages/SettingsPage.tsx?raw"
import { stripComments } from "@/lib/stripComments.testutil"
import {
  RETIRED_SETTINGS_TABS,
  SETTINGS_TABS,
  SETTINGS_TAB_STORAGE_KEY,
  isSettingsTabVisible,
  resolveSettingsTab,
  settingsTabFallback,
  visibleSettingsTabs,
} from "@/components/settings/settingsTabs"

describe("settingsTabs — the registry (D-14)", () => {
  it("declares every tab once, in strip order, with its audience", () => {
    expect(SETTINGS_TABS.map((t) => t.id)).toEqual(["0", "1", "2", "3", "4"])
    const audience = Object.fromEntries(SETTINGS_TABS.map((t) => [t.id, t.audience]))
    expect(audience).toEqual({
      "0": "model_management",
      "1": "model_management",
      "2": "model_management",
      "3": "everyone",
      "4": "everyone",
    })
  })

  it("lists \"5\" as retired and keeps the persisted-choice key (D-03)", () => {
    expect(RETIRED_SETTINGS_TABS).toEqual(["5"])
    expect(SETTINGS_TAB_STORAGE_KEY).toBe("settings_active_tab")
  })
})

describe("settingsTabs — visibility (fail-closed boolean)", () => {
  it("shows an operator every tab and a member only Memory and Audit Log", () => {
    expect(visibleSettingsTabs(true).map((t) => t.id)).toEqual(["0", "1", "2", "3", "4"])
    expect(visibleSettingsTabs(false).map((t) => t.id)).toEqual(["3", "4"])
  })

  it("never shows the retired \"5\" to anyone (D-03)", () => {
    expect(isSettingsTabVisible("5", true)).toBe(false)
    expect(isSettingsTabVisible("5", false)).toBe(false)
  })

  it("hides a governed tab from a member and shows an everyone tab", () => {
    expect(isSettingsTabVisible("0", false)).toBe(false)
    expect(isSettingsTabVisible("3", false)).toBe(true)
    expect(isSettingsTabVisible("0", true)).toBe(true)
  })
})

describe("settingsTabs — resolving a persisted choice (today's rule, reproduced exactly)", () => {
  it("falls back to the first everyone tab (\"3\") for both roles", () => {
    expect(settingsTabFallback(true)).toBe("3")
    expect(settingsTabFallback(false)).toBe("3")
  })

  it("starts at \"0\" when nothing is persisted", () => {
    expect(resolveSettingsTab(null, true)).toBe("0")
    expect(resolveSettingsTab(null, false)).toBe("3")
  })

  it("redirects the retired \"5\" for both roles", () => {
    expect(resolveSettingsTab("5", true)).toBe("3")
    expect(resolveSettingsTab("5", false)).toBe("3")
  })

  it("redirects a governed tab for a member and keeps it for an operator", () => {
    expect(resolveSettingsTab("1", false)).toBe("3")
    expect(resolveSettingsTab("1", true)).toBe("1")
    expect(resolveSettingsTab("4", false)).toBe("4")
  })

  it("passes an unknown id through untouched (today; 283-02 / D-05 redirects it)", () => {
    // ⚠ PINNED AS TODAY'S BEHAVIOUR, NOT ENDORSED. At PHASE_BASE the page's ternary only
    //   redirected "5" and the governed ids, so "9" selected a TabsContent that does not exist.
    //   283-02 (D-05) is the plan that changes this case.
    expect(resolveSettingsTab("9", true)).toBe("9")
    expect(resolveSettingsTab("9", false)).toBe("9")
  })
})

describe("settingsTabs — the literal strip in SettingsPage.tsx follows the registry order", () => {
  it("has one trigger per registry id, in registry order", () => {
    const src = stripComments(settingsPageSrc as string)
    const list = src.match(/<TabsList[^>]*>([\s\S]*?)<\/TabsList>/)
    expect(list, "SettingsPage.tsx must contain a <TabsList>").not.toBeNull()
    const ids = [...list![1].matchAll(/<TabsTrigger\b[^>]*\bvalue="([^"]+)"/g)].map((m) => m[1])
    // Non-vacuity: a regex that matched nothing would make the order check meaningless.
    expect(ids.length).toBeGreaterThanOrEqual(5)
    expect(ids).toEqual(SETTINGS_TABS.map((t) => t.id))
  })
})
