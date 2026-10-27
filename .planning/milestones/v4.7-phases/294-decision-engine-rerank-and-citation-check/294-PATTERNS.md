# Phase 294: Decision Engine: Rerank and Citation Check - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 33 (22 new, 11 modified; fixtures and tests listed separately)
**Analogs found:** 31 / 33 (2 have partial analogs only; see "No Analog Found")
**Base:** `3ac75f159` (develop). Next free migration re-confirmed: last file is `210_starter_workflows_v2.sql`, so **211** is free.

All excerpts below were read from the working tree on 2026-10-20. Line numbers are as of that read.

---

## File Classification

Plan numbers follow RESEARCH.md "Recommended plan breakdown".

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `backend/app/services/rerank_service.py` (M) | 01 | service (dispatcher) | request-response | itself (`rerank()` :41-78) | exact (extend in place) |
| `backend/app/services/rerank_engines/__init__.py` (N) | 01 | utility (lookup) | transform | `rerank_service.rerank` provider dispatch :68-75 | role-match |
| `backend/app/services/rerank_engines/registry.py` (N) | 01 | config (data table) | static | `frontend/.../servicesCatalog.ts` (table shape); `models/artifact.py` Literals :52-56 | partial |
| `backend/app/services/rerank_engines/prune.py` (N) | 01 | utility (pure) | transform | `retrieval_rank.py` pure helpers (`_cover_matched_documents`); `_rerank_local` sort :114-122 | role-match |
| `backend/app/services/rerank_engines/cohere.py` (N, moved) | 01 | service adapter | request-response (HTTP) | `rerank_service._rerank_api` :81-105 | exact (verbatim move) |
| `backend/app/services/rerank_engines/local.py` (N, moved) | 01 | service adapter | in-process ML | `rerank_service._get_local_model` / `_rerank_local` :27-38, :108-122 | exact (move + cache fix) |
| `backend/app/services/rerank_engines/jev.py` (N) | 01 | service adapter | request-response (HTTP, batched) | `rerank_service._rerank_api` :81-105 | role-match |
| `backend/app/services/rerank_engines/openai_decisions.py` (N) | 01 | service adapter | request-response (HTTP) | `rerank_service._rerank_api` :81-105 | role-match |
| `backend/app/services/rerank_engines/tracing.py` (N) | 01 | utility | transform | `recall_eval.describe_dsn` (credential-dropping summariser) :151-164; `@traceable(run_type="llm")` in `sub_agent_service.py:19` | partial |
| `backend/app/services/retrieval_service.py` (M, hot) | 01 | service (orchestrator) | request-response | itself :63-72, :158-172 | exact |
| `backend/app/services/search_documents_tool.py` (M) | 01 | tool handler | request-response | itself `_search_unfiltered` :1150-1178 and filtered call :1304-1311 | exact |
| `backend/app/services/openai_service.py` (M, hot) | 01 | config (tool schema) | static | `SEARCH_DOCUMENTS_TOOL` :25-131 | exact |
| `backend/app/api/settings.py` (M, hot) | 01 | controller | request-response | `hnsw_iterative_scan` allowlist refusal :866-881 | exact |
| `backend/app/services/decision_eval.py` (N) | 02 | service (measurement) | batch | `backend/app/services/recall_eval.py` | exact |
| `backend/app/services/pricing_service.py` (M) | 02 | utility | transform | `compute_token_cost_usd` :81-131 | exact |
| `scripts/measure-decision-engines.py` (N) | 02 | CLI | batch | `scripts/measure-recall.py` | exact |
| `backend/tests/fixtures/decision_heldout_v1.json` (N) | 02 | test fixture | static | `backend/tests/unit/fixtures/artifact_record_v1.json` (frozen wire fixture) | partial |
| `supabase/migrations/211_message_citation_checks.sql` (N) | 03 | migration | DDL | `supabase/migrations/202_message_artifacts.sql` | exact |
| `scripts/full-schema-supplement.sql` (M, hot) | 03 | config (ACL mirror) | DDL | its own migration-202 block :514-520 | exact |
| `backend/app/services/citation_claims.py` (N) | 03 | utility (pure) | transform | `backend/app/services/citation_markers.py` (`_CODE_RE`, `_MARKER_RE`) | role-match |
| `backend/app/services/citation_check_service.py` (N) | 03 | service | request-response (fan-out) | `rerank_engines/*` (01) + `db/artifacts.py` writer | partial |
| `backend/app/models/citation_check.py` (N) | 03 | model (Pydantic) | transform | `backend/app/models/artifact.py` (`Literal`, `_Strict` extra=forbid) :52-56, :232-233 | exact |
| `backend/app/api/citation_checks.py` (N) | 03 | controller (router) | request-response | `api/feedback.py` (user-JWT, message-keyed) + `api/workflow_run_evidence.py` (pool, uniform 404) + `api/evals.py` (Redis SET NX in-flight 409) | role-match (composite) |
| `backend/app/main.py` (M, hot) | 03 | config (router mount) | static | `include_router(workflow_run_evidence.router)` :898 | exact |
| `frontend/src/components/settings/rerankEngines.ts` (N) | 04 | config (data table) | static | `components/settings/servicesCatalog.ts`; `components/panel/phaseStatusMeta.ts` | exact |
| `frontend/src/components/settings/RerankEngineBlock.tsx` (N) | 04 | component | request-response (props in, callbacks out) | `components/settings/ModelPillRow.tsx` (extracted Settings sub-component) | role-match |
| `frontend/src/pages/SettingsPage.tsx` (M, hot) | 04 | page | request-response | itself :1350-1380 (Reranking card), :511-515 / :616-620 / :757-761 (state/hydrate/save) | exact |
| `frontend/src/stores/citationCheckStore.ts` (N) | 05 | store | request-response (batched GET) | `frontend/src/stores/askDraftStore.ts` | role-match |
| `frontend/src/lib/api/citationChecks.ts` (N) | 05 | API client | request-response | `frontend/src/lib/api/runEvidence.ts` (GET) + `lib/api/schedules.ts:49-62` (POST) | exact |
| `frontend/src/components/chat/citationVerdicts.ts` (N) | 05 | config (vocabulary) | static | `components/panel/phaseStatusMeta.ts` (STATUS_META + own-property guard) | exact |
| `frontend/src/components/chat/CitationCheckAction.tsx` (N) | 05 | component | event-driven | `components/metadata/ConfidenceChip.tsx` (glyph+word+raw score atoms); `CitationList.tsx` trigger | role-match |
| `frontend/src/components/chat/CitedMarkdown.tsx` (M) | 05 | component | event-driven (owned DOM) | itself `createMarker` :69-79, layout effect :122-165 | exact |
| `frontend/src/components/chat/CitationList.tsx` (M) | 05 | component | static | itself :32-72 | exact |
| `frontend/src/components/chat/CitationPeek.tsx` (M) | 05 | component | static | itself body :159-183 | exact |
| `frontend/src/components/chat/MessageItem.tsx` (M, hot) | 05 | component | static | itself :737-760 (the two mounts) | exact |

---

## Pattern Assignments

### `backend/app/services/rerank_service.py` (service, request-response) — Plan 01

**Analog:** itself. It keeps `rerank()`'s name, positional signature and `@traceable`, and becomes a thin dispatcher.

**Current imports to keep** (lines 12-25):
```python
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx
from langsmith import traceable

from app.config import settings

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)
```

**Settings resolution idiom to keep** (lines 54-66). Every engine reads settings this way: `user_settings` first, `settings` as the fallback.
```python
rerank_enabled = user_settings.rerank_enabled if user_settings is not None else settings.rerank_enabled
if not rerank_enabled:
    return documents
if not documents:
    return documents
rerank_top_n = user_settings.rerank_top_n if user_settings is not None else settings.rerank_top_n
n = top_n if top_n is not None else rerank_top_n
rerank_provider = user_settings.rerank_provider if user_settings is not None else settings.rerank_provider
```

**Dispatch + fallback to replace** (lines 68-78). Pitfall 3: `return documents` on failure returns the whole pool, so failure is not the same as off. The fix returns `documents[:n]`, and it must log the engine name only, never `logger.exception` (that would carry headers and response text):
```python
try:
    if rerank_provider in ("api", "cohere"):
        return _rerank_api(query, documents, n, rerank_api_key, rerank_model)
    elif rerank_provider == "local":
        return _rerank_local(query, documents, n, rerank_model)
    else:
        logger.warning("Unknown RERANK_PROVIDER=%r — skipping rerank", rerank_provider)
        return documents
except Exception:
    logger.exception("Reranking failed — returning original order")
    return documents
```
Target shape (RESEARCH "Code Examples"): `@traceable(name="rerank-documents", run_type="retriever", process_inputs=redact_inputs)`, signature `rerank(query, documents, top_n=None, user_settings=None, *, instruction=None, keep_documents=False)`, with the new parameters **keyword-only** (the fixed-signature fakes depend on it).

---

### `backend/app/services/rerank_engines/cohere.py` and `local.py` (adapters) — Plan 01

**Analog:** `rerank_service._rerank_api` (lines 81-105) and `_rerank_local` (108-122). This is a **verbatim move**: behaviour stays the same except for the `[:n]` fallback and the cache fix (D-08: no 0.1 floor for these two).

**HTTP adapter core** (lines 83-105). This is the template for every hosted adapter:
```python
response = httpx.post(
    "https://api.cohere.com/v2/rerank",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={ "model": model, "query": query,
           "documents": [doc["content"] for doc in documents], "top_n": top_n },
    timeout=30.0,
)
response.raise_for_status()
data = response.json()

reranked = []
for result in data["results"]:
    doc = dict(documents[result["index"]])      # COPY the row: keeps low_similarity, id, document_id, chunk_index
    doc["relevance_score"] = result["relevance_score"]
    reranked.append(doc)
return reranked
```

**Local sort-and-cut** (lines 110-122). For the Local engine the reorder-only rule (D-08) is exactly this:
```python
model = _get_local_model(model_name)
pairs = [(query, doc["content"]) for doc in documents]
scores = model.predict(pairs)
scored = [(float(score), doc) for score, doc in zip(scores, documents)]
scored.sort(key=lambda x: x[0], reverse=True)
reranked = []
for score, doc in scored[:top_n]:
    d = dict(doc); d["relevance_score"] = score; reranked.append(d)
```

**The defect to replace** (lines 27-38). It caches the first model forever and never looks at `model_name`. Replace it with the `(model_name, CrossEncoder)` tuple and the double-checked `threading.Lock` given in RESEARCH §2 "Local-model singleton fix":
```python
_local_model = None
def _get_local_model(model_name: str):
    global _local_model
    if _local_model is None:
        from sentence_transformers import CrossEncoder  # type: ignore
        _local_model = CrossEncoder(model_name)
    return _local_model
```

---

### `backend/app/services/rerank_engines/jev.py` and `openai_decisions.py` (adapters) — Plan 01, also used by Plan 03

**Analog:** the `_rerank_api` HTTP shape above. What is new and has no in-repo analog: batching, concurrency, the decision request bodies, and refusal/missing-answer detection. Copy these from RESEARCH §1 / §2 "Engine call design" (request shapes are cited from vendor docs).

Rules carried over from the analog:
- Use `httpx` directly, with no SDK (installed `openai` 2.28.0 has no `decisions`).
- Copy each row with `dict(doc)` (or `{**row, ...}`) so `low_similarity` survives (`retrieval_service.py:174-176` depends on it).
- Call `raise_for_status()` and then validate the body with a Pydantic model (copy `_Strict` from `models/artifact.py:232-233`, `model_config = ConfigDict(extra="forbid")`). Any validation failure raises, and the dispatcher catches it and falls back.
- Endpoint constants live in `registry.py`. Never derive the Jev URL from the stored OpenRouter `base_url` (`config.py:14` is `/api/v1`; Jev is `/api/alpha/decisions`).
- Untrusted strings (query, instruction, passages, claims) go only in `state` / `input` as JSON. The question `instructions` are module constants that reference ids (`P00`, `C000`) only (D-10).

**Error-log pattern to copy** (the redaction idea from `recall_eval.py:151-164` `describe_dsn`: the credential never travels into a printed line):
```python
logger.warning("rerank engine %s failed (%s) — keeping the current order", engine.id, _reason(exc))
# _reason(exc) = type(exc).__name__ or the HTTP status. Never str(exc) of an httpx error (may carry the request), never the key.
```

**Testing analog:** `tests/unit/test_284_request_recorder.py:206-217` swaps in an `httpx.MockTransport`:
```python
seen: list[httpx.Request] = []
client = httpx.Client(transport=httpx.MockTransport(_handler(seen)))
monkeypatch.setattr(deps, "_shared_httpx", client)
```
The adapters should take their client from a module-level factory (e.g. `_http_client()`) so the D-12 "no client constructed when off" test can patch it to raise, and the failure tests can inject a `MockTransport`.

---

### `backend/app/services/rerank_engines/prune.py` (utility, pure) — Plan 01

**Analog:** the pure helpers in `retrieval_rank.py` (imported at `retrieval_service.py:29-36`: `_cover_matched_documents`, `_carry_low_similarity`), plus the sort in `_rerank_local`. No I/O and no settings reads: everything comes in as arguments. RESEARCH §2 "Prune composition" gives the full body (`PRUNE_FLOOR = 0.1`, `MIN_KEEP = 3`, stable tie order, `keep_documents` coverage). The last line copies rows with every key kept:
```python
return [{**row, "relevance_score": p} for p, row in kept]
```
It applies to probabilistic engines only (`registry.probabilistic is True`). Cohere and Local never go through it.

---

### `backend/app/services/rerank_engines/tracing.py` (utility) — Plan 01

**Analog (partial):** no `process_inputs` exists in the codebase yet. The closest idea is `recall_eval.describe_dsn` (151-164), "the credential never travels". For the LLM child span, copy the decorator shape from `sub_agent_service.py:19` (`@traceable(name="sub-agent", run_type="llm")`). The body is in RESEARCH "Code Examples":
```python
_SECRET_ARGS = frozenset({"user_settings", "api_key"})
def redact_inputs(inputs: dict) -> dict:
    return {k: ("<redacted>" if k in _SECRET_ARGS else v) for k, v in inputs.items()}
```
Apply it to `rerank-documents` (rerank_service), `search-documents` (retrieval_service:63) and every new engine span (`decision.jev` / `decision.openai`, `run_type="llm"`). Never pass a key as an argument to a traced function.

---

### `backend/app/services/retrieval_service.py` (orchestrator, HOT) — Plan 01

**Analog:** itself. The ledger's binding invariants: one top-level def, 7 re-exports stay, the unfiltered `[:top_k]` and rerank `top_n=top_k` stay byte-unchanged, and the last positional parameter stays `document_ids`.

**Decorator + signature today** (lines 63-72):
```python
@traceable(name="search-documents", run_type="retriever")
async def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None = None,
    user_settings: UserEffectiveSettings | None = None,
    folder_ids: list[str] | None = None,
    document_ids: Sequence[str] | None = None,
) -> tuple[list[dict], float]:
```
Change: add `process_inputs=redact_inputs` to the decorator, and append `*, instruction: str | None = None` after `document_ids`.

**The one rerank call** (lines 158-172). The only body touch is adding conditional kwargs, so the fixed-signature fakes keep working:
```python
rerank_enabled = user_settings.rerank_enabled if user_settings else settings.rerank_enabled
if rerank_enabled:
    candidates = await run_in_threadpool(
        rerank, query, candidates, top_n=len(candidates) if filtered else top_k,
        user_settings=user_settings,
        # + **({"instruction": instruction} if instruction else {}),
        # + **({"keep_documents": True} if filtered else {}),
    )
    if filtered:
        candidates = _cover_matched_documents(candidates, top_k)
else:
    candidates = _cover_matched_documents(candidates, top_k) if filtered else candidates[:top_k]
```
**The fake that must gain `**_kw`** (with the reason recorded in the test): `tests/unit/test_272_filtered_both_arms.py:323`. Today it reads `def _fake_rerank(query, documents, top_n=None, user_settings=None):`.

---

### `backend/app/services/search_documents_tool.py` (tool handler) — Plan 01

**Analog:** itself, at its two `search_documents` call sites. The rule is in the docblock at :1153-1154: pass **no** kwarg rather than `kwarg=None`.

**Unfiltered call** (lines 1150-1162):
```python
async def _search_unfiltered(args: dict, ctx: Any, ToolResult: Any):
    """... ⛔ It passes NO ``document_ids`` kwarg (never ``document_ids=None``): test_260's fixed-signature
    retrieval fakes would TypeError ..."""
    try:
        results, avg_sim = await search_documents(
            args["query"], ctx.current_user["id"], ctx.supabase,
            metadata_filter=None,
            user_settings=ctx.user_settings,
            folder_ids=ctx.folder_subtree_ids,
            # + **({"instruction": clamped} if clamped else {}),
        )
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        return _provider_error(ctx, args["query"], exc, [], ToolResult)
```
**Filtered call** (lines 1304-1311): it has the same shape with `document_ids=scope.document_ids`, and gets the same conditional `instruction`. The clamp (strip control characters, collapse whitespace, ≤ 300 characters, ignore a non-string) is a small module-level helper in this file, called once per handler. Other fixed-signature fakes to keep green: `test_260_financial_analyzer_conversation.py:112,212` and `test_267_cr02_empty_biased_scope_searches.py:90`.

---

### `backend/app/services/openai_service.py` (tool schema, HOT) — Plan 01

**Analog:** `SEARCH_DOCUMENTS_TOOL` (lines 25-131). This is the single source for every provider: Anthropic and Google derive their schemas from it. Add **one** property beside `query`, using the provider-safe rules stated in the comment at :44-51 (no `anyOf` / `oneOf` / `allOf`, no type arrays, no `$ref`):
```python
"properties": {
    "query": {
        "type": "string",
        "description": "The semantic search query to find relevant document chunks.",
    },
    # + "instruction": {"type": "string", "description": "Optional. ..."},   # NOT in "required"
    ...
},
"required": ["query"],
```
Leave out `maxLength`; the server-side clamp handles length. Pins: `test_272_tool_schema.py:102-116` (Google sanitizer path) and `test_259_closed_core_inventory.py` (registry still 30).

---

### `backend/app/api/settings.py` (controller, HOT) — Plan 01

**Analog:** the closed-set refusal for `hnsw_iterative_scan` (lines 866-881). Copy this shape exactly: check against the allowed set, raise a 400 whose detail is a plain-language sentence, and only then write the update:
```python
if body.hnsw_iterative_scan is not None:
    if body.hnsw_iterative_scan not in HNSW_ITERATIVE_SCAN_VALUES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Iterative scan must be one of "
                + ", ".join(HNSW_ITERATIVE_SCAN_VALUES)
                + ". ..."
            ),
        )
    updates["hnsw_iterative_scan"] = body.hnsw_iterative_scan
```
**The line it wraps** (lines 657-658). This is the file's whole touch:
```python
if body.rerank_provider is not None:
    updates["rerank_provider"] = body.rerank_provider
```
Import the allowed ids from `rerank_engines.registry`; never retype the list in `settings.py`. Keep the legacy `"api"` id valid. The wire already sends `rerank_has_api_key` (:402) and `providers[*].has_key`, so no new response field is needed.

---

### `backend/app/services/decision_eval.py` (measurement service) — Plan 02

**Analog:** `backend/app/services/recall_eval.py` (1070 lines; reuse it, do not modify it, since its ledger row says "safe as-is").

**What to import** (do not copy): `EVAL_PROBES` (:63), `compute_metrics` (:116-131, md5-pinned), `RecallUnmeasurable` (:138-144), `describe_dsn` / `dsn_label` (:151-172), and the probe-vector cache idiom (:874-969).

**Module docblock contract to mirror** (lines 31-40). The refusal rule and import-safety:
```
**The refusal (D-03).** Every failure to reach the database, to establish the caller's role, or
to obtain query vectors raises :class:`RecallUnmeasurable`. No function here returns metrics on
an error path and none prints.
**Import-safe by construction.** No module-scope DSN, no module-scope connection, no side effect
at import ...
```

**Lazy import + refusal-on-error pattern** (lines 943-959). Copy it for every external dependency (embedding, the app's settings load, `retrieval_service.search_documents`):
```python
try:
    from starlette.concurrency import run_in_threadpool
    from app.services.openai_service import embed_texts
    vectors = await run_in_threadpool(embed_texts, [probe["query"] for probe in probes], embedding_model)
except RecallUnmeasurable:
    raise
except Exception as exc:
    raise RecallUnmeasurable(
        "could not measure: the probe queries could not be embedded and no cache is present "
        f"({type(exc).__name__}: {exc})"
    ) from exc
```
Add a held-out sha256 check that raises `RecallUnmeasurable` when the hash differs (D-18 freeze-first). Swap the arm settings in with `.model_copy(update={...})`, never by writing `app_settings`. Patch `app.services.retrieval_rpc.embed_texts` (patch-where-used; see the re-export note at `retrieval_service.py:51-52`).

---

### `scripts/measure-decision-engines.py` (CLI) — Plan 02

**Analog:** `scripts/measure-recall.py` (272 lines).

**Path setup + import** (lines 31-45):
```python
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.recall_eval import (  # noqa: E402  (path setup must precede the import)
    ..., RecallUnmeasurable, run_measurement,
)
_EXIT_OK = 0
_EXIT_UNMEASURABLE = 2
```
**Refusal branch + report write** (lines 221-268). Copy this structure verbatim:
```python
def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = asyncio.run(run_measurement(...))
    except RecallUnmeasurable as exc:
        # ⛔ THE REFUSAL BRANCH. Do not "simplify" this into the success path.
        print(f"[measure-recall] REFUSED: {exc}", file=sys.stderr)
        print("[measure-recall] no number was produced and no report was written.", file=sys.stderr)
        return _EXIT_UNMEASURABLE
    report["label"] = args.label
    report["measured_at"] = datetime.now(timezone.utc).isoformat()
    _print_verdict(report)
    if args.json_out is not None:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return _EXIT_OK

if __name__ == "__main__":
    sys.exit(main())
```
The verdict line names every question that flips from found to absent, and states plainly when a cost "costs $X more than it saves per search" (D-19).

---

### `backend/app/services/pricing_service.py` (utility) — Plan 02

**Analog:** `compute_token_cost_usd` (lines 81-131). Add one sibling helper **in this module** (the AST fence `test_257_single_token_conversion_home.py` refuses token × rate arithmetic anywhere else). It is the same Decimal arithmetic without `.quantize(QUANTIZE_FOUR_PLACES)` (Pitfall 8: a cost of $0.00002 would round to 0.0000 and read as "free"):
```python
in_cost_raw = (in_tokens * rate.input_cost_per_million) / ONE_MILLION
out_cost_raw = (out_tokens * rate.output_cost_per_million) / ONE_MILLION
total_raw = in_cost_raw + out_cost_raw
# compute_token_cost_usd then quantizes; the new helper returns total_raw unquantized.
```
Keep the honesty rule from the module docblock: with no rate, return `None`, never `0`.

---

### `supabase/migrations/211_message_citation_checks.sql` (migration) — Plan 03

**Analog:** `supabase/migrations/202_message_artifacts.sql`. Copy the header structure (WHAT / WHY A TABLE / VISIBILITY / apply discipline) and these blocks.

**Table + FK cascades + org column** (lines 60-66 pattern):
```sql
CREATE TABLE IF NOT EXISTS public.message_artifacts (
    id           text PRIMARY KEY ...,
    thread_id    uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id       uuid NOT NULL,
```
For 211: `message_id uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE`, `engine text NOT NULL CHECK (engine IN ('jev','openai_decisions'))`, `result jsonb NOT NULL`, `input_tokens int`, `cost_usd numeric`, `created_at`, `updated_at` (RESEARCH §5).

**Org autofill** (lines 120-122):
```sql
DROP TRIGGER IF EXISTS message_artifacts_autofill_org_id ON public.message_artifacts;
CREATE TRIGGER message_artifacts_autofill_org_id BEFORE INSERT ON public.message_artifacts
    FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');
```
**RLS + ACL** (lines 155-172). Note the service_role trap at :159-161. 211 differs from 202 in one way: a re-check **replaces**, so service_role gets UPDATE and there is **no** immutability trigger:
```sql
ALTER TABLE public.message_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.message_artifacts FROM service_role;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;   -- 211: + UPDATE

DROP POLICY IF EXISTS "Users can view their own message artifacts" ON public.message_artifacts;
CREATE POLICY "Users can view their own message artifacts" ON public.message_artifacts
    FOR SELECT TO authenticated
    USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));
```
**VERIFY block** (lines 179-214): copy the `with checks(what, ok) as (values ...) select case when ok then 'PASS' else '*** FAIL ***' end` form. Rows to keep: RLS enabled, exactly one policy, policy is SELECT, anon cannot SELECT, authenticated can SELECT, authenticated cannot INSERT/UPDATE, org autofill trigger present. 211 adds "service_role can UPDATE" and drops the immutability rows. If 211 adds a `set_updated_at` trigger, revoke function EXECUTE from PUBLIC first, as at :149-152 (only when it creates a new function; reusing the shared `set_updated_at` needs no revoke).

**Shape test analog:** `backend/tests/unit/test_273_migration_202_shape.py`. Copy its `_migration()` glob, `_strip_comments`, `_norm` and the SUPPLEMENT / FULL_SCHEMA paths (lines 17-49) into `test_294_migration_211_shape.py`.

---

### `scripts/full-schema-supplement.sql` (ACL mirror, HOT) — Plan 03

**Analog:** its own migration-202 block (lines 514-520). Append the 211 equivalent directly after the latest block, using the same comment style:
```sql
-- migration 202 — message_artifacts: owners READ (the messages predicate); only the backend writes.
-- No UPDATE to ANY role, service_role included (D-08: an artifact is immutable once shown).
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.message_artifacts FROM service_role;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;
```
Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`) **after** the operator pastes 211. Never hand-edit `full-schema.sql`.

---

### `backend/app/services/citation_claims.py` (pure utility) — Plan 03

**Analog:** `backend/app/services/citation_markers.py`. Import its regexes; never re-type them.

**Regexes to reuse** (lines 45-59):
```python
_MARKER_RE = re.compile(r"\[(\d+)\]")
_CODE_RE = re.compile(
    r"("
    r"```.*?```"        # fenced ``` ... ``` block
    r"|~~~.*?~~~"        # fenced ~~~ ... ~~~ block
    r"|``.*?``"          # double-backtick inline span
    r"|`[^`\n]*`"        # single-backtick inline span
    r")",
    re.DOTALL,
)
```
**Prose/code split walk** (lines 106-109). Use the same walk to enumerate in-range markers in document order:
```python
parts = _CODE_RE.split(text)
for i in range(0, len(parts), 2):     # only even indices are prose
    parts[i] = _transform_prose(parts[i], k)
```
**Dedup port source:** `frontend/src/components/chat/messageText.ts:18-~50` (`dedupParagraphs`, two passes). Port it 1:1 and pin it with the shared `citationOrdinals.json` fixture (see the parity-test analog under `rerankEngines.ts`). Like `citation_markers`, keep this module free of dependencies (its docblock :65-69 explains it avoids importing `agent_loop` because of a cycle).

---

### `backend/app/models/citation_check.py` (Pydantic model) — Plan 03

**Analog:** `backend/app/models/artifact.py`. Use closed `Literal`s at module scope (lines 52-56) so a frontend `?raw` fence can read them, and a strict base (lines 232-233):
```python
ComponentName = Literal["chart", "table", "metric"]
...
class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")
```
For 294: `Verdict = Literal["supported", "partly_supported", "not_supported", "contradicted", "couldnt_check"]` and `EngineId = Literal["jev", "openai_decisions"]`. An unknown engine label maps to `couldnt_check` **before** validation (D-17). Do not let it raise a 500.

---

### `backend/app/services/citation_check_service.py` (service) — Plan 03

**Analog (partial):** the 01 adapters for the engine call (the `choice` question), and `backend/app/db/artifacts.py` for the pool writer.

**Pool writer conventions** (`db/artifacts.py` docblock :8-14, insert :51-57, `_row_out` :97-104):
```python
# SECURITY: every value is bound with a ``$N`` positional placeholder. No f-string ... on a SQL string.
# ⛔ the pool connects as ``postgres`` and BYPASSES RLS ... EVERY read binds thread_id AND user_id
_INSERT_SQL = """
    INSERT INTO public.message_artifacts (id, thread_id, user_id, org_id, ...)
    VALUES ($1, $2, $3, $4, ...)
    RETURNING *
"""
def _row_out(row: Any) -> dict:
    out = _jsonable(dict(row))
    for key in ("spec", "caption"):           # belt: a pool without the jsonb codec returns text
        if isinstance(out.get(key), str):
            out[key] = json.loads(out[key])
    return out
```
For 211 the statement is `INSERT ... ON CONFLICT (message_id) DO UPDATE SET engine = EXCLUDED.engine, ... RETURNING *`, with `user_id` / `org_id` / `thread_id` **bound from the message row**, never from the request. Return `_row_out(row)` so the POST answer and a reload GET are the same object (the "live == reload" rule in 202's header).

Per-source failure handling: one source's failure marks only that source's claims `couldnt_check` (copy the shape of `workflow_run_evidence._optional`, :215-221: log the id, degrade, never 500).

---

### `backend/app/api/citation_checks.py` (router) — Plan 03

**Analogs (composite):**
1. **`api/feedback.py`**: the message-keyed, user-JWT, request-scoped router.
2. **`api/workflow_run_evidence.py`**: a pydantic wire with every field declared, and a uniform 404 for every miss.
3. **`api/evals.py:265-276`**: the atomic Redis `SET NX` in-flight claim and its 409.

**Imports + router** (`feedback.py` lines 7-16):
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

# Phase 163 (D-03): ... request-scoped → the RLS-enforced per-request user-JWT client.
from app.dependencies import get_current_user, get_user_supabase_client

router = APIRouter(prefix="/feedback", tags=["feedback"])
```
**Handler signature** (`feedback.py` lines 37-43):
```python
@router.post("", status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
```
⚠ `feedback.py` calls `supabase.table(...).execute()` **bare** inside an async handler. Do not copy that. Wrap every supabase-py call with `aexec` / `maybe_row` from `backend/app/utils/db.py:57-83` (D-v2.5-01; `test_280_maybe_row_fence.py` pins `maybe_single()` reads):
```python
async def aexec(query):
    return await run_in_threadpool(query.execute)
def maybe_row(resp):
    return resp.data if resp is not None else None
```
**Uniform 404** (`workflow_run_evidence.py` lines 211-212, 276-278):
```python
def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
...
run = await pool.fetchrow(_ACCESS_SQL, workflow_run_id, viewer_uuid)
if run is None:
    raise _not_found()
```
Here, "not found" and "not yours" are the same thing: a user-JWT read of `messages` returns no row, and both get one body.

**In-flight 409** (`evals.py` lines 265-276) with `redis: aioredis.Redis = Depends(get_redis)` (import at :51, :62):
```python
claimed = await redis.set(
    _inflight_key(skill_id), str(run_id), nx=True, ex=_INFLIGHT_TTL_S
)
if not claimed:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="An eval run is already in progress for this skill",
    )
```
Release in a `finally`, as `evals.py:404` does (`_release_inflight_if_owned`). Key: `citation_check:{message_id}`, `ex=60`.

**Response models:** declare every field (the `RunEvidenceRead` lesson, `workflow_run_evidence.py:62`: "response_model drops the rest"), or return a plain dict on purpose. `GET` never returns a key or a base URL.

---

### `backend/app/main.py` (router mount, HOT) — Plan 03

**Analog:** line 878 (the import list) and line 898 (one `include_router` with a trailing comment naming the phase and route):
```python
from app.api import threads, runs, ..., workflow_run_evidence, ...  # noqa: E402
app.include_router(workflow_run_evidence.router)  # Phase 289 VIS-03 — GET /workflow-runs/{id}/evidence: ...
```
Add `citation_checks` to the import tuple and one `app.include_router(citation_checks.router)  # Phase 294 DEC-03 — ...`. No `canvas_gate` entry (the path is not canvas-gated).

---

### `frontend/src/components/settings/rerankEngines.ts` (data table) — Plan 04

**Analogs:** `components/settings/servicesCatalog.ts` (an authored, exported registry of entries with a typed interface) and `components/panel/phaseStatusMeta.ts` (a table plus an own-property-guarded accessor).

**Typed entry + exported array** (`servicesCatalog.ts` lines 8-36):
```ts
export interface CatalogServiceEntry {
  serviceId: string
  name: string
  tagline: string
  ...
  shape?: "mcp" | "oauth"
  isPopular: boolean
}
export const POPULAR_SERVICES: CatalogServiceEntry[] = [ { serviceId: "slack", ... }, ... ]
```
**Total accessor with own-property guard** (`phaseStatusMeta.ts` lines 207-210). Use it for `engineFor(id)`, so an unknown or legacy id (`"api"`) resolves to a declared row and never to `undefined`:
```ts
export function statusMeta(status: Phase["status"]): StatusMeta {
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return STATUS_META.unknown
  return STATUS_META[status]
}
```
**Parity with `registry.py`:** copy the `?raw` source-read fence from `components/chat/__tests__/artifactParity.fence.test.ts` lines 13-46:
```ts
import modelSource from "../../../../../backend/app/models/artifact.py?raw"
function literalValues(source: string, name: string): string[] {
  const m = new RegExp(`^${name}\\s*=\\s*Literal\\[([^\\]]*)\\]`, "m").exec(source)
  ...
}
it("NON-VACUITY — both Literals were found in the backend source", ...)
it("ComponentName == ARTIFACT_COMPONENTS (as sets)", ...)
```
For this reason `registry.py` should expose its engine ids as a module-level `Literal[...]` (or another regex-readable constant). The same fence shape serves the `citationOrdinals.json` pytest + vitest parity (plan 05).

---

### `frontend/src/components/settings/RerankEngineBlock.tsx` (component) — Plan 04

**Analog:** `components/settings/ModelPillRow.tsx`. It was extracted from SettingsPage for a narrow test surface, takes values plus callbacks as props, has optional props with defensive defaults, and owns no fetch.

**Docblock + prop interface style** (lines 5-49):
```ts
/**
 * ModelPillRow — Phase 075.3 ...
 * Extracted from SettingsPage.tsx (was the inline render at lines 765-778) so
 * the badge logic has a narrow vitest test surface ...
 */
export interface ModelPillRowProps {
  /** Pre-split + trimmed model list from the active provider */
  models: string[]
  ...
  onSelect: (model: string) => void
  /** ... Optional — absent → empty set → no badge (defensive default). */
  deprecatedModels?: Set<string>
}
```
Props for the block: `enabled`, `provider`, `model`, `topN`, `apiKey`, their five setters (the existing `useState`s), plus `providers` (from `s.providers`, giving `has_key`). Card facts come **only** from `rerankEngines.ts` (024 rule). Glyph + word, never colour alone (ConfidenceChip's three-atoms rule, `ConfidenceChip.tsx:10-16`).

---

### `frontend/src/pages/SettingsPage.tsx` (page, HOT) — Plan 04

**Analog:** itself. Replace the card **body** with one mount, and add **0** new `useState`.

**State that stays** (lines 511-515), **hydrate** (616-620), **save** (757-761):
```tsx
const [rerankEnabled, setRerankEnabled] = useState(false)
const [rerankProvider, setRerankProvider] = useState("api")
const [rerankModel, setRerankModel] = useState("")
const [rerankTopN, setRerankTopN] = useState(5)
const [rerankApiKey, setRerankApiKey] = useState("")
...
setRerankProvider(data.rerank_provider)
setRerankApiKey(data.rerank_has_api_key ? KEY_PLACEHOLDER : "")
...
rerank_provider: rerankProvider,
rerank_api_key: rerankApiKey || KEY_PLACEHOLDER,
```
**Card to replace** (lines 1350-1380). Keep the `SectionCard` and the Enabled `FieldRow`, and swap the `{rerankEnabled && (<>...</>)}` body for `<RerankEngineBlock .../>`:
```tsx
<SectionCard title="Reranking" description="Re-score retrieved chunks with a cross-encoder for higher precision.">
  <FieldRow label="Enabled">
    <Toggle checked={rerankEnabled} onChange={setRerankEnabled} label={rerankEnabled ? "On" : "Off"} />
  </FieldRow>
  {rerankEnabled && ( <> <FieldRow label="Provider"><select ...> ... </> )}
</SectionCard>
```
Key status reads `s.providers` (`hydrate` :589-598 already holds `has_key` per provider). `SettingsPage.changedFields` asserts that hydrate makes no spurious diff, so the block must not normalise `"api"` to `"cohere"` on mount. Do **not** touch `ProviderPicker.tsx`.

---

### `frontend/src/lib/api/citationChecks.ts` (API client) — Plan 05

**Analog:** `frontend/src/lib/api/runEvidence.ts` for GET, and `lib/api/schedules.ts:49-62` for POST.

**Own specifier, not a barrel export** (`runEvidence.ts` lines 10-13, 18):
```ts
 * ⚠ ITS OWN SPECIFIER, NOT A RE-EXPORT THROUGH `lib/api.ts`. That file is the hottest in the
 * repository and suites mock it by path ...
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
```
**GET** (`runEvidence.ts` lines 115-123):
```ts
export async function getRunEvidence(runId: string, signal?: AbortSignal): Promise<RunEvidence> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflow-runs/${encodeURIComponent(runId)}/evidence`, { headers, signal })
  if (!res.ok) throw new ApiError(`Failed to load the run record (status ${res.status})`, res.status)
  return (await res.json()) as RunEvidence
}
```
**POST** (`schedules.ts` lines 53-61):
```ts
const headers = await getAuthHeaders()
const res = await fetch(`${API_BASE}/workflows/${encodeURIComponent(workflowId)}/schedules`,
  { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) })
if (!res.ok) { throw new ApiError(await readScheduleFailure(res), res.status) }
return (await res.json()) as WorkflowSchedule
```
The wire types are copied verbatim from the backend model (the "THE TYPES BELOW ARE THE WIRE CONTRACT VERBATIM" rule, `runEvidence.ts:14-16`), and a shared fixture pins them from both sides.

---

### `frontend/src/stores/citationCheckStore.ts` (store) — Plan 05

**Analog:** `frontend/src/stores/askDraftStore.ts` (a small, single-purpose zustand store kept out of the G-5 `streamsStore.ts`).

**Why its own module** (lines 11-12): *"that file FIRES under G-5 ... it gets its own small module rather than another slice there."*

**Create + stable empty reference** (lines 29, 37, 64, 87-90):
```ts
import { create } from "zustand"
export const EMPTY_DRAFT: AskDraft = Object.freeze({ choiceIndex: null, freeText: "" }) as AskDraft
export const useAskDraftStore = create<AskDraftState>()((set) => ({ drafts: {}, ... }))
export function useAskDraft(id: string): AskDraft {
  return useAskDraftStore((s) => s.drafts[id] ?? EMPTY_DRAFT)    // zustand v5: never a fresh {} per call
}
```
**Test reset** (lines 102-105): `export function resetCitationChecks()`, registered in `setupTests.ts` (module singletons outlive `cleanup()`). The microtask-batched `ensure(id)` → one `GET ?message_ids=` has no in-repo analog; build it from RESEARCH §5.

---

### `frontend/src/components/chat/citationVerdicts.ts` (vocabulary) — Plan 05

**Analog:** `components/panel/phaseStatusMeta.ts`. Its interface + `Record<Union, Meta>` table (lines 73-86) and its accessor (207-210, shown above):
```ts
export interface StatusMeta { glyph: string; text: string; textClass: string }
const STATUS_META: Record<Phase["status"], StatusMeta> = {
  pending: { glyph: "○", text: "Locked", textClass: "text-panel-muted-foreground" },
  done:    { glyph: "✓", text: "Complete", textClass: "text-[hsl(var(--panel-status-done))]" },
  failed:  { glyph: "✕", text: "Failed", textClass: "text-[hsl(0_80%_80%)]" },
  ...
}
```
Five rows (D-20a): ✓ supported · ◐ partly · ○ not supported · ✕ contradicted · ? couldn't check, each with a fixed one-line reason (decision engines return no text). Use the AA tokens from `ConfidenceChip.tsx:46-55` (`--panel-status-done` green, `--panel-status-active` amber, `hsl(0_80%_80%)` red). Unknown verdict → the `couldnt_check` row (the own-property guard).

---

### `frontend/src/components/chat/CitationCheckAction.tsx` (component) — Plan 05

**Analogs:** `CitationList.tsx`'s trigger row (lines 52-56) for placement, and `ConfidenceChip.tsx` for the count pills and confidence (glyph aria-hidden + WORD + raw `toFixed(2)`, never colour alone, lines 93-101):
```tsx
<span data-testid="confidence-chip" data-state="high" className={cn(BASE_CLASSES, SCORED_VARIANTS.high)}>
  <CheckCircle2 aria-hidden="true" className="w-3 h-3" />
  <span className="tabular-nums">High · {raw}</span>
</span>
```
⚠ It must be a **sibling** of the `CollapsibleTrigger asChild <button>` (no nested buttons) and visible while folded.

---

### `frontend/src/components/chat/CitedMarkdown.tsx` (component) — Plan 05

**Analog:** itself. Two touches: an optional `checkMessageId?` prop on `Props` (lines 46-50), and an ordinal attribute plus verdict decoration **inside the existing `useLayoutEffect`** (lines 122-165), because that effect owns `innerHTML` (the comment at :262-267 explains why).

**Marker factory to extend** (lines 69-79). Add `data-citation-ordinal`, and after a check, a verdict class and glyph. The aria-label gains the verdict word:
```ts
function createMarker(n: number, citation: Citation, staggerIndex: number): HTMLElement {
  const sup = document.createElement("sup")
  sup.className = "citation-marker citation-marker--attach"
  sup.setAttribute(CITATION_MARKER_ATTR, String(n))
  sup.setAttribute("role", "button")
  sup.setAttribute("tabindex", "0")
  sup.setAttribute("aria-label", `Citation ${n}: ${citation.filename}`)
  sup.textContent = String(n)
  sup.style.animationDelay = `${staggerIndex * STAGGER_MS}ms`
  return sup
}
```
**The ordinal source** is the existing `staggerIndex++` at line 155 (it counts upgraded in-range markers in text-node order, skipping `code` / `pre` / `a` via `isInSkippedAncestor` :58-66). Decorate only when the claim's `n` equals the marker's `n` (Pitfall 7). Read the verdicts through a ref (the `citationsRef` idiom, :89-90) so a verdict arrival does not tear down the listeners. The `CitationPeek` mount (:272-291) passes the optional `verdict`.

---

### `frontend/src/components/chat/CitationList.tsx` (component) — Plan 05

**Analog:** itself. Add one optional prop next to `flashContainer` (lines 24-29 docblock style), and **one** mount of `CitationCheckAction` beside the trigger at lines 52-56:
```tsx
<CollapsibleTrigger asChild>
  <button aria-expanded={open}>
    <FoldTrigger open={open} label={`References · ${count} source${count !== 1 ? "s" : ""}`} />
  </button>
</CollapsibleTrigger>
```
⚠ The label sentence is pinned by Phase 153 tests (comment :45-51). Do not change it. `defaultOpen = false` stays (224-05, the struck contract at :9-23).

---

### `frontend/src/components/chat/CitationPeek.tsx` (component) — Plan 05

**Analog:** itself. Add an optional `verdict?` to `CitationPeekProps` (lines 48-61), and render one section between the body (:159-167) and the footer (:169-183), reusing the body's text classes (`mt-1.5 text-xs ... text-muted-foreground`). When `verdict` is absent, the rendered DOM is unchanged (the existing peek tests stay green).

---

### `frontend/src/components/chat/MessageItem.tsx` (component, HOT) — Plan 05

**Analog:** itself. The ledger invariants are `useState` 3, `useEffect` 0, Props 5. The touch is two prop additions on existing mounts, with no new branch:
```tsx
// line 742
<CitedMarkdown content={dedupParagraphs(message.content)} citations={message.citations} />
// lines 758-760
{message.citations && message.citations.length > 0 && (
  <CitationList
    citations={message.citations}
```
Both gain `checkMessageId={!isStreaming && !message.id.startsWith("temp-") ? message.id : undefined}` (the settled guard is from RESEARCH §5 / `StreamsProvider.tsx:390`).

---

## Shared Patterns

### Blocking I/O off the event loop (D-v2.5-01)
**Source:** `retrieval_service.py:165-168` (`await run_in_threadpool(rerank, ...)`); `backend/app/utils/db.py:71-83` (`aexec`).
**Apply to:** the rerank call (already threadpooled; the Jev `ThreadPoolExecutor` fan-out runs *inside* that worker thread, with each task under `contextvars.copy_context()`), and every supabase-py read in `api/citation_checks.py`. The citation check's engine calls run in `run_in_threadpool`, or use `httpx.AsyncClient`.

### Fail to the current state, never to a fabricated pass
**Source:** `rerank_service.py:76-78` (to be corrected to `[:n]`); `workflow_run_evidence._optional` :215-221; `recall_eval.RecallUnmeasurable` :138-144.
**Apply to:** every engine adapter (rerank → `documents[:n]`), citation check (→ `couldnt_check`), measurement (→ refuse, non-zero exit, no report).

### Secret custody (SC#6)
**Source:** `models/user_settings.py:176-182` (`LLMProvider.api_key  # real key -- never sent to frontend`); `api/settings.py:402` (`rerank_has_api_key=bool(...)`); `recall_eval.describe_dsn` :151-164.
**Apply to:** Jev reads `providers['openrouter'].api_key`, OpenAI reads `providers['openai'].api_key`, and with `user_settings=None` both fall back to `settings.*_api_key`. Keys never go into a log line, a traced argument (`redact_inputs`), an exception message or a response body.

### Patch-where-used + conditional kwargs (fixed-signature fakes)
**Source:** `retrieval_service.py:51-52` comment; `search_documents_tool.py:1153-1154` docblock.
**Apply to:** all new kwargs (`instruction`, `keep_documents`). Pass them only when non-empty. New tests patch `app.services.retrieval_rpc.*`, never `retrieval_service.*`.

### Wire contract pinned from both stacks
**Source:** `frontend/src/components/chat/__tests__/artifactParity.fence.test.ts:13-46` (`?raw` of a backend `.py` and of a backend JSON fixture); fixture home `backend/tests/unit/fixtures/artifact_record_v1.json`.
**Apply to:** engine ids (`registry.py` ↔ `rerankEngines.ts`), verdict labels (`models/citation_check.py` ↔ `citationVerdicts.ts`), claim ordinals (`citationOrdinals.json`), and the citation-check result shape.

### Hot-file discipline (G-5)
**Source:** `docs/HOT-FILE-LEDGER.md`; the CLAUDE.md ledger rows for `retrieval_service.py`, `openai_service.py`, `api/settings.py`, `SettingsPage.tsx`, `MessageItem.tsx`, `main.py`, `full-schema-supplement.sql`.
**Apply to:** each hot file gets the minimal touch named above, and the engine logic lives in `rerank_engines/`. Rows needed at planning: `rerank_service.py`, `CitationList.tsx`, `CitedMarkdown.tsx`, `CitationPeek.tsx`, every new module, and an update to `search_documents_tool.py` (crosses to 3 phases). Run `node scripts/check-hot-file-ledger.cjs 294`.

---

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `rerank_engines/jev.py`, `openai_decisions.py` (the decision-API bodies, batching, refusal parsing) | service adapter | HTTP fan-out | No decision-API client exists. The HTTP skeleton comes from `_rerank_api`; request and response shapes, batch limits and timeouts come from RESEARCH §1-2 (vendor-cited). |
| `rerank_engines/tracing.py` (`process_inputs`) | utility | transform | No `process_inputs` use in the repo. Body from RESEARCH "Code Examples" (driven against langsmith 0.2.3). |
| `citationCheckStore.ensure()` microtask batching | store | batched GET | No batched-fetch store exists. Use RESEARCH §5. |
| `backend/tests/fixtures/decision_heldout_v1.json` | fixture | static | Note: `backend/tests/fixtures/` holds only subdirectories (`extraction`, `phase267`, ...), while JSON wire fixtures live in `backend/tests/unit/fixtures/`. The planner should pick one home and record it with the sha256. |

## Metadata

**Analog search scope:** `backend/app/services`, `backend/app/api`, `backend/app/db`, `backend/app/models`, `backend/app/utils`, `backend/tests/unit`, `supabase/migrations`, `scripts/`, `frontend/src/{components/chat,components/settings,components/panel,components/metadata,stores,lib/api,pages}`
**Files read:** 30 (targeted ranges for files over 300 lines)
**Pattern extraction date:** 2026-10-20
