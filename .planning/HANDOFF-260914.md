# Session handoff — 2026-09-14

**Written by:** Claude, at the operator's instruction (*"note this so i open new session"*).
**Read this first in a new session.** It is the state of play, not a history.

---

## 1 · Where the project is

| | |
|---|---|
| Milestone | **v4.2 The Connected Knowledge You Can Actually Run** — 5 phases, **247-251**, 26 requirements |
| Live | ✅ **v4.1 DEPLOYED 2026-09-13** — `production` = `eebc4c42f`, `production..develop` **0**, all migrations through **180** applied and verified in cloud, `get_advisors(security)` returns **zero ERROR** |
| Phase 247 | **BUILT (4 plans, 3 waves) and REVIEWED wave-by-wave. NOT CLOSED — five fast-fix findings, see §2b.** Sketch ratified (Variant A) · context locked · plans cleared (`BUS-211`) |
| Pipeline | Gemini sketches / plans / builds · **Claude reviews and does not shape** (`OV-SOLO-01` re-armed 2026-09-13) |

---

## 2 · ⛔ THE OPERATOR DECISION THAT NEEDS RECORDING — Claude takes the next phase end-to-end

**Operator, 2026-09-14:** *"you will handle next phase end to end yourself."*

The next unstarted phase is **248 — The Credential Boundary** (`CRED-01..04`).

⚠ **THE CONCERN, STATED ONCE AND NOT RE-LITIGATED.** 248 is the **trust-boundary** phase: a secret
that comes to rest in a column every org member can read, and 13 anon-executable `SECURITY DEFINER`
functions. **If Claude builds it, Claude cannot review it** — §6.3 — so it closes `self-verified`
with `independent_review: owed`, adding to the debt this session spent the day measuring and
unwinding. **249, 250 and 251 carry no trust boundary and would cost nothing to take instead.**

⭐ **This is recorded as a decision, not an objection.** The operator has the facts. If it stands,
248 must close with `verification_mode: self-verified` in its own verdict file and the honesty gate
will enforce that automatically — see §5.

---

## 2b · ✅ PHASE 247 IS CLOSED ON CODE — G-4 UAT STILL OWED

**Closed 2026-09-14 at `3d5f62dc6`.** Gemini built it across 3 waves; Claude reviewed every wave
independently (`BUS-214` / `BUS-217` / `BUS-218` / `BUS-219`), raised five findings, verified the
fixes (`BUS-221`), **retracted that close** (`BUS-222`), and re-closed on wider evidence (`BUS-223`).

**Gates at close, re-derived under Claude's own runs:** wider blast radius
(`pytest tests/unit/{services,db,api} -k "watch or source or connector or gmail"`) **460 passed, 0
failed** · 247's own suites 37 · frontend 118/118 · standing red 16/33 with the **same membership**
as the pinned baseline · honesty gate 10/10 · ledger gate OK.

⭐ **What the phase delivered:** 8 requirements, 5 success criteria, 4 plans. G-5 discharged
`1094 → 470` by a real seam. `connectors.py` byte-identical throughout, so the sixth-landing
extraction stays un-triggered. The 18-importer vocabulary contract honoured with value-only changes.
A **cross-tenant Gmail label leak** found in review and closed fail-closed on `(connection_id,
label_id)`. `WatchRowCard.tsx` carries a ledger row **at creation**.

⭐ **The SEED-282 fence was retired the RIGHT way** — `test_drive_path_is_the_real_folder` replaces
`test_drive_path_is_none_not_fabricated` under **`D-247-01`**, with the reason in the test body and
the NEW invariant asserted rather than the old one deleted. That is the Phase 206 precedent met.

⛔ **STILL OWED — 247's G-4 lived-experience UAT.** Three operator-defined *"I'd recognize failure
here"* scenarios, driven in a real browser. Everything above is jsdom, pytest and greps, and this
phase is entirely about **what a person reads** — a health pill, a sync answer, a timestamp, a button
label. This project has measured twice that a green fence coexists with a shipped legibility defect.
**The code close was Claude's to give; the UAT is the operator's to drive.**

⭐⭐ **THE METHOD FINDING THAT COST A WRONG CLOSE, and it is Claude's own.** The first close was given
over **three red suites**, all CAUSED by the phase (measured both ends: 70 passed at base
`987e7a685`, 2 failed at HEAD — not inherited). They were invisible because the review ran every file
247 TOUCHED and no file that DEPENDS on what 247 changed — and one of them was a **fence**, the
artifact class this project treats most carefully.
⛔ **A reviewer who runs only the phase's own suites measures the phase's own CLAIMS, never its
CONSEQUENCES.** For 248 onward: run the touched suites AND their dependents, and establish
base-vs-HEAD on anything red rather than assuming inheritance.

⚠ **A limit of the honesty gate, found by using it:** it printed `honesty gate OK — 10/10` over a
`verification_mode: peer-reviewed` marker that was not yet true. **It checks PRESENCE, never TRUTH.**
Worth a seed if it recurs.

## 3 · What is running right now

- **A persistent Monitor is armed** (task `b4pfle3op` — v4; v1-v3 were stopped and re-armed, twice to fix defects in the monitor ITSELF: a hardcoded "no source commits yet" that asserted what it never measured, and a `grep -c` count printed twice because it exits 1 on zero) watching, once a minute:
  new commits on `develop` · new files in `.planning/phases/247-sources-and-watches/` · new OPEN
  bus items addressed `to:claude`. ⚠ **It dies with this session.** A new session must re-arm it if
  autonomous monitoring is still wanted.
- **Review cadence promised to Gemini in `BUS-213`: per WAVE, not per commit.** Wave 1 = `247-01` +
  `247-02`; wave 2 = `247-03`; wave 3 = `247-04`.

⛔ **Claude cannot trigger Gemini.** It runs in Antigravity, a separate process with no channel to
this one (`ListAgents` → no reachable agents). The bus is a durable mailbox, not a doorbell —
**starting Gemini is an operator click.**

---

## 4 · The four plan-gate contracts 247 must hold to

1. **The standing red is a SET, not a count.** No test outside the 16 names in
   `.planning/phases/247-sources-and-watches/247-STANDING-RED-BASELINE.md` may fail. 16 / 17 / 18
   failing is fine **if every extra name is in that table**; a name outside it BLOCKS.
   ⭐ Measured: `sourceComposition.test.tsx` reads 16/33 here and 17/32 on Gemini's runner, on a
   **byte-identical** tree. Four readings exist across four sources; the total is always 49.
2. **`backend/app/api/connectors.py` stays at ZERO lines** — extraction owed at its sixth landing.
3. **`sourceHealthVocabulary.ts`: ADD causes and copy, never RE-KEY the maps** — **18 modules import
   it**. That fan-in is what made *safe-as-is* correct and is also the blast radius.
4. **`failure_cause.py`'s `Cause` union stays ONE plain-text line** — a frontend suite binds it by `?raw`.

---

## 5 · What changed in the toolchain today — pull before using either

- **`scripts/agent-bus.sh` `close()` was writing false records.** It matched only `[OPEN]`, so an
  `[ANSWERED]` item could never be closed, and `sed` exits 0 whether or not it substituted — it
  printed *"closed BUS-048"* over a byte-identical file. Driven RED, now gated on an md5 diff;
  re-closing refuses with exit 1.
- **`scripts/check-verification-honesty.cjs` now DERIVES its scan set** — phases ≥ 238, **live and
  archived**, `VERIFICATION.md` **and** `VERDICT.md` (operator ruling: VERDICT counts). It was
  reading **three hardcoded paths** and printing `honesty gate OK` while **20** verdict files
  existed; milestone archival had silently dropped 242/243/244/246 out of scope. **Scans 9 now.**
  ⚠ Its header docstring had FORBIDDEN a total-subject floor in capitals — that argument rested on
  `.planning/phases/` being *"designed to empty"* and is void once archives are included; rewritten
  in the same commit rather than left contradicting the code.
  ⭐ Counterfactual as proof: the OLD 3-path set prints `honesty gate OK` over the exact planted
  defect the new one catches.

---

## 6 · `DEBT-06` — countable for the first time

**8 phases owe an independent review; 1 has one.**

| Phase | State |
|---|---|
| 246 | ✅ `peer-reviewed` |
| 240 | ⚠ **`partial`** — build range independently reviewed (21 files, 2 Critical + 8 Warning + 6 Info); the **review-response range is uncovered**. See `240-REVIEW-RECONCILIATION.md` |
| 238 | ➡ **handed to Gemini** (`BUS-212`), queued behind 247 |
| 239 | ⛔ **NEEDS AN OPERATOR RULING — nobody untainted exists.** Gemini authored the plans, Claude executed them, so **both shaped it**. §6.3 bars the reviewer who *shaped* the build, not merely who typed it |
| 241, 242, 243, 244, 245 | `self-verified`, review owed — operator ruled these get **reasoned refusals**, not reviews |

⛔ **Claude built 238, 239 and 240** — measured from the phase records, not assumed. That is why the
operator's *"review the three trust-boundary phases"* instruction could not be executed as stated.

---

## 7 · Open bus — 7 items

| To | Items |
|---|---|
| **operator** | `BUS-040` (old handover) · **`BUS-208` — replace the two REVOKED provider keys in `backend/.env` AND Coolify.** GLM and Moonshot are dead until then, and they are rows 5 and 7 of the mandatory cross-provider roster; row 7 is the only `emit_tier: coerce` native row |
| **gemini** | `207` `209` `211` (247 execution) · `212` (238 review) · `213` (monitoring notice) |
| **claude** | `BUS-171` — triage job whose premise is stale: it says 23 operator items, there are **2** |

---

## 8 · Seeds planted today, both high priority

- **`SEED-274`** — the backend ceiling of **71 with "zero headroom"** is not a stable property:
  **71 / 72 / 72 / 77** measured on one tree. ⛔ The fix is **not a bigger number** — publish the
  failing SET across N runs, take union ∩ intersection, restate the gate as a set with a flake band.
- **`SEED-275`** — ✅ **closed the same day** by the operator's ruling; the honesty-gate fix in §5.

⚠ **Both are the same family:** a gate can be sound in its logic and still prove nothing — 274 is a
wrong **threshold**, 275 was a wrong **scan set**.

---

## 9 · The method finding this session kept re-earning

⭐ **Drive the claim; do not read it.** Measured repeatedly on 2026-09-14:

- Two `status: open` **blocking** bugs were already fixed (`BUG-260911-01`, `BUG-260910-03`); a third
  reading identically (`BUG-260907-02`) was **live**.
- `BUS-048`'s security finding had not evaporated — it shipped, **and** the forgery surface it left
  behind was deleted three days later.
- `240`'s register said *"nobody has looked at it"*; two reviews existed.
- ⚠ **And the discipline cut the other way twice**: `240`'s `base.py` md5 mismatch **looks** like a
  refuted headline claim and is not — the claim was scoped to the plan that made it and was true
  there. **A claim is false only within its own scope.** Publishing that would have been the same
  mechanism-shaped error this session caught in others.
