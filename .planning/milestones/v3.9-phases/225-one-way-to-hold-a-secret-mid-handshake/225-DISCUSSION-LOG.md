# Phase 225: One Way to Hold a Secret Mid-Handshake - Discussion Log

**Date:** 2026-09-03  
**Participants:** Operator, Gemini (Builder)  

## Discussion Summary

### Area 1: Convergence Strategy for "ONE State Implementation" (SC#2)
- **Question:** How should the convergence between Google/BYO OAuth and MCP OAuth state be structured?
- **Decision:** Extract the state engine into a dedicated shared helper (`backend/app/services/oauth_state.py`) that both `oauth_service.py` and `mcp_oauth.py` use, achieving true single-implementation convergence across all OAuth handshake paths.

### Area 2: Transition Cutover & In-Flight Consents (SC#3)
- **Question:** How should the callback cutover handle in-flight OAuth consents started just before deployment?
- **Decision:** Dual-mode callback during the transition window. The callback will inspect `state`: if it is an opaque handle, it consumes it from Redis via `take_pending_state`; if it contains the legacy HMAC-signed format (`.`), it verifies via `verify_oauth_state` with a deprecation warning log. This guarantees that handshakes initiated before deploy are not broken.

## Outcome
All decisions locked as D-225-01 through D-225-04 in `225-CONTEXT.md`. Ready for `plan-phase`.
