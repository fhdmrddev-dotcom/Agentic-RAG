"""Phase 190 code-review fixes — **the data layer**: CR-01 (code half), WR-02, WR-05.

Its sibling ``test_190_review_fix_executor.py`` carries CR-02, CR-03, CR-04 and WR-03. The
cut is where the fixtures are: every case there drives ``_exec_external_action``; every case
here drives a Pydantic model or a supabase double. Two files let each commit land GREEN on
its own, which is why the split exists at all.

**Every case here was OBSERVED RED before its fix landed** — the verbatim transcripts are in
``190-REVIEW-FIXES.md``. WR-02 needed a PLANT, because its fix had already landed when the
drive was authored: the validator line was removed from production source, the six mismatched
pairs were observed failing, and the line was restored with ``grep -c PLANT`` -> 0.

⚠ **Each case was additionally checked for REACH, not merely for RED.** This phase measured
six separate fences that passed over a real defect. So every assertion below names the
*property*, and the ones that could be satisfied by an accident carry an explicit
non-vacuity partner.

── The three findings ────────────────────────────────────────────────────────────────────
CR-01  ``secret_ciphertext`` was readable over PostgREST by any authenticated org member.
       The DATABASE half is driven in ``tests/integration/test_190_secret_column_privilege.py``
       (it needs a live Postgres). What is driven HERE is the CODE half migration 118 forces:
       the explicit projection this app must send instead of ``select=*``.
WR-02  ``update_connection`` omitted the capability<->config validator ``create`` enforces.
WR-05  the create path accepted an entirely empty connection and encrypted the empty secret.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionUpdate,
    CreateTicketConfig,
    PostMessageConfig,
    SendEmailConfig,
)
from app.services import connector_service

ORG_A = "aaaaaaaa-0000-4000-8000-000000000001"
CONNECTION_ID = "dddddddd-0000-4000-8000-00000000000c"


# ══════════════════════════════════════════════════════════════════════════════════════════
# CR-01 · the PostgREST projection the column grant forces
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_CR01_the_projection_names_every_safe_column_and_never_the_secret():
    """`_SELECTABLE_COLUMNS` is the exact set migration 118 granted, and excludes the secret.

    Derived from `ConnectorConnectionResponse.model_fields` rather than retyped, so a column
    added to the table tomorrow cannot enter a projection without a model field appearing in
    a diff a reviewer reads.
    """
    columns = connector_service._SELECTABLE_COLUMNS.split(",")

    assert "secret_ciphertext" not in columns, (
        "CR-01: the projection this module sends to PostgREST names the secret column. "
        f"Migration 118 revoked SELECT on it, so this query now 42501s: {columns!r}"
    )
    assert "*" not in connector_service._SELECTABLE_COLUMNS, (
        "CR-01: `*` expands to every column and the grant refuses the whole statement"
    )
    assert set(columns) == set(connector_service._RESPONSE_KEYS), (
        f"CR-01: the projection drifted from the response model: {sorted(columns)!r} vs "
        f"{sorted(connector_service._RESPONSE_KEYS)!r}"
    )


def test_CR01_the_project_helper_actually_sets_the_param_on_a_REAL_builder():
    """REACH, not RED — driven against a genuine postgrest builder, not a double.

    Every other CR-01 case in this file runs against a test double that models
    `request.params`, so all of them would pass against a `_project` that had quietly stopped
    working after a postgrest-py upgrade. This one takes the real object.
    """
    from postgrest import SyncPostgrestClient

    client = SyncPostgrestClient("http://127.0.0.1:1/rest/v1")
    builder = client.from_("connector_connections").insert({"name": "x"})

    assert "select" not in dict(builder.request.params), (
        "the control: postgrest does NOT set `select` on an insert by itself, which is "
        "exactly why `_project` has to"
    )

    connector_service._project(builder)
    sent = dict(builder.request.params)

    assert sent.get("select") == connector_service._SELECTABLE_COLUMNS, (
        f"CR-01: `_project` did not reach the real builder — params are {sent!r}. Without "
        "this the write asks PostgREST for `RETURNING *`, which the 118 column grant refuses "
        "with 42501."
    )
    assert "secret_ciphertext" not in sent["select"]


# ══════════════════════════════════════════════════════════════════════════════════════════
# WR-02 · a PATCH may not swap a connection's config shape
# ══════════════════════════════════════════════════════════════════════════════════════════
_CONFIG_FOR = {
    "send_email": SendEmailConfig(host="smtp.example.com", port=587, from_address="a@b.co"),
    "create_ticket": CreateTicketConfig(
        base_url="https://acme.atlassian.net", project_key="OPS", account_email="a@b.co"
    ),
    "post_message": PostMessageConfig(default_channel="#ops"),
}


class _StoredRowClient:
    """A supabase double that hands back ONE stored row and records what was written."""

    def __init__(self, row: dict):
        self._row = row
        self.updates: list[dict] = []
        self.request = SimpleNamespace(params=_Params())

    def table(self, _name):
        return self

    def select(self, *_a, **_kw):
        return self

    def update(self, changes):
        self.updates.append(dict(changes))
        return self

    def eq(self, *_a, **_kw):
        return self

    def limit(self, *_a, **_kw):
        return self

    def execute(self):
        return SimpleNamespace(data=[dict(self._row)])


class _Params(dict):
    def set(self, key, value):  # noqa: A003 — mirrors httpx.QueryParams.set
        merged = _Params(self)
        merged[key] = value
        return merged


def _stored(capability: str) -> dict:
    return {
        "id": CONNECTION_ID,
        "org_id": ORG_A,
        "capability": capability,
        "name": "Ops",
        "config": _CONFIG_FOR[capability].model_dump(mode="json", exclude_none=True),
        "is_enabled": True,
        "last_checked_at": None,
        "last_check_verdict": "not_checked",
        "created_at": None,
        "updated_at": None,
    }


@pytest.mark.parametrize("stored_capability", ["send_email", "create_ticket", "post_message"])
@pytest.mark.parametrize("submitted_capability", ["send_email", "create_ticket", "post_message"])
async def test_WR02_a_patch_cannot_swap_the_config_shape(stored_capability, submitted_capability):
    """Nine pairs: the three matching ones must succeed, the six mismatched ones must refuse.

    `ConnectorConnectionCreate` runs `_reject_config_capability_mismatch` in a
    `@model_validator(mode="after")`. `ConnectorConnectionUpdate` cannot — it carries no
    `capability` field on purpose — so before this fix `update_connection` wrote
    `payload.config.model_dump(...)` **without ever comparing it against the stored row's
    capability, which it had in hand one block above**.

    **The failure, concretely:** `PATCH {"config": {"default_channel": "#ops"}}` on a
    `send_email` connection. Pydantic's SMART UNION resolves it to a `PostMessageConfig`, the
    service writes it, and the API answers **200 with the new row** — the response model has
    no cross-field check either, so it validates. The SMTP host, port and from-address are
    gone. Settings renders a blank *Sends to* cell, the picker's `destinationPartsOf` returns
    `[]`, and the next run of every workflow bound to it fails with `SmtpConfigInvalid`.
    Nothing anywhere reports that a valid PATCH destroyed the destination.

    ⚠ The matching diagonal is the non-vacuity half — a fix that simply refused every
    config PATCH would satisfy the six mismatched pairs and break the product.
    """
    client = _StoredRowClient(_stored(stored_capability))
    payload = ConnectorConnectionUpdate(config=_CONFIG_FOR[submitted_capability])

    if stored_capability == submitted_capability:
        await connector_service.update_connection(
            CONNECTION_ID, org_id=ORG_A, payload=payload, supabase=client
        )
        assert client.updates and "config" in client.updates[0], (
            "the matching pair must still write the config — otherwise the fix broke editing"
        )
        return

    with pytest.raises(ValueError) as excinfo:
        await connector_service.update_connection(
            CONNECTION_ID, org_id=ORG_A, payload=payload, supabase=client
        )

    assert stored_capability in str(excinfo.value), (
        f"WR-02: the refusal does not name the STORED capability, so an operator cannot tell "
        f"which end is wrong: {str(excinfo.value)!r}"
    )
    assert client.updates == [], (
        f"WR-02: the mismatched config was WRITTEN before the refusal — the row is already "
        f"destroyed and the exception is cosmetic: {client.updates!r}"
    )


# WR-05 · an entirely empty connection may not be created
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_WR05_an_empty_send_email_connection_is_REFUSED_at_the_model():
    """*Add a connection* → *Sends an email* → **Save**, with nothing typed.

    Before this fix: `configFromDraft` produced `{host: "", port: 0, from_address: "",
    tls: "starttls"}`, `secret` was `""`, the API returned **201**, and `encrypt_secret("")`
    stored a real `enc:v1:` envelope over an empty password. Settings then listed a connection
    named `""` with a blank *Sends to* column that a workflow author could bind — and the
    first time anyone found out was a **failed workflow run** (`host_not_allowed`, since
    `_host_is_allowed` fails closed on an empty `allowed_host`).

    Constrained at the MODEL, where the API and every future caller are covered at once,
    rather than in the panel, where a curl request walks around it.
    """
    # ⚠ `config` is passed as a RAW DICT rather than a constructed `SendEmailConfig`. Python
    # evaluates the inner call first, so a constructed config would raise on its own before
    # `name` and `secret` were ever validated — and the case would silently measure one third
    # of what it claims. This is exactly the reach problem this phase kept finding.
    with pytest.raises(ValidationError) as excinfo:
        ConnectorConnectionCreate(
            capability="send_email",
            name="",
            config={"host": "", "port": 0, "from_address": ""},
            secret="",
        )
    # The whole point is that MORE THAN ONE field is wrong; a fix that constrained only
    # `name` would satisfy a bare `pytest.raises`.
    offending = {err["loc"][-1] for err in excinfo.value.errors()}
    assert {"name", "secret", "host", "from_address", "port"} <= offending, (
        f"WR-05: only {sorted(offending)} were refused. Every one of name / secret / host / "
        "from_address / port must carry its own constraint, or an empty connection is still "
        "constructable one field at a time."
    )


@pytest.mark.parametrize(
    "kwargs",
    [
        {"host": "", "port": 587, "from_address": "a@b.co"},
        {"host": "smtp.example.com", "port": 0, "from_address": "a@b.co"},
        {"host": "smtp.example.com", "port": 70000, "from_address": "a@b.co"},
        {"host": "smtp.example.com", "port": 587, "from_address": ""},
    ],
)
def test_WR05_each_send_email_config_field_carries_its_own_constraint(kwargs):
    """One case per field, because a single "the whole thing is refused" case cannot tell
    which constraint is load-bearing — and IN-03 is folded in here.

    ⚠ **IN-03**: `configFromDraft` maps an unparseable port to `0`, and
    `validate_destination`'s `resolved_port = port or parsed.port or _DEFAULT_PORTS[scheme]`
    treats `0` as FALSY and substitutes 465/587. Someone who typed `four sixty five` got a
    working connection on 587 and no indication their input was discarded. `Field(ge=1,
    le=65535)` is what makes that a refusal instead of a silent substitution.
    """
    with pytest.raises(ValidationError):
        SendEmailConfig(**kwargs)


@pytest.mark.parametrize(
    "config_cls,kwargs",
    [
        (CreateTicketConfig, {"base_url": "", "project_key": "OPS", "account_email": "a@b.co"}),
        (CreateTicketConfig, {"base_url": "https://x.atlassian.net", "project_key": "",
                              "account_email": "a@b.co"}),
        (CreateTicketConfig, {"base_url": "https://x.atlassian.net", "project_key": "OPS",
                              "account_email": ""}),
        (PostMessageConfig, {"default_channel": ""}),
    ],
)
def test_WR05_the_other_two_capabilities_constrain_their_fields_too(config_cls, kwargs):
    """The other six destination fields. An empty Jira `base_url` or Slack channel is the
    same defect wearing a different vendor's name."""
    with pytest.raises(ValidationError):
        config_cls(**kwargs)


def test_WR05_a_COMPLETE_connection_is_still_accepted():
    """Non-vacuity, and it is load-bearing: `min_length=1` on the wrong field, or on all of
    them plus one that is legitimately optional, breaks every real create."""
    payload = ConnectorConnectionCreate(
        capability="send_email",
        name="Billing mailer",
        config=SendEmailConfig(
            host="smtp.example.com", port=587, from_address="billing@example.com"
        ),
        secret="a-real-password",
    )
    assert payload.name == "Billing mailer"
    assert payload.config.username is None, (
        "`username` is legitimately optional (D-03: the non-secret half of the SMTP pair) and "
        "must NOT have acquired a non-empty constraint"
    )


def test_WR05_an_empty_name_or_secret_is_also_refused_on_UPDATE():
    """The same constraint on the PATCH path — an empty REPLACE is not a replace.

    `ConnectorConnectionUpdate` is all-optional, so ABSENT must stay legal while PRESENT-BUT-
    EMPTY must not: `secret=""` would otherwise encrypt an empty password over a working one.
    """
    ConnectorConnectionUpdate()  # absent is fine — the control
    ConnectorConnectionUpdate(is_enabled=False)

    with pytest.raises(ValidationError):
        ConnectorConnectionUpdate(name="")
    with pytest.raises(ValidationError):
        ConnectorConnectionUpdate(secret="")

