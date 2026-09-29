# Phase 255 Plan 01 Summary: The Extension Contract & Worked Examples

**Completed:** 2026-09-18
**Plan:** 255-01 (Wave 1)
**Requirements Delivered:** EXT-01, EXT-03

## Accomplishments

1. **The Extension Contract Authored (`docs/EXTENSION-CONTRACT.md`):**
   - Codified binding project law: *"A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code."*
   - Detailed the architectural guarantee of the closed core vs. open edges.
   - Formalized the three permitted mechanisms:
     * Data: Skills, declarative workflow DAGs, templates, metadata schemas.
     * External Process: Out-of-process Model Context Protocol (MCP) servers with per-tool approval grants and DNS-pinned egress.
     * Sandboxed Code: Isolated container compute running within `agentic-rag-sandbox`.
   - Recorded the three non-negotiable architectural refusals:
     * Third-party executors / emitters / validators
     * Generic HTTP egress node
     * Branching / looping workflow graphs as a plugin concern
   - Provided third-party extension development instructions.

2. **Complete Third-Party Worked Examples Authored (`docs/extensions/`):**
   - `docs/extensions/README.md`: Directory index and navigation guide.
   - `docs/extensions/skill-package-example/SKILL.md`: Pure-data financial analysis skill package with YAML frontmatter, parameter schema, and behavioral instructions.
   - `docs/extensions/workflow-definition-example.json`: Declarative 3-phase due diligence workflow DAG importing directly into Workflow Studio without backend code.
   - `docs/extensions/mcp-server-example.md`: Out-of-process FastMCP server implementation, connection setup guide, and execution flow.
   - `docs/extensions/sandbox-transform-example.py`: Python financial risk calculation script running in the pinned container sandbox via `execute_code`.

3. **Anchored in Project Rules (`CLAUDE.md`):**
   - Added core rule bullet to `CLAUDE.md` cross-referencing `docs/EXTENSION-CONTRACT.md`.
   - Verified `node scripts/check-claude-md-size.cjs` exits 0 (105,233 chars, 70.2% of budget, 44,767 chars of headroom).

## Verification Evidence

```bash
# Files created and populated:
test -f docs/EXTENSION-CONTRACT.md (exit 0)
test -f docs/extensions/README.md (exit 0)
test -f docs/extensions/skill-package-example/SKILL.md (exit 0)
test -f docs/extensions/workflow-definition-example.json (exit 0)
test -f docs/extensions/mcp-server-example.md (exit 0)
test -f docs/extensions/sandbox-transform-example.py (exit 0)

# Budget guard:
node scripts/check-claude-md-size.cjs -> exit 0 (105233 chars)
```
