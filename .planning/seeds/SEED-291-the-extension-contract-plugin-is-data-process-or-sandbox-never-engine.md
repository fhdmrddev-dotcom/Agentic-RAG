---
seed_id: SEED-291
title: "The extension contract — a plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE, and never engine code. The rule that lets an ecosystem exist without dissolving the governance claim."
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: "Planted from the outside architecture read of 2026-09-18 (archived under `.planning/external-reviews/`), reconciled against the tree the same day. The RULE is new as a written contract; every MECHANISM it names already ships."
trigger_when: >
  Fire at the /gsd:new-milestone that first scopes an ecosystem, plugin, pack, marketplace,
  partner or third-party-extension surface — this seed is that milestone's FIRST decision, not one
  of its requirements, because it decides what such a surface is permitted to be.

  Fire ALSO, and independently, on any phase that proposes to make an executor, an emitter, a
  validator, a programmatic function or an agent tool resolvable from data, config, a database row
  or a user-supplied name. That is the exact move this seed exists to refuse, and it will arrive
  wearing a reasonable justification.

  Mechanical check that the closed core is still closed, from the repo root:
    grep -rn "getattr(\|importlib\|eval(\|exec(" backend/app/services/harness/phase_types.py backend/app/services/tool_dispatcher.py
trigger_paths:
  - "backend/app/services/harness/phase_types.py"
  - "backend/app/services/harness/validator_kinds.py"
  - "backend/app/services/harness/emitters.py"
  - "backend/app/services/harness/programmatic.py"
  - "backend/app/services/tool_dispatcher.py"
  - "backend/app/services/agent_loop.py"
trigger_surfaces: [harness, workflow, skills, connectors, sandbox]
migration_note:
relates_to:
  - SEED-198 — Experts / domain bundles. THE FIRST THING THIS CONTRACT MAKES POSSIBLE. A pack is data; this seed is why it is allowed to be.
  - SEED-013 — Open Platform (REST API + MCP + service accounts). The external-process arm, and the one unbuilt slot left in `PRDs/SEQUENCE.md`.
  - SEED-146 — the full integration capability surface. Its already-answered clause (no outbound capability before the approval model) is this contract applied once.
  - SEED-080 / SEED-083 — entitlement + tier packaging. What turns a pack into a SKU rather than a folder.
  - SEED-186 / SEED-187 / SEED-188 — community skills. Skills are the data arm already running in public.
  - SEED-294 — go-to-market. This contract is what that seed is allowed to SELL.
  - v3.6 D-14 red line — "the canvas never became a second runtime". The precedent this seed generalises.
  - Phase 185 — graded governance. The claim this contract protects.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-291: The extension contract

## The finding

**This project already runs two extension philosophies, they are coherent, and nothing writes
them down.** Measured against the tree on 2026-09-18:

**Open at the edges** — each has a registry, a protocol or a directory, and a new member arrives
without an engine change:

| Edge | Where | Proof it is open |
|---|---|---|
| Model providers | `model_registry`, `provider_gateway/`, `model_discovery_service` | Phase 249 — a local/self-hosted model registers from the UI with no code edit and no deploy |
| Source families | `services/sources/` over one browse/list/read/check contract | Phase 239 proved zero-code by HASH against GitHub MCP; Phase 240 left `sources/base.py` byte-identical for mail |
| Connections | `connectors/registry.py`, `protocol.py`, `descriptors.py` | v3.9 — Notion returned 41 tools for zero lines of tool code |
| MCP servers | `mcp_client.py` | Any official MCP server, per-tool consent, no per-vendor adapter |
| Skills | `skill_catalog_filter`, `skill_embedding_service`, versions, evals | Teachable, persistent, shareable — already user-facing |
| Extractors | `services/extractors/` | A directory |

**Closed at the core** — names resolve against dictionaries fixed at import, and nothing is
evaluated dynamically: workflow executors, emitters, validators, programmatic functions, agent
tools.

## Why it matters

**The closed core is not a limitation waiting to be engineered away. It IS the product claim.**

v3.6 shipped graded per-node governance — strict-when-KB-grounded, flexible-when-open — enforced
at RUN time so that whoever authors the content cannot loosen it. The competitive crawl that
milestone ran found none of Beam, Glean or n8n grading strictness by grounding.

**The moment a third party can register an executor, an emitter or a validator, that claim is not
weakened. It is gone** — because it was a claim about what is structurally impossible, and a claim
about impossibility survives exactly zero exceptions.

So the contract is one line:

> **A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code.**

All three mechanisms already exist, which is what makes this a contract rather than a proposal:

| Mechanism | Already exists as | What a plugin may therefore be |
|---|---|---|
| **Data** | skills, workflow definitions, templates, metadata schemas, classification rules, view filters | Vertical packs, prompt sets, starter workflows, document schemas, report templates |
| **External process** | `mcp_client.py`, with `skill_snapshot` as the precedent for pinning a schema at publish | Any third-party tool surface, versioned and drift-checked |
| **Sandboxed code** | `sandbox_service.py`, pinned `agentic-rag-sandbox` image | Customer transforms, parsers, calculations |

⭐ **The commercial consequence, and the reason this is a seed rather than a docs task:** an
ecosystem built only on those three adds a revenue surface **without touching the trust boundary**.
Partners can ship packs without ever seeing engine code. That is the whole strategy, and it is
reachable today — the constraint is not capability, it is that nobody has written the rule down,
so the first plausible-sounding exception will win an argument it should lose.

⛔ **What this contract REFUSES, said out loud so it stops being re-litigated:**

- **Third-party executors, emitters or validators.** Destroys the governance claim by construction.
- **A generic HTTP egress node.** The architecture exists to make arbitrary egress unrepresentable.
  If it ever arrives it is a separate phase type with its own gate story — never a fourth
  capability name on the existing one.
- **Branching / looping workflow graphs as a plugin concern.** Milestone-sized, and it breaks
  resumability, reachability and the publish gate. Forward-only jumps are the minimal move if it
  is ever revisited. Not a plugin question.

## When to surface

Two independent conditions, both written as conditions rather than moods:

1. **Any `/gsd:new-milestone` whose scope names an ecosystem, plugin, pack, marketplace, partner
   or third-party-extension surface.** This seed is that milestone's first decision.
2. **Any phase whose plan makes an executor, emitter, validator, programmatic function or agent
   tool resolvable from data, config, a DB row or a user-supplied name.** The `trigger_paths` above
   are exactly those six files.

## Scope estimate

**Small as a decision, Large as a programme.** Writing the contract is a page. The thing it
unblocks — SEED-198's pack format, entitlement, a partner surface — is several milestones. ⚠ The
contract must be written FIRST and cheaply, because its whole value is being in place before the
first exception is proposed.

## Breadcrumbs

- Outside architecture read, 2026-09-18 — archived under `.planning/external-reviews/`. Written
  without a working tree and without reading `ROADMAP.md`; **its §1.3 rule is the one thing in it
  that reconciliation strengthened rather than corrected.**
- Reconciliation measured the same day: 8 of its 9 "challenges" were already closed, already
  planned, or refuted — but the open/closed split it named is real, and checks out file by file.
- v3.6 D-14: 7 harness executors at open, 7 at close, across 13 phases. The red line held once
  already, which is the evidence that this contract is enforceable rather than aspirational.
- Phase 206 / `D-206-07`: the `test_189_no_egress.py` fence was retired DELIBERATELY when the MCP
  client landed. That is the shape a contract change must take — never a surprise.
