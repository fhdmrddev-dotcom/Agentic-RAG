# Worked Example: External Process via Model Context Protocol (MCP)

This example shows how an external service or partner integrates with Agentic RAG as an **EXTERNAL PROCESS**.
No code runs inside the Agentic RAG backend. The service runs independently, speaks JSON-RPC 2.0, and connects via the standard Model Context Protocol.

---

## 1. The MCP Server (Python FastMCP or TypeScript)

Here is a minimal, production-ready FastMCP server providing external currency conversion and weather lookups:

```python
# external_mcp_service.py
# Run with: uvicorn external_mcp_service:app --port 8088
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("PartnerFinancialTools")

@mcp.tool()
def convert_currency(amount: float, from_curr: str, to_curr: str) -> dict:
    """Convert currencies using official market rates.
    
    Args:
        amount: Amount of currency to convert.
        from_curr: Source 3-letter currency code (e.g. USD).
        to_curr: Target 3-letter currency code (e.g. EUR).
    """
    # Deterministic calculation or call to external banking API
    rates = {"USD": 1.0, "EUR": 0.92, "GBP": 0.78}
    converted = (amount / rates.get(from_curr.upper(), 1.0)) * rates.get(to_curr.upper(), 1.0)
    return {
        "source_amount": amount,
        "from_currency": from_curr.upper(),
        "to_currency": to_curr.upper(),
        "converted_amount": round(converted, 2),
        "status": "success"
    }

if __name__ == "__main__":
    mcp.run(transport="sse")
```

---

## 2. Connecting to Agentic RAG

1. Navigate to **Settings → Connections** in the Agentic RAG application.
2. Select **Add Custom MCP Server**.
3. Enter your server's endpoint:
   - Name: `Partner Financial Service`
   - URL: `https://api.partner.example.com/sse` (or `http://host.docker.internal:8088/sse` in dev)
4. Click **Discover Tools**:
   - The platform sends an authenticated `tools/list` request.
   - `convert_currency` is discovered, parsed, and its JSON Schema is stored.
5. Set **Tool Permissions**:
   - Grant read/execute permission to specific workflows or chat assistants.
   - If the tool mutates state, mark `require_approval: true` to halt execution before sending.

---

## 3. How the Engine Dispatches Calls

1. When the agent or workflow phase invokes `convert_currency`, `mcp_client.py` opens a pinned HTTP connection.
2. The destination IP is validated against DNS-rebinding attacks via `app.security.egress.validate_mcp_destination`.
3. An audit record is spawned into `harness_audit` documenting:
   - Tool name
   - Connection ID
   - Request arguments
   - Execution status and response hash
4. The result returns directly into the agent's context window without running any partner code inside the engine.
