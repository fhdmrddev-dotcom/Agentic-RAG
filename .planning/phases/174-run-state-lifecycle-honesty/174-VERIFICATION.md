---
phase: 174-run-state-lifecycle-honesty
verified: 2026-07-22T14:24:45Z
status: human_needed
score: 9/9 code-level must-haves verified (1 additional SC#10 live-UAT truth requires human testing)
overrides_applied: 0
human_verification:
  - test: "DeepSeek early-cancel → full cold reload keeps 'cancelled — no output yet'"
    expected: "Stream DeepSeek, Stop ~5-7s in (before first token), nav away+back, then a full browser reload → the empty-content row still shows the 'cancelled — no output yet' affordance, never a blank avatar-only bubble."
    why_human: "Requires a live DeepSeek stream + precisely-timed early cancel + a real browser reload — cannot be simulated by grep/unit test."
  - test: "Workflows kill-switch 403 → amber 'disabled by the administrator' bubble, composer unlocked"
    expected: "Control Plane → Workflows kill-switch OFF; launch a published workflow from chat → an amber bubble carrying the server's verbatim ApiError.message renders in place of a blank workflow card, and the composer remains usable (not locked)."
    why_human: "Requires the operator kill-switch toggle + a live workflow launch attempt against the running backend."
  - test: "Reasoning-heavy model shows 'Reasoning…' during the pre-first-token gap"
    expected: "A Kimi/Moonshot, DeepSeek, or GLM long-reasoning prompt shows 'Reasoning…' instead of 'Setting up agent…' while reasoning tokens stream before the first visible answer token; Claude/Gemini keep 'Setting up agent…' (by design — they never emit reasoning_delta)."
    why_human: "Requires a live reasoning-heavy provider stream; the render-derive is unit-proven but the cross-provider signal timing needs a real stream."
  - test: "Multi-minute streaming workflow → nav away and back → timer keeps climbing (no reset), exactly one avatar"
    expected: "Launch a long-running workflow, navigate away for several minutes, navigate back → the elapsed timer reflects real elapsed time (not reset to seconds) and exactly one assistant avatar renders, on both a fast (OpenAI) and a slow (Google/OpenRouter) provider."
    why_human: "Requires a real multi-minute workflow run + actual browser navigation timing — cannot be simulated by a component test."
  - test: "Parallel-thread isolation: Thread A blocked (403 amber) while Thread B keeps its own composer/timer/avatar state"
    expected: "With Thread A mid-blocked-workflow, Thread B (a Deep chat) is unaffected — no cross-thread lock leak, no cross-thread avatar/timer bleed."
    why_human: "Requires two live browser tabs/threads streaming concurrently — outside static analysis reach."
  - test: "Long-message axis: ≥50-message thread, mid-stream Stop, cold reload per provider — STATE-02 reload-derive holds at scale"
    expected: "On a thread with ≥50 prior messages (or a ≥5KB prompt), stop mid-stream and cold-reload → 'Response stopped' still renders, keyed off runStatus, same as the short-thread case."
    why_human: "Requires a long-lived seeded thread and live provider streaming — SC#10 mandated axis, not reachable by unit/component tests."
---

# Phase 174: Run-State & Lifecycle Honesty Verification Report

**Phase Goal:** Every run's lifecycle (setting up → streaming → stop/cancel/kill → navigation) is honestly reflected in the chat surface — no empty bubbles (STATE-01a), no blank killed-workflow card (STATE-01b), no lost stop indicators across nav+reload (STATE-02), no hidden setup activity (STATE-03), no timer/avatar glitches on nav (STATE-04) — verified across providers with Deep Mode byte-identical.

**Verified:** 2026-07-22T14:24:45Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All code-level must-haves are VERIFIED against live source (not SUMMARY claims) and the full touched-file + full-suite vitest runs were executed live in this session (not trusted from SUMMARY narration). The one remaining gap is the mandated SC#10 4-axis live cross-provider UAT (174-VALIDATION.md), which is explicitly a live-operator/real-provider activity that cannot be automated — its absence routes this report to `human_needed`, not `passed` and not `gaps_found` (there is no code gap).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | STATE-01a: empty-content assistant row with `runStatus='cancelled'` renders `cancelled-no-output` affordance, never an empty avatar-only bubble | ✓ VERIFIED | `MessageItem.tsx:651-667` (`data-testid="cancelled-no-output"`, verbatim "cancelled — no output yet"); locked by 6 new component tests in `MessageItem.test.tsx` (174-02) — live-ran, 31 passing incl. the 6 new cases |
| 2 | STATE-01b: workflows kill-switch 403 renders honest in-chat amber bubble carrying the server's `ApiError.message`, composer never left locked | ✓ VERIFIED | `StreamsProvider.tsx:2080-2101` (`err.status === 403` branch, `blockedNotice` stamp + `clearWorkflowLockForThread(threadId)`); `MessageItem.tsx:485-493` (amber block, verbatim `model-fallback-notice` classes, React-text-only render); `MessageItem.blockedNotice.test.tsx` (4/4) + `streamsProvider_state01b_403.test.tsx` (3/3) — live-ran, green |
| 3 | STATE-02: stopped/cancelled-with-content run renders "Response stopped" derived from `message.runStatus`, surviving nav-away-and-back AND a full cold reload | ✓ VERIFIED | `MessageItem.tsx:693-702` (render keyed on `runStatus`, not the live-only `stopped` flag); reload-derive chain confirmed intact: `backend/app/api/threads.py:353` (`m["run_status"] = run["status"]`, keyed on `message_id`, DB-backed) → `frontend/src/lib/api.ts:198` (`runStatus: run_status ?? undefined`); `git diff` on both files = clean (no reserve fix fired, matches D-03 prediction) |
| 4 | STATE-03: pre-first-token window shows "Reasoning…" for a reasoning-streaming model instead of "Setting up agent…" | ✓ VERIFIED | `toolMeta.ts:68-92` (`reasoningActive` additive param, branch inside `!hasAnyTools && !isPlanning`); `MessageItem.tsx:644` (`reasoningActive` derived as `!message.content && !!message.reasoningContent`, passed as 5th arg); `toolMeta.test.ts` — live-ran, 5/5 green |
| 5 | STATE-04 (timer): kickoff placeholder stamped with `startedAt` so the run-strip timer keeps climbing on nav-back instead of reseeding from mount | ✓ VERIFIED | `StreamsProvider.tsx:1875` (`startedAt: new Date().toISOString()` additive on the kickoff `assistantId` branch); `RunCard.tsx:122` consumer (`runStartMs = startedAt ?? created_at`) confirmed UNEDITED (`git diff --stat` empty for `RunCard.tsx`/`RunStatusStrip.tsx`); `RunCard.timer.test.tsx` new case (g) — live-ran, green |
| 6 | STATE-04 (avatar): exactly one assistant avatar renders including the pre-runId double-mount window, WITHOUT erasing the STATE-01b amber/failed-send temp rows | ✓ VERIFIED | `dedupMessages.ts:52-97` (`isCollapsiblePreRunPlaceholder` excludes `blockedNotice` and `runStatus==='failed'` rows; collapse only fires for ADJACENT temp/no-runId rows with no intervening user row); `dedupMessages.test.ts`, `MessageList.dedup.test.tsx`, `streamsProvider_075_7_reconcile_race.test.tsx` — live-ran, green (incl. the mandatory amber/failed-survives regression case) |
| 7 | Deep Mode byte-identical (D-14): no shared-path fork across all 4 plans | ✓ VERIFIED | `outerBannerLabel(null,false,false,false,false)` still returns "Setting up agent…" (locked by test); `git diff` on `StreamsProvider.tsx` shows the 409/400/network catch branches with 0 deletions; `RunCard.tsx`/`RunStatusStrip.tsx` diff-clean; no backend or migration file touched (`git diff --stat` empty for `backend/` and `supabase/migrations/` across the full phase range) |
| 8 | Code review clean (0 blocker/high/medium defects) | ✓ VERIFIED | `174-REVIEW.md`: 0 critical/warning, 4 info (all accepted-as-is or optional tidiness, no fix required); deep cross-file trace of dedup adjacency, 403 catch ordering, byte-identical guards all confirmed PASS |
| 9 | Zero net-new test failures (differential vs SEED-056 rot baseline) | ✓ VERIFIED | Live full-suite run this session: 24 failed / 1791 passed (1815 total) — the 24 failures are the documented pre-existing rot (model-info costTier, PublishGauntlet, soulData glyphs, useMessages switch-back, IngestionPage heading/layout, `MessageItem.test.tsx` thinking-indicator, `StreamsProvider.dedup.test.ts` D-075.2-01/04, several Phase-068 `streamsProvider.test.tsx` rows, Plan04 terminal styling) — none reference the phase-174 touched files/functions (`toolMeta.ts`, `dedupMessagesByRunId`, the 403 branch, the `startedAt` stamp); failure COUNT matches the phase's own documented HEAD baseline (24) |
| 10 | SC#10 4-axis live cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message) passes with Deep Mode byte-identical | ? UNCERTAIN (human_needed) | Authored in `174-VALIDATION.md` ("SC#10 4-Axis Live UAT Matrix", "Manual-Only Verifications" — 5 rows), explicitly requiring a live operator + real provider streams (DeepSeek early-cancel timing, kill-switch toggle, reasoning-heavy models, multi-minute workflow navigation, ≥50-message thread). Not run in this verification pass — cannot be automated. |

**Score:** 9/9 code-level truths VERIFIED · 1/1 SC#10 live-UAT truth routes to human verification (not a code gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/toolMeta.ts` | `outerBannerLabel` gains additive `reasoningActive=false` param + "Reasoning…" branch | ✓ VERIFIED | Confirmed at lines 68-92; default byte-identical, branch scoped to `!hasAnyTools && !isPlanning` arm only |
| `frontend/src/components/chat/MessageItem.tsx` | :644 call site derives `reasoningActive`; new `blocked-notice` amber render block; existing cancelled-no-output/Response-stopped renders unchanged | ✓ VERIFIED | All three confirmed live in source; STATE-01a/02 renders untouched (VERIFY-only plan, D-01) |
| `frontend/src/lib/__tests__/toolMeta.test.ts` | D-14 byte-identical guard + reasoningActive/isHarness/isPlanning assertions | ✓ VERIFIED | Exists, imports `outerBannerLabel`, live-ran 5/5 green |
| `frontend/src/__tests__/components/MessageItem.test.tsx` | Extended with STATE-01a/02 render-invariant lock (6 new cases) | ✓ VERIFIED | +96 lines confirmed via `git diff --stat`; live-ran, 6 new cases pass (1 pre-existing unrelated rot elsewhere in the file) |
| `frontend/src/types/index.ts` | `blockedNotice?: { message: string }` render-only field | ✓ VERIFIED | Confirmed at line 213 |
| `frontend/src/components/chat/__tests__/MessageItem.blockedNotice.test.tsx` | Component render test for the amber blocked-notice block | ✓ VERIFIED | Exists, live-ran 4/4 green |
| `frontend/src/providers/StreamsProvider.tsx` | New `err.status===403` catch branch (placeholder-swap + lock-clear); `startedAt` stamp on kickoff placeholder | ✓ VERIFIED | Both confirmed at lines 2080-2101 and 1875 respectively; `git diff` = 33 insertions, byte-identical elsewhere |
| `frontend/src/__tests__/providers/streamsProvider_state01b_403.test.tsx` | Catch test — 403 sets blockedNotice + clears lock; 400/409 unchanged | ✓ VERIFIED | Exists, live-ran 3/3 green |
| `frontend/src/lib/dedupMessages.ts` | Scoped same-send pre-runId collapse, excluding amber/failed rows | ✓ VERIFIED | Confirmed at lines 52-97 (`isCollapsiblePreRunPlaceholder`) |
| `frontend/src/lib/__tests__/dedupMessages.test.ts` | Extended dedup tests incl. mandatory amber/failed-survives regression | ✓ VERIFIED | +83 lines confirmed; live-ran green |
| `frontend/src/components/chat/RunCard.timer.test.tsx` | New timer-anchor test (g) for the `startedAt` nav-back derivation | ✓ VERIFIED | Exists (+33 lines); live-ran green as part of `RunCard` suite |
| `frontend/src/components/chat/RunStatusStrip.tsx` (conditional) | Edited ONLY if a separate strip owns the workflow timer | ✓ VERIFIED (correctly untouched) | `git diff --stat` confirms zero changes — the PRIMARY RunCard-only path fired, per SUMMARY's Wave-0 confirmation, matching the plan's explicit conditional contract |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `MessageItem.tsx` | `outerBannerLabel` | `reasoningActive` 5th arg | ✓ WIRED | `MessageItem.tsx:644` passes `!message.content && !!message.reasoningContent` as the 5th positional arg |
| `message.reasoningContent` | `reasoningActive` | pre-content derive | ✓ WIRED | Same line; gated so it never fires once `message.content` is truthy |
| `StreamsProvider.sendMessage` catch | assistant placeholder `blockedNotice` | `err.status===403` branch | ✓ WIRED | `StreamsProvider.tsx:2094` maps the `assistantId` row; user bubble kept (not filtered) |
| `StreamsProvider` 403 branch | `clearWorkflowLockForThread` | owning `threadId` closure | ✓ WIRED | `StreamsProvider.tsx:2101` calls the existing store action with the correct per-thread closure |
| `message.blockedNotice` | amber notice render | `blocked-notice` block | ✓ WIRED | `MessageItem.tsx:485-493` renders `message.blockedNotice.message` as React text |
| `message.runStatus` | `cancelled-no-output` affordance | `MessageItem.tsx:651` empty-content branch | ✓ WIRED | Confirmed; mutual-exclusion with the "Response stopped" indicator proven under test |
| `message.runStatus` | "Response stopped" indicator | `MessageItem.tsx:693-702` reload-derived render | ✓ WIRED | Confirmed; gates on `!isStreaming` (terminal marker, survives reload since `runStatus` — not the live-only `stopped` flag — drives it) |
| `StreamsProvider` kickoff placeholder | RunCard timer | `startedAt` stamp consumed by `runStartMs = startedAt ?? created_at` | ✓ WIRED | `StreamsProvider.tsx:1875` stamps; `RunCard.tsx:122` (unedited, pre-existing 095.1 consumer) reads it |
| `MessageList` | `dedupMessagesByRunId` | dedup seam collapsing only the same-send pre-runId twin | ✓ WIRED | `MessageList.tsx:161` calls it; `MessageList.tsx:180` key (`run-${runId} ?? id`) unchanged, as required |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `MessageItem.tsx` (STATE-02 stop indicator) | `message.runStatus` | `backend/app/api/threads.py:353` — DB-backed zip of `runs.status` keyed on `message_id` (not a static/empty return) → `frontend/src/lib/api.ts:198` maps `run_status → runStatus` on every `getMessages`/snapshot hydrate | Yes — live DB query, not a static fallback | ✓ FLOWING |
| `MessageItem.tsx` (STATE-01a affordance) | `message.runStatus === "cancelled"` | Same reload-derive chain as above; the zip is keyed on the message's own `message_id`, so an empty (`content_len=0`) early-cancel row still resolves `run_status='cancelled'` | Yes | ✓ FLOWING |
| `RunCard.tsx` (STATE-04 timer) | `message.startedAt` | Client-stamped at kickoff (`StreamsProvider.tsx:1875`), corrected on next hydrate by the persisted `runs.started_at` enrich (`api.ts started_at→startedAt`) | Yes — additive client anchor, self-correcting from DB on next fetch (documented in code review IN-02, accepted) | ✓ FLOWING |
| `MessageItem.tsx` (STATE-03 label) | `message.reasoningContent` | `StreamsProvider.tsx` `onReasoningDelta` accumulates cross-provider `reasoning_delta` SSE events (already-shipped signal, no new backend event) | Yes — live SSE-sourced content | ✓ FLOWING |

### Behavioral Spot-Checks

This is a frontend render-layer phase with no runnable backend entry points to curl (D-14: no new endpoint, no migration). The equivalent live spot-check is running the actual touched-file test suites in this verification session (not trusting SUMMARY-reported pass counts):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| STATE-01a/01b/03/04 unit+component suites | `npx vitest run toolMeta.test.ts MessageItem.blockedNotice.test.tsx streamsProvider_state01b_403.test.tsx dedupMessages.test.ts RunCard.timer.test.tsx` | 5 files / 32 tests passed | ✓ PASS |
| STATE-01a/02 extended MessageItem + blockedNotice + dedup/reconcile-race + RunCard suites | `npx vitest run MessageItem.test.tsx MessageItem.blockedNotice.test.tsx MessageList.dedup streamsProvider_075_7_reconcile_race RunCard` | 8/9 files passed, 94/95 tests passed (the 1 failure is the documented pre-existing SEED-056 "thinking indicator" rot, identical at baseline) | ✓ PASS (differential) |
| Full frontend suite differential (no net-new failures) | `npx vitest run` (full suite) | 24 failed / 1791 passed (1815 total) — failure count matches the phase's documented HEAD baseline (24); no phase-174 file/function appears among the failures | ✓ PASS (differential) |
| No backend/migration edits | `git diff --stat c732f015 HEAD -- backend/ supabase/migrations/` | empty output | ✓ PASS |

### Probe Execution

SKIPPED — no `scripts/*/tests/probe-*.sh` declared or conventional for this phase (frontend render-layer bug-fix phase, not a migration/tooling phase). No probe references found in PLAN/SUMMARY files.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| STATE-01 | 174-02 (STATE-01a), 174-03 (STATE-01b) | Cancelled/killed run never leaves an empty bubble or orphaned card | ✓ SATISFIED | Truths #1, #2 above |
| STATE-02 | 174-02 | "Response stopped" survives nav-away-and-back AND full reload | ✓ SATISFIED (code-level); SC#10 live cold-reload UAT still owed | Truth #3 above; REQUIREMENTS.md checkbox is stale — see note below |
| STATE-03 | 174-01 | "Setting up agent…" no longer hides live model activity | ✓ SATISFIED | Truth #4 above |
| STATE-04 | 174-04 | Run timers/avatars stay accurate across navigation | ✓ SATISFIED | Truths #5, #6 above |

**Note on REQUIREMENTS.md staleness (not a code gap):** `.planning/REQUIREMENTS.md` line 19 still shows `- [ ] **STATE-02**` (unchecked) and the traceability table (line 110) shows `STATE-02 | Phase 174 | Pending`, while STATE-01/03/04 are checked/"Complete". This predates phase 174's execution (the requirements file was last touched at milestone-definition, commit `30d91051`, before any 174 plan ran) and was never synced afterward. The code-level evidence for STATE-02 (reload-derive chain + 6 new component tests, confirmed live in this session) is as solid as STATE-01/03/04's. This is a documentation-sync task for the orchestrator, not a phase defect — flagged so `/gsd:complete-milestone` or the next requirements sync doesn't miss it.

No requirements were found mapped to Phase 174 in REQUIREMENTS.md that are absent from the plans' `requirements:` frontmatter (no ORPHANED requirements).

### Anti-Patterns Found

None. Scanned all 5 phase-touched production files (`toolMeta.ts`, `MessageItem.tsx`, `StreamsProvider.tsx`, `dedupMessages.ts`, `types/index.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, empty-return stubs, and `dangerouslySetInnerHTML` — zero matches (the only substring hits were `EMPTY_TODOS`/`todosByThread`, unrelated pre-existing variable names, not debt markers). The `blockedNotice` server string renders as React text children only, confirmed at `MessageItem.tsx:491`.

### Human Verification Required

The SC#10 4-axis live cross-provider UAT mandate (authored in `174-VALIDATION.md`) requires a live operator against real provider streams and cannot be automated. Six items, harvested from `174-VALIDATION.md`'s "Manual-Only Verifications" table and the SC#10 parallel-thread axis:

### 1. DeepSeek early-cancel → full cold reload

**Test:** Stream DeepSeek, click Stop ~5-7s in (before the first visible token), navigate away and back, then perform a full browser reload.
**Expected:** The empty-content row still shows "cancelled — no output yet" — never a blank avatar-only bubble.
**Why human:** Needs a live DeepSeek stream with precisely-timed early cancellation and a real browser reload; the render condition and reload-derive chain are code-verified, but the live end-to-end timing (early-cancel race, actual reload) needs a human.

### 2. Workflows kill-switch 403 → amber bubble, composer unlocked

**Test:** Control Plane → Workflows kill-switch OFF; launch a published workflow from chat.
**Expected:** An amber bubble renders the server's verbatim "disabled by the administrator" message instead of a blank workflow card; the composer remains usable (not locked).
**Why human:** Needs the operator kill-switch toggle and a live workflow launch against the running backend.

### 3. Reasoning-heavy model shows "Reasoning…"

**Test:** Send a long-reasoning prompt to Kimi/Moonshot, DeepSeek, or GLM.
**Expected:** "Reasoning…" renders during the pre-first-token gap (instead of "Setting up agent…"); Claude/Gemini keep "Setting up agent…" by design.
**Why human:** Needs a live reasoning-heavy provider stream to observe the signal timing in practice.

### 4. Multi-minute workflow timer + single avatar on nav-back

**Test:** Launch a long-running workflow, navigate away for several minutes, navigate back — on both a fast (OpenAI) and a slow (Google/OpenRouter) provider.
**Expected:** The elapsed timer reflects real elapsed time (no reset to seconds); exactly one assistant avatar renders.
**Why human:** Needs a real multi-minute workflow run and actual navigation timing.

### 5. Parallel-thread isolation

**Test:** Thread A mid-blocked-workflow (403 amber) while Thread B runs a Deep chat concurrently.
**Expected:** No cross-thread lock leak (Thread B's composer stays usable); no cross-thread avatar/timer bleed.
**Why human:** Requires two live concurrent browser threads/tabs — outside static analysis reach.

### 6. Long-message axis — STATE-02 at scale

**Test:** On a thread with ≥50 prior messages (or a ≥5KB prompt), stop mid-stream and perform a full cold reload, per provider.
**Expected:** "Response stopped" still renders, keyed off `runStatus`, matching the short-thread behavior.
**Why human:** SC#10-mandated long-message axis; requires a seeded long-lived thread and live provider streaming.

### Gaps Summary

No code-level gaps found. All 4 requirement IDs (STATE-01, STATE-02, STATE-03, STATE-04) have live, tested, wired implementations confirmed directly against source in this session (not trusted from SUMMARY.md narration): the render conditions exist, the reload-derive DB chain is intact, the 403 catch branch is correctly scoped, the reasoning-derive is correctly gated, and the timer/avatar fixes are correctly scoped to avoid erasing the STATE-01b amber row. Deep Mode byte-identical is held (confirmed via git diff showing 0 deletions in existing branches, and no backend/migration edits across the whole phase). The full-suite differential shows zero net-new test failures (24 failed both before and after, all pre-existing SEED-056 rot unrelated to the touched files/functions).

The phase cannot honestly report `passed` because the roadmap's own Success Criteria #5 ("All four hold across providers, multi-tool prompts, parallel threads, and long histories with Deep Mode byte-identical — SC#10") mandates a live cross-provider UAT matrix that is explicitly deferred to `/gsd:verify-work` in every plan's `<verification>` section and is not reachable by static/unit verification. This routes the report to `human_needed` per the decision tree (a non-empty human-verification section takes priority over an otherwise-clean code-level pass).

---

_Verified: 2026-07-22T14:24:45Z_
_Verifier: Claude (gsd-verifier)_
