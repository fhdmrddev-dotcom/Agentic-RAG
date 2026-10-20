# Phase 282: The Slow Run and the Paused Run - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 27 (19 modified, 8 new incl. tests)
**Analogs found:** 26 / 27 (the draft store has no sibling store test; it copies the `streamsStore.ts` idiom)

Plan grouping follows D-18: **01 = FIX-06** (backend clients + bound + Registry), **02 = FIX-07** (draft store + stack + chips), **03 = live board / G-4** (no source files). 01 and 02 share no files.

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `backend/app/config.py` (constants, `llm_max_retries_for`, DB-tier clamp, ceiling 1800, boot validator) | 01 | config | transform | itself: `_parse_llm_call_timeout_overrides` bound check (:810-833) + `_validate_run_stale_sweep_bounds` (:1439-1466) | exact |
| `backend/app/services/openai_service.py` (`get_llm_client` kwargs, `create_adaptive_streaming_chat` forward, `get_embedding_client` constants) | 01 | service (client builder) | request-response | itself :1448-1486 / :1489-1498 / :2199-2219 | exact |
| `backend/app/services/anthropic_service.py` (`stream_anthropic` + `timeout_s`) | 01 | service (client builder) | streaming | itself :151-169 | exact |
| `backend/app/services/google_service.py` (`stream_google` + `timeout_s`) | 01 | service (client builder) | streaming | itself :396-415 (mirror of anthropic) | exact |
| `backend/app/services/provider_gateway/dispatcher.py` (`GatewayRequest.timeout_s`, off-loop open + shared deadline) | 01 | gateway / router | streaming | itself :41-89 (additive-field precedent `force_tool_name`) + agent_loop drain helper (`run_in_executor` + close-on-cancel) | exact |
| `backend/app/services/provider_gateway/openai_compat.py` | 01 | adapter | streaming | itself :497-525 (forcing kwargs forwarded) | exact |
| `backend/app/services/provider_gateway/openai_responses.py` | 01 | adapter | streaming | itself :543-563 | exact |
| `backend/app/services/provider_gateway/anthropic.py` | 01 | adapter | streaming | itself :80-124 | exact |
| `backend/app/services/provider_gateway/google.py` | 01 | adapter | streaming | itself :70-106 | exact |
| `backend/app/services/agent_loop.py` (+`timeout_s=` ×2, drain helper reads `budget_deadline`) | 01 | service (loop) | streaming | itself :521-618, :2553, :2637 | exact |
| `backend/app/services/forced_emit.py` (`_build_request` kwarg) | 01 | service | request-response | itself :280-320 | exact |
| `backend/app/services/task_service.py` (`timeout_s=` at build site) | 01 | service | request-response | itself :300 + agent_loop :2536 resolve | exact |
| `backend/app/services/run_producer.py` (timed_out sentence) | 01 | service | event-driven | itself :866-886 | exact |
| `backend/app/api/admin.py` (timeout-specific 422 sentence) | 01 | controller | request-response | itself :1489-1497 + `test_242_stored_value_refusal.py` sentence precedent | exact |
| `frontend/src/lib/api/admin.ts` (`MODEL_CAP_INT_BOUNDS` 3600→1800) | 01 | utility (client mirror) | — | itself :600-604 | exact |
| `frontend/src/components/admin/ModelRegistryTab.tsx` (help row while editing Timeout) | 01 | component | request-response | itself: in-row refusal `<tr data-model-error>` :586-595, `NumericCell` :688-750 | exact |
| `backend/tests/unit/test_282_client_timeouts.py` (new) | 01 | test | — | `tests/unit/test_provider_gateway_seam.py` (monkeypatch adapters) | role-match |
| `backend/tests/unit/test_282_open_off_loop.py` (new) | 01 | test | streaming | `test_provider_gateway_seam.py` :148-165 (real `open_stream`) | role-match |
| `backend/tests/unit/test_282_slow_stub_scaled.py` (new) | 01 | test (real socket) | streaming | research probe `scratchpad/d05_block_probe.py` (no in-repo `HTTPServer` test exists) | partial |
| `backend/tests/unit/test_282_timeout_bound.py` (new) | 01 | test | request-response | `tests/unit/test_242_stored_value_refusal.py` | exact |
| `frontend/src/stores/askDraftStore.ts` (new) | 02 | store | event-driven (pub-sub on `pendingAsksByThread`) | `frontend/src/stores/streamsStore.ts` :36-38, :475 + `StreamsProvider.tsx` :3977 subscribe | role-match |
| `frontend/src/stores/__tests__/askDraftStore.test.ts` (new) | 02 | test | — | `streamsProvider_244_settle_ask.test.tsx` `beforeEach` store seeding :184-201 | partial |
| `frontend/src/components/panel/PendingAskCard.tsx` (draft out, `home` prop, pointer, radio keyboard, radio mark) | 02 | component | event-driven | itself :274-722 (card), :729-834 (stack) | exact |
| `frontend/src/components/panel/WorkspacePanel.tsx` (`home="panel"`) | 02 | component | — | itself :436-440 | exact |
| `frontend/src/setupTests.ts` (global `afterEach(resetAskDrafts)`) | 02 | config (test) | — | itself (8 lines, `expect.extend`) | exact |
| `frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx` (new) | 02 | test | — | `panel/__tests__/PendingAskCard.test.tsx` provider-mock header :1-110 | exact |
| `frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx` (pin 837) + `scripts/vitest-count-gate.cjs` | 02 | test / gate | — | itself :238; gate :3139 / :5448 | exact |
| `frontend/src/pages/WorkflowRunPage.tsx` | 02 | — | — | **NOT edited** (card reads the store by `ask.tool_call_id`; :1638 mount unchanged) | n/a |

---

## Pattern Assignments — Plan 01 (FIX-06)

### `backend/app/config.py` (config, transform)

**Self-hosted table — the ONE predicate home** (lines 79-83). The new `llm_max_retries_for` sits directly beneath it and does a membership test only (no second list):
```python
_SELF_HOSTED_PROVIDERS: dict[str, dict[str, object]] = {
    "ollama":   {"url_field": "ollama_base_url",   ...},
    "lmstudio": {"url_field": "lmstudio_base_url", ...},
    "custom":   {"url_field": "custom_base_url",   ...},
}
```

**Bound constants** (lines 743-751) — change `_LLM_CALL_TIMEOUT_MAX_S = 3600` → `1800`; put the reason string and the new `NO_BUDGET_LLM_TIMEOUT_S` / `NO_BUDGET_LLM_MAX_RETRIES` / `LLM_CONNECT_TIMEOUT_S` constants beside them (below every caller, no import cycle — R4):
```python
# T-066-05 mitigation: lower / upper bounds for the
# LLM_CALL_TIMEOUT_OVERRIDES env-var parser. ...
_LLM_CALL_TIMEOUT_MIN_S: int = 1
_LLM_CALL_TIMEOUT_MAX_S: int = 3600
```

**Clamp + log pattern to copy into the DB tier** (from the env parser, lines ~822-829) — D-08 uses this exact shape on `int(db_timeout)` at line ~853 (currently `return int(db_timeout)` unclamped):
```python
        if val < _LLM_CALL_TIMEOUT_MIN_S or val > _LLM_CALL_TIMEOUT_MAX_S:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: ignoring out-of-range value for %r: %d "
                "(must be in [%d, %d])",
                model_id, val, _LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S,
            )
```
DB tier today (lines ~846-853) — the line to wrap:
```python
        db_cap = db_overrides.get(model_id)
        if db_cap is not None:
            db_timeout = db_cap.get("llm_call_timeout_seconds")
            if db_timeout is not None:
                return int(db_timeout)
```
Note: D-08 says **clamp** (min/max), unlike the env parser which **drops**. Log at warning with model id + raw value.

**Boot validator to copy** (lines 1439-1466, `@model_validator(mode="after")` on `Settings`). Add a sibling check — `run_stale_sweep_timeout_seconds > _LLM_CALL_TIMEOUT_MAX_S + run_stale_sweep_interval_seconds` (2400 > 1800 + 120) — either inside this method or as a sibling validator in the same style:
```python
    @model_validator(mode="after")
    def _validate_run_stale_sweep_bounds(self) -> "Settings":
        ...
        if self.run_stale_sweep_timeout_seconds < self.ask_user_max_timeout_seconds:
            raise ValueError(
                f"run_stale_sweep_timeout_seconds ({self.run_stale_sweep_timeout_seconds}) "
                "must be >= ask_user_max_timeout_seconds "
                f"({self.ask_user_max_timeout_seconds}) — a lower threshold would "
                "false-kill a legitimately-waiting ask_user run (D-145-07)."
            )
        return self
```
The binding bound it guards is documented at lines 1322-1334 (`run_stale_sweep_timeout_seconds: int = 2400`, "MUST EXCEED the longest legit SILENT gap").

---

### `backend/app/services/openai_service.py` (service, client builder)

**Analog:** itself, `get_llm_client` lines 1448-1486. Values go into `kwargs` **before** `OpenAI(**kwargs)` (line 1462) — never `with_options` after `wrap_openai` (line 1474):
```python
def get_llm_client(user_settings: UserEffectiveSettings | None = None) -> OpenAI:
    if user_settings is not None:
        kwargs: dict = {"api_key": user_settings.llm_api_key}
        if user_settings.llm_base_url:
            kwargs["base_url"] = user_settings.llm_base_url
        provider = user_settings.active_provider or "openai"
    else:
        kwargs = {"api_key": settings.llm_api_key}
        ...
    client = OpenAI(**kwargs)
    if settings.langsmith_api_key:
        try:
            from langsmith.wrappers import wrap_openai
            client = wrap_openai(client, chat_name=f"Chat{provider.title()}")
```
New signature (R4): `def get_llm_client(user_settings=None, *, timeout_s: float | None = None, max_retries: int | None = None)`. `None` → `NO_BUDGET_LLM_TIMEOUT_S` / `NO_BUDGET_LLM_MAX_RETRIES`. Shape: `httpx.Timeout(t, connect=min(LLM_CONNECT_TIMEOUT_S, t))` (D-02).

**Forwarding site** — `create_adaptive_streaming_chat` (line 2199-2219) gains `timeout_s: float | None = None` after `strict_response_format` (same additive-kwarg pattern as `force_tool_name`), and calls `get_llm_client(user_settings, **({...} if timeout_s is not None else {}))` at line 2219. ⚠ Forward **only when set** so the two lambda fakes keep working: `test_111_1_no_mangle_local.py:43` (`lambda us=None`) and `test_gateway_forcing.py:296` (`lambda user_settings=None`).

**`get_embedding_client`** (lines 1489-1498) — same two kwargs into its `OpenAI(**kwargs)` (D-23). `vision_text.py` / `multimodal_service.py` are deferred (D-23).

---

### `backend/app/services/anthropic_service.py` + `google_service.py` (service, streaming)

**Analog:** `stream_anthropic` signature + constructor (lines 151-169):
```python
@_ls_traceable(name="ChatAnthropic", run_type="llm")
def stream_anthropic(
    messages: list[dict],
    tools: list[dict],
    system_prompt: str,
    model: str,
    api_key: str,
    max_tokens: int,
    force_no_tools: bool = False,
    tool_choice: dict | None = None,
) -> Generator[dict, None, None]:
    ...
    client = anthropic.Anthropic(api_key=api_key)
```
Add `timeout_s: float | None = None` last (same additive pattern as the `tool_choice` seam). Per R4, extract a tiny builder `_anthropic_client(api_key, timeout_s)` so D-09 part 1 reads `.timeout` / `.max_retries` off a **real built client**; the generator body stays lazy (client built on first `next()` in the producer thread — do NOT move it).

`stream_google` (lines 396-415) is the mirror: `client = genai.Client(api_key=api_key)` → `_google_client(api_key, timeout_s)` returning `genai.Client(api_key=, http_options=types.HttpOptions(timeout=int(t*1000)))` when `t` set, else today's bare call. ⚠ never pass `timeout=0` (genai treats it as no timeout). No `retry_options` (1 attempt, D-03).

---

### `backend/app/services/provider_gateway/dispatcher.py` (gateway, streaming)

**`GatewayRequest` additive field** — copy the 101.1 precedent (lines 77-89): a trailing field with a safe default plus a comment explaining byte-identity for callers that do not set it:
```python
    force_tool_name: str | None = None
    strict_schema: bool = False
```
→ add `timeout_s: float | None = None` last.

**Off-loop open, else-branch only** (lines 157-196). Anthropic/Google branches (lines 149-156) stay untouched — they are already lazy. The sync body to move into a thread is:
```python
        _surface = resolve_api_surface(_effective_model, request.user_settings)
        if _surface is not None:
            return _open_surface_stream(_surface, request)

        from .openai_compat import open_openai_compat_stream

        return open_openai_compat_stream(request)
```
Wrap with `asyncio.to_thread` (not `run_in_executor` — contextvars / LangSmith), under `asyncio.timeout_at(deadline)` + `asyncio.shield`, a late-close done-callback, and `stream.budget_deadline = deadline` guarded by `try/except AttributeError` (Pitfall 9). Code sketch: RESEARCH §Code Examples 2.

**Close-on-cancel precedent to mirror** (agent_loop.py lines 594-613) — non-fatal close + `logger.debug(..., exc_info=True)`:
```python
    except (asyncio.TimeoutError, asyncio.CancelledError):
        try:
            (close_fn or stream.close)()
        except Exception:
            logger.debug(
                "stream close raised during Track A drain cancel — non-fatal",
                exc_info=True,
            )
```
⛔ Module docstring rule (lines 20-24): dispatcher must never import `agent_loop` / `threads.py`.

---

### Gateway adapters (adapter, streaming)

- **`openai_compat.py`** (lines 516-525): add `timeout_s=request.timeout_s` to the `create_adaptive_streaming_chat(...)` call alongside `force_tool_name=request.force_tool_name, strict_response_format=request.strict_schema`. Return shape (`_ClosableEventStream`) unchanged (RED LINE :45-57).
- **`openai_responses.py`** (line 553): `client = get_llm_client(request.user_settings)` → forward `timeout_s` / `max_retries=llm_max_retries_for(request.active_provider_name)` only when `request.timeout_s is not None`.
- **`anthropic.py`** (lines 115-124) and **`google.py`** (lines 97-106): add `timeout_s=request.timeout_s` to the `stream_anthropic(...)` / `stream_google(...)` kwargs. Existing fakes are `**kwargs` (`test_provider_gateway_seam.py:189,249`), so they absorb it.

---

### `backend/app/services/agent_loop.py` (loop, streaming)

**GatewayRequest sites** (lines 2553 and 2637) — `per_call_budget` is already resolved at :2536 / :2604; add one line `timeout_s=per_call_budget,` to each constructor. Nothing else at the call sites moves (roadmap fence).

**Drain helper** (lines 588-593) — the only body change (option A, D-20):
```python
    producer_fut = loop.run_in_executor(None, _producer)

    try:
        async with asyncio.timeout(timeout_seconds):
            while True:
                chunk = await q.get()
```
⚠ **SOURCE FENCE ON THIS EXACT LITERAL:** `backend/tests/integration/test_061_hard_timeout.py:105` asserts `"async with asyncio.timeout(timeout_seconds)" in agent_loop_src`. RESEARCH §Code Example 3 (`cm = ... ; async with cm:`) **removes that literal and reds the fence**. Planner must either keep the literal in the no-deadline arm (e.g. `if deadline is None: async with asyncio.timeout(timeout_seconds): ...` is awkward — prefer an `AsyncExitStack`/conditional that still contains the literal text) or edit the fence deliberately in the same commit with a recorded reason. The same file also pins `count("async def _drain_stream_with_close_on_cancel(") == 1` and `count("await _drain_stream_with_close_on_cancel(") >= 2` — both unaffected.

---

### `backend/app/services/forced_emit.py` / `task_service.py` (service, request-response)

`forced_emit._build_request` (lines 280-320) builds two `GatewayRequest(...)` arms; add `timeout_s: float | None = None` to `_build_request` and pass `timeout_s=timeout_s` in **both** arms. `forced_emit()` resolves once via `await get_per_call_timeout_async(model, settings)` before the rung loop. Fence: `test_forced_emit.py:602` asserts `src.count("_build_request(") == 1` — do not add a second call.

`task_service.py` (line ~300) — copy agent_loop's resolve line verbatim at the build site:
```python
per_call_budget = await get_per_call_timeout_async(_model_id, settings)
```
then `timeout_s=...` on the existing `GatewayRequest(... tool_choice="auto",)`.

---

### `backend/app/services/run_producer.py` (event-driven)

**Analog:** itself, lines 866-886. Keep the prefix byte-identical (`test_066_terminal_classification.py:116` asserts `error.startswith('timed_out:')`; frontend `categorizeError` matches `/timed?\s*out/`). Append the D-04/D-22 sentence after the existing string:
```python
            _terminal_status = "timed_out"
            _terminal_error = (
                f"timed_out: {_last_per_call_budget}s per-call deadline "
                f"exceeded at iteration {_last_iteration} "
                f"(model={_last_model_id})"
            )
```
⚠ Copy discrepancy for the planner to resolve: UI-SPEC says `"{model} did not answer within {N} s, the timeout set for it in the Model Registry."`; RESEARCH R5 warns "set for it in the Model Registry" is false when the value came from env/static/default and suggests "change it in Model Registry → Timeout". UI-SPEC is the approved contract; record whichever is chosen. The `timed_out` arm is not truncated (only the `failed:` arm is, :902 / :1080).

---

### `backend/app/api/admin.py` (controller, request-response)

**Analog:** itself, PATCH validation lines 1489-1497 (bound imported at :37-38, dict at :228):
```python
            _lo, _hi = _MODEL_CAP_INT_BOUNDS[col]
            if not (_lo <= val <= _hi):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{col}' must be between {_lo} and {_hi} (inclusive), or null.",
                )
```
For `col == "llm_call_timeout_seconds"` only, the detail becomes the UI-SPEC sentence: `Timeout must be between {min} and {max} seconds, because {reason}. {value} was not saved.` — `{reason}` imported from the constant beside `_LLM_CALL_TIMEOUT_MAX_S` in `config.py` (no third copy of the number). Other int columns keep today's sentence.

---

### `frontend/src/lib/api/admin.ts` (client mirror)

Lines 600-604 — the one client copy of the bound:
```ts
export const MODEL_CAP_INT_BOUNDS: Readonly<Record<string, readonly [number, number]>> = {
  llm_call_timeout_seconds: [1, 3600],
```
→ `[1, 1800]`. Refusal transport already exists: `setModelCapability` (811-822) throws `new ApiError(await errorDetail(res, ...), res.status)` and `errorDetail` (468-476) returns the string `detail`. No change there.

---

### `frontend/src/components/admin/ModelRegistryTab.tsx` (component)

**Refusal display — reuse unchanged** (lines 586-595):
```tsx
      {errorDetail && (
        <tr data-model-error={id}>
          <td colSpan={NUM_FIELDS.length + 6} className="border-t-0 px-4 pb-2">
            <span className="text-[11px] font-medium text-destructive" role="alert">
              {errorDetail}
            </span>
          </td>
        </tr>
      )}
```
**Help row** — same `<tr><td colSpan={NUM_FIELDS.length + 6}>` shape, rendered **above** the error row only while `editing === "llm_call_timeout_seconds"` (the `editing` state already drives `NumericCell` at :468-481). Span: `id="timeout-help-{id}" data-testid="timeout-help" className="text-[11px] leading-4 text-muted-foreground"`. Text from one exported constant interpolating `MODEL_CAP_INT_BOUNDS.llm_call_timeout_seconds`. D-22 wording wins over the UI-SPEC row: `Between {min} and {max} seconds. Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times.`

**`NumericCell` input** (lines 731-745) — add `aria-describedby` only for the timeout field; it needs the model id, which is already a prop (`modelId`):
```tsx
      <input
        ref={inputRef}
        type="number"
        aria-label={`${field.label} for ${modelId}`}
        defaultValue={value === null ? "" : String(value)}
```
No client pre-block (UI-SPEC: the server sentence is what the operator reads).

**Test analog:** `ModelRegistryTab.test.tsx:174-191` (409 in-row) — copy for the 422 case: `mockRejectedValue(new ApiError("<sentence>", 422))`, edit the Timeout cell, assert `findByText` + `role="alert"`. Count-gate pin `ModelRegistryTab.test.tsx: 29` (:129) moves in the same commit.

---

### Backend tests (Plan 01)

- **`test_282_timeout_bound.py`** — copy `test_242_stored_value_refusal.py` structure: module docstring stating what was wrong, `import pytest`, classes per claim, `@pytest.mark.asyncio` class for async cases, `monkeypatch` the loader (`_load_model_overrides`) rather than seeding a DB row (lines 23-26 explain why).
- **`test_282_client_timeouts.py`** / **`test_282_open_off_loop.py`** — copy `test_provider_gateway_seam.py`: `from app.services.provider_gateway import ...`, async test functions with `monkeypatch.setattr(_module, "name", fake, raising=False)` (:154-165), and real `await open_stream(provider, _mk_request(provider))`.
- **`test_282_slow_stub_scaled.py`** — no in-repo `HTTPServer` test exists (grep empty). Use the research probe shape (`ThreadingHTTPServer` on 127.0.0.1, monkeypatch `openai._base_client.DEFAULT_TIMEOUT`); label SCALED in the docstring (D-09).
- `test_066_terminal_classification.py` and `test_061_hard_timeout.py` must stay green (see fence above).

---

## Pattern Assignments — Plan 02 (FIX-07)

### `frontend/src/stores/askDraftStore.ts` (new store, pub-sub)

**Analog:** `frontend/src/stores/streamsStore.ts` — the only zustand store. Imports (lines 36-37) and creation (line 475):
```ts
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
...
export const useStreamsStore = create<StreamsState>()(subscribeWithSelector(() => ({
```
**Stable empty reference** — copy `StreamsProvider.tsx:150-160` (`const EMPTY_ASKS: PendingAsk[] = []`, "returns the SAME stable reference, so useSyncExternalStore skips re-render") → module-level `EMPTY_DRAFT`, never a fresh `{}` from a selector.

**GC subscription** — copy the provider's own `subscribeWithSelector` usage (`StreamsProvider.tsx:3977-3990`), but at module load (no `useEffect`, so StreamsProvider is not edited):
```ts
    const unsubscribe = useStreamsStore.subscribe(
      (s) => s.streamingThreads,
      (next) => {
        const { stoppingThreads, ... } = useStreamsStore.getState()
        ...
```
→ selector `(s) => s.pendingAsksByThread`, listener drops drafts whose `tool_call_id` is no longer in any thread's list. Shape: RESEARCH §Code Example 4. Exports: `useAskDraft(id)`, actions (`setChoice`, `setFreeText`, `clearDraft`, `addPanelHome`, `removePanelHome`), a settled marker for the pointer (UI-SPEC: pointer renders nothing once settled), and `resetAskDrafts()`.

⛔ Not in `streamsStore.ts` (FIRES, D-12). ⚠ New file → ledger row + `docs/HOT-FILE-LEDGER.md` section in the same commit (D-25).

---

### `frontend/src/components/panel/PendingAskCard.tsx` (component, FIRES)

**Imports** (lines 36-55) — add the store import next to the existing direct-store import, which is the documented exception:
```ts
import { useEffect, useMemo, useRef, useState } from "react"
...
// Phase 244-15 (G-8): the STORE, deliberately — not a provider hook. ...
import { useStreamsStore } from "@/stores/streamsStore"
```
`useLayoutEffect` joins the react import. ⛔ No new `@/providers/StreamsProvider` import: eight suites mock it with an allow-list factory (comment at :787-795).

**State to move out** (lines 291-292) — these two `useState`s leave; the other 7 stay (R8: 9 → 7):
```ts
  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [freeText, setFreeText] = useState("")
```
Every downstream read (`hasChoice`/`hasText` :350-352, `selectedValue` :356-359, `handleSubmit` :361-375) keeps its name, now sourced from `useAskDraft(tool_call_id)`. Clear-on-answer goes in the success arm right after `setState("answered")` (:379); clear-on-expiry beside `setState("expired")` (:332, :409, :430). ⛔ Never in a `catch` arm for non-expiry failures (refused answer must stay answerable — :388-390 rule).

**Chips to extend** (lines 630-654) — keep `role="radiogroup"` / `role="radio"` / `aria-checked` / toggle `onClick`; add roving `tabIndex`, `onKeyDown` (Arrows move+select+focus with wrap and `preventDefault`; `" "` intercepted to select-only), a refs array, `flex items-center gap-2`, the `aria-hidden` radio mark as first child, and focus ring `ring-2 ring-offset-2` (UI-SPEC Surface 2):
```tsx
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
          {options.map((opt, i) => {
            const selected = choiceIndex === i
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoiceIndex(selected ? null : i)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  "min-h-[44px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
```

**Pending root** (lines 577-581) — add `data-ask-card={tool_call_id}` and `data-ask-home={home}` so the pointer can locate the panel card (R8):
```tsx
    <div
      className="flex flex-col gap-2 rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] p-3"
      role="group"
      aria-labelledby={labelId}
    >
```
**Label/pip to copy for the pointer** (lines 583-588) — the pointer reuses this token set but with a static pip (no `animate-dotBounce`) and **no** `aria-live`:
```tsx
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warning))]">
        <span className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--warning))] animate-dotBounce" aria-hidden="true" />
        <span aria-live="assertive">Needs you</span>
```

**Stack** (lines 729-834) — `export function PendingAskStack()` → `PendingAskStack({ home = "chat" }: { home?: "chat" | "panel" })`. Panel home registers in `useLayoutEffect` (`addPanelHome(threadId)` / cleanup `removePanelHome`). Chat home: if `panelHomes[threadId] > 0` render one pointer per ask inside the **same** per-ask wrapper, else today's card. The early return and wrapper stay as is:
```tsx
  if (asks.length === 0) return null
  ...
    <div className="flex flex-col gap-2">
      {ordered.map((ask) => (
        <div key={ask.tool_call_id} className="sticky top-0 z-[4]">
          <PendingAskCard ask={ask} reconcile={reconcile} runIsOver={runIsOver} onAnswered={settleAnswered} ... />
```
⚠ Hooks must run before the `asks.length === 0` early return (the layout effect included). Pointer classes / copy / `ask-pointer*` test ids: UI-SPEC Surface 1, verbatim. XSS: prompt and options render as plain React text (T-087-11).

**Same-commit obligations:** `PendingAskCard.retired.baseline.test.tsx:238` `toBe(837)` → new `split("\n").length`; `scripts/vitest-count-gate.cjs` per-file counts (`"PendingAskCard.test.tsx": 45` :3139 etc.) and run-list entries (`"src/components/panel/__tests__/PendingAskCard.test.tsx",` :5448) for every new suite.

---

### `frontend/src/components/panel/WorkspacePanel.tsx`

Lines 436-440 — the mount **condition** stays byte-identical; only the prop is added:
```tsx
      {pendingAsks.length > 0 && (
        <div className="border-b border-border/40 p-2">
          <PendingAskStack />
        </div>
      )}
```
→ `<PendingAskStack home="panel" />`. `MessageItem.inlineApproval` 6c fence still finds `<PendingAskStack` here and exactly one in `MessageList.tsx` (:330, untouched).

---

### `frontend/src/setupTests.ts`

Current file is 8 lines (`import "@testing-library/jest-dom"`, axe matchers, `expect.extend`). Add `import { afterEach } from "vitest"` (already imports `expect` from vitest) and `afterEach(() => resetAskDrafts())`. Needs a ledger row (D-25; not exempt by the gate's regexes).

---

### `PendingAskStack.oneInput.test.tsx` (new test)

**Analog:** `panel/__tests__/PendingAskCard.test.tsx` lines 1-110 — copy the three mocks verbatim: `@/lib/supabase`, partial `@/lib/api` (real `ApiError` via `importActual`, `answerAskUser: vi.fn()`), and the allow-list `@/providers/StreamsProvider` factory (`useViewingThread`, `useAskUserPrompt` → `hookState.asks`, `useWorkflowLockForThread`, `usePhases`). Render `<PendingAskStack home="panel" />` + `<PendingAskStack />` together; assert `getAllByRole("button", { name: "Send Answer" }).length === 1`, `aria-checked` / pointer draft agreement, rail (unmount panel stack) mid-draft, and `document.activeElement` inside `[data-ask-home="panel"]` after clicking `ask-pointer-go`. Store reset comes from the global `afterEach`.

**Store-seeding analog for `askDraftStore.test.ts`:** `streamsProvider_244_settle_ask.test.tsx:184-201` — `useStreamsStore.setState({ ..., pendingAsksByThread: new Map() })` in `beforeEach`; then `setState` a map without the id and assert the draft is gone (GC).

Fences that must stay green **unedited**: `MessageItem.inlineApproval` 6c / W2 / 5 / W5, `Seam.test.tsx:84-88`, `streamsProvider_244_settle_ask` 9-12 (Test 11→12 leak is cleared by the GC because its `beforeEach` resets `pendingAsksByThread`).

---

## Shared Patterns

### Additive kwarg with a safe default (byte-identity for untouched callers)
**Source:** `dispatcher.py:77-89` (`force_tool_name` / `strict_schema`), `anthropic_service.py:159` (`tool_choice: dict | None = None`), `openai_service.py:2206-2207`.
**Apply to:** `GatewayRequest.timeout_s`, `stream_anthropic` / `stream_google` / `create_adaptive_streaming_chat` / `_build_request` `timeout_s`, `get_llm_client` keyword-only params. Always last, always defaulted, and forwarded only when not `None`.

### One home per number
**Source:** `admin.py:37-38, 228` imports `_LLM_CALL_TIMEOUT_MAX_S`; `admin.ts:600-604` is the single client mirror.
**Apply to:** the ceiling (1800), the 422 reason string, the help line (interpolates `MODEL_CAP_INT_BOUNDS`), the retry predicate (`_SELF_HOSTED_PROVIDERS` only). No literal `1800` in copy.

### Non-fatal close / never crash the surface
**Source:** `agent_loop.py:594-613` (backend), `PendingAskCard.tsx:391-399` guarded `onAnswered` (frontend).
**Apply to:** dispatcher late-close callback; pointer `Answer in panel →` when the panel card is absent (no-op, no throw).

### Direct store access instead of provider hooks in the ask components
**Source:** `PendingAskCard.tsx:51-53, 787-803`.
**Apply to:** `askDraftStore` reads/writes from the card and stack; never a new provider-hook import.

### G-5 ledger discipline
**Source:** `docs/HOT-FILE-LEDGER.md` scan list (:10989) row format, e.g. `audit_service.py` row :11474 + section :19425.
**Apply to:** every touched file, same commit; new rows for `google_service.py`, `provider_gateway/anthropic.py`, `provider_gateway/google.py`, `stores/askDraftStore.ts`, `setupTests.ts` (and `provider_gateway/errors.py` only if touched). Run `node scripts/check-hot-file-ledger.cjs 282`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/tests/unit/test_282_slow_stub_scaled.py` | test | streaming (real socket) | No in-repo test runs a local `HTTPServer` stub; use RESEARCH's `scratchpad/d05_block_probe.py` / `retry_probe.py` shape and §Code Example 5 |

## Discrepancies the planner must resolve

1. **`test_061_hard_timeout.py:105` literal fence** vs RESEARCH Code Example 3 (`async with cm:`). Keep the literal or edit the fence on purpose in the same commit.
2. **Run-failure sentence:** UI-SPEC "the timeout set for it in the Model Registry" vs R5's warning that it is not always set there.
3. **Help line:** UI-SPEC rows predate D-22; D-22 wording ("Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times.") supersedes, keeping UI-SPEC's `Between {min} and {max} seconds.` prefix.
4. **422 sentence:** RESEARCH R3 example keeps the raw column name; the approved UI-SPEC sentence (`Timeout must be between … because {reason}. {value} was not saved.`) wins.

## Metadata

**Analog search scope:** `backend/app/{config.py,api/admin.py,services/{openai,anthropic,google}_service.py,services/provider_gateway/*,services/{agent_loop,forced_emit,task_service,run_producer}.py}`, `backend/tests/{unit,integration}`, `frontend/src/{stores,providers,components/panel,components/admin,components/chat/MessageList.tsx,pages/WorkflowRunPage.tsx,lib/api/admin.ts,setupTests.ts}`, `scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~30
**Pattern extraction date:** 2026-10-15
