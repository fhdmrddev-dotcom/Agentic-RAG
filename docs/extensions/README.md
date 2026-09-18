# Third-Party Extension Worked Examples

This directory contains standalone, complete worked examples illustrating how third-party developers, partners, and operators extend Agentic RAG without writing engine code, in full compliance with the [Extension Contract](../EXTENSION-CONTRACT.md).

## Example Catalog

| Directory / File | Mechanism | Description |
|---|---|---|
| [`skill-package-example/SKILL.md`](skill-package-example/SKILL.md) | **1. DATA** | A pure-data Skill package defining frontmatter triggers, schema, and behavioral instructions. |
| [`workflow-definition-example.json`](workflow-definition-example.json) | **1. DATA** | A declarative workflow definition DAG that imports and runs directly in the Workflow Studio. |
| [`mcp-server-example.md`](mcp-server-example.md) | **2. EXTERNAL PROCESS** | A complete guide and runnable code for an out-of-process Model Context Protocol (MCP) server. |
| [`sandbox-transform-example.py`](sandbox-transform-example.py) | **3. SANDBOXED CODE** | An algorithmic Python transform designed to execute in the secure Docker container sandbox. |

---

## Contract Verification

Every extension pattern demonstrated here satisfies the core rule:
> **A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code.**

No extension here requires modifying backend services, database migrations, or core engine dispatch tables.
