---
phase: 128-chat-tool-card-unification-chat-area-reclaim
verified: 2026-06-27T12:00:00Z
status: human_needed
score: 5/6
overrides_applied: 0
overrides:
  - must_have: "lmstudio returns null so the caller renders Bot fallback"
    reason: "Operator mid-phase override (2026-06-27): lmstudio now maps to the LM Studio @lobehub/icons mark alongside ollama — both are named local connectors. The PLAN originally specified Bot-fallback for lmstudio, but the operator explicitly approved the mark override (recorded in 128-05-SUMMARY.md, 128-VALIDATION.md, and providerLogo.test.tsx comment). The providerLogo.test.tsx tests were updated to match. This deviation satisfies the intent of CTC-01 (accurate per-provider logo) more honestly than a Bot fallback for a known connector."
    accepted_by: "operator (2026-06-27 mid-phase live UAT)"
    accepted_at: "2026-06-27T00:00:00Z"
human_verification:
  - test: "Long user prompt clamp — live browser overflow check"
    expected: "Pasting a large (≥5 KB) user prompt should trigger the clamp: text truncates to ~7 visible lines, a violet fade gradient dissolves into the bubble, and a 'Read more' button appears at the bottom of the bubble. Clicking it expands the full prompt. Clicking 'Show less' collapses it again."
    why_human: "jsdom has no layout engine — scrollHeight and clientHeight are both 0, so useLayoutEffect never trips. Tests assert structure and the fade class using a spy-mock, but they cannot verify the live overflow-detect branch in a real browser with real text layout."
  - test: "Fade color matches the bubble, not the page background"
    expected: "The fade at the bottom of the clamped user bubble should dissolve into the violet `hsl(258 90% 66%)` end of the bubble's 135-degree gradient, not bleed into the dark page background as a color band."
    why_human: "Visual judgment — the Tailwind class `from-[hsl(258_90%_66%)]` is present in the DOM (verified structurally), but whether it matches the actual rendered bubble color is a human perceptual check."
  - test: "TDP-02 description in the preparing window — per-provider live wire check"
    expected: "When a tool-using prompt runs on Anthropic or an OpenAI-compat provider (which streams args token-by-token), the tool card should briefly show 'Preparing [tool]… — [description]' before tool_start fires. Google is expected to show only the quiet 'Preparing [tool]…' fallback (atomic arg delivery — no prep window)."
    why_human: "The partial-JSON extraction from argsCodeText is proven correct by unit tests (6/6), but whether the actual SSE stream emits argsCodeText with a description key DURING the preparing window requires a live tool-using run per provider. The per-provider WIN magnitude is not measurable without a live run."
---

# Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim — Verification Report

**Phase Goal:** One honest, unified, space-efficient chat surface across every provider — the tool card becomes the single canonical place for live run info, it reads identically on all providers, redundant chrome is removed, and every pixel of the chat area earns its place.
**Verified:** 2026-06-27T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TDP-02: A tool's `description` surfaces in the preparing window via `preparingDescription(tc)` reading partial-JSON `tc.argsCodeText`, with honest `Preparing {tool}…` fallback, no shared-path fork | VERIFIED | `frontend/src/lib/providerLogo.tsx:117–142` exports `preparingDescription`; wired at `ToolCallPanel.tsx:15` (import), `:832` (TARGET A preparing-branch append), `:964` (TARGET B ToolArgsLivePanel title); 6/6 unit tests green at `preparingDescription.test.ts` |
| 2 | CTC-01: The tool-card header shows the real per-provider logo (`providerLogo(message.provider)` → @lobehub/icons mark) replacing the generic Bot dot | VERIFIED | `frontend/src/components/chat/RunCard.tsx:4` imports `providerLogo`; `:256` computes `HeaderMark = providerLogo(message.provider)`; `:310–314` renders `<HeaderMark size={18}/>` or Bot fallback; 6/6 `RunCard.logo.test.tsx` structural tests green; LIVE per-provider logo confirmed by operator in both themes (128-VALIDATION.md § Scoreboard Results) |
| 3 | CTC-02: RunCard + ToolCallPanel both import the ONE `providerLogo.tsx` helper; no duplicate map/parse | VERIFIED | `RunCard.tsx:4` `import { providerLogo } from "@/lib/providerLogo"`; `ToolCallPanel.tsx:15` `import { preparingDescription } from "@/lib/providerLogo"`; neither file imports `@lobehub/icons` directly (the barrel path crashes the build); confirmed by 04-SUMMARY.md "Critical guard: no direct @lobehub/icons import in RunCard.tsx or ToolCallPanel.tsx" |
| 4 | CTC-03: The redundant `StickyTimerBar` above the composer is REMOVED from `ChatArea.tsx`; the two surviving status homes (RunStatusStrip + floating jump-to-live chip) remain | VERIFIED | `grep -c StickyTimerBar ChatArea.tsx` = 0 (confirmed by 06-SUMMARY.md evidence table); `toolLabel` import also removed; `showJumpToLive` lives in `MessageList.tsx` with 3 refs (the floating chip home); `RunStatusStrip` remains in `RunCard.tsx`; `ChatArea.tsx` import line 21 shows `Folder as FolderIcon, Menu, Sparkles` — no toolLabel |
| 5 | CTC-04: Long user prompts collapse to a clamped preview with a Read-more expander (MessageItem.tsx UserBubble) | VERIFIED | `frontend/src/components/chat/MessageItem.tsx:80–122` — `UserBubble` subcomponent with `useLayoutEffect` overflow-detect, `-webkit-line-clamp:7` via `cn`, `from-[hsl(258_90%_66%)]` fade at line 108, Read more/Show less toggle; 5/5 `MessageItem.clamp.test.tsx` tests green |
| 6 | ROADMAP SC#6: The unified surface is sketch-approved (G-2) before planning — the operator-approved mockup is the acceptance bar | VERIFIED (pre-code) | G-2 gate was honored during discuss-phase (2026-06-27 discussion `0e3608fa`, sketches 048/049/050, MANIFEST.md Running Design Decisions 38/39/40); this is a process gate that precedes code, not a code artifact; confirmed by ROADMAP.md "Reframed 2026-06-27 (operator)" + plan frontmatter references to sketch directories |

**Score:** 5/6 truths verified against the codebase. SC#6 (sketch-approved before planning) is a pre-code process gate, verified as honored. All 5 codebase truths pass at Levels 1–3. Human verification is needed for live browser behaviors (overflow reveal, fade visual, live wire TDP-02 per-provider).

---

### Deferred Items

The ROADMAP SC#3 CTC-02 sub-clause ("verified uniform before relying on it — SC#10") and the 128-VALIDATION.md D-06 mandated full native-7 × 4-axis exhaustive scoreboard are **operator-accepted partial deferences**, not verification failures.

| # | Item | Addressed in | Evidence |
|---|------|-------------|----------|
| 1 | Full native-7 + OpenRouter exhaustive 4-axis scoreboard (multi-tool / parallel-thread / long-message axes, Redis-stream `description`-during-preparing per provider) | Re-open trigger: any reported cross-provider tool-card regression | Documented honestly in 128-VALIDATION.md L98–103: "operator hardware can't run a local model large enough to drive tool cards; cloud sweep deferred to keep the phase closeable under time/resource constraints." Re-open trigger recorded. Precedent: Phase 116. Operator explicitly approved the D-07 deletion gate with this PARTIAL verdict (128-VALIDATION.md L102). Structural unit tests (10/10 providerLogo + preparingDescription; 6/6 RunCard.logo) and production vite build clean. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/providerLogo.tsx` | D-05 shared helper: `providerLogo()` + `preparingDescription()` in ONE module | VERIFIED | 143 lines; exports both functions; deep `@lobehub/icons/es/<Brand>/components/{Color,Mono}` imports; no barrel import; `LmStudio` added per operator override |
| `frontend/src/components/chat/RunCard.tsx` | CTC-01: imports `providerLogo`, `HeaderMark` computed and rendered; `animate-brandPulse` preserved | VERIFIED | Import at line 4; `HeaderMark` at line 256; avatar swap at lines 304–314 with `bg-white` chip for mapped providers; Bot fallback for null |
| `frontend/src/components/chat/ToolCallPanel.tsx` | TDP-02: imports `preparingDescription`; TARGET A (preparing-branch) + TARGET B (ToolArgsLivePanel title) both wired | VERIFIED | Import at line 15; TARGET A at line 832; TARGET B at line 964; 6 occurrences of `preparingDescription` in the file |
| `frontend/src/components/chat/ChatArea.tsx` | CTC-03: `StickyTimerBar` def + mount + orphaned imports removed; `showJumpToLive` (in MessageList) + RunStatusStrip preserved | VERIFIED | 0 `StickyTimerBar` occurrences; 0 `toolLabel` occurrences; imports at line 21 contain only surviving symbols; `{inputBar}` at line 516 preserved |
| `frontend/src/components/chat/MessageItem.tsx` | CTC-04: `UserBubble` local subcomponent with `useLayoutEffect` overflow-detect, `-webkit-line-clamp:7`, violet fade | VERIFIED | `UserBubble` at lines 80–122; `from-[hsl(258_90%_66%)]` fade at line 108; `-webkit-line-clamp:7` at line 98; Read more/Show less toggle at lines 111–118 |
| `frontend/package.json` | `@lobehub/icons@^5.10.0` installed; lockfile antd-free | VERIFIED | `"@lobehub/icons": "^5.10.0"` at line 16; plan 01-SUMMARY.md confirms antd and @lobehub/ui absent from lockfile (`--legacy-peer-deps` install) |
| `frontend/src/__tests__/lib/providerLogo.test.tsx` | 4 tests: mapped→mark, unknown→null, openrouter-not-unwrapped, no-glm/kimi-keys | VERIFIED | Present; covers all 4 behaviors + lmstudio mapped per operator override |
| `frontend/src/__tests__/lib/preparingDescription.test.ts` | 6 tests: parsed-args preference, truncated-partial extraction, full-parse, two honest-null cases, never-throws | VERIFIED | Present; all 6 behaviors covered |
| `frontend/src/__tests__/components/RunCard.logo.test.tsx` | 6 tests: mapped→mark, unmapped→Bot, brandPulse while streaming, absent on terminal | VERIFIED | Present; 6 tests covering the structural avatar contract + white-chip contrast fix |
| `frontend/src/__tests__/components/MessageItem.clamp.test.tsx` | 5 tests: Read more on long content, Show less toggle, no button on short, fade class, assistant branch untouched | VERIFIED | Present; 5 tests including `forceOverflow()` mock to exercise the REAL useLayoutEffect branch |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RunCard.tsx` | `frontend/src/lib/providerLogo.tsx` | `import { providerLogo } from "@/lib/providerLogo"` at line 4; `HeaderMark = providerLogo(message.provider)` at line 256 | WIRED | 4 occurrences of `providerLogo` in RunCard.tsx |
| `ToolCallPanel.tsx` | `frontend/src/lib/providerLogo.tsx` | `import { preparingDescription } from "@/lib/providerLogo"` at line 15 | WIRED | 6 occurrences of `preparingDescription` in ToolCallPanel.tsx; TARGET A (:832) + TARGET B (:964) both wired |
| `providerLogo.tsx` | `@lobehub/icons` | Deep leaf imports: `@lobehub/icons/es/<Brand>/components/{Color,Mono}` (NOT the barrel) | WIRED | 10 named leaf imports at lines 41–50; no `@lobehub/icons` barrel or brand-index import (antd-avoidance) |
| `MessageItem.tsx` UserBubble | `message.content` | `clamped <p>` with `useLayoutEffect` overflow-detect via ref; `scrollHeight > clientHeight + 1` | WIRED | `pRef` + `useLayoutEffect` at lines 81–90; content rendered as text children at line 101 |
| `ChatArea.tsx` | StickyTimerBar (removed) | Deletion confirmed: 0 occurrences of `StickyTimerBar` in `ChatArea.tsx` | VERIFIED ABSENT | D-02: pure subtraction; `{inputBar}` preserved at line 516 |
| `ChatArea.tsx` | floating jump-to-live chip (surviving) | `MessageList.tsx` owns `showJumpToLive` (3 refs); `ChatArea.tsx` preserves the `MessageList` mount | WIRED | The chip survives in its owner — not in ChatArea directly (confirmed in 06-SUMMARY.md verification table) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ToolCallPanel.tsx` preparing branch | `preparingDescription(tc)` → `prepDesc` | `tc.argsCodeText` (populated by SSE `tool_args_progress` events from StreamsProvider) | Real data when the provider streams args token-by-token; null (honest) when provider delivers atomically (Google) or nothing yet on the wire | FLOWING (structurally proven; per-provider WIN magnitude deferred to live UAT) |
| `RunCard.tsx` avatar | `HeaderMark = providerLogo(message.provider)` | `message.provider` is the server-resolved `runs.provider` field, already threaded at `RunCard.tsx:246` (`runSub`) | Real per-provider string from the DB run record | FLOWING |
| `MessageItem.tsx` UserBubble | `overflowing` (from `useLayoutEffect` measuring `scrollHeight > clientHeight + 1`) | Real DOM measurement via `pRef.current` | Depends on real browser layout; jsdom returns 0/0 (no layout) so tests mock it | STATIC in tests (jsdom), REAL in browser — live overflow check is human verification item |

---

### Behavioral Spot-Checks

Step 7b SKIPPED: the core deliverables require a running frontend + live LLM provider connections. No runnable entry points can be exercised without starting the full app stack. The human verification section covers the live behaviors.

---

### Probe Execution

No probes defined for this phase — no `scripts/*/tests/probe-*.sh` files referenced in PLAN.md or SUMMARY.md. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TDP-02 | 128-03-PLAN.md, 128-04-PLAN.md | Tool description streams live before `tool_start` (preparing-window honesty) | SATISFIED | `preparingDescription()` in `providerLogo.tsx:117–142`; wired at ToolCallPanel.tsx:832 + :964; 6/6 unit tests |
| CTC-01 | 128-01-PLAN.md, 128-03-PLAN.md, 128-04-PLAN.md | Tool-card header shows actual provider logo | SATISFIED | `providerLogo()` in `providerLogo.tsx:89–92`; wired at RunCard.tsx:256+310; 6/6 RunCard.logo tests; LIVE confirmed by operator |
| CTC-02 | 128-03-PLAN.md, 128-04-PLAN.md | Unified content/layout across ALL providers — single canonical tool card surface | SATISFIED (structurally; full exhaustive UAT deferred) | Both consumers import ONE shared helper; no duplicate map; card layout otherwise already provider-agnostic; structural unit tests green; production build clean; LIVE per-provider visual confirmed by operator |
| CTC-03 | 128-06-PLAN.md | Redundant sticky elapsed timer above composer removed | SATISFIED | `StickyTimerBar` count in ChatArea.tsx = 0; `toolLabel` count = 0; two status homes preserved; regression suite rot-adjusted delta = 0 |
| CTC-04 | 128-02-PLAN.md | Long user prompts collapse to clamped preview + Read-more | SATISFIED (structurally; live overflow verify is human item) | `UserBubble` in MessageItem.tsx:80–122; 5/5 clamp tests; `from-[hsl(258_90%_66%)]` class confirmed at line 108 |

All 5 requirement IDs declared across the 6 plans are covered. No orphaned requirements found — REQUIREMENTS.md traceability table maps TDP-02 + CTC-01..04 to Phase 128 exclusively.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/lib/providerLogo.tsx` | 63–65 (comment) | `lmstudio` treatment changed from plan (Bot fallback) to mark — documented as operator override | Info | Not a code defect; the operator approved the change mid-phase; tests and comments are consistent; the override is recorded in the VERIFICATION.md frontmatter above |
| `frontend/src/components/chat/MessageItem.tsx` | Pre-existing (line ~349 per 02-SUMMARY.md) | Pre-existing `react-hooks/rules-of-hooks` eslint error at `stickyLabelRef = useRef(...)` in the assistant path — NOT introduced by Phase 128 | Info | Pre-existing rot (SEED-056 family); documented by 02-SUMMARY.md; `UserBubble`'s hooks are clean; out of scope |

No TBD, FIXME, XXX, or PLACEHOLDER markers found in files modified by this phase. No unreferenced debt markers.

---

### Human Verification Required

#### 1. Long user prompt — live browser overflow reveal

**Test:** Open the dev app at http://localhost:5173. Start a chat thread. Paste a large text block (≥ 50 lines or ≥ 5 KB) as a user message and submit. Observe the user bubble immediately after the message appears.
**Expected:** The bubble shows only the first ~7 lines of text. A violet gradient fade is visible at the bottom of the clamped text that blends into the bubble color. A "Read more" button appears below the fade. Clicking it expands to show the full prompt. A "Show less" button appears; clicking it re-collapses.
**Why human:** `jsdom` has no layout engine so `scrollHeight` and `clientHeight` are both 0 in tests — `useLayoutEffect` never trips naturally. The test suite uses `vi.spyOn(HTMLElement.prototype, "scrollHeight", ...)` to exercise the production code path structurally, but the actual overflow detection in a real browser with real typography must be confirmed by a human.

#### 2. Fade color judgment — bubble-match vs page-background bleed

**Test:** After confirming the clamp fires (test 1 above), look closely at the gradient fade at the bottom of the clamped bubble.
**Expected:** The fade should dissolve text into the violet interior of the bubble (matching `hsl(258 90% 66%)`, the 135-degree gradient end), not cut off to the dark page background as a visible color band. The effect should look like the text fades away naturally within the bubble.
**Why human:** The Tailwind class `from-[hsl(258_90%_66%)]` is confirmed present in the DOM (line 108 of MessageItem.tsx), but whether it visually matches the live rendered bubble color (which itself uses a CSS gradient) is a perceptual design judgment not verifiable programmatically.

#### 3. TDP-02 preparing-window description — live SSE wire check (1–2 providers)

**Test:** With the backend running, run a tool-using prompt (e.g. "execute this: import pandas; print(pandas.DataFrame(...))" or "search my documents for...") on Anthropic and/or an OpenAI-compat provider. Watch the tool card during the brief period between the agent deciding to call a tool and the tool actually starting (the "preparing" window). Also try on Google.
**Expected:** On Anthropic (and OpenAI-compat providers that stream args token-by-token), the tool card should briefly show "Preparing [tool-name]… — [a description of what it will do]" before transitioning to the running state. On Google (which delivers tool args atomically with no prep window), only "Preparing [tool-name]…" should appear — the quiet fallback is correct, not a failure.
**Why human:** The partial-JSON description extraction path is proven correct by 6 unit tests against the parsing logic. However, whether any given provider's SSE stream includes the `description` field in its `argsCodeText` DURING the preparing window (before the first `tool_args_progress` batch completes) depends on the live model output — a fact the unit tests cannot establish. The per-provider WIN magnitude requires a real streaming run.

---

### Gaps Summary

No blocking gaps. All 5 codebase success criteria are satisfied at Levels 1–3 (exists, substantive, wired). The three human verification items are live behavioral checks that require a running browser + real LLM streams — they are not evidence of missing or broken implementation. The deferred full native-7 exhaustive scoreboard is an operator-accepted, honestly-documented carry-forward (recorded in 128-VALIDATION.md with a concrete re-open trigger).

The lmstudio deviation from the PLAN's original Bot-fallback specification is an operator-approved, mid-phase override that more honestly satisfies CTC-01's intent (accurate per-provider logo for a named connector) than the original plan wording — applied as a frontmatter override above.

---

_Verified: 2026-06-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
