---
phase: 089
phase_name: "Agent-Loop Extraction (G-5) + Kickoff UAT"
project: "Agentic RAG"
generated: "2026-05-31"
counts:
  decisions: 8
  lessons: 7
  patterns: 9
  surprises: 5
missing_artifacts:
  - "089-UAT.md (phase used VALIDATION.md + the SC#5 UAT table embedded in 089-VERIFICATION.md instead of a standalone UAT.md)"
---

# Phase 089 Learnings: Agent-Loop Extraction (G-5) + Kickoff UAT

> Behavior-preserving lift of the agent loop from `threads.py` (~3,009 LOC) into `agent_loop.py::run_agent_loop()` (~2,354 LOC), proven byte-identical, plus the v2.7 carry-forward sweep. The highest-risk-if-done-wrong task of v2.8.

## Decisions

### Seam-first review gate before moving any loop body (D-089-04)
Propose the `run_agent_loop` signature + `RunContext`/`AgentLoopResult` dataclasses + the exact boundary in `SEAM.md`, and gate the verbatim move on operator sign-off — BEFORE relocating a single line of the loop body.

**Rationale:** Extraction was the highest-risk-if-done-wrong task of v2.8; a careless cleanup could re-open the entire 075.x cross-provider cascade. Locking the contract first made the move mechanical and reviewable.
**Source:** 089-01-SUMMARY.md, SEAM.md

### B1 boundary + co-located `_reconstruct_history`
The L1470–1627 setup block (folder-scope, General/Explorer prompt+tool selection, history rebuild + trim) moves INTO `run_agent_loop`; `_reconstruct_history` is co-located in `agent_loop.py` rather than imported back from `threads.py`.

**Rationale:** Keep-and-import was rejected because `agent_loop → threads` reintroduces the exact circular import the seam exists to avoid.
**Source:** 089-01-SUMMARY.md

### Keyword-only callable injection (`emit`/`emit_terminal`/`spawn`)
The loop receives its side-effecting collaborators as injected callables, not imports.

**Rationale:** Breaks the `threads ↔ agent_loop` circular import (Pitfall 4) and keeps the dependency one-directional; the harness (091/092) can later compose `run_agent_loop` without further `threads.py` surgery.
**Source:** 089-01-SUMMARY.md

### frozen `RunContext` (inputs) + plain `AgentLoopResult` (outputs)
A `@dataclass(frozen=True) RunContext` (9 raw input fields) and a plain `AgentLoopResult` (finalizer outputs) mirror `tool_dispatcher.py`'s `ToolContext`/`ToolResult` house style.

**Rationale:** Consistency with the existing extraction precedent (Phase 088) + a clear inputs/outputs contract that the locked signature can stay positionally compatible with.
**Source:** 089-01-SUMMARY.md

### Move shared module-level helpers (one canonical copy), re-import into `threads.py`
`SYSTEM_PROMPT`, `TOOL_USAGE_INSTRUCTIONS`, `_format_tool_list`, `_compute_confidence`, `_deduplicate_citations`, `_accumulate_chunk_usage`, `_is_transient_provider_error`, `_reconstruct_history` move to `agent_loop.py` and are re-imported into `threads.py`.

**Rationale:** Keeps the moved loop body referencing same-module symbols (cycle-free) while every existing `from app.api.threads import ...` call site + test import keeps resolving via the re-export.
**Source:** 089-03-SUMMARY.md

### `result_sink` + `timeout_ctx` by-reference containers + 6th `persist_system_warnings` field
Minimal Rule-3 structural additions (two optional kw-only params + one bound callable) so the shielded finalizer — which **STAYS** in `threads.py` — receives the persist callables, token totals, system warnings, and `timed_out` detail on **every** exit path including exception/re-raise.

**Rationale:** The finalizer needs loop-internal state that now lives inside `run_agent_loop`; by-reference containers surface it cycle-free without fattening `RunContext` or breaking the operator-locked signature. The terminal-race order (I10) stays byte-identical.
**Source:** 089-03-SUMMARY.md

### SC#3 acceptance bar adapted to a structural skeleton, not raw SSE (operator-endorsed)
The byte-identical bar is the **structural skeleton** (event grammar + tool names/sequence + code-exec lifecycle + terminal classification, collapsing all streaming chunk-types) + same-code run1-vs-run2 noise isolation — NOT a literal raw-SSE empty-diff.

**Rationale:** A raw empty-diff is impossible against live LLMs (identical code produced 36/33/34 events on Anthropic). The skeleton isolates the behavior under test from agentic non-determinism.
**Source:** 089-04-SUMMARY.md, 089-VERIFICATION.md §SC#3

### Zero feature fixes in 089 (D-089-12); CF-01 is sweep-and-disposition only
The carry-forward sweep dispositions each item (verified-closed / re-open+defer); the two deferred Anthropic agent-loop bugs were preserved **as bugs** for Phase 093; `dispatch_tool`/`ToolContext`/the Phase-086 `.neq("role","system")` filter were left untouched.

**Rationale:** Extraction purity — keep the move provably behavior-preserving; do not smuggle fixes into a relocation.
**Source:** 089-VERIFICATION.md, 089-04-SUMMARY.md

---

## Lessons

### Raw SSE byte-diff is impossible against live LLMs
Identical pre-move code produced 36/33/34 events on Anthropic across runs; chunk-counts vary run-to-run.

**Context:** This invalidated the planned literal empty-diff bar mid-verification and forced the structural-skeleton + run1-vs-run2 approach. Prove behavior-preservation *structurally*, not by byte-equality, whenever live LLMs are in the loop.
**Source:** 089-VERIFICATION.md §SC#3

### A "verbatim" move is mostly test-plumbing surgery
The loop logic relocated cleanly, but the change touched **35 files** — ~37 `create_adaptive_streaming_chat` monkeypatch repoints + ~12 source-grep guard repoints + a mock-harness fix.

**Context:** Pitfall-1 (monkeypatch the binding the moved code *actually reads*) dominated the cost. Budget extraction work as "logic move = small, test-harness re-pointing = large."
**Source:** 089-03-SUMMARY.md

### A real functional regression hid behind the move (MOCK_LLM_MODE)
`install_mock` patched `app.api.threads.create_adaptive_streaming_chat`; after the move the loop reads the `agent_loop` binding, so the subprocess mock stopped intercepting → `test_077_multi_worker` left `runs:active` non-empty.

**Context:** Not a source-grep guard — a genuine behavior break. Any monkeypatch target must follow the moved code to its new binding.
**Source:** 089-03-SUMMARY.md

### With a large pre-existing failure baseline, compare the FAILED node-id SET, not the count
The suite has 102 pre-existing failures (no local Supabase/Redis). The acceptance bar was an **identical FAILED node-id set** before vs after (102→102, +2 new seam tests), not "tests pass."

**Context:** Live-DB test-infra debt (routed to Phases 076/077) means "green suite" is unavailable locally; set-equality is the regression signal.
**Source:** 089-01-SUMMARY.md, 089-03-SUMMARY.md

### A newly key-added provider is NOT "integrated" until verified live
GLM (zhipu) + MiniMax had been registered since the 2026-05-30 key-add but were **never functional** — wrong *regional* endpoints (China hosts) for international keys + stale/miscased model IDs.

**Context:** Discovered only when actually exercised. Onboarding a provider requires a live round-trip against its OWN docs + `/models`, not just a key + a registry row.
**Source:** 089-VERIFICATION.md, 089-04-SUMMARY.md

### Title-gen lives in `threads.py` and was untouched by the move
CF-01 C1 (DeepSeek title-gen broken) is therefore pre-existing (BUG-260527-01), not a 089 regression — correctly re-opened + deferred.

**Context:** Confirms the move's purity (SC#1 shows `generate_thread_title` patches unchanged) and routes the bug to the right owner. *(Note: subsequently fixed 2026-05-31 in quick task 260530-wvt — root cause was token-budget starvation, not model-name.)*
**Source:** 089-VERIFICATION.md §CF-01

### For a behavior-preserving move, eval is a noisy secondary lens
The after-eval aborted at the `zhipu` cell on a transient backend `ReadTimeout` (13/24 cells); every FAIL was on an untouched provider and matched documented pre-existing gaps.

**Context:** The conclusive proof for a relocation is AST + deterministic suite + SSE skeleton; the LLM-dependent eval is supplementary and should not gate a relocation.
**Source:** 089-VERIFICATION.md §SC#3 backstop

---

## Patterns

### Seam-first extraction (SEAM.md as operator-locked contract)
Propose signature + dataclasses + boundary in a `SEAM.md`, gate on operator sign-off, then move verbatim against that exact contract.

**When to use:** Any high-risk extraction out of a god-file where a behavior change would be expensive to detect.
**Source:** 089-01-SUMMARY.md

### Keyword-only callable injection to break import cycles
Pass side-effecting collaborators (`emit`/`emit_terminal`/`spawn`) as injected callables instead of importing them.

**When to use:** Extracting a module that the parent must also call into (would otherwise create a cycle).
**Source:** 089-01-SUMMARY.md

### Prove a verbatim move by dedented AST diff of every moved symbol BEFORE trusting the suite
Diff each relocated symbol (dedented) against the pre-move file to establish code-level identity first, then run the suite as confirmation.

**When to use:** Any behavior-preserving relocation — code-level proof is stronger and faster to localize than suite signals.
**Source:** 089-03-SUMMARY.md

### By-reference result containers for finalizer outputs on all exit paths
Use optional kw-only `result_sink`/`timeout_ctx` containers (populated in the moved code's outer `finally` + per-stream block) so a finalizer that stays in the parent reads loop-internal state cycle-free, including on exception/re-raise.

**When to use:** When a finalizer outside the moved code needs the moved code's internal outputs on every exit path without breaking a locked signature.
**Source:** 089-03-SUMMARY.md

### SSE-diff proof harness: XRANGE capture + normalize + per-index diff
`capture_run_events` reads `XRANGE run:{run_id}`, `normalize` masks volatile ids/timestamps, `diff_event_streams` returns per-index `(idx, before, after)`; `[]` == pass.

**When to use:** Proving streaming-behavior preservation across a refactor.
**Source:** 089-02-SUMMARY.md

### Same-code run1-vs-run2 stochastic-noise isolation
Run the IDENTICAL code twice; differences *between the two runs* prove that residual before/after deltas are LLM non-determinism, not the change.

**When to use:** Verifying any change whose output is produced by a non-deterministic live LLM (a verdict can even flip BLOCK→PASS on identical code).
**Source:** 089-04-SUMMARY.md, 089-VERIFICATION.md §SC#3

### Repoint source-grep test guards (intent-preserving) after a move
Tests that assert (via `read_text`/`inspect.getsource`) that code lives in file X get their source read repointed to the new file; call-site checks stay put.

**When to use:** Relocating code that has location-asserting tests (~12 such guards here).
**Source:** 089-01-SUMMARY.md, 089-03-SUMMARY.md

### Additive eval-gate extension
Append `(provider, model)` `PROVIDERS` rows + `(NAME, is_secret=True)` env-presence rows; `--provider` choices auto-derive; the localhost hard-gate + queries stay byte-identical.

**When to use:** Adding a provider to the cross-provider eval without risking the existing gate.
**Source:** 089-02-SUMMARY.md

### International-endpoint + `/models`-curation as the native-provider onboarding recipe
Fix the regional base URL, register the official model IDs from live `/models` + provider docs, set sensible defaults — the repeatable fix for an OpenAI-compatible provider that was "registered but dead."
**When to use:** Onboarding / debugging any newly-added OpenAI-compat provider.
**Source:** 089-04-SUMMARY.md, 089-VERIFICATION.md §Provider curation

---

## Surprises

### Identical code produced different SSE event counts (36/33/34 on Anthropic)
**Impact:** Invalidated the planned raw-SSE empty-diff acceptance bar mid-verification; the SC#3 mechanism had to be redefined to a structural skeleton and corrected **twice** from live data (reasoning_delta collapse + alignment-based diff).
**Source:** 089-VERIFICATION.md §SC#3, 089-04-SUMMARY.md

### DeepSeek flipped BLOCK→PASS across two runs on IDENTICAL code
**Impact:** The verdict depended purely on how many search/grep/read rounds the agent stochastically chose — concrete proof that residual skeleton deltas are agentic non-determinism, not the move. Drove the run1-vs-run2 isolation pattern.
**Source:** 089-VERIFICATION.md §SC#3

### The "verbatim" move ballooned to 35 files and ~3h
**Impact:** The loop relocation itself was clean, but 5 deviations (1 real regression, 2 Rule-3 structural, 2 test-guard sweeps) + the 37+12 monkeypatch/grep re-points made it the longest single plan of the phase. Reframes "verbatim move" as predominantly test-harness surgery.
**Source:** 089-03-SUMMARY.md

### GLM + MiniMax were dead-on-arrival despite being "registered"
**Impact:** Two of the native-7 providers had never actually worked since their key-add; the fix (international endpoints + 14 model registrations) landed in-scope during the verification sweep, not as planned work.
**Source:** 089-VERIFICATION.md §Provider curation, 089-04-SUMMARY.md

### The dev backend went transiently unreachable under sustained reasoning+code load
**Impact:** Interrupted the first GLM/MiniMax capture and the eval (aborted at the `zhipu` cell after 24 cells); recovered each time after an operator restart. Not a code defect, but it left the eval incomplete and reinforced its secondary-lens status.
**Source:** 089-04-SUMMARY.md
