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

- [ ] **WATCH-01**: A file ingested from Google Drive carries `metadata.source.path`, so a watched
      document classifies and locates exactly like an uploaded one. *(`BUG-260913-01`, major — the
      adapter never writes it, so classification rules keyed on path silently never match.)*
- [ ] **WATCH-02**: A OneDrive / SharePoint folder path is stored whole — no truncation and no
      mismatch between the path shown and the path stored. *(`BUG-260910-04`, major — three defects
      found by the independent review of Phase 238, all shipped.)*
- [ ] **WATCH-03**: A watch card reports the health of **the connection it rides**, not of its last
      run — a healthy connection whose last run failed, and a broken connection whose last run
      happened to succeed, both read correctly. *(`BUG-260909-03`, major.)*
- [ ] **WATCH-04**: "Sync now" reports its result **in place** — the section it writes into stays
      open and the answer is readable without re-navigating. *(`BUG-260909-04`, major.)*
- [ ] **WATCH-05**: A file that has gone missing at the source says **when** it went missing.
      *(`BUG-260909-05` — `missing_since` is declared and never written, so the column cannot answer
      the one question it exists for.)*
- [ ] **WATCH-06**: An action labelled as a fix performs the fix; one that only navigates is labelled
      as navigation. *(`BUG-260909-06` — a button worded as a write that only changes page.)*
- [ ] **WATCH-07**: A timestamp is either absolute or relative, never both concatenated.
      *(`BUG-260909-07` — "Last read successfully on 8 min ago".)*
- [ ] **WATCH-08**: Each of Phase 240's seven open build-review warnings is closed, or explicitly
      accepted **with the reason written down**. *(`BUG-260910-02` — a warning list with no
      disposition is a deferral nobody can re-open.)*

### The Credential Boundary

- [ ] **CRED-01**: A credential pasted into a field that is not a secret field is **refused, not
      stored** — and the refusal names which field takes a secret. *(`BUG-260907-02`, major, driven
      live 2026-09-13. `config` is `SELECT`-able by `authenticated` org-wide while `secret_ciphertext`
      is not; a secret written to `config` is readable by every org member.)*
- [ ] **CRED-02**: The grant override marker claims only what the app can actually know — it does not
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
- [ ] **CRED-03**: Every `SECURITY DEFINER` function in the exposed API schema is ruled on — each of
      the advisor's **13** anon-executable findings is either *intentionally public, with the reason
      recorded*, or revoked. ⛔ **Revoke from `PUBLIC`, then grant back the roles that need it** — a
      `REVOKE … FROM anon` is a **no-op** while the default `PUBLIC` grant stands, measured when
      migration 177's first version applied cleanly and verify still read `FAIL`.
- [ ] **CRED-04**: `get_advisors(security)` runs as part of the deploy parity checklist at every
      promotion. ⭐ It is the only thing that has ever caught this class: `BUG-260911-01` was
      invisible to every gate the project runs, because **every gate reads through the service role
      and nothing in the suite makes a request as `anon`.**

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
- [ ] **REG-02**: The seeds register is swept by something **executable**. ⚠ CLAUDE.md's rule says
      `/gsd:new-milestone` reads every `trigger_when`; at **161 planted seeds of 280** that sweep is a
      phase of work, not a step in a command — and `grep -rln "SEED" .claude/commands/gsd/` returns
      only `capture.md`, the command that *writes* seeds. ⭐ The cost is measured, not theoretical:
      `SEED-172` sat reachable for four weeks and it took a person hitting the wall to surface it.
- [ ] **REG-03**: `BUS-171`'s operator queue — **23 items** `--to operator`, most 5-10 days old — is
      triaged into a decision list. ⛔ **Claude may not close them**; the deliverable is a list the
      operator can rule on. Each item is classified *superseded* (naming the evidence), *live decision*
      (one line), or *carries an unfixed finding* — and that last arm **must verify a durable register
      holds the finding, planting one if not.** The 2026-09-06 sweep found two findings held only by a
      bus item.

### Verification Debt — a standing gate, not a phase

- [ ] **DEBT-06**: Phases **238, 240, 241** and **242-246** each receive an independent §6.3 review,
      or carry a **written refusal** naming who decided and why. ⭐ **The blocker is gone**: `OV-SOLO-01`
      was **re-armed 2026-09-13** when Gemini returned, so the two-agent separation of `AGENTS.md`
      §3 / §6.3 is back in force. `BUS-202` is already waiting — Gemini reports Phase 246 complete and
      ready for post-phase review. ⛔ **Nothing is retro-reviewed by re-arming the rule**: those phases
      stay `verification_mode: self-verified` with `independent_review: owed` until a review actually
      runs. ⚠ `/code-review ultra` stays ruled out on cost; the normal `/gsd:code-review <phase>` is
      the instrument, and it is what caught 241's shipped HTTP 500.

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
| CRED-01 | Phase 248 — The Credential Boundary | Pending |
| CRED-02 | Phase 248 — The Credential Boundary | Pending |
| CRED-03 | Phase 248 — The Credential Boundary | Pending (⛔ revoke from `PUBLIC`, not from `anon`) |
| CRED-04 | Phase 248 — The Credential Boundary | Pending |
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
| REG-02 | Phase 251 — Register Integrity | Pending |
| REG-03 | Phase 251 — Register Integrity | Pending (⛔ Claude may not close bus items — deliverable is a list the operator rules on) |
| DEBT-06 | **Milestone-wide standing gate** (no phase) | Pending — discharged alongside the build: 238 / 240 / 241 beside 247-248, 242-246 beside 249-251, and each v4.2 phase reviewed at its own close. ⛔ Re-arming `OV-SOLO-01` retro-reviews nothing |

⚠ **Re-derive this table from the phase directories at close, never from a summary line.** v4.1's own
close found its ROADMAP Progress table reading `0 / 5 phases complete · 0 / 19 requirements delivered`
with all five phases closed, and drift ran in **both** directions — rows carrying full closing evidence
while their boxes were unticked, and ticked boxes whose rows still read *"Pending"*. **A coverage check
run against the wrong denominator is how a requirement survives a milestone unnoticed.**
