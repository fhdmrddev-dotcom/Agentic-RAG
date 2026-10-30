/**
 * Phase 293-04 — shared builders for the API key component suites (not a suite itself).
 * Local-time constructors, because every card formats in the viewer's zone.
 */
import type {
  ApiKeyCall,
  ApiKeyRead,
  McpAvailability,
  McpToolRef,
  PickableFolder,
  StartableWorkflow,
} from "@/lib/api/apiKeys"

export const NOW = new Date(2026, 9, 25, 12, 0)
export const iso = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m, d, h, min).toISOString()

export function makeKey(over: Partial<ApiKeyRead> = {}): ApiKeyRead {
  return {
    id: "k1",
    label: "n8n-prod",
    key_prefix: "srl_live_Ab3d",
    workflows: [{ id: "w1", name: "Contract review", state: "startable" }],
    state: "active",
    expires_at: iso(2027, 0, 22),
    revoked_at: null,
    revoked_by_name: null,
    revoked_by_admin: false,
    last_used_at: iso(2026, 9, 25, 10, 42),
    created_at: iso(2026, 9, 1),
    owner_name: "Dana Kim",
    owner_is_you: true,
    calls: [],
    // Phase 304 — a workflow key's MCP fields.
    kind: "workflow",
    tools: null,
    folders: null,
    include_external: false,
    org_name: null,
    mcp_off: null,
    ...over,
  }
}

/** Phase 304-05: the server's D-11 catalogue as `GET /api-keys` serves it (test data only — the
 *  components never retype it; they read `list.mcp.tools`). */
export const MCP_CATALOGUE: McpToolRef[] = [
  { name: "search_knowledge_base", group: "read", label: "Search your knowledge base", travels_with: null },
  { name: "list_documents", group: "read", label: "List documents and folders", travels_with: null },
  { name: "read_document", group: "read", label: "Read a document", travels_with: null },
  { name: "ask_agent", group: "ask", label: "Ask the agent a question", travels_with: null },
  { name: "get_answer", group: "ask", label: "Fetch the agent's answer", travels_with: "ask_agent" },
  { name: "list_workflows", group: "run", label: "List your workflows", travels_with: "run_workflow" },
  { name: "run_workflow", group: "run", label: "Start a workflow run", travels_with: null },
  { name: "get_workflow_run", group: "run", label: "Check a workflow run", travels_with: "run_workflow" },
]

export const READ_ONLY_TOOLS = ["search_knowledge_base", "list_documents", "read_document"]

export const MCP_URL = "https://syrel.example.com/mcp"

/** An MCP key as the list serves it: Read only, All folders, never used, 90-day expiry. */
export function makeMcpKey(over: Partial<ApiKeyRead> = {}): ApiKeyRead {
  return makeKey({
    id: "m1",
    label: "claude-code-laptop",
    key_prefix: "srl_mcp_Xy12",
    workflows: [],
    expires_at: iso(2027, 0, 23),
    last_used_at: null,
    kind: "mcp",
    tools: READ_ONLY_TOOLS,
    folders: null,
    include_external: false,
    org_name: "Acme",
    mcp_off: null,
    ...over,
  })
}

export function makeMcp(over: Partial<McpAvailability> = {}): McpAvailability {
  return { available: true, off: null, url: MCP_URL, tools: MCP_CATALOGUE, ...over }
}

export function makeFolder(over: Partial<PickableFolder> & { id: string }): PickableFolder {
  return { name: over.id, parent_id: null, shared: false, source: null, ...over }
}

export function makeCall(over: Partial<ApiKeyCall> = {}): ApiKeyCall {
  return {
    at: iso(2026, 9, 25, 10, 42),
    verb: "start",
    workflow_id: "w1",
    workflow_name: "Contract review",
    run_id: "7f3a91c2-0000-4000-8000-000000000000",
    ok: true,
    outcome: "started",
    reason: null,
    detail: null,
    ...over,
  }
}

export function makeStartable(over: Partial<StartableWorkflow> = {}): StartableWorkflow {
  return {
    id: "w1",
    name: "Contract review",
    fields: [
      { key: "counterparty", label: "Counterparty", required: true },
      { key: "due_date", label: "Due date", required: false },
    ],
    startable: true,
    reason: null,
    ...over,
  }
}
