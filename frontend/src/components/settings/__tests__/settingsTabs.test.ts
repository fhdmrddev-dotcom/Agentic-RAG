/**
 * Phase 283-01 (FIX-01 / D-03, D-14) — THE SETTINGS TAB REGISTRY.
 *
 * `settingsTabs.ts` is the tab-REGISTRATION seam the G-5 hot-file ledger recorded as OWED on
 * `pages/SettingsPage.tsx`: every tab id, its audience, the strip order and the fallback for a
 * persisted choice the caller can no longer use are declared ONCE there, and the page asks.
 *
 * ⚠ 283-01 WROTE THESE CASES TO REPRODUCE THE PAGE'S RULE AS OF PHASE_BASE `9a0b78622` — a
 *   behaviour-preserving pin. Two of them were deliberately "today" and named as the ones 283-02
 *   (D-05) would change: the fallback was the first `everyone` tab ("3") for BOTH roles, and an
 *   unknown id passed through untouched.
 *
 * ⚠ REWRITTEN IN PLACE BY 283-02 (2026-10-15, FIX-01 / D-03, D-04, D-05), ON PURPOSE. Preferences
 *   "6" joins the registry between Integrations and Memory, and the fallback becomes the caller's
 *   FIRST VISIBLE tab (member "6", operator "0"). ANY id the caller cannot see — governed, retired
 *   or unknown — now resolves to that fallback, so a forced or stale `settings_active_tab` can
 *   never select an empty panel or a tab the caller has no right to. The edit is in place rather
 *   than additive so the old rule cannot survive alongside the new one.
 *
 * ⚠ THE SOURCE-ORDER FENCE (last block) EXISTS BECAUSE THE LABELS ARE NOT RENDERED FROM HERE.
 *   `scripts/check-docs-coverage.cjs` and `scripts/check-landing-drift.cjs` scrape the LITERAL
 *   `<TabsTrigger>` labels from SettingsPage.tsx in SOURCE order, so the strip stays literal JSX
 *   (orchestrator ruling 2 / RESEARCH Option A). The registry order and the JSX order are two
 *   registers of one fact; this fence is what stops them drifting apart.
 */
import { describe, expect, it } from "vitest"
// Vite `?raw` import (the `SearchDocumentsBody.test.ts` idiom) — the page's SOURCE text.
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
    expect(SETTINGS_TABS.map((t) => t.id)).toEqual(["0", "1", "2", "6", "3", "4"])
    const audience = Object.fromEntries(SETTINGS_TABS.map((t) => [t.id, t.audience]))
    expect(audience).toEqual({
      "0": "model_management",
      "1": "model_management",
      "2": "model_management",
      "6": "everyone",
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
  it("shows an operator every tab and a member only Preferences, Memory and Audit Log", () => {
    expect(visibleSettingsTabs(true).map((t) => t.id)).toEqual(["0", "1", "2", "6", "3", "4"])
    expect(visibleSettingsTabs(false).map((t) => t.id)).toEqual(["6", "3", "4"])
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

describe("settingsTabs — resolving a persisted choice (283-02 / D-05: first VISIBLE tab)", () => {
  it("falls back to the caller's first visible tab — \"0\" for an operator, \"6\" for a member", () => {
    // Was "3" for both roles until 283-02 (the wave-1 behaviour-preserving pin).
    expect(settingsTabFallback(true)).toBe("0")
    expect(settingsTabFallback(false)).toBe("6")
  })

  it("starts on the first visible tab when nothing is persisted", () => {
    expect(resolveSettingsTab(null, true)).toBe("0")
    expect(resolveSettingsTab(null, false)).toBe("6")
  })

  it("redirects the retired \"5\" to the first visible tab for both roles", () => {
    expect(resolveSettingsTab("5", true)).toBe("0")
    expect(resolveSettingsTab("5", false)).toBe("6")
  })

  it("redirects a governed tab for a member and keeps it for an operator", () => {
    expect(resolveSettingsTab("1", false)).toBe("6")
    expect(resolveSettingsTab("2", false)).toBe("6")
    expect(resolveSettingsTab("1", true)).toBe("1")
    expect(resolveSettingsTab("3", false)).toBe("3")
    expect(resolveSettingsTab("4", false)).toBe("4")
    expect(resolveSettingsTab("6", false)).toBe("6")
    expect(resolveSettingsTab("6", true)).toBe("6")
  })

  it("redirects an unknown id too (it used to pass through to an empty panel)", () => {
    expect(resolveSettingsTab("9", true)).toBe("0")
    expect(resolveSettingsTab("9", false)).toBe("6")
  })
})

describe("settingsTabs — the literal strip in SettingsPage.tsx follows the registry order", () => {
  it("has one trigger per registry id, in registry order", () => {
    const src = stripComments(settingsPageSrc as string)
    const list = src.match(/<TabsList[^>]*>([\s\S]*?)<\/TabsList>/)
    expect(list, "SettingsPage.tsx must contain a <TabsList>").not.toBeNull()
    const ids = [...list![1].matchAll(/<TabsTrigger\b[^>]*\bvalue="([^"]+)"/g)].map((m) => m[1])
    // Non-vacuity: a regex that matched nothing would make the order check meaningless.
    expect(ids.length).toBeGreaterThanOrEqual(6)
    expect(ids).toEqual(SETTINGS_TABS.map((t) => t.id))
  })
})
