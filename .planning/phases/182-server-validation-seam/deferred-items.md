# Phase 182 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: discovered while running adjacent suites,
NOT caused by any Phase-182 change, NOT fixed here.

## D1 — `_build_resume_context` refuses the service-role client without an org_id

**Discovered:** 2026-07-25, during plan 182-04 (running `tests/test_098_scope_governance.py`
as the caller-compatibility gate for the new `FolderScopeSubsetError`).

**Symptom:** `tests/test_098_scope_governance.py::test_run_start_resolution` fails with
`ValueError: get_service_role_supabase requires an explicit org_id`, raised at
`backend/app/services/harness_engine.py:1532` — i.e. BEFORE the
`assert_folder_scopes_subset` call the test is actually about (`harness_engine.py:1588`).

**Root cause (unverified, out of scope):** the v3.4 org hardening (`dependencies.py:228`,
`get_service_role_supabase` refuses a falsy `org_id` — D-05) landed after this Phase-098
test was written. The test's fabricated `run` dict carries no org, so the resume-context
builder refuses to mint the BYPASSRLS client. Test rot, not a product defect — the refusal
is the intended hardened behavior.

**Proven pre-existing:** the identical failure reproduces with the phase-start
(`702d6196`) copy of `harness/scope.py` — same 1 failed / 5 passed. Zero net-new.

**Not fixed because:** unrelated file (`harness_engine.py` / the test's own fixture), no
causal link to the folder-scope keying change, and fixing it means deciding what org a
resumed run's service-role client should assume — a v3.4 org-model call, not a 182 call.

**Re-open trigger:** the next phase that touches `harness_engine._build_resume_context`
or the Phase-098 scope-governance suite.

## D2 — `tests/test_dual_mode_wiring.py` source-drift + resume-context rot (15 failures)

**Discovered:** same session, running the adjacent suites that reference `folder_scope` /
`workflow_kickoff`.

**Symptom:** 15 failures in `tests/test_dual_mode_wiring.py` — a mix of source-text
assertions that no longer match `runs.py` (e.g. `assert '("completed", "failed",
"cancelled", "timed_out")' in src`) and the same `_build_resume_context` org_id refusal
as D1.

**Proven pre-existing:** the SAME command against the phase-start source produces an
identical `15 failed, 82 passed, 1 xfailed`. Zero net-new from plan 182-04.

**Not fixed because:** same-class rot in files this plan never touches; the fix-attempt
limit and scope boundary both apply.

**Re-open trigger:** any phase that touches `api/runs.py`'s cancel/terminal-state vocabulary
or `harness_engine._build_resume_context`.

## D3 — 29 of 133 seed files have frontmatter that does not parse as strict YAML

**Discovered:** 2026-07-25, during plan 182-05 (validating the frontmatter of the three
new seeds against the SEED-129 reference schema).

**Symptom:** `yaml.safe_load` on the `---` block fails for 28 seed files, and
`SEED-084-starter-workflow-library.md` has no frontmatter block at all. 104 parse
cleanly. The reference file the plan named as the schema to mirror,
`SEED-129-residual-org-blind-service-role-skill-reads.md`, is itself one of the
failures.

**Root cause:** unquoted plain scalars containing `": "`. YAML reads the embedded
colon-space as a nested mapping key. Example, SEED-129 line 7:

```yaml
category: security / tenancy-isolation — ... different call sites: none of them is a ...
                                                                ^^ parse breaks here
```

Three failure signatures appear — `mapping values are not allowed here` (the
colon-space case above), `while scanning for the next token` / `while parsing a block
mapping` (unescaped/unbalanced quoting inside a value), and one
`while parsing a flow sequence` (SEED-066, a malformed inline `[...]` list).

**Why it matters (not cosmetic):** seed frontmatter is the machine-readable index for
the deferred backlog — `status`, `folded_into`, `re_open_triggers`, `priority` are how
the `audit-open` sweep at milestone close enumerates open seeds (STATE.md's v3.4 close
counted "Seeds (dormant) | 9" from exactly this surface). A seed whose frontmatter does
not parse is invisible to any consumer that reads it structurally, which silently
defeats the project's preserve-every-deferred-idea rule for ~22% of the backlog. Note
this is a LATENT risk today, not a proven live failure: it was not confirmed during this
plan which specific tools parse seed frontmatter strictly versus regex-scrape it, and a
lenient consumer would not have surfaced it. Confirm the consumer set before sizing a fix.

**Not fixed because:** 29 files, none of them in this plan's `files_modified` (plan
182-05 owns exactly 4 files and its own acceptance criteria forbid touching anything
else). The three seeds this plan planted were authored quoted and verified to parse
cleanly, so the defect is not being extended.

**Re-open trigger:** any tooling change that reads seed frontmatter structurally
(a seeds index, an `audit-open` sweep, a `/gsd:new-milestone` seed roll-up), or the next
milestone close that counts open seeds — validate the whole directory first, since the
count will be wrong by up to 29. A one-pass mechanical fix (quote every offending scalar,
add frontmatter to SEED-084) plus a CI guard that parses every `.planning/seeds/*.md`
frontmatter would close it permanently and is the recommended shape.

## D4 — `test_bounded_retry_reaches_failed_after_3_attempts` audits 0 of 3 attempts

**Discovered:** 2026-07-25, during plan 182-07 (a wider-than-required regression sweep
across the harness/publish/workflow suites, run because the plan touched a module the
publish path also imports).

**Symptom:** `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts`
fails at `assert _audit_failures(mock_asyncpg_pool) == 3` with `assert 0 == 3`
(`tests/test_harness_gates.py:192`). The preceding assertion — `calls["n"] == 3`, the
HARD retry bound — passes, so the retry loop itself is correct; only the per-attempt
D-08 audit write is missing. Two adjacent log lines point at the same area:

```
WARNING app.services.harness_engine:harness_engine.py:532  harness failure surfacing:
        missing thread_id/user_id on ctx for run <uuid> (run_failed emitted but failure
        message not persisted)
ERROR   app.services.harness_engine:harness_engine.py:1242 ask_user expiry cleanup failed
        at fail_run site for run <uuid>  ->  KeyError: 'tool_call_id'
```

**Root cause (unverified, out of scope):** the failing surface is entirely inside
`harness_engine.py` — the `fail_run` path's audit write and its `ask_user` expiry cleanup.
Most likely the same class as D1/D2 (fixture drift: the test's fabricated ctx carries no
`thread_id`/`user_id`, and a tool-call record lacks `tool_call_id`), but that was not
confirmed, since confirming it means deciding what the engine should do with an
identity-less ctx — an engine-contract call, not a 182 call.

**Proven pre-existing:** the three source files plan 182-07 modifies
(`app/api/workflows.py`, `app/services/harness/reachability.py`,
`app/services/harness/grounding.py`) were temporarily replaced with their phase-start
(`e262e9af`) copies and the SAME test produced the identical `assert 0 == 3`. Files were
then restored from a scratchpad backup — `md5sum -c` OK, `git diff HEAD` empty. Zero
net-new from 182-07.

**Not fixed because:** unrelated file, no causal link (neither `LINT_CODES`,
`GROUNDING_VERDICT_CODES` nor `_severity` is reachable from the engine's retry/audit
path), and the scope boundary applies.

**Re-open trigger:** the next phase that touches `harness_engine`'s `fail_run` / audit
write path, its `ask_user` expiry cleanup, or the `test_harness_gates` suite. Worth
pairing with D1/D2 — all three smell like the same post-v3.4 fixture drift.
