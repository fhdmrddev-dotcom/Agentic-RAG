---
phase: 248
slug: the-credential-boundary
document: threat-model
status: active
mandatory: true
author: gemini (builder)
reviewer: claude
date: 2026-09-14
---

# Phase 248 — Threat Model: The Credential Boundary

> ⭐ **Purpose**: Phase 248 delivers **CRED-01**, **CRED-02**, **CRED-03**, and **CRED-04**. It hardens the credential and execution boundaries of the platform: ensuring secrets cannot come to rest in org-readable plaintext columns, preventing misleading attribution in grant configuration, revoking unauthenticated execution of `SECURITY DEFINER` functions in PostgreSQL, and adding security advisor enforcement to deployment workflows.

<trust_boundaries>
[BOUNDARY 1: Client Input & Model Validation Boundary]
Untrusted User / API Input (Settings UI, REST API, curl)
  -> `OAuthAuthorizeRequest`, `OAuthConnectionConfig`, `McpConfig`
  -> Validation gate (`backend/app/models/connector.py`)
  -> Database column: `connector_connections.config` (Readable org-wide by `authenticated`)
  -> Database column: `connector_connections.secret_ciphertext` (Encrypted, restricted)

[BOUNDARY 2: Projection & Read-Path Boundary (SEED-239)]
Database Rows (`connector_connections.config`)
  -> `connector_service.list_connections`
  -> `_to_response` (`ConnectorConnectionResponse.model_validate`)
  -> Single-row failure must NOT take down multi-row list comprehension

[BOUNDARY 3: PostgREST & Database Role Boundary]
Public Internet / Anonymous User (`anon` key in frontend bundle)
  -> PostgREST `/rest/v1/rpc/<name>`
  -> PostgreSQL `SECURITY DEFINER` functions (`pg_proc`)
  -> Default `PUBLIC` execute grant (`=X/postgres`)
  -> Database tables & internal triggers (`skills`, `auth.users`, `folders`, `documents`)

[BOUNDARY 4: Deploy & Infrastructure Parity Boundary]
Cloud Supabase Environment & Database Migrations
  -> Supabase Management API (`/v1/projects/{ref}/advisors/security`)
  -> Promotion & deployment runbooks (`docs/DEPLOYMENT-WORKFLOW.md`)
</trust_boundaries>

---

## Threats & Mitigations

```yaml
- threat_id: TM-248-01
  category: Information Disclosure / Credential Leak to Organization Members
  component: backend/app/models/connector.py, frontend ConnectionFormPanel.tsx (CRED-01)
  disposition: planned
  threat: >
    An operator or user pastes an OAuth client secret or bearer token into `custom_client_id`
    (e.g., in Settings -> Connections -> Custom OAuth App Credentials). Because `custom_client_id`
    lands in `connector_connections.config`—a JSONB column readable by all authenticated org members—the
    secret is stored in plaintext and exposed org-wide, while `secret_ciphertext` is restricted.
    The primary real-world vector is an Entra client secret (which carries no brand prefix and follows
    a `<prefix>~<body>` shape), alongside well-known API key prefixes and over-length strings.
  mitigation: >
    Pydantic negative credential-smell validator on all three `custom_client_id` homes (`McpConfig`,
    `OAuthConnectionConfig`, `OAuthAuthorizeRequest`) that rejects strings containing secret patterns
    (specifically Entra's `<prefix>~<body>` pattern, well-known secret prefixes, and excessive length >128)
    with a 422 naming which field takes a secret. The frontend repeats this validation inline.
  verification: >
    Unit tests in `tests/unit/test_connector_credential_boundary.py` assert refusal of secret-shaped
    values across all three models while permitting valid client IDs (including RFC 7591 dynamic client
    IDs for MCP BYO). Pre-existing suites asserting `custom_client_id` construction across dependent
    modules (e.g. `McpAuthDoor.test.tsx`, `ConnectionFormPanel.sourceTools.test.tsx`, `models/connector.py`
    suites) are re-run to prove existing construction contracts remain green. Dual-role database tests
    execute actual queries under `SET ROLE authenticated` and `SET ROLE anon` to prove `authenticated`
    CAN read `config`, CANNOT read `secret_ciphertext`, and `anon` gets zero access.

- threat_id: TM-248-02
  category: Repudiation / False Attribution in Access Control
  component: frontend/src/components/settings/grantsVocabulary.ts, ActionRow.tsx (CRED-02)
  disposition: planned
  threat: >
    The grant settings surface displays an affordance ("Use the default") on tool grant rows that
    were populated by automated database migrations (e.g. migration 128) rather than human action.
    This creates false attribution and operator confusion about who configured access rights.
  mitigation: >
    Reword the reset affordance to a neutral forward action ("Follow the default instead") in
    `grantsVocabulary.ts`, avoiding any implication of an undo of a person's prior choice.
  verification: >
    Component tests in `ConnectionGrantsList.test.tsx` assert rendered text content on overridden rows
    ("Follow the default instead") and verify absence on default rows.

- threat_id: TM-248-03
  category: Elevation of Privilege / Unauthenticated Function Execution via PostgREST
  component: supabase/migrations/181_revoke_public_secdef_functions.sql (CRED-03)
  disposition: planned
  threat: >
    Thirteen `SECURITY DEFINER` functions in PostgreSQL carry default `PUBLIC` execute privileges
    (`=X/postgres`) or explicit `anon` grants. An unauthenticated attacker on the public internet
    using the published `anon` key can invoke these functions via PostgREST (`/rest/v1/rpc/<name>`).
  mitigation: >
    Migration 181 revokes execute permissions from `PUBLIC` and `anon` on all 13 functions.
    Trigger functions (6) have execute revoked from `PUBLIC`, `anon`, and `authenticated` (triggers
    fire without DML execute rights). RLS helper functions (4) and search RPCs (3) retain execute
    for `authenticated` and `service_role` only.
  verification: >
    Integration tests against local PostgreSQL execute as `anon`, verifying that
    `has_function_privilege('anon', fn, 'EXECUTE')` is FALSE for all 13 functions. Trigger firing
    is explicitly driven across all 6 trigger functions—specifically including `handle_new_user` on
    `auth.users` insert (signup path), `capture_skill_version`, and `stale_skill_embedding`—proving
    triggers fire successfully when DML is run without EXECUTE privilege on the trigger functions.

- threat_id: TM-248-04
  category: Security Regression / Unnoticed Privilege Expansion
  component: scripts/check-security-advisors.sh, docs/DEPLOYMENT-WORKFLOW.md (CRED-04)
  disposition: planned
  threat: >
    Future migrations or schema changes introduce new `SECURITY DEFINER` functions or disable RLS
    without developer awareness, silently re-introducing unauthenticated access vectors into production.
  mitigation: >
    Add `scripts/check-security-advisors.sh` querying the Supabase Management API for security advisor
    findings, hard-failing on any ERROR-level findings and reporting WARN-level findings. Integrate
    the check into `docs/DEPLOYMENT-WORKFLOW.md` pre-promotion checklist and add a reminder to
    `scripts/check-deploy-drift.sh`.
  verification: >
    Execute unit tests shelling out to the actual bash script with mock JSON payloads to verify
    exit 1 on ERROR findings and exit 0 on clean/WARN-only findings.

- threat_id: TM-248-05
  category: Denial of Service / Read-Path Validation Outage (SEED-239)
  component: backend/app/services/connector_service.py:567, :1116 (CRED-01)
  disposition: planned
  threat: >
    `connector_service.py:1116` executes `[_to_response(row) for row in rows]` inside a list comprehension,
    where `_to_response` calls `ConnectorConnectionResponse.model_validate(d)`. If any existing row
    in `connector_connections` in any install carries a legacy or bad `custom_client_id` (e.g. from
    prior paste or over-length value), re-validating stored configs during read will raise `ValidationError`,
    crashing `list_connections` with an HTTP 503 for the entire organization (SEED-239).
  mitigation: >
    In `connector_service.py:_to_response`, wrap model validation to handle stored rows that fail
    configuration validation: degrade the affected single row to `status="error"` with `error_message`
    stating that the configuration failed validation and requires rotation, falling back to a safe
    empty configuration so that one damaged row never breaks `list_connections` for the whole org.
    Write endpoints (`create_connection`, `update_connection`, `OAuthAuthorizeRequest`) continue to
    strictly raise 422 on bad inputs.
  verification: >
    Test in `tests/unit/test_connector_credential_boundary.py` seeds a connection row containing a
    secret-smelling `custom_client_id` and calls `list_connections`, asserting that the endpoint
    returns 200 with all valid connections intact and the single damaged row marked with `status="error"`.

- threat_id: TM-248-06
  category: Information Disclosure / Credential Echo in Remediation Reporting
  component: supabase/migrations/181_revoke_public_secdef_functions.sql, scripts (CRED-01, CRED-03)
  disposition: planned
  threat: >
    D-248-03 requires detecting and reporting existing bad rows with secret-shaped `custom_client_id`
    so operators can rotate them. If the detection query or log output echoes the raw failing string,
    the plaintext secret is copied into log aggregators, console streams, or git-tracked migration logs.
  mitigation: >
    The detection query and any accompanying reports identify affected rows solely by non-sensitive
    identifiers (`id`, `org_id`, `service_id`, `name`) and emit a notice that a secret was detected
    and rotation is required. The plaintext value is NEVER echoed, logged, or recorded.
  verification: >
    Test asserts that detection queries run against candidate rows emit only row identifiers and
    rotation notices, with zero secret substring leakage.
```
