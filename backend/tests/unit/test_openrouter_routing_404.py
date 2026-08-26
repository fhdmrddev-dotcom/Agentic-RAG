"""BUG-260825-03 — OpenRouter's `404 No endpoints found that can handle the requested
parameters` must never reach a person as a raw provider payload.

⚠ WHAT THE ERROR ACTUALLY IS. Not a missing model, not auth. OpenRouter refuses the request
   as a whole when no provider endpoint behind the chosen model accepts the combination of
   parameters we sent. Per OpenRouter's own provider-selection documentation the default is
   LENIENT — an endpoint that lacks a parameter ignores it — and
   `provider.require_parameters: true` is precisely the switch that converts that leniency
   into a hard exclusion. This app sets that flag on every `quality`-strategy OpenRouter tool
   call, alongside an `:exacto` model suffix and a `response-healing` plugin.

⚠ AND THE REGISTRY AGREES IT IS A TOOLS PROBLEM: every OpenRouter row in
   `MODEL_CAPABILITIES` records `native_tools: False`, yet `resolve_calling_mode` returns
   NATIVE for OpenRouter under the `quality` and `native` strategies — so `tools` is attached
   to models the registry itself says are the non-native tool path.
"""
from __future__ import annotations

import pytest

import app.main  # noqa: F401  — app.api.* / some app.services.* cannot import standalone
from app.services.openai_service import (
    _OPENROUTER_ROUTING_PREFERENCES,
    _create_with_openrouter_routing_retry,
    _is_no_endpoint_404,
)
from app.services.provider_gateway import classify_provider_error, message_for_kind
from app.services.provider_gateway.errors import _has_no_endpoint_signature


_REAL_MESSAGE = (
    "No endpoints found that can handle the requested parameters. To learn more about "
    "provider routing, visit: https://openrouter.ai/docs/guides/routing/provider-selection"
)


class _RoutingRefusal(Exception):
    """The shape the OpenAI SDK raises for OpenRouter's 404 (verbatim body)."""
    status_code = 404
    body = {"error": {"message": _REAL_MESSAGE, "code": 404}}


class _UnrelatedNotFound(Exception):
    status_code = 404
    body = {"error": {"message": "The model `foo/bar` does not exist.", "code": 404}}


class _PlainBadRequest(Exception):
    status_code = 400
    body = {"error": {"message": "Invalid value for 'temperature'.", "code": 400}}


# ──────────────────────────────────────────────────────────────────────────────
# The person gets a NAMED refusal.
# ──────────────────────────────────────────────────────────────────────────────
def test_the_routing_404_is_classified_by_name_not_as_unknown() -> None:
    """⚠ THE SHIPPED BEHAVIOUR: 404 fell through `_classify_status` to `unknown`, and
    `unknown` is the ONE kind that interpolates the raw provider payload. That is exactly
    how the operator came to read a routing-doc URL in a chat window."""
    assert classify_provider_error("openrouter", _RoutingRefusal()) == "no_endpoint_for_parameters"


def test_the_named_message_says_what_cannot_be_done_and_what_to_do() -> None:
    msg = message_for_kind("no_endpoint_for_parameters")
    low = msg.lower()
    assert "tools" in low, "the refusal must name the capability that is missing"
    assert "openrouter" in low
    assert "404" not in msg, "a status code is not an explanation"
    assert "http" not in low, "no raw provider URL may reach a person"
    assert "no endpoints found" not in low, "the provider's own wording is not our copy"


def test_an_unrelated_404_keeps_its_prior_classification() -> None:
    """⚠ NARROWNESS IS THE POINT: BOTH signature substrings are required, matched only
    against the STRUCTURED body. A different 404 must be untouched (D-14)."""
    assert classify_provider_error("openrouter", _UnrelatedNotFound()) == "unknown"


def test_a_crafted_str_cannot_force_the_classification() -> None:
    """Mirrors T-175-03-02: the classifier reads `exc.body`, never `str(exc)`."""
    forged = Exception(_REAL_MESSAGE)
    assert classify_provider_error("openrouter", forged) != "no_endpoint_for_parameters"


def test_a_400_is_still_a_bad_request() -> None:
    assert classify_provider_error("openrouter", _PlainBadRequest()) == "bad_request"


def test_the_two_predicates_agree_on_the_same_exception() -> None:
    """⚠ THE PREDICATE IS DELIBERATELY DUPLICATED — `provider_gateway.errors` sits BELOW the
    gateway and must never be imported upward into `openai_service`. This is the guard that
    keeps the two copies in step; without it they can drift apart silently."""
    for exc in (_RoutingRefusal(), _UnrelatedNotFound(), _PlainBadRequest()):
        assert _is_no_endpoint_404(exc) == _has_no_endpoint_signature(exc), type(exc).__name__


# ──────────────────────────────────────────────────────────────────────────────
# The bounded, provider-scoped relax-and-retry.
# ──────────────────────────────────────────────────────────────────────────────
class _FakeClient:
    """Records every request body it is handed and raises whatever it is told to."""

    def __init__(self, raises: list) -> None:
        self._raises = list(raises)
        self.calls: list[dict] = []
        self.chat = self

    @property
    def completions(self):  # noqa: D401 — mimics client.chat.completions.create
        return self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self._raises:
            exc = self._raises.pop(0)
            if exc is not None:
                raise exc
        return "STREAM"


def _narrowed_kwargs() -> dict:
    """Exactly what the `quality` strategy builds today."""
    return {
        "model": "moonshotai/kimi-k2.6:exacto",
        "messages": [{"role": "user", "content": "hi"}],
        "stream": True,
        "tools": [{"type": "function", "function": {"name": "search_documents"}}],
        "tool_choice": "auto",
        "extra_body": {
            "plugins": [{"id": "response-healing"}],
            "provider": {"require_parameters": True},
        },
    }


def test_the_retry_drops_exactly_the_three_routing_preferences() -> None:
    client = _FakeClient([_RoutingRefusal(), None])
    assert _create_with_openrouter_routing_retry(client, _narrowed_kwargs(), "openrouter") == "STREAM"
    assert len(client.calls) == 2, "exactly one retry"
    retry = client.calls[1]
    assert retry["model"] == "moonshotai/kimi-k2.6", ":exacto must be dropped"
    assert "extra_body" not in retry, "provider + plugins were the only extra_body keys"
    assert retry["tools"] == _narrowed_kwargs()["tools"], "tools must SURVIVE the retry"
    assert retry["tool_choice"] == "auto"
    assert retry["messages"] == _narrowed_kwargs()["messages"]


def test_the_retry_keeps_extra_body_keys_it_does_not_own() -> None:
    """⚠ `extra_body` is shared — DeepSeek's `thinking` block lives there too. The retry
    must remove ONLY the routing preferences it named, never the whole dict."""
    kwargs = _narrowed_kwargs()
    kwargs["extra_body"]["thinking"] = {"type": "enabled"}
    client = _FakeClient([_RoutingRefusal(), None])
    _create_with_openrouter_routing_retry(client, kwargs, "openrouter")
    assert client.calls[1]["extra_body"] == {"thinking": {"type": "enabled"}}


def test_the_original_kwargs_are_not_mutated() -> None:
    kwargs = _narrowed_kwargs()
    client = _FakeClient([_RoutingRefusal(), None])
    _create_with_openrouter_routing_retry(client, kwargs, "openrouter")
    assert kwargs["model"].endswith(":exacto")
    assert kwargs["extra_body"]["provider"] == {"require_parameters": True}


def test_a_second_refusal_propagates_so_the_named_refusal_is_the_answer() -> None:
    """⚠ WE DO NOT RETRY WITHOUT `tools`. Answering a tool-shaped turn with a tool-less
    model degrades the answer silently; a named refusal is the honest outcome."""
    client = _FakeClient([_RoutingRefusal(), _RoutingRefusal()])
    with pytest.raises(Exception) as excinfo:
        _create_with_openrouter_routing_retry(client, _narrowed_kwargs(), "openrouter")
    assert len(client.calls) == 2, "bounded — never a third attempt"
    assert classify_provider_error("openrouter", excinfo.value) == "no_endpoint_for_parameters"


def test_nothing_to_relax_means_no_retry_at_all() -> None:
    """A request that carried no narrowing cannot be helped by removing narrowing."""
    bare = {"model": "z-ai/glm-5.2", "messages": [], "stream": True}
    client = _FakeClient([_RoutingRefusal()])
    with pytest.raises(Exception):
        _create_with_openrouter_routing_retry(client, bare, "openrouter")
    assert len(client.calls) == 1


@pytest.mark.parametrize("provider", ["openai", "anthropic", "google", "deepseek", "", None])
def test_every_other_provider_is_a_pass_through(provider) -> None:
    """⚠ THE RED LINE: provider-specific handling stays AT THE BOUNDARY. A non-OpenRouter
    caller must see the exception unchanged and must never see a second request."""
    client = _FakeClient([_RoutingRefusal()])
    with pytest.raises(Exception):
        _create_with_openrouter_routing_retry(client, _narrowed_kwargs(), provider)
    assert len(client.calls) == 1


def test_an_unrelated_error_is_never_retried_even_on_openrouter() -> None:
    client = _FakeClient([_PlainBadRequest()])
    with pytest.raises(Exception):
        _create_with_openrouter_routing_retry(client, _narrowed_kwargs(), "openrouter")
    assert len(client.calls) == 1


def test_a_successful_first_call_issues_exactly_one_request() -> None:
    client = _FakeClient([None])
    assert _create_with_openrouter_routing_retry(client, _narrowed_kwargs(), "openrouter") == "STREAM"
    assert len(client.calls) == 1


# ──────────────────────────────────────────────────────────────────────────────
# The request body itself.
# ──────────────────────────────────────────────────────────────────────────────
def test_require_parameters_no_longer_also_requires_parallel_tool_calls() -> None:
    """⚠ `require_parameters: True` applies to EVERY parameter in the body.
    `parallel_tool_calls=False` is an optimisation we merely prefer, so requiring an
    endpoint to support it shrank the candidate set for no benefit. Asserted on the shipped
    source, because the point is that the pop sits INSIDE the openrouter+quality gate."""
    import inspect
    from app.services import openai_service
    src = inspect.getsource(openai_service.create_adaptive_streaming_chat)
    assert 'kwargs.pop("parallel_tool_calls", None)' in src
    gate = src.index('if provider == "openrouter":')
    assert src.index('kwargs.pop("parallel_tool_calls", None)') > gate, (
        "the pop must sit inside the openrouter gate, never on the shared path"
    )


def test_non_openrouter_providers_still_get_parallel_tool_calls() -> None:
    """The shared path is untouched: the pop is the LAST statement of the openrouter
    branch, so an OpenAI call still carries the parameter it always carried."""
    import inspect
    from app.services import openai_service
    src = inspect.getsource(openai_service.create_adaptive_streaming_chat)
    assert src.count('kwargs["parallel_tool_calls"] = False') == 1
    assert src.count('kwargs.pop("parallel_tool_calls", None)') == 1
    assert src.index('kwargs["parallel_tool_calls"] = False') < src.index(
        'kwargs.pop("parallel_tool_calls", None)'
    )


def test_the_routing_preference_list_is_the_one_the_retry_strips() -> None:
    assert set(_OPENROUTER_ROUTING_PREFERENCES) == {"provider", "plugins"}


def test_every_openrouter_registry_row_records_native_tools_false() -> None:
    """⚠ THE STANDING CONTRADICTION, PINNED SO IT CANNOT BE FORGOTTEN: the registry says
    every OpenRouter row is the NON-native tool path, and `resolve_calling_mode` attaches
    `tools` to them anyway under the `quality`/`native` strategies. That is why this 404 is
    reachable at all. If a row ever records True, this test fails and the retry above
    deserves re-reading."""
    from app.config import MODEL_CAPABILITIES
    rows = {k: v for k, v in MODEL_CAPABILITIES.items() if v.get("provider") == "openrouter"}
    assert rows, "positive control: there must be OpenRouter rows to check"
    offenders = {k for k, v in rows.items() if v.get("native_tools")}
    assert not offenders, "OpenRouter rows now claiming native tools: " + repr(sorted(offenders))
