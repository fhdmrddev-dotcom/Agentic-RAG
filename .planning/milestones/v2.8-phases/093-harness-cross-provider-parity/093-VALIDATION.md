---
phase: 093
slug: harness-cross-provider-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 093 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `093-RESEARCH.md` → `## Validation Architecture` (full detail there). **Two-layer model (D-13):** mocked pytest proves *plumbing*; the live native-7 matrix proves the per-provider *round-trip*. F1→F8 each passed unit tests and failed live — wire-format alone is INSUFFICIENT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend/venv) + operator-run live drivers (`scripts/`) |
| **Config file** | `backend/tests/conftest.py` (fixtures incl. `four_seed_defs`) |
| **Quick run command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/test_harness_reachability.py backend/tests/unit/test_085_task_service.py -x` |
| **Full suite command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| **Estimated runtime** | quick ~10–20s; full ~3–5min |

> **Baseline note (092.5-05):** the full suite carries ~99–105 pre-existing failures that are flaky live-infra (FK-race + perf-threshold). **Gate on NET-NEW failures vs a worktree A/B baseline, not the absolute count.**

---

## Sampling Rate (Nyquist)

- **After every task commit:** Layer-1 quick run — `pytest <touched test files> -x` (the deterministic gate for the edited surface).
- **After every plan wave:** full backend suite (gate on net-new vs A/B baseline) + relevant live single-provider smoke (`eval_cross_provider.py --provider <x> --prompt factual-doc-search`).
- **Before `/gsd-verify-work`:** the FULL live native-7 × 5-phase-type × 4-workflow matrix + all 4 durability rows + the Deep-parity regression row — GREEN by the skeleton/twin judgment.
- **Max feedback latency:** Layer-1 < 20s; Layer-2 (live) operator-paced.

---

## Per-Requirement Verification Map

> Single requirement: **PARITY-02**. Planner maps concrete `{N}-PP-TT` task IDs into the Task ID column at plan time.

| Facet | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Gateway consumption (F9) | PARITY-02 | T-093-MISROUTE | `_stream_one_iteration` calls `open_stream` + honors `calling_mode`; STRUCTURED inject+post-parse fires for compat natives | unit (mock gateway) | `pytest backend/tests/unit/test_085_task_service.py -x` | ✅ exists / ❌ W0 (add cases) | ⬜ pending |
| Model resolver (F9) | PARITY-02 | T-093-MISROUTE | `resolve_sub_agent_model_safely` reads `available_models`; stale-cross-provider → provider default | unit | `pytest backend/tests/unit/test_sub_agent_routing.py -x` | ✅ exists / ❌ W0 | ⬜ pending |
| ask_user round-trip (F10) | PARITY-02 | T-093-IDOR | answer endpoint resolves a workflow_run id (owner+anchor) and publishes under it; Deep runs-id path still 200s | integration (live DB) | `pytest backend/tests/integration/test_093_ask_user_workflow_run_live.py` | ❌ W0 (new) | ⬜ pending |
| split_topic / fan-out | PARITY-02 | — | `split_topic` produces sub_questions from `kickoff_prompt`; `literature_review` fans out N>1 | unit | `pytest backend/tests/test_093_split_topic.py -x` | ❌ W0 (new) | ⬜ pending |
| reachability lint extension | PARITY-02 | T-093-DOS | `INPUT_UNSATISFIED` fires for an unproduced input_key; 4 seeds lint clean after the fix | unit (pure) | `pytest backend/tests/test_harness_reachability.py -x` | ✅ exists / ❌ W0 | ⬜ pending |
| answer surfacing | PARITY-02 | — | shared helper emits delta+sources+citations+confidence exactly once, before `run_completed` | unit (mock redis/pool) | `pytest backend/tests/test_093_surfacing.py -x` | ❌ W0 (new) | ⬜ pending |
| verify-gate route-forward | PARITY-02 | — | `plan_execute_verify` completes without dead-ending when `VERIFIED` isn't echoed | integration | `pytest backend/tests/integration/test_093_verify_gate_route_forward.py` | ❌ W0 (new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_085_task_service.py` — extend: gateway-consumption (open_stream called, calling_mode honored) + STRUCTURED inject/post-parse cases
- [ ] `backend/tests/unit/test_sub_agent_routing.py` — extend: `available_models` field read; stale-cross-provider → provider default fires
- [ ] `backend/tests/test_harness_reachability.py` — extend: `INPUT_UNSATISFIED` lint cases + 4-seeds-lint-clean-after-fix
- [ ] `backend/tests/test_093_split_topic.py` (NEW) — split_topic reads `kickoff_prompt`; fan-out N>1
- [ ] `backend/tests/integration/test_093_ask_user_workflow_run_live.py` (NEW, live DB) — workflow_run-id answer resolve + publish; Deep runs-id path unaffected
- [ ] `backend/tests/test_093_surfacing.py` (NEW) — shared helper single-emit + ordering before `run_completed`
- [ ] `backend/tests/integration/test_093_verify_gate_route_forward.py` (NEW) — verify-gate doesn't dead-end

---

## Manual-Only Verifications — Live Cross-Provider UAT (D-13, operator-run)

> **Authored here, NOT as PLAN tasks.** Seed the runs — no "if data permits" deferrals. native-7 = OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/zhipu, MiniMax. OpenRouter best-effort (not in the gate).

**Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow (headline gate).** The 4 seeds collectively exercise all 5 phase types; run each on ALL native-7:
| Workflow | Phase types exercised | Why |
|----------|----------------------|-----|
| `research_summarize` | llm_agent → llm_single | baseline cross-provider |
| `plan_execute_verify` | llm_single → llm_agent + gate → llm_single | execute_code + the verify-gate fix |
| `literature_review` | programmatic split_topic → llm_batch_agents → llm_single | split_topic fix + N-way fan-out |
| `doc_qa_human` | llm_agent → llm_human_input → llm_single | ask_user round-trip |

**Dimension 2 — 4-axis bandwidth (MANDATORY scoreboard recipe):**
| Axis | Coverage |
|------|----------|
| Cross-provider | all native-7 (Dimension 1 covers this) |
| Multi-tool | `plan_execute_verify` execute phase (`search_documents` + `execute_code`) ≥1 row |
| Parallel-thread | Thread A streaming `literature_review` fan-out while Thread B accepts a `research_summarize` kickoff |
| Long-message | one workflow kicked off with a ≥5KB prompt OR after ≥50 prior messages in the thread |

**Dimension 3 — durability rows:**
- Resume: kill uvicorn mid-`llm_agent` phase → restart → `resume_stranded_workflows` re-drives → answer surfaces (D-11) on ≥1 native provider.
- Resume mid-ask_user: kill uvicorn while paused in `doc_qa_human` confirm phase → restart → re-subscribe → submit answer → run completes.
- Continue: drive a phase to its step cap → POST `/continue` → run resumes + surfaces.
- Reload: page reload during a streaming harness run → reconcile → no stale lock (F2 self-heal intact).

**Dimension 4 — Deep-parity regression row (RED LINE D-14):** run the 092.5 SSE-diff driver on Deep — Anthropic byte-identical (0 skeleton edits); other 6 within tool-path-noise. Plus the eval `task` prompt (Deep `task()` sub-agent) to confirm the `task_service` rewrite didn't regress Deep sub-agents.

**Dimension 5 — result-quality (operator pass/fail, the "as-intended" gate — added 2026-06-02).** Functionality ≠ quality: a workflow can run, dispatch tools, and surface an answer while still doing the wrong thing (the "asks me to share the research" defect). For each of the 4 seed workflows (sampled across ≥2 providers, including at least one OpenAI-compat native), the operator records a simple **pass/fail** judgment on a real KB folder:
| Workflow | Quality pass criterion (operator judgment) |
|----------|---------------------------------------------|
| `research_summarize` | The summarize phase **produces a grounded summary of the found research** — it does NOT ask the user to supply/share the research (the migration-065 Fix-3 prompt). Sources attach. |
| `literature_review` | The merge phase **integrates the per-subtopic reviews** into one coherent review — does not ask the user to supply the reviews; subtopics are actually distinct. |
| `plan_execute_verify` | The plan is real, the execute phase actually runs (code/search), and the answer reflects the executed result (not a hollow "VERIFIED"). |
| `doc_qa_human` | The finalize phase **incorporates the user's correction** into the answer — does not restart from scratch or re-ask. |
> This is a thin human yes/no per cell on runs you are ALREADY doing in Dimensions 1–3 — NOT a golden-output/rubric framework. The deeper repeatable quality measurement (golden expected-outputs, an automated rubric judge, restart-quality) is **SEED-050 → Phase 096 eval**.

### How to detect a REAL regression on this non-deterministic surface (inherit 092.5's method)
- **Structural-skeleton diff, not raw diff** — `scripts/_diag_skeleton_diff.py` (gate on event-type order + tool names/sequence + code-exec lifecycle + terminal classification, NOT raw stream).
- **run1-vs-run2 noise isolation** — re-run BEFORE+AFTER 2–3×; a residual that changes run1↔run2 is noise, a PERSISTENT structural diff is a regression.
- **Anthropic-as-twin cross-check** — a shared-consumer regression hits Anthropic (0-edit in 092.5); if Anthropic stays byte-identical, the shared path is intact.
- **Eval non-regression floor = native-7 16/28** — `multi-tool`/`task`/`ask_user` cells KNOWN-FLAKY; the deterministic `factual-doc-search` cell MUST pass on all 7. Don't over-read cell flips.
- **2 live re-checks carried from 092.5:** (1) assistant-message `tool_call_id` non-empty + round-trips on a LIVE multi-tool turn per compat provider (Supabase `messages.tool_calls`); (2) token totals non-zero + equal across a multi-iteration run (`runs` token cols).
- **SEED-048 false-alarm guard** — many providers BLOCK with the SAME fingerprint on a search prompt → suspect the OpenAI-embeddings SPOF before a per-provider regression.
- **Do NOT lean on Playwright (SEED-049)** — the E2E suite is rotted; the live operator UAT + skeleton-diff is the real gate.

---

## Security Domain (ASVS L1 — `security_enforcement` enabled)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | all endpoints `Depends(get_current_user)`; the ask_user fallback resolves `workflow_runs` UNDER caller ownership (`.eq("user_id", current_user["id"])`) — never trust the path id alone |
| V4 Access Control | yes | RLS on all tables; the workflow_run resolve is owner-scoped + thread-anchor-confirmed (mirrors `runs.py:645-670`); **404 (never 403)** on missing — no existence leak. Resume's service-role client → retrieval MUST stay owner-scoped |
| V5 Input Validation | yes | Pydantic `AskUserResponseBody`; `WorkflowDefinition.model_validate`; the lint is a pure validation gate (DoS mitigation extended) |

**Threat patterns (each PLAN.md gets a `<threat_model>` block; block on HIGH):**
| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| `T-093-IDOR` — ask_user answer accepted for another user's run (id confusion) | Spoofing / Elevation | owner-scoped `workflow_runs` resolve + thread-anchor confirm; 404 on missing |
| ask_user resume service-role client reads another user's documents | Information Disclosure | `search_documents` filters by `run["user_id"]` — retrieval owner-scoped despite RLS-bypassing service-role client |
| `T-093-MISROUTE` — stale cross-provider model name → wrong provider client | Tampering (mis-routing) | model-resolver field fix validates against `available_models` + provider default |
| `T-093-DOS` — malicious/broken workflow definition (unproduced input_keys, unbounded STRUCTURED growth) | DoS | reachability `INPUT_UNSATISFIED` lint (publish-time) + inject-once flag |

---

## Landmines (carried from RESEARCH — flag in plans)

1. **Seed `definition` JSONB is immutable-on-publish (056 trigger).** The `literature_review` input_keys fix + `plan_execute_verify` verify-gate fix touch PUBLISHED rows. **Read the trigger body before writing the migration** — it may force a new-version row (engine must then select latest-published-per-slug). Open Question 3 — could change the seed-fix task shape materially. Migration applies via the **operator SQL-editor checkpoint** (never `db push`), then regenerate full-schema.
2. **`task_service` is a SHARED Deep + harness file (RED LINE).** Rewiring `_stream_one_iteration` changes Deep `task()` sub-agents too (correct — they become cross-provider-robust — but must be proven non-regressing via the byte-identical-Deep guard + the eval `task`-prompt check). Land as its own task.
3. **Sync-generator trap (IN-05).** `open_stream` is `async def` annotated `-> AsyncIterator` but returns SYNC generators. Drive with `for chunk in stream:` in `run_in_threadpool`, `close_fn=stream.close`. `async for` will break.
4. **STRUCTURED residue is consumer-side, not in the gateway.** The harness consumer MUST replicate inject (TOOL_USAGE_INSTRUCTIONS) + post-parse (`parse_structured_tool_calls`) gated on `calling_mode`. **Mechanism split (clarified 2026-06-02, post-adversarial-review):** on their REGISTERED-DEFAULT model IDs the four compat natives (DeepSeek/Moonshot/GLM/MiniMax) are `native_tools:True` → resolve **NATIVE** → fire tools via the API param (the happy path — the gateway-consumption fix is what lets that mode actually take effect, since the old path discarded `calling_mode`). The STRUCTURED inject+post-parse recovery is the **safety net** for a `native_tools:False` / registry-miss / OpenRouter-xml model — the case-sensitive-registry trap (`project_cross_provider_native_tools_registry_trap`) that makes a mis-cased/unregistered id fall back to narration. **LIVE UAT must verify BOTH:** (a) default-model compat-natives fire `search_documents` via NATIVE; (b) a deliberately registry-missing model triggers the STRUCTURED recovery (does not narrate).
5. **Surfacing single-owner.** Don't let both the live `_shielded_finalize` persist AND the new shared helper persist — one persist owner per entry path; remove the inline `threads.py` surfacing block in the same commit as the helper extraction.
6. **resume/Continue set `user_settings=None` today.** The model-resolver fires only when user_settings is present — if D-04's "all 3 build sites" needs a live resolve on resume/Continue, those paths need owner settings loaded (Open Question 2).
7. **`input_keys` is INERT on llm phases (corrected 2026-06-02).** Only `_exec_programmatic` reads `config.input_keys` (phase_types.py:205); `_exec_llm_single`/`_exec_llm_agent` ignore it and instead chain the prior phase output as the user turn via `_prior_output_text` (phase_types.py:116/231). So the "asks me to share the research" defect is a PROMPT-quality issue, not a missing-input_keys wiring break — the fix is the migration-065 Fix-3 prompt rewrite, NOT binding input_keys on the summarize/merge/finalize phases (which would be a no-op). The `split_topic` input_keys fix stays valid because that phase IS programmatic.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s (Layer 1)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
