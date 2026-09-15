---
phase: 251
plan: "02"
subsystem: planning-tooling
tags: [migration, seeds-register, REG-01, REG-02, D-09, D-10, D-11, D-16, D-18, tdd]
requires:
  - "251-01 — scripts/check-seeds-register.cjs (frontmatter, readKey, stripComment, analyse, STATUS_ENUM)"
provides:
  - "scripts/migrate-seeds-frontmatter.cjs — the first file-writing .cjs in scripts/; dry-run default, --apply, --self-test (7 arms), idempotent, body-invariant-gated"
  - ".planning/seeds/ — 284 files carrying seed_id + title + status + surface + trigger_when"
  - ".planning/seeds/TEMPLATE.md — the register's first written contract"
  - ".claude/get-shit-done/workflows/plant-seed.md — max(id)+1 allocator + the contract block"
  - "CLAUDE.md § Seeds register cross-check — the executable sweep, correction beside the original"
  - "ids 277-284 are FREE and are exactly the 8 Plan 03 needs (measured, see Carried findings)"
affects:
  - ".planning/seeds/ (frontmatter ONLY — 284/284 bodies proven md5-identical by an independent derivation)"
tech_stack:
  added: []
  patterns:
    - "one parser, IMPORTED: a migration that calls the gate's reader rather than growing a second one — proven live by stubbing the import and watching the run die"
    - "dry-run default / explicit --apply / idempotent / read-back asserted, ported from repair_dirty_workflow_phases.py into .cjs"
    - "the success line is gated on the WRITE, not on reach (agent-bus.sh:145-147)"
    - "second check-*.cjs-family script in this repo with an executable self-test; first migration with one"
key_files:
  created:
    - scripts/migrate-seeds-frontmatter.cjs
    - .planning/seeds/TEMPLATE.md
    - .planning/phases/251-register-integrity/251-02-SUMMARY.md
  modified:
    - .planning/seeds/ (242 of 284 files)
    - .claude/get-shit-done/workflows/plant-seed.md
    - CLAUDE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "D-16's 8 read-first status tokens were each decided by OPENING the seed; the sentence that decided each one is in the script's mapping table, not only in this SUMMARY, so a re-run reproduces the reading"
  - "the plan's criterion `the carry-no-trigger_when figure is 0` was REFUSED — D-02's own words require the gate to keep reporting 126, and relabelling `unset` as swept is the comfortable lie the phase exists to end"
  - "the plan's criterion `the allocator prints SEED-277` was REFUTED by measurement: the highest id is 285, so the correct answer is 286. The OLD allocator emits SEED-285, which already exists"
  - "`trigger_paths` globs are QUOTED — an unquoted double-star opens with YAML's alias indicator"
  - "a `git checkout --` restore of the register was run mid-task and silently rewrote 224 bodies' line endings; 280 of 284 were recovered byte-exact and the remaining 4 are git-identical. Recorded, not hidden"
metrics:
  duration: ~150 min
  tasks: 3
  commits: 4
  completed: 2026-09-16
---

# Phase 251 Plan 02: The Frontmatter Migration Summary

**One-liner:** All 284 seeds gained the contract the register never had — `seed_id`, `title`,
`status`, `surface`, `trigger_when`, a 10-value enum and 51 `status_note`s holding every displaced
byte — with all 284 bodies proven identical by a digest set derived independently of the migration,
and the contract written into the three files that would otherwise have undone it on the next seed
authored.

## What shipped

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | The migration script — imported parser, RAW-Buffer body invariant, 7 self-test arms | `08a1cd000` | `scripts/migrate-seeds-frontmatter.cjs` |
| 2 | Run it — 284 contracted, 284 bodies proven, gate's three codes to zero | `cd0d3fa3b` | `.planning/seeds/` (242 files), the script |
| 3 | The contract's three written homes | `eff1afa7e` | `TEMPLATE.md`, `plant-seed.md`, `CLAUDE.md` |

---

## The measured result, against `251-GATE-BASELINE.md`

| figure | baseline (pre-migration) | **measured now** | expected |
|---|---|---|---|
| `register:` / `parsed:` / `skipped:` | 284 / 284 / 0 | **284 / 284 / 0** | ✅ |
| `[missing-key]` | **396** | **0** | ✅ |
| `[unknown-status]` | **27** | **0** | ✅ |
| `[no-frontmatter]` | **5** | **0** | ✅ |
| `[duplicate-id]` | **8** | **8** | ✅ Plan 03's work — a green gate here would mean the gate had stopped seeing them |
| seeds carrying all 5 required keys | **73 / 284** | **284 / 284** | ✅ |
| `partial: true` | 0 | **15** | ✅ D-16's exact figure |
| unswept — no `trigger_when` | **126** | **126** | ⚠ see Deviation 1 — this is CORRECT |
| unswept — prose, no structured trigger | **158** | **114** | ✅ `-44` |
| gate exit code | 1 | **1** | ✅ the expected reading at this wave |
| `--self-test` (gate) | 6/6 PASS | **6/6 PASS** | ✅ |
| `--self-test` (migration) | — | **7/7 PASS** | ✅ |

```
seeds register — .planning/seeds
  register: 284 files · parsed: 284 · skipped: 0 · duplicate ids: 8
  unswept:  126 carry no trigger_when at all · 114 carry prose but no structured trigger
```

**The status corpus is now nine tokens and every one is an enum member** (`superseded-id` has zero
files, as designed — Plan 03 writes them):

```
$ grep -h '^status:' .planning/seeds/*.md | sed 's/\r$//' | awk '{print $2}' | sort -u
answered  closed  deferred  dormant  folded  open  partially-answered  planted  shipped
```

Every count reconciles against the baseline with **no residual**: `planted` 161 +1 (`SEED-285`)
+5 (the no-block five) = 167 · `open` 40 +`active` +`in_progress` = 42 · `folded` 13 +7 +2 +1 +1 +1
= 25 · `closed` 15 +`fixed` = 16 · `shipped` 3 +4 +1 +2 +1 = 11 · `answered` 5 +1 +1 = 7 ·
`dormant` 6 · `partially-answered` 5 · `deferred` 3 +1 +1 = 5. Total **284**.

---

## RED evidence, verbatim — required by `<tdd_note>`

### RED 1 · the failure mode, driven BEFORE the migration existed

A "reasonable" string-based frontmatter edit (read utf8 → split lines → insert a key → write),
applied to a real CRLF seed copied out of the tree:

```
body md5 BEFORE (raw Buffer) : 3c04fdaf11fb0a5a0a389d3aace7dbaa  bytes= 16671
body md5 AFTER  (raw Buffer) : 2a31a01ab1e1087159e4200fc6a2c722  bytes= 16489
RAW-BUFFER VERDICT           : CHANGED  <-- RED
normalised-text VERDICT      : identical  <-- the comfortable lie
```

⛔ **182 body bytes destroyed, and the check most people would write calls it identical.** That is
the whole argument for hashing raw Buffers.

### RED 1b · ⭐ and the git-side comparison is blind — measured on a real tracked file

`SEED-171`, whole-file line-ending rewrite, then restored:

```
file md5 BEFORE: 570605476deb532618cd062905f073e5 37062 bytes
file md5 AFTER : ce47c40e033abce9d021af1534559a0c 36509 bytes
bytes lost     : 553
--- what the git-side comparison sees ---
 M .planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md
[porcelain lines: 1]
[diff --stat lines: 0]                      <-- ZERO. 553 bytes gone, no content difference shown.
RESTORED: 570605476deb532618cd062905f073e5
```

⚠ **A PARTIAL CORRECTION TO RESEARCH §7.2, recorded beside it rather than over it.** Research says
the damage is *"invisible to `git diff`"*. Measured: the **content** comparison is indeed blind
(`--stat` prints nothing), but `git status --porcelain` **does** flag the file — it fails the stat
check first. So the precise claim is: *git can see THAT a file was touched; it cannot see WHAT
changed.* A reviewer trusting a content diff learns nothing; a reviewer trusting porcelain learns
only that something happened.

### RED 2 · ⭐ the body invariant, driven against a planted defect

A scratch copy of the migration with exactly one line changed — the body concatenated as a
re-serialised string instead of a Buffer:

```js
-  fs.writeFileSync(target, Buffer.concat([newFm, bodyBuf]));
+  fs.writeFileSync(target, newFm.toString('utf8') + bodyBuf.toString('utf8')
+    .split(String.fromCharCode(13,10)).join(String.fromCharCode(10)), 'utf8');   // PLANTED DEFECT
```

```
REFUSED: SEED-901-crlf-orphan-status.md: BODY md5 CHANGED across the write — expected
156e144de8b391042b11e70a744d01b9, got 4007176fe42dfad7ba4184fa8e736a0f. D-11 is the whole point of
this script; aborting the run before any further write. 0 file(s) were already written and are intact.
exit=1
```

The refusal fired on the **first** file and stopped the run, as designed.

### RED 3 · ⭐⭐ THE ONE THAT MATTERS — defang the comparison and SIX of seven arms stay green

One line changed: `return { ok: actual === expectedBodyMd5, actual }` → `return { ok: true, actual }`.

```
  arm 1 a dry run writes NOTHING … PASS
  arm 2 --apply leaves 0 missing-key / unknown-status / no-frontmatter … PASS
  arm 3 every BODY is md5-identical over raw Buffers (CRLF, LF and no-block) … PASS
  arm 4 a second --apply reports 0 files changed … PASS
  arm 5 the body-invariant REFUSES when the digest disagrees … FAIL
      ok=true actual=f4410a365a9315c7a3fcf15b64f6b147
  arm 6 an unlisted status token REFUSES, never coerces … PASS
  arm 7 a write outside the register is REFUSED … PASS

self-test 6/7 arms PASS — the migration cannot be trusted until every arm is green.
exit=1
```

⛔ **Arm 3 — the arm whose entire job is the body invariant — stayed GREEN over a migration whose
body check had become a no-op**, because the bodies genuinely were fine; the check was not.
**Only the counterfactual caught it.** This is Wave 1's arm-4 finding reproduced one register over,
independently, and it is why every arm in this phase has a partner that asserts the refusal.

### The self-test, green

```
seeds frontmatter migration — self-test (fixture register under …\Temp, real register untouched)
  arm 1 a dry run writes NOTHING … PASS
  arm 2 --apply leaves 0 missing-key / unknown-status / no-frontmatter … PASS
  arm 3 every BODY is md5-identical over raw Buffers (CRLF, LF and no-block) … PASS
  arm 4 a second --apply reports 0 files changed … PASS
  arm 5 the body-invariant REFUSES when the digest disagrees … PASS
  arm 6 an unlisted status token REFUSES, never coerces … PASS
  arm 7 a write outside the register is REFUSED … PASS

self-test 7/7 arms PASS — dry-run inertness, the contract, the RAW-Buffer body invariant,
idempotency, the refusal, the mapping floor, containment.
```

---

## The mutation checks — the import is PROVEN live, not assumed

*A dependency nobody has seen break is not a dependency.*

**Arm A — `gate.frontmatter` stubbed** (preload in the session scratchpad, never in the repo):

```
$ node -r <scratchpad>/poison-frontmatter.cjs scripts/migrate-seeds-frontmatter.cjs
FATAL: Error: STUBBED-frontmatter
real exit=2
seeds porcelain: 0
```

**Arm B — `gate.readKey` stubbed:**

```
$ node -r <scratchpad>/poison-readkey.cjs scripts/migrate-seeds-frontmatter.cjs
FATAL: Error: STUBBED-readKey
real exit=2
seeds porcelain: 0
```

Both die before printing a single line of their per-file plan, and neither touched the register.
**The script has no frontmatter logic of its own.** And the import is side-effect-free:

```
$ node -e "require('./scripts/check-seeds-register.cjs'); console.log('silent')"
silent          exit=0
```

**Call-graph criteria, all measured:**

| criterion | want | measured |
|---|---|---|
| `require(.*check-seeds-register` | 1 | **1** |
| `gate.frontmatter(` | 2 | **2** (locate · post-write re-slice) |
| `gate.readKey(` | ≥4 | **6** — `id`, `seed_id`, `status`, `surface`, `title`, `trigger_when` |
| `gate.stripComment(` | ≥1 | **1** |
| unqualified `frontmatter(` | 0 | **0** |
| unqualified `readKey(` | 0 | **0** |
| `createHash` over a Buffer | ≥1 | **1** |
| literal `git diff` in the source | 0 | **0** |
| whole-file CRLF normalisation on a write path | 0 | **0** |

---

## D-11 — the body invariant, proven INDEPENDENTLY of the script

The script's own claim:

```
242 files changed
bodies verified md5-identical: 242/242
(digests taken over RAW Buffers, before and after, in this same process run)
```

⛔ **The script proving itself is the weakest evidence available**, so the set was re-derived by a
separate one-off that shares no code with it — no `require` of the migration, no `require` of the
gate, and a **byte scan** for the delimiters rather than a regex over decoded text, deliberately a
different mechanism:

```
INDEPENDENT body-digest SET, pre-apply baseline vs post-apply
  pre  -> post missing: 0
  post -> pre  missing: 0
  set md5 pre : 881619cf57d8fe34e0cafb03a4b7742a
  set md5 post: 881619cf57d8fe34e0cafb03a4b7742a
```

**284 `path:md5` pairs, diffed in both directions, empty both ways.** ⛔ Equal counts were not the
criterion and were not used.

### The 6 mixed-line-ending and 5 no-frontmatter files, by name

| file | body md5 before | body md5 after | verdict |
|---|---|---|---|
| `SEED-013-external-integrations-api-mcp.md` | `f0bda635f1f519bc67efe0af6a0e7f48` | `f0bda635f1f519bc67efe0af6a0e7f48` | IDENTICAL |
| `SEED-144-provider-shaped-connections-oauth.md` | `28b2aa20b0f89c45709124c64c8f4bab` | `28b2aa20b0f89c45709124c64c8f4bab` | IDENTICAL |
| `SEED-145-connections-are-platform-assets-not-workflow-assets.md` | `be644778e6d462dade6e39482d2658c6` | `be644778e6d462dade6e39482d2658c6` | IDENTICAL |
| `SEED-171-workflows-library-suites-flake-independent-of-cap.md` | `d711d172eb2d3d8c48d80f6b5e9c6f5d` | `d711d172eb2d3d8c48d80f6b5e9c6f5d` | IDENTICAL |
| `SEED-193-agent-authored-interactive-artifacts-…md` | `e1e43f63dceed7503e47ec32c9e24c3a` | `e1e43f63dceed7503e47ec32c9e24c3a` | IDENTICAL |
| `SEED-194-image-generation-as-a-tool-any-endpoint.md` | `ec400b8c5c6847f48671e0e0900091e1` | `ec400b8c5c6847f48671e0e0900091e1` | IDENTICAL |
| `SEED-084-starter-workflow-library.md` | `9e422a13e9c582ec548be4606cfc8249` | `9e422a13e9c582ec548be4606cfc8249` | IDENTICAL |
| `SEED-163-authoring-does-not-propose-the-business-requirement.md` | `67f356054600bcf0ee41eb195927468f` | `67f356054600bcf0ee41eb195927468f` | IDENTICAL |
| `SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md` | `4605e93b160d459fc8edfc23d1371a75` | `4605e93b160d459fc8edfc23d1371a75` | IDENTICAL |
| `SEED-165-top-level-backend-tests-are-outside-every-gate.md` | `88fc9a346c4619be74fb664de9df0605` | `88fc9a346c4619be74fb664de9df0605` | IDENTICAL |
| `SEED-166-settings-operator-admin-information-architecture.md` | `b26b4303df3dd8cf0673616bc8c16508` | `b26b4303df3dd8cf0673616bc8c16508` | IDENTICAL |

⭐ **The mixed files prove the mechanism rather than merely surviving it.** After the migration
their bare-LF counts are *unchanged* while their CRLF counts rose by exactly the number of
frontmatter lines added — `SEED-013` CRLF 202 → 203 with bareLF still **13**; `SEED-171` 553 → 554
with bareLF still **36**. The mixture lives entirely in the BODY and the body was never
re-serialised.

---

## The 8 status tokens that required a READING, and the sentence that decided each

⛔ D-16 requires an individually listed mapping and forbids silent coercion. Each ruling below was
made by **opening the seed**, and each is encoded **in the script's `STATUS_MAP` with its reason**,
not only here — so a re-run reproduces the decision rather than re-making it.

| token | seed(s) | → | the sentence that decided it |
|---|---|---|---|
| `promoted` ×2 | SEED-100, SEED-101 | **folded** | Each carries a `promoted_to:` key naming a real phase — `"Phase 137.1 (EVAL-05)"` and `"Phase 137.2 (CREATE-01)"`. It means *became a requirement*, which is folding; the destination survives in its own key and in `status_note`. |
| `DONE` ×2 | SEED-063, SEED-064 | **shipped** | `"backend implemented + unit-tested + LIVE-VERIFIED 2026-06-07"` and `"Sketch 017 option C shipped; DB cross-check (runs table): both runs status='cancelled'"`. Code shipped. |
| `done` ×1 | SEED-098 | **shipped** | `shipped: 2026-06-30 (quick task 260630-226; commits e3ff8623 + 37bd6d5c)`. ⛔ Reached by READING, not by case-folding — case-folding is an explicit non-rule, and the two casings have separate rows in the table. |
| `resolved` ×1 | SEED-116 | **answered** | `resolved_by: ".planning/notes/settings-control-room-boundary.md (/gsd:explore session, operator-affirmed)"`. A QUESTION was settled by a document; no code shipped, so `answered`, not `closed`. |
| `partial` ×1 | SEED-253 | **folded** + `partial: true` | Its own inline comment: *"⚠ Phase 238 took OPTION 1 for Graph. Drive is STILL unpopulated."* Folded on one axis, open on the other — exactly what D-16's boolean exists to say. |
| `partial-consumed` ×1 | SEED-001 | **folded** + `partial: true` | `consumed_by: [Phase 073, Phase 079]`, with a `partial_note` saying load testing and the AnyIO ceiling audit remain. |
| `fixed` ×1 | SEED-238 | **closed** | A defect that stopped reproducing. |
| `routed` ×1 | SEED-096 | **folded** | Routed to a destination is folding. |

Mechanical, no reading needed: `scheduled`→`deferred` · `queued`→`deferred` · `in_progress`→`open` ·
`active`→`open` · the `partially-*` family (15 files) → base token + `partial: true`.

⚠ **`SEED-001` is the file Wave 1 warned about** — it carries neither `created:` nor `planted:`, so
`seedDate()` is not total. The migration never calls it, so the gap did not bite here; **Plan 03's
D-07/D-20 tie-break does call it, and `SEED-001` is one of the duplicate pairs.**

---

## Nothing was lost — the three `migration_note` files

⭐ **Caught in the dry run, BEFORE any write, by reading the migration's own planned output rather
than by reasoning about it.** The first draft recorded a displaced key only for the legacy `id:`
spelling. Two files would have had content silently deleted:

| file | the line that would have been deleted |
|---|---|
| `SEED-068` | `seed_id: SEED-068  # renumbered from SEED-063 at v2.8 audit close-out 2026-06-07 (ID collision with SEED-063-execute-code-wallclock-timeout)` — **this project's own renumbering precedent, which D-05 cites** |
| `SEED-092-remainder.md` | `seed_id: SEED-092-remainder` — a value that **disagrees with its filename** and is one half of a live duplicate-id pair |
| `SEED-273` | `surface: Agentic-RAG / retrieval / database` — the one compound surface in the register |

All three now sit verbatim in `migration_note`. **51 `status_note`s** carry every displaced status
line plus the prose that followed the token, byte-for-byte, plus the mapping and its reason.

---

## D-18 — the two figures, and the honest one is the one that did not move

```
  36  seed(s) yielded a `trigger_paths` (59 glob(s) total)
  10  seed(s) yielded a `trigger_surfaces` from the controlled enum
```

**44 distinct seeds** gained a structured trigger (2 gained both), and the gate's second unswept
figure moved **158 → 114**. ⚠ **Research §3.3 predicted ~45 seeds from `trigger_paths` alone; the
measured figure is 36, and the smaller number is published rather than the prediction.** The gap is
the `.md` exclusion: seed prose is full of `SEED-NNN-….md` cross-references, and `**/SEED-259-….md`
is a citation, not a code trigger.

⛔ **Roughly 240 of 284 seeds are still unswept, and the gate says so in its own voice.** A
migration reporting only the first figure would have told the comfortable lie REG-02 exists to end.

---

## Deviations from Plan

### 1. ⛔ [decision — criterion REFUSED] The plan's `carry no trigger_when at all` = 0 criterion is wrong, and satisfying it would have been the lie

- **The criterion:** *"the `carry no trigger_when at all` figure is `0` (every seed now carries the
  key, 126 of them reading `unset`)."*
- **Measured:** the figure is **126**, unchanged, and that is CORRECT. The Wave 1 gate treats
  `trigger_when: unset` as *no trigger*, deliberately — `unsweptCounts()` reads
  `if (!prose || prose === 'unset') { noTrigger++; }`.
- **D-02's own words settle it:** *"The 126 with no trigger get `trigger_when: unset` so they are
  visible as unswept rather than silently absent — the gate then reports '126 seeds carry no
  trigger' as a number that must shrink, not a blind spot."* The number shrinks when somebody
  **writes a trigger**, never when a migration writes the word `unset`.
- **Action:** the criterion was refused and the gate was left alone. ⛔ Driving the figure to 0 by
  relabelling would have required weakening the gate that Wave 1 drove RED — the textbook shape of
  greening a gate by blinding it.

### 2. ⛔ [Rule 1 — stale measurement] The plan's `SEED-277` allocator criterion is refuted, and the real answer is worse than the plan feared

- **The criterion:** *"Running the new allocator snippet by hand prints `SEED-277` today (highest id
  276), not `SEED-284`."*
- **Measured 2026-09-16:** 284 files · **276 distinct ids** · **highest id 285** → the allocator
  correctly prints **`SEED-286`**. The plan's premise (*highest id 276*) is stale for the same
  reason its `283` was: `SEED-285` was added by this phase's own base-commit lineage.
- ⭐ **And the defect is sharper than the plan claimed.** The plan says the old count-based form
  emits `SEED-284`. Measured, it emits **`SEED-285` — which ALREADY EXISTS.** The old allocator
  produces the **ninth collision on its very next use**, today, single-threaded. That is now the
  comment in `plant-seed.md`.
- **Action:** the allocator is `max(id)+1` with `10#`, verified correct at 286. The octal hazard was
  driven rather than asserted: `$(( 092 + 1 ))` → `bash: 092: value too great for base`.

### 3. ⛔ [Rule 1 — my own bug, caught before the register was committed] `git checkout --` is not a restore, and it rewrote 224 bodies

- **Found during:** Task 2, after discovering (Deviation 4) that the emitter needed a fix the
  idempotency guard could not reach.
- **What happened:** I ran `git checkout -- .planning/seeds/` to restore the pre-migration state.
  With `core.autocrlf=true` and no `.gitattributes`, git **re-materialised** all 242 files from the
  index and wrote them CRLF. **224 of 284 body digests moved**, and `git status --porcelain`
  reported the tree **clean** — because the index content is identical either way. It is RED 1b's
  finding fired at me from the other direction.
- **Recovery, measured:** 172 files were already correct; **107 restored byte-exact** by writing the
  HEAD blob (they had been pure LF); **1 more** (`SEED-171`) restored from a copy that happened to
  exist in the scratchpad from the RED 1b drive. **280 of 284 recovered byte-exact.**
- **The residual, stated rather than buried:** 4 files — `SEED-013`, `SEED-144`, `SEED-145`,
  `SEED-194` — lost a working-tree-only line-ending *mixture* that git has never stored. Proven
  inconsequential to anything the repo carries: for all four, `git status --porcelain` is **empty**
  and the working-tree content folds to a byte-identical blob. A fresh clone of this repo has never
  produced that mixture and never will.
- ⛔ **The lesson, which is the reusable half:** `git checkout -- <dir>` is a *re-materialisation*,
  not a restore, and on Windows with `autocrlf=true` it is a silent whole-file rewrite that
  `git status` then calls clean. Use a byte copy if you need the bytes back.

### 4. [Rule 3 — blocking] The idempotency guard is also a "never re-derive" guard, so an emitter fix cannot reach files already written

- **Found during:** Task 2, reading the migration's output on disk: `- **/config.py` was emitted
  **unquoted**, and a bare `*` is YAML's **alias indicator**. Our own tooling reads it (zero YAML
  dependency, by rule), but any other reader of these files gets a parse error — the exact class of
  defect this repo already refuses a YAML library over.
- **The blocker:** `trigger_paths` is derived only when the key is ABSENT (`!present.has(...)`), so
  that a hand-authored trigger is never overwritten. That guard is right — and it means a change to
  the emitter is invisible to the 36 files already carrying the key.
- **Fix:** quote every bullet (`- "**/config.py"`); `unquote` in the imported reader strips them
  again, so the matched value is unchanged — verified: `readList` resolves 36 seeds / 59 globs with
  the quotes gone. The register was restored to the committed baseline and the migration re-run from
  scratch, which also re-proved D-11 end to end on the final bytes.

### 5. [decision] `trigger_phase_touches` is named only in the gate, not in `TEMPLATE.md`

The plan's criterion is a literal `grep -n "trigger_phase_touches" TEMPLATE.md` returning nothing,
while this repo's S-6 convention says to name what was rejected. Both are honoured: `TEMPLATE.md`
states that *a third matching axis keyed on phase NUMBERS is deliberately absent*, gives the
measurement (31 seeds name a phase as HISTORY, not as a trigger), and points at the comment in
`check-seeds-register.cjs` where the key's actual name is written out — so the template cannot
suggest a key you may write, and the knowledge stays greppable one file over.

### 6. [decision] `REG-01` and `REG-02` were NOT marked complete

The plan's frontmatter carries `requirements: [REG-01, REG-02]`. Both were left `Pending`, following
Wave 1's precedent and for the same reason: **REG-01 is duplicate resolution and 8 collisions still
stand (Plan 03); REG-02's deliverable is the WIRING (D-03), which is Plan 04.** Ticking either here
would put a false record in the register this phase exists to make truthful.

---

## S-5 — both sync pairs, compared as SORTED SETS rather than by eye

```
status enum — TEMPLATE.md vs the gate
  TEMPLATE.md (10): answered closed deferred dormant folded open partially-answered planted shipped superseded-id
  gate        (10): answered closed deferred dormant folded open partially-answered planted shipped superseded-id
  tpl - gate : []        gate - tpl : []

trigger_surfaces vocabulary — TEMPLATE.md vs migrate-seeds-frontmatter.cjs
  TEMPLATE.md (15): admin auth chat connectors deployment harness ingestion library panel provider retrieval sandbox settings skills workflow
  migrate     (15): admin auth chat connectors deployment harness ingestion library panel provider retrieval sandbox settings skills workflow
  tpl - src  : []        src - tpl  : []
```

**And there are exactly TWO copies of the vocabulary in the repo, asserted rather than left to a
reader.** The gate reads the `trigger_surfaces` KEY (4 occurrences) but holds no member list —
checked by grepping it for the three rarest members together (`harness`, `ingestion`, `sandbox`):
**0 lines**. Same check on `plant-seed.md`: **0 lines**; its `trigger_surfaces` line carries the
comment `# controlled enum — see .planning/seeds/TEMPLATE.md`. The reason is structural and is
written into `TEMPLATE.md`'s sync section in words: the gate matches a seed's surfaces against **the
surfaces a PHASE declares**, never against an enum of its own. ⚠ If a later phase adds an
`[unknown-surface]` code, the pair becomes a triple — and `TEMPLATE.md` says so.

⚠ `.planning/seeds/TEMPLATE.md` is deliberately named so `SEED-\d{3}-.*\.md` does not match it.
Confirmed: the register census is **284** both before and after it was created.

---

## Carried findings for Plans 03 and 04

### ⭐ 1. Plan 03's id range has EXACTLY ZERO headroom — measured, not assumed

```
  distinct ids: 276   highest: 285
  ids 277-285 that are TAKEN: 285
  the first 9 FREE ids at or above 277: 277, 278, 279, 280, 281, 282, 283, 284, 286
```

D-05 says *"renumber the younger seed of each pair to a fresh id (`277`+)"*. **That works — 277
through 284 are free and there are exactly eight of them for eight renumbers.** ⛔ But `285` is
TAKEN, so a ninth renumber must jump to **286**, and Plan 03 must not assume a contiguous run.

### 2. The `status: superseded-id` carve-out is live and matches zero files today

`STATUS_ENUM` contains it, `STATUS_MAP` maps it to itself, `TEMPLATE.md` lists it, and
`duplicateGroups()`'s carve-out is driven by the gate's own arm 1b. Plan 03's eight stubs will
therefore read as resolutions, not as eight new regressions — on a path that has been exercised.

### 3. ⚠ `.claude/get-shit-done/` is a VENDORED framework at v1.42.3 — this edit is a re-apply risk

`plant-seed.md` is a vendored workflow file. A future `chore(gsd): apply the pending GSD framework
update` can revert it, taking the allocator and the contract block with it. **Precedent: `9d3d887de`
(the G-7 wiring) survived one framework update.** Accepted, not eliminated. ⛔ **Plan 04 records the
wiring sites in CLAUDE.md — name `plant-seed.md` there too**, alongside `discuss-phase.md` and
`new-milestone.md`, so all three can be re-applied together rather than rediscovered one at a time.

### 4. `check-hot-file-ledger.cjs 251` is still green because it checks NOTHING

```
  scan list: 281 rows · subject: 17 files · watched: 0
ledger gate OK — every watched file has a row.       exit=0
```

Unchanged from Wave 1, and recorded for the same reason: `watched: 0` beside `subject: 17` means
*"nothing was checked"*, not *"everything checked out"*. This plan modifies no product source, so no
ledger row is owed and **none was invented for tooling**.

### 5. `CLAUDE.md` is at 100,572 chars (was 99,021) — measured with the gate, never `wc`

```
  CLAUDE.md    100572 chars    67% of limit    headroom 49428    [OK]
claude-md size gate OK
```

`+1,551` for the correction. The struck-through original was kept and the surrounding prose was
replaced rather than only appended to, per T-251-13.

---

## Verification

| # | Check | Result |
|---|---|---|
| 1 | body-digest SET, independently derived, diffed both directions | **0 / 0** across 284 files |
| 2 | second `--apply` | **`0 files changed`**, exit **0** |
| 3 | `check-seeds-register.cjs` | `[missing-key]` **0** · `[unknown-status]` **0** · `[no-frontmatter]` **0** · `[duplicate-id]` **8** · exit **1** (expected) |
| 4 | seeds carrying all 5 required keys | **284 / 284** (was 73) |
| 5 | distinct `status` values | **9**, all enum members; 284 status lines for 284 files |
| 6 | `partial: true` | **15** — D-16's exact figure |
| 7 | duplicate top-level keys introduced | **0** across 284 files |
| 8 | `migrate-seeds-frontmatter.cjs --self-test` | **7/7 PASS**, exit 0 |
| 9 | `check-seeds-register.cjs --self-test` | **6/6 PASS**, exit 0 |
| 10 | `check-claude-md-size.cjs` | exit **0**, 100572 chars |
| 11 | `check-hot-file-ledger.cjs 251` | exit **0**, no `[no-row]` (see Carried finding 4) |
| 12 | S-5 sync pairs as sorted sets | both empty, both directions |
| 13 | mutation checks A and B | both exit **2** with their own signal; register untouched |
| 14 | file deletions in the register commit | **0** |
| 15 | dry run leaves `git status --porcelain .planning/seeds/` | **empty** |

## Self-Check: PASSED

```
FOUND: scripts/migrate-seeds-frontmatter.cjs
FOUND: .planning/seeds/TEMPLATE.md
FOUND: 08a1cd000
FOUND: cd0d3fa3b
FOUND: eff1afa7e
```

## TDD Gate Compliance

Plan-level `type: execute` with one `tdd="true"` task. Commit sequence is `feat` → `feat` → `docs`,
**with no `test(...)` commit**, and that is stated rather than hidden. The reason is the same one
Wave 1 recorded: there is no test framework for `scripts/*.cjs` in this repo. What replaces it here
is stronger than a commit label — **`--self-test` is committed inside the script itself at
`08a1cd000`, so all seven arms are re-runnable forever**, and three of them (3, 5, 7) exist only to
assert refusals. The RED drives were executed **before** each behaviour was trusted: RED 1 before
the file existed at all, RED 2 and RED 3 against planted single-line defects, both transcripts
captured verbatim above and the scratch copies deleted. **RED 3 is the one that earns the label** —
it proved that six of seven arms would have shipped green over a migration whose central guarantee
had become a no-op.
