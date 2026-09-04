# Phase 223 — PREFLIGHT

**Written 2026-09-02 by Claude (reviewer), before Gemini plans.** Base `3f2738d9f`, branch
`develop`, working tree carrying no code changes.

**What this is.** ⚠ **Not build direction.** I do not send Gemini design; design questions go to
the operator (`AGENTS.md` §3). This file carries only things I **measured at HEAD** that the
proposal and `BUS-056` either state incorrectly, state incompletely, or leave to be assumed — so
that a wrong inherited claim cannot become a shipped defect. Everything below was **driven**, not
reasoned about, and the command or file:line is given so it can be re-derived rather than trusted.

**Reviewer independence.** I wrote the proposal and the bus hand-off. That makes this a
**pre-flight of my own scoping document**, and its most valuable content is therefore the section
that says where my own document is **wrong** — §2. `AGENTS.md`'s rule is that whoever reviews must
not have shaped the build; I shaped the *scope*, so the post-phase check (§6) is the one that has
to be driven hardest, and I say so here rather than after.

---

## 1 · The finding is CONFIRMED live at HEAD, today

Not inherited from the 2026-09-02 drive — re-measured against the local DB while writing this.

```
public.audit_log — 6,256 rows.  Newest row per action_type:
  code.execute    2026-09-02 14:09:32Z     <- the UAT drive day
  search.query    2026-09-02 14:09:04Z     <- the UAT drive day
  settings.update 2026-09-01 19:44:24Z
  document.upload 2026-09-01 19:41:04Z
  skill.load      2026-09-01 05:35:54Z
  memory.recall   2026-08-31 17:40:43Z
  document.delete 2026-08-30 11:42:40Z
  thread.create   2026-07-19 09:11:23Z
```

⭐ **The inversion is real and current.** Internal tools wrote rows on the very day the connector
call ran. **No connector row exists at any date** — there is no `action_type` that could hold one.

**`GRANT-05` is met for the empty set.** That stands.

⚠ **One count correction:** `tool_dispatcher.py` has **7** `write_audit_entry` call sites, not
eight (744, 841, 1008, 1358, 2251, 2300, 2345; line 43 is the import). Seven action types:
`search.query` ×3, `skill.load`, `code.execute`, `memory.remember`, `memory.recall`. The claim's
substance is unchanged; the number in `BUS-056` is wrong and is corrected here rather than left to
be discovered.

---

## 2 · CORRECTIONS to the proposal and to `BUS-056`

### 2.1 ⭐ THE `Always allow` BUTTON DOES NOT GO THROUGH `update_grants`. This is the one that would ship the phase broken.

The proposal names `update_grants` in `api/connectors.py` as the site with no receipt. **That is
true and it is the wrong site.** It is the **Settings › Connections** form.

The approval card's `Always allow` — the button the proposal itself calls *"the most consequential
button on the approval card"* — goes somewhere else entirely:

| surface | route | service primitive |
|---|---|---|
| Settings › Connections form | `api/connectors.py::update_grants` | `connector_service.update_connection_grants` — **whole-column REPLACE** (D-206.2-16) |
| **chat approval card** | **`api/threads.py:1526`** | **`connector_service.grant_one_tool`** — **read-merge-write** |

They are **deliberately different primitives** — `grant_one_tool`'s own docstring says
`update_connection_grants` is *"the WRONG primitive"* for the card, because a whole-column replace
driven from a browser would put a lost-update race on a permission surface.

⚠ **So instrumenting `update_grants` alone would audit the settings form, leave the card
unaudited, and satisfy SC#1a on paper.** Every gate would be green. This is precisely the
seam-between-two-halves failure the 204 pre-flight is recorded as having missed twice.

**Two further facts that bear on how this gets covered — stated as constraints, not as a design:**

- **Neither service function takes an actor.** `grant_one_tool(connection_id, org_id, tool_name,
  posture, supabase)` and `update_connection_grants(connection_id, org_id, tool_grants, supabase)`
  have no `user_id`. **`audit_log.user_id` is `NOT NULL`** (§4.2). Whatever shape is chosen, an
  actor has to be threaded to wherever the write lands.
- **`api/threads.py` is the second-hottest file in the ledger** — `238 / 78 / 1408`. It is **not
  named in the proposal's blast radius**, and a write placed there is a G-5-firing hot-file touch
  that discuss-phase should see coming rather than discover.

### 2.2 ⭐ THE SILENT-FAILURE MECHANISM IS STATED BACKWARDS. Registering the type is what makes it LOUD.

Both the proposal (SC#4) and `BUS-056` say *"a new `action_type` that is not registered in
`VALID_ACTION_TYPES` fails SILENTLY."* The conclusion is right; **the mechanism is the inverse of
what that sentence implies, and the difference changes what the fix has to be.**

Measured in `backend/app/services/audit_service.py`:

- **`write_audit_entry` does NOT consult `VALID_ACTION_TYPES`.** It builds the insert dict and
  writes. The frozenset is referenced at lines 13, 30, 48, 51 — the definition, the boot guard's
  docstring, and the boot guard — **and nowhere in the writer.** A write of an unregistered type
  is not blocked by the frozenset; it is blocked by the **live `audit_log_action_type_check`
  CHECK constraint**, which raises `23514`, **which `write_audit_entry` swallows** (`except
  Exception: logger.error(...)`).
- **`assert_action_types_synced` (called from `main.py:395`, lifespan) hard-fails boot** if the
  frozenset is not a subset of the live CHECK. It is documented in `main.py` as *"the ONE
  un-guarded DB hard-fail"*.

So the four combinations are:

| frozenset entry | migration | result |
|---|---|---|
| no | no | ⛔ **the silent bug** — CHECK raises 23514, swallowed, row never lands, every gate green |
| no | yes | row lands, but nothing guards the pair from drifting apart later |
| **yes** | **no** | ✅ **boot HARD-FAILS with a named error** — the failure is loud and immediate |
| yes | yes | ✅ correct |

⭐ **The frozenset entry is the SAFETY NET, not the gate.** Adding the type to
`VALID_ACTION_TYPES` is what converts a silent row-drop into a startup crash that names the
missing type. The two must land in the **same commit**, and the frozenset half is the half that
makes a mistake visible.

### 2.3 There is no wrong timeout copy to correct — the payload carries none at all

The proposal's SC#3 and `BUS-056` describe *"the model INVENTS the recovery, telling the person to
check the workspace panel … and to re-authorize a connection that is perfectly healthy."* The
observed behaviour is real. **But the tool result it is inventing from is factually neutral:**

```python
# tool_dispatcher.py:4452
"status": "timeout",
"message": f"Tool execution '{action_tool_name}' on {matched_conn.name} timed out waiting for approval."
```

Nothing there mentions a panel or re-authorization. ⭐ **The model invents recovery because the
payload supplies none.** SC#3 is therefore an **addition** (give the refusal path the true
recovery sentence, and/or constrain it in the prompt), **not a correction of existing wrong
copy** — and a test that greps for the removal of a wrong string would find nothing to remove and
pass vacuously.

The rejection payload at `:4445` has the same shape.

### 2.4 The `tool_dispatcher.py` ledger triple is STALE AGAIN — re-derived here

```
git log --oneline -- backend/app/services/tool_dispatcher.py | wc -l   -> 76
phase buckets (dated quick tasks 260529, 260705 excluded)              -> 31
wc -l                                                                  -> 4643
```

| | ledger row / `BUS-056` say | **measured 2026-09-02** |
|---|---|---|
| commits | 72 | **76** |
| phases | 29 | **31** |
| lines | 4624 | **4643** |

**G-5 fires.** The row was already found stale once; it is stale again, by two phases. Re-derive
at discuss-phase — do not quote this table either, it will rot too.

### 2.5 The audit gap in `api/connectors.py` is wider than `update_grants`

`grep -n "write_audit_entry" backend/app/api/connectors.py` returns **zero matches.** The only hit
for `audit` in that file is a comment at `:229`.

So **no route in the connectors router writes an audit row** — not `update_grants`, and not
connection create or delete either. **I am recording the measurement, not proposing the scope.**
Whether 223 covers the whole router or only the grant paths is a scope decision, and per
`AGENTS.md` it belongs to the operator. ⚠ It should be **decided out loud**, because silently
widening to the whole router is the "closure rounds smuggle in features" failure G-7 exists for.

---

## 3 · Construction hazards — measured, ranked by how quietly they bite

### 3.1 The refusal and timeout returns happen BEFORE execution. An audit after the call misses them.

`_handle_connector_chat_tool` spans **`tool_dispatcher.py:4322-4605`** and has **nine exit
points**. SC#1 requires *"a refusal and a failure are recorded too, not only a success"* — and
**five of the nine exits are exactly those cases, and four of them return before the execute
block at `:4466`:**

| line | exit | SC#1 says |
|---|---|---|
| 4337 | no authenticated user in context | ⚠ **unauditable** — no `user_id`, and `audit_log.user_id` is `NOT NULL` |
| 4351 | org scope could not be resolved | not a connector call; a precondition fault |
| 4372 | `list_connections` failed | precondition fault |
| 4388 | no matching connection | precondition fault |
| **4401** | **denied by policy** | ⭐ **a REFUSAL — must be recorded** |
| **4445** | **user rejected** | ⭐ **a REFUSAL — must be recorded** |
| **4452** | **approval timed out** | ⭐ **a REFUSAL — must be recorded** |
| **4585** | **execution failed** | ⭐ **a FAILURE — must be recorded** |
| **4605** | success | ⭐ must be recorded |

⭐ **A single write placed near the return at `:4605` satisfies a green test and fails SC#1
outright.** The four early refusal/failure exits are the cases an audit exists for.

⚠ **`:4337` deserves an explicit decision rather than silence.** With no user in context there is
no legal `audit_log` row. Saying so in the plan is honest; leaving it unmentioned reads as covered.

### 3.2 The live-audit test SKIPS when the DB is down, and a skip reads green

The precedent SC#4 needs **already exists in the repo** — `backend/tests/integration/test_116_audit_live.py`,
whose docstring is almost the wording of SC#4:

> *"`write_audit_entry` SWALLOWS errors, so only a live read of the row proves the writer actually
> fired."*

Siblings: `test_110_dm_audit_live.py`, `test_110_audit_drift_guard.py`.

⚠ **But that harness "skips cleanly when :54322 is unreachable."** A test that skips is not a test
that passed. **SC#4 is satisfied by a RUN with the DB up whose output is recorded**, not by the
test's existence. If a summary says *"the live audit test passes"* without the run showing it did
not skip, SC#4 is unverified.

### 3.3 `_ALL_19` is a hardcoded literal — a 20th action type turns `test_110_boot_guard.py` RED, correctly

`backend/tests/test_110_boot_guard.py:43` builds `_ALL_19 = _TYPES_MISSING_ONE +
["metadata.field.create"]` as a **literal list**, independent of the frozenset. Adding a type to
`VALID_ACTION_TYPES` makes `test_boot_guard_synced_no_raise` fail, because the frozenset is no
longer a subset of that stub CHECK.

⭐ **That red is the guard working, not a flake, and not one of SEED-171's five.** It must be
updated in the same commit as the frozenset and the migration. Recorded here so it is not triaged
as noise, or "fixed" by loosening the assertion.

### 3.4 The next migration is `152`, and `151` is LOCAL ONLY

`ls supabase/migrations/ | tail` gives `128, 129, 140, 141, 150, 151`. **Next number: `152`.**

⚠ **`151_connector_tokens_rls_policy.sql` is applied locally and NOT in cloud** (operator, open
item). A `152` inherits the same exposure, and per `CLAUDE.md` the cloud failure mode for a
policy-less table is **silent** — a read returns empty, not an error. Whatever 223 ships, the
migration is an operator parity action, not something the phase can close by itself.

---

## 4 · Things I measured so nobody has to re-measure them

### 4.1 `public.messages` — schema-scoped, confirming the near-miss

```
id · thread_id · user_id · role · content · created_at · updated_at
tool_calls jsonb · source_refs jsonb
confidence_level · confidence_avg_similarity · confidence_disclaimer
reasoning_content · origin · org_id
```

⭐ **There is no `payload` and no `metadata` jsonb.** The proposal's near-miss is confirmed: that
column belongs to `realtime.messages`. **`tool_calls` and `source_refs` are the only jsonb columns,
and neither honestly means "armed connectors."** A migration is required for the armed set if it
lives on the message row.

### 4.2 `public.audit_log` — every column is `NOT NULL`

`id`, `user_id`, `action_type`, `metadata jsonb`, `created_at`, `org_id` — **all NOT NULL.**
Consequences: an actor is mandatory (§2.1, §3.1), and `metadata` must be an object, never null.
`write_audit_entry` takes an optional explicit `org_id`; passing it makes the mig-106 autofill
trigger a no-op, which is the only way a multi-org actor's row lands on the right org.

### 4.3 The live CHECK enum is exactly the 19 in the frozenset

```
classification.apply · classification.rule.create · code.execute · document.delete
document.upload · feedback.submit · memory.recall · memory.remember
metadata.field.create · metadata.update · relationship.create · relationship.delete
search.query · settings.update · skill.load · thread.create · thread.delete
view.create · view.delete
```

No spare capacity, no unused type to borrow. Any new type needs migration `152` **and** the
frozenset entry (§2.2).

### 4.4 ✅ The out-of-scope fence around workflow runs is REAL — now measured, not assumed

The proposal says whether workflow-run connector calls share the hole is *"not determined."* It is
now determined, and **the fence holds**:

- `execute_service_tool` has **exactly one call site** in the whole backend —
  `tool_dispatcher.py:4524`.
- Connector tools are only ever offered when `run_agent_loop` (`agent_loop.py:1533`) computes
  `allowed_ids` from **`body.active_connector_ids`**, and *"absent and empty both mean none."* A
  harness phase carries no such field, so the connector namespace is never built for it.
- The harness has its own separate ledger path — `_spawn_tool_refused_audit`
  (`tool_dispatcher.py:4236`) into **`harness_audit`** via `db/workflows.write_audit`, requiring
  `ctx.pool` and a run id.

⭐ **So the chat connector path and the workflow path are genuinely different call sites, and
excluding the latter is a real boundary rather than a convenient one.** Whether `harness_audit`
has an equivalent hole is still not determined — and still must be measured, not assumed, by
whoever takes it.

### 4.5 Everything SC#1 needs is in scope at the call site

`ToolContext` carries **`supabase`** and **`spawn`**, which is exactly how the existing seven
writes fire (`ctx.spawn(write_audit_entry(..., supabase=ctx.supabase))`, e.g. `:841`). Inside
`_handle_connector_chat_tool`: `matched_conn.name`, `matched_conn.id`, `matched_conn.service_id`,
`action_tool_name`, `args`, `ctx.current_user["id"]`, and the outcome. **The proposal's "a missing
write, not a missing design" is confirmed for the chat path.** It is **not** confirmed for the
grant path, which needs an actor threaded (§2.1).

### 4.6 `MessageInput.tsx` — the OFF rule is at `:82`, and the map at `:84`

The quoted sentence *"Off now means off — and on stays on for the conversation you said it in"* is
at **`:82`** (`BUS-056` says `:81`). The store is `const activeConnectorsByThread = new Map<string,
string[]>()` at **`:84`**, module-scoped, cleared only by `_resetComposerDraftsForTest`. **The
reload defect is confirmed**: a module global dies with the tab.

⚠ The docblock also records that the empty-selection-means-everything bug was closed on
2026-08-31, and that this map is *"part of the fix, not a feature riding along with it."* **Any
change to where the armed set lives inherits that constraint** — SC#2's "an explicit OFF stays
off" is not a nicety, it is the previous defect's fix.

---

## 5 · Gate baselines

Handed over in `BUS-056` and re-derived by the operator on this tree:

| gate | baseline | note |
|---|---|---|
| `tsc` | **66** | ⚠ **`-p tsconfig.app.json`** — the bare form checks **zero** files |
| vitest count gate | **OK 188/188 · total 7155 · pinned 6432 · failed 0** | `GSD_VITEST_MAX_WORKERS=2`, from the repo root |
| backend unit | **70 failed IS the baseline** | not a regression |

⚠ **A growing count-gate total is the gate working** — its contract is no per-file decrease and
zero failing, never a fixed total.

⚠ **If a suite reds, capture the filenames from the gate's persisted JSON BEFORE re-running
anything.** `WorkflowBuilderPage.canvas.test.tsx` — one of SEED-171's five — went red once for me
on a byte-unchanged tree. **And red is not always flake:** a red of `test_110_boot_guard.py` is
§3.3 and is real.

---

## 6 · What I will check after execution, driven

Recorded now so it is a contract rather than a verdict chosen afterwards — and because the
independence note above means my post-check has to be harder than usual, not softer.

1. **A row actually lands.** Run the real chain — arm a connection, let the agent propose a call,
   approve it — then **read `public.audit_log` directly** for a row newer than the call carrying
   service, tool, actor and outcome. Not a mock assertion, not a test report.
2. **All four SC#1 outcomes.** Success, **policy denial**, **reject**, **timeout**, **execution
   failure** — each driven or forced, each read back from the table (§3.1).
3. **`Always allow` from the CARD**, not from Settings — the §2.1 seam. Click the card's button and
   read the table.
4. **The boot guard is intact.** The new type is in `VALID_ACTION_TYPES` **and** in the live CHECK,
   and `assert_action_types_synced` still passes at boot (§2.2).
5. **The live audit test RAN and did not SKIP** (§3.2).
6. **Reload with something explicitly OFF**, and confirm it comes back OFF (§4.6). A restore that
   re-arms is worse than the bug.
7. **The three gates at or better than §5**, with `-p tsconfig.app.json` and from the repo root.
8. **No `args` blob stored verbatim** unless the operator decided otherwise out loud — the
   proposal's own G-6 names it as a failure mode.
