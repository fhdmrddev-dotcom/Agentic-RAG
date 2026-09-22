---
phase: 249-the-model-you-actually-run
reviewed: 2026-09-15T00:00:00Z
depth: deep
diff_base: abbaa2750
files_reviewed: 12
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/settings.py
  - backend/app/api/setup.py
  - backend/app/config.py
  - backend/app/models/user_settings.py
  - backend/app/services/setup_service.py
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/settings/ModelPillRow.tsx
  - frontend/src/hooks/useComposerModel.ts
  - frontend/src/lib/unverifiedModelCopy.ts
  - frontend/src/lib/api/settings.ts
  - scripts/vitest-count-gate.cjs
findings:
  critical: 2
  warning: 10
  info: 0
  total: 12
status: issues_found
---

# Phase 249: Code Review Report

**Reviewed:** 2026-09-15
**Depth:** deep (cross-file: call-chain traced from `verified_models` to every consumer, and from `add_model_by_id`'s `provider` to every egress site)
**Diff:** `git diff abbaa2750..HEAD -- backend/app frontend/src scripts`
**Status:** issues_found

## Summary

Two BLOCKERs, both in the **`verified_models` widening (MODEL-05)** — not in the SSRF area the brief
ranked first. The widening was traced to every consumer, and two of them were not updated with it:
the **judge-model picker now offers values `PUT /settings` refuses with a 400**, and the **models
MODEL-04 newly enables are exactly the ones the new pick-time warning goes silent about.**

The three categories the brief named as highest risk came back clean and are called out as such
below rather than padded: **SSRF/egress — no finding. SQL injection — no finding.
`GET /settings/providers` availability — no finding.**

---

## Critical Issues

### CR-01: `verified_models` now feeds the judge picker options the server rejects with 400 — BLOCKER

**Files:**
- `backend/app/api/settings.py:188-201` (`_verified_model_ids`), `:378` (`verified_models=sorted(_verified_set)`)
- `backend/app/api/settings.py:820-830` (the judge validator, **unchanged** by this phase)
- `frontend/src/pages/SettingsPage.tsx:1451` (`<JudgeModelPicker registryModels={[...verifiedModels]} />`)

**Issue:** `verified_models` changed meaning from *"in `MODEL_CAPABILITIES`"* to *"in
`MODEL_CAPABILITIES` **or** in `model_capabilities_overrides`"*. `SettingsPage` feeds that exact set
into `JudgeModelPicker` as `registryModels`, and the picker renders one `<option>` per entry
(`JudgeModelPicker.tsx:73,100-104`). Selecting one calls `setJudgeModel(m)` →
`updateSettings({harness_judge_model: m})` → `PUT /settings`, whose validator is unchanged:

```python
from app.config import get_model_capability          # ← the SYNC variant
cap = get_model_capability(body.harness_judge_model)
if cap.get("capability_source") != "registry":
    raise HTTPException(status_code=400, detail=f"Unknown judge model: {...}")
```

`get_model_capability` **never reads the DB** — `config.py:820-824` says so explicitly ("the SYNC
`get_model_capability` still never reads the DB … Any surface that needs a DB-only model's tier must
use THIS async path"). An operator-added model therefore resolves `capability_source="inferred"`, so
every registry-added option in that dropdown is a **guaranteed 400**, surfaced as
`Unknown judge model: X` in the picker's error line.

This also breaks `JudgeModelPicker`'s own stated invariant (`JudgeModelPicker.tsx:15-17`: *"the
select offers ONLY registry-known models; the Plan 05 server validates the write against the
registry (400 on unknown)"*). Worse, `_verified_model_ids` is sourced from `load_all_model_overrides()`
(**all live rows, including `enabled=false`** — `settings.py:296-300`), so even a model the operator
deliberately hid is offered as a judge, and 400s.

This is a *new* user-visible failure: before this commit, `verified_models` was built-ins only and
every option in that dropdown passed the validator.

**Fix (pick one — do not leave the picker and the validator disagreeing):**

*(a) keep the picker's feed narrow* — add a separate built-ins-only field rather than reusing the
widened one:

```python
# backend/app/api/settings.py — FullSettingsResponse
registry_models: list[str]          # built-ins ONLY — the judge validator's exact set
...
    registry_models=sorted(MODEL_CAPABILITIES.keys()),
    verified_models=sorted(_verified_set),   # the chip's set — union, unchanged
```
```tsx
// SettingsPage.tsx:1451
<JudgeModelPicker registryModels={registryModels} />
```

*(b) widen the validator to match the picker* — make the judge check override-aware, which is the
behaviour the widening implies:

```python
from app.config import get_model_capability_async
cap = await get_model_capability_async(body.harness_judge_model)
if cap.get("capability_source") not in ("registry", "db_override"):
    raise HTTPException(status_code=400, detail=f"Unknown judge model: ...")
```
⚠ (b) additionally needs the disabled-row question answered — `get_model_capability_async` reads the
**enabled-only** cache, so a disabled override still fails it while the picker offers it. (a) is the
smaller, provable change.

---

### CR-02: MODEL-05 goes silent on exactly the models MODEL-04 newly enables — a self-hosted model registers, then runs with tool calling OFF and says so nowhere — BLOCKER

**Files:**
- `backend/app/api/settings.py:1019-1041` (`_verified`/`_inferred`/`_tools_lost` in `get_providers`)
- `backend/app/config.py:806-833` (`get_model_capability_async` overlay), `:594` (`native_tools = provider in _NATIVE_TOOL_PROVIDERS`)
- `frontend/src/components/admin/ModelRegistryTab.tsx:1470-1478` (`toolsValue === "unknown"` ⇒ `native_tools` omitted)
- `frontend/src/components/chat/MessageInput.tsx:644-645` (chip guard)

**Issue:** traced end-to-end on the phase's headline use case (SEED-172 — *"skipping the manual step
silently loses `native_tools`"*):

1. Operator adds `qwen3-30b` under provider `lmstudio` (newly possible — MODEL-04).
2. `familyDefaults("qwen3-30b")` matches no family and `lmstudio` is absent from `PROVIDER_DEFAULTS`
   (`frontend/src/lib/model-defaults.ts:76-85`) ⇒ `tools: null` ⇒ the select sits on `unknown` ⇒
   `submit()` **omits `native_tools`** (`ModelRegistryTab.tsx:1476-1478`) ⇒ the column is NULL.
3. At run time `get_model_capability_async` builds the base from
   `_build_inferred_defaults(model_id, "lmstudio")` ⇒ `native_tools = "lmstudio" in _NATIVE_TOOL_PROVIDERS`
   = **False** (`config.py:540-542` — `lmstudio`/`custom` are not members), and the NULL overlay is
   skipped, so **False survives**. Structured mode, `tools` param never sent
   (`agent_loop.py:1911`).
4. The new pick-time chip cannot fire: `_tools_lost` is computed **only over `_inferred`**, and
   `_inferred` excludes everything in `_verified_set` — which now includes this row. Both surfaces
   go quiet.

Before this commit the Settings chip *did* fire for such a model (it was not in `MODEL_CAPABILITIES`).
So the phase whose goal is *"announces what it can and cannot do before it is used"* **removes the
only existing announcement for the case it newly enables**, while the capability loss is real. This
is the 2026-08-18 `safe_defaults_applied=True` failure that `unverifiedModelCopy.ts`'s own docblock
is written against, one register up.

**Fix:** `inferred_tools_lost` must be a claim about the **resolved** capability, not about registry
membership. In `get_providers`, add the registered-but-tool-less rows:

```python
# backend/app/api/settings.py :: get_providers — after `_inferred`
from app.config import _NATIVE_TOOL_PROVIDERS, _INFERENCE_FALLBACK_PROVIDER
_tools_lost = sorted(
    {m for m, prov in _inferred.items() if prov not in _NATIVE_TOOL_PROVIDERS}
    | {
        # ⭐ a REGISTERED row still loses tools when native_tools resolves False:
        # explicit False, or NULL under a provider outside _NATIVE_TOOL_PROVIDERS.
        mid
        for mid, cap in _overrides.items()
        if cap.get("native_tools") is False
        or (
            cap.get("native_tools") is None
            and (cap.get("provider") or _INFERENCE_FALLBACK_PROVIDER) not in _NATIVE_TOOL_PROVIDERS
        )
    }
)
```

and decouple the chip's render guard from `isUnverified` so a *verified-but-tool-less* model is still
marked (`MessageInput.tsx`):

```tsx
const isUnverified = (verifiedModels?.size ?? 0) > 0 && !verifiedModels!.has(m)
const isToolsLost  = toolsLostModels?.has(m) ?? false
// render the chip when EITHER is true; `unverifiedDescription` already picks the wording.
{(isUnverified || isToolsLost) && ( … )}
```

Secondary, cheap, and worth doing with it: default the Add-model **Native tools** select to `none`
(not `unknown`) when the selected provider is in `SELF_HOSTED_PROVIDERS`, so the stored row states
the truth instead of inheriting it.

---

## Warnings

### WR-01: `raise … from None` does not clear `__context__` — the asyncpg `DETAIL:` row (incl. `enc:v1:` envelopes) is still attached to the raised exception

**File:** `backend/app/models/user_settings.py:695`; fence at `backend/tests/unit/test_249_refused_settings_write.py:137`

**Issue:** `from None` sets `__cause__ = None` and `__suppress_context__ = True`, but implicit chaining
still sets `__context__` to the asyncpg error. Verified on this interpreter:

```
cause = None
suppress = True
context = ValueError('DETAIL: Failing row contains (enc:v1:SECRET, https://x.trycloudflare.com)')
```

`traceback`/`logging` honour `__suppress_context__`, so **no current consumer leaks it** — but the
comment at `:679-683` asserts an absolute ("a 500 handler rendering `__cause__` would put that row in
front of someone"), and the test pins only `__cause__ is None`. Any future structured error reporter
that walks the chain without checking `__suppress_context__` (Sentry-class tooling; none installed
today — grep for `sentry` returns 0) re-opens the exact leak this arm exists to close.

**Fix:** scrub it explicitly and pin it, so the guarantee matches the claim:

```python
refused = SettingsWriteRefused(sorted(clean.keys()), _constraint)
refused.__context__ = None          # ⛔ `from None` clears __cause__ ONLY
refused.__suppress_context__ = True
raise refused from None
```
```python
# test_249_refused_settings_write.py
assert ei.value.__context__ is None
blob = ... + repr(getattr(ei.value, "__context__", None)) + ...
```

### WR-02: the secret-leak guard is keyed to three classes; the sibling integrity-violation classes still reach the broad arm with `exc_info=True`

**File:** `backend/app/models/user_settings.py:667-671` vs `:698-705`

**Issue:** Postgres emits `DETAIL: Failing row contains (…)` for the whole
`integrity_constraint_violation` family — `unique_violation`, `foreign_key_violation`,
`exclusion_violation` as well as the two that are caught. Those three still fall into
`except Exception: logger.error(..., exc_info=True)`, which writes the full row — every `enc:v1:`
envelope and the operator's self-hosted base URLs — into the log. The phase closed 2 of ~5 members of
one family and documented the hazard as closed.

**Fix:** catch the family, not three of its members:

```python
except (
    asyncpg.exceptions.IntegrityConstraintViolationError,   # Check / NotNull / Unique / FK / Exclusion
    asyncpg.exceptions.UndefinedColumnError,
) as exc:
```
(If unique/FK must stay 500s rather than 400s, then at minimum drop `exc_info=True` from the broad
arm and log `type(exc).__name__ + sorted(clean.keys())` instead — the traceback is what carries the row.)

### WR-03: the `setup.py` comment claims `SettingsWriteRefused` propagates; the next line's `except Exception:` catches it

**File:** `backend/app/api/setup.py:466-476`

**Issue:** the new comment reads *"this deliberately does NOT catch `SettingsWriteRefused` … Letting it
propagate gives a real error instead of a false success. **Do not "fix" it.**"* — but
`SettingsWriteRefused` is an `Exception` subclass and the handler three lines down is
`except Exception:`. It is swallowed. The runtime behaviour happens to be acceptable (the endpoint
reports `setup_complete_persisted: false` honestly, per the docstring's deliberate best-effort
design), so this is not a functional break — but it is a **false claim placed by this phase on a
write-honesty path, carrying an instruction not to change it.** In this codebase a wrong comment stops
an audit.

**Fix:** either make the comment true —
```python
except SettingsWriteRefused:
    raise                                     # the DB refused it; never a silent best-effort
except Exception:  # noqa: BLE001 — unreachable DB only
```
— or replace the comment with what the code actually does: *"a refusal is swallowed here with the
rest; the honest report is `setup_complete_persisted: false`, and the FILE marker is the authority."*

### WR-04: `POST /setup/provider-key` swaps a deliberate honest 500 for an unhandled exception

**Files:** `backend/app/api/setup.py:385-390`; `backend/app/services/setup_service.py:339-345`

**Issue:** `persist_provider_key` now lets `SettingsWriteRefused` propagate "by design", but the only
caller still checks a bool: `if not await save_provider_key(...): raise HTTPException(500, "Could not
persist the provider key — it was not saved.")`. A refusal never reaches that line — it escapes the
handler as an unhandled exception (no app-wide exception handler exists; `grep exception_handler`
over `backend/app` returns none), so the wizard gets a bare `Internal Server Error` with a stack trace
where it previously got the worded message. `ProviderKeyBody.provider` is unvalidated free text
(`setup.py:248-253`), and `{provider}_api_key` is exactly the `UndefinedColumn` shape MODEL-08 is
about — i.e. the reachable case is the one that regressed.

**Fix:**
```python
try:
    persisted = await save_provider_key(body.provider, body.api_key, body.embedding_key)
except SettingsWriteRefused as refused:
    raise HTTPException(status_code=400, detail=refused.detail())
if not persisted:
    raise HTTPException(status_code=500, detail="Could not persist the provider key — it was not saved.")
```

### WR-05: `ModelPillRow.toolsLostModels` is wired to nothing — the Settings surface still shows only the benign copy

**Files:** `frontend/src/components/settings/ModelPillRow.tsx:48,93,132`; `frontend/src/pages/SettingsPage.tsx:1233-1242`; `backend/app/api/settings.py:150-186` (`FullSettingsResponse`)

**Issue:** the new optional prop is never passed. `GET /settings` gained `verified_models`'s new
meaning but **not** `inferred_tools_lost`, so `SettingsPage` has no value to hand down and
`unverifiedDescription` always takes the `describe()` branch there. Result: the consequence wording
ships on the composer only, and the Settings page keeps saying *"safe defaults"* about a model whose
tools are off — the precise thing `unverifiedModelCopy.ts`'s docblock calls *"repeating the
2026-08-18 mistake one surface up"*.

**Fix:** add `inferred_tools_lost: list[str]` to `FullSettingsResponse` (computed by the same
expression `get_providers` uses — one helper, not a second `if`), hydrate it in `SettingsPage`, and
pass it: `<ModelPillRow … toolsLostModels={toolsLostModels} />`. Otherwise delete the prop rather than
shipping an unreachable branch.

### WR-06: the third copy of the unverified tooltip is still inline in `SettingsPage.tsx` — and still says `timeout=90s`

**File:** `frontend/src/pages/SettingsPage.tsx:1221-1230`

**Issue:** the phase removed `_tooltipFor` from `ModelPillRow` because *"the old text was wrong: it
said `timeout=90s`; the inferred default is 300"* — and left a byte-identical duplicate of that wrong
string inline on the *same page*, on the selected-model badge, two elements above the corrected one:

```tsx
title={`This model isn't in our verified registry. Using inferred provider: … timeout=90s).`}
```

So the false number still ships, the two chips on one screen now disagree about the same model, and
the "one home for this copy" claim is untrue at the moment it was written.

**Fix:**
```tsx
{llmModel && !verifiedModels.has(llmModel) && (
  <span … title={unverifiedDescription(llmModel, inferredProviderFor, toolsLostModels ?? new Set())}>
    {UNVERIFIED.LABEL}
  </span>
)}
```

### WR-07: `SELF_HOSTED_PROVIDERS` in the registry UI is a fourth hand-typed roster, and the new lockstep fence does not pin it

**File:** `frontend/src/components/admin/ModelRegistryTab.tsx:1299-1300`

**Issue:** `new Set(["ollama", "lmstudio", "custom"])` is declared to "mirror
`backend/app/config.py::_SELF_HOSTED_PROVIDERS`" and nothing enforces it. `addProviderRoster.lockstep.test.ts`
pins `ADD_PROVIDER_ROSTER` only. Adding a fourth self-hosted provider in the backend silently drops
the "it has nowhere to run until that URL is set" note — the same class of drift (a hand-typed copy
of a backend table) that produced SEED-172, reintroduced in the commit that fixes SEED-172.

**Fix:** export it and extend the existing fence, which already `?raw`-imports `config.py`:

```ts
// addProviderRoster.lockstep.test.ts
const selfHosted = dictKeys(configPySource, "_SELF_HOSTED_PROVIDERS: dict[str, dict[str, object]] = {")
expect([...SELF_HOSTED_PROVIDERS].sort()).toEqual([...selfHosted].sort())
```

### WR-08: two comments placed by this phase are factually wrong about the code they annotate

**Files:** `backend/app/api/admin.py:1150-1160`; `backend/app/models/user_settings.py:29-32`

**Issue (a):** `AddModelRequest`'s docstring still reads *"validated against the native-7 + openrouter
roster (`PROVIDER_ENDPOINTS`)"*. That is now false and it names the **SSRF discovery allowlist** on the
one endpoint whose provider check moved off it — the highest-consequence place in this diff for a
reader to be told the wrong list. The handler docstring 40 lines below was updated; this one was not.

**Issue (b):** the new module-level `import asyncpg` comment justifies itself with *"an `except` clause
is evaluated at exception time — a lazy import inside the `try` would not be in scope there."* That is
not true: an `import asyncpg` as the first statement of the `try` binds a function-local name that the
`except` clause resolves fine. The *decision* (module level) is fine; the *reason* is wrong and will
be cited.

**Fix:** update (a) to `config.ROUTING_PROVIDERS` with the same ⚠ note the handler carries; reword (b)
to the real reason — *"module level because the except clause must resolve `asyncpg` even on a path
where the `try` body raised before reaching a lazy import."*

### WR-09: the 400/500 split is a column- and constraint-name oracle on `app_settings`

**Files:** `backend/app/models/user_settings.py:56-84` (`detail()`); `backend/app/api/settings.py:866-869`; `backend/app/api/admin.py:616-623`

**Issue:** the HTTP body now distinguishes *"that column may not exist yet"* (400 + column names) from
*"could not reach the DB"* (500), and names the violated `constraint_name` verbatim. That is schema
disclosure to the caller, and a clean existence oracle for `app_settings` columns. Reachability is
bounded — `PUT /settings` is `require_visible("model_management")` and `p.id` is 422'd against
`KNOWN_PROVIDERS` at `settings.py:524`, `/admin/flags` 422s against `_FLAG_KEYS` — so the reflected
names are code-owned today and this is defence-in-depth, not an open leak.

**Fix:** keep the column names (that is the value of MODEL-08) but treat the DB-authored
`constraint_name` as internal: log it, and put a stable worded reason in the body. At minimum, assert
in a test that `detail()` can only ever contain names drawn from the request's own code-owned key set.

### WR-10: `SettingsModelBadge.test.tsx` was re-pointed at the new shared copy module but sits in neither count-gate knob

**Files:** `frontend/src/__tests__/components/SettingsModelBadge.test.tsx`; `scripts/vitest-count-gate.cjs`

**Issue:** the phase adopted four suites into `TARGETS`+`BASELINE` (good — including the one that was
pinning the 8-provider defect). The suite it *edited* to bind `unverifiedModelCopy.ts`'s Settings-side
wording is not in either knob (`grep SettingsModelBadge scripts/vitest-count-gate.cjs` → no match, and
`src/__tests__` has no bare-directory entry — the phase's own comment at `vitest-count-gate.cjs:5400`
records that fact for `src/components/chat` and then does not apply it here). The corrected
`timeout=300s` assertion therefore runs under no gate.

**Fix:** add `"src/__tests__/components/SettingsModelBadge.test.tsx"` to `TARGETS` and its measured
`— N new` count to `BASELINE`, in the same shape as the four that were adopted.

### WR-11: `ROUTING_PROVIDERS` is a third public name for a set that already had two

**File:** `backend/app/config.py:42`; existing `backend/app/models/user_settings.py:117-120` (`KNOWN_PROVIDERS`)

**Issue:** `KNOWN_PROVIDERS` is already `{pid: … for pid, url in _PROVIDER_BASE_URLS.items()}` — the
same 11 keys, already exported, already imported by `api/settings.py`, and already used there as the
provider-id allowlist (`settings.py:524`). The new constant's own docblock argues *"DERIVED … because
this project's measured failure mode is a list that exists twice"* while creating the third name.
Both are derived so they cannot disagree in value; the cost is that a future reader must work out
which of the two to validate against — the ambiguity that produced this bug.

**Fix:** either drop `ROUTING_PROVIDERS` and use `if body.provider not in KNOWN_PROVIDERS:` in
`add_model_by_id`, or define it as `ROUTING_PROVIDERS = frozenset(_PROVIDER_BASE_URLS)` **and** make
`KNOWN_PROVIDERS` build from it, so one name is visibly the source.

---

## Categories checked with NO findings

Stated explicitly rather than omitted.

### 1. SSRF / egress — **no finding**

- `backend/app/services/model_discovery_service.py` is **byte-unchanged**:
  `git diff abbaa2750..HEAD -- backend/app/services/model_discovery_service.py` → 0 bytes.
- `PROVIDER_ENDPOINTS` remains the only thing that becomes a fetched URL (`model_discovery_service.py:269,354,389,426`),
  and the two endpoints that fan out (`/admin/models/discover` and the import path,
  `admin.py:1858-1869`) still validate against `set(PROVIDER_ENDPOINTS)` — unchanged.
- `body.provider` from `POST /admin/models` is written into `model_capabilities_overrides.provider`
  and read back only for **grouping/display and capability overlay**
  (`config.py:831`, `user_settings.py:948,958`, `admin.py:1278-1282`). Every consumer was traced; none
  constructs a URL or an HTTP client from it. Base URLs for `ollama`/`lmstudio`/`custom` come from
  `config._SELF_HOSTED_PROVIDERS` → operator-owned `app_settings` columns (mig 180), keyed by the
  **active provider setting**, never by a request body. No outbound surface is widened.
- Allowlist-before-touch ordering in `add_model_by_id` is intact and in the documented order:
  blank id → 422 (`admin.py:1212-1216`); provider → 422 (`:1234-1238`); per-column type guards → 422
  (`:1244-1256`); case-folded duplicate → 409 (`:1262-1295`). The duplicate guard performs a cached
  **read** only; the first write is the `fetchval` at `:1348`.
- `enabled` is still the forced literal `False` (`admin.py:1341`), `AddModelRequest` still has no
  `enabled` field, and the `ON CONFLICT` arm is still `WHERE …removed` so a live row can never be
  clobbered.

### 2. SQL injection — **no finding**

- `add_model_by_id`'s upsert is unchanged in substance: identifiers come only from
  `_ADD_MODEL_CAP_COLUMNS` + the two fixed columns (`admin.py:1176-1183, 1330-1342`); every value is a
  `$N` bind.
- `save_app_settings`'s SET-clause builder is unchanged (`user_settings.py:640-646`): column names come
  from `clean.keys()`, each gated by `_VALID_COLUMN_NAME`, and `settings.py:524` 422s an unknown
  `p.id` before it can become `f"{p.id}_api_key"`. Values are `$N` binds; `WHERE id = $N`.
- The new exception path adds no string interpolation into SQL.

### 3. `GET /settings/providers` availability — **no finding**

- It performs **one** `load_all_model_overrides()` read (`settings.py:1010`) and the three new fields
  reuse that same `_overrides` dict — no second read, confirmed by reading the whole handler.
- Every new call is non-raising: `load_all_model_overrides` is explicitly fail-soft
  (`user_settings.py:796-816` — returns the stale/empty cache); `_infer_provider_for` always returns a
  `str` and cannot raise for `None`/empty (`config.py:572-577`); the set union and the two
  comprehensions operate on `str` keys only (`model_id` is the table's non-null PK), so `sorted()`
  cannot hit a mixed-type `TypeError`.
- `_NATIVE_TOOL_PROVIDERS` is a module constant in an already-imported module; the function-local
  import cannot fail at request time.
- The route is still **not** behind `require_visible` (`settings.py:975-979` carve-out comment intact).
- `_build_response` (`GET /settings`) adds a second `load_all_model_overrides()` read, which is also
  fail-soft; it cannot 500 where it previously returned 200 either.

### 4. Optional-prop defensive defaults — **no finding**

- `useComposerModel.ts:319-321`: `new Set(verified_models ?? [])` → absent ⇒ empty set.
- `MessageInput.tsx:644-645`: guard is `(verifiedModels?.size ?? 0) > 0 && !has(m)` — an **empty** set
  marks nothing, so an older backend or an unwired caller renders exactly as before. Correct in both
  directions, and the asymmetry with `toolsLostModels` (empty ⇒ claim nothing) is right.
- `EMPTY_MODEL_SET` is module-scoped in both `MessageInput.tsx` and `ModelPillRow.tsx` — no per-render
  allocation.
- `ChatArea.tsx` is pass-through only; no new state or effect hook was added.
- ⚠ Not a finding but noted: `ModelPillRow`'s own `isUnverified` is `!verifiedModels.has(m)` with no
  `size > 0` guard (`ModelPillRow.tsx:108`) — pre-existing, unchanged by this phase, and its one caller
  always supplies the prop.

### 5. `_verified_model_ids` correctness — **no finding in the union itself**

`sorted(set(MODEL_CAPABILITIES) | set(overrides))` is correct, and sourcing it from
`load_all_model_overrides()` (all live rows, tombstones already excluded at
`user_settings.py:804-806`) rather than the enabled-only hot cache is the right call for the reason
the docstring gives. The two consumers of the helper agree by construction. The defects are in what
*other* surfaces do with the widened set — see CR-01 and CR-02.

---

_Reviewed: 2026-09-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
