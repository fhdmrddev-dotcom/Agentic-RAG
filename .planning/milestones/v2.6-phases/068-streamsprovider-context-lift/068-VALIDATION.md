---
phase: 068
slug: streamsprovider-context-lift
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 068 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Source of truth: `068-RESEARCH.md` §Validation Architecture (Finding #12).
> Locked invariants L-068-01..07 + Success Criteria SC#1..4 from `068-CONTEXT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 + jsdom 29 (verified: `frontend/package.json`) |
| **Config file** | `frontend/vitest.config.ts` (jsdom env; `setupTests.ts` loads `@testing-library/jest-dom`) |
| **Quick run command** | `cd frontend && npm test -- src/__tests__/providers/streamsProvider.test.tsx` |
| **Full suite command** | `cd frontend && npm test` |
| **Type/build gate** | `cd frontend && npm run build` |
| **Estimated runtime** | ~15s targeted / ~60s full suite |

---

## Sampling Rate

- **After every task commit:** `cd frontend && npm test -- src/__tests__/providers/streamsProvider.test.tsx src/__tests__/hooks/useMessages.test.ts`
- **After every plan wave:** `cd frontend && npm test` (full unit suite — 12 test files in `__tests__/`)
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` green + Chrome MCP `<DevTwoPaneMock>` manual exercise green
- **Max feedback latency:** ~15s targeted, ~60s full suite

---

## Per-Task Verification Map

> Tasks IDs use the planner's `{phase}-{plan}-{task}` convention. Plan 1 = store+provider scaffold; Plan 2 = `useMessages` thin reader; Plan 3 = reconcile listeners move; Plan 4 = mocked second surface + Chrome MCP. Final IDs are author-decided by gsd-planner.

| Task ID | Plan | Wave | Requirement | Invariant | Behavior asserted | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-----------|-------------------|-------------|--------|
| 068-01-* | 01 | 1 | STREAMS-PROVIDER-01 | SC#1 (scaffold) | Provider mounts; store actions defined; named hooks return correct slices | unit (Vitest) + ts build | `cd frontend && npm test -- src/__tests__/providers/streamsProvider.test.tsx` + `npm run build` | ❌ W0 (NEW file) | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-01 / SC#2** Branch D-3 `clearMessages` guard preserved verbatim — fires per-surface | `useMessages` is thin reader; existing `useMessages.test.ts` Branch D-3 test passes unmodified | unit (Vitest) | `cd frontend && npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "Branch D-3"` AND `npm test -- src/__tests__/hooks/useMessages.test.ts -t "Branch D-3"` | ✅ existing + ❌ W0 new | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-02 / SC#4** `reconcileInFlightRef` single-bit lock | Two concurrent `reconcile()` calls → second bails at top guard; lock releases in finally even on exception | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "concurrent reconcile"` | ❌ W0 | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-03** `setViewingThread` sole writer | `activeThreadIdRef.current =` mutated in exactly one location; post-await guard discards stale writes | structural + unit | grep `setViewingThread` source (1 hit) + Vitest mid-await navigation test | ❌ W0 | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-04** `streamingThreadIdRef` bucket-routing (Phase 067.4 R-1) | Incoming SSE delta routes to streaming thread's bucket, NOT viewing thread's | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "R-1 protection"` | ❌ W0 (port of existing `useMessages.test.ts:181-231`) | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-05** runId-match dedup | Reconcile reuses `m.runId === run.run_id` message's id as assistantId | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "runId-match dedup"` | ❌ W0 (mirrors Phase 063.1 Test 2) | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-06** `loadMessages` MERGE 3-clause filter | Three-clause filter (`m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`) preserves live in-flight placeholders | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "MERGE temp placeholders"` | ❌ W0 (mirrors D-063.1-12) | ⬜ pending |
| 068-02-* | 02 | 2 | STREAMS-PROVIDER-01 | **L-068-07** BL-03 cleanup on onTerminal | `subscriptionsRef.current.delete(runId)` fires inside `onTerminal`, NOT in promise finally | unit (Vitest) | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "cleanup on onTerminal"` | ❌ W0 | ⬜ pending |
| 068-03-* | 03 | 3 | STREAMS-PROVIDER-01 | SC#1 (listeners move) | `ChatArea.tsx:163-188` block deleted; provider's mount-time `useEffect` attaches `visibilitychange` / `focus` / `pageshow`; no-op when `activeThreadIdRef.current` is null (D-068-08) | unit + grep + e2e | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "listener migration"` + grep ChatArea.tsx returns 0 hits for `visibilitychange` + existing Playwright specs from Phase 063/063.1/067.x green | ❌ W0 (unit) + ✅ existing (e2e) | ⬜ pending |
| 068-04-* | 04 | 4 | STREAMS-PROVIDER-01 | **SC#3** Mocked second surface — re-render isolation + per-surface bucket invariant | Writes to `('mock-eval', X)` don't re-render `('chat', *)` consumer; Branch D-3 holds for both surfaces; `<DevTwoPaneMock>` exercises the path manually | unit (Vitest with render-counter) + manual Chrome MCP | `npm test -- src/__tests__/providers/streamsProvider.test.tsx -t "re-render isolation"` + manual: navigate to `http://localhost:5173/?devTwoPane=1` and exercise both panes | ❌ W0 + manual | ⬜ pending |
| 068-04-* | 04 | 4 | STREAMS-PROVIDER-01 | SC#3 regression coverage | Phase 067.5 5/5 cycles + Phase 063 / 063.1 / 067.x Playwright e2e specs pass under new architecture | manual (Chrome MCP) + e2e (Playwright if available, vitest-fallback otherwise) | Per Phase 067.5 cycles script + `cd frontend && npm run test:e2e` (if exists; Plan 4 author confirms inventory per Open Question A1) | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/providers/streamsProvider.test.tsx` — NEW; covers L-068-01..07 + SC#1..4
- [ ] `frontend/src/__tests__/providers/` directory — NEW (sibling to `hooks/`, `components/`, `lib/`)
- [ ] `frontend/src/__tests__/components/DevTwoPaneMock.test.tsx` — OPTIONAL; inlinable into `streamsProvider.test.tsx` if the dev-mock stays a simple stub
- [ ] No framework install needed — Vitest 4.1.0 + RTL 16.3.2 already present in `frontend/package.json`
- [ ] `zustand` dep — installed during Plan 1 Task 1 (`npm install zustand@^5.0.13`), pinned per RESEARCH §Findings #1

---

## "Preserved verbatim" — verifiable property (SC#2 binding gate)

Three layers of evidence stack for L-068-01 / SC#2:

1. **Line-anchor source diff** — the literal `clearMessages` body lines (currently `useMessages.ts:572-590`) migrate to the store action / provider-internal callback. A `git diff` view of the equivalent block shows the predicate `if (tid && tid !== streamingThreadIdRef.current) { ... }` byte-identical to source. **Manual checklist item in gsd-plan-checker Plan 2 review.**
2. **Snapshot identity-of-effect test** — the L-068-01 Vitest test asserts the OUTCOME (streamed content survives switch-back + clearMessages) rather than the IMPLEMENTATION. The outcome must hold for both `surfaceId='chat'` AND `surfaceId='mock-eval'` (the `it.each(["chat","mock-eval"])` enumeration).
3. **Inherited existing test passes unmodified** — the current `useMessages.test.ts` Phase 067.5 Branch D-3 test STAYS in `frontend/src/__tests__/hooks/useMessages.test.ts` and passes post-lift. Plan 2's binding gate: this test passes against the new thin-reader `useMessages` **without any test-side modification**. If the test needs modification, the abstraction broke.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-pane mock — visual confirmation that chat + mock-eval render independently and don't cross-contaminate | STREAMS-PROVIDER-01 / SC#3 | DOM rendering of a second consumer is visually obvious but unwieldy to assert in unit tests beyond render-count + bucket isolation | 1. `cd frontend && npm run dev`<br>2. Open `http://localhost:5173/` and authenticate (`fhdmrd@gmail.com` / `123456`)<br>3. Activate `<DevTwoPaneMock>` per Plan 4's chosen activation mechanism (URL flag, dev menu, or env)<br>4. Send a message in chat pane → confirm streams in chat pane only<br>5. Switch viewing thread → confirm Branch D-3 (streamed bucket survives switch)<br>6. Optional: drive via Chrome DevTools MCP for repeatability |
| Phase 067.5 lived-experience cycles (5/5) regression | STREAMS-PROVIDER-01 / SC#3 | Multi-tab + visibility + focus + thread-switch matrix requires real browser timing; vitest jsdom doesn't faithfully reproduce | Re-run the 5 cycles from `.planning/milestones/v2.5-phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md` cycle definitions against the new architecture. All five must pass. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all NEW test file + directory + dep dependencies
- [ ] No watch-mode flags in automated commands (`npm test` runs `vitest run`, not `vitest`)
- [ ] Feedback latency < 60s for per-task; < 90s for per-wave
- [ ] Branch D-3 binding gate (SC#2) covered by BOTH the new per-surface test AND the unmodified existing `useMessages.test.ts` test
- [ ] `nyquist_compliant: true` set in frontmatter after planner pins task IDs into the verification map

**Approval:** pending — planner finalizes task IDs into the table above; auditor confirms.
