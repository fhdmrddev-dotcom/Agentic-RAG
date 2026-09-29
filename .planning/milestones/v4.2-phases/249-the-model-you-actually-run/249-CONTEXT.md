# Phase 249: The Model You Actually Run - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

> ⚠ **THIS CONTEXT WAS GATHERED AUTONOMOUSLY, BY EXPLICIT OPERATOR INSTRUCTION, AND THAT IS
> DISCLOSED RATHER THAN HIDDEN.** The operator's own words at `/gsd:discuss-phase 249`
> (2026-09-15): *"I want you to execute this phase in to end yourself without gemini please
> proceed autonomously use the tools you have I want to come tomorrow to see it complete."*
> No `AskUserQuestion` was put to a person. **Every `D-249-NN` below is CLAUDE'S call, not an
> operator ruling** — the two are not interchangeable, and a later phase must not cite one of
> these as *"the operator decided"*. Where a decision closes a register entry, the evidence is
> named inline so the call can be audited rather than trusted.
>
> ⛔ **CONSEQUENCE FOR `DEBT-06`, stated now so the close cannot overclaim:** the builder and the
> reviewer of this phase are the same agent. 249 therefore closes
> `verification_mode: self-verified` with `independent_review: owed`, exactly like 238 / 240 / 241.
> **It may NOT be recorded as peer-reviewed.** (`D-249-13`.)

<domain>
## Phase Boundary

**Delivers:** the model a person wants to run can be registered from the UI, announces what it
can and cannot do *before* it costs a run, and a write that the system refuses says so.

Six requirements, and **two of them are already built** — this phase's first finding is that it
is smaller than its ROADMAP row implies:

| Req | What it is here | Shape |
|---|---|---|
| `MODEL-04` | A self-hosted model (Ollama / LM Studio / any OpenAI-compatible endpoint) is addable from the Model Registry UI | **BUILD** — two hardcoded rosters to widen, one SSRF fence to leave alone |
| `MODEL-05` | An id absent from the capability registry says so **at pick time**, and says the *consequence* | **BUILD** — the chip exists, it is on the wrong surface |
| `MODEL-06` | A registry/settings change reaches every worker | ⭐ **ALREADY SHIPPED** — prove it, fence it, do not rebuild it |
| `MODEL-07` | The control that hides a model from the picker is the discoverable one | **BUILD (legibility only)** — no new control, no renamed semantics |
| `MODEL-08` | A settings write the database refuses reports failure | **BUILD** — small, backend-only, latent-hazard class |
| `MODEL-09` | Every eval engine reports healthy or names its own cause | ⭐ **WRITTEN CLOSURE** — measured 8/8 healthy, 0 opaque `provider_error` |

**NOT in this phase:** the `MODEL_CAPABILITIES` extraction seam (owed at 48 phases, `SEED-224`
class), per-role model fitness beyond the pick-time chip (`SEED-135`'s expensive half), dynamic
model discovery for self-hosted endpoints (`SEED-088`), and any change to `PROVIDER_ENDPOINTS`.

</domain>

<decisions>
## Implementation Decisions

### MODEL-09 — the precondition, discharged by measurement

- **D-249-01: `MODEL-09` COLLAPSES TO A WRITTEN CLOSURE. It is not planned as a build.**
  The ROADMAP made this conditional — *"If the sweep now reads healthy, `MODEL-09` collapses to a
  written closure rather than a plan"* — and the sweep was run rather than assumed.

  **Driven live, 2026-09-15, against the running local app** (`localhost:5173/app` → backend
  `localhost:8000`), as the signed-in operator, by `POST /evals/engine-sweep` followed by
  `GET /evals/engine-health`:

  | | Board |
  |---|---|
  | **Stale board, swept 2026-08-27** | **7/8 healthy.** The ONE failure — `moonshot / kimi-k2.6` — carried `RateLimitError: Error code: 429 - {'error': {'message': 'Your account org-e5ea… is suspended due to insufficient balance…'}` **verbatim**. |
  | **FRESH sweep, 2026-09-14T21:57Z** | **8/8 healthy. Zero errors. Zero `provider_error`.** |

  ⭐ **Both halves of `BUG-260809-01` are refuted on this tree.** *"0/8 healthy"* → 8/8.
  *"6 of 8 hide why"* → **zero hide why**; even the stale board's single failure named a real
  vendor billing condition in the vendor's own words.

  ⛔ **THE HONEST LIMIT, recorded so the closure cannot be read as more than it is:**
  `BUG-260809-01` was measured on **cloud production, 2026-08-09**. This measurement is **LOCAL, at
  `develop` HEAD**. They are not the same system. What is proven is that *the application code does
  not manufacture an opaque cause*; what is NOT proven is that cloud's eight engines are healthy
  today. The closure must say both sentences.

- **D-249-02: the closure still ships ONE executable thing — a fence that the tile's `error` is the
  VERBATIM provider string and never an engine-shaped constant.** `evals.py::_tile_for_run` already
  intends this (D-02: *"NEVER an engine-shaped message"*), and it has exactly one arm that violates
  its own rule — `"The engine did not complete this arm."` on a terminal-but-failed run with no
  error. That arm is correct as a last resort; what is missing is anything that would notice if a
  future edit made it the FIRST resort. **A guard nobody has seen fire is not a guard** (Phase 242
  measured two of this project's guards passing vacuously), so the fence is driven RED against a
  planted defect before it is trusted.

- **D-249-03: `BUG-260809-01` is closed by editing the report, and `SEED-040`'s eval arm with it.**
  `status: open → closed`, `verified_closed_by: Phase 249`, and the measurement table above pasted
  into the report body. ⛔ A bug whose `status:` still reads `open` is re-proposed forever — the
  frontmatter IS the index.

### MODEL-06 — already shipped; prove it, do not rebuild it

- **D-249-04: `MODEL-06` IS BUILT. The deliverable is a driven proof and a fence, NOT a feature.**
  Measured on this tree, not read from a register:
  - `user_settings.py::broadcast_settings_change()` — re-warms the writing worker **then** issues
    one Redis PUBLISH on `SCOPE_APP_SETTINGS`.
  - `user_settings.py::broadcast_model_overrides_change()` — the model-registry twin,
    `SCOPE_MODEL_OVERRIDES`.
  - `main.py:611` constructs `SettingsCacheSubscriber` at lifespan; `settings_broadcast.py` holds
    the subscriber loop, the 1.0 s publish timeout, and the fail-soft degradation to the 30 s TTL.
  - Every `save_app_settings` write path funnels through the first; `admin.py` calls the second at
    **all three** registry write seams (`:1352` add, `:1536` patch, `:1676` remove) and deliberately
    **not** at the two WR-03 read-before-guard invalidations.

  ⚠ **This is the second time in two phases that a requirement's headline defect was already
  fixed before the phase opened** (248's `CRED-02` was fixed at `e615c0dad`). **Measure the tree
  before planning the fix** is now a pattern with two data points, not a one-off.

- **D-249-05: the proof is a REAL two-worker run, not a unit test of the publisher.** `WORKER_COUNT=2`
  is the default and is the exact condition the bug described (*"appears roughly half the time"*).
  The proof: write a registry change through the app, then read back **repeatedly** and show every
  read agrees. A test that mocks Redis proves the publisher calls publish; it does not prove the
  sibling worker changed its mind.

### MODEL-04 — widen the ROUTING roster, never the SSRF fence

- **D-249-06: the defect is a DUPLICATED LIST, and it is duplicated in TWO languages.** Measured:

  | List | Where | Members |
  |---|---|---|
  | **Routing roster** | `config.py::_PROVIDER_BASE_URLS` | **11** — the 8 clouds **+ `ollama` + `lmstudio` + `custom`** |
  | **SSRF discovery allowlist** | `model_discovery_service.py::PROVIDER_ENDPOINTS` | **8** clouds |
  | **What `POST /admin/models` validates against** | `admin.py:1210` | ⛔ **`PROVIDER_ENDPOINTS`** |
  | **What the UI offers** | `ModelRegistryTab.tsx::ADD_PROVIDER_ROSTER` | ⛔ **8, hand-typed again** |

  So a self-hosted model is refused `422 Unknown provider` by the API **and** cannot even be
  selected in the form. Both halves must move or the fix is invisible.

- **D-249-07: ⛔ `PROVIDER_ENDPOINTS` IS BYTE-UNCHANGED BY THIS PHASE.** It is a *different list for
  a different reason* — it is the set of URLs the server will make an outbound request to, and
  widening it is an SSRF regression, not a feature. The plan must assert this file is untouched by
  diff, not merely intend it. ⭐ The whole point of adding `ollama`/`lmstudio`/`custom` to the
  *routing* roster is that their URL comes from the **operator's own `app_settings` column**
  (`_SELF_HOSTED_PROVIDERS`, migration 180) — the server never discovers them, so they have no
  business in a discovery allowlist.

- **D-249-08: the two rosters are pinned to each other by a `?raw` fence so they cannot drift a
  third time.** This project already has the pattern (frontend suites import backend `.py` by
  `?raw` and assert against the text). The fence reads `_PROVIDER_BASE_URLS`' keys out of
  `config.py` and asserts `ADD_PROVIDER_ROSTER` equals them. ⛔ It must be driven RED by planting a
  12th provider in the backend table. **A hand-typed list that a test pins is still hand-typed —
  the fence is what makes it honest.**

- **D-249-09: no new endpoint.** Widening the validation is a one-symbol change in `admin.py`
  (`PROVIDER_ENDPOINTS` → the routing roster) and a three-line change in the frontend array. A
  `GET /admin/models/providers` would be a new API surface for zero behaviour the fence does not
  already guarantee, and G-8 governs this milestone.

### MODEL-05 — the chip exists; it is on the wrong surface, and it undersells the damage

- **D-249-10: the `unverified` chip MOVES TO THE PICK-TIME SURFACE — the chat composer's model
  dropdown — by reusing the shipped component's exact chip, not a second implementation.**
  Measured: `ModelPillRow.tsx` renders an amber `unverified` chip with a tooltip, driven by
  `verified_models` + `inferred_provider_for` which the backend **already sends**. The chat
  composer's dropdown (`MessageInput.tsx:618-660`) renders `deprecated` and `active` and **has no
  unverified marker at all**. So the warning exists on the screen where you *configure*, and is
  absent on the screen where you *choose*. `MODEL-05` says *"at pick time"*; pick time is the
  composer.

- **D-249-11: the tooltip states the CONSEQUENCE, not the mechanism — and the backend already
  wrote the sentence.** `config.py::_build_inferred_defaults` logs, on an inferred provider outside
  `_NATIVE_TOOL_PROVIDERS`: *"TOOL CALLING IS DISABLED for this model: it will run in STRUCTURED
  mode, the tools param will NOT be sent, and any tool call it attempts will arrive as unparseable
  prose."* ⭐ That wording exists **because a total tool-calling failure stayed invisible for a day
  on 2026-08-18** when the log read `safe_defaults_applied=True`. The chip must carry the same
  consequence, or it repeats the mistake one surface up: a word that reads as benign over a model
  that cannot call a tool.

- **D-249-12: ⛔ the pick is NOT blocked, and no refusal is added.** `D-122-05` makes a registry
  miss degrade to `coerce` **by design**, and that default is correct. `SEED-135` says so in its own
  words: *"That default is CORRECT and must not change; what is missing is that the degradation is
  invisible to the person who caused it."* This phase makes it visible. It does not make it fatal.

- **D-249-13: a measured drift is fixed in passing — `ModelPillRow`'s tooltip says
  `timeout=90s`; the real inferred default is `_INFERRED_DEFAULT_TIMEOUT_S = 300`.** The tooltip has
  been telling operators a false number. One-line fix, in the plan that touches the file. **A
  surface built to tell the truth about capability must not itself be wrong about one.**

### MODEL-07 — legibility, not a new control

- **D-249-14: NO new control, and `deprecated` keeps its meaning.** `D-149-04` (*"a deprecated row
  stays enabled/selectable"*) is a shipped, deliberate decision; renaming or re-semanticising it
  would break the informational-sunset contract the registry, the composer and `ModelPillRow` all
  read. `BUG-260908-03`'s own report says so: *"The behaviour is CORRECT… the capability the
  operator asked for ALREADY EXISTS, and they could not find it."*

- **D-249-15: the registry now has THREE answers to "get rid of this model", and the report predates
  one of them.** Measured: `deprecated` (badge only), `enabled` (hides from the picker), and — since
  migration 179 — **`Remove`** (`RemoveControl`, deletes a DB-only row / tombstones a code-declared
  one). `BUG-260908-03` was filed 2026-09-08 against a table that already had all three. **So the
  fix is not "add the missing control"; it is "make the row answer the question the operator
  arrived with".**

- **D-249-16: the fix is at the CONTROL, not in a legend.** The existing `Users see` column +
  `CouplingChip` were *designed for exactly this* and still lost — the report says so: *"A
  legibility affordance was designed, built, and still lost to the neighbouring toggle in real
  use."* ⛔ Adding a second passive affordance would repeat that. The change lands **on the
  `deprecated` control itself** (it says, in words, that it does NOT hide the model and names what
  does) and **on the `Enabled` toggle** (it says what flipping it off will do). A control that
  explains itself at the moment of reach beats a column that explains the row.

### MODEL-08 — a refused write and an unreachable database are different answers

- **D-249-17: split the one broad `except`. A CONSTRAINT REFUSAL becomes a 400 naming the
  constraint; an UNREACHABLE database stays a 500.** Today `save_app_settings`
  (`user_settings.py:~615`) catches `Exception`, logs the column names, and returns `False`;
  every one of its **six** call sites turns `False` into a bare HTTP 500 *"Failed to save
  settings"*. True, and undiagnosable — and for a `CheckViolationError` it is also *wrong*: a value
  the database refused is a **caller error**, not a server fault.

- **D-249-18: the mechanism is a typed exception, not a changed return type.** `save_app_settings`
  raises a new `SettingsWriteRefused` **only** on the refusal family
  (`CheckViolationError` / `NotNullViolationError` / `UndefinedColumnError`) and still returns
  `False` for everything else. ⛔ **Every one of the six call sites is audited in the same plan** —
  `api/settings.py:835`, `api/admin.py:611/1755/1765`, `api/setup.py:469`,
  `services/setup_service.py:342`. The two API routers catch it and answer **400 with the
  constraint name**; the setup path lets it propagate, because a refused setup write that reads as
  success is the same bug one layer up.

- **D-249-19: `UndefinedColumnError` is deliberately in the refusal family, and that is the highest-value
  arm.** It is the *"knob shipped in CODE without its migration"* signature — migration 078's
  `skill_builder_model` hid for **~10 days**, and `lmstudio_api_key` hid until migration 180. Naming
  that column in the response is the difference between ten days and ten seconds.

### Scope, gates and process

- **D-249-20: FOUR plans. G-8 governs this milestone harder than any capability milestone.**
  1. `249-01` — `MODEL-04`: backend roster + frontend roster + the `?raw` drift fence + the missing ledger rows.
  2. `249-02` — `MODEL-05`: the composer chip, the consequence tooltip, the `90s → 300s` drift.
  3. `249-03` — `MODEL-07` + `MODEL-08`: control-level legibility + the honest refusal (one is frontend, one is backend; they share no file, but they share the one question *"does this surface lie about what it did?"*).
  4. `249-04` — `MODEL-06` proof + `MODEL-09` closure + the register edits + the UAT board.

- **D-249-21: NO MIGRATION.** Nothing here touches schema. Migration head is **181** (248 took it);
  the next free slot stays **182** and this phase does not claim it.

- **D-249-22: NO SKETCH — G-2 does not fire.** The ROADMAP made it conditional (*"sketch only if
  discuss-phase surfaces a visual decision"*). `MODEL-05` reuses a shipped chip verbatim;
  `MODEL-07` changes words on two existing controls. No new visual surface is proposed, so there is
  nothing an operator-approved mockup would decide.

- **D-249-23: G-5 — three files in the blast radius have NO ledger row, and the row is added in the
  plan that touches them.** Re-derived 2026-09-15 with the CLAUDE.md recipe:

  | File | commits / phases / lines | G-5 |
  |---|---|---|
  | `backend/app/services/model_discovery_service.py` | 5 / 2 / 541 | not firing — row added at its **third** touch, per the `settingsSearchPayload.ts` precedent |
  | `frontend/src/lib/api/admin.ts` | 5 / 2 / 1075 | not firing — row added |
  | `backend/app/api/evals.py` | *(derive at plan time)* | row added if the `MODEL-09` fence touches it |

  ⚠ **An absent row is invisible to G-5 at ANY count** — that is why they are added now rather than
  at the third phase. `node scripts/check-hot-file-ledger.cjs 249` is the enforcement; it fails on a
  `files_modified` entry with no row.

  **Rows that DO exist and whose seam stays OWED** (this phase must not pretend to discharge them):
  `config.py` (⛔ the `MODEL_CAPABILITIES` seam, 48 phases), `SettingsPage.tsx` (tab seam, 24),
  `MessageInput.tsx` (the `ComposerChipsRow` half, 15), `admin.py`, `settings.py`,
  `user_settings.py` (32), `ModelRegistryTab.tsx`, `eval_runner_service.py`.

- **D-249-24: SC#10 cross-provider — 8 rows, DERIVED from `MODEL_CAPABILITIES`, and honestly
  bounded.** The roster is one representative per `provider` group, newest and registry-backed.
  - `MODEL-05`'s chip is computed **client-side** from `verified_models`, so all 8 rows are driven
    with **no LLM call and no cost** — a genuinely cheap full board.
  - `MODEL-04`'s *"and is then usable in chat"* needs a **live self-hosted endpoint**. If no Ollama
    / LM Studio / custom server is running at UAT time, that row is recorded **⛔ with the reason
    and the blocking condition — never dropped.** A scoreboard that lists only what passed is not a
    scoreboard.
  - ⚠ **Provider attribution must be VERIFIED per row, not assumed.** Phase 243 abandoned its board
    because a click for `anthropic` selected `minimax`; a row whose provider cannot be confirmed
    from the run record is worth less than no row.

- **D-249-25: G-4 lived-experience UAT — three "I'd recognise failure here" scenarios, defined
  NOW rather than post-hoc.** The operator is asleep; these are Claude's, and are marked as such.
  1. *Add `qwen3-coder:30b` under provider `ollama` from the registry UI.* Failure I'd recognise:
     the provider is not in the dropdown, or the save returns `422 Unknown provider`.
  2. *Open the chat composer's model dropdown on a model with no registry row.* Failure I'd
     recognise: it looks identical to a registered model — nothing says the run will not call tools.
  3. *Toggle `deprecated` on a model and look at the picker.* Failure I'd recognise: the operator
     still cannot tell, from the control they touched, that the model is still selectable.

- **D-249-26: this phase closes `self-verified` with `independent_review: owed`.** The operator
  instructed *"without gemini"*. `OV-SOLO-01` / `AGENTS.md` §6.3 two-agent separation is therefore
  **waived by instruction, not satisfied** — and `DEBT-06` gains a **fourth** owed row alongside
  238 / 240 / 241. ⛔ The VERIFICATION.md must carry the waiver in words. **Re-arming a rule
  retro-reviews nothing, and neither does waiving one.**

- **D-249-27: `242`'s owed UAT row 5 does NOT ride this close.** The ROADMAP offered it to Phase
  247. It is a production-promotion row and this phase pushes nothing to production. Leave it owed
  and named rather than absorbing it to make a table look complete.

### Claude's Discretion

Everything above. See the banner: no `AskUserQuestion` was put to a person, and every decision is
Claude's call under the operator's autonomy instruction. The ones most worth an operator's
second look, ranked:

1. **`D-249-01`** — closing `MODEL-09` on a **local** measurement when the bug was **cloud**.
2. **`D-249-18`** — introducing a raised exception into a function that has never raised.
3. **`D-249-16`** — putting the `MODEL-07` fix on the controls rather than adding an affordance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements and their registers
- `.planning/ROADMAP.md` → `#### Phase 249: The Model You Actually Run` — goal, 5 success criteria, and the flags block that set the `MODEL-09` precondition this context discharges.
- `.planning/REQUIREMENTS.md` §*The Model You Actually Run* (lines 103-125) — `MODEL-04` … `MODEL-09` verbatim, each with its originating bug/seed.
- `.planning/reported-bugs/BUG-260908-03-deprecated-reads-as-the-hide-control-and-enabled-does-not.md` — `MODEL-07`. ⭐ Read the *"Why it matters more than a label tweak"* section; it names the affordance that was built and still lost.
- `.planning/reported-bugs/BUG-260909-01-save-app-settings-swallows-a-rejected-write.md` — `MODEL-08`, including its honest *"NOT reachable by a user today"* scoping and its suggested (non-binding) fix direction.
- `.planning/reported-bugs/BUG-260809-01-*.md` — `MODEL-09`. ⛔ **Edit this file at the close; do not merely cite it.**

### Seeds that are answered by EDITING THE SEED, never by shipping
- `.planning/seeds/SEED-172-local-llm-providers-cannot-be-added-through-the-registry.md` — `MODEL-04`'s root cause, and the operator's verbatim 2026-09-13 trigger.
- `.planning/seeds/SEED-040-model-registry-self-service.md` — `status: dormant`; the registry-self-service arm and the eval arm both move here.
- `.planning/seeds/SEED-135-per-role-model-fitness-visible-at-pick-time.md` — `status: open`; its **cheap 80%** (*"surface the tier that already exists in the three pickers"*) is `MODEL-05`. Its expensive half stays open.

### Code the plans will read before they edit
- `backend/app/config.py` — `_PROVIDER_BASE_URLS` (:10-22, the routing roster), `_SELF_HOSTED_PROVIDERS` (:40-44), `_NATIVE_TOOL_PROVIDERS` (:516), `_INFERRED_DEFAULT_TIMEOUT_S` (:533), `_build_inferred_defaults` (:555-600, and **the log sentence `MODEL-05` reuses**).
- `backend/app/services/model_discovery_service.py` — `PROVIDER_ENDPOINTS` (:50-70). ⛔ **Read-only for this phase.**
- `backend/app/api/admin.py` — `add_model_by_id` (:1172-1260), and the three `broadcast_model_overrides_change()` seams (:1352 / :1536 / :1676).
- `backend/app/models/user_settings.py` — `broadcast_settings_change` (:408), `broadcast_model_overrides_change` (:435), `save_app_settings`' write + `except` (:589-623).
- `backend/app/services/settings_broadcast.py` — the publish timeout, the scopes, and `SettingsCacheSubscriber`.
- `backend/app/api/evals.py` — `_tile_for_run` (:2980-3027) and `_build_engine_health_board` (:3030-3060).
- `frontend/src/components/admin/ModelRegistryTab.tsx` — `ADD_PROVIDER_ROSTER` (:1239-1248), `DeprecatedControl` (:994), the `Enabled` `RowToggle` (:523-531), `CouplingChip` (:1089), `RemoveControl`.
- `frontend/src/components/settings/ModelPillRow.tsx` — the chip + `_tooltipFor` (the whole file is 141 lines; read it all).
- `frontend/src/components/chat/MessageInput.tsx` — the model dropdown (:596-665).

### Standing rules this phase is governed by
- `CLAUDE.md` § *Workflow guardrails* — **G-8** (plan count), **G-5** (hot-file ledger), **G-4** (lived-experience UAT), **G-2** (sketch-before-plan, not firing here per `D-249-22`).
- `CLAUDE.md` § *UAT scoreboard recipe* — the full-native-roster rule and **"rows may be blocked, but never silently omitted"**.
- `docs/HOT-FILE-LEDGER.md` — the named seam and binding invariants for every file above. ⚠ **Read this, not the CLAUDE.md table**, which carries the verdict only.
- `.planning/ROADMAP.md` § *DEBT-06 — a standing gate across the whole milestone* — and `D-249-26`, which is this phase's honest position against it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — every one of them already ships
- **The `unverified` chip + its tooltip** (`ModelPillRow.tsx:117-124`) — `MODEL-05` reuses this markup verbatim in the composer. ⛔ Do not write a second chip; two chips drift, and this phase exists because two ROSTERS drifted.
- **`verified_models` + `inferred_provider_for`** — the backend already computes and sends both. `MODEL-05` needs **zero new API surface**; it needs the composer to receive props the settings page already receives.
- **The consequence sentence** (`config.py:589-598`) — already written, already correct, already paid for by the 2026-08-18 invisible-failure day. `MODEL-05` lifts it into the tooltip rather than inventing wording.
- **`broadcast_settings_change` / `broadcast_model_overrides_change` + `SettingsCacheSubscriber`** — `MODEL-06`'s entire mechanism. Nothing to build.
- **`_SELF_HOSTED_PROVIDERS`** (migration 180) — the operator-supplied base URL + key for `ollama` / `lmstudio` / `custom`. This is **why** `MODEL-04` is now a roster widening and not an infrastructure project: the endpoints are already settable from the UI.
- **The in-row 409 refusal slot** (`ModelRegistryTab.tsx`, `data-model-error`) — `MODEL-08`'s 400 lands in a slot that already exists and already renders plain language.
- **The `?raw` backend-import fence pattern** — frontend suites in this repo already import backend `.py` as text to pin a constant. `D-249-08` rides it.

### Established Patterns
- **A list that exists twice will drift.** `_PROVIDER_BASE_URLS` vs `PROVIDER_ENDPOINTS` vs `ADD_PROVIDER_ROSTER` is the third instance of this class in the ledger; `_SELF_HOSTED_PROVIDERS`' own docblock records the last one (*"an `if provider == "ollama"` in FOUR separate files, three with no lmstudio arm"*). **Pin it or it drifts.**
- **Default-SAFE on a registry miss** (`D-122-05`) — degrade to `coerce`, never assume force. Correct, unchanged, and the reason `MODEL-05` is a surfacing change.
- **Honest locks** (Control-Room doctrine) — a control that cannot act is gated **with a tooltip saying why**, never silently inert. `MODEL-07`'s wording change is the same doctrine applied to a control that *can* act but acts differently than it reads.
- **Column names reach SQL only from code constants** — `_ADD_MODEL_CAP_COLUMNS`, `_VALID_COLUMN_NAME`. `MODEL-08` must not weaken this while adding the refusal arm: the constraint **name** may be returned, a client **value** may not.
- **Never log a secret** (`T-081.1-04`) — `save_app_settings` rows carry API keys. `MODEL-08`'s 400 says the **column and constraint**, never the value.

### Integration Points
- `admin.py:1210` — the one-symbol provider-validation swap (`MODEL-04`).
- `ModelRegistryTab.tsx:1239` — the frontend roster (`MODEL-04`), and `:994` / `:523` for the two control labels (`MODEL-07`).
- `MessageInput.tsx:618` — where the dropdown row is built; the chip lands beside the `deprecated` badge (`MODEL-05`), fed by props threaded from wherever `deprecatedModels` already comes from.
- `user_settings.py:~615` — the `except` that becomes two arms (`MODEL-08`), plus its six call sites.
- `evals.py:3009-3020` — the `_tile_for_run` else-branch the `MODEL-09` fence pins.

</code_context>

<specifics>
## Specific Ideas

- **The operator's own words for `MODEL-04`**, from `SEED-172`'s `trigger_fired` (2026-09-13):
  *"I need to add manually from the model registry the models for Ollama or LM Studio and configure
  the timeout and everything, the context."* That sentence is the acceptance bar — **timeout and
  context window are part of the ask**, and `AddModelForm` already carries both fields. The only
  thing stopping it is the provider dropdown.
- **The operator's own words for `MODEL-07`**, from `BUG-260908-03`: *"It is actually called
  deprecated and when toggled, it is still showing in the selector but with a deprecated tag."*
  The fix succeeds when that sentence could not be written about the new controls.
- ⭐ **`SEED-172` fired ~4 weeks after it was planted, and nothing swept the register in between.**
  It took a person hitting the wall. That is `REG-02`'s (Phase 251) case, made concrete by this
  phase's own requirement — worth carrying forward as evidence, not just as a complaint.

</specifics>

<deferred>
## Deferred Ideas

- **The `MODEL_CAPABILITIES` extraction seam** — `config.py` is at **48 phases** with the seam owed.
  This phase touches the file (the roster is there) but must **not** attempt the extraction; a
  roster widening is not the right vehicle for a 48-phase seam. → the next phase that changes
  `MODEL_CAPABILITIES`' *shape*, not its contents.
- **`SEED-088` / dynamic discovery for self-hosted endpoints** — an Ollama or LM Studio server
  exposes `/v1/models`, so the registry *could* populate itself instead of being hand-typed. ⛔ It
  is a new outbound-request surface pointed at an operator-supplied URL — i.e. exactly the SSRF
  question `D-249-07` refuses to open here. → its own phase, with a threat model.
- **`SEED-135`'s expensive half** — per-role fitness (chat / emit / judge) with three different
  bars, and the single-provider-tenant publish block. `MODEL-05` ships the cheap 80%; the roles
  question stays open. → co-scope with `SEED-088`.
- **The `ComposerChipsRow` seam** in `MessageInput.tsx` — named and owed at 15 phases. `MODEL-05`
  adds one chip to an existing row; it does not take the seam. → named here so the next toucher
  inherits it rather than rediscovering it.
- **`SettingsPage.tsx`'s tab seam** — owed at 24 phases. Not touched by this phase.
- **A cloud eval-engine sweep** — `D-249-01` proves the local tree; the cloud half of
  `BUG-260809-01` is unmeasured. → one operator click on the deployed app, whenever they next open
  it. Not a phase, not debt, **not a claim this phase may make**.

</deferred>

---

*Phase: 249-The Model You Actually Run*
*Context gathered: 2026-09-15*
