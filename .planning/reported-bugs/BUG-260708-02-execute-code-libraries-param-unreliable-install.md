---
id: BUG-260708-02
title: execute_code `libraries` param does not reliably install before the code runs (warm session)
reported: 2026-07-08
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [sandbox, backend/tool-dispatcher, backend/sandbox-service]
folded_into: "176"
verified_closed_by: null
related_seeds: [SEED-043]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8d414574
  date: 2026-07-08
---

# BUG-260708-02: execute_code `libraries` param unreliable install

## What we observed

Thread `5a86a9fd`, same run. Two consecutive `execute_code` calls BOTH passed
`libraries: ["fpdf2"]`:

- Attempt [22]: ran in **68 ms** and raised `ModuleNotFoundError: No module named
  'fpdf'` — i.e. the declared library was NOT installed before the code executed.
- Attempt [23]: same `libraries: ["fpdf2"]`, ran in **6607 ms** and got PAST the
  import (fpdf2 was fetched from PyPI and installed) to a different, runtime error.

So the `libraries` declaration was honored on the second call but not the first,
against what appears to be the same warm (thread-cached) sandbox session.

## Why it matters

Major: a skill or the agent can correctly DECLARE a dependency and still hit
`ModuleNotFoundError`, producing a visible failure + wasted retry turns (and, with a
degrading model, contributing to the long turns that trigger BUG-260708-01). It
undermines the "just install it and keep going" contract SEED-043 half (b) is meant
to guarantee.

## Hypothesized cause

Hypothesis (unverified): the `libraries` install step is not applied on a cached/warm
`SandboxSession` (installs may only run on session creation, or the param is not
threaded into the warm-session code path in `sandbox_service` / the execute_code
handler). Needs a focused probe of how `libraries` flows from the tool args into
`SandboxSessionManager.get_or_create` and whether it re-runs on an existing session.

Confirmed adjacent fact (resolves SEED-043's open question): the sandbox CAN reach
PyPI — attempt [23] installed fpdf2 in 6.6 s, so egress works and the
`Dockerfile.sandbox:27` "network is sealed" comment is inaccurate for egress.

## Surface classification

`Agentic-RAG` — our sandbox/tool-dispatcher plumbing. Route through app phases.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** SEED-043 half (b) (hardened
  missing-package / declared-library install). Make a declared or ModuleNotFound-ed
  package deterministically install-and-retry across ALL providers and on warm
  sessions.
- **Plant as seed:** already covered by SEED-043 (half b + Finding 3 in its
  2026-07-08 assessment).
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- Author skills against PREINSTALLED libraries (reportlab, python-docx, python-pptx,
  openpyxl, matplotlib, …) so no runtime install is needed — this is exactly what
  migration `093` now teaches skill-creator.
- The agent already retries with an explicit `pip install`, which self-heals within
  the turn (as attempt [23] showed) — just noisy.

## Reference / evidence links

- DB thread `5a86a9fd`, tool_calls [22] (68 ms, ModuleNotFound) vs [23] (6607 ms,
  installed) on the same assistant message.
- SEED-043 `.planning/seeds/SEED-043-sandbox-package-management.md` (2026-07-08
  assessment, Findings 2 & 3).
- Breadcrumbs: `backend/app/services/sandbox_service.py` (`get_or_create`),
  `backend/app/services/tool_dispatcher.py` (`_handle_execute_code`, `libraries` arg).
