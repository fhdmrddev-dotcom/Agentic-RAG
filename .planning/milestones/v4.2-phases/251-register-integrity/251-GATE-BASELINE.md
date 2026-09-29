---
type: gate-baseline
phase: 251
plan: "01"
captured: 2026-09-16
captured_by: claude (executor, plan 251-01) — BEFORE Plan 02's migration touches one byte of the register
base_commit: 97bb24e4d
gate: scripts/check-seeds-register.cjs
tree_state: .planning/seeds/ is byte-unchanged at capture time (`git status --porcelain .planning/seeds/` → 0 lines)
---

# Phase 251 — the seeds register census, taken BEFORE the migration

⚠ **Every number below is pasted from the output of the command named above it.** A figure quoted
from `251-CONTEXT.md` or `251-RESEARCH.md` instead of re-derived here is the rot this phase exists to
end — and §0 is the proof that it was worth insisting on.

⛔ **This is the number Plans 02 and 03 are measured against.** After the migration, `[missing-key]`
and `[unknown-status]` must be **0**; after Plan 03, `[duplicate-id]` must be **0** with 8
`status: superseded-id` stubs standing in their place.

---

## 0 · ⚠ THE PLAN'S OWN FIGURE HAD ALREADY ROTTED — by one, in the base commit

`251-01-PLAN.md` states the register holds **283** files and **157** carry a `trigger_when`, measured
at `0fa2674cd` on 2026-09-15. Re-derived at `97bb24e4d` on 2026-09-16:

```bash
$ ls .planning/seeds | grep -c -E '^SEED-[0-9]{3}-.*\.md$'
284
```

The extra file is **`SEED-285-decision-coverage-gate-parses-zero-decisions-on-every-phase.md`**,
added by `97bb24e4d` — **this plan's own base commit**, the commit immediately before execution
started.

| | plan says (2026-09-15) | **measured 2026-09-16** |
|---|---|---|
| register size | 283 | **284** |
| files carrying `trigger_when` | 157 | **158** |
| `[missing-key]` per-key gaps | surface 155 · seed_id 106 · trigger_when 126 · title 29 | **surface 150 · seed_id 101 · trigger_when 121 · title 24** (see §4 — the difference is not drift) |

⭐ **THE GATE NEEDED NO CHANGE, AND THAT IS THE POINT.** `registerSize` is derived by `readdirSync`
at run time; `grep -n "28[34]" scripts/check-seeds-register.cjs` matches **two comment lines and zero
code lines**. A gate that hardcoded 283 would have exited `2` on the first run of its own acceptance
criteria, one commit after the criteria were written.

---

## 1 · Derivation line — `node scripts/check-seeds-register.cjs`

```
seeds register — .planning/seeds
  register: 284 files · parsed: 284 · skipped: 0 · duplicate ids: 8
  unswept:  126 carry no trigger_when at all · 158 carry prose but no structured trigger
```

Exit code: **1**.

- `parsed === registerSize` and `skipped: 0` — every file is accounted for, and every skip that ever
  happens increments a printed counter (there are none today).
- ⛔ **D-18's two figures, never summed.** `126 + 158 = 284`, i.e. **the whole register is unswept
  today**, because no seed carries a structured `trigger_paths` yet. Reporting only the `126` would
  be the comfortable lie REG-02 exists to end; the second figure is the one Plan 02 must shrink.

---

## 2 · `[duplicate-id]` — 8, and they are exactly REG-01's eight

Anchored count (the remedy block also contains the literal string, so an unanchored `grep -c`
over-reports by one):

```bash
$ node scripts/check-seeds-register.cjs | grep -c '^  \[duplicate-id\]'
8
```

Verbatim, with each member's `created`-else-`planted` date (D-20) as the gate printed it:

```
  [duplicate-id] SEED-022 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-022-camelot-pdf-table-precision-audit.md   (2026-05-16)
      .planning/seeds/SEED-022-timeout-settings-ui.md   (2026-05-25)
  [duplicate-id] SEED-092 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-092-app-wide-wcag-aa-contrast-and-icon-button-labels.md   (2026-06-20)
      .planning/seeds/SEED-092-remainder.md   (2026-07-16)
  [duplicate-id] SEED-228 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-228-a-workflow-cannot-say-the-whole-library-on-purpose.md   (2026-08-28)
      .planning/seeds/SEED-228-read-doc-refuses-a-docx-without-saying-why.md   (2026-08-31)
  [duplicate-id] SEED-229 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-229-does-the-golden-run-hang-on-an-armed-approval-checkpoint.md   (2026-08-28)
      .planning/seeds/SEED-229-five-suites-in-neither-count-gate-knob.md   (2026-08-31)
  [duplicate-id] SEED-231 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-231-decision-coverage-gate-is-blind-to-this-repo-decision-ids.md   (2026-08-29)
      .planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md   (2026-08-29)
      ⚠ both carry the SAME date — D-20 tie-break, git add-commit timestamps:
        SEED-231-decision-coverage-gate-is-blind-to-this-repo-decision-ids.md  added 2026-08-29 04:00:08 +0400
        SEED-231-nobody-is-told-an-approval-is-waiting.md  added 2026-08-29 05:03:04 +0400
  [duplicate-id] SEED-253 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md   (2026-09-06)
      .planning/seeds/SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md   (2026-09-06)
      ⚠ both carry the SAME date — D-20 tie-break, git add-commit timestamps:
        SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md  added 2026-09-06 08:36:22 +0400
        SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md  added 2026-09-06 22:00:28 +0400
  [duplicate-id] SEED-259 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-259-assistant-narration-repeats-verbatim-across-tool-turns.md   (2026-09-13)
      .planning/seeds/SEED-259-tool-names-are-rows-but-argument-shapes-are-not.md   (2026-09-08)
  [duplicate-id] SEED-269 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-269-explanations-are-noise-in-the-form-move-them-behind-an-info-affordance.md   (2026-09-10)
      .planning/seeds/SEED-269-one-home-for-the-elapsed-formatter.md   (2026-09-11)
```

⭐ **Three of D-20's rulings are REPRODUCED by the gate rather than transcribed from CONTEXT.md**,
which is the strongest evidence in this file that the date rule is mechanical:

| pair | gate output | CONTEXT.md D-20 says | agree? |
|---|---|---|---|
| `SEED-231` | 04:00:08 vs 05:03:04 → `decision-coverage-gate-…` older by **62m 56s** | *"older by 63 min"* | ✅ |
| `SEED-253` | 08:36:22 vs 22:00:28 → `mobile-has-no-drawer-…` older by **13h 24m 06s** | *"older by 13h 24m"* | ✅ |
| `SEED-259` | 2026-09-08 (`tool-names-are-rows…`) is older than 2026-09-13 | D-17: *"`SEED-259` is harmless — D-07 keeps the id on the seed the source code actually means"* | ✅ `test_259_argument_shapes_are_rows_too.py` stays correct |

⚠ **Only 2 of the 8 pairs needed the git tie-break** — the gate consulted it exactly twice and
**printed that it had**, so no reader has to take the choice on trust.

⚠ **`SEED-001` carries NO DATE at all** (neither `created:` nor `planted:`) — surfaced by the §6 RED
drive, which printed `(NO DATE)` for it. Plan 02 must not assume `seedDate()` is total.

---

## 3 · `[no-frontmatter]` — 5, and they are exactly RESEARCH §1.10's five

```bash
$ node scripts/check-seeds-register.cjs | grep -c '^  \[no-frontmatter\]'
5
```

```
SEED-084-starter-workflow-library.md
SEED-163-authoring-does-not-propose-the-business-requirement.md
SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md
SEED-165-top-level-backend-tests-are-outside-every-gate.md
SEED-166-settings-operator-admin-information-architecture.md
```

⭐ **Each reports `[no-frontmatter]` and NOTHING ELSE** — not five `[missing-key]` findings on top.
"No block at all" is a different STATE from "block missing a key", and it needs a different code path
in Plan 02 (prepend a block; the body md5 is the md5 of the entire current file).

---

## 4 · `[missing-key]` — 396 findings across 284 files

```bash
$ node scripts/check-seeds-register.cjs | grep -c '^  \[missing-key\]'
396
$ node scripts/check-seeds-register.cjs | grep -A1 '^  \[missing-key\]' | grep -oE '^      `[a-z_]+`' | sort | uniq -c
    101       `seed_id`
    150       `surface`
     24       `title`
    121       `trigger_when`
```

`status` is missing from **0** parsed files — the 5 that lack it are the `[no-frontmatter]` five in §3.

⚠ **These are each EXACTLY 5 below `251-CONTEXT.md`'s figures (106 / 155 / 126 / 29), and that is
arithmetic, not drift:** CONTEXT counted key presence across all 283 files including the 5 with no
frontmatter block; this gate reports those 5 under `[no-frontmatter]` only. The `+1` from `SEED-285`
lands on the other side — that seed carries **all five** required keys, so it adds nothing here.
`(106−5) = 101` ✓ · `(155−5) = 150` ✓ · `(126−5) = 121` ✓ · `(29−5) = 24` ✓.

**Seeds carrying all 5 required keys today: 73 of 284 (25.7%).**

```bash
$ node -e "const g=require('./scripts/check-seeds-register.cjs');const path=require('path');
           const a=g.analyse({dir:path.join(process.cwd(),'.planning','seeds')});
           console.log('complete:',a.complete,'of',a.parsed);"
complete: 73 of 284
```

---

## 5 · `[unknown-status]` — 27 files, 16 raw tokens

```bash
$ node scripts/check-seeds-register.cjs | grep -c '^  \[unknown-status\]'
27
```

Token histogram, matching RESEARCH §2.2's 16-token / 27-file measurement exactly:

| token | files | token | files |
|---|---|---|---|
| `partially-folded` | 7 | `partial-consumed` | 1 |
| `partially-shipped` | 4 | `partial` | 1 |
| `promoted` | 2 | `partially-resolved` | 1 |
| `DONE` | 2 | `resolved` | 1 |
| `shipped-in-part` | 1 | `fixed` | 1 |
| `scheduled` | 1 | `in_progress` | 1 |
| `routed` | 1 | `active` | 1 |
| `queued` | 1 | `done` | 1 |

Per file, with the prose that D-10 requires be moved (not deleted) into `status_note`:

```
SEED-001-scale-readiness.md                                    status: partial-consumed
SEED-002-skill-studio-milestone-prep.md                        status: queued   [+18 chars of prose]
SEED-005-document-management-capabilities.md                   status: active   [+20 chars of prose]
SEED-021-table-image-recall-lift.md                            status: partially-resolved
SEED-024-settings-architecture-unification.md                  status: scheduled
SEED-026-error-handling-observability-lift.md                  status: partially-folded
SEED-037-workspace-panel-file-viewing-and-download.md          status: partially-shipped
SEED-044-multi-language-skill-execution.md                     status: partially-folded
SEED-055-concurrent-chats-and-send-path-hardening.md           status: partially-shipped
SEED-057-google-429-credit-depletion-reads-as-rate-limit.md    status: partially-folded
SEED-063-execute-code-wallclock-timeout.md                     status: DONE   [+151 chars of prose]
SEED-064-stop-button-backgrounded-runs.md                      status: DONE   [+462 chars of prose]
SEED-076-filtered-vector-search-recall-pgvector-index-scale.md status: partially-shipped   [+114 chars of prose]
SEED-078-runtime-feature-flag-killswitch-maintenance-mode.md   status: partially-folded
SEED-082-emit-gate-policy-flexibility.md                       status: partially-folded   [+301 chars of prose]
SEED-090-metadata-extraction-observability-…                   status: partially-folded
SEED-096-skill-bundle-tree-fidelity-and-runtime-tooling.md     status: routed
SEED-098-chat-tool-card-deduplication-unified-essence-line.md  status: done
SEED-100-skill-eval-production-clean-…                         status: promoted
SEED-101-skill-creator-native-builtin-protected.md             status: promoted
SEED-116-control-room-settings-boundary-…                      status: resolved
SEED-188-prompt-injection-defenses-have-no-adversarial-test.md status: in_progress
SEED-190-per-workflow-run-history.md                           status: shipped-in-part
SEED-214-a-connection-offers-its-full-capability-not-one-verb.md status: partially-folded
SEED-226-engineering-drawing-ingestion-ocr-and-cad-geometry.md status: partially-shipped
SEED-238-mcp-oauth-tokens-never-refresh-…                      status: fixed
SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md status: partial   [+66 chars of prose]
```

⭐ **`done` and `DONE` both appear and both are findings.** Case-folding is an **explicit non-rule**
in the gate (`grep -n "toLowerCase()" scripts/check-seeds-register.cjs` → nothing), because neither
casing is in the enum and blessing one silently would be a mapping nobody ruled on.

⚠ **The five load-bearing prose moves** (where the prose sits INSIDE the value rather than after a
`#`) are visible above by their char counts: `SEED-063` (+151), `SEED-064` (+462), `SEED-076` (+114),
`SEED-082` (+301), `SEED-253` (+66) — plus `SEED-002` (+18) and `SEED-005` (+20). Losing any of them
is exactly the failure D-10 exists to prevent.

---

## 6 · The RED drive against the REAL register — a ninth collision, planted and removed

⛔ Run in the main working tree, before Plan 02 starts, never concurrently with the migration
(T-251-04). Transcript verbatim:

```bash
$ digest() { find .planning/seeds -type f -name '*.md' | sort | xargs md5sum | md5sum; }
$ BEFORE=$(digest); echo "register digest BEFORE : $BEFORE"
register digest BEFORE : ed6c0d98a173a2c64e08b520d3acac8f *-

$ cp .planning/seeds/SEED-001-scale-readiness.md \
     .planning/seeds/SEED-001-planted-ninth-collision-red-drive.md

$ node scripts/check-seeds-register.cjs ; echo "exit=$?"
  register: 285 files · parsed: 285 · skipped: 0 · duplicate ids: 9
  [duplicate-id] SEED-001 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-001-planted-ninth-collision-red-drive.md   (NO DATE)
      .planning/seeds/SEED-001-scale-readiness.md   (NO DATE)
exit=1

$ rm -f .planning/seeds/SEED-001-planted-ninth-collision-red-drive.md
$ AFTER=$(digest); echo "register digest AFTER  : $AFTER"
register digest AFTER  : ed6c0d98a173a2c64e08b520d3acac8f *-
BYTE-IDENTICAL: yes
$ git status --porcelain .planning/seeds/ | wc -l
0
```

⭐ **`register:` moved 284 → 285 by itself.** The scan set is derived, so the ninth collision could
not have been missed by a stale constant — which is the same property §0 depends on.
⭐ **The before/after digests are the SAME STRING**, and it is a digest of per-file digests over raw
bytes, so a single changed byte anywhere in the register would have changed it.

---

## 7 · `--self-test` transcript — D-04's arms, re-runnable forever

```bash
$ node scripts/check-seeds-register.cjs --self-test ; echo "exit=$?"

seeds register — self-test (fixture register under C:/Users/fhdmr/AppData/Local/Temp, real register untouched)
  arm 1 duplicate id FAILS … PASS
  arm 1b a superseded-id stub is NOT a duplicate … PASS
  arm 2 unknown status + no frontmatter FAIL, clean seed does not … PASS
  arm 3 a matching trigger IS printed … PASS
  arm 4 a NON-matching trigger is ABSENT (the counterfactual) … PASS
  arm 5 an EMPTY register raises a harness error … PASS

self-test 6/6 arms PASS — duplicate id, stub carve-out, bad status, match, counterfactual, empty-register floor.
exit=0
```

### 7a · ⭐ Arm 4 driven RED — because a passing arm proves nothing on its own

A copy of the gate was taken to the scratchpad and ONE line was changed, so that the matcher matches
unconditionally — i.e. the gate "prints everything", which is the exact defect D-04 arm 4 exists to
catch:

```js
-        if (path.matchesGlob(norm(f), g)) hits.push({ kind: 'path', glob: g, target: norm(f) });
+        hits.push({ kind: 'path', glob: g, target: norm(f) });   // PLANTED DEFECT: matches everything
```

```
  arm 1 duplicate id FAILS … PASS
  arm 1b a superseded-id stub is NOT a duplicate … PASS
  arm 2 unknown status + no frontmatter FAIL, clean seed does not … PASS
  arm 3 a matching trigger IS printed … PASS
  arm 4 a NON-matching trigger is ABSENT (the counterfactual) … FAIL
      907 must NOT appear in the matched set, got [906,907]
  arm 5 an EMPTY register raises a harness error … PASS

self-test 5/6 arms PASS — the gate cannot be trusted until every arm is green.
exit=1
```

⛔ **FOUR of the six arms stayed GREEN over a gate that had become useless.** That is the whole
argument for the counterfactual, measured rather than asserted: *a gate that prints everything passes
arms 1-3 and is useless.* The defective copy was deleted; it never existed inside the repo tree.

---

## 8 · `--phase 251` — the trigger sweep, before any structured trigger exists

```bash
$ node scripts/check-seeds-register.cjs --phase 251
trigger sweep — phase 251 (4 plan file(s), 17 path(s) in files_modified)
  ⚠ the phase declares NO surfaces, so `trigger_surfaces` matched nothing here.
    That is a fact about the PHASE, not about the register — reported, never passed off as a clean sweep.
  0 seeds matched — of 284 parsed, none carries a structured trigger this blast radius satisfies.
```

⭐ **`0 seeds matched`, NOT a dump of the register.** This is the live counterexample to arm 4's
failure mode, and the number Plan 02's backfill must move off zero.

---

## 9 · `check-hot-file-ledger.cjs 251` — the reading the plan asked for

```bash
$ node scripts/check-hot-file-ledger.cjs 251 ; echo "exit=$?"
hot-file ledger — .planning/phases/251-register-integrity
  scan list: 281 rows · subject: 17 files · watched: 0
ledger gate OK — every watched file has a row.
exit=0
```

- ✅ **No `[no-row]`** — as `251-CONTEXT.md`'s blast-radius note predicted. This phase modifies no
  product source file, so no ledger row is owed and **none was added**.
- ⚠ **`watched: 0` while `subject: 17`.** The ledger gate's WATCHED filter is `backend/app/` and
  `frontend/src/` only, so all 17 of this phase's paths fall outside it and `ledger gate OK` here
  means *"nothing was checked"*, not *"everything checked out"*. **Recorded, not fixed** — it is a
  fact about that gate's subject-side guard (RESEARCH §4.4), and inventing rows for tooling would
  make the ledger dirtier, not safer.

---

## 10 · What Plans 02, 03 and 04 are measured against

| figure | baseline (2026-09-16) | after Plan 02 | after Plan 03 |
|---|---|---|---|
| `register:` / `parsed:` | 284 / 284 | 284 / 284 | **292 / 292** (8 redirect stubs) |
| `skipped:` | 0 | 0 | 0 |
| `[duplicate-id]` | **8** | 8 (untouched) | **0** |
| `[no-frontmatter]` | **5** | **0** | 0 |
| `[missing-key]` | **396** | **0** | 0 |
| `[unknown-status]` | **27** | **0** | 0 |
| seeds with all 5 keys | **73 / 284** | **284 / 284** | 292 / 292 |
| unswept — no `trigger_when` | **126** | must shrink | — |
| unswept — prose, no structured trigger | **158** | must shrink | — |
| `--self-test` | **6/6 PASS** | 6/6 PASS | 6/6 PASS |
| register body bytes | digest `ed6c0d98a173a2c64e08b520d3acac8f` | ⛔ **every BODY md5 identical** (D-11) | — |

⚠ **The two unswept figures are the honest ones.** D-18 measured that a fully-mechanical backfill
leaves ~84% of the register with no structured trigger; a Plan 02 that reports `126 → 0` while the
second figure barely moves has told the comfortable lie, and this table is where that will show.
