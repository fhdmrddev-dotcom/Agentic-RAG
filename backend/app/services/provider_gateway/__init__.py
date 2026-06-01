"""Provider Gateway package (Phase 092.5, GATEWAY-01 / D-01).

ONE home for provider logic. The gateway constructs each provider's stream and
normalizes its chunks into ONE canonical event vocabulary (the D-02 seam
contract) — it does NOT own accumulation or SSE emit (those stay in the
consumer, ``agent_loop``).

SC#3 — NO IMPORT CYCLE: this package MAY import the raw-SDK service modules
(``anthropic_service`` / ``google_service`` / ``openai_service`` / ``tool_parser``)
— they are BELOW it in the dependency graph today. It MUST NEVER import
``agent_loop`` or ``threads.py`` (the callable-injection seam exists precisely
to avoid that cycle; ``_emit`` / ``spawn`` stay passed-in callables consumer-side).

Task 2 (this plan) fills the package exports (open_stream, GatewayRequest,
GatewayEvent + per-type TypedDicts, CallingMode re-export). Task 1 lands events.py.
"""
