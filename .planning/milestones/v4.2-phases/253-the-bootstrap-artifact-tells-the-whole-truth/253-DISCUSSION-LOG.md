# Phase 253: The bootstrap artifact tells the whole truth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 253-the-bootstrap-artifact-tells-the-whole-truth
**Areas discussed:** Proving SC#1 as `authenticated`, CR-01 fix shape + the drift fence, Gate rewrite depth (CR-02 + CR-03), Plan shape + DEBT-06 reviewer

**Mode:** default (interactive). No SPEC.md, no USER-PROFILE.md, no blocking anti-patterns.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Proving SC#1 as `authenticated` | How to get an honest greenfield DB without `db reset` | ✓ |
| CR-01 fix shape + the drift fence | Extend the gate vs narrow the claim; where the column fence lives | ✓ |
| How far the gate rewrite goes (CR-02 + CR-03) | Tuple key, ordering, reverse drift; lexer vs cheap fix | ✓ |
| Plan shape + DEBT-06 reviewer | Plan split and whether an independent review is arranged | ✓ |

**User's choice:** all four.

---

## Proving SC#1 as `authenticated`

### Q1 — How do we build the greenfield database?

| Option | Description | Selected |
|--------|-------------|----------|
| Scratch DB on the running local Postgres | asyncpg from `backend/venv` → `CREATE DATABASE` on 54322, pinned stock preamble, artifacts, `SET ROLE authenticated`, drop. Non-destructive, no Docker. | ✓ |
| A second local Supabase project on other ports | Highest local fidelity; needs Docker, free ports, and the Windows port-reservation trap lives exactly there. | |
| A throwaway cloud Supabase project | Fidelity of the real deploy target; a manual operator action and an approval-gated cloud write. | |
| Stay structural — and say so in writing | Text parity as 252 did, recording SC#1's `authenticated` arm as unmet with a re-open trigger. | |

**Notes:** measured before asking — `supabase/full-schema.sql` contains 0 `ALTER DEFAULT PRIVILEGES`
and 0 `CREATE ROLE`; no `psql` on PATH; 54322 open; `backend/venv` has asyncpg; roles are
cluster-level so `anon`/`authenticated`/`service_role` already exist.

### Q2 — Where does the scratch DB's stock preamble come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive at runtime from `pg_default_acl` | Nothing typed, cannot rot, derived text prints into the evidence. | ✓ |
| Pin a literal preamble constant | Readable in a diff, stable across machines — but it is a constant, and this project's ledger is a museum of constants that rotted. | |
| Replay no preamble; assert only the supplement's delta | Cheapest, and a FALSE GREEN: `authenticated` would be refused for the wrong reason. | |

**Notes:** measured before asking — `public` carries default ACLs from two owners (`postgres`,
`supabase_admin`), both `arwdDxtm` on TABLES to `anon, authenticated, service_role`; and
`grep -rln "ALTER DEFAULT PRIVILEGES" supabase/migrations/` returns nothing, so the live cluster's
`pg_default_acl` is pristine stock.

### Q3 — Re-runnable gate, or one-shot phase evidence?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship it as a standalone script | `scripts/check-greenfield-privileges.py`, on the deploy parity checklist, skips with a stated reason when no DB. Kept OUT of `tests/unit` (ceiling 71, zero headroom). | ✓ |
| One-shot evidence in the phase folder | Cheapest and honest about what it proved — but proves it once, and the next drift is invisible again. | |
| Ship it AND wire it into the backend unit suite | Strongest coverage; makes a live Postgres a precondition of `pytest tests/unit`. | |

### Q4 — How wide is the assertion set?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive every narrowing from the migrations | No exception list — the principle that made 252's function gate find three unmirrored functions on its first run. | ✓ |
| Assert only the two SC#1/SC#2 targets | Tight to written scope; only ever knows what this review happened to find. | |
| Diff two scratch DBs — artifacts vs replayed migrations | The goal's literal wording; risk that replaying ~180 migrations into an empty DB has never been done here. | |

**Notes:** deferred, not discarded — the two-DB diff is recorded in CONTEXT.md `<deferred>` with a
concrete re-open trigger.

---

## CR-01 fix shape + the drift fence

### Q1 — Where does table/column parity live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `check-schema-acl-parity.cjs` | Second regex, `(table, grantee, verb, column-set)` tuples. One gate, one hook entry; makes §6's "table OR function" claim true. | ✓ |
| A separate sibling gate | Cleaner separation; a second thing a hook list must remember, and a gate missing from a scan list is invisible to its own guardrail. | |
| Narrow the §6 claim and seed the table half | The review's option (a). Honest about coverage — refuses SC#1 and SC#2 and leaves the escalation path open. | |

### Q2 — How is SC#2's column fence enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| A pytest in `backend/tests/unit` | Imports `_TABLE_SELECTABLE_KEYS` directly (19 keys), asserts set equality against the supplement text. No DB, no JS parsing Python. | ✓ |
| The Node gate parses the Python constant | One gate — but the value is derived from a Pydantic model's keys, which a regex cannot see; it would pin a spelling, not a value. | |
| Only the live greenfield harness asserts it | Truest check, but only runs when Postgres is reachable. | |

### Q3 — Hand-maintain the column list, or generate it?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-maintained, one per line, under the fence | §5's point is that the ABSENT column is visible in a diff; the artifact stays pasteable and readable. | ✓ |
| Generate the GRANT block from `_TABLE_SELECTABLE_KEYS` | Drift impossible rather than merely detected — but puts a generated region inside a hand-written pasteable file. | |

### Q4 — Where does the `connector_tokens` text come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Copied verbatim from migrations 129 and 151 | The 252 precedent; expected set and mirrored set are the same characters. | ✓ |
| Derived from the live DB's actual grants | Measurable (9 column grants today) — but pins the artifact to one machine at one moment. | |

---

## Gate rewrite depth (CR-02 + CR-03)

### Q1 — How far does the gate's key go?

| Option | Description | Selected |
|--------|-------------|----------|
| `verb\|signature\|grantee` tuples, one per grantee | The review's fix; RED drive is the proven `resize_embedding_column … FROM PUBLIC` deletion. | ✓ |
| Tuples PLUS PUBLIC-before-anon ordering | The failure text already lectures about it; either check it or stop saying it. | |
| Tuples, ordering AND reverse drift | Widest; also the most new surface inside a security gate. | |

**Notes:** because ordering was NOT taken, a derived obligation follows and is recorded as **D-14**
in CONTEXT.md — the gate's failure text must be narrowed so it stops implying an ordering check.
Ordering and reverse drift are both in `<deferred>` with concrete re-open triggers.

### Q2 — Which CR-03 fix?

| Option | Description | Selected |
|--------|-------------|----------|
| String-literal-aware walk, single pass | Correct by construction; keeps `;`-splitting meaningful, which the tuple rewrite depends on. | ✓ |
| Drop `^\s*` from ACL_RE and scan globally | Two lines; leaves a stripper still wrong about SQL. | |
| Both | Neither failure can hide the other; each arm then needs its own planted defect or one is untested. | |

### Q3 — Disposition of the five tables beyond CR-01's two?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror all seven — no exception list | 252's precedent; 25 statements over 7 tables is a bounded diff; an exception list is a thing that rots. | ✓ |
| Mirror two, allowlist the rest, plant a seed | Keeps the phase at written scope — ships a security gate with a suppression list on day one. | |
| Mirror all seven, stop and re-scope if the diff exceeds a stated size | Halt-and-return rather than widening silently. | |

**Notes:** measured before asking, and it is the discussion's biggest finding — only 7 tables carry
table/column ACLs across every migration, and 6 of the 7 (`connector_tokens`, `connector_watches`,
`connector_watch_items`, `connector_sync_runs`, `user_settings`, `app_settings`) are mirrored in
NEITHER artifact. The last two are the exact tables `BUG-260911-01` found in production with RLS
disabled and `anon` holding all privileges.

### Q4 — Where do the RED drives live?

| Option | Description | Selected |
|--------|-------------|----------|
| All four arms inside `--self-test` | One home, no framework; `--self-test` already runs wherever the gate runs. | ✓ |
| `--self-test` plus a vitest suite that shells out | Would put drives in the count gate — but SEED-287: TARGETS names files, not directories, so a `scripts/` suite runs nowhere. | |
| Move the gate's tests to a real framework | Cleanest long-term; two large edits to a security gate at once, neither bisectable from the other. | |

---

## Plan shape + DEBT-06 reviewer

### Q1 — Plan split

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans, serial | P1 harness RED → mirror → fence → GREEN; P2 gate rewrite; SC#5 a task on the last. | ✓ |
| 3 plans as ROADMAP specifies | Harness separately bisectable; adds a full worktree cycle for a plan that is red until the next lands. | |
| 3 plans, with SC#5 as its own | Protects CR-08 from being dropped; G-8 exists because bookkeeping plans manufacture their own gaps. | |

**Notes:** serial is required, not preferred — CLAUDE.md worktree rule 4: P1's harness mutates the
shared local Postgres, which no `files_modified` check can see.

### Q2 — DEBT-06

| Option | Description | Selected |
|--------|-------------|----------|
| File a review item to gemini at plan time | Review runs alongside execution rather than queueing behind 8 items filed the same day. | ✓ |
| Review at close | Cleanest reading of DEBT-06 — and exactly the sequencing that produced four self-verified closes. | |
| Write the refusal instead | Record why no review, rather than leaving the field blank. | |

**Notes:** bus state read during discussion — 8 open `to:gemini` items, all filed 2026-09-16.
DEBT-06's structural half is unmet regardless: `grep -rln "independent_review" scripts/ .claude/hooks/`
returns nothing.

### Q3 — SEED-266 routing

| Option | Description | Selected |
|--------|-------------|----------|
| Fold arm (a), keep (b) and (c) open with triggers | Status stays `partially-answered`; `status_note` gains a 253 entry naming arm (a) as answered. | ✓ |
| Fold the whole seed into 253 | Clean register entry — but (b) and (c) are genuinely untouched. | |
| Fold (a) and split (b)/(c) into a new seed | Clean triggers; costs a new id and a second entry for two already-legible arms. | |

**Notes:** the routing was written back into
`.planning/seeds/SEED-266-full-schema-sql-carries-no-acls-and-leaks-row-security-off.md` during this
session, and `node scripts/check-seeds-register.cjs` was re-run afterwards — `296/296 parsed,
0 duplicate ids`, gate OK.

---

## Claude's Discretion

- Scratch-database naming and teardown mechanics.
- The exact shape of the second regex in `check-schema-acl-parity.cjs` and column-set normalisation.
- Whether the four `--self-test` arms share fixture scaffolding.
- Task ordering within each of the two plans.

## Deferred Ideas

- PUBLIC-before-anon ordering assertion in the gate.
- Reverse-drift detection (supplement more permissive than the migration history).
- Diffing two scratch DBs — artifacts vs replayed migrations.
- Generating §5's column block from `_TABLE_SELECTABLE_KEYS`.
- `SEED-266` arms (b) `SET row_security = off` and (c) `--no-privileges`.
- `252-REVIEW.md` CR-04..CR-07 and CR-09..CR-11 — `/gsd:fast` sized under G-3.
- Six reported bugs reading `status: open` while cited as delivered, and `BUG-260828-02`'s duplicate id.

### Reviewed todos (not folded)

- `spike-nl-workflow-authoring.md` (score 0.6) — false positive; matched on generic keywords only.
