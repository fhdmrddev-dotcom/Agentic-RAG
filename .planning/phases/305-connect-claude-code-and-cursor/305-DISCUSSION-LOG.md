# Phase 305: Connect Claude Code and Cursor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-31
**Phase:** 305-connect-claude-code-and-cursor
**Mode:** `--auto` (operator: "continue autonomously end to end"). No question was put to the operator; each area took the recommended option.
**Areas discussed:** Transport and mount, Auth edge, The three read tools, Result hygiene, Narrowing at call time, Labels and errors / maintenance, Audit and limits, Spend attribution, PII redaction, Verification and UAT

---

## Transport and mount

| Option | Description | Selected |
|--------|-------------|----------|
| `mcp` 2.3.x stateless, no FastAPI upgrade, retire `test_059` under a D-NN | research D9, measured with a pip dry-run | ✓ |
| Hand-rolled JSON-RPC server | no SDK dependency | |
| FastAPI upgrade bundled | newer sse-starlette | |

[auto] Transport — Q: "Which server?" → Selected: "`mcp` 2.3.x stateless" (recommended default)
[auto] Transport — Q: "Canonical path?" → Selected: "`/mcp`, confirmed per topology in research; refuse the mount in production on a loopback `BACKEND_PUBLIC_URL`" (Q19)

## Auth edge

| Option | Description | Selected |
|--------|-------------|----------|
| Research decides `TokenVerifier` vs pure-ASGI wrapper; both call `authenticate_presented_key` | research D5 | ✓ |
| Lock `TokenVerifier` now | | |
| Lock the ASGI wrapper now | | |

[auto] Auth — Q: "Refusal shape?" → Selected: "one identical 401; only switched-off refusals carry words" (304 D-19, T-304-14)
[auto] Auth — Q: "Acting org source?" → Selected: "`McpPrincipal.org_id` only" (T-304-03)

## The three read tools

[auto] Tools — Q: "How do tools reach data?" → Selected: "wrap 304 `acting_member_reads`; no new visibility SQL" (304 D-24/D-38)
[auto] Tools — Q: "How are folders browsed with no `list_folders` tool?" → Selected: "`list_documents(folder_id?)` returns subfolders and documents" (304 D-11 fixes the catalogue)
[auto] Tools — Q: "Missing vs forbidden?" → Selected: "byte-identical refusal, malformed ids included"

## Result hygiene

[auto] Hygiene — Q: "Result form?" → Selected: "structuredContent + text; delimited passages; defanged images; static descriptions" (pitfall 4)

## Narrowing at call time

[auto] Narrowing — Q: "Where is the tool grant enforced?" → Selected: "both `tools/list` and `tools/call`" (pitfall 2)

## Labels, errors, maintenance

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist the MCP path in `maintenance.py`; refuse non-read tools in the server with a JSON-RPC error | research D7 | ✓ |
| Let the middleware 503 every MCP POST | reads would break in maintenance | |

## Audit and limits

[auto] Audit — Q: "Audit literal?" → Selected: "reuse `api_key.read` + `metadata.kind='mcp'`, `tool`, `outcome`" (304 D-36)
[auto] Limits — Q: "Buckets?" → Selected: "cheap (list/read) on the existing reads knob; expensive (search) on one new knob; refusal as a relayable tool error"

## Spend attribution

| Option | Description | Selected |
|--------|-------------|----------|
| A usage row that flows through the ONE `per_root` spend CTE; research picks the storage | totals agree by construction | ✓ |
| A separate MCP spend query | the 257 "two dialects" defect | |

[auto] Spend — Q: "AdminSpendPage?" → Selected: "no edit preferred; seam first if touched" (G-5 FIRES)

## PII redaction

| Option | Description | Selected |
|--------|-------------|----------|
| In-house deterministic redactor behind `Redactor`, one `outbound_guard`, per-org column, off by default, fail closed | research D8, Q5 | ✓ |
| Presidio / spaCy | heavy, names only partly | |
| Global (deployment-wide) redaction | anti-feature in FEATURES.md | |

## Verification and UAT

[auto] UAT — Q: "Which client rows can Claude drive?" → Selected: "Claude Code (CLI) locally; Cursor, cloud container, one-box and Claude Desktop owed to the operator"
[auto] UAT — Q: "Cross-provider scoreboard?" → Selected: "N/A — no LLM path touched; 306 runs it"

## Claude's Discretion

- Plan split within 3-5; module names in `backend/app/mcp/`; sentences; chunk budget and page sizes within bounds.

## Deferred Ideas

- "Test this key" button; name redaction; LangSmith/log redaction; ChatGPT `search`/`fetch` aliases.
- BUG-261031-01 deferred with a re-open trigger (operator reproduction on a disposable Postgres).
