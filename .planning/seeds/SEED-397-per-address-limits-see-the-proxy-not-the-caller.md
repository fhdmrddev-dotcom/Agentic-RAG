---
seed_id: SEED-397
title: Per-address rate limits see the proxy's address, so one keyless flood throttles the whole MCP and API-key door
created: 2026-10-31
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase that touches the uvicorn CMD in backend/Dockerfile, the per-address limiter in backend/app/services/rate_limit.py or backend/app/mcp/edge.py, or that opens the MCP door to a paying org"
trigger_paths: ["backend/Dockerfile", "backend/app/services/rate_limit.py", "backend/app/mcp/edge.py", "docker-compose.prod.yml", "deploy/onebox.env.example"]
trigger_surfaces: ["deployment"]
migration_note:
relates_to: ["305-REVIEW.md WR-02", "backend/app/services/rate_limit.py:84", "backend/app/api/inbound.py:265", "backend/app/api/setup.py:176", "SEED-079"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-397: Per-address rate limits see the proxy's address, not the caller's

## The finding

Phase 305's review (WR-02, 2026-10-31) traced `backend/app/mcp/edge.py:199-214`: the `mcp_ip`
bucket keys on `scope["client"]`. uvicorn runs without `--proxy-headers --forwarded-allow-ips`
(`backend/Dockerfile` CMD), so it trusts forwarded headers only from 127.0.0.1. Behind Coolify's
Traefik or the one-box nginx, **every caller shares the proxy's address**, and the per-address limit
is one counter for the whole door.

A keyless client at about 1,200 requests a minute fills that counter, and every member's MCP calls
are then refused. `initialize` and `tools/list` hit no per-key bucket at all.

**Not new in 305.** `rate_limit.py:84` documents the same property for the 293 API-key door
(`IP_CALLS_PER_MINUTE = 1_200`, "works as one door-wide ceiling"), and `api/setup.py` and
`api/inbound.py` share it.

## Why it matters

Today, nobody notices: the MCP door ships behind the org and deployment switches, and no paying
org uses it. Once a customer wires Claude Code or Cursor in, an unauthenticated flood is a
denial of service for every key at once.

## When to surface

Any phase touching the files in `trigger_paths`, or the first phase that turns MCP on for a paying
org. Accepted as a risk at 305 close (the orchestrator's recommendation; the operator may overrule).

## Scope estimate

Small in code, medium in deploy parity:
- `--proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS}` in the CMD.
- The var in `deploy/onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md` and
  `scripts/check-deploy-drift.sh`, all in one commit.
- The operator must read Traefik's network range in Coolify.
- A test proving a spoofed `X-Forwarded-For` from outside that range is ignored.
