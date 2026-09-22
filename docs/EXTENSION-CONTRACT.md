# The Extension Contract: Principles, Mechanisms & Refusals

> **The Binding Project Law:**  
> **A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code.**

---

## 1. Why This Contract Exists

The Agentic RAG platform operates under a foundational architectural guarantee: **graded per-node governance** (enforced at run-time, strict-when-grounded, flexible-when-open). The workflow runtime, phase executors, forced emitters, validation gates, programmatic functions, and agent tools form the **closed core** of the engine.

A claim about what is structurally impossible survives exactly zero exceptions. The moment an external entity or third-party plugin can register engine code—an arbitrary workflow executor, custom emitter, in-process validator, or dynamic dispatch handler—the governance claim is not merely weakened; it is structurally destroyed.

To enable a rich ecosystem, commercial vertical packs, and partner integrations without diluting trust boundaries, this contract establishes the three permitted extension mechanisms and explicitly records what is refused.

---

## 2. The Closed Core vs. Open Edges

The platform architecture is deliberately divided:

| Edge (Open by Design) | Extension Mechanism | How It Ships |
|---|---|---|
| **Skills** | DATA (Markdown + YAML) | Folders under `skills/` or imported dynamically with frontmatter, prompt rules, and schemas |
| **Workflows** | DATA (Declarative JSON/YAML DAG) | Pure configuration mapping phase types, inputs, outputs, and validation gates |
| **Templates & Schemas** | DATA (Docx / Jinja / JSON Schema) | Uploaded or pinned template assets rendered deterministically |
| **External Tools & Services** | EXTERNAL PROCESS (MCP) | Model Context Protocol servers communicating over JSON-RPC, gated by approval & audit |
| **Custom Transforms & Compute** | SANDBOXED CODE (Docker) | Python scripts executed inside an isolated container (`agentic-rag-sandbox`) |

The following components are strictly **CLOSED** and must never be dynamically registered, imported, or resolved from external data, database rows, configuration files, or user inputs:
- Workflow Phase Executors (`PHASE_TYPE_REGISTRY_ENTRIES` in `phase_types.py`)
- Emitter Drivers & Schemas (`EMITTER_REGISTRY` in `emitters.py`)
- Programmatic Functions (`PROGRAMMATIC_PHASE_REGISTRY` in `programmatic.py`)
- Validation Gate Kinds (`VALIDATOR_REGISTRY` and `PROGRAMMATIC_VALIDATOR_REGISTRY` in `validators.py`)
- Agent Built-in Tools (`_TOOL_REGISTRY` in `tool_dispatcher.py`)

---

## 3. The Three Permitted Extension Mechanisms

Third-party developers, partners, and operators extend Agentic RAG through three trusted channels:

```
                  ┌───────────────────────────────────────────────┐
                  │              Agentic RAG Engine               │
                  │   (Closed Core: Executors, Gates, Tools)     │
                  └───────┬───────────────┬───────────────┬───────┘
                          │               │               │
            1. DATA       │  2. EXTERNAL  │  3. SANDBOX   │
                          │     PROCESS   │     CODE      │
                          ▼               ▼               ▼
                 ┌────────────────┐ ┌───────────┐ ┌───────────────┐
                 │ Skill Packages │ │MCP Servers│ │ Docker Sandbox│
                 │ Workflow DAGs  │ │ (JSON-RPC)│ │  (Isolated    │
                 │ Schema Models  │ │           │ │   Execution)  │
                 └────────────────┘ └───────────┘ └───────────────┘
```

### Mechanism 1: DATA (Skills, Workflows, Templates, Schemas)
- **What it is:** Pure declarations that guide the agent or orchestrate existing engine primitives without executable logic in the host process.
- **Form:**
  - **Skills:** `SKILL.md` containing YAML frontmatter (`name`, `description`, `trigger_phrases`, `parameters`) and markdown instructions.
  - **Workflows:** JSON/YAML declarative definitions that wire existing engine phase types (e.g. `llm_single`, `llm_agent`, `programmatic`, `llm_emit`) and gates.
  - **Templates:** Jinja/docx template files paired with schema mappings for `llm_emit` phases.
- **Security Boundary:** Parsed by strict Pydantic schemas. Stored in Postgres under Row-Level Security (RLS). No Python code execution occurs on the server.
- **Worked Examples:** See `docs/extensions/skill-package-example/` and `docs/extensions/workflow-definition-example.json`.

### Mechanism 2: EXTERNAL PROCESS (Model Context Protocol - MCP)
- **What it is:** Out-of-process tools running in separate operating system processes or remote network servers implementing the Model Context Protocol (JSON-RPC 2.0).
- **Form:**
  - Standard MCP server endpoints (`mcp_server_url`) discovered via `mcp_client.py`.
  - Discovered tools are inspected and presented to the operator.
  - Each tool call requires explicit grant permissions (`per-tool grants`) and records an immutable audit trail (`harness_audit` / connection receipts).
- **Security Boundary:** The engine communicates strictly over HTTP/stdio JSON-RPC. Destination URLs are verified against SSRF, loopback, and RFC1918 addresses via TOCTOU DNS pinning (`validate_mcp_destination`). No external code runs inside the backend Python runtime.
- **Worked Example:** See `docs/extensions/mcp-server-example.md`.

### Mechanism 3: SANDBOXED CODE (Docker Container Execution)
- **What it is:** User-provided or agent-generated algorithmic code, data transformations, calculations, and parsers.
- **Form:**
  - Python scripts executed via the `execute_code` tool handled by `sandbox_service.py`.
  - Runs in ephemeral Docker containers using the pinned `agentic-rag-sandbox` image with fixed analytical libraries (`pandas`, `numpy`, `reportlab`, `docxtpl`, `openpyxl`).
- **Security Boundary:** Gated by `SANDBOX_ENABLED`. Containers have no access to host filesystem, no host network egress, bounded memory/CPU, and bounded execution time. State does not leak across tenants or threads.
- **Worked Example:** See `docs/extensions/sandbox-transform-example.py`.

---

## 4. Explicit Architectural Refusals

To prevent recurring design debates, this contract formally records what the architecture **refuses**:

### Refusal 1: Third-Party Executors, Emitters, or Validators
- **Refusal:** We refuse any feature that allows third-party Python packages, dynamic imports, or plugins to register custom workflow executors, forced emitters, or validation gates.
- **Reason:** Executors and gates define the security boundary and the graded governance model. A custom executor can bypass grounding checks, leak secrets, or disarm circuit breakers. The core registry of 7 executors is fixed.

### Refusal 2: Generic HTTP Egress Node
- **Refusal:** We refuse generic "HTTP Request" / "Webhook" nodes in workflows or agent tools.
- **Reason:** Unbounded egress creates severe SSRF, cloud-metadata exfiltration, and lateral movement risks. Outbound integrations must be modeled as governed capability connectors or pinned MCP servers with DNS-rebinding protections, explicit approvals, and audit logs.

### Refusal 3: Branching / Looping Graphs as a Plugin Concern
- **Refusal:** We refuse arbitrary user-defined cyclic loops or complex branching graph topographies within plugins.
- **Reason:** Workflows must guarantee resumability, reachability, forward progress, and verifiable termination. Loops break deterministic rollback and publish-gate coverage. Forward-only graphs with structured batch fan-out (`llm_batch_agents`) provide required concurrency safely.

---

## 5. Developer Guide: How to Ship an Extension

1. **Building an Agent Skill:** Author a directory with `SKILL.md` and any reference files. Distribute as a folder or zip. Users can teach the agent directly through chat or upload to Settings → Skills.
2. **Building a Connector / Service Integration:** Implement an MCP server using any language (TypeScript, Python, Go) exposing JSON-RPC tools. Connect the server via Settings → Connections.
3. **Building a Workflow Template:** Author a workflow DAG in JSON referencing standard phases and export it. Third-party users import the template into Workflow Studio.
4. **Building Custom Calculations:** Package Python scripts that run through `execute_code` in the sandbox, interacting purely through stdin/stdout and input parameters.

---

## 6. Mechanical Enforcement

This contract is not a suggestion; it is enforced by automated gates:
- `scripts/check-extension-contract.cjs`: AST and pattern scanner auditing the six trigger paths (`phase_types.py`, `validator_kinds.py`, `emitters.py`, `programmatic.py`, `tool_dispatcher.py`, `agent_loop.py`).
- `backend/tests/unit/test_255_extension_contract_guard.py`: Unit test suite ensuring registries remain static and closed.
- Pre-commit and GSD hooks preventing commits that introduce dynamic dispatch.
