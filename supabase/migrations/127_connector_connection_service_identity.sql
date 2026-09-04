-- 127_connector_connection_service_identity.sql
-- Phase 211 (CONN-05 / CONN-08) — the connection is a SERVICE, not a verb.
--
-- Decisions: D-211-01 (identity is FREE TEXT on the row), D-211-02 (the curated set is a
--            PRESENTATION lookup, never a constraint), D-211-03 (a total, one-time backfill
--            that leaves `capability` untouched), D-211-04 + D-211-11 (what replaces
--            migration 126's dropped shape CHECK).
--
-- WHY: `connector_connections` has organised itself around a VERB since migration 116 —
-- `capability IN ('send_email','create_ticket','post_message')`. A connection to a service
-- that this platform reaches by neither a first-party adapter nor a remote MCP server
-- (an OAuth-authenticated service, Phase 215) has no row shape at all today: migration 126's
-- `connector_connections_shape_is_one_of_two` refuses it outright. This migration gives every
-- connection a SERVICE identity, and lets a row exist that names a service without yet
-- naming a way to reach it.
--
-- ── Apply discipline (CLAUDE.md, D-21) ───────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER apply it with
--   the Supabase CLI's push or reset subcommands — both destroy the operator's dev data, and
--   both are forbidden by CLAUDE.md. (The two command strings are deliberately not spelled out
--   verbatim anywhere in this file, so a grep for them over the migration returns nothing and
--   cannot be satisfied by a warning that merely quotes them.) Then run
--   `bash scripts/regenerate-full-schema.sh` with NO `--reset`, and commit this migration
--   together with the regenerated `supabase/full-schema.sql`. Never hand-edit that file.
--   Filename is DIGITS-ONLY (`127_…`) — a letter suffix like `127b` is silently skipped by
--   the Supabase CLI, which would ship a column that does not exist.
--
--   The whole file is RE-PASTE-SAFE: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
--   before every `ADD CONSTRAINT`, `CREATE INDEX IF NOT EXISTS`, and both backfills carry a
--   predicate that makes a second run a no-op on rows that have moved on since.
--
-- ── Cloud parity ─────────────────────────────────────────────────────────────────────────
--   This file IS seed-bearing in the narrow sense that it BACKFILLS values (§2 and §2b), but
--   it introduces no env var, no bundled service and no sandbox image tag, so it owes no
--   `deploy/onebox.env.example` / `docker-compose.prod.yml` / `SANDBOX_IMAGE` change. It
--   joins the pending cloud set and is applied to cloud in order at the next operator-gated
--   production push.
--
-- ── ⚠ ORDER IS LOAD-BEARING ──────────────────────────────────────────────────────────────
--   §1 adds the column · §2 backfills identity onto every existing row · §2b backfills the
--   action list onto the legacy capability rows · §3 only THEN adds the constraint that
--   requires the identity. Adding §3's constraint before §2 completes fails on every
--   pre-existing row.

-- ================================================================================================
-- §1 — the column
-- ================================================================================================
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS service_id text;

COMMENT ON COLUMN public.connector_connections.service_id IS
  'Phase 211 (D-211-01): the SERVICE this connection reaches — ''slack'', ''jira'', ''smtp'', ''notion'', anything. FREE TEXT. It is NOT a foreign key, it is NEVER CHECK-constrained against a closed list, and no migration may later close it: a closed set here is migration 116''s `capability` mistake moved to a nicer axis, where every unknown service again becomes invisible or has to squeeze into a known name (SEED-207). The curated "Popular" set (Phase 212) is a PRESENTATION LOOKUP keyed by this value (D-211-02) — a miss degrades to a generic mark, NEVER to a refusal and NEVER to a hidden row, which is what makes adding a service cost a presentation row instead of a migration. The only constraint this column carries is the one in §3: present and non-blank.';

-- ================================================================================================
-- §2 — the identity backfill (D-211-03): total, ordered, one statement
-- ================================================================================================
-- ⚠ `capability` IS NOT TOUCHED, IN ANY ARM. CONN-05 is "the three shipped adapters keep
-- working, unchanged"; this migration only ADDS identity beside the verb. Nothing in this file
-- reshapes that column or assigns to it — no ALTER of it, no UPDATE writing it — and the
-- absence is greppable precisely because the two forbidden statement forms are NOT quoted
-- here either (a comment that quotes the thing it forbids defeats the grep that checks it).
--
-- Arm 1 — from `capability`. All three arms are written even though the local database has no
-- `send_email` row today: cloud may differ, and a backfill that covers only what one
-- environment happens to hold is a backfill that fails §3 somewhere else.
--
-- Arm 2 — from the HOST of `mcp_server_url`, extracted structurally and lowercased.
-- ⚠ THIS IS A ONE-TIME BACKFILL OF ROWS THAT PREDATE THE COLUMN. IT IS NOT THE IDENTITY
-- MODEL. D-211-01 explicitly REJECTED deriving identity from a URL as a design, because two
-- connections can reach the same service (a prod and a sandbox Jira) and a generic SMTP host
-- names no service at all. The value is EDITABLE afterwards and nothing downstream ever
-- re-derives it — this statement is the only place in the codebase that reads a host as a name.
--
-- Arm 3 — the literal 'unknown', so §3's constraint is addable without failing on a row whose
-- shape neither arm covers. That is HONESTY ABOUT A ROW WE CANNOT NAME, not a category: no
-- lookup, no filter and no picker may ever treat 'unknown' as a service. It is what a person
-- edits first.
UPDATE public.connector_connections
   SET service_id = COALESCE(
         CASE capability
             WHEN 'send_email'   THEN 'smtp'
             WHEN 'create_ticket' THEN 'jira'
             WHEN 'post_message'  THEN 'slack'
         END,
         NULLIF(
             lower(regexp_replace(COALESCE(mcp_server_url, ''), '^https://([^/]+).*$', '\1')),
             ''
         ),
         'unknown'
       )
 WHERE service_id IS NULL OR btrim(service_id) = '';

-- ================================================================================================
-- §2b — ⭐ THE ACTION-LIST BACKFILL. THIS SECTION EXISTS BECAUSE OF A MEASURED CLOSED LOOP.
-- ================================================================================================
-- ⚠ DO NOT DROP THIS SECTION, AND DO NOT "MOVE IT INTO THE APPLICATION". Both were considered
-- and both are the same defect. `connector_service.create_connection` writes descriptors for
-- NEW rows only, and the capability arm of `discover_connection_tools` is reachable ONLY
-- through `POST /connections/{id}/discover`, whose only caller is the tool picker in the
-- browser. Without this backfill the two shipped legacy rows carry `discovered_tools: []` on
-- the day the phase ships, and **SC#2 — *a legacy row presents as a SERVICE with a named
-- action* — is FALSE for every row that exists today.** That is this project's
-- built-but-unreachable signature (Phase 118, Phase 200 SC#3).
--
-- MEASURED on the local database 2026-08-26, before this migration was written:
--
--     'Slack-rag-test'        capability='post_message'     jsonb_array_length(discovered_tools)=0
--     'Jira - KAN'            capability='create_ticket'    jsonb_array_length(discovered_tools)=0
--     'DeepWiki (206.1 UAT)'  capability=NULL               jsonb_array_length(discovered_tools)=3
--
-- The MCP row already has its three; the two capability rows have nothing, and no user action
-- available in the shipped product would give them any.
--
-- ⚠ EACH LITERAL BELOW IS GENERATED, NEVER HAND-TYPED. It is the exact output of
--
--     ./venv/Scripts/python.exe -c "import json, app.services.connectors.descriptors as d; \
--         print(json.dumps(d.static_descriptors_for_capability('<cap>')))"
--
-- ⚠ **THE DUPLICATION IS REAL AND IT IS STATED RATHER THAN HIDDEN.** After this section the
-- descriptor JSON is spelled in TWO places: `backend/app/services/connectors/descriptors.py`
-- and this file. What holds them in agreement is **not care** — it is
-- `backend/tests/test_migration_127.py::test_the_sql_backfill_matches_the_python_descriptor`,
-- a cross-language SOURCE fence in the exact discipline of `ExternalActionSection.tsx`'s
-- `?raw` fence over `harness.py`: it reads this `.sql` file as text, extracts the three
-- dollar-quoted literals, and compares each to `static_descriptors_for_capability(cap)`.
-- It needs no database, so it can never SKIP.
--
-- ⚠ **THE STALENESS WINDOW, STATED SO IT IS NOT DISCOVERED.** A row's `discovered_tools` is a
-- COPY taken at backfill time or at create time. If an adapter's `INPUT_SCHEMA` changes later,
-- an existing row keeps the older copy until that row is refreshed — which is exactly what the
-- capability arm of `discover_connection_tools` and the now-reachable Discover control exist to
-- make possible in one click. The fence above catches a mismatch between this migration and the
-- code; it does not, and cannot, catch a row that was written before a schema change.
--
-- Each statement is guarded by the emptiness predicate so a re-run of this idempotent migration
-- cannot clobber a row that has since been refreshed. `capability` is still not touched; only
-- `discovered_tools` is written, and `tool_grants` is deliberately left alone — a descriptor
-- ADVERTISES an action, it does not GRANT one, and the executor's gate denies on a missing
-- grant key by design.
UPDATE public.connector_connections
   SET discovered_tools = $descriptor$[{"name": "post_message", "title": "Post message", "description": "Post one plain-text message to the channel configured on this connection.", "inputSchema": {"type": "object", "additionalProperties": false, "required": ["text"], "properties": {"text": {"type": "string", "description": "The message body as plain text. The channel is a property of the connection, not of the step."}}}}]$descriptor$::jsonb
 WHERE capability = 'post_message'
   AND (discovered_tools IS NULL OR discovered_tools = '[]'::jsonb);

UPDATE public.connector_connections
   SET discovered_tools = $descriptor$[{"name": "create_ticket", "title": "Create issue", "description": "Create one issue in this connection's configured Jira project, with a summary and a plain-text description.", "inputSchema": {"type": "object", "additionalProperties": false, "required": ["summary", "description"], "properties": {"summary": {"type": "string", "description": "The issue summary — Jira's required one-line title."}, "description": {"type": "string", "description": "The issue description as PLAIN TEXT. It is converted to an Atlassian Document Format document here; a document object is refused."}}}}]$descriptor$::jsonb
 WHERE capability = 'create_ticket'
   AND (discovered_tools IS NULL OR discovered_tools = '[]'::jsonb);

UPDATE public.connector_connections
   SET discovered_tools = $descriptor$[{"name": "send_email", "title": "Send email", "description": "Send one plain-text email to exactly one recipient through this connection's configured mail server.", "inputSchema": {"type": "object", "additionalProperties": false, "required": ["to", "subject", "body"], "properties": {"to": {"type": "string", "description": "A single recipient address, local@domain. Exactly one."}, "subject": {"type": "string", "description": "The subject line. Plain text; a line break is refused."}, "body": {"type": "string", "description": "The plain-text message body."}}}}]$descriptor$::jsonb
 WHERE capability = 'send_email'
   AND (discovered_tools IS NULL OR discovered_tools = '[]'::jsonb);

-- ================================================================================================
-- §3 — the replacement guarantee (D-211-04 + D-211-11)
-- ================================================================================================
-- ⚠ **RELAXING A CHECK REMOVES A DATABASE-LEVEL GUARANTEE, SO SAY WHAT REPLACES IT.** This is
-- migration 126 §2's own discipline, applied to migration 126 §2's own constraint.
--
-- WHAT IS DROPPED: `connector_connections_shape_is_one_of_two`
-- (`CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`). It refuses exactly the row
-- CONN-08 needs: a service this platform reaches by neither a first-party adapter nor a remote
-- MCP server — an OAuth-authenticated service, which has neither until Phase 215.
--
-- ⚠ **WHAT IS NO LONGER REFUSED, STATED PLAINLY RATHER THAN LEFT TO BE DISCOVERED:** an
-- IDENTIFIED row with NO REACHABLE PATH — no adapter, no server URL, no credential — is now
-- STORABLE. That is a deliberate loosening of 126's *"resolves to something"*. It is ACCEPTED
-- (threat T-211-08) rather than mitigated, because the alternative considered — an `auth_kind`
-- column with a closed member set — re-introduces a closed set on a NEW axis, which is exactly
-- the shape D-211-01 rejected, and commits Phase 215's OAuth vocabulary a milestone early.
-- SEED-146 names committing the connection shape twice as the expensive mistake here.
-- What such a row CANNOT do is act: nothing binds it to a step, `/check` refuses it by name and
-- `/discover` refuses it by name. It is a row that says *"this org uses Notion"* and nothing more.
--
-- WHAT REPLACES IT — two INDEPENDENT constraints, so a failure names which property broke:
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_shape_is_one_of_two;

-- (1) Every connection NAMES A SERVICE, and the name is not whitespace. This is the guarantee
-- the picker, the catalog and every Phase 212/214/216 read rest on. `btrim` rather than `<> ''`
-- because '   ' is a name nobody typed and a row nobody can find.
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_has_a_service_identity;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_has_a_service_identity
    CHECK (service_id IS NOT NULL AND length(btrim(service_id)) > 0);

-- (2) ⭐ A GUARANTEE THIS TABLE HAS NEVER HAD, AND THE REASON IS MEASURED, NOT REASONED ABOUT.
-- `phase_types.py` branches on `mcp_tool_name` FIRST when it executes an external action, so a
-- row carrying BOTH a `capability` and an `mcp_server_url` silently takes the remote-server path
-- and **its capability goes inert** — the connection does something other than what its own
-- verb says. Nothing stopped an `UPDATE` from setting both: verified against the live table
-- 2026-08-26, where an INSERT carrying `capability='post_message'` AND
-- `mcp_server_url='https://mcp.example.com/v1/mcp'` was **ACCEPTED**, inside a transaction that
-- rolled back. The model owes a matching arm (`_validate_connection_shape`), or the refusal is a
-- 500 where a 422 belongs — but the model guards the API and a service-role writer walks around
-- the API, which is why this constraint is the one that actually holds.
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_shape_is_not_ambiguous;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_shape_is_not_ambiguous
    CHECK (NOT (capability IS NOT NULL AND mcp_server_url IS NOT NULL));

-- ================================================================================================
-- §4 — the column-level SELECT grant. Without this the whole page is 503.
-- ================================================================================================
-- ⚠ MIGRATION 118 RE-GRANTED `SELECT` ON THIS TABLE **COLUMN BY COLUMN** TO `authenticated` so
-- that `secret_ciphertext` could be excluded by omission. **A NEW COLUMN IS THEREFORE UNREADABLE
-- BY DEFAULT**, and the read that breaks is not this feature's — it is EVERY read of this table.
-- `connector_service` projects `_SELECTABLE_COLUMNS` (= the response model's keys, never
-- `SELECT *`), so the moment `ConnectorConnectionResponse` gains `service_id` the projection
-- names a column `authenticated` has no grant on and PostgREST answers
-- `42501 permission denied for table connector_connections`. **THE FAILURE IS TOTAL AND IT LOOKS
-- LIKE AN OUTAGE** — "Could not load connections" on a pre-existing Slack row that has nothing to
-- do with this phase. Measured exactly that way on 2026-08-25, one migration ago.
--
-- A column added to `connector_connections` AND to `ConnectorConnectionResponse` owes its grant
-- HERE, in the same migration.
--
-- One column per line, deliberately — 118's convention, kept — so the omission of
-- `secret_ciphertext` stays VISIBLE in a diff rather than inferred from a comma-separated blob.
GRANT SELECT (
    service_id
) ON public.connector_connections TO authenticated;

-- ================================================================================================
-- §5 — the service-scoped index
-- ================================================================================================
-- The read pattern this phase moves toward: every connection for an org, grouped/filtered by the
-- SERVICE rather than by the verb.
CREATE INDEX IF NOT EXISTS idx_connector_connections_org_service
  ON public.connector_connections USING btree (org_id, service_id);

-- ⚠ MIGRATION 116'S `(org_id, capability)` INDEX IS DELIBERATELY **NOT** DROPPED HERE. The
-- `GET /connectors/connections?capability=…` query parameter is KEPT: removing a public query
-- parameter is an API break for no gain, and Phase 211 only stops the picker CALLING it. The
-- capability index becomes droppable once the read pattern has actually changed rather than
-- merely been offered an alternative — **Phase 212 owns that call**, and owes a measurement of
-- the live read pattern before making it.

-- ⚠ RLS: migration 116's four policies are ROW-level and need no change for a new column.
-- Nothing here adds, alters or drops a policy — the column-level GRANT in §4 is the only
-- privilege change, and it is additive.
