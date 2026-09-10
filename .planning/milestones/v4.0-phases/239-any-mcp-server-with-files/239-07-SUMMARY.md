---
phase: 239-any-mcp-server-with-files
plan: "07"
kind: seed-answer-frontend
answers: SEED-259
scope: frontend
subsystem: settings · connections · sources
base: eecbe502a
head: 3fe03a5d1
tdd: true
tags: [mcp, argument-mapping, rows-not-code, fail-closed, hi-02, tdd-red, seed-259]
backend_plan: 239-06
---

# Phase 239 Plan 07 — `SEED-259`'s argument mapping becomes a thing a person can set

`239-06` made a tool's argument SHAPE a row and could only be reached by hand-crafting a `PATCH`.
It is now a control. **The capability half of `SEED-259` is reachable through the product for the
first time; SC#2 is still not met, because nothing has been driven against a live server.**

---

## ⚠ Read this first: the worktree landed on the wrong base, for the SIXTH time running

`git log --oneline -1` in the fresh worktree read **`1335b4b1a`** — *"Merge develop into master —
ship v3.9 Connections"* — not the `eecbe502a` the brief names. The brief predicted five
occurrences; **this is the sixth, and it is now a perfect record.** Reset with
`git reset --hard eecbe502a` before any read; every measurement below is from that base.

⭐ **The prediction being right for the sixth consecutive time is the finding, not the reset.**
Nothing in this repository makes the wrong base *visible* — a worktree at `1335b4b1a` typechecks,
its tests pass, and it merges cleanly. The only thing standing between that and a phase built
against v3.9 is a paragraph in a brief that a plan must remember to read.

---

## What shipped

Three commits, all frontend, all inside the existing *File source mapping* card.

| Commit | What |
|---|---|
| `3971d99d2` | `test(239-07)` — the RED suite, alone, against the shipped tree |
| `bd2419ae4` | `feat(239-07)` — the controls, the derivation and the serializer |
| `3fe03a5d1` | `docs(239-07)` — both ledger rows re-derived, row + section in the same commit |

### The path argument is a PICKER, and that is the opposite choice to HI-04 one field up

The root folder is free text because **a server publishes its TOOLS, never its FOLDERS**. The path
ARGUMENT is a `<select>` because a server *does* publish its argument names — they are already in
`discovered_tools[].inputSchema` and already stored, so the product knows them. Asking a person to
retype one is how a typo pins every read to one fixed place, which is a **complete listing of the
wrong folder**: `H-5`'s deletion signal wearing a success.

It degrades to free text **only where the server declared nothing**. ⚠ And the branch is on what
the server DECLARED, never on how many options would result — that distinction was **driven, not
reasoned**. My first implementation merged the stored value into the options and then branched on
the count, so a server with no schema offered a one-option `<select>` containing the person's own
previous answer: a control that looks like a choice and is a dead end. The suite caught it at the
first GREEN run. **The test was not edited to accommodate the code** — its md5 is unchanged from
the RED measurement (below), which is what makes that claim checkable rather than asserted.

### The rows are derived from the schema, one per required argument the path does not carry

`sourceArgumentModel` reads the **effective** tools — `sourceListTool || "list_directory"` — because
`_resolve_binding` does `tools.get("list_tool") or DEFAULT_LIST_TOOL`, so an empty slot is not *"no
tool"*, it is the reference server's name. A model that read it as nothing would show no rows for a
connection that will really be called.

Choosing which argument carries the path **removes it from the rows**, mirroring
`_missing_arguments`' `required - (statics | {path_arg})`.

### The refusal is said BEFORE somebody hits it

`239-06` made an underspecified binding a refusal by name. The card now names every unfilled
argument and says the call is refused rather than answered empty — the same shape
`SOURCE_TOOLS_ROOT_HELP` already uses for a blank root (*"a blank root is refused rather than
guessed"*). It does **not** block Save: blocking would be a new failure mode, and the refusal
belongs at call time where the adapter can word it.

### ⛔ An unfilled row is OMITTED, and that is a deliberate divergence from the adapter

`mcp_source._static_args` **keeps** an empty value, deliberately, because through the API `""` is a
value somebody typed. **Here every derived row STARTS empty.** Writing them would put an
`arg_static.*` key on the connection for every argument nobody supplied — and
`refuse_if_underspecified` would then have **nothing to say, because the key IS present**. Merely
opening this panel and pressing Save would have disabled `239-06`'s safety half for the whole
connection at once: the fail-open shape the seed exists to close, re-entered through its own
remedy. The divergence is recorded in both files and asserted by a case.

### The two non-negotiables, both held and both asserted

1. **The stored value is ALWAYS rendered.** A `<select>` whose value is absent from its options
   renders UNSELECTED, so a filter alone turns *"open the panel and press Save"* into a silent
   wipe — HI-02, re-introduced by a remedy. Both new controls offer the stored value even when the
   schema does not declare it, and a stored static the server no longer asks for **still gets a
   row**, with a sentence saying why it is there.
2. **Every arm of `configFromDraft` carries it.** `239-05` found the arm set IS the seam: the `mcp`
   arm carried the binding and the `oauth` arm — where an MCP server connected by OAuth actually
   lands — silently deleted it. **Both new keys go through `sourceToolsFromDraft`, which both arms
   already call**, so a key added there cannot be present on one and absent on the other. Driven on
   both arms, plus a containment case proving the non-MCP arms do not widen.

---

## RED evidence, with hashes

### The suite was RED before the implementation existed

`frontend/src/components/settings/__tests__/ConnectionFormPanel.argumentMapping.test.tsx`
md5 **`a104eab7edac4fe980860a81e71dbf1f`**, committed alone at **`3971d99d2`**, against the shipped
tree at base `eecbe502a`:

```
 Test Files  1 failed (1)
      Tests  28 failed | 3 passed (31)
```

⭐ **The same file, byte-identical (md5 re-measured `a104eab7edac4fe980860a81e71dbf1f` after the
implementation landed), now reads `31 passed`.** The test did not move to meet the code.

⚠ **THE 3 PASSING CASES HAD NO RED VALUE AND ARE NAMED RATHER THAN COUNTED AS EVIDENCE:**

| Case | Why it was green at base |
|---|---|
| *the fixture's tool names survive the picker's mutation filter* | It is the fixture's own premise check, and it is meant to be green before and after — that is what makes the other 28 non-vacuous |
| *sourceToolsFromDraft emits nothing for an unmapped draft* | The function already returned `undefined` for a draft with no binding |
| *a non-MCP shape never acquires the keys* | Trivially true when the draft fields did not exist. It is a meaningful containment guard **after** the change and is not proof of it |

### Both structural fences were driven RED against the SHIPPED files

**Fence 1 — the same-commit sync with the adapter.** Planted into the shipped
`backend/app/services/sources/adapters/mcp_source.py` (`PATH_ARG_KEY = "argument_path"`):

```
AssertionError: expected '"""Phase 239 (SRC-04 / D-239-01 … D-2…' to contain 'PATH_ARG_KEY = "arg_path"'
1 failed | 30 skipped (31)
```

Restored and re-measured **md5-identical**: `b32f5f3ee4b27dedb11c538cc0ba4cc4` before and after.

⚠ **AND THE FIRST RESTORE WAS NOT BYTE-IDENTICAL, WHICH IS WORTH RECORDING.** `sed -i` on this
box rewrote the file's line endings, so the md5 came back `97d9f34c1f00e0e985a5dd29b7e7285d`
against an unchanged-looking diff. `git checkout -- <file>` restored it exactly. **A
plant-and-restore performed with `sed -i` can silently leave a whole-file CRLF diff** — the
restore must be verified by hash, not by reading the line back.

**Fence 2 — no vendor name and no argument default.** Planted `const PLANTED_DEFECT = ["owner",
"repo"]` into the shipped `ConnectionFormPanel.tsx`:

```
AssertionError: expected '/**\r\n * Phase 190-17 (CONN-02 / CON…' not to contain '"owner"'
1 failed | 30 skipped (31)
```

Restored **md5-identical**: `c5bef284cba1d9b16447a22cd0f67c84` before and after, `git status
--short` clean on that path.

⚠ **The fence scans STRING LITERALS, not words, and that is load-bearing.** Both shipped files
legitimately contain `github` in prose and in an OAuth provider map, so a naive whole-file vendor
scan would have been RED for pre-existing reasons — a fence that cannot pass is not a fence. It
carries a non-vacuity control (`arg_static.` and `connection-source-args` must be found in the same
scan), so a failed `?raw` import cannot make it pass on two empty strings.

⭐ **The behavioural half of the same fence is the fixture vocabulary.** `enumerate_vault`,
`fetch_entry`, `holder`, `vault`, `trail` appear nowhere else in this repository — the backend's
`test_the_refusal_holds_for_a_server_NOBODY_PREDICTED` idiom. A card that renders these rows
correctly cannot be reading a table of servers it was told about.

---

## Gate verdicts, verbatim

**The brief's gate, run from `frontend/`:**

```
$ GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/settings src/components/sources
 Test Files  1 failed | 31 passed (32)
      Tests  17 failed | 818 passed (835)
```

**`src/components/settings` alone — the whole blast radius of this plan:**

```
 Test Files  22 passed (22)
      Tests  536 passed (536)
```

**The new suite alone:** `Test Files 1 passed (1)` · `Tests 31 passed (31)`.

### ⚠ The 17 failures, triaged before anything was re-run

**Every one is in `src/components/sources/sourceComposition.test.tsx`** — the standing red the brief
names, in NEITHER gate knob by a Phase 235 decision. The failing SET was captured from the gate's
own JSON report **before** any re-run, and each was checked:

- `git status --short` and `git diff --numstat` name **three** files for this plan, and that file is
  **not one of them** — it is **provably unmodified**.
- ⭐ **Stronger than unmodified: it is provably OUT OF THE MODULE GRAPH.** `ConnectionFormPanel` and
  `connectionFormCopy` are imported by **eleven** files, all under `src/components/settings/`; that
  suite imports neither, directly or transitively. My change cannot reach it.
- **The cap was not touched.** It stayed at `2` for every run in this plan.

⚠ **The brief says 16 and the combined run reads 17, so the extra one was measured rather than
waved at.** Run alone, that file reads exactly the standing figure:

```
$ GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/sources/sourceComposition.test.tsx
      Tests  16 failed | 33 passed (49)
```

The 17th is `§2 positive controls · LibraryPage renders its heading — the page harness works`,
failing with `STACK_TRACE_ERROR` — a mount timeout on a **positive control**, present in both
combined runs and absent from the isolated one. That is the SEED-171 signature, cap-independent
and load-shaped. ⚠ **One green sample proves nothing**, so the honest statement is: *provably
unmodified, provably outside the import graph, and reproducing only under combined load.*

### `tsc --noEmit` — the set diff is EMPTY

```
$ npx tsc --noEmit ; echo "tsc exit=$?"
tsc exit=0
```

Zero output, exit 0 — the state the brief requires it be kept in. **Before: `{}` · after: `{}` ·
diff: `∅`.** There is no error set to diff because neither side has one; the claim is exit code
and empty stdout, both captured above.

### Ledger and CLAUDE.md

```
$ node scripts/check-hot-file-ledger.cjs --files frontend/src/components/settings/ConnectionFormPanel.tsx frontend/src/components/settings/connectionFormCopy.ts
  scan list: 231 rows · subject: 2 files · watched: 2
ledger gate OK — every watched file has a row.

$ node scripts/check-claude-md-size.cjs
  CLAUDE.md                                   86187 chars   57.5% of limit  headroom   63813  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

---

## Ledger triples, re-derived in the commit that lands them

| File | row said | **re-derived** |
|---|---|---|
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | `25 / 10 / 2577` | **`27 / 10 / 2807`** |
| `frontend/src/components/settings/connectionFormCopy.ts` | `17 / 8 / 1293` | **`19 / 8 / 1631`** |

⚠ **`ConnectionFormPanel.tsx`'s row has now been stale at FOUR consecutive closes**
(`9 / 5 / 2009` → `17 / 7 / 2376` → `24 / 10 / 2545` → `25 / 10 / 2577`), and
`connectionFormCopy.ts`'s at two. The ledger's own repeated finding, reproducing on the same file
for the fourth time. Both CLAUDE.md rows and both `docs/HOT-FILE-LEDGER.md` sections are updated in
the same commit, per the sync rule; the new §239-07 section carries the reasons and the disposition
cells stay inside the 200-char cap.

⛔ **G-5 FIRES on the panel at ten phases and the extraction is OWED, not discharged.** The file is
**2807 lines** and the source-binding card is roughly 330 of them. **The seam is that whole card**:
it reads `probeResult` and `draft`, writes only through `set`, and has no other coupling — it moves
to a `SourceBindingCard` with no state to relocate. It was not taken here because this is a
frontend-surfacing plan inside an in-flight phase; the re-open trigger is the next phase whose
`files_modified` names this file.

---

## ⛔ What I did NOT do — silence would read as done

1. **SC#2 IS STILL NOT MET, and this plan does not close it.** `SEED-259`'s own ruling says the
   criterion stays open until a second server actually lists and reads. **Nothing was driven
   against a live server** — every claim above is from unit drives with fixture data. What changed
   is that the remaining work is now a **UAT row somebody with a credential can run**, rather than a
   build. That row is the seed's one remaining `re_open_trigger`.
2. **No STATE.md, ROADMAP.md, VALIDATION.md or REQUIREMENTS.md edit.** Deliberate, and the same
   call `239-06` made: SC#2 is not met and I did not want a record implying otherwise.
3. **`SEED-259` stays `status: answered`.** Its frontmatter is unchanged; the body now records the
   frontend pass and strikes through the half of its `re_open_trigger` that has fired.
4. **The refresh-after-discovery re-seed does NOT carry the new keys**, and that is not an
   oversight: `infer_source_tools` never produces `arg_path` or `arg_static.*` (`239-06`'s item 5 —
   auto-detecting which parameter is the path is the guess `CR-02` was filed about), so seeding
   them from that path would be dead code today. If auto-detection ever lands, **that effect is
   where it must be wired**, and this sentence is the note that says so.
5. **No backend change of any kind.** `backend/` is byte-unchanged — the two plants were restored
   md5-identical and verified by hash and by `git status`.
6. **The unstorable-name case is NARROW.** A derived argument name whose `arg_static.` key would
   break the 64-char ceiling gets no box and is named on screen. It is the honest handling of a
   server pathology, not a general validation layer — there is no client-side check on the VALUE
   beyond `maxLength`, because the model's own 422 is the right authority for that.
7. **A stored static named the same as the path argument still renders**, as a *"not asked for —
   kept"* row. That wording is approximate for this one case (the server may ask for it; the path
   supplies it), and it is recorded here rather than given a third copy string. The adapter writes
   the path LAST so such a static is dead either way, and rendering it is what lets a person delete
   it.
8. **`sourceComposition.test.tsx` was NOT touched.** It is inherited red by a Phase 235 decision and
   is not this plan's to fix.
9. **`ConnectionFormPanel.tsx`'s extraction was not taken** — see the G-5 paragraph above.
10. **Nothing pushed. `master`, `production` and `backend/` untouched.**

---

## Anything that contradicts the brief

**Nothing material.** Three notes, recorded because the brief asks:

- The brief says *"offer the actual argument names rather than a free-text box **wherever you
  can**"*. There is one arm where it cannot: a server that published no `inputSchema` at all. That
  arm is free text, it is asserted with a positive control on the other arm, and the reason is
  written at the branch.
- The brief's *"say what happens when it is incomplete"* is answered with **two** sentences, not
  one, because *"this server asks for nothing else"* and *"this server has not said"* are different
  facts and only one is ever knowable. Conflating them would be the empty-listing lie in prose.
- The brief's non-negotiable on `max_length` is honoured with `maxLength` on every control plus a
  serializer guard on the key ceiling. **The serializer guard can drop a key** — it is the one
  silent drop in this change, and it is reachable only for a name the card explicitly refuses to
  give a box to, so nothing a person typed is ever discarded by it.
