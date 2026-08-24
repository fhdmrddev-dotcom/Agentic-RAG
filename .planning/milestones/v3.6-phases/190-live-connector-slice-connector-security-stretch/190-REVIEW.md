---
phase: 190-live-connector-slice-connector-security-stretch
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/connectors.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/models/connector.py
  - backend/app/models/harness.py
  - backend/app/models/user_settings.py
  - backend/app/security/egress.py
  - backend/app/services/connector_service.py
  - backend/app/services/connectors/__init__.py
  - backend/app/services/connectors/jira_adapter.py
  - backend/app/services/connectors/protocol.py
  - backend/app/services/connectors/registry.py
  - backend/app/services/connectors/slack_adapter.py
  - backend/app/services/connectors/smtp_adapter.py
  - backend/app/services/harness/phase_types.py
  - frontend/src/components/settings/ConnectionsTab.tsx
  - frontend/src/components/settings/ConnectionFormPanel.tsx
  - frontend/src/components/settings/connectionsCopy.ts
  - frontend/src/components/settings/connectionFormCopy.ts
  - frontend/src/components/settings/connectionRefusalCopy.ts
  - frontend/src/components/workflows/ConnectionPicker.tsx
  - frontend/src/components/workflows/SelectedPhaseSlugContext.tsx
  - frontend/src/components/workflows/ExternalActionSection.tsx
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - supabase/migrations/116_connector_connections.sql
  - supabase/migrations/117_harness_audit_external_action_sent.sql
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: fixed-partial
fixed_at: 2026-08-09
fix_report: .planning/phases/190-live-connector-slice-connector-security-stretch/190-REVIEW-FIXES.md
fix_commits: [f64a0ebb, 50d058e3]
resolution:
  fixed: [CR-01, CR-02, CR-03, CR-04, WR-02, IN-03]
  fixed_partial:
    WR-03: run terminal fixed; UI half deferred as D-190-DEF-11
    WR-05: model constraints fixed (the defect); panel mirror deferred as D-190-DEF-12
  deferred:
    WR-01: D-190-DEF-10 — no reachable bypass; VALIDATION.md's false W0-3 checkmark CORRECTED
    WR-04: D-190-DEF-13 — lands with D-190-DEF-11
    WR-06: D-190-DEF-14 — require_visible is shared by four other governed features
    IN-01: D-190-DEF-15
    IN-02: D-190-DEF-15
    IN-04: D-190-DEF-15
  skipped: []
migration_added: 118_connector_secret_column_privilege.sql
cloud_parity_queue: "099 -> 118 (was 099 -> 117) — 118 is SECURITY-BEARING"
---

# Phase 190: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** standard
**Files Reviewed:** 29 source files (+ 2 migrations)
**Status:** issues_found

## Summary

The egress guard itself is the strongest part of this phase and it survived adversarial
reading. I could not find a bypass in `validate_destination` / `send_pinned_http` /
`open_pinned_smtp`: the host comes from `httpx.URL(...).host` (userinfo/homograph closed),
matching is label-boundary, every resolved address is checked, the four IPv6-embedding
unwraps are real, `follow_redirects=False` is explicit *and* the 30x is turned into a
refusal rather than returned, both the wire and the decompressed body are capped, the TCP
connection goes to the pinned IP with SNI/cert identity preserved on both transports, and
`trust_env=False` closes the proxy hole. SMTP header injection is closed architecturally
(`EmailMessage.__setitem__` + a separate envelope validator + `send_message`), and both
`ok:false`-as-success traps (Slack identity check, Jira three-gate verdict) are correctly
implemented. The org-scoped resolver has two gates and no id-only path. The golden-run gate
(D-16) and the resume exclusion (A4) are both present and correct.

The defects I found are **not in the guard — they are in the things that decide whether the
guard is reached, and in the boundary the guard does not own**:

1. the RLS policy hands the encrypted tenant credential to every authenticated org member
   over PostgREST, which the API layer's careful T7 projection cannot see;
2. the `live_connectors` kill switch reads a settings cache with no staleness bound and
   treats three of its four legal audience values as "fully on";
3. the destination validator does a blocking `getaddrinfo` on the event loop from three
   `async def` call sites, on a path an org admin can trigger at will with no rate limit;
4. the flagship D-06 "guard before credential" ordering is a no-op in production for two of
   the three capabilities, and its fence drives a config shape the model forbids.

None of (1)–(4) is a hole in `egress.py`. All four are reachable, falsifiable, and each is
a place where a document in this phase asserts something the code does not do.

---

## Critical Issues

### CR-01: Every authenticated org member can read `secret_ciphertext` directly over PostgREST

**File:** `supabase/migrations/116_connector_connections.sql:114-116` (with
`backend/app/services/connector_service.py:98-111`, `frontend/src/lib/supabase.ts:36`)

**Issue:** The SELECT policy is

```sql
CREATE POLICY connector_connections_select ON public.connector_connections
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));
```

Row-level, not column-level — and the row contains `secret_ciphertext`. Supabase exposes
`public` to the `authenticated` role through PostgREST, and this app ships a live browser
Supabase client built from `/public-config` (`frontend/src/lib/supabase.ts:36,74`; the
pattern is already used for direct table reads, e.g. `MemorySection.tsx:45`
`.from("user_memory")`).

**Failure scenario (concrete):** a *plain member* of org A — not an org admin, explicitly
denied create/edit/delete/check by `require_org_manage` (UI-SPEC U-02, mig 116's write
policies) — opens devtools and runs

```js
await supabase.from("connector_connections").select("id,name,capability,secret_ciphertext")
```

and receives the `enc:v1:…` envelope for every connector credential in their org. The API
gate that this phase spent a module-scope assert on (`connector_service.py:108`, *"T7:
ConnectorConnectionResponse grew a secret-bearing field"*) is not in the path at all.

Three reasons this is not "just ciphertext": (a) it defeats the exact least-privilege split
the phase designed — credential *management* is admin-only, credential *material* is now
org-wide; (b) it is an offline artefact an insider can retain against a future
`SECRETS_ENCRYPTION_KEY` disclosure or key-rotation mistake; (c) `connector_service.py:27`
claims *"Every log line emits column NAMES, ids and counts only — never a ciphertext"* and
`list_connections`' docstring claims *"no row reaches a caller with its ciphertext
attached"* — true of the API, false of the database, and the phase's own T7 falsification
row was only ever driven against the API.

Note that the RLS shape was copied from `sso_configs` (mig 104:372-374, cited verbatim in
116's header) — **a table with no secret column at all**. The precedent does not carry.

**Fix:** revoke the column and re-grant the rest, in a new migration, in the same commit as
a driven test that reads the table as a plain member:

```sql
-- 118_connector_secret_column_privilege.sql
REVOKE ALL ON public.connector_connections FROM authenticated;
GRANT SELECT (id, org_id, created_by, capability, name, config, is_enabled,
              last_checked_at, last_check_verdict, created_at, updated_at)
  ON public.connector_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;
```

(RLS still applies on top; the column grant removes `secret_ciphertext` from every
PostgREST projection including `select=*`. The service-role resolver is unaffected — it
bypasses both.) Drive it: a member JWT selecting `secret_ciphertext` must get a
`42501 permission denied for column` rather than a value, and `resolve_connection` must
still return the secret on the service-role pool.

---

### CR-02: The `live_connectors` kill switch reads an unbounded-stale cache — turning it OFF does not reliably stop sending

**File:** `backend/app/services/harness/phase_types.py:2187`

```python
if feature_audience(_LIVE_CONNECTORS_FEATURE) == "off":
    return _record("live_connectors is off — the 189 behaviour, unchanged")
```

**Issue:** `feature_audience` resolves through the **synchronous** settings reader, and
`backend/app/models/user_settings.py:365-398` states the problem in its own words:

> `load_app_settings()` reads `_settings_cache` with **no staleness check at all** (:892)
> … on a NON-writing worker nothing expires the sync reader's view — it keeps serving the
> pre-flip audience until some *unrelated* request on that worker happens to await the
> async loader … has **no code-level bound**.

Every other gated read in the codebase awaits `ensure_settings_fresh()` first —
`api/features.py:57`, `dependencies.py:669` (`require_canvas`), `middleware/canvas_gate.py:146`
— and that helper exists *specifically because* T-184-UAT-02 measured a flipped-off
`visual_workflow_canvas` still answering `true`. **The executor gate does not call it.**
It is the only kill switch in the tree that reads the flag raw, and it is the one whose
false-negative sends real email.

**Failure scenario:** `WORKER_COUNT=2` (the documented default). An operator discovers a
leaked Slack bot token and flips `live_connectors` to `off` via `PUT /admin/visibility`.
That request lands on worker 1, whose `refresh_settings_cache` updates *its own* cache.
Worker 2 has not awaited `_load_settings_from_db` since boot. A workflow run scheduled on
worker 2 evaluates `feature_audience("live_connectors")` → `"everyone"` → **the gate opens
and the message is posted**, minutes or hours after the operator believes sending is
stopped. There is no bound on how long this persists, and the executor is `async def`, so
the fix is one awaited line.

**Fix:**

```python
    # GATE 2 · D-26 — the operator kill-switch.
    # T-184-UAT-02: the SYNC reader has no staleness check, so a worker that did not
    # service the operator's write keeps enforcing the pre-flip audience unbounded.
    # TTL-checked (no DB I/O on a warm cache) and non-raising.
    from app.models.user_settings import ensure_settings_fresh
    await ensure_settings_fresh()
    if feature_audience(_LIVE_CONNECTORS_FEATURE) == "off":
        return _record("live_connectors is off — the 189 behaviour, unchanged")
```

Add the import to the module-namespace block at `:87` so the ordering fence's
`monkeypatch.setattr(phase_types, …)` idiom still reaches it, and drive it: stub
`ensure_settings_fresh` to flip the audience and assert the step records.

---

### CR-03: The kill switch fails OPEN for three of its four legal audience values

**File:** `backend/app/services/harness/phase_types.py:2187` vs
`backend/app/api/admin.py:120` and `backend/app/dependencies.py:541-554`

**Issue:** `PUT /admin/visibility` accepts four audiences for any allow-listed feature —
`_VISIBILITY_AUDIENCES = {"everyone", "operators", "role", "off"}` (`admin.py:120`) — and
`live_connectors` was added to `_VISIBILITY_FEATURES` (`admin.py:110`) with no restriction
to the two D-26 names. The two consumers then disagree about what the middle values mean:

| consumer | reads | `"operators"` / `"role"` means |
|---|---|---|
| `require_visible("live_connectors")` (the three writes + check) | `resolve_feature_access` per caller | **restrictive** — a non-greenlisted caller gets 403 |
| `_exec_external_action` GATE 2 | `feature_audience(...) == "off"` | **fully ON, for every run by every user** |

**Failure scenario:** an operator wants to pilot live sending with only super-admins
allowed. They set `{feature: "live_connectors", audience: "role", roles: ["super-admin"]}`
— a legal, allow-listed write that the Control Room's own vocabulary invites. The
connections CRUD correctly refuses every non-super-admin. But every published workflow in
every org that already carries a bound `external_action` step now **sends for real**, run
by any member, because the executor only tests `== "off"`. The operator's restriction
silently became a platform-wide enablement of the phase's entire outbound capability.

The same shape bites in the other direction for auditing: an operator reading the Control
Room sees "restricted", while the send path is wide open.

**Fix:** make the send path require the same positive answer, not merely the absence of
`"off"`. Either restrict the write:

```python
# admin.py — live_connectors is a BINARY kill switch (D-26: Off = "off", On = "everyone").
_BINARY_VISIBILITY_FEATURES = {"live_connectors"}
if feature in _BINARY_VISIBILITY_FEATURES and audience not in ("off", "everyone"):
    raise HTTPException(400, "live_connectors is a kill switch: 'off' or 'everyone' only")
```

or (preferred, because it is fail-closed against a hand-edited `app_settings` row) invert
the executor's test:

```python
if feature_audience(_LIVE_CONNECTORS_FEATURE) != "everyone":
    return _record("live_connectors is not fully on — the 189 behaviour, unchanged")
```

Drive both non-`off`, non-`everyone` audiences and assert the step records.

---

### CR-04: `validate_destination` performs blocking DNS on the event loop, from three `async def` call sites

**File:** `backend/app/security/egress.py:298-307`, called at `:550` (`send_pinned_http`),
`:719` (`open_pinned_smtp`) and `backend/app/services/harness/phase_types.py:2193`

**Issue:** `_default_resolver` calls `socket.getaddrinfo(...)`, which is a **blocking**
libc call. `validate_destination` is `def`, and all three call sites are inside
coroutines — so the resolution runs on the event loop thread.

This is the D-v2.5-01 red line (`CLAUDE.md`: *"Do not run blocking I/O … directly inside
async handlers — wrap with `run_in_threadpool`"*), and the same file's own docstring
(`egress.py:705-710`) cites SEED-065's measurement of exactly this cost: *"a sync HTTP call
left on the event loop froze ALL request serving for the round trip."* The module carefully
wraps the SMTP **connect** in `run_in_threadpool` (`:737`) and then leaves the DNS lookup
that precedes it on the loop.

Two properties make this worse than a latency note:

* **`timeout=` does not bound it.** `SMTP_TIMEOUT_SECONDS` / `JIRA_TIMEOUT_SECONDS` are
  passed to the transport, not to `getaddrinfo`. A blackholed nameserver blocks for the
  OS resolver's own budget (glibc default `timeout:5 attempts:2` per `nameserver`, i.e.
  tens of seconds), with no application-level cap anywhere.
* **It is remotely triggerable with no rate limit.** `POST /connectors/connections/{id}/check`
  (`api/connectors.py:418-515`) reaches `open_pinned_smtp` → `validate_destination` on a
  user HTTP request. `190-15-SUMMARY.md:374` records the *worker-occupancy* half of this,
  but not this half — a threadpool thread being busy degrades throughput; the event loop
  being blocked stops **every** concurrent SSE chat stream on that worker.

**Failure scenario:** an org admin creates a `send_email` connection with
`host: nx.example.invalid` (or any domain whose authoritative NS drops packets) and clicks
*Check* a handful of times. Each click parks the worker's event loop inside `getaddrinfo`;
`WORKER_COUNT=2` means two such clicks stall all chat streaming, all SSE run frames and
every other request on the box for the resolver budget. No credential is needed, no
egress is permitted, and the guard "working correctly" is what triggers it.

**Fix:** keep `validate_destination` synchronous (the ordering fence depends on it being a
plain module attribute) and move the *resolution* off the loop by injecting an async-safe
resolver at the three async call sites, or add an async wrapper the binders use:

```python
async def avalidate_destination(capability, url_or_host, port=None, *, allowed_host=None,
                                resolver=None):
    """The async door. The DNS answer is produced off the event loop (D-v2.5-01);
    every ordering property of validate_destination is unchanged."""
    loop = asyncio.get_running_loop()

    def _threaded(hostname: str, prt: int) -> list[str]:
        return (resolver or _default_resolver)(hostname, prt)

    async_resolver = None  # placeholder — see below
    return await run_in_threadpool(
        validate_destination, capability, url_or_host, port,
        allowed_host=allowed_host, resolver=_threaded,
    )
```

Simplest correct form: `pinned = await run_in_threadpool(validate_destination, capability,
url, None, allowed_host=allowed_host, resolver=resolver)` at `egress.py:550`, `:719` and
`phase_types.py:2193`. Independently, add a hard cap on the lookup
(`socket.setdefaulttimeout` does **not** cover `getaddrinfo`; a `run_in_threadpool` +
`asyncio.wait_for` pair does) so a hostile nameserver cannot hold a threadpool slot either.

---

## Warnings

### WR-01: GATE 3 (D-06's pre-credential guard) is a no-op in production for `create_ticket` and `send_email`, and its fence drives a config the model forbids

**File:** `backend/app/services/harness/phase_types.py:1910-1914, 1937-1950, 2190-2193`;
`backend/tests/unit/test_190_egress_ordering.py:47-53`

**Issue:** `_pre_credential_destination` returns the step's `base_url` if one exists, else
the per-capability constant:

```python
_PRE_CREDENTIAL_DESTINATION = {"post_message": SLACK_API_BASE,
                               "create_ticket": None, "send_email": None}
```

`ExternalActionPhaseConfig` is `_StrictBase` (`extra='forbid'`) and carries **no**
`base_url` — `models/harness.py:257` adds `connection_id` and nothing else. So for a real
step:

* `post_message` → validates the constant `https://slack.com/api/` (always passes; the only
  effect is a DNS round trip, see CR-04);
* `create_ticket` / `send_email` → `destination is None` → **`validate_destination` is
  never called before `resolve_connection`**. An unbound step returns `recorded_not_sent` at
  GATE 4 without any destination ever being examined.

The W0-3 fence proves the ordering only over a duck-typed `SimpleNamespace` carrying
`base_url` — a shape the model rejects. The test file says so itself
(`test_190_egress_ordering.py:47-53`: *"A duck-typed config therefore cannot catch a model
that rejects the destination field … Recorded here as a known limit of this drive, not as a
property it proves"*), but `190-VALIDATION.md` then scores W0-3 ✅ and the executor's own
docblock (`phase_types.py:2097-2104`) states the property as an absolute:

> *"a send with **no credential bound at all** raises the EGRESS REFUSAL rather than a
> missing-credential error"*

which is false for two of three capabilities as shipped.

**Why this is a Warning and not a Critical:** there is no reachable bypass today, because
`send_pinned_http` and `open_pinned_smtp` both call `validate_destination` as their first
statement, so no socket opens unvalidated. What is missing is the *ordering* property
D-06 exists to make structural rather than incidental — and the fence that was supposed to
catch its regression cannot see the production path.

**Fix:** two halves, same commit.
1. Correct the docblock so it states the true, narrower property per capability
   (`post_message` guards pre-credential; the other two are guarded at the binder, which is
   before the socket but after the resolve).
2. Give the fence something real to bite on — assert the *binder-level* ordering directly,
   i.e. drive `jira_adapter.Adapter.send` with a stub `credential` whose `.secret` property
   records access, aim it at a refused host, and assert `EgressRefused` is raised **and**
   `.secret` was never read. That is the property `create_ticket` actually needs and it is
   currently asserted nowhere (`jira_adapter.py:100-108` records the gap in prose only).

---

### WR-02: `update_connection` omits the capability↔config validator that `create_connection` enforces

**File:** `backend/app/models/connector.py:180-190` (no `model_validator`),
`backend/app/services/connector_service.py:545-546`

**Issue:** `ConnectorConnectionCreate` runs `_reject_config_capability_mismatch` in an
`@model_validator(mode="after")` so a `create_ticket` row can never carry a
`PostMessageConfig`. `ConnectorConnectionUpdate` has no such validator, and
`update_connection` writes `payload.config.model_dump(...)` without comparing against the
stored row's `capability` — which it has in hand (`current`, read one block above at `:533`).

**Failure scenario:** an org admin (or any client) sends
`PATCH /connectors/connections/{id}` with `{"config": {"default_channel": "#ops"}}` for a
`send_email` connection. Pydantic's smart union resolves it to `PostMessageConfig`, the
service writes it, and the API answers **200 with the new row** — `ConnectorConnectionResponse`
also has no cross-field check, so the response validates. The connection's SMTP host,
port and from-address are gone. The Settings table then renders a blank *Sends to* cell,
the picker's `destinationPartsOf` returns `[]` for it, and the next run of every workflow
bound to it fails with `SmtpConfigInvalid`. Nothing anywhere reports that a valid PATCH
destroyed the destination.

**Fix:** reuse the existing helper against the stored capability, before building `changes`:

```python
    if "config" in submitted and payload.config is not None:
        from app.models.connector import _reject_config_capability_mismatch
        _reject_config_capability_mismatch(str(current["capability"]), payload.config)
        changes["config"] = payload.config.model_dump(mode="json", exclude_none=True)
```

and map the resulting `ValueError` to a 422 in the router. Drive it: PATCH each capability
with each of the other two config shapes and assert 422 + the row unchanged.

---

### WR-03: A capability change strands `connection_id`, and the run then dies on an uncaught `ValueError` instead of a D-17 terminal

**File:** `backend/app/services/harness/phase_types.py:2246-2251`;
`frontend/src/components/workflows/ExternalActionSection.tsx:157,208`

**Issue:** `ExternalActionSection`'s capability rows call `onChange(name)`, which patches
`capability` only. Nothing — not the section (+2 lines this phase), not `ConnectionPicker`
(which writes only on `<select>` change), not `PhaseFormPanel` (`0 0` by D-23) — clears
`config.connection_id`. The executor's mismatch check then does:

```python
    if getattr(connection, "capability", capability) != capability:
        raise ValueError(f"external_action phase {slug!r}: connection {connection_id!r} is a ...")
```

A bare `ValueError` is not an `AdapterError`, so `_exec_external_action`'s handler at
`:2262` does not catch it; it is not one of the four D-17 outcomes; and it produces no
`text`, no `failure` sentence and no honest card word.

**Failure scenario:** author binds a Slack connection to a step, then changes the step's
capability to *Creates a ticket* and saves. `connection_id` survives in the JSONB. The
picker's list read is capability-filtered, so `bound` is `undefined` and the panel footer
reads *"🔒 nothing bound — this step will record, not send"* — the author is told there is
nothing to clean up. `notConnectedOf` sees a non-empty string and drops the canvas badge, so
the canvas says the step is complete. At run time the step raises an internal `ValueError`
and the run fails with a stack-trace-shaped error rather than the shipped
`recorded_not_sent` / `failed` vocabulary this phase spent D-17 on.

**Fix:** two independent halves, both cheap.
1. Clear the reference when the capability changes. `ConnectionPicker` already owns
   `patchConfig`; add an effect keyed on `capability` that patches
   `{ connection_id: null }` whenever the currently-bound id is not in the settled list
   for the new capability — or, better, have `ExternalActionSection`'s row handler write
   both keys through the same `patchConfig` the picker uses.
2. Make the executor's mismatch a D-17 terminal rather than an exception, since it is a
   *data* condition the author caused, not a programming error:

```python
    if getattr(connection, "capability", capability) != capability:
        logger.warning("190: phase %r is bound to a %r connection, not %r — recording",
                       slug, getattr(connection, "capability", None), capability)
        return _record("the bound connection is for a different capability")
```

---

### WR-04: The canvas badge and the panel footer disagree about whether a step is connected

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:811-813`;
`frontend/src/components/workflows/ConnectionPicker.tsx:231,324,332-335`

**Issue:** `notConnectedOf` now returns `false` for any non-empty-string `connection_id` —
it validates the *shape* of the reference and nothing about the referent. The picker, one
panel away, resolves the reference against the live list and filters out disabled rows
(`:231`), so it reports `bound === undefined` for the same step.

**Failure scenario:** an author binds a connection; an org admin later disables it
(UI-SPEC §2g's `⏻ Disabled` state, a first-class supported action) or deletes it. Open the
workflow:

* the canvas shows **no `Not connected` badge** — the step reads as finished;
* the panel footer reads *"🔒 nothing bound — this step will record, not send"*;
* the run produces `recorded_not_sent` (`phase_types.py:2244`).

Two surfaces, one step, opposite answers, and the one an author scans first (the canvas) is
the one that is wrong. The whole point of D-24's state-conditional badge was that the canvas
answers *"is this step finished?"* — a dangling reference is exactly the state it should
still flag.

**Fix:** `notConnectedOf` reads `PhaseSpecJSON` and cannot fetch, so the resolution must be
data. `canvasModel.buildPhaseData` already resolves `notConnected` once and passes it as
data (`canvasModel.ts:145-175`); pass the Builder's fetched connection list into that
resolution and treat "bound id not present among enabled connections for this capability"
as not-connected. Keep `notConnectedOf`'s two-line shape (D-24) by widening its second line
to take an optional resolved-set argument that defaults to today's behaviour, so
`PhaseNode.tsx` / `PhaseNodeCard.tsx` stay at `0 0`.

---

### WR-05: The create path accepts an entirely empty connection — empty name, empty host, empty credential — and encrypts the empty secret

**File:** `backend/app/models/connector.py:157-177`,
`backend/app/services/connector_service.py:440-449`,
`frontend/src/components/settings/ConnectionFormPanel.tsx:625,1480`

**Issue:** No field on `ConnectorConnectionCreate` or the three config models carries a
length, format or non-empty constraint: `name: str`, `host: str`, `from_address: str`,
`base_url: str`, `default_channel: str`, `secret: str` all accept `""`. On the panel,
`saveBlocked` is `saveRefusal?.kind === "cipher"` only (`:625`) and the Save button's
`disabled` is `saving || saveBlocked` (`:1480`) — there is no completeness check at all.

**Failure scenario:** an org admin opens *Add a connection*, picks *Sends an email*, and
clicks **Save** without typing anything. `configFromDraft` produces
`{host: "", port: 0, from_address: "", tls: "starttls"}`, `secret` is `""`, the API returns
**201**, and `encrypt_secret("")` stores a real `enc:v1:` envelope over an empty password.
The Settings table now lists a connection named `""` with a blank *Sends to* column that a
workflow author can bind. It fails only at run time (`host_not_allowed`, since
`_host_is_allowed` fails closed on an empty `allowed_host`) — i.e. the first time anyone
finds out is a failed workflow run.

**Fix:** constrain at the model, where both the API and any future caller are covered:

```python
from pydantic import Field
NonEmpty = Annotated[str, Field(min_length=1)]

class ConnectorConnectionCreate(_StrictBase):
    capability: ConnectorCapability
    name: NonEmpty
    config: ConnectorConfig
    secret: NonEmpty
```

and the same for `host` / `from_address` / `base_url` / `project_key` / `account_email` /
`default_channel`, plus `port: int = Field(ge=1, le=65535)`. Mirror it in the panel with a
`saveBlocked` term so the button is disabled rather than the request 422'ing.

---

### WR-06: `require_visible` short-circuits for operators before reading the audience, so the connector write surface is open while the switch is OFF

**File:** `backend/app/dependencies.py:541-542`, applied at
`backend/app/api/connectors.py:331,367,397,421`

**Issue:**

```python
    async def _dep(current_user=..., request=None):
        if await is_operator(current_user["id"]):
            return  # operator -> no-op
        ...
        audience = feature_audience(feature)
```

The operator no-op runs **before** the `"off"` test. `GET /features`
(`api/features.py:70-72`) does the opposite and honours `"off"` for everyone *including
operators* — deliberately, per D-181-01 — and `require_canvas` (`dependencies.py:668-671`)
also checks the flag first.

**Failure scenario:** with `live_connectors` at its cold default `"off"`, an operator opens
Settings → Connections. `liveConnectorsOnFrom(features)` returns `false`, so
`ConnectionsTab` removes `＋ Add a connection` and the row `⋯` menu (`ConnectionsTab.tsx:249,362`)
and the panel renders static text with no Save. But `POST /connectors/connections` from
curl, or from a stale tab, **succeeds** — `require_visible` waved the operator through.
`D-190-DEF-07`'s resolution table asserts branch (b) was chosen because *"a phase whose
whole discipline is not over-claiming should not ship a live-credential WRITE surface more
open than its plan says"*; for the operator audience it is exactly that.

**Fix:** put the `"off"` test ahead of the operator no-op in `require_visible`, matching
`/features` and `require_canvas`:

```python
    async def _dep(current_user=..., request=None):
        from app.models.user_settings import feature_audience, resolve_feature_access
        audience = feature_audience(feature)
        if audience == "off":
            raise HTTPException(403, "This feature is available to administrators only.")
        if await is_operator(current_user["id"]):
            return
        ...
```

⚠ This dependency is shared by four other governed features — verify the four existing
consumers before changing it, or (narrower, safer for this phase) add a dedicated
`require_live_connectors` that composes the off-check with `require_visible`. Either way,
add `await ensure_settings_fresh()` here too (same root cause as CR-02).

---

## Info

### IN-01: `harness_engine.py`'s WR-06 block still describes Phase 190 in the future tense

**File:** `backend/app/services/harness_engine.py:802-836`

The block reads *"once Phase 190 wires a real send, PUBLISHING a workflow would PERFORM THE
EXTERNAL ACTION"* and *"PHASE 190 OWNS THE FIX and it is one of two shapes"*. 190 took shape
1 (`phase_types.py:2183`) and the trigger test is green. `_exec_external_action`'s docblock
was rewritten to mark its superseded invariants; this one was not. A future reader of the
engine will believe the defect is still open.

**Fix:** append a dated `RESOLVED 2026-08-09 (Phase 190 / D-16 — shape 1, at
`phase_types.py:2183`)` note in the block's own superseded-quote style, without deleting the
reasoning.

### IN-02: `ExternalActionSection`'s six "purity" fences no longer prove anything about the section's behaviour

**File:** `frontend/src/components/workflows/ExternalActionSection.tsx:66,223`

The six `expect().not.toMatch()` fences read the *source of that one file* for `useEffect`,
`fetch(` and `@/lib/api`. This phase moved all three into `ConnectionPicker.tsx`, which the
section now renders unconditionally. The fences pass and the section is no longer a pure
leaf — every render with a capability selected opens a network request. `190-VALIDATION.md`
§M4 scores them ✅ "re-run post-mount", which is true but no longer means what the row
implies.

**Fix:** either restate the fences as "this file names no transport" (honest and still
useful) or extend the walk to the modules this file imports, so the property matches the
claim.

### IN-03: A non-numeric SMTP port silently becomes the scheme default rather than a validation error

**File:** `frontend/src/components/settings/connectionFormCopy.ts:247-252`;
`backend/app/security/egress.py:400`

`configFromDraft` maps an unparseable port to `0`; `validate_destination`'s
`resolved_port = port or parsed.port or _DEFAULT_PORTS[scheme]` treats `0` as falsy and
substitutes 465/587. A person who types `four sixty five` gets a working connection on 587
and no indication their input was discarded. Fold into WR-05's `Field(ge=1, le=65535)`.

### IN-04: `SendEmailConfig.username` is unreachable from the UI, so SMTP hosts whose login differs from the mailbox cannot be configured

**File:** `frontend/src/components/settings/connectionFormCopy.ts:242-254`;
`backend/app/services/connectors/smtp_adapter.py:317-320`

`configFromDraft` never writes `username`, and the panel has no field for it, so
`_identity` always falls back to `from_address`. The model, the migration comment and the
`lib/api.ts` type all declare the field. For any provider whose SMTP username is not the
mailbox address (SES, Mailgun, most relay services), the connection can be created and can
never authenticate, with no configuration path. Either add the field to §3b's form or drop
it from the model so the three spellings agree.

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
