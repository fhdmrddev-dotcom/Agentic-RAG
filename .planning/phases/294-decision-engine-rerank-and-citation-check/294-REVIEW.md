---
phase: 294-decision-engine-rerank-and-citation-check
reviewed: 2026-10-20T01:46:11Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - .gitattributes
  - backend/.env.example
  - backend/app/api/api_docs.py
  - backend/app/api/citation_checks.py
  - backend/app/api/settings.py
  - backend/app/main.py
  - backend/app/models/citation_check.py
  - backend/app/services/citation_check_service.py
  - backend/app/services/citation_claims.py
  - backend/app/services/decision_eval.py
  - backend/app/services/openai_service.py
  - backend/app/services/pricing_service.py
  - backend/app/services/rerank_engines/__init__.py
  - backend/app/services/rerank_engines/cohere.py
  - backend/app/services/rerank_engines/jev.py
  - backend/app/services/rerank_engines/local.py
  - backend/app/services/rerank_engines/openai_decisions.py
  - backend/app/services/rerank_engines/prune.py
  - backend/app/services/rerank_engines/registry.py
  - backend/app/services/rerank_engines/tracing.py
  - backend/app/services/rerank_service.py
  - backend/app/services/retrieval_service.py
  - backend/app/services/search_documents_tool.py
  - backend/app/utils/environment.py
  - frontend/src/components/chat/CitationCheckAction.tsx
  - frontend/src/components/chat/CitationList.tsx
  - frontend/src/components/chat/CitationPeek.tsx
  - frontend/src/components/chat/citationVerdicts.ts
  - frontend/src/components/chat/CitedMarkdown.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/settings/RerankEngineBlock.tsx
  - frontend/src/components/settings/rerankEngines.ts
  - frontend/src/index.css
  - frontend/src/landing/components/TourSection.tsx
  - frontend/src/landing/scenes/SettingsScene.tsx
  - frontend/src/lib/api/citationChecks.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/setupTests.ts
  - frontend/src/stores/citationCheckStore.ts
  - scripts/apply_migration_211.py
  - scripts/build-decision-heldout.py
  - scripts/build-public-openapi.cjs
  - scripts/check-deploy-drift.sh
  - scripts/citation-order-probe.py
  - scripts/decision-fault-server.py
  - scripts/full-schema-supplement.sql
  - scripts/local-provider-key-custody.py
  - scripts/measure-decision-engines.py
  - scripts/vitest-count-gate.cjs
  - supabase/migrations/211_message_citation_checks.sql
findings:
  critical: 2
  warning: 4
  info: 8
  total: 14
status: issues_found
---

# Phase 294: Code Review Report

**Reviewed:** 2026-10-20T01:46:11Z
**Depth:** standard. Large pre-existing hot files were reviewed by their `4e7e94a82..HEAD` hunks only.
**Files Reviewed:** 50
**Status:** issues_found

## Summary

I reviewed the rerank-engine package, the dispatcher and retrieval call site, the citation-check service, route, model and migration, the Settings engine block and the chat verdict surfaces. I checked each area against the phase's locked contracts (D-02, D-07, D-10..D-17, N1-N3).

Most of the security-sensitive surface holds up when traced:

- **Key custody.** No key reaches a log line, an exception string, the browser or a span input. `redact_inputs` covers every traceable that takes `api_key`, `user_settings` or `supabase`. The logged failure reason is the exception type plus status only. Response models are `extra="forbid"`.
- **Fault path.** It requires an explicit ENVIRONMENT (the config default is `""`). It parses and rebuilds a strictly-loopback URL and swaps in the dummy token.
- **Failure equals off.** `documents[:n]` equals the off output on both the unfiltered and the filtered path, because filtered coverage is re-applied after it.
- **Migration 211.** It is owner-SELECT-only, revokes from PUBLIC first, and the supplement mirrors its ACLs.
- **Citation-check API.** It reads through the user JWT with a uniform 404, binds every id from the RLS-read row, caps GET at 100 uuids, puts the engine run in the threadpool, and dedupes in-flight work with compare-and-delete.

Two defects are BLOCKERs, and both break the citation check's core promise that a verdict shown is the verdict for that sentence:

1. **A failed check is stored and shown as a completed one.** An engine outage (401, 429, timeout) during a check answers 200 and upserts an all-"couldn't check" result. On a Re-check, that replaces a good stored result.
2. **The chat can show one sentence's verdict on another sentence.** The backend claim ordinals (regex) and the frontend marker ordinals (the `marked` DOM) disagree on realistic markdown, and the `n === n` guard does not stop the mix-up when a source number repeats. I reproduced this against the real `marked` and the real `extract_claims`.

## Critical Issues

### CR-01: A total engine failure is persisted as a completed check and overwrites the stored result

**File:** `backend/app/services/citation_check_service.py:222-255`, `backend/app/api/citation_checks.py:163-169`

**Issue:** `run_citation_check` treats every per-source failure (an HTTP 401/429/500, a non-JSON body, the 30 s budget running out) as `couldnt_check` for that source. It then always returns a valid `CitationCheckResult`. The route upserts that result unconditionally and answers **200**.

Scenario: a user checked an answer yesterday (stored: 4 supported, 1 contradicted). Today OpenRouter rate-limits the org key and the user presses **Re-check**. Every `ask()` raises `HTTPStatusError:429`. The result is 5 × couldn't check. `upsert_check` runs `ON CONFLICT DO UPDATE` and replaces the paid-for verdicts. The UI then shows "? 5 couldn't check · checked by Jev · saved with this answer". Because the POST succeeded, the error line ("The check didn't finish. Try again.") never renders.

The same happens on the first check of an answer, on every device, with no hint that it was an outage rather than the engine declining to judge. Only successful calls are recorded (`record_engine_call` runs only on success), so the "nothing succeeded" state is directly detectable from `engine_calls`. It is just never checked.

**Fix:** When at least one source was sent and **no** engine call succeeded, raise instead of returning a result, so nothing is stored. The route then maps that to a 503 and the store's existing `failed` code:
```python
# citation_check_service.run_citation_check, after the futures loop
class CitationCheckFailed(RuntimeError):
    """Every engine call failed; nothing is stored (D-17: an outage is not a verdict)."""

if groups and not engine_calls:
    raise CitationCheckFailed(spec.id)

# api/citation_checks.post_citation_check
except CitationCheckFailed:
    raise HTTPException(status_code=503, detail={"reason": "engine_failed"}) from None
```
Optionally also refuse to overwrite a stored row whose claims decided strictly more verdicts than the new result.

### CR-02: Claim ordinals diverge between `citation_claims.py` and `CitedMarkdown`, so a verdict renders on the wrong sentence

**File:** `backend/app/services/citation_claims.py:208-279` (ordinal assignment), `frontend/src/components/chat/CitedMarkdown.tsx:215-243` and `:104-112` (`claimFor`)

**Issue:** The frontend numbers markers by walking `marked`'s DOM. The backend numbers them with regexes (`_CODE_RE` for fenced and backtick code only, and `_LINK` for inline links only). The two disagree on ordinary CommonMark constructs that the parity fixture does not cover. I drove both with the real `marked` and the real `extract_claims`:

```
"Revenue grew to 40 million in 2025 [1]. Margins improved to 12 percent [2]. Headcount was cut by half [2].\n\n[1]: annual-report.pdf\n"
backend : (0,n1,'Revenue grew…') (1,n2,'Margins improved…') (2,n2,'Headcount was cut…') (3,n1,'annual-report.pdf')
marked  : <a href="annual-report.pdf">1</a> … Margins … [2] … Headcount … [2]
frontend: Margins → ordinal 0, Headcount → ordinal 1
```
`[1]: x` is a link-reference definition, so `marked` turns every body `[1]` into a link, and the frontend skips links. The backend counts each one as a claim, plus the definition line itself.

The result: the "Headcount" marker (frontend ordinal 1, n=2) matches backend claim 1. That claim has n=2, so the guard passes, but it is the **"Margins"** sentence. The Headcount sentence shows Margins' verdict and confidence. If Margins was supported and Headcount is contradicted by its source, the chat shows **✓ Supported** on a contradicted sentence. That is the exact failure named in CONTEXT `<failure>`.

Indented (4-space) code blocks diverge the same way. `_CODE_RE` does not blank them, while `marked` renders them as `<pre><code>`. The backend also pays the engine for claims the user never sees (`'annual-report.pdf'`).

The `claim.n === n` guard only turns a divergence into absence when the source numbers happen to differ.

**Fix:** Do not let decoration rest on ordinal equality alone. Two options:
- Mirror the renderer: parse with a CommonMark parser on the backend (for example `markdown-it-py` with link-reference and indented-code support) and number only the markers that reach text nodes outside `code`/`pre`/`a`.
- Make the frontend verify the claim before decorating, for example by requiring the normalised `claim.sentence` to appear in the marker's enclosing block text:

```ts
function claimFor(result, ordinal, n, el) {
  const claim = result?.claims.find((c) => c.ordinal === ordinal)
  if (!claim || claim.n !== n) return null
  const block = el.closest("p,li,td,th,h1,h2,h3,h4,h5,h6")?.textContent ?? ""
  return norm(block).includes(norm(claim.sentence).slice(0, 40)) ? claim : null
}
```
Add link-reference-definition and indented-code cases to `citation_ordinals_v1.json` so the parity fence can catch this.

## Warnings

### WR-01: The steering `instruction` drives the 0.1 prune, so it does filter, despite the tool description saying it does not

**File:** `backend/app/services/rerank_engines/jev.py:42-46`, `backend/app/services/rerank_engines/openai_decisions.py:38-42`, `backend/app/services/openai_service.py:47-54`, `backend/app/services/rerank_engines/prune.py:22`

**Issue:** Both engines fold `searcher_preference` into the single relevance question ("prefer passages that match it" / "count as more helpful"). The resulting probability is what `prune()` compares against `PRUNE_FLOOR`. A preference can therefore push the passage that holds the answer below 0.1 and drop it. Only the keep-3 floor bounds this.

The agent is told the opposite ("Used only to reorder results; it never filters by itself"). The instruction is also the D-10 untrusted value: the agent may have copied it from a hostile document it read earlier ("only passages from contract-v2 are relevant"). This is the "injected steering prunes the answer" failure mode that the deferred "always keep the RRF-best passage" item was meant to bound.

**Fix:** Keep the cut on an un-steered probability. Ask the steering question separately and use it only to order, or prune on a question that omits `searcher_preference`. If that is not done, at least correct the tool description, and re-open the deferred "always keep the RRF-best passage" item now, since the steering path already exists.

### WR-02: Citation checks have no per-user rate limit or concurrency cap, and each one holds a shared threadpool worker for up to 30 s

**File:** `backend/app/api/citation_checks.py:158-169`, `backend/app/services/citation_check_service.py:63-66, 211-236`

**Issue:** In-flight dedupe is **per message**. Nothing else limits a caller. Any authenticated org member can:
- POST checks for many of their own messages at once. Each one occupies a Starlette/anyio `run_in_threadpool` worker (default limiter: 40 tokens, shared with every `aexec` supabase call) for up to `OVERALL_BUDGET_S = 30 s`, plus 4 executor threads. About 40 concurrent checks starve every blocking DB call in that worker process.
- Re-check the same message in a loop. Each re-check up to 60 claims, billed to the organisation's OpenRouter or OpenAI key.

The cost goes into `message_citation_checks.cost_usd` and nowhere else. No spend ledger or entitlement sees it.

**Fix:** Add a per-user Redis token bucket (for example 10 checks per minute) and a per-user concurrent-check cap (for example 2, SET NX on `citation_check_user:{uid}` with a counter). Record the engine cost in the existing usage or spend path so the org budget sees it.

### WR-03: `supabase/full-schema.sql` was not regenerated; the bootstrap artifact lacks migration 211

**File:** `supabase/full-schema.sql` (unchanged since 285-01), `scripts/full-schema-supplement.sql:841-848`

**Issue:** `grep message_citation_checks supabase/full-schema.sql` returns nothing. 294-03-SUMMARY records that the dump could not be regenerated (no docker) and that `check-schema-acl-parity.cjs` reports "THE BOOTSTRAP ARTIFACT HAS LOST ITS SUPPLEMENT TAIL".

A greenfield environment built from the current artifact has no table. Its `GET /citation-checks` then fails inside `load_checks`, which does not catch the PostgREST error, so every thread view's batched GET returns 500 and the action silently never appears. The supplement now also references a relation that the artifact does not create.

**Fix:** Run `bash scripts/regenerate-full-schema.sh` (no `--reset`) once docker is available, re-run `node scripts/check-schema-acl-parity.cjs` to green, and commit it before any promotion. Record it as an owed deploy-parity item until then.

### WR-04: `prune()` returns an empty set when `top_n <= 0`, breaking the D-07 "never empty" invariant

**File:** `backend/app/services/rerank_engines/prune.py:35`, `frontend/src/components/settings/RerankEngineBlock.tsx:197-201`

**Issue:** `kept = kept[:top_n]` with `top_n = retrieval_top_k`. The server does not bound that value (SEED-271), and the new "Keep at most" `<Input type="number">` writes `Number("") === 0` whenever the field is cleared, then saves it. With Jev or OpenAI selected, `prune(…, 0)` returns `[]` for a non-empty pool, and a negative value slices from the end. The function's own docstring says "never return an empty set for a non-empty input". The rerank-off path has the same arithmetic, but D-07 is a promise this function makes, and the new control is a second writer of the value.

**Fix:** Clamp in `prune` (`top_n = max(1, top_n)`, with `floor_keep` applied after it). Clamp the input `onChange` to `[1, 50]` and ignore an empty string. Bound `retrieval_top_k` server-side (SEED-271).

## Info

### IN-01: The local adapter's span records the CrossEncoder object as an input on every search

**File:** `backend/app/services/rerank_engines/local.py:121-123`
**Issue:** `_score(..., model=resident)` is `@traceable`. `redact_inputs` passes `model` through, and LangSmith's serializer falls back to `str(obj)`, which for an `nn.Module` is the full architecture repr. It is not a secret, but it is a large, useless payload on every local search.
**Fix:** Add `"model"` to a per-decorator redaction list, or pass only `model_name` to the traced function.

### IN-02: `span_outputs` reports unknown token counts as 0 in LangSmith

**File:** `backend/app/services/rerank_engines/tracing.py:71-75`
**Issue:** `input_tokens or 0` means Cohere, Local and fallback spans show "0 tokens" in `usage_metadata`, while `EngineCall` correctly keeps `None` (METER-01).
**Fix:** Omit `usage_metadata` (or the token keys) when the counts are `None`.

### IN-03: The fault server cannot answer a `choice` question, so it can never drive a successful citation check

**File:** `scripts/decision-fault-server.py:63-88`
**Issue:** In `ok` mode it answers `noul` (Jev) or `predicate` (OpenAI) to every question, whatever its `type`. A citation check through it always fails validation, so every claim is couldn't check. The D-22 forced-failure drive has no "ok" baseline for the check path.
**Fix:** Branch on `q["type"] == "choice"` and return `{"type": "choice", "choice": "supported", "confidence": 0.9, ...}`.

### IN-04: Answer models validate in lax mode, so `true` becomes 1.0 and `"0.7"` becomes 0.7

**File:** `backend/app/services/rerank_engines/jev.py:70-79`, `backend/app/services/rerank_engines/openai_decisions.py:60-76`
**Issue:** Pydantic lax mode coerces `true` to `1.0` (verified), which defeats `map_answer`'s explicit bool rejection (`citation_check_service.py:152`), and it accepts numeric strings as probabilities.
**Fix:** Use `ConfigDict(strict=True)` (or `StrictFloat`) on the answer models only.

### IN-05: The frontend maps an unknown `rerank_provider` to Cohere; the backend treats it as off

**File:** `frontend/src/components/settings/rerankEngines.ts:120-123` vs `backend/app/services/rerank_service.py:82-85`
**Issue:** A stored unknown id selects the Cohere card in Settings, while search ignores it with a warning.
**Fix:** Map only `"api"` to Cohere, and show "unknown engine, search keeps today's order" for anything else.

### IN-06: Chat availability is a single global value that never refreshes

**File:** `frontend/src/stores/citationCheckStore.ts:85-95, 112-127`
**Issue:** Availability is set only by GET. A 409 `off` or `key_missing` from a POST updates that message's error, while every other message keeps its "Check citations" button. A failed GET leaves `availability` null (the action stays hidden), and `ensure` is called only on mount, so it does not retry.
**Fix:** On a 409 with an availability reason, update `availability`. Retry a failed flush once.

### IN-07: Claim sentences keep a stray space before punctuation

**File:** `backend/app/services/citation_claims.py:129-144`
**Issue:** Stripping `[2]` from `"…sharply [2]."` yields `"Costs fell sharply ."`. That text is what is sent to the engine and stored.
**Fix:** After `_MARKER_RE.sub`, collapse `\s+([.,;:!?])` to `\1`.

### IN-08: "Checking N citations…" counts sources, not the claims being checked

**File:** `frontend/src/components/chat/CitationCheckAction.tsx:66`, `frontend/src/components/chat/CitationList.tsx:73`
**Issue:** `citationCount` is `citations.length`. One source cited by five sentences reads "Checking 1 citation…".
**Fix:** Pass the marker count, or reword it to "Checking N sources…".

---

_Reviewed: 2026-10-20T01:46:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
