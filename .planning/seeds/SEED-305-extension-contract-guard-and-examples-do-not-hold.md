---
seed_id: SEED-305
title: The Extension Contract's guard misses the dynamic forms it exists to catch, and its worked examples do not match the product
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Before any third-party pack or plugin is accepted (SEED-291 ecosystem work gets a phase number), or any phase touching scripts/check-extension-contract.cjs, the harness registries, docs/EXTENSION-CONTRACT.md, docs/extensions/**, or sandbox_service.py's runtime config.
trigger_paths: ["scripts/check-extension-contract.cjs", "backend/tests/unit/test_255_extension_contract_guard.py", ".claude/hooks/extension-contract-guard.js", "docs/EXTENSION-CONTRACT.md", "docs/extensions/**", "backend/app/services/harness/**", "backend/app/services/sandbox_service.py"]
trigger_surfaces: [harness, sandbox, skills, connectors]
migration_note:
relates_to: ["255", SEED-291, R265-255-01, R265-255-02, R265-255-03, R265-255-04, R265-255-06, R265-255-07, R265-255-08, R265-255-10, R265-255-11]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-305: The Extension Contract's guard and examples do not hold

## The finding

Phase 265's review of 255 (`.planning/phases/265-owed-v4-3-verification/265-REVIEW-255.md`) found:

- **The guard** (`scripts/check-extension-contract.cjs`, line-based regex). Seven dynamic plants all exit 0 (R265-255-01): name-variable registry writes, `.update`, `.setdefault`, `globals()[...]`, a two-line `getattr`, and `register_*` called with a row value. In both guards, a `#` inside a string hides the rest of the line (R265-255-02). `validators.py`, where the validator registries live, is not scanned (R265-255-03). The registry-closure tests cannot fail on a config-gated plant (R265-255-04).
- **The examples.** The workflow example fails `WorkflowDefinition` with 29 errors (R265-255-06). The MCP example's dev URL is refused by `validate_mcp_destination`, and its UI names do not exist (R265-255-07). Skill `trigger_phrases` / `parameters` are dropped on import (R265-255-08). The example server uses the legacy SSE transport, which `mcp_client.py` does not speak (R265-255-11, PLAUSIBLE).
- **The sandbox claim.** The contract says containers have no host egress. `sandbox_service.py` sets no `network_mode` and no CPU limit (R265-255-10, PLAUSIBLE; it needs a Docker drive).

## Why it matters

EXT-02 (255 SC#2) is not met for the dynamic forms, and those are the forms a plugin would actually use. An external developer following the examples would fail at the first step. Nobody pays for this yet, because no third-party extension exists.

## When to surface

See `trigger_when`. The guard must hold before the first external pack arrives.

## Scope estimate

Medium. Moving the guard from regex to AST (Python `ast` for the .py paths) is one plan, and rewriting the four examples against the real schemas is a second. The sandbox egress question needs a Docker drive first.

## Breadcrumbs

See 265-REVIEW-255.md for the drive command behind each finding, and 265-TRIAGE.md rows `R265-255-*`. Gemini built part of 255 (plan 255-01).
