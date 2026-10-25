---
phase: 293-start-from-outside-and-close-out
plan: 05
subsystem: inbound-door close-out / docs / live proof / seeds register
tags: [api-keys, inbound, docs, live-uat, g-4, reg-06, seeds, ledger]
base: 77a1c6188c9b0cdb3800d8aed838dfb663a696e9
phase_base: 5724f42273bed67ac26699f0ef0b5dfed897c126
requires: [293-01, 293-02, 293-03, 293-04]
provides:
  - "public docs tell the truth about API keys; new guide api/guides/start-a-workflow-from-outside"
  - "scripts/drive-293-inbound.py: live SC#1-5 + SC#10 driver, secrets from env, redacted evidence"
  - "inbound_inputs.inbound_kickoff (key runs, enveloped) and launch_kickoff (in-app runs, plain lines)"
  - "check-seeds-register.cjs --require-settled <ids> + self-test arms 6-7"
  - "293-VALIDATION.md: SC#1-6, SC#10 board, G-4 signed, D-1..D-5, F-1..F-5, three logged bugs"
affects: [294, 296]
tech-stack:
  added: []
  patterns:
    - "one kickoff helper per trust level, called at BOTH kickoff sites (214 MIRROR rule)"
    - "a scoped close-out gate arm (--require-settled) rather than a register-wide rule"
key-files:
  created:
    - docs/public/api/guides/start-a-workflow-from-outside.md
    - scripts/drive-293-inbound.py
    - backend/tests/unit/test_293_app_kickoff.py
    - .planning/phases/293-start-from-outside-and-close-out/293-VALIDATION.md
    - .planning/phases/293-start-from-outside-and-close-out/deferred-items.md
    - .planning/phases/293-start-from-outside-and-close-out/evidence/
    - .planning/reported-bugs/BUG-261025-01-schedule-run-now-gives-no-visible-feedback.md
    - .planning/reported-bugs/BUG-261025-02-evidence-report-title-crushed-by-four-buttons.md
    - .planning/reported-bugs/BUG-261025-03-expired-ask-cards-while-run-still-waiting.md
  modified:
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.public.json
    - docs/public (authentication, overview, chat-from-a-script, roadmap, get-started, egress, secrets, limits-and-spend, settings/api-keys, README, sections.json)
    - frontend/src/docs/pages/ApiReference.tsx
    - frontend/src/docs/__tests__/ApiReference.test.tsx
    - frontend/src/docs/__tests__/publicOpenapi.test.ts
    - backend/app/services/inbound_inputs.py
    - backend/app/api/inbound.py
    - backend/app/api/threads.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/db/api_keys.py
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - scripts/check-seeds-register.cjs
    - .planning/seeds (SEED-163, -195, -014, -232, -084, -164, -183, -086, -155)
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "293-05: F-1 operator ruling (b): a key run's declared values reach the first AI step through the kickoff, each inside the untrusted envelope"
  - "293-05: D-3 operator ruling: an in-app run's kickoff carries the declared values as plain key: value lines (owner is trusted, no envelope)"
  - "293-05: SC#10's 7 non-active-provider rows accepted as ⛔ by the operator: key runs use the active provider, like schedules; the full roster is owed at deploy"
  - "293-05: F-2 (no live ThreadRunLine for unattended runs) deferred; re-opens with ThreadRunLine.tsx or StreamsProvider.tsx"
  - "293-05: a key's owner and revoker are named by sign-in email when the profile has no display name"
requirements-completed: [START-02, START-04, REG-06]
duration: ~2 h 30 min across four checkpoints
completed: 2026-10-25
---

# Phase 293 Plan 05: Close out: docs, live proof, G-4, seeds Summary

**The public docs now describe the two ways in. SC#1-5 were proven live with real keys made through the UI. The operator signed G-4. Five defects found while driving were fixed test-first. The 13 intake seeds are settled, and a new gate arm proves it.**

BASE: `77a1c6188c9b0cdb3800d8aed838dfb663a696e9` · PHASE_BASE: `5724f42273bed67ac26699f0ef0b5dfed897c126`

## Task commits

| Task | Commit | Message |
|---|---|---|
| 1 | `723807d36` | docs: the docs stop saying the app has no API keys (17 files, one commit) |
| 2 D-1 | `e835be507` → `99dd153a8` | launch fields from a definition stored as a JSON string |
| 2 D-2 | `30cb57c2c` → `343c023ae` | a key read of a run waiting on a person says `waiting_for_person` |
| 2 | `4a3815f22` | guide: where a key run's values went (superseded by F-1 b) |
| 2 | `e0cd53cd8` | driver, VALIDATION.md, evidence, deferred items |
| 2 F-1 (b) | `edd57308f`, `61ea70084` → `6afadff92` | a key run's values reach its first AI step, enveloped |
| 2 F-1 (b) | `8f39dfecd` | SC#1 / SC#4 re-drive; operator rulings recorded |
| 2 D-3 | `df269cad9` → `88fd5ad58` | an in-app run's launch values reach its first AI step (+ ledger rows) |
| 2 D-3 | `9e4f2b929` | D-3 live re-drive; G-4 steps 1-2 signed |
| 3 D-4 | `b00ffbfb7` → `7583298e6` | key owner/revoker named by email when unnamed |
| 3 D-5 | `4e0f95d26` → `b8aed8884` | a stopped run's origin and stop reason on separate lines (+ ledger rows) |
| 3 | `26bb2a730` | G-4 signed; D-4/D-5 live re-checks; three bugs logged |
| 4 RED | `fe04f668b` | self-test arms 6-7 for `--require-settled` |
| 4 GREEN | `60759ce81` | `--require-settled` arm |
| 4 | `f0fc881f4` | the 13 intake seeds settled |
| 4 | `798a3162b` | ledger re-derived for every source file 293 touched |

## Task 1: the docs

- **Pre-edit grep.** The planned grep hit these files:
  - `authentication.md:10,17`
  - `chat-from-a-script.md:12`
  - `api/overview.md:12`
  - `roadmap-open-platform.md:2`
  - `get-started/overview.md:49`
  - `README.md:25,83`
  - `egress-controls.md:56`
  - `ApiReference.tsx:108-110`
  - `ApiReference.test.tsx:3,35`
  - `publicOpenapi.test.ts:66`
  - `build-public-openapi.cjs:52`
- **Post-edit grep.** It hits only:
  - the `NO_KEY` sentence, which describes a single call, not a claim about the app;
  - the connector-schema comment in the snapshot.
  
  `has no API keys|no API keys today` returns nothing.
- **Spec check.** `components.securitySchemes.ApiKey` carries a description, and `/inbound` start and read use `[{"ApiKey": []}]`. `GET /inbound/files/{token}` has no `security`. That is by design: the one-time link is the credential, so the plan's assertion was narrowed to exclude that route.
- **Gates.** Docs coverage OK; `build-public-openapi --check` OK; `vitest src/docs` 17 files / 136 tests.

## Task 2: live proof (`293-VALIDATION.md`)

- **SC#1-5 all PASS live.** Evidence is in `evidence/`, with every secret redacted to its 13-character prefix. A HEAD-wide `git grep` for each of the six full secrets finds nothing.
  - **SC#1:** run `4ab828a3`. After F-1 (b) it was re-driven as run `33e267b6`, and the brief is about the topic sent.
  - **SC#2:** 12/12 checks pass. All seven 404 bodies are byte-identical.
  - **SC#3:** 11 concurrent starts gave 10 × 201 and 1 × 429 with `Retry-After: 57`. The Redis counter read 11. There were 76 audit rows, none containing a secret.
  - **SC#4:** run `46059c53`, re-driven as `7bf14e52`. The snapshot grants equal the published definition, and every value reached the model inside the envelope.
  - **SC#5:** key, schedule and old-run origins all checked.
- **SC#10 board:**
  - DeepSeek, the active provider, passes, as do the multi-tool, parallel-thread and long-message (7,000-byte) rows.
  - The other 7 provider rows are ⛔. The operator accepted this on 2026-10-25: a key run uses the operator's active provider, as a schedule run does.
  - The full roster stays owed at deploy.
- **Two workers.** The running backend is `uvicorn --reload`, a single worker. The limiter's counter lives in Redis, so it is shared across workers by construction. This is recorded as an OBSERVATION.

## Task 3: G-4 (signed 2026-10-25)

- **Steps 1-2:** signed by the operator.
- **Steps 3-6:** driven by the orchestrator in Chrome with the operator watching; all PASS.
- **Chat surface (293-03 branch B, ThreadRunLine):** the stopped key run `1e932094` reads "⊘ Stopped by you · 1 of 3 steps · 1h 41m 🔑 Started by key 293-A-brief". The key icon separates the two parts; the operator accepted this.
- **Audit browsers:** both word the `api_key.*` rows under an "API keys" group, and no raw `api_key.` text appears on either page.

## Task 4: seeds and ledger

### Seeds gate before any edit

- Plain scan: OK. 381/381 parsed. 130 seeds have no trigger at all; 113 have a prose trigger but no structured one.
- `--phase 293`: OK, with 43 triggers firing.

### The `--require-settled` arm

- RED was observed: self-test 8/10, with arms 6 and 7 reporting "requireSettled is not implemented". Without the arm, `--require-settled SEED-163,SEED-195` exited 0.
- After GREEN, before the seed edits: `--require-settled SEED-163,SEED-195` exited 1 with:
  - `[still-planted] SEED-163`
  - `[still-planted] SEED-195`
  - `[no-destination] SEED-195`
- An empty list exits 2.
- After the seed edits:
  - the 13-id run reports "all 13 settled";
  - the plain scan is OK;
  - the self-test passes 10/10.

### Seed edits

Only frontmatter was edited, and every body is md5-identical before and after:

| Seed | Change | Body md5 (before = after) |
|---|---|---|
| SEED-163 | `shipped`, `folded_into: "193.2"`, note "delivered in 193.2; the visible-mark sliver stays owed" | `f5b9850a37a6dd65a8f9140c7d41a27d` |
| SEED-195 | `partially-answered`, `partial: true`, `folded_into: "293"` | `9232e56f573fc5f239b55f730b038f20` |
| SEED-014 | `partially-answered`, `partial: true`, `folded_into: "204, 293"` | `4f9bf204da9c7b0bff9cf7b5571d83f8` |
| SEED-232 | kept `shipped`; added `folded_into: "287"` | `daad1a8cab31fc6c66b2512d0248557f` |
| SEED-084 | kept `shipped`; added `folded_into: "287"` | `0921730da56988fd08631758c57f8147` |
| SEED-164 | kept `partially-answered`; added `folded_into: "288"` | `b285fb5f3184cdbf74ebeab27fc3e8b1` |
| SEED-183 | kept `answered`; added `folded_into: "288"` | `f6e0c89914c1e27d0ee1af734c052589` |
| SEED-086 | `folded` → `partially-answered` (authoring picture shipped in 290; the live view stays open) | `737b199bba1c0cafa1f9362a3ceb518c` |
| SEED-155 | `folded` → `partially-answered` (card chip line shipped in 290; toolbar and counter stay open) | `6c69abb0374bdaaa739df9c524e133db` |

SEED-051, -337, -348 and -152 were read and already settled, so they are unchanged. SEED-197 and -297 were not touched and are not flagged.

### `--phase 293` after the edits

The same 43 triggers fire. Every one is **left**, and no seed outside the 13 intake ids was flipped. Most fire on broad `frontend/src/components/**` globs. The ones relevant to this phase's scope:

| Seed | What | Disposition |
|---|---|---|
| SEED-188 | Injection discipline untested | 293 adds `test_293_untrusted_fence` and the SC#4 live drive for the inbound channel. **Leave**: the seed spans four modules. |
| SEED-311 | Tier-gate false reasons | 293-02 stamped the org on unattended threads. **Leave**: the other arms are open. |
| SEED-341 | Schedules off by env | **Leave**: not in 293's scope. |
| SEED-363 | Lifespan test hazard | The 293 tests never enter the app lifespan. **Leave**. |

### Ledger

The 64 non-test source files changed since PHASE_BASE were re-derived with the recipe. In the scan list, 62 rows had drifted and were updated. In CLAUDE.md, 8 FIRING rows were updated and each verdict names the 293 touch (≤ 80 characters). The old cells are kept verbatim in `docs/HOT-FILE-LEDGER.md` §"Phase 293 close". `check-hot-file-ledger 293` and `check-claude-md-size` are both OK (99,163 characters).

## Deviations and defects found (all fixed test-first, RED observed failing for the right reason)

1. **D-1 [Rule 1]:** the key form showed no launch fields for 230 of 258 published workflows, because their definitions are stored as JSON strings.
2. **D-2 [Rule 1]:** a key read of a run waiting at a human-input step said `running`.
3. **F-1 → operator (b):** key-run values never reached an AI step, which saw only "Run <name>". They now arrive through `inbound_kickoff`, enveloped.
   - The first RED commit failed on a syntax error: a shell heredoc turned `\n` into real newlines.
   - Its literals were fixed in `61ea70084`. It was then confirmed failing on the missing import, before GREEN.
4. **D-3 (operator: "fix it"):** an in-app run with an empty task box had an empty kickoff.
   - `launch_kickoff` builds it now and is called at both kickoff sites.
   - `test_dual_mode_wiring`'s source pin was retargeted on purpose. Its failing set is otherwise identical to base: 22, the inherited failures in `tests/test_dual_mode_wiring.py` and `tests/test_thread_workflow_endpoint.py`.
5. **D-4 (G-4 step 5):** every key's owner read "an unknown member". Owner and revoker names now fall back to the sign-in email.
6. **D-5 (G-4 step 3):** a stopped run's report ran the origin line and "Why it stopped:" together. They are now one `flex-col` column, and the test asserts the order of its children.
7. **Spec assertion narrowed** to exclude the file route (see Task 1).
8. **`limits-and-spend.md`** was also corrected. It claimed "no HTTP rate limits", so Task 1's commit holds 17 files rather than 16.
9. **The driver's first SC#3 burst** was sequential. Each start takes about 4.2 s, so the burst straddled a minute boundary and all 11 were admitted, which is correct for a fixed window. The second burst ran concurrently. Both are kept as evidence (F-3).

## Findings and logged bugs (not fixed here)

- **F-2 (deferred by the operator):** a live unattended run shows no ThreadRunLine. It re-opens with the next phase that touches `ThreadRunLine.tsx` or `StreamsProvider.tsx`.
- **F-3:** a start takes about 4 s (an observation).
- **F-4:** a step pinned to another provider's model is sent to the active provider and refused. Pre-existing.
- **F-5:** deleting a draft that has a trial run returns 500. Pre-existing; logged in `deferred-items.md`.
- **Logged bugs:**
  - **BUG-261025-01:** Run now gives no visible feedback.
  - **BUG-261025-02:** the evidence report's title is crushed by four buttons. Pre-existing from `97c87e86a` (289-04).
  - **BUG-261025-03:** a waiting run shows expired ask cards while it still reads as waiting and Running.

## Owed at deploy (not executed; Supabase MCP not used)

1. Apply migration **215** to cloud **before** the backend deploys. Boot hard-fails without the `api_key.*` audit literals.
2. Run `get_advisors(security)`.
3. Run `scripts/check-deploy-drift.sh`. No new env var is expected.
4. Run the full SC#10 provider roster on the deploy target.
5. Run `/gsd:secure-phase 293` before the phase closes (D-29). The phase shipped as 5 plans (D-33).

## Phase-final gates

- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, run under the local-DB lock, which was released afterwards): **70 failed, 9855 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors**. The gate passed (70 ≤ 71). None of the 70 failing tests is a 293 file. Wave 3 measured 70 failed / 9843 passed.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, run once): **count gate OK**. Total 12102, 0 failing, 523/523 pinned files present, no per-file decrease. D-5 extended an existing case rather than adding one, so the total is unchanged from 293-03.
- **tsc** (`tsconfig.app.json`): **63 errors**, the same count every 293 plan measured at its base. None is in a file this plan wrote.
- **Targeted backend suites:**
  - 888 pass across the threads, kickoff, 214 and 293 suites;
  - 121 pass across the 293 inbound suites;
  - 44 pass in `test_293_api_keys_*`.
- **Seeds gate:** self-test 10/10, plain scan OK, and `--require-settled` reports all 13 settled.
- **Ledger and size gates:** `check-hot-file-ledger 293` OK; `check-claude-md-size` OK.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. D-4 adds a read of `auth.users.email` to the two key-list queries. This is the same exposure the org members roster already has: org admins see member emails, and members see the email of the admin who revoked their key.

## Self-Check

**PASSED.**
- Every file listed under key-files exists.
- All 23 commits in the table are present in `git log`.
- No full key secret appears in HEAD: checked by `git grep` for each of the six secrets and with the `srl_live_[A-Za-z0-9_-]{20,}` regex.
- Every key-secret file in the scratchpad folder (`keys.env`, `keys2.env`, `key*.json`) was deleted at plan end, and a grep of the folder finds no full secret. The permission system refused `rm -rf` of the whole folder, so redacted state, masked screenshots and helper scripts (which hold only the documented dev-only login) remain there.
