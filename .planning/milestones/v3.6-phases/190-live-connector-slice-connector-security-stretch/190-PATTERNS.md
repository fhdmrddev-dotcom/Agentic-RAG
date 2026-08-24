# Phase 190: Live Connector Slice + Connector Security — STRETCH — Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 38 (21 net-new · 17 modified)
**Analogs found:** 33 / 38 with a concrete in-tree analog · 5 with no analog (see §No Analog Found)

> **Every path, line number and symbol below was re-derived with a real command in this
> repository at HEAD.** Where CONTEXT.md or RESEARCH.md prose disagreed with the
> measurement, the measurement wins and the disagreement is named. This document inherits
> nothing.

---

## 0 · Measurements taken for this map (re-derive, do not inherit)

| Claim | Command | Measured |
|---|---|---|
| Migration head / next free | `ls supabase/migrations/ \| tail -1` · `\| wc -l` | `115_workflow_phases_recorded_not_sent.sql` · **109 files** → next free **116** ✅ CONTEXT D-10 correct |
| Count gate | `node scripts/vitest-count-gate.cjs` | **running 2727 · pinned 2714 · +13 drift · failed 0 · 48/48 files** ⚠ `ExternalActionSection.test.tsx` pin reads **25** at `vitest-count-gate.cjs:697`, the file **runs 34** |
| `notConnectedOf` | `grep -n "notConnectedOf" …/phaseVocabulary.ts` · `wc -l` | function `:810-813`; file is **813** lines; **the line 190 edits is `812`** (`return true`) ⚠ CONTEXT `:811-814`, canonical_refs `:788-814` and the prompt `:788-814` are ALL wrong |
| `_exec_external_action` | `grep -n … phase_types.py` | **`:1810-1885`** (`RECORDED_INTENT_KEY` `:1705`, `_external_action_inputs` `:1729`, `_external_action_body` `:1778`, registry `:1892-1903`); file is **1918** lines ⚠ CONTEXT's `:1667-1903` is wrong |
| `secret_cipher` symbols | `sed -n '244,252p' secret_cipher.py` | `__all__ = [SECRET_COLUMNS, get_cipher, is_encrypted, **encrypt_secret**, **decrypt_secret**, sweep_row, encryption_status]` ⚠ CONTEXT D-11's `encrypt_value`/`decrypt_value` **do not exist** |
| `visual_workflow_canvas` allowlist | `grep -n "visual_workflow_canvas" backend/app/api/admin.py` | **`:104`, inside `_VISIBILITY_FEATURES`** (`:97-105`) — **not** `_FLAG_HUMAN_NAMES` (`:67-79`) ⚠ CONTEXT D-26 names the wrong allowlist |
| `ExternalActionSection` props | `sed -n '88,98p'` | **THREE** props (`capability`, `onChange`, `onPersist`) ⚠ CONTEXT's "six contract properties" are six **source-purity fences** at `ExternalActionSection.test.tsx:381-412` |
| Net-new targets absent | `ls` | `backend/app/security/egress.py` ✗ · `backend/app/services/connectors/` ✗ · `frontend/src/components/workflows/ConnectionPicker.tsx` ✗ — all genuinely net-new |
| `harness_audit` CHECK | (RESEARCH §M2, re-confirmed) | column `event_type`, **23** literals, `full-schema.sql:1124`; Python mirror `backend/app/db/workflows.py:107-137` |

---

## 1 · Empty-diff fences — FILES NO PLAN MAY OPEN

**These are not "avoid if possible". A non-empty diff on any of them fails the phase
(UI-SPEC §1b, §14; CONTEXT D-23/D-24/D-31).** No pattern assignment below proposes editing
any of them. If an analog seems to require it, the analog is wrong.

| File | Required `git diff --numstat` | Authority |
|---|---|---|
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | **`0 0`** | D-23; G-5 ledger (189-14 already spent the one gated line at `:1052-1054`) |
| `frontend/src/components/workflows/PhaseNode.tsx` | **empty** | D-24 (the `BadgeSlots` tuple; a spread retires the max-2 typecheck guard) |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | **empty** | D-24; the 188.2 extraction exists to make this true |
| `frontend/src/components/workflows/phaseNodeCardContract.ts` | **empty** | D-24 — fenced card-subtree module |
| `frontend/src/components/workflows/ownProperty.ts` | **empty** | D-24 — fenced card-subtree module |
| `frontend/src/components/workflows/NodeCornerMarks.tsx` | **empty** | D-24 — fenced card-subtree module |
| `frontend/src/components/workflows/NodeRunOverlay.tsx` | **empty** | D-24 — fenced card-subtree module |
| `frontend/src/components/workflows/NodeIconWell.tsx` | **empty** | D-24 — fenced card-subtree module |

Plus three **property** fences (not diffs):

- `phaseVocabulary.ts` keeps **ZERO import statements** after the `:812` edit (measured
  holding at HEAD — the only two `import`-matching lines are inside comments at `:509` and
  `:679`). The replacement line reads `phase.config`, a parameter the function already
  receives, so no import is needed.
- `ExternalActionSection.test.tsx`'s **six source-purity fences stay GREEN** after the
  mount line lands. The child import must be the relative sibling form `"./ConnectionPicker"`.
- The canvas badge maximum is **2**; a third badge is a typecheck error. 190 proposes none.

---

## 2 · File Classification

### 2a · Backend — net-new

| File | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/security/egress.py` | security module (one dangerous thing) | transform / validate-then-bind | `backend/app/security/secret_cipher.py` | **exact** (same package, same "single home" contract, same source-fence discipline) |
| `backend/app/services/connectors/protocol.py` | protocol / seam | request-response | `backend/app/services/email_provider.py:41-46` (`EmailProvider` Protocol) | **exact** |
| `backend/app/services/connectors/registry.py` | registry / dispatcher | request-response | `backend/app/services/provider_gateway/dispatcher.py` + `phase_types.PHASE_TYPE_REGISTRY_ENTRIES:1892-1903` | **exact** |
| `backend/app/services/connectors/smtp_adapter.py` | adapter | request-response (blocking I/O) | `email_provider.ResendProvider:55-81` + `retrieval_service.py:72-74` (`run_in_threadpool`) | role-match |
| `backend/app/services/connectors/jira_adapter.py` | adapter | request-response (async HTTP) | `provider_gateway/anthropic.py` (thin adapter body) | role-match |
| `backend/app/services/connectors/slack_adapter.py` | adapter | request-response (async HTTP) | same as Jira, **but the response contract differs** — see §4 anti-pattern |
| `backend/app/services/connector_service.py` | data-access service | CRUD + org-scoped resolve | `backend/app/services/classification_rule_service.py` (CRUD) + `sso_provider_service.get_management_token:62-94` (decrypt-at-call-time) | **exact** (two analogs, one per half) |
| `backend/app/api/connectors.py` | router | CRUD | `backend/app/api/classification_rules.py` (172 L) | **exact** |
| `backend/app/models/connector.py` | Pydantic models | request-response | `backend/app/models/classification_rule.py` + `models/harness.py:172-275` (`_StrictBase`) | role-match |

### 2b · Backend — modified

| File | Role | Data flow | What changes | Analog for the change |
|---|---|---|---|---|
| `backend/app/services/harness/phase_types.py` | executor | request-response | `_exec_external_action` `:1810-1885` gains the D-16 gate + a delegation to the registry | its own `_exec_programmatic` closed-registry raise, quoted at `:1867-1873` |
| `backend/app/models/harness.py` | model | — | `ExternalActionPhaseConfig` `:172-275` gains ONE additive-optional field | the class's own "additive-optional / ZERO-MIGRATION" docblock `:181-188` |
| `backend/app/db/workflows.py` | data access | — | `_AUDIT_EVENT_TYPES` `:107-137` gains ONE literal | the `# 114 (Phase 185 …)` comment block at `:134-135` |
| `backend/app/api/admin.py` | router constant | — | `_VISIBILITY_FEATURES` `:97-105` gains `live_connectors` | Phase 181's `visual_workflow_canvas` at `:102-104` |
| `backend/app/models/user_settings.py` | config default | — | `_GOVERNED_FEATURES` `:1192-1204` gains `"live_connectors": "off"` | Phase 181's `"visual_workflow_canvas": "off"` at `:1197-1204` |
| `backend/app/main.py` | wiring | — | one import name + one `include_router` | `:718-721` (each router registered with a one-line phase-tagged comment) |

### 2c · Migrations

| File | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `supabase/migrations/116_connector_connections.sql` | migration | schema | `supabase/migrations/104_org_dept_role_schema.sql:153-163` (`sso_configs` table) + `:372-390` (its four policies) + `106_org_id_autofill_trigger.sql:74-107` | **exact** (three-part composite) |
| `supabase/migrations/117_harness_audit_external_action_sent.sql` | migration | schema | `supabase/migrations/114_harness_audit_action_risk_pending.sql` (**49 lines, whole file**) | **exact** |
| `supabase/full-schema.sql` | generated artifact | — | regenerate only: `bash scripts/regenerate-full-schema.sh` (no `--reset`) — **never hand-edit** | n/a |

### 2d · Frontend — net-new

| File | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `frontend/src/components/workflows/ConnectionPicker.tsx` | component (leaf-with-fetch) | request-response + store write | `components/settings/ProviderPicker.tsx` (🔒 always-on footer) + `GovernanceSection.tsx` (panel child, no authored copy) | role-match ×2 |
| `frontend/src/components/workflows/SelectedPhaseSlugContext.tsx` | provider / context | — | `components/workflows/BuilderStoreProvider.tsx` (**81 lines — copy its whole shape**) | **exact** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | page section | CRUD list | `components/admin/UsersAndAccess.tsx` (518 L instrument-table roster) | **exact** |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | panel form | CRUD write | `components/workflows/PhaseFormPanel.tsx` — **READ ONLY, never edit** (`:742` title rule) + `ProviderPicker.tsx:202-222` (footer) | role-match |
| `ConnectionPicker.test.tsx` · `ConnectionsTab.test.tsx` · `ConnectionFormPanel.test.tsx` | tests | — | `ExternalActionSection.test.tsx` (fence idiom) · `components/admin/__tests__/UsersAndAccess.a11y.test.tsx` | **exact** |

### 2e · Frontend — modified

| File | Role | What changes | Diff budget |
|---|---|---|---|
| `frontend/src/components/workflows/ExternalActionSection.tsx` | component | **+1 import, +1 JSX line** below the radiogroup (after `:220`, before the `:227` note) | 2 insertions |
| `frontend/src/components/workflows/phaseVocabulary.ts` | vocabulary | **line 812 only** | 1 changed line |
| `frontend/src/pages/SettingsPage.tsx` | page | one `TabsTrigger value="5"` + one `TabsContent value="5"` | small |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | page | wrap the existing `BuilderStoreProvider` subtree (`:1808`) in `SelectedPhaseSlugProvider` | ~3 lines |
| `frontend/src/lib/api.ts` | api client | connector CRUD + check functions | additive |
| `scripts/vitest-count-gate.cjs` | gate | BASELINE pins for the three net-new suites **in the commit that creates them** | additive |

### 2f · Tests

| File | Role | Analog | Note |
|---|---|---|---|
| `backend/tests/unit/test_190_egress.py` (net-new) | test | `tests/unit/test_189_no_egress.py:206-232` (matcher positive control) | the §R14 29-address corpus |
| `backend/tests/unit/test_190_egress_ordering.py` (net-new) | test | — | **W0-3, RED first** |
| `backend/tests/unit/test_190_cross_org_credential.py` (net-new) | test | — | **W0-2, RED first** |
| `backend/tests/unit/test_190_connector_source_fence.py` (net-new) | test | `test_189_no_egress.py:206-262` (fence + positive control, **verbatim shape**) | D-05 |
| `backend/tests/unit/test_190_credentials.py` (net-new) | test | `sso_provider_service.py:82-94` is the behaviour under test | D-11, T5–T7 |
| `backend/tests/unit/test_190_smtp_header_injection.py` (net-new) | test | — | T12 + positive control |
| `backend/tests/unit/test_190_slack_ok_false.py` (net-new) | test | — | **T13 — the likeliest shipped lie** |
| `backend/tests/unit/test_189_no_egress.py` (modified) | test | itself | **re-scope Case B's DRIVE, keep `_block_all_http` byte-identical** |
| `backend/tests/unit/test_audit_event_registration.py` (modified) | test | itself `:96-140` | moves for the first time |
| `backend/tests/test_harness_engine.py` (modified) | test | itself `:1139-1148` | **W0-1: drive RED then green in the same commit** |

### 2g · Docs / planning artefacts

| File | Change | Analog |
|---|---|---|
| `docs/CONNECTOR-ARCHITECTURE.md` | **dated amendment section appended** — never an in-place edit of the verdict (that doc's own rule) | how 189-16 corrected the migration-head bullet |
| `.planning/prd-reset/DECISIONS.md` | superseding `D-v3.6-02` pointing at the amendment | the existing `D-v3.6-01` pointer entry |
| `.planning/ROADMAP.md` | Phase-190 SC#1 parenthetical corrected, superseded wording **preserved** | same 189-16 precedent |

---

## 3 · Pattern Assignments

### 3.1 `backend/app/security/egress.py` (security module, validate-then-bind)

**Analog:** `backend/app/security/secret_cipher.py` (252 lines) — **exact**. Same package
(`backend/app/security/` currently holds only `__init__.py` + `secret_cipher.py`, so D-05's
"sibling" claim is literally true), same "one module owns one dangerous thing" contract,
same source-fence enforcement.

**The contract sentence to copy, with the noun swapped** (`secret_cipher.py:1-6`):

```python
"""Phase 150 Plan 01 (SEC-01) — at-rest secret cipher (Fernet/MultiFernet wrapper).

The SINGLE source of key material and the encrypt/decrypt/detect/sweep/status
helpers every downstream seam imports (Plans 03/04/05). No ``Fernet(...)`` is
constructed anywhere else in the app — all key parsing and cipher construction
live here so there is exactly one place that reads ``SECRETS_ENCRYPTION_KEY``.
"""
```

→ 190's version: *"No HTTP or SMTP client is constructed anywhere under
`backend/app/services/connectors/`."*

**Failure-polarity docblock pattern** (`secret_cipher.py:8-14`) — state the polarity of each
failure mode explicitly, in the module header, with its decision id. 190's egress module owes
the same block: refusal → auditable reason string; unresolvable → refusal; pin-unavailable →
refusal.

**Module-private constant + prefix classification, never a blind attempt** (`:41-43`):

```python
# Explicit, versionable ciphertext marker. Classification is by this prefix — never
# by a blind decrypt (Pitfall 1).
_ENVELOPE_PREFIX = "enc:v1:"
```

→ 190's analogue: classify a destination by **parsing** (`httpx.URL(u).host`), never by
substring-matching the raw URL string (RESEARCH §R15's userinfo/fragment/homograph table).

**`__all__` at the bottom, naming the public surface** (`:244-252`) — copy this shape so the
source fence can assert *"adapters import only from this list"*.

**Return an auditable reason STRING, never a bool** — RESEARCH §R14's `refuse_reason(ip) ->
str | None` is the shape, and it is what makes D-08 (log capability + host + reason, never the
credential) implementable and UI-SPEC §4c's closed six-row reason table renderable. The
`encryption_status()` precedent at `:172-241` is the in-tree model for "return a structured
verdict the surface can render honestly rather than a boolean".

---

### 3.2 `backend/app/services/connectors/protocol.py` (protocol / seam)

**Analog:** `backend/app/services/email_provider.py:41-46` — **exact**. A `typing.Protocol`
with one method, plus a factory below it. This is the smallest, cleanest seam in the tree and
it is what "MCP-SHAPED" (D-01) should look like in code.

```python
from typing import Protocol

class EmailProvider(Protocol):
    """The one delivery seam every provider implements."""

    def send_invite(self, to: str, link: str, org_name: str) -> None:  # pragma: no cover
        ...
```

**Secondary analog for the request envelope:** `provider_gateway/dispatcher.py:41-85`
(`@dataclass GatewayRequest`) — a frozen-ish envelope the consumer fills and each adapter
destructures, with every field's provenance cited in the docstring. D-01's "named capability,
JSON argument object, structured result, declared input schema" maps onto this dataclass shape
one-for-one.

---

### 3.3 `backend/app/services/connectors/registry.py` (registry, closed set)

**Analog:** `phase_types.py:1888-1914` — **exact**, and it is the pattern D-04 names.

```python
# ── registration ──────────────────────────────────────────────────────────
# The 7 executors keyed by phase_type — the engine's PHASE_TYPE_REGISTRY dispatch
# seam (Plan 02) resolves each of these.
PHASE_TYPE_REGISTRY_ENTRIES: dict = {
    "programmatic": _exec_programmatic,
    ...
    # 189 CONN-01 — the 7th (the governed external action, D-01): resolves a closed
    # capability, RECORDS what it would have done, and SENDS NOTHING (SC#4).
    "external_action": _exec_external_action,
}
```

**The static-assert half — copy the shape, derive the count, never re-type the list.**
`models/harness.py:229-235` records the two-spellings rule verbatim:

> *"Two spellings of one closed set are unavoidable (Pydantic needs a literal; the frozenset
> is the runtime home and this module must not import a service), so the agreement is
> MECHANICAL rather than remembered."*

The adapter registry is the **sixth** consumer of `EXTERNAL_ACTION_CAPABILITIES`
(`harness/grounding.py:947-970`). It must key off that frozenset with a module-scope `assert`,
and the fence test plants a 4th key and observes the `assert` fire **at import**.

**The closed-lookup raise to copy verbatim** (`phase_types.py:1867-1873`):

```python
capability = getattr(phase.config, "capability", None)
if capability not in EXTERNAL_ACTION_CAPABILITIES:
    raise KeyError(
        f"external_action phase {getattr(phase, 'slug', '?')!r}: capability "
        f"{capability!r} is not registered in EXTERNAL_ACTION_CAPABILITIES "
        f"(closed set — register it explicitly)"
    )
```

---

### 3.4 `backend/app/services/connectors/smtp_adapter.py` (adapter, blocking I/O)

**Analog A — the provider body shape:** `email_provider.py:55-81` (`ResendProvider`). Note
what it already does right and 190 must keep: escape tenant-controlled strings at the
outbound trust boundary, with the reasoning inline.

```python
class ResendProvider:
    """``EMAIL_PROVIDER=resend`` — real email via the Resend SDK (opt-in, lazy-imported)."""

    def send_invite(self, to: str, link: str, org_name: str) -> None:
        # LAZY import: the `resend` package is only required when real email is enabled…
        import resend

        resend.api_key = settings.resend_api_key
        # WR-02: org_name is tenant-controlled (organizations.name) and link is composed
        # server-side — HTML-escape BOTH before interpolating into the email body…
        safe_org = html.escape(org_name)
        safe_link = html.escape(link, quote=True)
```

**Analog B — ⚠ THE BLOCKING-I/O RULE, and it is the easiest defect in this phase to ship.**
`smtplib` is synchronous. CLAUDE.md's D-v2.5-01 forbids blocking I/O in an async handler, and
`_exec_external_action` is `async def`. The shipped pattern with its measured incident is
`retrieval_service.py:65-74`:

```python
# SEED-065: embed_texts is a SYNC OpenAI HTTP call. Running it directly on the
# event loop froze ALL request serving for the embedding round-trip — under a
# search-heavy llm_batch_agents fan-out (N concurrent sub-agents) that stacked
# into multi-second idle-request stalls… Wrap in run_in_threadpool
# so the blocking HTTP call leaves the loop (the D-v2.5-01 pattern…).
query_embedding = (
    await run_in_threadpool(embed_texts, [query], user_settings=user_settings)
)[0]
```

**Belongs in the plan's acceptance criteria, not in review.**

**Analog C — none exists for the header-injection defence.** Per RESEARCH §R13 the mitigation
is architectural: compose with `email.message.EmailMessage`, set headers via
`msg["Subject"] = …` (the stdlib raises `ValueError` on CR/LF — driven), and call
`smtp.send_message(msg)`. The D-05 source fence gains `.sendmail(` as a banned token.

---

### 3.5 `backend/app/services/connectors/{jira,slack}_adapter.py` (adapters, async HTTP)

**Analog:** `provider_gateway/anthropic.py` (124 L) / `google.py` (106 L) — thin adapter
modules behind one dispatcher, each lazily imported by the dispatcher rather than at module
scope (`dispatcher.py:106-116`):

```python
if provider == "anthropic":
    # Lazy import: keep the raw-SDK service module out of the dispatcher's
    # import-time graph…
    from .anthropic import open_anthropic_stream

    return open_anthropic_stream(request), CallingMode.NATIVE
```

**⚠ The one place the analog must NOT be followed:** `dispatcher.py` deliberately funnels
"everything else" into one shared `openai_compat` branch. **Jira and Slack must not share a
response check.** Jira signals errors with HTTP status codes (`raise_for_status()` correct);
Slack returns **HTTP 200** with `{"ok": false, "error": …}` (`raise_for_status()` reads that as
success — RESEARCH §R11, threat T13, UI-SPEC §8c). A shared `_check_response()` helper *is* the
"Complete for a send that did not leave the app" defect (D-31).

**Slack's host is a module constant** (D-02) — the in-tree precedent for a code-constant
destination is `slack_adapter.SLACK_API_BASE`'s cousin, `email_provider.compose_invite_link`
(`:30-38`), which composes server-side from existing config rather than accepting a URL:

```python
def compose_invite_link(raw_token: str) -> str:
    """Compose the invite link server-side from ``settings.frontend_url`` (the link base).

    Reuses the EXISTING ``frontend_url`` config — deliberately NO new env var for the link base
    (RESEARCH Open-Question 3)…
    """
```

---

### 3.6 `backend/app/services/connector_service.py` (service — CRUD + the org-scoped resolve)

Two analogs, one per half.

**Analog A — CRUD + security-invariant docblock:** `classification_rule_service.py:1-30`.
Copy the "Security invariants" header block verbatim in shape; it is where D-14's rule belongs:

```python
"""Classification-rule CRUD data-access service (Phase 118, CLASS-01).
…
Security invariants (T-118-02-01 / T-118-02-02 / T-118-02-03):
  - create_rule HARD-SETS is_system_global=False and enabled=True (never trusts a caller
    arg; the RLS WITH CHECK at migration 071 forces is_system_global on INSERT/UPDATE too —
    this hard-set is defense-in-depth). …
"""
```

→ 190's invariants: `resolve(connection_id, org_id)` **never** selects by id alone; the write
path hard-sets `org_id` from the caller (the mig-116 trigger is defence in depth, not the gate).

**Analog B — decrypt at call time, fail-CLOSED on the read:**
`sso_provider_service.get_management_token()` `:62-94` is the closest existing behaviour and it
already does the read-side inversion D-11 asks for:

```python
if is_encrypted(raw):
    cipher = get_cipher()
    if cipher is None:
        logger.error(
            "sso_provider_service: %s is encrypted but no SECRETS_ENCRYPTION_KEY is configured "
            "— cannot decrypt (fail closed)", _MGMT_TOKEN_COLUMN,
        )
        raise SsoProviderError(
            "management token is encrypted but SECRETS_ENCRYPTION_KEY is not configured"
        )
    return decrypt_secret(raw, cipher)
# No envelope: the value is plaintext at rest (fail-open D-150-01 — no master key). Return as-is.
return raw
```

⚠ **Line 93-94 is exactly the polarity D-11 inverts.** `app_settings` tolerates a plaintext
value at rest; a tenant credential does not. 190's resolver must **refuse** a
non-`enc:v1:` stored value, and its writer must refuse when `get_cipher()` returns `None`.
Copy `:82-92`; do **not** copy `:93-94`.

**The reuse verdict per symbol** (measured `__all__`, `secret_cipher.py:244-252`):

| Symbol | Verdict |
|---|---|
| `get_cipher()` → `MultiFernet \| None` (`:74-83`) | **REUSE** — and this is the exact site of D-11's inversion |
| `encrypt_secret(plaintext, cipher)` (`:91-94`) | **REUSE verbatim** — takes the cipher as an argument, so it cannot fail open on its own |
| `decrypt_secret(value, cipher)` (`:97-104`) | **REUSE verbatim** at call time |
| `is_encrypted(value)` (`:86-88`) | **REUSE** — classify by prefix, never try-decrypt |
| `_ENVELOPE_PREFIX` (`:43`) | read through `is_encrypted`; **never re-type the literal** |
| `sweep_row(row)` (`:107-169`) | **DO NOT REUSE** — hard-keyed to `SECRET_COLUMNS`, iterates ONE `app_settings` row |
| `SECRET_COLUMNS` (`:50-59`) | **DO NOT EXTEND.** Its own comment (`:47-49`) explains why: *"Adding a name here is all it takes for main.py's boot sweep_row to encrypt that app_settings column at rest"* — a per-org per-row table cannot be swept that way (RESEARCH Pitfall 5, confirmed by reading `:107-124`) |

**Analog C — the user-JWT path (D-15).** `retrieval_service._call_as_user` `:37-52`:

```python
async def _call_as_user(user_id: str, fn_sql: str, *args) -> list[dict]:
    """Run a retrieval RPC (or any SELECT) over the Phase-163 asyncpg user-context (D-164-02).
    …
    Fail-closed: on a service-role/owner connection ``auth.uid()`` is NULL
    → empty org set → 0 rows.
    """
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(fn_sql, *args)
    return [dict(r) for r in rows]
```

**Use it for the API-side CRUD.** The harness engine runs on the BYPASSRLS pool, so **at the
executor's resolve call site the application org filter IS the gate and RLS is the backstop** —
and D-15 requires the plan to say which applies at each site, per call site, rather than
asserting "RLS covers it".

---

### 3.7 `backend/app/api/connectors.py` (router, CRUD)

**Analog:** `backend/app/api/classification_rules.py` (172 L) — **exact**. Its own header
records that it was itself cloned from `api/document_views.py`, so this is the house CRUD shape.

```python
router = APIRouter(prefix="/classification-rules", tags=["classification-rules"])


@router.get("", response_model=list[RuleResponse])
async def list_rules(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """List the caller's own rules plus global ones (deduped, ordered by name)."""
    rows = await classification_rule_service.list_rules(current_user["id"], supabase=supabase)
    return [RuleResponse(**r) for r in rows]
```

**Two rules its docblock states that 190 inherits verbatim** (`classification_rules.py:11-19`):

- *"Every cross-user/unseeable miss collapses to a generic 404, NEVER the forbidden status —
  no existence leak."* → a connection id from another org must 404, never 403.
- *"UPDATE validates ownership FIRST … so an unowned/absent id uniformly 404s regardless of
  whether the submitted body is valid — no 422-vs-404 ordering oracle."*

**The org-admin gate (UI-SPEC U-02) is API-enforced, and the dependency factory already
exists** — `dependencies.py:518-557`, `require_visible(feature)`:

```python
def require_visible(feature: str):
    """VIS-01 API-layer visibility gate (D-03 / D-167-06). A dependency FACTORY.
    …
    Attach PER-ENDPOINT on the governed authoring/management endpoints ONLY — never at a
    router level that would gate a Run/chat carve-out…
    """
```

For a **role**-based (not operator-based) create/edit/delete gate, the SQL-side analog is
`current_user_has_permission(org_id, 'org:manage')` (seeded to `super-admin` + `org-admin` at
`104_org_dept_role_schema.sql:416-426`). Prefer that over inventing a new permission key.

**Router registration:** `main.py:701` (import name) + one `include_router` line with a
phase-tagged comment, matching `:718-721`.

---

### 3.8 `backend/app/services/harness/phase_types.py` — `_exec_external_action` (MODIFIED)

**Measured signature and return, `:1810` and `:1882-1885` — both keys are load-bearing:**

```python
async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict:
    ...
    return {
        "text": _external_action_body(capability, resolved),
        RECORDED_INTENT_KEY: {"capability": capability, "inputs": resolved},
    }
```

`text` is what `_latest_phase_text` scans for; `recorded_intent` is what the engine branches on
at `harness_engine.py:1764-1774`:

```python
from app.services.harness.phase_types import RECORDED_INTENT_KEY

_recorded_intent = (
    output.get(RECORDED_INTENT_KEY) if isinstance(output, dict) else None
)
if _emit_failure:
    await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
elif _recorded_intent:
    await record_phase_not_sent(pool, phase_id, durable_output)
else:
    await complete_phase(pool, phase_id, durable_output)
```

**D-16 — the gate site, and it is ONE LINE with NO signature change.** `ctx` is a plain
`SimpleNamespace` set at exactly one place (`publish_service.py:840-868`), and the engine
already reads the flag off it the same way at `harness_engine.py:837`:

```python
_armed = getattr(phase, "action_risk_armed", False)
if _armed and getattr(ctx, "is_golden_run", False):
```

So the executor's gate is `if getattr(ctx, "is_golden_run", False):` — **skip the send, keep the
record**, so `_external_action_body` (`:1778-1807`) remains the single composer of that sentence
(D-16 shape 1). The engine's own comment at `:832-835` names both shapes and hands 190 the
choice; the plan takes the first.

**The re-open trigger is already armed and must be observed, not routed around**
(`harness_engine.py:825-830`):

```python
# ``test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress``
# drives a REAL golden run with the widened no-egress transport sentinel armed…
# It passes today BECAUSE the step is inert.
# THE DAY A REAL SEND IS ADDED IT GOES RED, on the publish path specifically, naming this
# comment. That is the re-open trigger, expressed as a check rather than as prose.
```

**⚠ The docblock at `:1814-1829` is now FALSE and must be rewritten in the same commit.** It
currently asserts *"this executor performs NO network I/O"* and *"NOTHING IN THIS FUNCTION MAY
NAME A TRANSPORT, NOT EVEN TO DENY IT"* — that second sentence is a live fence
(`test_189_no_egress.py:237-262` walks `backend/app/**` for the `mcp` token; plan 189-09's
criteria grep this body for HTTP-client names). D-01 builds **no MCP client**, so the `mcp`
fence stays GREEN and untouched; the HTTP-client-name half is what 190 re-scopes, deliberately,
by moving every transport name behind `connectors/` + `egress.py`.

---

### 3.9 `backend/app/models/harness.py` — `ExternalActionPhaseConfig` (MODIFIED, D-13)

**Analog: the class's own arrival.** Its docblock at `:181-188` is the pattern for adding one
optional field, quoted so the plan can reuse the reasoning rather than re-derive it:

```
Additive-optional / ZERO-MIGRATION: appended to the ``PhaseConfig`` union as the 7th
discriminated member — the standard extension… ``_StrictBase`` rejects unknown keys (D-07);
old JSONB phase rows without ``external_action`` still ``model_validate()``, because an old
row never names the new member.
```

**The measured field block to extend** (`:243-256`):

```python
    phase_type: Literal["external_action"]
    capability: Literal["send_email", "create_ticket", "post_message"]
    # DERIVED, never authored — see the D-03 block above.
    available_tools: list[str] = Field(default_factory=list)

    # NO SHAPE-SYMMETRY OPTIONALS, and the omission is the decision. …
```

⚠ **That last comment block (`:258-265`) is a standing refusal to add optionals, and 190 is
adding one.** The plan must extend the comment with `connection_id`'s justification in the same
commit — a reference id is not a shape-symmetry optional; it is the one fact the executor needs
and the one CONN-03 SC#4 permits into the JSONB (**no secret, no host, no token**).

**Do not add a validator that resolves the id.** The `_available_tools_is_the_capability`
validator at `:267+` coerces rather than raises specifically so *"a stale client that sends an
empty list must not brick the definition it is saving"* — the same fail-closed-but-not-brittle
posture applies: an unresolvable `connection_id` is a **run-time** `recorded_not_sent`
(D-17), never a save-time 422.

---

### 3.10 `supabase/migrations/116_connector_connections.sql`

**Analog A — the table + index shape:** `104_org_dept_role_schema.sql:153-163` (`sso_configs`,
the closest sibling: an org-scoped per-org configuration table):

```sql
CREATE TABLE IF NOT EXISTS public.sso_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email_domain text,
    provider_id text,
    attribute_mapping jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id ON public.sso_configs USING btree (org_id);
COMMENT ON COLUMN public.sso_configs.provider_id IS 'D-07: nullable pointer to …';
```

Note three things to copy: `CREATE TABLE IF NOT EXISTS` (the file's own re-paste-safety rule
at `:23`), a `btree` index on `org_id`, and a `COMMENT ON COLUMN` carrying the decision id for
any column whose shape is non-obvious — `secret_ciphertext`, `last_check_verdict` and
`config` each earn one.

**Analog B — the four RLS policies:** `104_org_dept_role_schema.sql:372-390`:

```sql
CREATE POLICY sso_configs_select ON public.sso_configs
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_insert ON public.sso_configs;
CREATE POLICY sso_configs_insert ON public.sso_configs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'sso:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_update ON public.sso_configs;
CREATE POLICY sso_configs_update ON public.sso_configs
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'sso:manage'))
  WITH CHECK (public.current_user_has_permission(org_id, 'sso:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS sso_configs_delete ON public.sso_configs;
CREATE POLICY sso_configs_delete ON public.sso_configs
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'sso:manage'));
```

**This analog is a better fit than the `skills` policy RESEARCH §M8 quotes,** and the
difference is exactly UI-SPEC U-02: `sso_configs` reads **org-wide** and writes **permission-
gated**, which is precisely "read + bind org-wide, create/edit/delete org-admin only". The
permission `org:manage` is already seeded to `super-admin` + `org-admin`
(`104:416-426`) — reuse it rather than minting `connectors:manage` unless the plan wants a
fifth key, in which case the seed INSERT is the same block.

**⚠ D-12's decision is an ABSENCE:** there is no `is_system` / `is_system_global` branch in the
SELECT policy. That absence is the decision (it is the exact branch SEED-125 / mig 112 had to
close for skill files) and it must be stated in the migration's header comment, not left to be
inferred.

**Analog C — the autofill trigger** (`106_org_id_autofill_trigger.sql:74-107`), a
`SECURITY DEFINER` / `SET search_path = ''` function that no-ops when `org_id` is supplied and
fails safe to `NULL` (which the `NOT NULL` column then rejects):

```sql
CREATE OR REPLACE FUNCTION public.autofill_org_id_by_owner()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_owner_col text := TG_ARGV[0];      -- 'user_id' (GROUP 1) or 'created_by' (GROUP 2)
BEGIN
  -- Forward-compat NO-OP: org_id already provided (e.g. Phase 163) -> keep it verbatim.
  IF NEW.org_id IS NOT NULL THEN RETURN NEW; END IF;
  ...
```

`connector_connections` uses `created_by` → **GROUP 2**, so `TG_ARGV[0]` is `'created_by'`:

```sql
DROP TRIGGER IF EXISTS connector_connections_autofill_org_id ON public.connector_connections;
CREATE TRIGGER connector_connections_autofill_org_id BEFORE INSERT ON public.connector_connections
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');
```

**Sketch-155 column obligations that land here, not in a follow-up:** `last_checked_at` +
`last_check_verdict` (the `Credential` column), and `is_enabled` (Gate 2 reads it).

---

### 3.11 `supabase/migrations/117_harness_audit_external_action_sent.sql`

**Analog:** `114_harness_audit_action_risk_pending.sql` — **exact, whole-file, 49 lines.** It
is the one-literal amendment precedent and its header is the model for how to justify a
migration by naming the measured failure it prevents:

```sql
ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        ...
        -- 185 (GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
        'action_risk_pending'
    )
);
```

**Both layers move in the same commit.** The Python mirror is
`backend/app/db/workflows.py:107-137`, and the comment convention is per-migration:

```python
        # 114 (Phase 185 GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
        "action_risk_pending",
    }
)
```

**Do not re-type a count anywhere.** `write_audit`'s own error message derives it
(`db/workflows.py:1188-1196`), and the docblock at `:1175-1177` records why:

```python
        raise ValueError(
            f"write_audit event_type must be one of the "
            f"{len(_AUDIT_EVENT_TYPES)} harness_audit kinds "
            f"(059 + 069 + 070 + 114), got {event_type!r}"
        )
```

⚠ The `(059 + 069 + 070 + 114)` provenance string in that message and in the docblock is
hand-maintained — **190 appends `+ 117` there too**, or the message starts lying.

**The fence that binds it:** `test_audit_event_registration.py:101-114` reads *the
highest-numbered migration that DEFINES the CHECK*, not the highest-numbered migration — so 116
is invisible to it and 117 becomes the source of truth. The ordering CONTEXT D-20 chose needs no
special handling.

---

### 3.12 `backend/app/api/admin.py` + `models/user_settings.py` — the `live_connectors` switch

⚠ **CONTEXT D-26 names the wrong allowlist.** Measured: `visual_workflow_canvas` is at
`admin.py:104`, inside `_VISIBILITY_FEATURES` (`:97-105`), **not** `_FLAG_HUMAN_NAMES`
(`:67-79`). Taking `_FLAG_HUMAN_NAMES` costs an `app_settings` **boolean column** = a third
migration (118). Taking `_VISIBILITY_FEATURES` costs **zero migrations**.

**The Phase-181 precedent, verbatim** (`admin.py:97-112`):

```python
_VISIBILITY_FEATURES = {
    "skill_studio",
    "model_management",
    "workflow_authoring",
    "governance_health",
    # Phase 181 (REVERT-01 / T-181-03): the v3.6 canvas flag is operator-writable through
    # the SAME allowlisted PUT /admin/visibility path (Off = "off", On = "everyone").
    "visual_workflow_canvas",
}
_VISIBILITY_AUDIENCES = {"everyone", "operators", "role", "off"}
```

**And its cold default — the half that makes "zero migration" true** (`user_settings.py:1192-1204`):

```python
_GOVERNED_FEATURES: dict[str, str] = {
    "skill_studio": "operators",
    ...
    # Phase 181 (REVERT-01 / D-181-01,05): the v3.6 visual_workflow_canvas layer ships
    # behind a governed flag whose cold default is the 5th audience enum member "off" —
    # hidden from EVERYONE, operators included. This is the ONE authoritative cold default
    # (an unseeded feature_visibility key falls through to it), which is why NO migration is
    # needed: the app_settings.feature_visibility JSONB gains the key only on an operator
    # flip via set_feature_visibility's atomic `||` merge ("off" -> "everyone" and back).
    "visual_workflow_canvas": "off",
}
```

→ 190 adds **two lines** across two files: `"live_connectors"` to the allowlist,
`"live_connectors": "off"` to the cold defaults. `api/features.py:66-82` already honours `"off"`
over the operator short-circuit, and `dependencies.require_visible` (`:518-557`) is the
per-endpoint enforcement if the plan wants the API half.

⚠ If the operator prefers **true kill-switch semantics** (a boolean with the plain-language
audit label `flag.live_connectors.off`), that is `_FLAG_HUMAN_NAMES` + **migration 118** —
budget it at plan-phase, do not discover the column mid-execution.

---

### 3.13 `frontend/src/components/workflows/ConnectionPicker.tsx` (NET-NEW — §M4's resolution)

**Why it exists (measured, not asserted):** putting the fetch inside `ExternalActionSection.tsx`
turns all six of these RED (`ExternalActionSection.test.tsx:381-412`):

```ts
describe("ExternalActionSection — source purity", () => {
  it("imports nothing from the API client and opens no request", () => {
    expect(externalActionSectionSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(externalActionSectionSource).not.toMatch(/fetch\(/)
    expect(externalActionSectionSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    // Nor any route string: the option set is a mirror, never a read.
    expect(externalActionSectionSource).not.toMatch(/["'`]\/(workflows|api)\//)
  })

  it("is a LEAF — no context, no store, no effect", () => {
    expect(externalActionSectionSource).not.toMatch(/useContext|useStore|useEffect|zustand/)
  })

  it("carries NO title attribute — guidance cannot regress into a tooltip", () => {
    expect(externalActionSectionSource).not.toMatch(/title=/)
  })
```

and each fence already carries its own positive control at `:398-412`. **The child import must
be `"./ConnectionPicker"`** — the route fence regex requires a leading slash, so a relative
sibling cannot match. **Run the fences after the mount line lands; do not trust that sentence.**

**Analog A — the always-on 🔒 footer:** `components/settings/ProviderPicker.tsx:202-222`:

```tsx
      {/* ALWAYS-ON 🔒 endpoint footer (sketch 024 winner) — where-it-runs is
          never a click away. The legible half of the BUG-260616-01 cure. */}
      <div className={cn("flex items-center gap-2 rounded-md px-3 py-2 ghost-border",
          isLocal ? "bg-success/10 border-success/30" : "bg-primary/10")}>
        <Lock className={cn("h-3.5 w-3.5 shrink-0", isLocal ? "text-success" : "text-primary")} />
        <span className="text-xs font-mono text-foreground/90 truncate" title={footerParts.join(" · ")}>
          {footerParts.join(" · ")}
        </span>
```

⚠ **Copy the structure, NOT the `title=` attribute.** UI-SPEC §4a-4 and §12 bind refusal/reason
text to real DOM text via `aria-describedby` — *"never a `title`"* (142-B, the 184-07 lesson).
`ProviderPicker` uses `title` as a truncation affordance; the 190 footer must not.

Also copy the derived-footer idiom (`ProviderPicker.tsx:159-165`) — build the footer from parts
during render, never from state:

```tsx
  // The always-on footer text (endpoint · dims · threshold · key note).
  const footerParts = [footerEndpoint(value.base_url)]
```

**Analog B — a panel child that authors no copy of its own:** `GovernanceSection.tsx:10-17`:

```
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` — the same
 * `STRANDING_REASON` / `StepTypePicker` idiom, and for the same reason: a refusal
 * reason that lives inside a component is a refusal reason nobody can test for drift.
 * Its suite asserts character-identity against those imported names.
```

⚠ `ConnectionPicker` **does** consult the server (that is why it is a child), but the
**copy** half binds unchanged: UI-SPEC §4c's closed six-row refusal table and §6d's state
strings become exported identifiers, asserted by character-identity — never inline literals.

**Analog C — the mount point.** Insert one JSX line inside the existing
`<section data-section="external-action">`, after the radiogroup closes at
`ExternalActionSection.tsx:220` and before the `selected === null` note at `:227`, rendered only
when a capability is selected (UI-SPEC §6b). The note at `:222-231` stays untouched — its
docblock already anticipates this phase.

**Analog D — degrade, never throw.** `BuilderStoreProvider.tsx:41-51`:

```tsx
/**
 * Non-throwing accessor — `null` outside a provider (the `useTechnicalNamesOptional`
 * idiom). Leaves use this so an isolated render still works.
 */
export function useBuilderStoreOptional(): BuilderStore | null {
  return useContext(BuilderStoreContext)
}
```

`ExternalActionSection.test.tsx` renders the section standalone with no store and no provider.
The picker MUST use the optional readers and render its disconnected state, or 190 turns a
shipped suite RED for a reason unrelated to connections.

---

### 3.14 `frontend/src/components/workflows/SelectedPhaseSlugContext.tsx` (NET-NEW)

**Analog:** `frontend/src/components/workflows/BuilderStoreProvider.tsx` (81 lines) — **exact.
Copy the whole file's shape**: a `createContext<T | null>(null)`, a children-only provider that
emits no DOM, a throwing accessor for writers, a non-throwing accessor for leaves.

```tsx
const BuilderStoreContext = createContext<BuilderStore | null>(null)

/** Carry one Builder mount's store to its subtree. Renders children only — no DOM. */
export function BuilderStoreProvider({ store, children }: BuilderStoreProviderProps) {
  return <BuilderStoreContext.Provider value={store}>{children}</BuilderStoreContext.Provider>
}
```

**The "renders CHILDREN ONLY, emits no DOM element" property is load-bearing** — its docblock
at `:18-21` records that wrapping the page cannot move `graphChild` out of the grid's
first-child position (the D-183-03 flag-off contract at `WorkflowBuilderPage.tsx:520-522`). The
new provider inherits the same constraint.

**The mount site** (`WorkflowBuilderPage.tsx:1808`, measured):

```tsx
  return (
    <BuilderStoreProvider store={store}>
    <div className="flex h-full flex-col bg-background">
```

`selectedSlug` is React state at `:582`; the existing write idiom to mirror is
`onPhaseChange` at `:1262-1268`:

```tsx
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      if (selectedSlug === null) return
      store.getState().patchConfig(selectedSlug, patch)
    },
    [selectedSlug, store],
  )
```

The picker's write is the same two calls off the store
(`store.getState().patchConfig(slug, { connection_id })` + `flushHistory()`), reached through the
new context rather than a prop — because a prop would need a fourth argument on
`ExternalActionSection`, hence a fourth on `PhaseFormPanel`, which breaks D-23's `0 0`
(`PhaseFormPanel.tsx:730` — `const set = (key: string) => …` is **key-bound**).

---

### 3.15 `frontend/src/components/workflows/phaseVocabulary.ts` — ONE LINE (D-24)

**Measured at `:810-813`. The line 190 replaces is `812`.**

```ts
export function notConnectedOf(phase: PhaseSpecJSON): boolean {
  if (phase.config?.phase_type !== EXTERNAL_ACTION_PHASE_TYPE) return false
  return true
}
```

The docblock immediately above (`:788-809`) is the design contract 190 executes and it names its
own successor explicitly:

```
 * ⚠ THE TYPE TEST AND THE STATE TEST ARE ON SEPARATE LINES, ON PURPOSE… When
 * Phase 190 binds a real destination, it edits the SECOND line only — `return
 * <no destination bound>` — the badge stops rendering because the DATA changed, and
 * `PhaseNode.tsx` and `PhaseNodeCard.tsx` are both untouched.
```

**The suite gains its first genuine bound case** (UI-SPEC §7c): a rendered `external_action`
phase **with** a `connection_id`, asserting the badge is ABSENT, alongside the shipped case
asserting it is present without one. Without both, the one-line edit is unguarded.

**Property fence to re-run after the edit:** zero import statements
(`grep -nE "\bimport\b|\brequire\(|from ['\"]" phaseVocabulary.ts` → two hits, both inside
comments at `:509` and `:679`). Plant `import x from "y"`, observe RED, restore.

---

### 3.16 `frontend/src/components/settings/ConnectionsTab.tsx` (NET-NEW)

**Analog:** `frontend/src/components/admin/UsersAndAccess.tsx` (518 L) — **exact**. UI-SPEC
§2c names it as the 068-A instrument-table roster and §15 forbids adding a `<table>` primitive.

**The roster container** (`UsersAndAccess.tsx:166-179`):

```tsx
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="divide-y divide-border/60">
            {(filtered ?? []).map((row) => (
              <RosterRow key={row.id} row={row} … />
            ))}
          </div>
```

**The two distinct empty states** — filtered-to-zero vs genuinely empty (`:158-165`):

```tsx
            {query.trim() ? "No users match that search" : "No users yet"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {query.trim() ? "Try a different email fragment." : "Users appear here once they sign up."}
```

UI-SPEC §2d/§2e require exactly this split, with different copy per branch.

**The state chip — glyph/word, never colour alone** (`:280-290`):

```tsx
        {disabled ? (
          <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            Disabled
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            Active
          </span>
        )}
```

⚠ UI-SPEC §12 requires each of the four connection states to carry a **glyph AND a word**
(`✓ Ready` · `◌ Not checked` · `✕ Credential failed` · `⏻ Disabled`) so it reads in greyscale —
this analog carries the word but not the glyph. Add the glyph; keep `text-[11px] font-medium`
(the shipped `500` weight — UI-SPEC U-13).

**The victim-naming sheet** (`:385-405`) — `Sheet side="bottom" className="mx-auto max-w-lg"`,
a restorative "Keep active" secondary and a destructive primary that **names the victim in the
button label**:

```tsx
              <button type="button" onClick={() => setConfirm(null)} …>
                Keep active
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runWrite(() => onDisable(row.id), "Disabled · recorded")}
                className="… bg-destructive …">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Disable {email}
              </button>
```

Note `runWrite(fn, "Disabled · recorded")` — that is the **receipt-not-toast** idiom UI-SPEC
§2g requires (`✎ {verb} · recorded`). Reuse it; do not introduce a toast.

---

### 3.17 `frontend/src/components/settings/ConnectionFormPanel.tsx` (NET-NEW)

**Analog:** `frontend/src/components/workflows/PhaseFormPanel.tsx` — **READ ONLY**. It is the
400px push/split shell's lineage (UI-SPEC §3a) and the source of the two inherited type rules
(UI-SPEC §11b): the panel title is `text-[13px] font-semibold` at `PhaseFormPanel.tsx:742`, and
the field label is `text-[11px] font-medium` at `:228`. **Mirror those rules; do not open the
file to import from it, and do not "unify" the two title styles.**

**Secondary analog for the shell grid:** `WorkflowBuilderPage.tsx:1833-1836`:

```tsx
        className="grid min-h-0 min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
        style={{ gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px") }}
```

**No analog exists for the panel's focus trap / focus restore** — `Dialog` would have given
both free and the push/split panel gives neither. UI-SPEC §3a and §12 name this as **net-new
a11y work**; it is a plan task, not a review finding.

**The write-only secret** (UI-SPEC §3d) — the dots are a `font-mono` `<span>`, **never an
`<input type=password>` carrying a fake value**. `ProviderPicker.tsx:167` shows the shipped
masked-key sentinel idiom (`const isMasked = value.api_key === KEY_PLACEHOLDER`) — reuse the
sentinel concept, but render text, not an input.

---

### 3.18 `frontend/src/pages/SettingsPage.tsx` — ONE TAB (MODIFIED)

**Measured seams:**

```tsx
// :521-528 — there is NO router; the "route" is a localStorage-persisted numeric string
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("settings_active_tab") ?? "0"
  })

  function handleTabChange(value: string) {
    setActiveTab(value)
    localStorage.setItem("settings_active_tab", value)
  }
```

```tsx
// :874-884 — the five shipped tabs; the file records the routing-key discipline itself
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="0">AI Model</TabsTrigger>
            {/* D-04: display-only relabel via the term-map … value="1" — the tab
                ROUTING key — is unchanged (D-02a / no contract break). */}
            <TabsTrigger value="1">{retrievalTabLabel}</TabsTrigger>
            <TabsTrigger value="2">Integrations</TabsTrigger>
            <TabsTrigger value="3">Memory</TabsTrigger>
            <TabsTrigger value="4">Audit Log</TabsTrigger>
          </TabsList>
```

→ UI-SPEC U-01: **routing key `"5"`** (appending the next free key renumbers nothing, so every
user's persisted tab keeps pointing where they left it), **visually fourth** (the `TabsList`
order is independent of the key). Label `Connections`, no deep link.

**The card wrapper** (`SettingsPage.tsx:189-200`) — pass a `title` string, render no type of
your own:

```tsx
function SectionCard({ title, description, children }: {
  title: string; description: string; children: React.ReactNode
}) {
  return (
    <Card className="ghost-border bg-card/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">{title}</CardTitle>
```

---

### 3.19 `frontend/src/lib/api.ts` — the connector client functions (MODIFIED)

**Analog:** `api.ts:130-136` — the house shape is a bare `fetch` per function with
`getAuthHeaders()`, an explicit `res.ok` check and a typed cast. There is no generic request
wrapper; **do not introduce one for this phase.**

```ts
export async function listThreads(): Promise<Thread[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, { headers })
  if (!res.ok) throw new Error("Failed to list threads")
  return res.json() as Promise<Thread[]>
}
```

**T7 fence:** the response type must not carry `secret_ciphertext`. Assert it on the **Pydantic
response model** (backend) as the real gate; the TS type is documentation.

---

### 3.20 Tests — the fence idiom (`test_190_connector_source_fence.py` and friends)

**Analog:** `backend/tests/unit/test_189_no_egress.py:206-262` — **exact, and this shape is
mandatory.** A fence gets a positive control *test of its own*, listed FIRST, with both a
fires-on corpus and a must-not-fire corpus:

```python
def test_the_mcp_matcher_actually_matches():
    """V11 positive control — the fence's matcher fires on a haystack that HAS the token.

    Without this, a typo in the regex (or an accidental over-escape) would make
    ``test_no_mcp_identifiers_in_backend_app`` green forever while checking nothing at all.
    """
    for haystack in fires_on:
        assert _MCP_TOKEN.search(haystack), (…)

    # The boundary half, so the fence is not a bare substring search…
    for haystack in ["mcpherson", "compute", "dmcpx", "camp", "McPherson"]:
        assert not _MCP_TOKEN.search(haystack), (…)
```

and the fence itself asserts **non-vacuity of its own walk** before asserting the property:

```python
    files = _app_python_files()
    assert len(files) > 100, (
        f"the fence walked only {len(files)} python files under {_APP_ROOT} - the walk is "
        "broken and the fence proves nothing (measured at plan time: 160)"
    )
```

**The sentinel to re-scope, never delete** (`test_189_no_egress.py:84-145`) — keep
`_block_all_http` **byte-identical**; it is imported by the golden-run fence at
`test_harness_engine.py:1139`:

```python
    monkeypatch.setattr(httpx.Client, "send", _sync_send, raising=True)
    monkeypatch.setattr(httpx.AsyncClient, "send", _async_send, raising=True)
    monkeypatch.setattr(smtplib.SMTP, "__init__", _blocked("smtplib.SMTP.__init__"), raising=True)
    monkeypatch.setattr(urllib.request, "urlopen", _blocked("urllib.request.urlopen"), raising=True)
    monkeypatch.setattr(socket.socket, "connect", _blocked("socket.socket.connect"), raising=True)
```

with its own recorded ordering constraint (`:115-117`):

> `⚠ ORDER MATTERS: socket.socket.connect goes on LAST.`

**Re-scope Case B's DRIVE, not the sentinel:** the unbound-connection case keeps its meaning
(`recorded_not_sent` is a permanent shipping state, D-17); add a NEW positive case where a
`connection_id` IS bound and the executor **must** raise `_EgressAttempted` — proving the send
is live rather than accidentally still inert.

**Case A (`test_no_mcp_identifiers_in_backend_app`) stays untouched and green** — D-01 builds no
MCP client, so its passing becomes part of the amendment's evidence.

---

## 4 · Shared Patterns

### 4.1 One module owns one dangerous thing
**Source:** `backend/app/security/secret_cipher.py:1-6` · **Apply to:** `egress.py`, and
enforced over `backend/app/services/connectors/**`.
The contract is a sentence in the module header plus a **source fence** with a planted positive
control. Banned tokens for 190: `httpx.`, `requests.`, `smtplib.`, `urllib.request`, `socket.`,
and (from RESEARCH §R13) `.sendmail(`.

### 4.2 Closed sets with a derived static assert, never a parallel list
**Source:** `models/harness.py:229-235` + `phase_types.py:1867-1873` + `grounding.py:947-970`
· **Apply to:** the adapter registry, any client-side connector enum, any new count assertion.
*"Counts are DERIVED, never re-pinned"* — `db/workflows.py:1188-1196` is the shipped example of
an error message that derives its own count.

### 4.3 Allowlist-before-touch
**Source:** `api/admin.py:62-66, 93-97` — *"validated against these code constants BEFORE any
write — never free text (SQLi-safe)"* · **Apply to:** every connector endpoint, and the egress
guard itself (validate the destination **before** any DB or network operation — which is
literally D-06).

### 4.4 Fail-CLOSED at both ends of the cipher
**Source:** `sso_provider_service.py:82-92` (the read half, already correct) — inverted from
`secret_cipher.py:74-83`'s deliberate fail-OPEN (`get_cipher()` → `None`).
**Apply to:** the connector write path (refuse the STORE when `cipher is None`) AND the read
path (a stored non-`enc:v1:` value is a refusal, not a plaintext passthrough).

### 4.5 Log by NAME + count, never by value
**Source:** `secret_cipher.py:26-28` — *"every log line emits column NAMES + counts only —
NEVER a plaintext value or a ciphertext token"*; enacted at `:157-161` and `:216-225` ·
**Apply to:** every egress refusal (capability + host + reason), every adapter failure, every
resolver error. D-08.

### 4.6 No blocking I/O on the event loop
**Source:** `retrieval_service.py:65-74` (`run_in_threadpool`, with the measured SEED-065
incident inline) · **Apply to:** the SMTP adapter, unconditionally. `httpx.AsyncClient` is fine.

### 4.7 Non-throwing optional context accessors for leaves
**Source:** `BuilderStoreProvider.tsx:41-58` · **Apply to:** `SelectedPhaseSlugContext` and
`ConnectionPicker` — a leaf must still render in a provider-less unit test.

### 4.8 Refusal reasons are real DOM text, wired by `aria-describedby`
**Source:** `GovernanceSection.tsx:31-33` — *"with its reason as REAL DOM TEXT wired by
`aria-describedby` — never a `title` attribute (the 184-07 lesson)"* · **Apply to:** every
refusal in UI-SPEC §4b/§4c, the disabled Save, and the picker's failing-option line.
⚠ `ProviderPicker.tsx:211` uses `title=` — copy its layout, not that attribute.

### 4.9 Receipt, not toast
**Source:** `UsersAndAccess.tsx:395` (`runWrite(fn, "Disabled · recorded")`) · **Apply to:**
every write on the Connections surface (`✎ {verb} · recorded`), per UI-SPEC §2g. A persistent
state chip is the *consequence*; the receipt is separate.

### 4.10 RED first, in production source, restored md5-identical
**Source:** CONTEXT `<code_context>` → Established Patterns; enacted throughout 189 ·
**Apply to:** all three Wave-0 tests, all fourteen falsification rows (T1–T14), and each of the
four `_unwrap` clauses individually. `grep -c PLANT` → 0 after restore.

### 4.11 Migration apply discipline
**Source:** `114_harness_audit_action_risk_pending.sql:26-30` — the header states the discipline
in the file itself · **Apply to:** 116 and 117. Author → operator pastes into the Supabase SQL
editor → `bash scripts/regenerate-full-schema.sh` (no `--reset`) → commit both. Never
`db push` / `db reset`. Filenames `<digits>_name.sql` — `116b` is silently skipped by the CLI.

---

## 5 · No Analog Found

The planner should use RESEARCH.md's measured recipes, not a codebase pattern, for these:

| File / concern | Role | Data flow | Why no analog |
|---|---|---|---|
| The IP-property predicate (`_unwrap` / `refuse_reason`) inside `egress.py` | security | transform | **Nothing in this codebase validates a resolved IP.** RESEARCH §R14 supplies a driven 29-address corpus and the four measured holes in `not ip.is_global` (multicast, NAT64, IPv4-**translated** SIIT, IPv6 site-local). The defensible artefact is the **corpus**, not the predicate. |
| DNS-pin-to-validated-IP (httpx `extensions["sni_hostname"]`; smtplib `_host` + `connect(ip)`) | security | transform | No pinned-connection code exists anywhere in `backend/app`. RESEARCH §R10 verified both recipes in-venv; both depend on **non-public attributes** → RESIDUAL-190-01 with its own inspect-source fence. |
| Panel focus trap + focus restore (`ConnectionFormPanel`) | a11y | — | The shipped push/split panels (`PhaseFormPanel`, the 027-A document shell) provide **neither**; `Dialog` would have. Net-new work (UI-SPEC §3a, §12). |
| `Used by N steps` — the `connection_id` JSONB scan | data access | batch/read | **Net-new wire** (sketch 155's own flag). Measure once against the local corpus before committing to a live count; if slow it becomes an on-demand expand — a UI change, not a schema change (RESEARCH OQ#6). |
| Slack `ok:false` handling | adapter | request-response | Every HTTP caller in this tree treats a 2xx as success. T13 is a **new class of check** for this codebase and is the single most likely way 190 ships a lie. |

---

## 6 · Sequencing note for the planner (derived from the analogs, not decided here)

Three orderings are what the tests must assert, because no library quality makes an ordering
correct — and each has its RED-first analog above:

1. **The golden-run check before the send** (D-16) — `harness_engine.py:825-830`'s armed trigger.
2. **The guard before the credential** (D-06) — the n8n inversion; assert the *error identity*,
   not just the failure.
3. **The org before the id** (D-14) — `classification_rules.py:11-19`'s no-existence-leak rule
   plus `_call_as_user`'s fail-closed shape.

All three are latent defects **this phase's own commit creates**. Wave 0, RED, before any
adapter module exists.

---

## Metadata

**Analog search scope:** `backend/app/{security,services,api,models,db}/`,
`backend/tests/{unit,}/`, `supabase/migrations/`, `frontend/src/{components,pages,lib,hooks}/`,
`scripts/`
**Files read for excerpts:** 24 (each read once, non-overlapping ranges only)
**Commands run for measurement:** 22
**Pattern extraction date:** 2026-08-08
**Corrections carried forward from RESEARCH.md and independently re-confirmed here:** #1
(count-gate drift +13), #2 (`notConnectedOf` is `:810-813`, edit line **812**), #3 (three props,
six fences — hence `ConnectionPicker.tsx`), #4 (`_exec_external_action` is `:1810-1885`), #5
(`encrypt_secret`/`decrypt_secret`, not `_value`), #6 (`_VISIBILITY_FEATURES`, not
`_FLAG_HUMAN_NAMES`)
