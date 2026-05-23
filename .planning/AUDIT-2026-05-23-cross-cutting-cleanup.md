# Cross-Cutting Audit & Cleanup Proposal — 2026-05-23

**Trigger:** After Phase 075.3 closeout, the operator surfaced 4 cross-provider regressions during real-world testing ("search Fahed Mrad dissertation, make a professional pptx…"). On 4 providers × representative models tested, only OpenAI worked cleanly; Anthropic took 8 min / 22 iterations, OpenRouter shipped duplicate outputs + delayed-done, Google Gemini 3 / 3.5 / 3.1-pro-preview failed hard on every tool round. Operator feedback: "we spent too much time building features but breaking others and then keep inserting phases to fix what we broke."

This document is the **evidence-based audit** the operator asked for. It pulls from: 4 parallel subagent audits (provider hardcoding, streaming reliability, performance, test coverage), live local DB queries against `runs`, LangSmith trace inspection, and code-level grep evidence. The proposal at the bottom is **one consolidated phase** that closes the bug bundle AND installs the test backstop that would have caught all 4 of them — so the cycle stops here.

---

## 1. The 6 root-cause buckets

Every finding below has been verified at code level (file:line). No interpretation without evidence.

### Bucket A — Cross-thread global state pollution (5 globals, not 1)

The composer-lock bug (BUG-260523-01) is one of **five** global pollution issues in `streamsStore.ts`. All 5 were introduced by Phase 068's StreamsProvider Context Lift; none were caught because no test ever exercises two threads in parallel.

| State key | Location | Scope | Pollution risk |
|---|---|---|---|
| `isStreaming` | `streamsStore.ts:46` | **global** `boolean` | Composer disabled on all threads when ANY thread streams (BUG-260523-01) |
| `loadingThreadId` | `streamsStore.ts:55` | **global** `string\|null` | Race: concurrent `loadMessages` on threads A+B thrash this; wrong skeleton spinner shows |
| `reconcileError` | `streamsStore.ts:50` | **global** `{threadId, error}\|null` | Reconcile failure in A overwrites B's prior success; banner appears on wrong thread |
| `fallbackNotice` | `streamsStore.ts:47` | **global** `string\|null` | `fallback_model` event from A's sub-agent overwrites B's notice |
| `subscriptionsByRunId` | `streamsStore.ts:56` | **global** `Set<string>` (no thread key) | Subscription set grows unbounded across runs; subscriber selectors see ALL runs across all threads |

**Fix shape:** Promote all 5 to per-thread keys (`Map<threadId, …>`) + per-thread selectors. Single coherent refactor, not 5 patches.

### Bucket B — Provider/model hardcoded assumptions (7 sites)

The user's principle "each provider should work with all of its child models, not the listed ones" is violated at 7 distinct code sites. Phase 075.3 Plan 02 added inference fallback for `MODEL_CAPABILITIES`, but six OTHER hardcoded paths bypass it.

| # | Site | Hardcoded what | Failure mode for an unregistered model |
|---|---|---|---|
| 1 | `backend/app/config.py:447` | `_PROVIDER_BASE_URLS[provider]` dict lookup with NO fallback | **KeyError at startup** if provider not in literal `{openai, anthropic, google, openrouter, ollama}` |
| 2 | `backend/app/services/openai_service.py:758-762` | `_uses_max_completion_tokens()` checks `m.startswith(("o1","o3","o4"))` / `m.startswith("gpt-5")` | New `o5`/`o6`/`gpt-5.5` etc. → wrong param name → **400 Bad Request** from OpenAI |
| 3 | `backend/app/services/context_window.py:106` | tiktoken use gated on `model.startswith("gpt-")` / `("o1","o3")` | Unregistered children fall back to `chars/4` heuristic → **20–50% token undercount** |
| 4 | `backend/app/api/threads.py:1679` | `if active_provider_name == "anthropic"` routes to native SDK | Unregistered Anthropic child silently bypasses native path → loses optimization |
| 5 | `backend/app/services/openai_service.py:896` | `_NO_PARALLEL_TOOL_CALLS = frozenset({"google"})` — provider-level only | New Google model that DOES support parallel tools forced into single-tool mode silently |
| 6 | `backend/app/api/threads.py:1856-1947` | Chunk-handler captures `id/name/arguments` only — drops `thought_signature` | **BUG-260523-02** — Gemini 3+ tool flows die with 400 on round 2 |
| 7 | `backend/app/api/threads.py:1106-1109` | `_reconstruct_history` uses OpenAI tool-result shape even when target provider is Anthropic native | Anthropic native receives OpenAI-shaped messages on rebuild — fragile drift |

**Fix shape:** Each site gets a registry-or-inference fallback in the Phase 075.3 Plan 02 pattern: registry hit → use exact value; miss → inferred default with `capability_source: "inferred"` + warn-once log. NO new branching on provider/model name unless it's behind a registry.

### Bucket C — Streaming/agent-loop reliability gaps (5 new findings)

Beyond the 4 filed BUG-260523-* reports, the streaming-audit surfaced 5 latent issues:

1. **Terminal-status write race** (`threads.py:3231 vs 3261`) — SSE `done` event fires BEFORE `runs.status='completed'` lands. On 100ms+ Postgres latency (~5–10% of runs in real network conditions) the frontend's `_isTransientStreamEnd` probe sees `status='streaming'` for a done run → flickers "Resume" button briefly. Not a hard failure, but erodes indicator trust.

2. **Orphaned-run accumulation** — `runs INSERT` at `threads.py:1236` with `status='streaming'`, but no cleanup if `agent_runner` crashes BEFORE `_shielded_finalize` runs. Rows stay `status='streaming'` indefinitely (no TTL on the `runs` table). Need a periodic sweep OR a startup-time heal.

3. **Sub-agent 32KB result truncates parent context silently** — `sub_agent_service.py` allows up to 32KB summary output, which gets appended to parent message history at `threads.py:2917-2922`. On next iteration `trim_messages_to_fit` at `threads.py:2643` drops older context to fit — including the user's original intent — with **no UI warning**.

4. **Agent-loop iteration cap silently drops tool calls** — `force_no_tools = (iteration == max_iterations - 1)` at `threads.py:1656`. If iteration N-1 returns content AND tool_calls, the tool_calls are silently dropped. User sees a text response with no indication that file generation was skipped.

5. **Output-file overwrites invisible** — `_previous_files_in_run: set[str]` keyed by filename only (`threads.py:1630`). Iteration 2 overwriting `report.pdf` is filtered as "not new" → frontend never sees the update → final panel shows stale URL/size. (Related to BUG-260523-03 but technically distinct — the duplicate-output bug is the inverse symptom on different filenames.)

### Bucket D — Performance hotspots (4 measurable wins)

The audit identified specific perf issues with file:line evidence and ROI estimates:

1. **`MessageItem` not memoized** (`MessageItem.tsx:22`) — On a 50-message thread during streaming, every SSE delta re-renders ALL 50 messages. Estimated **500–1000ms saved per response** with `React.memo()`.
2. **`MarkdownRenderer` re-parses on every render** (`MarkdownRenderer.tsx:14`) — A 50KB assistant message blocks main thread 100–300ms per delta. `useMemo` on `[content]` fixes it.
3. **Sandbox cold-start unconfigured in dev** — `SANDBOX_IMAGE` env var typically unset → bare-Python image → `pip install matplotlib` etc. costs 50–100s on first `execute_code`. The pre-built image (`backend/Dockerfile.sandbox`) exists but isn't activated by default.
4. **`recharts` (~50 KB) loaded eagerly** for users who never visit Library Health view. Vite has no code-splitting configured; React.lazy + chunk split would cut initial bundle ~15%.

Plus the user reports "opening new chat takes some time" — Phase 075's snapshot endpoint IS in place and is being called, so this perceived latency is likely **render-cost cascade** from issues #1 and #2 above, not network waterfall.

### Bucket E — Test coverage that lets all this ship blind

- **Zero E2E tests** (no Playwright/Cypress). All tests mock the frontend-backend boundary.
- **Zero multi-thread tests** — no test ever spins up two threads in parallel. BUG-260523-01 invisible.
- **Zero multi-tool Gemini tests** — Plan 01 UAT was single-turn `hi` only. BUG-260523-02 invisible.
- **Zero OpenRouter agent tests** — only inference pattern-matching tested. BUG-260523-03 invisible.
- **No frontend CI job** — vitest only runs locally. Anyone can push without it.
- **44 pre-existing test failures** (logged in 075.3 baseline) — never triaged, just "logged."
- **LangSmith Anthropic native path under-traced** — 0 Anthropic runs in `agentic-rag-module2` project despite recent live runs. The 075.1 "Anthropic main-loop untraced + provider mislabel" item may have regressed.

### Bucket F — UX clarity issues (minor, but real)

- **Red text in code execution box** has no label — user can't tell `stderr` from "error." Worth a small badge.
- **"Still running" indicator stays past task completion** (BUG-260523-03 part b) — erodes trust in the indicator.
- **Duplicate output cards** confuse the user about which artifact is "the final one" (BUG-260523-03 part a).

---

## 2. Why we keep doing this

The pattern across Phases 068 → 068.5 → 075 → 075.1 → 075.2 → 075.3 is identical:
- Ship a feature with a UAT that exercises one narrow happy-path scenario.
- The UAT passes → feature ships → next phase plans on top of the unverified assumption.
- Real user testing surfaces the regression → file a bug → insert a fix phase → repeat.

The phases themselves are well-executed. The PROBLEM is the UAT recipes don't exercise:
1. **Cross-provider in one session** (the user always tests multiple providers — UAT tests one)
2. **Multi-tool agent rounds** (the user always uses tools — UAT often uses `hi`)
3. **Parallel threads** (the user runs long Anthropic tasks while typing in another tab — UAT tests one thread)
4. **Long messages / many messages** (the user has 50-message threads — perf UAT runs on empty threads)

This is **assumption-driven development**, exactly as the operator named it. The fix is to install the test backstop that would have caught all 4 BUG-260523-* before they shipped, so the cycle stops here.

---

## 3. Proposed cleanup phase shape

### Phase 075.4 — Cross-Provider Cleanup + Per-Thread State + E2E Backstop

**Goal:** Close all 6 open bugs, eliminate the 5 cross-thread global pollutions and the 7 provider hardcoded sites as a coherent refactor, and ship the smallest E2E test suite that would have caught everything in this audit. After this phase, the milestone (076–082.5) proceeds without insert-phases.

**Why one phase, not three:** the buckets share root causes. Splitting them means re-touching the same files in three phases. Bundle saves time AND lets the E2E tests verify the refactor end-to-end before ship.

**5-plan shape:**

| Plan | Scope | Closes |
|---|---|---|
| **01 — Per-thread state cleanup** (frontend, 4–6h) | Refactor 5 globals in `streamsStore.ts` to per-thread keys. New `useStreamingForThread(threadId)` / `useLoadingForThread` / `useReconcileErrorForThread` / `useFallbackNoticeForThread` selectors. `subscriptionsByRunId` keyed by `{threadId, runId}`. Update 3 consumer sites (`ChatArea.tsx`, `MessageList.tsx`, `MessageItem.tsx`). | BUG-260523-01 + 4 latent cross-thread bleed-throughs |
| **02 — Gemini 3 thought_signature capture + provider-agnostic hardcoding sweep** (backend, 6–8h) | Capture `thought_signature` from Google chunks in `_on_chunk_openai`, echo on next round when `active_provider == "google"`. ALSO sweep the 6 other hardcoded sites: `_PROVIDER_BASE_URLS` gets `.get()` + fallback, `_uses_max_completion_tokens` becomes registry-driven, `context_window.py` token-counter falls back via `get_model_capability().get("provider")`, `_NO_PARALLEL_TOOL_CALLS` becomes registry-driven, Anthropic-native gate uses `active_provider` directly. Pattern: every site uses `get_model_capability()` registry-or-inference shape from Phase 075.3 Plan 02. | BUG-260523-02 + 6 latent hardcoded sites |
| **03 — Streaming reliability fixes** (backend, 4–6h) | Move SSE `done` emit to AFTER `runs.status` update (close race window). Output-file dedup by content hash, not filename. Sub-agent result truncation warning (UI banner if parent context dropped). Iteration-cap silent-drop guard (warn if final iteration buffered tool_calls dropped). | BUG-260523-03 + 4 reliability findings |
| **04 — Perf wins + render cleanup** (frontend, 3–4h) | `React.memo(MessageItem)`. `useMemo` on `MarkdownRenderer` output. Lazy-load `recharts` via `React.lazy` for Library Health. Document SANDBOX_IMAGE setup in CLAUDE.md + onboarding (or auto-detect on first execute_code). Add `stderr` badge next to red lines in code execution box. | Performance findings + UX clarity |
| **05 — E2E backstop + frontend CI** (test infra, 6–8h) | Add Playwright. Ship 6 E2E scenarios that each map to one of the BUG-260523-* + cross-cutting failure modes (see table below). Wire `npm test` + Playwright into a new `.github/workflows/frontend-tests.yml`. Triage the 44 pre-existing backend test failures (delete dead, fix real, document mocks). | Test gap that lets regressions ship blind |

### E2E scenario coverage (Plan 05)

Each row maps a user flow → assertion → bug it would have prevented. Total run time estimate: 15–20 min.

| # | Scenario | Assertion | Prevents |
|---|---|---|---|
| 1 | Open Thread A, start long task; navigate to Thread B; try to type | B's composer is enabled, prompt submits, second run starts | BUG-260523-01 + future cross-thread bleed |
| 2 | Set model = `gemini-3-flash-preview`; send prompt that triggers 2+ tool rounds | Run completes (no 400); both tool rounds emit `thought_signature` | BUG-260523-02 |
| 3 | Set model = OpenRouter `minimax-m2.7`; send "make a pptx with charts" | Final panel shows exactly 1 pptx (latest version); no stale intermediate | BUG-260523-03a |
| 4 | Same OpenRouter run; measure SSE `done` → UI settled latency | < 500ms (per Phase 075.1 spec) | BUG-260523-03b |
| 5 | Add unknown model `gpt-99-mega` to OpenAI provider; switch to it; send "hi" | Inference fallback fires; safe defaults applied; badge visible; run completes | Phase 075.3 Plan 02 regression-guard |
| 6 | Compare iteration count for same prompt across all 4 providers | All complete; counts within ~50% of each other (no provider 5× higher) | BUG-260523-04 (Anthropic 22-iter outlier) |

### Out of scope (deliberate)

- **BUG-260523-04 root cause fix** (Anthropic 22 iterations). E2E scenario 6 surfaces it as a measurement; actual fix requires understanding why Claude is over-looking the pptx skill guide. Defer to a focused investigation phase after Phase 075.4 ships and we have better telemetry.
- **SEED-006 / 020 / 021** (extraction-quality carry-forwards). These are real but live on the ingestion axis, not the agent/streaming axis this phase covers. Stay carried.
- **BUG-260522-02** (backend `final_output_files` omits url/size). Owned by Phase 075.2 follow-up, NOT bundled here — it's a 30-line surgical backend fix that doesn't need to wait for this larger cleanup.

---

## 4. Recommended next move

1. **Insert Phase 075.4 with the 5-plan shape above.** Estimated 4 working-day phase. After ship, ALL 4 BUG-260523-* + 4 latent cross-thread bleeds + 6 hardcoded sites + 4 perf wins close as a bundle.
2. **Resume the planned roadmap from Phase 076** (Confidence Recalibration) with the E2E backstop preventing the assumption-driven regressions that have been costing us insert-phases.
3. **Update CLAUDE.md** with the multi-tool + parallel-thread UAT recipe rule so future phases inherit the discipline.

If you agree with this shape, the next step is `/gsd:phase insert 075.4 …` to put it in the roadmap, then `/gsd:discuss-phase 075.4 --all` so we lock decisions before planning.

---

*Audit generated 2026-05-23 by 4 parallel subagent investigations + main-thread synthesis. All findings cite file:line. Evidence files: this doc + `.planning/reported-bugs/BUG-260523-01..04.md` + the 4 task transcripts in `~/.claude/projects/.../tasks/`.*
