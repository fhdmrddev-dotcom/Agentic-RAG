# Phase 251: Register Integrity — Research

**Researched:** 2026-09-15 (all measurements taken this date)
**Tree:** `develop` @ `0fa2674cd`, working tree as described in `git status` at session start
**Domain:** repository-local register hygiene — YAML-ish frontmatter, Node CJS gate scripts, shell hooks, GSD workflow wiring
**Confidence:** HIGH on everything measured (every number below names the command that produced it). No web research was used or needed; D-01's glob question is settled by a local measurement (§4.6).

---

## Summary

This was a measurement pass over the local repository. **Every headline number in `251-CONTEXT.md` that I re-derived is CONFIRMED** — 283 seeds, highest id 276, the 8 duplicate ids, the key-presence census (`status` 278 / `title` 254 / `seed_id` 177 / `trigger_when` 157 / `relates_to` 144 / `surface` 128), the 5 status-less seeds, and all three bus counts (5 `to:operator` / 26 `to:gemini` / 1 `to:claude`) to the exact item ids.

**Eight findings materially change the plan.** In rough order of how much they move it:

1. **`.planning/seeds/TEMPLATE.md` DOES NOT EXIST.** CONTEXT.md lists it as a canonical file that "must be updated in the same commit as D-09/D-10". It must be **created**, not updated. (§1.2)
2. **D-02's backfill cannot be scripted at the rate D-02 assumes.** Only **20 of 157** `trigger_when` prose values name a full repo path; **45** name any path-or-filename; **33 name nothing extractable at all**. After a mechanical backfill the honest "unswept" count is ~**238 of 283**, not the 126 D-02 anticipates. (§3.3)
3. **D-03's two named wiring files are thin routers with nowhere to put a step.** `.claude/commands/gsd/discuss-phase.md` (76 lines) and `new-milestone.md` (45 lines) contain zero steps — they delegate to `.claude/get-shit-done/workflows/`. The wiring must land there. There is exactly one precedent (`9d3d887de`, the G-7 wiring) and it survived a later framework update. (§5.1–5.3)
4. **`/gsd:new-milestone` ALREADY has a seeds sweep** — `## 2.5. Scan Planted Seeds` — and it explicitly **forbids** what CLAUDE.md mandates: *"never delete or modify seed files during this workflow."* D-03 must resolve a live contradiction, not fill a void. (§5.4)
5. **The root cause of the collisions is a concrete, still-live bug**, not two agents guessing: `plant-seed.md` allocates `count(files) + 1`, not `max(id) + 1`. Today it would emit **`SEED-284`**, not D-08's expected `277`. (§5.5)
6. **D-07 is not deterministic on 2 of 8 pairs and names a key most seeds lack.** `SEED-231` and `SEED-253` tie on the same `created`/`planted` day; and D-07 says "by `created` date" while 5 of the 8 pairs carry only `planted:` (`created` is present in just 99 of 283). On the heaviest pair (`SEED-253`), D-07 hands the id to the seed that essentially nothing references. (§2.4)
7. **D-10's enum cannot express 27 of 278 seeds**, and 13 of those are `partially-folded` / `partially-shipped` / `shipped-in-part` — the exact "partially" distinction D-10 says it is deliberately preserving for `answered`. (§2.2)
8. **The Phase-242 vacuous-pass defect is guarded on the scan-set side and NOT on the subject side** in `check-hot-file-ledger.cjs`. A newer sibling, `check-verification-honesty.cjs`, does floor the subject set (`MIN_SUBJECT_FILES`) — that is the pattern D-04 should copy. (§4.4)

**Primary recommendation:** plan this as **4 plans**, cut at the three boundaries that are structurally real (§9): the gate + its RED drives; the 283-file frontmatter migration; the duplicate renumber + stubs; and the wiring/prose/bus work. The migration and the gate genuinely cannot share a worktree — the gate's RED drives require planting defects into the very files the migration rewrites.

---

## 1. Measured facts, with commands

All run from the repo root on 2026-09-15 at `0fa2674cd`.

### 1.1 Register size and shape — CONFIRMED

```bash
ls .planning/seeds/*.md | wc -l                                            # 283
ls .planning/seeds/ | grep -v '^SEED-'                                     # (empty)
ls .planning/seeds/ | sed -n 's/^SEED-\([0-9]\{3\}\).*/\1/p' | sort -n | tail -1   # 276
ls .planning/seeds/ | sed -n 's/^SEED-\([0-9]\{3\}\).*/\1/p' | sort -u | wc -l     # 275
ls .planning/seeds/ | sed -n 's/^SEED-\([0-9]\{3\}\).*/\1/p' | sort | uniq -c | awk '$1>1'
#   2 022 · 2 092 · 2 228 · 2 229 · 2 231 · 2 253 · 2 259 · 2 269
```

| Quantity | Value | Agrees with CONTEXT.md? |
|---|---|---|
| `.md` files in `.planning/seeds/` | **283** | ✅ |
| Distinct numeric ids | **275** | (not stated) |
| Highest allocated id | **276** | ✅ |
| Duplicate ids | **8**, exactly the named set | ✅ |
| Gaps in `001..276` | **exactly one — `SEED-016` does not exist** | ⭐ new |

The arithmetic closes: `275 distinct = 276 max − 1 gap`, and `283 files = 275 distinct + 8 duplicate partners`.

### 1.2 ⛔ DISAGREEMENT — `.planning/seeds/TEMPLATE.md` does not exist

```bash
ls -la .planning/seeds/TEMPLATE.md
#   ls: cannot access '.planning/seeds/TEMPLATE.md': No such file or directory
ls .planning/seeds/ | grep -i templ                        # (no output)
ls -la .planning/reported-bugs/TEMPLATE.md                 # exists, 2422 bytes
```

`251-CONTEXT.md` § *Canonical References* lists it as: *"`.planning/seeds/TEMPLATE.md` — ⚠ must be updated in the same commit as D-09/D-10."* **There is nothing to update.** The same-commit obligation is real and D-09's reasoning holds — *the very next seed authored re-introduces the defect the backfill just removed* — but the task is **creation**, and the file must be created against the D-09/D-10 contract with `.planning/reported-bugs/TEMPLATE.md` as its model (§6.3).

⚠ There is a second, quieter consequence: because no template exists, **the frontmatter contract has never had a written home**, which is a sufficient explanation on its own for 40+ status spellings and 106 seeds with no `seed_id`. D-09 is not tightening a loose rule; it is writing the first one.

### 1.3 Key presence — CONFIRMED exactly

Parsed with a hand-rolled reader (`scratchpad/parse.cjs`) that takes a top-level key as `^([A-Za-z_][A-Za-z0-9_-]*):` inside the fenced block:

| Key | Present | CONTEXT.md says | Verdict |
|---|---|---|---|
| `status` | **278** | 278 | ✅ |
| `title` | **254** | 254 | ✅ |
| `seed_id` | **177** | 177 | ✅ |
| `trigger_when` | **157** | 157 | ✅ |
| `relates_to` | **144** | 144 | ✅ |
| `surface` | **128** | 128 | ✅ |

Other keys worth knowing about (full census in the parse output): `priority` 229, `planted` 178, `category` 130, `planted_during` 122, `related_seeds` 111, `id` 101, `created` 99. **91 distinct keys appear across the register**, 40 of them in exactly one file — this is an unconstrained namespace, which is what D-09 is for.

⭐ Two keys already exist that the plan should reuse rather than invent: **`status_note`** (1 file) and **`renumbered_from` / `renumbered_because`** (1 file — see §2.5).

### 1.4 The `surface` filter blindness — CONFIRMED, and narrower than it looks

```bash
grep -h '^surface:' .planning/seeds/*.md | sed 's/\r$//' | sed 's/^surface:[[:space:]]*//' | sort | uniq -c | sort -rn
#   127 Agentic-RAG
#     1 Agentic-RAG / retrieval / database
```

**Only two distinct values exist, and both begin `Agentic-RAG`.** So CLAUDE.md's `surface: Agentic-RAG` filter fails on **absence**, never on a competing value — which makes D-09's `surface` default (`Agentic-RAG`) provably safe: there is no rival surface in this register to mis-assign a seed to. ⚠ The one compound value would fail an exact-equality match; the gate's comparison should be a prefix/membership test or the value should be normalised by the migration.

### 1.5 Bus queue — CONFIRMED to the item, counted with `grep -c`

```bash
grep -cE '^### \[OPEN\].*to:operator' .agent-bus/OPEN.md   # 5
grep -cE '^### \[OPEN\].*to:gemini'   .agent-bus/OPEN.md   # 26
grep -cE '^### \[OPEN\].*to:claude'   .agent-bus/OPEN.md   # 1
grep -cE '^### \[OPEN\]'              .agent-bus/OPEN.md   # 32
grep -oE '^### \[[A-Z]+\]' .agent-bus/OPEN.md | sort | uniq -c   # 212 CLOSED · 32 OPEN
```

```
### [OPEN] BUS-040 · to:operator · from:claude · 2026-08-31
### [OPEN] BUS-208 · to:operator · from:claude · 2026-09-13
### [OPEN] BUS-246 · to:operator · from:claude · 2026-09-14
### [OPEN] BUS-247 · to:operator · from:claude · 2026-09-14
### [OPEN] BUS-248 · to:operator · from:claude · 2026-09-15
```

Every REG-03 figure in CONTEXT.md holds: **5 / 26 / 1 = 32 open, 212 closed.** Oldest `to:operator` is `BUS-040` at 2026-08-31 → **15 days** on 2026-09-15, which matches D-14's illustrative line `5 open to:operator, oldest 15 days` exactly.

### 1.6 ⚠ DISAGREEMENT — `agent-bus.sh list` has no 20-row cap

CONTEXT.md § *Canonical References* states: *"⚠ **`list` prints at most 20 rows**."* Measured at HEAD, `cmd_list` (`scripts/agent-bus.sh:71-103`) loops over **every** line matching its pattern with no `head`, no counter limit and no cap of any kind:

```bash
sed -n '71,103p' scripts/agent-bus.sh      # no head/cap anywhere
grep -n '20\|head -\|MAX' scripts/agent-bus.sh   # only a comment on line 140
```

The claim is stale. **The underlying advice remains correct and I followed it** — every count in this document comes from `grep -c`, never from `list`. But a plan that cites the 20-row cap as a live reason will be citing something that is no longer true.

### 1.7 ⚠ DISAGREEMENT — the duplicate-id reference totals are larger than CONTEXT.md records

⚠ **Method note, because it nearly produced a wrong number here too:** `rg` **skips dot-directories by default**, so `rg 'SEED-253' .` silently returns nothing from `.planning/`. Every count below uses `--hidden`. My first pass without it reported `archive_occ=0` for all eight ids, which is how a confident zero gets published.

```bash
rg --hidden -l 'SEED-(022|092|228|229|231|253|259|269)' \
   -g '!.planning/seeds/**' -g '!**/node_modules/**' -g '!backend/venv/**' \
   -g '!**/__pycache__/**' -g '!backend/logs/**' . | wc -l          # 144 files
rg --hidden -o 'SEED-(022|092|228|229|231|253|259|269)' (same globs) . | wc -l   # 559 occurrences
rg --hidden -l '…' .planning/milestones/ | wc -l                     # 90 archive files
rg --hidden -o '…' .planning/milestones/ | wc -l                     # 403 archive occurrences
```

| | CONTEXT.md | Measured 2026-09-15 |
|---|---|---|
| Referencing files (excl. seeds) | 130 | **144** |
| Occurrences | 448 | **559** |
| Inside `.planning/milestones/` | 378 (84%) | **403 (72%)** |
| **Live (non-archive, non-seed)** | "~70 occurrences" | **156 occurrences across 54 files** |

**The per-id table in CONTEXT.md is essentially right** (within ±2 files on every row) and its *ordering* is exactly right — `253` heaviest at 53 files, `269` lightest at 8. **D-05 and D-06 are unaffected in substance:** archives still hold the clear majority, so not rewriting them remains correct, and the redirect stub is still what keeps them followable.

**What IS affected is the size of the live edit.** It is roughly **double** what CONTEXT.md budgets — and §1.8 explains where the extra lives.

### 1.8 ⛔ FINDING — ~half the live duplicate-id references sit in files this phase may not touch

```bash
rg --hidden -o 'SEED-(022|092|228|229|231|253|259|269)' \
   backend/app backend/tests frontend/src scripts -g '!**/__pycache__/**' | wc -l   # 84
rg --hidden -l '…' backend/app backend/tests frontend/src scripts … | wc -l          # 33 files
```

**84 of the 156 live occurrences (54%), across 33 files, are in product source, backend/frontend tests, and `scripts/`.** The phase boundary states plainly: *"No product source file is touched."* D-06's list of live files to update names `.planning/seeds/`, `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `.planning/phases/`, `CLAUDE.md`, `docs/` — **and does not name `backend/`, `frontend/` or `scripts/` at all.**

The heaviest concentrations:

| File | id | refs |
|---|---|---|
| `backend/app/services/sources/adapters/mcp_source.py` | SEED-259 | 11 |
| `frontend/src/components/settings/connectionFormCopy.ts` | SEED-259 | 8 |
| `backend/tests/unit/services/sources/test_source_adapter_conformance.py` | SEED-253 | 6 |
| `backend/tests/unit/services/sources/test_259_argument_shapes_are_rows_too.py` | SEED-259 | 5 |
| `frontend/src/components/settings/__tests__/ConnectionFormPanel.argumentMapping.test.tsx` | SEED-259 | 4 |
| `backend/app/services/sources/adapters/microsoft_graph.py` | SEED-253 | 4 |
| `scripts/vitest-count-gate.cjs` | SEED-229 | 3 |
| `frontend/src/components/layout/attentionConditions.ts` | SEED-231 | 3 |

⭐ **The good news, and it is decisive: for BOTH heavily-referenced ids, D-07 happens to keep the id on the seed the source code means — for 259, and NOT for 253.**

- **`SEED-259`** — source refs all mean `tool-names-are-rows-but-argument-shapes-are-not` (`created: 2026-09-08`), which is the **older** seed and therefore **keeps** its id under D-07. Nothing in `backend/` or `frontend/` needs to change. There is also a test **filename** `test_259_argument_shapes_are_rows_too.py` — it stays correct. ✅
- **`SEED-253`** — every live source and test reference means `source-file-path-is-synthetic-no-adapter-populates-it`, which D-07 makes the **younger** seed (see §2.4). **Those 25+ source/test references would become wrong**, and the phase is forbidden to fix them.

**This is a genuine collision between two locked decisions (D-05/D-07 and the phase boundary), and it is not resolvable by research.** The planner must surface it. Three honest shapes, in preference order:

1. **Let D-05's redirect stub carry it.** The stub is exactly the mechanism for references you will not rewrite — it works identically for an archived plan and for a source comment. Add one sentence to the plan recording that 33 source/test files are *deliberately* left pointing at the stub. **Costs nothing, changes no locked decision, and is what D-05 is for.**
2. **Narrow exception** for comment-only, non-executing references (all 84 are comments or test docstrings — none is an identifier or a filename except the `259` one that stays valid). This touches product files but changes zero bytes of executable code. Needs an operator ruling against the boundary.
3. ⛔ Departing from D-07 on the `253` pair — **not recommended**, and D-07 pre-emptively rejects "most-referenced keeps it" by name.

### 1.9 ⛔ LINE ENDINGS — 159 of 283 seeds contain CR, and 6 are MIXED

This is the single highest-risk measurement in the document, and my own first two attempts disagreed with each other. The authoritative count is byte-level, via Node, with no shell or `grep` involvement:

```bash
node -e '/* count 0x0D and 0x0A per file across .planning/seeds */'
#   pure CRLF: 153   pure LF: 124   MIXED: 6
```

| | Count |
|---|---|
| Pure CRLF | **153** |
| Pure LF | **124** |
| ⛔ **MIXED (both bare LF and CRLF in one file)** | **6** |

The six mixed files, with their LF and CRLF line counts:

```
SEED-013-external-integrations-api-mcp.md                                LF=215 CRLF=202
SEED-144-provider-shaped-connections-oauth.md                            LF=158 CRLF=145
SEED-145-connections-are-platform-assets-not-workflow-assets.md          LF=133 CRLF=120
SEED-171-workflows-library-suites-flake-independent-of-cap.md            LF=589 CRLF=553
SEED-193-agent-authored-interactive-artifacts-closed-component-vocab….md LF=111 CRLF=96
SEED-194-image-generation-as-a-tool-any-endpoint.md                      LF=107 CRLF=92
```

Git-side context:

```bash
cat .gitattributes                  # (no .gitattributes)
git config core.autocrlf            # true
git show HEAD:.planning/seeds/SEED-001-scale-readiness.md | <byte count>
#   CR=0 LF=162  => the repo stores LF; autocrlf converts on checkout
```

**No `.gitattributes` exists and `core.autocrlf=true`.** So git stores LF and the working tree carries CRLF for most files. Consequences the executor must be told (§8.2, §8.3).

⭐ **And this is exactly the Phase-242 class.** `check-hot-file-ledger.cjs` normalises CRLF in `planFiles()` *specifically because* a CRLF plan made it exit `0` over zero parsed files. The seeds register is **56% CRLF with 6 mixed files** — any new parser that is not CRLF-aware from line one will reproduce that defect at scale.

### 1.10 Frontmatter malformation — 5 files, and it is exactly the 5 with no `status`

```bash
for f in .planning/seeds/*.md; do
  [ "$(head -1 "$f" | tr -d '\r')" = "---" ] || echo "NO-LEADING---: $f"
done
```

| Finding | Count |
|---|---|
| First line is `---` **and** a closing `---` exists | **278** |
| No leading `---` (no frontmatter block at all) | **5** |
| Leading `---` but no closing `---` | **0** |
| BOM (`EF BB BF`) | **0** |
| Empty body | **0** |

The five are **exactly** `SEED-084`, `SEED-163`, `SEED-164`, `SEED-165`, `SEED-166` — the same five CONTEXT.md names as carrying no `status`. ⭐ **That is not a coincidence and it simplifies the plan:** they do not have a frontmatter block with a missing key, **they have no frontmatter block at all.** Their first line is the H1. D-09 must **prepend** a complete block to 5 files and **add keys to** 278 — two different code paths, and the md5 body contract (§7) means the whole current file becomes the body for those five.

```
SEED-084-starter-workflow-library.md                             CRLF   49 lines
SEED-163-authoring-does-not-propose-the-business-requirement.md  CRLF  233 lines
SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md     CRLF  170 lines
SEED-165-top-level-backend-tests-are-outside-every-gate.md       CRLF  206 lines
SEED-166-settings-operator-admin-information-architecture.md     CRLF  120 lines
```

### 1.11 Gate readings at research time

```bash
node scripts/check-claude-md-size.cjs
#   CLAUDE.md   99021 chars   66% of limit   headroom 50979   [OK]
#   claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.

node scripts/check-hot-file-ledger.cjs 251
#   FATAL: no *-PLAN.md in …\.planning\phases\251-register-integrity     (exit 2)
```

**CLAUDE.md has 20,979 chars of headroom to the 120k warn band and 50,979 to the hard limit** — D-09's CLAUDE.md correction has ample room, but must still be re-measured with this command (never `wc`) per CLAUDE.md's own rule.

⚠ The ledger gate **cannot yet be evaluated** for this phase — it exits `2` because no `*-PLAN.md` exists. CONTEXT.md's prediction (*"should come back clean"*) is **sound but untested**: the gate's `WATCHED` list is `[/^backend\/app\//, /^frontend\/src\//]` only, and its `EXEMPT` list includes `/^\.planning\//`, `/^scripts\//`, `/^docs\//` and `\.(md|…)$`. Every file this phase touches falls outside `WATCHED`. Re-run it once plans exist.

---

## 2. Q1 — the complete `status:` → enum mapping table

### 2.1 The exhaustive raw corpus

```bash
grep -h '^status:' .planning/seeds/*.md | sed 's/\r$//' \
  | sed 's/^status:[[:space:]]*//' | awk '{print $1}' | sort | uniq -c | sort -rn
```

**25 distinct first tokens across 278 files.** Of the raw lines, **252 are a bare token** and **26 carry trailing prose** (`awk 'NF==1'` → 252, `awk 'NF>1'` → 26).

### 2.2 The mapping table — EXHAUSTIVE

D-10's enum: `planted | dormant | open | partially-answered | answered | folded | shipped | closed | deferred | superseded-id`

| # | Raw token | Files | Proposed enum | Ruling needed? |
|---|---|---|---|---|
| 1 | `planted` | **161** | `planted` | — clean |
| 2 | `open` | **40** | `open` | — clean |
| 3 | `closed` | **15** | `closed` | — clean |
| 4 | `folded` | **13** | `folded` | — clean |
| 5 | `dormant` | **6** | `dormant` | — clean |
| 6 | `partially-answered` | **5** | `partially-answered` | — clean |
| 7 | `answered` | **5** | `answered` | — clean |
| 8 | `shipped` | **3** | `shipped` | — clean |
| 9 | `deferred` | **3** | `deferred` | — clean |
| 10 | `partially-folded` | **7** | `folded`? | ⛔ **RULING — destroys the "partially" distinction** |
| 11 | `partially-shipped` | **4** | `shipped`? | ⛔ **RULING — same** |
| 12 | `promoted` | **2** | `folded`? | ⛔ **RULING — no enum member** |
| 13 | `DONE` | **2** | `shipped`? `closed`? | ⛔ **RULING — the objective's own example** |
| 14 | `shipped-in-part` | 1 | `shipped`? | ⛔ **RULING — same class as #11** |
| 15 | `partially-resolved` | 1 | `answered`? | ⛔ RULING |
| 16 | `partial-consumed` | 1 | `partially-answered`? | ⛔ RULING |
| 17 | `partial` | 1 | `partially-answered`? | ⛔ RULING |
| 18 | `resolved` | 1 | `closed`? `answered`? | ⛔ RULING |
| 19 | `fixed` | 1 | `closed`? | ⛔ RULING |
| 20 | `done` | 1 | same as #13 (case variant) | ⛔ RULING — and **case-folding must be an explicit rule** |
| 21 | `routed` | 1 | `folded`? | ⛔ **RULING — no enum member** |
| 22 | `scheduled` | 1 | `open`? `deferred`? | ⛔ **RULING — no enum member** |
| 23 | `queued` | 1 | `open`? `deferred`? | ⛔ **RULING — no enum member** |
| 24 | `in_progress` | 1 | `open`? | ⛔ **RULING — no enum member** |
| 25 | `active` | 1 | `open`? | ⛔ **RULING — no enum member** |
| — | `superseded-id` | **0** | (new, for D-05 stubs) | — |

**9 tokens covering 251 files (90.3%) map 1:1 and need no judgement.**
**16 tokens covering 27 files (9.7%) fit no enum member and need a ruling.**

### 2.3 ⛔ THE FINDING — D-10's enum cannot express the "partially" family it says it is protecting

D-10's own words: *"⚠ `partially-answered` vs `answered` is a distinction this project uses **deliberately**; a 3-value collapse was rejected for exactly that reason."*

Measured, the register uses that same deliberate distinction on **four more axes** the enum has no slot for:

| Family | Spellings | Files |
|---|---|---|
| partially-**folded** | `partially-folded` | 7 |
| partially-**shipped** | `partially-shipped`, `shipped-in-part` | 5 |
| partially-**resolved** | `partially-resolved` | 1 |
| partial / consumed | `partial`, `partial-consumed` | 2 |
| | **total** | **15** |

Mapping `partially-folded` → `folded` asserts a seed is fully folded when its own frontmatter says half of it is pending. `SEED-082`'s value spells the loss out: *"partially-folded (102 half folded at Phase 102 … 103 half — builder UX, model-fit routing, per-run override — stays pending its own trigger)"*.

**This is a locked decision that cannot be implemented as written without destroying information D-10 exists to preserve.** Three options for the operator, and the third is cheapest:

1. **Widen the enum by two** — add `partially-folded` and `partially-shipped`. Covers 12 of 15. Smallest change to the register, largest to D-10's text.
2. **Map down and rely on `status_note`** — every "partially" becomes its base value, with the qualifier preserved verbatim in `status_note`. Honours D-10 literally; ⚠ but a scan filtering `status: folded` would then silently include half-open seeds, which is REG-02's failure mode in a new costume.
3. ⭐ **Add one generic member — `partially-` as a prefix convention, or a single boolean sibling key `partial: true`.** Preserves the distinction on every axis, adds one concept rather than four, and the gate can then validate `status ∈ enum` independently of `partial`.

**Recommended: option 3**, presented alongside 1 and 2. It is the only one that does not need re-opening as soon as a `partially-deferred` appears.

⚠ Note also **`promoted` (2), `routed` (1), `scheduled` (1), `queued` (1), `in_progress` (1), `active` (1)** — 7 files whose tokens describe *where a seed went* rather than *how settled it is*. `promoted` and `routed` in particular are near-synonyms of `folded` but were chosen deliberately by their authors. The plan must list each one's target explicitly, per D-10's own instruction, and `SEED-100`/`SEED-101`'s `promoted` should be read before mapping — they may mean "became a requirement", which is `folded` with a different destination key.

### 2.4 The split rule — UNAMBIGUOUS across all 278

**Proposed rule: the status VALUE is the first whitespace-delimited token; `status_note` is everything after it, with leading whitespace stripped and the remainder preserved byte-for-byte.**

Verified against all 26 prose-carrying lines:

```bash
grep -h '^status:' .planning/seeds/*.md | sed 's/\r$//' | sed 's/^status:[[:space:]]*//' \
  | awk 'NF>1' | sed -E 's/^([^[:space:]]+)([[:space:]]+)(.).*/token=[\1] gap=[\2] firstNoteChar=[\3]/' \
  | sort | uniq -c | sort -rn
```

| First char of the note | Files | Meaning |
|---|---|---|
| `#` | **21** | already a YAML comment — a real YAML parser discards it today |
| `(` | **3** | prose **inside the value** (`queued (v3.1 — re-scoped)`, `partially-folded (102 half…)`, `active (v3.0 — in progress)`) |
| `✅` / `—` | **2** | prose inside the value (`DONE ✅ — backend implemented…`, `DONE — VERIFIED LIVE…`) |

**No status value anywhere in the register legitimately contains a space** — every one of the 25 tokens is a single word or hyphenated compound (full list in §2.2). The separator is always a run of ≥1 space. **The rule is unambiguous across all 278 and there is no file where it fails.**

⭐ Two useful consequences:

- **Only 5 files actually need the `status_note` move to avoid data loss** — the `(`-prefixed and `✅`/`—`-prefixed ones, where the prose sits in the value. For the other 21 the prose is already a YAML comment. D-10 says move it regardless; that is fine and more consistent, but the plan should know that 21 of the 26 moves are cosmetic and 5 are load-bearing.
- **A naive YAML-library parse would have silently produced the right value for 21 files and the wrong one for 5** — which is precisely why the house rule forbids a YAML dependency (§4.3).

### 2.5 ⭐ Prior art — this project has renumbered a colliding seed TWICE

```bash
grep -rn 'renumbered_from\|renumbered_because' .planning/seeds/*.md
#   SEED-224-…:8: renumbered_from: SEED-217
#   SEED-224-…:9: renumbered_because: >
sed -n '1,3p' .planning/seeds/SEED-068-public-benchmark-scoreboard.md
#   seed_id: SEED-068  # renumbered from SEED-063 at v2.8 audit close-out 2026-06-07
#                      # (ID collision with SEED-063-execute-code-wallclock-timeout)
```

| Precedent | Form | Quality |
|---|---|---|
| `SEED-063` → `SEED-068` (2026-06-07) | inline `#` comment inside the `seed_id` value | ⛔ poor — it is why `seed_id` disagrees with the filename in that file (§6.2) |
| `SEED-217` → `SEED-224` | structured `renumbered_from:` + `renumbered_because:` keys | ⭐ **this is the shape D-05 should copy** |

**Neither left a redirect stub**, so D-05's stub is genuinely new work — but the *renumber* half has a clean, already-in-register key vocabulary that the plan should adopt verbatim rather than inventing `superseded_by`/`moved_to`.

### 2.6 ⛔ D-07 — two pairs are a TIE, and the rule names a key most seeds lack

```bash
for id in 022 092 228 229 231 253 259 269; do
  for f in .planning/seeds/SEED-$id-*.md; do
    grep -m1 -E '^(created|planted):' "$f"
    git log --diff-filter=A --format=%ad --date=short -- "$f" | tail -1
  done
done
```

| id | Seed | Date key + value | Git-add | D-07 verdict |
|---|---|---|---|---|
| **022** | `camelot-pdf-table-precision-audit` | `planted: 2026-05-16` | 2026-05-16 | ⭐ **keeps** |
| | `timeout-settings-ui` | `planted: 2026-05-25` | 2026-05-24 | moves |
| **092** | `app-wide-wcag-aa-contrast…` | `planted: 2026-06-20` | 2026-06-20 | ⭐ **keeps** |
| | `remainder` | `planted: 2026-07-16` | 2026-07-16 | moves |
| **228** | `a-workflow-cannot-say-the-whole-library…` | `planted: 2026-08-28` | 2026-08-28 | ⭐ **keeps** |
| | `read-doc-refuses-a-docx…` | `planted: 2026-08-31` | 2026-09-01 | moves |
| **229** | `does-the-golden-run-hang…` | `planted: 2026-08-28` | 2026-08-28 | ⭐ **keeps** |
| | `five-suites-in-neither-count-gate-knob` | `planted: 2026-08-31` | 2026-09-01 | moves |
| **231** | `decision-coverage-gate-is-blind…` | `planted: 2026-08-29` | **04:00:08** | ⛔ **TIE on the day** |
| | `nobody-is-told-an-approval-is-waiting` | `planted: 2026-08-29` | **05:03:04** | ⛔ **TIE on the day** |
| **253** | `mobile-has-no-drawer-trigger…` | `created: 2026-09-06` | **08:36:22** | ⛔ **TIE on the day** |
| | `source-file-path-is-synthetic…` | `created: 2026-09-06` | **22:00:28** | ⛔ **TIE on the day** |
| **259** | `tool-names-are-rows…` | `created: 2026-09-08` | 2026-09-08 | ⭐ **keeps** |
| | `assistant-narration-repeats-verbatim…` | `created: 2026-09-13` | 2026-09-13 | moves |
| **269** | `explanations-are-noise-in-the-form…` | `created: 2026-09-10` | 2026-09-10 | ⭐ **keeps** |
| | `one-home-for-the-elapsed-formatter` | `created: 2026-09-11` | 2026-09-11 | moves |

**Three problems with D-07 as written:**

1. ⛔ **It says "by `created` date", but `created` is present in only 99 of 283 seeds** (`grep -lE '^created:' | wc -l` → 99; `planted:` → 178; neither → **6**). **Five of the eight pairs carry only `planted:`.** The rule must read *"by `created` if present, else `planted`"*, and the gate must encode that fallback or it will fail to evaluate its own rule on 5 of 8 cases.
2. ⛔ **Two pairs — `231` and `253` — tie on the same day and D-07 gives no tie-break.** Resolved here by the add-commit timestamp, which is deterministic, auditable and already in the repo:
   - `SEED-231` → `decision-coverage-gate-is-blind…` is older by **63 minutes** (`283c624a9` 04:00:08 vs `f2240eaec` 05:03:04) → **keeps the id**.
   - `SEED-253` → `mobile-has-no-drawer-trigger…` is older by **13h 24m** (`834502ffc` 08:36:22 vs `3afada84f` 22:00:28) → **keeps the id**.
   **Recommend the plan adopt `git log --diff-filter=A --format=%ad --date=iso` as D-07's explicit tie-break** and say so in writing. It is derived, not judged, which is what D-07 is optimising for.
3. ⚠ **Frontmatter dates disagree with git on two pairs** (`SEED-022-timeout-settings-ui` reads `2026-05-25` but was added `2026-05-24`; both `228`/`229` movers read `2026-08-31` but were added `2026-09-01`). The disagreement never flips a verdict here — but the plan should state which source is authoritative rather than letting the script pick silently. **Recommend: frontmatter date is authoritative; git timestamp is the tie-break only.**

### 2.7 ⚠ The observation CONTEXT.md asked for — D-07 vs reference weight

CONTEXT.md: *"The planner should still **report any pair where D-07 hands the id to the markedly less-referenced seed**, as an observation recorded beside the rule — not as a reason to depart from it."*

**It happens on exactly one pair, and it is the heaviest one.**

**`SEED-253` — 53 referencing files, the heaviest of the eight.** Every live reference I sampled means `source-file-path-is-synthetic-no-adapter-populates-it`:

```bash
rg --hidden -n 'SEED-253' CLAUDE.md docs/ .planning/ROADMAP.md .planning/phases/ -g '!milestones'
#   CLAUDE.md:717            preview_service.py row — "238 re-opened SEED-253 here"
#   docs/HOT-FILE-LEDGER.md  ×4 — all about the fabricated source path
#   .planning/phases/247-…/247-CONTEXT.md:31   "Remote Path Hierarchy … (WATCH-01, WATCH-02, SEED-253)"
#   .planning/phases/247-…/247-CONTEXT.md:117  names the source-file-path file by full path
#   .planning/phases/247-…/.continue-here.md   ×3 — "the SEED-253 Drive-path fence"
```

Plus all 25+ `backend/` source and test references (§1.8). **D-07 moves that seed and leaves the id with `mobile-has-no-drawer-trigger-outside-the-chat-view`, which I found referenced nowhere outside its own file and the archives.**

**Recorded as an observation, not as a reason to depart from D-07** — exactly as CONTEXT.md directs. But it is the case that makes §1.8's stub decision load-bearing: after the renumber, `SEED-253` in `microsoft_graph.py`, `preview_service.py`, `mcp_source.py`, `watch_service.py`, `base.py`, `import_service.py`, `ingest_enrich.py`, `mock_source.py`, `mailbox.py` and five backend test files all point at the stub. **The stub's wording must therefore be good enough to serve a developer reading a code comment**, not just an archived plan — it should name both resolutions and say plainly which one concerns source paths.

---

## 3. Q2 — the `trigger_when` corpus, and what is mechanically extractable

### 3.1 Value shapes — ⛔ a single-line parser sees 29% of the corpus

Classified with `scratchpad/shapes.cjs` over all 157:

| Shape | Count | % |
|---|---|---|
| **`trigger_when: >`** folded block scalar | **78** | 50% |
| Plain single-line scalar | **45** | 29% |
| **YAML list** (`trigger_when:` then `  - …` bullets) | **33** | 21% |
| Mixed / other block | 1 | <1% |
| | **157** | |

The 33 list-shaped values carry **160 bullet items** between them.

⛔ **A parser that reads `^trigger_when:\s*(.*)$` and stops gets an EMPTY STRING for 112 of 157 files (71%)** — the folded scalars and the lists both put the content on continuation lines. This is the single most likely way to build a sweep that silently reports "no trigger" for most of the register.

Examples of each shape, verbatim:

```yaml
# folded (78 files) — SEED-172
trigger_when: >
  Anyone needs to register, tune or time-out a local model (Ollama / LM Studio) through the UI;
  OR the add-model endpoint or the Model Registry provider picker is touched for any reason;
  OR someone needs an LLM call to run longer than 600 seconds.

# list (33 files) — SEED-001
trigger_when:
  - Feature set declared "complete" (no major new feature milestones in flight)
  - Concurrent-user load reported by >10 simultaneous active users in production
  - Latency or queueing complaints from users (P95 response time degradation, "spinner stuck")
```

The one non-conforming file is **`SEED-167-incremental-stateful-workflows-living-register.md`** (classified `BLOCK_OR_MIXED`) — the planner should have the migration script report it by name rather than coerce it.

Median trigger length: **352 characters**. These are paragraphs, not tokens.

### 3.2 Prose kinds — classification over all 157

I read the full extracted text of all 157 (not a sample) via `scratchpad/trig.cjs`, which lifts the complete folded/list/scalar value, then classified by regex and inspected ~40 by eye:

| Kind | Count | % of 157 |
|---|---|---|
| Names a **full repo path** (`backend/app/x.py`, `frontend/src/…`) | **20** | 13% |
| Names a **bare filename** only (`config.py`, `api.ts`) | +25 → **45** | 29% |
| Names a **phase number** ("Phase 238") | 31 | 20% |
| Names **another SEED id** | 39 | 25% |
| Names a **numeric threshold** ("below 90%", ">10 users", "2s/page") | 4 | 3% |
| Names **none of the above** — event / milestone-scope / judgement | **67** | **43%** |

⚠ Categories overlap; a seed can name a path *and* a phase.

### 3.3 ⛔ THE FINDING — D-02's backfill produces far less than D-02 assumes

**D-02 (locked):** *"The backfill reads each existing `trigger_when` and emits `trigger_paths` / `trigger_surfaces` from the paths and surface names it **already names**."*

Measured, what an automated extractor can actually lift:

| Extraction target | Seeds it works on | % of 157 | % of 283 |
|---|---|---|---|
| `trigger_paths` from a **full repo path** — a reliable glob | **20** | 13% | 7% |
| `trigger_paths` from a bare filename (as `**/name.ext`) | **+25 → 45** | 29% | 16% |
| Any extractable token incl. backticks + quoted terms | 124 | 79% | 44% |
| ⛔ **Nothing extractable at all** | **33** | **21%** | 12% |

**The honest arithmetic D-02 needs:**

- 126 seeds have no `trigger_when` → `unset` (D-02 already accounts for these).
- Of the 157 that do, **~112 yield no usable `trigger_paths`** by mechanical extraction.
- ⛔ **So after a fully-automated backfill, roughly 238 of 283 seeds (84%) are still unswept** — not the 126 D-02's gate message anticipates (*"the gate then reports '126 seeds carry no trigger' as a number that must shrink"*).

**This does not refute D-01 or D-02 — it re-sizes them, and the planner must price it in.** Three consequences:

1. **The backfill cannot be a pure script.** It is a script for ~45 seeds and an **assisted pass** for the rest. Budget accordingly, or ship the script and mark the remainder honestly.
2. **The gate's "unswept" number must be the honest one.** If the gate reports `126 carry no trigger` while 238 have no *structured* trigger, the gate is telling a comfortable lie — which is the exact failure REG-02 exists to end.
3. ⭐ **Recommend splitting the number the gate prints into two:** `N seeds carry no trigger_when at all` and `M seeds carry prose but no structured trigger`. Both must shrink; conflating them hides the larger one.

### 3.4 ⚠ `trigger_surfaces` — extractable, but with no shared vocabulary

The 67 "judgement" triggers are not shapeless. Most follow a recognisable template — *"planning a milestone scoped to "A", "B", "C""* — and **53 of 157 (34%) contain at least one double-quoted term**; 60 contain a backticked token.

⛔ **But the vocabulary is almost entirely bespoke.** Across all quoted terms in all 157 files, the most frequent term appears **twice**:

```
2 workflow · 2 platform · 2 connectors · 2 integrations · 2 "did nothing"
1 skills · 1 skill studio · 1 eval · 1 distribution · 1 self-host · 1 packaging
1 tenancy · 1 organizations · 1 teams · 1 departments · 1 rbac · 1 document management …
```

**A `trigger_surfaces` field populated from these produces ~53 seeds each tagged with 3-8 unique strings that no other seed shares and that no phase will independently think to declare.** The matching side of D-01 — *"the sweep matches a phase's blast radius (files_modified, surface names) against the structured keys"* — has nothing to match against unless phases start declaring surfaces from the same controlled vocabulary, which does not exist today.

**Recommendation for the planner (this is inside "Claude's Discretion" per CONTEXT.md — *the exact glob syntax and matching semantics of `trigger_paths`*):**

- Make **`trigger_paths` the load-bearing field.** It is deterministic, matches `files_modified` directly, and is what D-04's arms 3 and 4 can actually be driven against.
- Treat **`trigger_surfaces` as a controlled enum**, not free extraction — seed it from the ~15 recurring domain words that actually repeat across the register (`workflow`, `connectors`, `retrieval`, `settings`, `chat`, `skills`, `ingestion`, …) and have the backfill map quoted terms onto it, leaving unmapped ones out rather than inventing single-use tags.
- ⛔ **Do not build `trigger_phase_touches` as a third matching axis** unless something declares phase touches. 31 seeds name a phase number, but they name it as *history* ("Phase 238 landed a Graph adapter"), not as a future trigger.

### 3.5 Frontmatter malformation report

Covered fully in §1.9 and §1.10. Summary for the parser author:

| Property | Reading |
|---|---|
| Files with a well-formed `---` … `---` block | **278 / 283** |
| Files with **no** frontmatter at all | **5** (§1.10, named) |
| Unterminated frontmatter | **0** |
| BOM | **0** |
| ⛔ Files containing CR | **159** (153 pure CRLF + 6 mixed) |
| ⛔ **Mixed line endings within one file** | **6** (§1.9, named) |
| `trigger_when` as a non-plain scalar | **112 / 157** (§3.1) |
| Duplicate top-level key within one file | **0** |
| Bare `---` lines inside seed **bodies** | **102** (§7.1 — a boundary hazard) |

---

## 4. Q3 — the house gate-script contract

### 4.1 The inventory

```bash
wc -l scripts/check-*.cjs
#   251 check-backend-unit-baseline.cjs   ·  333 check-claude-md-size.cjs
#   278 check-gap-closure-rounds.cjs      ·  191 check-hot-file-ledger.cjs
#   294 check-landing-drift.cjs           ·  200 check-react-hooks-rules.cjs
#   554 check-verification-honesty.cjs    ·  2101 total
```

Seven `check-*.cjs` (CONTEXT.md says 8 — the eighth is `scripts/check-deploy-drift.sh`, a shell script, plus `check-security-advisors.sh` and `check-181-scope-freeze.sh`).

### 4.2 The concrete shared shape

Extracted from the four named siblings. A new `scripts/check-seeds-register.cjs` should be indistinguishable:

| Element | Contract |
|---|---|
| **Shebang / mode** | `#!/usr/bin/env node` + `'use strict';` |
| **Dependencies** | ⛔ **`fs` and `path` ONLY.** Explicit rule, not preference (§4.3) |
| **Header** | Long block comment: `WHY THIS EXISTS` → the measured failure it prevents → `USAGE` → `EXIT` |
| **Exit codes** | `0` clear · `1` violation · `2` harness error |
| **Harness errors** | `function fail(msg){ console.error(\`FATAL: ${msg}\`); process.exit(2); }` |
| **argv** | `const argv = process.argv.slice(2);` then positional subject + `--files a b c` mode; **no-arg → `fail('usage: …')`** |
| **Root resolution** | `const root = path.resolve(__dirname, '..');` |
| **Derivation printing** | A line before the verdict: `` `  scan list: ${known.size} rows · subject: ${subject.size} files · watched: ${watched.length}` `` |
| **Green verdict** | `` console.log(`\x1b[32m<name> gate OK\x1b[0m — <what is true>`) `` |
| **Failure lines** | `` `  [bracketed-code] ${detail}   (named by ${who})` `` |
| **Remedy block** | Failure output ends with the exact commands to fix it, re-deriving rather than guessing |
| **Entry** | `try { process.exit(main()); } catch (e) { fail(e && e.stack ? e.stack : String(e)); }` |

**Existing `[bracketed-code]` vocabulary** (`grep -ohE '\[[a-z][a-z0-9-]+\]' scripts/check-*.cjs | sort | uniq -c`):

```
[round-cap] · [new-capability-in-closure] · [frontmatter-claims-review]
[no-verification-mode] · [no-frontmatter] · [stale-pin] · [no-row]
[malformed-row] · [duplicate-row] · [disposition-too-long] · [check-backend-unit-baseline]
```

⭐ **`[no-frontmatter]`, `[duplicate-row]` and `[malformed-row]` already exist and mean almost exactly what this phase needs.** D-04/D-08/D-09/D-10's codes should align: **`[duplicate-id]`**, **`[missing-key]`**, **`[unknown-status]`** — and reuse **`[no-frontmatter]`** verbatim for the 5 status-less seeds rather than minting a synonym.

### 4.3 ⛔ YAML parsing — hand-rolled, and a dependency is FORBIDDEN with evidence

```bash
ls package.json                                   # does not exist at repo root
grep -inE 'yaml|front-?matter|gray-matter' frontend/package.json   # no match
grep -n 'PyYAML' backend/requirements.txt         # line 63 — Python only, not Node
```

**There is no root `package.json` at all.** The gates run as bare `node scripts/x.cjs` with zero module resolution. No Node YAML dependency exists anywhere in the repo.

**Every gate hand-rolls its frontmatter parse.** The two live implementations:

`scripts/check-hot-file-ledger.cjs:106-110`
```js
const text = fs.readFileSync(path.join(dir, p), 'utf8').replace(/\r\n/g, '\n');
const fm = /^---\n([\s\S]*?)\n---/.exec(text);
if (!fm) continue;
const block = /files_modified:\s*\n((?:\s*-\s*.+\n)+)/.exec(fm[1] + '\n');
```

`scripts/check-verification-honesty.cjs` — same class, plus an unquoted-`#`-stripping value reader.

And the rule is stated in that file's header, with the measurement behind it (`check-verification-honesty.cjs:25-29`):

> *"ZERO DEPENDENCIES, and that is a RULE rather than a preference: `fs`, `path` only. ⚠ Measured 2026-09-13 (DEF-245-01): `244-VERIFICATION.md`'s frontmatter does NOT parse as YAML — it has an unquoted value carrying a bare `: ` at line 26 col 505, and it was broken at HEAD, before this gate existed. **A YAML-parsing gate would have exited `2` on its first run against a file that carries the marker perfectly.** The refused dependency is why this gate can read that file at all."*

**Verdict: D-09/D-10's parser is NEW hand-rolled code, modelled on `check-hot-file-ledger.cjs:106-110`.** Do not propose `js-yaml` or `gray-matter`. ⚠ And §2.4 gives an independent second reason: a real YAML parser would have silently discarded the `#`-comment prose on 21 files that D-10 requires be preserved.

### 4.4 ⛔⛔ THE MOST IMPORTANT FINDING FOR D-04 — where the Phase-242 vacuity defect is and is not guarded

**Guarded on the SCAN-SET side** — `check-hot-file-ledger.cjs:44-46, 140-143`:

```js
const MIN_SCAN_ROWS = 150;
…
if (known.size < MIN_SCAN_ROWS) {
  fail(`the scan list parsed to only ${known.size} rows (floor ${MIN_SCAN_ROWS}) — refusing to `
    + 'pass over a table this small; the parser has almost certainly bound to the wrong one.');
}
```

**NOT guarded on the SUBJECT side.** The CRLF *trigger* was fixed (line 106 now does `.replace(/\r\n/g, '\n')`, with a long comment naming Phase 242) — but the **vacuity hole itself is still open**:

```js
const fm = /^---\n([\s\S]*?)\n---/.exec(text);
if (!fm) continue;                       // ← silent skip, no counter
const block = /files_modified:\s*\n…/.exec(fm[1] + '\n');
if (!block) continue;                    // ← silent skip, no counter
```

`planFiles()` fails only when **zero `*-PLAN.md` files exist**. If every plan present has unparseable frontmatter — or simply no `files_modified:` block — `subject` comes back an empty `Map`, `watched` is `[]`, `missing` is `[]`, and the gate prints:

```
  scan list: 214 rows · subject: 0 files · watched: 0
ledger gate OK — every watched file has a row.
```

**and exits `0`.** The specific 2026 trigger is closed; **the class is not.**

**The sibling that does it right** — `check-verification-honesty.cjs:206, 225, 431-435`:

```js
const DEBT_FLOOR_PHASE = 238;
const MIN_SUBJECT_FILES = 6;
…
if (subject.length < MIN_SUBJECT_FILES) {
  fail(`the derived scan set resolved only ${subject.length} file(s) (floor ${MIN_SUBJECT_FILES}) `
    + `— refusing to pass over a set this small. A gate that passes over nothing is worse than `
    + `absent.`);
}
```

…with an explicit carve-out that the floor applies to **scan mode only**, never to `--files` mode (where one file is a legitimate resolution and a floor would make the hook error on every write).

**So, for D-04's non-negotiable count assertion — the answer the planner needs in one line:**

> ⛔ **Only `check-verification-honesty.cjs` floors its subject set. `check-hot-file-ledger.cjs` floors only its scan set and can still exit `0` over zero parsed subjects. The other five gates floor nothing.** Copy `check-verification-honesty.cjs`'s two-mode floor exactly — and D-04's requirement goes further than any existing gate by demanding the count **equal the register size**, not merely exceed a floor. That is strictly stronger and is the right call: the seeds register, unlike a phase directory, has a knowable exact size (`fs.readdirSync(...).filter(f => /^SEED-\d{3}-.*\.md$/.test(f)).length`).

### 4.5 ⛔ How the gates are tested — they are NOT

```bash
find . -name '*.test.cjs' -not -path './node_modules/*' -not -path './backend/venv/*'
#   ./.claude/get-shit-done/bin/check-latest-version.cjs   (a false positive on the glob)
ls -d scripts/*/          # __pycache__ _uat111 _uat111_1 git-hooks pm-pack spike-097
grep -n -i 'self-test\|selftest\|--test' scripts/check-*.cjs      # no matches
```

**There is no test file, no test directory and no self-test mode for any `check-*.cjs` in this repository.** The established method — documented in CLAUDE.md and visible in every recent phase record — is:

> plant a defect → run the gate → confirm it fires and names the right thing → **restore the file and prove it md5-identical** → record the drive in the PLAN/SUMMARY.

Confirmed in CLAUDE.md § *CLAUDE.md context budget*: *"All three findings were **driven RED against planted defects and the file restored md5-identical**; a guard nobody has seen fire is not a guard."* And in Phase 250's record for `check-react-hooks-rules.cjs`: *"Driven RED on the real defect AND on all three shapes the hand-rolled regex misses."*

**Consequence for the planner:** D-04's four RED arms + the count assertion are **executed and recorded in the plan/summary**, not committed as a test file. There is no runner to add them to. ⚠ **This makes plan decomposition load-bearing** — see §9: the RED drives plant duplicate ids and broken statuses into `.planning/seeds/`, which is the same directory the migration rewrites. **Two agents doing that concurrently in separate worktrees will produce a merge whose correctness nobody can establish.**

⭐ **Optional, and worth proposing:** a `--self-test` mode that plants into a **temp copy** of the register rather than the real one would make D-04's arms re-runnable forever instead of once. It costs perhaps 40 lines, it removes the worktree hazard entirely, and this project has paid twice for guards it could not re-drive. It is genuinely new ground for the repo — flag it as a recommendation, not a requirement.

### 4.6 ⭐ D-01's glob question — settled locally, no web research needed

```bash
node --version                                            # v24.19.0
node -e "console.log(typeof require('path').matchesGlob)"  # function
node -e "console.log(typeof require('fs').globSync)"       # function
```

**`path.matchesGlob(path, pattern)` is available and stable on this runtime.** It is a Node built-in, so it satisfies the zero-dependency rule absolutely. `fs.globSync` is also available if the gate ever needs to enumerate rather than test.

**Recommendation: `trigger_paths` uses `path.matchesGlob` semantics** (`**`, `*`, `?`, `{a,b}`), matched against each entry of a phase's `files_modified` normalised to forward slashes. Document the one-line semantic in the gate header and in `TEMPLATE.md` so seed authors write patterns that will actually match.

⚠ **One caveat to state in the plan:** `files_modified` entries are repo-relative with forward slashes, but `check-hot-file-ledger.cjs` already found it necessary to normalise (`.split(path.sep).join('/')`). Do the same on both sides of the comparison, on Windows especially.

---

## 5. Q4 — the two wiring points, read as actual text

### 5.1 ⛔ THE FINDING — D-03's two named files are routers with no steps in them

```bash
wc -l .claude/commands/gsd/discuss-phase.md      # 76
wc -l .claude/commands/gsd/new-milestone.md      # 45
grep -cE '^\s*(node |bash |sh |npx )' .claude/commands/gsd/discuss-phase.md   # 0
grep -rc 'node scripts/' .claude/commands/gsd/*.md | grep -v ':0'            # (no output)
```

**No file in `.claude/commands/gsd/` (68 files) invokes any `node scripts/…` or `bash scripts/…`.** Both named files consist of frontmatter, an `<objective>` summary, and a `<process>` block whose entire content is a delegation:

`.claude/commands/gsd/discuss-phase.md:60-63`
```
Otherwise (`"discuss"` / unset / any other value):
Read and execute `…/.claude/get-shit-done/workflows/discuss-phase.md` end-to-end.

**MANDATORY:** Read the appropriate workflow file BEFORE taking any action. The objective and
success_criteria sections in this command file are summaries — the workflow file contains the
complete step-by-step process…
```

`.claude/commands/gsd/new-milestone.md:42-45`
```
<process>
Execute end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
</process>
```

⛔ **CONTEXT.md's canonical_refs names these two as "the two files D-03's wiring lands in." There is nowhere in either of them to put a step** — adding one would put it in a file the command's own text says is only a summary. **The wiring must land in `.claude/get-shit-done/workflows/discuss-phase.md` (27,469 bytes) and `.claude/get-shit-done/workflows/new-milestone.md` (26,205 bytes).**

### 5.2 ⭐ There IS a precedent, and it is exactly this phase's shape

```bash
git log --oneline -- .claude/get-shit-done/workflows/
#   dec2577ae chore(gsd): apply the pending GSD framework update
#   9d3d887de feat: mechanical enforcement for G-7 (gap-closure round cap)
#   ffa7eab0f chore: update GSD framework agents, commands, and tooling
#   4da946196 …  ·  ded2ce686 …
```

**`9d3d887de` (2026-08-04)** is the G-7 wiring — a project-authored gate wired into three vendored workflow files:

```
.claude/get-shit-done/workflows/execute-phase.md | 762 ++++++----
.claude/get-shit-done/workflows/plan-phase.md    | 638 +++++++++--
.claude/get-shit-done/workflows/verify-work.md   | 116 +++-
```

**And it survived the later framework update:**

```bash
grep -rn 'check-gap-closure-rounds' .claude/get-shit-done/workflows/
#   execute-phase.md:1561 · plan-phase.md:182 · verify-work.md:549
git show --stat dec2577ae -- …/execute-phase.md …/plan-phase.md …/verify-work.md
#   (empty — the 2026-08-27 framework update did not touch these three files)
```

**The exact block to copy** — `.claude/get-shit-done/workflows/plan-phase.md:175-198`:

```markdown
## 2.4. PROJECT GATE — G-7 gap-closure round cap

**Skip if:** no `--gaps` flag.

**If `--gaps` is present, run the mechanical check BEFORE any research, planner spawn, or file write:**

```bash
node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
G7_EXIT=$?
```

**If `G7_EXIT` is 1: STOP. …** Print the check's own output verbatim — it names the derivation and
the reasons — then:
1. Report ROADMAP **success-criteria** status. …
4. Proceed ONLY if … re-running the check with `--unmet-criterion "SC#N: <what is not true>"` …
   and recording the override under `STATE.md → Guardrail overrides`.

Rationale …: `CLAUDE.md` § Workflow guardrails, rule **G-7** …
```

Note the section-numbering convention: **`## 2.4. PROJECT GATE — <rule>`**, slotted between existing numbered sections. D-03 should mint `## X.Y. PROJECT GATE — REG-02 seeds sweep` in the same style.

⚠ **Risk to state in the plan:** `.claude/get-shit-done/` is a **vendored framework at VERSION 1.42.3** (`cat .claude/get-shit-done/VERSION`), tracked in git, not gitignored, with a `SessionStart` hook (`gsd-check-update.js`) that checks for updates. An edit here **can be clobbered by a future `chore(gsd): apply the pending GSD framework update`.** It has not happened yet (one update has passed over the G-7 wiring untouched), but the plan should record the wiring sites so a future update can re-apply them — CLAUDE.md is the natural home, beside the G-7 entry.

### 5.3 ⭐ The precise landing point in `discuss-phase.md`

```bash
grep -n '<step name=' .claude/get-shit-done/workflows/discuss-phase.md
#   108 initialize          153 check_blocking_antipatterns   174 check_spec
#   193 check_existing      228 load_prior_context            264 cross_reference_todos
#   280 scout_codebase      289 analyze_phase                 312 present_gray_areas
#   345 discuss_areas       369 write_context                 401 confirm_creation
#   431 git_commit          456 update_state                  468 auto_advance
```

**The landing point is immediately after `<step name="cross_reference_todos">` (line 264-278) and before `<step name="scout_codebase">` (line 280)** — it is the register cross-reference step, and a seeds sweep is its exact sibling. The full step, verbatim:

```markdown
<step name="cross_reference_todos">
Check pending todos for matches with this phase's scope.

```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

Parse JSON for: `todo_count`, `matches[]` (each with `file`, `title`, `area`, `score`, `reasons`).

**If `todo_count` is 0 or `matches` is empty:** Skip silently.

**If matches found:** Present each match (title, area, why it matched). AskUserQuestion (multiSelect)
asking which to fold. Folded → `<folded_todos>` for CONTEXT.md `<decisions>`. Reviewed but not
folded → `<reviewed_todos>` for CONTEXT.md `<deferred>`.

**Auto mode (`--auto`):** Fold all todos with score >= 0.4 automatically. Log the selection.
</step>
```

⭐ **This is a ready-made template for the new step** — including the auto-mode arm, the skip-silently arm, and the fold/defer routing into CONTEXT.md that CLAUDE.md's seeds rule already asks for. A `<step name="cross_reference_seeds">` modelled on it will read as native.

⚠ **Note what this step does that CLAUDE.md's seeds rule requires and the sweep must add:** CLAUDE.md says *"A seed is answered by editing the seed. Flip `status` and record where it went."* The todo step writes routing into CONTEXT.md but does **not** write back to the todo file. **The seeds step must write back** — see §5.4 for why that is contested.

### 5.4 ⛔⛔ THE BIGGEST Q4 FINDING — `new-milestone` already has a seeds sweep, and it FORBIDS what CLAUDE.md mandates

`grep -n '<step name=' …/new-milestone.md` returns **nothing** — that workflow uses numbered `## N.` sections instead. And section **`## 2.5. Scan Planted Seeds`** (lines 49-97) already exists.

Verbatim extracts (`sed -n '49,97p'`):

```markdown
## 2.5. Scan Planted Seeds

Check `.planning/seeds/` for seed files that match the milestone goals gathered in step 2.

```bash
ls .planning/seeds/SEED-*.md 2>/dev/null
```

**If seed files exist:** Read each `SEED-*.md` file and extract from its frontmatter and body:
- **Idea** — the seed title (heading after frontmatter, e.g. `# SEED-001: <idea>`)
- **Trigger conditions** — the `trigger_when` frontmatter field and the "When to Surface" section's bullet list
- **Planted during** — the `planted_during` frontmatter field (for context)

Compare each seed's trigger conditions against the milestone goals from step 2. A seed matches when
its trigger conditions are relevant to any of the milestone's target features or goals.
…
**After selection:**
- Selected seeds become additional context for requirement definition in step 9. …
- Unselected seeds remain untouched in `.planning/seeds/` — never delete or modify seed files
  during this workflow.
```

**Four things this changes:**

1. ⛔ **CLAUDE.md's claim is right about the commands and wrong about the workflows.** `grep -rln "SEED" .claude/commands/gsd/` genuinely returns `capture.md` only (§5.6) — but that is because the commands are routers. **The sweep exists one directory down.** A plan written on the premise that nothing sweeps seeds at `/gsd:new-milestone` would be building a second one beside an existing one.
2. ⛔ **The existing sweep is the exact burden REG-02 names.** *"Read each `SEED-*.md` file"* — **all 283** — and judge trigger prose against milestone goals by hand. That is REQUIREMENTS.md's *"at 161 planted seeds of 280 that sweep is a phase of work, not a step in a command"*, written into the workflow verbatim. **D-03's script replaces the mechanism inside this section; it does not add a new section.**
3. ⛔ **It contradicts CLAUDE.md directly.** The workflow says *"never delete or modify seed files during this workflow."* CLAUDE.md § *Seeds register cross-check (MANDATORY)* says *"A seed is answered by editing the seed. Flip `status` and record where it went; a seed that shipped but still reads `planted` will be re-proposed forever."* **These cannot both be followed.** The plan must resolve it in writing, in the same commit, per CONTEXT.md's own same-commit convention. ⭐ This is very likely a real cause of the 161-planted backlog: the workflow that surfaces seeds is forbidden from flipping them.
4. ⚠ **It does NOT filter on `status` or `surface` at all** — it reads every `SEED-*.md`. So the "45% blind" defect is CLAUDE.md's *rule*, not this workflow's *behaviour*. This workflow is blind differently: it reads everything and judges by prose, which is unbounded rather than partial. **Both are real; the plan should describe them separately or it will claim to fix one and actually fix the other.**

⚠ **And one more, which strengthens D-03's case rather than weakening it:** the **reported-bugs** cross-check that CLAUDE.md also calls MANDATORY at four touchpoints is wired **nowhere**:

```bash
grep -rn -i 'reported-bug' .claude/get-shit-done/workflows/discuss-phase.md \
                            .claude/get-shit-done/workflows/new-milestone.md
#   (no output)
```

**Two MANDATORY cross-checks, one partially wired and one not wired at all.** D-03's *"a rule that exists and is not applied is the same as no rule"* is measured twice over.

### 5.5 ⛔⛔ D-08 — the id allocator exists, it is a concrete bug, and D-08's stated cause is incomplete

`.claude/get-shit-done/workflows/plant-seed.md:53-62`:

```markdown
<step name="generate-seed-id">
```bash
# Find next seed number
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

Generate slug from idea summary.
</step>
```

**This is `count(files) + 1`, not `max(id) + 1`.** Measured consequences:

```bash
ls .planning/seeds/SEED-*.md | wc -l    # 283  →  the allocator yields SEED-284
# highest allocated id                  # 276  →  D-08 expects the next fresh id to be 277
```

| | |
|---|---|
| **What D-08 expects the next id to be** | `277` |
| **What this allocator produces today** | **`284`** |
| **Why** | 8 duplicate partners inflate the file count above the id ceiling |

**And it is the collision mechanism.** Whenever the id space has a gap, `count < max`, so `count + 1 ≤ max` and the allocator hands out an id that already exists. **The register has exactly one gap — `SEED-016` does not exist** (§1.1) — which is enough for the count to have trailed the max and collided.

⚠ **Stated honestly: one gap does not arithmetically explain all eight collisions.** The remainder is most plausibly hand-authored seeds (agents writing the file directly rather than through `/gsd:capture --seed`), or two agents in one day — which is CONTEXT.md's stated cause. **So D-08's premise is not wrong, it is incomplete: there IS a mechanical allocator, and it is independently broken.** D-08's remedy — *"a next-id allocator that derives the number from the register"* — is exactly right and now has a named, quotable defect to replace:

```bash
# derive from the ID SPACE, never from the file count
NEXT=$(( $(ls .planning/seeds/ | sed -n 's/^SEED-\([0-9]\{3\}\).*/\1/p' | sort -n | tail -1) + 1 ))
```

⭐ **Two notes for the plan:**
- **The allocator lives in `.claude/get-shit-done/workflows/plant-seed.md`, not in `.claude/commands/gsd/capture.md`.** CONTEXT.md's Integration Points names `.claude/skills/gsd-capture` / `capture.md`; **no `.claude/skills/gsd-capture*` directory exists**, and `capture.md` only routes. `plant-seed.md` is the file.
- D-08's gate arm (`[duplicate-id]`) and the allocator fix are **complementary and both needed**, exactly as D-08 argues — the allocator prevents the ordinary case, the gate catches the parallel-agent case the allocator structurally cannot.

### 5.6 The CONTEXT.md grep claim — CONFIRMED, and weaker than it sounds

```bash
grep -rln "SEED" .claude/commands/gsd/
#   .claude/commands/gsd/capture.md
grep -n "SEED" .claude/commands/gsd/capture.md
#   33:| --seed | .planning/seeds/SEED-NNN-slug.md | plant-seed |
```

**Confirmed exactly: one file, and within it one line** — a row in a routing table mapping the `--seed` flag to a path. `capture.md` does not describe seed semantics at all; it delegates to `plant-seed.md`. **The claim holds, and is if anything understated.** ⚠ But read together with §5.4 it is easy to over-conclude from: the *commands* are silent about seeds because commands are silent about everything.

---

## 6. Q5 — `.agent-bus` mechanics for D-14

### 6.1 `agent-bus-check.sh` in full (41 lines) — how it selects and ages

```bash
items=$(grep -E '^### \[OPEN\].*to:claude' "$BUS" 2>/dev/null || true)
[ -z "$items" ] && exit 0                                    # ← line 18

while IFS= read -r line; do
  id=$(printf '%s' "$line" | grep -oE 'BUS-[0-9]{3}')
  from=$(printf '%s' "$line" | sed -nE 's/.*from:([a-z]+).*/\1/p')
  date=$(printf '%s' "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  body=$(awk -v id="$id" 'index($0,"### [")==1{p=(index($0,id)>0);next} p && NF && $0 !~ /^\*\*Answer:/{print;exit}' "$BUS")
  age=""
  then_s=$(date -u -d "$date" +%s 2>/dev/null || echo "")
  if [ -n "$then_s" ]; then
    d=$(( ( $(date -u +%s) - then_s ) / 86400 ))
    [ "$d" -ge 3 ] && age="  ** $d DAYS OLD **" || age="  (${d}d)"
  fi
  echo "  $id  from:$from$age"
  echo "    $body"
done <<< "$items"
```

### 6.2 Can D-14 reuse the parse? — **Yes, and the answer is more interesting than yes**

**The parse is four one-liners and it is trivially reusable.** But the framing in CONTEXT.md — *"D-14's age computation can reuse that parse rather than writing a second one — ⚠ a second parser that disagrees with the first is this project's recurring defect"* — **understates the position: there are already TWO copies, and they have already diverged.**

| | `scripts/agent-bus.sh` `cmd_list` (:86-89) | `.claude/hooks/agent-bus-check.sh` (:24-33) |
|---|---|---|
| id | `grep -oE 'BUS-[0-9]{3}'` | `grep -oE 'BUS-[0-9]{3}'` — identical |
| to | `sed -nE 's/.*to:([a-z]+).*/\1/p'` | *(not extracted — hardcoded in the grep)* |
| from | `sed -nE 's/.*from:([a-z]+).*/\1/p'` | identical |
| date | `grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` | identical |
| **age** | **`age_days()` helper (:38-44)** — `date -u -d` **with a BSD `date -u -j -f` fallback** and a `"?"` sentinel | **inline, GNU-only, no fallback, no sentinel** |

⛔ **The two already disagree on the one part that is not a one-liner.** `scripts/agent-bus.sh:38-44`:

```bash
age_days() {
  local d="$1" then now
  then=$(date -u -d "$d" +%s 2>/dev/null || date -u -j -f %Y-%m-%d "$d" +%s 2>/dev/null || echo "")
  [ -n "$then" ] || { echo "?"; return; }
  now=$(date -u +%s)
  echo $(( (now - then) / 86400 ))
}
```

**Recommendation: D-14 should `source` `scripts/agent-bus.sh`'s `age_days` rather than add a third copy** — or, if sourcing a command-dispatching script is awkward, extract `age_days` into a tiny shared file both read. Writing the age inline a third time is the defect CONTEXT.md is warning about, one iteration further along than it realises.

### 6.3 What must change in the hook for D-14

Three concrete changes, and one is not obvious:

1. ⛔ **The early exit at line 18 must go.** `[ -z "$items" ] && exit 0` fires whenever there are no `to:claude` items — **which is the normal state** (there is exactly 1 open `to:claude` today, `BUS-171` itself, and it will close). D-14's `to:operator` line must print **even when the `to:claude` section is empty**, so the structure becomes: compute all three counts first → print the `to:operator`/`to:gemini` summary line → print the `to:claude` detail block only if non-empty → exit 0.
2. ⚠ **The "SILENT when there is nothing addressed to Claude" contract is deliberately stated in the hook's own header** (lines 9-10: *"a hook that prints on every start is noise, and noise is how a real item gets scrolled past"*). **D-14 makes this hook print on every session and subagent start, forever.** That is a real trade the plan should name rather than slide past — a one-line summary is much cheaper than the current multi-line block, but it is no longer silent. Consider: print the summary line only when the `to:operator` count is non-zero, preserving the silence contract while still surfacing the queue.
3. ⚠ **The hook's own header comment is already rotted** — line 5: *"`.planning/seeds/` holds 188 `trigger_when` entries"*. Measured today: **157 `trigger_when` across 283 files**, and 188 was likely the seed *count* at the time. Since D-14 edits this file anyway, correct it in the same commit, with the original beside it per house convention.

### 6.4 The `·` separator is NOT a shell hazard

Neither parser ever matches on `·`. Both key exclusively on `BUS-\d{3}`, `to:([a-z]+)`, `from:([a-z]+)` and the ISO date. The multibyte middot is passed through as opaque bytes by `grep -oE` and `sed -nE` and never enters a character class. **Confirmed safe; no encoding work is needed for D-14.**

⚠ One genuine parsing caveat: `sed -nE 's/.*to:([a-z]+).*/\1/p'` is **greedy** — `.*to:` matches the *last* `to:` on the line. Header lines have exactly one, so it is correct today, but a header whose body text contained `to:` would mis-parse. Not a defect to fix; a constraint to preserve (⛔ **do not hand-edit `###` header lines** — CONTEXT.md already says this and it is the reason).

---

## 7. Q6 — the md5 body-invariant contract (D-11)

### 7.1 The frontmatter/body boundary — unambiguous, with one loaded hazard

**Proposed rule: line 1 must be exactly `---`; the body begins after the FIRST subsequent line that is exactly `---`.** Tested across all 283 (`scratchpad/body.cjs`):

```
parseable frontmatter: 278   no-frontmatter: 5   empty body: 0
boundary hazards: 0
bare '---' lines inside bodies (horizontal rules), total: 102
```

| Failure case | Count | Handling |
|---|---|---|
| No leading `---` (whole file is body) | **5** (§1.10, named) | separate code path — **prepend** a block; body md5 = md5 of the current whole file |
| Unterminated frontmatter | **0** | — |
| `---` inside the frontmatter block | **0** | — |
| Body's first line is `---` | **0** | — |
| BOM before the leading `---` | **0** | strip defensively anyway |
| ⛔ **Bare `---` lines inside BODIES** | **102** | **the hazard** |

⛔ **The hazard, stated precisely:** 102 markdown horizontal rules exist inside seed bodies. A **non-greedy** first-match regex (`/^---\r?\n([\s\S]*?)\r?\n---/`) is safe — it binds to the first closing delimiter. A **greedy** regex, or any approach that splits the file on `---` and takes `parts[2..]`, will silently eat body content into the frontmatter on ~40% of the register. **`check-hot-file-ledger.cjs:107` already uses the non-greedy form; copy it exactly, adding `\r?`.**

### 7.2 ⛔ The line-ending contract — the thing most likely to fail the run

Given §1.9 (153 CRLF, 124 LF, **6 mixed**, `core.autocrlf=true`, no `.gitattributes`):

| Risk | Consequence |
|---|---|
| Script reads as `utf8` string, normalises `\r\n`→`\n`, writes back | **153 files get a whole-file diff** in the working tree; the body md5 check passes (because it compares normalised text) **while every byte of every line changed**. D-11's guarantee becomes vacuous. |
| Script preserves per-file line endings | correct — but must be done from the **Buffer**, and the 6 mixed files cannot be characterised by a single per-file convention |
| Body md5 computed on **normalised** text | ⛔ **defeats D-11's purpose** — "a body that moved by one byte fails the run" cannot be true if bytes are normalised before hashing |
| Body md5 computed on **raw bytes** | ⭐ **correct**, and the only form that honours D-11 as written |

**Recommended contract, spelled out for the plan:**

> Read each file with `fs.readFileSync(p)` as a **Buffer**. Locate the two `---` delimiter lines by scanning for the byte sequences, tolerating `\r\n` and `\n`. **Slice the body as a Buffer** and compute `crypto.createHash('md5').update(bodyBuf).digest('hex')` **before** and **after**. Write the new file by concatenating `newFrontmatterBuf + bodyBuf` — **the body Buffer is passed through untouched, never re-serialised from a string.** Emit the new frontmatter using the line ending that dominates that file's existing frontmatter block.

⭐ **This makes the invariant true by construction rather than by assertion** — the body is literally the same bytes, so the hash comparison becomes a cheap confirmation rather than the thing the guarantee rests on. ⚠ Assert it anyway: D-11 requires the hash, and a hash that can never fail is still the record that it did not.

⚠ **Special case: the 6 mixed-line-ending files.** They will be untouched in their bodies by the Buffer approach, so they are safe. But if any of them lands in the "prepend a block" path or has its frontmatter rewritten, the *frontmatter* line ending must be chosen deliberately. None of the 6 is in the 5 no-frontmatter set, so this is a small, bounded concern — **name the 6 files in the plan so the executor verifies them individually.**

⚠ **Git-side note:** because `core.autocrlf=true` and git already stores LF, a script that wrote LF everywhere would produce **no git diff** for the 153 CRLF files — which makes the working-tree damage **invisible to `git diff`**. ⛔ **`git diff` is therefore NOT a valid verification of D-11.** The md5 comparison must be done on working-tree bytes in-process, before and after, in the same run.

### 7.3 In-repo precedent

```bash
grep -rln 'md5\|sha256\|createHash\|hashlib' scripts/ --include='*.cjs' --include='*.sh' --include='*.py'
#   scripts/agent-bus.sh · scripts/seed-pm-pack.py · scripts/vitest-count-gate.cjs
```

⛔ **There is no in-repo precedent for a bulk-edit script that proves a no-touch invariant by hash.** The nearest relatives, and what each contributes:

| Precedent | What it does | Usable? |
|---|---|---|
| `scripts/check-181-scope-freeze.sh` | Proves named paths are **absent from a phase diff** — *"the project's standing D-14 'confirmed-absent-from-the-phase-diff' technique, scripted"*. Matches by **path** against `git diff --name-only`, explicitly *"never greps file CONTENT"* | ⭐ **Closest in spirit; copy its header/usage/exit style, not its mechanism** |
| CLAUDE.md's RED-drive convention | *"driven RED against planted defects and the file restored **md5-identical**"* — a **manual** technique recorded in plans | ⭐ the source of D-11's wording; not a script |
| Phase `244-04` (D-11's cited precedent) | Left `App.tsx` **byte-unchanged** and **fenced it** with a test asserting `setLibraryTab(` still occurs exactly twice | ⭐ the *fence* idea — assert the invariant, do not just claim it |

**So D-11's script is new code.** Recommend it borrow: `check-181-scope-freeze.sh`'s header/exit shape, `check-hot-file-ledger.cjs`'s frontmatter regex, and `244-04`'s discipline of leaving behind an assertion rather than only a claim.

### 7.4 Execution shape — one-shot or committed?

**What the repo has done before for one-shot migrations of planning/data files:** `scripts/` contains `apply_migration_072.py`, `073`, `074`, `075`, `178` — **numbered, single-purpose, committed and kept**. Also `repair_dirty_workflow_phases.py`, `seed-constructor-slug-workflow.py`. **The house habit is to commit the one-shot script, named for what it did, and leave it.**

**Recommendation: commit it**, named `scripts/migrate-seeds-frontmatter.cjs`, for four reasons:

1. ⭐ **It is the only durable evidence of what was done to 283 files in one commit.** A throwaway script leaves a 283-file diff and no explanation of the rule that produced it.
2. It matches the `apply_migration_NNN.py` precedent exactly.
3. **It is re-runnable as an idempotency check** — running it again should report `0 files changed`, which is a cheap, strong post-condition and a genuine test of the gate/migration pair.
4. ⚠ It must be **idempotent and refuse to double-apply** — if a seed already has `status_note`, do not wrap it again. State this as an explicit requirement; the one existing `status_note` (§1.3) proves the case is live on day one.

⛔ **Do not make it a `check-*.cjs`.** It writes; the `check-` prefix in this repo means read-only and exit-coded. Keeping the namespace honest matters here more than elsewhere, because this phase is *about* register honesty.

---

## 8. Implementation risks / landmines

### 8.1 ⛔ The parser will see 29% of `trigger_when` unless written for folded scalars and lists
78 folded + 33 lists + 1 mixed = **112 of 157 put their content on continuation lines**. A `^key:\s*(.*)$` reader returns empty for all of them and the sweep reports a register with no triggers. **Write the continuation reader first and test it against the count 157 before anything else.** (§3.1)

### 8.2 ⛔ Line-ending normalisation will silently void D-11
`core.autocrlf=true` + no `.gitattributes` means a normalising rewrite produces **no `git diff`** for 153 files while changing every line in the working tree. Hash **raw body Buffers**; never verify D-11 with `git diff`. (§7.2)

### 8.3 ⛔ Six files have mixed line endings within one file
`SEED-013`, `SEED-144`, `SEED-145`, `SEED-171`, `SEED-193`, `SEED-194`. Any "detect the file's convention and re-emit" logic is **wrong by construction** for these. The Buffer pass-through handles them; nothing else does. (§1.9)

### 8.4 ⛔ 102 bare `---` lines live inside seed bodies
A greedy delimiter regex or a `split('---')` approach destroys body content on ~40% of the register — and D-11's md5 check would catch it, which is good, but only after the damage. Use the non-greedy form from `check-hot-file-ledger.cjs:107`. (§7.1)

### 8.5 ⛔ The five status-less seeds need a different code path, not a different value
They have **no frontmatter block at all**. `grep '^status:'` finding nothing is not the same problem as `status:` being wrong, and a migration that assumes "278 blocks, 5 missing keys" will crash or skip. (§1.10)

### 8.6 ⛔ ~84 duplicate-id references sit in product source and tests the phase may not touch
Chiefly `SEED-253` (which D-07 moves) across 9 backend modules and 5 backend test files. **Surface this to the operator before the renumber, not after.** (§1.8, §2.7)

### 8.7 ⚠ Editing `.claude/get-shit-done/` is editing a vendored framework at v1.42.3
There is precedent (`9d3d887de`) and it survived one update — but a future `chore(gsd): apply the pending GSD framework update` could clobber it. **Record the wiring sites in CLAUDE.md beside the G-7 entry** so a future update can re-apply them. (§5.2)

### 8.8 ⚠ The `new-milestone` workflow forbids modifying seed files; CLAUDE.md requires it
A direct contradiction between two live registers, and D-03's wiring sits exactly on the seam. **Resolve it in writing, in the same commit.** (§5.4)

### 8.9 ⚠ `check-hot-file-ledger.cjs 251` cannot be evaluated until plans exist
It exits `2` (`no *-PLAN.md`) today. CONTEXT.md's clean-result prediction is sound from the `WATCHED`/`EXEMPT` lists but untested. Re-run after planning; if it does report `[no-row]`, CONTEXT.md is right that it is a finding about the gate's scan set, not about this phase. (§1.11)

### 8.10 ⚠ Any CLAUDE.md edit must be re-measured with the gate, never `wc`
Currently **99,021 chars / 66% / 50,979 headroom**. D-09's correction to the seeds cross-check section has room, but the `check-claude-md-size.cjs` run is mandatory and its **200-char disposition cap** applies to any ledger row this phase touches. (§1.11)

### 8.11 ⚠ `rg` skips dot-directories by default
This bit me mid-research and produced a confident `archive_occ=0` for all eight ids (§1.7). **Every `rg` over `.planning/`, `.agent-bus/` or `.claude/` in this phase needs `--hidden`.** Worth a line in the plan — the whole phase operates on dot-directories.

### 8.12 ⚠ There is no test runner for gate scripts
D-04's four RED arms are executed-and-recorded, not committed as tests (§4.5). This is the constraint that makes §9's decomposition boundary real.

---

## 9. Suggested plan decomposition boundaries (advisory)

**Recommendation: 4 plans.** G-8 targets 3-5; 4 fits without justification. Each boundary below is a *structural* reason, not a topical one.

### Plan A — the gate + its RED drives (REG-02's instrument)
`scripts/check-seeds-register.cjs` + the four RED arms + the exact-count assertion. Builds the frontmatter/continuation parser (§3.1, §7.1), the `[duplicate-id]` / `[missing-key]` / `[unknown-status]` / `[no-frontmatter]` codes, `path.matchesGlob` matching, and the derivation print.

⛔ **Why this cannot share a worktree with Plan B:** D-04's arms require **planting a duplicate id and a broken `status` into `.planning/seeds/`**, running the gate, and restoring. Plan B **rewrites the frontmatter of all 283 files in that same directory**. Two worktrees both mutating `.planning/seeds/` — one deliberately corrupting it, one bulk-rewriting it — merge into a state whose correctness nobody can establish, and the md5 body proof cannot be reconstructed after the fact. **This is the one hard boundary in the phase.**

⭐ **Sequencing note:** Plan A should land **first**, because its arms 1 and 2 are the acceptance test for Plan B's output. A gate written after the migration is a gate fitted to its result.

### Plan B — the 283-file frontmatter migration (D-09/D-10/D-11)
`scripts/migrate-seeds-frontmatter.cjs` + the run + `TEMPLATE.md` **created** (§1.2) + the CLAUDE.md sweep-rule correction + the char-gate re-measurement.

**Why it is one plan and not two:** the status→enum mapping, the `status_note` split, the required-key backfill and the md5 proof all operate on the same single pass over the same 283 files. Splitting them means two passes, two md5 baselines, and a second chance to break a body.

⚠ **Blocked on an operator ruling before it can be written:** the 16 unmapped status tokens (§2.2) and specifically the `partially-*` family (§2.3). **Surface these at planning, not at execution.**

### Plan C — the duplicate renumber + redirect stubs (REG-01 / D-05, D-06, D-07)
8 renumbers using the `renumbered_from` / `renumbered_because` shape (§2.5), 8 stubs at `status: superseded-id`, and the **live** non-archive reference updates within the permitted file set.

**Why it is separate from Plan B:** it **renames files**, where B **rewrites contents**. Concurrent rename + rewrite of the same directory is a merge hazard of a different kind from B's, and the renumber depends on B having already normalised `seed_id`/`status` so the stubs can be written in the final vocabulary. ⭐ **C must land after B**, which also means C's stubs are the first new seeds written against the new `TEMPLATE.md` — a free end-to-end check of it.

⚠ **Carries the §1.8 / §2.7 operator decision** on the 84 source/test references to `SEED-253`.

### Plan D — the wiring, the allocator, and the bus (D-03, D-08, D-12/13/14/15)
The `<step name="cross_reference_seeds">` in `workflows/discuss-phase.md` (§5.3); the rewrite of `## 2.5. Scan Planted Seeds` in `workflows/new-milestone.md` (§5.4) including the CLAUDE.md contradiction; the `max(id)+1` allocator in `workflows/plant-seed.md` (§5.5); the `agent-bus-check.sh` extension (§6.3); and the 5-item operator triage list with `BUS-171` closed in writing.

**Why the bus work belongs here and not alone:** REG-03 is now (post-D-12 re-scope) a **document plus a 15-line hook change**. It is not a plan's worth of work on its own, and G-8 explicitly warns that *"two plans in one wave touching adjacent files are ONE plan with two tasks."* Both halves of D are "edit a small text file that wires an existing mechanism", and none of them touch `.planning/seeds/`.

⛔ **Why D must land LAST:** its `discuss-phase` / `new-milestone` wiring invokes Plan A's gate against Plan B's and C's output. Wiring a sweep into two commands before the register it sweeps is valid gives every subsequent `/gsd:discuss-phase` a red gate.

⚠ **D-13 constrains this plan absolutely: Claude may not close bus items.** The deliverable is a list. The only bus write permitted is the hook edit.

### Ordering

```
A (gate + RED drives)  →  B (migration)  →  C (renumber + stubs)  →  D (wiring + allocator + bus)
```

**All four are serial.** That is unusual for this project and worth stating plainly rather than hiding: **three of the four operate on `.planning/seeds/`, and the fourth validates the other three.** There is no honest parallelism here, and `use_worktrees: true` does not create any. A plan that parallelises A and B to save wall-clock will pay for it in a merge nobody can verify.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The one-gap-plus-hand-authoring account of the 8 collisions | §5.5 | Low — the allocator defect is **measured**; only the *attribution of all eight* is inferred, and D-08's remedy is unaffected either way |
| A2 | All 84 source/test `SEED-2xx` references are comments/docstrings, not identifiers | §1.8 | Medium — I sampled, did not read all 33 files. If one is an identifier or a filename, option 2 in §1.8 gets more expensive. **`test_259_argument_shapes_are_rows_too.py` IS a filename and I verified it stays valid.** |
| A3 | Every live `SEED-253` reference means `source-file-path-is-synthetic` | §2.7 | Low — verified across CLAUDE.md, `docs/HOT-FILE-LEDGER.md`, `247-CONTEXT.md`, `.continue-here.md` and the backend adapter set; all unambiguous |
| A4 | `path.matchesGlob` is stable enough to depend on at Node 24.19 | §4.6 | Low — measured present; it is a Node built-in. If the operator's other machines run older Node, a ~30-line glob→RegExp translator is the fallback |
| A5 | The 6 mixed-line-ending files are mixed by accident, not by content (e.g. an embedded code block with deliberate endings) | §1.9 | Low — the Buffer pass-through is correct regardless of why |

---

## Open Questions (for the operator, at planning)

1. **The 16 unmapped status tokens, and especially the `partially-*` family (15 files).** D-10's enum cannot express them without destroying the distinction D-10 exists to protect. Three options in §2.3; **recommend option 3** (a `partial:` sibling key, or a `partially-` prefix convention).
2. **The 84 duplicate-id references in product source/tests that the phase boundary forbids touching.** Three options in §1.8; **recommend option 1** — let D-05's redirect stub carry them, and say so in writing.
3. **`workflows/new-milestone.md`'s "never modify seed files" vs CLAUDE.md's "a seed is answered by editing the seed."** A direct contradiction on the exact seam D-03 wires (§5.4). Needs a ruling before Plan D is written.
4. **D-07's tie-break for `SEED-231` and `SEED-253`.** Recommend adopting the add-commit timestamp explicitly (§2.6); both are already measured and both are unambiguous under it.
5. **Should the gate ship a `--self-test` mode?** (§4.5) It would make D-04's arms re-runnable forever and remove the Plan A/B worktree hazard entirely. New ground for this repo; ~40 lines.
6. ⚠ **Out of scope but noticed, and REG-02 is literally about it:** `REQUIREMENTS.md` still reads `WATCH 0/8` and `CRED 0/4` for two closed phases, and `.planning/ROADMAP.md`'s own Progress note says *"Phase 251 is where that gets swept."* **That sweep is not in REG-01/02/03 and not in D-01..D-15.** Either scope it explicitly or record it as deferred — it is exactly the class of drift this phase exists to end, and leaving it silent would be the phase's own failure mode.

---

## Sources

### Primary — this repository, measured 2026-09-15 at `0fa2674cd` (HIGH)
- `.planning/seeds/` (283 files) — parsed in full via `scratchpad/{parse,keys,ml,shapes,trig,quoted,body}.cjs`
- `.agent-bus/OPEN.md` (3,049 lines) · `scripts/agent-bus.sh` · `.claude/hooks/agent-bus-check.sh`
- `scripts/check-hot-file-ledger.cjs` · `check-verification-honesty.cjs` · `check-gap-closure-rounds.cjs` · `check-claude-md-size.cjs` · `check-181-scope-freeze.sh`
- `.claude/commands/gsd/{discuss-phase,new-milestone,capture}.md` · `.claude/get-shit-done/workflows/{discuss-phase,new-milestone,plant-seed,plan-phase}.md` · `VERSION` (1.42.3)
- `.planning/reported-bugs/TEMPLATE.md` · `.planning/REQUIREMENTS.md` · `.planning/ROADMAP.md` · `.planning/STATE.md` · `CLAUDE.md`
- git history: `9d3d887de`, `dec2577ae`, `283c624a9`, `f2240eaec`, `834502ffc`, `3afada84f`

### Not used
No web search, no Context7, no external documentation. Every question in the brief was answerable from the working tree, including D-01's glob selection (§4.6).

---

## Metadata

**Confidence breakdown:**
- Register measurements (counts, keys, ids, line endings, statuses): **HIGH** — each derived by a named command, several cross-checked by a second method after two of my own runs disagreed (§1.9)
- Gate-script contract: **HIGH** — read in full, not sampled
- GSD wiring points: **HIGH** — both command files and both workflow files read in full; the precedent commit inspected and verified still present
- `trigger_when` extractability: **HIGH on the counts, MEDIUM on the classification** — all 157 values extracted programmatically; the "kind" split rests on regex plus ~40 read by eye
- Collision root-cause attribution: **MEDIUM** — the allocator defect is measured, the attribution of all 8 collisions to it is inferred (A1)

**Research date:** 2026-09-15
**Valid until:** ~2026-09-22 for the counts (the register gains seeds weekly — **re-derive, never quote**), indefinite for the structural findings (§1.2, §4.4, §5.1, §5.4, §5.5)
