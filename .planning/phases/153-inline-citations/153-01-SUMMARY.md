---
phase: 153-inline-citations
plan: 01
subsystem: api
tags: [citations, agent-loop, rag, cross-provider, prompt-injection, sse]

# Dependency graph
requires:
  - phase: 149-model-registry
    provides: the dual-channel STRUCTURED-tools injection precedent (active_system_prompt + messages[0]) this Seam B mirrors
  - phase: 151-fetch-file
    provides: full-doc / fetched-file citations (is_full_doc) that flow into the same unique_citations set the manifest numbers
provides:
  - "Pure citation_markers module: normalize_citation_markers (strip non-member/out-of-range [n], D-02/D-03), format_citation_manifest, apply_citation_instruction, CITATION_INSTRUCTION"
  - "Backend is the sole author of citation numbering truth — markers validated/renumbered at the settle point before persist (D-05)"
  - "Retrieval-turns-only dual-channel citation instruction reaching all providers uniformly (SC#10), byte-identical off-retrieval (D-12/D-14)"
affects: [153-02-citation-navigation, 153-frontend-cited-markdown, 153-citation-list-footer, 153-VALIDATION-cross-provider-UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure backend helper module mirroring _deduplicate_citations shape (no I/O, unit-testable in isolation)"
    - "Code-span/fence-aware marker transform (re.split on a code-region regex; only even segments transformed)"
    - "Delimited-note dual-channel injection: strip-and-reappend so the note refreshes fresh each retrieval turn without stacking"

key-files:
  created:
    - backend/app/services/citation_markers.py
    - backend/tests/unit/test_153_citation_markers.py
    - backend/tests/unit/test_153_citation_instruction.py
  modified:
    - backend/app/services/agent_loop.py

key-decisions:
  - "Own dedup copy in citation_markers.py (not an import from agent_loop) to keep the module dependency-free and avoid a circular import; identical key/order so numbering aligns"
  - "Renumber-to-footer is an identity by construction (manifest built from the same dedup order as the footer); the meaningful op is the out-of-range/non-member strip (D-02)"
  - "Delimited START/END note markers so the citation note can be stripped and re-appended fresh each retrieval turn without double-appending and without disturbing the separately-injected tool-usage instructions in messages[0]"
  - "Injection placed at the top-of-iteration seam (after the _needs_pre_injection block, before while True) so a single reassignment reaches BOTH the native and compat GatewayRequest system_prompt sites"

patterns-established:
  - "Pattern 1: Set-membership enforced by ONE authority — the backend derives both the footer set and the in-text markers from the same unique_citations; the frontend re-derives nothing"
  - "Pattern 2: Retrieval-gated provider-uniform dual-channel prompt injection (active_system_prompt AND messages[0]) — no per-provider branch"

requirements-completed: [CITE-01]

# Metrics
duration: 10min
completed: 2026-07-15
---

# Phase 153 Plan 01: Inline Citations Backend Honesty Core Summary

**Backend now the sole author of citation truth — a pure citation_markers module strips out-of-range/non-member `[n]` and aligns survivors to the finalized retrieval footer at the settle point, plus a retrieval-turns-only dual-channel instruction that prompts every provider uniformly while non-retrieval turns stay byte-identical.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-15T07:03:32Z
- **Completed:** 2026-07-15T07:13:45Z
- **Tasks:** 3 (2 TDD)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Pure, unit-tested `citation_markers.py`: `normalize_citation_markers` (strip non-members/out-of-range, code-span-aware, D-02/D-03), `format_citation_manifest` (chunk + full-doc rows), `apply_citation_instruction` + `CITATION_INSTRUCTION` (density wording + numbered manifest).
- Seam A: `full_content = normalize_citation_markers(full_content, unique_citations)` wired at the settle point (right after `unique_citations` is finalized, before persist) so the persisted message carries only validated/renumbered markers (D-05). No new SSE event — the existing terminal reconcile carries the normalized content live.
- Seam B: retrieval-gated dual-channel injection at the top-of-iteration seam, reaching both the native `active_system_prompt` param and the compat `messages[0]` system entry (SC#10 / Pitfall 1 — Anthropic drops mid-list system messages). Byte-identical off-retrieval (D-12/D-14).
- 9/9 new unit tests green; 30/30 existing citation/confidence tests still green; `agent_loop` imports cleanly.

## Task Commits

Each task was committed atomically (TDD tasks split test → feat):

1. **Task 1 (RED): failing tests for citation marker normalizer** - `a6124113` (test)
2. **Task 1 (GREEN): pure normalize_citation_markers + format_citation_manifest** - `bfe730bb` (feat)
3. **Task 2: normalize call at the settle point (Seam A)** - `53ec2bcc` (feat)
4. **Task 3 (RED): failing tests for dual-channel citation instruction** - `1eda5762` (test)
5. **Task 3 (GREEN): retrieval-gated dual-channel instruction (Seam B)** - `a4f682d1` (feat)

_Note: TDD tasks produced separate test → feat commits (RED authored and committed before GREEN)._

## Files Created/Modified
- `backend/app/services/citation_markers.py` - Pure helpers: strip/renumber markers, numbered manifest, dual-channel instruction + density wording. No Redis/DB/await, no provider fork.
- `backend/app/services/agent_loop.py` - Two additive seams: import + Seam A normalize-at-settle (rebind `full_content` before persist), Seam B retrieval-gated `apply_citation_instruction` at the top-of-iteration seam.
- `backend/tests/unit/test_153_citation_markers.py` - strip non-members / renumber-to-footer / code-span skip / manifest shape.
- `backend/tests/unit/test_153_citation_instruction.py` - byte-identical off-retrieval / dual-channel reach / manifest-matches-dedup-order / idempotent-or-fresh.

## Decisions Made
- **Dedup copy, not import:** `citation_markers._deduplicate_citations` duplicates the `agent_loop` shape (identical `(document_id, chunk_index)` key + order) to keep the module dependency-free and avoid a module-level circular import (`agent_loop` imports `citation_markers`). Numbering alignment is preserved by construction.
- **Renumber is an identity by construction:** the manifest handed to the model is built from the same dedup order as the footer, so a valid `[n]` already maps to footer row `n`. The load-bearing operation is the strip (D-02); the renumber keeps valid numbers.
- **Delimited note for fresh-each-turn injection:** the note is wrapped in `<<<CITATION_GUIDANCE>>> ... <<<END_CITATION_GUIDANCE>>>` and stripped-then-reappended on each retrieval turn, so multi-round retrieval refreshes the manifest without double-appending and without clobbering the separately-injected tool-usage instructions.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were required; the four declared files were the only files touched.

## Issues Encountered
- **Closure-cell correctness (Seam A):** verified that reassigning `full_content` at the settle point (6-space block level inside `run_agent_loop`) updates the same local that `_persist_assistant_message` reads via closure. Confirmed by the existing `full_content += fallback` at the same block level (L2702), which proves `full_content` is a directly-assignable `run_agent_loop` local at that scope (not a nested-function shadow). No `nonlocal` needed.

## Known Stubs
None. `CITATION_INSTRUCTION` is intentional prompt guidance, not a placeholder. No hardcoded empty values flow to any UI surface (this plan is backend-only).

## Threat Flags
None. The implementation stays within the plan's `<threat_model>`: model-emitted markers are validated by set-membership before persist (T-153-01-01), the shared path is not forked (T-153-01-02), non-retrieval turns are byte-identical (T-153-01-03), and the manifest is advisory-only (T-153-01-05). No new network endpoint, auth path, file access, or schema change introduced.

## User Setup Required
None - no external service configuration required.

**Operator action (not setup):** the changed `backend/app/services/agent_loop.py` requires an **uvicorn restart** to load before any live cross-provider verification. The orchestrator handles the restart before live UAT; the backend was NOT run by this executor.

## Next Phase Readiness
- The backend honesty core is complete: persisted `messages.content` now carries only validated, footer-aligned `[n]` markers going forward; historical rows have no markers and degrade to footer-only (D-06 — graceful, no backfill).
- Frontend plans (CitedMarkdown marker render, numbered footer, hover-peek/pin, AbsenceHint) render what this plan validates; 153-02 adds cross-view "Open document" navigation.
- **UAT gate (deferred to 153-VALIDATION.md, not this plan):** SC#10 4-axis live cross-provider UAT — markers render on native providers and degrade to footer-only where a model emits none (D-07); OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent from Phase 152). CITE-01 stays open at the requirement level until verify-work/secure-phase per the 148-152 false-green-avoidance convention.

---
*Phase: 153-inline-citations*
*Completed: 2026-07-15*
