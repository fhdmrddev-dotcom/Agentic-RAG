# Requirements: Agentic RAG — v4.2 The Connected Knowledge You Can Actually Run

**Defined:** 2026-09-13
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Milestone goal:** the capability v4.0 built and v4.1 deployed becomes the surface you can live on —
the watch loop tells the truth, a credential cannot land in a readable column, and the model you want
to run registers itself.

---

## How this milestone was scoped — measured, not remembered

⭐ **Every requirement below closes a register entry that was DRIVEN against the current tree on
2026-09-13, not read from a status field.** That method is load-bearing here, because the same sweep
found three register entries that were wrong:

| Claim in the register | Measured 2026-09-13 | Consequence |
|---|---|---|
| `BUG-260911-01` `status: open`, **blocking** — prod `app_settings`/`user_settings` RLS off, `anon` holds all privileges | `rls_enabled = true` on both · `anon` absent from both ACLs · `resize_embedding_column` EXECUTE false for `anon` **and** `authenticated` · `get_advisors(security)` returns **zero ERROR** | **Already fixed.** Not scoped. Flip to `closed` |
| `BUG-260910-03` `status: open`, **blocking** — Settings → Search unsaveable | Fixed by `46292bb81` (Phase 242-02) — the tab sends only what CHANGED | **Already fixed.** Not scoped. Flip to `closed` |
| `BUG-260907-02` `status: open`, major — a client secret pasted into the client-ID field is stored readable org-wide | **STILL LIVE.** `custom_client_id` is bare `str \| None = None` at `connector.py` **244, 351, 558** — no pattern, no length bound, no shape check | **Scoped as `CRED-01`** |

⚠ **Two of the three registers were stale in the direction of "still broken", and one in the
direction of "fine".** A milestone scoped from status fields alone would have front-loaded two
non-problems and under-weighted a live credential leak. **Drive the claim before planning against it.**

**The open register at scoping:** 27 real `surface: Agentic-RAG` bugs (29 listed, minus the two
measured-fixed above, minus `TEMPLATE.md`), of which **14 are `major`**. Clusters:

| Cluster | Open | Scoped here |
|---|---|---|
| Sources / watches / connectors | **9** | 8 → `WATCH-*` · 1 (`BUG-260907-02`) → `CRED-01` |
| Chat / agent-loop / run-honesty | 7 | 4 → `HONEST-*` · 3 deferred (see Out of Scope) |
| Workflows / publish gauntlet | 5 | 0 — deferred whole (see Out of Scope) |
| Model registry / settings / admin | 4 | 3 → `MODEL-*` |
| Other | 2 | 1 (`BUG-260809-01`) → `MODEL-09` · 1 deferred |

---

## v4.2 Requirements

### Sources & Watches — the surface you now live on

The v4.0 watch loop reached production for the first time on **2026-09-13**. These are the eight
defects standing between "it shipped" and "you can rely on it".

- [x] **WATCH-01**: A file ingested from Google Drive carries `metadata.source.path`, so a watched
      document classifies and locates exactly like an uploaded one. *(`BUG-260913-01`, major — the
      adapter never writes it, so classification rules keyed on path silently never match.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#1 ✅ PASSED** (`status: complete`, `verification_mode: peer-reviewed`, builder gemini / reviewer claude, 5/5 criteria). `google_drive.py:_resolve_folder_path` resolves parent breadcrumbs relative to the watched root; `test_google_drive_list_files_populates_source_file_path` in `backend/tests/unit/test_247_source_paths.py`.
- [x] **WATCH-02**: A OneDrive / SharePoint folder path is stored whole — no truncation and no
      mismatch between the path shown and the path stored. *(`BUG-260910-04`, major — three defects
      found by the independent review of Phase 238, all shipped.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#1 ✅ PASSED.** `microsoft_graph.py`'s `_PATH_PREFIX` / `_folder_path` strip `/drive/root:`, `/drives/{id}/root:` and SharePoint site roots; `test_microsoft_graph_list_files_combines_path_cleanly`.
- [x] **WATCH-03**: A watch card reports the health of **the connection it rides**, not of its last
      run — a healthy connection whose last run failed, and a broken connection whose last run
      happened to succeed, both read correctly. *(`BUG-260909-03`, major.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#2 ✅ PASSED.** The discriminator is driven in BOTH directions — a healthy connection whose run 429'd reads `Connected` + `Run failed (429)`, a disabled connection whose run succeeded reads `Connection Off` — in `WatchedFoldersSection.test.tsx` plus the backend pair in `test_247_watch_missing_lifecycle.py`. ⭐ Both directions, which is the only shape that can catch the defect this requirement names.
- [x] **WATCH-04**: "Sync now" reports its result **in place** — the section it writes into stays
      open and the answer is readable without re-navigating. *(`BUG-260909-04`, major.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#3 ✅ PASSED.** `loadWatches(initial = false)` confines `loading` to initial mount; the named test is *"does NOT unmount or collapse the card when Sync now is clicked"*.
- [x] **WATCH-05**: A file that has gone missing at the source says **when** it went missing.
      *(`BUG-260909-05` — `missing_since` is declared and never written, so the column cannot answer
      the one question it exists for.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#4 ✅ PASSED.** `missing_since` is written on disappearance and cleared on reappearance with the H-5 structural-completeness guard preserved; `test_missing_since_recorded_on_disappearance` / `_cleared_on_reappearance`.
- [x] **WATCH-06**: An action labelled as a fix performs the fix; one that only navigates is labelled
      as navigation. *(`BUG-260909-06` — a button worded as a write that only changes page.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#4 ✅ PASSED.** `sourceHealthVocabulary.ts`'s `connection_disabled` action now reads `"Open ${connectionName} in Settings ↗"` — labelled as the navigation it performs, not as a fix it does not do.
- [x] **WATCH-07**: A timestamp is either absolute or relative, never both concatenated.
      *(`BUG-260909-07` — "Last read successfully on 8 min ago".)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#4 ✅ PASSED.** `COPY.lastGood` drops the preposition: *"Last read successfully 4m ago"*. `sourceHealthVocabulary.test.ts` 69/69.
- [x] **WATCH-08**: Each of Phase 240's seven open build-review warnings is closed, or explicitly
      accepted **with the reason written down**. *(`BUG-260910-02` — a warning list with no
      disposition is a deferral nobody can re-open.)*

      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/247-sources-and-watches/247-VERIFICATION.md` → SC#5 ✅ PASSED**, with the dispositions written down in `.planning/phases/247-sources-and-watches/247-DISPOSITION.md` — WR-04/07/09 resolved in code, WR-02/05/06/08 accepted as debt **with reasons**, WR-01/03 already closed at Phase 240 by `9e83203a2`. ⭐ *"Accepted with the reason written down"* is exactly what this requirement asks for, and it is what the artifact contains.
### The Credential Boundary

- [x] **CRED-01**: A credential pasted into a field that is not a secret field is **refused, not
      stored** — and the refusal names which field takes a secret. *(`BUG-260907-02`, major, driven
      live 2026-09-13. `config` is `SELECT`-able by `authenticated` org-wide while `secret_ciphertext`
      is not; a secret written to `config` is readable by every org member.)*
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/248-the-credential-boundary/248-VERIFICATION.md`** (`status: complete`, `verification_mode: peer-reviewed`, builder gemini / reviewer claude, 4/4 requirements passed). The negative credential-smell rule is enforced across all three `custom_client_id` homes (`McpConfig`, `OAuthConnectionConfig`, `OAuthAuthorizeRequest`) — a smell is refused **422**, an RFC 7591 dynamic id is permitted — and the dual-role DB permissions were driven under `SET ROLE authenticated` and `SET ROLE anon`. ⚠ **ONE UAT ROW IS OWED AND IS NOT CLAIMED HERE**: G-4 scenario **S2** (the `McpAuthDoor` BYO-OAuth path, live) is recorded ⛔ owed in `248-G4-UAT.md` with the re-open trigger *"next touch to McpAuthDoor or first real BYO OAuth server connection"*; S1 and S3 passed in a real browser. **The requirement is delivered and a row is owed — saying both is the point.**
- [x] **CRED-02**: The grant override marker claims only what the app can actually know — it does not
      assert a human author for a change the system cannot attribute.
      *(`.planning/reported-bugs/grant-override-marker-claims-a-person-changed-it.md`. ⚠ **CITATION
      CORRECTED 2026-09-14 at `/gsd:discuss-phase 248`** — this read `BUG-260828-02`, and **two
      different bugs carry that id**: the grant-marker one above, and
      `BUG-260828-02-no-authoring-surface-can-declare-a-workflow-input.md`, which is `status: closed`
      and folded into 214.1. The bare id resolved by filename to the CLOSED, WRONG one. Cited by path
      from here. Duplicate ids also exist for `BUG-260528-01` and `BUG-260906-01` → Phase 251.)*
      ⭐ **MEASURED 2026-09-14: the headline defect is already fixed and the requirement is not
      discharged.** `GRANTS_COPY.OVERRIDDEN_LABEL` is `""` (`grantsVocabulary.ts:38`, deleted at
      `e615c0dad`) — *"You changed this"* renders nowhere. What remains is the **affordance**:
      `ActionRow.tsx:95` still offers *"Use the default"* on rows migration 128's backfill wrote, and
      `grantsVocabulary.ts` states that the reset's *"mere presence carries exactly what the tag
      spelled out."* See `D-248-05`.
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/248-the-credential-boundary/248-VERIFICATION.md`.** The reset affordance now reads *"Follow the default instead"* (`grantsVocabulary.ts`), so it no longer implies a human author the system cannot attribute; `ConnectionGrantsList.test.tsx` asserts the **rendered DOM text**, 9/9. ⭐ That assertion shape is deliberate — a presence assertion cannot see content drift, which is this project's own recorded finding.
- [x] **CRED-03**: Every `SECURITY DEFINER` function in the exposed API schema is ruled on — each of
      the advisor's **13** anon-executable findings is either *intentionally public, with the reason
      recorded*, or revoked. ⛔ **Revoke from `PUBLIC`, then grant back the roles that need it** — a
      `REVOKE … FROM anon` is a **no-op** while the default `PUBLIC` grant stands, measured when
      migration 177's first version applied cleanly and verify still read `FAIL`.
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/248-the-credential-boundary/248-VERIFICATION.md`.** Migration `181_revoke_public_secdef_functions.sql` revokes **`PUBLIC`** and `anon` execute across all **13** SECURITY DEFINER functions (11 + 2), verified live on `:54322` — direct execution denied to `anon` and `authenticated`, triggers still firing on DML. `supabase/full-schema.sql` regenerated. ⭐ The `PUBLIC`-first ordering this requirement insisted on is the one that was executed, which is the half a naive `REVOKE … FROM anon` gets wrong.
      ⚠ **THE TICK ABOVE COVERED THE FUNCTION HALF ONLY, AND IS KEPT RATHER THAN REWRITTEN.** `253-01` (2026-09-16, `253-01-SUMMARY.md`) closes the **TABLE** half: `connector_tokens`, the three watch tables, `app_settings` and `user_settings` were mirrored in NEITHER bootstrap artifact, so a greenfield deploy shipped Supabase's stock `GRANT ALL` over all six. Measured **as `authenticated` on a real scratch database**, not argued from text: `SELECT access_token_ciphertext FROM public.connector_tokens` **SUCCEEDED** before and answers `permission denied` after; `anon` held `app_settings` and `user_settings` — `BUG-260911-01`'s exact pair — and no longer does. Gate: `scripts/check-greenfield-privileges.py`, now on the deploy parity checklist beside `get_advisors(security)`.
- [x] **CRED-04**: `get_advisors(security)` runs as part of the deploy parity checklist at every
      promotion. ⭐ It is the only thing that has ever caught this class: `BUG-260911-01` was
      invisible to every gate the project runs, because **every gate reads through the service role
      and nothing in the suite makes a request as `anon`.**

      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/248-the-credential-boundary/248-VERIFICATION.md`.** `scripts/check-security-advisors.sh` queries `GET /v1/projects/{ref}/advisors/security`, exits **1** on ERROR and **0** on WARN-or-clean; `backend/tests/unit/test_check_security_advisors.py` drives every exit code. `SUPABASE_ACCESS_TOKEN` registered in `backend/.env.example` and in `OMITTED_FROM_ONEBOX`; `docs/DEPLOYMENT-WORKFLOW.md` updated. ⚠ It is **operator-run**, not an unskippable CI hook — stated in the verification rather than implied by the tick.

      ⚠ **THE TICK ABOVE COVERED THE ADVISOR SCRIPT ONLY, AND IS KEPT RATHER THAN REWRITTEN.** `253-02` (2026-09-17, `253-02-SUMMARY.md`) closes the **PARITY GATE** half, and it closes it against the gate's own vacuity rather than against a missing feature: `scripts/check-schema-acl-parity.cjs` saw `16/16` **function** tuples and **zero** table/column entries, so deleting the single line `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` still printed `missing: 0`, **exit 0** — over the exact RPC `BUG-260911-01` found callable unauthenticated. It now reads **133/133** (61 function + 72 table/column tuples from 32 statements across 12 migrations), is literal-aware (migration 180's three `COMMENT ON COLUMN` statements were being collapsed into one), and carries a **29/29** `--self-test` whose arms were themselves falsified against three planted defects — one arm was found **VACUOUS** that way and replaced. ⭐ **And it is now INVOKED by something other than a human typing it**: a PostToolUse hook (`.claude/hooks/schema-acl-parity-guard.js`, driven loud-vs-silent with the defect still planted) plus a CI workflow. ⛔ **The CI job has never executed** — it cannot be driven from a local worktree; confirm it on the next push touching a matching path. The local hook is the primary half under CLAUDE.md's own two-guards rule.
### The Model You Actually Run

- [x] **MODEL-04**: A local or self-hosted model — Ollama, LM Studio, vLLM, or any OpenAI-compatible
      endpoint — is addable from the Model Registry **UI**, without a code edit and without a deploy.
      *(`SEED-172`, trigger **fired by the operator 2026-09-13**: `POST /admin/models` validates its
      provider argument against the 8-cloud **SSRF discovery allowlist** rather than the routing
      roster. `SEED-040`, trigger fired 2026-07-22.)*
- [x] **MODEL-05**: A model whose id is absent from the capability registry **says so at pick time**.
      ⛔ Today it resolves `capability_source = inferred` and silently loses `native_tools`, which
      short-circuits above every tool gate — the run simply never calls a tool and nothing says why.
      *(`SEED-172` second arm, `SEED-135`.)*
- [x] **MODEL-06**: A registry or settings change reaches **every** worker, not only the one that
      served the write. *(`BUG-260902-06`, major — `WORKER_COUNT=2` by default, so a newly added
      model appears roughly half the time.)*
- [x] **MODEL-07**: The control that hides a model from the picker is the discoverable one.
      *(`BUG-260908-03`, major — `deprecated` reads as the hide control and `enabled` does not.)*
- [x] **MODEL-08**: A settings write the database refuses reports **failure**. *(`BUG-260909-01` —
      `save_app_settings` swallows a rejected write and returns 200 + "Saved". Same failure class as
      migration 078, which hid for ~10 days, and as the `lmstudio_api_key` column migration 180 just
      added.)*
- [x] **MODEL-09**: Every configured eval engine either reports healthy or **names its own cause** —
      no opaque `provider_error`. ⚠ **Re-measure FIRST**: `BUG-260809-01` (0/8 healthy, 6 of 8 hiding
      why) was measured against the **old** production on 2026-08-09. 292 commits have landed since.
      Engine health is a live sweep and is not persisted, so it cannot be re-derived from the
      database — it needs one click on **Settings → Eval engine health → Run sweep** before this
      requirement is planned.

### Run Honesty — the residue

- [x] **HONEST-01**: Context trimming never drops the user's own question. *(`BUG-260906-01`, major —
      the agent announces that your question was trimmed, naming a question you asked eight turns in.)*
- [x] **HONEST-02**: A reasoning model that produces no text inside a tool loop says what happened
      rather than returning "empty response after N iterations". *(`BUG-260722-02`, major,
      `cross-provider/openai`.)*
- [x] **HONEST-03**: The workspace panel never claims a run is in progress after that run has ended.
      *(`BUG-260902-01`, major — a timed-out run leaves the panel working forever.)*
- [x] **HONEST-04**: A task that completed does not leave a todo list asserting unfinished work.
      *(`BUG-260913-02`, reported by the operator 2026-09-13. ⚠ **Blocked on one measurement** — see
      that report: whether the stuck item carries `" (run ended — not completed)"` decides whether
      this is a backend defect or a copy decision, and the two arms lead to **opposite** fixes.
      ⛔ Auto-completing open todos at a clean run end is **rejected** and was rejected in 2026-06-26
      — a clean terminal status is not proof the listed work happened.)*

### Register Integrity

⚠ This is the recurring defect of the last two milestones, named in both closes and fixed in neither.

- [x] **REG-01**: No two seeds share an id. ~~**8 duplicates exist** — `022, 092, 228, 229, 231, 253,
      259, 269` — so a reference by id cannot be resolved, and `status:` frontmatter **is** the
      register index.~~ ⭐ **RESOLVED 2026-09-16 (251-03)** — the original is struck through rather
      than deleted. All eight movers renumbered to `277-284` by the D-07/D-20 date rule; a
      `status: superseded-id` redirect stub stands at each original id naming BOTH resolutions.
      Gate: `register 292 · parsed 292 · skipped 0 · duplicate ids 0`, exit **0**.
- [x] **REG-02**: The seeds register is swept by something **executable**. ⚠ CLAUDE.md's rule says
      `/gsd:new-milestone` reads every `trigger_when`; at **161 planted seeds of 280** that sweep is a
      phase of work, not a step in a command — and `grep -rln "SEED" .claude/commands/gsd/` returns
      only `capture.md`, the command that *writes* seeds. ⭐ The cost is measured, not theoretical:
      `SEED-172` sat reachable for four weeks and it took a person hitting the wall to surface it.
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `scripts/check-seeds-register.cjs` + `.planning/phases/251-register-integrity/251-04-SUMMARY.md`.** One command reads the register and prints the seeds whose trigger is already true (`--phase NNN`), and it is **CALLED** at both GSD touchpoints — `.claude/get-shit-done/workflows/discuss-phase.md` (`<step name="cross_reference_seeds">`) and `new-milestone.md` §2.5, which no longer instructs a human to read every seed by hand. ⛔ **Proven by execution, not by grep**: the fenced command was extracted from each file and run, and the counterfactual — the same file with the fence replaced by a prose mention — still satisfies `grep -rn "check-seeds-register"` while leaving **zero** runnable calls. ⚠ The register is still largely unswept **by design** (`134 carry no trigger_when at all · 114 carry prose but no structured trigger`) and the gate reports **both** figures, never their sum (D-18). This box means *the sweep exists and fires*, not *the backlog is gone*.
- [x] **REG-03**: `BUS-171`'s operator queue — **23 items** `--to operator`, most 5-10 days old — is
      triaged into a decision list. ⛔ **Claude may not close them**; the deliverable is a list the
      operator can rule on. Each item is classified *superseded* (naming the evidence), *live decision*
      (one line), or *carries an unfixed finding* — and that last arm **must verify a durable register
      holds the finding, planting one if not.** The 2026-09-06 sweep found two findings held only by a
      bus item.

      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/251-register-integrity/251-BUS-TRIAGE.md`.** The **5 currently-open** `to:operator` items are classified with named evidence, every third-arm finding verified against a durable register, and `SEED-286` planted for the one held by nothing. `BUS-171` is discharged **in writing** naming `88a9ff861` — 22 of its 23 named items are closed and 4 of today's 5 open items are newer than it. ⛔ **Claude wrote nothing to the bus**: `git diff --name-only .agent-bus/` is EMPTY, and the `answer` / `close` commands ship pre-filled **for the operator to run**. ⚠ The stated count of 23 was stale; the re-scope is recorded as a decision (D-12), not a quiet narrowing.
### Verification Debt — a standing gate, not a phase

- [ ] **DEBT-06**: Phases **238, 240, 241** and **242-246** each receive an independent §6.3 review,
      or carry a **written refusal** naming who decided and why. ⭐ **The blocker is gone**: `OV-SOLO-01`
      was **re-armed 2026-09-13** when Gemini returned, so the two-agent separation of `AGENTS.md`
      §3 / §6.3 is back in force. `BUS-202` is already waiting — Gemini reports Phase 246 complete and
      ready for post-phase review. ⛔ **Nothing is retro-reviewed by re-arming the rule**: those phases
      stay `verification_mode: self-verified` with `independent_review: owed` until a review actually
      runs. ⚠ `/code-review ultra` stays ruled out on cost; the normal `/gsd:code-review <phase>` is
      the instrument, and it is what caught 241's shipped HTTP 500.
      ⭐ **AMENDED 2026-09-17 (`254-04`) — THE SENTENCE ABOVE IS PRESERVED RATHER THAN REWRITTEN, BECAUSE
      IT NAMES NOT ONE PHASE THIS MILESTONE BUILT AND THAT IS THE FINDING.** Measured, never re-typed: its
      wording covers **none** of 249-253, so reviewing all five would have ticked nothing at all. The two
      clauses below are RE-DERIVED from the `independent_review:` key of each `*-VERIFICATION.md` (the command
      and its verbatim output are in `254-04-SUMMARY.md` §Task 2A), and they are deliberately **split**,
      because one undifferentiated clause naming every id would write a FALSE sentence into the very
      requirement this phase exists to make true — several rows the original wording calls owed are already
      discharged, and naming them as owed again is the drift, not the bookkeeping.
      **Still unmet (re-derived 2026-09-17):** 239 `owed` · 241 key absent · 242 `false` · 244 key absent · 245 has no verification file · 249 `owed` · 250 `owed` · 251 `owed` (the key was ABSENT and was ADDED by `254-04`) · 252 `owed` · 253 `owed` — **ten rows**.
      **Already accounted for (re-derived 2026-09-17):** 238 `complete` · 240 `complete` · 243 `refused` · 246 `done` — **four rows**, and ⛔ not one of them may be named as owed again.
      ⛔ **245 carries no `*-VERIFICATION.md` at all**, so it holds no value in any state: it is unmet
      because *nothing records it*, which is a different fact from a row that reads `owed`, and no key-value
      sweep can ever see it. ⚠ **`239` appears in the unmet clause and the original wording never named it**
      — it reads `independent_review: owed` on disk and belongs to neither arm as written. A hand-typed list
      is the defect this family keeps re-paying.
      ⛔ **THE AMENDMENT WIDENS THIS REQUIREMENT; IT DOES NOT TICK IT.** It now covers **fourteen** rows (ten
      unmet + four accounted) where the original wording covered eight. Phase 254 closes only the **249-253
      arm**, and it closes that arm with *drafted refusals awaiting an operator ruling* rather than with
      reviews — so `DEBT-06` becomes tickable when **both** arms are, which is not at this close (D-03 as
      corrected by M-11). ⛔ **The box stays `- [ ]`**, quoting `ROADMAP.md:271` verbatim: *"`DEBT-06` is NOT
      in this phase's scope and must not be quietly ticked by it."*
      ⚠ **The 254 apparatus, for whoever has to rule on it:** five bus asks amended in place with a
      **2026-09-24** deadline and the risk rank `251 → 253 → 252 → 249 → 250` (`254-01`, nothing
      opened / answered / closed); a self-assessed quality-floor review of the one phase that had none
      (`251-REVIEW.md`, `discharges_debt_06: false`); five `*-REVIEW-REFUSAL.md` drafts, every one
      `draft-pending-operator-ruling` and every one **void** if its ask is answered; and the index the
      operator rules on, with the `answer` and `close` commands pre-filled and unrun: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`.

---

## Future Requirements

Deferred, triggers intact.

### Open Platform / inbound — **this is v5.0**

- **OPEN-01**: The app is callable from outside — public API, MCP server, webhooks, service accounts.
  *(`SEED-013`, priority high.)*
- **OPEN-02**: An inbound trigger surface exists, so n8n (and a schedule, and a webhook) reach the
  same door. *(`SEED-195` — ⚠ this and `SEED-014` are the **same feature seen from outside**; do not
  plan them separately.)*

⚠ **Deferred for the SECOND time.** v4.1's scoping already reserved v5.0 for this. A third deferral
needs a reason written down, not silence.

### Named and deliberately not in v4.2

- **RECALL-01** — the small-tenant recall cliff. ⛔ **Not owed work: a finished decision.** Phase 246
  proved by `EXPLAIN (ANALYZE)` that no `hnsw_ef_search` value fixes it *through the index* — 40/60/80
  give an Index Scan returning **ONE row** (~0.05 recall, ~4 ms); 100/150/200 give a **Seq Scan**
  (recall 1.000, ~1,100 ms). Default reverted to 40. **Re-open path: `SEED-273` (`hnsw.iterative_scan`)**,
  and any future attempt must inspect a **PLAN**, not only a recall number — measuring recall alone is
  exactly how Phase 241 reached the opposite conclusion.
- **Workflows / publish gauntlet** — 5 open bugs (`BUG-260730-02`, `BUG-260815-06`, `BUG-260828-05`,
  `BUG-260828-06`, `BUG-260819-01`). Coherent cluster, genuinely deferrable: none blocks the surfaces
  this milestone is about.
- `SEED-211` BUILD (metadata-derived permissions) · `SEED-224` (document-space redesign) ·
  `SEED-004` (org / department / role — ⚠ department access has been owed since Phase 231) ·
  `SEED-265` / `266` / `267` / `272` (the v4.0 recall-harness residue) · `SEED-242` (`app.<domain>`,
  still armed) · `SEED-273` (`hnsw.iterative_scan`).

---

## Out of Scope

| Excluded | Reason |
|---|---|
| `BUG-260911-01`, `BUG-260910-03` | **Measured fixed 2026-09-13.** Both read `status: open` and neither is. Bookkeeping, not work |
| Auto-completing open todos at a clean run end | Fabricates success. A clean terminal status is not proof the listed work happened — rejected 2026-06-26, recorded here so it is not re-proposed as new |
| `/code-review ultra` | Ruled out on cost by the operator, standing |
| Workflow / publish-gauntlet bug cluster (5) | Deferred whole, with the ids named above — a cluster deferred by name can be re-opened; one deferred by silence cannot |
| `BUG-260718-03`, `BUG-260610-01`, `BUG-260609-02` | Minor chat/panel cosmetics. Named so they stay re-openable; `/gsd:fast` candidates if any is ≤ 1 file / ≤ 10 lines |
| `BUG-260908-01` (unbounded Chunks section) | Document-detail surface — belongs with `SEED-224`'s redesign, not scattered ahead of it |
| A new capability axis of any kind | This is a **consolidation** milestone and the version number says so. v5.0 is the next real axis |

---

## Known shape-risk, stated at scoping rather than discovered later

⚠ **This is the SECOND CONSECUTIVE consolidation milestone.** v4.1 named the risk — *"a consolidation
milestone has no natural stopping point; every register it opens contains more than it can close"* —
and then ran Phase 235's failure mode anyway at 17 plans for 4-6 plans of substance. The risk does not
diminish by being repeated; it compounds, because the registers are now larger and `SEED-013` has been
deferred twice.

**G-8 is the governor here more than on any capability milestone:**
- **3-5 plans per phase.** Above 6, justify it in CONTEXT.md by naming what genuinely cannot share a
  worktree.
- A bug that is **≤ 1 file / ≤ 10 lines** with no schema or API surface is `/gsd:fast` under **G-3** —
  never a plan.
- ⛔ **Never cut to save time:** the verifier, TDD RED drives, `security_enforcement` / `code_review`,
  migration discipline.

⚠ **G-2 fires on `WATCH-*`** — live UI, and every one of those eight complaints is a *legibility*
complaint. `/gsd:sketch` before `/gsd:plan-phase`; the operator-approved mockup is the acceptance bar.

⚠ **`CRED-*` touches a trust boundary** — threat model mandatory, and the dispatched code review is
not optional.

⚠ **`retrieval_service.py`'s G-5 extraction has been owed since 231** and 241 was the deliberate
**second** landing. **A third landing must propose the extraction FIRST.**

---

## Traceability

**Filled 2026-09-13 at roadmap creation** (`.planning/ROADMAP.md` → *v4.2 The Connected Knowledge You
Can Actually Run*). **26 requirements · 25 mapped to exactly one phase each · 1 (`DEBT-06`) held as a
milestone-wide standing gate. Coverage 26/26 — no orphans, no duplicates.**

| Requirement | Phase | Status |
|---|---|---|
| WATCH-01 | Phase 247 — Sources & Watches | Complete |
| WATCH-02 | Phase 247 — Sources & Watches | Complete |
| WATCH-03 | Phase 247 — Sources & Watches | Complete |
| WATCH-04 | Phase 247 — Sources & Watches | Complete |
| WATCH-05 | Phase 247 — Sources & Watches | Complete |
| WATCH-06 | Phase 247 — Sources & Watches | Complete |
| WATCH-07 | Phase 247 — Sources & Watches | Complete |
| WATCH-08 | Phase 247 — Sources & Watches | Complete |
| CRED-01 | Phase 248 — The Credential Boundary | ✅ **Complete (251-04 sweep)** — `248-VERIFICATION.md`, peer-reviewed 4/4. Smell rule enforced across all three `custom_client_id` homes, 422 on a smell, RFC 7591 ids permitted. ⚠ G-4 **S2** (`McpAuthDoor` BYO-OAuth, live) recorded ⛔ owed in `248-G4-UAT.md` |
| CRED-02 | Phase 248 — The Credential Boundary | ✅ **Complete (251-04 sweep)** — `248-VERIFICATION.md`. *"Follow the default instead"*; `ConnectionGrantsList.test.tsx` asserts the RENDERED DOM TEXT, 9/9 — a presence assertion could not have seen this drift |
| CRED-03 | Phase 248 — The Credential Boundary · **re-closed Phase 253-01 (table half)** | ✅ **Complete** — `248-VERIFICATION.md` (functions) + `253-01-SUMMARY.md` (tables). Migration `181` revokes **`PUBLIC`** and `anon` across all 13 SECURITY DEFINER functions. ⚠ That covered functions ONLY: `253-01` mirrored all **seven** ACL-bearing tables into both bootstrap artifacts and proved it on a scratch database **as `authenticated`** — `access_token_ciphertext` SUCCEEDED → `permission denied`, `anon` on `app_settings`/`user_settings` True → False, 1045 violations → 0. Gate: `scripts/check-greenfield-privileges.py` |
| CRED-04 | Phase 248 — The Credential Boundary · **re-closed Phase 253-02 (parity gate half)** | ✅ **Complete** — `248-VERIFICATION.md` (advisor script) + `253-02-SUMMARY.md` (parity gate). `scripts/check-security-advisors.sh`, exit 1 on ERROR / 0 on WARN-or-clean, every code driven by `test_check_security_advisors.py`. ⚠ **operator-run**, not an unskippable CI hook. ⚠ That covered the advisor only: `253-02` fixed the parity gate, which was passing `missing: 0` over a deleted `REVOKE … FROM PUBLIC` on `resize_embedding_column` — `16/16` function-only → **133/133** function + table/column, literal-aware, `--self-test` **29/29** with its arms falsified against planted defects, and wired to a PostToolUse hook + CI. ⛔ The CI job has never executed — confirm on next matching push |
| MODEL-04 | Phase 249 — The Model You Actually Run | **Complete (partial)** — addable from the UI with no code edit or deploy, driven live for all 3 self-hosted providers. ⛔ *"then usable in chat"* NOT driven: no live self-hosted endpoint answered during the run (`249-UAT.md` §C) |
| MODEL-05 | Phase 249 — The Model You Actually Run | **Complete** — the chip now renders at pick time (the composer), states the tool-loss consequence, and does not fire on an operator-added model. Driven on all **11** configured providers |
| MODEL-06 | Phase 249 — The Model You Actually Run | **Complete by construction + fence** — the broadcast was ALREADY shipped (`BUG-260902-06`) and is now pinned in both directions. ⛔ the multi-worker arm is NOT observed: this box runs two single-worker `--reload` servers, so `WORKER_COUNT=2` does not exist here |
| MODEL-07 | Phase 249 — The Model You Actually Run | **Complete** — the words went ON the two controls, not into a fourth passive column. `deprecated` semantics unchanged (D-149-04) |
| MODEL-08 | Phase 249 — The Model You Actually Run | **Complete** — reproduced live, then fixed: a refused value is a 400 naming the column and rule; an unreachable DB is still a 500. Also closed a traceback that logged the whole row |
| MODEL-09 | Phase 249 — The Model You Actually Run | **Closed by measurement, 2026-09-15** — fresh sweep **8/8 healthy, zero opaque `provider_error`**; the stale board's one failure named its cause verbatim. `BUG-260809-01` closed. ⛔ measured **LOCAL**; the cloud half is one operator click and is unmeasured |
| HONEST-01 | Phase 250 — Run Honesty | ✅ Complete (eviction ORDER: non-user groups go first, across BOTH sections) |
| HONEST-02 | Phase 250 — Run Honesty | ✅ Complete (4-arm taxonomy + honest `reason not captured`; never-reset reasoning counter) |
| HONEST-03 | Phase 250 — Run Honesty | ✅ Complete (gate admits every TRUE terminal status + panel reads run state, so 53 legacy rows are honest with NO backfill) |
| HONEST-04 | Phase 250 — Run Honesty | ✅ Complete — **the blocking measurement was TAKEN** (`250-MEASUREMENT.md`): marker PRESENT on the newest rows ⇒ the COPY arm, and the report's dichotomy was FALSE (both arms true of different rows). `NOT TICKED` badge; ⛔ nothing auto-completed |
| REG-01 | Phase 251 — Register Integrity | ✅ Complete (251-03) — 8 movers renumbered to 277-284 by the D-07/D-20 date rule, 8 `status: superseded-id` redirect stubs at the original ids naming BOTH resolutions. Gate: `register 292 · parsed 292 · duplicate ids 0`, exit 0. ⛔ 91 product-source references across 35 files deliberately left on a stub under D-17, listed by file in `251-RENUMBER-LEDGER.md` |
| REG-02 | Phase 251 — Register Integrity | ✅ **Complete (251-04)** — `scripts/check-seeds-register.cjs` is CALLED at both GSD touchpoints (`discuss-phase.md` `<step name="cross_reference_seeds">`, `new-milestone.md` §2.5), and the by-hand read of every seed is gone. ⛔ Proven by EXECUTING the fence, not by grep: defanged to a prose mention the file still passes `grep` with **zero** runnable calls. ⚠ `134 / 114` unswept remains, reported as two figures and never summed |
| REG-03 | Phase 251 — Register Integrity | ✅ **Complete (251-04)** — `251-BUS-TRIAGE.md`: 5 open `to:operator` items classified with named evidence, `SEED-286` planted for the one finding no register held, `BUS-171` discharged in writing naming `88a9ff861` (22 of 23 closed; 4 of today's 5 are newer than it). ⛔ **Claude closed nothing** — `git diff --name-only .agent-bus/` EMPTY; the `answer`/`close` commands ship pre-filled for the operator |
| DEBT-06 | **Milestone-wide standing gate** (no phase) | Pending — discharged alongside the build: 238 / 240 / 241 beside 247-248, 242-246 beside 249-251, and each v4.2 phase reviewed at its own close. ⛔ Re-arming `OV-SOLO-01` retro-reviews nothing ⚠ **STILL PENDING after Phase 254 (`254-04`, 2026-09-17), and the requirement TEXT was AMENDED rather than ticked (D-02 / D-03).** Re-derived at that close: **ten rows unmet · four already accounted for** — two figures, reported separately and never summed. 254 built the apparatus for its own arm only: `BUS-249/250/251/256/257` amended in place with a **2026-09-24** deadline, `251-REVIEW.md` as a self-assessed quality floor that `discharges_debt_06: false`, five `*-REVIEW-REFUSAL.md` drafts pending an operator ruling, and `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. ⛔ Not one `independent_review` reads `done` or `refused` as a result |
| | ⛔ **LEFT UNTICKED at the 251-04 sweep, deliberately** | The other 25 boxes were ticked against a named artifact. This one has none: **no independent §6.3 review has run** for 238/240/241, and 249 and 250 each closed `self-verified` with `independent_review: owed` — `BUS-247` says so in its own body and makes the case (*"a code-review pass is not a peer review"*). ⛔ Ticking it would be exactly the claim ROADMAP:271 forbids. It becomes tickable when a review runs, not when the rule is re-armed |
| | ⛔ **STILL UNTICKED at the 254-04 sweep, and now for a SECOND, DIFFERENT reason** | The 251-04 row above is preserved verbatim and still holds. What 254 adds: an independent §6.3 review has *still* not run for any of the fourteen rows this requirement now covers, and the five 249-253 asks were **amended, not answered** — `BUS-249` / `BUS-250` / `BUS-251` / `BUS-256` / `BUS-257` are all still `[OPEN]`. The five refusals `254-03` drafted are `draft-pending-operator-ruling`; ⛔ **a draft is not a decision, and `REG-03` forbids claude from making it one.** ⭐ 254 did move this row in the honest direction: `251-VERIFICATION.md` gained the `independent_review` key it had lacked for its whole life, so a sweep that returned **4** now returns **5**. ⛔ Tickable when BOTH arms close, not when the apparatus exists |

⚠ **Re-derive this table from the phase directories at close, never from a summary line.** v4.1's own
close found its ROADMAP Progress table reading `0 / 5 phases complete · 0 / 19 requirements delivered`
with all five phases closed, and drift ran in **both** directions — rows carrying full closing evidence
while their boxes were unticked, and ticked boxes whose rows still read *"Pending"*. **A coverage check
run against the wrong denominator is how a requirement survives a milestone unnoticed.**
