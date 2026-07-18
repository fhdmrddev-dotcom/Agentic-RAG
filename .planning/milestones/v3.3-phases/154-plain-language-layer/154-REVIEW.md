---
phase: 154-plain-language-layer
reviewed: 2026-07-15T00:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - frontend/src/providers/TechnicalNamesProvider.tsx
  - frontend/src/lib/termMap.ts
  - frontend/src/lib/PlainLabel.tsx
  - frontend/src/App.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/ingestion/DocumentStatusBadge.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/providers/__tests__/TechnicalNamesProvider.test.tsx
  - frontend/src/lib/__tests__/termMap.test.tsx
  - frontend/src/__tests__/components/DocumentStatusBadge.test.tsx
  - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
  - frontend/src/pages/SettingsPage.test.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
threats_open: 0
status: issues_found
---

# Phase 154: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** deep (cross-file: provider mount tree + consumer call chains traced)
**Files Reviewed:** 15 (9 source + 6 test)
**Status:** issues_found

## Summary

Phase 154 introduces a display-only plain-language layer: a shared
`TechnicalNamesProvider` context, a single-source `termMap`, a `PlainLabel`
render component, and bounded relabels across the ingestion badge, document
detail panel, Settings page, chat composer, and admin Control Room.

The four cardinal risks the phase exists to manage are all handled correctly:

1. **Contract safety (D-05) — CLEAN.** Every relabel is display-only. Verified
   no enum/API field/audit action/tab `value` key was renamed:
   - `DocumentStatusBadge`: `styles[status]` and the spinner stay keyed on the
     raw `status` enum; only the visible `label` routes through the term-map.
     The `ingest.${ingestionStep}` lookup is guarded by `in TERM_MAP` and the
     `"ingest."` prefix makes prototype-pollution via `in` impossible.
   - `SettingsPage`: `<TabsTrigger value="1">` routing key unchanged; only the
     child text relabeled. `activeTab`/`handleTabChange` key on the numeric value.
   - `MessageInput`: `onAgentModeChange("default"|"explorer")` raw enum untouched;
     only the visible `<span>` label + an additive helper `<p>` changed.
   - `ControlRoomPage`: only the `showTechnical` state *source* swapped
     (local `useState` → shared context); tab values and audit actions untouched.
2. **XSS / escaping (T-154-02) — CLEAN.** No `dangerouslySetInnerHTML`/`innerHTML`
   anywhere in scope. `PlainLabel` renders labels as auto-escaped React text nodes;
   `InfoHint` binds helper text via `title=`/`aria-label=` attributes (auto-escaped).
   Term-map values are static developer literals — no model/user text flows in.
3. **Shared-state correctness — CLEAN.** `TechnicalNamesProvider` is a real single
   `createContext` value mounted once in `App.tsx` wrapping `ChatLayout` (which
   hosts both `SettingsPage` and `ControlRoomPage`), so the Settings toggle and the
   Control Room toggle move one value and cannot disagree. Local `useState` for
   `showTechnical` was fully removed from `ControlRoomPage` (no dangling refs; all
   toggle sites now call the shared `toggle`). Hydration is `typeof window`-safe and
   defaults OFF (any non-`"true"` storage value → `false`).
4. **G-5 red line — HONORED.** `MessageItem.tsx` and `StreamsProvider.tsx` were NOT
   edited; composer relabels live in the `MessageInput.tsx` shell only, additive.

No blockers. One warning (a verbatim-contract drift that the guard test enshrines
as truthy) and two info-level quality items.

## Warnings

### WR-01: `settings.embedding` technical value is not the verbatim shipped string

**File:** `frontend/src/lib/termMap.ts:127-131` (and `frontend/src/pages/SettingsPage.tsx:1179-1185`)
**Issue:** The two-audience contract (D-02a, and this file's own header) states the
`technical` side must be *"TODAY's shipped string, VERBATIM"*. For `settings.embedding`
the map declares `technical: "embedding"`, but the string that actually shipped on the
`ProviderPicker` was `title="Embedding model"` (see the diff: `- title="Embedding model"`
→ `+ title={embeddingLabel}`). Consequences:
- With the reveal ON, the picker title now reads `"embedding"` (lowercase, no "model")
  instead of the pre-154 `"Embedding model"` — a small regression of the *technical*
  view the toggle is supposed to preserve exactly.
- The cardinal contract-guard test (`termMap.test.tsx` `SHIPPED_TECHNICAL`) hard-codes
  `"settings.embedding": "embedding"`, so the guard *passes* against a value that never
  shipped as that label. The guard gives false confidence for this key — the one
  mechanism meant to catch technical-side drift is blind here.

This is display-only (no wire/enum/audit contract is touched), which is why it is a
Warning and not a Blocker.

**Fix:** Make the technical side match what shipped, and correct the guard table:
```ts
// termMap.ts
"settings.embedding": {
  plain: "Search index",
  helper: "The model that makes your documents searchable.",
  technical: "Embedding model", // verbatim pre-154 ProviderPicker title
},
```
```ts
// termMap.test.tsx — SHIPPED_TECHNICAL
"settings.embedding": "Embedding model",
```

## Info

### IN-01: Three term-map keys are defined but never consumed (dead entries)

**File:** `frontend/src/lib/termMap.ts:117-136`
**Issue:** `settings.temperature`, `settings.context_window`, and `settings.reembed`
are present in `TERM_MAP` but no surface consumes them — a grep for
`usePlainLabel(`, `<PlainLabel term=`, and `TERM_MAP[` shows the only Settings keys
actually used are `settings.tab.retrieval` and `settings.embedding`. These are dead
map entries. They also contradict this file's own comment at lines 110-111 ("deep
expert-config knobs stay technical-audience and are intentionally NOT mapped —
Pitfall 4"): `temperature` and `context window` are exactly those knobs, yet they are
mapped. They still cost the contract-guard test three verbatim assertions to maintain.
**Fix:** Remove the three unused entries (and their `SHIPPED_TECHNICAL` rows), or wire
them to a real surface if a relabel there was intended. Prefer removal to keep the map
= exactly the shipped surfaces.

### IN-02: `usePlainLabel` called inline in JSX rather than hoisted (fragile hook placement)

**File:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:233`
**Issue:** `title={usePlainLabel("doc.metadata_section")}` calls a hook inline inside the
`const body = (…)` JSX. It is currently correct — the call is unconditional, in stable
order, with no early `return` before it — so it is not a live bug. But it is inconsistent
with the phase's other two consumers (`SettingsPage.tsx:503-504` and
`MessageInput.tsx:134-135` both hoist to a top-level const), and it is fragile: if this
`PanelSection` is ever wrapped in a conditional or a `.map()`, the inline hook silently
becomes a rules-of-hooks violation.
**Fix:** Hoist alongside the other hooks near the top of the component:
```tsx
const metadataSectionTitle = usePlainLabel("doc.metadata_section")
// …
<PanelSection title={metadataSectionTitle} warn={lowPlusEmpty > 0} count={lowPlusEmpty} defaultOpen>
```

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
