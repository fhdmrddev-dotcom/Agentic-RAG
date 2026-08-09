# Phase 174: Run-State & Lifecycle Honesty — Specification

**Created:** 2026-07-22
**Ambiguity score:** 0.15 (gate: ≤ 0.20)
**Requirements:** 5 locked

## Goal

Every run's lifecycle state is honestly reflected in the chat surface — a cancelled/killed run never shows an empty or blank bubble, a stopped run's indicator survives navigation AND a full reload, the pre-answer "setting up" state shows the model actually working, and a workflow run's timer + avatar stay accurate on navigation — verified across providers with Deep Mode byte-identical.

## Background

Grounded in the live code (scout 2026-07-22). The run-lifecycle surface is partly fixed and partly open:

- **Already implemented (Phase 147 / D-03), needs verification:** `MessageItem.tsx:627` renders **"cancelled — no output yet"** when `message.runStatus === "cancelled"` and content is empty (STATE-01, Deep path); `MessageItem.tsx:670` renders the persistent **"Response stopped"** indicator gated on `runStatus === "cancelled" && content`, intended to survive reload (STATE-02). Both derive from `message.runStatus`, which is meant to reflect the authoritative `runs.status` (FND-01 / Phase 145). **The open question is whether `runStatus` is actually re-derived from persisted `runs.status` on a cold reload** — the render condition exists, but the data wiring must be verified.
- **Genuinely open (build):**
  - **Killed-workflow 403 card (STATE-01):** a workflows kill-switch refusal throws a 403 in `StreamsProvider.sendMessage`'s catch (a *different* path than the cancelled-render above), leaving the workflow title with a **blank body** instead of an honest "disabled by the administrator" reason.
  - **"Setting up agent…" hides activity (STATE-03):** `toolMeta.ts:outerBannerLabel()` returns `"Setting up agent…"` whenever `!hasAnyTools && !isPlanning` — it does **not** count `reasoning_delta` / `tool_args_progress` as activity, so a reasoning-heavy model (Kimi streamed ~4,000 reasoning tokens) reads as idle during setup.
  - **Workflow-run timer reset + duplicate avatar (STATE-04, BUG-260610-01):** navigating to a streaming workflow run reseeds the elapsed timer from component mount (not the run's `started_at`), and a duplicate empty assistant avatar renders from the mount / first-SSE double-mount.

The design acceptance bar is the operator-approved sketches **129-C** (tiered terminal-state vocabulary keyed off `runs.status`) and **130-C** (run-card header carrying a live pre-answer sub-state + a timer anchored to `started_at` + a single avatar).

## Requirements

1. **STATE-01a — Deep cancelled-no-output (VERIFY)**: A cancel before the first visible token shows an honest affordance, never an empty avatar-only bubble.
   - Current: `MessageItem.tsx:627` already renders "cancelled — no output yet" for `runStatus === "cancelled"` + empty content (Phase 147 / D-03); not yet verified live cross-provider.
   - Target: The affordance holds for an early cancel on ≥2 providers including DeepSeek (the slow-first-token / DSML-strip case that produced the original empty bubble).
   - Acceptance: An early-cancel run on DeepSeek + one other provider renders "cancelled — no output yet" (never an empty avatar-only bubble) live and after reload; if it does not, the gap is fixed in-phase.

2. **STATE-01b — Killed-workflow honest reason bubble (BUILD)**: A workflows kill-switch 403 refusal renders an honest reason, never a blank workflow card.
   - Current: The 403 lands in `StreamsProvider.sendMessage`'s catch; the empty assistant placeholder is left as a workflow title with a blank body (`killed-workflow-empty-chat-card` / BUG-260712-01).
   - Target: The catch replaces the empty placeholder for that send with an honest error bubble carrying the server's `ApiError.message` (e.g. "Workflows are currently disabled by the administrator"), and clears any harness workflow-lock seeded at kickoff if no run registered.
   - Acceptance: With the workflows kill-switch OFF, launching a workflow shows the honest "disabled by the administrator" reason in chat (per sketch 129-C's amber block), never a title with a blank body; the composer is not left locked.

3. **STATE-02 — Stop indicator survives nav + reload (VERIFY reload-derive)**: A stopped/cancelled message stays visibly marked after navigation AND a full cold reload.
   - Current: `MessageItem.tsx:670` renders the persistent "Response stopped" indicator from `runStatus`; whether `message.runStatus` is populated from persisted `runs.status` on a cold reload (via the snapshot/messages fetch → `useMessages`/`StreamsProvider`) is unverified.
   - Target: The indicator is derived from the authoritative persisted `runs.status` so it renders identically live, after nav-away-and-back, and after a full page reload — no new persistence (FND-01 / Phase 145).
   - Acceptance: A mid-stream Stop on ≥1 provider still shows "Response stopped" after (a) navigating away and back AND (b) a full cold browser reload; if `runStatus` is not re-derived on reload, the derive is wired in-phase.

4. **STATE-03 — Pre-answer banner shows live activity (BUILD, frontend only)**: The pre-first-token state reflects the model actually working instead of a static "Setting up agent…".
   - Current: `toolMeta.ts:outerBannerLabel()` returns "Setting up agent…" for `!hasAnyTools && !isPlanning`; `reasoning_delta` / `tool_args_progress` events do not count as activity.
   - Target: During the pre-answer window the surface shows a live sub-state reflecting real activity (reasoning / writing tool-args / sandbox setup) per sketch 130-C's run-header sub-state, derived from events the backend already emits — a render-layer change, no backend latency work.
   - Acceptance: A reasoning-heavy model (e.g. Kimi / a reasoning model) shows live activity (e.g. "Reasoning…") during the pre-answer gap instead of a static "Setting up agent…", across providers, with Deep Mode byte-identical.

5. **STATE-04 — Workflow-run timer anchored + single avatar (BUILD)**: Navigating to a streaming workflow run keeps the timer accurate and renders exactly one avatar.
   - Current: The workflow/harness run strip reseeds elapsed from component mount on nav (BUG-260610-01); a duplicate empty assistant avatar renders from the mount / first-SSE double-mount.
   - Target: Elapsed derives from the run's `started_at`/`created_at` (the Phase 095.1 Deep-card fix extended to the workflow/harness strip); the StreamsProvider/MessageList double-mount is resolved so exactly one avatar renders.
   - Acceptance: Navigating to a multi-minute streaming workflow run shows the timer continuing from real elapsed (no reset to seconds) and exactly one assistant avatar (no duplicate), on a fast and a slow provider.

## Boundaries

**In scope:**
- Verify STATE-01a (Deep cancelled-no-output) holds live cross-provider (incl. DeepSeek early cancel) + after reload; fix any gap found.
- Build STATE-01b: the killed-workflow 403 honest reason bubble in `StreamsProvider.sendMessage`'s catch + clear the stray workflow-lock.
- Verify STATE-02 stop indicator persists across nav + full cold reload; wire the `runStatus`-from-`runs.status` reload-derive if it is not already.
- Build STATE-03: frontend banner/pre-answer honesty — show reasoning / tool-args / sandbox live sub-state (sketch 130-C run-header) from already-emitted events.
- Build STATE-04: anchor the workflow-run timer to `started_at` + resolve the duplicate-avatar double-mount (single avatar).
- Cross-provider SC#10 4-axis live UAT (cross-provider × multi-tool × parallel-thread × long-message).
- Render-layer only, over persisted `runs.status` + wire events the backend already emits.

**Out of scope:**
- Title-generation serial dispatch → async (BUG-260607-02 cause 2) — separate backend latency work; honest-label only here.
- Sandbox cold-start pre-warm / pool (BUG-260607-02 cause 3) — infra/SEED territory, not a chat-polish fix.
- OpenRouter-specific failures — experimental provider; fix only if native-safe + low-complexity, not this phase.
- Any backend persistence change or migration — `runs.status` is authoritative (FND-01 / Phase 145); no new state.
- Any change to the shared Deep / agent-loop / provider path — provider handling stays at the adapter/sanitizer boundary (D-14); Deep Mode byte-identical.
- The panel failure-card taxonomy — `run-honesty.md` already covers panel-side failures; 174 is the chat-surface terminal/lifecycle states only.

## Constraints

- **Deep Mode byte-identical (D-14)** — every change is a render layer over persisted state + already-emitted wire events; no shared-path fork, no new runtime.
- **No migration, no new persistence** — `runs.status` is the authoritative source (FND-01 / Phase 145).
- **G-5 hot files** — `MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `threads.py` (run-lifecycle). Re-run the replay/render tests; do not regress the shared render path. Audit refactor-vs-feature at discuss-phase.
- **SC#10 cross-provider mandate** — the 4-axis matrix (cross-provider × multi-tool × parallel-thread × long-message) must pass; long-message stays manual per provider.
- **Design acceptance bar** — sketches **129-C** (tiered dim/amber/red terminal vocabulary off `runs.status`) + **130-C** (run-header live sub-state + anchored timer + single avatar) are the operator-approved "feels like" bar.

## Acceptance Criteria

- [ ] An early cancel (before first visible token) on DeepSeek + ≥1 other provider renders "cancelled — no output yet" — never an empty avatar-only bubble — live and after reload.
- [ ] A workflows kill-switch 403 refusal renders an honest "disabled by the administrator" reason bubble in chat (not a title + blank body); the composer is not left locked.
- [ ] A mid-stream Stop still shows "Response stopped" after (a) nav-away-and-back AND (b) a full cold browser reload — derived from persisted `runs.status`.
- [ ] A reasoning-heavy model shows live pre-answer activity (e.g. "Reasoning…") instead of a static "Setting up agent…", across providers.
- [ ] Navigating to a multi-minute streaming workflow run shows the timer continuing from real elapsed (no reset) and exactly one assistant avatar.
- [ ] All five hold across the SC#10 4-axis matrix (cross-provider × multi-tool × parallel-thread × long-message) with Deep Mode byte-identical.
- [ ] No migration is added; no shared Deep/agent-loop path is forked; the G-5 replay/render tests are green.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | 5 measurable SC + per-requirement current-state pinned by the scout   |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Fix-vs-verify split locked; STATE-03 frontend-only; STATE-04 both symptoms |
| Constraint Clarity | 0.82  | 0.65 | ✓      | No migration/threat-model; Deep byte-identical; render over runs.status; SC#10 |
| Acceptance Criteria| 0.82  | 0.70 | ✓      | 7 pass/fail checks incl. reload-derive + cross-provider              |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      | Gate passed after 1 round                                             |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective          | Question summary                                              | Decision locked                                                                 |
|-------|----------------------|--------------------------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Researcher (scout)   | What of STATE-01..04 already exists in code?                  | STATE-01 Deep-cancel + STATE-02 render already in `MessageItem.tsx` (147/D-03); killed-workflow 403, STATE-03, STATE-04 open |
| 1     | Boundary Keeper      | Fix-vs-verify for the already-implemented STATE-01/02?        | Verify-and-close STATE-01a + STATE-02 (live UAT + reload-derive check); build the open gaps; fix any residual found |
| 1     | Boundary Keeper      | STATE-03 depth — frontend banner vs backend latency causes?  | Frontend banner honesty ONLY (sketch 130-C run-header sub-state); title-gen-serial + sandbox cold-start OUT (separate latency work) |
| 1     | Boundary Keeper      | STATE-04 — timer only, or timer + duplicate avatar?          | BOTH — anchor timer to `started_at` + resolve the double-mount for a single avatar (shared reconcile surface) |

---

*Phase: 174-run-state-lifecycle-honesty*
*Spec created: 2026-07-22*
*Next step: /gsd:discuss-phase 174 — implementation decisions (how to build/verify what's specified above; audit the G-5 hot files + fold the 5 reported bugs)*
