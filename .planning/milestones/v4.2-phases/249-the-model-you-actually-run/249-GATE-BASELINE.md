# Phase 249 — Gate baseline, captured BEFORE the first edit

**Captured:** 2026-09-15
**Tree:** `develop` at `603b843c2` (the CONTEXT commit; no source file touched yet)
**Why this file exists:** a gate figure read *after* a build cannot tell a pre-existing red from one
the phase caused. Phase 248 established the practice; this is the same instrument.

⚠ **Two test runners ran concurrently** (backend pytest + frontend vitest, one each). That is within
the measured-safe limit — **three** concurrent test-running agents is where the count gate goes
non-deterministic regardless of cap.

---

## Backend unit suite

```
cd backend && venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors
```

```
71 failed, 4761 passed, 2 xfailed, 2 xpassed, 45 warnings in 270.85s (0:04:30)
EXIT=1
```

| | Measured 2026-09-15 | CLAUDE.md publishes |
|---|---|---|
| failed | **71** | 71 |
| passed | **4761** | 3497 ⚠ stale |
| xfailed / xpassed | **2 / 2** | 2 / 2 |
| collection errors | **0** | 0 |

⭐ **The binding figure is `71 failed` and it is met exactly — ZERO headroom.** Any new failing name
breaks the gate.

⚠ **The `passed` figure CLAUDE.md publishes (3497) is stale by 1,264 cases.** It is not the gate —
the gate is the failing count — but a reader comparing `4761` against `3497` and concluding
something broke would be reading the wrong number. Recorded here so that inference is not made.

**The failing SET — 71 unique names — is captured in full at:**
`C:\Users\fhdmr\AppData\Local\Temp\claude\C--Vibe-Apps-Agentic-RAG\8487958d-4608-46a0-b209-5a680cbaee25\scratchpad\249-backend-base-set.txt`

⛔ **Compare the SET at close, never the count.** A count of 71 with a different membership is a new
failure hiding behind a fixed one — the 2026-09-06 lesson that published a baseline of 71 when the
truth was 72.

Also captured: 12 lines beginning `ERROR` in the output are **captured application log records**
(`run_producer` ZREM notices, a `MagicMock`-in-`await` secret-sweep warning), **not pytest errors**.
The summary line reports no error count. Recorded so a later reader does not count them as failures.

---

## Frontend count gate

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs     # from the repo root
```

Verdict line, **verbatim**:

```
  file                                     pinned  actual   delta
  total                                      7493    8300    +807
  total 8300  ·  failed 0  ·  pinned total 7493
count gate OK — 279/279 pinned files present, no per-file decrease, 0 failing.
```

⭐ **GREEN at baseline** — unlike Phase 248, whose baseline was RED with three inherited failures.
So for this phase, `count gate OK` **is** a reachable acceptance criterion, and a red run is a
finding rather than an inherited condition.

⚠ **Phase 248's own baseline claim — *"count gate OK is NOT reachable for this phase"* — was
already corrected in its STATE entry as an over-generalisation from two red samples.** This
measurement is consistent with that correction, not with the original claim.

⚠ The `+807` gap between grand total (8300) and pinned total (7493) is **unpinned suites**, not
missing cases. Growth in the grand total is the gate WORKING; its contract is *no per-file decrease*
and *zero failing*, never a fixed total.

⚠ **Carried, and not this phase's:** `src/components/sources/sourceComposition.test.tsx` sits
outside BOTH knobs by a Phase 235 decision and is invisible to the verdict line above.

---

## Hot-file ledger gate

```
node scripts/check-hot-file-ledger.cjs .planning/phases/249-the-model-you-actually-run
```

At plan-write time it reports, correctly:

```
scan list: 271 rows · subject: 30 files · watched: 13
G-5 CANNOT FIRE ON 4 FILE(S) — they have no ledger row:
  [no-row] backend/app/api/setup.py                    (249-03-PLAN.md)
  [no-row] backend/app/services/setup_service.py       (249-03-PLAN.md)
  [no-row] frontend/src/lib/api/settings.ts            (249-02-PLAN.md)
  [no-row] frontend/src/lib/unverifiedModelCopy.ts     (249-02-PLAN.md)
```

⭐ **This is the guard doing its job at plan-write time, in the turn the plan was authored** — not
eight days later. Each of the four is owned by the plan that named it, as its first task.
A fifth row (`backend/app/api/evals.py`, `24 / 7 / 3237`, **G-5 FIRES**) is added by `249-04`
although that file is deliberately **not** modified — an absent row is invisible at any count.

⚠ **When verifying at close, confirm the gate parsed a NON-ZERO file count.** Phase 242 measured
this exact script exiting `0` over **0 parsed files** on a CRLF plan. An `OK` over nothing is not
an OK.

---

## What the phase may NOT claim, decided here rather than at the close

- Anything about **cloud**. Every figure above is local, at `develop`.
- **Peer review.** Builder and reviewer are the same agent by operator instruction
  (`D-249-26`): `verification_mode: self-verified`, `independent_review: owed`.
