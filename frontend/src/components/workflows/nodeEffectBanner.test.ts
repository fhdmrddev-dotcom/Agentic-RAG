/**
 * nodeEffectBanner tests — Phase 209 (Item 2 · D-209-02)
 *
 * ⚠ MECHANISM: `readOnlyHint === true` ONLY, FAIL CLOSED.
 *
 * The PREVIOUS version (deleted 2026-08-26, blocking finding F1) used a verb-prefix regex
 * (`READ_VERB_PREFIX_RE`) to infer read-ness from the tool name. That is the wrong mechanism:
 * MCP imposes no constraint on naming, so `get_user_and_purge_records` would have shown
 * `ONLY READS` while deleting. Operator ruling: delete the regex, use only explicit
 * `readOnlyHint`, fail closed. See `.planning/209-HANDOFF.md`.
 *
 * This suite GUARDS that deletion with a SOURCE FENCE so the regex cannot silently return.
 */
import { describe, expect, it } from "vitest"

import sourceRaw from "./nodeEffectBanner.ts?raw"
import {
  EFFECT_BANNER_OUTSIDE,
  EFFECT_BANNER_READ_ONLY,
  effectBannerFor,
  isReadOnlyExternalAction,
} from "./nodeEffectBanner"

// ── Source guard: the deleted regex must not return ──────────────────────────────────────
it("the deleted READ_VERB_PREFIX_RE does NOT appear in nodeEffectBanner source (D-209-02 guard)", () => {
  // The needle is assembled from parts — the 187-24 lesson — so this file can never
  // satisfy its own guard. It is falsifiable: if the regex is re-introduced, this case
  // immediately goes red.
  const FORBIDDEN = ["READ", "VERB", "PREFIX", "RE"].join("_")
  expect(sourceRaw).not.toContain(FORBIDDEN)
  // POSITIVE CONTROL: the wrong fix really does contain the needle (guard is not vacuous).
  expect(`const ${FORBIDDEN} = /^(read|get)/`).toContain(FORBIDDEN)
})

describe("nodeEffectBanner", () => {
  describe("isReadOnlyExternalAction — readOnlyHint only, fail closed", () => {
    it("returns true ONLY on explicit readOnlyHint === true", () => {
      expect(isReadOnlyExternalAction({ readOnlyHint: true })).toBe(true)
      // tool_name alone is NOT a signal — the key point of the fix
      expect(isReadOnlyExternalAction({ tool_name: "read_wiki_structure" })).toBe(false)
      expect(isReadOnlyExternalAction({ tool_name: "get_issues" })).toBe(false)
      expect(isReadOnlyExternalAction({ tool_name: "list_repos" })).toBe(false)
    })

    it("returns false for readOnlyHint === false (fail closed)", () => {
      expect(isReadOnlyExternalAction({ readOnlyHint: false })).toBe(false)
    })

    it("returns false for absent hint — even on read-named tools (fail closed)", () => {
      // This is the DeepWiki case: no annotations → absent hint → CHANGES SOMETHING OUTSIDE.
      expect(isReadOnlyExternalAction({ tool_name: "read_wiki_structure" })).toBe(false)
      expect(isReadOnlyExternalAction({ tool_name: "get_wiki_page" })).toBe(false)
      expect(isReadOnlyExternalAction({})).toBe(false)
      expect(isReadOnlyExternalAction({ capability: "send_email" })).toBe(false)
    })

    it("is total over missing, null, or malformed configs", () => {
      expect(isReadOnlyExternalAction(undefined)).toBe(false)
      expect(isReadOnlyExternalAction(null)).toBe(false)
      expect(isReadOnlyExternalAction({ readOnlyHint: "true" as unknown as boolean })).toBe(false)
      expect(isReadOnlyExternalAction({ readOnlyHint: 1 as unknown as boolean })).toBe(false)
    })
  })

  describe("effectBannerFor", () => {
    it("returns null for non-external phase types", () => {
      const nonExternalTypes = [
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
        "llm_emit",
        "unknown_phase_type",
      ]
      for (const t of nonExternalTypes) {
        expect(effectBannerFor(t, { readOnlyHint: true })).toBeNull()
      }
    })

    it("returns EFFECT_BANNER_READ_ONLY for external_action with explicit readOnlyHint === true", () => {
      expect(effectBannerFor("external_action", { readOnlyHint: true })).toBe(EFFECT_BANNER_READ_ONLY)
      // Also with other fields present
      expect(
        effectBannerFor("external_action", { tool_name: "read_wiki_structure", readOnlyHint: true }),
      ).toBe(EFFECT_BANNER_READ_ONLY)
    })

    it("returns EFFECT_BANNER_OUTSIDE for absent, false, or malformed hint (fail closed)", () => {
      // Absent — the DeepWiki case
      expect(effectBannerFor("external_action", { tool_name: "read_wiki_structure" })).toBe(
        EFFECT_BANNER_OUTSIDE,
      )
      // Explicit false
      expect(effectBannerFor("external_action", { readOnlyHint: false })).toBe(EFFECT_BANNER_OUTSIDE)
      // Capability steps (no MCP annotations possible)
      expect(effectBannerFor("external_action", { capability: "send_email" })).toBe(
        EFFECT_BANNER_OUTSIDE,
      )
      // Totally absent config
      expect(effectBannerFor("external_action")).toBe(EFFECT_BANNER_OUTSIDE)
      expect(effectBannerFor("external_action", {})).toBe(EFFECT_BANNER_OUTSIDE)
    })
  })
})
