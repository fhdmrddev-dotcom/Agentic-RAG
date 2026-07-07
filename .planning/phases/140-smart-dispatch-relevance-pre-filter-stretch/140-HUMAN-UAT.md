---
status: partial
phase: 140-smart-dispatch-relevance-pre-filter-stretch
source: [140-VERIFICATION.md, 140-VALIDATION.md]
started: 2026-07-07T19:10:00Z
updated: 2026-07-07T19:50:00Z
---

## Current Test

[testing complete — mechanism-proven accepted by operator 2026-07-07; runtime-chat axes blocked on embedding quota]

## Tests

### 1. U1–U4 — cross-provider (OpenAI, Anthropic, Google, OpenRouter)
expected: With an over-budget catalog + a prompt matching a planted should-fire skill, the planted skill is in the injected menu (or reachable via `load_skill`), `load_skill` fires correctly, the honest `_CATALOG_TRIM_MARKER` is present when skills were cut, provider-agnostic.
result: pass
note: |
  MECHANISM VERIFIED LIVE over real data (scratchpad reproduction of the exact hot path,
  agent_loop.py:1234-1315, against the live DB :54322):
  - Relevance ranking is real + correct — the real `match_skills` RPC over the 7 real stored
    skill vectors: each probe skill ranks itself 1.000, semantic neighbors cluster sensibly
    (docx near both report+deck skills; report skills cluster). RPC honored the exact
    owner+global+is_enabled scope — no cross-user leak (V4).
  - Budget trim + honest marker + never-starve: at realistic over-budget (400/600 tok) the
    top-relevant skill IS surfaced + the honest marker always appends ("N additional skills…
    name one directly and I'll load it" = escape hatch); at 1500 (fits) all 7 listed,
    NO marker, byte-identical to pre-phase.
  - D-05 fail-open PROVEN (and is the current live state — OpenAI embedding key is at 429
    insufficient_quota): sim_by_id=None → inject-all-up-to-budget by name order + honest
    marker, never crashes or empties the catalog.
  - Provider-agnostic BY CONSTRUCTION: the pre-filter shapes the system prompt BEFORE
    provider dispatch and touches no provider routing, so the cross-provider axis is
    satisfied structurally.
  NOT separately exercised: live in-chat `load_skill` firing on each of the 4 providers
  (blocked — see tests 2-5; embedding quota 429 + the pre-filter is invisible in the chat UI).
  Accepted as mechanism-proven by operator 2026-07-07.

### 2. U5 — multi-tool
expected: One over-budget-catalog prompt that triggers the planted should-fire skill AND a second tool (e.g. `load_skill` + `search_documents`) in the same turn — both fire in one turn; the skill still reaches the model despite the trim.
result: blocked
blocked_by: third-party
reason: "Requires a live chat exercising the fresh-embedding relevance path, but the OpenAI embedding key is at 429 insufficient_quota (a live over-budget chat currently fails open, not ranks). Backend behavior covered by the 41/41 automated tests."

### 3. U6 — parallel-thread
expected: Thread A streaming with an over-budget catalog while Thread B accepts a new prompt concurrently — no pin bleed; each thread's catalog reflects only its own turn/history.
result: blocked
blocked_by: third-party
reason: "Same embedding-quota (429) gate; needs two live streaming threads with the relevance path active. Pin/isolation logic is id-keyed + covered by automated tests."

### 4. U7 — long-message
expected: ≥50 prior messages OR a ≥5 KB user prompt, with an over-budget catalog — trimming + pinned-keep still correct; no regression interacting with `trim_messages_to_fit`.
result: blocked
blocked_by: third-party
reason: "Same embedding-quota (429) gate; needs a live long-thread chat with the relevance path active."

### 5. Self-heal spot-check (Blocker-1)
expected: A brand-new should-fire skill with no vector → turn 1 fail-open-injected (marker present); turn 2, after the background `kick_skill_backfill` completes, ranks by genuine similarity.
result: blocked
blocked_by: third-party
reason: "The backfill (kick_skill_backfill) itself needs a working embedding round-trip to populate the new vector — blocked by the same 429 insufficient_quota. Fire-and-forget/fail-open behavior covered by automated tests (test_kick_is_fire_and_forget / test_kick_swallows_failure)."

## Summary

total: 5
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 4

## Gaps

[none — no functional issues. Non-blocking observations:]
- IN-04 (from 140-REVIEW.md, non-blocking): at a pathologically tiny budget (< one long skill line, e.g. 180 tok) the greedy keep-what-fits trim can surface a shorter lower-relevance skill instead of a longer top-relevance one. Never-starve still holds (top skill reachable via the escape-hatch marker); at realistic budgets (400+) the top-relevant skill IS surfaced. Follow-up candidate if strict "most-relevant-always-shown" is wanted.
- The 4 blocked tests re-run when the OpenAI embedding quota is restored: re-run `/gsd:verify-work 140` for the live in-chat cross-provider + multi-tool + parallel-thread + long-message + self-heal axes.
