# Phase 066: Adaptive Run Timeouts & Lifecycle States — Discussion Log

> **Audit trail only.** Decisions are captured in `066-CONTEXT.md`. This log
> records the questions asked, options presented, and the user's selections
> + free-text rationale during `/gsd:discuss-phase 066` on 2026-05-06.

## Session info

- **Date:** 2026-05-06
- **Phase:** 066-adaptive-run-timeouts-lifecycle-states
- **Mode:** discuss (default)
- **Operator:** fhdmrd@gmail.com
- **Triggered by:** Gap-006 (Adaptive Run Timeouts) escalated from Phase 063.1 close-out UAT 2026-05-04

## Areas selected for discussion

User selected ALL of:
1. Timeout budget shape
2. What the timeout measures
3. Per-model vs single config
4. Stopgap + UX + migration (bundle)

## Q&A trail

### Area 1 — Timeout budget shape

**Question:** How should the timeout budget be structured? Today's
`asyncio.timeout(120s)` wraps the entire agent loop — a 4-iteration tool-calling
agent (search → report → charts → docx) routinely exceeds it. `max_iterations`
already caps the loop at 15 (General) / 8 (Explorer), so a per-call-only design
isn't infinite — worst case is 15 × budget.

**Options:**
- (A) Per-call only, no overall cap (Recommended)
- (B) Hybrid — per-call + overall safety ceiling
- (C) Just raise the total deadline

**User selection:** Free-text — *"considering our application with the multi-model
selection and different providers that might be slower, we want to implement
what claude ai and ChatGPT do but with considerations to our App architecture,
we should not care about the budget but we care about accuracy, performance and
failure-free execution"*

**Interpretation:** Strong endorsement of (A) — match Claude/ChatGPT's no-total-cap
agent-loop pattern, multi-provider/model aware. Cost is not a primary
constraint; completion success is. → **D-066-01** locked.

### Area 2 — What the timeout measures

**Question:** What should the per-call budget actually wall-clock? Each
iteration has two phases — (A) the LLM stream, (B) tool execution after the
model decides. Choosing what's inside the timer changes failure-mode
characteristics.

**Options:**
- (A) LLM stream only (Recommended)
- (B) Whole-iteration (LLM + tools)
- (C) Two separate budgets

**User selection:** "LLM stream only (Recommended)"

**Interpretation:** Failure-mode separation — agent thinking too long
(timed_out) vs tool stuck (a tool-specific failure) surface distinctly. Tools
keep their own timeout discipline (sandbox, web_search retries, sub-agent).
→ **D-066-02** locked.

### Area 3 — Per-model vs single config

**Question:** Should the per-LLM-call budget be uniform or model-aware? The
codebase has `MODEL_CAPABILITIES` (config.py:71) as the per-model registry.
Slow reasoning models (Opus 4.6 extended, o1, Kimi K2.5) take 60–180s for one
stream; Haiku/gpt-4o-mini finish <30s.

**Options:**
- (A) Per-model in MODEL_CAPABILITIES (Recommended)
- (B) Per-provider tier
- (C) Single global with smart default

**User selection:** "Per-model in MODEL_CAPABILITIES (Recommended)"

**Interpretation:** Most precise; one place to tune. Aligns with how
MODEL_CAPABILITIES already shapes per-model behavior (native_tools, provider).
→ **D-066-03** locked. Plan-phase finalizes default value (suggested 180s) and
explicit per-model overrides for known-slow models.

### Area 4 — Stopgap + UX + migration (3 sub-questions in one batch)

#### 4a. Stopgap deployment timing

**Question:** Apply `RUN_HARD_TIMEOUT_SECONDS=600` in `backend/.env` NOW so
complex prompts unblock during planning/build, or wait for Phase 066 to ship?

**Options:**
- (A) Apply now (Recommended)
- (B) Wait for 066

**User selection:** "Apply now (Recommended)"

**Interpretation:** Zero-risk env-var bump; user has been blocked since
2026-05-04. → **D-066-12** locked.

#### 4b. Timed_out UX semantics

**Question:** When `runStatus === 'timed_out'`, what UX should the message
render? Today, `MessageItem.tsx:101` renders Resume only on `failed`.

**Options:**
- (A) Distinct banner + Resume (Recommended)
- (B) Same UX as failed
- (C) Banner only — no Resume

**User selection:** "Distinct banner + Resume (Recommended)"

**Interpretation:** Three-way distinction (cancelled = "Response stopped",
timed_out = "Agent reached time limit", failed = "Error: …") preserves the
ChatGPT/Claude-class UX. Resume button gates on
`failed || timed_out`. → **D-066-09 + D-066-10** locked.

#### 4c. CHECK migration shape

**Question:** How should the `runs.status` migration handle the 5th value
(`timed_out`)?

**Options:**
- (A) Extend CHECK to 5 values (Recommended)
- (B) Add `terminated_by` discriminator column

**User selection:** "Extend CHECK to 5 values (Recommended)"

**Interpretation:** Minimal blast radius; ROADMAP-aligned. Apply via SQL
editor per project rules. → **D-066-04** locked.

## Implicit decisions captured (derivable from explicit answers)

These were not asked as separate questions but follow directly from the user's
answers + ROADMAP / project context. Recorded in CONTEXT.md to spare the
planner from asking again:

- **D-066-05** Backend terminal classification map: TimeoutError → `timed_out`;
  CancelledError → `cancelled` (verbatim today's behavior); Exception → `failed`.
  User-Stop path in `runs.py` keeps writing `cancelled`.
- **D-066-06** SSE terminal sentinel adds `timed_out` type.
- **D-066-07** `runs.error` format: plain text with prefix discriminator
  (`timed_out: <Ns> per-call deadline exceeded at iteration <N> (model=<id>)`).
- **D-066-08** No retroactive reclassification of historical `cancelled` rows.
- **D-066-11** LangSmith clean termination: call SDK `stream.close()` before
  re-raising on per-call timer fire.

## Deferred ideas (not in scope for 066)

- `terminated_by` discriminator column (rejected in favor of CHECK extension; re-open if >2 termination sources emerge)
- `MAX_AGENT_ITERATIONS` as a config setting (today hardcoded 15/8)
- Per-tool timeout discipline harmonization
- Retroactive reclassification of historical `cancelled` rows
- Removing the `RUN_HARD_TIMEOUT_SECONDS` env-var symbol entirely (lean delete; plan-phase decides)
- Banner copy redesign for `failed` runs (UI-phase territory)

## Notes

- Stopgap (`RUN_HARD_TIMEOUT_SECONDS=600` in `backend/.env`) applied IMMEDIATELY
  per D-066-12 — this is a pre-phase bandaid, not the proper fix. The wrapper
  itself is deleted by the proper fix in D-066-01; the env-var symbol's fate
  (keep as no-op vs delete) is plan-phase's call.
- gsd-tools.cjs is broken in this clone (missing `config-schema.cjs`) — this
  session worked around it by reading STATE.md / ROADMAP.md / PROJECT.md
  directly. Worth reporting to GSD upstream or running `/gsd:update`.
- User asked mid-session for plain-language summaries (vibe-coder framing) —
  saved to memory as `feedback_vibe_coder_communication.md`. Applies to
  user-facing summaries; internal artifacts (CONTEXT.md, PLAN.md, commits)
  keep their precision.

---

*Phase: 066-adaptive-run-timeouts-lifecycle-states*
*Discussion completed: 2026-05-06*
