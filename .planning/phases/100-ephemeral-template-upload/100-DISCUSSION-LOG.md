# Phase 100: Ephemeral Template Upload - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 100-ephemeral-template-upload
**Areas discussed:** Upload UX & ephemeral visibility, TTL + sweep mechanics, Expiry semantics vs runs, Template typing & the AssetRef seam

---

## Upload UX & ephemeral visibility

*(Operator explicitly asked to align with the previously-designed UI — `sketch-findings-agentic-rag` skill loaded before this area.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Panel Files section button (Recommended) | Upload affordance in the workspace panel's Files section; keeps the 2-pill composer clean; separates from KB ingestion | ✓ |
| Composer attach (paperclip) | Conventional, but re-clutters the minimized composer and reads as "add to KB" | |
| Both panel + composer | Max discoverability, double the UI work | |

| Option | Description | Selected |
|--------|-------------|----------|
| Badge + expiry countdown (Recommended) | "Template" marker + muted mono "expires in 23h", amber near expiry, sketch-016 icons | ✓ |
| Separate Templates group | Distinct sub-group in the Files accordion | |
| Badge only, no countdown | Simplest, TTL learned from tooltip | |

| Option | Description | Selected |
|--------|-------------|----------|
| File just disappears (Recommended) | Panel reconciles to current state; chat untouched | ✓ |
| Expired tombstone state | Grayed "expired" row lingers | |

| Option | Description | Selected |
|--------|-------------|----------|
| No chat artifact (Recommended) | Upload is a panel action; nothing in conversation | ✓ |
| Quiet system chip in chat | One-line muted chip in the durable record | |

**User's choice:** All four recommendations accepted.

---

## TTL + sweep mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| 24 hours (Recommended) | Working-session length; app_settings tunable | ✓ |
| 48 hours | More forgiving, weaker ephemerality | |
| 7 days | Convenience over injection-surface minimization | |

| Option | Description | Selected |
|--------|-------------|----------|
| Read-path filter + janitor sweep (Recommended) | Expired invisible to every read instantly; sweep only reclaims | ✓ |
| Sweep-only | "Expires at" becomes "expires within sweep-interval of" | |

| Option | Description | Selected |
|--------|-------------|----------|
| In-process periodic task (Recommended) | asyncio lifespan task; deletes rows + Storage bytes; idempotent across 2 workers | ✓ |
| pg_cron job | DB-native but can't call Storage API — bytes orphan | |
| Startup sweep + lazy only | Bytes linger until restart | |

**User's choice:** All three recommendations accepted.

---

## Expiry semantics vs runs

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed from upload + run-pin (Recommended) | No silent refresh; kickoff pins expires_at past the run's wall-clock cap | ✓ |
| Refresh on every use | Regularly-used template never expires | |
| Strictly fixed, no pin | Long run straddling expiry fails mid-flight | |

| Option | Description | Selected |
|--------|-------------|----------|
| Clear tool error naming expiry (Recommended) | "template expired" — model relays honestly | ✓ |
| Standard not-found | Model may confabulate about a file the user knows exists | |

**G-4 UAT scenarios (multiSelect):** operator selected all 4 proposed rows (upload→visible→readable; never-in-search proof; expiry end-to-end; bad-file rejection) and asked for comprehensive judgment + whether no-template workflows were considered. Claude added 3 rows (run-straddles-expiry pin; cross-user isolation; no-template byte-identical regression) — accepted, total 7. The optionality invariant (D-11: templates optional everywhere, gated no-op when absent) was confirmed in response to the operator's question.

---

## Template typing & the AssetRef seam

| Option | Description | Selected |
|--------|-------------|----------|
| Strict allowlist + magic bytes (Recommended) | .docx/.pptx/.xlsx only; verify ZIP/OOXML container bytes | ✓ |
| Extension + MIME only | Renamed binary fails later, deep in Phase 101 | |
| Wider allowlist | .md/.txt too — broader than TMPL-01 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral upload only (Recommended) | AssetRef (library assets, no-TTL lifecycle) moves to Phase 101 | ✓ |
| Wire AssetRef storage here too | Bigger phase; definition-scoped storage + immutability + authoring questions | |

| Option | Description | Selected |
|--------|-------------|----------|
| By kind, in-thread (Recommended) | 101's fill step finds live kind='template_input' files; zero kickoff-API changes | ✓ |
| Explicit reference at kickoff | Adds kickoff surface 103 would redesign | |

**User's choice:** All three recommendations accepted.

---

## Claude's Discretion

- `kind` column design (text + CHECK vs enum; default for existing rows)
- `app_settings` key naming, sweep interval, run-pin margin
- Multipart implementation details (reuse `write_file` vs thin sibling)
- Countdown render cadence (no per-second timers)
- SSE event reuse (`workspace_file_written`) vs sibling event
- Duplicate-filename re-upload handling (lean: new version, same expiry rules)

## Deferred Ideas

- Definition-level `assets`/`AssetRef` behavior → Phase 101
- Launch-form file input / explicit kickoff reference → Phase 103
- Settings-UI exposure of the TTL → future Settings polish
- Composer attach affordance → revisit at Phase 104 UAT if panel button proves undiscoverable
- Template preview in panel → SEED-037 / Phase 108 `file_preview`
