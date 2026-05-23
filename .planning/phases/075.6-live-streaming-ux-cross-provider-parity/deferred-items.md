# Phase 075.6 — Deferred Items

Out-of-scope discoveries surfaced during Plan 03 execution. Per executor
scope boundary (Rule 0): only auto-fix issues DIRECTLY caused by the
current task's changes; pre-existing failures in unrelated tests are
logged here and not fixed.

---

## D-075.6-03-DEFER-1 — MessageItem.test.tsx:106 "thinking" assertion stale

- **Discovered during:** Plan 03 Task 4 (insert `<WorkingBadge>` into MessageItem.tsx).
- **Symptom:** `src/__tests__/components/MessageItem.test.tsx > MessageItem – streaming state > shows thinking indicator when streaming with empty content` fails — `getByText(/thinking/i)` cannot find a match.
- **Verified pre-existing:** Stashed all Plan 03 changes (including the WorkingBadge insertion) and re-ran the test on the pre-Plan-03 baseline — same failure: 17/18 pass, 1 fails on `MessageItem.test.tsx:106`. The failure is NOT introduced by Plan 03.
- **Likely root cause:** `outerBannerLabel(null, false, false)` returns `"Setting up agent…"` (per `frontend/src/lib/toolMeta.ts:73`); the test fixture (`role: assistant, content: ""`) sets neither `isPlanning` nor any tool calls. The test was likely written against an older `outerBannerLabel` that returned `"Thinking…"` for this state; the codebase has since shifted the early-streaming copy to `"Setting up agent…"` (Phase 067.1 Plan 02 changes per the toolMeta comment block) but the test assertion was never refreshed.
- **Fix scope:** Update the assertion to `getByText(/setting up agent|thinking/i)` (accepting either copy) OR adjust the test fixture to set `isPlanning: true` so the literal "Thinking…" path fires. Either change is a one-line edit but lives in MessageItem.test.tsx (an unrelated file), not in any Plan 03 surface.
- **Routing:** Address in a follow-up frontend-test-polish phase OR fold into the next phase that touches MessageItem.tsx directly. Not a blocker for Phase 075.6 verification.

---

## Notes

Plan 03 final-sweep result: all NEW tests added by 075.6 (Plan 02 ToolArgsLivePanel, Plan 03 WorkingBadge, Plan 03 ToolCallPanel) GREEN; all Plan 02 reducer tests GREEN; MessageItem.memo / MessageItem.sticky / MessageItem.finalOutputs GREEN (14/14). Only the pre-existing MessageItem.test.tsx:106 assertion remains red — same baseline pass/fail count as pre-Plan-03.
