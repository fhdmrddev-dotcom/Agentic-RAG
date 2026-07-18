---
phase: 154-plain-language-layer
plan: 03
subsystem: ui
tags: [react, plain-language, two-audience, term-map, settings, composer, g5-safe, vitest]

# Dependency graph
requires:
  - phase: 154-plain-language-layer (Plan 01)
    provides: "TechnicalNamesProvider/useTechnicalNames + termMap.ts/usePlainLabel + TechnicalNamesToggle control (the spine this plan attaches to)"
provides:
  - "Settings hosts the app-wide 'Show technical names' toggle (SC#3 / D-01) — every user can flip it; it writes the SAME shared context the admin Control Room reads (D-01a — one switch)"
  - "Bounded Settings relabels via the term-map: the Search & Retrieval tab label + the embedding/search-index picker label render plainly by default (D-04)"
  - "Chat composer General/Explorer mode helpers (additive, term-map-sourced) with the labels + enum untouched (D-03, G-5-safe)"
affects: [155-a11y]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Term-map consumer at a page/leaf: call usePlainLabel(key) at component top (hook), render the string; helper text read from TERM_MAP[key].helper"
    - "Reuse the prop-controlled TechnicalNamesToggle verbatim, feeding it the shared context (enabled=showTechnical, onToggle=toggle)"
    - "G-5-safe composer relabel: additive markup in the MessageInput shell only — no MessageItem/StreamsProvider edit"

key-files:
  created: []
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/SettingsPage.test.tsx
    - frontend/src/components/chat/MessageInput.tsx

key-decisions:
  - "Hosted the toggle near the TOP of the AI Model tab (RESEARCH Open Q#1 resolved) — a compact labelled row; the toggle is app-wide/tab-agnostic but reachable by every user there"
  - "Wired usePlainLabel('settings.embedding') to the EMBEDDING_PRESETS ProviderPicker title (string prop) — plain 'Search index' default, 'embedding' under the reveal; deep expert-config knobs left as-is (Pitfall 4)"
  - "Composer mode labels routed through usePlainLabel (plain === technical for these keys, so the visible label is byte-identical) so nothing drifts (D-02); helper text off TERM_MAP[key].helper"
  - "NO settings.temperature wiring (no such field in SettingsPage — Pitfall 4 phantom-field guard; grep == 0)"

requirements-completed: []   # LANG-01 stays OPEN at the requirement level until verify-work/live UAT (148-153 + 154-01/02 convention)

# Metrics
duration: ~12min
completed: 2026-07-15
---

# Phase 154 Plan 03: Settings toggle host + bounded Settings/composer relabels Summary

**The Settings page now HOSTS the app-wide "Show technical names" toggle (wired to the shipped shared context so every user can flip the reveal — SC#3), plus bounded display-only relabels of the Search tab + embedding/search-index picker label, and additive General/Explorer composer helpers — all frontend-only, zero backend files, G-5 hot files untouched.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 2 (both `type=auto`)
- **Files modified:** 3 (0 created, 3 modified — the plan's 2 declared source files + 1 Rule-3 test wrapper fix)

## Accomplishments
- **SC#3 toggle host (Task 1):** a compact "Show technical names" row near the top of the AI Model tab renders `<TechnicalNamesToggle enabled={showTechnical} onToggle={toggle} />` from `useTechnicalNames()`. Because Plan 01 already mounted `TechnicalNamesProvider` around `ChatLayout` (which contains Settings AND the admin Control Room), flipping it here moves the SAME shared value — the Settings toggle and the Control-Room toggle are one switch (D-01a; the cardinal "two toggles disagree" G-6 failure cannot occur).
- **Bounded Settings relabels (Task 1 / D-04):** the `Search & Retrieval` `TabsTrigger` label now renders `{usePlainLabel("settings.tab.retrieval")}` (plain "Search" default; "Search & Retrieval" under the reveal) with `value="1"` — the routing key — unchanged. The `EMBEDDING_PRESETS`-backed `ProviderPicker` title renders `{usePlainLabel("settings.embedding")}` ("Search index" default; "embedding" under the reveal). Deep expert-config knobs (sub-agent tokens, OpenRouter tool strategy) left as-is per Pitfall 4. No phantom `settings.temperature` wiring (no such field here).
- **Composer helpers (Task 2 / D-03, G-5-safe):** each General/Explorer dropdown item gained a one-line `text-[10px] text-muted-foreground` helper sourced from `TERM_MAP["agentmode.default"].helper` / `["agentmode.explorer"].helper`. Labels route through `usePlainLabel` (plain === technical for these keys → visible label byte-identical) and the `onAgentModeChange("default")`/`("explorer")` enum calls are untouched. The change is additive markup inside the `MessageInput` shell only.

## Task Commits
1. **Task 1: Settings toggle host + bounded relabels** — `49bbd81f`
2. **Task 2: composer General/Explorer helpers** — `a03746b4`

**Plan metadata:** final docs commit (SUMMARY + STATE + ROADMAP) follows.

## Files Created/Modified
- `frontend/src/pages/SettingsPage.tsx` — import `TechnicalNamesToggle` + `useTechnicalNames` + `usePlainLabel`; `const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()` + two `usePlainLabel` calls at component top; the toggle-host row atop the AI Model tab; `TabsTrigger value="1"` label → `{retrievalTabLabel}`; embedding `ProviderPicker title` → `{embeddingLabel}`.
- `frontend/src/pages/SettingsPage.test.tsx` — **Rule 3 blocking fix:** `SettingsPage` now calls `useTechnicalNames()` which throws outside its provider; wrapped the 7 bare `render(<SettingsPage />)` calls in a `renderSettings()` helper that mounts `<TechnicalNamesProvider>` (the 154-01 ControlRoomPage.test wrapper idiom).
- `frontend/src/components/chat/MessageInput.tsx` — import `TERM_MAP` + `usePlainLabel`; two `usePlainLabel` mode-label calls at component top; restructured the two mode `DropdownMenuItem`s to a label-row + helper-line layout (additive). MessageItem.tsx / StreamsProvider.tsx untouched.

## Decisions Made
- **Toggle tab = AI Model, top row** (RESEARCH Open Q#1). The toggle is tab-agnostic; a small labelled row near the top of the highest-traffic config tab keeps it reachable without inventing a new "Preferences" surface.
- **Embedding label on the picker `title` (a `string` prop).** `usePlainLabel("settings.embedding")` returns a string, so it slots directly into `ProviderPicker`'s `title`. The optional ⓘ helper was not added there (title is a string sink, not a node) — the picker already carries a plain `description`, so the ⓘ would be redundant (D-03: don't force ⓘ onto every surface).
- **Composer labels through `usePlainLabel` even though plain === technical.** Routing General/Explorer through the term-map (rather than leaving raw literals) means any future copy change lives in one place (D-02, no drift). The pill label at the top of the selector keeps the literal `"Explorer"/"General"` ternary (a display mirror; the acceptance grep + the reveal state both read consistently).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped SettingsPage.test render in TechnicalNamesProvider**
- **Found during:** Task 1
- **Issue:** After adding the toggle host, `SettingsPage` calls the throwing `useTechnicalNames()`. The existing `SettingsPage.test.tsx` renders `<SettingsPage />` bare (7 call sites), so the hook would throw and fail all 7 tests.
- **Fix:** Added a `renderSettings()` helper that wraps the render in `<TechnicalNamesProvider>` (default OFF → plain) and replaced the 7 bare renders. This is the exact precedent Plan 01 set for `ControlRoomPage.test.tsx`.
- **Files modified:** `frontend/src/pages/SettingsPage.test.tsx`
- **Commit:** `49bbd81f`

## Issues Encountered
None. Both touched suites green on first run; tsc stayed at the exact 30-error SEED-056/049 baseline (0 net-new); vite build exit 0.

## Verification / Gates
- **Tests:** `SettingsPage.test.tsx` 7/7; chat `__tests__` 58/58 across 8 files (G-5 non-regression: MessageItem/StreamsProvider suites re-run green) — all GREEN.
- **tsc gate:** `npx tsc -b` = exactly **30** pre-existing SEED-056/049 `error TS` lines (0 net-new). The only diff vs the captured baseline is line-number shifts of the same three pre-existing errors (`SettingsPage.tsx:754→770` web_search_enabled, `SettingsPage.tsx:1006→1040` FieldRow tooltip, `SettingsPage.test.tsx:48→61`); zero errors reference the new toggle/relabel/helper code.
- **build gate:** `npx vite build` exit **0**.
- **Contract-Safety Recipe (D-05a):** `git diff --name-only 49bbd81f^..HEAD` = exactly 3 files, ALL under `frontend/src/`; `grep -E '^backend/'` → NONE; `grep -E '^supabase/migrations/'` → NONE; `grep -vE '^frontend/src/'` → NONE; G-5 hot files (`MessageItem.tsx`/`StreamsProvider.tsx`) → NONE. Enum eyeball: `agentMode === "default"/"explorer"` comparisons unchanged, `onAgentModeChange("default")/("explorer")` intact, `TabsTrigger value="1"` intact — only display children changed. Deep Mode byte-identical by construction.
- **Acceptance greps:** `TechnicalNamesToggle`=2, `useTechnicalNames(`=1, `Show technical names`=2, `usePlainLabel("settings.tab.retrieval")`=1, `usePlainLabel("settings.temperature")`=**0** (phantom guard), `TabsTrigger value="1"`=1 (unchanged); MessageInput: labels present=4, `onAgentModeChange("default")`=1, `usePlainLabel`=3.

## Known Stubs
None. The toggle host wires the real shared context; the relabels are real display copy off the term-map; the composer helpers are the intended term-map helper strings. No hardcoded empties, no placeholder text, no unwired data source.

## Threat Flags
None. No new network endpoint, auth path, file-access pattern, or schema change — display-only relabels + a localStorage-backed UI preference (not a secret/session token), consistent with the plan's threat register (T-154-01..04).

## Next Phase Readiness
- **LANG-01 stays OPEN** at the requirement level (false-green avoidance, the 148–153 + 154-01/02 convention). The spine (154-01) + document surfaces (154-02) + this Settings/composer plan (154-03) complete the bounded relabel budget; closure is at `/gsd:verify-work` + live UAT.
- No operator setup, no migration, no cloud parity generated (frontend-only).
- Remaining low-traffic surfaces inherit the term-map cheaply later (D-04 documented follow-up, not this phase's bar). The optional PhaseFormPanel map migration (RESEARCH rank 5, below the cut line) was intentionally not planned.

## Self-Check: PASSED
- Modified files verified present on disk: `SettingsPage.tsx`, `SettingsPage.test.tsx`, `MessageInput.tsx` — all FOUND.
- Task commits verified in git log: `49bbd81f`, `a03746b4` — all FOUND.

---
*Phase: 154-plain-language-layer*
*Completed: 2026-07-15*
