# Phase 253: The bootstrap artifact tells the whole truth - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A database born from `supabase/full-schema.sql` + `scripts/full-schema-supplement.sql` **alone**
carries the same privileges as one built by replaying `supabase/migrations/` — **tables and
columns included, not only functions** — and `scripts/check-schema-acl-parity.cjs` is structurally
able to fail on the mutations it exists to catch.

**Scope source is FIXED:** `.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW.md`
§CR-01, §CR-02, §CR-03, §CR-08. ⛔ Nothing outside it. The nine behavioural findings
(CR-04..CR-07, CR-09..CR-11) are `/gsd:fast` sized under G-3 and are NOT this phase.

**No new requirement ids.** Re-closes `CRED-03` and `CRED-04`, which 252 closed against the
**function** half of the same claim.

</domain>

<decisions>
## Implementation Decisions

### A. Proving SC#1 as `authenticated` (the greenfield harness)

- **D-01: The greenfield database is a scratch database on the RUNNING local Supabase Postgres.**
  `CREATE DATABASE` on `127.0.0.1:54322` via `asyncpg` from `backend/venv`, applied, asserted,
  then dropped. ⛔ **Never `supabase db reset` / `supabase db push`** — CLAUDE.md forbids it and it
  would destroy the operator's dev data. Rejected alternatives, recorded so they are not
  re-proposed: a second local Supabase project on other ports (Docker + the Windows
  port-reservation trap for one assertion); a throwaway cloud project (a cloud write, approval-gated
  per action); and text-parity-only, which is what 252 did and what SC#1 explicitly refuses.
- **D-02: The Supabase stock preamble is DERIVED AT RUNTIME from `pg_default_acl`, never typed.**
  The harness reads the live cluster's default ACLs and replays the corresponding
  `ALTER DEFAULT PRIVILEGES` into the scratch database **before** applying `full-schema.sql`, and
  prints the derived text into its own evidence.
  ⭐ **Measured at discuss time, and this is the load-bearing fact:** `public` carries default ACLs
  from **two** owners — `postgres` and `supabase_admin` — both granting `arwdDxtm` (ALL) on TABLES
  to `anon, authenticated, service_role`. **That is the exposure engine.** The artifacts themselves
  contain **0** `ALTER DEFAULT PRIVILEGES` and **0** `CREATE ROLE`; they assume a fresh Supabase
  project supplies them.
  ⭐ **Sound because no migration touches them:** `grep -rln "ALTER DEFAULT PRIVILEGES"
  supabase/migrations/` returns **nothing**, so the local cluster's `pg_default_acl` is pristine
  stock and is a legitimate source.
- **D-03: ⛔ A harness that omits the preamble is a FALSE GREEN, and it is named here so it is
  rejected deliberately rather than by omission.** Without default privileges the table has no
  grants at all, so `authenticated` is refused for the **wrong reason** and SC#1 would pass while
  proving nothing.
- **D-04: It ships as a standalone re-runnable gate** — `scripts/check-greenfield-privileges.py`.
  Exits non-zero on exposure; **skips with a stated reason** when no Postgres is reachable (a silent
  skip is the same as absent). Added to the deploy parity checklist beside `get_advisors(security)`.
  ⛔ **It does NOT go into `backend/tests/unit`** — that suite sits at the ceiling of **71 failures
  with zero headroom**, and it must not gain a live-database precondition.
- **D-05: The assertion set is DERIVED from the migrations, with no exception list.** Every
  `GRANT`/`REVOKE` on a TABLE or COLUMN against `anon`/`authenticated` found in
  `supabase/migrations/` becomes an assertion against the scratch DB. This is the principle that
  made 252's function gate find three unmirrored functions its research never measured — including
  `resize_embedding_column`, which NULLs every vector in the corpus.
- **D-06 (Claude's discretion, recorded so it is not re-litigated): the scratch DB name is unique
  per run** (pid/timestamp suffix) with a drop-if-exists guard, so two agents cannot collide on the
  shared cluster.

### B. CR-01 — the table half of the mirror, and the drift fence

- **D-07: Table/column ACL parity EXTENDS `scripts/check-schema-acl-parity.cjs`.** A second regex
  for `GRANT`/`REVOKE` on TABLE/COLUMN, compared as `(table, grantee, verb, column-set)` tuples
  beside the function tuples. One gate, one home, one hook entry — and it makes §6's existing
  header claim (*"table OR function"*) **true** rather than aspirational. A separate sibling gate
  was rejected: a gate missing from a scan list is invisible to its own guardrail.
- **D-08: SC#2's drift fence is a pytest in `backend/tests/unit`.** It imports
  `_TABLE_SELECTABLE_KEYS` from `backend/app/services/connector_service.py:142` (currently **19**
  keys, derived from `ConnectorConnectionResponse`) and asserts set equality against the
  supplement's `GRANT SELECT (...)` column list. No database, and no JS tool parsing Python.
  ⛔ **Rejected: having the Node gate parse the Python constant** — the value is *derived from a
  Pydantic model's keys*, which is exactly what a regex cannot see, so that fence would pin a
  spelling rather than a value.
  ⭐ It is a **passing** test, so it raises the suite total without touching the 71 ceiling.
- **D-09: §5's column list stays HAND-MAINTAINED, one column per line, under that fence.** §5's
  entire point is that the **absent** column (`secret_ciphertext`) is visible in a diff, and the
  artifact must stay something an operator can read and paste. ⛔ **No generated region inside a
  hand-written pasteable file** — CLAUDE.md's *never hand-edit `full-schema.sql`* rule exists
  because generated and hand-written text in one artifact goes wrong.
- **D-10: The `connector_tokens` block is COPIED VERBATIM from migrations `129:85` and `151:92`,**
  with the source migration named inline — the 252 precedent (*copy the statements from the
  migration rather than retyping them*), so the gate's expected set and the supplement's mirrored
  set are the same characters. Deriving it from the live DB's 9 column grants was rejected: it
  would pin the artifact to one machine at one moment.
- **D-11: The same-commit rule binds.** `scripts/full-schema-supplement.sql` and
  `supabase/full-schema.sql`'s tail ship in the **same commit**, exactly as §5 and §6 were.
  `scripts/regenerate-full-schema.sh:104` passes `--no-privileges`, so a dump can **never** carry a
  grant and the supplement is the only home for one.

### C. CR-02 / CR-03 — making the gate able to fail

- **D-12: CR-02 — key on `verb|signature|grantee` tuples, one entry per grantee.**
  `REVOKE … FROM anon, authenticated` splits into two entries. The acceptance drive is the review's
  own proven defect: deleting
  `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` must exit
  **non-zero** (it prints `missing: 0 []` today).
- **D-13: Ordering assertion and reverse-drift detection are OUT of scope.** PUBLIC-before-anon
  ordering is not checked, and the supplement over-granting what a migration revokes is not
  detected.
- **D-14 (DERIVED from D-13, and it is an obligation, not a note): the gate's failure text MUST be
  narrowed** so it no longer lectures the reader that *"REVOKE … FROM PUBLIC must precede REVOKE …
  FROM anon"* (`check-schema-acl-parity.cjs:220-221`) as though it verified it. **Either check it or
  stop saying it** — a guard whose prose claims more than its code is the exact defect CR-01 is.
- **D-15: CR-03 — a single-pass, string-literal-aware walk** tracking `'`, `"` and `$tag$` state,
  replacing `line.indexOf('--')` (`:112-121`). Correct by construction, and it keeps `;`-splitting
  meaningful, which the D-12 tuple rewrite depends on. The cheaper *drop the `^\s*` anchor and scan
  globally* fix was rejected as the sole remedy: it leaves a stripper that is still wrong about SQL,
  so the next thing built on statement boundaries inherits the bug.
  ⚠ Live, not hypothetical: `supabase/migrations/180_app_settings_self_hosted_endpoints.sql` lines
  **30** and **32** already ship `COMMENT ON … IS '… -- …';`.

### D. Blast radius — what actually gets mirrored

- **D-16: ALL SEVEN ACL-bearing tables are mirrored. No exception list.**
  ⭐ **Measured at discuss time, and the gap is WIDER than CR-01 states.** Only **7** tables carry
  table/column ACL statements across every migration (**25 statements**), and **six of the seven are
  mirrored in NEITHER bootstrap artifact**:

  | Table | in supplement | in `full-schema.sql` tail |
  |---|---|---|
  | `connector_connections` | 8 | 3 |
  | `connector_tokens` | **0** | **0** |
  | `connector_watches` | **0** | **0** |
  | `connector_watch_items` | **0** | **0** |
  | `connector_sync_runs` | **0** | **0** |
  | `user_settings` | **0** | **0** |
  | `app_settings` | **0** | **0** |

  ⛔ `user_settings` and `app_settings` are **the exact two tables `BUG-260911-01` found in
  production with RLS disabled and `anon` holding all privileges.**
  An allowlist + seed was rejected: it would ship a security gate with a suppression list on its
  first day, and this project has measured what a deferral nobody sweeps is worth.
- **D-17: The five columns `connector_connections` is behind** — `auth_type`, `status`,
  `error_message`, `default_approval_posture`, `default_ingest_visibility` — are added, taking §5
  from **15** granted columns to the model's **19**. Today every connector list read on a greenfield
  DB answers `42501 permission denied`.

### E. RED drives

- **D-18: All four planted defects live inside `--self-test`**, which already runs wherever the gate
  runs: (1) a **partial-revoke omission** (CR-02's proven `resize_embedding_column … FROM PUBLIC`
  deletion), (2) a **comment-swallow** case (CR-03), (3) a **table/column omission** (CR-01), and
  (4) the **counterfactual** that a correct supplement stays green. Today `--self-test` plants only
  a *whole-function* omission (`FIXTURE_SUPPLEMENT_MISSING_ONE`) and therefore never exercises the
  partial case.
  ⛔ **Rejected: a new vitest suite that shells out.** `SEED-287` measured that `TARGETS` names
  **files, not directories**, so a suite under `scripts/` would run **nowhere** unless both count-gate
  knobs are edited — which is how a green gate ends up guarding nothing.
- **D-19: Every arm is driven RED against its planted defect BEFORE the fix, and again after.**
  A guard nobody has seen fire is not a guard. The greenfield harness (D-04) is subject to the same
  rule: it must be shown **red** against the unfixed supplement before the mirror lands.

### F. Process

- **D-20: TWO plans, SERIAL.**
  - **P1** — the greenfield harness driven RED → the seven-table mirror into the supplement **and**
    `full-schema.sql`'s tail (same commit) → the pytest column fence → harness GREEN.
  - **P2** — the gate rewrite: tuple key (D-12), literal-aware lexer (D-15), table/column regex
    (D-07), the four `--self-test` arms (D-18), narrowed failure text (D-14).
  - **SC#5 (CR-08) is a task on whichever plan lands last**, not a plan of its own.

  Under G-8's 3-5 target; each plan is one coherent RED→GREEN story. ⚠ **Serial is required, not
  preferred:** CLAUDE.md worktree rule 4 — P1's harness `CREATE`s and `DROP`s a database on the
  shared local cluster, which no `files_modified` check can see.
- **D-21: The independent review is filed to gemini AT PLAN TIME, not at close.** Queue it the
  moment the PLAN.md files exist so review can run alongside execution. ⚠ Gemini already holds
  **8 open bus items, all filed 2026-09-16** — an item filed at close would be ninth in line and
  this phase would close `self-verified` by default, for the **fifth** consecutive time (249, 250,
  251, 252).
  ⚠ `DEBT-06`'s structural half is unmet regardless of this phase:
  `grep -rln "independent_review" scripts/ .claude/hooks/` returns **nothing**, so the field its
  close condition is written against has no gate behind it.
- **D-22: `security_enforcement` and `code_review` are NOT optional** (ROADMAP flag). CR-01 is a
  live privilege-escalation path on every new deployment, not hygiene.
- **D-23: SC#5 (CR-08) concretely** — add ledger rows for `scripts/full-schema-supplement.sql`
  (**8 / 5 — G-5 FIRING, no row for its entire life**) and `scripts/check-schema-acl-parity.cjs`
  (row AT CREATION, the `settingsSearchPayload.ts` precedent), add a row AT CREATION for the new
  `scripts/check-greenfield-privileges.py`, and re-derive the twelve triples `252-REVIEW.md` CR-08
  measured stale, using the CLAUDE.md recipe. Row + `docs/HOT-FILE-LEDGER.md` section in the **same
  commit**; disposition cell capped at 200 chars.

### Claude's Discretion

- Scratch-database naming and teardown mechanics (D-06).
- The exact shape of the second regex in `check-schema-acl-parity.cjs` and how column-sets are
  normalised for comparison.
- Whether `--self-test`'s four arms share fixture scaffolding or each builds its own.
- Ordering of tasks *within* each of the two plans.

### Folded Seeds

- **`SEED-266`** — *"full-schema.sql carries no table ACLs and leaks `SET row_security = off`"*.
  **Arm (a) — TABLE and COLUMN privileges — IS this phase's SC#1 + SC#2 and is folded into 253.**
  Arms **(b)** (`SET row_security = off`, byte-unchanged) and **(c)** (`--no-privileges` itself,
  deliberately not revisited — see `252-01-PLAN.md`) stay **open with their own re-open triggers**.
  ⛔ **The seed's `status` stays `partially-answered`; its `status_note` gains a 253 entry naming
  arm (a) as answered.** A seed that shipped but still reads `planted` is re-proposed forever, and
  `status:` frontmatter IS the index — prose in the body is invisible to the scan. Splitting (b)/(c)
  into a new id was considered and rejected: it costs a new id and a second register entry for two
  arms that are already legible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The scope source — read FIRST
- `.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW.md` §CR-01 (lines 83-136), §CR-02
  (137-183), §CR-03 (186-216), §CR-08 (339-377) — the four findings that ARE this phase. CR-02's
  defect was **driven, not reasoned**; the transcript is in §CR-02.
- `.planning/ROADMAP.md` — Phase 253 detail section (line 273 onward): goal, five success criteria,
  and the four flags (TRUST BOUNDARY, THE PUBLIC TRAP, THE SAME-COMMIT RULE, CR-01 pre-dates 252).

### The artifacts being changed
- `scripts/full-schema-supplement.sql` — §5 (lines 194-262, table/column privileges) and §6
  (265-305+, function EXECUTE). The maintenance header (lines 29-33) is the claim this phase makes
  true. ⚠ **8 commits / 5 phases, G-5 FIRING, NO LEDGER ROW.**
- `supabase/full-schema.sql` — the generated dump. ⛔ **Never hand-edit**; its ACL tail is the
  supplement's text, applied in the same commit. 96 / 72, row present.
- `scripts/check-schema-acl-parity.cjs` — `statements()` `:112-121` (CR-03), `ACL_RE` `:123`
  (CR-01), `analyse()` `:177-190` and the `missing` line `:186` (CR-02), failure text `:220-221`
  (D-14), `--self-test` fixtures from `:240` (D-18).
- `scripts/regenerate-full-schema.sh:104` — the `--no-privileges` flag that makes the supplement the
  only possible home for a grant.

### Derivation sources
- `backend/app/services/connector_service.py:142-143` — `_TABLE_SELECTABLE_KEYS` (19) and
  `_SELECTABLE_COLUMNS`; the pytest fence in D-08 binds to the first of these.
- `supabase/migrations/129_*.sql` `:85`, `:88` and `supabase/migrations/151_*.sql` `:90`, `:92` —
  the verbatim source of the `connector_tokens` block (D-10).
- `supabase/migrations/128`, `156`, `118`, `104`, `106`, `177`, `181`, `012` — the other ACL-bearing
  migrations; `180_app_settings_self_hosted_endpoints.sql:30,32` carries the `COMMENT … '-- …'`
  construct CR-03 is about.

### Prior-art the plans must not contradict
- `.planning/phases/252-close-the-v42-audit-gaps/252-01-SUMMARY.md` — how the function half was
  mirrored and guarded; §"the gate scans EVERY migration" and the Group B / PUBLIC finding.
- `.planning/phases/252-close-the-v42-audit-gaps/252-01-PLAN.md` — the recorded reason
  `--no-privileges` was not dropped (SEED-266 arm (c)).
- `.planning/seeds/SEED-266-full-schema-sql-carries-no-acls-and-leaks-row-security-off.md` — routed
  by the Folded Seeds entry above.
- `.planning/seeds/SEED-287-targets-names-files-not-directories-so-a-new-suite-runs-nowhere.md` —
  why D-18 refuses a new vitest suite.
- `CLAUDE.md` — § *Supabase MCP* (reads free, writes approval-gated), § *Local dev infrastructure*
  (never `supabase db reset`/`db push`; the Windows port-reservation trap), § *Parallel execution*
  rule 4 (serialize DB-mutating plans), § *Workflow guardrails* G-5 / G-8, § *hot-file ledger*
  (200-char disposition cap, same-commit sync rule).
- `supabase/SETUP.md` — the bootstrap story a greenfield operator actually follows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`analyse()` / `report()` split in `check-schema-acl-parity.cjs`** — already a pure function with
  an injectable `log`, driven by BOTH the CLI and `--self-test`. The tuple rewrite (D-12) and the
  table regex (D-07) land inside `aclsIn`/`analyse` without touching that seam.
- **`VacuousScanError` + `MIN_MIGRATION_FILES` floor** — the gate already refuses to report a verdict
  over a collapsed scan set. The table half inherits that protection for free.
- **`backend/venv` has `asyncpg`** — the greenfield harness needs no new dependency. ⚠ There is **no
  `psql` on PATH** on this machine, and Docker is denied to the agent, so asyncpg is not a
  preference, it is the only reachable path.
- **§5's existing `REVOKE ALL` + `GRANT SELECT (…)` shape** is the template every new table block
  copies; its header already documents *why* the block lives in the supplement.

### Established Patterns
- **Mirrors are COPIED from the migration, never retyped** (252's own recorded lesson — an argument
  list is part of a function's identity; the same logic applies to a column list).
- **Gates derive their scan set from the filesystem** (`readdirSync`, never a constant) and **refuse
  to pass over a collapsed one** — `check-seeds-register.cjs` and `check-schema-acl-parity.cjs` both
  do this. The greenfield harness must too.
- **A guard is driven RED against a planted defect before it is trusted**, and the counterfactual is
  driven too.
- **`status:` frontmatter is the index**; a seed is answered by editing the seed.

### Integration Points
- `scripts/check-schema-acl-parity.cjs` ← the supplement and every file in `supabase/migrations/`.
- The new `scripts/check-greenfield-privileges.py` ← `supabase/full-schema.sql`,
  `scripts/full-schema-supplement.sql`, `supabase/migrations/*.sql`, and a live Postgres on 54322.
- The new pytest ← `connector_service._TABLE_SELECTABLE_KEYS` and the supplement's text.
- `docs/HOT-FILE-LEDGER.md` + the CLAUDE.md scan table ← three rows (D-23), same commit.
- The deploy parity checklist in `docs/DEPLOYMENT-WORKFLOW.md` ← the new harness, beside
  `get_advisors(security)`.

### ⚠ Measurements taken during this discussion (re-derive, do not trust these blind)
- `grep -c connector_tokens scripts/full-schema-supplement.sql` → **0**
- Supplement grants **15** columns on `connector_connections`; `_TABLE_SELECTABLE_KEYS` derives **19**
- `supabase/full-schema.sql`: **0** `ALTER DEFAULT PRIVILEGES`, **0** `CREATE ROLE`, **65**
  `^GRANT|^REVOKE` lines
- `pg_default_acl` in `public`: two owners (`postgres`, `supabase_admin`), both `arwdDxtm` on TABLES
  to `anon, authenticated, service_role`
- `grep -rln "ALTER DEFAULT PRIVILEGES" supabase/migrations/` → **nothing**
- 7 ACL-bearing tables, 25 statements; 6 of 7 mirrored nowhere (table in D-16)
- Live DB reference target: `connector_tokens` has exactly **9** SELECT column grants to `authenticated`

</code_context>

<specifics>
## Specific Ideas

- **The CR-02 acceptance is a specific line, not a category.** Deleting
  `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` from a copy of
  the supplement must make the gate exit non-zero. That exact deletion printed `missing: 0 []` and
  exit 0 against the shipped `analyse()`.
- **The CR-03 acceptance is a specific pair.** `COMMENT ON COLUMN public.t.c IS 'includes /v1 --
  verbatim';` followed by `REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;` must
  yield that signature; the same SQL without `--` in the literal already does.
- **"Measured as `authenticated`, never through the service role"** is the operator's framing and it
  is the point of SC#1 — every gate this project runs reads through the service role, which is
  precisely the blind spot `BUG-260911-01` lived in.
- **CR-01 pre-dates 252 and must not be written up as its regression.** What 252 added is a header
  claiming *"table OR function"* over a gate enforcing only functions. The exposure is older than
  the sentence that overstates the coverage.

</specifics>

<deferred>
## Deferred Ideas

- **PUBLIC-before-anon ordering assertion in the gate** (D-13). Not built. ⚠ Its re-open trigger is
  concrete: **the next migration that revokes a role privilege without revoking PUBLIC first** — the
  migration 181 Group B class, which 252's SUMMARY records as having been inert on greenfield.
- **Reverse-drift detection** — the supplement granting something the migrations revoke, i.e. the
  bootstrap being MORE permissive than the migration history (D-13). Re-open trigger: any phase that
  edits the supplement's grants by hand.
- **Diffing two scratch DBs — artifacts vs replayed migrations** (rejected in favour of D-05). It is
  the phase goal's literal wording and would catch what nobody thought of. Re-open trigger: the
  first time replaying all migrations into an empty database is demonstrated to succeed cleanly.
- **Generating §5's column block from `_TABLE_SELECTABLE_KEYS`** (rejected in D-09). Re-open
  trigger: the pytest fence firing more than once on real drift, which would prove detection is not
  enough.
- **`SEED-266` arms (b) and (c)** — `SET row_security = off` in the dump, and `--no-privileges`
  itself. Left open with their existing triggers.
- **CR-04 .. CR-07, CR-09 .. CR-11** (nine behavioural findings from `252-REVIEW.md`) — `/gsd:fast`
  sized under G-3, explicitly not this phase.
- **The six reported bugs reading `status: open` while a v4.2 phase cites them as delivered**, and
  **`BUG-260828-02` being a duplicate id shared by two different bugs** (ROADMAP, register-sweep
  note). Register hygiene, no code — not this phase.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** — *"SPIKE — NL→workflow authoring …"*, surfaced by
  `todo.match-phase 253` at score 0.6. **Not folded: a false positive.** It matched on generic
  keywords (`derived`, `phases`, `run`, `real`, `2026`) and has nothing to do with schema ACL
  parity or bootstrap artifacts.

### ⚠ Register sweep note
`node scripts/check-seeds-register.cjs --phase 253` **could not run** at discuss time — it exits
`FATAL: no phase directory matches "253"` because it matches seeds against `files_modified` across a
phase's PLAN.md files, and no plans exist yet. ⛔ **REG-02's sweep must therefore be re-run at
`/gsd:plan-phase 253`, once the PLAN.md files exist.** The manual grep done instead surfaced
`SEED-266` (folded, above) and `SEED-233` (already `closed`, `folded_into: 222`).

✅ **RE-RUN AT `/gsd:plan-phase 253`, 2026-09-16 — the loop this note opened is now CLOSED.**
With the two PLAN.md files on disk the sweep resolves `files_modified` (12 paths) and runs:
`296/296 parsed · 0 duplicate ids · 296/296 carry all 5 required keys · gate OK`. **Three** seeds
fire on paths — one more than the manual grep found:

| Seed | status | matched on | Routing |
|---|---|---|---|
| `SEED-266` | `partially-answered` | `**/full-schema.sql` | **FOLDED** (arm (a)) — already recorded above; `253-02` Task 4F appends the arm-(a) `status_note`. Status and `partial: true` stay untouched; arms (b)/(c) stay open. |
| `SEED-188` | `open` | `backend/tests/**` → the new `test_253_supplement_column_parity.py` | **NOT FOLDED — false positive.** It is about anti-prompt-injection discipline having no adversarial test; a cross-language column-parity fence is unrelated. Left `open` with its own trigger. |
| `SEED-284` | `planted` | `docs/HOT-FILE-LEDGER.md` | **NOT FOLDED — false positive.** It is about three file-local elapsed formatters owing one home; this phase only adds ledger ROWS to that file. Left `planted`. |

⚠ **The sweep also reported `the phase declares NO surfaces, so trigger_surfaces matched nothing`** —
a fact about the phase, not the register, and it means this was a **path-only** sweep. Recorded
rather than passed off as a clean one.

</deferred>

---

*Phase: 253-the-bootstrap-artifact-tells-the-whole-truth*
*Context gathered: 2026-09-16*
