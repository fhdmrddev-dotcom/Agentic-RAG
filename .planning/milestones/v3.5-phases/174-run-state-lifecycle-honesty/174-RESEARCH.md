# Phase 174: Run-State & Lifecycle Honesty - Research

**Researched:** 2026-07-22
**Domain:** React chat-surface render layer over persisted `runs.status` + already-emitted SSE (no backend, no migration)
**Confidence:** HIGH (every code claim verified against live source this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-15 — verbatim intent)
- **D-01 / D-02 / D-03 (STATE-01a + STATE-02):** VERIFY, not rebuild. The cancelled-no-output render (`MessageItem.tsx:627`) and the persistent "Response stopped" indicator (`MessageItem.tsx:670`) already exist (Phase 147 / D-03). Cold-reload `runStatus` hydration (`threads.py:346-353` join + `api.ts` map) already exists. Work = live cross-provider UAT + full cold-reload check; surgical fix ONLY if a real gap surfaces. Highest-probability probe: the `threads.py` run-join must populate `run_status='cancelled'` even for an empty (content_len=0) early-cancel row.
- **D-04 / D-05 / D-06 (STATE-01b):** A workflow kill-switch **403** is an **administrative block → AMBER** (sketch 129-C), NOT the red-error / rollback-banner path. Add a **targeted new branch** in `StreamsProvider.sendMessage`'s catch that replaces the empty assistant placeholder with an honest in-chat amber bubble carrying `ApiError.message`, and clears the harness workflow-lock if no run registered. Do **NOT** regress the existing 400 (disabled-skill) / 409 (workflow-lock) rollback paths. Reuse the amber styling primitive `MessageItem.tsx:467-473` (`model-fallback-notice`).
- **D-07 / D-08 / D-09 / D-10 (STATE-03):** Make the pre-first-token state honest by counting **already-emitted activity** (`reasoning_delta` / `tool_args_progress`) as activity. Extend `outerBannerLabel()` (`toolMeta.ts:68`) + its call site (`MessageItem.tsx:620`) to surface a live "Reasoning…" sub-state. Signal source = state the frontend already stamps (`message.reasoningContent`, `preparing` tool entry). No new backend event, no backend latency work. Deep Mode byte-identical. Researcher MUST confirm the reasoning signal is populated CROSS-PROVIDER (Moonshot/Kimi, GLM/zhipu), not DeepSeek-only. Honest-label ONLY — latency causes (title-gen serial, sandbox cold-start) stay OUT.
- **D-11 / D-12 (STATE-04):** Anchor the workflow/harness run-strip timer to the run's `started_at`/`created_at` (reuse the Phase 095.1 Deep-run-card fix), and resolve the StreamsProvider/MessageList double-mount so exactly one avatar renders. Backend is correct (1 assistant row per run). Both symptoms fixed together.
- **D-13:** G-5 hot-file audit → no refactor-first required (render-layer only; `threads.py` producer extraction already paid down in Phase 162.5). Re-run replay/render tests; do not regress the shared render path.
- **D-14 (RED LINE):** Deep Mode byte-identical. Every change is a render layer over persisted state + already-emitted wire events; no shared Deep/agent-loop/provider fork; no new runtime.
- **D-15:** Design acceptance bar = sketches **129-C** (tiered dim/amber/red terminal vocabulary off `runs.status`) + **130-C** (run-header live sub-state + `started_at`-anchored timer + single avatar). "Quiet & calm, red for real failure — the louder the frame, the more it's earned."

### Claude's Discretion
- Exact discriminator for the STATE-01b amber branch (researcher confirms — see Open Question 5: recommend `status === 403`).
- Whether STATE-01a/02 need any surgical fix (researcher confirms verify-only — see Open Question 1).
- Optional polish per sketch 130-A (reasoning-token count + elapsed alongside the label) — nice-to-have, NOT required for acceptance.

### Deferred Ideas (OUT OF SCOPE)
- Title-gen serial→async (BUG-260607-02 cause 2) — separate backend latency work.
- Sandbox cold-start pre-warm / pool (BUG-260607-02 cause 3) — infra/SEED territory.
- OpenRouter-specific run-state failures — experimental provider; fix only if native-safe + low-complexity.
- Any backend persistence change or migration — `runs.status` authoritative (FND-01 / Phase 145).
- Panel-side run-honesty (BUG-260609-02 SUB-RESULTS desc loss, BUG-260609-04 phase-0 slug) — panel taxonomy is `run-honesty.md`'s, candidate for STRETCH Phase 178.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **STATE-01a** | Cancelled/killed run never leaves an empty bubble — "cancelled — no output yet" | VERIFY-only. Render exists (`MessageItem.tsx:627`); reload-derive **confirmed working end-to-end** (empty row gets `runs.message_id` + `status='cancelled'` via the finalizer → the `threads.py:346-353` zip re-derives it on reload). See Open Question 1. STATE-01b (killed-workflow) is the BUILD half. |
| **STATE-02** | "Response stopped" indicator survives nav + full cold reload | VERIFY-only. Render exists (`MessageItem.tsx:670`); the indicator gates on `message.runStatus`, which `api.ts:_mapMessageResponse` derives from the backend `run_status` enrich on every `getMessages`/`getSnapshot`. `useMessages.ts` carries zero runStatus logic. Data wiring confirmed. See Open Question 2. |
| **STATE-03** | Pre-answer "Setting up agent…" shows live model activity | BUILD (frontend only). `reasoning_delta` IS emitted cross-provider on the OpenAI-compat path (DeepSeek + Moonshot/Kimi + MiniMax + GLM/zhipu) and accumulated into `message.reasoningContent` (`StreamsProvider.tsx:405-413`). Extend `outerBannerLabel()` + call site to count it. See Open Question 3. |
| **STATE-04** | Workflow-run timer anchored + single avatar on nav | BUILD. Deep RunCard timer already `started_at`-anchored (`RunCard.tsx:122`); the live kickoff placeholder is NOT stamped with `startedAt` (`StreamsProvider.tsx:1859-1865` stamps runId/model/provider only). Avatar dup = pre-runId dedup gap in `dedupMessagesByRunId`. See Open Question 4. |
</phase_requirements>

## Summary

Phase 174 is a **pure render-layer chat-surface phase** — five run-lifecycle honesty fixes over data the backend already persists (`runs.status`, `runs.started_at`, `runs.message_id`) and events it already emits (`reasoning_delta`, `tool_args_progress`). There is **no new package, no migration, no backend change** on the acceptance path, and Deep Mode must stay byte-identical (D-14). Two of the five requirements (STATE-01a, STATE-02) are **verify-and-close** — the render conditions and the reload-derive already exist and were confirmed correct end-to-end this session. Three (STATE-01b, STATE-03, STATE-04) are surgical **builds** at well-identified seams.

The single most valuable finding: the **reasoning-activity signal is genuinely cross-provider**, contrary to the "DeepSeek reasoning" doc-comment that motivated Open Question 3. The OpenAI-compat gateway (`openai_compat.py:285-328`) routes `<think>…</think>` content to `reasoning_delta` for **moonshot, deepseek, minimax, and zhipu**, and DeepSeek's separate `reasoning_content` field to the same event — all four accumulate into `message.reasoningContent` on the frontend with **zero backend change**. Anthropic and Google never emit `reasoning_delta` (confirmed at `agent_loop.py:1906-1916`), so their pre-answer window keeps the calm "Setting up agent…" fallback — acceptable, since the SPEC's motivating cases (Kimi ~4,000 tokens, GLM) are all OpenAI-compat.

**Primary recommendation:** Treat STATE-01a/02 as UAT-verify tasks (surgical fix held in reserve, not expected to fire). Build STATE-03 as a single additive `outerBannerLabel` branch fed by a `reasoningActive` boolean derived at `MessageItem.tsx:620`. Build STATE-01b as a new `status === 403` amber branch inserted **before** the generic `ApiError` branch at `StreamsProvider.tsx:2069`. Build STATE-04 as (a) stamp `startedAt` onto the kickoff optimistic placeholder, and (b) close the pre-runId dedup gap in `dedupMessagesByRunId` / the MessageList reconcile insert.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cancelled/stopped terminal marker (STATE-01a/02) | Browser / React render (`MessageItem.tsx`) | API enrich (`threads.py` read-only) | Render derives from `message.runStatus`; the API only **reads** `runs.status` onto the message — no write. |
| Killed-workflow amber bubble (STATE-01b) | Browser / StreamsProvider catch | API (raises the 403, unchanged) | The 403 is already correct server-side (`workflow_kickoff.py:200-203`); the honesty gap is purely how the frontend catch renders it. |
| Pre-answer live sub-state (STATE-03) | Browser / render-derive (`toolMeta.ts` + `MessageItem.tsx`) | Gateway (already emits `reasoning_delta`, unchanged) | The signal is already on the wire and already stamped on `message.reasoningContent`; only the label derivation is missing. |
| Workflow timer anchor (STATE-04 timer) | Browser / StreamsProvider kickoff + RunCard | API enrich (`started_at`, already returned) | The run's `started_at` is authoritative and already flows via the enrich; the live kickoff placeholder just fails to carry it. |
| Single-avatar dedup (STATE-04 avatar) | Browser / MessageList + `dedupMessagesByRunId` | — | Backend confirmed 1 assistant row/run; the duplicate is a pure frontend reconcile-race artifact. |

## Standard Stack

**No new packages.** This phase reuses the existing chat-surface stack exclusively. Verified in-repo:

### Core (existing, reused)
| Library / module | Purpose | Why used here |
|---|---|---|
| React 18 + Zustand (`streamsStore.ts`) | Chat bucket state, per-thread `workflowLockByThread`, `reconcileErrors`, `failedSendDrafts` | The state seams STATE-01b/04 read and write already exist. |
| `lucide-react` (`Square`, `Loader2`, `Bot`) | Terminal/streaming glyphs | Already the icon source in `MessageItem.tsx` / `RunCard.tsx`; sketch 129-C's `⊘`/`■` map to `Square`. |
| Tailwind + Aether Deep Midnight tokens | Amber/dim/red tier styling | The `border-amber-400/30 bg-amber-400/10 text-amber-400/90` primitive (`MessageItem.tsx:470`) is the STATE-01b amber tier. |
| `@lobehub/icons` (`providerLogo.tsx`) | Per-provider avatar mark | Already the single avatar source in `RunCard.tsx:256`; do not add a second avatar system. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `outerBannerLabel` with a `reasoningActive` param | A new standalone `<PreAnswerActivity>` component | Sketch 130 winner **C** explicitly rejects the standalone line (variant A) — the label is the calmest fix and it's already the single call site. Stay with the label extension. |
| Closing the dedup gap in `dedupMessagesByRunId` | Changing the MessageList React `key` scheme | The key at `MessageList.tsx:180` already prefers `run-${runId}`; the real gap is the **pre-runId** window (no runId yet), so fix the dedup input, not the key. |

**Installation:** none. No `npm install`, no `pip install`, no migration.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All work is edits to existing frontend TypeScript (`MessageItem.tsx`, `StreamsProvider.tsx`, `toolMeta.ts`, `RunCard.tsx`, `dedupMessages.ts`, `MessageList.tsx`) plus optional read-only verification of `threads.py`. The slopcheck / registry-verification gate has no packages to evaluate. [VERIFIED: no new dependency in scope — SPEC "no migration, render-layer only"]

## Architecture Patterns

### System Architecture — the run-lifecycle honesty data flow

```
                      ┌─────────────────────────── BACKEND (unchanged) ───────────────────────────┐
  provider SSE        │                                                                            │
  (delta / reasoning) │  provider_gateway/openai_compat.py                                         │
        │             │   ├─ delta.content ──<think> strip (moonshot/deepseek/minimax/zhipu)──┐    │
        ▼             │   │                                                                    ▼    │
  ┌───────────┐       │   ├─ reasoning_content (deepseek) ────────────────►  yield reasoning_delta │
  │  provider │──────►│   └─ delta.content ──────────────────────────────►  yield delta           │
  └───────────┘       │                          agent_loop.py:1906-1916 re-emits reasoning_delta  │
                      │                          (OpenAI reasoning path too; NO-OP anthropic/google)│
                      │                                                                            │
                      │  run_producer.py finalize ──► finalize_run_terminal(status, message_id)    │
                      │       writes runs.status + runs.message_id (EVEN for empty cancel row)     │
                      │                                                                            │
                      │  threads.py GET /messages ── zip runs.status → m["run_status"] (:346-353)  │
                      │       + started_at / completed_at / model / provider enrich                │
                      └────────────────────────────────────┬───────────────────────────────────────┘
                                                            │  SSE (run:{run_id})  +  REST hydrate
                                                            ▼
  ┌────────────────────────────────────── FRONTEND (the change site) ───────────────────────────────┐
  │  api.ts _mapMessageResponse ── run_status→runStatus, reasoning_content→reasoningContent,          │
  │                                 started_at→startedAt  (cold-reload derive — STATE-01a/02)         │
  │                                                                                                   │
  │  StreamsProvider.makeStreamCallbacks                                                               │
  │    ├─ onReasoningDelta → message.reasoningContent += delta   ← STATE-03 SIGNAL (cross-provider)   │
  │    ├─ onToolPreparing  → tool_calls[preparing] entry         ← STATE-03 tool-args signal          │
  │    └─ sendMessage kickoff: stamp runId/model/provider (NOT startedAt) ← STATE-04 timer gap        │
  │                                                                                                   │
  │  StreamsProvider.sendMessage catch (:2047-2093)                                                    │
  │    ├─ 409 → rollback + reconcileErrors banner        (KEEP byte-identical)                        │
  │    ├─ 403 → NEW AMBER in-chat bubble + clear lock    ← STATE-01b (new branch, insert here)        │
  │    ├─ other ApiError (400) → rollback + banner        (KEEP byte-identical)                        │
  │    └─ network → mark assistant failed                 (KEEP byte-identical)                        │
  │                                                                                                   │
  │  MessageList → dedupMessagesByRunId → MessageItem                                                  │
  │    ├─ dedup collapses same-runId twins (temp vs persisted) ← STATE-04 avatar (gap: pre-runId)     │
  │    ├─ MessageItem:620 outerBannerLabel(...) pre-answer      ← STATE-03 label site                 │
  │    ├─ MessageItem:627 "cancelled — no output yet"           ← STATE-01a (exists)                  │
  │    ├─ MessageItem:670 "Response stopped"                    ← STATE-02 (exists)                   │
  │    └─ RunCard (tool_calls>0): started_at-anchored timer     ← STATE-04 timer (exists for Deep)    │
  └───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| File | Lines (verified) | Role in Phase 174 |
|------|------------------|-------------------|
| `frontend/src/components/chat/MessageItem.tsx` | `:467-473` amber primitive · `:616-626` pre-answer thinking branch (`:620` STATE-03 call site) · `:627-644` cancelled-no-output (STATE-01a exists) · `:670-680` "Response stopped" (STATE-02 exists) · `:437-438` RunCard mount gate | The terminal-state + pre-answer render surface. |
| `frontend/src/lib/toolMeta.ts` | `:68-100` `outerBannerLabel` (`:80` dead "Setting up agent…" gate) | STATE-03 label derivation. |
| `frontend/src/providers/StreamsProvider.tsx` | `:405-413` `onReasoningDelta` accumulation · `:426-463` `onToolPreparing` · `:1827-1834` workflow-lock kickoff seed · `:1859-1865` optimistic placeholder stamp (no `startedAt`) · `:2047-2093` sendMessage catch · `:2023` `clearWorkflowLockForThread` | STATE-01b branch, STATE-03 signal, STATE-04 timer seed. |
| `frontend/src/lib/api.ts` | `:165-204` `_mapMessageResponse` (`run_status→runStatus`, `reasoning_content→reasoningContent`, `started_at→startedAt`) | Cold-reload derive (STATE-01a/02). |
| `frontend/src/components/chat/RunCard.tsx` | `:122` `runStartMs = startedAt ?? created_at` · `:335-347` RunStatusStrip header | Deep timer already anchored; the pattern STATE-04 extends. |
| `frontend/src/components/chat/RunStatusStrip.tsx` | whole file | The `⏱ elapsed · Step N · activity` strip; consumes RunCard's `elapsedLabel`. |
| `frontend/src/lib/dedupMessages.ts` | `:31-53` `dedupMessagesByRunId` | STATE-04 avatar dedup (gap: rows without runId). |
| `frontend/src/components/chat/MessageList.tsx` | `:161` dedup call · `:180` `key = run-${runId} ?? id` | STATE-04 avatar reconcile seam. |
| `backend/app/api/threads.py` | `:332-360` runs enrich/zip · `:781` `preflight_workflow_kickoff` | **Verify only** — no change expected. |
| `backend/app/services/workflow_kickoff.py` | `:200-203` `raise HTTPException(403, "Workflows are currently disabled by the administrator")` | The STATE-01b 403 origin (unchanged). |

### Pattern 1 — Enum-conditional terminal render (Pattern S1, exists)
**What:** Terminal-state markers gate on the literal 5-value `runStatus` enum, derived from persisted `runs.status`.
**When to use:** STATE-01a/02 (already implemented — do not rebuild).
```tsx
// Source: MessageItem.tsx:670-680 [VERIFIED: codebase]
{(message.stopped ||
  message.runStatus === "timed_out" ||
  (message.runStatus === "cancelled" && !!message.content)) &&
  !isStreaming && (
  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
    <Square className="w-3 h-3" />
    <span className="italic">
      {message.runStatus === "timed_out" ? "Agent reached time limit" : "Response stopped"}
    </span>
  </div>
)}
```

### Pattern 2 — Additive catch branch, narrowest-first (STATE-01b)
**What:** Insert a new `status === 403` branch **before** the generic `ApiError` branch so the amber path is reached only for administrative blocks; every other status flows to the untouched existing branches.
**When to use:** STATE-01b.
```tsx
// Insertion point: StreamsProvider.tsx BETWEEN :2068 (409 branch end) and :2069 (generic ApiError)
// [VERIFIED: codebase — the 403 kill-switch currently falls into the generic branch at :2069]
} else if (err instanceof ApiError && err.status === 403) {
  // 129-C amber tier: an administrative block (workflow kill-switch / app-layer ban).
  // Replace the empty assistant placeholder with an honest in-chat amber bubble
  // carrying the server's message — NOT the red rollback-banner path.
  useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, blockedNotice: { message: err.message } }  // new render-only field
        : m,
    ).filter((m) => m.id !== userMsg.id ? true : true),  // keep user bubble; see D-04
  )
  // D-04: guarantee the composer is not left locked (no-op if no lock was seeded).
  useStreamsStore.getState().actions.clearWorkflowLockForThread(threadId)
}
```
> The exact placeholder-vs-rollback shape (keep the user bubble, replace the assistant bubble with the amber notice) is a plan decision; the discriminator (`status === 403`) and the lock-clear are the load-bearing parts. Render the amber notice with the existing primitive class (`MessageItem.tsx:470`).

### Pattern 3 — Count already-stamped state as activity (STATE-03)
**What:** Derive a `reasoningActive` boolean at the call site and pass it into `outerBannerLabel`; return "Reasoning…" instead of "Setting up agent…".
**When to use:** STATE-03.
```tsx
// toolMeta.ts:80 — extend the first branch (Deep byte-identical: only this branch changes)
// [VERIFIED: codebase — current signature outerBannerLabel(activeTool, hasAnyTools, isPlanning, isHarness)]
export function outerBannerLabel(
  activeTool: ToolCall | null,
  hasAnyTools: boolean,
  isPlanning: boolean,
  isHarness = false,
  reasoningActive = false,   // NEW — default false keeps every existing caller byte-identical
): string {
  if (!hasAnyTools && !isPlanning) {
    if (reasoningActive) return "Reasoning…"          // STATE-03 (130-C sub-state)
    return isHarness ? "Starting workflow…" : "Setting up agent…"
  }
  // …every other branch unchanged…
}

// MessageItem.tsx:620 call site — derive reasoningActive from the already-stamped field
// [VERIFIED: codebase — message.reasoningContent is accumulated cross-provider]
const reasoningActive = !message.content && !!message.reasoningContent
<span className="italic">
  {outerBannerLabel(null, false, message.isPlanning ?? false, workflowLock != null, reasoningActive)}
</span>
```

### Pattern 4 — Anchor the live timer to `started_at` (STATE-04)
**What:** Stamp `startedAt` onto the optimistic assistant placeholder at kickoff so the RunCard/strip timer derives from a stable wall-clock baseline that survives a nav-back remount (mirrors Phase 095.1's `runStartMs = message.startedAt ?? created_at`).
```tsx
// StreamsProvider.tsx:1859-1865 — the kickoff placeholder stamp currently omits startedAt
// [VERIFIED: codebase — only runId/model/provider are stamped]
if (m.id === assistantId)
  return {
    ...m,
    runId: run_id,
    model: resolvedModel ?? undefined,
    provider: resolvedProvider ?? undefined,
    startedAt: resolvedStartedAt ?? new Date().toISOString(),  // NEW — anchor survives remount
  }
```
> Source `resolvedStartedAt` from the kickoff POST response if it returns the run's `started_at`; otherwise the client send-time is an acceptable anchor (drift ≤ one network RTT, and the persisted enrich corrects it on the next hydrate). Confirm the exact workflow strip during the plan (see Open Question 4).

### Anti-Patterns to Avoid
- **Rebuilding STATE-01a/02.** Both render conditions and the reload-derive already exist and are correct — a rebuild risks regressing Phase 147/D-03. Verify, patch only if UAT surfaces a gap.
- **Making STATE-01b a status-agnostic branch.** Keying the amber path on anything broader than `status === 403` will swallow the 400 disabled-skill and 409 workflow-lock rollback paths (D-05 regression).
- **Emitting a new backend event for STATE-03.** The signal is already on the wire; a backend change breaks D-14 and the "no latency work" boundary.
- **Adding a second avatar / second timer.** The single avatar (`RunCard.tsx:256` / `providerLogo`) and single strip (`RunStatusStrip`) are the sketch-locked instruments; STATE-04 removes a duplicate, never adds a home.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Same-runId assistant duplicate collapse | A new MessageList reconcile pass | Extend existing `dedupMessagesByRunId` (`dedupMessages.ts:31`) | It already handles temp↔persisted twin replacement; only the pre-runId window is uncovered. |
| Elapsed-timer derivation | A fresh `setInterval` accumulator | The `RunCard.tsx:122-177` `runStartMs`/`frozenEndRef` machinery | It's the 095.1 never-vanishes + honest-duration fix (immune to tab-throttle, no reload fabrication). Reuse the derivation, feed it `startedAt`. |
| Amber notice styling | New CSS | `MessageItem.tsx:470` `model-fallback-notice` classes | Sketch 129-C's amber tier IS this primitive; consistency is a decision (D-06). |
| Provider avatar | A new icon map | `providerLogo.tsx` (`@lobehub/icons`) | Icon-convention rule: same concept, byte-identical everywhere. |
| Reasoning signal per provider | Provider-specific frontend detection | `message.reasoningContent` (already cross-provider via the gateway) | The gateway already normalizes `<think>` + `reasoning_content` into one event. |

**Key insight:** Every mechanism this phase needs already exists in the codebase — the work is *wiring an already-stamped signal into an already-rendered surface*, not building new machinery. The failure mode of this domain is re-implementing (and thereby forking / regressing) a shared render path; the discipline is additive edits at the identified seams.

## Common Pitfalls

### Pitfall 1: The STATE-03 tool-args sub-state is a different render location than the reasoning sub-state
**What goes wrong:** Assuming "Writing execute_code…" and "Reasoning…" render at the same site.
**Why it happens:** `MessageItem.tsx:620` (the STATE-03 label site) is reached only in the `isStreaming && !hasAnyTools` branch — i.e., **before any tool exists**. The moment a tool enters `preparing`, `hasAnyTools` flips true and the render moves to `RunCard` → `RunStatusStrip`, whose `activityVerb` already calls `outerBannerLabel(activeTool, …)` and already returns "Preparing code…". So the tool-args honesty **already exists** once a tool appears; only the **reasoning-before-any-tool** window is dead.
**How to avoid:** Scope STATE-03 to the reasoning window at `MessageItem:620`. Do not try to route tool-args through this call site (it always passes `hasAnyTools=false`).
**Warning signs:** A plan task that adds tool-name branches to the `MessageItem:620` call — those are unreachable there.

### Pitfall 2: Anthropic/Google have no `reasoning_delta` — STATE-03 is silent for them by design
**What goes wrong:** Expecting "Reasoning…" on a Claude or Gemini pre-answer gap and calling it a bug.
**Why it happens:** `agent_loop.py:1911-1912` — "No-op for anthropic/google (they never emit reasoning_delta)." Their thinking is not streamed as a separate delta today, and adding it is a backend change (out of scope, D-14).
**How to avoid:** Accept the calm "Setting up agent…" fallback for Anthropic/Google. UAT the "Reasoning…" state on an OpenAI-compat reasoning model (DeepSeek/Kimi/GLM), not on Claude/Gemini.
**Warning signs:** A UAT row asserting "Reasoning…" on `claude-*` or `gemini-*`.

### Pitfall 3: STATE-04 timer bug is NOT on the Deep RunCard — that one is already fixed
**What goes wrong:** Editing `RunCard.tsx:122` thinking it's the reset source.
**Why it happens:** BUG-260610-01 is on the **workflow/harness** run; the Deep RunCard timer is already `started_at`-anchored (095.1). The reset happens because the **live kickoff placeholder** never carries `startedAt` (`StreamsProvider.tsx:1859-1865`) AND a mid-workflow run isn't persisted yet (message row written at terminal), so a nav-back hydrate returns no `startedAt` → RunCard falls back to a remount-fresh `created_at`.
**How to avoid:** Fix the **source** (stamp `startedAt` on the kickoff placeholder), not the consumer. Confirm during the plan whether the workflow receipt renders through RunCard (`tool_calls>0`) or a separate strip.
**Warning signs:** A diff to the `runStartMs`/`frozenEndRef` logic instead of the placeholder stamp.

### Pitfall 4: The duplicate avatar lives in the pre-runId window, which `dedupMessagesByRunId` can't see
**What goes wrong:** Assuming the existing dedup already covers it.
**Why it happens:** `dedupMessagesByRunId` (`dedupMessages.ts:35`) keys on `msg.runId`; the kickoff optimistic placeholder has **no runId** until `StreamsProvider.tsx:1862` stamps it after the POST returns. If a reconcile/first-SSE inserts a second assistant row in that window, both lack a shared runId → no collapse → two avatars (BUG-260610-01 reproduces even on fast OpenAI, confirming a race not latency).
**How to avoid:** Close the gap at the reconcile-insert seam (don't insert an orphan assistant row while an un-runId'd optimistic placeholder for the same send is present) and/or give the dedup a pre-runId fallback key (e.g., match a temp placeholder against the incoming persisted row for the same thread when neither has a runId yet).
**Warning signs:** A fix that only touches the `MessageList.tsx:180` key — the key is fine; the dedup **input** is the gap.

### Pitfall 5: STATE-01b — the 403 fires before any run/message exists (fail-closed-before-insert)
**What goes wrong:** Trying to "mark the run cancelled" or read a run_id in the 403 branch.
**Why it happens:** `preflight_workflow_kickoff` raises the 403 **before** the user-message INSERT and before any run row (`workflow_kickoff.py` fail-closed ordering). There is no run, no message_id, no assistant DB row — only the frontend optimistic bubbles exist.
**How to avoid:** The amber branch is purely a frontend placeholder swap + lock-clear. Do not expect server state to reconcile it.
**Warning signs:** A plan task querying `runs` for the blocked send.

## Code Examples

### Verify STATE-01a reload-derive end-to-end (the D-03 gap probe — CONFIRMED CLOSED)
```python
# backend/app/services/agent_loop.py:1507-1511 [VERIFIED: codebase]
# The empty early-cancel row IS persisted (content_len=0):
if not full_content and not persisted_tool_calls:
    logger.warning("Agent loop produced no content … — persisting empty assistant message", thread_id)
# → insert_assistant_message returns _cached_id → _msg_id_for_runs

# backend/app/services/run_producer.py:180-191 [VERIFIED: codebase]
# On a TRUE terminal (incl. cancelled), the finalizer links message_id + writes status:
await finalize_run_terminal(
    …, status=terminal_status,                       # 'cancelled'
    message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,   # the empty row's id
)

# backend/app/api/threads.py:350-353 [VERIFIED: codebase]
# On reload, the zip re-derives run_status for that message by message_id (NOT by content):
for m in messages:
    run = runs_by_message.get(m["id"])
    m["run_status"] = run["status"] if run else None   # → 'cancelled' for the empty row
```
**Conclusion:** the empty early-cancel row gets `runs.message_id` + `status='cancelled'`, so `MessageItem.tsx:627` fires on reload. Verify-only; the only edge where it wouldn't render is when NO assistant row was ever inserted — in which case there is also no empty avatar to fix (no message = no bubble).

### The cross-provider reasoning signal (STATE-03 — the key finding)
```python
# backend/app/services/provider_gateway/openai_compat.py:285-328 [VERIFIED: codebase]
if active_provider_name in ("moonshot", "deepseek", "minimax", "zhipu"):
    # …strip <think>…</think> from delta.content → _reasoning…
    if _reasoning:
        yield {"type": "reasoning_delta", "content": _reasoning}   # Kimi/GLM/MiniMax path
# DeepSeek separate field:
_rc = getattr(delta, "reasoning_content", None)
if _rc:
    yield {"type": "reasoning_delta", "content": _rc}              # DeepSeek path
```
```tsx
// frontend/src/providers/StreamsProvider.tsx:405-413 [VERIFIED: codebase]
onReasoningDelta: (delta) => {
  setMessages((prev) => prev.map((m) =>
    m.id === assistantId ? { ...m, reasoningContent: (m.reasoningContent ?? "") + delta } : m))
},
```
→ `message.reasoningContent` is populated for **DeepSeek, Moonshot/Kimi, MiniMax, zhipu/GLM** and OpenAI reasoning models — the STATE-03 signal is cross-provider with **no backend change**.

## State of the Art

| Old (pre-174) | Current target (174) | Source |
|---------------|----------------------|--------|
| Empty avatar-only bubble on early cancel | "cancelled — no output yet" (exists, verify) | `MessageItem.tsx:627` (Phase 147) |
| Live-only "stopped" badge lost on reload | Persisted-derive from `runs.status` (exists, verify) | `threads.py:346-353` + `api.ts:198` |
| Workflow kill-switch → blank workflow card | Amber "disabled by the administrator" bubble | sketch 129-C / `workflow_kickoff.py:200` |
| "Setting up agent…" during reasoning stream | "Reasoning…" from `reasoningContent` | `openai_compat.py:285-328` |
| Workflow timer reseeds from mount on nav | `started_at`-anchored (095.1 pattern) | `RunCard.tsx:122` |

**Deprecated/outdated:**
- The `reasoningContent` doc-comment "DeepSeek reasoning" (`types/index.ts`, `api.ts:156`) is **stale** — the field is cross-provider as of the `<think>`-strip work (BUG-260526-02, minimax/zhipu added 2026-05-30). Do not treat it as DeepSeek-only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The kickoff POST can surface the run's `started_at` (or client send-time is an acceptable anchor) for STATE-04 | Pattern 4 | If the strip reads a different field, the timer fix lands in the wrong place — mitigated by the plan confirming the workflow receipt component first. |
| A2 | The "companion app-layer ban 403" the SPEC notes is (or will be) a plain `403` on the send path, so `status === 403` covers it | Open Q5 | If a future ban uses a different status, it won't route to amber — low risk, current code has only the kill-switch 403. |
| A3 | The workflow run in chat renders through `RunCard` when it accumulates `tool_calls` (harness phases run Deep tools) | Open Q4 | If a pure-workflow run uses a separate strip with its own timer, STATE-04 timer fix targets that component instead — plan confirms. |

## Open Questions (RESOLVED)

**1. STATE-01a/02 verify-first confirmation — is `run_status='cancelled'` populated for the empty early-cancel row?**
- **Answered: YES, verify-only, no surgical fix expected.** The empty assistant row IS persisted (`agent_loop.py:1507`), the finalizer links `runs.message_id` + writes `status='cancelled'` on the terminal path (`run_producer.py:180-191`), and the reload zip keys on `message_id` not content (`threads.py:350-353`). The only path where the marker wouldn't render is when NO assistant row was inserted at all — but then there is no empty bubble to fix either. **Recommendation:** UAT-verify on DeepSeek early cancel + one other provider, live + full cold reload; hold a surgical patch in reserve only if UAT contradicts this.

**2. STATE-02 reload-derive — is `runStatus` re-derived on cold reload?**
- **Answered: YES.** `api.ts:_mapMessageResponse` (`:198`) maps the backend `run_status` enrich to `message.runStatus` on every `getMessages`/`getSnapshot`; `useMessages.ts` holds zero runStatus logic. The "Response stopped" indicator (`MessageItem.tsx:670`) therefore renders identically live, on nav-back, and on full reload. Verify-only.

**3. STATE-03 cross-provider reasoning signal — DeepSeek-only or cross-provider?**
- **Answered: CROSS-PROVIDER, no backend change.** `openai_compat.py:285-328` emits `reasoning_delta` for **moonshot, deepseek, minimax, zhipu** (via `<think>` strip) and DeepSeek's `reasoning_content` field; `agent_loop.py:1906-1916` also emits it on the OpenAI reasoning path. All accumulate into `message.reasoningContent` (`StreamsProvider.tsx:409`). **Anthropic/Google do NOT** emit it (by design). The cleanest "tool-args streaming" signal is the existing `preparing` tool entry (`StreamsProvider.tsx:446-461`), which already drives `outerBannerLabel`'s tool branches via `RunCard`/`RunStatusStrip` — so STATE-03's only dead window is reasoning-before-any-tool at `MessageItem:620`.

**4. STATE-04 double-mount seam — exact component + path.**
- **Timer:** the live kickoff optimistic placeholder is stamped with `runId`/`model`/`provider` but **not `startedAt`** (`StreamsProvider.tsx:1859-1865`); a mid-workflow run has no persisted row yet (written at terminal), so a nav-back hydrate returns no `startedAt` → the RunCard timer (`RunCard.tsx:122`) falls back to a remount-fresh `created_at` → reset. **Fix:** stamp `startedAt` on the kickoff placeholder. **Avatar:** the pre-runId window (`dedupMessagesByRunId` keys on runId, which is absent until `:1862`) lets a reconcile/first-SSE orphan assistant row co-exist with the placeholder → two avatars (reproduces on fast OpenAI = race, not latency). **Fix:** close the reconcile-insert orphan and/or add a pre-runId dedup fallback. **Plan must confirm** whether the workflow receipt renders through `RunCard` (`tool_calls>0`, `MessageItem.tsx:437`) or a separate strip.

**5. STATE-01b discriminator — how to distinguish the workflow-403 from the Deep-400.**
- **Answered:** the workflow kill-switch raises `HTTP_403_FORBIDDEN` "Workflows are currently disabled by the administrator" (`workflow_kickoff.py:200-203`), reached only for a workflow launch (`body.workflow_definition_id is not None`), **before** the user-message INSERT. The Deep disabled-skill gate is a **400**; the workflow-lock refusal is a **409**. **Recommended discriminator: `err instanceof ApiError && err.status === 403`**, inserted as a new branch between the 409 branch (`:2050-2068`) and the generic `ApiError` branch (`:2069`). This cleanly targets the kill-switch, also covers the SPEC's "companion app-layer ban 403" (both are 129-C amber administrative blocks), and leaves the 400/409 rollback paths byte-identical. The harness workflow-lock is seeded at kickoff at `StreamsProvider.tsx:1827-1834` (after run_id) — on a 403 it is never seeded, but the branch should still call `clearWorkflowLockForThread(threadId)` **defensively** (D-04) so any optimistic/launch-path lock cannot leave the composer stuck.

**6. G-5 regression surface — the tests that MUST stay green.**
- **Answered (verified present):**
  - `frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` — the reconcile-race backstop (directly relevant to STATE-04 avatar).
  - `frontend/src/__tests__/providers/StreamsProvider.dedup.test.ts` + `frontend/src/lib/__tests__/dedupMessages.test.ts` + `frontend/src/__tests__/components/chat/MessageList.dedup.test.tsx` — the dedup invariants (STATE-04 avatar).
  - `frontend/src/__tests__/providers/StreamsProvider.anthropic-ordering.test.ts` — Anthropic text/tool ordering (Deep byte-identical guard, D-14).
  - `frontend/src/__tests__/providers/streamsProvider_bug_260707_01_streaming_flag.test.tsx` + `…_03_final_answer_resolve.test.tsx` — send/stream lifecycle (STATE-01b catch path).
  - `frontend/src/__tests__/components/MessageItem.test.tsx` (+ `.memo`, `.sticky`, `.fallbackNotice`, `.finalOutputs`, `.clamp`) — MessageItem render invariants (STATE-01a/02/03).
  - `frontend/src/__tests__/components/RunCard.logo.test.tsx` — single-avatar/logo (STATE-04 avatar).
  - `frontend/src/__tests__/hooks/useMessages.test.ts` — confirms useMessages carries no runStatus logic.
  - `frontend/src/lib/__tests__/stepCount.test.ts`, `termMap.test.tsx`, `toolKey.test.ts` — supporting derivations.
  - **No dedicated "Deep byte-identical" snapshot test exists;** the D-14 guard is the Anthropic-ordering test + the reconcile-race test + a manual diff review. The plan should add a Wave-0 component test asserting `outerBannerLabel(null,false,false,false,false)` still returns "Setting up agent…" (byte-identical default) and `…,true)` returns "Reasoning…".

## Environment Availability

> This phase is code-only to build, but SC#10 live UAT requires the full running dev stack + cross-provider keys.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + Vite dev server (`localhost:5173`) | build + UAT | assumed (dev machine) | project pins | — |
| `npm test` (vitest) | G-5 regression | assumed | project pins | — |
| Uvicorn backend (operator-started) | live UAT / SSE | operator-started | — | none — user starts it (memory: never `run_in_background`) |
| Supabase local (`:54322`) | reload-derive UAT | assumed running | 15.x | none |
| Redis (`docker-compose.dev.yml`) | run-buffer / SSE | assumed running | 7.x | none |
| DeepSeek API key | **STATE-01a required** early-cancel + STATE-03 reasoning | operator-configured | — | Moonshot/Kimi or GLM covers STATE-03 reasoning; DeepSeek is REQUIRED for STATE-01a per D-14 |
| OpenAI / Anthropic / Google keys | SC#10 cross-provider axis | operator-configured | — | none for the axis they represent |
| Moonshot/Kimi **or** GLM/zhipu key | STATE-03 reasoning-heavy proof (~4,000 tokens) | operator-configured | — | DeepSeek reasoning model |
| A published workflow + workflows kill-switch (Admin Control Room) | **STATE-01b + STATE-04** | operator-configured | — | none — STATE-01b needs the kill-switch OFF; STATE-04 needs a multi-minute workflow run |

**Missing dependencies with no fallback:** DeepSeek key (STATE-01a), a published workflow + kill-switch toggle (STATE-01b/04). The plan must confirm these are available before the UAT wave, or STATE-01a/01b/04 acceptance cannot be proven.

## Validation Architecture

> nyquist_validation = true; SC#10 4-axis mandate applies. UAT rows authored under **VALIDATION.md**, not PLAN tasks (D-14).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend unit/component) + manual live UAT (Chrome MCP / operator-driven) |
| Config file | `frontend/vitest.config.*` (existing; hot-file tests already present) |
| Quick run command | `cd frontend && npm test -- <file>` (per-file, < 30s) |
| Full suite command | `cd frontend && npm test` |
| Known baseline rot | ~14-17 vitest tests pre-existing ROT (SEED-056) — differential-only: the phase's touched-file tests must not newly fail. |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| STATE-01a | empty cancelled row → "cancelled — no output yet" from `runStatus='cancelled'` + empty content | component | `npm test -- MessageItem.test.tsx` (extend) | ✅ (extend for empty-content case) |
| STATE-01a | reload-derive: `run_status` zip populates for empty row | manual live UAT | DeepSeek early cancel → full cold reload | ❌ manual (backend join verified in research) |
| STATE-01b | `status===403` → amber bubble + composer unlocked; 400/409 unchanged | component | `npm test -- streamsProvider*` (new dedicated test) | ❌ Wave 0 — new test |
| STATE-02 | "Response stopped" renders from `runStatus` after nav + reload | component + manual | `npm test -- MessageItem.test.tsx`; manual cold reload | ✅ (extend) + manual |
| STATE-03 | `reasoningActive` → "Reasoning…"; default → "Setting up agent…" (byte-identical) | unit | `npm test -- toolMeta` (new) | ❌ Wave 0 — new test |
| STATE-03 | reasoning-heavy model shows "Reasoning…" pre-answer | manual live UAT | Kimi/DeepSeek/GLM long-reasoning prompt | ❌ manual |
| STATE-04 | single avatar (no pre-runId duplicate) | component | `npm test -- MessageList.dedup.test.tsx` / `streamsProvider_075_7_reconcile_race` (extend) | ✅ (extend for pre-runId case) |
| STATE-04 | timer anchored to `startedAt` on nav-back | component + manual | extend RunCard/strip test; manual multi-minute workflow nav | ⚠ partial (RunCard timer tested; workflow strip manual) |

### SC#10 4-Axis Live UAT Matrix (mandatory — VALIDATION.md)
| Axis | Required coverage for 174 |
|------|---------------------------|
| **Cross-provider** | OpenAI, Anthropic, Google, **+ DeepSeek (REQUIRED for STATE-01a)**; STATE-03 reasoning proof on Kimi/Moonshot **or** GLM (OpenAI-compat). Anthropic/Google keep the "Setting up agent…" fallback for STATE-03 (by design — not a failure). |
| **Multi-tool** | ≥1 row: a prompt driving 2+ tools (e.g. `search_documents` + `execute_code`) while watching the pre-answer → tool → terminal transitions (STATE-03 + STATE-04 timer). |
| **Parallel-thread** | ≥1 row: Thread A streaming a workflow while Thread B accepts a Deep prompt — verify per-thread workflow-lock isolation (STATE-01b lock-clear must not leak) and no cross-thread avatar/timer bleed (STATE-04). |
| **Long-message** | ≥1 row per provider: ≥50 prior messages OR ≥5 KB prompt — stays **manual per provider** (STATE-02 reload-derive on a long thread; STATE-03 reasoning window under load). |

### Reload / Nav Proofs (STATE-02 + STATE-04)
- **STATE-02:** mid-stream Stop → (a) nav away & back, (b) **full cold browser reload** → "Response stopped" still shown, both on ≥1 provider.
- **STATE-04:** multi-minute streaming workflow → nav away & back → timer continues from real elapsed (no reset) + exactly one avatar, on a fast (OpenAI) and a slow (Google/OpenRouter) provider.

### Sampling Rate
- **Per task commit:** `cd frontend && npm test -- <touched-file>` (the specific hot-file test).
- **Per wave merge:** `cd frontend && npm test` (full suite; differential against the SEED-056 rot baseline).
- **Phase gate:** full vitest green (differential) + the SC#10 4-axis live UAT matrix passes with Deep Mode byte-identical, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/lib/__tests__/toolMeta.test.ts` — assert `outerBannerLabel` default byte-identical + new `reasoningActive` branch (STATE-03 + D-14 guard).
- [ ] New StreamsProvider catch test — `status===403` → amber field set + `clearWorkflowLockForThread` called; 400/409 paths unchanged (STATE-01b).
- [ ] Extend `MessageItem.test.tsx` — empty-content `runStatus='cancelled'` → `cancelled-no-output` testid (STATE-01a).
- [ ] Extend the reconcile-race / dedup test with a **pre-runId** duplicate scenario (STATE-04 avatar).
- [ ] (If workflow renders a separate strip) a timer-anchor test for that strip; else extend RunCard timer test for the kickoff-placeholder `startedAt`.

## Security Domain

> `security_enforcement` absent in config → treated as enabled. This is a render-layer chat phase with **no new attack surface** (no new endpoint, no new input, no auth/crypto/access-control change).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | unchanged |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | The 403 kill-switch authz is already enforced server-side (`workflow_kickoff.py`); 174 only renders its message. |
| V5 Input Validation / Output Encoding | **yes** | The amber bubble renders `ApiError.message` (a server string) as **React text children**, never `innerHTML` — inherits the established XSS-safe pattern (`RunStatusStrip.tsx:39-40`, `RunCard` run-sub `T-095.1-03-01`, and the `:2069` branch's existing "rendered as React text, never HTML → T-099-08-01"). |
| V6 Cryptography | no | unchanged |

### Known Threat Patterns for this surface
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via server error string in the amber bubble | Tampering / Info-disclosure | Render as React text children only (never `dangerouslySetInnerHTML`) — matches the existing `reconcileErrors`/RunStatusStrip pattern. |
| Cross-thread lock/state leak (parallel threads) | Info-disclosure | All lock/error/timer state is per-thread keyed (`workflowLockByThread`, `reconcileErrors` Maps keyed by `threadId`) — never a global flag (BUG-260523-01). STATE-01b's `clearWorkflowLockForThread(threadId)` must use the OWNING `threadId` closure, not the viewed thread. |

## Sources

### Primary (HIGH confidence — verified against live code this session)
- `frontend/src/components/chat/MessageItem.tsx:450-687` — terminal render states, amber primitive, STATE-03 call site, RunCard mount gate.
- `frontend/src/lib/toolMeta.ts:56-100` — `outerBannerLabel` signature + the dead "Setting up agent…" gate.
- `frontend/src/providers/StreamsProvider.tsx:380-499, 1695-1868, 1995-2126` — reasoning/tool-args accumulation, workflow-lock seed/clear, kickoff placeholder stamp, sendMessage catch.
- `frontend/src/components/chat/RunCard.tsx:86-256` — the 095.1 `started_at`-anchored timer + single avatar.
- `frontend/src/components/chat/RunStatusStrip.tsx` (full) — the `⏱ · Step N · activity` strip.
- `frontend/src/lib/dedupMessages.ts` (full) + `frontend/src/components/chat/MessageList.tsx:154-180` — the dedup + key seam.
- `frontend/src/lib/api.ts:145-204` — `_mapMessageResponse` cold-reload derive.
- `backend/app/api/threads.py:320-362, 760-788, 925-963` — the runs enrich/zip + workflow-kickoff preflight.
- `backend/app/services/workflow_kickoff.py:184-203` — the 403 kill-switch origin.
- `backend/app/services/agent_loop.py:1490-1555, 1906-1916` — empty-row persistence + `reasoning_delta` emit (OpenAI path; no-op anthropic/google).
- `backend/app/services/run_producer.py:157-204` — the finalizer writing `runs.status` + `message_id` on terminal (incl. cancelled).
- `backend/app/services/provider_gateway/openai_compat.py:265-328` — the cross-provider `<think>`/`reasoning_content` → `reasoning_delta` normalization.

### Secondary (design bar — operator-approved)
- `.claude/skills/sketch-findings-agentic-rag/references/run-state-honesty.md` — sketches 129-C / 130-C, D1-D6, CSS/HTML patterns, "what to avoid".
- `.planning/phases/174-run-state-lifecycle-honesty/174-CONTEXT.md` (D-01..D-15) + `174-SPEC.md` (5 locked requirements + acceptance criteria).
- `.planning/reported-bugs/BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar.md` — STATE-04 DB-confirmed-render-only evidence.

### Tertiary (LOW confidence / needs plan confirmation)
- The exact workflow-run chat-receipt component owning the STATE-04 timer (RunCard vs a separate strip) — plan confirms during Wave 0.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every reused module read this session.
- Architecture / seams: HIGH — all file:line anchors verified against live source.
- STATE-01a/02 verify conclusion: HIGH — the full persist→finalize→zip→map→render chain traced.
- STATE-03 cross-provider claim: HIGH — confirmed in the gateway + agent_loop, not inferred.
- STATE-04 timer/avatar root cause: MEDIUM-HIGH — kickoff-stamp gap + pre-runId dedup gap verified; the exact workflow strip component is a plan-Wave-0 confirmation (Open Q4 / A3).

**Research date:** 2026-07-22
**Valid until:** ~2026-08-21 (stable internal codebase; re-verify line numbers if the hot files are edited before planning — they are G-5 hot).
