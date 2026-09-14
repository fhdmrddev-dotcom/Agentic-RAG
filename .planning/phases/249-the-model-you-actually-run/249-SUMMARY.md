# Phase 249 — The Model You Actually Run · SUMMARY

**Built:** 2026-09-15, in one autonomous run (discuss → plan → execute → verify).
**Builder:** Claude. **Reviewer:** Claude. ⛔ **Same agent — see *"What this phase may not claim"*.**
**Commits:** `603b843c2` (context) · `abbaa2750` (plans + baselines) · `2505d4758` (MODEL-04/05/07) ·
`06490edd7` (MODEL-08 + the MODEL-06/09 fences).

---

## In one paragraph

Adding a model you actually run stopped meaning *"edit code and deploy"*, and picking one stopped
being silent about what it will not do. Two of the six requirements turned out to be **already
built** — the phase measured that before planning and did not rebuild them. One turned out to be a
defect that **no longer reproduces**, and was closed in writing with its limit stated rather than
fixed for show. The three that were real were small, and each was reproduced against the live
system before a line was changed.

---

## The finding that shaped the phase

⭐ **Two of six requirements were already satisfied in code before the phase opened, and a third's
defect did not reproduce.** The method that caught all three was the same: **measure the tree
before planning the fix.**

| Req | Expected | Measured |
|---|---|---|
| `MODEL-06` | build cross-worker cache invalidation | **already shipped** — `broadcast_settings_change` + `broadcast_model_overrides_change` + `SettingsCacheSubscriber`, wired at all three write seams |
| `MODEL-09` | fix 0/8 unhealthy eval engines hiding their cause | **8/8 healthy, zero opaque `provider_error`** on a fresh sweep |
| `BUG-260908-03` | add the missing hide control | **three** hide-ish controls already exist; the report predates one of them (`Remove`, mig 179) |

⚠ **This is the second consecutive phase where a headline defect was already fixed before the phase
opened** (248's `CRED-02` at `e615c0dad`). Two data points make it a pattern worth stating as a
rule, not an anecdote.

---

## What shipped, requirement by requirement

### MODEL-04 — the registry accepts the models you actually run

**The defect was one symbol, and it had two layers.** `POST /admin/models` validated its `provider`
argument against `model_discovery_service.PROVIDER_ENDPOINTS` — the **SSRF discovery allowlist**,
8 cloud providers — instead of `config._PROVIDER_BASE_URLS`, the **routing roster**, 11. The gap is
exactly `ollama` / `lmstudio` / `custom`. The frontend hand-typed the same 8 a third time.

So a self-hosted model was refused `422 Unknown provider` **and** could not be selected in the form
— for the endpoint's entire life.

- `config.py` gains `ROUTING_PROVIDERS = frozenset(_PROVIDER_BASE_URLS)` — **derived**, not a fourth
  list.
- `ModelRegistryTab.tsx`'s roster widens 8 → 11 and is **pinned** to the backend by a `?raw`
  lockstep fence that reads `config.py` at test time.
- ⛔ **`PROVIDER_ENDPOINTS` is byte-unchanged**, and two fences fail if a self-hosted provider ever
  reaches it. Widening the routing roster is safe precisely because a self-hosted provider's base
  URL comes from the operator's own `app_settings` column (mig 180) — the server never *discovers*
  it, so it has no business in a discovery allowlist.

### MODEL-05 — the warning moved to where the choice is made

**The chip already existed. It was on the wrong surface.** `ModelPillRow` (Settings) has rendered
an amber `unverified` chip since Phase 075.3, fed by `verified_models` + `inferred_provider_for` —
fields `GET /settings` already sent. The chat composer's dropdown, where a model is actually
**picked**, had no marker at all.

- `GET /settings/providers` now carries `verified_models`, `inferred_provider_for` and
  `inferred_tools_lost`, all computed from the overrides dict it **already fetched**.
- ⭐ **`verified_models` was BUILT-INS ONLY**, so a model added through MODEL-04's new door would
  have rendered as *unverified*: **fixing one requirement would have lit the other's warning.** It
  is now the union with operator-entered rows.
- The chip's words state the **consequence** — tool calling disabled, structured mode, tool calls
  arriving as unreadable text — lifted from `config.py`'s own wording, which reads that way because
  the previous phrasing (`safe_defaults_applied=True`) **hid a total tool-calling failure for a day
  on 2026-08-18**.
- ⛔ It is a warning, never a refusal. `D-122-05`'s default-SAFE degradation is correct and
  untouched; a case pins that the option is still selectable.

### MODEL-07 — the controls explain themselves

`deprecated` keeps its meaning (`D-149-04`), nothing is renamed, and **no fourth passive affordance
was added** — the `Users see` column already was that, and was still lost in real use. The words
went **on the controls**: `deprecated` carries a visible sentence naming `Enabled` and `Remove`;
`Enabled` carries a screen-reader description.

### MODEL-08 — a refused write reports failure

Reproduced live first, exactly as the report described: `set 0 / 51 / 999 → returned False`, value
unchanged at 25, while Postgres rejected every one. `save_app_settings` now raises
`SettingsWriteRefused` on the refusal family and still returns `False` for everything else; four
call sites answer **400** naming the column and the rule, and the two setup paths **deliberately
propagate**.

⭐ **A second finding the reproduction surfaced, which the bug report does not mention:** the old arm
logged with `exc_info=True`, and asyncpg's `CheckViolationError` carries a `DETAIL:` line holding
**the entire failing row** — `enc:v1:` secret envelopes and the operator's tunnel URL included.
`T-081.1-04` forbids that. **A silent failure had a quiet disclosure sitting beside it.**

### MODEL-06 and MODEL-09 — proven and closed, not rebuilt

Both already true. Each got a **fence driven RED against a planted defect** and then restored
byte-identical, because what did not exist was anything that would notice a regression.

---

## Four green fences that were hiding something

⭐ **The most useful output of this phase is not the code. It is four places where a test was green
over a defect.**

1. **`ModelRegistryTab.test.tsx` asserted `getAllByRole("option")).toHaveLength(8)`.** The 8 *was*
   the defect. A green fence pinned `SEED-172` in place for the component's whole life.
2. **…and it was running outside the count gate entirely.** `src/components/admin/` had one named
   entry and no directory entry. **A fence outside the gate that pins a bug is worse than no
   fence — it reads as coverage.**
3. **`ModelPillRow`'s tooltip claimed `timeout=90s`** against a real default of **300**, revised
   2026-05-24 and never propagated — **on the surface whose whole job is telling the truth about a
   model's capabilities**.
4. **`SettingsModelBadge.test.tsx` asserted the false number.** The fence did not catch the drift
   because the fence *was* the drift.

All four are closed: the count now derives from the exported roster, three suites were adopted into
both knobs, and the copy lives in one module both surfaces read.

---

## Three measured corrections to my own work, recorded rather than quietly fixed

1. **The lockstep fence's parser was wrong on its first run.** `^\s+"key":` also matched the
   *continuation lines* of `PROVIDER_ENDPOINTS`' nested dicts, so the roster read far longer than it
   was. **Driving the fence RED is what found it** — a fence written and never failed would have
   shipped a parser that counted `"auth"` and `"key_env"` as providers.
2. **A comment inflated the `grep -c` that proves a G-5 discharge.** Writing *"state hooks 9, effect
   hooks 10"* into `ChatArea.tsx` made the raw count read 10 and 11. The file's own docblock already
   warns about this trap for `useComposerModel`. **A verification method a comment can break is
   worth knowing about before it is quoted as evidence.**
3. **A test asserted an unreachable state.** The first draft of the picker-feed fence monkeypatched
   `load_all_model_overrides` to raise and asserted a 200 — but that function **never raises**
   (it carries its own `except`). The second draft counted calls and measured **2**, where the
   second read is **pre-existing** in `load_app_settings_async`. The invariant was moved to where
   it actually lives: the handler's own source.

---

## Deviations from the plans

- **Plans 01 and 02 were committed together** (`2505d4758`), and 03 with 04 (`06490edd7`). The four
  plans share `scripts/vitest-count-gate.cjs`, `admin.py`, `settings.py` and the ledger; splitting
  the commits would have required staging hunks rather than files. The SUMMARY and the ledger
  sections disaggregate them.
- **Plans were executed serially in the main tree, by one agent**, not in parallel worktrees. With
  four plans sharing four files, parallel worktrees would have collided at merge for no wall-clock
  gain on a single-agent run.
- **`MODEL-08`'s refusal cases use the patched pool**, with the real constraint driven separately
  and its transcript recorded. The branch is our code and a mock is the right instrument for it;
  the claim *"the database refuses this value"* is **not** taken from a mock.

---

## ⛔ What this phase may NOT claim

- **Peer review.** Builder and reviewer are the same agent, by the operator's explicit instruction
  (*"without gemini"*). This phase closes `verification_mode: self-verified`,
  `independent_review: owed`, and adds a **fourth** owed row to `DEBT-06` beside 238 / 240 / 241.
  ⛔ Re-arming a rule retro-reviews nothing, and neither does waiving one.
- **Anything about cloud.** Every measurement is local, at `develop`. `MODEL-09`'s closure proves
  the application does not *manufacture* an opaque cause; it does not prove cloud's engines are
  healthy today.
- **Multi-worker verification.** This box runs **two independent single-worker `--reload` servers**
  on port 8000, so `WORKER_COUNT=2` does not exist here. Cross-request visibility was driven 10/10;
  cross-worker rests on the fence and the shipped subscriber.
- **`MODEL-04` end-to-end.** The registry row is created and selectable. A real completion through a
  live self-hosted endpoint was not driven.
- **That any register is now clean.** Three bugs closed and three seeds answered — **all three
  seeds `partially-answered`, with five live findings named**, not swept.
