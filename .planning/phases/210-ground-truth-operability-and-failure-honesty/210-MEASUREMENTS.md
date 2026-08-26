---
type: measurement-pack
phase: 210
phase_name: "Ground Truth — Operability & Failure Honesty"
builder: gemini
reviewer: claude
captured_by: claude
captured_at: 2026-08-26
tree_state: UNTOUCHED — captured before any Phase 210 work began
---

# Phase 210 — measurement pack

**What this is.** `AGENTS.md §3.1` makes the reviewer supply CLAUDE.md's three mandatory
discuss-phase cross-checks — reported bugs, the seeds sweep, and the G-5 hot-file scan — as
**measurements, on the bus, before `discuss-phase` opens**. The builder owns `discuss-phase` and
every decision in it.

⚠ **There are no recommendations in this file, deliberately.** Every line below is a fact with the
command that produced it. If you want a judgement, ask the operator — a measurement pack carrying a
suggested fix is a design direction wearing a lab coat.

⚠ **Captured on the UNTOUCHED tree.** A baseline taken after the change measures the change against
itself.

---

## 1 · Gate baselines

| Gate | Command | Baseline |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`) | **34 errors** |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (from repo root) | _see §1.1_ |
| Backend unit suite | `python -m pytest tests/unit -q` (from `backend/`, venv active) | _see §1.1_ |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **83,431 chars · 55.6% of limit · OK** |

⚠ **`tsc --noEmit` WITHOUT `-p tsconfig.app.json` checks ZERO files.** The v3.7 close audit reported
that bare form as "clean" while a real defect sat in the 35th error. Use the flag.

⚠ **34 is a BASELINE, not a target.** It matches the figure Gemini recorded at Phase 209's close.
A Phase 210 plan is clean if it introduces **no error in a file it touched**, not if the total is 0.

### 1.1 Pending at the time of writing

The count gate and backend suite were still running when this pack was committed. **Re-derive them
yourself rather than trusting a number in this file** — that is this repo's most-repeated lesson
(the gated test total has rotted four times, twice within two days).

For orientation only, the last recorded readings: count gate `OK 114/114 pinned, 0 failing,
total 5773` (Phase 209 close). Backend `tests/unit` carries a **known rot set of ~62-63 failures**
(`retrieval_service` 13, `sql_service` 12, `sandbox_service` 3, `streaming_reliability` 1) that
predates this milestone.

⚠ **`retrieval_service` is 13 of that rot set AND is RAG-09's home file.** Establish which of those
13 are pre-existing before touching it, or a pre-existing failure will read as one you caused.

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
| `backend/app/api/admin.py` | 32 / 12 / 1733 | **FIRES** | yes |
| `backend/app/services/retrieval_service.py` | 17 / 9 / 362 | **FIRES** | ⚠ **NO** |
| `frontend/src/components/admin/ControlRoomPage.tsx` | 15 / 9 / 855 | **FIRES** | ⚠ **NO** |
| `backend/app/services/embedding_service.py` | 9 / 5 / 348 | **FIRES** | ⚠ **NO** |
| `backend/app/api/settings.py` | 30 / 16 / 616 | **FIRES** | yes |
| `frontend/src/components/admin/CapabilityGrid.tsx` | 2 / 2 / 257 | no | no |
| `backend/app/services/scheduler_service.py` | 4 / 1 / 378 | no | no |

⚠ **THREE FILES IN THIS PHASE'S BLAST RADIUS FIRE G-5 AND HAVE NEVER HAD A LEDGER ROW**, so the
guardrail has never been able to fire on any of them at any count — `retrieval_service.py` at 9
phases, `ControlRoomPage.tsx` at 9, `embedding_service.py` at 5. This is the same invisibility the
ledger documents about `api.ts` (105 phases, no row until Phase 207) and `config.py` (43 phases,
invisible for the project's entire life).

⚠ **`ControlRoomPage.tsx` is named in CLAUDE.md's project-skills paragraph but has no TABLE row.**
Being mentioned in prose is not being in the scan list. A grep for the filename returns a hit and is
therefore a misleading check — match on the row format `| [\`path\`](...)` instead.

**Verification note:** an earlier run of this scan reported `admin.py` as having no row. That was a
shell-escaping fault in the check (backticks inside double quotes became command substitution), not
a finding. The table above is from a fixed-string match and is correct.

---

## 3 · Reported bugs whose `affected_areas` touch this phase

All five are `status: open`, `surface: Agentic-RAG`. CLAUDE.md routes the frontmatter write
(`status` + `folded_into: 210`) to `discuss-phase` — **it has not been done**, and it is the
builder's to do.

| Bug | Severity | Requirement | Areas |
|---|---|---|---|
| `BUG-260826-04` | major | CONN-09 | frontend/admin · frontend/settings · backend/api · operator-surface |
| `BUG-260826-06` | major | CONN-10 | backend/scheduler · backend/api · frontend/workflows · deployment/config |
| `BUG-260826-07` | major | CONN-10 | backend/scheduler · frontend/workflows · backend/harness · automations |
| `BUG-260826-03` | major | CONN-11 | backend/scheduler · backend/api · backend/automations |
| `BUG-260815-05` | ⛔ **blocking** | RAG-09 | RAG/retrieval · backend/harness · publish-gauntlet · observability · embeddings · settings · admin/control-room |

### 3.1 Measured on the tree — `BUG-260826-04`'s crux

```bash
grep -rn 'live_connectors' frontend/src/components/admin/
#   -> ZERO occurrences
```

`live_connectors` resolves in **7 non-cache source files** — `backend/app/api/admin.py`,
`backend/app/api/connectors.py`, `backend/app/main.py`, `backend/app/models/user_settings.py`,
`backend/app/services/harness/phase_types.py`, and five `frontend/src/components/settings/*` files
plus `frontend/src/lib/api/_core.ts`. **None of them is an operator/admin component.**

`CapabilityGrid.tsx`'s own header comment reads *"The four capability flags this grid controls — the
FLAG-01 subset of `FlagKey`"*, and its contract is `onToggle: (key: CapabilityKey, value: boolean)`.
So the grid is a closed four-key subset; `live_connectors` is not among them.

---

## 4 · Seeds register sweep — `status: planted`, trigger touches this phase

CLAUDE.md requires the routing to be written back into each seed's frontmatter at `discuss-phase`.
**Not done** — builder's call, four ways each (fold / defer / leave / reject).

| Seed | Why it surfaced here |
|---|---|
| **`SEED-057`** | *Google 429 credit-depletion now reads as "rate limited — retry"* — ⚠ recorded as a **deliberate Phase 095.1 trade-off** that can under-warn on genuine billing exhaustion. This is the same provider-error-honesty axis as RAG-09, and it says the current behaviour was chosen, not accidental. |
| **`SEED-078`** | *Unified runtime feature-flag / kill-switch / maintenance-mode system — no operator off-switch for a misbehaving capability.* CONN-09 adds one switch to a surface this seed says has no general mechanism. |
| **`SEED-090`** | *Distinguish `provider_error` (transport/down) from `model_failed_to_emit` (honest decline).* The exact distinction RAG-09 asks for, already specified for a sibling subsystem. |
| **`SEED-026`** | *Error handling, surfacing & observability lift — structured `ErrorResponse` + admin error inspector.* The umbrella RAG-09's error path would sit under. |

`SEED-020` (Retrieval Quality Audit) also names `retrieval_service.py` but its trigger is about
embedding-model and re-ranker QUALITY, not failure reporting.

---

## 5 · Cross-plan seam audit — the check that would have caught the Phase 204 defect

Not a finding; a **procedure the builder owes**, recorded here because this phase's `CONN-10`
is the same subsystem where it last failed.

Phase 204 shipped a spend cap that never armed: `204-03` wrote the caps to `workflow_runs.inputs`
and `204-02`'s `load_run_budget` read `workflow_runs.metadata`. `scheduler_service.py` contained
**zero** occurrences of `metadata`. The read **fails open**, so the breaker disarmed silently —
measured at 3m20s against a 120s cap — while **106 tests stayed green**, because the two parallel
waves each mocked the other's side.

For every value one plan WRITES and another READS in this phase, name the exact column or key on
**both** sides and confirm they match. If the phase has parallel waves and no test that mocks
**neither** side, that is a gap.

⚠ **`CONN-10` is TWO defects sharing one requirement** — *"cannot be silently accepted"*
(`BUG-260826-06`) and *"the default budget does not guarantee cancellation"* (`BUG-260826-07`).
A plan can close one and read as closing both.

---

## 6 · Reachability

Phase 210's SC#1 is an operator seeing and flipping a switch. The Phase 118 / Phase 200 failure
shape is: built, gated, green, and structurally unreachable. §3.1 above records that
`live_connectors` currently reaches no operator component at all.

⚠ **Phase 209 shipped behind `visual_workflow_canvas`, whose cold default is `off`** — its 16/16
browser drive ran against a flag-flipped database, so it proves behaviour on a flipped install, not
a fresh one. If any Phase 210 surface lands behind a flag, the same question applies.

---

## 7 · Roster note for SC#10

CLAUDE.md's UAT scoreboard names an 8-row native chat roster. **RAG-09's axis is the EMBEDDING
provider set** — OpenAI / Google / Ollama / LM Studio / OpenAI-compatible, per Phase 111.1 — not the
chat roster. A provider with no key configured is recorded ⛔ with its reason; it is never dropped
from the table.
