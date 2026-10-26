---
seed_id: SEED-376
title: Decide sandbox network egress for a workflow run's execute_code before anyone but the author can start it
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Before any non-author or API caller can reach a workflow with execute_code — i.e. the first phase that lets a colleague, a key (inbound API) or a schedule owned by someone else start a workflow whose steps carry execute_code; also any phase touching the sandbox network_mode. A security capability decision, routed via /gsd:discuss-phase.
trigger_paths: ["backend/app/services/sandbox_service.py", "backend/app/services/tools/sandbox.py", "backend/Dockerfile.sandbox", "backend/app/api/inbound.py", "backend/app/services/unattended_launch.py"]
trigger_surfaces: ["sandbox", "workflow", "harness"]
migration_note:
relates_to: ["296-CONTEXT D-11", "296-INVENTORY 291-network_mode", "291-REVIEW-R1 WR-01 (residual)", "Phase 293 (inbound API keys)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-376: Sandbox egress for a workflow run's `execute_code`

## The finding

A workflow step's `execute_code` runs in the same sandbox as chat, with network egress open.
291-REVIEW-R1 WR-01 found that once a description asks for running code, every `execute_code` step in
the draft is kept, including one planted by an attached file. Today only the author can start a
draft, so the planted code runs as the author, against the author's own data. 296 D-11 left egress
unchanged on purpose: closing it breaks workflows that fetch at run time.

## Why it matters

When a key, a schedule or a colleague can start a workflow whose code was shaped by an untrusted
file, that code runs with network egress and nobody reviews it. That is an exfiltration path.

## When to surface

Before any non-author or API caller can reach a workflow with `execute_code`.

## Scope estimate

Medium to large: a per-run `network_mode` (none by default for unattended starts), an allow-list,
and a worded refusal when a step needs the network.

## Breadcrumbs

- 291 deferred-items R1-WR-01 ("Trigger: the sandbox network_mode decision").
- 296-INVENTORY ACCEPT 291-R1-WR-01-res closes on this seed.
