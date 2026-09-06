# Phase 236: The Corpus Under Attack - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-06
**Phase:** 236-the-corpus-under-attack
**Areas discussed:** Attack vectors & corpus scope, SC#2 mutation drive mechanism, SC#10 8-provider roster execution, Live UAT payload placement

---

## Attack Vectors & Corpus Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Test both indirect injection via retrieved docs (manipulating tools/exfiltration) and delimiter escapes across all 8 defense modules | ✓ |
| 2 | Focus strictly on indirect document injection triggering unauthorized tool actions (TRUST-03 fence) | |
| 3 | Broad corpus covering prompt extraction, tool hijacking, markdown exfiltration, and persona subversion | |

**User's choice:** Option 1: Test both indirect injection via retrieved docs (manipulating tools/exfiltration) and delimiter escapes across all 8 defense modules.
**Notes:** Comprehensive coverage across all 8 defense modules identified during baseline measurements.

---

## SC#2 Mutation Verification Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | Environment variable / test flag (e.g. `AGENTIC_DISABLE_DEFENSE=<name>`) or fixture that disables the specific guard without modifying source files | ✓ |
| Option B | Source-level AST mutation or git patch drive applied by Claude during the review phase | |

**User's choice:** Option A.
**Notes:** User specifically asked what this means from a user perspective, and selected Option A to keep working tree and source files completely clean while enabling Claude to independently drive mutation testing.

---

## SC#10 8-Provider Native Roster Execution

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Mocked/offline unit tests for all 8 providers in CI + live execution on active configured providers with explicit ⛔-with-reason for unconfigured ones | ✓ |
| 2 | Require live API keys and real calls for all 8 providers during the phase evaluation | |

**User's choice:** Option 1.
**Notes:** Dynamic roster derived from `MODEL_CAPABILITIES` without hardcoding; unconfigured providers produce explicit skip notices rather than being omitted.

---

## Live UAT Ingestion Payload

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | A markdown/text document in Google Drive watched folder containing indirect injection attempting to trigger a write tool (e.g. email/slack) | ✓ |
| 2 | A synthetic document uploaded directly via the Library upload door with prompt exfiltration instructions | |

**User's choice:** Option 1.
**Notes:** Validates the complete pipeline (watched folder sync -> retrieval -> tool gating).
