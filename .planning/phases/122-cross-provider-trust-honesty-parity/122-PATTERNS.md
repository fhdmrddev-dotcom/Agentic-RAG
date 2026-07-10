# Phase 122: Cross-Provider Trust & Honesty Parity - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 14 (5 modified source + 2 new tests + 4 modified/extended tests + 1 frontend test + 2 data artifacts)
**Analogs found:** 14 / 14 (every file has a live in-repo analog — this phase chains existing machinery, no greenfield)

> **Posture (from RESEARCH §"Don't Hand-Roll"):** This phase adds ZERO new packages and builds NO new machinery. Every file COPIES from an existing analog in the same module or test file. The work is to *chain* existing modes (MP-01), *replace* a two-bool guess (MP-02), *add a mode* to a proven driver (MP-03), and *add one sentence + a guard* (TDP-01). Line numbers below were re-verified against the live tree on 2026-06-23 (CONTEXT/RESEARCH line refs had drifted; the corrected numbers are here).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/forced_emit.py` | service (emit substrate) | request-response / transform | self — the existing TIER-FORCE/TIER-COERCE branches (`:294-390`) | exact (in-place rung-loop refactor) |
| `backend/app/config.py` | config (capability registry) | transform (lookup) | self — `strict_json_schema`/`forced_emission`/`capability_source` fields + the 55 registry rows | exact (field-add + row migration) |
| `backend/app/services/openai_service.py` | service (gateway forcing) | request-response | self — the `force_tool_name` branch (`:1534-1581`) | exact (deletion + tier-read) |
| `backend/app/services/agent_loop.py` | config (shared prompt) | n/a (prompt string) | self — the `execute_code` guidance bullets in `SYSTEM_PROMPT` (`:497-501`) | exact (one additive bullet) — **G-5 HOT FILE** |
| `scripts/eval_cross_provider.py` | utility (operator eval driver) | batch / measurement | self — `--workflow` mode + `emit_capability_table` (`:1142`) | exact (new `--forced-emit` mode parallel to `--workflow`) |
| `backend/tests/unit/test_config_registry.py` | test (registry invariant) | n/a | `test_gateway_forcing.py` module-top import + invariant style | role-match (NEW file) |
| `backend/tests/unit/test_eval_forced_emit.py` | test (structure-only, fake gateway) | n/a | `test_103_forced_emit_strict.py` `_patch_gateway` + `eval_cross_provider` import | role-match (NEW file) |
| `backend/tests/unit/test_forced_emit.py` | test (ladder rung-descent) | n/a | self — `_patch_gateway` fixture + `_run` + the synthetic stream factories | exact (extend) |
| `backend/tests/unit/test_gateway_forcing.py` | test (no-provider-gate + Deep-no-leak) | n/a | self — `test_no_provider_branch_in_shared_path` + `GatewayRequest` capture | exact (extend) |
| `backend/tests/unit/test_system_prompt.py` | test (string-presence guard) | n/a | any `inspect.getsource`-style prompt guard; mirror `test_gateway_forcing` source-grep | role-match (NEW file) |
| `frontend/src/lib/workspacePanel.test.ts` | test (bare-name assertion) | n/a | `frontend/src/lib/model-info.test.ts` (vitest describe/it + lib import) | role-match (NEW file; SUT exists) |
| `.planning/eval/forced-emit-scoreboard-<date>.json` | data artifact | n/a | `.planning/eval/capability-table-2026-06-07.json` | exact (mirror shape) |
| `.planning/eval/forced-emit-scoreboard-<date>.md` | data artifact | n/a | `.planning/eval/capability-table-2026-06-07.md` (the `md_lines` twin writer) | exact (mirror shape) |
| `.planning/eval/README.md` | doc | n/a | self — the existing "Emit trigger" + "grep ritual" sections | exact (extend) |

---

## Pattern Assignments

### `backend/app/services/forced_emit.py` (service, MP-01 ladder)

**Analog:** self — the existing TWO-rung shape (`forced_emit.py:245-390`). The ladder PARAMETERIZES + LOOPS the existing FORCE/COERCE request-assembly that is already there; it adds NO new emission machinery (RESEARCH "Key insight").

**`<read_first>` for the planner:** `forced_emit.py:205-390` (the whole `forced_emit` body), `:251-291` (cross-provider key injection — DO NOT TOUCH, 111.1's seam — Pitfall 5), `test_forced_emit.py` (the fixture the ladder test extends), `test_103_forced_emit_strict.py` (the `strict` override already added — the ladder must preserve it).

**Tier resolution today** (`:245-249`) — the line the MP-02 `emit_tier` read replaces:
```python
cap = get_model_capability(model) or {}
forced = bool(cap.get("forced_emission", False))  # default-SAFE — a miss is coerce
# Phase 103: strict override — None = cap-derived; False = force-without-strict
strict = bool(cap.get("strict_json_schema", False)) if strict is None else bool(strict)
tier = "TIER-FORCE" if forced else "TIER-COERCE"
```

**The FORCE-branch request assembly** (`:294-309`) — rung 1/2 re-drive this with `strict_schema` toggled:
```python
if forced:
    req = GatewayRequest(
        messages=messages, model=model, active_provider_name=provider,
        tools=tools, system_prompt=_system, user_settings=user_settings,
        max_tokens=max_tokens,
        tool_choice="auto",          # ignored on the forced path — force_tool_name drives it
        force_tool_name=emitter,
        strict_schema=strict,        # ← rung 1 = True, rung 2 = False
    )
```

**The COERCE-branch request assembly** (`:310-330`) — rung 3 re-drives this:
```python
else:
    _system = ((_system or "") + _COERCE_DIRECTIVE.format(emitter=emitter)
               + _coerce_schema_block(emitter, tools))
    req = GatewayRequest(..., tool_choice="auto")   # no force_tool_name
```

**The single sealed call + honest-fail wrap** (`:338-345`) — each rung re-drives this; the `except` becomes "descend to next rung", the final fall-through becomes `_failure(...)`:
```python
try:
    stream, calling_mode = await open_stream(provider, req)
    content, tool_calls, finish_reason = await run_in_threadpool(_drain, stream)
except Exception:  # noqa: BLE001 — a provider raise is an honest failure, not a crash
    logger.warning("forced_emit: provider call raised tier=%s provider=%s", tier, provider)
    return _failure(tier, provider, forced=forced, failure_override="provider_error")
```

**Truncation guard + extract/recover/honest-fail** (`:347-390`) — runs per rung on the SUCCESS path; `is_truncated` → descend; `recover_narrated_emission` is the coerce-rung recovery; `_failure(...)` is the rung-4 floor (ALL already shipped — reuse verbatim).

**Telemetry to ADD (D-122-03):** the success-result dict (`:382-390`) gains an `"emit_rung": <name>` key; `logger.info` the winning rung **identifier-only** (T-073-04 — never message/args content). NEVER write the registry.

**Pattern to follow (RESEARCH "MP-01 ladder loop"):** an ordered `_RUNGS_BY_TIER` dict (`force_strict → [strict_force, non_strict_force, coerce, fail]`, `force → [non_strict_force, coerce, fail]`, `coerce → [coerce, fail]`); loop, `continue` on provider_error / truncation / no-emit, `return` on first validated emission.

**Anti-patterns (RESEARCH):** do NOT run the strict rung on a `coerce`-tier model (400s every Kimi); do NOT alter the `if provider in ("ollama", "lmstudio")` injection branch at `:270-291` (111.1's, Pitfall 5).

---

### `backend/app/config.py` (config, MP-02 registry)

**Analog:** self — `strict_json_schema`/`forced_emission`/`capability_source` are the exact field-add template; the 55 `MODEL_CAPABILITIES` rows (`:215-337`) are the migration target.

**`<read_first>`:** `config.py:136-182` (the `ModelCapability` TypedDict), `:207-337` (the 55 rows), `:464-486` (`get_model_capability` — default-SAFE resolution), `:672-682` (`_SUB_AGENT_MODEL_DEFAULTS` — the eval's representative roster).

**Field-add template** (the `Literal` field next to `capability_source` at `:155` / `strict_json_schema` at `:182`):
```python
capability_source: Literal["registry", "inferred"]  # Phase 075.3 D-075.3-08
...
strict_json_schema: bool  # Phase 101.1 D-15 — verified token-level schema guarantee (default SAFE = absent)
# ADD (D-122-04):
emit_tier: Literal["force_strict", "force", "coerce"]  # Phase 122 — single source of truth (default-SAFE "coerce")
```

**Default-SAFE resolution** — the `get_model_capability(model).get("emit_tier", "coerce")` read mirrors the existing `forced_emission`/`strict_json_schema` `.get(..., False)` default-SAFE pattern (`:246-248`, D-122-05).

**The 55-row migration (RESEARCH §Pattern 2, quantified live):**

| Current flags | Rows | New `emit_tier` | Live registry lines |
|---------------|------|-----------------|---------------------|
| `forced_emission:True` + `strict_json_schema:True`, provider=openai | **14** | `force_strict` | `:215-228` (gpt-4o … o1) |
| `forced_emission:True` + `strict_json_schema:True`, provider=deepseek | **2** | **`force`** (demote — strict inert, no `/beta`) | `:280-281` (deepseek-v4-flash/pro) |
| `forced_emission:True`, no strict (anthropic/google/minimax/zhipu + conditional openrouter) | **34** | `force` | `:239-244`, `:257-271`, `:297-316`, `:326-336` |
| `forced_emission` absent (kimi/moonshot) | **5** | `coerce` | `:288-290`, `:330-331` |

**Row example (after migration):**
```python
"gpt-4o":            {..., "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
"deepseek-v4-pro":   {..., "forced_emission": True, "strict_json_schema": True, "emit_tier": "force"},  # DEMOTED — strict inert
"claude-opus-4-8":   {..., "forced_emission": True, "emit_tier": "force"},
"kimi-k2.6":         {..., "capability_source": "registry", "emit_tier": "coerce"},
```

**Open mechanism (D-122-04 / RESEARCH Open Q1 — planner's call):** keep the two old bools deprecated-unread for one phase (safer rollback) vs delete them. Do NOT add a *derived* `emit_tier` view that re-reads `strict_json_schema` (re-introduces the DeepSeek `force_strict` guess — Pitfall 3, RESEARCH anti-pattern).

---

### `backend/app/services/openai_service.py` (service, MP-02 forcing cleanup)

**Analog:** self — the `force_tool_name` branch (`:1534-1581`). This is a DELETION + a tier-read, not new code.

**`<read_first>`:** `openai_service.py:1521-1581` (the forcing branch), `:1521-1526` (DeepSeek thinking-off — DO NOT TOUCH, separate concern). **Pitfall 5 adjacency:** do NOT touch the local-provider routing at `:1449-1456` (111.1's).

**The two removal sites (live):**

Inert DeepSeek function-level strict (`:1536-1549`) — REMOVE (does nothing without `/beta`):
```python
if strict_response_format:
    _forced_tools = copy.deepcopy(_forced_tools)
    for _t in _forced_tools or []:
        _fn = _t.get("function") if isinstance(_t, dict) else None
        if _fn and _fn.get("name") == force_tool_name:
            _fn["strict"] = True   # ← :1548 INERT for DeepSeek — REMOVE
            break
```

The hardcoded `provider == "openai"` strict gate (`:1555`) — REMOVE the name check, gate on the resolved tier instead:
```python
if strict_response_format and provider == "openai":   # ← :1555 — REMOVE the `and provider == "openai"`
    ...
    kwargs["response_format"] = {"type": "json_schema", "json_schema": {
        "name": force_tool_name, "schema": _schema, "strict": True,
    }}
```

**Target state (RESEARCH "MP-02 deletions"):** `strict_response_format` is set by the caller ONLY for `emit_tier=="force_strict"` shots (post-migration: OpenAI-only by measurement, not by name). The `response_format` json_schema is requested whenever `strict_response_format` is true — no provider-name special-case.

**A4 (RESEARCH load-bearing assumption):** removing the function-level `:1548` block must NOT regress OpenAI — OpenAI gets its guarantee from the `response_format` json_schema, not the function flag. The plan MUST add an explicit OpenAI `force_strict` test (the `request.strict_schema` capture pattern below).

---

### `backend/app/services/agent_loop.py` (config, TDP-01 nudge) — **G-5 HOT FILE**

**Analog:** self — the `execute_code` guidance bullets inside `SYSTEM_PROMPT` (`agent_loop.py:497-501`). ONE additive bullet, no logic (G-5: "one additive string").

**`<read_first>`:** `agent_loop.py:461` (`SYSTEM_PROMPT =`), `:490-501` (the tool guidance bullets — the nudge site), `:523-544` (the `## Rules` section — alt placement).

**Note — the schema field is ALREADY good** (`openai_service.py:601-603`): the `execute_code.description` tool-schema already carries strong guidance ("Short human-readable label … e.g. 'Generating PowerPoint presentation'"). So TDP-01 is purely a *prompt nudge* problem (make the model USE it), not a schema problem.

**The nudge site** (`:497-501`, the existing `execute_code` bullet):
```python
"- **execute_code** → create downloadable files (PowerPoint, PDF, Word, Excel, charts) when the user explicitly asks "
"for file creation. Also for calculations and data analysis that require Python. "
"Always pass `libraries` for non-stdlib packages. "
"Pass `skill_files` to inject skill attachment files into the sandbox at /sandbox/{filename}. "
"Write output files to /sandbox/output/ and list them in `output_files`.\n"
```

**Pattern to follow (RESEARCH "TDP-01 ungated nudge"):** append ONE sentence to that bullet (or a `## Rules` bullet) instructing a concrete, specific `description` — e.g.:
```python
"- **execute_code labels:** ALWAYS set `description` to a short, specific label of what the code "
"produces (e.g. 'Generating Q3 revenue chart', 'Creating the risk-register .docx'), never a generic "
"phrase like 'Run code'. The user sees this label live in their workspace panel.\n"
```

**Anti-pattern:** do NOT add Anthropic-specific extraction (BUG-260528-03's stated cause is WRONG — `tool_args_progress` is already cross-provider). The nudge is provider-agnostic.

---

### `scripts/eval_cross_provider.py` (utility, MP-03 scoreboard)

**Analog:** self — the `--workflow` mode + `emit_capability_table` writer. The new `--forced-emit` mode is PARALLEL to `--workflow`, reusing every established scaffold verbatim.

**`<read_first>`:** `eval_cross_provider.py:82-93` (`PROVIDERS` roster), `:140-142` (`NATIVE_7` gate tuple), `:423-440` (`assert_localhost_only`), `:1137-1139` (`_eval_artifact_dir`), `:1142-1231` (`emit_capability_table` — the JSON+MD twin writer to mirror), `:1284-1324` (`_parse_args` — where `--forced-emit` is added), `config.py:672-682` (`_SUB_AGENT_MODEL_DEFAULTS` — the effective roster, Pitfall 6).

**Reuse verbatim — the roster + gate** (`:82-93`, `:140-142`):
```python
PROVIDERS: list[tuple[str, str]] = [
    ("openai", "gpt-5.4-mini"), ("anthropic", "claude-haiku-4-5-20251001"),
    ("google", "gemini-3.5-flash"), ("openrouter", "z-ai/glm-5.1"),
    ("deepseek", "deepseek-v4-flash"), ("moonshot", "kimi-k2.6"),
    ("zhipu", "glm-5.1"), ("minimax", "MiniMax-M2.7-highspeed"),
]
NATIVE_7 = ("openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax")
```

**Reuse verbatim — the localhost hard-gate** (`:423-440`): call `assert_localhost_only()` before any work (no change).

**Reuse + adapt — the dated-artifact writer** (`:1142-1231`): mirror `emit_capability_table`'s structure exactly — `_eval_artifact_dir()` + `date.today().isoformat()` stamp + a `.json` writer + an `md_lines` twin (`:1195-1229`) + the two `print(... written: ...)` lines. Write `forced-emit-scoreboard-<stamp>.{json,md}` instead.

**Reuse verbatim — the SQL allowlist pattern** (`:111-114` `_COUNT_QUERIES`): if the matrix needs DB reads, use the fixed-constant-query + parameterized `%s` pattern — NEVER interpolate a table/identifier (T-088-02-04).

**Reuse — the argparse `--workflow` flag** (`:1313-1323`) as the template for the new `--forced-emit action="store_true"` flag.

**New logic (RESEARCH Pattern 3 + Open Q2 → A3 recommendation):** a localhost-only **direct-call harness** that imports `forced_emit` and drives it per `(provider, {EASY, HARD} schema)`, scoring 4 axes (trigger / force / recovery / honest-fail). The HARD schema = optional-heavy + `additionalProperties` confidence object (the live trip-wire — Pitfall 1). Direct-call avoids Pitfall 6 (`body.model` doesn't steer harness phases). Cell verdicts PASS/FAIL/DOCUMENTED (D-122-07).

---

### `backend/tests/unit/test_forced_emit.py` (test, EXTEND — ladder)

**Analog:** self — the `_patch_gateway` fixture (`:123-146`) + `_run` (`:149-159`) + the synthetic stream factories (`:29-66`).

**The fixture to extend** (`:123-146`) — captures the `GatewayRequest`; the ladder test makes the FIRST `open_stream` raise, then succeed:
```python
@pytest.fixture()
def _patch_gateway(monkeypatch):
    import app.services.forced_emit as fe
    state: dict = {"events": [], "request": None, "provider": None, "calling_mode": None}
    async def _fake_open_stream(provider, request):
        from app.services.provider_gateway import CallingMode
        state["request"] = request
        state["provider"] = provider
        cm = state["calling_mode"] or CallingMode.NATIVE
        return iter(state["events"]), cm
    monkeypatch.setattr(fe, "open_stream", _fake_open_stream)
    monkeypatch.setattr(fe, "get_model_capability",
                        lambda model: {"forced_emission": True, "provider": "openai"})
    return state
```

**Rung-descent test pattern (NEW — RESEARCH Wave-0 gap):** make `_fake_open_stream` raise on the first call (or return `_unrecoverable_stream()` `:53-58`), succeed on the retry (`_tool_call_stream` `:29-40`); assert the result `emit_rung == "non_strict_force"` (or `"coerce"`) and `emitted is not None`. The synthetic stream factories `:29-66` are reused as-is. Monkeypatch `get_model_capability` to return `{"emit_tier": "force_strict", ...}` to exercise the full descent; `{"emit_tier": "coerce"}` to assert the strict rung is SKIPPED (tier-scoping).

**`emit_tier` default test (NEW):** monkeypatch `get_model_capability` to return `{}` (registry miss) → assert the resolved tier is `coerce` (default-SAFE, D-122-05).

---

### `backend/tests/unit/test_gateway_forcing.py` (test, EXTEND — no-provider-gate)

**Analog:** self — `test_no_provider_branch_in_shared_path` (`:61-85`, the D-14 source-grep guard) + the `GatewayRequest` module-top import (`:29-33`) + the `strict_schema` request-capture from `test_103_forced_emit_strict.py:117-185`.

**The Deep-no-leak guard to re-run** (`:61-85`) — asserts NO `if provider ==` forcing branch in the shared path; re-run unchanged for SC#5:
```python
def test_no_provider_branch_in_shared_path():
    import inspect
    from app.services import agent_loop
    src = inspect.getsource(agent_loop)
    if "force_tool_name" in src:
        assert "open_stream" in src, "forcing must be threaded via GatewayRequest..."
    for line in src.splitlines():
        if "if provider ==" in line or "active_provider_name ==" in line:
            assert "force" not in line.lower(), f"forcing must not branch per-provider: {line.strip()!r}"
```

**The request-capture assertion pattern (from `test_103_forced_emit_strict.py:128`)** — the no-provider-gate test mirrors this:
```python
res = await _run(_patch_gateway, strict=None)
assert res["emitted"] is not None
assert _patch_gateway["request"].strict_schema is True   # ← capture what REACHED the gateway
```

**no-provider-gate test (NEW):** drive a `force_strict`-tier model for a NON-`"openai"` provider key context and assert the json_schema response_format is still requested (gate is now tier-driven, not name-driven). **deepseek-force test (NEW):** assert `get_model_capability("deepseek-v4-pro")["emit_tier"] == "force"` AND the captured request carries NO function-level strict.

---

### `backend/tests/unit/test_config_registry.py` (test, NEW — registry invariant)

**Analog:** `test_gateway_forcing.py:1-33` module-top import style (the registry symbols EXIST today, so a top import is fine — unlike the in-body convention for not-yet-existing symbols).

**Pattern to follow:**
```python
from app.config import MODEL_CAPABILITIES

def test_every_row_has_emit_tier():
    for model_id, cap in MODEL_CAPABILITIES.items():
        assert cap.get("emit_tier") in ("force_strict", "force", "coerce"), model_id

def test_force_strict_is_openai_only():
    for model_id, cap in MODEL_CAPABILITIES.items():
        if cap.get("emit_tier") == "force_strict":
            assert cap.get("provider") == "openai", model_id   # 14 rows, OpenAI ⊇ force_strict
```

---

### `backend/tests/unit/test_eval_forced_emit.py` (test, NEW — structure-only)

**Analog:** `test_103_forced_emit_strict.py` `_patch_gateway` fixture (a fake gateway, no live keys) + `eval_cross_provider` module import. Tests STRUCTURE only (axis-scoring + artifact writer + localhost gate) — the LIVE proof is the operator run (D-122-06).

**Pattern to follow:** import the new `--forced-emit` matrix function from `eval_cross_provider`; inject a fake gateway / fake `forced_emit` result; assert the 4 axes are scored and the `.json`/`.md` artifact is written with PASS/FAIL/DOCUMENTED cells (mirror the `emit_capability_table` JSON shape). Assert `assert_localhost_only` is called (monkeypatch `SUPABASE_URL` to a cloud URL → expect `SystemExit`).

---

### `backend/tests/unit/test_system_prompt.py` (test, NEW — string-presence guard)

**Analog:** `test_gateway_forcing.py:66-85` `inspect.getsource` source-grep style.

**Pattern to follow:**
```python
def test_system_prompt_has_execute_code_label_nudge():
    from app.services.agent_loop import SYSTEM_PROMPT
    assert "description" in SYSTEM_PROMPT
    # a string-presence guard so the nudge can't be silently deleted
    assert "label" in SYSTEM_PROMPT.lower()   # tighten to the exact nudge phrase the plan ships
```

---

### `frontend/src/lib/workspacePanel.test.ts` (test, NEW — bare-name assertion)

**Analog:** `frontend/src/lib/model-info.test.ts:1-15` (vitest `describe`/`it`/`expect` + lib import). The SUT (`workspacePanel.ts` `humanize`/`inferLabel`) EXISTS; only the test file is new.

**`<read_first>`:** `frontend/src/lib/workspacePanel.ts:109-129` (`inferLabel`), `:156-186` (`PRETTY_TOOL_NAMES` + `humanize` precedence).

**The behavior to assert (RESEARCH Pitfall 4 — the bare-name risk):**
```typescript
import { describe, it, expect } from "vitest"
// SUT: humanize is module-private today — the plan exports it or tests via the public derive path.
// Precedence: execute_code → description > inferLabel(code) > "Run code";
// non-execute_code → PRETTY_TOOL_NAMES[name] ?? name  (the ?? name is the bare-name floor)

it("execute_code uses the description when present", () => {
  // humanize({name:'execute_code', args:{description:'Generating Q3 chart'}}) === 'Generating Q3 chart'
})
it("a non-mapped tool falls back to its bare name", () => {
  // humanize({name:'query_documents_by_view', args:{}}) === 'query_documents_by_view'  ← the floor TDP-01's UAT watches
})
```

---

### `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` + `README.md` (data artifacts)

**Analog:** `.planning/eval/capability-table-2026-06-07.{json,md}` (the exact shape) + `README.md`'s "Emit trigger" + "grep ritual" sections.

**JSON cell shape (RESEARCH "MP-03 scoreboard artifact shape"):**
```json
{
  "schema_difficulty": "hard", "provider": "deepseek",
  "model_effective": "deepseek-v4-flash", "declared_emit_tier": "force",
  "winning_rung": "coerce",
  "axes": {"trigger": "PASS", "force": "FAIL", "recovery": "PASS", "honest_fail": "PASS"},
  "documented": [{"axis": "force", "note": "deepseek 400s on the additionalProperties confidence schema; recovers via coerce — declared tier 'force' reflects this", "evidence": "BUG-260615-01"}],
  "gated": true
}
```
**MD twin:** mirror the `md_lines` table writer (`eval_cross_provider.py:1195-1229`) — a header + a `| provider | difficulty | tier | trigger | force | recovery | honest_fail | rung | gated |` table.

**README extension:** add a "Forced-emit scoreboard" section mirroring the existing "Emit trigger" + "The grep ritual" (`README.md:13-27`, `:71-85`) — the operator greps the latest scoreboard before flipping any `emit_tier`, attaches to VALIDATION.md (D-122-06).

---

## Shared Patterns

### Default-SAFE capability resolution (applies to: `forced_emit.py`, `config.py`)
**Source:** `config.py:246-248` + `get_model_capability` (`:464-486`)
A missing capability field defaults to the SAFE path. `emit_tier` follows the exact `.get(..., default)` shape — a registry miss → `"coerce"` (never assumes forcing/strict it hasn't verified, D-122-05).
```python
cap = get_model_capability(model) or {}
emit_tier = cap.get("emit_tier", "coerce")   # mirrors forced=cap.get("forced_emission", False)
```

### Honest-fail, never silent (applies to: `forced_emit.py`, all 4 consumers)
**Source:** `forced_emit.py:341-345` (provider-error wrap) + `:378-380` (`_failure` floor)
Every provider raise / no-emit / truncation returns a structured `_failure(...)` with `emitted=None` — NEVER a silent empty or prose-as-artifact. The ladder makes this the explicit RUNG-4 floor. This is the load-bearing trust property (RESEARCH Security: "Fabricated artifact passed off as a real emission" → Spoofing mitigation).

### Identifier-only logging (T-073-04) (applies to: `forced_emit.py` ladder telemetry, eval)
**Source:** `forced_emit.py:342` (`logger.warning("...tier=%s provider=%s", tier, provider)`)
The "which rung won" telemetry (D-122-03) logs rung name + tier + provider ONLY — never message/args content. The eval reports model NAMES + verdicts only — never key material.

### Gateway/adapter isolation — the D-14 RED LINE (applies to: `forced_emit.py`, `openai_service.py`, all forcing)
**Source:** `test_gateway_forcing.py:61-85` (the shipped guard test)
All forcing/strict translation lives in the 3 adapters + `forced_emit`'s rung loop. The shared `_normalize` event path is NEVER branched by provider for forcing. Deep stays byte-identical on the native-7. The ladder re-drives `open_stream`; it does NOT fork the consumer.

### The `_patch_gateway` request-capture fixture (applies to: all `forced_emit`/forcing tests)
**Source:** `test_forced_emit.py:123-146` + `test_103_forced_emit_strict.py:63-81`
A monkeypatched `open_stream` records the `GatewayRequest` the substrate built, so a test reads `request.strict_schema` / `request.force_tool_name` — the deterministic, no-live-key way to assert what REACHED the gateway. Every Wave-0 backend test extends this.

### Localhost-gated, git-diffable, manual-gate eval (applies to: `eval_cross_provider.py`, the scoreboard, README)
**Source:** `eval_cross_provider.py:423-440` (`assert_localhost_only`) + `:1142-1231` (dated-artifact writer) + `README.md:71-85` (grep ritual)
No CI secrets; presence-only env; a dated `.json`+`.md` twin per run; the operator greps the latest before any tier flip (D-122-06). The scoreboard reuses ALL of it.

---

## No Analog Found

*(none — every file has a live in-repo analog)*

The closest thing to "no analog" is the MP-03 **direct-call forced-emit harness** logic (RESEARCH Open Q2 → A3): the *axis-scoring loop* is new, but its scaffolding (roster, localhost gate, artifact writer, SQL allowlist, argparse flag) all copy from `eval_cross_provider.py`'s `--workflow` mode. Treat it as an EXTENSION, not a greenfield.

---

## Metadata

**Analog search scope:** `backend/app/services/{forced_emit,openai_service,agent_loop,embedding_service}.py`, `backend/app/services/harness/{phase_types,publish_service,validator_kinds}.py`, `backend/app/services/workflow_authoring.py`, `backend/app/config.py`, `backend/tests/unit/{test_forced_emit,test_103_forced_emit_strict,test_gateway_forcing}.py`, `scripts/eval_cross_provider.py`, `frontend/src/lib/{workspacePanel.ts,model-info.test.ts}`, `.planning/eval/{capability-table-2026-06-07.{json,md},README.md}`
**Files scanned:** ~18
**Line-drift note:** CONTEXT/RESEARCH refs had drifted; corrected live numbers herein — `SYSTEM_PROMPT` starts `:461`, `execute_code` bullet `:497-501`, `execute_code.description` schema `openai_service.py:601-603`, the `provider=="openai"` gate `openai_service.py:1555`, the inert DeepSeek strict `:1548`, the forcing branch `:1534-1581`, `forced_emit` tier-resolution `:245-249`, sealed call `:339`, `emit_capability_table` `:1142`, `_eval_artifact_dir` `:1137`.
**Pattern extraction date:** 2026-06-23
