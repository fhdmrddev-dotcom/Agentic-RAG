---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
verified: 2026-09-16T20:40:54Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
verification_mode: self-verified
independent_review: owed
re_verification: false
gaps: []
deferred: []
human_verification:
  - test: "Push a commit touching `supabase/migrations/**`, `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` or `scripts/check-schema-acl-parity.cjs` to a matching branch (or open a PR), and confirm the `schema-acl-parity` GitHub Actions job actually runs — both steps, `--self-test` first."
    expected: "The job appears in the Actions tab, `node scripts/check-schema-acl-parity.cjs --self-test` passes 29/29, and the scan step passes 133/133. A deliberately unmirrored REVOKE in the same push must turn the job RED."
    why_human: "GitHub Actions cannot be executed from this worktree. `253-02-SUMMARY.md` states this in writing rather than claiming it — the workflow file exists, parses under js-yaml, and both of its command strings were reproduced locally (exit 0 clean / exit 1 against a planted defect), but the job itself has never run. This is the one half of MC-4 that is owed."
---

# Phase 253: The bootstrap artifact tells the whole truth — Verification Report

**Phase Goal:** A database born from `supabase/full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail.

**Verified:** 2026-09-16T20:40:54Z (UTC) · repo `develop` @ `69f06cef0`
**Status:** `human_needed` — every ROADMAP success criterion is met; one CI-execution item cannot be driven from here
**Re-verification:** No — initial verification
**Verification mode:** ⛔ `self-verified` — the fifth consecutive phase this milestone (`DEBT-06`, `BUS-257`). Recorded as standing debt, not as a finding of this phase.

---

## How this phase was verified

This is a gap-closure phase about **guards that were green while broken**. A gate's exit code is therefore not evidence here. Every criterion below was driven by this verifier **in its own process**, against **scratchpad copies** of the artifacts, with the real files' md5 asserted before and after each drive. SUMMARY.md transcripts were read as claims and then re-measured, never quoted as proof.

- The real `scripts/full-schema-supplement.sql` measured `da9c561634d417ebd289bedf07b75f69` **before and after every drive in this report**.
- The operator's live dev data on `127.0.0.1:54322` was measured intact **after** the greenfield harness ran: **169 documents · 7,995 chunks · 0 `greenfield_acl_*` databases left behind.**
- ⛔ `node scripts/check-hot-file-ledger.cjs 253` was run and returns `scan list: 284 rows · subject: 12 files · watched: **0**`, exit 0. It is structurally blind to every file in this phase and **is not cited anywhere below**. SC#5 was verified by reading the rows and re-deriving triples by hand.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence (measured by this verifier) |
|---|-------|--------|--------------------------------------|
| 1 | **SC#1** — on a database bootstrapped from `full-schema.sql` **alone**, `select access_token_ciphertext from connector_tokens` **as `authenticated`** is refused | ✓ VERIFIED | Re-ran `./backend/venv/Scripts/python.exe scripts/check-greenfield-privileges.py`: scratch DB `greenfield_acl_114892_1789591010` created, `full-schema.sql applied ALONE`, `[SC#1] … -> InsufficientPrivilegeError: permission denied for table connector_tokens` (×2, access + refresh). The `[control] SELECT id … -> the read SUCCEEDED` line is present, so the refusal is not a false green from an unreachable table. `pg_class.relacl connector_tokens = {postgres, service_role}` only. **exit 0 · 0 violations · teardown verified** |
| 2 | **SC#2** — every column `_TABLE_SELECTABLE_KEYS` names is readable on a fresh DB; a fence pins §5 to the model | ✓ VERIFIED | Same run: `[SC#2] supplement §5 grants 20 columns … all 20 are readable as authenticated`. Fence re-run by me: `pytest tests/unit/test_253_supplement_column_parity.py -q` → **7 passed**, no DB/network/env. Derived expectation table printed 20 column grants on `connector_connections` including the five that were missing (`auth_type`, `status`, `error_message`, `default_approval_posture`, `default_ingest_visibility`) |
| 3 | **SC#3** — deleting the single `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` line makes the gate exit **non-zero** | ✓ VERIFIED | Driven by me on a scratchpad copy via the exported `analyse`/`report`: siblings (`FROM anon`, `TO service_role`) asserted PRESENT so the deletion is genuinely *partial* → **exit 1**, `mirrored: 132/133`, `[not-mirrored] REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM public`. Unmodified control copy → **exit 0 / 133 of 133** |
| 4 | **SC#4** — a `--` inside a string literal cannot hide a following ACL | ✓ VERIFIED | Driven by me: `aclsIn("COMMENT … IS 'a value -- with a double dash…'; REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;")` → `["public.danger(integer)"]`, identical to the no-dash control. **Live, not hypothetical:** `statements()` over real migration `180` now yields **5 chunks containing 3 `COMMENT ON COLUMN` statements** — matching the file's real count of 3 (the shipped splitter collapsed them to 1) |
| 5 | **SC#5** — the absent ledger rows exist with same-commit sections, and the twelve CR-08 triples are re-derived | ✓ VERIFIED | 3 rows at `docs/HOT-FILE-LEDGER.md:10647-10649` + 3 detail sections at `:14385`, `:14443`, `:14508`, **all in commit `22972ca6e`** together with the CLAUDE.md row. I re-derived **7 of the 12** triples with the CLAUDE.md recipe — all exact (see table below) |
| 6 | The greenfield harness was shown **RED against the unfixed supplement** and GREEN after, with its own transcript | ✓ VERIFIED | Independently reconstructible from git, not taken on trust: at the RED point (`3192f480f`) the supplement contained **0** occurrences of `connector_tokens` and **0** of `app_settings`/`user_settings`/`connector_watches`. See "Deviations assessed" §1 |
| 7 | The assertion set is **derived** by scanning `supabase/migrations/` with no exception list, and refuses a collapsed scan set | ✓ VERIFIED | Harness output: `migration scan — files read: 148 (floor 120)`, `32 table/column ACL statements replayed`, `derived checks issued: 126 table-level · 1688 column-level`, plus a printed derived-expectation table. Skip path driven by me: `--self-test-skip` → `SKIPPED … exit 2, never 0` (**exit=2**). The gate's twin assertion also fires: self-test arm `COUNT: a collapsed scan set is a harness error, never a pass` PASSES |
| 8 | §5 and `_TABLE_SELECTABLE_KEYS` are pinned by a **passing, database-free** pytest | ✓ VERIFIED | 7 passed in 0.17 s. Imports `_TABLE_SELECTABLE_KEYS` from `connector_service`; three-part form (`keys − §5 == ∅`; `§5 − keys == {created_by}` by name; `secret_ciphertext ∉ §5`) |
| 9 | **D-11** — supplement and `full-schema.sql`'s tail are byte-identical and ship in the **same commit** | ✓ VERIFIED | `md5sum scripts/full-schema-supplement.sql` = `tail -n 653 supabase/full-schema.sql \| md5sum` = **`da9c561634d417ebd289bedf07b75f69`** (matches the value stated in the brief). All **6** most recent commits touching either file touch **both** (`b9067a904`, `c73463658`, `3192f480f`, `588373b4c`, `a7efe17d1`, `0396aea27`) |
| 10 | The gate sees **TABLE and COLUMN** privileges beside the function tuples (D-07) | ✓ VERIFIED | `aclsIn(migration 118)` → **16 entries, all table/column** (`tbl\|REVOKE\|public.connector_connections\|ALL\|<table-level>\|anon`, `tbl\|GRANT\|…\|SELECT\|id\|authenticated`, …). Scan verdict: `FUNCTION: 61 … → 61 tuple(s) · TABLE/COLUMN: 32 … in 12 file(s) → 72 tuple(s) · mirrored: 133/133`. **I drove the table half RED myself** — see the extra drive below |
| 11 | Ordering and reverse-drift are **out of scope by decision**, and the prose says so rather than claiming coverage | ✓ VERIFIED | `grep -c "must precede"` = **0** in both the gate and the supplement; `"asserted by the plan"` = **0**. A `CHECKS / DOES NOT` block at `check-schema-acl-parity.cjs:51-67`, a `WHAT THIS GATE DOES NOT CHECK` block in the failure text at `:523-529`, and the widened `⚠ ORDER IS LOAD-BEARING, AND NOTHING CHECKS IT` paragraph at `full-schema-supplement.sql:497-506` — each with a re-open trigger. ⭐ **The prose is accurate, not merely present:** I appended an extra `GRANT SELECT (secret_ciphertext)` to a supplement copy and the gate exited **0**, exactly as the prose admits |
| 12 | `--self-test` carries four new arms, each falsified against a planted defect | ✓ VERIFIED | `node scripts/check-schema-acl-parity.cjs --self-test` → **exit 0, 29/29** assertions, read line by line. All four commissioned arms present and passing, including `NEW RED arm 2 (FALSE-POSITIVE CONTROL)` — the replacement for the vacuous dollar-quote arm — and `NEW RED arm 3 (COLUMN-SET): the failure names the MISSING COLUMN b, and not a` |
| 13 | **MC-4** — the gate is invoked by something other than a human, and the hook has been seen to fire | ✓ VERIFIED | `grep -rn "check-schema-acl-parity" .github .claude` (minus `get-shit-done`) = **8**. Registered at `.claude/settings.json` → `PostToolUse[5]`, matcher `Write\|Edit`, timeout 20 — JSON parses. ⭐ **I drove the hook myself against an isolated defective tree** (real repo untouched): see the hook drive table below |
| 14 | **SEED-266** — arm (a) recorded answered, `status` still `partially-answered`, arms (b)/(c) open | ✓ VERIFIED | Frontmatter reads `status: partially-answered`, `partial: true`, `folded_into: null`. A dated `── 2026-09-17 · ANSWERED — ARM (a), by Phase 253` block sits inside `status_note`; `⛔ ARMS (b) AND (c) STAY OPEN, WITH THEIR EXISTING TRIGGERS UNCHANGED`. `node scripts/check-seeds-register.cjs` → **296/296 parsed, 0 duplicate ids**, exit 0 |

**Score: 14 / 14 truths verified. All five ROADMAP success criteria are met.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/check-greenfield-privileges.py` | re-runnable greenfield privilege gate | ✓ VERIFIED | 1,157 lines. Re-run by me end-to-end: exit 0, 0 violations. Takes **no DSN and no env var** (`main()` rejects any argument but `--self-test-skip`); target guard anchored to `^greenfield_acl_[0-9]{1,10}_[0-9]{1,14}$`, loopback-only, port 54322 only |
| `scripts/full-schema-supplement.sql` | mirrored ACLs for all seven ACL-bearing tables | ✓ VERIFIED | 653 lines. `grep -c connector_tokens` → **9**; `app_settings`/`user_settings` revokes at `:461-472`; §0 `SET search_path = public;` at `:75` |
| `supabase/full-schema.sql` | bootstrap artifact whose tail is the supplement byte for byte | ✓ VERIFIED | `grep -c connector_tokens` → **36**; `SET search_path = public;` at `:7329`; tail md5 identical |
| `backend/tests/unit/test_253_supplement_column_parity.py` | no-database drift fence | ✓ VERIFIED | 7 passed, 0.17 s |
| `scripts/check-schema-acl-parity.cjs` | tuple-keyed, literal-aware, table **and** function gate | ✓ VERIFIED | 883 lines; exports `normaliseSignature, statements, aclsIn, analyse, report, MIN_MIGRATION_FILES`; only `fs`/`path`/`os` required |
| `.claude/hooks/schema-acl-parity-guard.js` | in-turn PostToolUse guard | ✓ VERIFIED | Driven loud-vs-silent by me with a defect planted (below) |
| `.github/workflows/schema-acl-parity.yml` | CI backstop | ⚠ PRESENT, **NOT DRIVEN** | Well-formed: `runs-on: ubuntu-latest`, `actions/checkout@v4` → `--self-test` → scan, five path filters, `push` + `pull_request`. Both command strings reproduce locally. ⛔ The job has never executed — routed to human verification, **not** counted as a gap (the SUMMARY states it plainly) |
| `docs/HOT-FILE-LEDGER.md` | 3 rows + 3 sections + 12 re-derived triples | ✓ VERIFIED | Rows `:10647-10649`, sections `:14385/:14443/:14508`, all in `22972ca6e` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `scripts/full-schema-supplement.sql` | `supabase/full-schema.sql` | byte-identical tail, same commit | ✓ WIRED | md5 `da9c561634d417ebd289bedf07b75f69` on both sides; 6/6 recent commits touch both |
| `test_253_supplement_column_parity.py` | `connector_service._TABLE_SELECTABLE_KEYS` | direct import | ✓ WIRED | 7 passing cases; the RED-drive history shows it naming the planted column |
| `check-greenfield-privileges.py` | `supabase/migrations/` | derived scan with non-vacuity floor | ✓ WIRED | `files read: 148 (floor 120)`, 32 statements, 12 files — no exception list |
| `.claude/settings.json` | `.claude/hooks/schema-acl-parity-guard.js` | PostToolUse `Write\|Edit` entry | ✓ WIRED | `PostToolUse[5]`, timeout 20; JSON parses |
| `.claude/hooks/schema-acl-parity-guard.js` | `scripts/check-schema-acl-parity.cjs` | `execFileSync(process.execPath, [gate])` | ✓ WIRED | Driven; reports `acl_parity_gate_exit: 1` |
| `CLAUDE.md` | `docs/HOT-FILE-LEDGER.md` | same-commit row ↔ section | ✓ WIRED | Both edited in `22972ca6e`; CLAUDE.md row at `:799` |
| `.github/workflows/schema-acl-parity.yml` | GitHub Actions runner | `on: push` / `on: pull_request` | ⚠ UNPROVEN | Cannot be executed locally — the human-verification item |

---

### Independent Adversarial Drives (this verifier's own, not the executor's)

#### The PostToolUse hook, driven against a tree that **would** fail

Run against an isolated `CLAUDE_PROJECT_DIR` holding a copy of the 148 migrations, the gate, and a supplement with the one `FROM PUBLIC` line deleted. **The real repository was never modified** (md5 identical before and after).

| # | Payload | Defect planted? | Result | Verdict |
|---|---|---|---|---|
| A | `supabase/migrations/181_…sql` | yes | exit 0 · **2,612 bytes** · `acl_parity_gate_exit: 1` · names `resize_embedding_column … FROM public` | REPORTS |
| B | `frontend/src/App.tsx` | **still planted** | exit 0 · **0 bytes** | silent — path filtered, not silent because clean |
| C | `supabase/seed.sql` (unnumbered) | **still planted** | exit 0 · **0 bytes** | silent — unnumbered `.sql` correctly excluded |
| D | `C:\…\scripts\full-schema-supplement.sql` (Windows separators) | **still planted** | exit 0 · **2,613 bytes** · gate exit 1 | REPORTS — separator normalisation works |
| E | `supabase/full-schema.sql` | **still planted** | exit 0 · **2,578 bytes** · gate exit 1 | REPORTS |
| F | `supabase/migrations/181_…sql` | **removed** | exit 0 · **0 bytes** | silent — the silence is earned |

⭐ Cases B, C and F together are what make this non-vacuous: two negatives taken with the defect *still planted* (so they prove the path filter), and one negative on a clean tree (so it proves the gate agrees).

#### The TABLE/COLUMN half driven RED — the CR-01 arm, on the real supplement's content

| Plant (on a scratchpad copy) | Result |
|---|---|
| drop the column `auth_type` from §5's `GRANT SELECT` list | **exit 1** — `[not-mirrored] GRANT SELECT (auth_type) ON public.connector_connections TO authenticated — migrations/129…, migrations/150… writes it` |
| drop one `REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated` | **exit 1** — `[not-mirrored] REVOKE ALL ON public.connector_tokens FROM authenticated` |
| whitespace-only change (control) | **exit 0**, `133/133` |
| append an **extra** `GRANT SELECT (secret_ciphertext)` (reverse drift) | **exit 0** — confirming the documented limitation is honest, not aspirational |

---

### Data-Flow Trace (Level 4)

Not applicable in the UI sense — this phase ships no rendering surface. The equivalent trace was run instead: **does real privilege data flow through the gates, or do they read constants?**

| Artifact | "Data" | Source | Real? | Status |
|---|---|---|---|---|
| `check-greenfield-privileges.py` | expectations | `readdir` over `supabase/migrations/` with a floor of 120 files; replayed last-statement-wins | yes — `148 files read`, `32 statements`, printed derivation table | ✓ FLOWING |
| `check-greenfield-privileges.py` | measurements | `has_table_privilege` / `has_column_privilege` on a **real scratch database**, as `authenticated` | yes — 126 + 1,688 live checks | ✓ FLOWING |
| `check-schema-acl-parity.cjs` | expected tuples | lexed from the migration files at run time | yes — no hardcoded total; the only `32` in the file is comment line 47 | ✓ FLOWING |
| `test_253_supplement_column_parity.py` | the key set | live `import` of `_TABLE_SELECTABLE_KEYS` | yes — 19 keys read from running code | ✓ FLOWING |

---

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| ACL parity scan on the real tree | `node scripts/check-schema-acl-parity.cjs` | `mirrored: 133/133`, exit 0 | ✓ PASS |
| Gate falsification | `node scripts/check-schema-acl-parity.cjs --self-test` | **29/29**, exit 0 | ✓ PASS |
| Greenfield privileges | `./backend/venv/Scripts/python.exe scripts/check-greenfield-privileges.py` | 0 violations, exit 0, teardown verified | ✓ PASS |
| Skip is not a pass | `… --self-test-skip` | `SKIPPED … exit 2, never 0`, **exit=2** | ✓ PASS |
| Column drift fence | `pytest tests/unit/test_253_supplement_column_parity.py -q` | 7 passed | ✓ PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | **104,538** chars, no structural findings, exit 0 | ✓ PASS |
| Seeds register gate | `node scripts/check-seeds-register.cjs` | 296/296 parsed, 0 duplicate ids, exit 0 | ✓ PASS |
| G-7 round cap | `node scripts/check-gap-closure-rounds.cjs 253` | `G-7 clear — no gap-closure plans`, exit 0 | ✓ PASS |
| Operator data intact | live read on `:54322` | 169 documents · 7,995 chunks · 0 scratch DBs left | ✓ PASS |
| Backend unit baseline | *cited, not re-run* | **71 failed · 4,878 passed · 2 xfailed · 2 xpassed · 0 collection errors** — at the ceiling, zero headroom. Both summaries publish an identical failing **SET** (24 files), and this phase touched no backend source beyond one new all-passing test file which I ran | ✓ PASS (cited) |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository, and neither PLAN nor SUMMARY declares a probe. The equivalent obligation for this phase — *run the gates yourself, do not accept a transcript* — was discharged through the spot-checks and adversarial drives above.

| Probe | Command | Result | Status |
|---|---|---|---|
| *(none declared; none conventional)* | — | — | N/A |

---

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|---|---|---|---|---|
| `CRED-03` | `253-01-PLAN.md` | greenfield deploy is not born with over-permissive privileges | ✓ SATISFIED | SC#1 + SC#2 driven on a real scratch database as `authenticated`. `REQUIREMENTS.md:101` and `:286` both updated by `a37cc673d` to record the table half beside the earlier function-half tick |
| `CRED-04` | `253-02-PLAN.md` | the gate that claims to prove parity can actually fail | ✓ SATISFIED (in code) | SC#3 + SC#4 driven by me. ⚠ **Register drift:** `REQUIREMENTS.md:108` and `:287` were **not** updated by this phase, though ROADMAP §253 says it *re-closes `CRED-04`*. `CRED-03`'s two rows were updated; `CRED-04`'s were not. Bookkeeping only — see Findings |

No orphaned requirements: ROADMAP's coverage table maps **no new ids** to Phase 253, and both plans declare exactly `CRED-03` / `CRED-04`.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **Zero** across all six phase-authored/modified source files |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **Zero** |

No debt-marker gate fires. No file was deleted by this phase (`git diff --diff-filter=D` over the phase range is empty). The working tree carries three unrelated pre-existing modifications (`.claude/settings.local.json`, a Phase 236 report, an untracked screenshot) that predate this session.

---

## Deviations assessed (the two the executors named, judged rather than rediscovered)

### 1. `253-01` — the substituted RED property **does carry the RED**. ✓ ACCEPTED

Task 2's original criteria (supplement md5 still `6a58a476…`; clean `git status` after Task 2) became unreachable when the harness's first run found `full-schema.sql` unappliable: no privilege can be measured on a database that does not exist. The substituted property was `grep -c connector_tokens scripts/full-schema-supplement.sql` → **0**, asserted immediately before the drive.

**I did not take that on trust — it is reconstructible from git.** At the RED commit `3192f480f`:

- the supplement contained **0** occurrences of `connector_tokens`, and **0** of `app_settings` / `user_settings` / `connector_watches`;
- the commit's diff to the supplement is `23 insertions, 0 deletions`, of which the **only** non-comment line is `SET search_path = public;`;
- `git show 3192f480f -- scripts/full-schema-supplement.sql | grep '^+' | grep -cE "GRANT|REVOKE"` → **0**.

So the artifact under the RED drive was the fully unmirrored one. The abandoned md5 criterion was a *procedural proxy* for "the supplement has not been fixed yet"; the property it proxied for was preserved exactly and is independently provable. **The RED is substantive, and the 1,045 → 0 violation delta means what it says.**

### 2. `253-02` — per-**COLUMN** keying is genuinely at least as sensitive as per-column-**SET**. ✓ ACCEPTED

The wording of D-07 (`(table, grantee, verb, column-set)`) was measured to produce **7 false reds against a correct supplement**, because the migrations are a history (six migrations grew `connector_connections`'s readable set) while the supplement is a final state. The implementation keys per column instead.

Assessed on the semantics, not on the executor's argument:

- In PostgreSQL, `GRANT SELECT (a, b) ON t TO r` is **exactly** equivalent to two single-column grants. The grouping carries no privilege semantics, so it cannot be the identity of a fact. Per-column is the semantically correct key; per-set encodes a syntactic accident.
- Sensitivity is strictly greater at naming granularity, and **I saw the arm prove it**: `NEW RED arm 3 (COLUMN-SET): mirroring (a) where the migration granted (a, b) exits 1` and `… the failure names the MISSING COLUMN b, and not a` — both PASS, and both were shown to FAIL under planted DEFECT B.
- The one thing per-column could have lost — collapsing a **table-level** fact into a **column-level** one — is prevented by the distinguished `<table-level>` marker, which has its own arm (`a table-level REVOKE ALL never collapses into the column-level REVOKE ALL (secret)`), passing.
- I drove the table half independently: dropping one column from §5 reds the gate and **names that column**; dropping one table-level `REVOKE ALL` reds it and **names the grantee**.

**Verdict: not a loosening. The literal wording would have shipped a gate that reds against a correct artifact — which is how a guard gets switched off.** The deviation is stated in the SUMMARY rather than glossed, which is the correct handling.

### 3. `253-02` — CI not driven. ✓ ACCEPTED AS STATED, routed to human verification

The SUMMARY says so in a dedicated section titled *"The workflow — the UNDRIVEN half, said plainly"*. That admission is **accurate**: I confirmed the file exists, is well-formed, and that both of its command strings reproduce locally. An owed item stated in writing is not a gap. It is the single `human_verification` entry.

---

## SC#5 — the twelve triples, re-derived by this verifier

I re-derived **7 of the 12** with the CLAUDE.md recipe (`git log --oneline | wc -l` / phase-bucket extraction with six-digit dated-quick-task buckets subtracted / `wc -l`). Every one matches the ledger exactly:

| File | Ledger row now says | **I measured** | Match |
|---|---|---|---|
| `scripts/full-schema-supplement.sql` | `11 / 6 / 653` | `11 / 6 / 653` (buckets 162 165 190 211 252 253) | ✓ |
| `scripts/check-schema-acl-parity.cjs` | `3 / 2 / 883` | `3 / 2 / 883` | ✓ |
| `scripts/check-greenfield-privileges.py` | `1 / 1 / 1157` | `1 / 1 / 1157` | ✓ |
| `frontend/src/providers/StreamsProvider.tsx` | `104 / 38 / 4948` | `104 / 39 / 4948` raw → **38** after subtracting the dated quick-task bucket `260529`, exactly as the SUMMARY documents | ✓ |
| `backend/app/api/connectors.py` | `45 / 21 / 2162` | `45 / 21 / 2162` | ✓ |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | `8 / 4 / 645` | `8 / 4 / 645` | ✓ |
| `frontend/src/stores/streamsStore.ts` | `22 / 14 / 572` | `22 / 14 / 572` | ✓ |
| `frontend/src/components/panel/TodosSection.tsx` | `11 / 6 / 337` | `11 / 6 / 337` | ✓ |
| `frontend/src/components/panel/PhaseCard.tsx` | `17 / 11 / 788` | `17 / 11 / 788` | ✓ |
| `frontend/src/components/chat/ThinkingBlock.tsx` | `6 / 2 / 320` | `6 / 2 / 320` | ✓ |

The remaining rows (`PhaseTimeline.tsx 10/8/404`, `phaseStatusMeta.ts 4/4/291`, `connector_service.py 28/11/1858`, `WatchedFoldersSection.tsx 10/4/486`, `WatchRowCard.tsx 3/2/770`) were read from the ledger and are internally consistent with the same recipe; the sample above is large enough that a systematically wrong derivation would have surfaced.

⭐ Two of the twelve were **findings, not bookkeeping**, and both are recorded rather than papered over: `sourceHealthVocabulary.ts` carries `⛔ FIRES — UNDISPOSITIONED` naming 252-03 as the touch nobody dispositioned, and `WatchedFoldersSection.tsx` carries `⚠ FIRES — STATE CHANGE` (from `no (3 phases)` to firing at 4).

---

## Findings

### ⚠ WARNING — `CRED-04`'s `REQUIREMENTS.md` rows were not updated, though ROADMAP says 253 re-closes it

`REQUIREMENTS.md:108` and `:287` still read *"Phase 248 — The Credential Boundary · Complete (251-04 sweep)"* with no mention of Phase 253. `CRED-03`'s two rows **were** updated (commit `a37cc673d`). This is one-sided register drift of exactly the class `REG-01`/`REG-02` exist to prevent, in the milestone that shipped them.

⛔ **This is bookkeeping, not a goal miss.** `CRED-04`'s substance for this phase is SC#3 and SC#4, and both are verified in code by independent drive. It does not block the phase and does not warrant a gap-closure round (G-3 sized: two lines in one file). Recorded so it is not discovered again at milestone close.

### ⛔ STANDING DEBT (not a finding of this phase) — `DEBT-06`

`verification_mode: self-verified`, `independent_review: owed` — the **fifth consecutive** phase (249, 250, 251, 252, 253). `253-02-SUMMARY.md` §Task 4G states plainly that no `.agent-bus` item was found or created, and that queuing a review of one's own work would be the self-assessment the protocol forbids. Its structural half also remains unmet: `grep -rln "independent_review" scripts/ .claude/hooks/` returns nothing — **nothing executable reads the field the close condition is written against.** `BUS-257`.

### Carry-forward observations (not gaps — no action required by this phase)

1. **The `search_path` defect class is not closed, only this instance.** `supabase/full-schema.sql` was unappliable end-to-end from `a7efe17d1` (Phase 252-01) to `3192f480f`, because `pg_dump` leaks `set_config('search_path','',false)` into everything appended after it. **The fix holds** — I confirmed it: the harness reports `supabase/full-schema.sql applied ALONE` and reaches a privilege verdict, which is only possible if §0 resolves §6's unqualified `vector`. But the *session* half is guarded only by §0's comment and by the harness happening to apply the artifact end to end. A future `pg_dump` emitting another `SET` breaks it the same way. Correctly deliberately **not** fixed by qualifying to `public.vector`, which would have changed the signature text the parity gate compares. Recorded in `SEED-266` as strengthening arm (b).
2. **`MC-5` — `check-hot-file-ledger.cjs` is blind to `scripts/`.** Confirmed by me: `watched: 0 of 12`, exit 0 regardless of whether the three new rows exist. `WATCHED = [^backend/app/, ^frontend/src/]`; `EXEMPT` drops `^scripts/`, `.md`, `.sql`. This is the structural cause of `full-schema-supplement.sql` having no row for six phases. Deliberately not fixed here (a shared-guardrail change needs its own scope); re-open trigger written into the ledger: *the next phase whose `files_modified` names a `scripts/` file*.
3. **`CR-08`'s line-count proposal is unacted.** The ledger gate is satisfied by a row **existing** and never compares it to `wc -l` — which is why this pass found twelve stale rows and two registers disagreeing on four of them. Planted as a finding with the same re-open trigger.
4. **Reverse drift is undetected by design** (confirmed by my own drive: an extra `GRANT SELECT (secret_ciphertext)` exits 0). Partially mitigated for the one column that matters by `test_section_5_never_grants_the_secret_column`. Documented with a re-open trigger in all three prose homes.
5. **Hot-file debts surfaced by SC#5 and owed elsewhere:** `sourceHealthVocabulary.ts` G-5 fired **undispositioned** at 252-03 and the seam is owed; `WatchedFoldersSection.tsx` changed G-5 state to FIRING at 4; `backend/app/api/connectors.py` took a **seventh** landing at `45 / 21 / 2162` with its extraction still owed (`SEED-224` class).
6. **The hook lives outside the vendored framework** and its `.claude/settings.json` registration can be silently dropped by a settings rewrite — the file itself warns about this. Worth adding to the CLAUDE.md "re-apply as a set" table at the next framework update.

---

## Deferred Items

None. Phase 253 is the **last** phase of the v4.2 milestone (247–253); there is no later phase to which any item could be deferred. Every unmet item above is either a carry-forward observation with a written re-open trigger or a standing milestone-wide debt.

---

## Human Verification Required

### 1. The `schema-acl-parity` CI job has never executed

**Test:** Push a commit touching `supabase/migrations/**`, `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` or `scripts/check-schema-acl-parity.cjs` to `develop` (or open a PR), and look at the Actions tab. For a stronger check, include a deliberately unmirrored `REVOKE` in that push and confirm the job goes **red**, then remove it.

**Expected:** The job appears and runs two steps in order — `node scripts/check-schema-acl-parity.cjs --self-test` (29/29) then `node scripts/check-schema-acl-parity.cjs` (133/133). With an unmirrored REVOKE present, step 2 exits 1 and the job fails.

**Why human:** GitHub Actions cannot be executed from a local worktree. The workflow file exists, parses, and both command strings reproduce locally — but *"the YAML is correct"* is precisely the class of claim this phase exists to distrust. `253-02-SUMMARY.md` states the omission in writing rather than claiming it was driven, which is why this is a verification item and not a gap.

**Note:** the **primary** guard under CLAUDE.md's two-guards rule is the local PostToolUse hook, and that half **was** driven — by the executor, and independently again by this verifier against a tree that would fail. The CI job is the backstop.

---

## Gaps Summary

**There are no gaps.** All five ROADMAP success criteria for Phase 253 are met, and each was re-measured by this verifier in its own process rather than read from a transcript:

- the **artifact** half (SC#1, SC#2) proved on a real scratch database as the `authenticated` role, with the operator's live data measured intact afterwards;
- the **gate** half (SC#3, SC#4) driven RED by me on scratchpad copies, for both the function tuple and — beyond what the SUMMARY drove — the table and column tuples, with a whitespace-only control staying green;
- the **wiring** (MC-4) driven loud-vs-silent against a tree that *would* fail, so the negatives prove the path filter rather than a clean tree;
- the **ledger** (SC#5) verified by reading the rows and re-deriving 7 of 12 triples by hand, precisely because `check-hot-file-ledger.cjs` is structurally blind here and cannot be cited.

Both deviations the executors named are **sound on inspection**, not merely disclosed: the substituted RED property is reconstructible from git and carries the full weight of the original, and per-column keying is strictly more sensitive than the literal per-column-set wording, which was measured to red against a correct artifact.

⭐ **Stopping here is a real option and is the recommended one.** The single outstanding item is a CI job that has never run — openly recorded by its own author — and the two register-level items (`CRED-04`'s `REQUIREMENTS.md` rows; the `DEBT-06` independent review) are a `/gsd:fast`-sized edit and a standing milestone gate respectively. **Neither justifies a gap-closure round** (G-7: a closure round may never be manufactured where every success criterion is verified).

---

_Verified: 2026-09-16T20:40:54Z_
_Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance_
_⛔ `verification_mode: self-verified` · `independent_review: owed` (DEBT-06, BUS-257) — fifth consecutive phase_
