---
id: SEED-043
status: dormant
planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: Any user report of "the agent failed because a package was missing" OR Skill Studio (v3.0) needing per-skill declared dependencies
scope: Medium
---

# SEED-043: Managed/Extensible Sandbox Package Set + Hardened Missing-Package Fallback

## Why This Matters

When the agent writes and runs Python in the sandbox (the `execute_code` tool), it
runs inside a fixed, pre-built Docker image (`backend/Dockerfile.sandbox`). That
image ships with a curated set of packages (matplotlib, pandas, numpy, python-pptx,
openpyxl, python-docx, pypdf, etc.). When the agent needs a package that ISN'T in
that image, two separate things can go wrong — and on 2026-05-31 they both bit at
once (quick task 260531-00x, where `reportlab` was missing and a file export failed):

1. **No easy way to ADD a package.** Today the only way to put a new library into
   the image is to hand-edit the Dockerfile and rebuild it. There is no operator
   knob — no allowlist, no settings field, no "add this package" button. For a vibe
   coder that means "edit a Dockerfile and run a docker build command" every time
   the agent needs something new. That's friction the operator shouldn't have to eat.

2. **The fallback can silently give up.** The agent is explicitly *instructed* that
   when it hits `ModuleNotFoundError` it should `pip install <pkg>` and retry — and to
   "NOT give up after the first import failure" (`backend/app/services/agent_loop.py:497-501`).
   But the operator's report ("the sandbox is missing reportlab, so the file export
   failed") shows a provider gave up *instead* of installing. That is the exact
   gpt-5.4 give-up behavior the Dockerfile comment was written to warn about
   (`backend/Dockerfile.sandbox:4-8`: "OpenAI gpt-5.4 gave up after the failure"). So
   the safety net exists in the prompt but isn't reliable across all providers in
   practice.

The fix has two halves: give the operator a real way to manage what's in the image,
AND make the runtime "just install it and keep going" path bulletproof so a missing
package is a brief delay, never a failed task.

## When to Surface

**Trigger:** Any user report of "the agent failed because a package was missing"
OR Skill Studio (v3.0) needing per-skill declared dependencies.

Present during /gsd:new-milestone when the milestone scope matches:
- Sandbox / code-execution reliability, `execute_code`, or document/file generation
  workflows (any milestone that hardens or extends the sandbox path)
- Skill Studio (v3.0): a skill that needs a specific library should be able to
  *declare* that dependency, which requires a managed-package mechanism to back it
  (see SEED-002, SEED-025)

## Scope Estimate

**Medium** — three pieces that can ship together or as a small wave:

- **(a) Operator-editable managed package set / allowlist** for the sandbox image —
  so adding a package is a config edit (and optional rebuild) instead of a Dockerfile
  hand-edit. This ties to SEED-024 (runtime-config / settings-architecture unification)
  and the SEED-040 pattern of an operator UI for infra knobs — it could share that same
  admin surface rather than inventing a new one.
- **(b) Harden the runtime pip-install fallback** so a missing package reliably
  triggers a retry-with-install across ALL providers (not just the well-behaved ones).
  Today this lives only as prose in the SYSTEM_PROMPT; making it dependable likely
  means a deterministic backend behavior (e.g. detect `ModuleNotFoundError`, install,
  retry) at the tool boundary rather than trusting each provider to obey the prompt.
  Keep any provider-specific handling at the service boundary, never on the shared path.
- **(c) Surface missing-package events via SEED-025 telemetry** (the `sandbox_executions`
  surface) so the gaps are visible and the managed package set in (a) can be tuned from
  real usage — "these 5 packages got pip-installed at runtime most often this month →
  promote them into the image."

## Breadcrumbs

- `backend/Dockerfile.sandbox:1-30` — the fixed pre-built image, its curated package
  list, and the comment (lines 4-8) documenting the gpt-5.4 give-up behavior this seed
  re-addresses
- `backend/app/services/agent_loop.py:497-501` — the SYSTEM_PROMPT instruction telling
  the agent to `pip install` on `ModuleNotFoundError` and NOT give up (the prose that
  half (b) must turn into reliable behavior)
- `backend/app/services/sandbox_service.py:42-48` — `SANDBOX_IMAGE` env lookup;
  when unset it falls back to `llm_sandbox`'s bare-Python image, which forces a
  `pip install` per chat (~10-15s warm-up) per CLAUDE.md
- Related seeds: SEED-025 (sandbox execution telemetry — the *tracking* half),
  SEED-024 (settings-architecture unification — config home for the allowlist),
  SEED-040 (model-registry self-service — the operator-UI-for-infra-knobs pattern to
  reuse), SEED-002 (Skill Studio milestone — per-skill declared dependencies)

## Notes

- **This seed is the *management* half; SEED-025 is the *tracking* half.** SEED-025 only
  records exec failures and retries as telemetry — it does NOT manage which packages are
  available. They pair: SEED-025 tells you which packages keep getting installed at
  runtime, and SEED-043 gives you the knob to promote them into the image.
- The bare-image fallback (no `SANDBOX_IMAGE` set) is the worst case — it forces a fresh
  `pip install` on every new chat (~10-15s warm-up) per CLAUDE.md's sandbox-setup notes.
  A managed package set keeps the curated image as the fast default while still letting
  the operator extend it.
- v3.0 Skill Studio (SEED-002) is the strongest forcing function: once skills can declare
  "I need `reportlab`," the platform needs a place to satisfy that declaration — which is
  exactly the managed-package mechanism in half (a).
- Cross-provider is first-class here: the give-up failure was provider-specific (gpt-5.4),
  so half (b)'s reliability work must be validated across all native providers, not just
  the one that already obeys the prompt.
