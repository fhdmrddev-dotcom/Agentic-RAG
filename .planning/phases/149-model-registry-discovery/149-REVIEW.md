---
phase: 149-model-registry-discovery
reviewed: 2026-07-12T17:16:38Z
review_round: 2 (gap-closure plans 149-08 / 149-09 / 149-10 — diff base 5e552a96; round-1 review of plans 01-07 was resolved in commit 6c910ccb, see git history of this file)
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/threads.py
  - backend/app/services/openai_service.py
  - backend/tests/test_149_fallback_notice.py
  - backend/tests/test_149_namespaced_model_routes.py
  - backend/tests/test_149_native_tools_routing.py
  - frontend/src/__tests__/components/MessageItem.fallbackNotice.test.tsx
  - frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx
  - frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx
  - frontend/src/components/admin/ModelDiscoveryPanel.tsx
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/lib/api.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/types/index.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: resolved
resolution:
  resolved: 2026-07-12
  all_findings_fixed: false
  fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05]
  open_info: [IN-01, IN-02, IN-03, IN-04]
  fix_commits:
    - "46c09382 — CR-01 effective fallback model on the wire (body.model_copy at the _apply_fallback_to_request seam) + gateway-model regression test"
    - "7b3e82de — WR-01 capability_source registry/db_override gate in _reresolve_fallback_provider (pattern-INFERRED providers rejected)"
    - "beb32917 — WR-02 fallback provider recorded only when override_provider actually applied (identity check)"
    - "e41195ce — WR-04 non-empty model_id 422 guard on both :path model routes (PATCH + PUT /lock)"
    - "3214bbbf — WR-03 deprecated-reason dirty check (no-change blur never writes) + busy-window commit survival (settled flag not set while busy)"
    - "4c8dc454 — WR-05 honest-lock: native_tools toggle gated with always-native tooltip on anthropic/google rows; native-branch routing consult DEFERRED (see finding body + openai_service.py scope comment)"
  verification: "78 backend tests green (test_149_* full set); scoped vitest 26/26 (MessageItem.fallbackNotice + ModelDiscoveryPanel + ModelRegistryTab); vite build exit 0; tsc -b at the 30-error pre-existing baseline (0 new)"
  note: "IN-01..IN-04 are documented, not fixed (info-only, out of fix scope this round). IN-03 (modelFallbackNotice is stream-transient — vanishes on reload) is the most user-visible of the four; candidate for the live-UAT pass or a future polish plan."
---

# Phase 149: Code Review Report (Round 2 — gap-closure plans 08–10)

**Reviewed:** 2026-07-12T17:16:38Z · **Fixes applied:** 2026-07-12 (CR-01 + WR-01..WR-05 resolved — see frontmatter `resolution.fix_commits`; IN-01..IN-04 documented, not fixed)
**Depth:** standard
**Files Reviewed:** 15
**Status:** resolved (was issues_found)

## Summary

Re-review of the gap-closure diff since `5e552a96` (plans 149-08/09/10, 13 commits). Verified
green: all 18 new backend tests pass (`test_149_native_tools_routing.py`,
`test_149_namespaced_model_routes.py`, `test_149_fallback_notice.py`) and all 23 frontend
component tests pass. The 149-08 work is largely sound: `_resolve_db_native_tools` correctly
mirrors the `_resolve_db_max_output_cap` sync-cache-read pattern (module-attribute re-import
per call works with the rebinding `_load_model_overrides`; the warm ordering holds —
`agent_loop.py:2023` awaits `get_model_capability_async` before `open_stream` reaches
`resolve_calling_mode` at `openai_service.py:1651`), and the `{model_id:path}` converters
route namespaced IDs without shadowing any existing route (POST `/models/discover` is
method-disjoint; the `/lock` literal anchors the PUT).

However, the 149-09 provider re-resolve interacts **dangerously** with a pre-existing seam:
the model actually sent to the LLM is `body.model` (never `ctx.resolved_model`, which is a
dead local in `agent_loop.py`), so flipping `_user_settings` to the fallback model's provider
aims the request at a provider that cannot serve the still-disabled `body.model`. Every
cross-provider disabled-model fallback — the exact UAT Test-7 scenario this plan closes —
now hard-fails, and same-provider fallbacks keep silently serving the disabled model while
the new inline notice tells the user the fallback model replied. This is a BLOCKER
(CR-01). The plan-09 unit tests test the helper in isolation and never drive the served
model, so they mask it — the same fixture-masking failure mode as round-1's CR-01.

## Critical Issues

### CR-01: Disabled-model fallback never changes the model actually sent — the new provider flip breaks cross-provider fallback runs and the new notice renders a false statement

**File:** `backend/app/api/threads.py:1216-1225` (new), interacting with `backend/app/services/agent_loop.py:1937,2005,2032` and `backend/app/services/provider_gateway/openai_compat.py:457`, surfaced by `frontend/src/components/chat/MessageItem.tsx:432-439`
**Issue:** The LLM request model is always `body.model` (`agent_loop.py:1937` native path,
`:2005`/`:2032` compat path → `openai_compat.py:457 model=request.model`;
`provider_gateway/anthropic.py:119 model=request.model`). `ctx.resolved_model` is unpacked at
`agent_loop.py:1124` and **never used** for the request. `body` is passed unmodified into
`RunContext` (`threads.py:1635 body=body`) and `body.model` is never rewritten after
`_resolve_enabled_model` swaps `_resolved_model` to the org default. A fallback can only fire
when `body.model` is the disabled model (if `body.model` is None, `_resolved_model` IS the org
default and no fallback fires), so **every fallback-fired run still sends the disabled model
on the wire**. The fallback only ever changed bookkeeping (`runs.model`, the persisted message
`model` column at `threads.py:1986`) and the SSE notice.

The new plan-09 block makes this actively destructive in two ways:

1. **Cross-provider fallback → hard failure.** `override_provider(_user_settings,
   _resolved_provider)` at `threads.py:1225` switches `active_provider`, `llm_api_key`, and
   `llm_base_url` to the fallback model's provider, and `agent_runner` picks it up
   (`threads.py:1399 user_settings = _user_settings` → `agent_loop.py:1761
   active_provider_name`). The UAT Test-7 shape (user sends disabled
   `claude-haiku-4-5-20251001`, org default `MiniMax-M2.5-highspeed`): active provider
   becomes `minimax`, the compat adapter opens a stream against the MiniMax base URL with
   `model="claude-haiku-4-5-20251001"` → provider 400/404 → the run fails. Pre-flip it was
   at least served (dishonestly) by the disabled model; now it breaks — the opposite of
   D-149-10's "never mid-run break".

2. **Same-provider fallback → the new UI notice is false.** Disabled `gpt-4o-mini` → org
   default `gpt-4o`: the provider flip is a no-op, `body.model=gpt-4o-mini` is still served,
   and the new `MessageItem` notice renders "gpt-4o-mini was disabled by your administrator —
   this reply used gpt-4o." — a false statement now surfaced prominently to the user. The
   persisted message/model attribution and `runs.model` also record the un-served fallback
   model.

The plan-09 tests (`test_fallback_run_records_effective_provider` etc.) exercise only the
pure helper and `_resolve_enabled_model` in isolation — no test asserts the model that
reaches the gateway/SDK, so the suite is green while the feature is broken end-to-end.
**Fix:**
```python
# threads.py, immediately after the plan-09 re-resolve block (:1225) — make the
# producer actually run the effective model; enabled path stays byte-identical:
if _model_fallback_notice:
    _fallback_provider = await _reresolve_fallback_provider(
        _resolved_model, _resolved_provider
    )
    if _fallback_provider != _resolved_provider:
        _resolved_provider = _fallback_provider
        _user_settings = override_provider(_user_settings, _resolved_provider)
    # NEW: the producer's closure-captured body must carry the EFFECTIVE model —
    # agent_loop/gateway send body.model (agent_loop.py:1937/:2005/:2032), and
    # ctx.resolved_model is a dead local there.
    body = body.model_copy(update={"model": _resolved_model})
```
Audit the post-seam `body.model` readers (`threads.py:1325` title-gen, `agent_loop.py` — for
all of them the effective model is the correct value). Alternative (bigger blast radius):
make `agent_loop` prefer `ctx.resolved_model` over `body.model` — it is already threaded and
the Continue endpoint (`threads.py:2244`) already constructs `body` from resolved values.
Then add a regression test that drives `send_message`-level resolution and asserts the model
handed to the gateway equals the fallback model. Re-run UAT Test-7 live (cross-provider leg).

## Warnings

### WR-01: `_reresolve_fallback_provider` accepts pattern-INFERRED providers — the "unknown" guard is dead code and the documented D-075.3-08 semantics are violated

**File:** `backend/app/api/threads.py:244-262`
**Issue:** After Phase 075.3, `get_model_capability_async` never returns
`provider="unknown"` for a non-empty model id — a registry/DB miss returns a pattern-
**inferred** provider (`config.py:531-537`, `_infer_provider_for`: slashed ids → `openrouter`,
garbage → the `ollama` bucket) with `capability_source="inferred"`. The helper checks only
`provider != "unknown"` and never checks `capability_source`, so its docstring promise ("a
garbage / absent capability never yanks the recorded provider") is not delivered for the
real-world garbage shape. Twenty lines below, the pre-existing provider-resolution block
guards exactly this with `_capability_source == "registry"` (`threads.py:1196`) and documents
why (a garbage id must not yank routing — D-067.3-N01-02). If the org default is not in the
static registry or DB overrides (legacy env-CSV model, mis-cased id — the memorialized
zhipu/minimax casing trap), a fallback yanks `runs.provider` AND live SDK routing (via
`override_provider` at `:1225`) to an inference bucket. A slashed local-model org default
(e.g. an LM-Studio `google/gemma-3-4b`) with an OpenRouter key configured would route chat
content to OpenRouter — the documented BUG-260616-01 data-egress class ("a name cannot
identify the endpoint", `config.py:404-411`). The tests
(`test_reresolve_provider_guards_garbage_capability`,
`test_reresolve_provider_handles_none_capability`) exercise only the impossible
`"unknown"`/`None` shapes — never the inferred shape — so they validate a fiction.
**Fix:**
```python
capability = await get_model_capability_async(effective_model) or {}
provider = capability.get("provider")
source = capability.get("capability_source", "")
if provider and provider != "unknown" and source in ("registry", "db_override"):
    return provider
return current_provider
```
Add a test where `get_model_capability_async` returns
`{"provider": "openrouter", "capability_source": "inferred"}` and assert the current
provider is kept.

### WR-02: `runs.provider` is updated even when `override_provider` refuses the switch — the recorded provider can name a provider that did not serve the run

**File:** `backend/app/api/threads.py:1220-1225`
**Issue:** `override_provider` returns the settings **unchanged** when the target provider
has no configured API key (`user_settings.py:714-716`). The new block sets
`_resolved_provider = _fallback_provider` at `:1221` unconditionally, then calls
`override_provider` — if the fallback provider has no key, the SDK keeps the pre-fallback
provider while `register_run_start` records the fallback provider. This recreates the exact
runs-row dishonesty the plan set out to fix, in the opposite direction. (The pre-existing
registry branch at `:1197-1203` has the same latent flaw, but this is a new instance in new
code.)
**Fix:** Only commit the re-resolved provider when the settings switch actually applied:
```python
_switched = override_provider(_user_settings, _fallback_provider)
if _switched is not _user_settings:  # override_provider returns `effective` unchanged on refusal
    _user_settings = _switched
    _resolved_provider = _fallback_provider
```
(or have `override_provider` signal refusal explicitly).

### WR-03: DeprecatedControl commits on every blur with no dirty check — no-op writes hit the API, the ✎ audit ledger, and the registry refetch; a busy-window commit is silently swallowed forever

**File:** `frontend/src/components/admin/ModelRegistryTab.tsx:520-524, 573`
**Issue:** `onBlur={commitReason}` fires `onWrite({deprecated: true, deprecated_reason: …})`
whenever the input loses focus and `settled` is false — including a plain focus+blur (or
tab-through) with **zero edits** on an already-deprecated row. Each such blur issues a real
PATCH, stamps a `model.capability.set` ✎ audit receipt ("Changed capabilities for …" — an
audit entry for a change that did not happen), and triggers the shell's registry re-fetch.
The comment claims "full commit parity with InlineNumberCell", but NumericCell's commit path
drops no-change values at the parent (`:307 if (v !== row[f.key])`) — that dirty check is the
missing half of the parity. Secondary: `commitReason` sets `settled.current = true` **before**
`write()`'s `if (busy) return` guard runs (`:246`), so an Enter/blur that lands while another
write on the row is in flight is dropped **permanently** — the old code's blur would retry;
now nothing will until the operator types another character. The new tests lock
Enter-once/Escape/Enter-then-blur but never the no-edit blur case.
**Fix:**
```tsx
function commitReason() {
  if (settled.current) return
  const next = reason.trim() || null
  if (next === (row.deprecated_reason ?? null)) return  // dirty check — no-op blur never writes
  settled.current = true
  void onWrite({ deprecated: true, deprecated_reason: next })
}
```
and add a test: focus + blur with no edits → `onSet` not called. For the busy-swallow, set
`settled.current = true` only after `onWrite` is actually accepted (or leave `settled` false
when `busy`).

### WR-04: `{model_id:path}` now matches an EMPTY model_id — `PUT /admin/models//lock` can blank the org default; `PATCH /admin/models/` upserts a phantom `model_id=""` row

**File:** `backend/app/api/admin.py:1061, 1224`
**Issue:** Starlette's `path` converter regex is `.*` — unlike the old single-segment
`{model_id}` (`[^/]+`, ≥1 char), it matches the empty string. `PATCH /admin/models/` (and
`PATCH /admin/models` via the default 307 slash-redirect) reaches `set_model_capability`
with `model_id=""`: no non-empty validation exists, `get_model_capability("")` infers
provider `ollama`, and the upsert inserts a `model_id=""` row that then surfaces as a
DB-only phantom row in the registry union (`get_model_registry:1053-1056`) and in
`_build_providers`. Worse, `PUT /admin/models//lock` with `{"locked": true}` reaches
`set_model_lock` with `model_id=""` and writes `app_settings.llm_model=""` +
`llm_model_locked=true` — the org default is blanked and locked, degrading every
default-model read (`load_user_settings().llm_model` returns `""`). Operator-gated, so not
an unauthenticated attack surface, but the route change genuinely widened the input space
that the old converter made structurally impossible; a buggy client call is enough.
**Fix:** First line of both handlers:
```python
if not model_id or not model_id.strip("/ "):
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="model_id must be non-empty.")
```
Plus a regression test (`client.patch("/admin/models/", json=...)` → 422, and
`client.put("/admin/models//lock", ...)` → 422).

### WR-05: The operator `native_tools` toggle is inert for Anthropic- and Google-served models — the code comment claims "must win for EVERY provider" and the registry UI offers the toggle on every row

**File:** `backend/app/services/openai_service.py:1563-1573` (claim), `backend/app/services/agent_loop.py:1921-1967` (native branches), `frontend/src/components/admin/ModelRegistryTab.tsx:315-323` (per-row toggle)
**Issue:** `resolve_calling_mode` — the only consumer of the new `_resolve_db_native_tools`
read — is called solely inside the OpenAI-compat gateway path
(`openai_service.py:1651`). The `active_provider_name in ("anthropic", "google")` branches
(`agent_loop.py:1921`) dispatch to native-SDK adapters that always return
`CallingMode.NATIVE` (dispatcher docstring) and never consult `native_tools`, DB or static.
So an operator flipping `native_tools` OFF on a Claude or Gemini row sees the OVR recorded,
the ✎ receipt, and the SC#1 "takes effect on the next request" copy — while routing is
byte-identical. The new comment ("An explicit native_tools=False must win for EVERY
provider") overstates what the change delivers; 2 of the 9 providers ignore the knob
entirely.
**Fix:** Either (a) honor the override in the native branches — e.g. in `agent_loop`,
consult `_active_cap.get("native_tools")`/`resolve_calling_mode` before choosing the native
branch and fall through to the compat/STRUCTURED path when explicitly disabled — or (b) if
Anthropic/Google are intentionally always-native, gate/annotate the toggle for those rows in
`ModelRegistryTab` (disabled control + "always native on this provider" tooltip) and correct
the comment. Silent inertness on an operator control is the one option that isn't
acceptable (Control-Room honest-locks doctrine).

## Info

### IN-01: Discovery provenance label reads "returned full capabilities ✓" for an empty capabilities map

**File:** `frontend/src/components/admin/ModelDiscoveryPanel.tsx:471-478`
**Issue:** `returnedCount === totalCount` is evaluated first, so `capabilities: {}` (0 === 0)
would produce "returned full capabilities ✓" — the exact lie SC#3 bans. Currently
unreachable: `_build_new_entry` (`model_discovery_service.py:403-406`) always emits every
`_CAP_FIELDS` key with the UNKNOWN sentinel. Defensive ordering costs nothing.
**Fix:** Check the zero case first: `totalCount === 0 || returnedCount === 0 ? "returned IDs
only" : returnedCount === totalCount ? "returned full capabilities ✓" : "returned some
capabilities"`.

### IN-02: The partial-provenance test asserts only the absence of wrong labels — a blank suffix would pass

**File:** `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx:153-174`
**Issue:** `test_partial_provenance_not_ids_only` asserts `queryByText(/returned IDs
only/)` and `/returned full capabilities/` are both null, but never asserts the positive
"returned some capabilities" renders — the row could show no suffix at all and stay green.
**Fix:** Add `expect(within(row).getByText(/returned some capabilities/i)).toBeInTheDocument()`.

### IN-03: `modelFallbackNotice` is stream-transient — the notice vanishes on reload

**File:** `frontend/src/types/index.ts:200-205`, `frontend/src/lib/api.ts:151-176` (mapMessage)
**Issue:** The notice is stamped only from the live SSE event; `mapMessage` has no source
column for it, so a page refresh (or the Realtime reconcile-by-fetch) drops the notice and
the swap becomes silent again for anyone reading the thread later. Consistent with the
`skill_activated` precedent and the plan's scope, but D-149-10's "never silent" only holds
for the live session. Note for a future persist (e.g. derive it at load time from
`runs.model` vs the request model, or a message metadata column).
**Fix:** Accept as scoped, or file a seed for load-time derivation.

### IN-04: `_resolve_db_native_tools` byte-duplicates `_resolve_db_max_output_cap`; neither strips the `:exacto` suffix that the static-lookup path strips

**File:** `backend/app/services/openai_service.py:1456-1494` (new) vs `:1416-1453`, `:1401`
**Issue:** The two resolvers are structurally identical except for the field name — a shared
`_resolve_db_override_field(model_id, field)` would collapse them and keep future DB-overlay
fields from a third copy. Also inherited: `_resolve_max_tokens` strips `:exacto` before the
**static** registry lookup (`:1401`) but the DB-cache reads key on the raw id — a DB override
would be missed for a suffix-carrying id. Benign today (the suffix is appended after
resolution), but the asymmetry is now duplicated.
**Fix:** Extract the shared field resolver; apply the same `removesuffix(":exacto")`
normalization inside it that the static path uses.

---

_Reviewed: 2026-07-12T17:16:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
