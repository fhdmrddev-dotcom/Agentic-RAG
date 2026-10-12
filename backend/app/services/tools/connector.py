"""Phase 216 namespaced connector chat tools (``<service>__<action>``) and the single authority
for the connector approval timeout (``_APPROVAL_TIMEOUT_SECONDS``, Phase 224).

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

⚠ PATCH-WHERE-USED: the bodies in this module resolve these names from THIS module's globals —
``write_audit_entry``. Patch ``app.services.tools.connector.<name>``; a patch of the same name on
``tool_dispatcher`` no longer reaches the code that calls it (and, because the registry module no
longer imports them, raises ``AttributeError`` instead of silently patching nothing).

``dispatch_tool`` reaches ``_handle_connector_chat_tool`` as a ``tool_dispatcher`` global
(imported there by name), so ``tests/unit/security/conftest.py`` keeps patching it there.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta

from app.services.audit_service import write_audit_entry
from app.services.tools.base import ToolContext, ToolResult

logger = logging.getLogger(__name__)


# Phase 224 Plan 02 (BUG-260902-04 / D-224-01):
# Single authority for the connector tool approval timeout.
# Consumed by both the asyncio.wait_for pause and the wire deadline/duration emit.
_APPROVAL_TIMEOUT_SECONDS: float = 120.0


async def _handle_connector_chat_tool(
    service_id: str,
    action_tool_name: str,
    args: dict,
    ctx: ToolContext,
) -> ToolResult:
    """Phase 216 (CHAT-05 / CHAT-07 / GRANT-03 / D-216-04): Dispatches namespaced connector tool."""
    from uuid import UUID
    from app.services.connector_service import list_connections
    from app.services.connectors.grants import resolve_effective_posture
    from app.services.connectors.chat_tools import wrap_untrusted_tool_result
    from app.services.connectors.org_scope import resolve_connector_org

    user_id = (ctx.current_user or {}).get("id")
    if not user_id:
        logger.warning(
            "connector chat tool %s: no authenticated user in context (audit_log.user_id is NOT NULL)",
            action_tool_name,
        )
        return ToolResult(result=f"Cannot execute {action_tool_name}: no authenticated user in context.")

    # ── ⚠ THREE DIFFERENT FAULTS USED TO ARRIVE AS ONE INNOCENT SENTENCE ──────────────
    # This function resolved the org with a swallowed `except: pass` followed by
    # `org_id = str(user_id)`, and then listed connections under `except: conns = []`.
    # A user id matches no `connector_connections.org_id`, so an RLS denial, a dropped
    # connection, an org-less account and a genuinely absent connection ALL ended at
    # `"Connector service 'x' is not connected or not found."` — a refusal that names
    # the wrong cause is worse than one that says it does not know, because the model
    # then relays the wrong remedy to the person. (Measured 2026-08-31 one level up:
    # given only `HTTP 403`, the model told the operator to re-consent scopes that were
    # already granted.) Each arm below now says which one it was.
    scope = await resolve_connector_org(ctx.current_user, getattr(ctx, "supabase", None))
    if not scope.ok:
        return ToolResult(result=json.dumps({
            "error": "connector_scope_unresolved",
            "tool": action_tool_name,
            "message": (
                f"{action_tool_name} was NOT performed: {scope.problem}. This is not the "
                f"same as {service_id!r} being disconnected — the connection was never "
                "looked up."
            ),
        }))
    org_id = scope.org_id

    # Look up connection matching service_id
    try:
        conns = await list_connections(org_id=str(org_id), supabase=ctx.supabase)
    except Exception as exc:  # noqa: BLE001 — a DB/RLS boundary
        # ⚠ NOT `conns = []`. An unreadable list is not an empty one, and only this arm
        # can tell them apart.
        logger.warning(
            "connector chat tool %s: listing connections for org %s failed",
            action_tool_name, org_id, exc_info=True,
        )
        return ToolResult(result=json.dumps({
            "error": "connector_lookup_failed",
            "tool": action_tool_name,
            "message": (
                f"{action_tool_name} was NOT performed: your connected services could "
                f"not be read ({exc.__class__.__name__}). {service_id!r} may well be "
                "connected — this is a lookup failure, not a missing connection."
            ),
        }))
    matched_conn = next(
        (c for c in conns if (c.service_id == service_id or (c.name and c.name.lower().replace(" ", "_") == service_id.lower()))),
        None,
    )
    if not matched_conn:
        # Reached ONLY after a successful read of a resolved org — so this sentence is
        # now true when it is said, which it was not before.
        return ToolResult(result=f"Connector service '{service_id}' is not connected or not found.")

    # Phase 223 (GRANT-05 / SC#1 / D-223-01..04): Audit all outbound connector tool execution attempts & outcomes.
    def _record_connector_audit(outcome: str, failure_reason: str | None = None) -> None:
        arg_keys = list(args.keys()) if isinstance(args, dict) else []
        audit_meta = {
            "connection_id": str(matched_conn.id),
            "service_id": service_id,
            "service_name": matched_conn.name,
            "tool_name": action_tool_name,
            "outcome": outcome,
            "arg_keys": arg_keys,
            "failure_reason": failure_reason,
        }
        actor_user_id = (ctx.current_user or {}).get("id")
        if not actor_user_id:
            logger.warning("Cannot audit connector call: user_id is missing (audit_log.user_id is NOT NULL)")
            return
        entry_coro = write_audit_entry(
            user_id=actor_user_id,
            action_type="connector.call",
            metadata=audit_meta,
            supabase=ctx.supabase,
            org_id=str(org_id) if org_id else None,
        )
        if getattr(ctx, "spawn", None) is not None:
            ctx.spawn(entry_coro)
        else:
            asyncio.create_task(entry_coro)

    # Phase 221 (D-221-05 / D-221-06) — the APPLICATION rung, resolved from the spec table.
    # ⚠ Without these two keywords the middle rung is a no-op and the write cap CANNOT FIRE:
    # `application` defaults to None, so `app:drive` is never consulted and an application
    # `allow` would arm a write. The cap shipped tested-and-unreachable; this is the wire.
    from app.services.connectors.service_tools import tool_facet

    _application, _is_write = tool_facet(getattr(matched_conn, "service_id", None), action_tool_name)
    posture = resolve_effective_posture(
        matched_conn, action_tool_name, application=_application, is_write=_is_write
    )

    # ── TRUST-03: Trifecta Anti-Injection Fence ───────────────────────────────
    # If this is a mutating / write tool and connection-sourced knowledge was retrieved
    # into prompt context, disarm automated execution and force human approval ('ask').
    # Prevents untrusted external content (e.g. prompt injection in a watched document)
    # from triggering unauthorized outbound write actions without explicit operator consent.
    has_conn_in_context = getattr(ctx, "has_connection_retrieval", False)
    if not has_conn_in_context:
        for cit in getattr(ctx, "citations", []) or []:
            if isinstance(cit, dict) and (cit.get("source_connection_id") or cit.get("source_state")):
                has_conn_in_context = True
                break

    if _is_write and has_conn_in_context and posture != "deny":
        posture = "ask"

    if posture == "deny":
        _record_connector_audit("policy_denial", "Denied by tool posture policy")
        return ToolResult(
            result=json.dumps({
                "error": "tool_refused",
                "message": f"Action '{action_tool_name}' on {matched_conn.name} was denied by policy.",
            })
        )

    if posture == "ask" and getattr(ctx, "redis", None) is not None:
        call_id = getattr(ctx, "tool_call_id", None) or f"call_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        now_utc = datetime.now(timezone.utc)
        deadline_utc = now_utc + timedelta(seconds=_APPROVAL_TIMEOUT_SECONDS)
        expires_at_iso = deadline_utc.isoformat()
        if getattr(ctx, "emit", None) is not None:
            await ctx.emit(
                ctx.redis,
                getattr(ctx, "run_id", None),
                "tool_approval_required",
                # ⚠ THE CONNECTION ID, NOT ONLY THE SERVICE ID. Two rows can share a
                # service — this install has two `slack` connections in different orgs —
                # so a client that resolved "which connection is this" from `service_id`
                # would sometimes write a grant onto the wrong one. It is also the only
                # way the card's "Always allow" can name what it is changing: without it,
                # that button could not exist, which is a reachability defect of exactly
                # the shape this repo keeps finding.
                connection_id=str(matched_conn.id),
                service_id=service_id,
                service_name=matched_conn.name,
                tool_name=action_tool_name,
                args=args,
                expires_at=expires_at_iso,
                timeout_seconds=_APPROVAL_TIMEOUT_SECONDS,
            )

        approval_channel = f"tool_approval:{ctx.thread_id}:{call_id}"
        pubsub = ctx.redis.pubsub()
        await pubsub.subscribe(approval_channel)
        try:
            async def _wait_for_decision():
                while True:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if msg is not None and msg.get("type") == "message":
                        try:
                            return json.loads(msg["data"])
                        except Exception:
                            return None

            decision_payload = await asyncio.wait_for(_wait_for_decision(), timeout=_APPROVAL_TIMEOUT_SECONDS)
            if not decision_payload or decision_payload.get("decision") != "allow":
                _record_connector_audit("user_rejected", "User rejected execution")
                return ToolResult(
                    result=json.dumps({
                        "status": "rejected",
                        "message": f"User rejected execution of tool '{action_tool_name}' on {matched_conn.name}. Do not retry this action unless explicitly requested by the user.",
                    })
                )
        except asyncio.TimeoutError:
            _record_connector_audit("timeout", f"Approval request timed out after {int(_APPROVAL_TIMEOUT_SECONDS)}s")
            return ToolResult(
                result=json.dumps({
                    "status": "timeout",
                    "message": f"Tool execution '{action_tool_name}' on {matched_conn.name} timed out waiting for human approval in the chat. Nobody answered in time. Do not advise the user to check a workspace panel or re-authenticate; if the user still wants this action, ask them in this chat if they would like to try again.",
                })
            )
        finally:
            try:
                await pubsub.unsubscribe(approval_channel)
                await pubsub.aclose()
            except Exception:
                pass

    # ══════════════════════════════════════════════════════════════════════════════════
    # Execute the action — THREE SHAPES, ONE HONEST FAILURE
    # ══════════════════════════════════════════════════════════════════════════════════
    #
    # ⚠ THE VERSION THIS REPLACES TOLD THE MODEL EVERY FAILURE HAD SUCCEEDED. It caught
    # `Exception` and answered `f"Executed {tool} on {name} with result/note: {exc}"`, so an
    # expired token, a 404 and a timeout all reached the model as a COMPLETED ACTION with a
    # note attached — and the model then reported to the person that the message was posted.
    # Its `if not raw_output` fallback said "successfully." for the same reason. A refusal
    # must READ as a refusal: the phase executor's own contract (`phase_types.py:2865`) is
    # that only the adapter's verdict produces `completed`, and this path now matches it.
    #
    # ⚠ AND THE NATIVE BRANCH COULD NEVER HAVE RUN. It called
    # `adapter.send(matched_conn, args, user_id=...)` against a protocol whose `send` is
    # KEYWORD-ONLY (`args`, `credential`, `config`, `capability`) — an immediate `TypeError`,
    # swallowed by the same handler into an "Executed …" sentence. Slack, Jira and SMTP have
    # never once been callable from chat, and nothing failed, because the lie caught the
    # evidence.
    raw_output = ""
    failure: str | None = None

    try:
        from app.services.connector_service import resolve_connection

        # ONE resolve for all three shapes. It is also the org-scoping gate and the D-11
        # credential read, so no branch below can reach a wire without passing it.
        resolved_conn = await resolve_connection(matched_conn.id, matched_conn.org_id)

        if getattr(matched_conn, "mcp_server_url", None):
            from app.services import mcp_client

            tool_res = await mcp_client.call_tool(
                resolved_conn.mcp_server_url,
                tool_name=action_tool_name,
                arguments=args,
                secret=resolved_conn.secret,
                # Resolved, not guessed — see ResolvedConnection.auth_scheme.
                auth_scheme=resolved_conn.auth_scheme,
            )
            # ⚠ `isError` IS THE SERVER SAYING NO, and reading only `text` treats its refusal
            # as its answer — the same shape as the "Executed …" lie one level up.
            if isinstance(tool_res, dict) and tool_res.get("isError"):
                failure = str(tool_res.get("text") or "the server refused the call")
            else:
                raw_output = tool_res.get("text") or json.dumps(
                    tool_res.get("content") or tool_res
                )
        else:
            from app.services.connectors.service_tools import (
                ServiceToolError,
                execute_service_tool,
                spec_for,
            )

            spec = spec_for(getattr(matched_conn, "service_id", "") or "", action_tool_name)
            if spec is not None:
                # One of the SERVICE's advertised actions (Phase 216 follow-up). Same host and
                # same egress key as the capability it hangs off; no allow-list is widened.
                try:
                    result = await execute_service_tool(
                        matched_conn.service_id,
                        action_tool_name,
                        args,
                        secret=resolved_conn.secret,
                        config=resolved_conn.config,
                        # The OAuth arm mints its own access token from the row; it cannot
                        # use `secret`, which for an oauth_byo connection is None.
                        connection_id=str(matched_conn.id),
                    )
                    raw_output = json.dumps(result)
                except ServiceToolError as exc:
                    failure = str(exc)
            elif getattr(matched_conn, "capability", None) == action_tool_name:
                # The row's own capability verb — the ONE action with a first-party adapter.
                from app.services.connectors.registry import get_adapter

                adapter = get_adapter(action_tool_name)
                send_args = {
                    key: value
                    for key, value in args.items()
                    if key in adapter.INPUT_SCHEMA.get("properties", {})
                }
                result = await adapter.send(
                    args=send_args,
                    credential=resolved_conn,
                    config=resolved_conn.config,
                    capability=action_tool_name,
                )
                # ⚠ ONLY THE ADAPTER'S OWN VERDICT MEANS DONE. Slack answers HTTP 200 with
                # `{"ok": false}` for a message nobody received; `phase_types.py` states this
                # at length and chat must not disagree with the canvas about the same send.
                if not getattr(result, "ok", False):
                    failure = (
                        getattr(result, "provider_message", "")
                        or getattr(result, "detail", "")
                        or "the destination refused it"
                    )
                else:
                    raw_output = json.dumps(
                        {
                            "performed": action_tool_name,
                            "detail": getattr(result, "detail", "") or "",
                            "provider_message": getattr(result, "provider_message", "") or "",
                        }
                    )
            else:
                failure = (
                    f"{matched_conn.name} does not advertise an action called "
                    f"{action_tool_name!r}"
                )
    except Exception as exc:  # noqa: BLE001 — a transport/credential boundary
        logger.warning(
            "connector chat tool %s on %s failed", action_tool_name, matched_conn.name,
            exc_info=True,
        )
        failure = str(exc) or exc.__class__.__name__

    if failure is not None:
        _record_connector_audit("execution_failure", failure)
        # Not wrapped: this sentence is OURS, not third-party text, and putting our own words
        # inside the untrusted-content envelope would teach the model to distrust them.
        return ToolResult(
            result=json.dumps(
                {
                    "error": "tool_failed",
                    "service": matched_conn.name,
                    "tool": action_tool_name,
                    "message": (
                        f"{action_tool_name} on {matched_conn.name} was NOT performed: "
                        f"{failure}"
                    ),
                }
            )
        )

    if not raw_output:
        # A success with no body is still a success, and saying so is not the old lie: this
        # line is now reachable ONLY when no failure was recorded.
        raw_output = json.dumps({"performed": action_tool_name, "detail": ""})

    _record_connector_audit("success", None)
    wrapped = wrap_untrusted_tool_result(matched_conn.name, action_tool_name, raw_output)
    return ToolResult(result=wrapped)
