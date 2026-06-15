---
status: audit-complete
phase: 092-dual-mode-wiring-continue-button
type: comprehensive-bug-landscape + phase-scope
date: 2026-06-01
source: 5 parallel READ-ONLY code audits (provider parity ×2, phase-type readiness, seed-workflow E2E, UI/presentation, regression/cross-cutting) cross-checked against live operator UAT (092-07-UAT-FINDINGS F9/F10, UPDATE 6 cross-provider Deep proof)
purpose: replace piecemeal F-by-F deviations with a small number of comprehensive, UAT-gated phases
---

# 092 Comprehensive Audit — Harness / Workflow + Dual-Mode Surface

## TL;DR (for the product owner)

You said: *"we will face a lot of bugs across providers, modes and UI."* **That is correct, and here is the honest quantification.** Five independent code audits found **34 distinct issues**: **5 critical, 13 high, 11 medium, 5 low**. They are NOT 34 unrelated bugs — they collapse into **4 root causes**. The single biggest one is that the **harness (workflow) path is a re-implementation of Deep that never actually used Deep's machinery**: it talks to every LLM provider through one OpenAI-shaped pipe, so it only works on OpenAI. Deep mode, by contrast, was **live-proven correct on all 7 native providers** (092-07 UPDATE 6). So this is not a provider problem and not a Deep problem — it is a *harness-substrate* problem plus a *presentation* problem.

The good news: **F1–F8 are already fixed and live-verified** (the core OpenAI document-grounded workflow runs end to end with visible sources + confidence). What remains is making that same loop work on the other 6 providers, finishing the 3 phase-types that were never exercised live, and building the workflow-mode UI that was deliberately deferred.

**Recommendation: 2 phases (one backend hardening, one design→build UI), each with a real multi-axis UAT gate, instead of more single-domino fixes.** Optionally a tiny 3rd phase for the seed-workflow prompt/key fixes. Detail in §4.

---

## 1. Bug landscape at a glance

All 34 distinct issues, severity-sorted. `Area`: **prov** = cross-provider routing, **phase** = phase-type executor, **flow** = workflow/resume/continue, **UI** = presentation, **regr** = regression/cross-cutting. Several IDs from different audits describe the *same* underlying defect — those are marked `(dup of …)` and collapsed in the count.

| # | ID | Title (short) | Sev | Conf | Area |
|---|---|---|---|---|---|
| 1 | HARNESS-substructured-missing / PROV-structured-tools-unwired / PROV-harness-subagent-openai-only | Harness sub-agent loop has NO structured-mode handling (no schema injection, no text-tool-call parsing) and discards `calling_mode` — only OpenAI-shaped tool deltas are read | **critical** | high | prov |
| 2 | PROV-anthropic-native-404 | Anthropic 404s on the harness path — OpenAI client pointed at the Anthropic native base URL (Deep uses `stream_anthropic`) | **critical** | high | prov |
| 3 | HUMAN-answer-404-runs-table / DOCQA-asker-runid-404 | ask_user answer can never resume — prompt row stores the *workflow_run* id but `POST /runs/{id}/ask_user_response` validates against the `runs` table → 404, answer dropped (F10b) | **critical** | high | phase |
| 4 | RESUME-final-output-dropped / RESUME-no-answer-surfaced | Startup-sweep resume runs to completion but never persists/emits the final answer (F6 re-opens on resume) | **critical** | high | flow |
| 5 | CONTINUE-no-answer-surfaced | Harness *Continue* runs to completion but never persists/emits the final answer (CONT-01 broken for harness) | **critical** | high | flow |
| 6 | HARNESS-ctx-model-unset / PROV-wf_ctx-missing-model | `wf_ctx` never sets `ctx.model` at either build site → sub-agent model resolved solely from `user_settings.llm_model`; resume/Continue set `user_settings=None` → env-default provider misroute (F9a) | **high** | high | prov |
| 7 | PROV-openrouter-structured-harness | OpenRouter is registry-pinned `native_tools=False` → harness phases always hit the unhandled structured path → narration instead of tool calls | **high** | high | prov |
| 8 | PROV-google-compat-divergence | Google runs through the OpenAI-compat shim in harness (no native `stream_google`) → thought_signature / usage divergence vs Deep | **high** | med | prov |
| 9 | PROV-reasoning-think-tags-unhandled | No think-tag / reasoning_content handling in `_consume_sync_stream` → reasoning leaks into output / budget starvation | **high** | high | prov |
| 10 | PROV-resolver-name-only | Sub-agent resolver fixes the model *name* but not the *transport* — corrected name still goes to the same OpenAI client, so Anthropic still 404s | **high** | high | prov |
| 11 | CROSS-PROVIDER-no-native-sdk | All LLM phase-types break off-OpenAI — harness sub-agents/single never branch to native Anthropic/Google SDK (F9, the umbrella) | **high** | high | prov |
| 12 | RESUME-user-settings-none | Resume + Continue lose `user_settings` (=None) → LLM phases route to env-default provider/model, not the user's | **high** | high | flow |
| 13 | PROG-split-topic-topic-key / LITREV-split-topic-key-mismatch | `programmatic` `split_topic` reads `input['topic']` but the run only ever stores `kickoff_prompt` → always returns `[]` → type is effectively dead | **high** | high | phase |
| 14 | BATCH-no-fanout | `llm_batch_agents` never fans out (depends on the empty `sub_questions`) → silently degrades to ONE generic sub-agent | **high** | high | phase |
| 15 | DOCQA-invisible-draft / INTERMEDIATE-outputs-invisible / PROV-intermediate-output-invisible | Intermediate phase outputs are never surfaced — only the FINAL phase text renders → ask_user fires with no draft (F10a); batch sub-results invisible | **high** | high | UI |
| 16 | PROV-phase-events-dropped | Backend emits `phase_started/completed/transition/gate_failed` but the frontend SSE parser has NO handler → no phase progress can render | **high** | high | UI |
| 17 | PROV-failed-run-looks-complete | `fail_run` / `gate_failed` emits a `done` sentinel with an empty assistant message → a failed workflow looks successful | **high** | high | UI |
| 18 | PEV-cross-provider-F9 | Plan→Execute→Verify (and all llm_agent/batch phases) only verified on OpenAI — execute_code/search may be narrated as text off-OpenAI | **high** | med | flow |
| 19 | PROV-google-maxtools-parallel | Google `max_tools=16` cap applied on harness but NOT on Deep → asymmetric Deep-mode Google tool-count quality risk | **med** | med | prov |
| 20 | PROV-deepseek-reasoning-harness | DeepSeek `reasoning_content` round-trip handled in Deep loop, ignored in harness `_consume_sync_stream` → multi-turn tool loops may misbehave | **med** | med | prov |
| 21 | PROV-zhipu-minimax-registry-trap / PROV-registry-trap-glm-minimax | GLM/MiniMax registry trap latent: a mis-cased/unmatched id infers to `ollama` → `native_tools=False` → structured → harness narrates (defaults are safe; user-picked ids are the risk) | **med** | med | prov |
| 22 | PROV-deepseek-moonshot-glm-minimax-soft-fail | The 4 OpenAI-compat native providers *connect* but degrade (reasoning leak / structured trap), they don't 404 — a quieter, harder-to-spot failure | **med** | med | prov |
| 23 | HARNESS-citations-depend-on-tools | Source_refs/confidence only populate if a tool actually fires — structured-mode fallthrough yields an *ungrounded* answer that can still show a confidence chip (masks the failure) | **med** | med | phase |
| 24 | HARNESS-askuser-transport / PEV-verify-gate-repays-execute (split) | ask_user channel keying nuance + verify-gate brittleness (see rows 3 & 25) | **med** | med | phase |
| 25 | PEV-verify-gate-repays-execute | Plan→Execute→Verify regex gate (`VERIFIED`) re-runs the *whole* verify LLM each retry; a model that never echoes the literal token dead-ends the whole run | **med** | med | flow |
| 26 | PROV-harness-mode-no-workflow-silent-deep | Harness mode with NO picked workflow silently sends a plain Deep turn while the composer still shows "Harness" | **med** | high | UI |
| 27 | PROV-two-knob-composer-confusion | General/Explorer + Deep/Harness + picker render as identical adjacent pills with overlapping semantics (the D-092-UX concern) | **med** | high | UI |
| 28 | PROV-cappaused-locks-composer-misleading | A `cap_paused` run keeps the composer locked with a misleading placeholder while idle, awaiting Continue | **med** | high | UI |
| 29 | PROV-no-runcard-harness-asymmetry | Harness answers get no RunCard / phase timeline; Deep tool-bearing turns do | **med** | high | UI |
| 30 | CONT-double-execute-claim | Harness Continue takes no `claim_run` lease before `run_workflow` → startup sweep + Continue could double-drive the same run (narrow window) | **med** | med | regr |
| 31 | TEST-resume-continue-surfacing-uncovered | F6/F7 tests stub `run_workflow` and assert the live branch only → resume/Continue surfacing + real cross-provider sub-agent streams are structurally invisible to CI | **med** | high | regr |
| 32 | LITREV-batch-grounding-confidence-skew | Batch `similarity_scores` extended per-branch then averaged run-level (not deduped) → confidence chip skews vs Deep | **low** | med | phase |
| 33 | RESUME-folder-scope-lost | Resume/Continue set folder scope to None → unscoped (whole-KB) retrieval vs the run's intended folder | **low** | high | flow |
| 34 | DOCQA-prompt-row-best-effort-resume | ask_user prompt-row insert is best-effort; on insert failure the resume re-emit mints a NEW tool_call_id and orphans the old answer | **low** | med | phase |
| 35 | BATCH-semaphore-claim-hollow | Docstring claims batch `Semaphore(5)` composes with the per-run `Semaphore(3)` — false (run_task_sub_agent never acquires the per-run sem); harmless but misleads 096 sizing | **low** | high | phase |
| 36 | HUMAN-resume-audit-userid-null-risk | ask_user durable row + `harness_audit.user_id` can be NULL on a resume row with NULL user_id → F1-class reject (unguarded assumption on the untested human-input resume path) | **low** | med | phase |
| 37 | PROV-llm-single-no-name-safety-net | `llm_single` bypasses the name resolver → a stale model name reaches the transport raw | **low** | high | prov |
| 38 | PROV-llm_single-no-tool-reasoning-roundtrip | `llm_single` discards `calling_mode`; native Anthropic content extraction may yield empty/partial summarize text even when the research sub-agent succeeded | **low** | med | prov |

**Honest count after collapsing duplicates:** ~**34 distinct defects**. The severity is real but *concentrated*: the 5 criticals and 8 of the 13 highs all trace back to the same handful of root causes in §3 — fix those and roughly two-thirds of the list closes at once.

---

## 2. By theme

### (A) Cross-provider harness parity — F9, generalized

**The headline finding, and it is now backed by direct live evidence, not inference.** In Deep mode, the same RAG prompt answered correctly and grounded on **all 7 native providers** (092-07 UPDATE 6: OpenAI, Anthropic, Google, DeepSeek, Moonshot, MiniMax, GLM — all ✅, all with sources + high confidence). In Harness mode, the identical workflow worked on **OpenAI only**.

The reason is structural: Deep branches at the service boundary into the *native SDK* for each provider (`stream_anthropic`, native Google path) and into structured-vs-native tool handling. The harness phase sub-agent does none of that — `task_service._stream_one_iteration` sends every provider through one `create_adaptive_streaming_chat → OpenAI-shaped client`, discards the returned `calling_mode`, and `_consume_sync_stream` only reads native OpenAI `delta.tool_calls`. Failure modes split by provider:

- **Anthropic** → **hard 404** (OpenAI client pointed at Anthropic's native base URL). Loudest, easiest to spot.
- **Google** → connects via the compat shim but diverges on thought_signature / usage; tool-count cap asymmetry vs Deep.
- **DeepSeek / Moonshot / GLM / MiniMax** → **soft failure**: they connect (OpenAI-compatible endpoints) but degrade — reasoning_content leaks into the answer, or a registry-miss / structured-mode fall-through means **tools are narrated as text and `search_documents` never fires** → an *ungrounded* answer that can still wear a confidence chip (masking the failure).
- **OpenRouter** → registry-pinned `native_tools=False` → always the unhandled structured path → narration. (OpenRouter is experimental per project policy; fix only if native-safe + low-cost.)

Compounding routing bug (provider-agnostic but lethal off-OpenAI): `wf_ctx` never carries a resolved `model`, so the sub-agent model is read from `user_settings.llm_model`; on **resume/Continue** `user_settings=None`, so the run silently falls to the env-default provider (`settings.llm_model`, typically a `gpt-*`) regardless of what provider the run was started under.

**Net:** harness is "Deep's intent without Deep's substrate." The fix is to make the harness sub-agent loop *consume the same provider boundary Deep already uses* — not to re-derive it.

### (B) Phase-type coverage — what's actually been exercised live

Only **2 of 5** phase-types are proven live, and only on the OpenAI happy path:

| Phase type | Live status | Blocking defect |
|---|---|---|
| `llm_agent` | ✅ proven (Research phase, OpenAI) | rides §A off-OpenAI |
| `llm_single` | ✅ proven (Summarize phase, OpenAI) | discards calling_mode; no name safety net (rows 37–38) |
| `programmatic` | ❌ **dead** | `split_topic` reads `input['topic']`; runs only carry `kickoff_prompt` → always returns `[]` (row 13) |
| `llm_batch_agents` | ❌ **never fans out** | depends on the empty `sub_questions` → degrades to ONE generic sub-agent (row 14); the headline parallel feature never engages |
| `llm_human_input` (ask_user) | ❌ **round-trip broken** | answer 404s on the `runs`-table ownership gate (row 3); and the draft is invisible before the prompt (row 15) — exactly F10 |

`execute_code` *inside* a phase was the one hypothesized break that the audit **disproved** — the sandbox is keyed on `ctx.thread_id` (carried), not on ctx-borne deps, so it works on both live and resume. Its real risk is provider parity (§A) and the brittle verify-gate (row 25), not sandbox context. Note `programmatic` (13) and `batch` (14) are the *same* root cause: a single missing `topic` key kills both, because batch depends on what programmatic produces.

### (C) Workflow-type coverage — the 4 seed workflows (`061_harness_seed_templates.sql`)

| Seed workflow | Phase chain | Verdict |
|---|---|---|
| **Research → Summarize** | llm_agent → llm_single | ✅ **the only verified-working path** (OpenAI). Rides F4–F8 cleanly. |
| **Plan → Execute → Verify** | llm_single → llm_agent(+execute_code) → llm_single (regex `VERIFIED` gate) | Structurally fine on sandbox; **fails off-OpenAI** (§A) and the **regex gate can dead-end the whole run** if the model never echoes the literal token (row 25). |
| **Doc Q&A** | llm_agent(draft) → llm_human_input(confirm) → llm_single(finalize) | ❌ **two breaks = F10**: (a) draft invisible before the prompt; (b) ask_user answer 404s and never resumes. |
| **Literature Review** | programmatic(split) → llm_batch_agents(review ×N) → llm_single(merge) | ❌ **most broken**: split gets `{}` → no sub_questions → fan-out collapses to one generic agent. The headline parallel demo never runs. |

So **1 of 4 seed workflows works, on 1 of 7 providers.** That is the honest scale.

### (D) Presentation / legibility — the deferred-094 surface + mode clarity

This is a coherent *second* cluster, mostly independent of the backend cluster, and it makes even the working OpenAI path feel broken:

- **Phase events go nowhere** (row 16): the engine emits `phase_started/completed/transition/gate_failed`, the frontend has **no handler** → zero phase progress renders. Root of the invisible-intermediate-output problem.
- **Only the final phase text shows** (row 15): intermediate drafts and batch sub-results never reach the user → the ask_user prompt appears with no draft (F10a), batch looks like nothing happened.
- **Failed runs look successful** (row 17): `fail_run`/`gate_failed` emit a `done` sentinel with empty content → DB says `failed`, the UI says done with no error. This is a *trust* bug.
- **Mode clarity** (rows 26–28): two orthogonal axes (General/Explorer × Deep/Harness) plus a workflow picker render as look-alike pills; Harness-with-no-workflow silently runs a Deep turn; a `cap_paused` run leaves the composer locked with a misleading placeholder. This is the D-092-UX composer-simplification concern.
- **No RunCard for harness** (row 29): Deep tool turns get a run-card; harness answers don't, so a workflow result looks like a plain message with no provenance of the multi-phase work behind it.

### (E) Regressions / cross-cutting

- **Deep is NOT regressed** — verified. The MODE-01 branch is a clean additive if/else; the Deep `else` path is unchanged; the shared files F5/F7/F8 touched (`run_task_sub_agent`, `phase_types`) are additive (overrides default to None for Deep callers). The "Deep byte-identical" claim **holds** at the producer-shell seam. Good.
- **Resume drops the answer** (row 4) and **Continue drops the answer** (row 5): F6/F7 surfacing is wired ONLY in the live-kickoff branch. Both resume paths run the workflow to completion and then throw the answer away — F6 re-opens, and CONT-01 is broken for harness specifically.
- **Resume/Continue lose user_settings + folder scope** (rows 12, 33): wrong provider, and whole-KB retrieval instead of the run's folder.
- **Continue has no claim_run lease** (row 30): a narrow double-drive window vs the startup sweep — the same CAS hazard 091-08 was added to prevent.
- **The test blind spot persists** (row 31): F6/F7 tests stub `run_workflow` and only assert the live branch; resume/Continue surfacing and real cross-provider sub-agent streams are invisible to CI. *This is the exact pattern that let F1→F8 each pass tests and only fail in live UAT.* Any fix here MUST come with live-DB / real-provider tests or it will recur.

---

## 3. Root-cause clusters — the few causes behind the many symptoms

Four causes explain ~all 34 symptoms:

**RC-1 — The harness re-implemented Deep's LLM loop instead of reusing Deep's provider boundary.**
`task_service` funnels every provider through one OpenAI-shaped sync stream, discards `calling_mode`, and has no native-SDK branch and no structured-mode inject/parse. → rows 1, 2, 6, 7, 8, 9, 10, 11, 18, 20, 21, 22, 23, 37, 38 (the entire §A cluster + the grounding-masking row). **This is the single highest-leverage fix.** It is also a *shared* file (Deep's `task()` tool uses it), so the fix must stay at the service boundary and not regress Deep's task callers.

**RC-2 — The harness path was never exercised live until F4, so everything downstream of "a phase actually does work" is untested-by-construction.** F1→F8 each peeled one layer that only appeared once the prior layer worked. The three never-run phase-types (programmatic/batch/human-input) and both resume/Continue surfacing gaps are all "code that no live run ever reached." → rows 3, 4, 5, 12, 13, 14, 31, 33, 34, 36. The cure is not more fixes — it is a **UAT gate that forces every phase-type × every workflow × every provider to actually execute** before the phase is called done.

**RC-3 — `run_id` namespace confusion: `workflow_runs` id vs `runs` id.** The harness keys prompts/channels on the *workflow_run* id, but the ownership/answer endpoint validates against the *runs* table. → row 3 (ask_user 404, F10b), and it compounds the resume re-emit orphaning (row 34). One namespace decision fixes both.

**RC-4 — Presentation was built for Deep only; the harness emits a richer event vocabulary that the frontend ignores.** The engine speaks `phase_*`/`gate_failed`; the UI only knows `delta`/`sources`/`confidence`. So intermediate work is invisible, failures look like successes, and there's no phase timeline. → rows 15, 16, 17, 26, 27, 28, 29. This is the entire §D cluster and was *deliberately deferred to 094* — it is now the gating UX defect for ask_user and batch.

Two crisp slogans for the systems view: **"harness has Deep's intent without Deep's substrate" (RC-1+RC-2)** and **"the answer surface was wired once, on the live-kickoff branch, for Deep's event vocabulary" (RC-3+RC-4).**

---

## 4. Recommended phasing

Carve this into **2 comprehensive phases** (+1 optional micro-fix), each with a real multi-axis UAT gate. Stop the F-by-F deviation pattern.

### Already DONE — do not re-litigate
F1 (`harness_audit.user_id`), F2, **F4** (sub-agent parent_run_id FK), **F5** (wf_ctx carries supabase + folder-scope + spawn + semaphore), **F6** (final answer surfaced/persisted on the live-kickoff branch), **F7** (sources + confidence visible, Deep's shape), **F8** (kickoff_prompt threaded into the first phase) — all **VERIFIED LIVE on OpenAI**. The core document-grounded loop works. Deep mode is **provider-robust on all 7** (UPDATE 6) and is **not regressed**. The new phases build ON this, they don't redo it.

---

### PHASE A — "Harness cross-provider + phase-type hardening" (backend)
**Owns RC-1, RC-2, RC-3.** This is the big one and it is backend-only.

**Scope:**
1. **Provider parity (RC-1):** route the harness phase sub-agent loop through the *same* provider boundary Deep uses — native Anthropic/Google SDK branches + structured-mode schema-inject/parse for the OpenAI-compat + structured providers + reasoning_content / thought_signature round-trip. Stay at the service boundary; do not touch Deep's `task()` callers' behavior (additive overrides only).
2. **Model/provider routing (RC-1):** thread the resolved model into `wf_ctx.model` at BOTH build sites; carry `user_settings` (or an equivalent resolved provider/model snapshot) into the resume + Continue contexts so a run resumes on the provider it started under.
3. **Phase-type completion (RC-2):** fix the `topic`/`kickoff_prompt` key so `programmatic.split_topic` and therefore `llm_batch_agents` fan-out actually run; harden the verify-gate so a missing literal token doesn't dead-end a successful plan+execute.
4. **ask_user round-trip (RC-3):** resolve the `workflow_runs`-vs-`runs` id namespace so the answer endpoint accepts the harness prompt's id and resumes the paused phase.
5. **Resume/Continue answer surfacing (RC-2):** wire F6/F7 surfacing into the resume + Continue paths (read `final_output`, persist + emit); add the `claim_run` lease to Continue; restore folder scope.

**UAT gate (the non-negotiable part — this is what F1–F8 lacked):** a live matrix of
**native-7 providers × all-5 phase-types × all-4 seed workflows**, with at least the 4-axis bandwidth (cross-provider, multi-tool, parallel-thread, long-message) per the UAT scoreboard recipe. Plus resume + Continue + reload rows. **Seed the runs — no "if data permits" deferrals.** And add the live-DB / real-provider tests that close the row-31 mock blind spot. A phase is not done until the scoreboard is green, not just CI.

**Dependencies:** none beyond the shipped F1–F8. This must ship FIRST — Phase B's UI is meaningless if the workflows don't run cross-provider.

**Note on guardrails:** `task_service.py`/`phase_types.py` are becoming hot files. Audit the G-5 ledger at discuss-phase; if RC-1 turns into a third feature wave on the sub-agent loop, consider an extraction first.

---

### PHASE B — "Workflow-mode legibility + mode clarity" (design → build, sketch-first)
**Owns RC-4 + the D-092-UX composer concern. This is the deferred Phase 094 surface, now mandatory because it gates the ask_user and batch UX.**

**G-2 fires:** this is live-UI / panel / badge / "feels like" work → **start with `/gsd:sketch`**, operator-approved mockup is the acceptance bar, BEFORE spec/plan.

**Scope:**
1. **Phase progress (RC-4):** frontend handlers for `phase_started/completed/transition/gate_failed`; render a phase timeline / RunCard for harness answers (parity with Deep tool turns).
2. **Intermediate output (RC-4):** surface intermediate phase text (the draft before ask_user, batch sub-results) — progressive disclosure, not just the final delta.
3. **Failure honesty (RC-4):** a failed/gate-failed run must render as failed with an error, never as a `done` sentinel with empty content.
4. **Mode clarity (D-092-UX):** disambiguate the two orthogonal axes + picker; guard Harness-with-no-workflow (don't silently send Deep); fix the `cap_paused` composer-lock placeholder + Continue affordance.

**UAT gate (G-4 lived-experience):** operator-defined "I'd recognize failure here" scenarios at scope-time, driven via Chrome MCP — exercise both themes, multiple threads, mobile, ask_user render+answer end-to-end, a failing workflow showing as failed, a long-running workflow showing live phase progress, and the composer states (idle / streaming / cap_paused / Continue).

**Dependencies:** **must follow Phase A** (the events Phase B renders only carry answers once Phase A surfaces them on resume/Continue, and ask_user only round-trips after RC-3).

---

### PHASE C (optional micro-fix) — seed-workflow prompt/key cleanup
Some §B/§C defects are 1-line data fixes in `061_harness_seed_templates.sql` (the `topic` input_key, the brittle `VERIFIED` regex). If Phase A's scope absorbs them cleanly, fold them in; otherwise a single `/gsd:quick` migration. **Do NOT spin a full discuss→plan→execute for this (G-3).**

**Sequence:** **A → B**, with C folded into A or run as a quick before A's UAT. Phase A is the spine; everything legible in B depends on A's answers actually existing and routing correctly.

---

## 5. Explicitly NOT now

- **Workflow builder / authoring UI** — deferred to v2.9 (D-092-AUTHOR Phase A is authoring-spec only; no builder this milestone). These two phases harden + surface the *existing* seed workflows, they do not let users compose new ones.
- **New engine logic / new phase-types / plugin contract** — the engine's 5 phase-types are the surface; Phase A finishes the 3 unfinished ones, it does not add a 6th. Plugin Contract stays deferred to v2.9.
- **Making Deep "feel deeper"** — Deep is already provider-robust and grounded on all 7 (UPDATE 6). No Deep-mode behavior changes; "Deep byte-identical" stays the invariant. This work is about bringing *Harness* up to Deep's substrate and giving it a legible surface — not changing Deep.
- **096 concurrency fair-share sizing** — note row 35 (the false Semaphore-composition claim) so 096 isn't misled, but the actual sizing work stays in 096.
- **OpenRouter as a first-class target** — fix OpenRouter-only issues only if native-safe + low-cost (project policy: experimental). The native-7 are the bar.
