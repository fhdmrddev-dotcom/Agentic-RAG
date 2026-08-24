-- 126_mcp_connector_connections.sql
-- Phase 206 (CONN-02 / CONN-03) — MCP Connector Client (provider-shaped connection row)
--
-- Extends public.connector_connections to support remote Model Context Protocol (MCP) servers:
--   - mcp_server_url: Endpoint for the remote MCP server (e.g. https://mcp.atlassian.com/v1/mcp)
--   - tool_grants: JSONB mapping of tool names to boolean permission grants ({ "jira_create_issue": true })
--   - discovered_tools: JSONB array caching discovered tool schemas from tools/list
--   - capability: Made NULLABLE so provider-shaped MCP connections are not restricted to the legacy 3-action set

-- ================================================================================================
-- §1 — Extend connector_connections table
-- ================================================================================================
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS mcp_server_url text,
    ADD COLUMN IF NOT EXISTS tool_grants jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS discovered_tools jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drop NOT NULL on capability to allow provider-shaped MCP connections
ALTER TABLE public.connector_connections
    ALTER COLUMN capability DROP NOT NULL;

COMMENT ON COLUMN public.connector_connections.mcp_server_url IS
  'Phase 206 (D-206-01): The HTTPS endpoint of the remote MCP server. Required for MCP provider connections.';

COMMENT ON COLUMN public.connector_connections.tool_grants IS
  'Phase 206 (F-1 / D-206-06): JSONB mapping of tool names to boolean permission grants. Key presence and true means granted; absent or false means denied.';

COMMENT ON COLUMN public.connector_connections.discovered_tools IS
  'Phase 206 (D-206-05): JSONB array of tool schemas discovered from the remote MCP server via tools/list.';

-- ================================================================================================
-- §2 — A row must be ONE of the two shapes, and the database must say so too
-- ================================================================================================
-- ⚠ DROPPING NOT NULL ON `capability` OPENS A SHAPE THE TABLE CANNOT OTHERWISE REFUSE, and it
-- was measured rather than reasoned about (2026-08-25 pre-flight): with NOT NULL gone, a
-- NULL-capability INSERT is ACCEPTED, because `capability = ANY(ARRAY[...])` evaluates to NULL
-- and a CHECK passes unless it is FALSE. So §1 alone permits a row that is NEITHER a capability
-- connection NOR an MCP one — a connection that resolves to nothing, listed in every picker.
--
-- The model (`ConnectorConnectionCreate`) enforces exactly this, and that is precisely why the
-- database must too: the model guards the API, and a service-role writer walks around the API.
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_shape_is_one_of_two;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_shape_is_one_of_two
    CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL);

-- HTTPS only. The MCP credential rides an Authorization header on EVERY call, so a cleartext
-- endpoint puts a live token on the wire at a host the SSRF predicate happily permits *because*
-- it is public. `validate_mcp_destination` enforces this at call time and the model enforces it
-- at save time; this is the third door, and the only one a direct SQL write cannot pass.
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_mcp_url_is_https;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_mcp_url_is_https
    CHECK (mcp_server_url IS NULL OR mcp_server_url LIKE 'https://%');
