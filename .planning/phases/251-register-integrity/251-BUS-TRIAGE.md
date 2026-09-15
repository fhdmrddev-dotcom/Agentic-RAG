---
type: bus-triage
phase: 251
plan: "04"
requirement: REG-03
derived: 2026-09-16
derived_by: claude (executor, plan 251-04)
scope: "the 5 CURRENTLY open `to:operator` items (D-12). The 26 open `to:gemini` are OUT OF SCOPE by D-15 and counted below, never ruled on."
bus_writes: 0
---

# Phase 251 — the operator's bus queue, triaged

⛔ **CLAUDE HAS WRITTEN NOTHING TO THE BUS, AND THIS DOCUMENT IS NOT A CLOSURE.** D-13 is absolute:
*an item closed without the operator seeing it is a decision taken by the wrong party.* No task in
this plan called `agent-bus.sh open`, `answer` or `close`; `git diff --name-only .agent-bus/` is
**empty**, asserted at every commit. **This is a LIST YOU RULE ON.** The exact commands are at the
bottom, pre-filled with the ids, and they are yours to run.

**Read this in one sitting.** Five items, three classes, one line of question each.

---

## The queue, measured

| | count |
|---|---|
| open `to:operator` — **this document's scope** | **5** |
| open `to:gemini` — ⛔ **out of scope (D-15)**, counted so its size stops being invisible | **26** |
| open `to:claude` | **1** (`BUS-171`, the item that asked for this triage) |
| **open, total** | **32** |
| closed | **212** |

Counted with `grep -cE '^### \[OPEN\].*to:<party>'` — ⛔ **never `| tail`.** That mistake hid this
very queue's size twice on 2026-09-06 and published a wrong backend baseline on another day. Ages by
`scripts/lib/bus-age.sh`'s `age_days`, which is now the **one** home for that computation.

⭐ **The size and the oldest age now print at every session start.** `.claude/hooks/agent-bus-check.sh`
was extended in this plan and reads, live:

```
AGENT BUS — 5 open to:operator, oldest 15 days · 26 open to:gemini (gemini's to answer) · 1 open to:claude
  List them:  bash scripts/agent-bus.sh list --to operator
```

That line is D-14's whole point: *the queue went 23 → 5 because a person noticed, with no mechanism
involved.* It prints only when the count is non-zero, so an empty queue is still silent.

---

## The five items

Each carries exactly one of D-13's three classes. **Superseded** names its evidence — a commit, a
file, a phase. **Live decision** states the question in one line so you can rule without re-reading
the item. **Carries an unfixed finding** names the durable register that holds it, or the seed
planted here because none did.

### 1 · `BUS-040` — 15 days — ✅ **SUPERSEDED**

**What it is actually asking:** the 2026-08-31 session-4 handover. Three operator actions plus four
findings it explicitly did not fix.

**Evidence it is discharged:**

| BUS-040 asked for | state today | evidence |
|---|---|---|
| revoke the Zhipu/GLM + Moonshot/Kimi keys published in `e5977a24` | **DONE** — operator revoked 2026-09-14 | recorded in `BUS-208`'s own body |
| reconnect Google with the working org active | **carried forward** | `BUS-208` |
| enable Sheets + Docs in Cloud project `877112366454` | **carried forward** (the `api_off` UAT row) | `BUS-208` |
| check the OAuth consent screen's publishing status | **carried forward** — still in Testing | `BUS-208` |

⛔ **BUT `BUS-208` DOES NOT CARRY FORWARD THE FOUR "FOUND AND DID NOT FIX" FINDINGS**, so the third
arm was run on each one before recommending anything:

| the finding | held by | verdict |
|---|---|---|
| Microsoft 365 shows `OAuth connected · ✓ Ready` with **zero tools** | `.planning/reported-bugs/BUG-260907-01-source-only-connection-reads-not-usable.md:75` — *"it was written because Microsoft 365 once claimed `✓ Ready` with zero tools"* — and `docs/HOT-FILE-LEDGER.md:10098` | ✅ HELD |
| the starter chips are hardcoded at `ChatArea.tsx:461` | `docs/HOT-FILE-LEDGER.md:12876-12877` (names both chips verbatim) and `BUG-260911-02`, which uses them as a live discriminator | ✅ HELD |
| three chat suites in **neither** count-gate knob | `.planning/seeds/SEED-280-five-suites-in-neither-count-gate-knob.md:45-46` — names `ToolApproval`, `MessageInput.connectors`, `MessageInputDrafts` explicitly | ✅ HELD |
| the folder scope picker exists **only on the empty state**, so a thread's scope cannot be changed once it starts | ⛔ **NOTHING** | ⭐ **PLANTED as `SEED-286`** |

⭐ **The third arm paid for itself again, and this is the second consecutive time.** `SEED-112` looks
like the holder and is not — it is the **workflow-run** KB scope surface, a different question;
`SEED-247` is thread-scoped *attachments*. Neither holds the chat-thread scope gap. Verified in the
source rather than inferred: `ChatArea.tsx:570` opens `if (!thread) { return (`, the `<select>` sits
at `:611` inside it, and `scopeFolderId` is read exactly once at `:404` as a thread-**creation**
argument. There is no extracted component to grep for — `rg -l "ScopePicker" frontend/src` is empty —
which is part of why it was invisible.

**Recommendation:** close. Its live arms are carried by `BUS-208`; its four findings are now all held
by a durable register.

---

### 2 · `BUS-208` — 2 days — ⚠ **LIVE DECISION**

**What it is actually asking:** *"`e5977a244` still contains the four literal keys and IS an ancestor
of `origin/production`. The repo is PRIVATE and the keys are now dead, so I recommend AGAINST
rewriting shared history. Say so if you disagree and I will scope it."*

**The question, in one line:** ⭐ **Do you accept `private repo + revoked keys` as the end state, or
do you want git history rewritten?**

**Everything else in this item is an owed ACTION, not a decision** — listed so a close does not lose
it, and none of it needs a ruling:

- your local `backend/.env` still holds the **revoked** `ZHIPU_API_KEY` and `MOONSHOT_API_KEY`
  (measured presence-only). Every local run on GLM or Moonshot fails with a provider auth error that
  looks like a code defect.
- **cloud is a second place:** `app_settings.zhipu_api_key` / `.moonshot_api_key` are both NULL in
  production, so live reads these from **Coolify env vars** — update them there too.
- ⚠ it hits the mandatory UAT roster: Zhipu/GLM is row 5 and Moonshot/Kimi is row 7, and **row 7 is
  the only `emit_tier: coerce` native row in the registry** — the weakest emission guarantee we ship,
  so it is the row least worth silently losing.
- the OAuth consent screen is still in **Testing** mode → refresh tokens die every 7 days.
- the `api_off` UAT row is unrun: disable Sheets in `877112366454`, press Check, confirm only Sheets
  reports `api_off` with a working link, re-enable, press Check, confirm the line disappears.

**Recommendation:** answer the history question, then close. ⚠ **If you close it without answering,
the four owed actions above leave the register** — they are held by nothing but this item.

---

### 3 · `BUS-246` — 1 day — ⚠ **LIVE DECISION**

**What it is actually asking:** Phase 249 (*The Model You Actually Run*) is closed; five things are
owed and each needs you, not claude.

**The question, in one line:** ⭐ **Which of the five owed rows do you want run, and do you want
`qwen3-coder:30b` left in the registry?** (It was left **disabled**, as visible evidence, and is one
click to remove.)

**The number worth your attention, restated because it is the item's headline:** **13 of your
configured models run with tool calling silently disabled** — 5 OpenRouter, 6 Ollama, 2 LM Studio —
and the model your composer had selected was one of them. ⚠ `BUS-247` then re-measured this as **16**,
not 13; see below.

**Findings check (third arm):** the only finding this item carries beyond the phase record is
`SEED-172` finding #2 — `get_llm_client` sets no `timeout=`, so httpx's 600 s read timeout binds and
`max_retries=2` triples the attempt. ✅ **HELD**, verbatim, at
`.planning/seeds/SEED-172-local-llm-providers-cannot-be-added-through-the-registry.md:87-104,301`,
where it is marked ⛔ **OPEN** with a re-open trigger. The two-uvicorn environment finding is held by
the project memory `reference_stale_uvicorn_workers_hold_port_8000`. **Nothing needs planting.**

**Recommendation:** rule on the owed rows, then close — or leave open until they are run. Either is
defensible; this is a "which rows" question, not a "is it finished" one.

---

### 4 · `BUS-247` — 1 day — ⚠ **LIVE DECISION**

**What it is actually asking:** the `/gsd:code-review 249` follow-up. **Both blockers it found are
already fixed and driven**, so this item is not asking for repair work.

**The question, in one line:** ⭐ **Does `DEBT-06` stay a standing gate, given that a self-verified
close shipped two blockers that no gate could have caught?**

That is the item's real content, and it makes the case in one paragraph: **every gate was green, six
fences were driven red against planted defects, three scenarios were driven in a live browser — and
CR-01 and CR-02 were both present.** CR-01 is a disagreement between two components whose individual
tests are each correct; CR-02 is a warning that correctly does not fire by its own implementation's
logic. Neither is gate-catchable. ⭐ **A code-review pass is not a peer review**, and that sentence is
the argument for `DEBT-06` rather than an apology.

**Findings check (third arm):**

| finding | held by |
|---|---|
| `DEBT-06` — independent §6.3 review owed by 238/240/241/249/250 | ✅ `.planning/REQUIREMENTS.md:168,286` (a milestone-wide **standing gate**, no phase) and `.planning/STATE.md:241,382` |
| the count gate's `failed 1` on `WorkflowBuilderPage.canvas.test.tsx` | ✅ `.planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md` — its **fifth** named suite |

⭐ **And the item did the triage correctly rather than re-running for a green:** the failing name was
captured from the gate's persisted JSON *before* any re-run, the worker cap was left at 2, and the
diff proved the phase touched neither `frontend/src/pages` nor `components/workflows`. That is
CLAUDE.md's rule followed exactly, recorded here because `BUS-040` recorded the opposite slip on
itself.

**Recommendation:** rule on `DEBT-06`, then close. Nothing to plant.

---

### 5 · `BUS-248` — 0 days — ⚠ **LIVE DECISION** (two of them)

**What it is actually asking:** Phase 250 (*Run Honesty — the residue*) is closed; **two calls are
explicitly yours.**

**The questions, one line each:**

1. ⭐ **THE WORD.** An unfinished todo on an ended run now reads **`NOT TICKED`** instead of
   `(run ended - not completed)`. The word was taken from your own report — *"the to dos is not up to
   date and ticked as completed"* — because it describes the **agent's bookkeeping** rather than
   judging whether your job got done. **One constant** in
   `frontend/src/components/panel/todoRunHonesty.ts` if you want different words.
2. ⚠ **G-2 SKETCH DECLINED.** `/gsd:sketch` was not run, on the ground that `SEED-105` (planted
   2026-07-06 at your own live UAT) plus `references/run-state-honesty.md` D1 already carry an
   operator-approved vocabulary, and the change is one existing row gaining a fourth status word.
   ⛔ **That is a guardrail call made without you present** — the item says so itself rather than
   letting it pass silently. Ratify it or ask for the sketch.

**What to look at first, from the item:** open the *"Translate Full Doc to Arabic PDF"* thread — the
one you complained about. The panel reads **2/5** and the three unfinished items say `NOT TICKED`;
hover one for the reason. Then open any *"generate weekly report"* thread from 2026-08-31 — that todo
was **never touched by the reconciler and reads honestly anyway**, which is why this phase ships no
migration and no backfill.

⭐ **The measurement came first and changed the phase.** The ROADMAP blocked planning on an either/or;
measured live, **both arms were true of different rows** — 78 open todos across 26 threads, 25 marked,
53 unmarked of which 49 predate the reconciler. One measurement answered two requirements.

**Findings check (third arm):** the vocabulary decision is held by ✅ `SEED-105`
(`.planning/seeds/SEED-105-run-state-aware-todos-panel.md`); the review debt by ✅ `DEBT-06`. The owed
rows (the live mirror-image control, HONEST-02 per-provider behavioural rows, the parallel-thread
axis) are held by the phase record at `.planning/phases/250-run-honesty-the-residue/`. **Nothing needs
planting.**

**Recommendation:** rule on the word and on the declined sketch, then close.

---

## `BUS-171` — discharged IN WRITING, and NOT closed by claude (D-12 / D-13)

`BUS-171` (2026-09-06, **from: operator**, to: claude — 9 days) is the instruction that produced this
triage. It reads: *"23 items are open --to operator (BUS-019, 026, 028, 034, 036-046, 050, 055, 071,
094, 097, 114, 117, 138, 169)."*

⛔ **That count was already stale when this phase was scoped, and the goal is met while the number is
not.** Re-derived here against both bus files, not read off a summary:

| | |
|---|---|
| items BUS-171 named | **23** |
| of those, **CLOSED** today | **22** |
| of those, still open | **1** — `BUS-040`, triaged above as **superseded** |
| currently-open `to:operator` items **NEWER than BUS-171 itself** | **4** — `BUS-208`, `BUS-246`, `BUS-247`, `BUS-248` |

**The triage it asked for already ran**, at commit **`88a9ff861`** (2026-09-14) —
*"docs(BUS-171): triage delivered — and one true orphan found by its third arm."* ⭐ **Its third arm
found a real orphan and planted `SEED-276`**
(`.planning/seeds/SEED-276-localhost-resolves-ipv6-first-while-uvicorn-binds-ipv4-only.md`, 90 lines),
which is the proof the arm is not ceremony — and the reason it was run again, item by item, above.

⭐ **This is an honest re-scope recorded at discuss-phase, not a quiet narrowing.** `BUS-171`'s
REQUIREMENT is *"the operator's queue is a list they can rule on"*; that is delivered. Its stated
COUNT of 23 described a queue that no longer exists — 22 of the 23 are closed and 4 of today's 5 items
did not exist when it was written. **The goal is met; the number was stale, and both halves are said
out loud rather than one being quietly dropped.**

⛔ **Claude does not close `BUS-171` either.** It is addressed to claude, which makes closing it look
harmless — and it is exactly the case where the temptation is strongest, because claude would be
marking its own homework. The command is at the bottom with the others.

---

## Out of scope, named with its size — the 26 open `to:gemini` (D-15)

They are **gemini's to answer**, and ruling on them here would be one agent deciding another's queue.
Counted, never triaged:

| | count |
|---|---|
| open `to:gemini` | **26** |
| open overall | **32** |
| closed overall | **212** |

⚠ **They are no longer invisible**: the SessionStart hook prints that 26 on the same line as your own
queue, every session, so its growth is a number you see rather than one somebody has to go and count.

**Re-open trigger for this exclusion — write it down rather than leaving it to notice:**

1. **any one of the 26 is found to carry an unfixed finding held by no durable register** — the same
   arm that found `SEED-286` here and `SEED-276` at `88a9ff861`. ⚠ The 2026-09-06 sweep of gemini's
   own queue already found two such items (`BUS-049`'s org-wide-outage finding held only by
   `SEED-239`; `BUS-010`'s W-1 held only by `BUG-260815-05`), so the rate is **not** zero; **or**
2. the count crosses a threshold you care about — it is printed at every session start, so you will
   see it move.

---

## The commands — ⛔ YOURS TO RUN, NOT CLAUDE'S

Answer first, then close. `agent-bus.sh close` refuses an item that is already closed or whose header
is malformed, so a wrong id fails loudly rather than silently.

```bash
# 1 · BUS-040 — superseded; live arms carried by BUS-208, all four findings now held
bash scripts/agent-bus.sh answer BUS-040 "Superseded. Keys revoked 2026-09-14; the reconnect/API/consent arms are carried by BUS-208; the four unfixed findings are held by BUG-260907-01, docs/HOT-FILE-LEDGER.md, SEED-280 and the newly planted SEED-286."
bash scripts/agent-bus.sh close  BUS-040

# 2 · BUS-208 — needs your ruling on git history; then the four owed actions are yours
bash scripts/agent-bus.sh answer BUS-208 "<accept private-repo + revoked-keys as the end state, OR ask for a history rewrite>"
bash scripts/agent-bus.sh close  BUS-208

# 3 · BUS-246 — which of the five owed rows to run; keep or remove qwen3-coder:30b
bash scripts/agent-bus.sh answer BUS-246 "<which owed rows; keep or remove qwen3-coder:30b>"
bash scripts/agent-bus.sh close  BUS-246

# 4 · BUS-247 — does DEBT-06 stay a standing gate
bash scripts/agent-bus.sh answer BUS-247 "<DEBT-06 stays a standing gate / is discharged differently>"
bash scripts/agent-bus.sh close  BUS-247

# 5 · BUS-248 — the word, and the declined G-2 sketch
bash scripts/agent-bus.sh answer BUS-248 "<keep 'NOT TICKED' or give the replacement words; ratify the declined sketch or ask for it>"
bash scripts/agent-bus.sh close  BUS-248

# 6 · BUS-171 — the instruction that produced this document. Claude does not close it for itself.
bash scripts/agent-bus.sh answer BUS-171 "Triage delivered: .planning/phases/251-register-integrity/251-BUS-TRIAGE.md. The 23-item premise was discharged at 88a9ff861 (2026-09-14) — 22 of 23 closed, and 4 of today's 5 open items are newer than this one."
bash scripts/agent-bus.sh close  BUS-171
```

⚠ **After closing, `bash scripts/agent-bus.sh archive` sweeps CLOSED items out of `OPEN.md`.** Ids are
allocated from **both** files, so an archived id can never be reused and an answer can never land on
the wrong question.

---

## What this document changed on disk

| | |
|---|---|
| bus items opened, answered or closed by claude | ⛔ **0** — `git diff --name-only .agent-bus/` is EMPTY |
| seeds planted | **1** — `SEED-286`, id derived as `max(id)+1 = 286` by the allocator's own rule |
| register verdict after planting | `seeds register gate OK — 293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys` (exit 0) |

⛔ **`286`, not `285`.** `285` was already taken before this phase began, and Plan 03 consumed
`277-284` with exactly zero headroom. The **old count-based allocator would have emitted `SEED-285`
and collided** — measured here, not assumed: `distinct ids: 284`, so `count+1 = 285`, **which exists.**
That is the `max(id)+1` allocator Wave 2 shipped getting its first real exercise, and it was the right
answer on the first seed planted after it.
