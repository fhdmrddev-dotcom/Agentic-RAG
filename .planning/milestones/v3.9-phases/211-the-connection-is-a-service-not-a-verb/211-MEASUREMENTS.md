---
type: measurement-pack
phase: 211
phase_name: "The Connection Is a Service, Not a Verb"
builder: claude
reviewer: gemini
captured_by: gemini
captured_at: 2026-08-26
tree_state: UNTOUCHED — captured before any Phase 211 code work began
---

# Phase 211 — measurement pack

**What this is.** `AGENTS.md §3.1` and `§3` make the reviewer supply CLAUDE.md's three mandatory
discuss-phase cross-checks — reported bugs, the seeds sweep, and the G-5 hot-file scan — as
**measurements, on the bus, before `discuss-phase` opens**. For critical phases (AGENTS.md §3.1),
Claude builds and Gemini reviews.

⚠ **There are no recommendations in this file, deliberately.** Every line below is a fact with the
command that produced it. The builder holds `discuss-phase` and decides design direction.

---

## 1 · Gate baselines

| Gate | Command | Baseline |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`) | **34 errors** |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (from repo root) | **OK, 114/114 pinned, total 5793, 0 failed** |
| Backend unit suite | `python -m pytest tests/unit -q` (from `backend/`, venv active) | **68 failed / 2680 passed** (rot set 68) |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **83,431 chars · 55.6% of limit · OK** |

⚠ **`tsc --noEmit` WITHOUT `-p tsconfig.app.json` checks ZERO files.** Use the flag.

⚠ **34 is a BASELINE, not a target.** It matches the figure recorded at Phase 209 and Phase 210 open.

⚠ **Backend unit rot set is 68** (`retrieval_service` 15, `reembed_kickoff` 4, `sql_service` 12, `sandbox_service` 3, `streaming_reliability` 1, plus unattributed growth).

---

## 2 · G-5 hot-file scan — RE-DERIVED FROM GIT, not read from the ledger

Recipe used (CLAUDE.md), with six-digit dated quick-task buckets subtracted:

```bash
git log --oneline -- <file> | wc -l                                     # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' \
  | grep -vE '^[0-9]{6}$' | sort -u | wc -l                             # phases
wc -l <file>                                                            # lines
```

| File | commits / phases / lines | G-5 | Has a ledger ROW? |
|---|---|---|---|
| `backend/app/services/harness/phase_types.py` | 45 / 20 / 2621 | **FIRES** | yes (extraction taken 2026-08-19, 200-03) |
| `backend/app/services/harness/grounding.py` | 19 / 6 / 1311 | **FIRES** | yes (honoured by construction, 193.1) |
| `backend/app/models/connector.py` | 4 / 2 / 346 | no | no |
| `backend/app/services/mcp_client.py` | 2 / 2 / 367 | no | no |

---

## 3 · Reported bugs whose `affected_areas` touch this phase

| Bug | Severity | Requirement | Status / Target | Areas |
|---|---|---|---|---|
| `BUG-260826-01` | ⛔ **blocking** | STEP-02 | open (folded: 214) | backend/connectors · backend/harness · frontend/workflows |
| `BUG-260826-02` | major | STEP-03 | open (folded: 214) | backend/connectors · publish-gauntlet |
| `BUG-260826-05` | major | STEP-05 | open (folded: 214) | backend/connectors · backend/harness · frontend/workflows |
| `BUG-260810-01` | major | CAT-05 | open (folded: 212) | frontend/settings · frontend/connections |

---

## 4 · Seeds register sweep — `status: planted`, trigger touches this phase

| Seed | Title / Context | Status |
|---|---|---|
| **`SEED-207`** | *The three verbs become one shape among many, not the organising axis* — ⭐ **flagged as PREREQUISITE for Phase 211** | planted |
| **`SEED-146`** | *Two-way connectors: write / push / invoke* — connector connection shape | planted |
| **`SEED-142`** | *Two-way connectors: read / pull / auto-ingest* | planted |
| **`SEED-144`** | *Connectors: configuration schema & discovery* | planted |
| **`SEED-145`** | *Connectors: secret storage & credential lifecycle* | planted |
| **`SEED-177`** | *OAuth token refresh lifecycle* | planted |

---

## 5 · Critical phase classification (AGENTS.md §3.1)

Phase 211 meets critical test #4:
- Introduces **Migration 127** (head is 126), dropping migration 126's `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)` and committing the service-shaped row.
- Relaxes database-level constraint so OAuth/catalog rows can exist.

---
