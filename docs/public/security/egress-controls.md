---
title: What Syrel can reach
slug: security/egress-controls
section: security
audience: admin
status: written
release: shipped
covers: [D26, D22, D23]
summary: >-
  Syrel reaches outside services only through connections you create. MCP destinations are checked
  before every call, each tool is allowed, held for approval or denied, and real sending is off by
  default.
reviewed: 2026-10-04
---

Syrel talks to the outside world in a small number of ways, and each one has its own control. This page lists them.

## The ways out

| Route | What controls it |
|---|---|
| Model providers | The providers and keys a platform operator configures. |
| Web search | Off unless an operator switches it on and adds a search key. |
| Connections to services (Google Workspace, Slack, Jira, email, MCP servers) | Created by org admins; every tool on a connection has its own grant. |
| Workflow steps that act outside ("Reach outside") | Always stop for approval; real sending is off until an operator switches it on. |
| The code sandbox | Off unless an operator switches it on. See [Sandbox isolation](/docs/security/sandbox-isolation). |

## MCP destinations are checked

Before Syrel calls an MCP server, it checks the destination:

- The address must use **HTTPS**. A plain-HTTP MCP address is refused, because the connection's credential travels with every call.
- Every address the server's name resolves to must be a **public** address. Loopback, private network ranges, cloud metadata addresses and similar internal ranges are refused, so a connection cannot be pointed at your own internal network.
- The checked address is the one actually called, so the name cannot be switched to a different address between the check and the call.

## Every tool has a grant

Each tool on a connection is set to **Allow**, **Ask** or **Deny**, under a default for the whole connection. Org admins set them.

- **Allow** — Syrel may call the tool.
- **Ask** — the run pauses and a person approves or declines the call. The approval names the service as well as the tool.
- **Deny** — the call is refused, with a message naming the grant that would allow it.

When a chat's context includes content from a connected source, Syrel holds any tool that writes to an outside service for approval, even if that tool is set to Allow. See [Prompt-injection defences](/docs/security/prompt-injection).

## Real sending is off by default

Workflow steps that send an email, post a message or create a ticket stop for a person's approval before they act. On top of that, an operator-level switch — live sending — decides whether anything is actually sent. It is **off** by default: until an operator turns it on, those steps record what they would have sent and show "Not sent — recorded".

## Every call leaves a record

Each call through a connection writes an audit receipt naming the connection, the destination host, the tool and the result. Each chat message also records which connections were active when it was sent. See [Audit trails](/docs/security/audit-trails).

## What does not exist

Syrel has no generic "call any URL" step, and receives no webhooks — the only inbound callbacks are the OAuth sign-in redirects. Inbound webhooks and API keys are Not available today. [See what's planned](/docs/api/roadmap-open-platform).
