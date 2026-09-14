import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client

from app.config import (
    MODEL_CAPABILITIES,
    _infer_provider_for,
    _SELF_HOSTED_PROVIDERS,
    normalize_self_hosted_base_url,
)
from app.dependencies import get_current_user, get_supabase, require_visible
from app.models.user_settings import (
    HNSW_EF_SEARCH_CEILING,
    HNSW_EF_SEARCH_FLOOR,
    HNSW_ITERATIVE_SCAN_VALUES,
    KEY_PLACEHOLDER,
    KNOWN_PROVIDERS,
    SOURCE_MAX_FILE_SIZE_MB_CEILING,
    SOURCE_MAX_FILE_SIZE_MB_FLOOR,
    load_app_settings,
    load_app_settings_async,
    save_app_settings,
    resolve_sub_agent_model,
)
from app.services.retrieval_tuning import app_settings_has_hnsw_columns
from app.services.audit_service import write_audit_entry
from app.services.reembed_service import start_reembed
from app.services.skill_tuner_service import resolve_skill_builder_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

# Phase 242 (D-242-03) — the settings columns `_range_refusal_detail` is allowed to read back.
# ⛔ An ALLOW-LIST rather than a bare `getattr`: the settings object also carries ten provider API
#    keys and the Supabase management token, and this function's return value goes straight into an
#    HTTP 400 body. Keep it in step with the numeric bounds in `update_settings` — and note that
#    `backend/tests/unit/test_242_stored_value_refusal.py` already asserts that EVERY bound the
#    `ast` detector finds routes through this helper, so adding a bound without updating both reds.
_BOUNDED_SETTINGS_FIELDS = frozenset(
    {
        "multimodal_max_vision_calls",
        "vision_max_pages",
        "source_max_file_size_mb",
        "hnsw_ef_search",
    }
)

# ── Phase 163 (TEN-02 / D-03 / D-05) — settings client policy ─────────────────
# These handlers KEEP the hardened service-role client (classified carve-out, marked
# ``# service-role:`` at each Depends) — this is APP-LEVEL / operator config, not per-user
# request data:
#   * ``app_settings`` has RLS DISABLED (a global singleton config table — verified live on
#     :54322); the settings read/write flows through ``load_app_settings_async`` /
#     ``save_app_settings`` (their own ``get_pg_pool()`` access), NOT the injected client.
#   * The injected ``supabase`` here only drives (a) the ``write_audit_entry`` BackgroundTask
#     (audit_log — INSERT-only authenticated policy, a detached writer) and (b) the RE-EMBED
#     subsystem (``start_reembed`` / ``reembed_progress`` in reembed_service.py) — the re-embed
#     ASYNC WRITER is explicitly widened with org_id in plan 09 (D-05), so its request surface
#     stays service-role here to keep that boundary clean.
# ``GET /settings/providers`` (the Run-carve-out chat-picker feed) injects no client at all.


# ── Response models ───────────────────────────────────────────────────────────

class ProviderInfo(BaseModel):
    id: str
    name: str
    base_url: str
    has_key: bool
    is_active: bool
    models: list[str]


class FullSettingsResponse(BaseModel):
    # LLM
    active_provider: str
    llm_model: str
    available_models: list[str]
    providers: list[ProviderInfo]
    # Embedding
    embedding_model: str
    embedding_base_url: str
    embedding_dimensions: int
    embedding_has_api_key: bool
    # Phase 111.1 — the stored provider the picker reads to show the current selection.
    embedding_provider: str
    extraction_provider: str
    extraction_model: str
    # Reranking
    rerank_enabled: bool
    rerank_provider: str
    rerank_model: str
    rerank_top_n: int
    rerank_has_api_key: bool
    # Multimodal (SEED-227) — migration 044's column, reachable from the product at last.
    # It had a DB column, a loader and a live reader in multimodal_service, and NO route
    # to any surface: `api:0 ui:0` when measured 2026-08-28.
    multimodal_max_vision_calls: int
    # SEED-226 — the vision model was a HARDCODED CONSTANT and the fallback that was
    # supposed to reach the active chat model was dead code. Empty => active chat model.
    vision_model: str
    vision_max_pages: int
    # SEED-258 — the source file ceiling, plus the bounds the UI must state rather than
    # re-type. ⛔ The bounds are SERVED, never hardcoded in the form: a form carrying its own
    # copy of `50` is a fourth private constant, which is the defect this replaced.
    source_max_file_size_mb: int
    source_max_file_size_mb_floor: int
    source_max_file_size_mb_ceiling: int
    # Retrieval
    retrieval_top_k: int
    retrieval_match_threshold: float
    hybrid_search_enabled: bool
    hybrid_candidate_count: int
    vector_search_weight: float
    keyword_search_weight: float
    rrf_k: int
    # Phase 241 (QUEUE-06 / D-09) — the two HNSW scan knobs, plus the bounds and the enum
    # members the UI must STATE rather than re-type. ⛔ Same rule as SEED-258 above: a form
    # carrying its own copy of `1000`, or its own list of the three modes, is a second private
    # constant that can drift from the database's CHECK without anything noticing.
    hnsw_ef_search: int
    hnsw_iterative_scan: str
    hnsw_ef_search_floor: int
    hnsw_ef_search_ceiling: int
    hnsw_iterative_scan_values: list[str]
    # Web search
    web_search_enabled: bool
    web_search_has_api_key: bool
    web_search_max_results: int
    # Sandbox
    sandbox_enabled: bool
    # Phase 147 (FLAG-01, migration 097) — operator control-plane kill-switches, exposed
    # on the EXISTING settings read contract (no new endpoint) so the Control Plane
    # capability grid has a flag-read source, consistent with the two capability booleans
    # (web_search_enabled / sandbox_enabled) already served here. GET /settings serves
    # them to any authed user; the operator WRITE path lands on /admin/flags in a later plan.
    self_improve_enabled: bool
    workflows_enabled: bool
    maintenance_mode: bool
    # Phase 159 (MODEL-03 / D-159-04) — the persisted discovery-panel utility-filter default,
    # surfaced on the SAME settings read contract so the Control Room shell can read the operator's
    # "filter on by default" preference (ControlRoomPage `capabilityFlags` idiom). GET /settings
    # serves it; the operator WRITE rides the shipped PUT /admin/flags path (Plan 02).
    model_discovery_filter_enabled: bool
    # Context & Sub-agent
    context_window_max_tokens: int
    sub_agent_max_output_tokens: int
    sub_agent_model: str
    resolved_sub_agent_model: str
    # Phase 123 (D-08 / TRIG-01) — the skill-builder model for the Trigger Tuner.
    # The raw setting ("" => unset) + the RESOLVED label (resolve_skill_builder_model:
    # explicit -> strong forced_emission default -> None). A model id is a VALUE not a
    # secret -> surfaced through the settings contract (CLAUDE.md). The Settings UI
    # (Plan 06) reads `skill_builder_model` to show the current selection and the
    # resolved label as the strong default when unset.
    skill_builder_model: str
    resolved_skill_builder_model: str | None
    # Phase 137.1-05 (EVAL-05f / D-11) — the ONE shared harness judge model, surfaced
    # raw ("" when unset) + resolved. This is the SAME harness_judge_model that already
    # drives BOTH the eval judge and the harness/publish judge via resolve_judge_model
    # (validator_kinds.py:58 — the ONE source of truth, D-11). NO new setting, NO
    # migration, NO split. The resolved label surfaces the effective default
    # (claude-opus-4-8) so a single-provider / local-model org can see what the judge
    # will use before picking one (the picker lands in Plan 10). A model id is a VALUE
    # not a secret -> exposed through the settings contract (CLAUDE.md).
    harness_judge_model: str
    resolved_harness_judge_model: str | None
    # Phase 075.3 D-075.3-13: registry-known model_ids (frontend uses this set
    # to decide whether to render the "unverified" badge inline next to each
    # model in the main LLM dropdown + selected-label).
    verified_models: list[str]
    # Phase 075.3 D-075.3-13 + D-075.3-12: per-unknown-model inferred provider
    # mapping (frontend reads this to substitute {provider} in the tooltip text
    # without mirroring the inference table client-side — RESEARCH.md §6
    # Approach b, zero-drift over Approach a's 5-pattern client mirror).
    inferred_provider_for: dict[str, str]
    # Phase 149 (MODEL-01 / D-149-05): the enabled models an operator has flagged
    # deprecated (model_capabilities_overrides.deprecated). The picker reads this to
    # light the informational "deprecated" badge — deprecated ≠ disabled, the model
    # stays selectable (only `enabled` controls availability). Sorted for stable diffs.
    deprecated_models: list[str]


def _verified_model_ids(overrides: dict[str, dict]) -> list[str]:
    """Every model id the platform considers REGISTERED — built-in OR operator-entered.

    ⚠ Phase 249 (MODEL-05). This was ``sorted(MODEL_CAPABILITIES.keys())`` — BUILT-INS ONLY — and
    that made MODEL-04's success light MODEL-05's warning: a model added through the Model
    Registry UI lands in ``model_capabilities_overrides`` and resolves
    ``capability_source="db_override"``, i.e. THE OPERATOR TYPED ITS CAPABILITIES. Calling such a
    model "not in our verified registry" is the opposite of the truth.

    ⛔ ONE helper, TWO callers (``GET /settings`` and ``GET /settings/providers``). Two surfaces
    answering the same question about the same model must not be able to disagree — that is the
    whole shape of the defect this phase exists to close.
    """
    return sorted(set(MODEL_CAPABILITIES) | set(overrides))


# ── Request models ────────────────────────────────────────────────────────────

class ProviderUpdate(BaseModel):
    id: str
    api_key: str = KEY_PLACEHOLDER   # "***" = keep existing; "" = clear; real = save
    models: list[str] = []
    base_url: str = ""               # only relevant for ollama


class SettingsUpdate(BaseModel):
    active_provider: str | None = None
    llm_model: str | None = None
    providers: list[ProviderUpdate] = []
    # Embedding
    embedding_model: str | None = None
    embedding_api_key: str | None = None   # "***" = keep; "" = clear; real = save
    embedding_base_url: str | None = None
    embedding_dimensions: int | None = None
    # Phase 111.1 — configurable / multi-provider embeddings (migration 073).
    embedding_provider: str | None = None      # D-06 explicit embedding provider
    extraction_provider: str | None = None     # D-09 #1 explicit extraction provider
    extraction_model: str | None = None         # the operator's selected extraction model (was silently dropped — verify-work 111.1)
    confidence_bucket_high: float | None = None    # D-12 portable confidence bucket
    confidence_bucket_medium: float | None = None  # D-12 portable confidence bucket
    # Reranking
    rerank_enabled: bool | None = None
    rerank_provider: str | None = None
    rerank_api_key: str | None = None      # "***" = keep; "" = clear; real = save
    rerank_model: str | None = None
    rerank_top_n: int | None = None
    # Multimodal (SEED-227)
    multimodal_max_vision_calls: int | None = None
    vision_model: str | None = None          # SEED-226; "" clears it back to the chat model
    vision_max_pages: int | None = None
    # SEED-258 — the source file ceiling. ONE knob; the MCP envelope cap is DERIVED from it
    # server-side and is deliberately NOT a field here.
    source_max_file_size_mb: int | None = None
    # Retrieval
    retrieval_top_k: int | None = None
    retrieval_match_threshold: float | None = None
    hybrid_search_enabled: bool | None = None
    hybrid_candidate_count: int | None = None
    vector_search_weight: float | None = None
    keyword_search_weight: float | None = None
    rrf_k: int | None = None
    # Phase 241 (QUEUE-06 / D-09) — the two HNSW scan knobs. ⛔ There is no `_floor` /
    # `_ceiling` here and there must never be: the bounds are the SERVER's, read-only on the
    # response. ⛔ Nor are `hnsw_max_scan_tuples` / `hnsw_scan_mem_multiplier` here — they are
    # hardcoded in config.py because a wrong value is a memory footgun (T-241-16).
    hnsw_ef_search: int | None = None
    hnsw_iterative_scan: str | None = None
    # Web search
    tavily_api_key: str | None = None      # "***" = keep; "" = clear; real = save
    web_search_max_results: int | None = None
    web_search_enabled: bool | None = None
    # Sandbox
    sandbox_enabled: bool | None = None
    # Context & Sub-agent
    context_window_max_tokens: int | None = None
    sub_agent_max_output_tokens: int | None = Field(default=None, ge=4096, le=65536)
    sub_agent_model: str | None = None
    # Phase 123 (D-08 / TRIG-01) — the skill-builder model id. A VALUE not a secret;
    # selectable across the FULL provider list incl. local (no paid-provider SPOF).
    # "" = unset (the resolver falls back to a strong default); decoupled from the
    # benchmark targets (the builder WRITES candidates, the targets MEASURE firing).
    skill_builder_model: str | None = None
    # Phase 137.1-05 (EVAL-05f / D-11 / D-12) — the shared harness judge model id. The
    # SAME setting the eval judge + publish judge already resolve (no new setting, no
    # migration). Registry-validated on persist (D-12): only a MODEL_CAPABILITIES-known
    # model is accepted (an unknown/inferred id 400s), so the shared judge can never be
    # pointed at an unroutable model. "" = unset (the resolver falls back to the
    # effective default — claude-opus-4-8).
    harness_judge_model: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _build_response(s=None) -> FullSettingsResponse:
    if s is None:
        s = await load_app_settings_async()
    # Phase 137.1-05 (D-11) — the ONE judge resolver, shared by the eval judge AND the
    # publish judge. Function-local import keeps the harness validators registry off the
    # settings module-load path; NEVER introduce a second resolver (T-137.1-J2).
    from app.services.harness.validator_kinds import resolve_judge_model
    # Phase 149 (MODEL-01 / D-149-05) — the enabled deprecated models for the picker badge.
    # Reads the enabled-only hot cache (deprecated ≠ disabled — a deprecated model stays
    # enabled); _load_model_overrides never raises (returns the stale/empty cache on a blip).
    from app.models.user_settings import _load_model_overrides, load_all_model_overrides
    _overrides = await _load_model_overrides()
    deprecated_models = sorted(mid for mid, cap in _overrides.items() if cap.get("deprecated"))
    # Phase 249 (MODEL-05) — the verified UNION reads ALL override rows, not the enabled-only hot
    # cache above. ⚠ The distinction is load-bearing: a model the operator added and then DISABLED
    # is still REGISTERED (they typed its capabilities), so sourcing the union from the
    # enabled-only cache would report it "unverified" the moment it was hidden from the picker.
    # Both reads are fail-soft and cached; neither raises.
    _all_overrides = await load_all_model_overrides()
    _verified_set = set(_verified_model_ids(_all_overrides))
    return FullSettingsResponse(
        active_provider=s.active_provider,
        llm_model=s.llm_model,
        available_models=s.available_models,
        providers=[
            ProviderInfo(
                id=p.id,
                name=p.name,
                base_url=p.base_url,
                has_key=bool(p.api_key and p.api_key != "ollama"),
                is_active=p.is_active,
                models=p.models,
            )
            for p in s.providers
        ],
        embedding_model=s.embedding_model,
        embedding_base_url=s.embedding_base_url,
        embedding_dimensions=s.embedding_dimensions,
        embedding_has_api_key=bool(s.embedding_api_key),
        # Phase 111.1 — surface the stored provider so the picker can read it back.
        embedding_provider=s.embedding_provider,
        extraction_provider=s.extraction_provider,
        extraction_model=s.extraction_model,
        rerank_enabled=s.rerank_enabled,
        rerank_provider=s.rerank_provider,
        rerank_model=s.rerank_model,
        rerank_top_n=s.rerank_top_n,
        rerank_has_api_key=bool(s.rerank_api_key),
        multimodal_max_vision_calls=s.multimodal_max_vision_calls,
        vision_model=s.vision_model,
        vision_max_pages=s.vision_max_pages,
        # SEED-258. The bounds ride along so the form can state them without owning them.
        source_max_file_size_mb=s.source_max_file_size_mb,
        source_max_file_size_mb_floor=SOURCE_MAX_FILE_SIZE_MB_FLOOR,
        source_max_file_size_mb_ceiling=SOURCE_MAX_FILE_SIZE_MB_CEILING,
        retrieval_top_k=s.retrieval_top_k,
        retrieval_match_threshold=s.retrieval_match_threshold,
        hybrid_search_enabled=s.hybrid_search_enabled,
        hybrid_candidate_count=s.hybrid_candidate_count,
        vector_search_weight=s.vector_search_weight,
        keyword_search_weight=s.keyword_search_weight,
        rrf_k=s.rrf_k,
        # Phase 241 — the knobs, and the bounds that ride along so the form owns no copy.
        hnsw_ef_search=s.hnsw_ef_search,
        hnsw_iterative_scan=s.hnsw_iterative_scan,
        hnsw_ef_search_floor=HNSW_EF_SEARCH_FLOOR,
        hnsw_ef_search_ceiling=HNSW_EF_SEARCH_CEILING,
        hnsw_iterative_scan_values=list(HNSW_ITERATIVE_SCAN_VALUES),
        web_search_enabled=s.web_search_enabled,
        web_search_has_api_key=bool(s.tavily_api_key),
        web_search_max_results=s.web_search_max_results,
        sandbox_enabled=s.sandbox_enabled,
        # Phase 147 (FLAG-01) — the three operator kill-switches from the effective settings.
        self_improve_enabled=s.self_improve_enabled,
        workflows_enabled=s.workflows_enabled,
        maintenance_mode=s.maintenance_mode,
        # Phase 159 (MODEL-03 / D-159-04) — the persisted discovery-filter default (default-ON).
        model_discovery_filter_enabled=s.model_discovery_filter_enabled,
        context_window_max_tokens=s.context_window_max_tokens,
        sub_agent_max_output_tokens=s.sub_agent_max_output_tokens,
        sub_agent_model=s.sub_agent_model,
        resolved_sub_agent_model=resolve_sub_agent_model(s),
        # Phase 123 (D-08) — the raw knob + the resolved label (strong default when unset).
        # Phase 123 (D-08) — the raw knob + the resolved label (strong default when unset).
        skill_builder_model=s.skill_builder_model,
        resolved_skill_builder_model=resolve_skill_builder_model(s),
        # Phase 137.1-05 (EVAL-05f / D-11) — the shared judge knob + its resolved label.
        # resolve_judge_model is the ONE source of truth (eval + publish judge); the raw
        # value is "" when unset and the resolved label surfaces the effective default.
        # Phase 137.1-05 (EVAL-05f / D-11) — the shared judge knob + its resolved label.
        # resolve_judge_model is the ONE source of truth (eval + publish judge); the raw
        # value is "" when unset and the resolved label surfaces the effective default.
        harness_judge_model=s.harness_judge_model,
        resolved_harness_judge_model=resolve_judge_model(s),
        # Phase 075.3 D-075.3-13: snapshot of registry-known model_ids
        # (sorted for stable client diffs / test assertions).
        # Phase 249 (MODEL-05): the UNION — built-ins PLUS operator-entered override rows.
        verified_models=sorted(_verified_set),
        # Phase 075.3 D-075.3-13 + D-075.3-12: build the inferred-provider map
        # only for model_ids the user has configured (via providers[*].models)
        # that are NOT in the registry. Keeps the payload small (one entry per
        # unknown). Iterates providers[*].models because that's the canonical
        # source of truth for the Settings dropdown surface.
        inferred_provider_for={
            m: _infer_provider_for(m)
            for p in s.providers
            for m in p.models
            # Phase 249: keyed off the UNION, so an operator-added model has no inferred
            # provider and therefore nothing for the chip to render.
            if m and m not in _verified_set
        },
        # Phase 149 (MODEL-01 / D-149-05) — enabled deprecated models for the badge.
        deprecated_models=deprecated_models,
    )


def _validate_confidence_buckets(high: float | None, medium: float | None) -> None:
    """Phase 111.1 V5 — clamp/coherence guard for the confidence buckets (D-12).

    Each bucket, when supplied, must be inside [0.0, 1.0]; when BOTH are supplied
    they must keep a coherent order (medium <= high). An incoherent pair is a
    tampering vector (T-111.1-01-01) — reject with a 422 rather than silently
    storing thresholds that make every result grade 'low'/'high' nonsensically.
    """
    for name, val in (("confidence_bucket_high", high), ("confidence_bucket_medium", medium)):
        if val is not None and not (0.0 <= val <= 1.0):
            raise HTTPException(
                status_code=422,
                detail=f"{name} must be within [0.0, 1.0] (got {val}).",
            )
    if high is not None and medium is not None and medium > high:
        raise HTTPException(
            status_code=422,
            detail=(
                f"confidence_bucket_medium ({medium}) must be <= confidence_bucket_high "
                f"({high}) — incoherent bucket order."
            ),
        )


async def _range_refusal_detail(
    *,
    field: str,
    label: str,
    submitted,
    lo,
    hi,
    typed_detail: str,
) -> str:
    """Phase 242 (D-242-03) — when the value being refused is the one ALREADY STORED, say so.

    ⛔ WHY THIS EXISTS. Every bound below refuses with a sentence that is truthful about the RULE
    and silent about the CAUSE. The operator's install held `multimodal_max_vision_calls = 1001` —
    a value they never typed — and the Search tab sent all 24 of its fields on every save, so that
    sentence appeared while they were editing a retrieval threshold, naming a field on a card they
    had not opened. It reads as a rejection of what they just typed. It was not.

    ⚠ D-242-02 (changed-fields-only) makes the untouched-field path unreachable FROM THE UI — it
    does not make it unreachable. The operator can edit the offending field itself, and any other
    client can send the stored value back. So the sentence is still owed.

    ⛔ THIS MUST NEVER TURN A 400 INTO A 500. The nicer sentence needs a settings read and a
    settings read can fail (pool blip, connection reset, a settings object predating the column).
    Every failure falls back to `typed_detail`, which is the sentence that ships today and carries
    what the bound BUYS. A nicer error message that can crash is worse than a blunt one.

    ⭐ ONE HELPER, FOUR SITES. SC#3's "the general fix, not the specific one" applies to the
    sentence as much as to the CHECK constraint.
    """
    # ⛔ ALLOW-LIST, not a bare getattr (code review WR-04). The settings object carries every
    #    provider API key and the Supabase management token; `getattr` on a caller-supplied name
    #    would put one of those into an HTTP 400 body the moment a future site passed the wrong
    #    string. `field` is a literal at all four call sites today — the allow-list is what keeps
    #    that true rather than hoping it stays true. An unknown name falls back silently.
    if field not in _BOUNDED_SETTINGS_FIELDS:
        logger.warning(
            "_range_refusal_detail called with an unknown field %r — falling back to the typed "
            "sentence. Add it to _BOUNDED_SETTINGS_FIELDS if it is a real bounded column.",
            field,
        )
        return typed_detail
    try:
        stored = getattr(await load_app_settings_async(), field, None)
    except Exception:  # noqa: BLE001 — any read failure falls back; see the docstring
        # ⚠ LOGGED, not swallowed (code review WR-05). The fallback is correct behaviour, but a
        #   settings read failing here means the same read is failing elsewhere, and a refusal path
        #   that hides that makes the real fault harder to find than the message it improves.
        logger.warning(
            "_range_refusal_detail: settings read failed for %s; using the typed sentence",
            field,
            exc_info=True,
        )
        stored = None
    if stored is not None and stored == submitted:
        return (
            f"'{label}' was already set to {stored}, which is outside the allowed range of "
            f"{lo}–{hi}. That is what is blocking this save — nothing you just changed "
            f"is at fault. Set it to a value between {lo} and {hi} to save this tab."
        )
    return typed_detail


# ── Routes ────────────────────────────────────────────────────────────────────

# Phase 148 (VIS-01) — the model-registry / Settings surface is an Operators-only governed
# feature (model_management). Gate PER-ENDPOINT (NEVER at the router level) so the Run carve-out
# GET /settings/providers below stays ungated (Pitfall 3 — router-gating would 403 the chat model
# picker). require_visible is a no-op for operators + Everyone-audience features; 403 (D-03) else.
@router.get(
    "",
    response_model=FullSettingsResponse,
    dependencies=[Depends(require_visible("model_management"))],
)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return await _build_response()


@router.put(
    "",
    response_model=FullSettingsResponse,
    dependencies=[Depends(require_visible("model_management"))],  # Phase 148 (VIS-01) — model_management gate
)
async def update_settings(
    body: SettingsUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),  # service-role: app-level settings (app_settings RLS-off) + audit/re-embed writers (plan 09)
):
    updates: dict = {}

    if body.active_provider is not None:
        updates["llm_provider"] = body.active_provider
    if body.llm_model is not None:
        updates["llm_model"] = body.llm_model

    # D-17: Store provider model lists as JSONB dict instead of individual CSV keys
    provider_model_lists: dict[str, list[str]] = {}
    for p in body.providers:
        # Phase 150 (CR-01, defense-in-depth): p.id is client input that becomes the raw
        # column name f"{p.id}_api_key" downstream. Reject any unknown provider id at the
        # boundary with 422 so a crafted id never reaches save_app_settings (whose own
        # _VALID_COLUMN_NAME guard is the load-bearing fix). KNOWN_PROVIDERS is the same
        # code-owned set GET /settings builds the provider list from.
        if p.id not in KNOWN_PROVIDERS:
            raise HTTPException(status_code=422, detail=f"Unknown provider: {p.id}")
        updates[f"{p.id}_api_key"] = p.api_key  # save_app_settings handles "***" skip
        if p.models:
            provider_model_lists[p.id] = p.models  # list, not CSV
        # SEED-173 — persist the base_url for EVERY self-hosted provider, not just ollama.
        # ⚠ This condition read `p.id == "ollama"` until migration 180, which is why a base
        # URL typed on the LM Studio card was accepted by the API, dropped on the floor, and
        # answered with 200 + "Saved". normalize_self_hosted_base_url owns the /v1 rule and is
        # the exact inverse of the resolve_ helper the loader uses -- keep them paired, or a
        # save round-trips http://host/v1 -> stored as-is -> /v1/v1 on the next load.
        if p.id in _SELF_HOSTED_PROVIDERS and p.base_url is not None:
            updates[str(_SELF_HOSTED_PROVIDERS[p.id]["url_field"])] = (
                normalize_self_hosted_base_url(p.id, p.base_url)
            )
    if provider_model_lists:
        updates["provider_model_lists"] = provider_model_lists  # JSONB column

    if body.embedding_model is not None:
        updates["embedding_model"] = body.embedding_model
    if body.embedding_api_key is not None:
        updates["embedding_api_key"] = body.embedding_api_key
    if body.embedding_base_url is not None:
        updates["embedding_base_url"] = body.embedding_base_url
    if body.embedding_dimensions is not None:
        updates["embedding_dimensions"] = body.embedding_dimensions

    # Phase 111.1 — configurable / multi-provider embeddings (migration 073).
    # V5: validate the confidence buckets BEFORE building updates so an incoherent
    # pair (medium > high) or an out-of-range value is rejected with a 422.
    _validate_confidence_buckets(body.confidence_bucket_high, body.confidence_bucket_medium)
    if body.embedding_provider is not None:
        updates["embedding_provider"] = body.embedding_provider
    if body.extraction_provider is not None:
        updates["extraction_provider"] = body.extraction_provider
    if body.extraction_model is not None:
        updates["extraction_model"] = body.extraction_model
    if body.confidence_bucket_high is not None:
        updates["confidence_bucket_high"] = body.confidence_bucket_high
    if body.confidence_bucket_medium is not None:
        updates["confidence_bucket_medium"] = body.confidence_bucket_medium

    if body.rerank_enabled is not None:
        updates["rerank_enabled"] = body.rerank_enabled
    if body.rerank_provider is not None:
        updates["rerank_provider"] = body.rerank_provider
    if body.rerank_api_key is not None:
        updates["rerank_api_key"] = body.rerank_api_key
    if body.rerank_model is not None:
        updates["rerank_model"] = body.rerank_model
    if body.rerank_top_n is not None:
        updates["rerank_top_n"] = body.rerank_top_n

    # SEED-227 — the per-document ceiling on paid vision calls. BOUNDED ON WRITE, because
    # the two ends fail in opposite and equally silent ways: 0 disables image description
    # for the whole install while every ingestion still reports success, and an unbounded
    # value turns one upload into an unbounded spend. Neither end announces itself, so the
    # refusal is the only thing that can.
    if body.multimodal_max_vision_calls is not None:
        if not 1 <= body.multimodal_max_vision_calls <= 1000:
            raise HTTPException(
                status_code=400,
                detail=await _range_refusal_detail(
                    field="multimodal_max_vision_calls",
                    label="Images read per document",
                    submitted=body.multimodal_max_vision_calls,
                    lo=1,
                    hi=1000,
                    typed_detail=(
                        "Images read per document must be between 1 and 1000. "
                        "0 would silently stop every image from being read."
                    ),
                ),
            )
        updates["multimodal_max_vision_calls"] = body.multimodal_max_vision_calls

    # SEED-226 — the vision model, and the per-document page ceiling on transcription.
    #
    # ⚠ EMPTY IS A REAL, MEANINGFUL VALUE HERE and is stored as such: it means "use the active
    #   chat model", which is by definition one the operator has credentials for. That is the
    #   whole point of the fix — the previous behaviour pinned `gpt-4o-mini` in code, so an
    #   install with no OpenAI key made vision calls it could never complete.
    if body.vision_model is not None:
        updates["vision_model"] = body.vision_model.strip()

    # ⚠ BOUNDED ON WRITE for the same reason as the cap above, but the failure is worse: this
    #   one silently SHORTENS documents. 0 would transcribe nothing while every ingestion still
    #   reported success, and an unbounded value turns one 1,000-page scan into 1,000 paid
    #   calls. A truncated document does say so in every chunk header — but a refusal here is
    #   cheaper than a library full of 5% documents.
    if body.vision_max_pages is not None:
        if not 1 <= body.vision_max_pages <= 500:
            raise HTTPException(
                status_code=400,
                detail=await _range_refusal_detail(
                    field="vision_max_pages",
                    label="Pages read per document",
                    submitted=body.vision_max_pages,
                    lo=1,
                    hi=500,
                    typed_detail=(
                        "Pages read per document must be between 1 and 500. "
                        "0 would silently stop every scanned page from being read."
                    ),
                ),
            )
        updates["vision_max_pages"] = body.vision_max_pages

    # SEED-258 — the file ceiling every connected source refuses at.
    #
    # ⚠ THE API IS THE BOUNDARY, NOT THE FORM. A number input with min/max is a convenience
    #   for someone who is not attacking anything; a PATCH carrying 999999999 has to be
    #   refused here or the bound does not exist. The read clamps too (defence in depth), but
    #   a clamp is silent and a refusal can say why.
    #
    # ⚠ AND THE SENTENCE CARRIES THE COST, not just the range. The whole point of SEED-258 is
    #   that nobody could see what the ceiling was OR why; a bare "must be between 1 and 50"
    #   would leave the operator exactly as blind as the constant did. Raising it means more
    #   memory buffered per in-flight request from a server we do not control — MCP carries
    #   file bytes INSIDE the JSON-RPC envelope, base64-inflated 4/3.
    if body.source_max_file_size_mb is not None:
        if not (
            SOURCE_MAX_FILE_SIZE_MB_FLOOR
            <= body.source_max_file_size_mb
            <= SOURCE_MAX_FILE_SIZE_MB_CEILING
        ):
            raise HTTPException(
                status_code=400,
                detail=await _range_refusal_detail(
                    field="source_max_file_size_mb",
                    label="Largest file a connected source may import",
                    submitted=body.source_max_file_size_mb,
                    lo=SOURCE_MAX_FILE_SIZE_MB_FLOOR,
                    hi=SOURCE_MAX_FILE_SIZE_MB_CEILING,
                    typed_detail=(
                        f"The largest file a connected source may import must be between "
                        f"{SOURCE_MAX_FILE_SIZE_MB_FLOOR} and {SOURCE_MAX_FILE_SIZE_MB_CEILING} MB. "
                        f"0 would stop every source importing while each sync still reported "
                        f"success. Raising it costs memory: the whole response is held in memory "
                        f"per in-flight request from a server we do not control, and file content "
                        f"arrives base64-encoded at 4/3 its size. "
                        f"{SOURCE_MAX_FILE_SIZE_MB_CEILING} MB is the app's own upload limit, so a "
                        f"connected source can never admit a file you could not upload by hand."
                    ),
                ),
            )
        updates["source_max_file_size_mb"] = body.source_max_file_size_mb

    if body.retrieval_top_k is not None:
        updates["retrieval_top_k"] = body.retrieval_top_k
    if body.retrieval_match_threshold is not None:
        updates["retrieval_match_threshold"] = body.retrieval_match_threshold
    if body.hybrid_search_enabled is not None:
        updates["hybrid_search_enabled"] = body.hybrid_search_enabled
    if body.hybrid_candidate_count is not None:
        updates["hybrid_candidate_count"] = body.hybrid_candidate_count
    if body.vector_search_weight is not None:
        updates["vector_search_weight"] = body.vector_search_weight
    if body.keyword_search_weight is not None:
        updates["keyword_search_weight"] = body.keyword_search_weight
    if body.rrf_k is not None:
        updates["rrf_k"] = body.rrf_k

    # Phase 241 (QUEUE-06 / D-09) — search breadth, bounded here because HERE is the boundary.
    #
    # ⚠ THE API REFUSAL IS THE LOAD-BEARING ARM AND THE CHECK CONSTRAINT IS THE BACKSTOP —
    #   which is the opposite of the usual reading, and it is measured rather than assumed:
    #   `BUG-260909-01` records that `save_app_settings` SWALLOWS a CHECK violation and returns
    #   as if the write had succeeded. A bound enforced only in migration 176 would therefore be
    #   a bound nobody is ever told about.
    #
    # ⚠ AND THE SENTENCE CARRIES THE COST, not just the range — SEED-258's shape, which this
    #   file's ledger row records as its binding property. `hnsw.ef_search` is how many
    #   candidate vectors the index walks BEFORE the search's filters are applied; a bare
    #   "must be between 10 and 1000" tells an operator nothing about what they are buying.
    # CR-01 (Phase 241 review) -- THE COLUMN GATE, and it must precede BOTH assignments.
    #   `save_app_settings` composes ONE `UPDATE app_settings SET col=$1, ...` over every key
    #   in `updates`, so on a database where migration 176 has not been applied a single
    #   absent column raises `UndefinedColumnError`, which is caught, reported as False, and
    #   turned into a 500 below -- taking the WHOLE Search tab with it (reranker, embedding
    #   model, retrieval threshold, rrf_k), not just these two knobs. Cloud has not had 176
    #   applied, so without this gate the next deploy ships a 500.
    #
    #   ~~The frontend sends both keys UNCONDITIONALLY (SettingsPage.tsx), so "the operator did
    #   not touch them" is indistinguishable here from "the operator set them" unless we
    #   compare against what is stored.~~ Hence: silently drop an UNCHANGED value (nothing was
    #   asked for), and REFUSE a CHANGED one with a worded 409 naming the migration -- never
    #   accept a change and discard it, which is Phase 240's "screen that discards its own
    #   answer".
    #
    #   ⚠ CORRECTED 2026-09-11 (Phase 242, D-242-02) — the struck sentence above is kept rather
    #   than deleted, because the SHAPE it justifies is unchanged and only its premise moved.
    #   `SettingsPage.tsx` now sends CHANGED FIELDS ONLY, so an untouched knob no longer arrives
    #   here at all and the stored-comparison below is BELT-AND-BRACES rather than load-bearing
    #   for the UI path. ⛔ IT IS STILL LOAD-BEARING FOR EVERY OTHER CLIENT: this endpoint is not
    #   the Settings page, and a caller that does send both keys unchanged must still be dropped
    #   silently rather than refused. Do not delete the comparison on the strength of what one
    #   frontend now does.
    if not await app_settings_has_hnsw_columns():
        _stored = await load_app_settings_async()
        _asked = [
            name
            for name, sent, stored in (
                ("hnsw_ef_search", body.hnsw_ef_search, _stored.hnsw_ef_search),
                ("hnsw_iterative_scan", body.hnsw_iterative_scan, _stored.hnsw_iterative_scan),
            )
            if sent is not None and sent != stored
        ]
        if _asked:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Search breadth and keep-scanning cannot be saved on this database yet: "
                    "migration 176 has not been applied here, so the two columns that store "
                    "them do not exist. Every other setting on this tab saves normally. Apply "
                    "supabase/migrations/176_app_settings_hnsw_knobs.sql in the SQL editor "
                    "(never db push / db reset), then set these again. Until then searches "
                    "keep working and simply use the built-in defaults."
                ),
            )
        body.hnsw_ef_search = None
        body.hnsw_iterative_scan = None

    if body.hnsw_ef_search is not None:
        if not HNSW_EF_SEARCH_FLOOR <= body.hnsw_ef_search <= HNSW_EF_SEARCH_CEILING:
            raise HTTPException(
                status_code=400,
                detail=await _range_refusal_detail(
                    field="hnsw_ef_search",
                    label="Search breadth",
                    submitted=body.hnsw_ef_search,
                    lo=HNSW_EF_SEARCH_FLOOR,
                    hi=HNSW_EF_SEARCH_CEILING,
                    typed_detail=(
                    f"Search breadth must be between {HNSW_EF_SEARCH_FLOOR} and "
                    f"{HNSW_EF_SEARCH_CEILING}. It is how many candidate vectors the index "
                    f"walks before your filters are applied, so raising it costs time and "
                    f"memory on every single search — a bigger number means more candidate "
                    f"vectors walked per query and slower answers. Lowering it makes searches "
                    f"faster but can return fewer results than asked for when a filter matches "
                    f"only a small part of the library. {HNSW_EF_SEARCH_CEILING} is the "
                    f"database's own maximum; below {HNSW_EF_SEARCH_FLOOR} the scan walks so "
                    f"little that filtered searches would come back near-empty while still "
                    f"reporting success."
                    ),
                ),
            )
        updates["hnsw_ef_search"] = body.hnsw_ef_search

    # ⛔ A FREE-TEXT MODE REACHES A POSTGRES SESSION PARAMETER. Validated against the
    #   three-member tuple BEFORE it is ever stored, and `retrieval_tuning.py` validates it
    #   again before binding it — the value is a bind parameter there, never interpolated, but
    #   an unknown mode would still make every search log a warning for no reason (T-241-14).
    if body.hnsw_iterative_scan is not None:
        if body.hnsw_iterative_scan not in HNSW_ITERATIVE_SCAN_VALUES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Iterative scan must be one of "
                    + ", ".join(HNSW_ITERATIVE_SCAN_VALUES)
                    + ". Turning it on lets the index keep scanning until enough results "
                    "survive your filters instead of returning a short list — which costs "
                    "more work per search, and more memory. 'strict_order' keeps results in "
                    "exact relevance order; 'relaxed_order' is faster but may reorder them. "
                    "⚠ Databases older than pgvector 0.8 do not have this setting at all; on "
                    "those, searches keep working and this control simply has no effect."
                ),
            )
        updates["hnsw_iterative_scan"] = body.hnsw_iterative_scan

    if body.tavily_api_key is not None:
        updates["tavily_api_key"] = body.tavily_api_key
    if body.web_search_max_results is not None:
        updates["web_search_max_results"] = body.web_search_max_results
    if body.web_search_enabled is not None:
        updates["web_search_enabled"] = body.web_search_enabled

    if body.sandbox_enabled is not None:
        updates["sandbox_enabled"] = body.sandbox_enabled
    if body.context_window_max_tokens is not None:
        updates["context_window_max_tokens"] = body.context_window_max_tokens
    if body.sub_agent_max_output_tokens is not None:
        updates["sub_agent_max_output_tokens"] = body.sub_agent_max_output_tokens
    if body.sub_agent_model is not None:
        updates["sub_agent_model"] = body.sub_agent_model
    # Phase 123 (D-08) — the skill-builder model knob. A free-form model id (any
    # provider incl. local); the resolver provides the strong default + honest-None
    # floor, so no provider-list validation here (decoupled from the benchmark
    # targets, no SPOF). "" persists as unset.
    if body.skill_builder_model is not None:
        updates["skill_builder_model"] = body.skill_builder_model
    # Phase 137.1-05 (EVAL-05f / D-11 / D-12) — the shared harness judge model knob. Same
    # field the eval + publish judge already resolve (resolve_judge_model — no new setting,
    # no migration). D-12: registry-validate on write — a NON-EMPTY value must be a
    # MODEL_CAPABILITIES-known model (mirrors evals.py:165-170), else 400; an unknown /
    # inferred id can never reach the shared judge setting (T-137.1-J1). "" persists as
    # unset (the resolver then falls back to the effective default).
    if body.harness_judge_model is not None:
        if body.harness_judge_model:
            from app.config import get_model_capability  # function-local (Pitfall 4)
            cap = get_model_capability(body.harness_judge_model)
            if cap.get("capability_source") != "registry":
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown judge model: {body.harness_judge_model}",
                )
        updates["harness_judge_model"] = body.harness_judge_model

    # MDL-01: Validate sub_agent_model against active provider's model list
    if body.sub_agent_model:
        current_settings = await load_app_settings_async()
        pending_provider = (
            getattr(body, "active_provider", None)
            or current_settings.active_provider
        )
        provider_obj = next(
            (p for p in current_settings.providers if p.id == pending_provider),
            None,
        )
        if provider_obj and provider_obj.models and body.sub_agent_model not in provider_obj.models:
            raise HTTPException(
                status_code=422,
                detail=f"Model '{body.sub_agent_model}' is not available for provider '{pending_provider}'.",
            )

    # Phase 111.1 EMBED-05 — snapshot the PREVIOUS embedding model/dims BEFORE the write,
    # so we can detect a real change after save and kick the re-embed job (D-04/D-05).
    prev_settings = await load_app_settings_async()
    prev_model = prev_settings.embedding_model
    prev_dims = prev_settings.embedding_dimensions

    # Phase 150 (SEC-01 / D-150-07 / SC#2) — surface the previously-ignored save bool as a
    # real HTTP 500. save_app_settings SWALLOWS every DB-write exception and returns False (a
    # pool blip / connection reset / an UndefinedColumn on an unmigrated secret column). The
    # raise sits IMMEDIATELY after the save and BEFORE the audit write + the re-embed kick
    # below, so a failed save never emits a false settings.update audit row or a spurious
    # re-embed (Phase 147 CR-02 precedent; RESEARCH §Round-trip verification). Round-trip
    # meaning (SC#2): save_app_settings encrypts-then-writes; the one read seam decrypts back.
    if not await save_app_settings(updates):
        raise HTTPException(status_code=500, detail="Failed to save settings")
    sanitized = {k: ("[REDACTED]" if "_key" in k or "_secret" in k else v) for k, v in updates.items()}
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="settings.update",
        metadata={"new_settings": sanitized},
        supabase=supabase,
    )

    # Phase 111.1 EMBED-05 — kick the re-embed job on a CONFIRMED model/dim change.
    # The D-03 confirm gate is the FRONTEND modal (Plan 06) — the backend kicks on the
    # already-confirmed save, so we never add a second backend confirmation. A change in
    # the embedding MODEL or DIMENSIONS makes the existing chunks stale (their vectors
    # live in a different space), so the job re-embeds them from preserved content
    # (graceful-dip recall in the meantime via the D-10 stale-model filter). The handler
    # returns fast; the job runs in the BackgroundTask thread (same pattern as
    # documents.py:497). dims_changed gates the destructive resize_embedding_column.
    new_settings = await load_app_settings_async()
    model_changed = new_settings.embedding_model != prev_model
    dims_changed = new_settings.embedding_dimensions != prev_dims
    if model_changed or dims_changed:
        background_tasks.add_task(
            start_reembed,
            supabase,
            current_user["id"],
            new_settings,
            dims_changed,
        )

    return await _build_response()


# Phase 111.1 EMBED-05 — re-embed progress + manual re-kick surfaces.

class ReembedProgressResponse(BaseModel):
    status: str            # idle | running | partial | complete | failed
    total: int | None
    re_embedded: int | None
    remaining: int | None
    model: str | None = None
    updated_at: float | None = None


@router.get(
    "/reembed-progress",
    response_model=ReembedProgressResponse,
    dependencies=[Depends(require_visible("model_management"))],  # Phase 148 (VIS-01) — model_management gate
)
async def get_reembed_progress(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),  # service-role: app-level settings (app_settings RLS-off) + audit/re-embed writers (plan 09)
):
    """Reconcile-on-fetch progress for the Settings re-embed status card (D-v2.5-03).

    Counts are derived live from document_chunks (the source of truth); the status hint
    is reconciled against them (counts win — T-111.1-05-05). RLS-scoped to the caller.
    """
    from app.services.reembed_service import reembed_progress

    s = await load_app_settings_async()
    return await reembed_progress(supabase, current_user["id"], s)


class ReembedKickBody(BaseModel):
    """BE-3 (217.1): optional folder scope for `POST /settings/reembed`.

    `folder_ids` narrows the re-embed to a caller-selected set of folders, ANDed onto the
    stale predicate. `None`/absent keeps the kickoff byte-identical to pre-217.1.
    """
    folder_ids: list[str] | None = None


@router.post(
    "/reembed",
    response_model=ReembedProgressResponse,
    dependencies=[Depends(require_visible("model_management"))],  # Phase 148 (VIS-01) — model_management gate
)
async def rekick_reembed(
    body: ReembedKickBody | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),  # service-role: app-level settings (app_settings RLS-off) + audit/re-embed writers (plan 09)
):
    """Manual "Re-embed now" re-kick for a failed/partial run (D-05). Re-runs against the
    same stale predicate, so it resumes from wherever the last run stopped. dims_changed
    is False here — a manual re-kick re-embeds the still-stale chunks, never re-resizes
    (a dims change always flows through the settings save kickoff above).

    BE-3 (217.1): an optional `folder_ids` body narrows the scope. The returned progress
    carries a `scope` marker when the scope selected zero rows — `folder_empty` (no docs at
    all in the selected folders) vs `already_current` (docs exist, none stale) — so the
    frontend can render "Already indexed with the current model." rather than a silent no-op."""
    from app.services.reembed_service import reembed_progress, start_reembed

    s = await load_app_settings_async()
    background_tasks.add_task(
        start_reembed, supabase, current_user["id"], s, False,
        body.folder_ids if body else None,
    )
    # Return the CURRENT (pre-run) progress snapshot so the card can show "running".
    return await reembed_progress(supabase, current_user["id"], s)


# Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT add require_visible here. This feeds the chat
# model picker (ChatArea.tsx getProviders()); end users need it. Gating it would be a
# self-inflicted end-user outage (Pitfall 3 / T-148-08). test_148_carveouts guards this.
@router.get("/providers")
async def get_providers(current_user: dict = Depends(get_current_user)):
    """Lightweight endpoint for the chat UI provider selector."""
    s = await load_app_settings_async()
    configured = [
        {"id": p.id, "name": p.name, "models": p.models, "is_active": p.is_active}
        for p in s.providers
        if p.api_key  # only providers that have a key set
    ]
    # Phase 149 (IN-01 / D-149-05): the deprecated-model id set for the chat picker's
    # informational badge. Same comprehension as the /settings response so the chat composer's
    # MessageInput can render the `deprecated` badge (deprecated ≠ disabled — a deprecated
    # model stays enabled/selectable). load_all_model_overrides never raises (returns the
    # stale/empty cache on a blip), so this can never break the end-user picker feed.
    from app.models.user_settings import load_all_model_overrides  # function-local (Pitfall 4)
    _overrides = await load_all_model_overrides()
    deprecated_models = sorted(mid for mid, cap in _overrides.items() if cap.get("deprecated"))
    # Phase 196 Plan 07 (D-18 / BUG-260718-04): the operator-DISABLED model-id set, so the
    # composer's per-thread model restore can apply D-07's disabled rule by name instead of
    # inferring it. Same already-fetched `_overrides` dict as the line above — no new read,
    # no new import, no new cache.
    #
    # ⚠ SEMANTICS ARE `_registry_row`'s, NOT `enabled_model_allowed_set`'s: only a row that
    # is PRESENT with `enabled` explicitly False is disabled. An ABSENT override row is
    # enabled (that is the overwhelming majority of ids, which have no row at all), so a
    # truthiness test here would report every unregistered model as disabled. This is the
    # identical predicate `_build_providers` uses to assemble `disabled_ids`
    # (user_settings.py — D-149-08), which is what makes the two agree by construction.
    disabled_models = sorted(
        mid for mid, cap in _overrides.items() if cap.get("enabled") is False
    )
    # Phase 249 (MODEL-05) — WHAT THE COMPOSER NEEDS TO WARN AT PICK TIME.
    #
    # The `unverified` chip already existed, in `ModelPillRow` on the SETTINGS page, driven by
    # these same two fields on the `GET /settings` response. The chat composer's dropdown — the
    # surface where a model is actually PICKED — had no marker at all, so the warning lived on the
    # screen where you configure and was absent on the screen where you choose.
    #
    # ⛔ ALL THREE REUSE `_overrides`, ALREADY FETCHED ABOVE for deprecated/disabled. No second
    # read, no new import, no new cache — this is the end-user picker feed (the VIS-01 run
    # carve-out), and a second thing that can be slow here is a second way for it to break.
    _verified = _verified_model_ids(_overrides)
    _verified_set = set(_verified)
    # Keyed only by CONFIGURED ids that are not registered — one entry per unknown, so the
    # payload stays small. `_infer_provider_for` is the SERVER's inference; the client never
    # mirrors the pattern table (RESEARCH §6 Approach b).
    _inferred = {
        m: _infer_provider_for(m)
        for p in s.providers
        for m in p.models
        if m and m not in _verified_set
    }
    # ⭐ THE CONSEQUENCE, not the mechanism. An inferred provider OUTSIDE _NATIVE_TOOL_PROVIDERS
    # means the run goes to STRUCTURED mode, the `tools` param is never sent, and any tool call
    # the model attempts arrives as unparseable prose — the agent loop then breaks after one
    # iteration with no error anywhere. `config.py` learned to say this out loud on 2026-08-18,
    # after that exact failure stayed invisible for a day behind the words
    # `safe_defaults_applied=True`. The chip says it too, and this field is what tells it which
    # models to say it about.
    from app.config import _NATIVE_TOOL_PROVIDERS  # function-local (Pitfall 4)
    _tools_lost = sorted(m for m, prov in _inferred.items() if prov not in _NATIVE_TOOL_PROVIDERS)
    return {
        "active": s.active_provider,
        "active_model": s.llm_model,
        "providers": configured,
        "deprecated_models": deprecated_models,
        "disabled_models": disabled_models,
        "verified_models": _verified,
        "inferred_provider_for": _inferred,
        "inferred_tools_lost": _tools_lost,
    }
