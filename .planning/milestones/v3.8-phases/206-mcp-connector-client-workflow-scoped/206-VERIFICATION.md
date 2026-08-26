---
phase: 206-mcp-connector-client-workflow-scoped
verified: 2026-08-26
status: passed_retroactively
retroactive: true
retroactive_reason: "No VERIFICATION.md existed. Written at milestone close from evidence RE-DERIVED at HEAD, never transcribed."
requirements: "CONN-02, CONN-03"
gaps_count: 5
---

# Phase 206 - Verification Report (RETROACTIVE)

> ## THIS REPORT IS RETROACTIVE, AND SAYS SO IN ITS OWN FRONTMATTER
>
> It was written on **2026-08-26**, at milestone close, because `/gsd:audit-milestone` found that
> **seven of v3.8's twelve phases had no `VERIFICATION.md` at all** - 201, 202, 203, 204, 205,
> 206 and 209. The phases shipped; the verification ARTEFACT was never written. This file closes
> the artefact gap and **must not be read as a contemporaneous verification**.
>
> **What that costs, stated plainly:** a verification written at execution time can catch a phase
> before anything is built on top of it. This one cannot - five later phases already stand on this
> work. What it can still do honestly is **re-derive the evidence at today's HEAD** rather than
> transcribe the phase's own SUMMARY, and that is what the scorecard below does. Every number in
> it was MEASURED on 2026-08-26, not copied.
>
> **`status: passed_retroactively` is deliberately NOT `passed`.** It records that the code
> satisfies its requirement on evidence re-derived today - never that the phase was verified when
> it shipped, which it was not.


**Phase Goal:** Reach external systems through their official MCP servers, with no per-vendor adapter code.

**Requirements:** CONN-02, CONN-03  
**Verified:** 2026-08-26 - **Status:** `passed_retroactively`

## Measured at HEAD on 2026-08-26

`pytest tests/unit/test_mcp_connector_client.py tests/unit/test_190_connectors_api.py tests/unit/test_189_no_egress.py` -> **56 passed**

## Evidence

- **THE FULL ROUND TRIP IS DRIVEN LIVE**, 2026-08-25 against `https://mcp.deepwiki.com/mcp`: create connection (Settings) -> bind to an `external_action` step -> discover tools -> grant one -> run. **Grant OFF => `tool_refused` / `permission_denied`; grant ON => `external_action_sent`, `raw_status 200`, DeepWiki's real page list returned.** Then published (206.3): `status='published'`, v1.
- Migration 126 (provider-shaped MCP schema); SSRF egress defence `validate_mcp_destination` blocking loopback, RFC1918, `169.254.169.254` and IPv6 site-local.
- **Zero per-vendor adapter code** - the requirement's whole point, and structurally true rather than asserted.

## Gaps and honest limits

- **`REQUIREMENTS.md` still recorded CONN-02 and CONN-03 as `Planned`** - stale paperwork, corrected at this audit.
- **THIS PHASE SHIPPED THREE GAPS THAT ITS THREE INSERTS EXISTED TO REPAIR** - 206.1 (an MCP connection could not be CREATED in the UI), 206.2 (`SEED-200`: it could not be BOUND to any step), 206.3 (`SEED-201`: a workflow reaching outside could not PUBLISH). A verification written at the time would very likely have caught at least the binding gap; **it was never written.** That is the concrete cost of this artefact gap and the clearest argument for why this backfill exists.
- **CONN-03's OAuth half is explicitly deferred** to the Connections milestone (`SEED-204`).
- **Connections are not callable from CHAT** - `tool_dispatcher._TOOL_REGISTRY` holds 20 tools and ZERO connector tools (`SEED-146` / `SEED-205`). *'Workflow-scoped' was recorded as SEQUENCING, not an architectural boundary*, so this is deferral, not completion.
- **`annotations` and `outputSchema` were both discarded** by the sanitizer (`mcp_client.py:279-296`). `annotations` was repaired in Phase 209; **`outputSchema` is still dropped** - the competitor study's *'single cheapest actionable finding'*.

## Verdict

Requirement(s) **CONN-02, CONN-03** are satisfied by code whose evidence was re-derived on 2026-08-26.
The gaps above are recorded as **carried debt**, not blockers - none of them claims the shipped
behaviour is absent. **This is not a claim that the phase was verified when it shipped.**
