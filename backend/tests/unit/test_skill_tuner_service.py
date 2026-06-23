"""Phase 123 Plan 03 Task 2 — skill_tuner_service orchestration over forced_emit.

forced_emit is MOCKED at the skill_tuner_service module boundary (it is imported
at module level there, so we patch the name on the SERVICE module). NO live LLM
calls in these unit tests.

Behaviors proven:
  - build_candidates: <=N candidate strings from the emitted CandidateDescriptions;
    an honest-fail (emitted=None) -> zero candidates, never a crash.
  - classify_fires: returns a TriggerDecision; the classifier prompt CONTAINS the
    real LOAD_SKILL_POLICY text (Pitfall 1 fidelity).
  - configured_targets: ONE representative per CONFIGURED provider; a keyless/
    base_url-less provider NEVER appears; OpenRouter and native deepseek/zhipu/
    moonshot/minimax are DISTINCT; N=1 is a valid clean result.
  - auto_seed_cases / fetch_owner_scoped_siblings: the owner-scoped
    .or_(user_id.eq.{id}, is_global.eq.true) query is used and never returns a
    sibling outside that scope.
  - the Pydantic schemas are FLAT + single-typed (no Union/anyOf/oneOf).

CONVENTION: imports INSIDE the test bodies; forced_emit mocked.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


def _patch_provider(monkeypatch, provider="anthropic"):
    """Make get_model_capability(model) resolve a provider (function-local import in
    the service)."""
    import app.config as cfg

    monkeypatch.setattr(
        cfg, "get_model_capability", lambda model: {"forced_emission": True, "provider": provider}
    )


# ── build_candidates ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_build_candidates_returns_up_to_n(monkeypatch):
    import app.services.skill_tuner_service as svc

    _patch_provider(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": svc.CandidateDescriptions(candidates=["a", "b", "c", "d"]), "failure": None}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    out = await svc.build_candidates(
        name="Risk Register",
        description="Fill the weekly risk register.",
        builder_model="claude-haiku-4-5-20251001",
        user_settings=object(),
        n=3,
    )
    assert out == ["a", "b", "c"], "must cap at N candidates"


@pytest.mark.asyncio
async def test_build_candidates_honest_fail_yields_zero(monkeypatch):
    import app.services.skill_tuner_service as svc

    _patch_provider(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": None, "failure": "model_failed_to_emit"}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    out = await svc.build_candidates(
        name="x", description="y", builder_model="m", user_settings=object()
    )
    assert out == [], "an honest-fail (emitted=None) yields zero candidates, never a crash"


@pytest.mark.asyncio
async def test_build_candidates_passes_nonempty_system_prompt(monkeypatch):
    """anthropic empty-block 400 guard: the builder shot must send a NON-EMPTY system."""
    import app.services.skill_tuner_service as svc

    _patch_provider(monkeypatch)
    seen = {}

    async def _fake_forced_emit(**kwargs):
        seen["system_prompt"] = kwargs.get("system_prompt")
        seen["schema_model"] = kwargs.get("schema_model")
        return {"emitted": svc.CandidateDescriptions(candidates=["a"]), "failure": None}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    await svc.build_candidates(name="x", description="y", builder_model="m", user_settings=object())
    assert seen["system_prompt"], "the builder shot must send a non-empty system_prompt"
    assert seen["schema_model"] is svc.CandidateDescriptions


# ── classify_fires (Pitfall 1 — real policy) ──────────────────────────────────
@pytest.mark.asyncio
async def test_classify_fires_returns_trigger_decision(monkeypatch):
    import app.services.skill_tuner_service as svc

    _patch_provider(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": svc.TriggerDecision(would_load=True, skill_name="Risk Register"), "failure": None}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    decision = await svc.classify_fires(
        target_model="gpt-5.4-mini",
        catalog_lines="- Risk Register: fill the weekly risk register",
        user_prompt="Build me this week's risk register",
        user_settings=object(),
    )
    assert decision.would_load is True
    assert decision.skill_name == "Risk Register"


@pytest.mark.asyncio
async def test_classifier_system_prompt_mirrors_real_policy(monkeypatch):
    """Pitfall 1 fidelity: the classifier system prompt must CONTAIN the real
    LOAD_SKILL_POLICY (imported from skill_lint), so the Tuner measures production."""
    import app.services.skill_tuner_service as svc
    from app.services.skill_lint import LOAD_SKILL_POLICY

    _patch_provider(monkeypatch)
    seen = {}

    async def _fake_forced_emit(**kwargs):
        seen["system_prompt"] = kwargs.get("system_prompt")
        return {"emitted": svc.TriggerDecision(would_load=False, skill_name=None), "failure": None}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    await svc.classify_fires(
        target_model="m", catalog_lines="-", user_prompt="hi", user_settings=object()
    )
    assert LOAD_SKILL_POLICY in seen["system_prompt"], (
        "the classifier prompt must embed the REAL production LOAD_SKILL_POLICY (Pitfall 1)"
    )


@pytest.mark.asyncio
async def test_classify_fires_honest_fail_is_no_fire(monkeypatch):
    import app.services.skill_tuner_service as svc

    _patch_provider(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": None, "failure": "provider_error"}

    monkeypatch.setattr(svc, "forced_emit", _fake_forced_emit)

    decision = await svc.classify_fires(
        target_model="m", catalog_lines="-", user_prompt="hi", user_settings=object()
    )
    assert decision.would_load is False, "a never-reached model is treated as 'did not fire'"


# ── configured_targets (N-column adaptivity / Pattern 4) ──────────────────────
def test_n_column_configured_only():
    """Configured providers appear; keyless/base_url-less providers NEVER do.
    OpenRouter and native deepseek/zhipu are DISTINCT entries."""
    from app.services.skill_tuner_service import configured_targets

    settings = SimpleNamespace(
        openai_api_key="sk-x",
        anthropic_api_key="sk-ant-x",
        google_api_key="",          # NOT configured
        openrouter_api_key="sk-or-x",
        deepseek_api_key="ds-x",    # native deepseek, distinct from openrouter
        moonshot_api_key="",
        minimax_api_key="",
        zhipu_api_key="zp-x",       # native zhipu, distinct from openrouter
        ollama_base_url="",         # local NOT configured
        lmstudio_base_url="",
    )
    targets = configured_targets(settings)
    providers = {t["provider"] for t in targets}
    assert "openai" in providers
    assert "anthropic" in providers
    assert "google" not in providers, "a keyless provider must NEVER appear"
    assert "moonshot" not in providers and "minimax" not in providers
    assert "ollama" not in providers and "lmstudio" not in providers
    # OpenRouter (gateway) and native deepseek/zhipu are DISTINCT columns.
    assert "openrouter" in providers
    assert "deepseek" in providers
    assert "zhipu" in providers
    assert len({"openrouter", "deepseek", "zhipu"} & providers) == 3, (
        "OpenRouter must be a distinct entry from native deepseek/zhipu"
    )


def test_n_equals_one_is_a_valid_clean_baseline():
    """A single configured provider is the CLEAN single-provider baseline (NOT degraded)."""
    from app.services.skill_tuner_service import configured_targets

    settings = SimpleNamespace(
        openai_api_key="",
        anthropic_api_key="sk-ant-only",
        google_api_key="",
        openrouter_api_key="",
        deepseek_api_key="",
        moonshot_api_key="",
        minimax_api_key="",
        zhipu_api_key="",
        ollama_base_url="",
        lmstudio_base_url="",
    )
    targets = configured_targets(settings)
    assert len(targets) == 1, "N=1 is a valid clean result"
    assert targets[0]["provider"] == "anthropic"


def test_local_provider_appears_when_base_url_set():
    """D-08 / 111.1: a local provider with a base_url (no key) is a first-class target —
    no paid-provider SPOF."""
    from app.services.skill_tuner_service import configured_targets

    settings = SimpleNamespace(
        openai_api_key="", anthropic_api_key="", google_api_key="",
        openrouter_api_key="", deepseek_api_key="", moonshot_api_key="",
        minimax_api_key="", zhipu_api_key="",
        ollama_base_url="http://localhost:11434", lmstudio_base_url="",
    )
    targets = configured_targets(settings)
    assert {t["provider"] for t in targets} == {"ollama"}, (
        "a local provider configured by base_url must appear (no paid SPOF)"
    )


def test_configured_targets_reads_presence_not_value():
    """T-123-03-02: the probe reads key PRESENCE only (truthy), never the value. A
    whitespace-only key is treated as absent."""
    from app.services.skill_tuner_service import configured_targets

    settings = SimpleNamespace(
        openai_api_key="   ",  # whitespace-only = absent
        anthropic_api_key="sk-ant-x",
        google_api_key="", openrouter_api_key="", deepseek_api_key="",
        moonshot_api_key="", minimax_api_key="", zhipu_api_key="",
        ollama_base_url="", lmstudio_base_url="",
    )
    providers = {t["provider"] for t in configured_targets(settings)}
    assert providers == {"anthropic"}, "a whitespace-only key must be treated as absent"


# ── owner-scoped auto-seed (D-04 / V4 / T-123-03-01) ──────────────────────────
class _FakeQuery:
    """Records the .or_() filter argument; returns its seeded rows on .execute()."""

    def __init__(self, rows):
        self._rows = rows
        self.or_arg = None
        self.is_enabled_filter = None

    def select(self, *_a, **_k):
        return self

    def or_(self, expr):
        self.or_arg = expr
        return self

    def eq(self, col, val):
        if col == "is_enabled":
            self.is_enabled_filter = val
        return self

    def execute(self):
        return SimpleNamespace(data=self._rows)


class _FakeSupabase:
    def __init__(self, rows):
        self.query = _FakeQuery(rows)

    def table(self, _name):
        return self.query


def test_fetch_siblings_uses_owner_scoped_query():
    from app.services.skill_tuner_service import fetch_owner_scoped_siblings

    rows = [
        {"id": "s1", "name": "Mine", "description": "my private skill"},
        {"id": "g1", "name": "Global", "description": "a global skill"},
    ]
    supa = _FakeSupabase(rows)
    out = fetch_owner_scoped_siblings(supa, user_id="user-123")
    # The query carried the EXACT owner-scoped .or_() filter + is_enabled gate.
    assert supa.query.or_arg == "user_id.eq.user-123,is_global.eq.true", (
        "siblings MUST be fetched with the owner-scoped .or_(user_id.eq.{id}, is_global.eq.true) query"
    )
    assert supa.query.is_enabled_filter is True
    assert {r["id"] for r in out} == {"s1", "g1"}


def test_fetch_siblings_excludes_edited_skill():
    from app.services.skill_tuner_service import fetch_owner_scoped_siblings

    rows = [{"id": "s1", "name": "A", "description": "a"}, {"id": "s2", "name": "B", "description": "b"}]
    out = fetch_owner_scoped_siblings(_FakeSupabase(rows), user_id="u", exclude_skill_id="s1")
    assert {r["id"] for r in out} == {"s2"}, "the edited skill is excluded from its own siblings"


def test_auto_seed_uses_only_provided_siblings():
    """auto_seed_cases NEVER reads the DB — it only paraphrases the siblings it is GIVEN
    (which the caller fetched owner-scoped). A sibling outside scope can never appear
    because this function does no I/O."""
    from app.services.skill_tuner_service import auto_seed_cases

    skill = {"name": "Risk Register", "description": "Fill the weekly risk register."}
    siblings = [{"name": "Status Report", "description": "Write the weekly status report."}]
    cases = auto_seed_cases(skill, siblings)
    assert cases["should_fire"], "should-fire cases (recall rail) must be seeded"
    assert cases["should_not"], "should-NOT cases (false-fire rail) must be seeded"
    # The sibling's description is bait; the generic off-topic set pads the rail.
    assert "Write the weekly status report." in cases["should_not"]
    assert len(cases["should_not"]) > 1, "generic off-topic set pads the false-fire rail"


# ── FLAT single-typed schemas (Gemini trap — Pitfall 4) ───────────────────────
def test_schemas_are_flat_single_typed():
    """The Pydantic schemas must be FLAT + single-typed — no Union/anyOf/oneOf at the
    property level (str | None nullable is allowed)."""
    from app.services.skill_tuner_service import CandidateDescriptions, TriggerDecision

    cand_schema = CandidateDescriptions.model_json_schema()
    # candidates is a plain array of strings.
    assert cand_schema["properties"]["candidates"]["type"] == "array"
    assert cand_schema["properties"]["candidates"]["items"]["type"] == "string"

    trig_schema = TriggerDecision.model_json_schema()
    assert trig_schema["properties"]["would_load"]["type"] == "boolean"
    # skill_name is str | None — nullable, NOT a discriminated Union. Pydantic v2 may
    # render this as anyOf[{string},{null}] which is the ALLOWED nullable form; assert it
    # is at most a string/null nullable, never a multi-MODEL Union.
    skill_name = trig_schema["properties"]["skill_name"]
    if "anyOf" in skill_name:
        types = {sub.get("type") for sub in skill_name["anyOf"]}
        assert types <= {"string", "null"}, (
            "skill_name may only be the nullable string form (string|null), never a "
            "multi-type/discriminated Union (Gemini trap)"
        )
    else:
        assert skill_name.get("type") in ("string", None)
