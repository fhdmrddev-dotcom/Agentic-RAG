# Phase 248: The Credential Boundary - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 248-the-credential-boundary
**Areas discussed:** CRED-01 refusal rule, CRED-02 changed scope, CRED-03 the 13 functions, CRED-04 enforcement

---

## Measured before questions were written

Five findings were driven against the tree and production before the first question, and three of
them changed what was worth asking:

| # | Finding | Effect on the discussion |
|---|---|---|
| 1 | `OVERRIDDEN_LABEL` is `""` (`grantsVocabulary.ts:38`, deleted at `e615c0dad`) — CRED-02's headline defect is **already fixed** | The CRED-02 question became *"is the requirement met, or did the dishonesty move?"* rather than *"how do we reword it?"* |
| 2 | Production also reports `authenticated_security_definer_function_executable`, **same 13 functions** | Added the scope question CRED-03 does not ask |
| 3 | `custom_client_id` has **three** homes; `McpConfig`'s is RFC 7591 dynamically registered (`bD78Ksp3xBJew1kL`) | Made a positive shape rule breaking, not merely strict |
| 4 | `get_advisors` appears in **zero** scripts and **zero** docs | Confirmed CRED-04 genuinely unmet |
| 5 | Two different bugs share id `BUG-260828-02`; REQUIREMENTS.md's CRED-02 citation resolves to the closed one | Recorded as a register defect, routed to Phase 251 |

---

## CRED-01 — the refusal rule

### Q1 · What shape is refused?

| Option | Description | Selected |
|--------|-------------|----------|
| Credential-smell, everywhere | One negative rule on all three homes — refuse values that look like a secret. Never breaks MCP's opaque ids. Weakness: a secret shaped like an id still passes | ✓ |
| Positive shape where the provider is known | Microsoft ⇒ GUID, Google ⇒ `.apps.googleusercontent.com`; credential-smell for MCP only. Each new provider needs a shape written | |
| Both, layered | Smell as the floor, positive shape on top. Most protective; two rules to keep in sync | |

**User's choice:** Credential-smell, everywhere.
**Notes:** The MCP BYO door (Phase 222) is the binding constraint — its id is minted by the server and has no knowable shape.

### Q2 · Where does the refusal live?

| Option | Description | Selected |
|--------|-------------|----------|
| Model + panel | Pydantic validator is THE gate (422 naming the mistake, so `curl` is refused too); panel repeats the sentence inline | ✓ |
| Model only | One place to get right; the person meets it as a failed save rather than inline | |
| Model + panel + live paste warning | Best felt experience; adds state and a debounce to a file whose wider seam is already owed | |

**User's choice:** Model + panel.
**Notes:** Matches the `NonEmpty` posture already recorded in `connector.py` — model is the gate, panel is the kindness. No new pattern invented.

### Q3 · Existing bad rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Detect and report, never auto-clear | Migration names any failing `config->>'custom_client_id'` so an operator knows which connection to rotate | ✓ |
| Nothing — new writes only | Cheapest; an install that already took a paste keeps a live secret with nothing saying so | |
| Detect, report, AND null the key | Stops the readability immediately; erases the only signal a rotation is owed | |

**User's choice:** Detect and report, never auto-clear.
**Notes:** A failing value is a credential to rotate, not just a bad row — clearing is not sufficient because the secret is already burned.

### Q4 · What does the non-service-role assertion assert?

| Option | Description | Selected |
|--------|-------------|----------|
| A real second connection, as `anon` AND as `authenticated` | Asserts `authenticated` CAN read `config` and CANNOT read `secret_ciphertext`; `anon` gets nothing. CRED-03 reuses the fixture | ✓ |
| `has_column_privilege` assertions only | Cheap and exact about grants; tests the ACL, not a request | |
| PostgREST over HTTP with the anon key | Closest to the real attack; needs local Supabase up, slower and more fragile | |

**User's choice:** A real second connection, as `anon` and as `authenticated`.
**Notes:** Builds the instrument the project has never had — the blind spot that hid `BUG-260911-01` from every gate.

---

## CRED-02 — the marker that overclaims

### Q1 · Is the requirement already met?

| Option | Description | Selected |
|--------|-------------|----------|
| The affordance is the defect — fix it | `grantsVocabulary.ts` states the reset's *mere presence carries exactly what the tag spelled out*; deleting the tag moved the dishonesty rather than removing it | ✓ |
| Already met — record the discharge | The marker is gone; spend the phase on CRED-01/03/04 | |
| Make the marker mean "differs from the default" | A behaviour change, not copy — it would also hide the reset on a row a person genuinely set | |

**User's choice:** The affordance is the defect — fix it.

### Q2 · What is the fix?

| Option | Description | Selected |
|--------|-------------|----------|
| Reword to what is known | A forward action ("Follow the default instead"), not an undo. One constant in `grantsVocabulary.ts`; zero behaviour change, zero schema | ✓ |
| Record authorship, then the marker can be true | Honest instead of avoided — but a jsonb shape change on `tool_grants`, which is SEED-239 territory | |
| Show it always, on every row | Cheapest; on a 44-action list it is the noise the 2026-08-31 audit deleted | |

**User's choice:** Reword to what is known.

### Q3 · How is the reword fenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Assert the rendered content, not block presence | Render `ActionRow` in both states; assert the visible words and that nothing claims a person acted | ✓ |
| Pin the copy constant plus a negative sweep | Cheap, catches duplication; is exactly the value-pinning already recorded as insufficient alone | |
| Both | Real fence plus a cheap second net; more to maintain | |

**User's choice:** Assert the rendered content.
**Notes:** Phase 235's finding — a green presence fence by `data-testid` coexisted with the shipped defect because the content drifted underneath it.

---

## CRED-03 — the 13 functions

### Q1 · Does the ruling cover both advisor lints?

| Option | Description | Selected |
|--------|-------------|----------|
| Both — you cannot rule on one without the other | `REVOKE … FROM PUBLIC` covers both roles at once, so what `authenticated` gets back must be decided regardless. `current_user_org_ids` appears 147× in the schema | ✓ |
| `anon` only — hold the requirement's line | Scope discipline; leaves the second lint standing at 13 after the phase closes | |
| Both, plus the 3 RLS INFO findings | 177 says two of the three are deliberately fail-closed and "fixing" them would weaken them | |

**User's choice:** Both.

### Q2 · How is "no outage" proved?

| Option | Description | Selected |
|--------|-------------|----------|
| Trace each function to its caller, in writing, before the migration | 177's own method — frontend grep, service-role path, `get_user_supabase()` named by file and line | ✓ |
| Revoke, then drive the app as a signed-in user | Catches what a trace misses; absence of a visible break is weak evidence | |
| Both — trace first, then drive | Most expensive; the only combination where a wrong trace is caught before cloud | |

**User's choice:** Trace each function to its caller, in writing.
**Notes:** 177's warning is the phase's principal risk — *revoking without tracing every caller would trade a config exposure for an outage.*

### Q3 · Where does the per-function ruling live?

| Option | Description | Selected |
|--------|-------------|----------|
| In the migration itself | A comment block per function, exactly as 177 does. Ships with the change that enacts it and cannot drift from it | ✓ |
| A phase register file + a thin migration | Easier to diff as a list; a register nobody re-reads is the same as no fact | |
| Both, under the same-commit sync rule | Two homes to keep honest; the pattern is already used elsewhere | |

**User's choice:** In the migration itself.

### Q4 · Where does SC#3's advisor re-run happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Local re-run closes the phase; cloud is a separate operator-approved step | Keeps closure independent of a production write and of the operator being at a keyboard | ✓ |
| Phase does not close until production is re-run | Strongest proof; makes closure depend on an operator action | |
| Local re-run plus a direct production ACL read | Free and catches drift in the before-state; does not prove the after-state | |

**User's choice:** Local re-run closes the phase.
**Notes:** The verdict must SAY production still reads 13/13 until the cloud apply — silence would read as a claim that it does not.

---

## CRED-04 — the deploy-checklist step

### Q1 · What is the mechanism?

| Option | Description | Selected |
|--------|-------------|----------|
| A script in §6 pre-promotion checks, run by the operator | Sibling of `check-deploy-drift.sh`; runs where the credential already is | ✓ |
| A CI job that fails the promotion | Genuinely unskippable; needs a long-lived production-read PAT as a repo secret | |
| A checklist line in §5 only | Zero new credentials; is the "rule that exists and is not applied" shape | |

**User's choice:** A script in §6, run by the operator.
**Notes:** The CI arm was declined on the trade — adding a standing production credential to close a credential-boundary phase.

### Q2 · What does the script call?

| Option | Description | Selected |
|--------|-------------|----------|
| The Management API with a token from env | `GET /v1/projects/{ref}/advisors/security`; same data the MCP returns | ✓ |
| Run the linter SQL directly against the DB | No token, works against LOCAL; a vendored third-party query rots silently | |
| Neither — the script checks the checklist was answered | Gates on an assertion rather than a measurement | |

**User's choice:** The Management API with a token from env.
**Notes:** ⚠ Measured afterwards: `app_settings.supabase_management_token` is **NULL in production**, so the existing column is not a viable source — the token must come from an env var, which binds the change to the deploy-artifact parity rule.

### Q3 · What makes it fail?

| Option | Description | Selected |
|--------|-------------|----------|
| ERROR fails; WARN prints and passes | ERROR is the level that caught `BUG-260911-01`. A gate that fails on the steady state is one people learn to skip | ✓ |
| ERROR fails, and WARN fails if the SET changed | Catches regressions; needs a baseline, and SEED-274 was planted the day before about exactly that | |
| Any finding at all fails | `extension_in_public` and `function_search_path_mutable` ×7 would make it red from day one | |

**User's choice:** ERROR fails; WARN prints and passes.

### Q4 · Does anything reduce the skip risk?

| Option | Description | Selected |
|--------|-------------|----------|
| Name it in §6 and have the drift script mention it | `check-deploy-drift.sh` already runs in CI and is what an operator sees at promotion; zero credential cost | ✓ |
| Nothing — accept it and write the limit down | Honest and cheap; the requirement's wording then overclaims | |
| Wire it into CI after all | Reverses the earlier call and re-opens the declined trade | |

**User's choice:** Name it in §6 and have the drift script mention it.
**Notes:** The limit is still real and goes in the verdict — CRED-04 ships as an operator-run check, so *"cannot silently skip"* slightly overclaims.

---

## Claude's Discretion

- Exact wording of the CRED-01 422 message and the CRED-02 reset label, within their stated constraints.
- Plan decomposition and wave structure, subject to G-8 (target 3–5 plans).
- Whether the CRED-01 shape check is a shared validator or three call sites.

## Deferred Ideas

- `backend/app/api/connectors.py` extraction, owed at its sixth landing — 247 fenced it at zero lines.
- Ledger rows missing for `ActionRow.tsx`, `ApplicationGroup.tsx`, `oauth_service.py` — add at touch.
- Duplicate bug ids (`BUG-260828-02`, `BUG-260528-01`, `BUG-260906-01`) → Phase 251 (Register Integrity).
- The 3 `rls_enabled_no_policy` INFO findings — out of scope; 177 says two are deliberately fail-closed.
- The `ConnectionShapeFields.tsx` seam on `ConnectionFormPanel.tsx`.
- `function_search_path_mutable` ×7 and `extension_in_public` — standing WARNs, deliberately passed.

### Reviewed Todos (not folded)

- `spike-nl-workflow-authoring.md` (score 0.60) — matched on generic keywords only; no overlap with the credential boundary.
