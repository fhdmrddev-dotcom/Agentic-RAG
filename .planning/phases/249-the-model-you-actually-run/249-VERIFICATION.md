---
phase: 249-the-model-you-actually-run
phase_name: "The Model You Actually Run"
verified: 2026-09-15
status: complete
verification_mode: self-verified
builder: claude
reviewer: claude
independent_review: owed
independent_review_waiver: "Operator instruction, 2026-09-15, verbatim: 'I want you to execute this phase in to end yourself without gemini please proceed autonomously use the tools you have I want to come tomorrow to see it complete.' OV-SOLO-01 / AGENTS.md §6.3 two-agent separation is WAIVED BY INSTRUCTION, not satisfied. This is a FOURTH owed DEBT-06 row beside 238 / 240 / 241."
score: "6 / 6 requirements delivered · 2 with a NAMED limit"
---

# Phase 249: The Model You Actually Run — Verification Report

**Goal:** the model a person wants to run registers itself from the UI, announces what it can and
cannot do before it is used, and reaches every worker — so *"add a model"* stops meaning *"edit
code and deploy"*, and a silent capability loss stops being the failure mode.

**Verdict: PASS**, self-verified, with two limits stated below rather than discovered later.

---

## ⛔ Read this before the verdict

**The builder and the reviewer of this phase are the same agent**, by the operator's explicit
instruction. Everything below is a self-assessment. `DEBT-06` gains a **fourth** owed row.
⛔ **Re-arming a rule retro-reviews nothing, and neither does waiving one.** This phase may not be
recorded anywhere as peer-reviewed.

**Every measurement is LOCAL, at `develop`.** Nothing here says anything about cloud.

---

## Success criteria, against the ROADMAP's own wording

### SC#1 — a local/self-hosted model is added from the Model Registry UI, then selectable and usable in chat, with no code edit and no deploy (`MODEL-04`)

**MET, with one half named as unproven.**

Driven live: `POST /admin/models` with `provider: ollama` → **200 `enabled:false`**; the same for
`lmstudio` and `custom`; `definitely-not-a-provider` still **422**. The registry now renders **11**
provider sections (`ollama` and `custom` had never existed); the Add form offers **11** options.

⛔ **NOT PROVEN: *"and usable in chat"* end to end.** No live self-hosted endpoint was verified
answering during this run. The row is created, disabled-by-default and enable-able; a real
completion through such an endpoint was not driven. **One operator action closes it** — start the
server, set its base URL, enable the model, send one message.

### SC#2 — picking a model absent from the capability registry says so at pick time (`MODEL-05`)

**MET, and driven in a real browser rather than only in a test.**

The composer's model dropdown rendered **13 rows for `ollama`, 7 carrying the `unverified` chip**.
⭐ The operator's **currently selected** model is one of the seven, and its chip states the
consequence in full: *"tool calling is DISABLED for it… any tool call it tries will arrive as
unreadable text. Add a row for it in the Model Registry…"*.

⭐ **13 of the operator's configured models will silently lose tool calling.** Until this phase,
nothing said so at pick time.

⛔ The pick is **not blocked** — `D-122-05`'s default-SAFE degradation is correct and untouched,
pinned by a case.

### SC#3 — a registry/settings change is visible on the next request no matter which worker serves it (`MODEL-06`)

**MET BY CONSTRUCTION AND BY FENCE. ⛔ NOT MET BY MULTI-WORKER OBSERVATION, and that is stated
rather than glossed.**

The mechanism shipped with `BUG-260902-06` and was measured present at all three registry write
seams plus the one `app_settings` write seam, with `SettingsCacheSubscriber` constructed at
lifespan. It is now **pinned in both directions**, including the negative one (the two WR-03
read-before-guard sites must **not** broadcast), **driven RED against a planted broadcast**.

⛔ **`WORKER_COUNT=2` does not exist in this environment.** Measured: two independent
`uvicorn --reload` servers are running on port 8000 from different Python installs — and
`--reload` implies a single worker. The cross-**request** half was driven: one write, **ten
consecutive reads, 10/10 unanimous**. The cross-**worker** half rests on the fence and the shipped
subscriber. ⚠ The two-server condition is itself a live environment hazard worth the operator's
attention.

### SC#4 — the hide control is the discoverable one, and a refused settings write reports failure (`MODEL-07`, `MODEL-08`)

**MET, both halves.**

`MODEL-07`: 17 `deprecated` notes and 17 `Enabled` descriptions render in the live Control Room,
each bound by `aria-describedby` (resolved through the DOM, not assumed). `deprecated` says it does
**not** hide the model and names `Enabled` **and** `Remove`. ⛔ Its semantics are unchanged
(`D-149-04`), pinned by a case.

`MODEL-08`: reproduced live first — `set 0/51/999 → returned False` — then fixed. A refused value
now raises `SettingsWriteRefused`, and `PUT /settings` plus the three admin write seams answer
**400** naming the column and the rule; an unreachable database is still a **500**, byte-identical.

### SC#5 — every configured eval engine reports healthy or names its own cause (`MODEL-09`)

**MET BY MEASUREMENT, and the limit is stated in the same breath.**

The ROADMAP made this conditional on a re-measurement, and the sweep was driven rather than
assumed: fresh board **8/8 healthy, zero errors, zero opaque `provider_error`**; the stale
2026-08-27 board read 7/8 with its one failure carrying a verbatim vendor `RateLimitError`.
`BUG-260809-01`'s two claims — *"0/8 healthy"* and *"6 of 8 hide why"* — are **both refuted on this
tree**.

⛔ **The original was measured on CLOUD production, 2026-08-09. This is LOCAL.** What is proven is
that the application does not **manufacture** an opaque cause — now fenced, and the fence was
driven RED against a plant that moved the engine-shaped sentence one branch higher. What is **not**
proven is that cloud's eight engines are healthy today.

---

## Gates — every figure RE-DERIVED, none read from a builder's claim

| Gate | Baseline (before the first edit) | At close | Verdict |
|---|---|---|---|
| Backend unit | **71 failed** / 4761 passed / 2 xfail / 2 xpass / **0 collection errors** | **71 failed** / 4788 passed / 2 / 2 / **0** | ✅ **The SET is identical** — all 71 names match, not just the count |
| Frontend count gate | `count gate OK` · 8300 · failed 0 · pinned 7493 · **279/279** | `count gate OK` · **8346** · **failed 0** · pinned **7539** · **283/283** | ✅ **+46 attributed exactly**: 29 + 4 + 6 + 7, this phase's four suites. No residual |
| Hot-file ledger | 4 files named by plans with **no row** | `ledger gate OK — every watched file has a row` · 276 scan rows · 30 subject files | ✅ non-vacuous (the parse count is checked, per Phase 242's vacuous-pass finding) |
| `tsc -p tsconfig.app.json` | 32 files with errors | 31 files with errors, **zero NEW** | ✅ measured as a **set diff** — "zero errors" is not reachable in this repo |

⚠ **The backend `passed` count CLAUDE.md publishes (3497) is stale by ~1,290.** It is not the gate
— the gate is the failing count — but a reader comparing `4788` to `3497` would be reading the
wrong number. Recorded so that inference is not made.

⚠ **`count gate OK` was GREEN at baseline for this phase**, unlike Phase 248's. So it was a
reachable acceptance criterion here, and a red run would have been a finding.

---

## Fences driven RED against planted defects, then restored

⭐ Six, because **a guard nobody has seen fire is not a guard** — Phase 242 measured two of this
project's guards passing vacuously.

| Fence | Plant | Restored |
|---|---|---|
| `addProviderRoster.lockstep` (frontend roster short) | roster left at 8 | ✅ |
| `addProviderRoster.lockstep` (backend roster longer) | a 12th provider in `_PROVIDER_BASE_URLS` | ✅ named the drifted provider in its failure message |
| `hideControlLegibility` | `deprecated` copy weakened to *"Marks this model as deprecated."* | ✅ 2 of 6 cases fired |
| `MessageInput.unverified` | `isUnverified = false` | ✅ 3 of 7 cases fired |
| WR-03 read-does-not-broadcast | a broadcast planted at a read-before-guard site | ✅ `admin.py` restored |
| engine-shaped-sentence-is-last | the constant moved one branch higher | ✅ `evals.py` **byte-unchanged** (`git diff --stat` empty) |

⭐ **The first plant found a real bug in the fence itself** — its parser matched the *continuation
lines* of nested dicts, so the roster read far longer than it was. A fence written and never failed
would have shipped counting `"auth"` and `"key_env"` as providers.

---

## Self-check on the riskiest decision (`D-249-18`)

`D-249-18` — *introducing a raised exception into a function that has never raised* — was flagged at
discuss-phase as the change most worth an operator's second look. It was re-audited at close:

- **All six call sites confirmed by a repo-wide grep**, not by reading the plan back. `grep -rn
  "save_app_settings(" --include=*.py` (venv and tests excluded) returns exactly the six, and no
  seventh exists anywhere — no script, no service, no migration helper.
- **The two propagating sites end in a generic 500, not a leak.** There is **no global
  `exception_handler`** registered anywhere in `app/`, so FastAPI's default applies:
  `{"detail":"Internal Server Error"}` to the client, traceback to the log.
- **`raise ... from None` is load-bearing on exactly this path.** It sets `__suppress_context__`,
  so Python's traceback printer omits the original `CheckViolationError` — and with it the
  `DETAIL:` line carrying the whole `app_settings` row. Without it, an *uncaught* refusal on the
  setup path would have printed every `enc:v1:` envelope into the server log.
- ⚠ `setup_service.py`'s write is `{f"{provider}_api_key": ...}` — so if that path ever refuses,
  `detail()` names an **api_key COLUMN**. A column name is schema, not a secret, and the value is
  never included. Stated because *"the exception names the column"* sounds different when the
  column is called `_api_key`.

## Guardrails

| Rule | Status |
|---|---|
| **G-8** plan count | ✅ **4 plans** for 6 requirements, two of which were verification not build |
| **G-5** hot-file ledger | ✅ gate green; **5 rows added that had never existed** — `lib/api/settings.ts`, `unverifiedModelCopy.ts`, `api/setup.py`, `services/setup_service.py`, and `api/evals.py` (⚠ **FIRING at 7 phases**, and the plan that added its row left the file byte-unchanged) |
| **G-2** sketch | ✅ correctly not fired — the ROADMAP made it conditional and no visual decision arose |
| **G-4** lived-experience UAT | ✅ 3 scenarios, all driven in the browser. ⛔ **Claude's scenarios, not the operator's** — labelled as such |
| **SC#10** cross-provider | ✅ **11 rows**, not 8 — derived from the live configuration, at zero LLM cost |
| **G-1 / G-3 / G-7** | not applicable — no phase insert, no `/gsd:fast`-sized item split out, no gap-closure round |
| Migration | ✅ none needed; head stays at **181** |

---

## ⛔ Owed at close — five items, none a defect

1. **`MODEL-04` end-to-end in chat** — needs a live self-hosted endpoint.
2. **`MODEL-06` multi-worker observation** — not reproducible on this box.
3. **`MODEL-09` cloud sweep** — one operator click on the deployed app.
4. **`DEBT-06`: an independent review of this phase** — waived by instruction, not satisfied.
5. **`SEED-172` findings #2/#3/#4** — ⚠ **#2 (the 600 s SDK ceiling `get_llm_client` never sets)
   bites exactly the local models this phase just unblocked.** A local model is precisely the kind
   you would give a 900-second timeout, and httpx's read timeout would bind instead, surfacing as
   `APITimeoutError` rather than the `asyncio.TimeoutError` the loop classifies — with
   `max_retries=2` tripling the attempt.

⛔ **242's owed UAT row 5 is deliberately NOT ridden by this close** (`D-249-27`) — it is a
production-promotion row and this phase pushes nothing to production.

---

## Two environment findings for the operator, outside this phase's scope

1. ⚠ **Two independent `uvicorn --reload` servers are running on port 8000**, from
   `backend/venv` and `C:\Python312`. This repo has a recorded memory for exactly this trap. It is
   why `MODEL-06`'s multi-worker arm could not be observed.
2. ⚠ **`qwen3-coder:30b` was left in the registry, DISABLED**, as visible evidence of `MODEL-04`.
   Remove it in one click if unwanted. The two probe rows were deleted.
