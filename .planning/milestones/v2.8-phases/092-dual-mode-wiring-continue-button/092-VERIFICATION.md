---
phase: 092-dual-mode-wiring-continue-button
verified: 2026-06-01T00:00:00Z
status: passed_with_overrides
score: 3/3 requirements met (dual-mode wiring proven end-to-end on OpenAI); 2 cross-provider/transport defects (F9/F10) overridden → Phase 093
overrides_applied: 2
human_verification:
  - test: "MODE-01 live: toggle a thread Deep↔Harness, pick a published workflow, kick off a Harness run; confirm a workflow_runs row is created with a non-null user_id, the thread shows active_workflow_run_id, and the mode switch takes effect only on the NEXT run (never mutates an in-flight stream)."
    expected: "Harness run starts end-to-end; workflow_runs + harness_audit rows carry non-null user_id; no NotNullViolationError; mode flips per-thread."
    why_human: "Live LLM workflow + Supabase row inspection; verified by operator Chrome MCP + uvicorn console UAT (092-06/092-07-UAT-FINDINGS UPDATE 1–4)."
    result: "VERIFIED CLOSED live (UPDATE 3/4/6): Research→Summarize ran end-to-end on the user's DBA docs — grounded answer rendered + persisted, survives reload, sources+confidence visible."
  - test: "MODE-02 live: with a workflow active, attempt Harness→Deep; confirm server-side 409 refusal (not just a grayed button); Cancel / terminal status clears active_workflow_run_id in the same transaction (no dangling lock); lock is per-thread keyed."
    expected: "409 lock-refusal on active run; failed/cancelled run → status terminal + active_workflow_run_id NULL; no wedged lock; lock_is_stale self-heals."
    why_human: "Requires a live locked thread + DB state inspection; verified by operator (092-04 MODE-02 409 confirmed; 092-06 F2 + SC#2 failure-path VERIFIED CLOSED live)."
    result: "VERIFIED CLOSED live (092-06 UAT): F1+F2 closed, SC#2 failure-path PASS (failed run → status=failed + anchor NULL)."
  - test: "CONT-01 cap→Continue live: drive a run to its step cap and confirm the Continue affordance resumes the SAME run/phase with a bounded budget and consumes the previously-buffered tool calls (never silently drops)."
    expected: "cap_paused carrier row + event; Continue re-reads available_tools and consumes buffered calls; no unbounded global cap bump."
    why_human: "Needs a run that actually hits the cap live; CODE-COMPLETE + the F4 FK fix unblocks end-to-end, but the live cap-drive observation was accepted as code-verified at close (operator close decision 2026-06-01)."
    result: "CODE-COMPLETE + FK-unblocked; live cap-drive accepted as code-verified per operator close decision (single-provider owed row)."
deferred:
  - truth: "The Harness workflow path is provider-agnostic across the native-7 (not OpenAI-only) — sub-agent model resolution per provider + native Anthropic/Google streaming + STRUCTURED-mode tool injection for GLM/MiniMax in the phase sub-agent."
    addressed_in: "Phase 093 (Harness Cross-Provider Parity) — prerequisite Phase 092.5 (Provider Gateway Extraction)"
    evidence: "F9 (092-07-UAT-FINDINGS UPDATE 5/6): the Research workflow worked on OpenAI ONLY; Deep mode is provider-robust on ALL 7 (live evidence table UPDATE 6) → the gap is HARNESS-specific (harness funnels every phase LLM call through OpenAI-SDK-only create_adaptive_streaming_chat; wf_ctx never carries _resolved_model). Operator directive (UPDATE 5): route to a comprehensive phase, stop piecemeal fixing. → 092-COMPREHENSIVE-AUDIT.md + 093-CONTEXT.md."
  - truth: "The ask_user / llm_human_input Doc-Q&A round-trip works: the draft (llm_agent) phase surfaces visible output before the confirm (llm_human_input) phase, and the user's answer resumes the workflow."
    addressed_in: "Phase 093 (ask_user round-trip + draft plumbing)"
    evidence: "F10 (092-07-UAT-FINDINGS UPDATE 5/6): Doc-Q&A jumped straight to ask_user with no draft AND the answer did not resume. Root causes: (a) no draft = F6 ceiling (only final phase surfaced; human-input blocks before the final delta); (b) answer rejected = run_id namespace mismatch (submit endpoint queries runs; harness keys on workflow_runs id → 404 before persist/publish). Operator-routed to the comprehensive phase (093)."
  - truth: "The remaining single-provider binding rows are positively observed live on OpenAI: F3 lock-during-active-run (needs a long workflow), SC#3 parallel-thread, SC#5 reload-mid-run."
    addressed_in: "Accepted as code-verified at close (operator decision 2026-06-01); re-exercised under Phase 093/096 cross-provider + restart UAT."
    evidence: "Code shipped (092-06 F3 lock-UX commits 3b21f230/4546b5bb; 092-07 Facet C resume/Continue cdd775f6). Not positively observed live because runs complete in seconds (F3) and operator focus shifted to the F9/F10 root-cause routing. Per-thread keyed lock (Map/Set, not global bool) is code-asserted (BUG-260523-01 pattern). Phase 096 owns the restart-mid-workflow + parallel-thread proof gate."
---

# Phase 092: Dual-Mode Wiring + Continue Button — Verification Report

**Phase Goal:** A user can switch a thread between Deep Mode (default) and Harness Mode (locked workflow), the lock is per-thread and server-enforced, Cancel cleanly exits, and hitting a step cap surfaces a Continue affordance instead of silently dropping tool calls.
**Verified:** 2026-06-01
**Status:** `passed_with_overrides` — the dual-mode wiring (MODE-01/MODE-02/CONT-01) is proven end-to-end on OpenAI; two defects found during live UAT (F9 cross-provider harness parity, F10 ask_user round-trip) are **operator-routed to Phase 093** (with Phase 092.5 the prerequisite gateway). This is not a silent pass — the overrides are named and carried forward with evidence.
**Re-verification:** No — initial verification (close after the 092-07 Task 6 binding-gate, resolved by operator close decision 2026-06-01).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **MODE-01**: Mode is per-thread via `threads.active_workflow_run_id` (NULL = Deep, non-null = Harness + locked); `agent_runner` branches on it; a switch takes effect only on the NEXT run, never mutates an in-flight stream. | VERIFIED (live, OpenAI) | Atomic `create_workflow_run` (INSERT `workflow_runs` + anchor + lock) confirmed in 092-04 UAT (the trigger that unblocked 091's parked UAT). F1 fix (migration 064 `workflow_runs.user_id` + `write_audit` owner-binding across all 11 audit sites) lets a run execute with no `NotNullViolationError` — VERIFIED CLOSED live (092-06). End-to-end Research→Summarize rendered a grounded, persisted answer (UPDATE 3/4/6). |
| 2 | **MODE-02**: Workflow-lock is server-enforced — Harness→Deep refused at run creation (409, not just a grayed button) until terminal/cancel; Cancel clears `active_workflow_run_id` in the SAME txn as the terminal write; lock is per-thread keyed. | VERIFIED (live, OpenAI) | 092-04 UAT confirmed MODE-02 server-side 409 lock-refusal. F2 fix: `_shielded_finalize` terminalizes `workflow_runs` + clears the anchor on any non-completed escape; `lock_is_stale` self-heals (pure read). SC#2 failure-path PASS live (092-06): failed run → `status='failed'` + `active_workflow_run_id=NULL`, no wedged lock. F3 client lock-UX shipped (disable-while-locked + 409 rollback + per-thread keyed lock). |
| 3 | **CONT-01**: Hitting a step cap (Deep run OR Harness phase) surfaces a Continue affordance that resumes the SAME run/phase with a bounded budget and consumes the previously-buffered tool calls (never silently drops; never unbounded global bump). | CODE-COMPLETE + FK-unblocked (live cap-drive accepted as code-verified) | 092-03 persist-at-cap (consume not drop) + `POST /runs/{id}/continue` + bounded 3-cap; 092-07 Facet C `latest_producer_run_id` surfacing + Continue-404 owner-scoped repair + frontend re-subscribe (cdd775f6). The F4 FK fix (producer `runs` row distinct from the `workflow_runs` ctx id) unblocks end-to-end so a phase can actually reach its cap. Live cap-drive observation deferred (accepted as code-verified per operator close decision). |

**Score:** 3/3 requirements met (dual-mode wiring proven end-to-end on OpenAI; CONT-01 cap-drive code-verified).

---

### Gap-Closure Ledger (F1–F8 closed; F9–F10 overridden)

| Defect | Severity | Owner | Status | Evidence |
|--------|----------|-------|--------|----------|
| F1 — `write_audit` omits `user_id` (NOT NULL) → run dies pre-phase | CRITICAL | 092-05 | ✅ CLOSED live | migration 064 + 11 audit sites; live-DB audit test green |
| F2 — failure leaves `workflow_runs.status='active'` → wedged lock | HIGH | 092-05 | ✅ CLOSED live | `_shielded_finalize` terminalize + `lock_is_stale` self-heal; SC#2 failure-path PASS |
| F3 — composer not disabled-while-locked; orphaned optimistic bubble | MEDIUM (UX) | 092-06 | ✅ CODE-COMPLETE (live cap-drive owed) | typed 409 ApiError + per-thread lock seed/reconcile + rollback banner; tsc+build clean |
| F4 — harness sub-agent `parent_run_id` = `workflow_run` id → `runs_parent_run_id_fkey` violation | CRITICAL | 092-07 | ✅ CLOSED (code + live FK test) | `producer_run_id` on engine ctx (fa14a1c3) + SSE `stream_run_id` routing (ca0ee5c5) + both resume ctx sites mint a real producer `runs` row (0f6a66df/cdd775f6) + live-DB FK regression test (ec9dd4f4) |
| F5 — resume ctx missing tools/supabase context | HIGH | 092-07 (dev) | ✅ VERIFIED live | a7be6423; search_documents runs in-phase |
| F6 — only final phase output surfaced (no visible assistant reply) | HIGH | 092-07 (dev) | ✅ VERIFIED live | 803aafd3; grounded answer renders as the assistant message |
| F7 — grounding not visible (no sources/confidence chip) | MEDIUM | 092-07 (dev) | ✅ VERIFIED live | ba5949c4; "● Medium confidence" + "5 sources" chip, `source_refs`/`confidence_level` persisted |
| F8 — `kickoff_prompt` (SEED-047) stored but no phase consumed it | HIGH | 092-07 (dev) | ✅ VERIFIED live | 95da3032; threaded into wf_ctx + both resume ctxs + first phase's user turn; on-topic grounded synthesis |
| **F9 — harness works on OpenAI ONLY (not native-7)** | **BINDING** | **→ Phase 093** | ⏭ OVERRIDE | Deep is provider-robust on all 7 (UPDATE 6 evidence table); harness funnels every phase LLM call through OpenAI-SDK-only path + `wf_ctx` lacks `_resolved_model`. Operator-routed (UPDATE 5). Prereq: 092.5 gateway. |
| **F10 — ask_user round-trip broken + no draft** | **BINDING** | **→ Phase 093** | ⏭ OVERRIDE | submit endpoint queries `runs`, harness keys on `workflow_runs` id → 404; draft blocked by F6 ceiling. Operator-routed (UPDATE 5). |

---

### Overrides Applied (2)

Per operator directive (092-07-UAT-FINDINGS UPDATE 5, 2026-05-31): **"NOTE these for a separate comprehensive phase rather than continue ad-hoc fixing."**

1. **F9 (cross-provider harness parity)** → **Phase 093** (Harness Cross-Provider Parity), built on **Phase 092.5** (Provider Gateway Extraction — the shared provider boundary the harness must consume). The original 092 SC#10 native-7 row is superseded by 093's native-7 × 5-type × 4-workflow UAT gate.
2. **F10 (ask_user round-trip + draft plumbing)** → **Phase 093**. The run_id namespace mismatch (`runs` vs `workflow_runs`) and the F6 surfacing ceiling are 093's domain.

Both overrides are documented in `092-COMPREHENSIVE-AUDIT.md` (full provider × mode × phase-type × workflow × UI defect matrix → 4 root causes) and `093-CONTEXT.md` (the rescope that made 093 the milestone-blocking harness work). The v2.8 ROADMAP critical path was rescoped accordingly: **089 → 091 → 092 → 092.5 → 093 → 094**.

---

## Out of Scope (correctly deferred, not blockers)

- **Rich live workflow panel** (run-card / phase timeline / live tool-calls during a run) → **Phase 094** (deferred by design; G-2 sketch-first).
- **F8 content-quality variance** in the seed-workflow prompts (now F8 was re-diagnosed as a wiring gap and FIXED; any residual prompt/handoff tuning is a separate seed-workflow-quality concern, not 092 wiring).
- **PARITY-01** (Deep-mode Anthropic summary/iteration/tool-card polish) — re-deferred (not reproducing for the operator; not worth shared-path risk).

---

## Verdict

**Phase 092 is COMPLETE (passed_with_overrides).** The dual-mode wiring goal is met: a user can switch Deep↔Harness per-thread, the lock is server-enforced and self-healing, and a Harness workflow runs end-to-end and surfaces a grounded answer (proven live on OpenAI). The two cross-provider/transport defects (F9/F10) that block native-7 parity are operator-routed to Phase 093 with full evidence, and Phase 092.5 (the prerequisite gateway) is planned. Requirements MODE-01 / MODE-02 / CONT-01 are marked Validated.

**Next:** execute Phase 092.5 (Provider Gateway Extraction) → Phase 093 (Harness Cross-Provider Parity).
