# Phase 095: Chat Tool-Card Unification - Research

**Researched:** 2026-06-05
**Domain:** React 18 chat-surface render/reducer (frontend) + one contained FastAPI/sandbox backend touch
**Confidence:** HIGH (all claims `[VERIFIED: codebase]` against the actual .tsx/.py — no provider-doc dependency for this phase)

> **Scope reminder:** the design contract is LOCKED by 3 operator-approved sketches (G-2 satisfied). This research does NOT redesign. It confirms the UNVERIFIED root causes and exact code sites so the planner can write anchored tasks. The CONTEXT deferred 7 questions to research; those ARE the assignment. Where a CONTEXT/grounding-brief assumption is WRONG against the real code, the correction is the highest-value output — see **§Corrections to CONTEXT Assumptions**.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-08 — research THESE, no alternatives)
- **D-01 — Resting state = one-line essence, one consistent frame.** Finished tool card folds to a single calm line (icon + tool + key result), expand-on-click. SAME outer frame + inner-body for every tool type. Direction = `sketch-findings-agentic-rag` Focus Mode. Details re-ranked, never hidden.
- **D-02 — Focus Mode during a live run.** Only the step running NOW is expanded/live; finished steps auto-fold to D-01 summary; next step opens.
- **D-03 — Smart auto-scroll (follow-but-release).** Stick to newest while at/near bottom; stop on scroll-up; re-arm at bottom; "↓ Jump to live" affordance. (BUG-260529-02 #1.)
- **D-04 — One visible action = one step.** "Step N" = number of tool cards on screen. Timer strip + panel header read the SAME source. (Closes BUG-260528-02.) Today RunCard counts `iteration_start`, panel counted tool starts — unify onto the action/tool-card count.
- **D-05 — Zero duplicates, ever (root fix, cross-provider).** ONE stable identity from first streamed event; no "self-heals in 10-15s." Must hold across all 6 native providers and fix the read/summarize sub-agent double-render (BUG-260529-02 #3), which may be distinct from the 075.2 transient id-instability flicker (BUG-260521-01) — **research confirms which.**
- **D-06 — Persistent run-status strip = time + step + activity.** Stays visible from kickoff until the run TRULY ends. Elapsed from a stable start timestamp, rendered continuously — immune to dropped SSE, background-tab throttling, temp-id→DB-id remounts. (Closes BUG-260528-01; do NOT regress the 083 temp-id-remount fix BUG-260526-04.)
- **D-07 — Re-rank, don't hide + hero the intended output.** Show ALL generated files, all reliably downloadable; final intended output(s) are the hero, intermediates are secondary. The AGENT marks the final deliverable (small backend signal).
- **D-08 — 095 carries one small, contained backend touch (narrows SC#4).** Permitted: (a) agent tagging its final output file(s) in the final-outputs payload; (b) re-signing/refreshing a download link ONLY IF research proves the dead-link root is server-side signed-URL expiry. Constraint: must NOT regress PANEL-06 isolation or the StreamsProvider per-thread demux. **Investigate-first** — confirm the dead-link root before changing backend code.

### Claude's Discretion
- Component file layout, hook shape, the exact stable-key scheme for D-05, the precise elapsed-time derivation for D-06, and how "hero vs working files" renders.
- Icon/copy per tool type for the D-01 essence line (reuse existing icons/labels).

### Deferred Ideas (OUT OF SCOPE — ignore)
- Orphaned ask_user 404 (BUG-260605-01 — routed OUT of 095).
- Per-phase tool/search COUNT chips from the sub-agent stream (SEED-053).
- Generated files rendered IN THE PANEL (SEED-037/038 — 095 is the CHAT side only).
- Composer 2-pill redesign + Workflows page (v2.9 / SEED-051).
- Relocating Deep tool-cards into the panel (dropped at 094 D-01 — cards STAY in chat).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-04 | Chat tool-cards render in one consistent frame with auto-scroll, details-on-demand collapse, no duplicates, timer/step-count consistency, working download. | The §Verified Anchor Table + the D-01..D-08 root-cause findings below give the planner concrete sites for every clause. The frame/collapse already largely exists (RunCard + ToolCallPanel Focus Mode); the gaps are the 5 root fixes (D-03/D-04/D-05/D-06) + the D-07 hero split + the D-08 final-output tag. |
</phase_requirements>

## Summary

The chat tool-card surface is far MORE built than the CONTEXT/grounding brief imply. The 075.x refactor (esp. 075.7/075.8/075.9) already delivered: a single `RunFrame` (`RunCard.tsx`), a body-only `ToolCallPanel`, Focus-Mode collapse-at-3+, a stable `clientKey`/`makeToolKey` dedup stamp for regular tools, a 60s-TTL re-signing download endpoint, and a final-outputs panel. **095 is a small set of targeted root fixes + a hero/working render split + a one-field backend tag, NOT a rebuild.** The "Used N tools" panel header the grounding brief references no longer exists (Bug D removed it at 075.7 — RunCard owns all chrome).

The two highest-value corrections: (1) **D-08's dead-link root is NOT signed-URL expiry** — the design already re-signs on every click via `/sandbox-outputs/{path}` (60s TTL, indefinite life). The real dead-link roots are *files arriving without a `url` field* and *reconcile swapping streaming state for DB state*. So the D-08 backend touch should be the agent-tags-the-hero field, **not** a re-sign change. (2) **D-05's sub-agent double-render is a SEPARATE root** from the 075.2 transient-id flicker — the legacy `analyze_document` path writes to a single-slot `message.sub_agent` with NO `clientKey` stamp, AND the same logical task ALSO lands in `tool_calls` (with `tc.sub_agent` populated at terminal). The dual render source `tc.sub_agent ?? subAgent` is the mechanism.

**Primary recommendation:** Build the SKETCH-CONSISTENCY §1 inventory by EXTENDING existing components (RunCard, ToolCallPanel, OutputFileCard) — only `useFollowScroll`/`JumpToLive` and the hero/working split are genuinely new. Make D-04/D-06/D-05 changes in StreamsProvider's `makeStreamCallbacks` factory ADDITIVELY, never altering the shared `onDelta`/terminal Deep paths for working providers. The D-08 backend touch is a single additive field on the `final_output_files` payload.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool-card frame + collapse + Focus Mode (D-01/D-02) | Browser/Client (React render) | — | Pure presentation over `message.tool_calls`; already in RunCard + ToolCallPanel |
| Follow-but-release scroll (D-03) | Browser/Client (scroll controller) | — | DOM scroll discipline; lives in MessageList over the Radix ScrollArea viewport |
| Unified step count (D-04) | Browser/Client (derivation) | — | Both counters derive from existing `message.tool_calls` / `iterationCount` — a render-side single source, no wire change |
| Zero-duplicate identity (D-05) | Browser/Client (SSE reducer) | — | `makeStreamCallbacks` reducer in StreamsProvider stamps identity; the sub-agent slot is the gap |
| Persistent timer (D-06) | Browser/Client (timer derivation) | — | Elapsed derivation in RunCard; needs a stable wall-clock baseline, not a perf.now delta |
| Output file download (D-07/D-08 files) | API/Backend (re-sign + tag) | Browser/Client (hero/working render) | The download already re-signs server-side; the hero TAG is a backend signal, the SPLIT is a frontend render |
| Final-output hero TAG (D-08) | API/Backend (agent loop emit) | Database (persisted tool_calls) | The agent knows request intent; the tag rides the existing `final_output_files` emit + persists via execute_code result |

---

## §Verified Anchor Table (Question 6 — the single most useful artifact)

Re-derived against the ACTUAL files on `v2.5-dev` 2026-06-05. **Use these for `read_first` / `action` fields.** Where the CONTEXT/grounding candidate line was wrong, the correction is noted.

| Decision | File | Verified line(s) | What's there |
|---|---|---|---|
| D-01/D-02/D-06 frame + collapse model | `frontend/src/components/chat/RunCard.tsx` | 47-73 | `hasTools`, `isStreamingNow`, `isTerminal`, `userExpanded` state, `expanded = isStreamingNow \|\| !hasTools \|\| userExpanded` (L73) |
| D-06 timer derivation (ROOT) | `frontend/src/components/chat/RunCard.tsx` | 83-96 | `startedAtRef = performance.now()` once (L89); 250ms `setInterval`; clears when `!isStreamingNow` |
| D-06 timer render GATE (ROOT — vanish trap) | `frontend/src/components/chat/RunCard.tsx` | 192-199 | `{(isStreamingNow \|\| elapsedMs > 0) && …}` — the exact BUG-260528-01 condition |
| D-04 RunCard step label (ROOT counter A) | `frontend/src/components/chat/RunCard.tsx` | 132-135 | `stepLabel = message.iterationCount != null ? Step ${N+1}` — counts `iteration_start` |
| D-04 RunCard collapsed-row "N tool calls" | `frontend/src/components/chat/RunCard.tsx` | 222-248 | `Run · N tool calls · ✓ done · Xs ▸` — derives `message.tool_calls?.length` (NOT deduped) |
| D-01 collapsed header copy | `frontend/src/components/chat/RunCard.tsx` | 126-130 | `Run · N tools · {glyph} {word}` header title |
| D-06 file-count badge | `frontend/src/components/chat/RunCard.tsx` | 100-110, 201-206 | `fileCount` from parsing `tc.result.output_files` |
| D-05 dedup key (3-tier) | `frontend/src/components/chat/ToolCallPanel.tsx` | 321-334 | `const key = tc.clientKey ?? tc.id ?? composite` — `deduplicatedToolCalls` useMemo. **Grounding said L328; the useMemo block is 321-334.** |
| D-04 panel count (ROOT counter B) | `frontend/src/components/chat/ToolCallPanel.tsx` | 321-336 | `deduplicatedToolCalls.length` — **the grounding's "Used N tools" header at ~line 336/350-360 NO LONGER EXISTS** (removed at 075.7 Bug D, see comment L338-345). The panel is BODY-ONLY. |
| D-05 sub-agent dual-render source (ROOT) | `frontend/src/components/chat/ToolCallPanel.tsx` | 531-532, 749-754 | `agentState = tc.sub_agent ?? subAgent` (L531-532); rendered via `SubAgentBlock` (L754); result block suppressed when `agentState` present (L749) |
| D-02 Focus-Mode collapse-at-3 | `frontend/src/components/chat/ToolCallPanel.tsx` | 391-410, 455-501 | `activeIndex`, `hiddenStepsCount >= 3`, `stepsCollapsed`, per-step summary rows |
| D-05 regular-tool clientKey stamp (preparing) | `frontend/src/providers/StreamsProvider.tsx` | 322-360 | `onToolPreparing` — `makeToolKey({messageId, name, observedAt, index})` at L336-341. **Grounding said 336-344; the stamp is 336-341, handler 322-360.** |
| D-05 regular-tool clientKey stamp (start) | `frontend/src/providers/StreamsProvider.tsx` | 397-469 | `onToolStart` — second stamp site L443-448 (providers that skip preparing) |
| D-05 sub-agent NO-stamp path (ROOT) | `frontend/src/providers/StreamsProvider.tsx` | 491-515 | `onSubAgentStart/Delta/Done` write `message.sub_agent` single-slot, NO clientKey, NO tool_calls entry. **This is the gap.** |
| D-04 iteration counter source | `frontend/src/providers/StreamsProvider.tsx` | 654-659 | `onIterationStart` sets `currentIteration` + `message.iterationCount` |
| D-07/D-08 finalOutputFiles stamp | `frontend/src/providers/StreamsProvider.tsx` | 620-624 | `onFinalOutputFiles` FULL-REPLACE `message.finalOutputFiles`. **Grounding said 620-623; it's 620-624.** |
| D-06 transient-stream-end probe | `frontend/src/providers/StreamsProvider.tsx` | 166-208 | `_isTransientStreamEnd` — the premature-done detection |
| D-06 sendMessage onTerminal (ROOT — runStatus flip) | `frontend/src/providers/StreamsProvider.tsx` | 1402-1490 | flips `runStatus` to completed/failed at L1453-1464. **Grounding said ~1457; the setMessages block is 1453-1464.** |
| D-06 reconcile onTerminal (parallel flip) | `frontend/src/providers/StreamsProvider.tsx` | 1142-1222 | mirror onTerminal for reconciled runs |
| D-06 per-thread streamingThreads write | `frontend/src/providers/StreamsProvider.tsx` | 1340-1343, 1535-1539 | authoritative streaming-end in sendMessage `finally` |
| Per-thread demux Maps (SC#10 invariant) | `frontend/src/stores/streamsStore.ts` | 80, 97, 111-151, 268-300 | `streamingThreads`, `subscriptionsByThread`, `workflowLockByThread`, panel Maps |
| D-03 scroll tracking (ROOT) | `frontend/src/components/chat/MessageList.tsx` | 23, 33-38 | `isNearBottomRef`, `handleScroll` sets `< 120` near-bottom |
| D-03 auto-scroll effect (only on new msgs) | `frontend/src/components/chat/MessageList.tsx` | 70-99 | scrolls on `newCount > prevCountRef` OR streaming+near-bottom; **no token-delta follow** |
| D-03 listener attach | `frontend/src/components/chat/MessageList.tsx` | 45-68 | useLayoutEffect attaches scroll listener to Radix viewport |
| D-07 download URL resolution | `frontend/src/components/chat/OutputFileCard.tsx` | 14-22 | `resolveOutputUrl` — `/`-prefix → `API_BASE + url`; http passes through |
| D-07 url-optional back-compat (dead-link #1) | `frontend/src/components/chat/OutputFileCard.tsx` | 72-86 | file missing `url` → plain filename, NO download affordance |
| D-07 Bearer-fetch download | `frontend/src/components/chat/OutputFileCard.tsx` | 88-107 | `downloadSandboxOutput` intercept |
| D-07 final-outputs panel render | `frontend/src/components/chat/MessageItem.tsx` | 506-527 | flat `space-y-1.5` map of `OutputFileCard`, no hero/sort |
| D-07 RunCard mount gate | `frontend/src/components/chat/MessageItem.tsx` | 305-307 | RunCard only when `tool_calls.length > 0` |
| D-07 reload reconstruct (dead-link relevance) | `frontend/src/lib/api.ts` | 111-133 | `_mapMessageResponse` rebuilds `finalOutputFiles` from persisted `tool_calls[].result.output_files` using `f.url` — **iterationCount NOT reconstructed** |
| D-05 makeToolKey contract | `frontend/src/lib/toolKey.ts` | 36-45 | `makeToolKey(opts)` → `provider\|messageId\|name\|observedAt\|index` |
| api.ts sub_agent dispatch | `frontend/src/lib/api.ts` | 538-559 | `sub_agent_start/delta/done` — `sub_run_id != null` discriminator (TASK vs legacy) |
| api.ts final_output_files dispatch | `frontend/src/lib/api.ts` | 589-592 | `onFinalOutputFiles((parsed.files ?? []))` — reads `{filename, url?}` |
| api.ts stream_end → done terminal | `frontend/src/lib/api.ts` | 648-650 | `stream_end` → `onTerminal("done")` |
| api.ts iteration_start dispatch | `frontend/src/lib/api.ts` | 677-678 | `onIterationStart(parsed.iteration)` |
| **D-08 backend final_output_files emit (ROOT site)** | `backend/app/services/agent_loop.py` | 2020-2042 | emits `final_output_files` with `[{filename, url, size}]` from `_previous_files_in_run.values()` — **the tag field would be added here** |
| D-08 backend iteration_start emit (D-04 source) | `backend/app/services/agent_loop.py` | 1283-1287 | `_emit('iteration_start', iteration=iteration)` at loop top |
| D-08 backend harvest + relative URL | `backend/app/services/sandbox_service.py` | 157-318; URL at 276-282 | `harvest_output_files` stores `url: /sandbox-outputs/{storage_path}` |
| D-08 backend re-sign endpoint (NOT the root) | `backend/app/api/sandbox_outputs.py` | 35-97 | re-signs with 60s TTL on EVERY click → downloads alive indefinitely |
| D-08 analyze_document sub_agent emit (D-05 backend) | `backend/app/services/tool_dispatcher.py` | 223-300; emits 243/278/284 | `_handle_analyze_document` emits `sub_agent_start/delta/done` AND returns a `sub_agent_record` persisted onto the tool_call (agent_loop.py:2014) |

---

## Per-Decision Root-Cause Findings

### D-05 — Sub-agent double-render ROOT (highest value) — **(c): composite render of BOTH the sub_agent bookend events AND the inner tool_call**

`[VERIFIED: codebase]` The answer is **(c)**, with a contributing **(b)** (no clientKey on the sub-agent path). It is a SEPARATE root from the 075.2 transient-id flicker (a). Mechanism:

1. The agent calls `analyze_document`. The agent loop emits `tool_start(name="analyze_document")` → StreamsProvider `onToolStart` (L397-469) appends ONE entry to `message.tool_calls` with a `clientKey`.
2. WHILE that tool executes, `_handle_analyze_document` (tool_dispatcher.py:243/278/284) emits `sub_agent_start` / `sub_agent_delta` / `sub_agent_done`. The api.ts dispatcher (L538-559, legacy branch where `sub_run_id == null`) routes these to `onSubAgentStart/Delta/Done` (StreamsProvider L491-515), which write to the **single-slot `message.sub_agent`** field — NO `clientKey`, NO `tool_calls` entry.
3. At `tool_end`, the persisted tool_call carries a `sub_agent` record (agent_loop.py:2014 `**({"sub_agent": sub_agent_record} ...)`), so `tc.sub_agent` becomes populated for the analyze_document tool_call (on reconcile/DB-reload; during live streaming `tc.sub_agent` may be absent while `message.sub_agent` is live).
4. **The render dual-source** (ToolCallPanel.tsx:531-532): `const agentState = tc.sub_agent ?? subAgent`. The `subAgent` prop is `message.sub_agent` (passed from RunCard.tsx:305). So during streaming, EVERY tool row in the panel where `tc.sub_agent` is absent falls back to the message-scoped `subAgent` → the live `SubAgentBlock` (L754) can render attached to the analyze_document tool row AND again if another row also falls through. More concretely: the analyze_document `tool_calls` entry renders its row, and the message-level `sub_agent` renders its content via the SAME `subAgent` fallback — the user sees the read/summarize content appear to "duplicate" (once as the tool body, once as the message-scoped sub-agent block), and it does NOT self-heal because both are stable state, not a transient id race.

**Quote (the dual-source, ToolCallPanel.tsx:529-532):**
```tsx
// Precedence rule unchanged: tool-scoped tc.sub_agent wins over message-scoped subAgent prop.
const agentState: SubAgentState | undefined =
  tc.sub_agent ?? subAgent
```

**Quote (the no-stamp sub-agent reducer, StreamsProvider.tsx:491-499):**
```tsx
onSubAgentStart: (filename, task) => {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, sub_agent: { filename, task, content: "", status: "running" } }
        : m,
    ),
  )
},
```
There is no `makeToolKey` stamp, no `tool_calls` entry, and `message.sub_agent` is a single slot (a second concurrent sub-agent would overwrite it).

**Minimal root fix shape (this is a STRUCTURAL change, not a 5-line stamp):**
- **Collapse the dual render source.** The sub-agent should render attached to its OWNING tool_call only. Stop falling back to the message-scoped `subAgent` prop for tool rows that aren't the analyze_document owner. Either (1) stamp the sub-agent stream onto the matching `tool_calls` entry (find the running `analyze_document`/`task` tool and set `tc.sub_agent` live, instead of writing a separate `message.sub_agent`), OR (2) drop the `?? subAgent` fallback entirely once (1) makes `tc.sub_agent` authoritative during streaming.
- Extend the `makeToolKey` discipline to whichever entry carries the sub-agent so its identity is stable from frame 1 (the (b) contribution).
- **Cross-provider note:** this path is provider-agnostic (the SSE vocabulary is shared); the fix is in the reducer (shared path) so it MUST be verified additive — see §Landmines. The TASK variant (`sub_run_id != null`, panel-driven) is OUT of scope (it routes to `onTaskStart`/panel, not the chat `sub_agent`).

### D-08 / D-07 — Dead-download-link ROOT — **NOT signed-URL expiry; it's missing-url + reconcile-swap**

`[VERIFIED: codebase]` The CONTEXT's "investigate-first, do not assume" instruction was right to flag this — **the assumed root (1h signed-URL decay) is already solved by the design.** Confirmed roots, in priority order:

1. **Files arriving without a `url` field → no download affordance.** OutputFileCard.tsx:72-86 renders a plain filename with NO anchor when `file.url` is missing. This happens when (a) the `final_output_files` emit carries a url-less entry, or (b) on DB reload, `_mapMessageResponse` (api.ts:111-133) reconstructs from `tc.result.output_files` and an older persisted result lacks `f.url`. **This is the primary dead-link root.**
2. **Reconcile swaps streaming state (has per-cell `outputFiles`/`finalOutputFiles`) for canonical DB state.** On a snapshot reconcile (StreamsProvider.tsx:1068-1080) the bucket is replaced with `snapshot.messages` (run through `_mapMessageResponse`). If the run hadn't yet emitted `final_output_files` OR the DB row's persisted `tool_calls` lack output_files, the `finalOutputFiles` reconstruction yields nothing → the panel disappears or shows fewer files mid-stream.
3. **Legacy http signed URLs (the 1h-decay path) — NOT the current root.** `resolveOutputUrl` (OutputFileCard.tsx:14-22) passes `http`-prefixed URLs through unchanged (legacy decay accepted per a prior CONTEXT). New files store the relative `/sandbox-outputs/{path}` which re-signs every click.

**The re-sign mechanism (sandbox_outputs.py:35-97) — confirmed alive indefinitely:**
```python
# Step 3: short-TTL re-sign. 60s is enough for the 302 → CDN fetch hop.
signed = await run_in_threadpool(
    supabase.storage.from_("sandbox-outputs").create_signed_url, storage_path, 60,
)
# Step 4: 302 redirect — browser follows to Supabase CDN.
return RedirectResponse(url=url, status_code=302)
```
The relative URL (`/sandbox-outputs/{user_id}/{execution_id}/{filename}`) is stable; each click authenticates (Bearer), ownership-fences (404 on miss/IDOR), and re-signs fresh. **A download "next day" works** as long as the `url` field is present and the `sandbox_files` row + storage object still exist.

**Minimal D-08 backend touch (what's actually permitted + needed):**
- **(a) Hero TAG — the real backend work.** Add a single additive field to the `final_output_files` emit at `agent_loop.py:2020-2042` (e.g., `"is_final": bool` or a `final_filenames: list[str]` companion). The agent knows request intent; the cleanest signal is to have the agent loop mark which file(s) match the user's requested deliverable type, OR carry the agent's own declaration. Payload today: `[{filename, url, size}]` from `_previous_files_in_run.values()`. **The tag is purely additive** — older streams without it → frontend treats all as working files (graceful). Thread the same flag into the persisted execute_code result so reload-reconstruction (api.ts:111-133) can re-hero next-day.
- **(b) Re-sign refresh — NOT needed.** Root is not signed-URL expiry; skip this. If the planner wants a belt-and-suspenders guarantee, the only gap is ensuring EVERY emitted file carries a `url` (guard against url-less entries at the emit site) — a frontend-friendly backend hardening, not a re-sign change.
- **PANEL-06 / demux risk:** the emit site is the Deep+harness shared agent loop. The tag field is read by the CHAT render only (MessageItem final-outputs panel) — it never touches panel stores. The emit is additive (no `return`, no shape change for existing consumers). **No demux risk** as long as the field is optional and the frontend defaults missing→working. Flag: do NOT change the `final_output_files` event NAME or remove existing fields (the 094 phase_* branches and Deep dispatch are byte-identical-sensitive — see Landmines).

### D-06 — Timer-vanish ROOT — **the render gate `{(isStreamingNow || elapsedMs > 0)}` + a perf.now delta that never recorded a tick**

`[VERIFIED: codebase]` Mechanism (RunCard.tsx:83-96, 192-199):
1. The timer effect (L87-96) only runs `if (isStreamingNow)`. It captures `startedAtRef = performance.now()` ONCE (L89) and ticks `elapsedMs` every 250ms.
2. On a long non-Anthropic run (Kimi/Moonshot), a premature/transient `stream_end` (or `buffer_expired`) reaches `_isTransientStreamEnd` (StreamsProvider L166-208). If the snapshot probe momentarily fails or the reattach window drops, the onTerminal handler (L1453-1464) flips `runStatus` → `completed`.
3. `isStreamingNow` (RunCard L48) goes `false`. The timer effect cleanup clears the interval (L95). If `elapsedMs` was still `0` (interval hadn't ticked yet, OR a temp-id→DB-id remount reset the component before the first 250ms tick, OR background-tab `setInterval` throttling delayed the first tick), then the render gate `{(isStreamingNow || elapsedMs > 0)}` (L192) is `false || false` = **false → the timer disappears entirely.**

**Quote (the trap, RunCard.tsx:192-199):**
```tsx
{(isStreamingNow || elapsedMs > 0) && (
  <span ... aria-live="polite">{elapsedSeconds}s</span>
)}
```

**Robust derivation (D-06 fix shape):**
- Derive elapsed from a **stable wall-clock start timestamp**, not a `performance.now()` delta captured inside a streaming-gated effect. Available sources:
  - **`message.created_at`** (ISO string, present on every assistant message including DB-loaded — see `_mapMessageResponse`). `Date.parse(message.created_at)` is the run start. This survives temp-id→DB-id remounts (the message identity changes but `created_at` is preserved through reconcile).
  - The run start event carries `run.started_at` (StreamsProvider reconcile L1113 sets `created_at: run.started_at` on placeholders) — same value.
- **Render continuously, decoupled from `isStreamingNow`.** Compute `elapsed = (frozenEnd ?? now) - start`. While streaming, `now` ticks; at terminal, freeze `frozenEnd` to the terminal timestamp. The render gate becomes "always show when a start time exists," never gated on `elapsedMs > 0`.
- **Immune to background-tab throttling:** because elapsed is `now - start` recomputed from wall-clock on each tick (not an accumulator), a throttled/skipped interval just means a coarser tick, never a wrong/frozen value. (The current code IS already a `now - baseline` delta, so this property is half-present — the fix is the BASELINE source and the RENDER GATE, not the tick math.)
- **Do NOT regress the 083 fix (BUG-260526-04):** that fix made `runId` the stable React key (MessageList.tsx:118 `key={run-${msg.runId}}`) so the temp-id→DB-id swap doesn't remount RunCard. The D-06 derivation must keep reading a value stable across that swap — `message.created_at` is stable; `performance.now()` captured in an effect is NOT (it resets on remount). Using `created_at` actively REINFORCES the 083 fix.
- **Persistent strip placement (D-06):** the strip (`⏱ Xs · Step N · activity`) lives in the RunCard sticky header (L150-212) — already sticky against the Radix viewport. The activity verb comes from `outerBannerLabel(activeTool, ...)` (L126-127). Keep it rendering until a TRUE terminal (the four terminal kinds).

### D-04 — `unifiedStepCount()` source-of-truth

`[VERIFIED: codebase]` The two divergent counters:
- **Counter A (RunCard step label):** `Step {message.iterationCount + 1}` (RunCard.tsx:132-135), driven by `iteration_start` SSE (`onIterationStart` StreamsProvider L654-659; backend emit agent_loop.py:1283-1287). Counts **semantic agent iterations** (1-15), where one iteration can emit 0-24 tool calls.
- **Counter B (panel):** `deduplicatedToolCalls.length` (ToolCallPanel.tsx:321-336). Counts **deduped tool cards**. (The grounding's "Used N tools" *header* was removed at 075.7 Bug D — the count now only drives the collapse logic and the RunCard collapsed-row "N tool calls" at RunCard.tsx:232-234, which reads RAW `message.tool_calls?.length`, NOT deduped — a third subtle inconsistency.)

**Single derivation (D-04 fix): one visible action = one step = the deduped tool-card count.**
- Define `unifiedStepCount(message)` = `deduplicatedToolCalls.length` (the deduped count — must use the SAME dedup as ToolCallPanel.tsx:321-334, so extract that dedup into a shared helper or compute once at the RunCard level and pass down).
- **Every consumer it must feed:**
  1. RunCard `Step N` subtitle (currently `iterationCount + 1` at L132-135) → switch to `unifiedStepCount`.
  2. RunCard collapsed-row "N tool calls" (L232-234, currently raw `tool_calls.length`) → switch to `unifiedStepCount`.
  3. RunCard header title "Run · N tools" (L129, raw length) → switch to `unifiedStepCount`.
  4. The persistent status strip "Step N" (D-06) → `unifiedStepCount`.
  5. The rail `snum` + collapsed "N steps" header per SKETCH-CONSISTENCY §1 → `unifiedStepCount`.
- **Off-by-one / double-count cross-provider:** the deduped count is provider-agnostic (it dedups on `clientKey` which is stamped uniformly). The `iteration_start`-based count was the cross-provider hazard (some providers emit extra iterations with 0 tools). Switching to the deduped tool-card count REMOVES the cross-provider divergence. Caveat: the iteration *divider* inside the panel (ToolCallPanel.tsx:559-570 "Step {tc.iteration + 1}") still uses `tc.iteration` for grouping — that's a within-run sub-grouping, NOT the headline count; leaving it is fine, but the planner should confirm the headline number and the divider don't read as contradictory (the sketch fixture treats "Step 7" = 7th card, so the divider semantics may need re-labeling to "Round N" or dropping — Claude's discretion within D-04).

### D-03 — Follow-but-release scroll

`[VERIFIED: codebase]` Today (MessageList.tsx:70-99): auto-scroll fires only when `newCount > prevCountRef` (a new MESSAGE arrives) OR `isStreaming && isNearBottomRef`. The streaming branch (L89-98) scrolls to the active preparing tool element or bottom on the `[messages, isStreaming]` effect — but `messages` only changes reference when the reducer mutates (which IS every token via `onDelta`), so it DOES re-run per delta. The gap is: (1) no explicit "release on scroll-up + re-arm at bottom" state machine beyond the `isNearBottomRef < 120` heuristic, and (2) no "↓ Jump to live" affordance.

**Hook shape (`useFollowScroll` — D-03 fix):**
- Track three pieces of state: `isPinned` (following the edge), `isNearBottom` (< 120px, already computed L36-37), and a derived `showJumpToLive = !isPinned && isStreaming`.
- **Follow signal:** the existing `[messages, isStreaming]` effect IS the delta cadence (messages ref changes per token via the immutable reducer). The hook should scroll-to-bottom on that effect ONLY when `isPinned`. Reuse the existing `bottomRef.scrollIntoView({behavior: isStreaming ? "instant" : "smooth"})`.
- **Release on scroll-up:** in `handleScroll` (L33-38), when `distFromBottom > 120` AND the scroll was user-initiated (not a programmatic scrollIntoView), set `isPinned = false`. Distinguish user-vs-programmatic by a short-lived `isProgrammaticScrollRef` flag set before each `scrollIntoView` and cleared on the next frame.
- **Re-arm at bottom:** when `handleScroll` sees `distFromBottom < 120`, set `isPinned = true`.
- **JumpToLive affordance:** render a floating pill (the SKETCH-CONSISTENCY `live-chip` / `JumpToLive`) when `showJumpToLive`; onClick sets `isPinned = true` + `scrollIntoView`.
- **What stream signal to follow:** the `messages` array reference (changes per delta) is the right cadence — no need for a separate ref to the streaming message. Keep the active-preparing-tool scroll-target priority (L78-82) for Focus Mode.
- **Reuse, don't fight 083/BL-05:** the BL-05 `scrollListenerAttachedRef` guard (L25-30, 45-68) already handles the "can't trust isNearBottom until attached" race — extend it, don't replace it.

---

## §Shared Component Build Map (SKETCH-CONSISTENCY §1 cross-checked against real code)

For each row: does it map to a real file/extension point, or need a brand-new file?

| Component / fn (SKETCH-CONSISTENCY §1) | Real-code status | Action |
|---|---|---|
| **`RunFrame`** | EXISTS = `RunCard.tsx` (the gradient frame, sticky header, progress bar, collapsed terminal row are all there, L137-336) | **EXTEND** RunCard — relabel "N tools"→"N steps" (D-04), wire the persistent strip (D-06). Not a new file. |
| **`StepRail` + `StepRow`** | PARTIAL — ToolCallPanel renders per-tool rows + Focus-Mode summary rows (L455-771) but NO numbered rail/node graphic | **NEW presentational wrapper** inside/around ToolCallPanel; data = `(index, status)` from the deduped `tool_calls`. Low risk (pure render). |
| **`ToolEssenceLine`** | PARTIAL — `summarizeToolCall(tc)` (tool-bodies registry) already produces the one-line result; rendered at ToolCallPanel.tsx:469-483, 209 | **REUSE** `summarizeToolCall` + `toolLabel`/`toolSummary` (toolMeta.ts). Add the icon+pill+chev one-liner wrapper. |
| **`ToolBody` (per-tool)** | EXISTS = `TOOL_BODIES` registry + `summarizeToolCall` (`./tool-bodies`), dispatched in `ToolResultBlock` (ToolCallPanel.tsx:140-229) | **REUSE** — the G4 "forbid a second body system" maps to: keep using `TOOL_BODIES`. No new renderer. |
| **`StatusPill`** | EXISTS = `frontend/src/components/chat/StatusPill.tsx` (confirmed present) | **REUSE** verbatim. |
| **`RunStatusStrip`** | PARTIAL — RunCard header has timer (L192-199) + step label (L132-135) + activity title (L126-127) as SEPARATE elements, not one strip | **EXTEND** — compose them into ONE strip component with two placement wrappers (header / floating). Resolves G8/G9/G12. New small component, fed by existing RunCard derivations + D-06 timer + D-04 count. |
| **`fileIcon`** | PARTIAL — OutputFileCard uses a single Lucide `Download` icon, no per-extension glyph | **NEW** small module (Lucide-based per-extension map is fine per SKETCH-CONSISTENCY G1). Pure presentation, zero risk. |
| **`OutputFileCard` (+Hero/Working)** | EXISTS = `OutputFileCard.tsx` (download, url-optional, supersedes); NO hero/working split | **EXTEND** OutputFileCard with a layout flag (hero vs working) + add the hero/working grouping in MessageItem.tsx:506-527. The download states (idle/ok/dead) already exist (L88-145). |
| **`SubAgentEssence`** | EXISTS = `SubAgentBlock` (ToolCallPanel.tsx:233-270) | **EXTEND/REPLACE** — the real fix is the D-05 dedup (collapse `tc.sub_agent ?? subAgent`), not the visual. One-card-per-task. |
| **`unifiedStepCount()`** | DOES NOT EXIST as a shared fn — count is forked across RunCard (`iterationCount+1`, raw `tool_calls.length` ×2) and ToolCallPanel (`deduplicatedToolCalls.length`) | **NEW** shared helper (e.g. `frontend/src/lib/stepCount.ts` or co-located). The embodied D-04 fix. Must reuse the EXACT dedup from ToolCallPanel.tsx:321-334 (extract that dedup too, or it drifts). |
| **`useFollowScroll` + `JumpToLive`** | DOES NOT EXIST — MessageList has the `isNearBottom < 120` heuristic + new-message scroll, no release/re-arm/jump | **NEW** hook + small pill component, extending MessageList.tsx:33-99. The genuinely-new D-03 work. |

**Verdict:** only **3 genuinely new artifacts** — `fileIcon` (trivial), `useFollowScroll`+`JumpToLive` (the D-03 hook), and `unifiedStepCount` (the D-04 helper, plus extracting the shared dedup). Everything else EXTENDS an existing file. This keeps the phase contained and honors G-5 (the hot files are touched additively, not rebuilt).

---

## §Corrections to CONTEXT / Grounding-Brief Assumptions

1. **WRONG (grounding §3, §1):** "ToolCallPanel shows `Used N tools` header at ~line 336/350-360." → **The panel is BODY-ONLY since 075.7 Bug D** (ToolCallPanel.tsx:338-345 comment). There is no "Used N tools" header to unify; the count lives in RunCard now. The D-04 unification is: RunCard's `iterationCount+1` step label vs the deduped tool-card count, both inside RunCard's chrome. (`[VERIFIED: codebase]`)
2. **WRONG (CONTEXT D-08, grounding §3 + §4 Cluster C):** "the dead-link root MAY be server-side signed-URL expiry → re-sign on download." → **The design ALREADY re-signs on every click (sandbox_outputs.py:35-97, 60s TTL).** Signed-URL expiry is NOT the current root. The real roots are missing-`url` entries (OutputFileCard.tsx:72-86) and reconcile-swap (StreamsProvider.tsx:1068-1080). **The D-08 backend touch should be the hero TAG, not a re-sign change.** (`[VERIFIED: codebase]`)
3. **REFINED (CONTEXT D-05, grounding §4 Cluster A):** the sub-agent double-render is **(c) composite** (a `tool_calls` entry + a single-slot `message.sub_agent`, joined by the `tc.sub_agent ?? subAgent` dual source), not merely **(b) missing-stamp** and definitely not **(a) the 075.2 transient-id flicker**. The fix is structural (collapse the dual source), not a 5-line clientKey stamp. (`[VERIFIED: codebase]`)
4. **REFINED (grounding §3):** the timer is a `performance.now()` delta (RunCard.tsx:89), and `ToolCallPanel`'s `ElapsedTimer` (L83-94) uses `Date.now() - startedAt` (already wall-clock!). The RunCard run-level timer is the one with the perf.now baseline + the vanish gate. The fix targets RunCard's baseline source + render gate. (`[VERIFIED: codebase]`)
5. **NEW (not in CONTEXT):** `message.iterationCount` is **NOT reconstructed on DB reload** (`_mapMessageResponse` api.ts:75-134 omits it). So on "reopen the chat next day," RunCard's current `Step N` label vanishes regardless of D-04. Switching D-04 to `unifiedStepCount` (= deduped `tool_calls.length`, which IS persisted) FIXES this for free. (`[VERIFIED: codebase]`)

---

## §Landmines / Regression Risks

| Risk | Source | What the planner MUST assert |
|---|---|---|
| **083 temp-id remount (BUG-260526-04)** | RunCard remounts on temp-id→DB-id swap | D-06 must read a value STABLE across the swap (`message.created_at`), never a `performance.now()` captured in an effect. The MessageList `key={run-${runId}}` (L118) prevents the remount; don't break it. |
| **075.2 dedup (BUG-260521-01)** | Transient two-probe reattach replaying tool_start | D-05 changes must NOT touch `_isTransientStreamEnd`/`_reattachAfterTransient` (StreamsProvider L166-250) — that's the working transient fix. The sub-agent fix is in `onSubAgentStart/Done` + the render dual-source, a different neighborhood. |
| **075.1 download (BUG-260514-01)** | `final_output_files` delta filter + re-rank | D-07 RE-RANKS (hero/working), does NOT hide — the operator explicitly reversed the "hide intermediates" stance. Don't reintroduce hiding. The backend delta filter (`_previous_files_in_run`) stays; the tag is additive. |
| **PANEL-06 isolation** | Chat selectors read `bucketsBySurface` only | D-05/D-06/D-07 changes write `message.*` (chat bucket) only. The D-08 tag is read by MessageItem (chat), never panel stores. Assert: no new read of `todosByThread`/`tasksByThread`/`phasesByThread`/`workspaceFilesByThread`/`pendingAsksByThread` from chat render. |
| **Per-thread demux (SC#10 parallel-thread)** | `streamingThreads`, `subscriptionsByThread`, `workflowLockByThread` Maps | All reducer changes go inside `makeStreamCallbacks` which closes over the OWNING `threadId` (StreamsProvider L283-289). Assert: no global flag, no cross-thread write. Thread A's sub-agent/timer/files must not bleed into Thread B. |
| **Cross-provider shared path (no regressions)** | `makeStreamCallbacks` is the SHARED Deep render path for all 6 providers | D-05's sub-agent fix and D-04's count change must be ADDITIVE/derivation-only. Assert: `onDelta` content-append invariant preserved (StreamsProvider L295-301 + the L351-357/463-466 spread-preserves-content comments); the four terminal kinds (done/error/cancelled/timed_out + reader_done) all render the frozen card/timer correctly. |
| **094 byte-identical Deep dispatch** | api.ts phase_* + Deep dispatch branches | The D-08 backend emit must NOT rename/reshape `final_output_files` or add a `return` that breaks cursor-advance. Additive field only. |
| **`final_output_files` reload reconstruct** | api.ts:111-133 rebuilds from persisted `tool_calls` | The hero TAG must persist into the execute_code `result.output_files` (agent_loop.py:1995-2002) so reload re-heroes; otherwise next-day reload shows all-as-working. |

---

## Validation Architecture

> Nyquist validation enabled (`workflow.nyquist_validation` not false). Framework detected.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3 + vitest-axe 0.1.0 |
| Config file | `frontend/vitest.config.*` (vitest run via `package.json` "test") |
| Quick run command | `cd frontend && npx vitest run src/components/chat/RunCard.test.tsx` (per-file) |
| Full suite command | `cd frontend && npm test` (`vitest run`) |
| Backend (D-08 tag) | `cd backend && venv pytest backend/tests/` |

**Existing infrastructure (Wave 0 is mostly covered):** `RunCard.test.tsx`, `__tests__/components/chat/ToolCallPanel.test.tsx`, `__tests__/components/MessageItem.finalOutputs.test.tsx`, `__tests__/components/chat/MessageList.test.tsx`, `__tests__/lib/toolKey.test.ts`, `__tests__/providers/StreamsProvider.dedup.test.ts`, `StreamsProvider.transient.test.ts`, `streamsProvider_075_9_clientkey.test.tsx`, `integration/streamsStore_per_thread.test.ts`.

### Per-Decision Validation Map (what the downstream planner derives Dimension-8 tasks from)

| Decision | Behavior | Test type | Automated command / observable | Pass condition |
|---|---|---|---|---|
| **D-01 collapse** | Terminal+tools run mounts COLLAPSED; click expands; one-line essence | unit (vitest + testing-library) | `RunCard.test.tsx` — assert `run-card-collapsed` row present when terminal+hasTools, body hidden until click | Collapsed row rendered; `data-testid="run-card-collapsed"` toggles body |
| **D-02 focus mode** | Only active step open; finished fold to summary | component | `ToolCallPanel.test.tsx` — fixture with 3+ done + 1 running; assert `step-summary-row` for past, active expanded | hiddenStepsCount≥3 → summary rows; active row `data-testid="tc-active"` |
| **D-03 follow-scroll** | Follow at bottom; release on scroll-up; re-arm; Jump-to-live appears | component (state machine) | NEW `useFollowScroll` test — simulate scroll events, assert `isPinned`/`showJumpToLive` transitions | scroll-up→`isPinned=false`+pill shown; scroll-to-bottom→`isPinned=true`+pill hidden |
| **D-04 unified count** | RunCard step label == panel card count == collapsed "N steps" | unit | NEW `stepCount.test.ts` + `RunCard.test.tsx` — fixture with N deduped tools across M iterations; assert all three read N | `unifiedStepCount(msg)` == deduped length; all 3 consumers equal |
| **D-05 zero-dup** | One card per logical sub-agent task; no duplicate | unit (reducer) | `StreamsProvider.dedup.test.ts` extension — drive `tool_start(analyze_document)` + `sub_agent_*`; assert exactly ONE rendered sub-agent block | Single `SubAgentBlock`; `tc.sub_agent ?? subAgent` resolves to one source |
| **D-06 persistent timer** | Timer visible whole run; freezes at true terminal; survives transient stream_end + remount | unit | `RunCard.test.tsx` — set `created_at`, flip runStatus completed mid-cycle with elapsedMs=0; assert timer STILL rendered | Timer present when start-time exists regardless of `elapsedMs`/`isStreamingNow` |
| **D-07 hero file** | Hero block above collapsed working group; all downloadable | component | `MessageItem.finalOutputs.test.tsx` extension — fixture with tagged hero + N working; assert hero rendered emphasized, working collapsed | Hero `OutputFileCard` separate from working group; all have download affordance when `url` present |
| **D-08 tag (backend)** | Agent loop emits `final_output_files` with the hero tag; persists into result | unit (pytest) | NEW `backend/tests/test_095_final_output_tag.py` — drive the emit; assert tag field present + persisted | Emit payload carries tag; execute_code persisted result carries it for reload |
| **D-07 dead-link (no url)** | url-less file → still has a path to download OR clearly marked | unit | `MessageItem.finalOutputs.test.tsx` — file without url; assert no silent dead anchor | Either download works or affordance clearly disabled (current: plain filename L72-86) |

### Lived-experience UAT (Chrome-DevTools MCP — the 4 operator scenarios, G-4)
Wire format + screenshot are INSUFFICIENT; drive a real browser. These are the SC#10 4-axis + the CONTEXT `<uat>` rows.

| UAT | Scenario | Axis coverage | Observable pass condition |
|---|---|---|---|
| **#1 Long run stays honest** | Kimi/Moonshot ~11-step PPTX build | long-run + D-06 + D-04 + D-05 | Timer NEVER blinks out; step count == cards on screen; read/summarize card never doubles; freezes at correct final duration at TRUE terminal |
| **#2 Multi-tool stays calm** | one prompt → `search_documents` + `execute_code` | multi-tool + D-01/D-02/D-03 | Both cards share frame; finished folds to one line; active open + auto-scroll follows; chat readable |
| **#3 Hero file downloads** | ask for a `.docx`; complete | D-07/D-08 | Finished doc is the hero, one-click download works; **reopen the chat the next day → download STILL works** (re-sign path) |
| **#4 Two threads + cross-provider** | Thread A streaming while Thread B accepts a prompt; sweep all 6 native providers | parallel-thread + cross-provider | A keeps timer/cards correct; B works; no cross-bleed; unified frame identical across Anthropic/OpenAI/Google/Kimi-Moonshot/GLM/MiniMax |

**Sampling rate:** per task commit → the relevant per-file vitest run; per wave merge → `npm test` full suite green; phase gate → full suite + the 4 Chrome-MCP UAT scenarios before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] NEW `frontend/src/lib/stepCount.ts` (or co-located) + `stepCount.test.ts` — the D-04 `unifiedStepCount` + shared dedup extraction.
- [ ] NEW `useFollowScroll` hook + test — D-03 state machine.
- [ ] NEW `backend/tests/test_095_final_output_tag.py` — D-08 emit/persist.
- [ ] EXTEND `RunCard.test.tsx` — D-06 timer-survives-transient + D-04 unified label cases.
- [ ] EXTEND `StreamsProvider.dedup.test.ts` — D-05 sub-agent single-render case.
- [ ] EXTEND `MessageItem.finalOutputs.test.tsx` — D-07 hero/working split + url-less case.
- *(Framework already installed — no install step needed.)*

---

## Project Constraints (from CLAUDE.md)

- **Cross-provider always top of mind / one UX, four adapters.** Every change must hold across all 6 native providers; provider-specific handling stays at the service boundary, never the shared chat render path. (D-05/D-06 are in the shared `makeStreamCallbacks` — must be additive/derivation-only.)
- **No cross-provider regressions.** Provider bug fixes must be provider-scoped or additive; never break the shared SSE/render path for working providers. The `onDelta` content-append invariant (StreamsProvider L295-301) is locked.
- **G-5 hot-file ledger:** ToolCallPanel/MessageItem/StreamsProvider show "satisfied at 075.7." 094 only touched StreamsProvider additively (the panel `onPhase*` demux + `onRunFailed`). **G-5 does NOT fire** — 095 is the first chat-render feature touch since the refactor; confirmed the files are still structured as the ledger describes (RunFrame in RunCard, body-only ToolCallPanel, per-thread Maps in StreamsProvider).
- **UAT scoreboard 4-axis recipe MANDATORY** for streaming/UI-state phases — the 4 UAT rows above cover cross-provider × multi-tool × parallel-thread × long-run.
- **Frontend stack:** React + Vite + Tailwind + shadcn/ui (Aether Intelligence / Deep Midnight). Reuse-only CSS / no new keyframes (allowed: `animate-fadeSlideUp/brandPulse/toolSlideIn/dotBounce/pulseGlow/pulse`, `tool-progress-bar`; Radix `ScrollArea`/`Collapsible`). All confirmed present in the touched files.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest + testing-library + vitest-axe | All frontend validation | ✓ | vitest 4.1.0, RTL 16.3.2, vitest-axe 0.1.0 | — |
| Chrome DevTools MCP | The 4 lived-experience UAT scenarios | ✓ (per memory `feedback_chrome_mcp_testing`) | — | none — UAT is mandatory |
| Local dev app | Chrome-MCP UAT | ✓ | http://localhost:5173 (login fhdmrd@gmail.com / 123456) | — |
| Supabase local (sandbox-outputs bucket) | D-07/D-08 download re-sign | ✓ | Supabase CLI v2.101 | — |
| Sandbox image | execute_code file generation for UAT #1/#3 | ✓ | `agentic-rag-sandbox:075.1.1` (set `SANDBOX_IMAGE` in backend/.env) | bare image (slower warm-up) |
| Backend uvicorn | D-08 backend tag + UAT | user-started | — | user starts in visible terminal (memory `feedback_user_starts_backend`) — never `run_in_background` |

**Missing dependencies with no fallback:** none — all infrastructure present.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest D-08 hero signal is the agent loop tagging files by request-intent match; the exact tag field name (`is_final` vs `final_filenames`) is a planning detail | D-08 finding | Low — any additive field works; planner picks; backend tag is small |
| A2 | `message.created_at` is the right stable start-time source for the D-06 timer (it's preserved through reconcile/DB-reload) | D-06 finding | Medium — if reconcile ever rewrites `created_at` to a different value the elapsed would jump; planner should confirm `created_at` == run start on the reconcile placeholder (StreamsProvider L1113 sets it to `run.started_at`, so HIGH confidence it's correct) |
| A3 | Collapsing the `tc.sub_agent ?? subAgent` dual source won't break the TASK-variant panel path | D-05 finding | Low — TASK variant (`sub_run_id != null`) routes to `onTaskStart`/panel, never the chat `sub_agent` slot (api.ts:538-559); the chat `subAgent` is legacy-analyze_document only |

*(No `[ASSUMED]` claims in the body — all root-cause findings are `[VERIFIED: codebase]`. The 3 above are forward-looking design choices the planner/operator confirms, not facts presented as verified.)*

## Open Questions

1. **Does the agent reliably know which file is the "final intended output"?**
   - What we know: the agent loop has the user prompt + request intent; it could match the requested file extension (`.docx`/`.pptx`) or carry an explicit declaration.
   - What's unclear: whether to derive the hero heuristically (largest matching-extension file) at the emit site, or require the agent to declare it via a tool arg/system-prompt convention.
   - Recommendation: start with a backend heuristic (match the user-requested extension; fall back to the largest/last-written deliverable). Keep it additive so a future explicit-declaration upgrade is non-breaking. Confirm with the operator at discuss/plan time — this is the one genuine product decision in D-08.

2. **Should the in-panel iteration divider ("Step N", ToolCallPanel.tsx:559-570) be re-labeled once D-04 makes "Step" = card count?**
   - What we know: the divider uses `tc.iteration` (agent rounds); the headline count switches to deduped tool-card count. Two different meanings of "Step."
   - What's unclear: whether the operator reads the divider as contradictory to the headline.
   - Recommendation: re-label the divider to "Round N" (or drop it) so "Step N" means exactly one thing (one visible action). Claude's discretion within D-04; verify against the sketch fixture.

## Sources

### Primary (HIGH confidence — all `[VERIFIED: codebase]`)
- `frontend/src/components/chat/RunCard.tsx` (384 lines) — D-01/D-02/D-04/D-06 frame + timer + counters
- `frontend/src/components/chat/ToolCallPanel.tsx` (774 lines) — D-01/D-02/D-05 dedup + Focus Mode + sub-agent dual source
- `frontend/src/providers/StreamsProvider.tsx` (2325 lines) — D-04/D-05/D-06 reducer; per-thread demux; terminal flips
- `frontend/src/components/chat/MessageList.tsx` (132 lines) — D-03 scroll
- `frontend/src/components/chat/OutputFileCard.tsx` (146 lines) — D-07 download + url-optional
- `frontend/src/components/chat/MessageItem.tsx` (554 lines) — D-07 final-outputs render + RunCard mount
- `frontend/src/lib/api.ts` (1783 lines) — SSE dispatch + `_mapMessageResponse` reload reconstruct + `downloadSandboxOutput`
- `frontend/src/lib/toolKey.ts` (45 lines) — `makeToolKey` contract
- `frontend/src/stores/streamsStore.ts` — per-thread Maps (demux/PANEL-06)
- `backend/app/services/agent_loop.py` — `final_output_files` + `iteration_start` emit sites
- `backend/app/services/sandbox_service.py` — `harvest_output_files` + relative URL
- `backend/app/api/sandbox_outputs.py` — the 60s-TTL re-sign endpoint (the D-08 root correction)
- `backend/app/services/tool_dispatcher.py` — `_handle_analyze_document` sub_agent emit (D-05 backend)

### Secondary
- 095-CONTEXT.md, 095-SKETCH-GROUNDING.md, 095-SKETCH-CONSISTENCY.md (the locked design contract)
- 5 bug reports (BUG-260529-02, 260528-01, 260528-02, 260521-01, 260514-01)
- ROADMAP Phase 095 block, REQUIREMENTS CHAT-04, STATE recent-phase history (083/094 regression context)

## Metadata

**Confidence breakdown:**
- D-05 sub-agent root: HIGH — traced the full emit→reducer→render chain across 4 files
- D-08 dead-link root: HIGH — read the actual re-sign endpoint; the "signed-URL expiry" assumption is disproven by code
- D-06 timer root: HIGH — the render gate + perf.now baseline + reload-omits-iterationCount all confirmed
- D-04 counter sources: HIGH — both counters located; the "Used N tools" header confirmed removed
- D-03 scroll: HIGH — the gap (no release/re-arm/jump) confirmed against the current effect
- Build map: HIGH — every SKETCH-CONSISTENCY §1 row mapped to a real file or flagged new
- Line anchors: HIGH — re-derived against current files; grounding's stale anchors corrected

**Research date:** 2026-06-05
**Valid until:** 2026-06-19 (14 days — chat hot files are stable since 075.x/076.x but are the milestone's active surface; re-verify anchors if any 095-pre commit lands)
