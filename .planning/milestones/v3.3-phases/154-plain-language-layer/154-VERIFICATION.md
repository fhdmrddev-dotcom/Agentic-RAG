---
phase: 154-plain-language-layer
verified: 2026-07-15T20:15:00Z
status: human_needed
score: 8/8 must-haves code-verified
overrides_applied: 0
human_verification:
  - test: "Plain labels read naturally to a non-technical user"
    expected: "No jargon leaks with the reveal OFF; no 'plain' label reads MORE confusing than the raw term it replaces"
    why_human: "Copy quality is subjective (RESEARCH flagged plain-label copy as [ASSUMED] A1)"
  - test: "Flip 'Show technical names' in Settings, then check chat + documents + workflows + /admin all show technical vocab; reload the page"
    expected: "All surfaces flip together (one shared switch); the ON state survives a page reload"
    why_human: "End-to-end cross-surface + localStorage persistence is a live-runtime behavior, not statically verifiable"
  - test: "With the reveal ON, open Settings → AI Model tab → check the embedding/search-index picker's technical label"
    expected: "Operator decision needed — see Finding F-01 below: the shipped reveal text is 'embedding', not the pre-phase title 'Embedding model'. Confirm whether this is acceptable or needs a 1-line term-map fix."
    why_human: "A verified code-level copy-accuracy defect (not a contract break) — needs a human call on whether it blocks LANG-01 closure"
---

# Phase 154: Plain-Language Layer Verification Report

**Phase Goal:** User-facing surfaces speak plain language, with technical terms tucked behind an admin/advanced reveal — extending the Phase-124 two-door pattern app-wide — WITHOUT breaking any enum/API/audit contract. Frontend display-only; Deep Mode byte-identical.
**Verified:** 2026-07-15T20:15:00Z (base `c9f3cf2b` → HEAD `4b91c6c5`)
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1 — Everyday users see plain-language labels by default; technical terms appear only behind the reveal | ✓ VERIFIED | `DocumentStatusBadge.tsx` (Waiting/Working…/Splitting into sections/Making it searchable/Ready/Couldn't process), `DocumentDetailPanel.tsx` ("Details"), `SettingsPage.tsx` ("Search" tab label, "Search index" picker label, "Show technical names" toggle row), `MessageInput.tsx` (General/Explorer + helper text) — all confirmed by direct source read + 115/115 green tests across the 7 touched suites (live-run, not just SUMMARY claim) |
| 2 | SC#2 — Relabels are display-only; enum/API/audit contracts unchanged; Deep Mode byte-identical | ✓ VERIFIED (see Finding F-01 caveat) | `git diff --name-only c9f3cf2b..4b91c6c5` → zero `backend/` files, zero `supabase/migrations/` files, every changed file under `frontend/src/` or `.planning/` (confirmed live, not from SUMMARY). `styles[status]` in `DocumentStatusBadge.tsx` still keyed on raw `status` enum. `TabsTrigger value="1"` unchanged in `SettingsPage.tsx`. `onAgentModeChange("default"/"explorer")` unchanged in `MessageInput.tsx`. No `dangerouslySetInnerHTML` in `PlainLabel.tsx`. **Caveat:** one term-map entry (`settings.embedding`) does not hold the pre-phase shipped string verbatim — see Finding F-01. This is a copy-accuracy defect, not an enum/API/audit contract break (Pitfall 15 is about wire values, confirmed by reading 154-RESEARCH.md's own Pitfall-15 definition), so the core SC#2 promise (no contract break) still holds |
| 3 | SC#3 — An operator/advanced user can flip the reveal and see the technical vocabulary | ✓ VERIFIED (wiring); routed to human for live cross-surface + persistence proof | ONE shared `createContext` (`TechnicalNamesProvider.tsx`) confirmed NOT a bare per-consumer hook. Both `ControlRoomPage.tsx` (`useTechnicalNames()`) and `SettingsPage.tsx` (`useTechnicalNames()`) read/write the identical context instance (both mounted under the single `App.tsx` provider wrap). `localStorage["technical-names"]` persistence code confirmed (`getInitial()` + `useEffect` write). Live cross-tab/reload proof is a browser-runtime behavior — see Human Verification |
| 4 | D-01 — Reveal state is ONE shared React context, never two independent toggles | ✓ VERIFIED | `TechnicalNamesProvider.tsx`: `createContext<TechnicalNamesValue \| null>(null)`, throwing `useTechnicalNames()` + non-throwing `useTechnicalNamesOptional()`, modeled on `citationNav.tsx` (not `useTheme.ts`'s bare-hook shape). `matchMedia` absent (grep confirmed 0 hits) |
| 5 | D-01a — Admin Control Room consumes the shared context with ZERO leaf-prop-signature changes | ✓ VERIFIED | `git diff` on `ControlRoomPage.tsx` shows a surgical swap: `useState(false)` → `useTechnicalNames()`, 4 `setShowTechnical` closures → `toggleTechnical`; every `showTechnical={showTechnical}` prop thread to `HealthSignals`/`CapabilityGrid`/`AuditTab`/`FeatureVisibility`/`ModelRegistryTab` is untouched. `ControlRoomPage.test.tsx` 7/7 green (live-run) |
| 6 | D-02 — Term-map is the single source; maps DISPLAY strings only, never a wire enum/API/audit value | ✓ VERIFIED | `termMap.ts` `TERM_MAP as const satisfies Record<string, Term>`; every consumer (`DocumentStatusBadge`, `DocumentDetailPanel`, `SettingsPage`, `MessageInput`) imports from this single file; none of the 18 map keys are posted to an API or used as enum/audit values (confirmed by reading each consumer's usage) |
| 7 | Plan 02 — Ingestion badge + document-detail header relabeled plain-by-default; enum-keyed styling intact | ✓ VERIFIED | Live-run `DocumentStatusBadge.test.tsx` 19/19 green (plain-default assertions + reveal-ON assertions + a dedicated byte-identical-color-class test), `DocumentDetailPanel.a11y.test.tsx` 7/7 green (accessible-name matchers correctly updated from `/metadata/i` to `/details/i`, all a11y assertions preserved) |
| 8 | Plan 03 — Settings hosts the toggle; composer gets additive helpers only; G-5 hot files untouched | ✓ VERIFIED | `SettingsPage.tsx` hosts `<TechnicalNamesToggle enabled={showTechnical} onToggle={toggleTechnical}/>` from `useTechnicalNames()`. `MessageInput.tsx` labels route through `usePlainLabel` (plain===technical for these two keys) + helper lines added; enum calls (`onAgentModeChange`) unchanged. `git diff --name-only c9f3cf2b..4b91c6c5 \| grep -E 'MessageItem\.tsx\|StreamsProvider\.tsx'` → zero matches (confirmed live) |

**Score:** 8/8 truths code-verified. Two items ((3) and the F-01 caveat under (2)) require human confirmation before LANG-01 formally closes — consistent with the phase's own documented convention (148–153: "LANG-01 stays OPEN at the requirement level pending live UAT").

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/providers/TechnicalNamesProvider.tsx` | App-wide `createContext` provider + throwing/optional hooks + localStorage persistence | ✓ VERIFIED | `createContext` present; `useTechnicalNames`/`useTechnicalNamesOptional` exported; `STORAGE_KEY = "technical-names"`; default OFF via `getInitial()`; `matchMedia` absent |
| `frontend/src/lib/termMap.ts` | Single-source `TERM_MAP` + `TermKey` + `usePlainLabel` | ✓ VERIFIED | 18-row `TERM_MAP as const satisfies Record<string, Term>`; `usePlainLabel` reads `useTechnicalNamesOptional()`, unknown-key passthrough via `String(key)` |
| `frontend/src/lib/PlainLabel.tsx` | `<PlainLabel term showHelper?>` component | ✓ VERIFIED | Renders `usePlainLabel(term)` as a plain text node (no `dangerouslySetInnerHTML`) + optional inlined `InfoHint` ⓘ |
| `frontend/src/components/admin/ControlRoomPage.tsx` | D-01a consolidation — local `useState` replaced by `useTechnicalNames()` | ✓ VERIFIED | `useState(false)` for `showTechnical` gone; `useTechnicalNames(` present; `setShowTechnical` closures = 0 (all rewired to `toggleTechnical`) |
| `frontend/src/components/ingestion/DocumentStatusBadge.tsx` | Ingestion labels routed through `usePlainLabel`; enum-keyed styling preserved | ✓ VERIFIED | `usePlainLabel` present; `styles[status]` unchanged; 19/19 tests green |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | "Metadata" → "Details" header relabel via term-map | ✓ VERIFIED | `title={usePlainLabel("doc.metadata_section")}`; literal `title="Metadata"` gone; ConfidenceChip untouched |
| `frontend/src/pages/SettingsPage.tsx` | Toggle host + bounded relabels | ✓ VERIFIED | `TechnicalNamesToggle` + `useTechnicalNames(` present; "Show technical names" row present; `TabsTrigger value="1"` unchanged; no phantom `settings.temperature` wiring |
| `frontend/src/components/chat/MessageInput.tsx` | General/Explorer helpers, additive | ✓ VERIFIED | `usePlainLabel` + `TERM_MAP[...].helper` present; `onAgentModeChange("default"/"explorer")` intact; labels not removed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` | `TechnicalNamesProvider` | provider mount wrapping `<ChatLayout>` | ✓ WIRED | `grep` confirms `TechnicalNamesProvider` import + wraps the `<CitationNavProvider>` block inside `<TooltipProvider>`, covering chat/docs/workflows/settings/`/admin` |
| `ControlRoomPage.tsx` | `useTechnicalNames` | context read replacing `useState(false)` | ✓ WIRED | Confirmed at line 222: `const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()` |
| `termMap.ts` | `TechnicalNamesProvider` | `usePlainLabel` reads `useTechnicalNamesOptional` | ✓ WIRED | `termMap.ts:150` — `const ctx = useTechnicalNamesOptional()` |
| `DocumentStatusBadge.tsx` | `termMap.ts` | `usePlainLabel(ingest.*/status.*)` | ✓ WIRED | One term key computed unconditionally, `usePlainLabel(termKey)` called once |
| `DocumentDetailPanel.tsx` | `termMap.ts` | `usePlainLabel('doc.metadata_section')` | ✓ WIRED | Line 233 confirmed |
| `SettingsPage.tsx` | `TechnicalNamesProvider.tsx` | `TechnicalNamesToggle` fed `useTechnicalNames()` | ✓ WIRED | Line 502-503, 895 confirmed |
| `MessageInput.tsx` | `termMap.ts` | `usePlainLabel` for `agentmode.*` helpers | ✓ WIRED | Lines 134-135, 350/364 (labels), 354/368 (helpers) confirmed |

### Data-Flow Trace (Level 4)

Not applicable in the traditional DB/API sense — this phase's "data source" is the static `TERM_MAP` literal object plus the client-only `localStorage`/React-context reveal boolean. Traced: `TERM_MAP` (static, real copy, not a stub) → `usePlainLabel` (reads context) → rendered text node. No hardcoded-empty or disconnected-prop pattern found in any of the 4 relabeled surfaces.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Touched-surface suites green (not just SUMMARY claim) | `cd frontend && npx vitest run <7 touched test files>` | 14 test files, 115/115 tests passed | ✓ PASS |
| `tsc -b` exactly 30 pre-existing errors, 0 net-new | `cd frontend && npx tsc -b 2>&1 \| grep -cE 'error TS'` | `30` — all 3 remaining errors trace to `SettingsPage.tsx`/`SettingsPage.test.tsx` pre-existing lines (`web_search_enabled`, `FieldRow` tooltip, line-61 type mismatch), none reference the new/touched Phase-154 code | ✓ PASS |
| `vite build` exits 0 | `cd frontend && npx vite build` | exit 0 | ✓ PASS |
| Contract-Safety Recipe (D-05a) | `git diff --name-only c9f3cf2b..4b91c6c5` | Zero `backend/` files, zero `supabase/migrations/` files; every file under `frontend/src/` or `.planning/` | ✓ PASS |
| G-5 hot files untouched | `git diff --name-only ... \| grep -E 'MessageItem.tsx\|StreamsProvider.tsx'` | Zero matches | ✓ PASS |
| Full vitest run (regression sweep beyond touched files) | `cd frontend && npx vitest run` | 143/152 files passed, 1375/1395 tests passed. 9 failing files: `MessageItem.test.tsx`, `Plan04.frontend.test.tsx`, `useMessages.test.ts`, `StreamsProvider.dedup.test.ts`, `streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`, `PublishGauntlet.test.tsx`, `soulData.test.ts`, `model-info.test.ts` — **none of these files were touched by Phase 154** (confirmed against the `git diff --name-only` file list above); this matches the pre-existing SEED-056/049 baseline vitest rot documented in project memory, not a regression introduced by this phase | ℹ️ INFO (pre-existing, not a 154 regression) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared or referenced by this phase's PLAN/SUMMARY files, and no conventional probes found in `scripts/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| LANG-01 | 154-01, 154-02, 154-03 | User-facing surfaces speak plain language, technical terms behind reveal, contracts unchanged | ✓ SATISFIED (code) / OPEN at requirement-tracking level | All 8 truths above verified in code. `REQUIREMENTS.md:42` still shows `[ ]` unchecked — this is intentional per the phase's explicit documented convention (148–153): LANG-01 closes at `/gsd:verify-work` + live UAT, not at code-completion. No orphaned requirements — LANG-01 is the sole requirement mapped to Phase 154 in `REQUIREMENTS.md:98`, and all 3 plans declare it in `requirements: [LANG-01]` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/lib/termMap.ts` | 127-131 | `settings.embedding.technical` = `"embedding"` does not match the pre-phase shipped picker title `"Embedding model"` (verified via `git show c9f3cf2b:frontend/src/pages/SettingsPage.tsx` — the literal was `title="Embedding model"`, not `"Embedding"` or `"embedding"`) | ⚠️ WARNING | **Finding F-01.** When an advanced user flips "Show technical names" ON, the Settings "Search index" picker will show "embedding" instead of the historically-shipped "Embedding model." This is a copy-accuracy defect in one term-map entry, not a Pitfall-15 contract break (confirmed by reading 154-RESEARCH.md's own Pitfall-15 definition, which is scoped to enum/API/audit-action wire values, not UI-label text fidelity — "embedding" and "Embedding model" are both just display strings, neither is posted to an API). The `termMap.test.tsx` contract-guard test does NOT catch this because it asserts against a hand-copied `SHIPPED_TECHNICAL` table inside the test file itself, not against the actual live source string — so the test is self-referential for this one entry rather than an independent proof. All other 17 term-map entries were cross-checked directly against `git show c9f3cf2b` and matched verbatim (`ingest.*`, `status.*`, `doc.metadata_section`, `agentmode.*`, `settings.tab.retrieval` all confirmed exact). `settings.temperature`/`settings.context_window`/`settings.reembed` are documented as intentionally unwired (no live surface reads them), so no accuracy risk there. **Recommended fix:** change `termMap.ts:130` `technical: "embedding"` → `technical: "Embedding model"` (one-line fix), or add an override if "embedding" is judged an acceptable simplification. |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 8 files touched by this phase. No `dangerouslySetInnerHTML`, no empty-implementation stubs, no hardcoded-empty props routed to rendering.

### Human Verification Required

### 1. Plain labels read naturally to a non-technical user

**Test:** With the reveal OFF (default, fresh browser/incognito or cleared localStorage), read through the ingestion badge states, the document-detail header, the Settings AI Model/Search tabs, and the composer mode dropdown.
**Expected:** No jargon leaks through; no "plain" label reads as MORE confusing than the raw technical term it replaced (RESEARCH's own [ASSUMED] flag on the plain-copy wording).
**Why human:** Copy-quality/tone is inherently subjective; cannot be graphed or grepped.

### 2. The reveal flips the WHOLE app and persists across reload

**Test:** Flip "Show technical names" in Settings → check that chat composer helpers, the documents ingestion badge / detail panel, and the `/admin` Control Room ALL show technical vocabulary simultaneously. Reload the page → confirm the ON state survives.
**Expected:** One switch moves every surface at once (no drift between the Settings toggle and the admin toggle — D-01a); state persists across a hard reload.
**Why human:** End-to-end cross-surface behavior + `localStorage` persistence across a real browser reload is a live-runtime property; the code-level wiring is verified (same `useTechnicalNames()` context instance, same `localStorage` key) but the actual browser round-trip needs a human click-through.

### 3. Confirm/decide on Finding F-01 (settings.embedding technical-string mismatch)

**Test:** With the reveal ON, open Settings → AI Model tab → look at the embedding/search-index picker's label.
**Expected:** Decide whether "embedding" (the current reveal text) is acceptable, or whether it should be corrected to "Embedding model" (the actual pre-phase shipped string) for full D-02a fidelity.
**Why human:** This is a verified, non-ambiguous code defect (not uncertain) — but its severity (cosmetic copy vs. must-fix) is a product judgment call, not something the verifier should silently downgrade or silently block on.

### Gaps Summary

No blocking gaps. All 8 code-verifiable must-haves (3 ROADMAP success criteria + 5 cross-plan D-decisions) hold up under direct source inspection, live test runs (not SUMMARY-trusted), and live `git diff` contract-safety checks — the phase's central promise (zero backend/migration files touched, enum/API/audit contracts untouched, one shared reveal context, term-map single source) is real and matches the SUMMARY claims almost exactly.

One verified-but-non-blocking defect was found through adversarial code inspection that the SUMMARYs did not surface: the `settings.embedding` term-map entry's `technical` field ("embedding") does not match the actual pre-phase shipped Settings picker title ("Embedding model"). This does not break any enum/API/audit contract (SC#2's core promise holds) and does not affect Deep Mode. It is flagged for human decision (fix now vs. accept) rather than silently passed or silently blocked.

Status is `human_needed` rather than `passed` because (a) the phase's own VALIDATION.md explicitly designates SC#1 copy-naturalness and SC#3 live cross-surface+persistence as Manual-Only, consistent with the 148–153 convention that LANG-01 closes at verify+UAT, and (b) Finding F-01 needs an explicit human call.

---

*Verified: 2026-07-15T20:15:00Z*
*Verifier: Claude (gsd-verifier)*
