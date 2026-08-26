---
phase: 210-ground-truth-operability-and-failure-honesty
artifact: REVIEW
author: claude (reviewer — did not build)
builder: gemini
date: 2026-08-26
reviewed_at_head: c892bec6
verdict: BLOCKING — 1 blocker, 1 unmet success criterion
---

# Phase 210 — reviewer post-phase check

**Gates re-derived, not trusted. All three reproduce exactly as BUS-008 reported.**

| Gate | BUS-008 claim | My run | |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 34 | **34** | ✅ exact baseline |
| count gate | OK 114/114, total 5798, failed 0 | **OK 114/114, total 5798, pinned 5180, failed 0** | ✅ `+618` above pinned, attributable |
| backend `tests/unit` | rot set 68, touched tests green | **68 failed / 2687 passed** (baseline 68 / 2680) | ✅ same 68, `+7` passing |

Per-file rot distribution is unchanged — `test_retrieval_service.py` still 15, `test_111_1_reembed_kickoff.py`
still 4 — and **zero failures in `test_tool_dispatcher.py`, `test_validator_kinds.py`,
`test_scheduler_service.py` or the new `test_retrieval_failure_honesty.py`**. No test was swapped for
another. **The gate report is honest and accurate.**

**And the phase still ships a blocker no gate could see.** That is the finding, not a criticism of the
gates: this defect lives in code no gate executes on the path it breaks.

---

## V-1 · ⛔ BLOCKER · the error citation crashes every consumer that reads citations

`tool_dispatcher.py:731-735` now returns, on an embedding-provider outage:

```python
citations=[{"is_error": True, "retrieval_status": "provider_error", "detail": str(exc)}]
```

That object has **no `document_id`**. Every citation consumer in the tree keys on it with a bare
subscript, not `.get()`:

- `agent_loop.py:906` — `key = (c["document_id"], c.get("chunk_index"))`
- `citation_markers.py:73` — the mirrored implementation, same bare subscript

**Driven, not reasoned** (`backend/venv`, the exact object the dispatcher emits):

```
RAISE agent_loop._deduplicate_citations: KeyError: 'document_id'
RAISE citation_markers._deduplicate_citations: KeyError: 'document_id'
```

Three reachable call sites, on both surfaces:

| # | Path | Chain |
|---|---|---|
| 1 | **Deep / chat, next turn** | `agent_loop.py:2643` `retrieved_citations.extend(_tool_result.citations)` → `:1896` `if retrieved_citations:` → `apply_citation_instruction` → `citation_markers.py:166` → **KeyError** |
| 2 | **Deep, answer surfacing** | `agent_loop.py:2899` `_deduplicate_citations(retrieved_citations)` → **KeyError** |
| 3 | **Harness / workflow run** | `phase_types.py:823` `output["citations"]` → `harness_engine.py:2248` accumulate → `:2421` `_finalize_run_grounding` → `:367` `_deduplicate_citations` → **KeyError** |

⚠ **This is a REGRESSION of a path that already worked.** Pre-flight P-4 measured that
`tool_dispatcher.py:686-731` already returned an honest `retrieval_unavailable` message with **empty**
citations, and the chat turn completed. After 210-03, the same outage raises. The feature built to make
a failure honest makes that failure crash.

⚠ **Note what path 1 means:** the crash is on the **turn after** the failed search, so the symptom
presents as an unrelated chat error, not as a retrieval problem.

### Why the "mocks neither side" test did not catch it — the third recurrence of one shape

`test_retrieval_failure_honesty.py` joins the **producer** and the **gate**, and nothing in between.
Test 2 hand-builds the `output` dict with the citation already inside it (`:42`). The citation never
passes through `_deduplicate_citations`, `apply_citation_instruction` or `_finalize_run_grounding` —
the three functions that actually carry citations, and the three that raise. The join was tested at
the two ends the plan chose; the defect is in the middle.

This is the same shape as P-3 (dict-key mismatch) and R-1 (object-identity mismatch), now as a
**contract mismatch**: `citations` is a typed channel with an implicit required key, and a foreign
object was placed in it.

## V-2 · ⛔ ROADMAP SC#5's *"names it"* is unmet — and the two new tests disagree about it

SC#5: *"the answer says the provider failed **and names it**."*

`validator_kinds.py:294` reads `provider = error_cit.get("provider") or "retrieval provider"`.
**Nothing in the tree writes a `provider` key.** `grep -rn "is_error" backend/app` returns exactly two
hits — the writer at `tool_dispatcher.py:733` and the reader at `validator_kinds.py:293` — and the
writer emits only `is_error`, `retrieval_status`, `detail`.

So in production the message is always:

> `citations_required: retrieval failed (retrieval provider: …)`

— a generic phrase, on every occurrence. The provider is never named.

**The two new tests, 20 lines apart, encode opposite contracts:**

- `test_search_documents_exception_returns_structured_error_citation` (`:30-35`) asserts the produced
  citation's three keys and **does not assert `provider`** — correctly, because production omits it.
- `test_validator_rejects_with_honest_provider_outage_message` (`:42-58`) **hand-builds a citation
  containing `"provider": "openai"`** and asserts the message reads `retrieval failed (openai: …)`.

Both pass, because each owns half the contract and neither runs the other's half. The test that proves
SC#5 supplies the key the producer never emits.

## V-3 · The synthetic citation is designed to land in `messages.source_refs`

Contained inside V-1 today (it raises before arriving), but it is the reason V-1 exists and it survives
any fix that only adds a `document_id`. `harness_engine.py:367-375`: when `unique_citations` is
non-empty, `final_source_refs = unique_citations` — and the docstring states this *"is the value that
lands in `messages.source_refs` so the references render with passages."* An `is_error` object entering
`citations` is therefore designed to appear in the run's **source references**, a surface that means
*"here is what was read."* Nothing was read.

## What I did NOT verify — stated rather than implied

- **No browser-driven UAT was run** for SC#1 (Control Room kill-switch flip), SC#2 (scheduler-off
  notice), SC#3 (budget floor) or SC#4 (null-`org_id` manual trigger). With a blocker open on SC#5 the
  phase re-opens regardless, so driving those now would measure a tree that is about to change. **They
  are owed**, and SC#1's server-side refusal half is already discharged by pre-flight P-7.
- **The 68 rot-set members were compared by per-file distribution and by the 19 names captured
  pre-phase, not by a full name-level diff of all 68.** Same total, same distribution, same 19, and no
  failure in any file 210 touched — strong, but not a name-level proof for the other 49.

## What verified CORRECT

- All three gates, re-derived independently (table above).
- **The gate ordering in `validator_kinds.py` is right**: the `is_error` branch runs **before** the
  `retrieved_and_cited` non-empty check, so a provider outage cannot satisfy Phase 185's
  *"really retrieved something"* half. The obvious fail-open was avoided.
- **R-2 resolved**: `210-02` and `210-03` moved to wave 2 with `depends_on: ["210-01"]`; no concurrent
  `_core.ts` edits.
- **R-3 resolved cleanly**: `scheduler_process_enabled` ships as a top-level sibling of the `features`
  map, so `GovernedFeature` stays uncontaminated and no phantom Control Room card appears.
- **R-4 resolved better than asked**: the budget lift targets the exact legacy `50_000`, so an
  operator's deliberate low budget is preserved.
- **P-1 stayed resolved**: `connectionsCopy.ts` is untouched by 210 and 211's fence held.
