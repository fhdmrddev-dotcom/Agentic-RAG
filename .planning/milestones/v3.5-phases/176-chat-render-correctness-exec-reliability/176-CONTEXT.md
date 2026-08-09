# Phase 176: Chat Render Correctness + Exec Reliability - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

> **Mode:** Interactive discuss (default). Four gray areas (EXEC-01, RENDER-01, RENDER-02, RENDER-03) selected + discussed; RENDER-04 taken on the recommended path. All decisions grounded in a live code scout (2026-07-22 — `tool_dispatcher.py:1642` install seam confirmed) + the 6 folded bug reports + Phase 174's carry-forward decisions. Locked for the researcher + planner.

<domain>
## Phase Boundary

The chat transcript renders each message **exactly once**, the final answer lifts **un-folded** at a clean terminal, a submitted send **always lands or fails honestly** (never a silent drop), an approved skill/description version pointer **updates live**, and `execute_code` **installs declared libraries reliably** (no silent no-op, no wasted retry rounds).

This is a **render-layer / reconcile-logic** phase over the frontend chat surface (`StreamsProvider.tsx`, `MessageItem.tsx`, `MessageInput.tsx`, `SkillTunerPage.tsx`) **plus one backend sandbox-install seam** (`tool_dispatcher.py` `_handle_execute_code` + `sandbox_service.py`). Bug-fix + honesty, **not** a net-new build. No shared Deep/agent-loop/provider fork (D-14 red line); Deep Mode byte-identical. No migration expected (app-layer fixes throughout). The EXEC-01 change lives **below** the provider boundary in the tool dispatcher, so it is provider-uniform and D-14-safe by construction.

Five requirements: **RENDER-01** (dedup user bubble), **RENDER-02** (un-fold final answer), **RENDER-03** (no silent send-drop), **RENDER-04** (live version pointer), **EXEC-01** (reliable library install). No SPEC.md — requirements are captured in the decisions below.

</domain>

<decisions>
## Implementation Decisions

### EXEC-01 — Reliable `execute_code` library install (the major-severity one)
- **D-01: Root mechanism is a swallowed install failure, not a skipped install.** The live scout confirms `session.install(libraries=...)` **IS** called before every `execute_code` that declares libraries (`tool_dispatcher.py:1642-1657`), but the `except Exception` at `:1653` **only logs a warning and runs the user code anyway** → the agent gets a raw `ModuleNotFoundError` with zero signal that the *install* failed. The 68ms-vs-6607ms evidence (BUG-260708-02) says the install is **intermittent** on a warm session, not never-run. The researcher MUST probe **why** `llm_sandbox`'s `session.install` sometimes returns/raises in ~68ms on a cached `SandboxSession` (warm-session race, silent CalledProcessError, or a no-op path) — that root cause drives the fix.
- **D-02: Scope = declared-install hardening + bounded ModuleNotFound auto-heal (operator-chosen).** Two failure modes get fixed, not one:
  1. **Declared `libraries`** install deterministically — retry the install **once** on failure; NEVER silently swallow.
  2. **Undeclared imports** (the common "model forgot to declare" case — SEED-043 half-b) — when the user code raises `ModuleNotFoundError`, auto-install the named module and **re-run the code once**.
- **D-03: Failure contract = honest tool-result, bounded to 1 heal cycle per module (operator-chosen).** If a package genuinely can't be installed (PyPI down, bad name, no wheel) after the retry/heal, return an **honest tool result** ("Could not install X: `<reason>`") instead of a raw traceback, so the model can adapt (use a preinstalled lib, tell the user) rather than blindly retrying. **One heal cycle per missing module** → no loops, no wasted retry rounds. No silent swallow anywhere on the path.
- **D-04: Provider-uniform, D-14-safe.** The change is entirely in the tool dispatcher / sandbox service, below the provider adapter boundary — it must behave identically across all providers (no `provider ==` fork) and cannot touch the shared Deep/agent-loop path. Preinstalled-set awareness (reportlab/pandas/matplotlib/… per `docs/SANDBOX-PACKAGES.md`) is a nice-to-have signal for the honest message, not required.

### RENDER-01 — Duplicate user bubble (optimistic temp + persisted row)
- **D-05: No-migration reconcile identity fix (operator-chosen).** Give the optimistic user temp a **matchable identity without a schema change** — the researcher picks the cleanest of two: (a) **re-key** the optimistic temp to the persisted user-row id returned by `postMessage` when it resolves (then the existing id-based dedup drops the duplicate on the next snapshot), or (b) **drop** an untyped user temp when the snapshot already holds an identical-content user row **newer than** the temp's `created_at`. Proportionate to a **minor** cosmetic bug + the ROADMAP no-migration preference. The durable `client_msg_id` + column approach was explicitly **rejected** as over-scoped for this milestone.
- **D-06: The 075.7 blank-thread preserve-guard is load-bearing — do NOT weaken it.** The fix must dedup *against the snapshot*; it must NEVER "stop preserving temps" (that guard exists to prevent the pre-stamp placeholder race that blanked fresh threads). Mirror the assistant-side dedup precedents (BUG-260609-03 / BUG-260626-01) on the user side, which never got one because user temps carry no `runId`.

### RENDER-02 — Final answer stays folded in the narration until reload
- **D-07: Extend the content-reconcile to the nav/mount-watched terminal path (operator-chosen).** Keep the already-applied 2026-07-07 **send-path** `onTerminal` content-reconcile (clean Deep terminal → fire-and-forget `getMessages` → swap only this run's bucket-message `content` to the persisted clean answer by `runId`). **Extend the same reconcile to the mount/reconcile-path terminal** — a backgrounded run watched after navigation (Thread B while Thread A streams, then switch back) must also resolve **un-folded without a reload**. This is precisely the **SC#10 parallel-thread** case, so it has to be proven live regardless — fix it rather than leave a reload dependency.
- **D-08: Live verification is part of acceptance.** BUG-260707-03 stays `open` chiefly because the applied fix was never live-confirmed. One live Deep run showing the answer resolving un-folded at run-end (no reload) is required before close.
- **D-09: SEED-094 (backend stray-last-line emit) is OUT of scope.** For runs where the backend persisted a stray interim line instead of the real final answer (e.g. GLM "All checks pass. Let me finalize…"), the reconcile faithfully shows that stray line — that is a **separate backend final-answer-emit bug** (SEED-094 / run-end honesty), not a render fix.

### RENDER-03 — Intermittent silent send-drop
- **D-10: Race-fix + honesty guarantee, with honesty load-bearing (operator-chosen).** Mechanism #1 (the global `isSendingRef` mutex) was **already root-fixed** in the per-thread `sendingThreadsRef` change (concurrent chats work — SEED-055 Part 1). This phase does BOTH remaining halves:
  1. **Tighten the fresh-thread ordering** so a send on a just-created/switched thread doesn't race thread-binding/reconcile (mechanism #2 — reduces frequency).
  2. **Honesty guarantee (the load-bearing one):** don't clear/lose the composer draft until the send is **confirmed dispatched**; on any non-dispatch, **restore the text + show a quiet "couldn't send — retry" hint**. Even if the race ever fires, the user never loses their message silently.
- **D-11: Route through the existing recovery seam.** Reuse the per-thread `failedSendDrafts` / `reconcileErrors` recovery machinery (`StreamsProvider.tsx` ~:2081-2084, the 400/409 rollback path) for the silent-drop case rather than inventing a new one — the seam already stashes the draft + surfaces a per-thread banner. Root cause of the invisibility: `MessageInput` clears the text **synchronously** (`MessageInput.tsx:126-127`) before dispatch is confirmed. Verify-and-close-only was **rejected** (mechanism #2 still drops, so "no silent send-drop" wouldn't be true).

### RENDER-04 — Approve → version pointer stale until reload (recommended path, not deep-dived)
- **D-12: Targeted versions-query refetch after approve.** In `handleApproveDescription` (`SkillTunerPage.tsx:531`), after `approveDescriptionProposal(...)` + the existing `loadSkills()` (WR-05 reconciles the description text), **also invalidate/refetch the `skill_versions` query** that drives the Studio header `vN` + the Versions-tab LIVE badge — mirroring exactly what WR-05 did for the description text. No migration, no realtime subscription. DB was correct throughout (BUG-260706-01); this is purely a missing frontend refetch.

### Cross-cutting — G-2 audit, G-5 audit, SC#10, no-migration
- **D-13: G-2 audit → NO fresh sketch (operator-confirmed).** The render-correctness work is reconcile-logic honesty (dedup / un-fold / draft-safety / refetch) + a backend install fix — **no net-new visual chrome**. The final answer just renders as normal markdown once terminal; the visual target is already defined by the 2026-07-07 applied fix + **sketch 014** (unified card frame) + the existing `StreamingNarration` design. G-2 is **satisfied by existing sketches**; acceptance bar = the intended behavior actually happens, verified live.
- **D-14: G-5 audit → additive reconcile fixes, no refactor-first required.** `MessageItem.tsx`, `useMessages.ts`, `StreamsProvider.tsx` are all G-5 hot, but 176 (like 174) is **render-layer / reconcile-logic only** at existing seams — additive, not a feature add. The `threads.py` producer extraction was already paid down in Phase 162.5. Re-run the render/replay tests; do not regress the shared render path (D-14).
- **D-15: SC#10 4-axis live UAT is mandatory** — cross-provider (OpenAI, Anthropic, Google, + one of DeepSeek/Moonshot/GLM) × multi-tool (≥1 row 2+ tools, e.g. `execute_code` exercising EXEC-01 auto-heal) × parallel-thread (Thread A streaming while Thread B sends — the RENDER-02 nav-reconcile + RENDER-01/03 case) × long-message (≥50 prior msgs OR ≥5KB prompt, manual per provider). Authored under `VALIDATION.md`, NOT PLAN tasks.
- **D-16: No migration.** Every fix is app-layer (frontend reconcile + backend dispatcher). If the researcher discovers RENDER-04 or RENDER-01 *truly* needs schema, that reopens the no-migration assumption for an explicit operator call — not expected.

### Folded Todos
None — the only `todo.match-phase` hit (`spike-nl-workflow-authoring.md`, score 0.4) is a keyword false-positive; see Reviewed Todos below.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements (read first)
- `.planning/ROADMAP.md` §"Phase 176: Chat Render Correctness + Exec Reliability" — goal, 5 success criteria, flags (SC#10, G-2, G-5, reported-bugs fold).
- `.planning/REQUIREMENTS.md` — RENDER-01/02/03/04 (lines ~35-40) + EXEC-01 (line ~44) + their source-report list.
- Project skill `sketch-findings-agentic-rag` (`Skill("sketch-findings-agentic-rag")`) — validated CSS/visual patterns for the unified tool-card frame, MessageItem terminal states, StreamingNarration; auto-load when touching MessageItem / StreamsProvider / the chat render surface. (Sketch 014 = the unified card frame, the D-13 acceptance anchor.)

### Folded reported bugs (the 5 primaries, now `folded_into: "176"`)
- `.planning/reported-bugs/BUG-260712-02-duplicate-user-bubble-optimistic-temp-plus-persisted-row.md` → RENDER-01. Optimistic temp ~`StreamsProvider.tsx:1751`; preserve-guard merge ~`:1429`; assistant-side dedup precedents (BUG-260609-03 / BUG-260626-01).
- `.planning/reported-bugs/BUG-260707-03-final-answer-stays-folded-in-narration-until-reload.md` → RENDER-02. Applied 2026-07-07 send-path reconcile; `:358` append invariant; `:991` harness-only `onRunCompleted`; `MessageItem.tsx:429`; residuals = live-verify + nav/mount path. Related SEED-094.
- `.planning/reported-bugs/general-chat-intermittent-silent-send-drop.md` (id **BUG-260603-01**) → RENDER-03. Two mechanisms; #1 root-fixed (per-thread send); #2 fresh-thread reconcile race under SEED-055; `MessageInput.tsx:126-127` sync clear.
- `.planning/reported-bugs/BUG-260706-01-approve-description-version-pointer-stale-until-reload.md` → RENDER-04. `SkillTunerPage.tsx:531` `handleApproveDescription`; WR-05 `loadSkills` note ~:101-103; `DescriptionProposalCard.tsx`.
- `.planning/reported-bugs/BUG-260708-02-execute-code-libraries-param-unreliable-install.md` → EXEC-01. **major.** Thread `5a86a9fd` [22] 68ms ModuleNotFound vs [23] 6607ms installed. SEED-043 half-b.

### Backend change site (EXEC-01)
- `backend/app/services/tool_dispatcher.py` — `_handle_execute_code`; `:1476` `libraries` arg; `:1642-1657` install seam (the swallowed-`except` at `:1653` is the D-01 bug); `:1661-1673` `_run_sync` execute; the stderr drain loop `:1675+` (where ModuleNotFound detection for D-02 auto-heal would hook).
- `backend/app/services/sandbox_service.py` — `SandboxSessionManager.get_or_create` (`:25`, warm-session re-attach D-077-05 preserves pip installs); the `session.install` behavior the researcher must probe.
- `docs/SANDBOX-PACKAGES.md` — the preinstalled set (reportlab/pandas/matplotlib/python-docx/python-pptx/openpyxl/docxtpl/…) — the honest-message "use a preinstalled lib" hint (D-03).
- `.planning/seeds/SEED-043-sandbox-package-management.md` — half-b (declared + ModuleNotFound install-and-retry); 2026-07-08 Findings 2 & 3 (PyPI egress confirmed working).

### Frontend render surface (RENDER-01/02/03/04)
- `frontend/src/providers/StreamsProvider.tsx` — `sendMessage` optimistic temp + `postMessage` (RENDER-01 re-key / RENDER-03 ordering); `getSnapshot`/`setMessagesForBucket` preserve-guard merge (RENDER-01, D-06); send-path `onTerminal` content-reconcile + the mount/reconcile-path terminal (RENDER-02, D-07); `:358` append invariant; per-thread `failedSendDrafts`/`reconcileErrors` seam ~:2081-2084 (RENDER-03, D-11). *(Line numbers drifted after 174/175 shipped — re-scout.)*
- `frontend/src/components/chat/MessageItem.tsx` — the `isMessageStreaming` → `StreamingNarration` vs `MarkdownRenderer` switch at the clean terminal (RENDER-02, ~:429 pre-drift).
- `frontend/src/components/chat/MessageInput.tsx` — `:126-127` synchronous text-clear (RENDER-03 root of invisibility; the honesty guarantee changes this).
- `frontend/src/lib/api.ts` — `_mapRow` (`run_status → runStatus`), `getMessages`, `getSnapshot`, `postMessage` return shape (RENDER-01 re-key source, RENDER-02 reconcile fetch).
- `frontend/src/pages/SkillTunerPage.tsx` — `:531` `handleApproveDescription` + WR-05 `loadSkills` (RENDER-04, D-12); the `skill_versions` query hook to invalidate.
- `frontend/src/components/skills/studio/DescriptionProposalCard.tsx` — the "Promoted…" card (RENDER-04 context).

### Prior-phase anchors
- `.planning/phases/174-run-state-lifecycle-honesty/174-CONTEXT.md` — the carry-forward decisions this phase inherits (D-14 red line, `runs.status` authoritative, render-layer-only, 075.7 guard, SC#10 4-axis). Phase 174 shipped 2026-07-22 and touched these same files.
- Phase 075.7 (blank-thread preserve-guard — D-06 load-bearing); Phase 145/FND-01 (`runs.status` authoritative); SEED-055 (send-reliability residuals — RENDER-03 mechanism #2).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Assistant-side temp dedup precedents** (BUG-260609-03 / BUG-260626-01, `StreamsProvider.tsx`) — the exact shape RENDER-01 replicates on the user side; user temps just carry no `runId` to match on, hence the id-re-key or content-newer approach (D-05).
- **Applied 2026-07-07 send-path content-reconcile** (`StreamsProvider.tsx` `onTerminal`) — RENDER-02 extends this SAME mechanism to the mount/nav path (D-07); do not rebuild it.
- **Per-thread `failedSendDrafts` / `reconcileErrors` recovery seam** (`StreamsProvider.tsx` ~:2081-2084) — RENDER-03 routes the silent-drop honest-failure through it (D-11); already stashes draft + surfaces a per-thread banner.
- **WR-05 `loadSkills()` reconcile-via-fetch** (`SkillTunerPage.tsx` ~:101-103) — RENDER-04 mirrors it for the versions query (D-12).
- **The `installing_libraries` SSE phase + threadpooled `session.install`** (`tool_dispatcher.py:1642-1652`) — EXEC-01 builds on this; the fix is the swallowed-`except` + a re-run-on-ModuleNotFound hook, not new install plumbing.

### Established Patterns
- **`runs.status` is the single source of truth** (FND-01/145); render derives, never persists new state (no migration — D-16).
- **Reconcile-against-snapshot, never stop-preserving-temps** (075.7) — the RENDER-01 hard constraint (D-06).
- **Provider-uniform tool dispatch** (Phase 147 FLAG-01 precedent — REFUSE/HIDE with no `provider ==` fork) — EXEC-01 stays provider-uniform below the adapter boundary (D-04).
- **D-14 red line** — Deep Mode byte-identical; provider differences at the adapter/sanitizer boundary, never a shared-path fork.

### Integration Points
- `tool_dispatcher._handle_execute_code` install seam + stderr drain (EXEC-01: retry declared install; detect ModuleNotFound → install + re-run once → honest tool result).
- `StreamsProvider.sendMessage` optimistic-temp + `postMessage` resolve (RENDER-01 re-key; RENDER-03 fresh-thread ordering + draft-hold).
- `StreamsProvider` mount/reconcile-path `onTerminal` (RENDER-02 content-reconcile extension).
- `SkillTunerPage.handleApproveDescription` (RENDER-04 versions-query invalidate).

</code_context>

<specifics>
## Specific Ideas

- **EXEC-01 honest message shape:** "Could not install X: `<reason>`" (not a raw traceback) so the model can pivot to a preinstalled lib or tell the user — bounded to **1 heal cycle per missing module**.
- **RENDER-03 honesty is load-bearing over the race-fix:** the durable guarantee is "the user never silently loses a message" (keep the draft until dispatch confirmed + quiet retry hint), because a timing race is hard to *prove* gone.
- **RENDER-02 acceptance anchor:** the fold gives way to a clean, separated answer **live** (no reload) on BOTH the send path and the nav-watched path; sketch 014's unified card frame is the visual bar (no fresh sketch).
- **UAT anchors from the bug DB evidence:** DeepSeek/fpdf2 warm-session install (EXEC-01 — thread `5a86a9fd`); DeepSeek fresh-thread dup bubble (RENDER-01); a backgrounded parallel-thread run resolving un-folded on switch-back (RENDER-02 nav path); fresh-thread immediate send (RENDER-03).

</specifics>

<deferred>
## Deferred Ideas

- **SEED-094 — backend stray-last-line final-answer emit** (RENDER-02 residual #3): runs where the backend persisted an interim line instead of the real final answer. Separate backend run-end-honesty bug; the render reconcile faithfully shows whatever was persisted. NOT this phase.
- **SEED-043 full half-b remainder** (beyond D-02's bounded auto-heal): preinstalled-set-aware install planning, a cross-provider install-verification matrix, permanent `libraries` reshaping. EXEC-01 delivers the declared-hardening + bounded ModuleNotFound heal; the broader hardening stays SEED-043.
- **`BUG-260609-02` (SUB-RESULTS phantom "Sub-task" desc-loss) + `BUG-260609-04` (phase-card `phase-0` slug clobber)** — same reconcile-floor *family* but **panel-side run-honesty**, not the chat-render terminal. Phase 174 explicitly routed both to STRETCH **Phase 178** (chat/nav polish). Kept **deferred**, not folded here (SPEC boundary: panel taxonomy ≠ chat render).
- **RENDER-01 durable `client_msg_id` + column** — the bulletproof identity approach, rejected as over-scoped for a minor bug in a no-migration milestone. Re-open only if the no-migration reconcile proves flaky under UAT.
- **RENDER-02 verify-only option** — rejected in favor of extending the reconcile to the nav path (D-07), since SC#10 exercises it anyway.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (`todo.match-phase` score 0.4) — a **keyword false-positive** ("run"). Semantically it is v3.6 NL→workflow authoring, wholly unrelated to chat render correctness / exec reliability. **Reviewed and deliberately NOT folded** (same call Phase 174 made).

</deferred>

---

*Phase: 176-chat-render-correctness-exec-reliability*
*Context gathered: 2026-07-22*
