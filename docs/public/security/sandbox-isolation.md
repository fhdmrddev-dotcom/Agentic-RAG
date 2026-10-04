---
title: Sandbox isolation
slug: security/sandbox-isolation
section: security
audience: operator
status: written
release: shipped
covers: [I11, B14]
summary: >-
  Code Syrel runs goes into a Docker container per chat. The backend starts those containers
  through the host's Docker socket, which is why the sandbox suits single-tenant installs only.
reviewed: 2026-10-04
---

When code execution is switched on, Syrel runs the Python it writes in a Docker container instead of on the server itself. This page explains what that container separates, and what it does not.

## How the sandbox works

- Code execution is off unless the operator enables it (`SANDBOX_ENABLED`), and an operator can switch it off at any time with a kill switch.
- Each chat gets its own container. Variables and installed packages carry over between turns in that chat, and the container is closed after it has been idle for a while (30 minutes by default).
- The container runs a prebuilt image with common data libraries — pandas, matplotlib, python-docx, reportlab and others — so most work starts without installing anything. The operator chooses the image with `SANDBOX_IMAGE`.
- Files the code writes are collected into storage and offered as downloads. Word and PDF files are downloaded, not previewed inside Syrel.

## What it separates

- Code runs in a container, not in the Syrel server process, so it cannot read the server's memory or its environment variables.
- One chat's container is not shared with another chat.

## What it does not separate

> **Warning:** The Syrel backend starts sandbox containers through the host's Docker socket. Access to that socket is equivalent to root on the host. Run a Syrel deployment with code execution on **single-tenant hosts only** — servers that hold one customer's data.

Also be aware that:

- Syrel does not add its own network restrictions to the container. Code in the sandbox can reach the internet, for example to install a Python package it was asked to use.
- Syrel does not set its own CPU or memory limits on the container beyond Docker's defaults.

If those properties do not suit your environment, leave code execution switched off. Everything else in Syrel works without it.

## Related

- [Running code and making files](/docs/use/code-execution)
- [The code sandbox image](/docs/deploy/sandbox)
- [Kill switches and maintenance](/docs/administer/control-room/kill-switches)
