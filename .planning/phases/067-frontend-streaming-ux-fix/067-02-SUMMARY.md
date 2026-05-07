---
phase: 067
plan: 02
subsystem: frontend-streaming-ux
tags: [tool-call-panel, iteration-divider, sse, react-rendering, ux-polish]
dependency_graph:
  requires:
    - "Phase 066 D-066-04 iteration_start SSE event semantics"
    - "Phase 067 Plan 01 D-067-01 (POST→subscribe handoff reorder)"
    - "Phase 067 Plan 01 D-067-02 (existence-checked terminal flips, no Saving response… fallback)"
    - "Phase 063.1 D-063.1-08 guardedSetMessages"
    - "Phase 063.1 D-063.1-09 lastSeenOffsetRef"
    - "Phase 063.1 D-063.1-11 reconcileInFlightRef"
    - "Phase 063.1 D-063.1-12 loadMessages MERGE-preserve filter"
    - "Phase 063.1 BL-03 subscriptionsRef cleanup ordering"
  provides:
    - "D-067-03 ToolCall.iteration field — 0-based per-call iteration index stamped from SSE"
    - "D-067-03 closure-tracked currentIteration counter inside makeStreamCallbacks"
    - "D-067-03 Step N gradient divider with data-testid='iteration-divider' on iteration boundaries"
  affects:
    - "frontend/src/types/index.ts — ToolCall extended with optional iteration?: number"
    - "frontend/src/hooks/useMessages.ts — onToolPreparing/onToolStart stamp iteration; onIterationStart bumps closure-tracked counter"
    - "frontend/src/components/chat/ToolCallPanel.tsx — gradient Step N divider rendered between iteration groups"
tech_stack:
  added: []
  patterns:
    - "Closure-tracked counter inside factory function (let, not useRef) — ensures all returned callback closures share the same captured variable across the same SSE stream lifetime"
    - "Stamp on object literal (no setState side-effect) — counter mutated only inside onIterationStart BEFORE the setMessages updater"
    - "Defensive iteration spread: tc.iteration ?? currentIteration on the preparing-upgrade branch — preserves stamp from onToolPreparing but falls back when preparing was missed via race/reconnect"
    - "Boundary detection helper that walks back past consecutive skill rows to find the most recent tool kind — skill rows do not partition iterations"
    - "Strict-undefined boundary gating (Pitfall 5): boundary requires both current AND prev iteration to be defined — DB-loaded historical messages with no SSE stamp render no spurious dividers"
key_files:
  created:
    - ".planning/phases/067-frontend-streaming-ux-fix/067-02-SUMMARY.md"
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/hooks/useMessages.ts"
    - "frontend/src/components/chat/ToolCallPanel.tsx"
decisions:
  - "D-067-03 ToolCall.iteration is orthogonal to Message.iterationCount — the latter is the latest-seen counter (used for the header-level Step N prefix), the former partitions tool calls into iteration groups for the in-body divider. Both retained, both load-bearing."
  - "Counter declared as `let` inside makeStreamCallbacks (not useRef in the hook) per BLK-5 guidance — closures returned from the factory share the captured variable across the SSE stream lifetime."
  - "Default `currentIteration = 0` covers the rare race where a tool starts BEFORE the first iteration_start callback fires (mock streams; reconnect mid-iteration)."
  - "Strict-undefined boundary gating (Pitfall 5) chosen over PATTERNS.md Pattern F's looser conditional — protects mixed-source threads (DB-loaded tool call followed by SSE-stamped tool call) from rendering a misleading Step 1 divider."
  - "Diff stayed inline (~16 added lines across 3 files) — keep-inline per CONTEXT.md (well under 150-LOC split threshold)."
metrics:
  duration: "12min"
  completed_date: "2026-05-07"
---

# Phase 067 Plan 02: Step N Iteration Divider Summary

Added a one-field ToolCall extension + per-call iteration stamping in the SSE callbacks + a gradient `Step N` divider in ToolCallPanel so multi-iteration agent runs (search → report → charts → docx) render iteration boundaries as intentional progress instead of a runaway flat list (UX-067-05).

## Tasks Completed

### Task 1: Add `iteration?: number` field to ToolCall type

**Commit:** `8096362` — `feat(067-02): add iteration field to ToolCall type (D-067-03)`

- Added optional `iteration?: number` field to `ToolCall` interface at `frontend/src/types/index.ts:46`.
- Field is 0-based per the iteration_start SSE event payload semantics.
- Doc comment locked in verbatim from PATTERNS.md L309-313 — explicitly notes that DB-loaded historical messages have undefined iteration (panel divider gating treats undefined as "no boundary").
- `Message.iterationCount?: number` at line 86 unchanged — the per-message latest-seen counter remains the source for the header-level Step N prefix; ToolCall.iteration is the orthogonal per-tool-call partitioning field.
- TypeScript compile clean.

### Task 2: Stamp ToolCall.iteration in useMessages.ts callbacks

**Commit:** `bf3e486` — `feat(067-02): stamp ToolCall.iteration in useMessages SSE callbacks (D-067-03)`

- **Counter declaration** at `frontend/src/hooks/useMessages.ts:60`: `let currentIteration = 0` placed in the outer scope of `makeStreamCallbacks` (after the destructuring line, before the `return {`), so closures returned in `onToolPreparing`, `onToolStart`, and `onIterationStart` all share the same captured variable.
- **`onIterationStart` bump** at `useMessages.ts:296`: `currentIteration = iteration` set BEFORE the `setMessages` updater (no side-effects inside React state updaters per Phase 057 deferral §1 / Phase 060 D-060-11). The pre-existing `Message.iterationCount` update at line 298 preserved verbatim.
- **`onToolPreparing` stamp** at `useMessages.ts:96`: `iteration: currentIteration` appended to the preparingEntry literal.
- **`onToolStart` preparing-upgrade defensive stamp** at `useMessages.ts:123`: `iteration: tc.iteration ?? currentIteration` — preserves the stamp set in onToolPreparing (Edit 3a above), but falls back to current counter if preparing was missed via race/reconnect.
- **`onToolStart` no-preparing-fallback stamp** at `useMessages.ts:138`: `iteration: currentIteration` appended directly to the new running entry literal.
- `onToolEnd` (line ~143) and other callbacks untouched — `tc.iteration` survives via the spread `...tc` in onToolEnd's map.
- Wave 1 ordering invariants preserved: `guardedSetMessages` (5 occ), `reconcileInFlightRef` (5 occ), `lastSeenOffsetRef` (6 occ), D-067-01 markers (3 occ), D-067-02 existence-check guards intact at lines 622 (sendMessage) + 866 (reconcile), set-before-subscribe at line 554, BL-03/MERGE-preserve filter at line 454.
- TypeScript compile clean.

### Task 3: Render Step N gradient divider in ToolCallPanel.tsx

**Commit:** `e165bfe` — `feat(067-02): render Step N gradient divider on iteration boundaries (D-067-03)`

- **`prevToolIteration` helper** at `frontend/src/components/chat/ToolCallPanel.tsx:644-655` (inside the displayItems map callback, per-iteration scope): walks back past consecutive skill rows to find the most recent tool kind's iteration. `undefined` if no prior tool item exists. Skill rows do not partition iterations — they break the inter-tool flow visually but do not signal an iteration boundary.
- **Conditional divider block** at `ToolCallPanel.tsx:674-689`: replaces the existing inter-tool `h-px bg-border/20` separator (was lines 654-657 in pre-edit source). Renders the gradient Step N divider when:
  - `i > 0` (Pitfall 4 — never above the first iteration), AND
  - `tc.iteration !== undefined`, AND
  - `prevToolIteration !== undefined` (Pitfall 5 — DB-loaded historical tool calls without an iteration field DON'T trigger a spurious divider when followed by a fresh SSE-stamped call), AND
  - `tc.iteration !== prevToolIteration`.
- Falls back to the existing `h-px bg-border/20 -mt-1 mb-2.5 mx-1` plain separator otherwise (still rendered when `i > 0` but the boundary check fails).
- DOM attributes: `data-testid="iteration-divider"` and `data-iteration={tc.iteration}` (0-based) for evaluation by Plan 05's Chrome MCP UAT.
- Aether tokens reused: `from-transparent via-primary/30 to-transparent` gradient; `text-muted-foreground/70` label; `text-[10px] tracking-wider uppercase` typography matches the existing PATTERNS.md Pattern F mockup (`──── Step 2 ──────`).
- Skill-row branch separator at line 640 (`{i > 0 && <div className="h-px bg-border/20 -mt-1 mb-2.5 mx-1" />}`) untouched.
- Header-level `stepPrefix` rendering at lines 542-574 (derived from `iterationCount`, used in `headerLabel`) untouched — complementary to the in-body divider.
- TypeScript compile clean.

## Verification Results

| Gate | Expected | Observed | Status |
|------|----------|----------|--------|
| TypeScript build (Task 1) | exit 0 | exit 0 | PASS |
| TypeScript build (Task 2) | exit 0 | exit 0 | PASS |
| TypeScript build (Task 3) | exit 0 | exit 0 | PASS |
| `iteration?: number` (substring) | ≥2 | 2 (new ToolCall.iteration + existing Message.iterationCount) | PASS |
| `D-067-03` in types/index.ts | ≥1 | 1 | PASS |
| `iterationCount?: number` preserved | 1 | 1 (line 86) | PASS |
| `let currentIteration = 0` | ≥1 | 1 (line 60) | PASS |
| `currentIteration = iteration` | ≥1 | 1 (line 296, onIterationStart) | PASS |
| `iteration: currentIteration` | ≥2 | 2 (preparing entry + no-prep fallback) | PASS |
| `iteration: tc.iteration ?? currentIteration` | ≥1 | 1 (preparing-upgrade defensive) | PASS |
| `iterationCount: iteration` (Message preserved) | ≥1 | 1 (line 298) | PASS |
| `data-testid="iteration-divider"` | ≥1 | 1 (line 677) | PASS |
| `Step {tc.iteration + 1}` | ≥1 | 1 (line 682) | PASS |
| `tc.iteration !== prevToolIteration` | ≥1 | 1 (line 674) | PASS |
| `i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined` | ≥1 | 1 (line 674) | PASS |
| `h-px bg-border/20 -mt-1 mb-2.5 mx-1` (skill + tool fallback) | ≥2 | 2 (line 640 skill + line 687 tool fallback) | PASS |
| `stepPrefix` (header preserved) | ≥1 | 5 (1 derivation + 4 usages) | PASS |
| Wave 1: `guardedSetMessages` | ≥1 | 5 | PASS |
| Wave 1: `reconcileInFlightRef` | ≥3 | 5 | PASS |
| Wave 1: `lastSeenOffsetRef` | ≥4 | 6 | PASS |
| Wave 1: D-067-01/02 markers | ≥1 | 5 | PASS |
| Wave 1: BL-03 `m.id.startsWith("temp-")` | ≥1 | 1 (line 454) | PASS |
| Wave 1: set-before-subscribe (line 554) | ≥1 | 1 | PASS |
| Wave 1: `Saving response` deleted | 0 | 0 | PASS |
| Wave 1: D-067-02 existence-check sendMessage | ≥1 | 1 (line 622) | PASS |
| Wave 1: D-067-02 existence-check reconcile | ≥1 | 1 (line 866; idempotent insert at 801) | PASS |

## Deviations from Plan

None — plan executed exactly as written. Three tasks, three commits, no auto-fixes required, no architectural decisions surfaced.

## Authentication Gates

None — all changes are pure frontend TypeScript edits; no auth/secret surface.

## Threat Flags

None — no new network surface, auth paths, file access patterns, or schema changes introduced. Plan's `<threat_model>` STRIDE register (T-067-02-01 tampering accepted, T-067-02-02 disclosure accepted) covers all changes; both dispositions are `accept` because (a) iteration counter from SSE shares the existing trust boundary the rest of the chat surface trusts and (b) iteration count is non-sensitive (already visible to the user as part of the header `Step N` label since v2.3 Phase 56).

## Known Stubs

None — the divider renders only when both current and previous iteration are defined; DB-loaded historical messages with undefined iteration intentionally render no divider (D-067-03 design — historical tool calls have no SSE iteration_start context to attribute them to). This is documented behavior, not a stub.

## Live UAT Smoke

Deferred to Plan 05 closing UAT per D-067-07 / VERIFICATION.md. Plan 05 will drive a Chrome MCP session at `localhost:5173` (login `fhdmrd@gmail.com / 123456`) to:

1. Submit a multi-iteration prompt (e.g., `execute_code → PNGs → execute_code → docx`).
2. Confirm via Chrome MCP `evaluate_script`: `document.querySelectorAll('[data-testid="iteration-divider"]').length >= 1` returns true after the second iteration begins.
3. Verify visual `Step 2`, `Step 3`, etc. labels appear between iteration groups in the ToolCallPanel.
4. Verify a thread loaded purely from DB (historical tool calls, no SSE iteration field) renders ZERO `iteration-divider` elements.

## TDD Gate Compliance

Plan type `execute` (not `tdd`) — TDD gate sequence not required. Each task committed individually with `feat(067-02)` commit prefix per task_commit_protocol.

## Self-Check

**Created files:**
- `.planning/phases/067-frontend-streaming-ux-fix/067-02-SUMMARY.md` — FOUND (this file).

**Modified files:**
- `frontend/src/types/index.ts` — FOUND (commit 8096362).
- `frontend/src/hooks/useMessages.ts` — FOUND (commit bf3e486).
- `frontend/src/components/chat/ToolCallPanel.tsx` — FOUND (commit e165bfe).

**Commits exist:**
- `8096362 feat(067-02): add iteration field to ToolCall type (D-067-03)` — FOUND.
- `bf3e486 feat(067-02): stamp ToolCall.iteration in useMessages SSE callbacks (D-067-03)` — FOUND.
- `e165bfe feat(067-02): render Step N gradient divider on iteration boundaries (D-067-03)` — FOUND.

## Self-Check: PASSED
