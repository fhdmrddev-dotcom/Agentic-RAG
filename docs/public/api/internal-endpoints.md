---
title: Internal and legacy endpoints
slug: api/internal-endpoints
section: api
audience: developer
status: written
release: shipped
covers: [H16, H17, H25, H40, router:admin, router:setup_api, router:api_docs]
summary: >-
  Some endpoints exist but are not a contract: a few are left out of the public reference, and a
  few are listed but marked "UI-internal: may change".
reviewed: 2026-10-04
---

The public API reference lists what you can build on. A small number of endpoints exist on every deployment but are not part of that contract. This page names them, so nothing is hidden by accident.

## Listed, but marked "UI-internal: may change"

These endpoints are in the public reference with the badge **UI-internal: may change**. They serve a specific screen in the Syrel app, and their shape can change with that screen.

| Endpoint | Why it is internal |
|---|---|
| `/knowledge-health/*` | The legacy library-health endpoints. The page that used them was retired, but the app's knowledge client still calls them, so they stay — as legacy, not as a contract. |
| `/workflows/grounding-bundle` | Gathers what the workflow builder needs to draft a workflow. |
| `/workflows/validate` | The builder's live structure check while you draw a workflow. |
| `/threads/{thread_id}/snapshot` | Lets the app restore a chat's state when it reconnects. |
| `/threads/expert-scope-preview` | The preview shown before inviting an Expert. |
| `/library/index-summary` | Feeds the Library's Indexing tab. |

## Not in the public reference

| Endpoints | Why they are left out |
|---|---|
| `/admin/*` | The operator API. It answers 404 to anyone who is not an operator. See [Operator API](/docs/api/reference/operator). |
| `/setup/*` and `/public-config` | The first-run setup wizard, protected by a one-time setup token and refused once setup is finished, plus the public Supabase settings the browser needs to sign in. They belong to deployment, not to the API. See [The setup wizard](/docs/deploy/setup-wizard). |
| `/connectors/oauth/callback`, `/connectors/mcp/oauth/callback` | The browser's return leg after signing in to a connected service. Not something to call yourself. |
| `/evals/*` | The operators' evaluation-engine sweep and health checks. |
| `/api/sources/*` | An alias of `/sources/*` under a second prefix. Use `/sources/*`. |
| `/__test__/*` | Test fixtures. Mounted only when a test environment variable is set, and the server refuses to start with them in production. Never present on a real deployment. |
| `/docs`, `/redoc`, `/openapi.json` | Each deployment's live API explorer and schema. Open locally; in production they answer only to a signed-in request. |

## Related

- [Organisations and row-level security](/docs/api/concepts/orgs-and-rls)
- [Errors](/docs/api/concepts/errors)
