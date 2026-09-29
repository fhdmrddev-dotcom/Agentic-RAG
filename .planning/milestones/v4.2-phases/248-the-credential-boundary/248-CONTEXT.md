# Phase 248: The Credential Boundary - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

## ⚠ ROLES — REVERSED 2026-09-14, AFTER THIS FILE WAS WRITTEN. READ THIS BEFORE THE DECISIONS.

~~Verification mode is `self-verified` by operator ruling. Claude plans, builds and closes this phase
end-to-end (operator, 2026-09-14: *"you will handle next phase end to end yourself."*). Gemini has
been told it is 248's reviewer and must NOT start the build (`BUS-227`).~~

⛔ **SUPERSEDED the same day — the original is struck through rather than deleted, because a reader
who finds only the new ruling cannot tell that this file was authored under the old one.** Operator,
2026-09-14, verbatim: *"handover planning and execution to gemini and you review."*

| | |
|---|---|
| **Builds** (plans + executes) | **Gemini** |
| **Reviews** | **Claude** |
| Armed by | `bash scripts/arm-pair.sh 248 gemini` → `BUS-228` / `BUS-229` |
| `BUS-227` | ⛔ **RETRACTED IN FULL by `BUS-230`** and closed. It told Gemini in capitals not to start 248 |
| Expected close | `verification_mode: peer-reviewed` — **not** `self-verified` |

⚠ **AND THE §6.3 PROBLEM THIS CREATES, DISCLOSED RATHER THAN HIDDEN, BECAUSE IT IS THE REVIEWER'S
OWN.** **Claude wrote this file** — 15 decisions — under the old ruling, and `CLAUDE.md` warns that
*whoever REVIEWS a phase must not have shaped the build*. The reviewer has therefore shaped the
design.

- ⭐ **What makes it usable anyway: every one of the 15 decisions was CHOSEN BY THE OPERATOR** through
  `AskUserQuestion`. Claude framed the options and marked recommendations — that framing is the
  shaping — and the operator picked each one. **Read this file as operator-ratified input, never as
  build direction from the reviewer.**
- ⛔ **The consequence binds the REVIEWER, not the builder: at review, Claude may not defend a
  decision because it appears here.** If Gemini disagrees with one, that is a DECISION and it goes
  `--to operator` — never settled agent-to-agent.
- ⚠ **The cleanest alternative remains open and is the operator's to call:** have Gemini re-run
  `/gsd:discuss-phase 248` from scratch and supersede this file entirely.
- ⚠ **The honesty gate cannot catch any of this** — it checks that a `verification_mode` marker is
  **present**, never that it is **true** (found 2026-09-14 by using it). So 248's verdict must state
  the shaping in words.

⭐ **Baselines were captured BEFORE the builder started** — `248-GATE-BASELINE.md`, at
`415f57f8e`. ⛔ **`count gate OK` is NOT reachable for this phase** (3 inherited failures) and the
backend gate is a **set with a one-test flake band**, not the number `71` that `CLAUDE.md` publishes.

<domain>
## Phase Boundary

A secret cannot come to rest anywhere a reader who should not see it can read it:

1. **not in a mis-typed field** — `custom_client_id` accepts any string into `config`, a column
   `authenticated` can `SELECT` org-wide while `secret_ciphertext` cannot (`CRED-01`);
2. **not behind a marker that overclaims its own authorship** — the grant surface still offers to
   undo a choice no person made (`CRED-02`);
3. **not through a function the exposed API schema hands to `anon`** — 13 `SECURITY DEFINER`
   functions, in three ACL groups requiring two different remedies (`CRED-03`);
4. and the instrument that is the only thing to have ever caught this class becomes a step of the
   deploy parity checklist (`CRED-04`).

**Not in this phase:** the `connectors.py` extraction (owed at its sixth landing — see Deferred),
the wider `ConnectionShapeFields.tsx` seam, the `rls_enabled_no_policy` INFO findings, and any
production write. Cloud application of migration 181 is a separate operator-approved step.

</domain>

<decisions>
## Implementation Decisions

### CRED-01 — the refusal rule

- **D-248-01: The check is a NEGATIVE, credential-smell rule, applied to all three
  `custom_client_id` homes — not a positive per-provider shape.** Refuse what looks like a secret
  (Entra's `<prefix>~<body>`, over-length, high-entropy with no provider marker), not "anything that
  is not a GUID."
  **Why, and this is the binding reason:** `custom_client_id` has **three** homes, not the one the
  bug report names — `McpConfig` (`connector.py:244`), `OAuthConnectionConfig` (`:351`) and
  `OAuthAuthorizeRequest` (`:558`). `McpConfig`'s value is **minted by the server under RFC 7591
  dynamic client registration** (`bD78Ksp3xBJew1kL` in `McpAuthDoor.byo.test.tsx:161`) and has no
  knowable shape. A GUID / `.apps.googleusercontent.com` rule would refuse a legitimate id and break
  the Phase 222 MCP BYO door.
  ⚠ **Accepted weakness, stated rather than hidden:** a secret that happens to look like an id still
  passes. The rule catches the mistake that actually happened, not every conceivable one.

- **D-248-02: The Pydantic model validator is THE gate; the panel repeats the sentence as a
  kindness.** A 422 naming the mistake and naming which field takes a secret, so `curl` is refused
  too; the panel shows the same sentence inline before save.
  **Why:** this is the posture `connector.py` already records for `NonEmpty` on `host` /
  `from_address` — the model is the gate, the panel is the kindness. No new pattern is invented.
  ⛔ **Not chosen:** a live paste-time warning. It would add state and a debounce to
  `ConnectionFormPanel.tsx`, whose wider seam is already owed.

- **D-248-03: Existing bad rows are DETECTED AND REPORTED, never auto-cleared.** Migration 181 (or a
  companion read-only query) NAMES any `config->>'custom_client_id'` failing the shape so an operator
  knows which connection to rotate.
  **Why:** a failing value is **a credential to rotate, not just a bad row** — clearing the column is
  not sufficient because the secret is already burned, and deleting it destroys the only signal that
  a rotation is owed. Production is already clean (the operator removed the key by hand and rotated
  the Entra secret); this is for every other install.

- **D-248-04: The fence makes its assertions through a REAL second connection, as `anon` AND as
  `authenticated` — not through the service role.** One fixture; it asserts that `authenticated`
  **CAN** `SELECT config` (proving the exposure is real rather than hypothetical), **CANNOT**
  `SELECT secret_ciphertext`, and that `anon` gets nothing.
  **Why:** ⛔ *every gate in this project reads through the service role and nothing in the suite
  makes a request as `anon`* — that is exactly why `BUG-260911-01` was invisible to all of them
  (migration 177's own audit says so). A CRED-01 fence exercised only through the service role
  reproduces the blind spot exactly.
  ⭐ **Build this fixture once — `CRED-03` reuses it.** It is the instrument this project has never
  had, and it is the most durable thing 248 can leave behind.

### CRED-02 — the marker that overclaims

- **D-248-05: The HEADLINE defect is already fixed, and the requirement is NOT therefore
  discharged.** Measured 2026-09-14: `GRANTS_COPY.OVERRIDDEN_LABEL` is `""`
  (`grantsVocabulary.ts:38`), deleted at `e615c0dad` in the 2026-08-31 noise audit. The words *"You
  changed this"* render nowhere.
  ⛔ **What remains is the AFFORDANCE.** `ActionRow.tsx:95` still renders *"Use the default"* on every
  row migration 128's backfill wrote, and `grantsVocabulary.ts` states outright that the reset's
  *"mere presence carries exactly what the tag spelled out."* **By the file's own reasoning the
  screen still tells the reader a choice was made.** The dishonesty moved from a label to an
  affordance; deleting the tag relocated it rather than removing it.

- **D-248-06: The fix is a REWORD to what is known — a forward action, not an undo.** e.g.
  *"Follow the default instead"* rather than language implying a prior choice. Copy only, in
  `grantsVocabulary.ts`, the one file the whole grant surface reads from. Zero behaviour change, zero
  schema.
  ⛔ **Not chosen — record authorship in `tool_grants`.** It would make the claim honest instead of
  avoided, but it is a jsonb shape change on a config-like column plus a migration, and that is
  **`SEED-239` territory**: one unexpected key shape inside a row's config is exactly what made every
  connection in an org unreadable (503, *"Could not load connections"*, driven live 2026-09-01).
  ⛔ **Not chosen — "differs from the default".** A behaviour change, not copy: it would also hide the
  reset on a row a person genuinely set to the same value as the default.
  ⛔ **Not chosen — show it on every row.** That is the 44-control noise the 2026-08-31 audit deleted.

- **D-248-07: The reword is fenced by asserting the RENDERED CONTENT, not block presence.** Render
  `ActionRow` in both states and assert the visible words — that the new sentence appears on an
  overridden row, and that no string claiming a person acted appears anywhere on the surface.
  **Why:** Phase 235's finding, ratified into G-8's reasoning — *a green composition fence by
  `data-testid` coexisted with the shipped defect because the content drifted underneath it.*
  **Presence assertions cannot see content drift; assert the rendered CONTENT where the words are the
  deliverable.**

### CRED-03 — the 13 functions

- **D-248-08: The ruling covers BOTH advisor lints, not the `anon` one alone.** Production reports
  `anon_security_definer_function_executable` (13) **and**
  `authenticated_security_definer_function_executable` (13) — the **same thirteen functions**.
  **Why it is not scope creep:** the remedy is `REVOKE … FROM PUBLIC`, and `PUBLIC` covers both roles
  in one statement. The moment the revoke lands, what `authenticated` gets back is a decision that
  must be made — so the second lint is answered by construction whether or not it is written down.
  ⭐ **`current_user_org_ids` appears 147 times in `supabase/full-schema.sql`** — withholding it from
  `authenticated` breaks RLS across the product. `current_user_has_permission` appears 21 times.

- **D-248-09: A per-function CALLER TRACE is written BEFORE the migration, in writing, for all 13.**
  Reproduce migration 177's own method: name the frontend grep, the service-role path and
  `get_user_supabase()` by file and line, then conclude.
  **Why:** 177 deliberately scoped itself narrow and left this sweep as *"its own piece of work"*,
  with the warning that **revoking them without tracing every caller would trade a config exposure
  for an outage.** That warning is this phase's principal risk.
  ⛔ **A zero app-code grep is NOT evidence of no caller, and a plan that treats it as evidence is
  wrong.** RLS helpers are invoked inside POLICY bodies and trigger functions by Postgres on a row
  event — **neither ever appears in Python or TypeScript.** Measured: `autofill_org_id_from_parent`,
  `stale_skill_embedding`, `stale_skill_embedding_from_case`, `connection_doc_is_visible` and
  `folder_is_org_shared` each return **0** app-code references and all five are in active use.
  ⚠ **One question the trace must ANSWER rather than assume:** does executing a TRIGGER require the
  DML user to hold `EXECUTE` on the trigger function? Postgres checks this at `CREATE TRIGGER` time,
  not at fire time — **drive it against the local DB before revoking any of the six trigger
  functions**, because the whole six-function arm depends on the answer.
  ⭐ **Already answered once, re-read rather than redone:** `match_document_chunks`,
  `keyword_search_chunks` and `match_skills` filter on `auth.uid()` and **not** on their
  `match_user_id` argument, so under `anon` they return nothing. Source: migration 177's header, and
  the function source says so in a comment. The v3.4 one-way door holds.

- **D-248-10: The per-function ruling lives IN MIGRATION 181 ITSELF**, as a comment block per
  function — group (A / B / C), caller trace, verdict, reason — exactly as 177 does.
  **Why:** 177 is the artifact this session repeatedly went back to, and the ruling ships with the
  change that enacts it and cannot drift from it. This project's own recurring finding is that *a
  fact in a register nobody re-reads is the same as no fact*; the migration is the file people
  actually open.
  ⛔ **Remedy differs by group and a uniform migration half-works and reads green:**
  **Group A (11, ACL carries `=X/postgres`)** — `REVOKE … FROM PUBLIC` first, then grant back.
  **Group B (2: `autofill_org_id_by_owner`, `autofill_org_id_from_parent`)** — a plain
  `REVOKE … FROM anon` DOES work; no PUBLIC grant present.
  **Group C (2: `create_org_with_default_dept`, `resize_embedding_column`)** — already locked down,
  nothing owed. `resize_embedding_column` is proof the Group A remedy shape works: migration 177 had
  to revoke from `PUBLIC` to get it there.

- **D-248-11: SC#3's proof is a LOCAL re-run; the production re-run is a separate operator-approved
  step, recorded as owed rather than claimed.** Apply 181 to local Supabase, re-derive the function
  ACLs there, close on that.
  **Why:** every write against production needs explicit per-action operator approval (CLAUDE.md),
  and phase closure must not depend on the operator being at a keyboard. ⚠ **The verdict must SAY
  that the production advisor still reads 13/13 until the cloud apply** — silence would read as a
  claim that it does not.

### CRED-04 — the deploy-checklist step

- **D-248-12: `scripts/check-security-advisors.sh`, listed in `docs/DEPLOYMENT-WORKFLOW.md §6`
  (pre-promotion checks), run by the operator.** Structural sibling of `check-deploy-drift.sh` and
  `pending-cloud-migrations.sh` — same why/usage/notes header, strict-bash mode, non-zero exit on
  failure.
  ⛔ **Not chosen — a CI job.** It would be genuinely unskippable, but it needs a long-lived
  production-read PAT as a GitHub repo secret. **Adding a standing credential to close a
  credential-boundary phase is the wrong trade**, and that call is the operator's, which is why it was
  asked rather than assumed.

- **D-248-13: The script calls the Supabase Management API** — `GET /v1/projects/{ref}/advisors/security`
  with a token from the environment. The Supabase MCP is a Claude-side tool and **cannot** be called
  from bash.
  ⚠ **MEASURED, and it closes off the obvious source:** `app_settings.supabase_management_token`
  exists as a secret column but **is NULL in production** (read live 2026-09-14). It is not a viable
  source today — the token comes from an env var, and the var must be registered in
  `OMITTED_FROM_ONEBOX` or added to `deploy/onebox.env.example` under the same-commit deploy-artifact
  parity rule.
  ⛔ **Not chosen — vendoring Supabase's linter SQL.** It would need no token and would work against
  LOCAL, but a copied third-party query rots silently: you get the lints you copied, not the lints
  that exist.

- **D-248-14: ERROR-level findings FAIL the script; WARN findings print in full and PASS.**
  **Why:** ERROR is the level that caught `BUG-260911-01` (`rls_disabled_in_public`) and the level
  that means *someone can read or write what they must not*. Production currently has **zero ERROR**
  and **7 WARN classes** — including `extension_in_public` (vector) and `function_search_path_mutable`
  ×7, neither of which this phase fixes. ⛔ **A gate that is red from the day it ships is a gate that
  cannot pass, and one that fails on the steady state is one people learn to skip.**
  ⛔ **Not chosen — pinning the WARN set.** It would catch a regression the level rule misses, but
  `SEED-274` was planted the day before precisely about a baseline treated as a stable property when
  it was not.

- **D-248-15: `check-deploy-drift.sh` prints a one-line reminder naming
  `check-security-advisors.sh`** when a migration or a security-bearing file is in the diff.
  **Why:** the honest limitation of D-248-12 is that the gate only fires if the operator runs it. The
  drift script already runs in CI on every push and is what an operator sees at promotion time, so
  this puts the prompt where attention already is, at zero credential cost.
  ⚠ **The limit is still real and must be written into the verdict:** CRED-04 ships as an
  **operator-run** check. The requirement's phrase *"cannot silently skip"* slightly overclaims, and
  saying so is cheaper than letting a future reader believe otherwise.

### Claude's Discretion

- Exact wording of the CRED-01 422 message and the CRED-02 reset label (both must satisfy their
  stated constraints: name which field takes a secret; state a forward action, not a past choice).
- Plan decomposition and wave structure, subject to **G-8: target 3–5 plans**; above 6 requires a
  named justification in this file.
- Whether the CRED-01 shape check is a shared validator or three call sites (one home for the rule
  either way — a literal copied into a second file makes its fence vacuous).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase inputs — read first
- `.planning/phases/248-the-credential-boundary/248-MEASUREMENTS.md` — the production ACL
  measurement pack (read-only, no write attempted, no exploit run). Carries the three-group split,
  the trigger-vs-helper cut, and the deliberately-empty baselines section.
- `.planning/ROADMAP.md` → *Phase 248* — goal, 4 success criteria, Flags (the `PUBLIC` trap, the
  service-role blind spot, the G-5 list, migration slot 181).
- `.planning/REQUIREMENTS.md` §CRED-01..04 — ⚠ its CRED-02 citation (`BUG-260828-02`) resolves to the
  WRONG file; see Deferred.

### The bugs this phase closes
- `.planning/reported-bugs/BUG-260907-02-custom-client-id-accepts-a-secret-into-a-readable-column.md`
  — CRED-01. Carries the SHA-256 confirmation, the `resolve_client_credentials` reason the paste was
  invisible, and the "rotate, don't just clear" instruction.
- `.planning/reported-bugs/grant-override-marker-claims-a-person-changed-it.md` — CRED-02 (id
  `BUG-260828-02`). Names both honest repairs and the behaviour-change caveat on the second.

### The precedent migration — the method to reproduce
- `supabase/migrations/177_rls_app_settings_user_settings.sql` — ⭐ **the model for 181.** Its header
  is the caller trace, the "why revoking is safe" section, the deliberate narrow scope, and the
  sentence that makes 248 exist: *"That sweep is its own piece of work."* Also records that the three
  search RPCs self-authorise on `auth.uid()`.
- `supabase/migrations/150_*` — why `custom_client_secret` was removed from `config`; the rule
  `config` holds ids, never secrets.
- `supabase/migrations/128_connector_connection_posture.sql` §3 — the `tool_grants` backfill that
  wrote the grants no person set.

### Code homes
- `backend/app/models/connector.py` — `:244` `McpConfig`, `:351` `OAuthConnectionConfig`, `:558`
  `OAuthAuthorizeRequest`; the docstring recording the `config` vs `secret_ciphertext` grant
  measurement; the `NonEmpty` / `ServiceId` validator precedent at `:88` / `:130`.
- `backend/app/services/oauth_service.py` `resolve_client_credentials` (`:244`) — requires BOTH
  custom values, which is why the paste had no visible consequence.
- `frontend/src/components/settings/grantsVocabulary.ts` `:28-39` — the noise-audit comment and the
  now-empty `OVERRIDDEN_LABEL`.
- `frontend/src/components/settings/ActionRow.tsx` `:95` — the surviving affordance.
- `frontend/src/components/settings/ConnectionGrantsList.tsx` `:29` — `resolveItemPosture`;
  ⛔ Invariant 8 forbids `title` attributes outright (a tooltip is unreachable by touch and keyboard).
- `scripts/check-deploy-drift.sh` — the header/strict-bash/exit-code shape to copy for
  `check-security-advisors.sh`; also the host for D-248-15's reminder line.
- `docs/DEPLOYMENT-WORKFLOW.md` §5 (parity checklist) and §6 (pre-promotion checks).

### Seeds and standing rules in the blast radius
- `.planning/seeds/SEED-239-one-malformed-config-row-makes-every-connection-in-the-org-unreadable.md`
  — `status: planted`, severity high. **Its trigger fires here:** *"ANY migration adds, renames or
  moves a key inside `connector_connections.config`"* and *"any config model's `extra='forbid'` is
  reconsidered."* D-248-06 avoids it deliberately; D-248-03 must not re-enter it.
- `.planning/seeds/SEED-274-*` — the backend ceiling of 71 is not a stable property (71/72/72/77 on
  one tree). ⚠ If the backend baseline reads above 71, read this BEFORE attributing it to the diff.
- `CLAUDE.md` → *Supabase MCP — reads are free, WRITES ARE APPROVAL-GATED*; *Deployment-artifact
  parity (same-commit rule)*; the migration discipline (SQL editor, then
  `bash scripts/regenerate-full-schema.sh`, never `db push` / `db reset`).
- `docs/HOT-FILE-LEDGER.md` — read each touched file's section before planning. ⚠ Three files in the
  likely blast radius have NO ROW (see Deferred).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`NonEmpty` / `Port` / `ServiceId` (`connector.py:88-130`)** — the `Annotated` +
  `AfterValidator` pattern the CRED-01 validator should follow. The module header already states the
  posture the fix completes: the per-capability models exist so *"a password key in `config` is
  UNCONSTRUCTABLE rather than merely discouraged."* **`custom_client_id` is the gap in that posture.**
- **`GRANTS_COPY` (`grantsVocabulary.ts`)** — one copy table for the whole grant surface, already
  the single home. D-248-06 is a one-constant change there.
- **`check-deploy-drift.sh` / `pending-cloud-migrations.sh`** — an established script shape (why/usage
  header, strict bash, non-zero exit on drift) to clone rather than invent.
- **Migration 177's header** — a worked example of the caller trace D-248-09 requires.

### Established Patterns
- **Model is the gate, panel is the kindness** — recorded in `connector.py` for `NonEmpty` on
  `host` / `from_address`. D-248-02 rides it.
- **`_StrictBase` / `extra='forbid'` on every config model** — this is why an unexpected key makes a
  row match NO member of the `ConnectorConfig` union. See SEED-239.
- **A row is validated inside a list comprehension** (`connector_service.list_connections:956`) — one
  bad row answers 503 for the whole org. Any CRED-01 change that could make an EXISTING row fail
  validation inherits that blast radius. ⛔ **This is why D-248-03 reports rather than refuses on
  read.**
- **Same-commit sync rules** — `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`, and the
  deploy-artifact parity rule that binds any new env var to `deploy/onebox.env.example` +
  `OMITTED_FROM_ONEBOX`. D-248-13 introduces an env var and is bound by the second.

### Integration Points
- `OAuthAuthorizeRequest` (`:558`) is the **front door** — it carries `custom_client_id` AND
  `custom_client_secret` side by side. That adjacency is the mechanism of the bug, and it is the one
  place the 422 has the most value.
- `McpAuthDoor.tsx:161` / `:185` writes `custom_client_id` on a second path — the MCP BYO door. Any
  validator change must be driven against **both** doors, or the phase ships a refusal that breaks
  Phase 222's registration flow.
- RLS policies across `supabase/full-schema.sql` call `current_user_org_ids` (147 mentions) and
  `current_user_has_permission` (21). These are the highest-blast-radius entries in the CRED-03 set.

</code_context>

<specifics>
## Specific Ideas

- **The fixture is the deliverable that outlives the phase.** D-248-04's two-role connection
  (`anon` + `authenticated`) is the instrument this project has never had. Every gate reads through
  the service role; that is a named, measured, twice-burned blind spot. Build it once and let CRED-03
  reuse it.
- **Reproduce 177's voice in 181.** Not as style — as function. Its header is why this session could
  answer questions about the three search RPCs without re-deriving them.
- **Say the limits out loud in the verdict:** production still reads 13/13 until the cloud apply
  (D-248-11); CRED-04 is operator-run, not unskippable (D-248-15); the credential-smell rule does not
  catch an id-shaped secret (D-248-01).

</specifics>

<deferred>
## Deferred Ideas

- ⛔ **`backend/app/api/connectors.py` — extraction OWED at its SIXTH landing** (2051→2071→2091→2102
  →2113→2140). Phase 247 fenced it at **ZERO lines** and it held. **If 248 must land there, the
  extraction is proposed FIRST** (G-5). Prefer a plan shape that does not touch it at all.
- ⛔ **Three files in the likely blast radius have NO hot-file ledger row** — re-derived 2026-09-14:
  `frontend/src/components/settings/ActionRow.tsx` (1/1/160),
  `frontend/src/components/settings/ApplicationGroup.tsx` (2/1/259),
  `backend/app/services/oauth_service.py` (6/2/418). None fires G-5, but
  `scripts/check-hot-file-ledger.cjs` FAILS on a `files_modified` entry with no row. **Add rows AT
  TOUCH** — an absent row is invisible to G-5 at any count (the `settingsSearchPayload.ts` precedent).
- ⚠ **REGISTER DEFECT — two different bugs share the id `BUG-260828-02`:**
  `BUG-260828-02-no-authoring-surface-can-declare-a-workflow-input.md` (`status: closed`, folded into
  214.1) and `grant-override-marker-claims-a-person-changed-it.md` (`status: open`, minor).
  **REQUIREMENTS.md's CRED-02 citation resolves to the CLOSED, wrong one.** Two further duplicate ids
  exist: `BUG-260528-01`, `BUG-260906-01`. → **Phase 251 (Register Integrity, REG-01/REG-02)** is the
  natural home; fix the CRED-02 citation in-phase as a one-line correction since 248 depends on it.
  ⭐ **RESOLVED AT PHASE 252 Plan 01 (D-36), two phases after this note found it** — the open
  grant-override report is now `BUG-260828-11-grant-override-marker-claims-a-person-changed-it.md`
  and the closed workflow-input report keeps `-02`, because it is the one that is cited (in
  `v3.9-ROADMAP.md`, three `214.1-*` artifacts and eight source/test files). ⚠ `BUG-260528-01` and
  `BUG-260906-01` are still duplicated — named here so they stay re-openable.
- **The 3 `rls_enabled_no_policy` INFO findings** (`app_settings`, `operator_audit_log`,
  `operator_users`). ⚠ Migration 177 states the last two are deliberately fail-closed by Phase 146's
  design and that giving them policies would **weaken** them. Out of scope; if ever revisited, the
  output is a written refusal, not a change.
- **The `ConnectionShapeFields.tsx` seam** on `ConnectionFormPanel.tsx` — still owed after 239-08
  took the narrower `SourceToolsCard.tsx` extraction. Not this phase.
- **`function_search_path_mutable` ×7 and `extension_in_public` (vector)** — standing WARN findings.
  D-248-14 deliberately lets them pass. Separate work.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.60) — matched on generic keywords only
  (*human, run, 2026, first, schema*). NL→workflow authoring has no overlap with the credential
  boundary. **Reviewed, not folded.**

</deferred>

---

*Phase: 248-the-credential-boundary*
*Context gathered: 2026-09-14*
