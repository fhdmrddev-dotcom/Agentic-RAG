"""Phase 211 (CONN-04 / D-211-05 / D-211-06) — what a first-party capability connection
ADVERTISES.

A connection to a Model-Context-Protocol server arrives carrying a list of named,
described, schema-carrying tools. A first-party capability connection has always been able
to DO exactly one such thing and has never been able to SAY so, which is why SC#1 ("the
actions offered are the tools that service advertises") and SC#2 ("presents as a service
with named actions") were unreachable: there was nothing to offer. This module produces
that list, in the byte-shape the tool sanitizer already emits, so the two kinds of
connection are indistinguishable to every downstream reader.

── WHAT IS AND IS NOT DECLARED HERE ──────────────────────────────────────────────────────
Only ``title`` and ``description`` are authored in this file. They are prose, and prose has
no other home. Everything else is DERIVED:

  * ``name``        — the capability id itself. It is the grant key the executor reads and
                      the value a picker puts on an ``<option>``; a descriptor whose name is
                      not the capability advertises an action nobody can ever grant.
  * ``inputSchema`` — the adapter's own ``INPUT_SCHEMA``, converted to plain JSON types.

⭐ **THERE IS NO PARALLEL REQUIRED-ARGUMENTS CONSTANT, AND THERE MUST NEVER BE ONE.**
D-211-06 asks that each adapter's required arguments be declared as data. They already are:
``INPUT_SCHEMA["required"]`` is exactly that array, frozen on the adapter class. Copying it
into this module would create an eighth spelling of the same fact with nothing holding it in
agreement — and a descriptor that advertised an argument the adapter refuses, or hid one it
requires, would be a lie told at the exact moment an author is deciding whether to grant an
outbound action. Derivation removes the possibility rather than guarding against it.

── THE TWO AUTHORED MAPS ARE HELD BY A DERIVED MODULE-SCOPE ASSERT ───────────────────────
In the shape of the sibling registry's D-04 assert (and ``models/harness.py``'s): both
operands are literals declared in the tree, so the check is static and data-independent and
can only fire when someone edits one of them — which is precisely when it should. A fourth
title, or a capability with no description, is an ``AssertionError`` **at import**: loud,
never latent.

── WHY LAZY IMPORT ───────────────────────────────────────────────────────────────────────
The adapter registry is imported INSIDE the function body, never at module scope, and the
reasoning is copied here verbatim from the registry's own docstring so the next reader does
not undo it:

  1. importing this module must not drag every vendor module into the import graph. Anything
     that merely asks WHICH capabilities exist would otherwise pay for every adapter;
  2. the standing fence
     ``test_190_connector_source_fence.py::test_no_vendor_module_enters_the_import_graph_until_a_send_happens``
     asserts that a cold ``import app.services.harness.phase_types`` loads NO ``*_adapter``
     module, and it is asserted rather than assumed for exactly that reason;
  3. that same fence pins the FILES holding a function-local registry import, so this
     module's deferred import is a deliberate, reviewed line rather than a silent addition.

  A module-scope form of the line below — written out as
  ``from app.services.connectors.registry import get_adapter`` at column zero — would also
  join the latent import cycle that fence documents. Keep it indented.

── WHAT THIS MODULE DOES NOT DO ──────────────────────────────────────────────────────────
It opens nothing, imports no transport, and GRANTS nothing. ⚠ A descriptor is an
advertisement, not a permission: the executor's gate reads ``tool_grants`` only, and a
missing key DENIES. That asymmetry is the desirable direction (T-211-05) — it is what makes
a legacy connection presentable as a service without silently arming it — and it must not
be "wired up".

(The three-letter acronym for the protocol named above is spelled out rather than
abbreviated, to match this package's five neighbours. The fence that once required that has
since become a documented milestone record, so the expansion is a house style here rather
than an obligation.)
"""

from __future__ import annotations

from types import MappingProxyType
from typing import Any

from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

__all__ = ["descriptor_for", "static_descriptors_for_capability"]


#: capability -> the human-readable action name. The Model-Context-Protocol tool ``title``
#: field, and Phase 212's catalog label. Authored, because prose cannot be derived.
_TITLE_FOR_CAPABILITY: dict[str, str] = {
    "send_email": "Send email",
    "create_ticket": "Create issue",
    "post_message": "Post message",
}

#: capability -> one sentence describing what the action does, for an author deciding
#: whether to grant it. Never empty: a blank description renders as a blank row.
_DESCRIPTION_FOR_CAPABILITY: dict[str, str] = {
    "send_email": (
        "Send one plain-text email to exactly one recipient through this connection's "
        "configured mail server."
    ),
    "create_ticket": (
        "Create one issue in this connection's configured Jira project, with a summary and "
        "a plain-text description."
    ),
    "post_message": (
        "Post one plain-text message to the channel configured on this connection."
    ),
}

# DERIVED, never retyped — the shape of the sibling registry's D-04 assert. Static and
# data-independent: both operands are literals declared in the tree, so this can only fire
# when someone edits one of them. A capability with no title (or a title for a capability
# that does not exist) is an ImportError for the whole app, not a latent blank row.
assert set(_TITLE_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
    "D-211-06: the descriptor title map disagrees with EXTERNAL_ACTION_CAPABILITIES "
    f"({sorted(set(_TITLE_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))}). The "
    "capability set is CLOSED and has one runtime home; a title with no capability names an "
    "action nothing can perform, and a capability with no title advertises a blank row"
)
assert set(_DESCRIPTION_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
    "D-211-06: the descriptor description map disagrees with EXTERNAL_ACTION_CAPABILITIES "
    f"({sorted(set(_DESCRIPTION_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))}). "
    "An author reads this sentence before granting an outbound action; there is no "
    "admissible default for it"
)


def _plain_json(value: Any) -> Any:
    """Deep-convert a frozen schema into plain, JSON-serialisable Python types.

    ⚠ **LOAD-BEARING, NOT COSMETIC.** Every adapter's ``INPUT_SCHEMA`` is a
    ``MappingProxyType`` whose nested property objects are ``MappingProxyType`` too, and a
    read-only proxy is NOT JSON-serialisable. The descriptor this module returns is written
    into a ``jsonb`` column, so a proxy that leaked through would raise at the database
    write — far from the code that produced it. It is converted here, at the point of
    production, and the round trip is asserted in this module's test.

    Also a deep COPY: the adapter's declaration is frozen precisely so nothing can edit it,
    and handing a caller a live view of it would give away that guarantee.
    """
    if isinstance(value, (MappingProxyType, dict)):
        return {str(key): _plain_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_json(item) for item in value]
    return value


def descriptor_for(capability: str) -> dict[str, Any]:
    """Return the advertised action for ``capability``, or raise on anything outside the
    closed set.

    The returned object carries exactly the four keys a sanitized discovered tool carries,
    in the sanitizer's own order and casing::

        {"name": ..., "title": ..., "description": ..., "inputSchema": {...}}

    Raises ``KeyError`` — the same shaped raise the adapter registry uses, with the noun
    swapped. One vocabulary for one closed set. There is no ``.get()`` with a default in
    this function: an unknown capability fails CLOSED, at a named site, rather than
    resolving to a stub that would put an unimplemented action into a picker.
    """
    if capability not in EXTERNAL_ACTION_CAPABILITIES:
        raise KeyError(
            f"connector descriptor lookup: capability {capability!r} is not registered "
            "in EXTERNAL_ACTION_CAPABILITIES (closed set — register it explicitly)"
        )

    # ⚠ DEFERRED IMPORT — see this module's "WHY LAZY IMPORT" block. Keep it indented.
    from app.services.connectors.registry import get_adapter

    adapter = get_adapter(capability)

    return {
        "name": capability,
        "title": _TITLE_FOR_CAPABILITY[capability],
        "description": _DESCRIPTION_FOR_CAPABILITY[capability],
        # DERIVED from the adapter's own declaration — never retyped. See the docstring.
        "inputSchema": _plain_json(adapter.INPUT_SCHEMA),
    }


def static_descriptors_for_capability(
    capability: str, service_id: str | None = None
) -> list[dict[str, Any]]:
    """Everything this connection advertises, in the shape ``discovered_tools`` holds.

    The capability descriptor is ALWAYS first and always present. It is the row's
    identity: the grant key every bound workflow step already carries, the value stored
    on `ExternalActionPhaseConfig.capability`, and the one action whose adapter the
    executor reaches through `get_adapter`. Nothing about it changes here.

    ⚠ **IT IS NO LONGER THE ONLY ONE, AND THE ONE-ELEMENT WORDING ABOVE IT WAS A
    MEASUREMENT OF THE PROBLEM RATHER THAN A REQUIREMENT.** SEED-207 asked for *"present
    a native connection as a connection with exactly ONE available tool"*, and that was
    the right first step — a service that could not SAY what it did was the defect Phase
    211 closed. But the operator, driving chat after Phase 216, met the next one: a Jira
    connection that worked, was credentialled and was enabled still answered *"there is no
    Jira integration"*, because create_ticket was not the action that moment needed and
    there was no second one to reach for. GitHub advertised 44 tools beside it; Slack,
    Jira and SMTP advertised one each.

    So when the caller knows the SERVICE, the service's own action list follows the
    capability descriptor — `service_tools.SERVICE_TOOL_SPECS`, which adds no verb to the
    closed capability set and no host to the egress allow-list.

    ⚠ `service_id` DEFAULTS TO None AND THAT ARM IS PRESERVED DELIBERATELY. A caller who
    genuinely holds only a capability — and there are such callers — gets exactly the
    one-element list it got before, byte for byte. Adding an argument must not change the
    answer to the question that was already being asked.

    ⚠ ADVERTISING IS NOT GRANTING. Every extra action arrives with no `tool_grants` key,
    and the executor DENIES on a missing key (T-211-05). A connection that gains nine
    actions here has gained nine rows on a grant list and zero new powers.
    """
    descriptors = [descriptor_for(capability)]
    if service_id:
        # Function-local for the reason this module's header states about the registry:
        # nothing that merely asks WHAT a connection advertises should drag a vendor
        # module into the import graph. `service_tools` imports its transport lazily too.
        from app.services.connectors.service_tools import extra_descriptors_for_service

        advertised = {d["name"] for d in descriptors}
        descriptors.extend(
            extra for extra in extra_descriptors_for_service(service_id)
            # The capability descriptor wins any name collision: its `inputSchema` is
            # DERIVED from the adapter that will actually run it, so a same-named spec
            # here could only ever disagree with the code.
            if extra["name"] not in advertised
        )
    return descriptors
