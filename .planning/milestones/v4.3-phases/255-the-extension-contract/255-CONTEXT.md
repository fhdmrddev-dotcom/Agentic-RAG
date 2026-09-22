# Phase 255: The Extension Contract — Context

**Gathered:** 2026-09-18
**Status:** In discussion / Ready for planning

<domain>
## Phase Boundary

Phase 255 establishes the foundational extension contract for the Agentic RAG platform:
What a plugin is permitted to be is written down as binding project law and mechanically enforced,
**before** the first plausible exception is proposed.

**Scope source is FIXED:** `.planning/REQUIREMENTS.md` (EXT-01, EXT-02, EXT-03) and `.planning/seeds/SEED-291-the-extension-contract-plugin-is-data-process-or-sandbox-never-engine.md`.

- **EXT-01:** The extension contract is written down as binding project law — *a plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE, and never engine code* — in one durable home (`docs/EXTENSION-CONTRACT.md`), naming the three permitted mechanisms and explicitly refusing third-party executors / emitters / validators, generic HTTP egress, and branching / looping workflow graphs.
- **EXT-02:** A mechanical guard fails when an executor, emitter, validator, programmatic function, or agent tool becomes resolvable from data, config, a database row, or a user-supplied name — over the six `trigger_paths` named in `SEED-291`. The guard is driven RED against a planted violation on all six paths before it is trusted, and lands where it executes in order.
- **EXT-03:** Each of the three permitted mechanisms has a named home and one worked example a third party could follow without seeing engine code (Data → skill / workflow definition / template; External Process → `mcp_client.py`; Sandboxed Code → `sandbox_service.py`).

No schema migrations (UI hint: no).
</domain>

<decisions>
## Implementation Decisions

### A. The Contract Specification & Durable Home (EXT-01)

- **D-255-01:** The canonical durable home for the extension contract is `docs/EXTENSION-CONTRACT.md`, with direct cross-references and summary invariants added to `CLAUDE.md`.
- **D-255-02:** The contract explicitly defines the three permitted plugin mechanisms:
  1. **Data:** Skills (`SKILL.md`), workflow definitions (DAG schemas), templates (`template_render_service`), and metadata schemas.
  2. **External Process:** Standardized Model Context Protocol (MCP) clients (`mcp_client.py`), with discovered tools, per-tool grants, pinned schemas, and audit receipts.
  3. **Sandboxed Code:** Ephemeral, isolated container environments (`sandbox_service.py` via `agentic-rag-sandbox`), running user/agent code with no direct host, DB, or network bypass.
- **D-255-03:** The contract explicitly records the three architectural refusals:
  1. *Third-party executors, emitters, or validators:* Disallowed. The closed core (`PHASE_TYPE_REGISTRY_ENTRIES`, `PROGRAMMATIC_PHASE_REGISTRY`, `EMITTER_REGISTRY`, `_TOOL_REGISTRY`, `VALIDATOR_REGISTRY`) is the graded-governance product claim.
  2. *Generic HTTP egress node:* Disallowed. All external outbound calls must be governed capability connectors or pinned MCP servers.
  3. *Branching / looping workflow graphs as a plugin concern:* Disallowed. Arbitrary graph control structures break determinism, resumability, and the publish gate.

### B. The Mechanical Guard & Enforcement (EXT-02)

- **D-255-04:** The mechanical guard is implemented in two complementary, executable layers:
  1. `scripts/check-extension-contract.cjs`: Standalone Node.js AST/regex static analysis scanner verifying the closed-core boundary across the six trigger files. Returns exit 0 on clean, exit 1 on violation with exact line numbers.
  2. `backend/tests/unit/test_255_extension_contract_guard.py`: A pytest unit test in the canonical test suite asserting that the registries remain closed dicts and that no dynamic dispatch (`importlib`, `eval`, `exec`, or dynamic attribute-based callable lookups) exists for executors, emitters, validators, programmatic functions, or tools.
- **D-255-05:** The six trigger paths audited from `SEED-291` are:
  - `backend/app/services/harness/phase_types.py`
  - `backend/app/services/harness/validator_kinds.py`
  - `backend/app/services/harness/emitters.py`
  - `backend/app/services/harness/programmatic.py`
  - `backend/app/services/tool_dispatcher.py`
  - `backend/app/services/agent_loop.py`
- **D-255-06:** The guard must be driven **RED** against planted violations in all six files before being finalized, with before/after logs recorded in the plan summary.
- **D-255-07:** The guard is wired to execute in order: registered in package scripts (`npm run check:extension-contract`), wired into pre-commit/hooks, and included in the pytest backend test pass.

### C. Worked Examples for Third Parties (EXT-03)

- **D-255-08:** Worked examples will be authored in `docs/extensions/` and embedded in `docs/EXTENSION-CONTRACT.md`:
  1. *Data Example:* A self-contained, fully commented custom skill package and a starter workflow JSON definition that can be imported directly.
  2. *External Process Example:* An MCP server configuration walkthrough demonstrating how to expose external tools to the agent with per-tool grant controls.
  3. *Sandboxed Code Example:* A Python data-transform script illustrating how custom compute runs securely via the sandbox execution boundary.

### D. Governance & Ledger Maintenance (G-5, G-8)

- **D-255-09:** Phase 255 reads but does NOT modify the engine implementation in the six trigger files (preserving the closed core).
- **D-255-10:** Hot-file ledger rows for `programmatic.py` and `emitters.py` are added to `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`, and stale triples for `phase_types.py`, `agent_loop.py`, and `validator_kinds.py` are refreshed to keep G-5 clean.
- **D-255-11:** Phase plan count is targeted at 2-3 plans under G-8 (Plan 01: Contract & Examples, Plan 02: Mechanical Guard & RED drives, Plan 03: Ledger rows & Seed/State updates).

</decisions>

<operator_decisions>
## Operator Rulings Needed at Phase 255 Discuss

### 1. Decision #2: Open Platform Sequencing (`SEED-013`)
- **Question:** Does Open Platform (REST API + MCP server + Service Accounts, `SEED-013`, the external-process arm of `EXT-01`) sequence inside Milestone v4.3 or immediately after v4.3?
- **Recommendation:** Sequence immediately after v4.3 (Milestone v4.4 or dedicated milestone). v4.3 focuses on packaging, pricing, metering, tiers, and experts ("What You Can Actually Sell"). Open Platform is a substantial developer platform surface requiring its own auth, API keys, and rate-limiting infrastructure. If deferred after v4.3, this recommendation serves as the written reason required by the roadmap.
- **Status:** Open for operator ruling on the agent bus.

### 2. Decision #6: `OV-248-01` Register Ruling
- **Question:** Retire `OV-248-01` (`retired-2026-09-18`) or record why it stays `live`?
- **Recommendation:** Retire `OV-248-01` as `retired-2026-09-18`. The override recorded that Claude would build Phase 248 end-to-end without independent review. However, Phase 248 closed with `verification_mode: peer-reviewed` (Gemini built, Claude reviewed in `248-VERIFICATION.md`), satisfying the override's own lapse trigger.
- **Status:** Open for operator ruling on the agent bus.
</operator_decisions>

<reported_bugs>
## Reported Bugs Cross-Check

The six open reports with `surface: Agentic-RAG` touching harness / workflow / executor / validator territory were audited:
- `BUG-260609-02` (workflow navigation)
- `BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar` (workflow run nav)
- `BUG-260730-02-emit-gate-reports-citations-when-citations-were-perfect` (forced emit citations)
- `BUG-260815-06-structural-gate-refusal-names-nothing-actionable` (gate refusal message)
- `BUG-260828-05-send-receipt-names-the-smtp-host-not-the-recipient` (connection receipt)
- `BUG-260908-01-chunks-section-is-unbounded-and-buries-every-section-below-it` (document chunks UI)

**Disposition:** None of these overlap with Phase 255's extension contract boundary. They remain open and routed to their respective future phases.
</reported_bugs>

<seeds_sweep>
## Seeds Register Sweep

- **`SEED-291`:** The extension contract itself. Phase 255 is the direct implementation of this seed. Upon completion of Phase 255, `SEED-291` frontmatter will be flipped to `status: answered` with `folded_into: 255`.
- **`SEED-295`:** Named outcomes / forward-only edges. Planted 2026-09-18 as UNJUSTIFIED. `trigger_when` requires `EXT-01` to have landed first. Remains `status: planted` (unjustified) and is not in scope for 255.
</seeds_sweep>
