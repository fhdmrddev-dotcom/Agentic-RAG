# Phase 174: Run-State & Lifecycle Honesty - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

> **Mode:** Discussed autonomously (`--auto` semantics — operator left unattended, instructed "select best options"). Every gray area was resolved to the recommended option, grounded in a live code scout (2026-07-22) + the operator-approved sketches 129-C / 130-C. All decisions below are locked for the researcher + planner.

<domain>
## Phase Boundary

Every run's lifecycle state is **honestly reflected in the chat surface** — a cancelled/killed run never shows an empty or blank bubble, a stopped run's indicator survives navigation AND a full cold reload, the pre-answer "setting up" state shows the model *actually working*, and a workflow run's timer + avatar stay accurate on navigation — verified across providers with **Deep Mode byte-identical**.

This is a **render-layer / chat-surface** phase over **persisted `runs.status` (authoritative — FND-01 / Phase 145)** and **events the backend already emits** — no backend persistence, no migration, no shared Deep/agent-loop/provider fork (D-14 red line). The panel-side failure taxonomy (`run-honesty.md`) is out of scope; 174 is the chat-surface terminal/lifecycle states only.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `174-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `174-SPEC.md` before planning or implementing. Requirements are not duplicated here.

- **STATE-01a** — Deep cancelled-no-output (VERIFY): early cancel shows "cancelled — no output yet", never an empty avatar-only bubble.
- **STATE-01b** — Killed-workflow honest reason bubble (BUILD): a workflows kill-switch 403 renders an honest reason, never a blank workflow card.
- **STATE-02** — Stop indicator survives nav + reload (VERIFY reload-derive): a stopped/cancelled message stays visibly marked after nav AND full cold reload.
- **STATE-03** — Pre-answer banner shows live activity (BUILD, frontend only): the pre-first-token state reflects real work instead of a static "Setting up agent…".
- **STATE-04** — Workflow-run timer anchored + single avatar (BUILD): nav to a streaming workflow run keeps the timer accurate + renders exactly one avatar.

**In scope (from SPEC.md):**
- Verify STATE-01a holds live cross-provider (incl. DeepSeek early cancel) + after reload; fix any gap found.
- Build STATE-01b: the killed-workflow 403 honest reason bubble in `StreamsProvider.sendMessage`'s catch + clear the stray workflow-lock.
- Verify STATE-02 stop indicator persists across nav + full cold reload; wire the `runStatus`-from-`runs.status` reload-derive if it is not already.
- Build STATE-03: frontend banner/pre-answer honesty — show reasoning / tool-args / sandbox live sub-state (sketch 130-C run-header) from already-emitted events.
- Build STATE-04: anchor the workflow-run timer to `started_at` + resolve the duplicate-avatar double-mount (single avatar).
- Cross-provider SC#10 4-axis live UAT (cross-provider × multi-tool × parallel-thread × long-message).
- Render-layer only, over persisted `runs.status` + wire events the backend already emits.

**Out of scope (from SPEC.md):**
- Title-generation serial→async (BUG-260607-02 cause 2) — separate backend latency work; honest-label only here.
- Sandbox cold-start pre-warm / pool (BUG-260607-02 cause 3) — infra/SEED territory.
- OpenRouter-specific failures — experimental provider; fix only if native-safe + low-complexity.
- Any backend persistence change or migration — `runs.status` is authoritative (FND-01 / Phase 145).
- Any change to the shared Deep / agent-loop / provider path (D-14); Deep Mode byte-identical.
- The panel failure-card taxonomy — `run-honesty.md` covers panel-side failures.

</spec_lock>

<decisions>
## Implementation Decisions

### STATE-01a + STATE-02 — Verify-first, surgical-fix-only-if-a-gap-is-found
- **D-01:** These are **VERIFY, not rebuild.** The live scout (2026-07-22) confirms BOTH halves already exist and must NOT be re-implemented from scratch:
  - **Render conditions exist:** `MessageItem.tsx:627` renders `cancelled — no output yet` (`data-testid="cancelled-no-output"`) for `runStatus === "cancelled"` + empty content; `MessageItem.tsx:670` renders the persistent `Response stopped` indicator for `(runStatus === "cancelled" && !!content) || timed_out` (Phase 147 / D-03).
  - **Cold-reload hydration exists:** `backend/app/api/threads.py:346-353` zips `runs.status` onto each assistant message (`m["run_status"] = run["status"] if run else None`) on `GET /messages`; `frontend/src/lib/api.ts:198` maps `run_status → runStatus` in the shared row mapper (`_mapRow`, ~L147-198). `useMessages.ts` carries **zero** `runStatus` logic — StreamsProvider + the api mapper own it. So `message.runStatus` **is** re-derived from persisted `runs.status` on a cold reload.
- **D-02:** Work = **live cross-provider UAT + a full cold-reload check**, not code churn. Prove STATE-01a on DeepSeek (the original empty-bubble / slow-first-token / DSML-strip case) **plus ≥1 other provider**, and STATE-02 across (a) nav-away-and-back AND (b) a full cold browser reload. **Only if UAT surfaces a real gap** do we patch it surgically at the render/derive seam.
- **D-03:** **Highest-probability residual gap to probe first** (so UAT isn't blind): the `threads.py:346-353` run-join must pick **the message's own run** and must populate `run_status='cancelled'` even for the **empty (content_len=0) early-cancel row** (DeepSeek run `64cebee7` / msg `7fcc704c` from the bug's DB evidence). If the join misses a message whose run row exists but content is empty, STATE-01a's render never fires on reload → that's the surgical fix (correct the join/derive, no new persistence).

### STATE-01b — In-chat AMBER administrative-block bubble (not the red-error / rollback-banner path)
- **D-04:** Per **sketch 129-C's tiered vocabulary**, a workflows kill-switch **403** is an **administrative block = AMBER**, NOT a failure (red) and NOT a silently-dropped send. In `StreamsProvider.sendMessage`'s catch, add a **targeted branch** that **replaces the empty assistant placeholder for that send with an honest in-chat amber bubble** carrying the server's `ApiError.message` (e.g. "Workflows are currently disabled by the administrator"), and **clears the harness workflow-lock seeded at kickoff** if no run registered (so the composer is not left locked).
- **D-05:** **Scope guard — do NOT regress the existing Deep 400/409 paths.** The current non-409 `ApiError` branch (`StreamsProvider.tsx:2069-2084`) rolls back BOTH optimistic bubbles + shows a per-thread `reconcileErrors` banner + stashes the draft (the disabled-skill 400 case). That path stays byte-identical. STATE-01b is a **new, narrower branch** keyed to the workflow-launch kill-switch 403 (and the companion app-layer ban 403 the SPEC notes) that renders the amber in-chat block instead of the rollback-banner. Distinguish it by status + workflow-lock context — the researcher confirms the exact discriminator (403 + workflow-locked send).
- **D-06:** **Reuse the existing amber styling primitive** — `MessageItem.tsx:467-473` (`model-fallback-notice`) already renders an amber notice (`border-amber-400/30 bg-amber-400/10 text-amber-400/90`). The STATE-01b block matches that visual family so the surface stays consistent (sketch 129-C's amber tier).

### STATE-03 — Count reasoning + tool-args as activity in the pre-answer label (frontend render-derive)
- **D-07:** Make the pre-first-token state honest by counting **already-emitted activity** as activity. `frontend/src/lib/toolMeta.ts:68 outerBannerLabel()` returns `"Setting up agent…"` for `!hasAnyTools && !isPlanning` and ignores reasoning/arg-streaming. Extend it (+ its call site `MessageItem.tsx:620`) to surface a **live "Reasoning…" sub-state** (sketch 130-C's run-header sub-state) when the model is streaming reasoning or writing tool-args, instead of the dead "Setting up agent…".
- **D-08:** **Signal source = state the frontend already stamps.** `message.reasoningContent` is accumulated from reasoning deltas (`StreamsProvider.tsx:409`); `tool_args_progress` / `tool_preparing` already create a `preparing` tool entry (`StreamsProvider.tsx:461`). Derive the sub-state from these — **no new backend event, no backend latency work.** Deep Mode byte-identical (the label branch is the only change; every other `outerBannerLabel` branch unchanged).
- **D-09:** **Cross-provider research flag (for the researcher):** the sketch's motivating case is **Kimi/Moonshot (~4,000 reasoning tokens)**, but `reasoningContent`'s doc-comment says "DeepSeek reasoning". The researcher MUST confirm the reasoning-activity signal is populated **cross-provider** (Moonshot, GLM/zhipu, plus the generic `reasoning_delta` SSE), not DeepSeek-only — and if a provider streams reasoning through a channel the frontend doesn't yet count, wire that counting at the render layer (still no backend change). Optional polish per sketch 130-A: reasoning-token count + elapsed alongside the label — nice-to-have, not required for acceptance.
- **D-10:** **Honest-label ONLY — the latency causes stay OUT.** Title-gen serial→async and sandbox cold-start pre-warm (BUG-260607-02 causes 2 & 3) are explicitly deferred (see Deferred). 174 makes the *existing* wait legible; it does not shorten it.

### STATE-04 — Anchor the workflow-run timer to started_at + dedupe the double-mount avatar
- **D-11:** **Timer:** the workflow/harness run-strip currently reseeds elapsed **from component mount** on nav-back (a multi-minute run reads "28s"). **Reuse the Phase 095.1 Deep-run-card fix** — seed elapsed from the run row's `started_at`/`created_at`, extended to the workflow/harness strip — so the timer keeps climbing on nav. (Confirm which strip owns the workflow timer; 095.1 fixed the Deep run-card, this extends the same pattern to the workflow surface.)
- **D-12:** **Avatar:** resolve the **StreamsProvider/MessageList double-mount** (the kickoff optimistic-placeholder + first-SSE-event race, and the nav-back remount) so **exactly one** assistant avatar renders. Backend is already correct (DB-confirmed **1 assistant row per run**); this is a pure frontend reconcile/dedup fix at the MessageList key/reconcile seam. Both symptoms fixed together (SPEC-locked: STATE-04 = timer + avatar).

### Cross-cutting — G-5 audit, SC#10, design bar
- **D-13:** **G-5 hot-file audit conclusion → no refactor-first required.** Touched files (`MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `threads.py`) are G-5 hot, but 174 is **render-layer-only over persisted state + already-emitted events**; the `threads.py` producer extraction was already paid down in Phase 162.5. Changes are additive at the render/derive seam — G-2 (sketch gate) is satisfied by operator-approved 129-C/130-C. Re-run the replay/render tests; do not regress the shared render path (D-14).
- **D-14:** **SC#10 4-axis live UAT is mandatory** — cross-provider (OpenAI, Anthropic, Google, one of DeepSeek/Moonshot/GLM — DeepSeek required for STATE-01a) × multi-tool (≥1 row with 2+ tools) × parallel-thread (Thread A streaming while Thread B accepts a prompt) × long-message (≥50 prior msgs OR ≥5KB prompt, stays manual per provider). Authored under `VALIDATION.md`, not PLAN tasks.
- **D-15:** **Design acceptance bar = sketches 129-C + 130-C** (operator-approved). 129-C = tiered **dim** (user-chosen: Stopped · Cancelled) / **amber** (administrative block: kill-switch 403) / **red framed** (genuine failure) keyed off `runs.status`. 130-C = run-header carries a live activity pill + a `started_at`-anchored timer + a single avatar. The tier ladder = "quiet & calm, red for real failure — the louder the frame, the more it's earned."

### Folded Todos
None — no pending todo matched this phase's scope for folding.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements + design bar (read first)
- `.planning/phases/174-run-state-lifecycle-honesty/174-SPEC.md` — Locked requirements, boundaries, acceptance criteria. **MUST read before planning.**
- `.planning/sketches/129-terminal-run-states/README.md` + `.planning/sketches/129-terminal-run-states/index.html` — Design bar for STATE-01/02: tiered dim/amber/red terminal vocabulary off `runs.status` (winner **C**). Toolbar demonstrates the STATE-02 reload-persist proof.
- `.planning/sketches/130-live-preparing-honesty/README.md` + `.planning/sketches/130-live-preparing-honesty/index.html` — Design bar for STATE-03/04: run-header live sub-state + `started_at`-anchored timer + single avatar (winner **C**). Toolbar "Nav away & back" = the STATE-04 proof.
- Project skill `sketch-findings-agentic-rag` (`Skill("sketch-findings-agentic-rag")`) — validated CSS/visual patterns for the run-card frame, never-vanishes run-status strip, tool-call panel, MessageItem terminal states; auto-load when building any of these surfaces.

### Frontend render surface (the change site)
- `frontend/src/components/chat/MessageItem.tsx` — `:616-626` pre-answer no-tools thinking branch (STATE-03 label call site, `:620`); `:627-644` cancelled-no-output render (STATE-01a, exists); `:670-680` persistent "Response stopped" indicator (STATE-02, exists); `:467-473` amber `model-fallback-notice` styling primitive to reuse for STATE-01b.
- `frontend/src/lib/toolMeta.ts` — `:68 outerBannerLabel()` (STATE-03; `:80` is the dead "Setting up agent…" gate).
- `frontend/src/providers/StreamsProvider.tsx` — `:2047-2093` `sendMessage` catch (STATE-01b new amber branch; `:2069-2084` existing rollback-banner path to NOT regress); `:409` `reasoningContent` accumulation + `:461` `tool_args_progress`/`preparing` entry (STATE-03 signal); the kickoff optimistic-placeholder + reconcile/remount seams (STATE-04 avatar dedupe).
- `frontend/src/lib/api.ts` — `:147-198` `_mapRow` (`run_status → runStatus`), `getMessages` (`:242`), `getSnapshot` (`:1037`) — the cold-reload hydration path (STATE-01a/02 derive).
- `frontend/src/hooks/useMessages.ts` — message hydration; carries NO runStatus logic (confirms StreamsProvider + api mapper own it).
- `frontend/src/types/index.ts` — `:158-199` `Message.runStatus` (5-value enum), `.stopped`, `.reasoningContent`, `.isPlanning` field contracts.
- The Phase 095.1 Deep-run-card `started_at`-timer-anchor implementation (find the RunCard/RunStatusStrip timer) — the pattern STATE-04 extends to the workflow strip.

### Backend derive (verify, no change expected)
- `backend/app/api/threads.py` — `:346-353` runs.status→message run_status zip (STATE-01a/02 reload-derive); `:677` `get_messages`; `:949` workflow kill-switch 403 origin (STATE-01b); `:1083-1246` workflow `run_status`. **No backend change expected — verify only** (no migration, `runs.status` authoritative).

### Folded reported bugs (the 5, now `folded_into: "174"`)
- `.planning/reported-bugs/cancelled-run-empty-bubble-early-cancel.md` (BUG-260710-02) → STATE-01a. DB evidence: DeepSeek run `64cebee7`, empty msg `7fcc704c` (content_len=0).
- `.planning/reported-bugs/killed-workflow-empty-chat-card.md` (BUG-260712-01) → STATE-01b. Suggested-fix shape lives here.
- `.planning/reported-bugs/cancelled-run-stop-indicator-lost-on-navigation.md` (BUG-260710-01) → STATE-02. DB evidence: OpenAI run `f2d7acef`, 1606 chars, status=cancelled.
- `.planning/reported-bugs/setting-up-agent-hides-model-activity.md` (BUG-260607-02) → STATE-03 (cause 1 ONLY; causes 2/3 deferred). Redis reasoning-timeline evidence table.
- `.planning/reported-bugs/BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar.md` → STATE-04. Provider-agnostic; DB-confirmed render-only (1 assistant row/run).

### Prior-phase anchors
- Phase 145 (FND-01 — `runs.status` authoritative run-lifecycle foundation) · Phase 147 (D-03 — cancelled render + stop-indicator persist) · Phase 095.1 (Deep run-card `started_at` timer anchor) · D-14 red line (never fork the shared path — provider handling at the gateway/adapter/sanitizer boundary).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Cancelled-no-output render** (`MessageItem.tsx:627`) — already built (Phase 147/D-03); verify, don't rebuild.
- **Persistent "Response stopped" indicator** (`MessageItem.tsx:670`) — already built; verify reload-persist.
- **Cold-reload runStatus hydration** (`threads.py:346-353` join + `api.ts:198` map) — already wired; the STATE-02 "is it re-derived on reload?" question resolves to **yes** at the data level.
- **Amber notice primitive** (`MessageItem.tsx:467-473`, `model-fallback-notice`) — reuse for STATE-01b's amber administrative-block bubble.
- **`reasoningContent` accumulation** (`StreamsProvider.tsx:409`) — the STATE-03 activity signal, already stamped on the message.
- **Phase 095.1 `started_at` timer anchor** — the exact pattern STATE-04 extends to the workflow/harness run strip.
- **Per-thread `reconcileErrors` + `failedSendDrafts` recovery seam** (`StreamsProvider.tsx:2081-2084`) — the shape the STATE-01b branch deliberately diverges from (amber in-chat vs banner).

### Established Patterns
- **`runs.status` is the single source of truth** (FND-01/Phase 145); render derives from it, never persists new state (no migration).
- **Render-layer-only over already-emitted SSE** — STATE-03/04 count existing `reasoning_delta` / `tool_args_progress` / `started_at`; no new backend events.
- **D-14 red line** — Deep Mode byte-identical; provider differences at the adapter/sanitizer boundary, never a shared-path fork.
- **Enum-conditional render (Pattern S1)** — terminal-state markers gate on the literal 5-value `runStatus` enum.

### Integration Points
- `sendMessage` catch (`StreamsProvider.tsx`) — new amber branch for the workflow-403 (STATE-01b), alongside the untouched 409/400 rollback paths.
- `outerBannerLabel` (`toolMeta.ts`) + its `MessageItem.tsx:620` call site — the STATE-03 sub-state derive.
- The workflow/harness run-strip timer + MessageList reconcile/remount seam — STATE-04 timer anchor + avatar dedupe.

</code_context>

<specifics>
## Specific Ideas

- **Tiered vocabulary (129-C):** dim = user-chosen (Stopped/Cancelled), amber = administrative block (kill-switch 403), red framed = genuine failure. "The louder the frame, the more it's earned."
- **Single instrument (130-C):** the run-card header owns the live pre-answer sub-state pill + the anchored timer + the single avatar — STATE-03 and STATE-04 are one surface.
- **Concrete UAT anchors from the bug DB evidence:** DeepSeek early-cancel (STATE-01a, the empty-bubble case); OpenAI mid-stream Stop with 1606 chars (STATE-02); Kimi/Moonshot ~4,000 reasoning tokens (STATE-03); a multi-minute Google/OpenRouter workflow run nav-back (STATE-04).

</specifics>

<deferred>
## Deferred Ideas

- **Title-gen serial→async** (BUG-260607-02 cause 2, `threads.py` serial `generate_thread_title` before agent spawn) — separate **backend latency** work; 174 makes the wait honest, does not shorten it. Route to a future run-legibility & latency phase.
- **Sandbox cold-start pre-warm / pool** (BUG-260607-02 cause 3, 15-22s per new thread) — infra/SEED territory (SEED-069 candidate), not a chat-polish fix.
- **OpenRouter-specific run-state failures** — experimental provider; out of the SC#10 mandate; fix only if native-safe + low-complexity, not this phase.
- **Panel-side run-honesty (BUG-260609-02 SUB-RESULTS desc loss, BUG-260609-04 phase-card `phase-0` slug)** — same workflow-run-display *cluster* but panel-side, not the chat terminal/lifecycle surface. Candidate for STRETCH Phase 178 (chat/nav polish) — NOT folded into 174 (SPEC boundary: panel taxonomy is `run-honesty.md`'s, not 174's).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (todo.match-phase score 0.6) — a **keyword false-positive** ("phases/run/status/first/during"). Semantically it is v3.6 NL→workflow authoring, wholly unrelated to run-state lifecycle honesty. **Reviewed and deliberately NOT folded** (scope discipline).

</deferred>

---

*Phase: 174-run-state-lifecycle-honesty*
*Context gathered: 2026-07-22*
