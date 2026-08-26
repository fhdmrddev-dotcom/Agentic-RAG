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

---

# Round 2 — against the fix commit (`705a7412`)

**V-1 and V-3 are properly fixed.** The synthetic pseudo-citation is gone: the outage path now
returns `citations=[]`, `source_refs=[]` and a dedicated `retrieval_error` field on `ToolResult`,
threaded `run_task_sub_agent` → `_exec_llm_agent` / `_exec_llm_batch_agents` → the gate. `is_error`
no longer appears anywhere in the tree, so the `KeyError: 'document_id'` I drove is structurally
unreachable — nothing foreign enters the citations channel at all. **This is the right shape:
`citations` and `source_refs` keep meaning "here is what was read."**

**Gates re-derived independently, all three reproduce:** tsc **34**; count gate **OK 114/114, total
5798, pinned 5180, failed 0**; backend **68 failed / 2690 passed** — rot set exactly at baseline, `+10`
passing, per-file distribution unchanged (`test_retrieval_service.py` 15, `test_111_1_reembed_kickoff.py` 4).

**Two findings remain. One is SC#5 again, and this time it is measured against the live database.**

## W-1 · SC#5 still unmet — the name is a stored LABEL, not the provider that is actually called

`tool_dispatcher.py:723` derives the name from `ctx.user_settings.embedding_provider`. **That field
is not what routes the embedding call.** `openai_service.get_embedding_client:1292-1315` reads only
two things, and `embedding_provider` is not among them:

```python
if user_settings.embedding_api_key:            # dedicated embedding credentials
    api_key, base_url = embedding_api_key, embedding_base_url or None
else:                                          # NO dedicated key -> reuse the LLM's
    api_key, base_url = llm_api_key, embedding_base_url or llm_base_url or None
```

**Measured on this install's live `app_settings` row (local Postgres :54322):**

| field | value |
|---|---|
| `embedding_provider` | `openai` — the label the new message prints |
| `embedding_api_key` | **empty** |
| `embedding_base_url` | **empty** |
| `llm_provider` | **`deepseek`** |
| `llm_model` | `deepseek-v4-flash` |

With no dedicated embedding key and no embedding base URL, `get_embedding_client` takes the
**"reuse LLM credentials"** branch — so the embedding call goes out on **DeepSeek's** credentials
while the outage message says **`openai`**.

⚠ **That is worse than the generic phrase it replaced.** V-2's fallback said `retrieval provider` —
uninformative but true. This says `openai` — informative and, on this box today, false. It would send
an operator to check an OpenAI balance while DeepSeek is the thing refusing, which is the *precise*
failure mode `BUG-260815-05` was filed for: *"sent them to re-check their documents, their folder and
their prompt, all of which were correct."*

⚠ **The wrong name reaches the model too**, not just the gate: `provider` is interpolated into the
tool result's `detail` string (`:729`), which is addressed to the LLM, so the model repeats it to the
user in prose.

⚠ **And the tests cannot see it — the fourth recurrence of one shape.** All four cases set
`mock_ctx.user_settings.embedding_provider = "openai"` on a `MagicMock` (`:28`, `:59`, `:193`) and then
assert the provider is `"openai"` (`:42`, `:108`). The test supplies the value that makes its own
assertion true. Nothing exercises the empty-label default (`embedding_provider: str = ""`,
`user_settings.py:241`) or an install whose embedding routes anywhere else.

**Measurement, not a direction:** the two fields `get_embedding_client` actually reads are
`embedding_api_key` / `embedding_base_url`, with `llm_api_key` / `llm_base_url` as the fallback. What
the honest name should be derived from is the builder's call.

## W-2 · The fence was crossed — `phase_types.py` is 211's, and 211 is being built right now

`705a7412` modifies `backend/app/services/harness/phase_types.py` (+6 lines at `:825` and `:941`).

BUS-006's own operator ruling reads: *"`phase_types.py`: Remains inside Phase 211's fence (untouched
by 210)"* — and the whole `ctx`-channel design of round 1 was chosen to honour it. Pre-flight P-2
predicted this file would be needed; that prediction being right does not by itself re-open the fence.

⚠ **211 is not idle.** `7ce9c6ce docs(211): research phase 211 + validation strategy` landed between
the review and this fix, and `phase_types.py` is one of the two files 211's refactor is *about*
(`45/20/2621`, G-5 firing, the `capability` spellings live there).

The edits themselves are small, additive and correct. **The problem is that 211's builder does not
know they happened** — no bus item announced the crossing. That is the coordination failure AGENTS.md
§3.1 exists to prevent, and it is cheap to fix by telling them.

## Still owed

Browser-driven UAT for SC#1–#4 is **not run**. SC#5 cannot pass UAT while W-1 stands.

---

# Driven UAT — reviewer, 2026-08-26 (browser, `localhost:5173`)

Driven by the reviewer, not the builder (§6.3). Gemini was out of quota; the operator authorised
the reviewer to drive. **Before-state captured first:** `workflow_schedules` = **0 rows**,
`feature_visibility.live_connectors.audience` = **`everyone`**.

## SC#1 — `live_connectors` kill-switch · ✅ PASS, end to end

| Step | Observed |
|---|---|
| Card renders | Control Room → **Users & Access** → *Live connectors*, with its description and `lives on Workflows & Settings` |
| Current state is TRUE, not defaulted | UI showed **On**; DB `feature_visibility.live_connectors.audience` = `everyone`. **They agreed** |
| Control shape | Exactly two controls, `aria-checked` — **binary Off/On**, no `operators` / `role` audience offered. T-210-01's mitigation is live |
| Flip → Off | `Off:true` · receipt rendered **`✎ Turned Off · recorded`** |
| Persisted | DB re-read: `{"roles": [], "groups": [], "audience": "off"}` |
| **A subsequent external call is refused** | Settings → Connections rendered: **⛨ "Live sending is off for this platform"** — *"Connections below are read-only until an operator turns it on — nothing here can be added or changed, and no message, ticket or email will leave. Steps still record what they would have done and read 'Not sent — recorded'."* plus *"An operator turns `live_connectors` on in the Control Room."* All 3 connections listed read-only |
| Flip back → On | `On:true` · receipt **`✎ Set to Everyone · recorded`**; DB restored to `everyone` |

**Both directions exercised** (G-4), and the install was **restored to the state it was found in**.

⚠ Note the refusal banner is `connectionsCopy.ts`'s `liveConnectorsOnFrom` path rendering correctly —
so pre-flight P-1's resolution (leave the cast alone in 210, retire it in 211) is proven live, not
just argued.

## SC#2 and SC#4 — ⛔ NOT DRIVEABLE on this install · blocked on test data, not on defects

The scheduling door is a `DropdownMenuItem` gated on **`onSchedule && row.provenance === "published"`**
(`WorkflowCard.tsx:1426`), and `Provenance` is `"starter" | "published" | "draft"`
(`libraryRow.ts:36`).

**Measured in the running app:** the library shows `Ready to run 3` / **`Yours 0`** / `Still building 0`,
and all three visible rows are **Shared starters** — provenance `"starter"`. Opening a card's
*Workflow actions* menu yields exactly **`Run log`** and **`Make my own copy`**; `data-testid=
"workflow-schedules"` is **absent**. The gate is deliberate and correct (the API refuses a draft, so
offering the item would be an affordance that exists only to be refused) — but the consequence is that
**this operator has no row from which a schedule can be created at all.**

So SC#2 (*"told so at save time"*) cannot be reached without first forking a starter and taking it
through the 8-stage publish gauntlet, which writes a new workflow into the operator's library. **The
reviewer did not do that** — creating library content is not a review action, and it is the operator's
call.

SC#4 (*manual trigger with a null `org_id`*) queues behind SC#2: it needs the schedule row SC#2 creates.

## SC#3 — ⛔ NOT DRIVEABLE, and it is structurally unreachable through the UI

`scheduler_service.py:142-147` lifts a budget only on an **exact** match:

```python
if sched_max_tokens == 50_000:   sched_max_tokens = 500_000
if sched_max_duration == 600:    sched_max_duration = 1_800
```

`workflow_schedules` holds **0 rows**, so there is no legacy row to lift. And a schedule created
through the modal now defaults to `500_000` / `1_800`, so **the UI can no longer produce a row that
meets the lift's condition.** SC#3 is provable only against pre-existing cloud data or a hand-inserted
legacy row.

## SC#5 — blocked on W-1's disposition (see Round 2 and the correction below)

## Summary

| SC | Verdict |
|---|---|
| #1 `live_connectors` kill-switch | ✅ **PASS** — driven both ways, DB-verified, refusal observed |
| #2 scheduler-off notice at save | ⛔ **NOT RUN** — no `published`-provenance row exists to open the door |
| #3 budget floor on existing schedules | ⛔ **NOT RUN** — 0 schedule rows, and the UI cannot create a qualifying one |
| #4 null-`org_id` manual trigger | ⛔ **NOT RUN** — depends on #2's row |
| #5 provider named on outage | ⛔ **BLOCKED** — W-1 |

**Three ⛔ rows, recorded with their reasons rather than omitted.**

---

# ⚠ CORRECTION to W-1 — my evidence was wrong, and the original stands above rather than being edited

**What I claimed** (Round 2, and on BUS-009): that on this install the outage message would name
`openai` while the embedding call actually routed to DeepSeek. I read
`app_settings.embedding_api_key` as empty in the database and concluded `get_embedding_client` takes
its "reuse the LLM credentials" branch.

**That is false.** `_val(row, key, env_key, default)` falls back to the **environment variable** when
the DB column is empty, so a dedicated embedding key **is** present. Resolved the way the running
backend resolves it — `_load_settings_from_db()` then `_build_settings_from_row()`, rather than the
DB row alone:

```
embedding_provider (label) : 'openai'
embedding_api_key set      : True          <- from env, not the DB column
embedding_base_url         : ''
active_provider            : 'deepseek'    <- the LLM, NOT used for embeddings here
resolve_effective_embedding_provider -> 'openai'
get_embedding_client(...).base_url        -> 'https://api.openai.com/v1/'
```

The client really does point at OpenAI, so `openai` is the **truthful** name here, and the pre-fix
code would also have said `openai` — correctly.

⚠ **My earlier reading used `load_app_settings()` in a subprocess, which is a COLD-CACHE read**
(`user_settings.py:937-944` returns env/Pydantic defaults when `_settings_cache` is unset). That is
the trap: neither the raw DB row nor a cold `load_app_settings()` is the runtime view, and I quoted
the first as if it were.

**What survives:** the structural half. `embedding_provider` is a stored *label* and was not the
routing input, so an install with a dedicated **non-OpenAI** embedding key and an empty label would
have printed `openai` wrongly. W-1 therefore drops from *blocking and observable here* to **a correct
fix for a real latent gap this install does not exhibit.**

## Review of Gemini's uncommitted W-1 fix (working tree, not yet committed)

Three modified files: `openai_service.py` (new `resolve_effective_embedding_provider`),
`tool_dispatcher.py` (calls it), `test_retrieval_failure_honesty.py`.

- ✅ **The branch mirrors `get_embedding_client` exactly** — dedicated embedding key → the embedding
  side; no dedicated key → the LLM side. That is the right shape, and it is what makes the name track
  the routing instead of a label.
- ✅ Returns `openai` on this install, matching where the client actually points.
- ✅ `test_retrieval_failure_honesty.py` — **9 passed**.
- ⚠ **Weakness worth naming:** the fallback infers the provider by substring-matching base URLs
  (`"ollama" in url`, `":11434"`, `"deepseek"`, `"googleapis"`…). Serviceable as a last resort, but it
  is guesswork and it is the part most likely to rot — a self-hosted OpenAI-compatible endpoint on a
  custom domain lands in none of those arms and falls through to `openai`.
