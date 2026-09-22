---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
plan: 02
subsystem: deploy-artifacts / guardrails
tags: [CRED-04, CR-01, CR-02, CR-03, CR-08, MC-4, MC-5, MC-6, acl, greenfield, security]
requires:
  - 253-01 (the seven mirrored tables; the greenfield harness; the §0 search_path fix)
  - supabase/migrations/ (the 12 ACL-bearing migrations)
  - .claude/hooks/hot-file-ledger-guard.js (the PostToolUse shape)
  - .github/workflows/claude-md-size.yml (the CI backstop shape)
provides:
  - "scripts/check-schema-acl-parity.cjs — tuple-keyed, literal-aware, table AND function"
  - .claude/hooks/schema-acl-parity-guard.js (the PRIMARY guard — driven against a planted defect)
  - .github/workflows/schema-acl-parity.yml (the CI backstop — NOT driven from here)
  - "docs/HOT-FILE-LEDGER.md — 3 new rows + 3 sections, 12 re-derived triples"
affects:
  - scripts/full-schema-supplement.sql (§6 header prose only)
  - supabase/full-schema.sql (tail region only; head byte-unchanged)
  - .claude/settings.json (one additive PostToolUse element)
  - CLAUDE.md (1 new FIRING row, 9 re-derived rows)
tech-stack:
  added: []
  patterns:
    - "a single-pass SQL lexer: literal / identifier / dollar-quote / nested block comment"
    - "tuple keys with a distinguished <table-level> marker so two different facts cannot collapse"
    - "the NEGATIVE case driven against a tree that WOULD fail, never against a clean one"
    - "falsify the self-test arms themselves against planted defects in a scratchpad copy"
key-files:
  created:
    - .claude/hooks/schema-acl-parity-guard.js
    - .github/workflows/schema-acl-parity.yml
  modified:
    - scripts/check-schema-acl-parity.cjs
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - .claude/settings.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-266-full-schema-sql-carries-no-acls-and-leaks-row-security-off.md
decisions:
  - "Column grants are keyed PER COLUMN, not per column-SET as the plan worded it. MEASURED: the whole-set model produces 7 false reds against a CORRECT supplement, because the migrations are a history and the supplement is a final state. Per-column is also strictly more sensitive."
  - "The dollar-quote self-test arm was VACUOUS — it passed against its own planted defect — and was replaced with a false-positive control rather than written off."
  - "The hook's NEGATIVE case is driven with the CR-02 defect STILL PLANTED, so a silent exit cannot be green because the tree was clean."
metrics:
  duration: ~3h
  completed: 2026-09-17
  tasks: 4
  commits: 3
  base_sha: a56d6fea1885c3b1631e4fcbbd8dfdeb51ceb947
---

# Phase 253 Plan 02: The gate that could not fail, given teeth — and something that runs it

`scripts/check-schema-acl-parity.cjs` now fails on all three of the defects `252-REVIEW.md` proved
it could not see — each reproduced on this machine at this commit BEFORE the fix — and it is
invoked by a PostToolUse hook and a CI job rather than only by a human typing it.

## Base commit

Measured at agent start. The worktree came up at `84e3b020f9d13295ecd4b2d6851df6f341220c75`
(`origin/HEAD`, the stale `master` tip) and was `git reset --hard` to the instructed base:

```
$ git rev-parse HEAD
a56d6fea1885c3b1631e4fcbbd8dfdeb51ceb947
$ md5sum scripts/full-schema-supplement.sql
3a9b13bd557da238eeb7cfe9226d87af *scripts/full-schema-supplement.sql
$ ls scripts/check-greenfield-privileges.py
-rwxr-xr-x 1 fhdmr 197609 54479 Sep 16 23:43 scripts/check-greenfield-privileges.py
```

All three Wave-1 sanity checks matched. Branch `worktree-agent-ada12dbd4812d32fb`.

## Commits

| Hash | Subject |
|---|---|
| `b9067a904` | `fix(253-02): the ACL gate can fail on the three defects it was driven against` |
| `8790c4119` | `feat(253-02): wire the ACL gate so it can actually fail, and falsify its own arms` |
| `22972ca6e` | `docs(253-02): three absent ledger rows, twelve re-derived triples, SEED-266 arm (a)` |

⚠ **Task 1 produced NO commit, by design** — its acceptance criterion is *"`git status --short`
shows NO modified file at the end of this task"*. It is a pure RED reproduction; its output is the
transcripts below.

---

## D-19 — THE RED → GREEN PAIRS, SIDE BY SIDE

All three were driven with the **same script and the same fixtures** before and after
(`red-drive.cjs` in the session scratchpad; the supplement copy is regenerated on each run and the
real file is never touched).

### RED-1 / GREEN-1 — CR-02, the partial revoke (SC#3)

The deleted line, quoted verbatim, at supplement line **637**:

```
REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;
```

Its three siblings were asserted PRESENT in the copy before the drive, so the deletion is genuinely
*partial*:

```
  sibling present: true  <- REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM anon;
  sibling present: true  <- REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM authenticated;
  sibling present: true  <- GRANT EXECUTE ON FUNCTION public.resize_embedding_column(integer) TO service_role;
  FROM PUBLIC present in copy: false
```

| | **RED — the SHIPPED gate** | **GREEN — after Task 2** |
|---|---|---|
| verdict line | `function ACLs found: 16 · mirrored: 16` | `mirrored: 132/133` |
| failure output | *(none)* | `[not-mirrored]  REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM public — migrations/177_rls_app_settings_user_settings.sql writes it; the supplement does not` |
| `missing` | **0** | **1** |
| exit code | **0** | **1** |

⭐ **That green exit 0 IS the shipped defect.** `resize_embedding_column` is the RPC
`BUG-260911-01` found callable **unauthenticated in production**; it NULLs every vector in
`document_chunks` and `skill_embeddings`.

### RED-2 / GREEN-2 — CR-03, the comment swallow (SC#4)

```
input (swallowed):
  COMMENT ON COLUMN public.t.c IS 'a value -- with a double dash inside the literal';
  REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;
input (control):
  COMMENT ON COLUMN public.t.c IS 'a value with no double dash inside the literal';
  REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;
```

| | **RED — the SHIPPED gate** | **GREEN — after Task 2** |
|---|---|---|
| `aclsIn(swallowed)` | `[]` | one entry, `signature: "public.danger(integer)"` |
| `aclsIn(control)` | one entry, `public.danger(integer)` | one entry, `public.danger(integer)` |

**And it is LIVE, not hypothetical.** The shipped `statements()` over
`supabase/migrations/180_app_settings_self_hosted_endpoints.sql`:

```
SHIPPED statements() over migration 180 -> 3 chunk(s)
--- chunk[1]  quotes=4  lines=7 ---
    COMMENT ON COLUMN app_settings.lmstudio_base_url IS
      'LM Studio OpenAI-compatible endpoint. INCLUDES /v1
    COMMENT ON COLUMN app_settings.custom_base_url IS
      'Generic OpenAI-compatible endpoint (...). Stored and used VERBATIM
    COMMENT ON COLUMN app_settings.custom_api_key IS
      'Bearer token for custom_base_url. ...'

How many COMMENT ON COLUMN statements does the file really contain?  3
How many chunks does the SHIPPED splitter produce that contain a COMMENT ON COLUMN? 1
```

The closing quote **and** the semicolon of lines 30 and 32 were truncated away with the "comment",
so the first surviving `;` is line 34's and **every boundary after line 30 is shifted**. Three real
statements became one chunk.

### RED-3 / GREEN-3 — CR-01, the table/column blindness

Twelve ACL-bearing migrations read, named in full:
`118_connector_secret_column_privilege.sql` · `126_mcp_connector_connections.sql` ·
`127_connector_connection_service_identity.sql` · `128_connector_connection_posture.sql` ·
`129_connector_oauth_tokens.sql` · `150_connector_oauth_client_secret.sql` ·
`151_connector_tokens_rls_policy.sql` · `156_grant_default_ingest_visibility_column.sql` ·
`168_connector_watches.sql` · `169_connector_watch_items.sql` · `172_connector_sync_runs.sql` ·
`177_rls_app_settings_user_settings.sql`.

| | **RED — the SHIPPED gate** | **GREEN — after Task 2** |
|---|---|---|
| TABLE/COLUMN entries from `aclsIn` over the twelve | **0** | **84** |
| statements the gate reports | `61 GRANT/REVOKE statements` (all function) | `FUNCTION: 61 in 5 files → 61 tuples` · `TABLE/COLUMN: 32 in 12 files → 72 tuples` |

MC-6 re-derived independently by the shell recipe, never typed:

```
$ grep -rn -E "^[[:space:]]*(GRANT|REVOKE)[[:space:]]+" supabase/migrations/ | grep -viE "EXECUTE ON FUNCTION" | wc -l
32
```

…and by the gate itself at run time:

```
table/column statements per migration: 118 (4) · 126 (1) · 127 (1) · 128 (1) · 129 (3) · 150 (1) · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)
```

### The gate against the real tree, after the rewrite

```
schema ACL parity — migrations scanned: 148 · FUNCTION: 61 statement(s) in 5 file(s) → 61 tuple(s) · TABLE/COLUMN: 32 statement(s) in 12 file(s) → 72 tuple(s) · mirrored: 133/133
schema ACL parity OK — every function AND table/column ACL in supabase/migrations/ is mirrored in the supplement.
scan exit=0
```

⭐ **133/133 on the first run** — plan `253-01`'s mirror is complete under a gate that can now
actually see it. No finding had to be carried back.

---

## ⚠ DEVIATION 1 [Rule 1 — the plan's model would have produced a FALSE RED] — column grants are keyed PER COLUMN, not per column-SET

The plan (D-07, Task 2C) words the table tuple as `(table, grantee, verb, column-set)` with the
column-set sorted. **Implemented literally, that reds against a CORRECT supplement**, and the
reason is structural rather than cosmetic: **the migrations are a HISTORY and the supplement is a
FINAL STATE.** `public.connector_connections`'s readable column set was grown across SIX migrations
(118, 126, 127, 128, 150, 156), each granting a different subset; the supplement mirrors the union
as one 20-column block.

**Measured, not argued.** The whole-set model was implemented over this very tree
(`colset-counterfactual.cjs`) and run:

```
COLUMN-SET keying (the plan's literal wording) over the REAL tree
  expected table tuples : 51
  mirrored              : 44
  MISSING (false reds)  : 7

  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(auth_type, error_message, status)|authenticated   <- 129
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(auth_type, status)|authenticated                  <- 150
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(capability, config, created_at, created_by, id, is_enabled, last_check_verdict, last_checked_at, name, org_id, updated_at)|authenticated  <- 118
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(default_approval_posture)|authenticated           <- 128
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(default_ingest_visibility)|authenticated          <- 156
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(discovered_tools, mcp_server_url, tool_grants)|authenticated  <- 126
  [not-mirrored] tbl|GRANT|public.connector_connections|SELECT|(service_id)|authenticated                         <- 127

Are those columns actually absent from the supplement? (per-COLUMN check)
  ... columns genuinely absent from the supplement: NONE — the whole set is present, column by column
  (all seven)
```

**Seven false reds, zero genuinely absent columns.** Per-column keying is also strictly MORE
sensitive, which is why this is not a loosening: a supplement granting `(a)` where the migration
granted `(a, b)` fails, and **the failure NAMES `b`**. Both properties are pinned in `--self-test`.

⛔ The plan's hard constraint is preserved exactly: a table-level statement carries the
distinguished `<table-level>` marker, so a table-level `REVOKE ALL` can never collapse into a
column-level `REVOKE ALL (c)`. That is its own self-test arm.

⚠ **I first wrote "9 false reds" into the gate's docstring from memory and then measured 7.**
The comment was corrected to the measured figure before the commit. Recorded because this project's
most-repeated failure is a number that was plausible when written.

---

## ⚠ DEVIATION 2 [Rule 1 — a self-test arm that could not fail] — the dollar-quote arm was VACUOUS

Task 3's acceptance requires the `--self-test` arms to be falsified, not merely present. Driving
them against three planted defects in scratchpad COPIES of the gate found that **the dollar-quote
arm PASSED against its own defect.**

The original fixture wrapped an ordinary plpgsql body containing a `--` and asserted the ACL
*after* it was still found. The naive `line.indexOf('--')` splitter survives that, because the
body's `$$ … ;` terminator sits on a line of its own — so the arm asserted something that was true
either way. **An arm that cannot fail is the CR-02 defect one level up.**

**Fixed by changing the fixture, not by writing the finding off.** The dollar-quote case is now a
**false-positive control**: a body whose TEXT contains an ACL-shaped line at a statement boundary.
A splitter that does not know `$$` mines the body and counts a **PHANTOM** revoke that no database
will ever execute — which inflates the expected set and reds the gate against a correct supplement,
i.e. how a guard gets switched off. Quote-awareness alone does not save it; there is not a quote
involved.

Re-driven, the arm now fires:

```
FAIL  NEW RED arm 2 (FALSE-POSITIVE CONTROL): an ACL-shaped line INSIDE a dollar-quoted body is a
      PHANTOM and is NOT counted  — REVOKE EXECUTE ON FUNCTION public.phantom_from_body() FROM public · ...
```

---

## D-18 / Task 3 — `--self-test`, and the falsification of its own arms

**29/29 assertions, exit 0.** The three preserved normaliser arms, the preserved GREEN and
whole-function-omission arms, plus the four commissioned ones:

| Arm | What it plants | Assertions |
|---|---|---|
| **1 — PARTIAL REVOKE** (CR-02) | `REVOKE … public.alpha() FROM PUBLIC;` deleted, `FROM anon` + `TO service_role` kept | exits 1 · names the `REVOKE / public.alpha() / public` tuple · `missing.length === 1`, so the siblings are still seen as mirrored. Labelled in-file with the real instance it stands for: `resize_embedding_column … FROM PUBLIC` |
| **2 — COMMENT-SWALLOW** (CR-03) | a `--` inside a literal; a dollar-quoted body; a doubled `''` escape | all three still yield their signatures · the phantom-in-a-`$$`-body control · the entirely-commented `public.never_real()` line is STILL not counted · plus the `^\s*` anchor arm and a CRLF-parity arm |
| **3 — TABLE/COLUMN** (CR-01) | `REVOKE ALL ON TABLE public.widgets FROM anon, authenticated;` unmirrored, beside a multi-line `GRANT SELECT ( a, b )` | the gate SEES 4 table statements at all · exits 1 · names **both** grantees · a table-level `REVOKE ALL` never collapses into the column-level `REVOKE ALL (secret)` · a column-set arm: mirroring `(a)` where the migration granted `(a, b)` exits 1 and names **b**, not a |
| **4 — COUNTERFACTUAL** | — | a correct mirror exits 0 **even with the columns re-ordered** · mirrored FUNCTION tuples are absent from the failure output · mirrored TABLE tuples are too · the partial-revoke arm stays GREEN on a correct supplement, so it fails for the defect and not for the fixture |

Both existing idioms kept: the fixture pads to the **real** `MIN_MIGRATION_FILES`, and every
fixture path goes through `assertOutsideWatchedTree`. ⛔ No vitest suite was added — `SEED-287`
measured that `vitest-count-gate.cjs`'s `TARGETS` names FILES, so a suite under `scripts/` would
run nowhere.

### The arms driven against planted defects (`falsify-arms.cjs`)

Real gate md5 `52e3c769a84287469ec1faa1ba6003cd` before **and** after; every copy deleted.

```
=== DEFECT A — revert the TUPLE KEY to signature-only (CR-02 as it shipped) ===
  self-test exit : 1     failing arms : 3
    FAIL  NEW RED arm 1 (PARTIAL REVOKE …): exits 1  — exit=0, missing=0
    FAIL  NEW RED arm 1: the failure names the REVOKE / public.alpha() / public TUPLE
    FAIL  NEW RED arm 1: the SIBLING tuples on the SAME function are still mirrored

=== DEFECT B — blind the gate to TABLE/COLUMN statements again (CR-01 as it shipped) ===
  self-test exit : 1     failing arms : 5
    FAIL  NEW RED arm 3 (TABLE): the gate SEES table and column privileges at all  — 0 table statement(s) → 0 tuple(s)
    FAIL  NEW RED arm 3 (TABLE): a missing table-level REVOKE exits 1  — exit=0
    FAIL  NEW RED arm 3 (TABLE): the failure NAMES the missing table tuple, both grantees
    FAIL  NEW RED arm 3 (COLUMN-SET): mirroring (a) where the migration granted (a, b) exits 1  — exit=0
    FAIL  NEW RED arm 3 (COLUMN-SET): the failure names the MISSING COLUMN b, and not a

=== DEFECT C — revert the LEXER to line.indexOf('--') (CR-03 as it shipped) ===
  self-test exit : 1     failing arms : 4
    FAIL  NEW RED arm 2 (COMMENT-SWALLOW): a `--` INSIDE a literal does not hide the next ACL  — 0 entr(y|ies): none
    FAIL  NEW RED arm 2 (FALSE-POSITIVE CONTROL): an ACL-shaped line INSIDE a dollar-quoted body is a PHANTOM …
    FAIL  NEW RED arm 2: a doubled single-quote escape does not end the literal
    FAIL  CRLF: a \r\n file yields the SAME tuples as the \n file

VERDICT: every planted defect made its arm(s) FAIL.
```

---

## MC-4 — THE GATE IS NOW INVOKED BY SOMETHING, AND THE HOOK WAS DRIVEN

At plan time `grep -rln "check-schema-acl-parity" .claude .github package.json` returned **zero**.
Now:

```
$ grep -rn "check-schema-acl-parity" .github .claude | grep -vc "get-shit-done"
8
```

### The hook — the DRIVEN half

⛔ **The negative case is driven with the CR-02 defect STILL PLANTED.** A negative that is silent
because the tree is clean proves nothing about the filter; this one is driven against a tree that
**would** fail.

```
REAL supplement md5 BEFORE any plant : da9c561634d417ebd289bedf07b75f69

--- 1. CLEAN TREE · migration payload (181_revoke_public_secdef_functions.sql) ---
  hook exit 0 · stdout bytes 0   (silent — the gate was clear)

PLANTED: deleted line 647 — REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;
REAL supplement md5 WITH THE DEFECT  : 8a2f913b73777e15828e5ef4ddc299d9

--- 2. DEFECT PLANTED · migration payload ---
  hook exit 0 · stdout bytes 2612 · acl_parity_gate_exit : 1
    | SCHEMA ACL PARITY — a migration ACL is NOT mirrored into the bootstrap artifact.
    | … mirrored: 132/133
    | 1 ACL TUPLE(S) ARE NOT MIRRORED …
    |   [not-mirrored]  REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM public …

--- 3. DEFECT PLANTED · supplement payload (WINDOWS separators) ---
  hook exit 0 · stdout bytes 2655 · acl_parity_gate_exit : 1     (same report)

--- 4. DEFECT STILL PLANTED · UNRELATED payload (frontend/src/App.tsx) ---
  hook exit 0 · stdout bytes 0   (silent — the path was filtered out)

--- 5. DEFECT STILL PLANTED · UNNUMBERED sql payload (supabase/seed.sql) ---
  hook exit 0 · stdout bytes 0   (silent — the path was filtered out)

REAL supplement md5 AFTER restore    : da9c561634d417ebd289bedf07b75f69
byte-identical to pre-drive          : true
```

Restored from a byte buffer held in memory, **never** with `git checkout -- <dir>` — `core.autocrlf`
moved 224 body digests at Phase 251 while `git status` read clean.

The hook is deliberately **NOT** a PreToolUse blocker, matching both precedents: a migration that
narrows a privilege is a correct edit that simply owes a mirror, and a hook must never deny that
write.

### The workflow — the UNDRIVEN half, said plainly

⛔ **CI WAS NOT DRIVEN FROM HERE, and nothing below should be read as if it had been.** GitHub
Actions cannot be executed in this worktree. What *was* checked:

- the YAML **parses** (`js-yaml`), and its resolved shape is `runs-on: ubuntu-latest`, steps
  `actions/checkout@v4` → `node scripts/check-schema-acl-parity.cjs --self-test` →
  `node scripts/check-schema-acl-parity.cjs`;
- both command strings **reproduce locally**: `--self-test` exits 0, the scan exits 0 on a clean
  tree and 1 against the planted defect (above);
- the five path filters resolve to `supabase/migrations/**`, `scripts/full-schema-supplement.sql`,
  `supabase/full-schema.sql`, `scripts/check-schema-acl-parity.cjs` and the workflow file itself.

**The local hook is therefore the driven half.** `--self-test` runs FIRST in CI on every
invocation, because a scan that passes because the gate stopped being able to fail is exactly the
state CR-02 found.

### `.claude/settings.json` — additive only

```diff
@@ -110,6 +110,16 @@
           }
         ]
       },
+      {
+        "matcher": "Write|Edit",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "\"C:/Program Files/nodejs/node.exe\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/schema-acl-parity-guard.js",
+            "timeout": 20
+          }
+        ]
+      },
       {
         "matcher": "Write|Edit",
         "hooks": [
```

**10 insertions, 0 deletions.** No existing entry, permission, matcher or timeout changed, and
`node -e "JSON.parse(...)"` succeeds. ⛔ `.claude/settings.local.json` was NOT touched.

---

## D-14 / D-13 — the ordering claim, in all THREE homes

| Home | Before | After |
|---|---|---|
| `check-schema-acl-parity.cjs:26-28` (docstring) | *"Ordering (PUBLIC before anon) is asserted by the plan's own checks"* | a `CHECKS / DOES NOT` block naming ORDERING and REVERSE DRIFT as out of scope **by decision (D-13)**, each with its re-open trigger |
| `check-schema-acl-parity.cjs:220-221` (failure text) | *"⚠ REVOKE … FROM PUBLIC must precede REVOKE … FROM anon"* | *"WHAT THIS GATE DOES NOT CHECK — said here so this failure is not read as a clean bill of health on anything else"*, both fences + triggers. The fact that ordering **matters** is kept; the implication that it is **checked** is gone |
| `full-schema-supplement.sql` §6 header | *"⚠ ORDER IS LOAD-BEARING … PUBLIC is revoked first, every time."* | *"⚠ ORDER IS LOAD-BEARING, **AND NOTHING CHECKS IT** … a CONVENTION KEPT BY HAND, NOT AN ASSERTED ONE"*, plus both re-open triggers. Its adjacent ⛔ claim was also widened from *"EXECUTE on a function"* to tables and columns — now TRUE |

```
$ grep -c "must precede" scripts/check-schema-acl-parity.cjs        0
$ grep -c "must precede" scripts/full-schema-supplement.sql         0
$ grep -c "asserted by the plan" scripts/check-schema-acl-parity.cjs 0
```

⚠ **The plan cited `full-schema-supplement.sql:284-286` and warned that `253-01` had moved it.**
It had: the block is now at **494-496**, and it contains no literal `must precede` at all — the
third home is the *"⚠ ORDER IS LOAD-BEARING"* paragraph, identified by reading the base commit
(`git show 09f4cfbe5:… | sed -n '278,292p'`) rather than by trusting the number.

---

## D-11 — the same-commit tail identity, re-asserted

The supplement edit and `supabase/full-schema.sql` shipped in ONE commit (`b9067a904`). The mirror
was done at **byte level**, identifying the suffix to replace by identity rather than by a line
count:

```
full-schema.sql bytes      : 324659  md5 f9a17ca899682525c016adabeaf57aab
OLD supplement (git HEAD)  : 41081  md5 3a9b13bd557da238eeb7cfe9226d87af
NEW supplement (worktree)  : 42050  md5 da9c561634d417ebd289bedf07b75f69
PRECONDITION OK: the last 41081 bytes of full-schema.sql == the OLD supplement.
head bytes kept            : 283578  md5 ff750a97cb1ec3ae9e2fc65767bcd465
AFTER:
  head region UNCHANGED    : true
  tail == supplement       : true  md5 da9c561634d417ebd289bedf07b75f69
```

Confirmed independently by the plan's own command and by `253-01`'s harness:

```
$ tail -n 653 supabase/full-schema.sql | md5sum   →  da9c561634d417ebd289bedf07b75f69
$ md5sum scripts/full-schema-supplement.sql        →  da9c561634d417ebd289bedf07b75f69
$ git diff -U0 supabase/full-schema.sql | grep "^@@"
@@ -7745 +7745,4 @@   @@ -7748,3 +7751,10 @@          (banner is at 7250)
```

⚠ **The `git show HEAD:` blob is LF while the working tree is CRLF**, so the blob's md5 is
`ef2cd604a67bd63937b178f3d565fe8f`, not `3a9b13bd…`. Converting `\n → \r\n` reproduces
`3a9b13bd557da238eeb7cfe9226d87af` exactly — recorded because reading the blob as "the previous
file" would have silently compared the wrong bytes.

---

## The measured corrections, recorded BESIDE the claim they correct

### MC-4 — CONFIRMED, and CLOSED by this plan

The CONTEXT's D-07 (*"one gate, one home, ONE HOOK ENTRY"*) and D-18 (`--self-test` *"ALREADY RUNS
WHEREVER THE GATE RUNS"*) were **both false at plan time** — nothing ran the gate at all. Now a
hook and a CI job do, and the hook has been **seen to fire** against a real planted defect.

### MC-5 — CONFIRMED LIVE AND UNFIXED. ⛔ The ledger gate is NOT cited as evidence for anything here.

```
$ node scripts/check-hot-file-ledger.cjs 253
hot-file ledger — .planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth
  scan list: 284 rows · subject: 12 files · watched: 0
ledger gate OK — every watched file has a row.
exit=0
```

**`watched: 0` of 12 subject files**, and it exits **0 whether the three new rows exist or not** —
`scripts/check-hot-file-ledger.cjs:67` sets `WATCHED = [/^backend\/app\//, /^frontend\/src\//]` and
`:51`'s `EXEMPT` additionally drops `/^scripts\//`, `.md` and `.sql`. The scan list grew `281 → 284`
(the three new rows are parsed into it) which changes nothing about the verdict.
**D-23 was therefore executed MANUALLY and every row carries its own re-derived evidence.**

### MC-6 — CONFIRMED EXACTLY. **32** statements across **12** files.

The CONTEXT's D-16 says *"25 statements"* and `253-PATTERNS.md` says *"11 files"* then lists twelve.
Re-derived three independent ways (shell recipe, the gate at run time, `check-greenfield-privileges.py`),
all agreeing: **32 / 12**, with the per-file breakdown `118 (4) · 126 (1) · 127 (1) · 128 (1) ·
129 (3) · 150 (1) · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)`.
⛔ No expected total is hardcoded in executable code:

```
$ grep -nE "(=|\s)32\b" scripts/check-schema-acl-parity.cjs
47: *     which carry 32 such statements between them.        ← a comment
```

---

## SC#5 / CR-08 — the ledger (Task 4)

### The three absent rows, with sections in the SAME COMMIT

| File | Re-derived triple | Phase buckets | G-5 |
|---|---|---|---|
| `scripts/full-schema-supplement.sql` | **11 / 6 / 653** | 162, 165, 190, 211, 252, 253 (excl. `schema`, `seed`) | ⚠ **FIRES** — absent for its ENTIRE LIFE |
| `scripts/check-schema-acl-parity.cjs` | **3 / 2 / 883** | 252, 253 | no (2 phases) — row at its SECOND phase |
| `scripts/check-greenfield-privileges.py` | **1 / 1 / 1157** | 253 | no (1 phase) — row AT CREATION |

Each section names what the file is the ONE home of, its binding invariants, the named seam the
next refactor should take, and ⭐ **MC-5 in plain words: this row could never have been demanded by
the ledger gate, because `scripts/` is exempt by construction.** Only
`scripts/full-schema-supplement.sql` joins CLAUDE.md's FIRING shortlist; the other two live in
`docs/HOT-FILE-LEDGER.md` only.

### The twelve CR-08 triples — re-derived, stale figures kept BESIDE

Commands used (per file), the CLAUDE.md recipe:

```bash
git log --oneline -- <file> | wc -l                                     # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l   # phases
wc -l <file>                                                            # lines
```

(mechanised as `derive-triples.cjs`, which PRINTS the excluded buckets so the subtraction is
auditable rather than asserted).

| File | ledger row said | CLAUDE.md said | **measured 2026-09-17** | note |
|---|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | `101/37/4815` | `102/37/4880` | **104 / 38 / 4948** | 8th rot. 1 dated quick-task bucket (`260529`) excluded |
| `frontend/src/components/chat/ThinkingBlock.tsx` | `4/1/283` | `4/1/313` | **6 / 2 / 320** | both registers said **1 phase**; it is 2 — it still does NOT fire |
| `frontend/src/components/panel/PhaseCard.tsx` | `16/10/755` | `16/10/755` | **17 / 11 / 788** | |
| `frontend/src/components/panel/PhaseTimeline.tsx` | `9/7/385` | `9/7/385` | **10 / 8 / 404** | |
| `frontend/src/components/panel/phaseStatusMeta.ts` | `3/3/236` | `3/3/236` | **4 / 4 / 291** | |
| `backend/app/api/connectors.py` | `43/20/2113` | `44/21/2140` | **45 / 21 / 2162** | ⛔ a **SEVENTH** landing; extraction still OWED |
| `backend/app/services/connector_service.py` | `25/9/1772` | `25/9/1772` | **28 / 11 / 1858** | |
| `frontend/src/components/panel/TodosSection.tsx` | `6/4/210` | *(absent)* | **11 / 6 / 337** | +127 L since the row was written |
| `frontend/src/components/sources/WatchedFoldersSection.tsx` | `9/3/470` · **no (3 phases)** | *(absent)* | **10 / 4 / 486** | ⚠ **G-5 STATE CHANGE — see below** |
| `frontend/src/components/sources/WatchRowCard.tsx` | `2/1/649` · no (1 phase) | *(absent)* | **3 / 2 / 770** | 252-05 put it into both count-gate knobs; it had run NOWHERE |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | `2/1/454` · **no (1 phase)** | `6/3/560` | **8 / 4 / 645** | ⛔ **G-5 FIRED UNDISPOSITIONED — see below** |
| `frontend/src/stores/streamsStore.ts` | `21/13/546` | `21/13/546` | **22 / 14 / 572** | |

⚠ **The two registers DISAGREED with each other on four files** (`StreamsProvider.tsx`,
`ThinkingBlock.tsx`, `connectors.py`, `sourceHealthVocabulary.ts`) before this pass — not merely
stale, but stale **by different amounts**. A reader checking one and not the other would have been
told two different things.

⛔ **None of these twelve files was modified by Phase 253.** Every triple moved because *other*
phases (chiefly 252) touched them and no one re-derived. That is the CR-08 finding reproducing
itself while it was being written down.

### ⛔ `sourceHealthVocabulary.ts` — G-5 FIRED AND NOBODY SAID SO (D-23's explicit requirement)

CLAUDE.md's row read *"row added **BUG-260912-01** at its THIRD phase, so **G-5 FIRES on the next
touch**"*. **Phase 252-03 WAS that next touch.** No refactor proposal and no
honoured-by-construction disposition was recorded in either register. A reader of that row today
would believe G-5 has not fired yet and **would be wrong by two phases** (it now measures 4).
Both rows now carry `⛔ FIRES — UNDISPOSITIONED` and name 252-03 explicitly. **The seam is OWED.**

### ⚠ `WatchedFoldersSection.tsx` — a G-5 STATE CHANGE, not a stale number

Its ledger row read `9 / 3 / 470` and **`no (3 phases)`**. Measured: **10 / 4 / 486** — Phase 252
was the fourth phase, so **G-5 FIRES now**. `247-03`'s `WatchRowCard.tsx` extraction (1095 → 470
lines) stands as the discharge and is recorded as such; it must be re-asserted or re-taken on the
next touch. ⚠ This file is **not** in CLAUDE.md's shortlist, and the plan's Task 4D scopes CLAUDE.md
updates to *"where one exists"* — so it was **not** added there. Flagged here instead rather than
silently widened.

### CLAUDE.md size gate — and it was DRIVEN, because 242 measured this class passing vacuously

```
$ node scripts/check-claude-md-size.cjs
  CLAUDE.md                                  104528 chars   69.5% → 69.7% of limit  headroom   45472  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
exit=0
```

`104,302 → 104,528` chars (**+226**), far under the 120,000 warn band and the 150,000 hard limit.
No `[disposition-too-long]`, `[duplicate-row]` or `[malformed-row]`. All 15 new/edited disposition
cells measured **125–197 chars**, every one inside the 200 cap, checked BEFORE anything was written.

⚠ **THE FIRST DRIVE OF THIS GATE WAS A BADLY-PLACED PLANT AND IS RECORDED RATHER THAN BURIED.**
Three defects appended at the END of `docs/HOT-FILE-LEDGER.md` all "passed" — because
`ledgerRows()` reads a **contiguous** run starting at the exact header line and never saw them. I
came within one sentence of reporting the gate dead. Re-planted INSIDE the table:

```
scan-table header at line 10364; plants go at line 10366
rows inside the contiguous run the gate parses: 284          ← non-vacuous, measured

A. 260-char disposition cell → exit 1  [disposition-too-long] line 10366  260 chars (cap 200)
B. duplicate row             → exit 1  [duplicate-row] lines 10366 + 10648  scripts/full-schema-supplement.sql
C. 5 cells instead of 6      → exit 1  [malformed-row] line 10366  5 cells, expected 6
clean                        → exit 0
ledger md5 restored byte-identical: true
```

⭐ **The lesson is the plan's own: a plant outside the parsed region measures nothing.** A gate that
"passed" three defects is indistinguishable from a gate that is dead, until you check where the
defect landed.

### Task 4E — MC-5 and CR-08's line-count proposal, PLANTED as a finding, NOT acted on

Two related holes in `scripts/check-hot-file-ledger.cjs`, recorded together:

1. **`WATCHED` / `EXEMPT` blindness (MC-5).** `WATCHED` is `^backend/app/` + `^frontend/src/` only,
   and `EXEMPT` drops `^scripts/` plus `.md` / `.sql`. A `scripts/` file can never be demanded a
   row, at any commit count, forever, silently. That is the structural cause of CR-08's finding
   that `full-schema-supplement.sql` had 5 phases and no row — **the guardrail was blind by
   construction, not the author careless.**
2. **Presence-only rows (CR-08's own *"separately worth considering"*).** The gate is satisfied by
   a row EXISTING; it never checks the row's line count against `wc -l`. **That is the same class
   of guard CR-02 proved this repo ships** — one that cannot notice the thing it is about. This
   pass found twelve rows stale and two registers disagreeing on four of them.

⛔ **Neither was acted on.** Both are changes to a **shared guardrail affecting every phase** and
are outside this phase's fixed scope (`scope_fences`). **Re-open trigger: the next phase whose
`files_modified` names a `scripts/` file.** The finding is written into
`docs/HOT-FILE-LEDGER.md` → `scripts/full-schema-supplement.sql` so it travels with the row.

---

## SEED-266 — arm (a) ANSWERED (Task 4F)

```
$ node scripts/check-seeds-register.cjs --files .planning/seeds/SEED-266-*.md
  register: 296 files · selected by --files: 1 · skipped: 0 · duplicate ids: 0
seeds register gate OK — 1/296 parsed, 0 duplicate ids, 1/1 carry all 5 required keys.
exit=0

$ grep -c "^status: partially-answered" .planning/seeds/SEED-266-*.md   1
$ grep -c "^partial: true" .planning/seeds/SEED-266-*.md                1
$ git diff --stat .planning/seeds/SEED-266-*.md
 1 file changed, 37 insertions(+)
```

**37 insertions, 0 deletions** — entirely inside the existing `status_note: |` literal, in the same
`── 2026-09-XX · …` format as its predecessors. `status` stays `partially-answered`, `partial`
stays `true`, `folded_into` stays `null`; no other key and no body line changed. Arm **(a)** is
recorded as ANSWERED with the measured evidence (1045 → 0 violations; the `authenticated` read
going from *succeeded* to `InsufficientPrivilegeError`; 133/133 mirrored). Arms **(b)**
(`SET row_security = off`, byte-unchanged) and **(c)** (`--no-privileges`, reason in
`252-01-PLAN.md`) stay OPEN with their existing triggers.

⚠ The block also **corrects the 2026-09-16 entry beside itself, never over it**: that entry says
*"25 statements"*; measured **32 across 12 files**, and migrations 126/127/150 each carry a
`connector_connections` column grant named in NO register. The *"7 tables"* half reproduces.

⭐ And one new fact the seed now carries: `supabase/full-schema.sql` **did not apply at all**
between `a7efe17d1` and `3192f480f` — a SESSION setting the dump leaks into everything appended
after it. **That is arm (b)'s shape one register over**, and it strengthens rather than answers it.

### REG-02 sweep (`--phase 253`), which could not run at discuss time

```
seeds register — .planning/seeds
  register: 296 files · parsed: 296 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

trigger sweep — phase 253 (2 plan file(s), 12 path(s) in files_modified)
  ⚠ the phase declares NO surfaces, so `trigger_surfaces` matched nothing here.
  3 seed(s) matched:
  [trigger-fires] SEED-188 (status: open)  … anti-prompt-injection discipline verified by nobody
      path "backend/tests/**"  matched  "backend/tests/unit/test_253_supplement_column_parity.py"
  [trigger-fires] SEED-266 (status: partially-answered) …
      path "**/full-schema.sql"  matched  "supabase/full-schema.sql"
  [trigger-fires] SEED-284 (status: planted) … three file-local elapsed formatters, one home owed
      path "docs/HOT-FILE-LEDGER.md"  matched  "docs/HOT-FILE-LEDGER.md"

seeds register gate OK — 296/296 parsed, 0 duplicate ids, 296/296 carry all 5 required keys.
exit=0
```

⚠ **Read the two unswept figures separately and never sum them: 134 and 114.** ⚠ **SEED-188 and
SEED-284 matched on incidental paths** — a test file this phase did not write, and the ledger this
phase edits by obligation. Neither is folded; both are left with their status unchanged, recorded
here so the match is not mistaken for a silent dismissal.

---

## Task 4G — the process decisions, closed out

**D-20 — the two-plan serial structure HELD.** Waves 1 and 2, `depends_on: [253-01]`. It was
required by CLAUDE.md worktree rule 4, not chosen for convenience: `253-01`'s harness **creates and
drops a database on the shared local Postgres cluster**, which no `files_modified` check can see.
This plan ran that harness too (green, below), so the serialisation was load-bearing to the end.

**D-22 — `security_enforcement` and `code_review` were treated as non-optional.** This plan carries
a `<threat_model>` with 10 entries; every `mitigate` disposition was implemented and driven:
T-253-09 (tuple key), T-253-10 (lexer), T-253-11 (table tuples), T-253-12 (prose in three homes),
T-253-13 (the wiring, hook driven), T-253-15 (the RED plant restored md5-identical), T-253-16
(settings.json additive, diff pasted), T-253-17 (MC-5 stated, not cited). T-253-14 is `accept
(inherited)` — `VacuousScanError` + `MIN_MIGRATION_FILES` were reused, not duplicated. **T-253-SC:
no package was installed by this plan** — the gate's only `require` calls are `fs`, `path`, `os`;
the hook adds `child_process`; CI uses only `actions/checkout@v4`.

**D-21 — the independent review. ⛔ I CANNOT CONFIRM THE BUS ITEM EXISTS, and say so plainly
rather than implying it.** I did not find or open a `.agent-bus` item for Phase 253 from this
worktree, and I did not create one — queuing a review of my own work would be the self-assessment
the protocol forbids. **If no item was queued at plan time, this phase closes `self-verified` for
the FIFTH consecutive time (249, 250, 251, 252).**

⚠ **And `DEBT-06`'s structural half is unmet regardless of the answer:**

```
$ grep -rln "independent_review" scripts/ .claude/hooks/
(no output)
```

**Nothing executable reads the field its close condition is written against.** A review obligation
tracked only by prose is the same class as a `trigger_when` nobody sweeps.

---

## Backend unit baseline — INTACT at the ceiling, failing SET published

```
$ cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors
71 failed, 4878 passed, 2 xfailed, 2 xpassed, 44 warnings in 391.82s (0:06:31)
$ grep -c '^FAILED' pytest.txt                                   71
$ grep -c 'errors during collection\|ERROR collecting' pytest.txt 0
```

**71 failed · 0 collection errors** — exactly the ceiling, zero headroom, unchanged. ⭐ The failing
**SET** is byte-identical to the one `253-01` published: the same 24 files with the same per-file
counts (`test_retrieval_service.py` 15, `test_sql_service.py` 12, `test_explorer_agent.py` 6,
`test_multimodal_query.py` 5, `test_111_1_reembed_kickoff.py` 4, `test_sandbox_service.py` /
`test_lifespan.py` / `test_db_runs.py` 3 each, four files at 2, twelve at 1). **Sets, never
counts** — this plan touched no backend source.

⚠ CLAUDE.md's quoted `3497 passed` remains rotted at `4878`; the gate binds the **failed** ceiling
of 71 and that is what held.

## The frontend count gate was NOT run, and that is a decision

This plan touched **zero** files under `frontend/src` and added no vitest suite (D-18 refuses one —
`SEED-287`). `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` was therefore not
invoked. ⚠ Stated rather than omitted: *"frontend untouched ⇒ gate unaffected"* is **unsound** in
this repo in general — frontend suites `?raw`-import backend sources — but the nine files this plan
modified include no backend or frontend **source** at all, only two scripts, two hooks/CI files,
two SQL artifacts and three documents.

---

## Verification — every line of the plan's `<verification>` block

| Check | Result |
|---|---|
| `check-schema-acl-parity.cjs --self-test` exits **0**, ≥ 4 new arms + 3 normaliser arms | ✅ exit 0, **29/29** assertions |
| `check-schema-acl-parity.cjs` exits **0** against the tree as `253-01` left it | ✅ exit 0, **133/133** mirrored |
| …exits **1** against a copy missing `resize_embedding_column … FROM PUBLIC` (SC#3) | ✅ exit 1, names the signature AND the grantee `public` |
| exported `aclsIn` returns `public.danger(integer)` for the CR-03 swallowed case (SC#4) | ✅ exactly one entry |
| `grep -rn "check-schema-acl-parity" .github .claude` ≥ 2 hits (0 at plan time) | ✅ **8** |
| `node scripts/check-claude-md-size.cjs` exits **0** | ✅ 104,528 chars, no structural findings |
| `check-seeds-register.cjs --files SEED-266-*.md` exits **0** | ✅ |
| `check-seeds-register.cjs --phase 253` runs, output recorded (REG-02) | ✅ 3 seeds matched, recorded above |
| `check-greenfield-privileges.py` still exits **0** — no regression of `253-01` | ✅ exit 0, 0 violations, teardown verified |
| `pytest tests/unit` ≤ **71** failed, **0** collection errors, SET recorded | ✅ 71 / 0, SET identical to `253-01`'s |
| `git status --short` shows exactly the nine `files_modified` and nothing else | ✅ clean tree; `git diff --name-only <base> HEAD` = exactly those nine |
| D-11 tail identity re-asserted after the part-D prose edit | ✅ both `da9c561634d417ebd289bedf07b75f69` |
| `normaliseSignature` byte-unchanged, its 3 arms still PASS | ✅ `diff` of the function body is EMPTY |
| `grep -c "must precede"` = 0 in both files; `"asserted by the plan"` = 0 | ✅ 0 / 0 / 0 |
| zero runtime dependencies — only `fs`, `path`, `os` | ✅ three `require` lines |
| no hardcoded expected total outside a comment | ✅ the only `32` is comment line 47 |

Also confirmed: `backend/tests/unit/test_253_supplement_column_parity.py` → **7 passed** (the §6
header edit did not disturb §5), and **no file was deleted** on this branch
(`git diff --diff-filter=D` is empty).

## Success criteria

| Criterion | Status |
|---|---|
| **SC#3** — the gate fails on a PARTIAL revoke, driven before the fix and again after | ✅ RED exit 0 / `missing: 0` → GREEN exit 1 naming the tuple |
| **SC#4** — a comment cannot hide an ACL, incl. dollar-quoted and doubled-quote variants | ✅ plus a false-positive control the first fixture was missing |
| **SC#5** — 3 absent ledger rows with sections, 12 stale triples re-derived, `sourceHealthVocabulary.ts` dispositioned | ✅ all three, and TWO G-5 findings surfaced rather than papered over |
| The gate is RUN by CI and a registered PostToolUse hook, and the hook has been SEEN to fire (MC-4) | ✅ hook driven against a planted defect; ⛔ CI stated as undriven |
| D-13's two out-of-scope decisions visible in the gate's prose with triggers; D-14 removed from all three homes | ✅ |
| MC-4, MC-5, MC-6 recorded beside the CONTEXT claim they correct, never over it | ✅ |

**Two `must_have` truths need a qualification rather than a tick, and are recorded as such:**

1. **"The gate sees TABLE and COLUMN privileges, compared as `(table, grantee, verb, column-set)`
   tuples."** ✅ in substance, ⚠ **not in the literal wording** — keyed per COLUMN, because the
   column-SET model was MEASURED to produce 7 false reds against a correct supplement. Deviation 1.
2. **"`--self-test` carries four arms … each driven RED against its planted defect BEFORE the fix
   and GREEN after."** ✅ for the three CR arms and the counterfactual, ⚠ **but the arms were
   authored in Task 2's commit rather than Task 3's** — I wrote them while validating the rewrite,
   so `b9067a904` contains the arms and `8790c4119` contains their falsification and the fixture
   correction. A task-boundary deviation only; no scope changed, and nothing shipped unfalsified.

---

## What the next plan should know

1. **⛔ `sourceHealthVocabulary.ts` owes a G-5 disposition and nobody has written one.** Its row
   predicted its own firing, 252-03 fired it, and neither register noticed for two phases. It now
   measures `8 / 4 / 645`.
2. **⚠ `WatchedFoldersSection.tsx` changed G-5 state** from `no (3 phases)` to FIRING at 4. The
   `247-03` extraction stands as the discharge; re-assert it on the next touch.
3. **⛔ `backend/app/api/connectors.py` took a SEVENTH landing** (`2051→2071→2091→2102→2113→2140→2162`)
   and its extraction is still OWED.
4. **MC-5 is live and untouched.** Any `scripts/` file is invisible to the ledger gate. The next
   phase whose `files_modified` names one should decide whether to widen `WATCHED`/`EXEMPT` and add
   CR-08's line-count check — both are shared-guardrail changes and need their own scope.
5. **The named seam for BOTH new script rows is the same one:** `check-schema-acl-parity.cjs` and
   `check-greenfield-privileges.py` each implement the tuple normalisation, in different languages.
   A `--emit-missing` mode on the gate would make the hand-mirror **derivable** instead of typed,
   which removes the failure class rather than guarding it.
6. **D-21's independent review is unconfirmed and `DEBT-06`'s structural half is unmet** — nothing
   executable reads `independent_review`.
7. ⚠ **The three files I rewrote or created were written with LF endings** into a tree whose other
   files are CRLF (`git` warned `LF will be replaced by CRLF the next time Git touches it`). The
   blobs are LF, which is what `core.autocrlf=true` normalises to anyway; node is indifferent. It
   is recorded because a future `md5sum` of the working-tree file will differ from the blob's, the
   same trap that made `git show HEAD:` the wrong source for the D-11 mirror.

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `scripts/check-schema-acl-parity.cjs` exists | ✅ FOUND |
| `.claude/hooks/schema-acl-parity-guard.js` exists | ✅ FOUND |
| `.github/workflows/schema-acl-parity.yml` exists | ✅ FOUND |
| `.claude/settings.json` exists and parses as JSON | ✅ FOUND |
| `docs/HOT-FILE-LEDGER.md` exists (14,549 lines) | ✅ FOUND |
| `CLAUDE.md` exists (104,528 chars) | ✅ FOUND |
| `scripts/full-schema-supplement.sql` exists (653 lines) | ✅ FOUND |
| `supabase/full-schema.sql` exists | ✅ FOUND |
| `.planning/seeds/SEED-266-…md` exists | ✅ FOUND |
| commit `b9067a904` | ✅ FOUND |
| commit `8790c4119` | ✅ FOUND |
| commit `22972ca6e` | ✅ FOUND |
