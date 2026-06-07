---
seed_id: SEED-062
title: Sandbox & agent-security hardening — egress control, isolation tier, CBSE audit, skill-import verification (post-production planned update)
status: planted
planted: 2026-06-07
phase_origin: assessment session 2026-06-06/07 (.planning/research/rag-architecture-assessment-2026-06-06.md §5 topic 6)
category: C — post-production planned update (operator directive 2026-06-07 — document-only, do NOT build pre-production)
related_seeds: [SEED-025, SEED-001, SEED-004, SEED-013]
relates_to:
  - "`backend/app/services/sandbox_service.py:58-61` — `runtime_configs` sets container name + labels ONLY; no network/egress restriction; standard shared-kernel Docker via llm-sandbox"
  - "`SANDBOX_ENABLED` gate + per-thread container reuse + 30-min idle eviction — the current (adequate-for-dev) posture"
  - "Skills system: `import_skill` accepts ZIPs with scripts; skills are user/global scope today — no verification/signing layer (becomes load-bearing at the v3.5+ marketplace idea)"
  - "Ingestion is manual-upload-only (CLAUDE.md rule) — deliberately small indirect-prompt-injection surface today; v3.3 open platform + v3.4 automations widen it (webhooks, API-ingested content)"
re_open_triggers:
  - Production / VPS deployment milestone opens (first real exposure — this seed is a named line item for that hardening pass)
  - Multi-user or org multi-tenancy work starts (v3.2 era — co-tenant code execution raises the isolation bar from "dev convenience" to "tenant boundary")
  - v3.3 Open Platform (API-sourced content enters RAG → indirect prompt injection surface grows beyond manual uploads)
  - Any move toward community/marketplace skills (v3.5+) — the synthesis's "many community-contributed skills contain vulnerabilities" finding makes import verification a precondition
  - A security review / gsd:secure-phase run flags sandbox escape or exfiltration paths
priority: low now / critical at production+multi-user
suggested_phase: post-production planned update — natural home is the deployment-hardening milestone (v3.1+ operator era) with the marketplace-verification slice waiting for v3.5+
---

# SEED-062 — Sandbox & agent-security hardening

## Current posture (verified 2026-06-07 — fine for local single-operator dev)

- Code execution: Docker via `llm-sandbox`, gated by `SANDBOX_ENABLED`,
  per-thread containers (name + thread label), idle eviction.
- **No egress control** — sandbox containers get default Docker networking;
  nothing prevents exfiltration from inside executed code.
- **Shared-kernel isolation** — plain Docker; the synthesis recommends
  MicroVMs (Firecracker) or user-space kernels (gVisor) for hostile-code tiers.
- **No CBSE audit** — nobody has checked whether the agent can rewrite its own
  configuration/startup surface from inside the sandbox (Configuration-Based
  Sandbox Escape pattern).
- **No skill verification** — `import_skill` trusts the ZIP; OK while skills
  are operator-authored, untenable for community skills.
- Mitigating factors already in place: manual-upload-only ingestion (small
  indirect-injection surface), RLS everywhere, tool whitelists in harness mode,
  workspace-scoped file tools.

## The hardening menu (when triggers fire — pick per threat model, not all-at-once)

1. **Default-deny egress** for sandbox containers (Docker network none / custom
   network + allowlist). Cheapest, highest-value first step; likely a
   `runtime_configs` extension at `sandbox_service.py:58`.
2. **CBSE audit** — enumerate what the sandboxed process can reach that
   influences host/app behavior (mounted paths, env, the output-collection
   seam at `copy_from_runtime`); document or close.
3. **Isolation-tier evaluation** — gVisor runsc as Docker runtime (drop-in
   candidate) vs Firecracker (bigger lift); decide per deployment tier
   (co-tenant SaaS needs more than dedicated single-org installs — D-PRD-02
   hybrid posture means BOTH will exist).
4. **Indirect-prompt-injection posture** — when v3.3/v3.4 add non-manual
   content paths, add source-trust metadata on retrieved chunks + injection
   heuristics at the retrieval merge.
5. **Skill-import verification** — manifest allowlists, static scan of scripts,
   signature/provenance for shared/global skills; precondition for any
   marketplace (v3.5+).

## Vibe-coder plain summary

Today the agent runs code in a Docker box on your own machine, with only you
uploading documents and writing skills — so the risk is genuinely low. But the
box has no network lock (code inside it could phone out), Docker boxes share
the computer's kernel (escapable by serious attackers), and nobody has audited
whether the agent could rewrite its own settings from inside. None of this
matters until real users / real deployment — then it matters a lot. This seed
is the checklist for that day, wired to fire automatically when deployment,
multi-tenancy, the public API, or community skills arrive.
