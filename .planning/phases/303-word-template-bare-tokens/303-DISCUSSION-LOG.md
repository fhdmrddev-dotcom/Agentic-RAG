# Phase 303: Word Template Bare Tokens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-06
**Phase:** 303-word-template-bare-tokens
**Areas discussed:** Repro & size, docxtpl fix shape, run_replace token match, integrity scan scope, golden runs
**Mode:** delegated end to end ("continue autonomously end to end of this phase"). No AskUserQuestion; Claude took the recommended option at each gate (memory: feedback_delegates_gsd_phase_end_to_end).

---

## Repro & size

| Option | Description | Selected |
|--------|-------------|----------|
| Repro through the real driver script first | `_RENDER_DRIVER_SRC` run as `python -u`, docxtpl 0.20.2 | ✓ |
| Repro in the Docker sandbox from this shell | refused: `docker` CLI and Docker SDK both denied | |
| `/gsd:quick` (G-3) | only if ≤ 1 file / ≤ 10 lines | |
| Phase, one plan | 3 defects, 2 files, ~60-100 lines | ✓ |

**Choice:** repro first (RED, 3 defects), then one plan. In-app run with run id → UAT row U-1.

## docxtpl fix shape

| Option | Description | Selected |
|--------|-------------|----------|
| Coerce only | dict subclass `__str__` → value | |
| Detect only | integrity fails on `'source_chunk_id':` | |
| Both | coerce for intent, detect as backstop | ✓ |

## run_replace token match

| Option | Description | Selected |
|--------|-------------|----------|
| Leave tight `{{key}}` only | spaced / `.value` keep blanking | |
| Match `{{ key }}`, `{{key}}`, `{{ key.value }}` in both copies | never blank a known key | ✓ |

## Integrity scan scope

| Option | Description | Selected |
|--------|-------------|----------|
| Body + top-level tables (today) | | |
| + nested tables + all header/footer variants | python-docx reachable surface | ✓ |
| Raw `word/*.xml` scan | reaches text boxes too; changes hit format | deferred |

## Golden runs

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic before/after via driver script, captured at base | byte-identical XML parts | ✓ |
| Live publish-gauntlet golden run | needs backend + provider | ✓ as UAT U-2 |

## Claude's Discretion

- Record-text failure wording; subclass name; test file names.

## Deferred Ideas

- Unknown run_replace tokens still blank silently.
- Text boxes / footnotes / SmartArt stay unscanned.
