# Phase 175: Cross-Provider Streaming Fidelity - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 9 modified + 4 new (tests) + 1 shared-helper edit
**Analogs found:** 13 / 13 (backend-only; every seam is an in-repo edit or has a sibling test)

> **Scope reminder (D-14 RED LINE):** every change below is **additive, boundary-scoped, default-inert**. Deep Mode / the shared `_normalize` chunk path / the shared `_on_chunk` consumer stay **byte-identical**. This is a modify-existing phase — the "closest analog" for each modified file is **the surrounding in-file convention the executor must match**, not a different file. Because it is backend-only, the `sketch-findings` UI skill is intentionally not consulted.

---

## Line-Drift Confirmation (opened + verified 2026-07-22)

Both drift notes the orchestrator flagged are **CONFIRMED against live source**:

| Claim | CONTEXT said | Actual (verified) | Verdict |
|-------|--------------|-------------------|---------|
| `_SUB_AGENT_MODEL_DEFAULTS` location | `config.py:693` | **`config.py:729`** (`:693` is now inside `get_model_capability`-adjacent code) | **DRIFT — use :729** |
| Top-level `reasoning_effort` in openai_service | (implied handling ~:1802-1816) | **NONE.** Only two hits, both INSIDE the DeepSeek `extra_body["thinking"]` block: comment `:1802`, value `:1816`. No top-level `reasoning_effort` anywhere. | **CONFIRMED — app never sets it (matches BUG-260711-02)** |

Other refs spot-checked and accurate: `resolve_calling_mode` `openai_service.py:1660`; DeepSeek enable-block `openai_service.py:1812-1817`; `client.chat.completions.create` `openai_service.py:1914`; `_strip_deepseek_tool_markup` `openai_compat.py:141-174`, `_DSML_OPENER` `:138`; `_infer_provider_for` `config.py:466`, `_INFERENCE_PATTERNS` `config.py:412-424`; `errors.py:188` bad_request copy; `thread_title.py` budget `:145`, title call `:154-159`, inline-await `:247`, fallback emit `:257`.

---

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog (pattern to copy) | Match |
|------|---------|------|-----------|----------------------------------|-------|
| `backend/app/config.py` | MOD | config/registry | transform (capability lookup) | existing `MODEL_CAPABILITIES` rows (`:247-385`) + `_SUB_AGENT_MODEL_DEFAULTS` (`:729`) | in-file |
| `backend/app/services/openai_service.py` | MOD | service/adapter | request-response (streaming) | `resolve_calling_mode` db_native gate (`:1680`) + DeepSeek enable-block (`:1812-1817`) | in-file |
| `backend/app/services/provider_gateway/openai_compat.py` | MOD | middleware/sanitizer | streaming/transform | `_strip_deepseek_tool_markup` (`:141-174`) + `_normalize` deepseek branch (`:314-319`) | in-file |
| `backend/app/services/thread_title.py` | MOD | service/utility | request-response | `generate_thread_title` request build (`:146-159`) + multi-model override (`:127-137`) | in-file |
| `backend/app/services/suggestion_service.py` | MOD | service/utility | request-response | override block (`:74-87`) — twin of thread_title's | in-file |
| `backend/app/services/task_service.py` | MOD | service/utility | transform (model resolution) | `_resolve_sub_agent_effective_model` (`:49-104`) | in-file |
| `backend/app/services/sub_agent_models.py` | MOD (shared D-03 home) | utility/helper | transform | `resolve_sub_agent_model_safely` (`:54-134`) | in-file |
| `backend/app/services/provider_gateway/errors.py` | MOD | utility/error-handling | transform | `_MESSAGES` + `classify_provider_error` + `ErrorKind` Literal | in-file |
| `backend/app/services/agent_loop.py` | MOD (Option B post-drain) | consumer/controller | streaming/event-driven | post-drain STRUCTURED block (`:2159`) + `_emit(...,'error',...)` (`:2291`) | in-file |
| `backend/tests/unit/test_reasoning_first_routing.py` | **NEW** | test | — | `backend/tests/test_149_native_tools_routing.py` | exact |
| `backend/tests/unit/test_utility_model_guard.py` | **NEW** | test | — | `backend/tests/unit/test_sub_agent_routing.py` | exact |
| `backend/tests/unit/test_title_reasoning_off.py` | **NEW** | test | — | `backend/tests/unit/test_threads_title_gen.py` | exact |
| `backend/tests/unit/test_dsml_leak_signal.py` | **NEW** | test | — | `backend/tests/unit/test_openai_compat_dsml_strip.py` | exact |

**Byte-frozen — DO NOT EDIT (map for reference only):** `backend/app/services/sub_agent_service.py` (D-085-16). Its inline list-membership guard (`:55-89`) is the ORIGINAL of the pattern `sub_agent_models.py` replicated. See "No Analog / Special Handling" below.

---

## Pattern Assignments

### `backend/app/config.py` (config/registry, transform) — XPROV-01, XPROV-04, D-03 fall-through

**Analog:** the existing `MODEL_CAPABILITIES` row shape + `_SUB_AGENT_MODEL_DEFAULTS`.

**Existing MODEL_CAPABILITIES row shape** (`config.py:247`, dict literal `MODEL_CAPABILITIES` starts `:239`). Every row is a flat dict of capability keys; `native_tools` and `provider` are always declared. This is where the D-01 `reasoning_first` marker and the D-05 `reasoning_off` marker land — **as NEW keys on existing rows**, never a code id-list ("by capability, not by name", D-122-04):
```python
# config.py:265-267 — the gpt-5.6 rows (XPROV-01 target; add "reasoning_first": True):
"gpt-5.6-sol":   {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, ..., "emit_tier": "force_strict"},  # flagship + max reasoning/ultra
"gpt-5.6-terra": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, ..., "emit_tier": "force_strict"},  # balanced everyday
"gpt-5.6-luna":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, ..., "emit_tier": "force_strict"},  # lightweight/fastest
```
> Note: all three gpt-5.6 rows are `native_tools: True` today → **100% unusable with tools** (the BUG-260714-01 symptom). D-01 adds `"reasoning_first": True` to route them STRUCTURED. **Design Q (flag in plan):** `reasoning_first` should sit ABOVE the `effective_native` resolution in `resolve_calling_mode` so an operator `db_native=True` does NOT re-trigger the 400 (hard OpenAI API constraint wins).

**XPROV-04 SAFE-provider default rows** — the `reasoning_off` marker attaches to the rows named by `_SUB_AGENT_MODEL_DEFAULTS` (the models title-gen actually calls). Per the RESEARCH verdict table, SAFE = `deepseek-v4-flash` (`:325`), `kimi-k2.6` (`:333`), `glm-5-turbo` (`:360`); **UNSAFE (do NOT mark)** = `MiniMax-M2.7-highspeed` (M2.x, `:348`) and `gemini-3.5-flash` (3.x, `:313`). Convergent shape for the 3 SAFE rows: `extra_body={"thinking":{"type":"disabled"}}` → mark e.g. `"reasoning_off": "thinking_disabled"`.

**`_infer_provider_for` + the regex table** (`config.py:466-480`, patterns `:412-423`) — the inference mechanism the D-03 guard consumes (no new regex table — reuse):
```python
_INFERENCE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^gpt-", re.IGNORECASE), "openai"),
    (re.compile(r"^claude-", re.IGNORECASE), "anthropic"),
    (re.compile(r"^gemini-", re.IGNORECASE), "google"),
    (re.compile(r"^deepseek-", re.IGNORECASE), "deepseek"),
    (re.compile(r"^kimi-", re.IGNORECASE), "moonshot"),
    (re.compile(r"^minimax-", re.IGNORECASE), "minimax"),
    (re.compile(r"^glm-", re.IGNORECASE), "zhipu"),
    (re.compile(r"^[^/\s]+/[^/\s]+"), "openrouter"),
]  # else → "ollama"
```

**`_SUB_AGENT_MODEL_DEFAULTS`** (`config.py:729` — **DRIFT-corrected**) — the D-03 fall-through target:
```python
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic": "claude-haiku-4-5-20251001", "openai": "gpt-5.4-mini",
    "google": "gemini-3.5-flash", "openrouter": "", "ollama": "",
    "deepseek": "deepseek-v4-flash", "moonshot": "kimi-k2.6",
    "minimax": "MiniMax-M2.7-highspeed", "zhipu": "glm-5-turbo",
}
```

---

### `backend/app/services/openai_service.py` (service/adapter, request-response) — XPROV-01

**Analog:** the `resolve_calling_mode` db_native short-circuit + the DeepSeek `extra_body` enable-block (the exact ENABLE form of what XPROV-04 writes in DISABLE form).

**The XPROV-01 gate site** — `resolve_calling_mode` (`:1660`). `cap` is resolved `:1662`; the `db_native is False` short-circuit `:1679-1681` is the template. Add the `reasoning_first` gate near the top, ABOVE `effective_native` (`:1698`):
```python
def resolve_calling_mode(model_id, user_settings=None) -> CallingMode:
    cap = get_model_capability(model_id)                 # :1662
    if cap.get("reasoning_first"):                       # ADD — XPROV-01 (above db_native)
        return CallingMode.STRUCTURED                    #   tools via XML, reasoning stays on, no 400
    db_native = _resolve_db_native_tools(model_id)       # :1679
    if db_native is False:                               # :1680 — existing short-circuit template
        return CallingMode.STRUCTURED
    ...
    effective_native = db_native if db_native is not None else cap["native_tools"]  # :1698
```
When STRUCTURED, the auto-path tool-attach branch hits `else: pass` (`:1909-1912`) → **no `tools`, no `reasoning_effort`** → no 400. `client.chat.completions.create(**kwargs)` at `:1914`.

**The DeepSeek enable-block** (`:1812-1817`) — proof the `extra_body.thinking` shape works in-repo; XPROV-04's title call writes the mirror-image DISABLE form:
```python
if (provider == "deepseek" or effective_model.startswith("deepseek-")) and force_tool_name is None:
    kwargs.setdefault("extra_body", {})
    kwargs["extra_body"]["thinking"] = {"type": "enabled", "reasoning_effort": "high"}  # :1814-1817
# XPROV-04 disable form is: {"type": "disabled"}
```

**Known boundary (note in plan, out of scope):** the `force_tool_name` path (`:1825-1864`) always attaches `tools` + a named `tool_choice` and does NOT consult `calling_mode` → a workflow/harness forcing a tool on a reasoning-first model could still 400. Deep chat uses `tool_choice="auto"` / `force_tool_name=None` → fixed by this phase. Forced-emission on reasoning-first = SEED-114 territory.

---

### `backend/app/services/provider_gateway/openai_compat.py` (middleware/sanitizer, streaming) — XPROV-02

**Analog:** the shipped `_strip_deepseek_tool_markup` (harden, don't rebuild) + the `_normalize` deepseek-gated branch.

**The strip** (`:141-174`, opener `:138`) — pure/side-effect-free; returns `(visible_out, new_pending, new_leaking)`:
```python
_DSML_OPENER = "<｜｜DSML｜｜"   # :138 — U+FF5C fullwidth pipe, NOT ASCII '|'
def _strip_deepseek_tool_markup(text, pending, leaking) -> tuple[str, str, bool]:
    if leaking: return "", "", True                       # drop-all once opener seen
    buf = pending + text
    idx = buf.find(_DSML_OPENER)
    if idx != -1: return buf[:idx], "", True              # prose before opener kept
    max_tail = min(len(_DSML_OPENER) - 1, len(buf))       # split-across-chunks tail
    for k in range(max_tail, 0, -1):
        if _DSML_OPENER.startswith(buf[-k:]): return buf[:-k], buf[-k:], False
    return buf, "", False
```

**The invocation site + per-stream state** — `_normalize` (deepseek-gated `:314-319`); state init `:229-230`:
```python
_dsml_leaking: bool = False   # :229
_dsml_pending: str = ""       # :230
...
if active_provider_name == "deepseek":                    # :314
    _visible, _dsml_pending, _dsml_leaking = _strip_deepseek_tool_markup(_visible, _dsml_pending, _dsml_leaking)
```

**The stream-end flush GAP (XPROV-02a — real, low-severity content-loss)** — the `for chunk in self._raw:` loop starts `:251` and ends before the usage yield `:431`. `_dsml_pending` is **never flushed** after the loop. Harden by adding a flush right after the loop, before/beside the usage yield:
```python
# AFTER the `for chunk in self._raw:` loop (~:427), before/beside the usage yield (:431):
if _dsml_pending and not _dsml_leaking:
    yield {"type": "delta", "content": _dsml_pending}     # ADD — XPROV-02a flush
```

**The finish event dict** (`:422-426`) — the additive carrier (Option A alternative). RESEARCH prefers **Option B** (below) so this hot per-chunk dict stays byte-identical:
```python
yield {"type": "finish", "finish_reason": _finish_reason, "tool_calls": _fin_tcs}  # :422-426
```

**XPROV-02b honest-incomplete signal (RECOMMENDED Option B)** — expose the leak via a mutable attr on the `_ClosableEventStream` instance (e.g. `self.dsml_leaked = True` set inside `_normalize` when leaking begins), read it in the **agent_loop post-drain block** (see agent_loop entry), emit the existing `error` SSE event. This edits neither the per-chunk `_on_chunk` nor the finish dict → strictly safer under D-14.

---

### `backend/app/services/thread_title.py` (service/utility, request-response) — XPROV-03 + XPROV-04

**Analog:** the file's own `generate_thread_title` request build + the multi-model override branch. This module was freshly extracted in Phase 162.5 and is **NOT on the hot-file ledger** (G-5 clear).

**The XPROV-03 seam — the unguarded multi-model override** (`:125-137`) — the root of BUG-260623-01 (no guard; sends `sub_agent_model` straight to whatever provider is active):
```python
else:   # multi-model providers  (:125)
    override = ((user_settings.sub_agent_model if user_settings else "") or settings.sub_agent_model)  # :127-130
    if override:
        model = override                                  # :132 — BLIND: no provider check → 404 → fallback banner
    else:
        model = (_SUB_AGENT_MODEL_DEFAULTS.get(provider, "") or ...)  # :134-137
```
> D-03 fix: wrap the raw `override` acceptance with the shared guard — `override = provider_safe_utility_model(user_settings, ...)` (helper home = `sub_agent_models.py`). Once cross-provider overrides are dropped BEFORE the call, no 404 → no `fallback_model` emit → no banner (suppress-when-fine is automatic, D-04).

**The XPROV-04 seam — the title call + budget** (`:145-159`) — inject the reasoning-off kwarg here, SAFE models only, budget + call otherwise byte-identical:
```python
_title_max_tokens = 160 if provider == "google" else 30   # :145 — MUST stay byte-identical (protects run-start latency)
token_param = "max_completion_tokens" if _uses_max_completion_tokens(model) else "max_tokens"  # :146
...
response = client.chat.completions.create(                # :154-159
    model=model, messages=title_messages, stream=False,
    **{token_param: _title_max_tokens},
    # ADD — XPROV-04 (SAFE models only): **_reasoning_off_kwargs
    #   thinking_disabled → extra_body={"thinking":{"type":"disabled"}}
    #   effort_none        → reasoning_effort="none"   (Google 2.5 only — current default is UNSAFE 3.x)
)
```

**The derived-fallback path that MUST stay intact for UNSAFE** (`:70-96`) — `_clean_llm_title` → `_derive_title_from_message`; also the `_strip_think_blocks` (`:50-67`). For UNSAFE providers (MiniMax M2.x, Gemini 3.x, Kimi k3) and for empty/refusal/`<think>`-only on ANY provider, these still fire exactly as today (no regression to the closed `title-generation-broken-...` fix):
```python
def _clean_llm_title(raw, first_user_message) -> str:     # :82
    cleaned = _strip_think_blocks(raw or "")
    cleaned = cleaned.strip().strip('"').strip("'").strip("*").strip()
    if (not cleaned or len(cleaned) > 60 or cleaned.startswith(("I ", "I'", "**", "Sorry", "As ", "<"))):
        return _derive_title_from_message(first_user_message)   # :95 — the honest fallback
    return cleaned
```

**The inline-await ordering — MUST stay byte-identical** (`maybe_autotitle_thread:247`, fallback emit before title emit `:256-262`):
```python
_title, _title_fallback = await run_in_threadpool(title_fn, first_message, user_settings, chat_model)  # :247
if _title_fallback:
    await emit(redis, run_id, 'fallback_model', **_title_fallback)   # :257 — fires BEFORE title
await emit(redis, run_id, 'title', content=_title)                  # :262
```

**Patch-surface gotcha (from the 162.5 extraction):** `generate_thread_title` resolves `get_llm_client` LATE via `from app.api.threads import get_llm_client` (`:111`) and is re-exported into `app.api.threads`. Tests patch `app.api.threads.get_llm_client` / `app.api.threads.generate_thread_title`. The new `test_title_reasoning_off.py` MUST follow this (see test entry).

---

### `backend/app/services/suggestion_service.py` (service/utility, request-response) — XPROV-03

**Analog:** its own override block (`:74-87`) — the exact twin of thread_title's unguarded pattern. Same D-03 fix (wrap with the shared guard):
```python
override_model = ((user_settings.sub_agent_model if user_settings else "") or settings.sub_agent_model)  # :74-77
if override_model:
    effective_model = override_model                      # :79 — BLIND (same gap as thread_title)
else:
    provider = user_settings.active_provider if user_settings else ""
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    effective_model = (provider_default or (user_settings.llm_model if user_settings else None) or settings.llm_model)  # :83-87
```

---

### `backend/app/services/task_service.py` (service/utility, transform) — XPROV-03

**Analog:** `_resolve_sub_agent_effective_model` (`:49-104`) — already routes through `resolve_sub_agent_model_safely` (`:84-88`) plus a narrow empty-`available_models` guard (`:92-103`). RESEARCH's **single most-leveraged edit**: fold the inferred-provider check INTO `resolve_sub_agent_model_safely` so task_service inherits it for free (no site edit needed here if the shared helper gains the gate):
```python
effective_model = resolve_sub_agent_model_safely(         # :84-88 — already the shared-helper caller
    user_settings, override_model=_user_sub_agent_model or None, fallback_model=ctx_model or None,
)
if (effective_model == settings.llm_model                 # :92 — existing empty-list guard (the pattern to extend)
    and provider not in ("openai", "openrouter", "ollama", "unknown")
    and _SUB_AGENT_MODEL_DEFAULTS.get(provider)):
    effective_model = _SUB_AGENT_MODEL_DEFAULTS[provider]  # :103
```

---

### `backend/app/services/sub_agent_models.py` (utility/helper, transform) — D-03 SHARED HOME

**Analog:** `resolve_sub_agent_model_safely` (`:54-134`) — the established shared home + sibling for the new guard. This is where the D-03 helper lands (either a new `provider_safe_utility_model` function OR an inferred-provider gate folded into the existing resolver — Claude's discretion per D-03). Current logic validates against `available_models` **list membership**, which is a **no-op when that list is empty** (fresh settings row) — the exact blind spot the inferred-provider check closes:
```python
def resolve_sub_agent_model_safely(user_settings, override_model=None, fallback_model=None) -> str:  # :54
    _active_provider = (user_settings.active_provider if user_settings else "") or ""   # :84
    _active_models = user_settings.available_models if (... available_models) else []    # :89-93 — EMPTY on fresh row
    _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")              # :95
    candidate = (override_model or (user_settings.llm_model if user_settings else None) or fallback_model or settings.llm_model)  # :101-106
    if _active_models_list and candidate not in _active_models_list:   # :111 — GAP: guarded by non-empty list
        if _provider_default: return _provider_default                # :118-119
        return candidate                                              # :130 — flexible-provider best-effort
    return candidate                                                  # :134 — empty-list passthrough (the leak)
```
> RESEARCH recommended new-function shape (Claude's discretion on signature/home). The inferred-provider check must fire **regardless of `available_models` population** and must **never block flexible providers** (`inferred == active or active in ("openrouter","ollama")` → pass):
```python
def provider_safe_utility_model(user_settings, override_candidate: str | None) -> str | None:
    active = (user_settings.active_provider if user_settings else "") or ""
    if not override_candidate: return None
    inferred = _infer_provider_for(override_candidate)
    if inferred == active or active in ("openrouter", "ollama"): return override_candidate
    return None   # cross-provider mismatch → caller falls through to _SUB_AGENT_MODEL_DEFAULTS[active]
```

---

### `backend/app/services/provider_gateway/errors.py` (utility/error-handling, transform) — XPROV-01 / D-04

**Analog:** `classify_provider_error` (`:117-170`) + `_MESSAGES` (`:175-199`) + `ErrorKind` Literal (`:64-72`) + `message_for_kind` (`:202-212`).

**The generic copy to replace/augment** (`:187-190`) — returned by `message_for_kind("bad_request")` for ANY 400 across ALL providers → **cannot** be blanket-rewritten to mention gpt-5.6:
```python
"bad_request": ("*Model parameter error — this model may not support the current configuration.*"),  # :187-190
```

**RECOMMENDED (D-04 option a): a narrow dedicated kind.** The 400 body carries the structured signature `"Function tools with reasoning_effort are not supported"` / `"use /v1/responses or set reasoning_effort to 'none'"`. Add an `ErrorKind` (e.g. `"reasoning_tools_unsupported"`) to the Literal (`:64-72`), a `_MESSAGES` entry (`:175`), and a narrow substring branch in `classify_provider_error` (`:151` — the `_OpenAIBadRequestError` branch). **Fixed copy, NO raw-detail interpolation** — the specific-kind rule at `message_for_kind` (`:210-212`) forbids interpolating raw detail (info-disclosure control). Because the D-01 fix PREVENTS this 400 for flagged models, this copy is defense-in-depth (fires only for a not-yet-flagged successor or an operator force-flip).

```python
ErrorKind = Literal["rate_limit","auth","billing","bad_request","server","context_overflow","unknown"]  # :64-72 — extend here
```

---

### `backend/app/services/agent_loop.py` (consumer/controller, event-driven) — XPROV-02b (Option B)

**Analog:** the post-drain STRUCTURED block (`:2159`) + the existing honest-fail `_emit(...,'error',...)` vocabulary (`:2291`).

**The post-drain hook site** — after `_drain_stream_with_close_on_cancel(stream, ...)` (`:2151-2156`), alongside the STRUCTURED `parse_structured_tool_calls` post-processing (`:2159-2190`). Read the leak flag off the `stream` instance and emit the existing `error` event (do NOT invent a new SSE type):
```python
await _drain_stream_with_close_on_cancel(stream, per_call_budget, _on_chunk, close_fn=stream.close)  # :2151-2156
# ADD — XPROV-02b (Option B, post-drain, deepseek-leak-only → byte-identical otherwise):
if getattr(stream, "dsml_leaked", False):
    await _emit(redis, run_id, 'error', message="The model tried to call a tool but wrote it as text, so it didn't run. Please retry.")
if calling_mode == CallingMode.STRUCTURED:               # :2159 — existing post-drain block
    structured_calls = parse_structured_tool_calls(full_content)
    ...
```

**The existing `error`-emit vocabulary to reuse** (`:2291`, also `:2777`, `:2789`):
```python
await _emit(redis, run_id, 'error', message='finish_reason=length during tool streaming')  # :2291 — same class of "graceful but incomplete"
```

---

## NEW Files — Test Pattern Assignments

### `backend/tests/unit/test_reasoning_first_routing.py` (XPROV-01)

**Analog:** `backend/tests/test_149_native_tools_routing.py` — the calling-mode routing test. Copy its structure: import `CallingMode, resolve_calling_mode`; assert `resolve_calling_mode(model, user_settings=None) is CallingMode.STRUCTURED`. Monkeypatch pattern for DB override already shown there (`_warm_cache`). Add cases: `reasoning_first` row → STRUCTURED; the `reasoning_first`-wins-over-`db_native=True` ordering (Open Q2); a non-5.6 row stays byte-identical.
```python
# analog excerpt to mirror (test_149_native_tools_routing.py:26-41):
def test_db_native_false_forces_structured(monkeypatch):
    _warm_cache(monkeypatch, {"gpt-5.4-mini": {"native_tools": False, "enabled": True, "provider": "openai"}})
    assert resolve_calling_mode("gpt-5.4-mini", user_settings=None) is CallingMode.STRUCTURED
def test_no_override_is_byte_identical(monkeypatch):
    _warm_cache(monkeypatch, {})
    assert resolve_calling_mode("gpt-4o", user_settings=None) is CallingMode.NATIVE
```

### `backend/tests/unit/test_utility_model_guard.py` (XPROV-03)

**Analog:** `backend/tests/unit/test_sub_agent_routing.py` — the provider-inference / sub-agent-model test. Copy its `SimpleNamespace` user-settings factory + `_SUB_AGENT_MODEL_DEFAULTS` assertions. Cases required by RESEARCH: cross-provider override dropped; same-provider override kept; flexible-provider (`openrouter`/`ollama`) passthrough; **empty-`available_models` case fires the inferred-provider guard** (the blind spot `resolve_sub_agent_model_safely` misses).
```python
# analog excerpt to mirror (test_sub_agent_routing.py:18-27):
def _make_user_settings(provider="anthropic", llm_model="claude-sonnet-4-6", sub_agent_model=""):
    return SimpleNamespace(active_provider=provider, llm_model=llm_model, sub_agent_model=sub_agent_model)
```

### `backend/tests/unit/test_title_reasoning_off.py` (XPROV-04)

**Analog:** `backend/tests/unit/test_threads_title_gen.py` — patches `app.api.threads.get_llm_client` and drives `generate_thread_title` via the re-exported `from app.api.threads import generate_thread_title`. Copy that patch surface exactly (the 162.5 late-import contract). Cases: SAFE model → reasoning-off kwarg injected (mock client, assert `create()` kwargs carry `extra_body={"thinking":{"type":"disabled"}}` or `reasoning_effort="none"`); UNSAFE model → NO reasoning-off param; empty response on a SAFE provider still derives (no regression); budget `_title_max_tokens` (30/160) + inline-await ordering unchanged.
```python
# analog excerpt to mirror (test_threads_title_gen.py:14-21):
from app.api.threads import generate_thread_title
with patch("app.api.threads.get_llm_client", side_effect=...):
    title, fallback_info = generate_thread_title(first_user_message="Hello world")
```

### `backend/tests/unit/test_dsml_leak_signal.py` (XPROV-02b)

**Analog:** `backend/tests/unit/test_openai_compat_dsml_strip.py` — the pure-filter `_feed` harness. Copy `_feed(chunks)` and the opener-split cases. New assertions: a detected leak surfaces a **single** `error` SSE event (Option B — assert the `stream.dsml_leaked` flag flips and the post-drain hook emits exactly one `error`). Also **extend** `test_openai_compat_dsml_strip.py` with the stream-end flush case (trailing `_dsml_pending` non-leaking fragment is flushed).
```python
# analog excerpt to mirror (test_openai_compat_dsml_strip.py:16-22):
def _feed(chunks):
    pending, leaking, out = "", False, []
    for c in chunks:
        vis, pending, leaking = _strip_deepseek_tool_markup(c, pending, leaking)
        out.append(vis)
    return "".join(out)
```

---

## Shared Patterns

### Capability-keyed request-shape control (XPROV-01 + XPROV-04)
**Source:** `MODEL_CAPABILITIES` rows (`config.py:239-385`), read via `get_model_capability(model_id)` at the adapter seam (`openai_service.py:1662`).
**Apply to:** the `reasoning_first` gate (`resolve_calling_mode`) and the `reasoning_off` marker (title call). **Never** branch on a model-id string in code (D-122-04). Precedent keys following this pattern: `native_tools`, `emit_tier`, `uses_max_completion_tokens`, `supports_parallel_tools`, `forced_emission`.

### Inferred-provider utility-model guard (XPROV-03)
**Source:** `_infer_provider_for` (`config.py:466`) + `_SUB_AGENT_MODEL_DEFAULTS` (`config.py:729`).
**Apply to:** all utility sites — `thread_title.py:127`, `suggestion_service.py:74`, `task_service.py` (via `resolve_sub_agent_model_safely`). Home for the shared helper = `sub_agent_models.py`. Fires regardless of `available_models` population; never blocks `openrouter`/`ollama`.

### Reuse the existing `error` SSE vocabulary (XPROV-02b)
**Source:** `_emit(redis, run_id, 'error', message=…)` (`agent_loop.py:2291`; helper `threads.py:202`).
**Apply to:** the honest-incomplete DSML-leak signal. Do NOT invent a new SSE event type — the frontend already renders `error` bubbles.

### `extra_body=` pass-through for provider-specific params
**Source:** the DeepSeek enable-block (`openai_service.py:1812-1817`) + the OpenRouter `plugins`/`provider` block (`openai_service.py:1901-1908`).
**Apply to:** XPROV-04 title reasoning-off (the DISABLE mirror of the enable-block) — `kwargs.setdefault("extra_body", {})` then set the provider param.

### Honest fixed-copy error messages (D-04)
**Source:** `_MESSAGES` + `message_for_kind` (`errors.py:175-212`).
**Apply to:** the new reasoning-tools-unsupported copy — fixed string, NO raw-detail interpolation (info-disclosure control at `:210-212`).

---

## No Analog / Special Handling

| File | Role | Reason |
|------|------|--------|
| `backend/app/services/sub_agent_service.py` | service (byte-frozen) | **D-085-16 byte-frozen — DO NOT EDIT.** Its inline list-membership guard (`:55-89`) is the ORIGINAL that `sub_agent_models.py` replicated. D-03 names it as 1 of 4 sites, but the leverage move is to fold the inferred-provider check into the SHARED `resolve_sub_agent_model_safely` (which task_service uses) rather than touch the frozen file. **Planner must resolve the D-03-vs-D-085-16 tension:** either get an explicit operator nod to edit it, OR document that its inline guard + provider-correct default already cover the populated-list case in practice. (RESEARCH Open Q3.) |

**Extend-existing (not net-new files):**
- `backend/tests/unit/test_openai_compat_dsml_strip.py` — add stream-end flush + (if RESEARCH A1 confirmed at UAT) alternate-opener coverage.
- Errors classification test — **no `test_errors.py` exists.** Provider-gateway tests live in `backend/tests/unit/test_provider_gateway_seam.py`; the executor either extends that file or creates `backend/tests/unit/test_errors.py` for the reasoning-tools-unsupported classification/copy.

---

## Metadata

**Analog search scope:** `backend/app/config.py`, `backend/app/services/openai_service.py`, `backend/app/services/provider_gateway/{openai_compat,errors}.py`, `backend/app/services/{thread_title,suggestion_service,task_service,sub_agent_models,sub_agent_service,agent_loop}.py`, `backend/tests/unit/`, `backend/tests/`.
**Files scanned:** 10 source files + 5 test files opened; line refs verified against live source.
**Pattern extraction date:** 2026-07-22
**Confidence:** HIGH — every seam is an in-file edit with the surrounding convention captured; every new test has an exact in-repo sibling.

---

## PATTERN MAPPING COMPLETE

**Phase:** 175 - cross-provider-streaming-fidelity
**Files classified:** 13 (9 modified + 4 new tests; 1 shared-helper edit in `sub_agent_models.py`; 1 byte-frozen reference)
**Analogs found:** 13 / 13

### Coverage
- Files with exact analog: 13 (backend-only; 9 in-file conventions + 4 sibling tests)
- Files with role-match analog: 0
- Files with no analog: 0 (1 byte-frozen file mapped for reference only)

### Key Patterns Identified
- Capability-keyed request-shape control — `reasoning_first` / `reasoning_off` markers on `MODEL_CAPABILITIES` rows, read at `resolve_calling_mode` + the title call ("by capability, not by name", D-122-04).
- Inferred-provider utility-model guard — one shared helper in `sub_agent_models.py` over `_infer_provider_for` + `_SUB_AGENT_MODEL_DEFAULTS`, applied at 3 editable sites (4th is byte-frozen).
- Boundary-only + default-inert (D-14) — DSML flush is deepseek-gated; the honest-leak signal reuses the existing `error` SSE event via an Option-B post-drain hook (no per-chunk edit); the reasoning-off title param is an additive `extra_body` kwarg for SAFE models only.

### Line-Drift Report
- `_SUB_AGENT_MODEL_DEFAULTS` → **config.py:729** (CONTEXT :693 was stale — corrected).
- **No top-level `reasoning_effort` in openai_service.py** — only inside the DeepSeek `extra_body["thinking"]` block (`:1812-1817`), confirming BUG-260711-02's claim the app never sets it.

### File Created
`.planning/phases/175-cross-provider-streaming-fidelity/175-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns + verified line numbers in PLAN.md files.
