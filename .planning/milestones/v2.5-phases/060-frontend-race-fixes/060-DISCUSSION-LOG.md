# Phase 060: Frontend Race Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 060-frontend-race-fixes
**Areas discussed:** Cleanup scope, Verification approach, AbortError handling, useEffect ordering & deps

---

## Cleanup scope (multi-select)

Phase 060 changes intersect with several Phase 057 band-aids that still live in `useMessages.ts` / `ChatArea.tsx`. How aggressive should cleanup be beyond the 3 locked SC items?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop 8s fallback timer | ChatArea.tsx:90-92 — naive setTimeout(loadMessages, 8s). Phase 061 replaces with proper polling. Removing it now means F5 mid-stream stays broken until 061, but stops the timer racing with the new abort-on-navigate logic. | ✓ |
| Drop visibilitychange listener | ChatArea.tsx:96-101 — fires loadMessages on tab focus. Phase 061 replaces with the proper handler (E recovery). Same trade-off as the 8s timer: short-term regression on Symptom E, but cleaner 060 surface. | ✓ |
| Drop subscribeToThread/threadChannelRef | Always-on Supabase Realtime sub in useMessages (lines 55-96). 057-DEFERRAL flagged it as duplicate-subscription source of races. STREAM-03 deferred; Phase 060 SC don't require it. Removing now eliminates a known race source. | ✓ |
| Drop per-stream channelRef | Realtime sub spun up inside sendMessage (lines 156-200). With finally-block reload gone (SC#3), its 'recovery' purpose is moot. 057-DEFERRAL recommended single-subscription architecture explicitly. | ✓ |

**User's choice:** All four — most aggressive cleanup path.
**Notes:** User explicitly opted into the short-term E/F regression between 060 and 061 to get a clean foundation. Phase 061 reintroduces the proper handlers on top of `setViewingThread` + `loadMessages(signal)`.

---

## Verification approach (single-select)

Phase 060 SC#4 mandates a browser MCP test for the Thread A→B race. Phase 062 (the harness) hasn't shipped yet. How do we verify before Phase 061 unblocks?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline chrome-mcp test now (Recommended) | Write the Thread A→B navigation scenario as a one-off browser-MCP script in 060, mirror it into the 062 harness later. Highest confidence; satisfies SC#4 literally; ~30min cost. | ✓ |
| Manual two-tab DevTools checklist (058 style) | Mirror the 058/059-VERIFICATION.md format: human runs the steps, captures Network tab evidence of aborted Thread A getMessages. Faster, no tooling dependency, but not reproducible. | |
| Defer SC#4 test to after 062 lands | Ship 060 with structural verification only, park the browser test until 062 harness exists. Risks SC#4 not being literally satisfied at merge. | |

**User's choice:** Inline chrome-mcp test now.
**Notes:** The manual checklist (058 style) is preserved as a non-gating backstop in `060-VERIFICATION.md` (D-060-13). Phase 062 will fold the inline test into the reusable harness.

---

## AbortError handling (single-select)

When `loadAbortRef.abort()` cancels the previous in-flight `getMessages`, the rejected fetch surfaces as `AbortError`. Where should it be silenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside loadMessages (Recommended) | try/catch in loadMessages: if err.name === 'AbortError', return silently; otherwise rethrow. Call sites keep their .catch(console.error) and only see real errors. Matches the existing pattern at useMessages.ts:423. | ✓ |
| At each call site | Each .catch(console.error) at ChatArea:84/91/98 filters AbortError. More duplication but makes intent visible at call sites. | |
| Inside getMessages in api.ts | Convert AbortError to a sentinel return (e.g. null/empty array). Cleanest call site but loses the 'aborted' signal — same shape as 'no messages'. | |

**User's choice:** Inside loadMessages.
**Notes:** Matches existing AbortError-swallow pattern in `sendMessage`'s catch. Keeps the API of `getMessages` standard (rejects on abort like every other Web fetch).

---

## useEffect shape (single-select)

ChatArea useEffect ordering and dependency reduction — are 057-DEFERRAL's FIX 4 defaults correct?

| Option | Description | Selected |
|--------|-------------|----------|
| FIX 4 defaults (Recommended) | Order: setViewingThread(thread?.id ?? null) → abortStream() → clearMessages() → loadMessages(thread.id). Deps: [thread?.id] only (callbacks are stable via useCallback([])). Matches 057-DEFERRAL recommendation verbatim. | ✓ |
| Same order, keep callback deps | Same statement order but keep current dep array including all callbacks. Defensive against callback identity drift; slight risk of effect re-fires. | |
| Fold setViewingThread into loadMessages call site | Don't add setViewingThread as a separate exported callback — set activeThreadIdRef directly via a forwarded ref. Tighter API surface but breaks SC#1's 'exactly one function' literal wording. | |

**User's choice:** FIX 4 defaults.
**Notes:** Locked by ROADMAP SC#1 ("`setViewingThread` is the only writer"). Reduced dep array requires an ESLint suppression comment with justification — planner picks the exact form.

---

## Claude's Discretion

Items the user did not need to weigh in on; planner has flexibility:

- Exact prompt for the long-running stream in the chrome-mcp test (must yield ≥5s of streaming deterministically).
- Whether to preserve `loadMessages`'s same-thread `isSendingRef.current` guard (keeping it is the safer default).
- Whether to delete legacy guards `streamingThreadIdRef` and `sendGenerationRef` now or in a future cleanup phase (subsumed by new mechanism; safe to delete cleanly if focused).
- Where `loadAbortRef` lives in the hook body (top-level vs grouped).
- Test directory location (`tests/browser/` vs `frontend/tests/e2e/` vs existing precedent).
- Exact form of ESLint suppression for the reduced dep array.

## Deferred Ideas

Surfaced during discussion, captured in CONTEXT.md `<deferred>` section:

- Phase 061 will reintroduce E/F recovery (polling + visibilitychange + pageshow + Resume button) on Phase 060's clean foundation.
- Phase 062 will generalize the inline chrome-mcp test into a reusable harness covering E/F/G/H + navigate-during-stream.
- Phase 063 (Skills Test Infrastructure Repair) is unrelated — fixes pre-existing test breakage from 059 deferred-items.md.
- STREAM-03 (Realtime as best-effort hint layer) deferred to a later milestone.
- Legacy guard cleanup (`streamingThreadIdRef`, `sendGenerationRef`) tracked as future maintenance.
- `UseMessages` interface JSDoc stabilization tracked as future polish.
