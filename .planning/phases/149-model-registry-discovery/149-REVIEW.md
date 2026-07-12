---
phase: 149-model-registry-discovery
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/settings.py
  - backend/app/api/threads.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/app/services/model_discovery_service.py
  - backend/app/services/openai_service.py
  - backend/app/services/provider_gateway/anthropic.py
  - backend/app/services/provider_gateway/google.py
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/ModelDiscoveryPanel.tsx
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/settings/ModelPillRow.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/SettingsPage.tsx
  - supabase/migrations/099_model_registry_deprecated.sql
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 149: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the Phase 149 model-registry & discovery slice (diff base `a3b3df48`). The
security-critical surfaces are solid: the `PATCH /admin/models/{id}` write is SQLi-safe
(hardcoded `_MODEL_CAP_COLUMNS` allowlist rejected pre-touch, parameterized `$N` binds,
column names sourced only from the code constant); all `/admin/*` routes inherit the
router-level `require_operator` default-deny 404 gate; discovery is SSRF-safe (URLs come
only from the hardcoded `PROVIDER_ENDPOINTS` allowlist, client provider selection is
validated against `set(PROVIDER_ENDPOINTS)` before any fan-out, per-provider failures are
names-only with no body/key echo); and the `threads.py` change is a genuine single-seam
additive guard (`_resolve_enabled_model`) with no per-provider fork. No blocking I/O runs
directly in async handlers. Discovery correctly stays propose-only (never auto-enables).

However, one **BLOCKER** correctness defect sits in the heart of the discovery diff: a
capability field-name namespace mismatch in `compute_diff` means every already-known
Google/OpenRouter model is spuriously reported as "changed" on every run, and the unit
test masks it by feeding a fixture whose keys match the wrong namespace. Four warnings
(input-type validation, case-sensitivity false vanished/new pairs, a multi-worker
cache-staleness hole in the no-dead-default guarantee, and a Context-column-shows-0
display defect) and two info items follow.

## Structural Findings (fallow)

No structural pre-pass payload was provided with this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Discovery `compute_diff` "changed" detection compares mismatched field-name namespaces — every known Google/OpenRouter model is falsely flagged as changed

**File:** `backend/app/services/model_discovery_service.py:445-448` (with the caller at `backend/app/api/admin.py` `run_model_discovery`, the `current`-registry builder)

**Issue:**
`compute_diff` compares the discovered capability map against the injected `current`
registry using `_CAP_FIELDS = ("context", "max_output", "native_tools")`:

```python
stored = current[model_id]
for field, value in model_caps.items():          # keys: context / max_output / native_tools
    if field in _CAP_FIELDS and stored.get(field) != value:
        field_changes[field] = {"from": stored.get(field), "to": value}
```

But the `current` registry passed by the only real caller (`run_model_discovery` in
admin.py) is built from `MODEL_CAPABILITIES` ∪ `load_all_model_overrides()`, whose
capability keys are `context_window_tokens` and `max_output_tokens` — NOT `context` /
`max_output`. (`context_window_tokens` appears exactly once in `config.py` — the overlay
tuple at line 703 — and is defined on ZERO built-in `MODEL_CAPABILITIES` rows;
`max_output_tokens` is the real config/DB key.)

Consequently `stored.get("context")` and `stored.get("max_output")` are **always `None`**
on the stored side, so for every already-known model that an OK caps-provider returns
(Google + OpenRouter), the comparison `None != <value>` is always true and the model is
pushed into `changed` with `{"from": null, "to": <value>}`. Even `max_output`, where the
registry *does* hold the correct value under `max_output_tokens`, is reported as changed
from `null`. Only `native_tools` (same key in both namespaces) compares correctly.

Net effect: on every discovery run the "Changed" group fills with false positives for the
two providers that actually return metadata — the panel renders "— → 200000" rows for
essentially every Google/OpenRouter model, defeating the SC#3 "propose what changed"
purpose. It is not auto-applied (propose-only saves it from data corruption), but the
diff — the feature's hero output — is systematically wrong.

**Why the test did not catch it:** `backend/tests/test_149_discovery.py:179-183` builds its
`current` fixture with the *discovery-service* namespace (`{"provider": "google",
"context": 1_000_000, "max_output": 8192}`), which happens to match `_CAP_FIELDS`. The test
therefore green-lights a contract the real caller never satisfies. The fixture should mirror
the production registry keys (`context_window_tokens` / `max_output_tokens`).

**Fix:** Normalize the namespace at the comparison boundary — either translate discovered
field names to registry column names before comparing (and when building `changed`), or
have `compute_diff` read the stored value through an explicit field-name map. For example:

```python
# discovery field -> registry/DB column name
_STORED_KEY = {"context": "context_window_tokens", "max_output": "max_output_tokens",
               "native_tools": "native_tools"}
...
for field, value in model_caps.items():
    if field not in _CAP_FIELDS:
        continue
    stored_val = stored.get(_STORED_KEY[field])
    if stored_val != value:
        field_changes[field] = {"from": stored_val, "to": value}
```

Then update `test_149_discovery.py`'s `current` fixtures to use the real registry column
names so the test exercises the production contract.

## Warnings

### WR-01: `PATCH /admin/models/{id}` performs no per-column value-type validation; wrong-typed values become 500s and the disable-guard keys on `is False`

**File:** `backend/app/api/admin.py` `set_model_capability` (the `body: dict` handler)

**Issue:** The endpoint deliberately takes a raw `dict` body (to preserve present-null vs
omitted) and, after the column-name allowlist, binds the raw values straight into the
asyncpg upsert: `values = [model_id, provider, *[body[c] for c in present_cols]]`. There is
no value-type check. A client sending `context_window_tokens: "abc"`, an object, or
`native_tools: "yes"` hits an asyncpg type error caught by the broad `except Exception`,
which raises the honest 500 — but the intent for malformed input is a 422, not a 500.

Separately, the no-dead-default guard uses identity comparison `if body.get("enabled") is
False:`. A non-JSON-bool falsy value (e.g. `enabled: 0`) skips the guard entirely (the
subsequent boolean-column write then fails with a 500, so no dead default is created — but
the guard logic is brittle and relies on the downstream write to fail).

**Fix:** Validate each present column's value against its expected type before building the
upsert (ints for the three numeric columns, bools for `native_tools`/`enabled`/`deprecated`,
str|null for `deprecated_reason`), returning 422 on mismatch — while still preserving the
explicit-null-vs-omitted distinction. Coerce/validate `enabled` to a real bool before the
`is False` check, or compare with `== False` after validation.

### WR-02: Discovery `vanished`/`new` matching is case-sensitive on `model_id` — case-variant providers surface false vanished+new pairs

**File:** `backend/app/services/model_discovery_service.py` `compute_diff` (`id_set` membership and the `new` branch)

**Issue:** `vanished` is computed as `current` ids not in `info["id_set"]`, and `new` as
returned ids not in `current`, both using exact string membership. The codebase already
documents a case-sensitivity trap for zhipu/minimax (registry `minimax-m3` vs a live
`MiniMax-M3`). When a provider returns a differently-cased id than the registry stores, the
same model is emitted as BOTH `vanished` (registry id not returned) and `new` (returned id
not in registry) — a misleading double proposal. It is propose-only so nothing auto-applies,
but the operator is shown phantom churn and could disable/deprecate a live model.

**Fix:** Match with a case-folded key for vanished/new pairing (preserve verbatim casing for
display and for the actual write), or reconcile the returned id against the registry id with
a case-insensitive lookup before classifying as new/vanished.

### WR-03: The "no dead default can ever exist" guarantee is not airtight under multi-worker — the disable guard reads a per-worker 30s-TTL settings cache

**File:** `backend/app/api/admin.py` `set_model_capability` (disable guard) + `backend/app/api/threads.py` `_resolve_enabled_model`

**Issue:** The disable guard resolves the org default via `_load_settings_from_db()`, which
returns a per-process 30s-TTL cache; `save_app_settings` only invalidates the LOCAL worker's
cache (no cross-worker settings invalidation). With the default `WORKER_COUNT=2`: worker A
changes the org default to model X; worker B still holds the stale default (Y) for up to the
TTL; a disable of X routed to worker B reads default=Y, sees `X != Y`, and permits disabling
X — leaving X simultaneously the DB org default and `enabled=false` (a dead default).

`threads.py:_resolve_enabled_model` explicitly relies on the invariant that the org default
is always enabled and does NOT re-verify the fallback target's `enabled` state, so a dead
default produced this way is used unchecked for the affected chats within the window. This
matches the D-PRD-12 multi-worker singleton concern in CLAUDE.md.

**Fix:** Force a fresh settings read (bypass or invalidate the settings cache) inside the
disable/lock guards before the org-default comparison, or defensively re-check the fallback
target's enabled state in `_resolve_enabled_model` (fall back to a guaranteed-enabled model,
not blindly to `org_default`).

### WR-04: Registry "Context" column reads 0 for every built-in model because `MODEL_CAPABILITIES` defines no `context_window_tokens`

**File:** `backend/app/api/admin.py` `_registry_row` (`_eff("context_window_tokens", 0) or 0`) surfaced by `frontend/src/components/admin/ModelRegistryTab.tsx`

**Issue:** No built-in `MODEL_CAPABILITIES` entry carries `context_window_tokens` (confirmed:
the token appears only in the overlay tuple at `config.py:703`). `_registry_row` coalesces a
missing context to `0`, and the registry table renders it as "Context 0 · DEF" for
essentially every `capability_source: "registry"` row. An operator reads this as "this model
has zero context window," which is false — the value is simply not tracked in the built-in
registry. This undermines the tab's honesty rail (DEF should read as "inherited/unknown," not
a concrete `0`).

**Fix:** Distinguish "not defined in the registry" from a real `0` — either surface `null`
(and render it as "—"/"not set" in the table), or populate `context_window_tokens` on the
built-in `MODEL_CAPABILITIES` entries. Do not present an absent value as a hard `0`.

## Info

### IN-01: `MessageInput.tsx` gained a `deprecatedModels` prop that no parent wires yet

**File:** `frontend/src/components/chat/MessageInput.tsx:34-37, 81`

**Issue:** The `deprecatedModels?: Set<string>` prop and its badge render were added, but the
prop is not passed from the chat composer's parent (the change's own comment: "lights up once
wired to the payload"). The deprecated badge in the chat model dropdown is therefore inert;
only the Settings `ModelPillRow` path is actually wired. Harmless (defensive default = empty
set), but the chat-side feature is currently dead until the parent threads the set through.

**Fix:** Either wire `deprecatedModels` from the settings payload at the MessageInput call
site, or drop the prop until the wiring lands to avoid a latent dead affordance.

### IN-02: Deprecation-reason input always starts blank; an existing `deprecated_reason` is never read back

**File:** `frontend/src/components/admin/ModelRegistryTab.tsx` `DeprecatedControl` (`useState("")`) + `frontend/src/lib/api.ts` `ModelRegistryRow`

**Issue:** `DeprecatedControl` seeds its reason draft from `useState("")` and `ModelRegistryRow`
does not expose `deprecated_reason` at all (the backend `_registry_row` never returns it), so
re-editing a deprecated model can never show or edit the currently-stored reason — every edit
starts from an empty field and a blur/enter overwrites the stored reason. Write-only reason.

**Fix:** Include `deprecated_reason` in the registry read row and seed the input from it, so
the operator sees and can preserve/edit the current note rather than silently clobbering it.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
