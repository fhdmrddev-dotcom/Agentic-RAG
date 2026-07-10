---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 06
subsystem: frontend-chat-surface
tags: [chat-ui, cleanup, net-subtractive, CTC-03, G-5, D-02, D-07]
requires:
  - "128-05 (D-06 live cross-provider scoreboard verdict — gates this deletion per D-07)"
provides:
  - "CTC-03: the redundant StickyTimerBar (Phase 076.1 D-03 sticky composer timer) removed from ChatArea.tsx — chat-area vertical space reclaimed; two honest status homes preserved"
affects:
  - "frontend/src/components/chat/ChatArea.tsx (the only file changed; threads.py untouched — G-5)"
tech-stack:
  added: []
  patterns:
    - "Net-subtractive G-5 discipline: remove a redundant render surface rather than add another; the canonical surface (the unified tool card, proven in Plan 05) + the floating chip make the third elapsed surface superfluous"
    - "Orphaned-import hygiene after a component deletion: every import whose SOLE consumer was the deleted code must also be removed (Pitfall 4 / TS6133 / TS6196), verified against the real compiler"
key-files:
  created:
    - ".planning/phases/128-chat-tool-card-unification-chat-area-reclaim/128-06-SUMMARY.md"
  modified:
    - "frontend/src/components/chat/ChatArea.tsx (StickyTimerBar def + mount + 3 orphaned imports removed; 2 ins / 68 del)"
decisions:
  - "D-02 honored: pure subtraction, NO net-new wire — the StickyTimerBar def + its IIFE mount deleted; the two surviving status homes (header RunStatusStrip + MessageList floating '↓ Jump to live' chip) left fully intact"
  - "D-07 honored: this is the LAST plan, gated on the Plan 05 D-06 scoreboard. The scoreboard recorded a PARTIAL PASS (CTC-01/CTC-02 logo + unified card verified LIVE per-provider in BOTH themes + structural suites green; full native-7 × 4-axis exhaustive run DEFERRED for operator hardware/resource constraints, with a re-open trigger). The operator EXPLICITLY approved proceeding with the deletion (128-VALIDATION.md L102). Gate recorded resolved/approved — not re-prompted."
  - "Rule 3 deviation: the deletion orphaned TWO MORE imports beyond the planned toolLabel — Loader2 (lucide-react) and the Message type (@/types). StickyTimerBar was their ONLY consumer in this file. The real tsc compiler flagged both (TS6133 'Loader2'... + TS6196 'Message'...). Removing them is REQUIRED to satisfy the acceptance gate 'ChatArea.tsx introduces NO NEW tsc error' and reproduces nothing — it prevents the exact Pitfall-4 build break the plan exists to avoid. The plan's 'only toolLabel goes' PRESERVE language was predicated on those imports remaining used elsewhere; empirically they did not."
metrics:
  duration: "~4 min"
  completed: "2026-06-27"
  tasks_completed: "3 / 3 (Task 1 operator-cleared gate, Task 2 deletion, Task 3 regression)"
  files_changed: 1
---

# Phase 128 Plan 06: CTC-03 StickyTimerBar Deletion Summary

Removed the redundant sticky elapsed timer above the composer (the Phase 076.1 D-03 `StickyTimerBar` in `ChatArea.tsx`) — a pure-subtraction, net-zero-wire cleanup (CTC-03 / sketch 049-A / D-02) that reclaims chat-area vertical space now that the unified tool card (proven uniform in Plan 05) and the floating "↓ Jump to live" chip make the third elapsed surface superfluous. The two honest status homes — the header `RunStatusStrip` (in-view, home #1) and the `MessageList` floating "↓ Jump to live" chip (scroll-away, home #2) — are left fully intact. This is the LAST plan of Phase 128 (D-07), executed on the operator's explicit approval of the Plan 05 PARTIAL-PASS scoreboard verdict.

## What Was Done

**Task 1 — D-07 sequencing gate (`checkpoint:human-verify`) — operator-cleared, not re-prompted.**
Per the plan's D-07 gate, the CTC-03 deletion may only proceed once the Plan 05 D-06 live cross-provider scoreboard is satisfied. `128-VALIDATION.md` records the verdict (executed 2026-06-27, operator-driven): **PARTIAL PASS** — CTC-01/CTC-02 per-provider logo + the unified tool card were verified LIVE per provider/model and confirmed legible-and-good in BOTH light and dark themes (this live observation drove the white-chip contrast fix `214d24d0`); the `providerLogo` / `preparingDescription` / `RunCard.logo` / `MessageItem.clamp` unit suites all pass and `vite build` is clean. The **full native-7 + OpenRouter exhaustive 4-axis sweep was DEFERRED** (operator hardware can't run a local model large enough to drive tool cards; the cloud exhaustive sweep was deferred to keep the phase closeable) — recorded honestly, not counted as a green, with a re-open trigger (any reported cross-provider tool-card regression → run the full scoreboard first). `128-VALIDATION.md` L102 explicitly states the StickyTimerBar deletion proceeds on the operator's explicit approval with this PARTIAL verdict recorded. The gate is therefore **resolved/approved**; per the execution objective it was NOT re-prompted.

**Task 2 — Deleted the StickyTimerBar (def + mount + orphaned imports).** Three planned deletions plus two compiler-mandated orphaned-import removals (see Deviations):
1. The StickyTimerBar **mount** — the `{isStreaming && (() => { … <StickyTimerBar message={activeMsg} /> … })()}` IIFE block that sat between `MessageList` and `{inputBar}`.
2. The entire `function StickyTimerBar({ message }: { message: Message }) { … }` **definition** (the trailing ~53-line subcomponent).
3. The now-orphaned `import { toolLabel } from "@/lib/toolMeta"` line (DELETE TARGET 3 — `toolLabel`'s only consumer was StickyTimerBar).

Result: `ChatArea.tsx` went from 585 → 519 lines (`2 insertions(+), 68 deletions(-)`). `{inputBar}` renders immediately after the preserved `MessageList`; the file's `ChatArea` function closes cleanly with no trailing subcomponent.

**Task 3 — Regression check (verification only, no source change).** Ran the `src/__tests__/components/` vitest suite before and after the deletion. Both runs are identical: **2 test files failed, 22 passed; 2 tests failed, 177 passed (179 total)**. The 2 failures are pre-existing rot (`MessageItem.test.tsx` "thinking" assertion + `Plan04.frontend.test.tsx` stdout/stderr terminal-output styling) — they fail at baseline AND at HEAD, unrelated to StickyTimerBar (`project_frontend_vitest_rot`). **Rot-adjusted delta = 0 new failures.**

## Verification Evidence

| Acceptance criterion | Result |
|---|---|
| `grep -c StickyTimerBar src/components/chat/ChatArea.tsx == 0` | ✅ 0 (def + mount gone) |
| `grep -c toolLabel src/components/chat/ChatArea.tsx == 0` | ✅ 0 (import removed) |
| ChatArea.tsx introduces NO NEW tsc error (no orphaned-import / no-unused-vars) | ✅ `tsc -b --noEmit` shows ZERO `ChatArea.tsx(...)` source errors after the Loader2 + Message removals (the TS6133/TS6196 errors the bare 3-delete created are resolved) |
| Surviving status homes intact | ✅ `RunStatusStrip` still in RunCard.tsx (4 refs); `showJumpToLive` floating "↓ Jump to live" chip still in MessageList.tsx (3 refs, the home #2 mount ChatArea preserves) |
| `{inputBar}` preserved immediately after MessageList | ✅ ChatArea.tsx:516 |
| No file other than ChatArea.tsx modified (threads.py untouched — G-5) | ✅ `git diff --stat` lists only ChatArea.tsx; `git status` clean for threads.py |
| chat-surface vitest: no NEW failures vs baseline (rot-adjusted) | ✅ 2 failed / 177 passed both before and after (delta 0) |

> Note on `showJumpToLive`: the verify-notes asked for `grep -c showJumpToLive ChatArea.tsx >= 1`, but `showJumpToLive` is DEFINED inside `MessageList.tsx` (the floating-chip owner — PATTERNS §ChatArea.tsx MOD L93), not in ChatArea.tsx. ChatArea preserves the chip by keeping the `MessageList` mount untouched. The load-bearing D-02 requirement — the floating chip survives — is satisfied (verified in MessageList.tsx, 3 refs). `grep -c showJumpToLive ChatArea.tsx` is correctly 0 because ChatArea never named that symbol (the deleted StickyTimerBar didn't use it either).

> Note on absolute tsc: per the verify-notes, the project carries ~29 PRE-EXISTING tsc errors in unrelated files (SEED-056), so a full `tsc -b` is red at baseline. The 4 `ChatAreaMode.test.tsx` TS2322 errors observed are pre-existing test-fixture `Props`-shape rot (a `__tests__` file), not introduced by this deletion. The acceptance bar — ChatArea.tsx adds NO NEW error — is met.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Removed two additional orphaned imports the deletion created (`Loader2` + the `Message` type)**
- **Found during:** Task 2 (post-deletion import audit + `tsc -b` check).
- **Issue:** The plan's PRESERVE list said "ONLY the toolLabel import line goes" and to keep `Loader2` (lucide-react) and `Message` (`@/types`) because they "remain used elsewhere." After deleting StickyTimerBar, that assumption was empirically false: StickyTimerBar's spinner (`<Loader2 .../>` at the old :571) and its param type (`{ message }: { message: Message }`) were the **only** consumers of those two imports in this file. The real TypeScript compiler confirmed it — the bare 3-delete produced `ChatArea.tsx(20,23): error TS6196: 'Message' is declared but never used.` and `ChatArea.tsx(21,32): error TS6133: 'Loader2' is declared but its value is never read.` This is the exact Pitfall 4 / T-128-06-02 family the plan deletes `toolLabel` to avoid.
- **Fix:** Trimmed `Message` from the `@/types` import (kept `Folder`, `Thread` — both still used) and `Loader2` from the lucide-react import (kept `FolderIcon`, `Menu`, `Sparkles` — all still used). Re-ran `tsc -b --noEmit`: ChatArea.tsx is now error-clean. The plan's PRESERVE instruction itself mandated "verify each is still referenced elsewhere before concluding," which this honors; the higher-priority acceptance gate ("NO NEW tsc error") required it.
- **Files modified:** `frontend/src/components/chat/ChatArea.tsx` (the same single file; same commit).
- **Commit:** (this plan's Task-2 commit).

## Known Stubs

None. This is a pure deletion of a redundant render surface; no placeholder, empty-value, or unwired-data path was introduced. The two canonical status homes (RunStatusStrip + the floating chip) are pre-existing, fully-wired surfaces left untouched.

## Threat Flags

None. CTC-03 is a pure frontend subtraction — no new network endpoint, auth path, file-access pattern, or schema change. The threat register's two items are both mitigated: T-128-06-01 (lost run-status visibility) by the D-07 gate + the two preserved status homes; T-128-06-02 (build break from orphaned imports) by the `tsc -b`-clean import trim above (which removed not just `toolLabel` but also the two further orphans the deletion exposed).

## Self-Check: PASSED

- FOUND: `frontend/src/components/chat/ChatArea.tsx` (present, StickyTimerBar removed)
- FOUND: commit `7e20b4dc` (refactor(128-06): delete redundant StickyTimerBar)
- FOUND: `.planning/phases/128-chat-tool-card-unification-chat-area-reclaim/128-06-SUMMARY.md`
- No whole-file deletions in the commit (intra-file removal, as expected)
- `grep -c StickyTimerBar ChatArea.tsx` = 0 · `grep -c toolLabel ChatArea.tsx` = 0 · ChatArea.tsx tsc source-clean · chat-surface vitest rot-adjusted delta = 0 · threads.py untouched
