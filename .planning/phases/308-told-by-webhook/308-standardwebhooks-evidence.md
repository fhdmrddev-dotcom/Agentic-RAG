# `standardwebhooks==1.1.0` — package legitimacy evidence (for 308-06 Task 3)

Gathered 2026-11-04 by the orchestrator (slopcheck unavailable — install blocked, per RESEARCH).

| Check | Result |
|---|---|
| PyPI project | `standardwebhooks`, releases `1.0.0` (2024-01-12), `1.0.1`, `1.1.0` (2026-07-21) |
| `requires_dist` | none — zero runtime dependencies |
| Author on PyPI | "Standard Webhooks Team" |
| Upstream repo | `github.com/standard-webhooks/standard-webhooks` — 1,790 stars, created 2023-08-27 |
| Upstream python package | `libraries/python/pyproject.toml` → `name = "standardwebhooks"`, author "Standard Webhooks Team", MIT |
| Upstream README import | `from standardwebhooks.webhooks import Webhook` |
| 1.1.0 wheel sha256 (prefix) | `9a88d48a1f198be6…` (`standardwebhooks-1.1.0-py3-none-any.whl`) |

**Verdict:** the PyPI name, author and package metadata match the spec's own organisation repository;
no typosquat signal, no runtime dependencies. Test-only use (D-54) — never in the runtime image.

**Approval:** taken under the operator's end-to-end delegation ("continue autonomously end to end",
2026-11-04), recorded as a guardrail decision in `STATE.md`. Re-open: the operator objects to the
dependency, or a later release adds runtime dependencies.
