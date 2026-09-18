# Phase 245 — deferred items (out of scope, discovered during execution)

Logged per the executor SCOPE BOUNDARY rule: discovered while executing, **not** caused by this
phase's changes, therefore **not fixed here**.

---

## DEF-245-01 — `244-VERIFICATION.md`'s frontmatter is invalid YAML, and was at HEAD

**Found during:** `245-01` Task 1, running the plan's own YAML acceptance check over the five
marked files.

**Measured, both directions:**

```
244-VERIFICATION.md HEAD -> YAML ERROR: mapping values are not allowed here
244-VERIFICATION.md NOW  -> YAML ERROR: mapping values are not allowed here
```

Byte-identical failure before and after this plan's one-line insert, so the defect is inherited,
not introduced. The offending token is at **frontmatter line 26, column 505** — an unquoted block
scalar under `gaps_closed_this_round:`/`sc_closures:` that contains a bare `: ` sequence:

```
  SHELL-03: CLOSED 2026-09-13. Built across 244-03 / 244-12 / 244-15; G-8 was driven FALSE at R2-4 …
```

YAML reads the second `: ` as a nested mapping key and refuses the document.

**Why it was not fixed here:** `245-01` is forbidden from changing prose in a `*-VERIFICATION.md`
(D-01 / the ROADMAP's Flags block). Repairing this needs a quoting change to an authored line, and
the plan's mechanical fence is `git diff` deletions **= 0** in all five files. A fix would break the
fence that proves the plan did not re-review anything.

**⭐ It independently confirms a design decision rather than merely being a nit.** `D-02` mandates
that `check-verification-honesty.cjs` be zero-dependency — `fs`, `path`, `child_process`, a `split`
and never a YAML parser. **A YAML-parsing gate would have exited `2` on `244-VERIFICATION.md` on its
very first run**, on a file that carries the marker correctly. The refused dependency is the reason
the gate can read this file at all.

**Re-open trigger:** the next phase that legitimately edits `244-VERIFICATION.md`'s frontmatter
(a re-verification round, or the v4.1 close archiving it). Quote the value; change nothing else.

---

## DEF-245-02 — `236-ROSTER-REPORT.md` was dirty in the working tree before this phase began

`git status` at `245-01`'s start already carried ` M .planning/phases/236-the-corpus-under-attack/236-ROSTER-REPORT.md`
(1 insertion / 1 deletion). **It is not this plan's change and was not staged by any of its commits.**
It is named here only because `245-01`'s acceptance criterion *"total deletions across `.planning/`
= 0"* reads that pre-existing deletion and would otherwise look like a violation of this plan's
no-prose-changed fence. Deletions attributable to `245-01` are **0**; see the per-file `--numstat`
in `245-01-SUMMARY.md`.
