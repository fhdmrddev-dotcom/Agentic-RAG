---
phase: 210-ground-truth-operability-and-failure-honesty
artifact: SC10-ROSTER
axis: embedding provider (NOT the 8-row chat roster)
author: claude (reviewer)
date: 2026-08-26
driven_at_head: 0910a351
fixed_at_head: pending-commit
verdict: FAIL then FIXED — 5 of 18 rows misnamed; after the fix 18/18 honest
independent_verifier_absent_for: ["the SC#10 fix (reviewer-authored)"]
---

# SC#10 — the embedding-provider roster

ROADMAP: *"**SC#10 applies with a DIFFERENT roster** — RAG-09's axis is the *embedding* provider set
(OpenAI / Google / Ollama / LM Studio / OpenAI-compatible, per Phase 111.1), not the 8-row chat
roster; a blocked provider is recorded ⛔ with its reason, never omitted."*

⚠ **The roster is NINE, not the five the ROADMAP names.** Derived from
`frontend/src/components/settings/ProviderPicker.tsx:49` (`EMBEDDING_PRESETS`) rather than re-typed —
CLAUDE.md's *"derive the roster, never re-type it"* rule, and the reason it exists: the ROADMAP's list
was already stale when it was written.

## Method

No live keys and no network needed, because the question is not *"does the provider work"* — it is
*"when it fails, do we name the right one."* For each preset, settings were built the way the running
backend builds them (`_build_settings_from_row`), then two values compared:

- **truth** — `get_embedding_client(s).base_url`, the endpoint the call actually goes to
- **claim** — `resolve_effective_embedding_provider(s)`, the name the outage message prints

Each preset was driven **twice**: with `embedding_provider` set (the Settings picker wrote it) and
with it **empty** — which is the field's real default (`user_settings.py:241`) and, see below, the
state of every env-configured install.

## Results — 18 rows, 13 honest, **5 misname**

| # | Preset | Label | Endpoint actually called | Named as | |
|---|---|---|---|---|---|
| 1 | `openai` | set | `api.openai.com/v1/` | `openai` | ✅ |
| 2 | `openai` | **empty** | `api.openai.com/v1/` | `openai` | ✅ |
| 3 | `openai-large` | set | `api.openai.com/v1/` | `openai-large` | ✅ |
| 4 | `openai-large` | **empty** | `api.openai.com/v1/` | `openai` | ✅ |
| 5 | `google` | set | `generativelanguage.googleapis.com/…` | `google` | ✅ |
| 6 | `google` | **empty** | `generativelanguage.googleapis.com/…` | `google` | ✅ |
| 7 | `ollama` | set | `localhost:11434/v1/` | `ollama` | ✅ |
| 8 | `ollama` | **empty** | `localhost:11434/v1/` | `ollama` | ✅ |
| 9 | `lmstudio` | set | `localhost:1234/v1/` | `lmstudio` | ✅ |
| 10 | **`lmstudio`** | **empty** | **`localhost:1234/v1/`** | **`openai`** | ⛔ |
| 11 | `cohere` | set | `api.cohere.ai/compatibility/v1/` | `cohere` | ✅ |
| 12 | **`cohere`** | **empty** | **`api.cohere.ai/compatibility/v1/`** | **`openai`** | ⛔ |
| 13 | `jina` | set | `api.jina.ai/v1/` | `jina` | ✅ |
| 14 | **`jina`** | **empty** | **`api.jina.ai/v1/`** | **`openai`** | ⛔ |
| 15 | `mistral` | set | `api.mistral.ai/v1/` | `mistral` | ✅ |
| 16 | **`mistral`** | **empty** | **`api.mistral.ai/v1/`** | **`openai`** | ⛔ |
| 17 | `custom` | set | `embeddings.acme-internal.example.com/v1/` | `custom` | ✅ |
| 18 | **`custom`** | **empty** | **`embeddings.acme-internal.example.com/v1/`** | **`openai`** | ⛔ |

**No row was blocked or omitted.** All nine presets ran, in both label states.

## Why this is not an edge case

**1. LM Studio is a shipped first-class preset, and it fails.** The inference in
`resolve_effective_embedding_provider` matches `":11434"` — **Ollama's** port — and has no arm for
`":1234"`, LM Studio's. Two local presets sit side by side in the same picker; only one is recognised.
This project runs LM Studio (see `reference_lmstudio_exact_slug_and_jit_trap`), so it is a live shape.

**2. The empty-label state is the DEFAULT for env-configured installs.**

```python
embedding_provider=str(_val(row, "embedding_provider", None, "")),   # user_settings.py:919
                                                    # ^^^^ env key is None
```

`embedding_provider` has **no environment fallback at all** — it comes only from the DB column the
Settings picker writes. And `deploy/onebox.env.example:138-148` ships `EMBEDDING_API_KEY`,
`EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` with **no provider field**, because none exists.

So a fresh one-box deploy pointed at Mistral, Cohere, Jina, LM Studio or a private endpoint sits in
the misnaming state **until a human opens Settings and clicks a preset**. That is precisely the
deployment shape `docs/OPERATOR.md` targets.

## Consequence for SC#5

ROADMAP SC#5 requires the answer to *"say the provider failed **and name it**."* In the default
configuration state, on 5 of 9 presets, it names **OpenAI** — a provider that is not involved. That is
the same failure `BUG-260815-05` was filed for: the operator is sent to check the wrong account while
the real endpoint is the one refusing.

⚠ **This corrects the reviewer's own earlier verdict.** Round 2's correction downgraded W-1 to *"a
correct fix for a real latent gap this install does not exhibit."* That was true of **this install**
and wrong about **the product**: the gap is reachable in five of nine shipped configurations, one of
which is a first-class local preset. **W-1 is REOPENED.**

## The shape of an honest fix — measurement, not a mandate

The ground truth already exists in the process: `get_embedding_client` computes the exact `base_url`
it is about to use. Any name derived from a *separate* input can drift from it, which is what both
W-1 and this roster measured. A name derived from the resolved endpoint itself cannot — and when the
host matches nothing known, the **host itself is a true name**, where `openai` is a false one.

## Reproduce

`_build_settings_from_row` per preset, then compare `get_embedding_client(s).base_url` against
`resolve_effective_embedding_provider(s)`. Both label states. No network, no keys.

---

# AFTER THE FIX — re-driven, `18/18 honest, 0 MISNAME`

Fix authored by the **reviewer** (Gemini unavailable; operator instructed continue). ⚠ **No
independent verifier exists for it** — `/code-review ultra` is the outstanding gate.

## What changed

`resolve_embedding_endpoint(user_settings) -> (api_key, base_url, dedicated)` is now the **single**
resolution, and **both** `get_embedding_client` and `resolve_effective_embedding_provider` read it.
The name is derived from the very `base_url` the client is built with, so the two cannot drift —
which is the failure both W-1 and this roster measured.

Naming rules, in order:

1. **Local servers are identified by PORT**, because the host is `localhost` for both:
   `11434 → ollama`, **`1234 → lmstudio`** — the single missing arm that made a shipped preset claim
   `openai`.
2. **Known hosts** map to canonical names (`api.openai.com`, `generativelanguage.googleapis.com`,
   `api.cohere.ai`, `api.jina.ai`, `api.mistral.ai`, `api.deepseek.com`, `api.anthropic.com`,
   `openrouter.ai`, `api.voyageai.com`), matched longest-first and accepting subdomains.
3. ⚠ **An unrecognised host returns THE HOST, never `openai`.** A self-hosted OpenAI-compatible
   endpoint is not OpenAI, and calling it that sends an operator to the wrong account.
4. **No `base_url` at all** means the SDK default. Only there is a stored name the best answer — and
   **which** stored name depends on `dedicated`: with dedicated embedding credentials the
   `embedding_provider` label describes the endpoint contacted; **without them the label describes an
   endpoint nothing contacted**, so `active_provider` / `llm_provider` is used instead. That branch
   *is* W-1.

## Re-driven result

| | before | after |
|---|---|---|
| honest rows | 13 / 18 | **18 / 18** |
| misnames | **5** | **0** |

`lmstudio`, `cohere`, `jina` and `mistral` now name themselves in both label states. The private
endpoint resolves to **`embeddings.acme-internal.example.com`** — a true name where `openai` was a
false one.

## Guard: `test_210_sc10_embedding_provider_naming.py` (19 cases)

**Driven RED first** — the five predicted rows failed against the substring implementation before any
fix was written, and the failure list matched the roster exactly. The suite parametrises all eight
network presets in **both** label states, asserts an unknown host names the host and *not* `openai`,
asserts the name tracks the client actually built, and pins the no-dedicated-key fallback.

⚠ **One defect was found by Gemini's existing tests, not by mine**, and it is worth recording: the
first cut preferred the `embedding_provider` label whenever `base_url` was empty — which
re-introduced W-1 for the no-dedicated-key path. Four of `test_retrieval_failure_honesty.py`'s cases
went red and named it. **The `dedicated` flag exists because of that.**

## Gates after the fix

| Gate | Result |
|---|---|
| backend `tests/unit` | **68 failed / 2770 passed** — rot set exactly at baseline, `+19` = this suite |
| `test_retrieval_failure_honesty.py` + the new suite | **28 passed** |
| roster re-driven | **18/18 honest, 0 misname** |
