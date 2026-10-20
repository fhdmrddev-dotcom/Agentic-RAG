---
phase: 283-every-member-reaches-their-own-settings
verified: 2026-10-16T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (SC#4 carries one owed row)
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "With the Chrome window in front, open a large document's detail panel, expand Chunks, focus the chunk list, press Tab once."
    expected: "Focus leaves the bounded list and lands on the next section header (the list is one Tab stop; no nested scrollers)."
    why_human: "Real key events cannot be delivered in the hidden MCP tab (0 keydown seen). Evidence so far is a focusability measurement (0 nested scroll containers, 0 focusable chunk bodies after CR-01) plus a jsdom fence, not a recorded key press."
---

# Phase 283 Verification

**Goal:** An ordinary org member can reach and use their own settings (Memory, Audit Log, "Show technical names") while operator-only tabs stay hidden and refused, and a large document's detail panel stays navigable when its Chunks section is open.
**Status:** human_needed. Everything checkable passed. The only open item is one owed Tab key press.
**Requirements:** FIX-01 (plans 01 and 02) and FIX-08 (plan 03). Both are declared in PLAN frontmatter and match REQUIREMENTS.md. No orphaned IDs.

## Roadmap success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | A member finds a Settings door and opens Memory, Audit Log and "Show technical names". A saved change persists across reload. Operator tabs do not render. | VERIFIED | `settingsTabs.ts` registry: tabs 0/1/2 are `model_management`, and 6 (Preferences), 3 (Memory) and 4 (Audit Log) are `everyone`. `SettingsPage.tsx` wraps each of the three operator `TabsContent` blocks in `isSettingsTabVisible(...)`, so they are not rendered. `canManageModels` is a fail-closed `=== true`, and `getSettings` is skipped for members. The Settings rail entry is un-gated in `nav-items.ts`. Live evidence: the member saw 3 tabs, flipped the toggle, set the default model, and both persisted after reload and in the DB. Memory and Audit Log showed the member's own data. |
| 2 | The UI gate and API gate agree, with a two-role fence on the real auth path. The member's own-settings write is accepted. An operator-only call by a member returns 403. The audience is not widened. | VERIFIED | `git diff 9a0b78622 HEAD -- backend/app` is empty, so no gate changed and `model_management` was not widened. I re-ran `test_283_settings_two_role_fence.py` and `test_283_settings_route_inventory.py`: 14 passed. The review confirms the fence keeps `require_visible` real and that the inventory has a planted-defect self-test. Live curl: member got 403 on `GET /settings`, `PUT /settings`, `/settings/reembed-progress` and `POST /settings/reembed`, and 200 on `/me/preferences` and `/audit-logs`. The operator got 200. |
| 3 | With Chunks expanded on a large document, every section below is reachable without scrolling past the chunks. The list is bounded and scrolls inside itself, with the count shown. Measured by bounding rect in Chrome. | VERIFIED | `DocumentChunksSection.tsx` has a `role="region"` with an aria-label that carries the count, `tabIndex 0`, and `max-h-96 overflow-y-auto`. The per-chunk nested scroller was removed in CR-01 (`ba3aacdde`). Live measurement on a real 764-chunk document: region 384 px, next section 401 px below the Chunks header, content height 310,748 px kept inside the region. The test used 764 chunks rather than the roughly 1,000 in the criterion. The bound is a fixed max-height, so the result does not depend on the count, and the deviation is recorded. |
| 4 | G-4: lived-experience scenarios driven as the real role. | VERIFIED, with one owed row | `283-LIVE-EVIDENCE.md` records roles proven before any row (member and operator via `org_members` and `operator_users`). Scenario 1 (member's first visit, including the D-05 fallback), scenario 2 (operator unchanged: 6 tabs, AI Model landing, "Show technical names" moved to Preferences) and scenario 3 (large document) all passed. |

## "How we'd know this failed"

| Condition | Result |
|---|---|
| `model_management` widened | No. `backend/app` is unchanged since base. |
| A member sees an operator tab that 403s | No. The member got 3 tabs and no 403s in the network log. |
| The door appears but the page is empty | No. Preferences populated, and the fallback from a stale operator tab id lands on Preferences. |
| The client hides a tab whose API still accepts a member's write | No. The write routes are refused with 403, as the live curl and the fence show. |
| A "Show first 20 / Show all" button on Chunks | Not found. The list is a single bounded region. |
| The bounded list traps keyboard focus or wheel scroll | The wheel does not trap: `overscroll-behavior-y` is `auto`. The keyboard check is pending (see below). |
| A filter box on Chunks | Not found. |

## Targeted checks I re-ran

- Frontend: `settingsTabs.test.ts`, `SettingsPage.member283.test.tsx`, `DetailSections.lazy.test.tsx`, `nav-items.test.ts`. 4 files, 57 passed.
- Backend: the two 283 suites. 14 passed.
- The full backend baseline and the full vitest count gate were not run, per instruction.

## Anti-patterns

No TBD, FIXME or XXX markers in `settingsTabs.ts` or `SettingsPage.tsx`. No stubs found.

## Owed row and why it is human_needed

The live drive first found a real keyboard defect: up to 736 nested chunk-body scrollers were Tab stops in Chrome 154. A green jsdom fence could not see it. CR-01 fixed it by removing the nested scrollers, and the re-measurement showed 0 nested scroll containers and 0 focusable chunk bodies, with the region as the only focusable element in the list. The code is consistent with a single Tab stop, but nobody has recorded a real Tab key press. This is not a gap, because the behavior is very likely correct. It is not inflated either: one human row remains (see `human_verification` above).

## Non-blocking carry-overs

- Review items IN-04 (no retired-id reuse fence) and IN-06 (UI and API disagree on `audience: "off"`) were skipped by decision. Neither is a roadmap criterion.
- `LibraryStatTiles` returns a member 403 on `/settings/reembed-progress`. It is pre-existing, outside this phase, and recorded in the evidence.
- The ROADMAP progress row still reads "0/TBD, Not started". The orchestrator should update it at close.

## Human verification — resolved 2026-10-16

The one owed row (real Tab key press on the Chunks list, D-17) was run by the operator with the window in front and reported "checked, working". Recorded in `283-HUMAN-UAT.md`. Status moved `human_needed` → `passed`.
