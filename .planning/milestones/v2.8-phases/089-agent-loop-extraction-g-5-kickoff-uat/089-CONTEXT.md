# Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A **pure, behavior-preserving lift** of the agent loop out of the 3,186-LOC `backend/app/api/threads.py` god file into a clean `backend/app/services/agent_loop.py::run_agent_loop()` module — with **byte-identical cross-provider SSE before and after** — PLUS the **CF-01** v2.7 carry-forward UAT sweep (title-gen, Google secondary-model 404, download-link payload).

This is the **G-5** refactor that gives the harness (Phase 091) a clean module to sit on instead of bolting onto the god file. The loop serves BOTH `agent_mode` values (General AND Explorer) and must preserve the Explorer branch (its 6-KB tool set, dedicated prompt, `max_iterations=8`) byte-identically.

**In scope:** verbatim extraction of the iteration loop + tool-dispatch block; the CF-01 carry-forward verification sweep; before/after equivalence proof across the native provider matrix.
**Out of scope:** ANY feature fix, bug fix, or "while-I'm-in-here" cleanup. Harness features (091+). Schema (090). The two deferred Anthropic agent-loop bugs (Phase 093). SEED-037 download wire-up unless the sweep proves it's needed (then a standalone `/gsd:quick`, not a 089 task).

</domain>

<decisions>
## Implementation Decisions

### Extraction boundary & seam
- **D-089-01:** **Clean module.** `agent_loop.py::run_agent_loop()` owns the iteration loop, the tool-dispatch block, the three provider chunk-handlers (`_on_chunk_anthropic` ~L1944, `_on_chunk_google` ~L2055, `_on_chunk_openai` ~L2245), AND `_persist_assistant_message` (~L1659) — all moved **VERBATIM** (no logic change). This is what SC#1's "iteration loop + tool-dispatch block" means.
- **D-089-02:** `threads.py` retains ONLY: the route handler (`send_message` ~L1225), the producer spawn (`agent_runner` ~L1423 shell + `_producer`/`_drain` plumbing), `_emit`/`_emit_terminal`/`_spawn` helpers, and `_shielded_finalize` (~L3035). SC#1 verbatim.
- **D-089-03:** **No "while-I'm-in-here" cleanup.** The extraction changes file location only, never behavior. This is the highest-risk-if-done-wrong phase of v2.8 — a careless cleanup re-opens the entire 075.x cross-provider cascade.
- **D-089-04:** **State-passing across the new module boundary = Claude's discretion** (likely a frozen context dataclass — e.g. `AgentLoopContext`/`RunContext` — holding `run_id`, `redis`, the request, thread, reconstructed history, plus the `_emit`/`_spawn` callables — over a ~15+ arg flat parameter list). Researcher/planner picks the mechanism that minimizes diff-risk and **reports the exact seam + `run_agent_loop` signature back to the operator for confirmation BEFORE executing.**

### Cross-provider matrix (operator correction — ROADMAP "6" undercounts)
- **D-089-05:** The 089 baseline covers the **full native first-class provider set of 7**: `openai`, `anthropic`, `google`, `deepseek`, `moonshot`, **`zhipu`/GLM, `minimax`**. The ROADMAP/REQUIREMENTS wording "all 6 native providers" inherited the 088 eval's 6 (which never added GLM + MiniMax) and **undercounts** — `_PROVIDER_BASE_URLS` in `backend/app/config.py` is the single source of truth and registers GLM (zhipu) + MiniMax as wired native providers, NOT deferred. **This correction is authoritative and propagates to every downstream v2.8 phase** (091/092/093/094/095/096 cross-provider success criteria read "native-7", not "native-6").
- **D-089-06:** Per-provider round-trip invariants carried forward verbatim and **named in VERIFICATION** (SC#2) span the matrix, not just Anthropic: Anthropic `end_turn`-instead-of-`tool_calls`; Google `thought_signature` echo; DeepSeek `reasoning_content` round-trip; Moonshot empty-content-after-tool-call retry guard; plus the shared guards `force_no_tools`-on-last-iteration, iteration-cap silent-drop guard (`kind='iteration_cap_dropped_tool_calls'`), and the terminal-status race (`_shielded_finalize`). GLM + MiniMax invariants captured if any exist; absence noted explicitly.
- **D-089-07:** **OpenRouter = experimental / best-effort** in the matrix — a regression there is logged, not a phase-blocker ([[feedback_openrouter_is_experimental]]). **Ollama = optional / opportunistic** (exercised if running locally, not a gate). The **native-7 are the hard pass/fail bar.**

### Byte-identical proof bar (SC#3)
- **D-089-08:** **Both mechanisms.** (a) Capture per-provider **SSE event-sequence logs** from a scripted multi-tool run BEFORE extraction, replay the identical run AFTER, assert the **diff is empty** (literal SC#3 "captured snapshot diff = empty" evidence); AND (b) the 088 cross-provider eval-harness (`scripts/eval_cross_provider.py`) + the 075.4 Playwright E2E backstop stay **GREEN before AND after** as the behavioral backstop.
- **D-089-09:** **Extend the automated eval gate to GLM + MiniMax NOW in 089.** Add `zhipu`/GLM + `minimax` to the eval script's PROVIDERS list + do a quick **current-model-ID curation pass** (per [[feedback_model_names_representative]] — names are provider-class, need pinning) so the automated SSE-diff + eval gate covers all 7 native first-class providers from the kickoff baseline. This is **additive proof-harness work, NOT agent-loop edits** — it does not violate extraction-purity, and it gives 091+ a complete regression gate. (088 eval was 6 → 089 makes the automated gate 7 native + OpenRouter best-effort.)
- **D-089-10:** "Representative multi-tool run" = **Claude's discretion**, guided by SC#10's multi-tool axis (a scripted prompt exercising 2+ tools, e.g. `search_documents` + `execute_code` and/or `write_todos`) run on each native provider. Manual 4-axis kickoff UAT (cross-provider × multi-tool × parallel-thread × long-message ≥50 msgs / ≥5 KB) exercised in BOTH General AND Explorer `agent_mode` (SC#4).

### CF-01 carry-forward sweep
- **D-089-11:** **Driver = hybrid.** Claude drives the browser-observable checks via Chrome MCP on `http://localhost:5173/` (test login `fhdmrd@gmail.com`, per [[reference_local_dev_app]]) — title-gen appearing, download link working — AND authors the exact cross-provider eval runbook/script. **The operator runs the backend eval script** (it hits real provider APIs needing keys only in the operator's `backend/.env`) + confirms provider keys, then pastes results back. Operator starts uvicorn themselves in a visible terminal ([[feedback_user_starts_backend]]) — never `run_in_background`.
- **D-089-12:** **Disposition = re-open + defer; 089 stays pure.** If any swept item is STILL broken, it is **re-opened with a concrete `re_open_trigger`** and routed to a named later slot — **zero feature fixes inside 089**. Routing: title-gen / Google-404 → a v2.8 polish slot (093 vicinity or a standalone quick); download-link → SEED-037 `/gsd:quick`. Preserves G-5 discipline + avoids the "while-I'm-in-here" trap ([[feedback_check_user_ask_before_overscoping]]).
- **D-089-13:** **CF-01 title-gen sweep scope = the native-7**, not just the ROADMAP's "DeepSeek/Moonshot/Google" (BUG-260527-01). Extend to verify GLM + MiniMax + OpenAI + Anthropic title generation too, consistent with D-089-05.
- **D-089-14:** **SEED-037 download `/gsd:quick` timing = decide after the sweep.** If download proves genuinely still-broken AND it's the SEED-037 in-panel wire-up gap, run the quick right then (already at the download surface); if download already works, SEED-037 stays a separate later quick. Data-driven, not pre-committed.

### Reported-bugs routing (MANDATORY cross-check — `surface: Agentic-RAG`)
- **D-089-15:** Six Agentic-RAG bugs sit in this neighborhood; **none fold into 089** (all already homed by the v2.8 roadmap — see `<deferred>`). The two `backend/agent-loop` Anthropic bugs (`anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations`) stay **deferred to Phase 093** and **must NOT be touched during the lift** — fixing them is the forbidden cleanup that re-opens the cascade. Behavior is preserved verbatim (bugs included); 093 fixes on the clean module after.

### Claude's Discretion
- State-passing mechanism / context object shape (D-089-04 — report seam first).
- Exact "representative multi-tool run" prompt + tool selection (D-089-10).
- Whether the extraction lands as one atomic commit or a reviewable sequence (planner's call) — provided each intermediate state keeps eval + E2E GREEN.

### Folded Todos
None — `todo.match-phase 089` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition & requirements
- `.planning/ROADMAP.md` §"Phase 089" — goal, 5 success criteria, Explorer-branch note, G-5 satisfaction.
- `.planning/REQUIREMENTS.md` — FOUND-03 (extraction) + CF-01 (carry-forward sweep) full text; Traceability table.
- `.planning/PROJECT.md` — v2.8 goal, "G-5: extraction lands FIRST", D-v2.8-01, mode-axis clarification (Deep/Harness orthogonal to General/Explorer).
- `.planning/STATE.md` — Blockers/Concerns (089 is highest-risk; carry EVERY per-provider fix verbatim) + **Phase 086 surface note** (snapshot `role='system'` filter — any reconcile/message-list change MUST preserve `.neq("role","system")` or ask_user threads 500 on load).

### Extraction source (the code being lifted)
- `backend/app/api/threads.py` — `send_message` route ~L1225; `agent_runner` ~L1423; `_persist_assistant_message` ~L1659; `_on_chunk_anthropic` ~L1944; `_on_chunk_google` ~L2055; `_on_chunk_openai` ~L2245; `_shielded_finalize` ~L3035; `_emit`/`_emit_terminal`/`_spawn` ~L69-126; `_reconstruct_history` ~L1135.
- `backend/app/services/tool_dispatcher.py` — the 083 registry-pattern `dispatch_tool()` the loop calls (the 091 whitelist guard lands here later; 089 must NOT disturb it).
- `backend/app/config.py` `_PROVIDER_BASE_URLS` (~L10-20) — **single source of truth** for the native provider list (the basis for D-089-05).

### Proof harness
- `scripts/eval_cross_provider.py` — the 088 SEED-034 cross-provider eval harness (greppable `EVAL_ROW`/`EVAL_SUMMARY`); the behavioral backstop + the script extended to GLM + MiniMax per D-089-09. Switches provider via per-request `MessageCreate.provider/model` override (threads.py ~L1285), NOT a persistent user_settings UPDATE.
- `.github/workflows/frontend-tests.yml` + the 075.4 Playwright E2E scenarios + `restart-backend.{sh,ps1}` + `/health` — the E2E backstop.

### CF-01 carry-forward bug reports
- `.planning/reported-bugs/title-generation-broken-deepseek-moonshot-google.md` (folded 083, BUG-260527-01 — verify or re-open).
- `.planning/reported-bugs/sub-agent-cross-provider-model-default-404.md` (closed 085) + the transient 088-04 Google secondary-model 404 routing artifact.
- `.planning/reported-bugs/final-outputs-backend-omits-url-in-event-payload.md` + `final-outputs-pinned-panel-no-download-link.md` (download-link payload).

### Project rules
- `CLAUDE.md` — G-5 hot-file ledger (`threads.py` 9+ touches → extraction due), SC#10 4-axis UAT recipe, provider-docs-first, no-shared-path-edits ([[feedback_no_cross_provider_regressions]]), [[feedback_cross_provider_always_top_of_mind]] (all 9 providers first-class).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/eval_cross_provider.py` (Phase 088) — the cross-provider eval scoreboard; reused as the behavioral proof-gate and extended to GLM + MiniMax (D-089-09).
- 075.4 Playwright E2E suite + `restart-backend.{sh,ps1}` + `/health` — reused as the E2E backstop before/after the lift.
- `tool_dispatcher.py` (Phase 083) — registry-pattern dispatch the lifted loop already calls; the extraction keeps this seam intact.
- `_emit`/`_emit_terminal`/`_spawn`/`_drain_stream_with_close_on_cancel` (threads.py) — the run:{run_id} Redis-stream plumbing the loop emits through; stays in threads.py, passed into `run_agent_loop` as callables.

### Established Patterns
- **One UX, N adapters** ([[feedback_provider_uniform_ux]]): provider-specific logic lives in the `_on_chunk_*` handlers; the shared SSE event vocabulary is provider-agnostic. The extraction moves the adapters into the module WITHOUT collapsing the shared path.
- **All harness/cross-cutting logic above the loop or at the single `dispatch_tool` entry — never inside provider streaming branches** (075.x cascade-prevention rule). The 089 extraction respects this; 091's whitelist guard relies on it.
- Per-request provider override for eval (no global state mutation) — the proof harness measures the REAL `active_system_prompt`.

### Integration Points
- `run_agent_loop()` is the seam Phase 091 branches into for harness phases; Phase 092 branches `agent_runner` on `threads.active_workflow_run_id`. 089 must land a signature clean enough for both to compose without re-touching it.
- Snapshot/`/messages` `role='system'` filter (086 surface note) — preserved through any reconstruction the lift touches.

</code_context>

<specifics>
## Specific Ideas

- Operator was explicit (2026-05-30): **do not treat this as Anthropic-centric.** Every provider — including DeepSeek, Moonshot, GLM, MiniMax — is first-class in the proof + UAT. The "Anthropic-only" mentions in the bug-routing table were Phase-093 (PARITY-01) bug titles, not 089 scope.
- The acceptance bar is **byte-identical SSE per provider**, captured-diff-empty — NOT "tests pass" (STATE blocker note, restated by operator).
- Seam-first review: operator wants to confirm the `run_agent_loop` boundary/signature BEFORE the verbatim move executes (D-089-04).

</specifics>

<deferred>
## Deferred Ideas

### Reported-bugs routing (surfaced at discuss-phase; none fold into 089)
- `non-anthropic-generic-code-task-descriptions` (open) → **Phase 093** (PARITY-01 SC#3) — leave open.
- `anthropic-end-of-cycle-shows-actions-not-summary` (deferred, **backend/agent-loop**) → **Phase 093** (PARITY-01 SC#1 / BUG-260514-02) — **stays deferred; must NOT fix during 089 lift.**
- `anthropic-excessive-tool-iterations-on-multi-step-tasks` (deferred, **backend/agent-loop**) → **Phase 093** (PARITY-01 SC#2 / BUG-260523-04) — **stays deferred; must NOT fix during 089 lift.**
- `chat-tool-cards-scroll-collapse-duplicate` (open) → **Phase 095** (CHAT-04) — leave open.
- `step-count-mismatch-timer-vs-panel` (open) → **Phase 095** (CHAT-04 SC#2) — leave open.
- `timer-disappears-long-runs` (open) → **Phase 095** (CHAT-04 SC#2) — leave open.

(No bug frontmatter mutated — all six are already correctly homed by the v2.8 ROADMAP; recorded here so future phases don't re-surface them as "missed.")

### Out-of-phase work (named homes)
- **SEED-037 download wire-up** — standalone `/gsd:quick`; trigger = CF-01 sweep proves download still-broken (D-089-14).
- **Per-provider model-ID full curation** beyond what D-089-09 needs for the eval gate → Phase 096 (EVAL-01 owns the comprehensive pass).
- General/Explorer-selector behavior DURING an active workflow → **Phase 092** (UX-composition call, explicitly deferred there).

### Reviewed Todos (not folded)
None — `todo.match-phase 089` returned 0 matches.

</deferred>

---

*Phase: 089-agent-loop-extraction-g-5-kickoff-uat*
*Context gathered: 2026-05-30*
